// src/components/PublicRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * PublicRoute (Guest Guard) - Membungkus halaman publik yang hanya boleh dibuka saat user belum login
 * (seperti /login, /register, /forgot-password, /reset-password).
 *
 * - Jika user SUDAH login -> otomatis dialihkan ke /dashboard.
 * - Jika user BELUM login -> tampilkan elemen anak (halaman auth).
 */
export default function PublicRoute({ children }) {
    const { isLoggedIn, isLoading } = useAuth();

    // Tampilkan spinner saat status autentikasi masih diverifikasi
    if (isLoading) {
        return <LoadingSpinner text="Memverifikasi sesi..." />;
    }

    // Jika sudah login, cegah akses ke halaman auth dan alihkan ke dashboard
    if (isLoggedIn) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}
