import { useState, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { buildProfileFromUser } from '../utils/userProfile';
import toast from 'react-hot-toast';
import {
    User,
    Mail,
    Phone,
    Building,
    Shield,
    Camera,
    Save,
    X,
    Edit,
} from 'lucide-react';

export default function Profile() {
    const { user, updateProfile } = useAuth();
    const fileInputRef = useRef(null);

    // Data yang ditampilkan selalu dibaca ulang dari user pada context, bukan
    // disalin ke state saat render pertama. Sesi dipulihkan secara asinkron,
    // sehingga salinan sekali-jalan akan membeku kosong saat halaman dibuka
    // langsung lewat URL.
    const profile = useMemo(() => buildProfileFromUser(user), [user]);

    // Draft berisi perubahan yang belum disimpan. null berarti tidak sedang
    // mengedit, jadi tidak perlu flag isEditing terpisah yang bisa desinkron.
    const [draft, setDraft] = useState(null);
    const isEditing = draft !== null;

    const [avatar, setAvatar] = useState(null); // untuk preview
    const [isSaving, setIsSaving] = useState(false);

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setDraft((prev) => ({ ...prev, [name]: value }));
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
    const handleSave = async () => {
        if (!draft) return;

        if (!draft.name.trim()) {
            toast.error('Nama lengkap wajib diisi.');
            return;
        }

        setIsSaving(true);
        try {
            // Hanya nama dan nomor telepon yang boleh diubah pemilik akun; role,
            // divisi, dan email adalah kewenangan admin. Toast keberhasilan
            // dikeluarkan oleh updateProfile agar tidak muncul dua kali.
            const result = await updateProfile({
                name: draft.name.trim(),
                // Nomor kosong dikirim sebagai null, bukan string kosong, supaya
                // kolom phone_number tetap bersih di database.
                phone_number: draft.phone.trim() || null,
            });

            // Mode edit hanya ditutup bila penyimpanan benar-benar berhasil,
            // supaya perubahan pengguna tidak hilang tanpa jejak saat gagal.
            if (result?.success) {
                setDraft(null);
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Handle cancel
    const handleCancel = () => {
        setDraft(null);
        setAvatar(null);
    };

    // Get initial for avatar
    const getInitial = () => {
        const initial = profile.name.trim().charAt(0);
        return initial ? initial.toUpperCase() : '?';
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
        return labels[role] || role || 'Peran belum diatur';
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Profil Saya</h2>
                    <p className="text-sm text-gray-500 mt-1">Kelola informasi akun dan preferensi pribadi Anda.</p>
                </div>

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
                            <h3 className="text-xl font-bold text-gray-800">{profile.name || 'Nama belum diisi'}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(profile.role)}`}>
                                    {profile.roleLabel || getRoleLabel(profile.role)}
                                </span>
                                <span className="text-sm text-gray-500">{profile.department || 'Divisi belum diatur'}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                {isEditing ? 'Klik "Simpan" untuk menyimpan perubahan' : 'Klik ikon kamera untuk mengubah foto profil'}
                            </p>
                        </div>
                        <div className="sm:ml-auto">
                            {!isEditing ? (
                                <button
                                    onClick={() => setDraft(profile)}
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
                                        value={draft.name}
                                        onChange={handleChange}
                                        placeholder="Nama lengkap sesuai data kepegawaian"
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#00529C] focus:border-transparent text-sm"
                                    />
                                ) : (
                                    <div className="px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 text-sm">
                                        {profile.name || '-'}
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
                                    {profile.email || '-'}
                                </div>
                            </div>

                            {/* Role */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Shield size={16} className="text-gray-400" />
                                    Role
                                </label>
                                <div className="px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 text-gray-500 text-sm cursor-not-allowed">
                                    {profile.roleLabel || getRoleLabel(profile.role)}
                                </div>
                            </div>

                            {/* Departemen */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Building size={16} className="text-gray-400" />
                                    Departemen
                                </label>
                                <div className="px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 text-gray-500 text-sm cursor-not-allowed">
                                    {profile.department || 'Belum diatur admin'}
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
                                        value={draft.phone}
                                        onChange={handleChange}
                                        placeholder="Contoh: 08xxxxxxxxxx"
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#00529C] focus:border-transparent text-sm"
                                    />
                                ) : (
                                    <div className="px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 text-sm">
                                        {profile.phone || 'Belum diisi'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-500">
                                <div>
                                    <span className="font-semibold text-gray-700">ID User:</span> {user?.id ?? '-'}
                                </div>
                                {/* Waktu login terakhir tidak tersedia pada data user, jadi yang
                                    ditampilkan adalah tanggal pembuatan akun yang memang dikirim API. */}
                                <div>
                                    <span className="font-semibold text-gray-700">Akun Dibuat:</span>{' '}
                                    {user?.created_at
                                        ? new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                                        : '-'}
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