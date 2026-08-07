import { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, ChevronRight, AlertCircle, Info, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale/id';

export default function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // Tutup dropdown saat klik di luar
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Dapatkan ikon berdasarkan tipe notifikasi
    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle size={16} className="text-emerald-500" />;
            case 'warning':
                return <AlertTriangle size={16} className="text-amber-500" />;
            case 'danger':
                return <AlertCircle size={16} className="text-red-500" />;
            default:
                return <Info size={16} className="text-blue-500" />;
        }
    };

    // Format waktu relatif
    const formatTime = (dateStr) => {
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: id });
        } catch (e) {
            return 'baru saja';
        }
    };

    // Handle klik notifikasi
    const handleNotificationClick = (notif) => {
        markAsRead(notif.id);
        setIsOpen(false);
        if (notif.relatedUrl) {
            navigate(notif.relatedUrl);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-500 hover:text-[#00529C] hover:bg-blue-50 rounded-full transition-colors"
            >
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 max-h-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
                        <h3 className="font-semibold text-gray-800">Notifikasi</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-[#00529C] hover:text-[#004080] font-medium transition-colors"
                                >
                                    Tandai Semua
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* List Notifikasi */}
                    <div className="overflow-y-auto max-h-[400px] divide-y divide-gray-100">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <Bell size={32} className="mb-2" />
                                <p className="text-sm">Tidak ada notifikasi</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.isRead ? 'bg-blue-50/50 hover:bg-blue-50' : ''
                                        }`}
                                    onClick={() => handleNotificationClick(notif)}
                                >
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm ${!notif.isRead ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                                                    {notif.title}
                                                </p>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeNotification(notif.id);
                                                    }}
                                                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <Clock size={12} className="text-gray-400" />
                                                <span className="text-xs text-gray-400">{formatTime(notif.createdAt)}</span>
                                                {notif.relatedUrl && (
                                                    <>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="text-xs text-[#00529C] hover:underline flex items-center gap-0.5">
                                                            Lihat <ChevronRight size={12} />
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-200 bg-gray-50/50 text-center">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/admin/audit');
                                }}
                                className="text-xs text-gray-500 hover:text-[#00529C] transition-colors"
                            >
                                Lihat semua notifikasi di Audit Trail
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}