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
    if (action === "generate_token") return handleGenerateToken(e.parameter.class_id);
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
      class_time: sch ? `${formatTime12(sch.start_time)} - ${formatTime12(sch.end_time)}` : ""
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
      class_time: sch ? `${formatTime12(sch.start_time)} - ${formatTime12(sch.end_time)}` : ""
    };
  }).reverse();
  return responseJSON({ success: true, data: data });
}

function handleGetDashboardStats() {
  const reservations = getSheetData(SHEET_RESERVATIONS);
  const classes = getSheetData(SHEET_CLASSES);
  const stats = {
    total_bookings: reservations.length,
    total_paid: reservations.filter(r => r.payment_status === "paid").length,
    attendance_today: reservations.filter(r => r.status === "checked_in" && isToday(r.created_at)).length,
    revenue: reservations.filter(r => r.payment_status === "paid").reduce((acc, r) => {
       const cls = classes.find(c => c.id == r.class_id);
       return acc + (cls ? Number(cls.price) : 0);
    }, 0)
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
  const result = schedules.filter(s => s.status !== "deleted").map(s => {
    const cls = classes.find(c => c.id === s.class_id);
    return { ...s, class_title: cls ? cls.title : "Unknown", formatted_time: `${formatTime12(s.start_time)} - ${formatTime12(s.end_time)}` };
  }).reverse();
  return responseJSON({ success: true, data: result });
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
  const { schedule_id, name, phone, promo_code } = payload;
  const schedules = getSheetData(SHEET_SCHEDULES);
  const schIdx = schedules.findIndex(s => s.id == schedule_id);
  const sch = schedules[schIdx];
  if (!sch || sch.status !== "active" || Number(sch.booked) >= Number(sch.quota)) return responseJSON({ success: false, message: "Slot penuh/tidak tersedia" });
  
  let finalPrice = 0;
  const cls = getSheetData(SHEET_CLASSES).find(c => c.id == sch.class_id);
  const basePrice = cls ? Number(cls.price) : 0;
  if (promo_code) {
    const pRes = handleValidatePromo(promo_code, phone, basePrice);
    const pData = JSON.parse(pRes.getContent());
    if (pData.success) finalPrice = basePrice - pData.discount;
    else return pRes;
  } else { finalPrice = basePrice; }

  const booking_id = generateBookingId();
  SHEET_RESERVATIONS.appendRow([booking_id, sch.class_id, name, "'" + phone, "confirmed", new Date(), "", "pending", promo_code || "", schedule_id]);
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
  let [h, m] = t.split(':').map(Number);
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

function parseT(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
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

function handleGetSettings() {
  let s = SS.getSheetByName("settings");
  if (!s) { s = SS.insertSheet("settings"); s.appendRow(["key", "value"]); s.appendRow(["checkin_mode", "class_qr"]); }
  const d = {}; s.getDataRange().getValues().slice(1).forEach(r => d[r[0]] = r[1]);
  return responseJSON({ success: true, data: d });
}
