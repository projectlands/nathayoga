/**
 * YOGA RESERVATION SYSTEM - BACKEND API (PREMIUM VERSION)
 * Built with Google Apps Script
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_CLASSES = getOrCreateSheet("classes");
const SHEET_RESERVATIONS = getOrCreateSheet("reservations");
const SHEET_MEMBERSHIP_PACKAGES = getOrCreateSheet("membership_packages");
const SHEET_USER_MEMBERSHIPS = getOrCreateSheet("user_memberships");
const SHEET_PROMOS = getOrCreateSheet("promo_codes");

/**
 * GET Handler
 * ?action=classes
 * ?action=my_bookings&phone=0812...
 */
function doGet(e) {
  const action = e.parameter.action;
  
  try {
    if (action === "classes") {
      return getClasses();
    }
    if (action === "my_bookings") {
      return getMyBookings(e.parameter.phone);
    }
    if (action === "checkin") {
      return handleCheckin(e.parameter.booking_id);
    }
    if (action === "generate_token") {
      return handleGenerateToken(e.parameter.class_id);
    }
    if (action === "checkin_self") {
      return handleCheckinSelf(e.parameter.token, e.parameter.phone, e.parameter.booking_id);
    }
    if (action === "attendance_list") {
      return handleAttendanceList(e.parameter.class_id);
    }
    if (action === "settings") {
      return handleGetSettings();
    }
    if (action === "scan_user") {
      return handleScanUser(e.parameter.booking_id);
    }
    if (action === "admin_bookings") {
      return handleGetAdminBookings();
    }
    if (action === "update_status") {
      return handleUpdateStatus(e.parameter.booking_id, e.parameter.type, e.parameter.value);
    }
    if (action === "dashboard_stats") {
      return handleGetDashboardStats();
    }
    if (action === "membership_packages") {
      return responseJSON({ success: true, data: getSheetData(SHEET_MEMBERSHIP_PACKAGES) });
    }
    if (action === "user_memberships") {
      return handleGetUserMemberships(e.parameter.phone);
    }
    if (action === "membership_stats") {
      return handleGetMembershipStats();
    }
    if (action === "promos") {
      return responseJSON({ success: true, data: getSheetData(SHEET_PROMOS) });
    }
    if (action === "validate_promo") {
      return handleValidatePromo(e.parameter.code, e.parameter.phone, e.parameter.amount);
    }
    if (action === "promo_stats") {
      return handleGetPromoStats();
    }
    return responseJSON({ success: false, message: "Action not found" });
  } catch (err) {
    return responseJSON({ success: false, message: err.toString() });
  }
}

/**
 * Handle POST - Booking, Membership, Promo
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // ACTION: Create Membership (Admin)
    if (data.action === "create_membership") return handleCreateMembership(data);
    
    // ACTION: Create Promo (Admin)
    if (data.action === "create_promo") return handleCreatePromo(data);
    
    // ACTION: Booking Class
    if (!data.name || !data.phone || !data.class_id) {
      return responseJSON({ success: false, message: "Missing required fields" });
    }

    const classes = getSheetData(SHEET_CLASSES);
    const cls = classes.find(c => c.id == data.class_id);
    if (!cls) return responseJSON({ success: false, message: "Class not found" });
    if (cls.quota <= 0) return responseJSON({ success: false, message: "Class full" });

    // 1. Membership Logic
    let bookingSource = "pay_per_class";
    const membership = findActiveMembership(data.phone);
    if (membership) {
      if (membership.type === "session" && membership.remaining > 0) {
        bookingSource = "membership";
        updateMembershipSession(membership.id, -1);
      } else if (membership.type === "unlimited") {
        bookingSource = "membership";
      }
    }

    // 2. Promo Logic
    let discountAmount = 0;
    let promoUsed = "";
    if (data.promo_code && bookingSource === "pay_per_class") {
       const v = handleValidatePromo(data.promo_code, data.phone, cls.price);
       if (v.success) {
         discountAmount = v.discount;
         promoUsed = data.promo_code;
         incrementPromoUsage(data.promo_code);
       }
    }

    const bookingId = "BK-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    SHEET_RESERVATIONS.appendRow([
      bookingId,
      data.class_id,
      data.name,
      data.phone,
      "pending",
      new Date(),
      "pending", // payment_status
      bookingSource,
      promoUsed,
      discountAmount,
      cls.price - discountAmount // final_amount
    ]);

    updateQuota(data.class_id, -1);

    return responseJSON({
      success: true,
      booking_id: bookingId,
      source: bookingSource,
      discount: discountAmount,
      final_price: cls.price - discountAmount
    });
  } catch (err) {
    return responseJSON({ success: false, message: err.toString() });
  }
}

/**
 * Promo Helpers
 */
function handleValidatePromo(code, phone, amount) {
  const promos = getSheetData(SHEET_PROMOS);
  const promo = promos.find(p => p.code === code.toUpperCase() && p.status === "active");
  
  if (!promo) return { success: false, message: "Voucher tidak valid" };
  if (new Date(promo.expired_at) < new Date()) return { success: false, message: "Voucher kadaluarsa" };
  if (promo.used_count >= promo.max_usage) return { success: false, message: "Kuota voucher habis" };
  if (amount < promo.minimum_payment) return { success: false, message: "Minimal transaksi belum terpenuhi" };
  
  // Calculate Discount
  let discount = 0;
  if (promo.type === "percentage") {
    discount = (amount * promo.value) / 100;
  } else {
    discount = promo.value;
  }
  
  return { success: true, discount: discount, message: "Voucher berhasil dipasang" };
}

function incrementPromoUsage(code) {
  const data = SHEET_PROMOS.getDataRange().getValues();
  const idx = data.findIndex(r => r[1] === code.toUpperCase());
  if (idx !== -1) {
    const current = SHEET_PROMOS.getRange(idx + 1, 6).getValue();
    SHEET_PROMOS.getRange(idx + 1, 6).setValue(current + 1);
  }
}

function handleCreatePromo(data) {
  const id = "PR-" + Utilities.getUuid().substring(0, 6).toUpperCase();
  SHEET_PROMOS.appendRow([
    id,
    data.code.toUpperCase(),
    data.type,
    data.value,
    data.max_usage,
    0, // used_count
    data.expired_at,
    data.minimum_payment || 0,
    data.member_only || false,
    "active"
  ]);
  return responseJSON({ success: true, message: "Promo created" });
}

function handleGetPromoStats() {
  const data = getSheetData(SHEET_PROMOS);
  return responseJSON({
    success: true,
    data: {
      total_active: data.filter(p => p.status === "active").length,
      total_usage: data.reduce((acc, p) => acc + p.used_count, 0)
    }
  });
}

/**
 * Get Membership Statistics
 */
function handleGetMembershipStats() {
  const data = getSheetData(SHEET_USER_MEMBERSHIPS);
  const packages = getSheetData(SHEET_MEMBERSHIP_PACKAGES);
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);
  
  const stats = {
    total_active: data.filter(m => m.status === "active" && new Date(m.expired_at) > now).length,
    exhausted: data.filter(m => m.status === "exhausted" || (m.membership_type === "session" && m.remaining_sessions <= 0)).length,
    expiring_soon: data.filter(m => {
      const exp = new Date(m.expired_at);
      return m.status === "active" && exp > now && exp < nextWeek;
    }).length,
    total_revenue: data.reduce((acc, m) => {
       const pkg = packages.find(p => p.id == m.package_id);
       return acc + (pkg ? pkg.price : 0);
    }, 0)
  };
  
  return responseJSON({ success: true, data: stats });
}

/**
 * Get All Bookings for Admin
 */
function handleGetAdminBookings() {
  const data = SHEET_RESERVATIONS.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).reverse(); // Newest first
  
  const classes = getSheetData(SHEET_CLASSES);
  
  const bookings = rows.map(row => {
    const cls = classes.find(c => c.id == row[1]);
    return {
      id: row[0],
      class_id: row[1],
      class_title: cls ? cls.title : "Unknown",
      class_date: cls ? cls.formatted_date : "",
      class_time: cls ? cls.formatted_time : "",
      name: row[2],
      phone: row[3],
      status: row[headers.indexOf("status")] || "pending",
      payment_status: row[headers.indexOf("payment_status")] || "pending",
      checkin_at: row[headers.indexOf("checkin_at")] || null,
      created_at: row[headers.indexOf("created_at")]
    };
  });
  
  return responseJSON({ success: true, data: bookings });
}

/**
 * Update Payment or Attendance Status
 */
function handleUpdateStatus(bookingId, type, value) {
  if (!bookingId || !type || !value) return responseJSON({ success: false, message: "Missing params" });
  
  const data = SHEET_RESERVATIONS.getDataRange().getValues();
  const headers = data[0];
  const rowIndex = data.findIndex(row => row[0] === bookingId);
  
  if (rowIndex === -1) return responseJSON({ success: false, message: "Booking not found" });
  
  const colIndex = headers.indexOf(type);
  if (colIndex === -1) {
    // If column doesn't exist, append it
    SHEET_RESERVATIONS.getRange(1, headers.length + 1).setValue(type);
    SHEET_RESERVATIONS.getRange(rowIndex + 1, headers.length + 1).setValue(value);
  } else {
    SHEET_RESERVATIONS.getRange(rowIndex + 1, colIndex + 1).setValue(value);
  }
  
  // Record update time
  const updateIdx = headers.indexOf("updated_at");
  if (updateIdx !== -1) SHEET_RESERVATIONS.getRange(rowIndex + 1, updateIdx + 1).setValue(new Date());
  
  return responseJSON({ success: true, message: `Status ${type} updated to ${value}` });
}

/**
 * Get Dashboard Statistics
 */
function handleGetDashboardStats() {
  const data = SHEET_RESERVATIONS.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const classes = getSheetData(SHEET_CLASSES);
  
  const payIdx = headers.indexOf("payment_status");
  const statIdx = headers.indexOf("status");
  
  const stats = {
    total_bookings: rows.length,
    total_paid: rows.filter(r => r[payIdx] === "paid").length,
    total_pending: rows.filter(r => r[payIdx] === "pending" || !r[payIdx]).length,
    attendance_today: rows.filter(r => r[statIdx] === "checked_in").length,
    revenue_est: rows.filter(r => r[payIdx] === "paid").reduce((acc, r) => {
       const cls = classes.find(c => c.id == r[1]);
       return acc + (cls ? cls.price : 0);
    }, 0)
  };
  
  return responseJSON({ success: true, data: stats });
}

/**
 * Get System Settings
 */
function handleGetSettings() {
  let sheetSettings = SS.getSheetByName("settings");
  if (!sheetSettings) {
    sheetSettings = SS.insertSheet("settings");
    sheetSettings.appendRow(["key", "value"]);
    sheetSettings.appendRow(["checkin_mode", "class_qr"]); // Default mode
  }
  
  const data = sheetSettings.getDataRange().getValues().slice(1);
  const settings = {};
  data.forEach(row => settings[row[0]] = row[1]);
  
  return responseJSON({ success: true, data: settings });
}

/**
 * Handle Admin Scanning User QR
 */
function handleScanUser(bookingId) {
  if (!bookingId) return responseJSON({ success: false, message: "Booking ID required" });
  
  const data = SHEET_RESERVATIONS.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const rowIndex = rows.findIndex(row => row[0] === bookingId);
  if (rowIndex === -1) return responseJSON({ success: false, message: "Booking ID tidak ditemukan" });
  
  const reservation = rows[rowIndex];
  const statusIndex = headers.indexOf("status");
  
  if (reservation[statusIndex] === "checked_in") {
    return responseJSON({ success: false, message: "Peserta sudah check-in", data: { name: reservation[2] } });
  }

  // Update Status
  SHEET_RESERVATIONS.getRange(rowIndex + 2, statusIndex + 1).setValue("checked_in");
  const checkinIndex = headers.indexOf("checkin_at");
  if (checkinIndex !== -1) {
    SHEET_RESERVATIONS.getRange(rowIndex + 2, checkinIndex + 1).setValue(new Date());
  }

  return responseJSON({
    success: true,
    message: "Check-in Berhasil!",
    data: { name: reservation[2] }
  });
}

/**
 * Generate Dynamic Token for Class Session
 */
function handleGenerateToken(classId) {
  if (!classId) return responseJSON({ success: false, message: "Class ID required" });
  
  const token = "SES-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  const expiry = new Date(new Date().getTime() + 60 * 60 * 1000); // 1 hour expiry
  
  // Store token in a dedicated sheet or PropertyService
  // For simplicity & persistence, we'll use a new sheet 'sessions'
  let sheetSessions = SS.getSheetByName("sessions");
  if (!sheetSessions) {
    sheetSessions = SS.insertSheet("sessions");
    sheetSessions.appendRow(["token", "class_id", "created_at", "expired_at"]);
  }
  
  sheetSessions.appendRow([token, classId, new Date(), expiry]);
  
  return responseJSON({
    success: true,
    data: { token, expiry: expiry.toISOString(), class_id: classId }
  });
}

/**
 * Handle Self Check-in by Participant
 */
function handleCheckinSelf(token, phone, bookingId) {
  if (!token || (!phone && !bookingId)) return responseJSON({ success: false, message: "Missing required data" });
  
  // 1. Validate Token
  const sheetSessions = SS.getSheetByName("sessions");
  if (!sheetSessions) return responseJSON({ success: false, message: "System Error: No sessions found" });
  
  const sessions = sheetSessions.getDataRange().getValues().slice(1);
  const session = sessions.find(s => s[0] === token);
  
  if (!session) return responseJSON({ success: false, message: "Token tidak valid" });
  if (new Date() > new Date(session[3])) return responseJSON({ success: false, message: "Token sudah kadaluwarsa" });
  
  const classId = session[1];
  
  // 2. Find and Validate Booking
  const data = SHEET_RESERVATIONS.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  // Search by Phone or Booking ID
  const rowIndex = rows.findIndex(row => {
    const matchUser = (phone && normalizePhone(row[3]) === normalizePhone(phone)) || (bookingId && row[0] === bookingId);
    return matchUser && row[1] == classId;
  });
  
  if (rowIndex === -1) return responseJSON({ success: false, message: "Booking tidak ditemukan untuk kelas ini" });
  
  const reservation = rows[rowIndex];
  const statusIndex = headers.indexOf("status");
  
  if (reservation[statusIndex] === "checked_in") {
    return responseJSON({ success: true, message: "Anda sudah check-in sebelumnya", already: true });
  }

  // 3. Update Check-in
  SHEET_RESERVATIONS.getRange(rowIndex + 2, statusIndex + 1).setValue("checked_in");
  const checkinIndex = headers.indexOf("checkin_at");
  if (checkinIndex !== -1) {
    SHEET_RESERVATIONS.getRange(rowIndex + 2, checkinIndex + 1).setValue(new Date());
  }

  return responseJSON({
    success: true,
    message: "Check-in Berhasil!",
    data: { name: reservation[2] }
  });
}

/**
 * Get Realtime Attendance List for Admin
 */
function handleAttendanceList(classId) {
  if (!classId) return responseJSON({ success: false, message: "Class ID required" });
  
  const reservations = SHEET_RESERVATIONS.getDataRange().getValues().slice(1);
  const headers = SHEET_RESERVATIONS.getDataRange().getValues()[0];
  const statusIndex = headers.indexOf("status");
  
  const attendees = reservations
    .filter(r => r[1] == classId && r[statusIndex] === "checked_in")
    .map(r => ({
      id: r[0],
      name: r[2],
      checkin_at: r[headers.indexOf("checkin_at")]
    }));
    
  return responseJSON({
    success: true,
    data: {
      total_present: attendees.length,
      list: attendees
    }
  });
}

/**
 * Handle Admin Check-in
 */
function handleCheckin(bookingId) {
  if (!bookingId) return responseJSON({ success: false, message: "Booking ID required" });
  
  const data = SHEET_RESERVATIONS.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const rowIndex = rows.findIndex(row => row[0] === bookingId);
  if (rowIndex === -1) return responseJSON({ success: false, message: "Booking ID tidak ditemukan" });
  
  const reservation = rows[rowIndex];
  const statusIndex = headers.indexOf("status");
  const checkinIndex = headers.indexOf("checkin_at");
  
  // Validation
  if (reservation[statusIndex] === "checked_in") {
    return responseJSON({ 
      success: false, 
      message: "Peserta sudah check-in sebelumnya",
      data: { name: reservation[2] } 
    });
  }
  
  if (reservation[statusIndex] === "cancelled") {
    return responseJSON({ success: false, message: "Booking ini telah dibatalkan" });
  }

  // Update Status & Time
  // Row index in sheet is rowIndex + 2 (1-based + header)
  SHEET_RESERVATIONS.getRange(rowIndex + 2, statusIndex + 1).setValue("checked_in");
  
  // Add checkin_at column if not exist or just update it
  // We assume headers are: id, class_id, name, phone, status, created_at, checkin_at
  if (checkinIndex === -1) {
    SHEET_RESERVATIONS.getRange(1, headers.length + 1).setValue("checkin_at");
    SHEET_RESERVATIONS.getRange(rowIndex + 2, headers.length + 1).setValue(new Date());
  } else {
    SHEET_RESERVATIONS.getRange(rowIndex + 2, checkinIndex + 1).setValue(new Date());
  }

  // Get Class Info for Response
  const classes = getSheetData(SHEET_CLASSES);
  const cls = classes.find(c => c.id == reservation[1]);

  return responseJSON({
    success: true,
    message: "Check-in Berhasil!",
    data: {
      name: reservation[2],
      class_title: cls ? cls.title : "Unknown",
      class_time: cls ? formatTime(cls.time) : ""
    }
  });
}

/**
 * POST Handler
 * Body: { class_id, name, phone }
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return createBooking(data);
  } catch (err) {
    return responseJSON({ success: false, message: "Invalid JSON or Server Error: " + err.toString() });
  }
}

/**
 * Get active yoga classes with formatted date and time
 */
function getClasses() {
  const data = getSheetData(SHEET_CLASSES);
  const activeClasses = data.filter(item => item.status === "active").map(item => {
    if (item.date) item.formatted_date = formatIndonesianDate(item.date);
    if (item.time) item.formatted_time = formatTime(item.time);
    return item;
  });
  
  return responseJSON({ success: true, data: activeClasses });
}

/**
 * Get bookings for a specific phone number
 */
function getMyBookings(phone) {
  if (!phone) return responseJSON({ success: false, message: "Phone number required" });
  
  const reservations = getSheetData(SHEET_RESERVATIONS);
  const classes = getSheetData(SHEET_CLASSES);
  
  // Normalisasi nomor HP pencari (hanya angka)
  const searchPhoneClean = phone.toString().replace(/[^0-9]/g, "");
  
  const userBookings = reservations.filter(r => {
    // Normalisasi nomor HP dari sheet (hanya angka)
    const storedPhoneClean = r.phone.toString().replace(/[^0-9]/g, "");
    return storedPhoneClean === searchPhoneClean;
  });
  
  const detailedBookings = userBookings.map(r => {
    const cls = classes.find(c => c.id == r.class_id);
    return {
      ...r,
      class_title: cls ? cls.title : "Unknown",
      class_date: cls ? formatIndonesianDate(cls.date) : "Unknown",
      class_time: cls ? formatTime(cls.time) : "Unknown"
    };
  });
  
  return responseJSON({ success: true, data: detailedBookings });
}

/**
 * Create a new booking with sequential ID
 */
function createBooking(payload) {
  const { class_id, name, phone } = payload;

  if (!class_id || !name || !phone) {
    return responseJSON({ success: false, message: "Missing required fields" });
  }

  const classes = getSheetData(SHEET_CLASSES);
  const classIndex = classes.findIndex(c => c.id == class_id);
  const yogaClass = classes[classIndex];

  if (!yogaClass) return responseJSON({ success: false, message: "Class not found" });
  if (yogaClass.status !== "active") return responseJSON({ success: false, message: "Class is not active" });
  if (Number(yogaClass.booked) >= Number(yogaClass.quota)) {
    return responseJSON({ success: false, message: "Class quota is full" });
  }

  const reservations = getSheetData(SHEET_RESERVATIONS);
  const isDuplicate = reservations.some(r => r.class_id == class_id && r.phone.toString().replace("'","") == phone);
  if (isDuplicate) {
    return responseJSON({ success: false, message: "You have already booked this class" });
  }

  // Sequential Booking ID: YOGA-YYYYMMDD-001
  const booking_id = generateBookingId();
  
  SHEET_RESERVATIONS.appendRow([
    booking_id,
    class_id,
    name,
    "'" + phone,
    "confirmed",
    new Date()
  ]);

  const bookedCell = SHEET_CLASSES.getRange(classIndex + 2, 7); 
  bookedCell.setValue(Number(yogaClass.booked) + 1);

  return responseJSON({
    success: true,
    message: "Booking confirmed successfully",
    booking_id: booking_id
  });
}

/**
 * ID Generator: YOGA-YYYYMMDD-XXX
 */
function generateBookingId() {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd");
  const data = SHEET_RESERVATIONS.getDataRange().getValues();
  const todayPrefix = `YOGA-${dateStr}-`;
  const count = data.filter(row => row[0].toString().startsWith(todayPrefix)).length + 1;
  const sequence = count.toString().padStart(3, '0');
  return `${todayPrefix}${sequence}`;
}

/**
 * Helpers
 */
function formatIndonesianDate(dateVal) {
  try {
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return dateVal;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch (e) { return dateVal; }
}

function formatTime(timeVal) {
  try {
    const date = new Date(timeVal);
    if (isNaN(date.getTime())) return timeVal;
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "HH:mm");
  } catch (e) { return timeVal; }
}

function getSheetData(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  const rows = values.slice(1);
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let classSheet = ss.getSheetByName("classes");
  if (!classSheet) classSheet = ss.insertSheet("classes");
  classSheet.clear();
  classSheet.appendRow(["id", "title", "instructor", "date", "time", "quota", "booked", "price", "status"]);
  classSheet.appendRow(["C001", "Hatha Flow", "Santi Devi", "2024-06-01", "08:00", 20, 5, 150000, "active"]);
  classSheet.appendRow(["C002", "Vinyasa Power", "Budi Yoga", "2024-06-01", "16:00", 15, 15, 175000, "active"]);
  classSheet.appendRow(["C003", "Yin & Sound", "Maya Angel", "2024-06-02", "10:00", 12, 10, 200000, "active"]);
  
  let resSheet = ss.getSheetByName("reservations");
  if (!resSheet) resSheet = ss.insertSheet("reservations");
  resSheet.clear();
  resSheet.appendRow(["id", "class_id", "name", "phone", "status", "created_at"]);
  
  SpreadsheetApp.getUi().alert("Setup Premium Selesai!");
}
