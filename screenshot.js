const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Alamat URL Target (Secara default mengarah ke GitHub Pages Anda)
const BASE_URL = process.argv[2] || "https://projectlands.github.io/nathayoga/";

// Buat direktori penyimpanan jika belum ada
const dir = path.join(__dirname, 'assets', 'guide');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

(async () => {
    console.log(`🚀 Memulai Puppeteer Automation...`);
    console.log(` Target URL: ${BASE_URL}\n`);

    // Jalankan browser headless
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // -------------------------------------------------------------
    // ALUR 1: ADMIN - FORMULIR CREATE CLASS
    // -------------------------------------------------------------
    console.log(`📸 Langkah 1: Memotret Form Create Class Admin...`);
    // Atur viewport desktop untuk Admin
    await page.setViewport({ width: 1280, height: 800 });

    // Masuk ke halaman admin.html terlebih dahulu untuk menanamkan autentikasi bypass
    await page.goto(`${BASE_URL}admin.html`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
        localStorage.setItem('yoga_admin_auth', 'true');
        localStorage.setItem('theme', 'dark'); // Set dark mode agar wow
    });

    // Pindah ke admin-classes.html
    await page.goto(`${BASE_URL}admin-classes.html`, { waitUntil: 'networkidle2' });
    
    // Picu pemunculan modal Create Class via Alpine.js secara paksa agar instan & aman
    await page.evaluate(() => {
        const el = document.querySelector('[x-data]');
        if (el && window.Alpine) {
            const data = window.Alpine.$data(el);
            data.openModal();
        }
    });

    // Tunggu animasi modal selesai
    await new Promise(resolve => setTimeout(resolve, 800));
    await page.screenshot({ path: path.join(dir, 'admin-create-class.png') });
    console.log(`   ✅ Tersimpan di: assets/guide/admin-create-class.png`);


    // -------------------------------------------------------------
    // ALUR 2: ADMIN - LAYAR QR DISPLAY CHECK-IN
    // -------------------------------------------------------------
    console.log(`\n📸 Langkah 2: Memotret Layar QR Check-in Admin...`);
    
    // Pindah ke admin-checkin.html
    await page.goto(`${BASE_URL}admin-checkin.html`, { waitUntil: 'networkidle2' });

    // Suntikkan data tiruan kelas & generate QR instan agar tidak tergantung pada koneksi sheets
    await page.evaluate(() => {
        const el = document.querySelector('[x-data]');
        if (el && window.Alpine) {
            const data = window.Alpine.$data(el);
            data.selectedClassId = 999;
            data.selectedClassTitle = "Vinyasa Flow Masterclass (08:00 - 09:30 WITA)";
            data.token = "MOCK-TOKEN-NATHAYOGA-2026";
            data.checkinUrl = "https://projectlands.github.io/nathayoga/checkin.html?token=MOCK-TOKEN-NATHAYOGA-2026";
            
            // Render QR code tiruan di container
            const container = document.getElementById("qrcode-container");
            if (container) {
                container.innerHTML = "";
                new QRCode(container, {
                    text: data.checkinUrl,
                    width: 250,
                    height: 250,
                    colorDark: "#0f172a",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }
    });

    // Tunggu sebentar untuk render QR
    await new Promise(resolve => setTimeout(resolve, 800));
    await page.screenshot({ path: path.join(dir, 'admin-qr-display.png') });
    console.log(`   ✅ Tersimpan di: assets/guide/admin-qr-display.png`);


    // -------------------------------------------------------------
    // ALUR 3: USER - FORM RESERVASI USER
    // -------------------------------------------------------------
    console.log(`\n📸 Langkah 3: Memotret Form Reservasi User...`);
    // Atur viewport mobile untuk halaman User
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

    // Masuk ke halaman beranda user
    await page.goto(`${BASE_URL}index.html`, { waitUntil: 'networkidle2' });

    // Suntikkan data jadwal tiruan agar halaman tidak kosong, lalu buka modal booking
    await page.evaluate(() => {
        const el = document.getElementById('app') || document.querySelector('[x-data]');
        if (el && window.Alpine) {
            const data = window.Alpine.$data(el);
            // Sediakan jadwal tiruan
            data.classes = [{
                id: 888,
                class_id: 888,
                class_title: "Gentle Hatha & Meditation",
                class_thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=800",
                instructor: "Made Sukarta",
                date: new Date().toISOString(),
                start_time: "08:00",
                end_time: "09:30",
                formatted_time: "08:00 - 09:30 WITA",
                booked: 3,
                quota: 15,
                price: 120000,
                status: "active"
            }];
            
            // Arahkan ke tab kelas & buka form reservasi
            data.view = 'classes';
            setTimeout(() => {
                data.openBooking(data.classes[0]);
            }, 100);
        }
    });

    // Tunggu transisi modal meluncur dari bawah layar
    await new Promise(resolve => setTimeout(resolve, 800));
    await page.screenshot({ path: path.join(dir, 'user-booking-form.png') });
    console.log(`   ✅ Tersimpan di: assets/guide/user-booking-form.png`);

    console.log(`\n🎉 Seluruh tangkapan layar sukses dibuat!`);
    await browser.close();
})();
