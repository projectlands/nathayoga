import API from './api.js';
import UI from './ui.js';
import Booking from './booking.js';

window.yogaApp = () => {
    return {
        loading: true,
        classes: [],
        modalOpen: false,
        myBookingsOpen: false,
        selectedClass: null,
        bookingLoading: false,
        myBookings: [],
        view: 'home', // 'home' or 'my-bookings'
        
        formData: {
            name: '',
            phone: ''
        },
        
        searchPhone: '',

        async init() {
            const userData = Booking.getUserData();
            this.formData.name = userData.name;
            this.formData.phone = userData.phone;
            this.searchPhone = userData.phone;
            
            await this.loadClasses();
        },

        async loadClasses() {
            this.loading = true;
            try {
                const result = await API.fetchClasses();
                if (result.success) {
                    this.classes = result.data;
                }
            } catch (error) {
                UI.showAlert('error', 'Gagal memuat data', 'Terjadi kesalahan saat mengambil jadwal kelas.');
            } finally {
                this.loading = false;
            }
        },

        openBooking(cls) {
            if (cls.booked >= cls.quota) {
                UI.showAlert('info', 'Kelas Penuh', 'Maaf, kuota untuk kelas ini sudah penuh.');
                return;
            }
            this.selectedClass = cls;
            this.modalOpen = true;
        },

        async submitBooking() {
            if (!this.formData.name.trim() || !this.formData.phone.trim()) {
                UI.showAlert('warning', 'Data tidak lengkap', 'Silakan isi nama dan nomor WhatsApp Anda.');
                return;
            }

            this.bookingLoading = true;
            try {
                const result = await API.createBooking({
                    class_id: this.selectedClass.id,
                    name: this.formData.name,
                    phone: this.formData.phone
                });

                if (result.success) {
                    Booking.saveUserData(this.formData.name, this.formData.phone);
                    
                    this.modalOpen = false;
                    
                    // Show success with QR
                    await UI.showAlert('success', 'Booking Berhasil!', '', `
                        <div class="flex flex-col items-center gap-4 py-4">
                            <p class="text-sm text-gray-400">ID Booking: <b class="text-white">${result.booking_id}</b></p>
                            <div id="qrcode" class="bg-white p-2 rounded-xl"></div>
                            <p class="text-xs text-gray-500">Tunjukkan QR ini saat check-in</p>
                        </div>
                    `);

                    // Generate QR after modal open
                    new QRCode(document.getElementById("qrcode"), {
                        text: result.booking_id,
                        width: 128,
                        height: 128
                    });

                    await this.loadClasses(); // Refresh quota
                } else {
                    UI.showAlert('error', 'Booking Gagal', result.message);
                }
            } catch (error) {
                UI.showAlert('error', 'Koneksi Gagal', 'Gagal mengirim data ke server.');
            } finally {
                this.bookingLoading = false;
            }
        },

        async checkMyBookings() {
            if (!this.searchPhone.trim()) {
                UI.showAlert('warning', 'Nomor HP Kosong', 'Masukkan nomor WhatsApp yang digunakan saat booking.');
                return;
            }

            this.loading = true;
            try {
                const result = await API.fetchMyBookings(this.searchPhone);
                if (result.success) {
                    this.myBookings = result.data;
                    this.view = 'my-bookings';
                    if (this.myBookings.length === 0) {
                        UI.showAlert('info', 'Tidak Ditemukan', 'Tidak ada data booking untuk nomor ini.');
                    }
                }
            } catch (error) {
                UI.showAlert('error', 'Gagal', 'Terjadi kesalahan saat mencari data.');
            } finally {
                this.loading = false;
            }
        },

        formatPrice(p) { return UI.formatCurrency(p); }
    }
}
