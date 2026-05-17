/**
 * YOGA RESERVATION SYSTEM - BACKEND API (CONSOLIDATED PREMIUM)
 * Built with Google Apps Script
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_CLASSES = getOrCreateSheet("classes");
const SHEET_SCHEDULES = getOrCreateSheet("schedules");
const SHEET_RESERVATIONS = getOrCreateSheet("reservations");
const SHEET_MEMBERSHIP_PACKAGES = getOrCreateSheet("membership_packages");
const SHEET_USER_MEMBERSHIPS = getOrCreateSheet("user_memberships");
const SHEET_PROMOS = getOrCreateSheet("promo_codes");

/**
 * GET Handler
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    // PUBLIC ACTIONS
    if (action === "classes") return handleGetClasses();
    if (action === "schedules") return handleGetSchedules(e.parameter.date);
    if (action === "settings") return handleGetSettings();
    if (action === "my_bookings") return getMyBookings(e.parameter.phone);
    if (action === "validate_promo") return handleValidatePromo(e.parameter.code, e.parameter.phone, e.parameter.amount);
    
    // ADMIN ACTIONS
    if (action === "admin_bookings") return handleGetAdminBookings();
    if (action === "admin_classes") return responseJSON({ success: true, data: getSheetData(SHEET_CLASSES) });
    if (action === "admin_schedules") return handleGetAdminSchedules();
    if (action === "dashboard_stats") return handleGetDashboardStats();
    if (action === "membership_stats") return handleGetMembershipStats();
    if (action === "promo_stats") return handleGetPromoStats();
    if (action === "validate_conflict") return handleValidateScheduleConflict(e.parameter);
    if (action === "update_status") return handleUpdateStatus(e.parameter.booking_id, e.parameter.type, e.parameter.value);
    
    // CHECK-IN ACTIONS
    if (action === "checkin") return handleCheckin(e.parameter.booking_id);
    if (action === "scan_user") return handleScanUser(e.parameter.booking_id);
    if (action === "generate_token") return handleGenerateToken(e.parameter.class_id, e.parameter.force);
    if (action === "checkin_self") return handleCheckinSelf(e.parameter.token, e.parameter.phone, e.parameter.booking_id);
    if (action === "attendance_list") return handleAttendanceList(e.parameter.class_id);

    // DATA LISTS
    if (action === "membership_packages") return responseJSON({ success: true, data: getSheetData(SHEET_MEMBERSHIP_PACKAGES) });
    if (action === "user_memberships") return handleGetUserMemberships(e.parameter.phone);
    if (action === "promos") return responseJSON({ success: true, data: getSheetData(SHEET_PROMOS) });

    return responseJSON({ success: false, message: "Action not found: " + action });
  } catch (err) {
    return responseJSON({ success: false, message: err.toString() });
  }
}

/**
 * POST Handler
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // CLASS CRUD
    if (action === "create_class") return handleCreateClass(data);
    if (action === "update_class") return handleUpdateClass(data);
    if (action === "delete_class") return handleDeleteClass(data.id);

    // SCHEDULE CRUD
    if (action === "create_schedule") return handleCreateSchedule(data);
    if (action === "update_schedule") return handleUpdateSchedule(data);
    if (action === "delete_schedule") return handleDeleteSchedule(data.id);

    // MEMBERSHIP & PROMO CRUD
    if (action === "create_membership") return handleCreateMembership(data);
    if (action === "create_promo") return handleCreatePromo(data);
    
    // DEFAULT: Booking Class
    if (data.schedule_id || data.class_id) return createBooking(data);

    return responseJSON({ success: false, message: "Invalid POST Action" });
  } catch (err) {
    return responseJSON({ success: false, message: "Server Error: " + err.toString() });
  }
}

/**
 * --- PUBLIC HANDLERS ---
 */
function handleGetClasses() {
  const data = getSheetData(SHEET_CLASSES);
  return responseJSON({ success: true, data: data.filter(c => c.status === "active") });
}

function handleGetSchedules(filterDate) {
  const schedules = getSheetData(SHEET_SCHEDULES);
  const classes = getSheetData(SHEET_CLASSES);
  let activeSchedules = schedules.filter(s => s.status === "active");
  
  if (filterDate) {
    activeSchedules = activeSchedules.filter(s => {
      const sDate = new Date(s.date).toISOString().split('T')[0];
      return sDate === filterDate;
    });
  }

  const result = activeSchedules.map(s => {
    const cls = classes.find(c => c.id === s.class_id);
    return {
      ...s,
      class_title: cls ? cls.title : "Unknown",
      class_thumbnail: cls ? cls.thumbnail : "",
      category: cls ? cls.category : "",
      difficulty: cls ? cls.difficulty : "",
      price: cls ? cls.price : 0,
      formatted_date: formatIndonesianDate(s.date),
      formatted_time: `${formatTime12(s.start_time)} - ${formatTime12(s.end_time)} ${s.timezone}`
    };
  });
  return responseJSON({ success: true, data: result });
}

function getMyBookings(phone) {
  if (!phone) return responseJSON({ success: false, message: "Phone required" });
  const reservations = getSheetData(SHEET_RESERVATIONS);
  const classes = getSheetData(SHEET_CLASSES);
  const schedules = getSheetData(SHEET_SCHEDULES);
  const searchPhone = normalizePhone(phone);
  
  const detailed = reservations.filter(r => normalizePhone(r.phone) === searchPhone).map(r => {
    const cls = classes.find(c => c.id == r.class_id);
    const sch = schedules.find(s => s.id == r.schedule_id);
    return {
      ...r,
      class_title: cls ? cls.title : "Unknown",
      class_date: sch ? formatIndonesianDate(sch.date) : (cls ? formatIndonesianDate(r.created_at) : ""),
      class_time: sch ? `${formatTime12(sch.start_time)} - ${formatTime12(sch.end_time)}` : "",
      price: cls ? parsePrice(cls.price) : 0,
      sch_raw_date: sch ? sch.date : "",
      sch_raw_end_time: sch ? sch.end_time : ""
    };
  });
  return responseJSON({ success: true, data: detailed });
}

/**
 * --- ADMIN HANDLERS ---
 */
function handleGetAdminBookings() {
  const reservations = getSheetData(SHEET_RESERVATIONS);
  const classes = getSheetData(SHEET_CLASSES);
  const schedules = getSheetData(SHEET_SCHEDULES);
  
  const data = reservations.map(r => {
    const cls = classes.find(c => c.id == r.class_id);
    const sch = schedules.find(s => s.id == r.schedule_id);
    return {
      ...r,
      class_title: cls ? cls.title : "Unknown",
      class_date: sch ? formatIndonesianDate(sch.date) : (cls ? formatIndonesianDate(r.created_at) : ""),
      class_time: sch ? `${formatTime12(sch.start_time)} - ${formatTime12(sch.end_time)}` : "",
      price: cls ? parsePrice(cls.price) : 0
    };
  }).reverse();
  return responseJSON({ success: true, data: data });
}

function handleGetDashboardStats() {
  const reservations = getSheetData(SHEET_RESERVATIONS);
  const classes = getSheetData(SHEET_CLASSES);
  
  const paidReservations = reservations.filter(r => r.payment_status === "paid");
  const pendingReservations = reservations.filter(r => r.payment_status === "pending");
  
  const revenue = paidReservations.reduce((acc, r) => {
     const cls = classes.find(c => c.id == r.class_id);
     return acc + (cls ? parsePrice(cls.price) : 0);
  }, 0);

  const pending_revenue = pendingReservations.reduce((acc, r) => {
     const cls = classes.find(c => c.id == r.class_id);
     return acc + (cls ? parsePrice(cls.price) : 0);
  }, 0);

  const stats = {
    total_bookings: reservations.length,
    total_paid: paidReservations.length,
    total_pending: pendingReservations.length,
    revenue: revenue,
    revenue_est: revenue,
    revenue_pending: pending_revenue,
    pending_revenue: pending_revenue,
    attendance_today: reservations.filter(r => r.status === "checked_in" && isToday(r.created_at)).length
  };
  return responseJSON({ success: true, data: stats });
}

function handleUpdateStatus(bookingId, type, value) {
  const data = SHEET_RESERVATIONS.getDataRange().getValues();
  const headers = data[0];
  const colIndex = headers.indexOf(type);
  const rowIndex = data.findIndex(row => row[0] === bookingId);
  if (rowIndex === -1 || colIndex === -1) return responseJSON({ success: false, message: "Not found" });
  SHEET_RESERVATIONS.getRange(rowIndex + 1, colIndex + 1).setValue(value);
  return responseJSON({ success: true });
}

/**
 * --- CRUD HANDLERS ---
 */
function handleCreateClass(data) {
  const id = "CLS-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  SHEET_CLASSES.appendRow([id, data.title, data.description, data.category, data.difficulty, data.duration, data.default_quota, data.thumbnail, "active", new Date(), data.price]);
  return responseJSON({ success: true, id: id });
}

function handleUpdateClass(data) {
  const rows = SHEET_CLASSES.getDataRange().getValues();
  const idx = rows.findIndex(r => r[0] === data.id);
  if (idx === -1) return responseJSON({ success: false });
  const headers = rows[0];
  const updateMap = { title: 1, description: 2, category: 3, difficulty: 4, duration: 5, default_quota: 6, thumbnail: 7, status: 8, price: 10 };
  for (let key in updateMap) {
    if (data[key] !== undefined) SHEET_CLASSES.getRange(idx + 1, updateMap[key] + 1).setValue(data[key]);
  }
  return responseJSON({ success: true });
}

function handleDeleteClass(id) {
  const rows = SHEET_CLASSES.getDataRange().getValues();
  const idx = rows.findIndex(r => r[0] === id);
  if (idx !== -1) SHEET_CLASSES.getRange(idx + 1, 9).setValue("deleted");
  return responseJSON({ success: true });
}

function handleCreateSchedule(data) {
  const conflict = checkScheduleConflict(data);
  if (conflict.isConflict) return responseJSON({ success: false, message: conflict.message });
  let currentDate = new Date(data.date);
  const untilDate = data.recurring_until ? new Date(data.recurring_until) : currentDate;
  let count = 0;
  while (currentDate <= untilDate && count < 50) {
    const sId = `SCH-${Utilities.getUuid().substring(0, 5).toUpperCase()}-${count}`;
    SHEET_SCHEDULES.appendRow([sId, data.class_id, data.instructor, new Date(currentDate), data.start_time, data.end_time, data.timezone || "WITA", data.quota, 0, data.room || "Main Room", data.recurring_type, data.recurring_until, "active", new Date()]);
    if (data.recurring_type === "daily") currentDate.setDate(currentDate.getDate() + 1);
    else if (data.recurring_type === "weekly") currentDate.setDate(currentDate.getDate() + 7);
    else if (data.recurring_type === "monthly") currentDate.setMonth(currentDate.getMonth() + 1);
    else break;
    count++;
  }
  return responseJSON({ success: true, count: count });
}

function handleGetAdminSchedules() {
  const schedules = getSheetData(SHEET_SCHEDULES);
  const classes = getSheetData(SHEET_CLASSES);
  
  const result = [];
  const activeSchedules = schedules.filter(s => s.status !== "deleted");
  
  activeSchedules.forEach(s => {
    try {
      const cls = classes.find(c => c.id == s.class_id);
      result.push({
        ...s,
        class_title: cls ? cls.title : "Unknown Class",
        formatted_time: `${formatTime12(s.start_time)} - ${formatTime12(s.end_time)}`
      });
    } catch (e) {
      Logger.log("Error mapping schedule ID " + s.id + ": " + e.toString());
      // Tetap masukkan data mentah jika gagal formatting
      result.push({
        ...s,
        class_title: "Error Loading Info",
        formatted_time: s.start_time + " - " + s.end_time
      });
    }
  });
  
  return responseJSON({ success: true, data: result.reverse() });
}

function handleUpdateSchedule(data) {
  const rows = SHEET_SCHEDULES.getDataRange().getValues();
  const headers = rows[0];
  const idx = rows.findIndex(r => r[0] === data.id);
  
  if (idx === -1) return responseJSON({ success: false, message: "Schedule not found" });
  
  // Update Map
  const updateMap = {
    instructor: headers.indexOf("instructor"),
    date: headers.indexOf("date"),
    start_time: headers.indexOf("start_time"),
    end_time: headers.indexOf("end_time"),
    room: headers.indexOf("room"),
    quota: headers.indexOf("quota"),
    status: headers.indexOf("status")
  };

  for (let key in updateMap) {
    if (data[key] !== undefined && updateMap[key] !== -1) {
      let value = data[key];
      if (key === "date") value = new Date(value);
      SHEET_SCHEDULES.getRange(idx + 1, updateMap[key] + 1).setValue(value);
    }
  }
  
  return responseJSON({ success: true, message: "Schedule updated" });
}

function handleDeleteSchedule(id) {
  const rows = SHEET_SCHEDULES.getDataRange().getValues();
  const idx = rows.findIndex(r => r[0] === id);
  if (idx === -1) return responseJSON({ success: false });
  if (Number(rows[idx][8]) > 0) return responseJSON({ success: false, message: "Ada peserta aktif" });
  SHEET_SCHEDULES.getRange(idx + 1, 13).setValue("deleted");
  return responseJSON({ success: true });
}

/**
 * --- CORE LOGIC ---
 */
function createBooking(payload) {
  const { schedule_id, name, phone, promo_code, medical_history, consent } = payload;
  const schedules = getSheetData(SHEET_SCHEDULES);
  const schIdx = schedules.findIndex(s => s.id == schedule_id);
  const sch = schedules[schIdx];
  if (!sch || sch.status !== "active" || Number(sch.booked) >= Number(sch.quota)) return responseJSON({ success: false, message: "Slot penuh/tidak tersedia" });
  
  let finalPrice = 0;
  const cls = getSheetData(SHEET_CLASSES).find(c => c.id == sch.class_id);
  const basePrice = cls ? parsePrice(cls.price) : 0;
  if (promo_code) {
    const pRes = handleValidatePromo(promo_code, phone, basePrice);
    const pData = JSON.parse(pRes.getContent());
    if (pData.success) finalPrice = basePrice - pData.discount;
    else return pRes;
  } else { finalPrice = basePrice; }

  const booking_id = generateBookingId();
  SHEET_RESERVATIONS.appendRow([booking_id, sch.class_id, name, "'" + phone, "confirmed", new Date(), "", "pending", promo_code || "", schedule_id, medical_history || "Tidak ada", consent ? "Yes" : "No"]);
  SHEET_SCHEDULES.getRange(schIdx + 2, 9).setValue(Number(sch.booked) + 1);
  return responseJSON({ success: true, booking_id, final_price: finalPrice });
}

function handleValidatePromo(code, phone, amount) {
  const promo = getSheetData(SHEET_PROMOS).find(p => p.code.toString().toUpperCase() === code.toUpperCase() && p.status === "active");
  if (!promo) return responseJSON({ success: false, message: "Voucher tidak valid" });
  if (promo.expired_at && new Date() > new Date(promo.expired_at)) return responseJSON({ success: false, message: "Voucher kadaluwarsa" });
  if (Number(promo.used_count) >= Number(promo.max_usage)) return responseJSON({ success: false, message: "Kuota habis" });
  if (amount < Number(promo.minimum_payment)) return responseJSON({ success: false, message: "Min. transaksi kurang" });
  let discount = promo.type === "percentage" ? (amount * promo.value) / 100 : Number(promo.value);
  return responseJSON({ success: true, discount, code });
}

/**
 * --- HELPERS ---
 */
function parsePrice(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = val.toString().replace(/[^0-9]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function getSheetData(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function normalizePhone(phone) {
  return phone ? phone.toString().replace(/[^0-9]/g, "") : "";
}

function formatIndonesianDate(dateVal) {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return dateVal;
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime12(t) {
  if (!t) return "";
  let h, m;
  if (t instanceof Date) {
    h = t.getHours();
    m = t.getMinutes();
  } else {
    try {
      [h, m] = t.toString().split(':').map(Number);
    } catch (e) { return t; }
  }
  
  if (h === undefined || isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = (h % 12) || 12;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function generateBookingId() {
  const d = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  const count = getSheetData(SHEET_RESERVATIONS).filter(r => r.id.toString().includes(d)).length + 1;
  return `YOGA-${d}-${count.toString().padStart(3, '0')}`;
}

function checkScheduleConflict(n) {
  const ss = getSheetData(SHEET_SCHEDULES).filter(s => s.status === "active" && new Date(s.date).toDateString() === new Date(n.date).toDateString());
  const ns = parseT(n.start_time), ne = parseT(n.end_time);
  for (let s of ss) {
    const sS = parseT(s.start_time), sE = parseT(s.end_time);
    if (ns < sE && ne > sS) {
      if (s.instructor === n.instructor) return { isConflict: true, message: `Instruktur ${s.instructor} bentrok` };
      if (s.room === n.room) return { isConflict: true, message: `Ruangan ${s.room} bentrok` };
    }
  }
  return { isConflict: false };
}

function parseT(t) {
  if (!t) return 0;
  let h, m;
  if (t instanceof Date) {
    h = t.getHours();
    m = t.getMinutes();
  } else {
    try {
      [h, m] = t.toString().split(':').map(Number);
    } catch (e) { return 0; }
  }
  return (h || 0) * 60 + (m || 0);
}
function isToday(d) { return new Date(d).toDateString() === new Date().toDateString(); }

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    const h = {
      classes: ["id", "title", "description", "category", "difficulty", "duration", "default_quota", "thumbnail", "status", "created_at", "price"],
      schedules: ["id", "class_id", "instructor", "date", "start_time", "end_time", "timezone", "quota", "booked", "room", "recurring_type", "recurring_until", "status", "created_at"],
      reservations: ["id", "class_id", "name", "phone", "status", "created_at", "checkin_at", "payment_status", "promo_code", "schedule_id"],
      membership_packages: ["id", "title", "type", "total", "price", "valid_days", "status"],
      user_memberships: ["id", "user_phone", "package_id", "remaining", "expired_at", "status"],
      promo_codes: ["id", "code", "type", "value", "max_usage", "used_count", "minimum_payment", "expired_at", "status"]
    };
    s.appendRow(h[name]);
  }
  return s;
}

/**
 * FORCE SYNC HEADERS
 * Jalankan fungsi ini satu kali dari Editor Apps Script untuk memperbarui kolom Sheet Anda.
 */
function syncSheetHeaders() {
  const headers = {
    classes: ["id", "title", "description", "category", "difficulty", "duration", "default_quota", "thumbnail", "status", "created_at", "price"],
    schedules: ["id", "class_id", "instructor", "date", "start_time", "end_time", "timezone", "quota", "booked", "room", "recurring_type", "recurring_until", "status", "created_at"],
    reservations: ["id", "class_id", "name", "phone", "status", "created_at", "checkin_at", "payment_status", "promo_code", "schedule_id"],
    membership_packages: ["id", "title", "type", "total", "price", "valid_days", "status"],
    user_memberships: ["id", "user_phone", "package_id", "remaining", "expired_at", "status"],
    promo_codes: ["id", "code", "type", "value", "max_usage", "used_count", "minimum_payment", "expired_at", "status"]
  };

  for (let sheetName in headers) {
    let sheet = SS.getSheetByName(sheetName);
    if (sheet) {
      // Update baris pertama saja (header)
      const newHeader = headers[sheetName];
      sheet.getRange(1, 1, 1, newHeader.length).setValues([newHeader]);
      Logger.log("Updated headers for: " + sheetName);
    } else {
      // Jika sheet belum ada, buat baru
      getOrCreateSheet(sheetName);
      Logger.log("Created new sheet: " + sheetName);
    }
  }
  
  SpreadsheetApp.getUi().alert("Sinkronisasi Kolom Selesai! Mohon cek Google Sheet Anda.");
}

function handleGetSettings() {
  let s = SS.getSheetByName("settings");
  if (!s) { s = SS.insertSheet("settings"); s.appendRow(["key", "value"]); s.appendRow(["checkin_mode", "class_qr"]); }
  const d = {}; s.getDataRange().getValues().slice(1).forEach(r => d[r[0]] = r[1]);
  return responseJSON({ success: true, data: d });
}

function handleGenerateToken(classId, force) {
  if (!classId) return responseJSON({ success: false, message: "Class/Schedule ID required" });
  
  const cache = CacheService.getScriptCache();
  
  if (force !== "true") {
    const existingToken = cache.get("CLASS_TOKEN_" + classId);
    if (existingToken) {
      return responseJSON({ success: true, data: { token: existingToken } });
    }
  }

  // Generate a random token
  const token = "TOKEN-" + Utilities.getUuid().substring(0, 12).toUpperCase();
  
  // Store the token in script cache for 12 hours (43200 seconds)
  cache.put(token, classId, 43200);
  cache.put("CLASS_TOKEN_" + classId, token, 43200);
  
  return responseJSON({ success: true, data: { token: token } });
}

function handleCheckinSelf(token, phone, bookingId) {
  if (!token) return responseJSON({ success: false, message: "Token required" });
  if (!phone) return responseJSON({ success: false, message: "Phone required" });
  
  const cache = CacheService.getScriptCache();
  const classId = cache.get(token);
  
  if (!classId) return responseJSON({ success: false, message: "Token kadaluwarsa atau tidak valid. Silakan scan ulang QR Code di studio." });
  
  // Find reservation for this user for this class today
  const sheet = SHEET_RESERVATIONS;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colId = headers.indexOf("id");
  const colClassId = headers.indexOf("class_id");
  const colPhone = headers.indexOf("phone");
  const colStatus = headers.indexOf("status");
  const colCheckinAt = headers.indexOf("checkin_at");
  const colName = headers.indexOf("name");
  const colScheduleId = headers.indexOf("schedule_id");
  
  const cleanPhone = normalizePhone(phone);
  let rowIndex = -1;
  let userName = "";
  
  // Look for a confirmed booking for this user today for this class or schedule session
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowPhone = normalizePhone(row[colPhone]);
    const rowClassId = row[colClassId];
    const rowScheduleId = colScheduleId !== -1 ? row[colScheduleId] : "";
    const rowStatus = row[colStatus];
    
    if (rowPhone === cleanPhone && (rowClassId == classId || rowScheduleId == classId) && rowStatus !== "cancelled") {
      rowIndex = i;
      userName = row[colName];
      break;
    }
  }
  
  if (rowIndex === -1) {
    return responseJSON({ success: false, message: "Tidak ada data reservasi kelas hari ini untuk nomor WhatsApp ini." });
  }
  
  // Mark as checked_in and record time
  sheet.getRange(rowIndex + 1, colStatus + 1).setValue("checked_in");
  sheet.getRange(rowIndex + 1, colCheckinAt + 1).setValue(new Date());
  
  return responseJSON({ success: true, data: { name: userName } });
}

function handleAttendanceList(classId) {
  if (!classId) return responseJSON({ success: false, message: "Class/Schedule ID required" });
  
  const reservations = getSheetData(SHEET_RESERVATIONS);
  
  // Filter reservations for this class today with status = "checked_in"
  const list = reservations.filter(r => (r.class_id == classId || r.schedule_id == classId) && r.status === "checked_in" && isToday(r.created_at)).map(r => {
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      checkin_at: r.checkin_at
    };
  });
  
  return responseJSON({ 
    success: true, 
    data: { 
      total_present: list.length, 
      list: list 
    } 
  });
}

function handleScanUser(bookingId) {
  if (!bookingId) return responseJSON({ success: false, message: "Booking ID required" });
  
  const sheet = SHEET_RESERVATIONS;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colId = headers.indexOf("id");
  const colClassId = headers.indexOf("class_id");
  const colName = headers.indexOf("name");
  const colStatus = headers.indexOf("status");
  const colCheckinAt = headers.indexOf("checkin_at");
  
  const rowIndex = data.findIndex(row => row[colId] === bookingId);
  if (rowIndex === -1) return responseJSON({ success: false, message: "Booking tidak ditemukan" });
  
  const row = data[rowIndex];
  if (row[colStatus] === "checked_in") return responseJSON({ success: false, message: "Peserta sudah check-in sebelumnya" });
  if (row[colStatus] === "cancelled") return responseJSON({ success: false, message: "Booking telah dibatalkan" });
  
  // Get Class title
  const classes = getSheetData(SHEET_CLASSES);
  const cls = classes.find(c => c.id == row[colClassId]);
  
  // Check-in user
  sheet.getRange(rowIndex + 1, colStatus + 1).setValue("checked_in");
  sheet.getRange(rowIndex + 1, colCheckinAt + 1).setValue(new Date());
  
  return responseJSON({ 
    success: true, 
    data: { 
      name: row[colName], 
      class_title: cls ? cls.title : "Unknown Class",
      class_time: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm")
    } 
  });
}

function handleCheckin(bookingId) {
  return handleScanUser(bookingId);
}
