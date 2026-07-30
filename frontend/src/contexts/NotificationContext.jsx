import { createContext, useState, useContext, useEffect } from 'react';
import { mockNotifications } from '../data/mockData';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState(() => {
        const saved = localStorage.getItem('nagari_sdlc_notifications');
        if (saved) {
            try { return JSON.parse(saved); } catch { }
        }
        return [];
    });

    const [unreadCount, setUnreadCount] = useState(() => {
        const saved = localStorage.getItem('nagari_sdlc_notifications');
        if (saved) {
            try {
                const list = JSON.parse(saved);
                return list.filter(n => !n.isRead).length;
            } catch { }
        }
        return 0;
    });

    useEffect(() => {
        localStorage.setItem('nagari_sdlc_notifications', JSON.stringify(notifications));
    }, [notifications]);


    // Fungsi untuk menambah notifikasi baru
    const addNotification = (title, message, type = 'info', relatedUrl = null) => {
        const newNotif = {
            id: Date.now(),
            title,
            message,
            type, // 'info', 'success', 'warning', 'danger'
            isRead: false,
            createdAt: new Date().toISOString(),
            relatedUrl,
        };
        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Optional: play sound jika diinginkan
        return newNotif;
    };

    // Fungsi untuk menandai satu notifikasi sebagai sudah dibaca
    const markAsRead = (id) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    // Fungsi untuk menandai semua notifikasi sebagai sudah dibaca
    const markAllAsRead = () => {
        setNotifications(prev =>
            prev.map(n => ({ ...n, isRead: true }))
        );
        setUnreadCount(0);
    };

    // Fungsi untuk menghapus notifikasi
    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        // Update unread count jika notifikasi yang dihapus belum dibaca
        const removed = notifications.find(n => n.id === id);
        if (removed && !removed.isRead) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    // Simulasi notifikasi masuk dari berbagai event
    // Ini bisa dijalankan di useEffect atau dipanggil dari komponen lain
    useEffect(() => {
        // Simulasi notifikasi periodik (untuk demo)
        const interval = setInterval(() => {
            // Hanya tambahkan jika sudah ada notifikasi dari action
            // Biarkan event yang memicu notifikasi dari action
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            addNotification,
            markAsRead,
            markAllAsRead,
            removeNotification,
            setNotifications, // untuk testing/mock
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
}