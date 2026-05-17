/**
 * API Module - Handles communication with Google Apps Script
 */
const API = {
    // GANTI DENGAN URL WEB APP ANDA
    URL: "https://script.google.com/macros/s/AKfycbyZPb2V9MzYbtUOrhUx0uQtv4yWX3LWqn2rQEhRN20eg8uPvcUqGlntTdawhmdGFQ8fzg/exec",

    async fetchClasses() {
        try {
            const response = await fetch(`${this.URL}?action=classes`);
            return await response.json();
        } catch (error) {
            console.error("API Fetch Classes Error:", error);
            throw error;
        }
    },

    async createBooking(data) {
        try {
            const response = await fetch(this.URL, {
                method: "POST",
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error("API Create Booking Error:", error);
            throw error;
        }
    },

    async fetchMyBookings(phone) {
        try {
            const response = await fetch(`${this.URL}?action=my_bookings&phone=${phone}`);
            return await response.json();
        } catch (error) {
            console.error("API Fetch My Bookings Error:", error);
            throw error;
        }
    }
};
