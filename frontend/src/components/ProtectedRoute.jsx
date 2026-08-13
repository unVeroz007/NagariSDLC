// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultRouteForRole } from '../data/menuConfig';
import LoadingSpinner from './LoadingSpinner';

/**
 * ProtectedRoute - Membungkus halaman agar hanya bisa diakses oleh:
 * 1. User yang sudah login (isLoggedIn === true)
 * 2. User dengan role yang sesuai (jika prop `allowedRoles` diberikan)
 *
 * Usage:
 *   <ProtectedRoute>                          — hanya perlu login
 *   <ProtectedRoute allowedRoles={['super_admin', 'project_manager']}> — login + role tertentu
 */
export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, isLoggedIn, isLoading } = useAuth();
    const location = useLocation();

    // Tampilkan spinner saat AuthContext sedang loading
    if (isLoading) {
        return <LoadingSpinner text="Memverifikasi sesi..." />;
    }

    // Belum login → redirect ke halaman login
    if (!isLoggedIn || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Sudah login tapi role tidak diizinkan → redirect secara ramah
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Alihkan ke workspace/tugas utama sesuai role, bukan halaman 403 mentah
        const targetRoute = getDefaultRouteForRole(user.role);
        return <Navigate to={targetRoute} replace state={{ from: location }} />;
    }

    // Lolos semua pengecekan → render children
    return children;
}
