/**
 * UI Module - Handles standardized SweetAlert2 and UI interactions
 */
const UI = {
    showAlert(icon, title, text, html = '') {
        return Swal.fire({
            icon: icon,
            title: title,
            text: text,
            html: html,
            background: '#111827', // Tailwind gray-900
            color: '#fff',
            confirmButtonColor: icon === 'error' ? '#ef4444' : '#8b5cf6',
            customClass: {
                popup: 'rounded-3xl border border-gray-800 shadow-2xl',
                title: 'text-2xl font-bold',
                confirmButton: 'rounded-xl px-6 py-3'
            }
        });
    },

    showLoading(title = 'Memproses...') {
        Swal.fire({
            title: title,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            },
            background: '#111827',
            color: '#fff'
        });
    },

    hideLoading() {
        Swal.close();
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};

export default UI;
