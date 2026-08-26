// src/contexts/ChatContext.jsx
// Chat per proyek — terhubung ke backend (ChatController) agar pesan tersimpan
// permanen & sinkron lintas user/laman. Menyediakan cache in-memory per proyek
// + polling ringan saat tab aktif agar pesan baru dari user lain muncul.
import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { chatService } from '../services/api';
import { useVisibilityPolling } from '../hooks/usePolling';
import { POLLING_INTERVAL_MS } from '../constants/polling';

const ChatContext = createContext();

export function ChatProvider({ children }) {
    const { isLoggedIn } = useAuth();

    // Cache pesan per proyek: { [projectId]: Message[] }
    const [messagesMap, setMessagesMap] = useState({});
    // Status loading per proyek: { [projectId]: bool }
    const [loadingMap, setLoadingMap] = useState({});
    // Inisialisasi chat per proyek agar tidak fetch ulang berulang
    const fetchedRef = useRef(new Set());
    // Proyek yang chat-nya terakhir dibuka. Polling hanya menyegarkan proyek ini,
    // bukan seluruh proyek yang pernah dimuat: setelah pengguna membuka beberapa
    // proyek, `fetchedRef` terus bertambah dan polling lama menembakkan satu
    // request per proyek setiap 10 detik untuk ruang chat yang tidak terlihat.
    const activeProjectRef = useRef(null);

    // ── Load pesan dari backend ──
    const loadMessages = useCallback(async (projectId, { force = false } = {}) => {
        if (!projectId) return;
        activeProjectRef.current = String(projectId);
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

    // ── Kirim pesan ──
    // Tipe pesan tidak lagi dikirim dari sini. Backend selalu menyimpan `text`
    // karena pesan bertipe `system` harus berasal dari kode server; kalau klien
    // boleh menentukannya, pengguna biasa dapat memalsukan pengumuman sistem.
    const sendMessage = async (projectId, text) => {
        if (!text.trim() || !projectId) return;
        try {
            const res = await chatService.send(projectId, text.trim());
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

    // ── Polling ringan saat tab aktif agar pesan user lain muncul ──
    // Selang waktunya dipusatkan di `constants/polling.js`.
    const pollMessages = useCallback(() => {
        const activeProjectId = activeProjectRef.current;
        if (!activeProjectId) return;
        loadMessages(activeProjectId, { force: true });
    }, [loadMessages]);

    useVisibilityPolling(pollMessages, POLLING_INTERVAL_MS.chatMessages, {
        enabled: isLoggedIn,
    });

    // Reset cache saat logout. Ini sinkronisasi terhadap sesi (sumber di luar
    // komponen), bukan turunan state yang bisa dihitung saat render, jadi setState
    // di dalam effect memang tepat di sini.
    useEffect(() => {
        if (!isLoggedIn) {
            fetchedRef.current = new Set();
            activeProjectRef.current = null;
            // eslint-disable-next-line react-hooks/set-state-in-effect -- bersihkan cache pesan saat sesi berakhir
            setMessagesMap({});
        }
    }, [isLoggedIn]);

    return (
        <ChatContext.Provider
            value={{
                getMessages,
                sendMessage,
                loadMessages,
                loadingMap,
                messagesMap,
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
