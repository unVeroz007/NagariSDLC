// src/contexts/ChatContext.jsx
// Chat per proyek — terhubung ke backend (ChatController) agar pesan tersimpan
// permanen & sinkron lintas user/laman. Menyediakan cache in-memory per proyek
// + polling ringan saat tab aktif agar pesan baru dari user lain muncul.
import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { chatService } from '../services/api';

const ChatContext = createContext();

export function ChatProvider({ children }) {
    const { user, isLoggedIn } = useAuth();

    // Cache pesan per proyek: { [projectId]: Message[] }
    const [messagesMap, setMessagesMap] = useState({});
    // Status loading per proyek: { [projectId]: bool }
    const [loadingMap, setLoadingMap] = useState({});
    // Inisialisasi chat per proyek agar tidak fetch ulang berulang
    const fetchedRef = useRef(new Set());

    // ── Load pesan dari backend ──
    const loadMessages = useCallback(async (projectId, { force = false } = {}) => {
        if (!projectId) return;
        if (fetchedRef.current.has(String(projectId)) && !force) return;

        setLoadingMap(prev => ({ ...prev, [String(projectId)]: true }));
        try {
            const res = await chatService.getByProject(projectId);
            const list = Array.isArray(res?.data) ? res.data : [];
            setMessagesMap(prev => ({ ...prev, [String(projectId)]: list }));
            fetchedRef.current.add(String(projectId));
        } catch {
            // Abaikan — biarkan cache / empty state
        } finally {
            setLoadingMap(prev => ({ ...prev, [String(projectId)]: false }));
        }
    }, []);

    // ── Get messages (hanya baca cache — PURE, tidak trigger fetch) ──
    const getMessages = (projectId) => {
        return messagesMap[String(projectId)] || [];
    };

    const getUnreadCount = () => 0;

    const markAsRead = () => {};

    // ── Kirim pesan ──
    const sendMessage = async (projectId, text, _projectName = 'Proyek SDLC', type = 'text') => {
        if (!text.trim() || !projectId) return;
        try {
            const res = await chatService.send(projectId, text.trim(), type);
            if (res?.data) {
                setMessagesMap(prev => ({
                    ...prev,
                    [String(projectId)]: [...(prev[String(projectId)] || []), res.data],
                }));
            } else {
                // Fallback: refresh dari server agar konsisten
                await loadMessages(projectId, { force: true });
            }
        } catch {
            // Biarkan — toast di UI
        }
    };

    const sendSystemMessage = (projectId, text) => sendMessage(projectId, text, 'Proyek SDLC', 'system');

    // ── Polling ringan saat tab aktif (10 detik) agar pesan user lain muncul ──
    useEffect(() => {
        if (!isLoggedIn) return;
        const poll = () => {
            if (document.visibilityState !== 'visible') return;
            // Refresh semua proyek yang sudah di-load
            fetchedRef.current.forEach(pid => {
                loadMessages(pid, { force: true });
            });
        };
        const timer = setInterval(poll, 10000);
        return () => clearInterval(timer);
    }, [isLoggedIn, loadMessages]);

    // Reset cache saat logout
    useEffect(() => {
        if (!isLoggedIn) {
            fetchedRef.current = new Set();
            setMessagesMap({});
        }
    }, [isLoggedIn]);

    return (
        <ChatContext.Provider
            value={{
                getMessages,
                sendMessage,
                sendSystemMessage,
                markAsRead,
                getUnreadCount,
                loadMessages,
                loadingMap,
                messagesMap,
                unreadMap: {},
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
