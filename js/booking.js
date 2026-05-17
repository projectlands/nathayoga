/**
 * Booking Module - Handles local storage and booking logic
 */
const Booking = {
    saveUserData(name, phone) {
        localStorage.setItem('yoga_user_name', name);
        localStorage.setItem('yoga_user_phone', phone);
    },

    getUserData() {
        return {
            name: localStorage.getItem('yoga_user_name') || '',
            phone: localStorage.getItem('yoga_user_phone') || ''
        };
    },

    generateWhatsAppLink(bookingData) {
        const phone = "628123456789"; // GANTI DENGAN NOMOR ADMIN ANDA
        const text = `Halo Admin Natha Yoga,\n\nSaya ingin konfirmasi booking:\nID: ${bookingData.booking_id}\nKelas: ${bookingData.class_title}\nNama: ${bookingData.name}\n\nTerima kasih.`;
        return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    }
};

export default Booking;
