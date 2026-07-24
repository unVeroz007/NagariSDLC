import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    User,
    Shield,
    Bell,
    Palette,
    ChevronRight,
    Search,
    Settings as SettingsIcon,
    HelpCircle,
    LogOut,
    CheckCircle,
    Eye,
    EyeOff,
    Save,
    Mail,
    Phone,
    UserCog,
    Globe,
} from 'lucide-react';

export default function Settings() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');

    // State untuk form
    const [profile, setProfile] = useState({
        name: user?.name || 'Ahmad Fauzi',
        email: user?.email || 'ahmad.fauzi@banknagari.co.id',
        role: 'Super Admin',
        phone: '+62 812 3456 7890',
    });

    const [password, setPassword] = useState({
        current: '',
        new: '',
        confirm: '',
    });

    const [notifications, setNotifications] = useState([
        { id: 'project', title: 'Update Proyek (Project Updates)', desc: 'Pemberitahuan saat ada perubahan status pada proyek SDLC.', active: true },
        { id: 'security', title: 'Peringatan Keamanan (Security Alerts)', desc: 'Notifikasi instan jika ditemukan kerentanan berisiko tinggi.', active: true },
        { id: 'tasks', title: 'Tugas (Assignments)', desc: 'Pemberitahuan jika ada tugas baru yang diberikan.', active: true },
        { id: 'weekly', title: 'Laporan Mingguan (Weekly Reports)', desc: 'Ringkasan aktivitas dan metrik performa setiap hari Senin.', active: false },
        { id: 'system', title: 'Pesan Sistem (System Messages)', desc: 'Informasi pemeliharaan terjadwal dan update sistem.', active: true },
    ]);

    const [theme, setTheme] = useState('light');

    // Toggle notifikasi
    const toggleNotification = (id) => {
        setNotifications(prev =>
            prev.map(item =>
                item.id === id ? { ...item, active: !item.active } : item
            )
        );
    };

    // Handle profile change
    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    // Handle password change
    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPassword(prev => ({ ...prev, [name]: value }));
    };

    // Submit handlers
    const handleProfileSubmit = (e) => {
        e.preventDefault();
        alert('Profil berhasil diperbarui!');
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (password.new !== password.confirm) {
            alert('Konfirmasi sandi baru tidak cocok!');
            return;
        }
        alert('Sandi berhasil diperbarui!');
        setPassword({ current: '', new: '', confirm: '' });
    };

    const handleNotificationSubmit = (e) => {
        e.preventDefault();
        alert('Preferensi notifikasi berhasil disimpan!');
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <div className="p-6 animate-[fadeIn_0.3s_ease-in-out]">
                        <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-4 mb-4">
                            Informasi Pribadi
                        </h3>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
                            <div className="w-24 h-24 rounded-full bg-[#003a73] text-white flex items-center justify-center text-4xl font-bold">
                                {user?.name?.charAt(0) || 'A'}
                            </div>
                            <div>
                                <button className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-lg transition-colors border border-gray-300 mb-2">
                                    Ubah Foto
                                </button>
                                <p className="text-sm text-gray-500">Format JPG, GIF atau PNG. Maksimal 2MB.</p>
                            </div>
                        </div>

                        <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-2xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={profile.name}
                                        onChange={handleProfileChange}
                                        className="w-full bg-white px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Email Bank</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={profile.email}
                                        onChange={handleProfileChange}
                                        className="w-full bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-500 cursor-not-allowed"
                                        disabled
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Peran / Role</label>
                                    <input
                                        type="text"
                                        name="role"
                                        value={profile.role}
                                        className="w-full bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-500 cursor-not-allowed"
                                        disabled
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">No. Handphone</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={profile.phone}
                                        onChange={handleProfileChange}
                                        className="w-full bg-white px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent text-sm"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-gray-200">
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-[#003a73] hover:bg-[#002a5a] text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all"
                                >
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                );

            case 'security':
                return (
                    <div className="p-6 animate-[fadeIn_0.3s_ease-in-out]">
                        <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-4 mb-4">
                            Keamanan & Sandi
                        </h3>

                        <div className="space-y-6 max-w-2xl">
                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <h4 className="font-semibold text-gray-800">Ubah Sandi</h4>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Sandi Saat Ini</label>
                                    <input
                                        type="password"
                                        name="current"
                                        value={password.current}
                                        onChange={handlePasswordChange}
                                        className="w-full bg-white px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent text-sm"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Sandi Baru</label>
                                    <input
                                        type="password"
                                        name="new"
                                        value={password.new}
                                        onChange={handlePasswordChange}
                                        className="w-full bg-white px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent text-sm"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Konfirmasi Sandi Baru</label>
                                    <input
                                        type="password"
                                        name="confirm"
                                        value={password.confirm}
                                        onChange={handlePasswordChange}
                                        className="w-full bg-white px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1A56DB] focus:border-transparent text-sm"
                                        required
                                    />
                                </div>
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-[#003a73] hover:bg-[#002a5a] text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all"
                                    >
                                        Perbarui Sandi
                                    </button>
                                </div>
                            </form>

                            <div className="border-t border-gray-200 pt-6">
                                <h4 className="font-semibold text-gray-800 mb-4">Autentikasi Dua Faktor (2FA)</h4>
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div>
                                        <p className="font-semibold text-gray-800">Aplikasi Authenticator</p>
                                        <p className="text-sm text-gray-500 mt-1">Gunakan aplikasi seperti Google Authenticator untuk keamanan ekstra.</p>
                                    </div>
                                    <div className="relative inline-block w-12 align-middle select-none">
                                        <input
                                            type="checkbox"
                                            id="2fa-toggle"
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 transition-all duration-300 checked:right-0 checked:border-emerald-500"
                                        />
                                        <label
                                            htmlFor="2fa-toggle"
                                            className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer transition-colors duration-300 checked:bg-emerald-500"
                                        ></label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'notifications':
                return (
                    <div className="p-6 animate-[fadeIn_0.3s_ease-in-out]">
                        <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-4 mb-4">
                            Preferensi Notifikasi
                        </h3>

                        <form onSubmit={handleNotificationSubmit} className="space-y-4 max-w-2xl">
                            {notifications.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                    <div>
                                        <p className="font-semibold text-gray-800">{item.title}</p>
                                        <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                                    </div>
                                    <div className="relative inline-block w-12 align-middle select-none mt-1">
                                        <input
                                            type="checkbox"
                                            id={`notif-${item.id}`}
                                            checked={item.active}
                                            onChange={() => toggleNotification(item.id)}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 transition-all duration-300 checked:right-0 checked:border-emerald-500"
                                        />
                                        <label
                                            htmlFor={`notif-${item.id}`}
                                            className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-300 ${item.active ? 'bg-emerald-500' : 'bg-gray-300'
                                                }`}
                                        ></label>
                                    </div>
                                </div>
                            ))}
                            <div className="pt-4 border-t border-gray-200">
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-[#003a73] hover:bg-[#002a5a] text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all"
                                >
                                    Simpan Preferensi
                                </button>
                            </div>
                        </form>
                    </div>
                );

            case 'appearance':
                return (
                    <div className="p-6 animate-[fadeIn_0.3s_ease-in-out]">
                        <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-4 mb-4">
                            Tampilan & Tema
                        </h3>

                        <div className="space-y-6 max-w-2xl">
                            <h4 className="font-semibold text-gray-800 mb-2">Tema Aplikasi</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Light Theme */}
                                <div
                                    className={`border-2 rounded-xl p-4 cursor-pointer bg-white transition-all ${theme === 'light'
                                        ? 'border-[#1A56DB] shadow-md'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    onClick={() => setTheme('light')}
                                >
                                    {theme === 'light' && (
                                        <div className="absolute top-2 right-2 text-[#1A56DB]">
                                            <CheckCircle size={20} />
                                        </div>
                                    )}
                                    <div className="h-24 bg-gray-100 rounded-lg mb-3 flex flex-col gap-2 p-2 relative">
                                        <div className="h-4 w-full bg-white rounded"></div>
                                        <div className="flex gap-2">
                                            <div className="w-1/3 h-12 bg-white rounded"></div>
                                            <div className="w-2/3 h-12 bg-white rounded"></div>
                                        </div>
                                    </div>
                                    <p className="font-semibold text-center text-gray-800">Terang (Light)</p>
                                </div>

                                {/* Dark Theme */}
                                <div
                                    className={`border-2 rounded-xl p-4 cursor-pointer bg-white transition-all ${theme === 'dark'
                                        ? 'border-[#1A56DB] shadow-md'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    onClick={() => setTheme('dark')}
                                >
                                    <div className="h-24 bg-gray-800 rounded-lg mb-3 flex flex-col gap-2 p-2">
                                        <div className="h-4 w-full bg-gray-700 rounded"></div>
                                        <div className="flex gap-2">
                                            <div className="w-1/3 h-12 bg-gray-700 rounded"></div>
                                            <div className="w-2/3 h-12 bg-gray-700 rounded"></div>
                                        </div>
                                    </div>
                                    <p className="font-semibold text-center text-gray-800">Gelap (Dark)</p>
                                </div>

                                {/* System Theme */}
                                <div
                                    className={`border-2 rounded-xl p-4 cursor-pointer bg-white transition-all ${theme === 'system'
                                        ? 'border-[#1A56DB] shadow-md'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    onClick={() => setTheme('system')}
                                >
                                    <div className="h-24 flex rounded-lg mb-3 overflow-hidden">
                                        <div className="w-1/2 bg-gray-100 h-full flex flex-col gap-2 p-2">
                                            <div className="h-4 w-full bg-white rounded"></div>
                                            <div className="w-full h-12 bg-white rounded"></div>
                                        </div>
                                        <div className="w-1/2 bg-gray-800 h-full flex flex-col gap-2 p-2">
                                            <div className="h-4 w-full bg-gray-700 rounded"></div>
                                            <div className="w-full h-12 bg-gray-700 rounded"></div>
                                        </div>
                                    </div>
                                    <p className="font-semibold text-center text-gray-800">Ikuti Sistem</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profil Saya', icon: User },
        { id: 'security', label: 'Keamanan & Sandi', icon: Shield },
        { id: 'notifications', label: 'Preferensi Notifikasi', icon: Bell },
        { id: 'appearance', label: 'Tampilan & Tema', icon: Palette },
    ];

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Pengaturan Sistem</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Kelola preferensi akun, keamanan, notifikasi, dan tampilan antarmuka Anda.
                    </p>
                </div>

                {/* Settings Layout */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* Left Navigation */}
                    <div className="md:col-span-3 space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors text-left ${isActive
                                        ? 'bg-blue-50 text-[#1A56DB]'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                        }`}
                                >
                                    <Icon size={20} className={isActive ? 'text-[#1A56DB]' : 'text-gray-400'} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Content */}
                    <div className="md:col-span-9 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
                        {renderContent()}
                    </div>
                </div>
            </div>

            {/* Custom toggle CSS (inline) */}
            <style>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: #10b981;
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: #10b981;
        }
        .toggle-checkbox:checked + .toggle-label:after {
          transform: translateX(100%);
          border-color: white;
        }
        .toggle-checkbox {
          right: 50%;
        }
        .toggle-checkbox:checked {
          right: 0;
        }
        .toggle-checkbox + .toggle-label {
          background-color: #d1d5db;
        }
      `}</style>
        </div>
    );
}