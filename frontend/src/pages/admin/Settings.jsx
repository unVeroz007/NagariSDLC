// src/pages/admin/Settings.jsx
import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import {
    Save,
    X,
    CheckCircle,
    AlertCircle,
    User,
    Mail,
    Phone,
    Building,
    Shield,
    Bell,
    Moon,
    Sun,
    Laptop,
    Globe,
    Lock,
    Key,
    Database,
    RefreshCw,
    Clock,
    Calendar,
    FileText,
    Users,
    Settings as SettingsIcon,
    ChevronRight,
    Search,
    Activity,
    LogOut,
    Eye,
    EyeOff,
    Palette,
    Smartphone,
    Monitor,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Sub-komponen untuk setiap tab
const ProfileSettings = ({ user, profile, setProfile, handleSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(profile);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = () => {
        setProfile(formData);
        setIsEditing(false);
        handleSave('Profil berhasil diperbarui!');
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
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-[#1A56DB] text-white rounded-lg text-sm font-medium hover:bg-[#1349c2] transition-colors"
                    >
                        Edit Profil
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setIsEditing(false); setFormData(profile); }}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-4 py-2 bg-[#003a73] text-white rounded-lg text-sm font-medium hover:bg-[#002a5a] transition-colors"
                        >
                            Simpan
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Foto Profil</label>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-[#003a73] text-white flex items-center justify-center text-2xl font-bold">
                            {formData.name?.charAt(0) || 'U'}
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
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent"
                        />
                    ) : (
                        <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">{formData.name}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                    <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">{formData.email}</p>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">No. Handphone</label>
                    {isEditing ? (
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent"
                        />
                    ) : (
                        <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">{formData.phone}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Divisi / Departemen</label>
                    <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">{formData.department}</p>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                    <p className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">{formData.role}</p>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-400">
                    <span className="font-semibold">ID User:</span> {user?.id || 'USR-001'} &nbsp;•&nbsp;
                    <span className="font-semibold">Bergabung:</span> {new Date().toLocaleDateString('id-ID')}
                </p>
            </div>
        </div>
    );
};

const SecuritySettings = () => {
    const [password, setPassword] = useState({ current: '', new: '', confirm: '' });
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [twoFA, setTwoFA] = useState(false);

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPassword(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (password.new !== password.confirm) {
            toast.error('Konfirmasi password tidak cocok!');
            return;
        }
        if (password.new.length < 8) {
            toast.error('Password minimal 8 karakter!');
            return;
        }
        toast.success('Password berhasil diperbarui!');
        setPassword({ current: '', new: '', confirm: '' });
    };

    const togglePassword = (field) => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
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
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent"
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
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent"
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
                    <p className="text-xs text-gray-400 mt-1">Minimal 8 karakter, kombinasi huruf dan angka.</p>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Konfirmasi Password Baru</label>
                    <div className="relative">
                        <input
                            type={showPasswords.confirm ? 'text' : 'password'}
                            name="confirm"
                            value={password.confirm}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent"
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

            {/* 2FA */}
            <div className="pt-4 border-t border-gray-200 max-w-md">
                <h4 className="font-semibold text-gray-700 mb-4">Autentikasi Dua Faktor (2FA)</h4>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                        <p className="font-semibold text-gray-800">Aplikasi Authenticator</p>
                        <p className="text-sm text-gray-500">Google Authenticator atau aplikasi sejenis.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={twoFA}
                            onChange={() => setTwoFA(!twoFA)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors relative">
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${twoFA ? 'translate-x-5' : ''}`} />
                        </div>
                    </label>
                </div>
            </div>

            {/* Session Management */}
            <div className="pt-4 border-t border-gray-200 max-w-md">
                <h4 className="font-semibold text-gray-700 mb-4">Sesi Aktif</h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <p className="font-medium text-gray-800">Perangkat Ini</p>
                            <p className="text-xs text-gray-500">Chrome • Windows • IP 192.168.1.1</p>
                        </div>
                        <span className="text-xs text-emerald-600 font-medium">Aktif</span>
                    </div>
                    <button className="text-sm text-red-500 hover:text-red-600 font-medium">
                        Keluar dari Semua Perangkat
                    </button>
                </div>
            </div>
        </div>
    );
};

const NotificationSettings = () => {
    const [notifications, setNotifications] = useState([
        { id: 'project', label: 'Update Proyek', desc: 'Notifikasi perubahan status proyek', enabled: true },
        { id: 'task', label: 'Tugas', desc: 'Notifikasi tugas baru atau perubahan', enabled: true },
        { id: 'qa', label: 'Pengajuan QA', desc: 'Notifikasi saat ada pengajuan QA', enabled: true },
        { id: 'cyber', label: 'Pengajuan Cyber', desc: 'Notifikasi saat ada pengajuan Cyber', enabled: true },
        { id: 'release', label: 'Pengajuan Rilis', desc: 'Notifikasi saat ada pengajuan rilis', enabled: true },
        { id: 'approval', label: 'Persetujuan', desc: 'Notifikasi saat ada permintaan approval', enabled: true },
        { id: 'weekly', label: 'Laporan Mingguan', desc: 'Ringkasan aktivitas mingguan', enabled: false },
        { id: 'system', label: 'Pesan Sistem', desc: 'Notifikasi pemeliharaan & update sistem', enabled: true },
    ]);

    const toggleNotification = (id) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n)
        );
    };

    const handleSave = () => {
        toast.success('Preferensi notifikasi berhasil disimpan!');
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Preferensi Notifikasi</h3>
                <p className="text-sm text-gray-500">Aktifkan atau nonaktifkan notifikasi untuk setiap jenis event.</p>
            </div>

            <div className="space-y-3 max-w-2xl">
                {notifications.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                        <div>
                            <p className="font-semibold text-gray-800">{item.label}</p>
                            <p className="text-sm text-gray-500">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={item.enabled}
                                onChange={() => toggleNotification(item.id)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors relative">
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${item.enabled ? 'translate-x-5' : ''}`} />
                            </div>
                        </label>
                    </div>
                ))}
            </div>

            <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#003a73] text-white rounded-lg font-medium hover:bg-[#002a5a] transition-colors"
            >
                Simpan Preferensi
            </button>
        </div>
    );
};

const AppearanceSettings = () => {
    const [theme, setTheme] = useState('light');

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Tampilan & Tema</h3>
                <p className="text-sm text-gray-500">Sesuaikan tampilan antarmuka sesuai preferensi Anda.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
                {/* Light Theme */}
                <div
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${theme === 'light' ? 'border-[#1A56DB] shadow-md' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    onClick={() => setTheme('light')}
                >
                    {theme === 'light' && (
                        <div className="text-[#1A56DB] float-right">
                            <CheckCircle size={20} />
                        </div>
                    )}
                    <div className="h-20 bg-gray-100 rounded-lg p-2 flex flex-col gap-1">
                        <div className="h-3 w-full bg-white rounded"></div>
                        <div className="flex gap-1">
                            <div className="w-1/3 h-10 bg-white rounded"></div>
                            <div className="w-2/3 h-10 bg-white rounded"></div>
                        </div>
                    </div>
                    <p className="text-center font-medium text-gray-800 mt-2">Terang</p>
                </div>

                {/* Dark Theme */}
                <div
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${theme === 'dark' ? 'border-[#1A56DB] shadow-md' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    onClick={() => setTheme('dark')}
                >
                    <div className="h-20 bg-gray-800 rounded-lg p-2 flex flex-col gap-1">
                        <div className="h-3 w-full bg-gray-700 rounded"></div>
                        <div className="flex gap-1">
                            <div className="w-1/3 h-10 bg-gray-700 rounded"></div>
                            <div className="w-2/3 h-10 bg-gray-700 rounded"></div>
                        </div>
                    </div>
                    <p className="text-center font-medium text-gray-800 mt-2">Gelap</p>
                </div>

                {/* System Theme */}
                <div
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${theme === 'system' ? 'border-[#1A56DB] shadow-md' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    onClick={() => setTheme('system')}
                >
                    <div className="h-20 flex rounded-lg overflow-hidden">
                        <div className="w-1/2 bg-gray-100 p-2 flex flex-col gap-1">
                            <div className="h-3 w-full bg-white rounded"></div>
                            <div className="w-full h-8 bg-white rounded"></div>
                        </div>
                        <div className="w-1/2 bg-gray-800 p-2 flex flex-col gap-1">
                            <div className="h-3 w-full bg-gray-700 rounded"></div>
                            <div className="w-full h-8 bg-gray-700 rounded"></div>
                        </div>
                    </div>
                    <p className="text-center font-medium text-gray-800 mt-2">Ikuti Sistem</p>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200 max-w-2xl">
                <h4 className="font-semibold text-gray-700 mb-3">Preferensi Lainnya</h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-700">Tampilkan animasi</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-emerald-500 transition-colors relative">
                                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                            </div>
                        </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-700">Compact mode (lebih padat)</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-emerald-500 transition-colors relative">
                                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SystemSettings = () => {
    const { projects } = useProjects();

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Pengaturan Sistem</h3>
                <p className="text-sm text-gray-500">Konfigurasi umum sistem dan informasi aplikasi.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <Database size={20} className="text-[#1A56DB]" />
                        <div>
                            <p className="font-semibold text-gray-800">Total Proyek</p>
                            <p className="text-2xl font-bold text-gray-800">{projects.length}</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <Users size={20} className="text-[#1A56DB]" />
                        <div>
                            <p className="font-semibold text-gray-800">Total Pengguna</p>
                            <p className="text-2xl font-bold text-gray-800">47</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <Clock size={20} className="text-[#1A56DB]" />
                        <div>
                            <p className="font-semibold text-gray-800">Uptime Sistem</p>
                            <p className="text-2xl font-bold text-gray-800">99.8%</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <Calendar size={20} className="text-[#1A56DB]" />
                        <div>
                            <p className="font-semibold text-gray-800">Versi Aplikasi</p>
                            <p className="text-2xl font-bold text-gray-800">v2.4.0</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200 max-w-3xl">
                <h4 className="font-semibold text-gray-700 mb-3">Tindakan Sistem</h4>
                <div className="space-y-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700">
                        <RefreshCw size={16} />
                        Clear Cache
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700">
                        <FileText size={16} />
                        Export Log Sistem
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-red-500">
                        <AlertCircle size={16} />
                        Reset Konfigurasi ke Default
                    </button>
                </div>
            </div>
        </div>
    );
};

// Main Settings Component
export default function Settings() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [profile, setProfile] = useState({
        name: user?.name || 'Ahmad Fauzi',
        email: user?.email || 'ahmad.fauzi@banknagari.co.id',
        phone: '+62 812 3456 7890',
        department: user?.department || 'IT',
        role: user?.role || 'Super Admin',
    });

    const handleSave = (message = 'Perubahan berhasil disimpan!') => {
        toast.success(message);
    };

    const tabs = [
        { id: 'profile', label: 'Profil', icon: User },
        { id: 'security', label: 'Keamanan', icon: Shield },
        { id: 'notifications', label: 'Notifikasi', icon: Bell },
        { id: 'appearance', label: 'Tampilan', icon: Palette },
        { id: 'system', label: 'Sistem', icon: SettingsIcon },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return <ProfileSettings user={user} profile={profile} setProfile={setProfile} handleSave={handleSave} />;
            case 'security':
                return <SecuritySettings />;
            case 'notifications':
                return <NotificationSettings />;
            case 'appearance':
                return <AppearanceSettings />;
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
                            <SettingsIcon size={24} className="text-[#1A56DB]" />
                            Pengaturan Sistem
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Kelola profil, keamanan, notifikasi, tampilan, dan konfigurasi sistem.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                            v2.4.0
                        </span>
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
                                    ? 'border-[#1A56DB] text-[#1A56DB]'
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