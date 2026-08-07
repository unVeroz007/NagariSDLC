// src/pages/ResetPassword.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Lock,
    Eye,
    EyeOff,
    CheckCircle,
    AlertCircle,
    Shield,
    ArrowLeft,
    KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [formData, setFormData] = useState({
        password: '',
        password_confirmation: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errors, setErrors] = useState({});
    const [isTokenValid, setIsTokenValid] = useState(true);

    // Validasi token (simulasi)
    useEffect(() => {
        if (!token) {
            setIsTokenValid(false);
            toast.error('Token reset tidak valid atau sudah kadaluarsa');
        }
    }, [token]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

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

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!token) {
            toast.error('Token tidak valid');
            return;
        }

        if (!validateForm()) {
            toast.error('Mohon perbaiki form yang masih error');
            return;
        }

        setIsLoading(true);

        // Simulasi reset password (nanti diganti dengan API call)
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Simulasi sukses
            setIsSuccess(true);
            toast.success('Password berhasil direset!');
        } catch (error) {
            toast.error('Gagal mereset password. Silakan coba lagi.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isTokenValid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Token Tidak Valid</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Link reset password tidak valid atau sudah kadaluarsa.
                    </p>
                    <Link
                        to="/forgot-password"
                        className="inline-block px-6 py-2 bg-[#003a73] text-white rounded-lg hover:bg-[#002a5a] transition-colors"
                    >
                        Minta Link Baru
                    </Link>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Password Berhasil Direset!</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Password Anda telah berhasil diubah. Silakan login dengan password baru.
                    </p>
                    <Link
                        to="/login"
                        className="inline-block px-6 py-2 bg-[#003a73] text-white rounded-lg hover:bg-[#002a5a] transition-colors"
                    >
                        Login Sekarang
                    </Link>
                </div>
            </div>
        );
    }

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
                        Reset Password<br />Akun Anda
                    </h1>
                    <p className="text-lg text-blue-200 mb-12 max-w-md">
                        Buat password baru untuk akun SDLC Bank Nagari Anda.
                    </p>
                    <ul className="space-y-6">
                        <li className="flex items-center space-x-3">
                            <CheckCircle className="text-[#D4A017]" size={24} />
                            <span className="text-white font-medium">Password minimal 8 karakter</span>
                        </li>
                        <li className="flex items-center space-x-3">
                            <CheckCircle className="text-[#D4A017]" size={24} />
                            <span className="text-white font-medium">Gunakan kombinasi huruf & angka</span>
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

            {/* Right Panel - Reset Password Form */}
            <div className="w-full lg:w-3/5 flex flex-col justify-center items-center bg-white p-8 lg:p-16 relative">
                <div className="lg:hidden absolute top-8 left-8 flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[#003a73] rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-[#D4A017] font-bold text-lg">BN</span>
                    </div>
                    <span className="text-xl font-bold text-gray-800">Nagari SDLC</span>
                </div>

                <div className="w-full max-w-md mt-12 lg:mt-0">
                    {/* Header */}
                    <div className="mb-8 text-center lg:text-left">
                        <div className="flex items-center gap-3 mb-2 justify-center lg:justify-start">
                            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#00529C] flex items-center justify-center">
                                <KeyRound size={24} />
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">Reset Password</h2>
                        </div>
                        <p className="text-sm text-gray-500">
                            Masukkan password baru untuk akun Anda.
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* Password Baru */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                Password Baru <span className="text-red-500">*</span>
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
                            <p className="mt-1 text-xs text-gray-400">
                                Gunakan kombinasi huruf, angka, dan simbol untuk keamanan lebih baik.
                            </p>
                        </div>

                        {/* Konfirmasi Password */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                Konfirmasi Password Baru <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="password_confirmation"
                                    value={formData.password_confirmation}
                                    onChange={handleChange}
                                    placeholder="Ketik ulang password baru"
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
                                    <KeyRound size={18} />
                                    Reset Password
                                </>
                            )}
                        </button>

                        {/* Back to Login */}
                        <div className="text-center">
                            <Link
                                to="/login"
                                className="text-sm text-gray-500 hover:text-[#00529C] transition-colors flex items-center justify-center gap-1"
                            >
                                <ArrowLeft size={16} />
                                Kembali ke Login
                            </Link>
                        </div>
                    </form>

                    {/* Footer */}
                    <div className="mt-10 text-center">
                        <p className="text-xs text-gray-400">© 2026 PT Bank Nagari. Hak Cipta Dilindungi.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}