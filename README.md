# Sistem Reservasi Kelas Yoga (Backend API)

Backend ini menggunakan Google Apps Script (.gs) dan Google Sheets sebagai database.

## 📋 Persiapan Google Sheets

1. Buat Google Sheets baru.
2. Buat dua sheet (tab) dengan nama dan header berikut:
   - **Sheet: `classes`**
     Header (Baris 1): `id`, `title`, `instructor`, `date`, `time`, `quota`, `booked`, `price`, `status`
   - **Sheet: `reservations`**
     Header (Baris 1): `id`, `class_id`, `name`, `phone`, `status`, `created_at`

## 🚀 Cara Deploy ke Google Apps Script

1. Di Google Sheets, buka menu **Extensions** > **Apps Script**.
2. Salin isi file `api_reservasi.gs` ke editor Apps Script.
3. Klik tombol **Deploy** > **New Deployment**.
4. Pilih **Type**: `Web App`.
5. **Execute as**: `Me`.
6. **Who has access**: `Anyone`.
7. Klik **Deploy** dan salin **Web App URL** yang diberikan.

## 📡 Dokumentasi API

### 1. Ambil Daftar Kelas
- **Method**: `GET`
- **URL**: `YOUR_URL?action=classes`
- **Response**: Mengembalikan daftar kelas dengan status `active`.

### 2. Booking Kelas
- **Method**: `POST`
- **Body (JSON)**:
  ```json
  {
    "class_id": "C001",
    "name": "Budi Santoso",
    "phone": "08123456789"
  }
  ```

## 💻 Contoh Penggunaan JavaScript (Fetch)

### Ambil Data (GET)
```javascript
const API_URL = "URL_WEB_APP_ANDA?action=classes";

async function getClasses() {
  const response = await fetch(API_URL);
  const result = await response.json();
  console.log(result.data);
}
```

### Booking (POST)
```javascript
const API_URL = "URL_WEB_APP_ANDA";

async function bookClass(classId, name, phone) {
  const response = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      class_id: classId,
      name: name,
      phone: phone
    })
  });
  const result = await response.json();
  alert(result.message);
}
```

## 🛠 Integrasi Frontend
Sistem ini sangat mudah dihubungkan dengan:
- **Tailwind CSS** untuk styling.
- **Alpine.js** untuk logic frontend yang ringan.
- **HTML/JS** murni.
