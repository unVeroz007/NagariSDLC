import { useState, useRef, useEffect } from 'react';
import { Bell, X, ChevronRight, AlertCircle, Info, CheckCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale/id';

/**
 * Peran yang boleh membuka Activity Log. Nilainya wajib sama dengan `ADMIN_ROLES`
 * pada `router/index.jsx`, yang menjaga rute `/admin/activity-log`.
 */
const ACTIVITY_LOG_ROLES = ['super_admin'];

/**
 * src/components/NotificationBell.jsx
 *
 * Lonceng notifikasi di topbar. Seluruh datanya berasal dari
 * `NotificationContext`, yang kini memuat kotak masuk `GET /notifications` dan
 * mem-polling-nya; komponen ini tidak memanggil API secara langsung.
 *
 * Dua sumber ditampilkan dalam satu daftar (lihat `NotificationContext`):
 * baris server yang persisten, dan pemberitahuan lokal satu sesi hasil aksi
 * pengguna sendiri. Perbedaannya yang terlihat di sini hanya dua: baris server
 * tidak punya tautan tujuan (kolomnya tidak ada di tabel) dan tidak dapat
 * dihapus (endpoint-nya tidak ada), sehingga keduanya diberi label sumber agar
 * pengguna tidak menduga tombol yang memang tidak tersedia.
 */
export default function NotificationBell() {
    const {
        notifications,
        unreadCount,
        isLoading,
        error,
        refresh,
        markAsRead,
        markAllAsRead,
        removeNotification,
    } = useNotifications();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const canOpenActivityLog = ACTIVITY_LOG_ROLES.includes(user?.role);

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
        } catch {
            return 'baru saja';
        }
    };

    /*
     * Klik pada satu notifikasi.
     *
     * `markAsRead` menyimpan status terbaca ke backend untuk baris server dan cukup
     * mengubah state untuk item lokal; keduanya dibedakan di dalam context, jadi di
     * sini tidak perlu percabangan. Sengaja tidak di-`await`: penandaan berjalan di
     * latar belakang dan tampilannya sudah berubah optimistis, sehingga navigasi
     * tidak perlu menunggu jaringan.
     *
     * Dropdown hanya ditutup bila memang berpindah halaman. Sebelumnya ia selalu
     * tertutup pada klik apa pun, padahal mayoritas notifikasi kini berasal dari
     * server dan tidak punya tujuan navigasi — pengguna yang hendak membaca beberapa
     * notifikasi harus membuka loncengnya kembali setelah setiap klik.
     */
    const handleNotificationClick = (notif) => {
        markAsRead(notif.id);
        if (notif.relatedUrl) {
            setIsOpen(false);
            navigate(notif.relatedUrl);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => {
                    const willOpen = !isOpen;
                    setIsOpen(willOpen);
                    // Saat dibuka, muat ulang di luar jadwal polling: inilah satu-satunya
                    // saat isi daftarnya benar-benar dibaca, dan selang polling 30 detik
                    // bisa membuat notifikasi yang baru masuk belum tampak.
                    if (willOpen) refresh();
                }}
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
                                    onClick={() => markAllAsRead()}
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

                    {/*
                      * Pita galat. Notifikasi dimuat di latar belakang, jadi kegagalannya
                      * tidak boleh ditelan diam-diam: tanpa pita ini kotak masuk yang gagal
                      * dimuat terlihat sama persis dengan kotak masuk yang benar-benar
                      * kosong. Ditempatkan di atas daftar supaya data terakhir yang berhasil
                      * dimuat tetap terbaca di bawahnya.
                      */}
                    {error && (
                        <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-4 py-3">
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-red-700">Notifikasi gagal dimuat</p>
                                <p className="mt-0.5 text-xs text-red-600 break-words">{error}</p>
                            </div>
                            <button
                                onClick={() => refresh()}
                                className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                            >
                                <RefreshCw size={12} /> Coba lagi
                            </button>
                        </div>
                    )}

                    {/* List Notifikasi */}
                    <div className="overflow-y-auto max-h-[400px] divide-y divide-gray-100">
                        {isLoading && notifications.length === 0 ? (
                            /*
                             * Pemuat hanya tampil pada pemuatan pertama dan selalu berakhir
                             * (context menutup `isLoading` di blok `finally`, baik saat berhasil
                             * maupun gagal), jadi tidak ada keadaan berputar tanpa ujung.
                             */
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <span className="mb-3 h-6 w-6 rounded-full border-2 border-gray-200 border-t-[#00529C] animate-spin" />
                                <p className="text-sm">Memuat notifikasi...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <Bell size={32} className="mb-2" />
                                <p className="text-sm">Tidak ada notifikasi</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={`${notif.source}:${notif.id}`}
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
                                                {/*
                                                  * Tombol hapus hanya untuk pemberitahuan lokal. API tidak
                                                  * menyediakan endpoint hapus notifikasi, jadi menampilkannya
                                                  * pada baris server berarti menjanjikan aksi yang akan
                                                  * dibatalkan sendiri oleh polling berikutnya.
                                                  */}
                                                {notif.source === 'local' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeNotification(notif.id);
                                                        }}
                                                        title="Sembunyikan pemberitahuan ini"
                                                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
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
                    {/*
                      * Tautan ke Activity Log hanya untuk peran yang memang boleh
                      * membukanya. Sebelumnya tombol ini tampil untuk semua peran dan
                      * mengarah ke `/admin/audit`; rute itu meneruskan ke
                      * `/admin/activity-log` yang dijaga `ADMIN_ROLES` (hanya
                      * super_admin), sehingga 13 dari 14 peran ditolak dan dikembalikan
                      * ke dashboard tanpa penjelasan. Tujuannya juga langsung ke rute
                      * sebenarnya, tanpa melewati pengalihan.
                      */}
                    {notifications.length > 0 && canOpenActivityLog && (
                        <div className="p-3 border-t border-gray-200 bg-gray-50/50 text-center">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/admin/activity-log');
                                }}
                                className="text-xs text-gray-500 hover:text-[#00529C] transition-colors"
                            >
                                Lihat riwayat aktivitas di Activity Log
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}