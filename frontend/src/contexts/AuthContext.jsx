import { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

const mockUser = {
    id: 1,
    name: 'Ahmad Fauzi',
    email: 'ahmad@banknagari.com',
    role: 'super_admin',
    department: 'IT',
    avatar_url: null,
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(mockUser);
    const [isLoggedIn, setIsLoggedIn] = useState(true);

    const login = (email, password) => {
        setUser(mockUser);
        setIsLoggedIn(true);
    };

    const logout = () => {
        setUser(null);
        setIsLoggedIn(false);
    };

    return (
        <AuthContext.Provider value={{ user, isLoggedIn, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}