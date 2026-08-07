// src/contexts/AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();
const SESSION_KEY = 'nagari_sdlc_session';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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
                    setUser(parsed.user);
                    setIsLoggedIn(true);

                    // Silent token verification
                    try {
                        const meRes = await authService.getCurrentUser();
                        if (meRes && meRes.data) {
                            setUser(meRes.data);
                            localStorage.setItem(SESSION_KEY, JSON.stringify({ 
                                token: parsed.token, 
                                user: meRes.data 
                            }));
                        }
                    } catch (err) {
                        if (err.status === 401) {
                            handleUnauthorized();
                        }
                    }
                }
            } catch (err) {
                console.error('[AuthContext] Session parse error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const handleUnauthorized = () => {
        console.warn('[AuthContext] 401 Unauthorized detected, logging out...');
        setUser(null);
        setIsLoggedIn(false);
        localStorage.removeItem(SESSION_KEY);
        toast.error('Sesi Anda telah berakhir, silakan login kembali.');
    };

    const login = async (email, password) => {
        try {
            const res = await authService.login(email, password);
            if (res && res.data && res.data.token) {
                const userData = res.data.user;
                const token = res.data.token;
                
                setUser(userData);
                setIsLoggedIn(true);
                localStorage.setItem(SESSION_KEY, JSON.stringify({ user: userData, token }));
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
                const session = JSON.parse(localStorage.getItem(SESSION_KEY));
                localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user: updatedUser }));
                toast.success('Profil berhasil diperbarui');
            }
        } catch (err) {
            toast.error(`Gagal update profil: ${err.message}`);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoggedIn, isLoading, login, logout, updateProfile }}>
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
