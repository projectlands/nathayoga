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
    return responseJSON({ success: false, message: "Action not found" });
  } catch (err) {
    return responseJSON({ success: false, message: err.toString() });
  }
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
