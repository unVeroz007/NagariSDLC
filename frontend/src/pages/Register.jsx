// src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
    User,
    Mail,
    Lock,
    Eye,
    EyeOff,
    Building,
    Shield,
    CheckCircle,
    AlertCircle,
    UserPlus,
    ArrowRight,
    ArrowLeft,
    KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
    const navigate = useNavigate();
    const { login, registerUser } = useAuth();
    const { addNotification } = useNotifications();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        department: '',
        role: 'business_user',
        terms: false,
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Departemen options
    const departments = [
        'Divisi TI',
        'Divisi Kredit',
        'Divisi Dana & Jasa',
        'Divisi Digital Banking',
        'Divisi SDM',
        'Divisi Kepatuhan',
        'Divisi Manajemen Risiko',
        'Divisi Operasional',
        'Divisi Audit Internal',
        'Divisi Treasury & International',
        'Divisi Perencanaan & Strategi',
        'Divisi Layanan',
        'Kantor Pusat Operasional',
    ];

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Nama lengkap wajib diisi';
        } else if (formData.name.trim().length < 3) {
            newErrors.name = 'Nama lengkap minimal 3 karakter';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email wajib diisi';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Format email tidak valid';
        }

        if (!formData.password) {
            newErrors.password = 'Password wajib diisi';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password minimal 8 karakter';
        }

        if (!formData.password_confirmation) {
            newErrors.password_confirmation = 'Konfirmasi password wajib diisi';
        } else if (formData.password !== formData.password_confirmation) {
            newErrors.password_confirmation = 'Password tidak cocok';
        }

        if (!formData.department) {
            newErrors.department = 'Pilih departemen';
        }

        if (!formData.terms) {
            newErrors.terms = 'Anda harus menyetujui syarat dan ketentuan';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error('Mohon perbaiki form yang masih error');
            return;
        }

        setIsLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 800));

            const result = registerUser({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                department: formData.department,
                role: 'lead_group', // default role pengusul
            });

            if (!result.success) {
                toast.error(result.message);
                setIsLoading(false);
                return;
            }

            toast.success('Registrasi berhasil! Silakan login.');

            addNotification(
                'Akun Baru Terdaftar',
                `Pengguna ${formData.name} telah mendaftar sebagai ${formData.role}`,
                'success'
            );

            navigate('/login');
        } catch (error) {
            toast.error('Registrasi gagal, silakan coba lagi.');
        } finally {
            setIsLoading(false);
        }
    };

    const getRoleLabel = (role) => {
        const labels = {
            business_user: 'Business User (Pengaju Proyek)',
            lead_group: 'Lead Group (Approval)',
            analyst: 'System Analyst',
            project_manager: 'Project Manager',
            qa_lead: 'QA Lead',
            qa_tester: 'QA Tester',
            cyber_lead: 'Cyber Lead',
            pentester: 'Pentester',
            head_of_it: 'Head of IT',
        };
        return labels[role] || role;
    };

    return (
        <div className="min-h-screen flex bg-[#f8f9fb]">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-2/5 relative flex-col justify-between p-12 bg-gradient-to-br from-[#003a73] via-[#001838] to-[#001838] overflow-hidden">
                <div
                    className="absolute inset-0 pointer-events-none opacity-5"
                    style={{
                        backgroundImage:
                            'radial-gradient(at 0% 0%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(at 100% 100%, rgba(255,255,255,0.05) 0%, transparent 50%)',
                    }}
                />
                <div className="relative z-10 flex items-center space-x-4">
                    <div className="bg-white p-2 rounded shadow-sm flex items-center justify-center">
                        <span className="text-[#003a73] font-bold text-2xl">BN</span>
                    </div>
                    <span className="text-2xl font-bold text-white">Nagari SDLC</span>
                </div>
                <div className="relative z-10 mt-16 flex-grow">
                    <h1 className="text-4xl font-bold text-white mb-6 tracking-tight">
                        Daftar Akun Baru<br />SDLC Bank Nagari
                    </h1>
                    <p className="text-lg text-blue-200 mb-12 max-w-md">
                        Buat akun untuk mengakses sistem manajemen proyek SDLC Bank Nagari.
                    </p>
                    <ul className="space-y-6">
                        <li className="flex items-center space-x-3">
                            <CheckCircle className="text-[#D4A017]" size={24} />
                            <span className="text-white font-medium">Akses terpusat ke seluruh proyek</span>
                        </li>
                        <li className="flex items-center space-x-3">
                            <CheckCircle className="text-[#D4A017]" size={24} />
                            <span className="text-white font-medium">Alur persetujuan yang jelas</span>
                        </li>
                        <li className="flex items-center space-x-3">
                            <CheckCircle className="text-[#D4A017]" size={24} />
                            <span className="text-white font-medium">Pantau progres real-time</span>
                        </li>
                    </ul>
                </div>
                <div className="relative z-10 mt-auto pt-12 flex items-center space-x-2 text-blue-200">
                    <Shield size={18} />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                        Sistem Internal Terenkripsi 256‑bit
                    </span>
                </div>
            </div>

            {/* Right Panel - Register Form */}
            <div className="w-full lg:w-3/5 flex flex-col justify-center items-center bg-white p-8 lg:p-16 relative">
                {/* Logo mobile */}
                <div className="lg:hidden absolute top-8 left-8 flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[#003a73] rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-[#D4A017] font-bold text-lg">BN</span>
                    </div>
                    <span className="text-xl font-bold text-gray-800">Nagari SDLC</span>
                </div>

                <div className="w-full max-w-md mt-12 lg:mt-0">
                    {/* Back Button */}
                    <div className="mb-6">
                        <Link 
                            to="/login"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#00529C] transition-colors"
                        >
                            <ArrowLeft size={16} />
                            Kembali ke Login
                        </Link>
                    </div>

                    {/* Header */}
                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2 justify-center lg:justify-start">
                            <UserPlus size={28} className="text-[#00529C]" />
                            Daftar Akun
                        </h2>
                        <p className="text-sm text-gray-500">
                            Isi data di bawah untuk mendaftar sebagai pengguna SDLC Bank Nagari.
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* Nama Lengkap */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                Nama Lengkap <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Masukkan nama lengkap Anda"
                                    className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all ${errors.name ? 'border-red-400' : 'border-gray-200'
                                        }`}
                                />
                            </div>
                            {errors.name && (
                                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                Email Korporat <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Masukkan email korporat Anda"
                                    className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all ${errors.email ? 'border-red-400' : 'border-gray-200'
                                        }`}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Minimal 8 karakter"
                                    className={`w-full pl-10 pr-10 py-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all ${errors.password ? 'border-red-400' : 'border-gray-200'
                                        }`}
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        {/* Konfirmasi Password */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                Konfirmasi Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="password_confirmation"
                                    value={formData.password_confirmation}
                                    onChange={handleChange}
                                    placeholder="Ketik ulang password"
                                    className={`w-full pl-10 pr-10 py-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all ${errors.password_confirmation ? 'border-red-400' : 'border-gray-200'
                                        }`}
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.password_confirmation && (
                                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    {errors.password_confirmation}
                                </p>
                            )}
                        </div>

                        {/* Departemen */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                Departemen <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Building size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none appearance-none transition-all ${errors.department ? 'border-red-400' : 'border-gray-200'
                                        }`}
                                >
                                    <option value="">Pilih Departemen</option>
                                    {departments.map((dept) => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            </div>
                            {errors.department && (
                                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    {errors.department}
                                </p>
                            )}
                        </div>

                        {/* Role (readonly, default business_user) */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                Role / Peran
                            </label>
                            <div className="relative">
                                <Shield size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={getRoleLabel(formData.role)}
                                    disabled
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg bg-gray-100 text-sm text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-gray-400">
                                Role akan ditentukan oleh Administrator setelah registrasi.
                            </p>
                        </div>

                        {/* Terms & Conditions */}
                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                name="terms"
                                checked={formData.terms}
                                onChange={handleChange}
                                className={`mt-1 w-4 h-4 rounded border-gray-300 text-[#00529C] focus:ring-[#00529C] ${errors.terms ? 'border-red-400' : ''
                                    }`}
                            />
                            <label className="text-sm text-gray-600">
                                Saya menyetujui{' '}
                                <a href="#" className="text-[#00529C] hover:underline">Syarat dan Ketentuan</a>
                                {' '}serta{' '}
                                <a href="#" className="text-[#00529C] hover:underline">Kebijakan Privasi</a>
                                {' '}Bank Nagari.
                                {errors.terms && (
                                    <span className="text-red-500 text-xs block mt-1">{errors.terms}</span>
                                )}
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-[#003a73] hover:bg-[#001f4a] text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                <>
                                    <UserPlus size={18} />
                                    Daftar Sekarang
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="mt-6 mb-6 relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-400 text-xs uppercase">Sudah punya akun?</span>
                        </div>
                    </div>

                    {/* Login Link */}
                    <Link
                        to="/login"
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-all font-medium text-gray-700 text-sm"
                    >
                        <ArrowRight size={18} className="text-gray-400" />
                        Masuk ke Akun Anda
                    </Link>

                    {/* Footer */}
                    <div className="mt-10 text-center">
                        <p className="text-xs text-gray-400">© 2026 PT Bank Nagari. Hak Cipta Dilindungi.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}