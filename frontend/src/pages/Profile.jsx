import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    User,
    Mail,
    Phone,
    Building,
    Shield,
    Camera,
    Save,
    X,
    CheckCircle,
    Edit,
} from 'lucide-react';

export default function Profile() {
    const { user } = useAuth();
    const fileInputRef = useRef(null);

    // State untuk form profil
    const [profile, setProfile] = useState({
        name: user?.name || 'Ahmad Fauzi',
        email: user?.email || 'ahmad.fauzi@banknagari.co.id',
        role: user?.role || 'Super Admin',
        department: user?.department || 'IT',
        phone: '+62 812 3456 7890',
    });

    const [avatar, setAvatar] = useState(null); // untuk preview
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile((prev) => ({ ...prev, [name]: value }));
    };

    // Handle avatar upload
    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatar(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle save
    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            setIsEditing(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        }, 1000);
    };

    // Handle cancel
    const handleCancel = () => {
        setIsEditing(false);
        // Reset ke data awal (mock)
        setProfile({
            name: user?.name || 'Ahmad Fauzi',
            email: user?.email || 'ahmad.fauzi@banknagari.co.id',
            role: user?.role || 'Super Admin',
            department: user?.department || 'IT',
            phone: '+62 812 3456 7890',
        });
        setAvatar(null);
    };

    // Get initial for avatar
    const getInitial = () => {
        return profile.name.charAt(0).toUpperCase();
    };

    // Role badge color
    const getRoleColor = (role) => {
        const colors = {
            super_admin: 'bg-purple-100 text-purple-700',
            lead_group: 'bg-blue-100 text-blue-700',
            analyst: 'bg-cyan-100 text-cyan-700',
            project_manager: 'bg-indigo-100 text-indigo-700',
            qa_lead: 'bg-emerald-100 text-emerald-700',
            qa_tester: 'bg-teal-100 text-teal-700',
            cyber_lead: 'bg-rose-100 text-rose-700',
            pentester: 'bg-orange-100 text-orange-700',
            head_of_it: 'bg-amber-100 text-amber-700',
            business_user: 'bg-gray-100 text-gray-700',
        };
        return colors[role] || 'bg-gray-100 text-gray-700';
    };

    const getRoleLabel = (role) => {
        const labels = {
            super_admin: 'Super Admin',
            lead_group: 'Lead Group',
            analyst: 'System Analyst',
            project_manager: 'Project Manager',
            qa_lead: 'QA Lead',
            qa_tester: 'QA Tester',
            cyber_lead: 'Cyber Lead',
            pentester: 'Pentester',
            head_of_it: 'Head of IT',
            business_user: 'Business User',
        };
        return labels[role] || role;
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Profil Saya</h2>
                    <p className="text-sm text-gray-500 mt-1">Kelola informasi akun dan preferensi pribadi Anda.</p>
                </div>

                {/* Success Alert */}
                {saveSuccess && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700">
                        <CheckCircle size={20} />
                        <span className="font-medium">Profil berhasil diperbarui!</span>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Avatar Section */}
                    <div className="p-6 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative">
                            <div className="w-28 h-28 rounded-full bg-[#003a73] text-white flex items-center justify-center text-4xl font-bold overflow-hidden">
                                {avatar ? (
                                    <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    getInitial()
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 p-2 bg-[#003a73] text-white rounded-full hover:bg-[#002a5a] transition-colors shadow-md"
                            >
                                <Camera size={16} />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                        </div>
                        <div className="text-center sm:text-left">
                            <h3 className="text-xl font-bold text-gray-800">{profile.name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(user?.role)}`}>
                                    {getRoleLabel(user?.role)}
                                </span>
                                <span className="text-sm text-gray-500">{profile.department}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                {isEditing ? 'Klik "Simpan" untuk menyimpan perubahan' : 'Klik ikon kamera untuk mengubah foto profil'}
                            </p>
                        </div>
                        <div className="sm:ml-auto">
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-[#003a73] text-white rounded-lg font-semibold text-sm hover:bg-[#002a5a] transition-colors flex items-center gap-2"
                                >
                                    <Edit size={16} />
                                    Edit Profil
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCancel}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                                    >
                                        <X size={16} />
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        <Save size={16} />
                                        {isSaving ? 'Menyimpan...' : 'Simpan'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Form */}
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Nama Lengkap */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <User size={16} className="text-gray-400" />
                                    Nama Lengkap
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        name="name"
                                        value={profile.name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#00529C] focus:border-transparent text-sm"
                                    />
                                ) : (
                                    <div className="px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 text-sm">
                                        {profile.name}
                                    </div>
                                )}
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Mail size={16} className="text-gray-400" />
                                    Email
                                </label>
                                <div className="px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 text-gray-500 text-sm cursor-not-allowed">
                                    {profile.email}
                                </div>
                            </div>

                            {/* Role */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Shield size={16} className="text-gray-400" />
                                    Role
                                </label>
                                <div className="px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 text-gray-500 text-sm cursor-not-allowed">
                                    {getRoleLabel(user?.role)}
                                </div>
                            </div>

                            {/* Departemen */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Building size={16} className="text-gray-400" />
                                    Departemen
                                </label>
                                <div className="px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 text-gray-500 text-sm cursor-not-allowed">
                                    {profile.department}
                                </div>
                            </div>

                            {/* No. Handphone */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Phone size={16} className="text-gray-400" />
                                    No. Handphone
                                </label>
                                {isEditing ? (
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={profile.phone}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#00529C] focus:border-transparent text-sm"
                                    />
                                ) : (
                                    <div className="px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 text-sm">
                                        {profile.phone}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-500">
                                <div>
                                    <span className="font-semibold text-gray-700">ID User:</span> {user?.id || 'USR-001'}
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-700">Terakhir Login:</span> {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Note */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                    <Shield size={18} className="text-[#00529C] shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Keamanan Akun</p>
                        <p className="text-xs text-gray-600">Untuk mengubah kata sandi, silakan kunjungi halaman <a href="/admin/settings" className="text-[#00529C] hover:underline">Pengaturan Sistem</a> &gt; Keamanan &amp; Sandi.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}