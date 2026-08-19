// src/contexts/AuthContext.jsx
import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();
const SESSION_KEY = 'nagari_sdlc_session';
// Module-level flag agar toast "Sesi berakhir" tidak spam saat banyak request 401 bersamaan.
let unauthorizedToastShown = false;

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Bersihkan sesi & (opsional) tampilkan toast anti-spam.
    const handleUnauthorized = useCallback(({ showToast = true } = {}) => {
        setUser(null);
        setIsLoggedIn(false);
        localStorage.removeItem(SESSION_KEY);

        if (showToast && !unauthorizedToastShown) {
            unauthorizedToastShown = true;
            toast.error('Sesi Anda telah berakhir, silakan login kembali.');
            setTimeout(() => { unauthorizedToastShown = false; }, 4000);
        }
    }, []);

    // Dipicu dari api.js (request 401 saat user sedang aktif) → tampilkan toast.
    // Jangan tampilkan saat masih inisialisasi (isLoading) — itu hanya token startup
    // yang expire, user sedang di halaman login, cukup bersihkan sesi diam-diam.
    const onAuthUnauthorized = useCallback(() => {
        handleUnauthorized({ showToast: !isLoading });
    }, [handleUnauthorized, isLoading]);

    useEffect(() => {
        const initAuth = async () => {
            const savedSession = localStorage.getItem(SESSION_KEY);
            if (!savedSession) {
                setIsLoading(false);
                return;
            }

            try {
                const parsed = JSON.parse(savedSession);

                if (parsed.token && parsed.user) {
                    // Jangan set isLoggedIn dulu — tunggu verifikasi token agar
                    // komponen lain (ProjectContext dll) tidak memicu request 401
                    // saat token sudah expire (menyebabkan toast "Sesi berakhir" spam).
                    try {
                        const meRes = await authService.getCurrentUser();
                        if (meRes && meRes.data) {
                            setUser(meRes.data);
                            setIsLoggedIn(true);
                            localStorage.setItem(SESSION_KEY, JSON.stringify({
                                token: parsed.token,
                                user: meRes.data,
                                issuedAt: parsed.issuedAt || Date.now()
                            }));
                        } else {
                            localStorage.removeItem(SESSION_KEY);
                        }
                    } catch (err) {
                        // Token expire/invalid → bersihkan sesi diam-diam (tanpa toast)
                        localStorage.removeItem(SESSION_KEY);
                    }
                } else {
                    localStorage.removeItem(SESSION_KEY);
                }
            } catch {
                localStorage.removeItem(SESSION_KEY);
            } finally {
                setIsLoading(false);
            }
        };
        initAuth();

        window.addEventListener('auth:unauthorized', onAuthUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', onAuthUnauthorized);
    }, [handleUnauthorized, onAuthUnauthorized]);

    const login = async (email, password) => {
        try {
            const res = await authService.login(email, password);
            if (res && res.data && res.data.token) {
                const userData = res.data.user;
                const token = res.data.token;

                // Reset flag agar toast sesi expire dapat muncul lagi di masa depan
                unauthorizedToastShown = false;

                setUser(userData);
                setIsLoggedIn(true);
                localStorage.setItem(SESSION_KEY, JSON.stringify({ user: userData, token, issuedAt: Date.now() }));
                return { success: true };
            }
            return { success: false, message: 'Invalid response format from server.' };
        } catch (err) {
            return { success: false, message: err.message || 'Email atau password salah.' };
        }
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
        setIsLoggedIn(false);
        localStorage.removeItem(SESSION_KEY);
    };

    const updateProfile = async (updates) => {
        try {
            const res = await authService.updateProfile(updates.name, updates.phone_number);
            if (res && res.data) {
                const updatedUser = res.data;
                setUser(updatedUser);
                const raw = localStorage.getItem(SESSION_KEY);
                if (raw) {
                    const session = JSON.parse(raw);
                    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user: updatedUser }));
                }
                toast.success('Profil berhasil diperbarui');
            }
        } catch (err) {
            toast.error(`Gagal update profil: ${err.message}`);
        }
    };

    const registerUser = async (data) => {
        try {
            const res = await authService.register(data);
            if (res && res.status === 'success') {
                return { success: true, message: res.message || 'Registrasi berhasil.' };
            }
            return { success: false, message: res?.message || 'Registrasi gagal.' };
        } catch (err) {
            return { success: false, message: err.message || 'Registrasi gagal, coba lagi.' };
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoggedIn, isLoading, login, logout, updateProfile, registerUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
