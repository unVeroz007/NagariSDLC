// src/contexts/AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/api';

const MODE = import.meta.env.VITE_API_MODE || 'mock';

const AuthContext = createContext();

/**
 * MOCK_USERS — Credential sesuai dengan UserSeeder di Backend.
 * Digunakan saat VITE_API_MODE=mock.
 * Login mode API: gunakan email & password yang sama ke endpoint /auth/login.
 */
const MOCK_USERS = [
    {
        id: 1,
        name: 'Admin NagariSDLC',
        email: 'admin@nagari.co.id',
        password: 'password123',
        role: 'super_admin',
        division: { code: 'DSI', name: 'Divisi Sistem Informasi' },
        phone_number: '081234567890',
        avatar_url: null,
    },
    {
        id: 2,
        name: 'Head of IT',
        email: 'headit@nagari.co.id',
        password: 'password123',
        role: 'head_of_it',
        division: { code: 'DSI', name: 'Divisi Sistem Informasi' },
        phone_number: '081234567891',
        avatar_url: null,
    },
    {
        id: 3,
        name: 'Lead Group / Kadiv IT',
        email: 'lead@nagari.co.id',
        password: 'password123',
        role: 'lead_group',
        division: { code: 'IT-DEV', name: 'IT Development' },
        phone_number: '081234567892',
        avatar_url: null,
    },
    {
        id: 4,
        name: 'System Analyst',
        email: 'analyst@nagari.co.id',
        password: 'password123',
        role: 'analyst',
        division: { code: 'IT-DEV', name: 'IT Development' },
        phone_number: '081234567893',
        avatar_url: null,
    },
    {
        id: 5,
        name: 'Development Lead',
        email: 'devlead@nagari.co.id',
        password: 'password123',
        role: 'development_lead',
        division: { code: 'IT-DEV', name: 'IT Development' },
        phone_number: '081234567894',
        avatar_url: null,
    },
    {
        id: 6,
        name: 'Project Manager',
        email: 'pm@nagari.co.id',
        password: 'password123',
        role: 'project_manager',
        division: { code: 'IT-DEV', name: 'IT Development' },
        phone_number: '081234567895',
        avatar_url: null,
    },
    {
        id: 7,
        name: 'Developer',
        email: 'developer@nagari.co.id',
        password: 'password123',
        role: 'developer',
        division: { code: 'IT-DEV', name: 'IT Development' },
        phone_number: '081234567896',
        avatar_url: null,
    },
    {
        id: 8,
        name: 'QA Lead',
        email: 'qalead@nagari.co.id',
        password: 'password123',
        role: 'qa_lead',
        division: { code: 'IT-QA', name: 'IT Quality Assurance' },
        phone_number: '081234567897',
        avatar_url: null,
    },
    {
        id: 9,
        name: 'QA Tester',
        email: 'qatester@nagari.co.id',
        password: 'password123',
        role: 'qa_tester',
        division: { code: 'IT-QA', name: 'IT Quality Assurance' },
        phone_number: '081234567898',
        avatar_url: null,
    },
    {
        id: 10,
        name: 'Cyber Security Lead',
        email: 'cyberlead@nagari.co.id',
        password: 'password123',
        role: 'cyber_lead',
        division: { code: 'IT-SEC', name: 'IT Security' },
        phone_number: '081234567899',
        avatar_url: null,
    },
    {
        id: 11,
        name: 'Pentester',
        email: 'pentester@nagari.co.id',
        password: 'password123',
        role: 'pentester',
        division: { code: 'IT-SEC', name: 'IT Security' },
        phone_number: '081234567800',
        avatar_url: null,
    },
    {
        id: 12,
        name: 'Business User / Pemohon',
        email: 'user@nagari.co.id',
        password: 'password123',
        role: 'business_user',
        division: { code: 'IT-OPS', name: 'IT Operations' },
        phone_number: '081234567801',
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
                const sessionUser = parsed.user || parsed;

                if (sessionUser && (sessionUser.id || sessionUser.email)) {
                    setUser(sessionUser);
                    setIsLoggedIn(true);
                }
                setIsLoading(false);

                // Verifikasi token di background secara independen (silent sync)
                if (MODE === 'api' && parsed.token && parsed.token !== 'mock_token') {
                    authService.getCurrentUser()
                        .then(meRes => {
                            if (meRes && meRes.status === 'success' && meRes.data) {
                                const userData = {
                                    ...meRes.data,
                                    role: meRes.data.role?.name || sessionUser.role || 'super_admin',
                                };
                                setUser(userData);
                                localStorage.setItem(SESSION_KEY, JSON.stringify({ token: parsed.token, user: userData }));
                            }
                        })
                        .catch(err => {
                            console.warn('[AuthContext] Background sync notice:', err);
                        });
                }
            } catch (err) {
                console.error('[AuthContext] Parse session error:', err);
                setIsLoading(false);
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
        // Ambil token lama dari localStorage agar tidak hilang
        const existing = localStorage.getItem(SESSION_KEY);
        const token = existing ? (JSON.parse(existing).token || null) : null;
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user: updatedUser, token }));
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