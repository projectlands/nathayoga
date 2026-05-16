/**
 * YOGA RESERVATION SYSTEM - BACKEND API (PREMIUM VERSION)
 * Built with Google Apps Script
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_CLASSES = SS.getSheetByName("classes");
const SHEET_RESERVATIONS = SS.getSheetByName("reservations");

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
    return responseJSON({ success: false, message: "Action not found" });
  } catch (err) {
    return responseJSON({ success: false, message: err.toString() });
  }
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
