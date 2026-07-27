// src/contexts/ChatContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import toast from 'react-hot-toast';

const ChatContext = createContext();

const STORAGE_CHAT_KEY = 'nagari_sdlc_chats';
const STORAGE_UNREAD_KEY = 'nagari_sdlc_chat_unread';

const initialMessages = {
    'PRJ-2023-001': [
        {
            id: 1,
            userId: 'pm-1',
            name: 'Budi Santoso',
            avatar: 'BS',
            message: 'Tolong pastikan dokumentasi FSD dan SIT Report sudah lengkap untuk tim QA.',
            timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
            type: 'text',
        },
        {
            id: 2,
            userId: 'system',
            name: 'Sistem SDLC',
            avatar: 'SY',
            message: 'Dokumen FSD_Aplikasi_LOS_v2.1.pdf telah diunggah oleh System Analyst.',
            timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
            type: 'system',
        },
        {
            id: 3,
            userId: 'dev-1',
            name: 'Dimas Anggara',
            avatar: 'DA',
            message: 'Siap Pak PM, modul kalkulasi suku bunga sedang di-test skenario edge case-nya.',
            timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
            type: 'text',
        },
    ],
    'PRJ-2026-099': [
        {
            id: 101,
            userId: 'analyst-1',
            name: 'Citra Kirana',
            avatar: 'CK',
            message: 'Spesifikasi API Gateway untuk pelaporan OJK sudah final di Swagger.',
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            type: 'text',
        },
        {
            id: 102,
            userId: 'dev-1',
            name: 'Dimas Anggara',
            avatar: 'DA',
            message: 'Baik Mbak Citra, koneksi microservices sedang kami hubungkan ke staging.',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            type: 'text',
        },
    ],
    'PRJ-2026-100': [
        {
            id: 201,
            userId: 'pm-1',
            name: 'Budi Santoso',
            avatar: 'BS',
            message: 'Eka, tolong selesaikan UI form inventaris minggu ini ya.',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            type: 'text',
        },
        {
            id: 202,
            userId: 'dev-2',
            name: 'Eka Putri',
            avatar: 'EP',
            message: 'Siap Pak, komponen React dan integrasi SSO sudah 80% selesai.',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            type: 'text',
        },
    ],
};

export function ChatProvider({ children }) {
    const { user } = useAuth();
    const { addNotification } = useNotifications();

    const [messagesMap, setMessagesMap] = useState(() => {
        const saved = localStorage.getItem(STORAGE_CHAT_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch { }
        }
        return initialMessages;
    });

    const [unreadMap, setUnreadMap] = useState(() => {
        const saved = localStorage.getItem(STORAGE_UNREAD_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch { }
        }
        return {};
    });

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messagesMap));
    }, [messagesMap]);

    useEffect(() => {
        localStorage.setItem(STORAGE_UNREAD_KEY, JSON.stringify(unreadMap));
    }, [unreadMap]);

    // Ambil pesan proyek
    const getMessages = (projectId) => {
        return messagesMap[projectId] || [];
    };

    // Ambil jumlah unread
    const getUnreadCount = (projectId) => {
        return unreadMap[projectId] || 0;
    };

    // Tandai sudah dibaca
    const markAsRead = (projectId) => {
        if (unreadMap[projectId] && unreadMap[projectId] > 0) {
            setUnreadMap(prev => ({
                ...prev,
                [projectId]: 0,
            }));
        }
    };

    // Kirim pesan baru
    const sendMessage = (projectId, text, projectName = 'Proyek SDLC', type = 'text') => {
        if (!text.trim()) return;

        const senderName = user?.name || 'Pengguna';
        const senderInitials = senderName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2) || 'U';

        const newMessage = {
            id: Date.now(),
            userId: user?.id || `user-${Date.now()}`,
            name: senderName,
            avatar: senderInitials,
            message: text,
            timestamp: new Date().toISOString(),
            type: type,
        };

        // Update messages state
        setMessagesMap(prev => {
            const currentList = prev[projectId] || [];
            return {
                ...prev,
                [projectId]: [...currentList, newMessage],
            };
        });

        // Trigger Notification ke NotificationContext jika bukan system message
        if (type !== 'system') {
            const truncatedMsg = text.length > 40 ? text.substring(0, 40) + '...' : text;
            addNotification(
                `Pesan Chat Baru (${projectId})`,
                `${senderName} di ${projectName}: "${truncatedMsg}"`,
                'info',
                `/pm/workspace`
            );

            // Increment unread count for other team members
            setUnreadMap(prev => ({
                ...prev,
                [projectId]: (prev[projectId] || 0) + 1,
            }));
        }

        // Auto-reply system jika mengandung "help" atau "bantuan"
        const lowerText = text.toLowerCase();
        if (lowerText.includes('help') || lowerText.includes('bantuan')) {
            setTimeout(() => {
                const replyMsg = {
                    id: Date.now() + 1,
                    userId: 'system-assistant',
                    name: 'Asisten Otomatis Bank Nagari',
                    avatar: 'SY',
                    message: 'Halo! Saya Asisten Otomatis SDLC. Untuk bantuan teknis atau otorisasi peran, silakan hubungi PM proyek atau kirim tiket ke IT Support (Ext. 404).',
                    timestamp: new Date().toISOString(),
                    type: 'system',
                };
                setMessagesMap(prev => ({
                    ...prev,
                    [projectId]: [...(prev[projectId] || []), replyMsg],
                }));
            }, 1800);
        }
    };

    // Helper kirim pesan sistem (misal saat upload FSD / rilis)
    const sendSystemMessage = (projectId, text) => {
        sendMessage(projectId, text, 'Proyek SDLC', 'system');
    };

    return (
        <ChatContext.Provider
            value={{
                getMessages,
                sendMessage,
                sendSystemMessage,
                markAsRead,
                getUnreadCount,
                messagesMap,
                unreadMap,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
