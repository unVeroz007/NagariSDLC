// src/contexts/AuthContext.jsx
import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authService, sessionStore } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();
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
        sessionStore.clear();

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
            /*
             * Sesi tersimpan tidak lagi memuat token — tokennya ada di cookie
             * `HttpOnly` yang dilampirkan peramban sendiri. Isi `localStorage` di
             * sini hanya penanda "peramban ini pernah masuk" beserta salinan profil
             * pengguna, dan keabsahan sesinya tetap ditentukan server lewat
             * `GET /auth/me`.
             *
             * Penanda itu sengaja tetap dipakai sebagai syarat: tanpanya setiap
             * pengunjung anonim ikut memanggil `/auth/me` pada tiap muat halaman,
             * hanya untuk dijawab 401.
             */
            const parsed = sessionStore.read();
            if (!parsed?.user) {
                sessionStore.clear();
                setIsLoading(false);
                return;
            }

            // Jangan set isLoggedIn dulu — tunggu verifikasi ke server agar
            // komponen lain (ProjectContext dll) tidak memicu request 401
            // saat sesi sudah berakhir (menyebabkan toast "Sesi berakhir" spam).
            try {
                const meRes = await authService.getCurrentUser();
                if (meRes && meRes.data) {
                    setUser(meRes.data);
                    setIsLoggedIn(true);
                    sessionStore.save({
                        user: meRes.data,
                        // Waktu terbit dipertahankan: penjadwalan penyegaran dihitung
                        // dari kapan token benar-benar diterbitkan, bukan dari kapan
                        // tab terakhir dibuka. Menimpanya dengan `Date.now()` membuat
                        // penyegaran tidak pernah terpicu bila pengguna rutin memuat
                        // ulang halaman, sampai tokennya kedaluwarsa mendadak.
                        issuedAt: parsed.issuedAt || Date.now(),
                        expiresInMinutes: parsed.expiresInMinutes,
                    });
                } else {
                    sessionStore.clear();
                }
            } catch {
                // Sesi berakhir/tidak valid → bersihkan diam-diam (tanpa toast)
                sessionStore.clear();
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
            /*
             * Keberhasilan diukur dari adanya `data.user`, bukan `data.token`.
             * Tokennya dilekatkan sebagai cookie `HttpOnly` dan sengaja dapat
             * dihilangkan dari body lewat `AUTH_COOKIE_EXPOSE_TOKEN=false` di
             * produksi — memeriksa `data.token` akan membuat setiap login gagal
             * begitu pengerasan itu diaktifkan.
             */
            if (res && res.data && res.data.user) {
                const userData = res.data.user;

                // Reset flag agar toast sesi expire dapat muncul lagi di masa depan
                unauthorizedToastShown = false;

                setUser(userData);
                setIsLoggedIn(true);
                sessionStore.save({
                    user: userData,
                    expiresInMinutes: res.data.token_expires_in_minutes,
                });
                // Data pengguna ikut dikembalikan. Halaman login menentukan tujuan
                // pengalihan dari `result.user.role`, dan sebelumnya kunci itu tidak
                // pernah ada di nilai kembalian — jadi setiap peran diarahkan ke rute
                // bawaan `/dashboard`, lalu ditolak di sana dan dialihkan sekali lagi.
                return { success: true, user: userData };
            }
            return { success: false, message: 'Invalid response format from server.' };
        } catch (err) {
            return { success: false, message: err.message || 'Email atau password salah.' };
        }
    };

    /**
     * Akhiri sesi.
     *
     * Pencabutan token di server dicoba lebih dulu, tetapi kegagalannya tidak boleh
     * menghalangi pembersihan sesi lokal. Sebelumnya `await authService.logout()`
     * berada di luar try: bila permintaannya gagal — jaringan mati, atau tokennya
     * memang sudah kedaluwarsa sehingga server menjawab 401 — pengecualiannya
     * membatalkan seluruh sisa fungsi ini, dan pengguna tetap tampak masuk dengan
     * token yang tidak lagi berlaku sampai tab-nya ditutup.
     */
    const logout = async () => {
        try {
            await authService.logout();
        } catch {
            // Token mungkin sudah tidak berlaku di server; sesi lokal tetap dibersihkan.
        } finally {
            setUser(null);
            setIsLoggedIn(false);
            sessionStore.clear();
        }
    };

    /**
     * Simpan perubahan profil ke backend, lalu segarkan user di context dan
     * di localStorage supaya seluruh halaman langsung melihat data terbaru.
     * Hasilnya dikembalikan agar pemanggil dapat memutuskan sendiri, misalnya
     * menutup mode edit hanya bila penyimpanan benar-benar berhasil.
     */
    const updateProfile = async (updates) => {
        try {
            const res = await authService.updateProfile(updates.name, updates.phone_number);

            if (!res || !res.data) {
                const message = res?.message || 'Format respons profil tidak dikenali.';
                toast.error(`Gagal update profil: ${message}`);
                return { success: false, message };
            }

            const updatedUser = res.data;
            setUser(updatedUser);
            // Sesi tersimpan hanya diperbarui bila memang masih ada. `sessionStore`
            // sudah menelan isi localStorage yang rusak, jadi kegagalan membacanya
            // tidak lagi dapat membatalkan pembaruan profil yang sebenarnya sudah
            // tersimpan di server.
            const stored = sessionStore.read();
            if (stored) {
                sessionStore.save({
                    user: updatedUser,
                    issuedAt: stored.issuedAt,
                    expiresInMinutes: stored.expiresInMinutes,
                });
            }
            toast.success('Profil berhasil diperbarui');

            return { success: true, user: updatedUser };
        } catch (err) {
            const message = err.message || 'Terjadi kesalahan tidak terduga.';
            toast.error(`Gagal update profil: ${message}`);
            return { success: false, message };
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
