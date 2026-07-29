// src/contexts/AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/api';

const MODE = import.meta.env.VITE_API_MODE || 'mock';

const AuthContext = createContext();

// Mock user database untuk simulasi login
const MOCK_USERS = [
    {
        id: 1,
        name: 'Ahmad Fauzi',
        email: 'admin@banknagari.com',
        password: 'admin123',
        role: 'super_admin',
        department: 'IT',
        nip: '199001011234',
        avatar_url: null,
    },
    {
        id: 2,
        name: 'Budi Santoso',
        email: 'pm@banknagari.com',
        password: 'pm123',
        role: 'project_manager',
        department: 'IT Core',
        nip: '198505051234',
        avatar_url: null,
    },
    {
        id: 3,
        name: 'Citra Kirana',
        email: 'analyst@banknagari.com',
        password: 'analyst123',
        role: 'analyst',
        department: 'IT',
        nip: '199203031234',
        avatar_url: null,
    },
    {
        id: 4,
        name: 'Dewi Lestari',
        email: 'lead@banknagari.com',
        password: 'lead123',
        role: 'lead_group',
        department: 'IT',
        nip: '198801011234',
        avatar_url: null,
    },
    {
        id: 5,
        name: 'Eko Prasetyo',
        email: 'qa@banknagari.com',
        password: 'qa123',
        role: 'qa_lead',
        department: 'IT Quality',
        nip: '199104041234',
        avatar_url: null,
    },
    {
        id: 6,
        name: 'Fajar Nugroho',
        email: 'devlead@banknagari.com',
        password: 'dev123',
        role: 'development_lead',
        department: 'IT Development',
        nip: '199006061234',
        avatar_url: null,
    },
    {
        id: 7,
        name: 'Gita Savitri',
        email: 'cyber@banknagari.com',
        password: 'cyber123',
        role: 'cyber_team',
        department: 'IT Security',
        nip: '199307071234',
        avatar_url: null,
    },
    {
        id: 8,
        name: 'Dimas Anggara',
        email: 'dimas@banknagari.com',
        password: 'dev123',
        role: 'developer',
        department: 'Divisi TI (Backend)',
        nip: '199401011234',
        avatar_url: null,
    },
    {
        id: 9,
        name: 'Eka Putri',
        email: 'eka@banknagari.com',
        password: 'dev123',
        role: 'developer',
        department: 'Divisi TI (Frontend)',
        nip: '199502021234',
        avatar_url: null,
    },
    {
        id: 10,
        name: 'Pengusul Proyek (Business User)',
        email: 'user@banknagari.com',
        password: 'user123',
        role: 'business_user',
        department: 'Divisi Kredit',
        nip: '199601011234',
        avatar_url: null,
    },
    {
        id: 11,
        name: 'Test Pengusul',
        email: 'test@nagari.co.id',
        password: 'test1234',
        role: 'business_user',
        department: 'Divisi Kredit',
        nip: '199801011234',
        avatar_url: null,
    },
];

const SESSION_KEY = 'nagari_sdlc_session';
const CUSTOM_USERS_KEY = 'nagari_sdlc_custom_users';

const getCustomUsers = () => {
    try {
        const saved = localStorage.getItem(CUSTOM_USERS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
};

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
                if (MODE === 'api') {
                    // Jika token berupa mock token atau tidak valid, hapus session lama
                    if (!parsed.token || parsed.token === 'mock_token') {
                        localStorage.removeItem(SESSION_KEY);
                        setUser(null);
                        setIsLoggedIn(false);
                        setIsLoading(false);
                        return;
                    }

                    // Verifikasi token dengan backend
                    const meRes = await authService.getCurrentUser();
                    if (meRes && meRes.status === 'success' && meRes.data) {
                        const userData = {
                            ...meRes.data,
                            role: meRes.data.role?.name || 'super_admin',
                        };
                        setUser(userData);
                        setIsLoggedIn(true);
                    } else {
                        localStorage.removeItem(SESSION_KEY);
                        setUser(null);
                        setIsLoggedIn(false);
                    }
                } else {
                    const sessionUser = parsed.user || parsed;
                    if (sessionUser && (sessionUser.id || sessionUser.email)) {
                        setUser(sessionUser);
                        setIsLoggedIn(true);
                    } else {
                        localStorage.removeItem(SESSION_KEY);
                    }
                }
            } catch (err) {
                localStorage.removeItem(SESSION_KEY);
                setUser(null);
                setIsLoggedIn(false);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    const registerUser = (userData) => {
        const customUsers = getCustomUsers();
        const allUsers = [...MOCK_USERS, ...customUsers];

        const existing = allUsers.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
        if (existing) {
            return { success: false, message: 'Email sudah terdaftar di sistem.' };
        }

        const newUser = {
            id: Date.now(),
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.role || 'business_user',
            department: userData.department || 'Divisi Kredit',
            nip: userData.nip || '19950101' + Math.floor(1000 + Math.random() * 9000),
            avatar_url: null,
        };

        const updatedCustom = [...customUsers, newUser];
        localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(updatedCustom));
        return { success: true, user: newUser };
    };

    const login = async (email, password) => {
        if (MODE === 'api') {
            try {
                const res = await authService.login(email, password);
                if (res.status === 'success' && res.data) {
                    const userData = {
                        ...res.data.user,
                        role: res.data.user.role?.name || 'super_admin',
                    };
                    const sessionData = {
                        user: userData,
                        token: res.data.token,
                    };
                    setUser(userData);
                    setIsLoggedIn(true);
                    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
                    return { success: true };
                } else {
                    return { success: false, message: res.message || 'Login gagal.' };
                }
            } catch (err) {
                return { success: false, message: err.message || 'Email atau password salah.' };
            }
        }

        const customUsers = getCustomUsers();
        const allUsers = [...MOCK_USERS, ...customUsers];

        const foundUser = allUsers.find(
            u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (!foundUser) {
            return { success: false, message: 'Email atau password salah.' };
        }

        const { password: _, ...userWithoutPass } = foundUser;
        setUser(userWithoutPass);
        setIsLoggedIn(true);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user: userWithoutPass, token: 'mock_token' }));

        return { success: true };
    };

    const logout = () => {
        setUser(null);
        setIsLoggedIn(false);
        localStorage.removeItem(SESSION_KEY);
    };

    const updateProfile = (updates) => {
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user: updatedUser }));
    };

    return (
        <AuthContext.Provider value={{ user, isLoggedIn, isLoading, login, logout, registerUser, updateProfile }}>
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