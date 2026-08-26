// src/pages/admin/Settings.jsx
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import {
    User,
    Shield,
    Database,
    Clock,
    Server,
    Link2,
    LogOut,
    Users,
    Settings as SettingsIcon,
    Eye,
    EyeOff,
} from 'lucide-react';
import { authService, sessionStore, userService } from '../../services/api';
import { getPasswordError, PASSWORD_REQUIREMENT_HINT } from '../../constants/passwordPolicy';
import { buildProfileFromUser } from '../../utils/userProfile';
import toast from 'react-hot-toast';

// Sub-komponen untuk setiap tab
const ProfileSettings = ({ user, profile }) => {
    const { updateProfile } = useAuth();

    // formData berisi draft yang belum disimpan; null berarti tidak sedang
    // mengedit. Dengan begitu tidak ada salinan data profil yang bisa membeku
    // saat user pada context baru tersedia setelah komponen ini dirender.
    const [formData, setFormData] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditing = formData !== null;
    const view = formData ?? profile;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        if (!formData) return;

        if (!formData.name.trim()) {
            toast.error('Nama lengkap wajib diisi.');
            return;
        }

        setIsSubmitting(true);
        try {
            // Lewat AuthContext, bukan authService langsung, supaya user pada
            // context dan localStorage ikut tersegarkan. Toast keberhasilan
            // sudah dikeluarkan di sana.
            const result = await updateProfile({
                name: formData.name.trim(),
                phone_number: formData.phone.trim() || null,
            });

            if (result?.success) {
                setFormData(null);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">Informasi Akun</h3>
                    <p className="text-sm text-gray-500">Kelola data pribadi dan informasi akun Anda.</p>
                </div>
                {!isEditing ? (
                    <button
                        onClick={() => setFormData(profile)}
                        className="px-4 py-2 bg-[#00529C] text-white rounded-lg text-sm font-medium hover:bg-[#004080] transition-colors"
                    >
                        Edit Profil
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFormData(null)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-[#003a73] text-white rounded-lg text-sm font-medium hover:bg-[#002a5a] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Foto Profil</label>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-[#003a73] text-white flex items-center justify-center text-2xl font-bold">
                            {view.name.trim().charAt(0).toUpperCase() || '?'}
                        </div>
                        <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                            Upload Foto
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
                    {isEditing ? (
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Nama lengkap sesuai data kepegawaian"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00529C] focus:border-transparent"
                        />
                    ) : (
                        <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">{view.name || '-'}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                    <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">{view.email || '-'}</p>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">No. Handphone</label>
                    {isEditing ? (
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="Contoh: 08xxxxxxxxxx"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00529C] focus:border-transparent"
                        />
                    ) : (
                        <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">{view.phone || 'Belum diisi'}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Divisi / Departemen</label>
                    <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">{view.department || 'Belum diatur admin'}</p>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                    <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">{view.roleLabel || view.role || 'Belum diatur admin'}</p>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
                {/* Tanggal bergabung dibaca dari created_at akun; sebelumnya nilai ini
                    selalu menampilkan tanggal hari ini sehingga tidak pernah benar. */}
                <p className="text-xs text-gray-400">
                    <span className="font-semibold">ID User:</span> {user?.id ?? '-'} &nbsp;•&nbsp;
                    <span className="font-semibold">Bergabung:</span>{' '}
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : '-'}
                </p>
            </div>
        </div>
    );
};

const SecuritySettings = () => {
    const { logout } = useAuth();
    const [password, setPassword] = useState({ current: '', new: '', confirm: '' });
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Waktu mulai sesi dibaca dari sesi yang benar-benar tersimpan di peramban ini.
    const sessionStartedAt = useMemo(() => {
        const issuedAt = sessionStore.read()?.issuedAt;
        return issuedAt ? new Date(issuedAt) : null;
    }, []);

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPassword(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (password.new !== password.confirm) {
            toast.error('Konfirmasi password tidak cocok!');
            return;
        }
        const passwordError = getPasswordError(password.new);
        if (passwordError) {
            toast.error(passwordError);
            return;
        }
        // Backend menolak password baru yang sama dengan password saat ini
        // (aturan `different`), jadi diberitahukan di sini sebelum request dikirim.
        if (password.new === password.current) {
            toast.error('Password baru harus berbeda dari password saat ini.');
            return;
        }
        try {
            await authService.updatePassword(password.current, password.new);
            toast.success('Password berhasil diperbarui & tersimpan di database!');
            setPassword({ current: '', new: '', confirm: '' });
        } catch (err) {
            toast.error(`Gagal mengubah password: ${err.message}`);
        }
    };

    const togglePassword = (field) => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Keamanan Akun</h3>
                <p className="text-sm text-gray-500">Kelola password dan pengaturan keamanan akun Anda.</p>
            </div>

            {/* Change Password */}
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                <h4 className="font-semibold text-gray-700">Ubah Password</h4>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Password Saat Ini</label>
                    <div className="relative">
                        <input
                            type={showPasswords.current ? 'text' : 'password'}
                            name="current"
                            value={password.current}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00529C] focus:border-transparent"
                            required
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => togglePassword('current')}
                        >
                            {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Password Baru</label>
                    <div className="relative">
                        <input
                            type={showPasswords.new ? 'text' : 'password'}
                            name="new"
                            value={password.new}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00529C] focus:border-transparent"
                            required
                            minLength="8"
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => togglePassword('new')}
                        >
                            {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{PASSWORD_REQUIREMENT_HINT}</p>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Konfirmasi Password Baru</label>
                    <div className="relative">
                        <input
                            type={showPasswords.confirm ? 'text' : 'password'}
                            name="confirm"
                            value={password.confirm}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00529C] focus:border-transparent"
                            required
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => togglePassword('confirm')}
                        >
                            {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <button
                    type="submit"
                    className="px-4 py-2 bg-[#003a73] text-white rounded-lg font-medium hover:bg-[#002a5a] transition-colors"
                >
                    Perbarui Password
                </button>
            </form>

            {/*
              * Sesi perangkat ini.
              *
              * Blok ini sebelumnya menampilkan "Chrome • Windows • IP 192.168.1.1"
              * yang ditulis langsung di berkas ini untuk setiap pengguna, ditemani
              * tombol "Keluar dari Semua Perangkat" tanpa penangan klik. Backend tidak
              * menyimpan daftar perangkat maupun endpoint pencabutan seluruh token,
              * jadi yang ditampilkan sekarang hanya sesi peramban ini dan tombolnya
              * memanggil POST /auth/logout yang memang ada.
              *
              * Blok Autentikasi Dua Faktor juga dihapus: sakelarnya hanya mengubah
              * state lokal, tidak ada kolom, endpoint, maupun alur verifikasi 2FA di
              * backend, sehingga tampilannya menjanjikan perlindungan yang tidak ada.
              */}
            <div className="pt-4 border-t border-gray-200 max-w-md">
                <h4 className="font-semibold text-gray-700 mb-4">Sesi Perangkat Ini</h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <p className="font-medium text-gray-800">Sesi aktif di peramban ini</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Clock size={12} />
                                {sessionStartedAt
                                    ? `Masuk sejak ${sessionStartedAt.toLocaleString('id-ID', {
                                        day: '2-digit', month: 'long', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                    })}`
                                    : 'Waktu mulai sesi tidak tercatat'}
                            </p>
                        </div>
                        <span className="text-xs text-emerald-600 font-medium">Aktif</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <LogOut size={14} />
                        {isLoggingOut ? 'Mengakhiri sesi...' : 'Keluar dari Perangkat Ini'}
                    </button>
                    <p className="text-xs text-gray-500">
                        Sistem belum mencatat daftar perangkat, sehingga sesi di perangkat lain
                        harus diakhiri dari perangkat tersebut.
                    </p>
                </div>
            </div>
        </div>
    );
};

/**
 * Ikhtisar sistem.
 *
 * Semua angka di sini harus punya sumber. Versi sebelumnya menampilkan "Total
 * Pengguna 47", "Uptime Sistem 99.8%", dan "Versi Aplikasi v2.4.0" sebagai teks
 * tetap di berkas ini — tiga angka yang tidak pernah diukur maupun dibaca dari mana
 * pun, padahal ditampilkan di halaman pengaturan sebagai kondisi sistem. Jumlah
 * pengguna sekarang dihitung dari GET /users, dan sebagai ganti uptime serta versi
 * ditampilkan lingkungan build dan alamat API yang benar-benar dipakai peramban.
 *
 * Tiga tombol "Tindakan Sistem" (Clear Cache, Export Log Sistem, Reset Konfigurasi
 * ke Default) juga dihapus: ketiganya tidak punya penangan klik maupun endpoint.
 */
const SystemSettings = () => {
    const { projects } = useProjects();
    const [userCount, setUserCount] = useState(null);
    const [userCountError, setUserCountError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const loadUserCount = async () => {
            try {
                const res = await userService.getAll();
                if (cancelled) return;
                setUserCount(Array.isArray(res?.data) ? res.data.length : 0);
                setUserCountError(null);
            } catch (err) {
                if (cancelled) return;
                setUserCountError(err.message || 'Gagal memuat jumlah pengguna.');
            }
        };

        loadUserCount();
        return () => { cancelled = true; };
    }, []);

    const apiBaseUrl = import.meta.env.VITE_API_URL || 'Belum dikonfigurasi';
    const buildMode = import.meta.env.MODE || 'tidak diketahui';

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Informasi Sistem</h3>
                <p className="text-sm text-gray-500">Ringkasan data dan konfigurasi aplikasi yang sedang berjalan.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <Database size={20} className="text-[#00529C]" />
                        <div>
                            <p className="font-semibold text-gray-800">Total Proyek</p>
                            <p className="text-2xl font-bold text-gray-800">{projects.length}</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <Users size={20} className="text-[#00529C]" />
                        <div>
                            <p className="font-semibold text-gray-800">Total Pengguna</p>
                            {userCountError ? (
                                <p className="text-sm text-red-500 mt-0.5">{userCountError}</p>
                            ) : (
                                <p className="text-2xl font-bold text-gray-800">
                                    {userCount === null ? 'Memuat...' : userCount}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <Server size={20} className="text-[#00529C]" />
                        <div>
                            <p className="font-semibold text-gray-800">Lingkungan Aplikasi</p>
                            <p className="text-lg font-bold text-gray-800 capitalize">{buildMode}</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <Link2 size={20} className="text-[#00529C]" />
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-800">Alamat API</p>
                            <p className="text-sm font-mono text-gray-700 break-all">{apiBaseUrl}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main Settings Component
export default function Settings() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');

    // Profil dibaca ulang dari user pada context setiap kali user berubah,
    // sehingga tab Profil langsung menampilkan hasil penyimpanan terakhir.
    const profile = useMemo(() => buildProfileFromUser(user), [user]);

    // Tab Notifikasi dan Tampilan dihapus. Keduanya hanya berisi sakelar yang
    // mengubah state lokal: preferensi notifikasi tidak punya endpoint penyimpanan
    // (tombolnya bahkan menampilkan "berhasil disimpan" tanpa mengirim apa pun),
    // dan pilihan tema gelap, animasi, serta compact mode tidak pernah diterapkan
    // ke antarmuka. Tampilkan kembali setelah penyimpanan preferensinya ada.
    const tabs = [
        { id: 'profile', label: 'Profil', icon: User },
        { id: 'security', label: 'Keamanan', icon: Shield },
        { id: 'system', label: 'Sistem', icon: SettingsIcon },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return <ProfileSettings user={user} profile={profile} />;
            case 'security':
                return <SecuritySettings />;
            case 'system':
                return <SystemSettings />;
            default:
                return null;
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <SettingsIcon size={24} className="text-[#00529C]" />
                            Pengaturan Sistem
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Kelola profil, keamanan akun, dan lihat informasi sistem.
                        </p>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex overflow-x-auto border-b border-gray-200 bg-white rounded-t-xl shadow-sm">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${isActive
                                    ? 'border-[#00529C] text-[#00529C]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}