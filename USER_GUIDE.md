# 🧘‍♂️ Panduan Penggunaan Sistem Reservasi Natha Yoga

Dokumen ini menjelaskan alur operasional penuh sistem manajemen Natha Yoga, mulai dari penyiapan kelas oleh Administrator hingga proses reservasi dan absensi mandiri oleh Pengguna.

---

## 🏢 BAGIAN 1: PANDUAN ADMINISTRATOR (ADMIN)

Sistem Admin digunakan oleh pemilik studio atau staf operasional untuk mengelola kelas, mengatur jadwal, mengonfirmasi pembayaran, dan menyiapkan absensi.

### 1. Membuat Katalog Kelas (Class Library)
Sebelum jadwal bisa dibuka, tipe kelas dasar harus dibuat terlebih dahulu.
1. Buka Dasbor Admin dan masuk ke menu **Classes**.
2. Klik tombol **+ Create Class**.
3. Isi detail formulir: 
   - Judul Kelas (Contoh: *Vinyasa Flow* atau *Hatha Yoga*)
   - Kategori & Tingkat Kesulitan
   - Harga Kelas
   - Tautan Gambar (Thumbnail)
4. Simpan. Kelas yang dibuat di sini dapat digunakan berulang kali untuk jadwal kapan pun tanpa harus menulis ulang deskripsinya.

### 2. Membuka Jadwal Baru (Schedules)
Ini adalah tempat di mana Anda membuka "Slot Waktu" pendaftaran untuk para murid.
1. Buka menu **Schedules**.
2. Klik **+ Create Schedule**.
3. Pilih "Master Kelas" yang telah dibuat sebelumnya dari menu *dropdown*.
4. Masukkan **Nama Instruktur**, **Ruangan**, dan batas maksimum **Kuota**.
5. Tetapkan **Tanggal**, **Jam Mulai**, dan **Jam Selesai**.
6. *Fitur Rutin (Recurring):* Jika kelas diadakan setiap minggu di hari yang sama, ubah opsi Recurring dari *One Time* menjadi *Weekly*, dan pilih tanggal batas akhirnya. Sistem otomatis menggandakan jadwalnya hingga tanggal batas.
7. Simpan. Jadwal akan seketika muncul di aplikasi pengguna secara *real-time*.
> **💡 Tip Filter Cerdas:** Di halaman Schedules, Admin dapat memfilter jadwal berdasarkan "Tanggal" dan "Status" (Aktif vs Kedaluwarsa). Jadwal yang kedaluwarsa adalah arsip penting untuk laporan keuangan bulanan.

### 3. Mengelola Pendaftaran (Bookings)
Memantau siapa saja yang mendaftar ke kelas Anda.
1. Buka menu **Bookings**.
2. Anda akan melihat semua nomor tiket pendaftaran, nama peserta, dan status pembayarannya.
3. Saat peserta mentransfer uang secara manual via WhatsApp, Anda sebagai Admin bertugas untuk membuka menu ini dan mengubah status peserta tersebut dari **"Pending"** menjadi **"Paid"**.

### 4. Proses Absensi Studio (QR Check-in)
Ketika hari H tiba dan kelas akan dimulai, ikuti langkah ini untuk sistem absensi mandiri.
1. Buka menu **QR Check-in** di komputer resepsionis/admin.
2. Cari dan pilih jadwal kelas yang akan dimulai hari itu.
3. Sebuah **Kode QR Absensi** yang besar akan muncul di layar.
4. Hadapkan layar berisi QR tersebut ke arah pintu masuk atau cetak jika diperlukan.
5. Pada menu ini, layar akan otomatis menampilkan data peserta yang baru saja melakukan absen (sinkronisasi *real-time*).

---

## 🧘‍♀️ BAGIAN 2: PANDUAN PENGGUNA (PESERTA)

Aplikasi Pengguna diakses melalui tautan peramban (Chrome/Safari) dan dirancang sangat responsif tanpa mengharuskan unduh aplikasi berbayar.

### 1. Mencari Jadwal Kelas
1. Buka aplikasi **Natha Yoga**.
2. Di halaman Beranda, tekan **Mulai Booking** atau gulir ke menu "Jadwal Kelas".
3. Daftar kelas sudah diurutkan secara cerdas: **Kelas terdekat (hari ini/besok) berada paling atas**.
4. Peserta tidak akan pusing dengan jadwal yang sudah lewat karena jadwal yang sudah habis jamnya (*Expired*) otomatis dihapus/disembunyikan dari katalog ini.
5. Gunakan fitur penyaring (*Filter*) untuk mencari jadwal di **Tanggal** tertentu atau mencari kelas bersama **Instruktur** idola Anda.

### 2. Melakukan Reservasi
1. Pilih dan ketuk jadwal kelas yang diinginkan.
2. Formulir pemesanan akan terbuka dari bawah layar.
3. Masukkan **Nama**, **Nomor WhatsApp**, dan opsi **Catatan Medis**.
4. Jika ada diskon khusus, masukkan **Kode Promo**.
5. Centang kotak persetujuan pembatalan H-1.
6. Ketuk **Konfirmasi Booking**. Pengguna akan otomatis dipindahkan ke halaman "My Booking".

### 3. Konfirmasi Pembayaran
1. Di halaman **My Booking**, cari tiket yang berlabel **"Belum Bayar"**.
2. Ketuk tombol berlogo WhatsApp bertuliskan **Konfirmasi**.
3. Sistem akan memindahkan pengguna ke aplikasi WhatsApp dan menyiapkan pesan (*chat*) otomatis yang ditujukan ke Admin Natha Yoga, lengkap dengan Nomor ID Booking, Rincian Kelas, dan Total Tagihan.
4. Kirim pesan tersebut beserta bukti transfer ke Admin.

### 4. Melakukan Absensi Hadir (Self Check-in)
1. Setiba di studio Natha Yoga, pastikan koneksi internet ponsel dalam keadaan aktif.
2. Buka menu **My Booking**.
3. Cari tiket kelas untuk hari tersebut. Jika tiket masih aktif (belum kedaluwarsa) dan sudah dilunasi, akan muncul tombol bergambar kamera **"📷 Scan Absen"**.
4. Ketuk tombol tersebut. Kamera ponsel akan terbuka (izinkan akses kamera jika diminta).
5. Arahkan kamera ponsel Anda ke **Kode QR** yang disajikan oleh Admin di resepsionis.
6. Berhasil! Sebuah notifikasi sukses akan muncul dan status tiket otomatis berubah menjadi **"Hadir"**.

---
*Dokumentasi ini disajikan khusus untuk membantu transisi ekosistem operasional Natha Yoga menjadi 100% digital, tanpa kertas, dan bebas hambatan.*
