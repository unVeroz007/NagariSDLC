// src/contexts/AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';

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
];

const SESSION_KEY = 'nagari_sdlc_session';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // untuk cek session awal

    // Saat app pertama dimuat, cek apakah ada session di localStorage
    useEffect(() => {
        const savedSession = localStorage.getItem(SESSION_KEY);
        if (savedSession) {
            try {
                const parsedUser = JSON.parse(savedSession);
                // Validasi bahwa user masih ada di "database" kita
                const validUser = MOCK_USERS.find(u => u.id === parsedUser.id);
                if (validUser) {
                    const { password: _, ...userWithoutPass } = validUser;
                    setUser(userWithoutPass);
                    setIsLoggedIn(true);
                } else {
                    localStorage.removeItem(SESSION_KEY);
                }
            } catch {
                localStorage.removeItem(SESSION_KEY);
            }
        }
        setIsLoading(false);
    }, []);

    /**
     * Login dengan email dan password.
     * Mengembalikan { success: true } atau { success: false, message: '...' }
     */
    const login = (email, password) => {
        const foundUser = MOCK_USERS.find(
            u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (!foundUser) {
            return { success: false, message: 'Email atau password salah.' };
        }

        // Jangan simpan password di state/localStorage
        const { password: _, ...userWithoutPass } = foundUser;
        setUser(userWithoutPass);
        setIsLoggedIn(true);

        // Simpan session ke localStorage agar persist setelah refresh
        localStorage.setItem(SESSION_KEY, JSON.stringify(userWithoutPass));

        return { success: true };
    };

    /**
     * Logout: hapus state dan session.
     */
    const logout = () => {
        setUser(null);
        setIsLoggedIn(false);
        localStorage.removeItem(SESSION_KEY);
    };

    /**
     * Update data profil user yang sedang login.
     */
    const updateProfile = (updates) => {
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
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