// src/components/ChatBox.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import {
    MessageSquare,
    Send,
    Paperclip,
    ChevronDown,
    ChevronUp,
    Clock,
    X,
    Zap,
} from 'lucide-react';

export default function ChatBox({
    projectId,
    projectName = 'Proyek SDLC',
    className = '',
    maxHeight = '420px',
    showHeader = true,
    isFloating = false,
}) {
    const { user } = useAuth();
    const { getMessages, sendMessage, markAsRead, getUnreadCount, loadMessages } = useChat();

    const [inputText, setInputText] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(isFloating);
    const chatContainerRef = useRef(null);

    // Load pesan proyek saat komponen tampil (fetch sekali via cache guard di context)
    useEffect(() => {
        if (projectId) {
            loadMessages(projectId);
        }
    }, [projectId, loadMessages]);

    const messages = getMessages(projectId);
    const unreadCount = getUnreadCount(projectId);

    // Auto-scroll ke bawah di dalam wadah pesan saja (tanpa scroll halaman utama browser)
    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        if (!isCollapsed) {
            scrollToBottom();
            markAsRead(projectId);
        }
    }, [messages, isCollapsed, projectId]);

    const handleSend = (e) => {
        e?.preventDefault();
        if (!inputText.trim()) return;

        sendMessage(projectId, inputText, projectName, 'text');
        setInputText('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Helper format tanggal separator
    const formatDateSeparator = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Hari ini';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Kemarin';
        } else {
            return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        }
    };

    // Helper format jam timestamp
    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    };

    // Group messages by date for date separators
    const groupedMessages = messages.reduce((acc, msg) => {
        const dateKey = formatDateSeparator(msg.timestamp);
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(msg);
        return acc;
    }, {});

    // Floating Button State
    if (isFloating && isCollapsed) {
        return (
            <button
                onClick={() => { setIsCollapsed(false); markAsRead(projectId); }}
                className="fixed bottom-6 right-6 z-50 bg-[#1a365d] hover:bg-[#0f2342] text-white p-4 rounded-full shadow-2xl flex items-center gap-3 transition-all hover:scale-105 border-2 border-white"
            >
                <div className="relative">
                    <MessageSquare size={24} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <span className="font-bold text-xs hidden sm:inline">Diskusi Proyek ({projectId})</span>
            </button>
        );
    }

    return (
        <div
            className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col transition-all ${className} ${
                isFloating ? 'fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] shadow-2xl border-2 border-blue-900/20' : 'w-full'
            }`}
        >
            {/* HEADER */}
            {showHeader && (
                <div className="bg-gradient-to-r from-[#1a365d] to-[#0f2342] text-white p-3.5 px-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <MessageSquare size={18} className="text-blue-300 shrink-0" />
                        <div className="min-w-0">
                            <h3 className="font-bold text-xs tracking-wide truncate flex items-center gap-2">
                                Diskusi Proyek: {projectName}
                            </h3>
                            <div className="text-[10px] text-blue-200/80 truncate font-mono">{projectId}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                                {unreadCount} baru
                            </span>
                        )}
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-blue-200 hover:text-white"
                            title={isCollapsed ? 'Buka Chat' : 'Kecilkan Chat'}
                        >
                            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        </button>
                    </div>
                </div>
            )}

            {/* CHAT BODY (Jika tidak collapsed) */}
            {!isCollapsed && (
                <>
                    {/* Message Area */}
                    <div
                        ref={chatContainerRef}
                        className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 text-xs"
                        style={{ height: maxHeight, maxHeight: maxHeight }}
                    >
                        {Object.keys(groupedMessages).length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-10">
                                <MessageSquare size={36} className="mb-2 opacity-40 text-blue-600" />
                                <p className="font-bold text-gray-600">Belum Ada Diskusi</p>
                                <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
                                    Mulai percakapan tim proyek di sini. Semua pesan akan tersimpan dan dapat diakses anggota tim.
                                </p>
                            </div>
                        ) : (
                            Object.entries(groupedMessages).map(([dateLabel, dateMsgs]) => (
                                <div key={dateLabel} className="space-y-3">
                                    {/* Date Separator */}
                                    <div className="flex items-center my-3">
                                        <div className="flex-1 border-t border-gray-200"></div>
                                        <span className="px-3 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full py-0.5 mx-2 uppercase tracking-wider">
                                            {dateLabel}
                                        </span>
                                        <div className="flex-1 border-t border-gray-200"></div>
                                    </div>

                                    {/* Messages list */}
                                    {dateMsgs.map((msg) => {
                                        const isOwn =
                                            user?.name &&
                                            (msg.name.toLowerCase() === user.name.toLowerCase() ||
                                             msg.userId === user.id);
                                        const isSystem = msg.type === 'system';

                                        if (isSystem) {
                                            return (
                                                <div key={msg.id} className="flex justify-center my-2">
                                                    <div className="bg-blue-50/80 border border-blue-200 text-blue-900 px-3.5 py-2 rounded-xl text-[11px] font-mono max-w-xs sm:max-w-md text-center shadow-2xs">
                                                        <div className="font-bold text-blue-950 flex items-center justify-center gap-1 mb-0.5">
                                                            <Zap size={12} className="text-amber-500" /> {msg.name}
                                                        </div>
                                                        <p className="leading-relaxed">{msg.message}</p>
                                                        <div className="text-[9px] text-blue-400 mt-1">{formatTime(msg.timestamp)}</div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex items-start gap-2.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                                            >
                                                {/* Avatar (inisial dari nama) */}
                                                <div
                                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 shadow-sm ${
                                                        isOwn ? 'bg-[#1a365d]' : 'bg-gray-600'
                                                    }`}
                                                >
                                                    {(msg.avatar || (msg.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2))}
                                                </div>

                                                {/* Bubble Content */}
                                                <div className={`max-w-[75%] sm:max-w-[80%] ${isOwn ? 'items-end' : 'items-start'}`}>
                                                    <div className={`flex items-center gap-2 mb-1 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                                        <span className="font-bold text-[11px] text-gray-700">
                                                            {isOwn ? 'Anda' : msg.name}
                                                        </span>
                                                        <span className="text-[9px] text-gray-400">{formatTime(msg.timestamp)}</span>
                                                    </div>

                                                    <div
                                                        className={`p-3 rounded-2xl leading-relaxed text-xs shadow-2xs ${
                                                            isOwn
                                                                ? 'bg-[#1a365d] text-white rounded-tr-none font-normal'
                                                                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none font-normal'
                                                        }`}
                                                    >
                                                        {msg.message}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {/* INPUT AREA */}
                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
                            title="Lampirkan Dokumen (Placeholder)"
                        >
                            <Paperclip size={16} />
                        </button>

                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ketik pesan diskusi tim proyek... (Ketik 'help' untuk bantuan)"
                            className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all"
                        />

                        <button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="p-2 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0"
                            title="Kirim Pesan"
                        >
                            <Send size={15} />
                        </button>
                    </form>
                </>
            )}
        </div>
    );
}
