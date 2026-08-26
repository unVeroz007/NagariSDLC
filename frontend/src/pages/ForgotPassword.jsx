// src/pages/ForgotPassword.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Mail,
    ArrowLeft,
    CheckCircle,
    AlertCircle,
    Shield,
    Send,
    KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../services/api';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState('');

    const validateEmail = () => {
        if (!email.trim()) {
            setError('Email wajib diisi');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Format email tidak valid');
            return false;
        }
        setError('');
        return true;
    };

    /**
     * Kirim permintaan tautan reset.
     *
     * Backend menjawab dengan pesan yang sama untuk email terdaftar maupun tidak,
     * jadi keberhasilan di sini hanya berarti permintaannya diterima — bukan bahwa
     * akunnya ada. Pesan sukses karena itu memakai teks dari backend apa adanya.
     */
    const requestResetLink = async () => {
        if (!validateEmail()) {
            toast.error('Mohon perbaiki email Anda');
            return;
        }

        setIsLoading(true);

        try {
            const res = await authService.requestPasswordReset(email.trim().toLowerCase());
            setIsSent(true);
            toast.success(res?.message || 'Permintaan reset password telah dikirim.');
        } catch (err) {
            setError(err.message || 'Gagal mengirim tautan reset.');
            toast.error(err.message || 'Gagal mengirim tautan reset. Silakan coba lagi.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await requestResetLink();
    };

    /**
     * Kirim ulang tanpa keluar dari layar konfirmasi.
     *
     * Backend membatasi jarak antar permintaan (60 detik) dan menjawab 429 bila
     * terlalu cepat, jadi kegagalannya perlu terlihat — layar konfirmasi tetap
     * ditampilkan dan pesannya muncul sebagai toast.
     */
    const handleResend = async () => {
        await requestResetLink();
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
                        Lupa Password?<br />Tenang, Kami Bantu
                    </h1>
                    <p className="text-lg text-blue-200 mb-12 max-w-md">
                        Masukkan email korporat Anda, kami akan kirim link untuk reset password.
                    </p>
                    <ul className="space-y-6">
                        <li className="flex items-center space-x-3">
                            <CheckCircle className="text-[#D4A017]" size={24} />
                            <span className="text-white font-medium">Link reset dikirim ke email</span>
                        </li>
                        <li className="flex items-center space-x-3">
                            <CheckCircle className="text-[#D4A017]" size={24} />
                            <span className="text-white font-medium">Proses cepat & aman</span>
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

            {/* Right Panel - Forgot Password Form */}
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
                            <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">Lupa Password</h2>
                        </div>
                        <p className="text-sm text-gray-500">
                            Masukkan email Anda untuk menerima link reset password.
                        </p>
                    </div>

                    {isSent ? (
                        // Success state
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Cek Email Anda!</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Jika{' '}
                                <span className="font-semibold text-gray-800">{email}</span>{' '}
                                terdaftar dan akunnya aktif, tautan reset password sudah dikirim ke sana.
                            </p>
                            <p className="text-xs text-gray-500 mb-6">
                                Tautan reset hanya berlaku 60 menit dan sekali pakai. Jika tidak menemukan email, cek folder Spam.
                            </p>
                            <button
                                onClick={handleResend}
                                disabled={isLoading}
                                className="text-[#00529C] hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                            >
                                {isLoading ? 'Mengirim ulang...' : 'Kirim ulang tautan'}
                            </button>
                            <div className="mt-4 pt-4 border-t border-emerald-200">
                                <Link
                                    to="/login"
                                    className="text-[#00529C] hover:underline text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft size={16} />
                                    Kembali ke Login
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {/* Email */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                    Email Korporat <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (error) setError('');
                                        }}
                                        onBlur={validateEmail}
                                        placeholder="Masukkan email korporat Anda"
                                        className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all ${error ? 'border-red-400' : 'border-gray-200'
                                            }`}
                                    />
                                </div>
                                {error && (
                                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        {error}
                                    </p>
                                )}
                                <p className="mt-2 text-xs text-gray-400">
                                    Gunakan email korporat yang terdaftar di sistem SDLC Bank Nagari.
                                </p>
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
                                        Mengirim...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Kirim Link Reset
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
                    )}

                    {/* Footer */}
                    <div className="mt-10 text-center">
                        <p className="text-xs text-gray-400">© 2026 PT Bank Nagari. Hak Cipta Dilindungi.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}