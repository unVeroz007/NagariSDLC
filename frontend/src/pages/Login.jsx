import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultRouteForRole } from '../data/menuConfig';
import {
    User,
    Lock,
    Eye,
    EyeOff,
    Shield,
    Zap,
    BarChart2,
    Users,
    FileCheck,
    UserPlus,
} from 'lucide-react';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const result = await login(username, password);
            setIsLoading(false);
            if (result.success) {
                const userRole = result.user?.role || result.data?.user?.role;
                const targetRoute = getDefaultRouteForRole(userRole);
                navigate(targetRoute);
            } else {
                setError(result.message || 'Login gagal. Periksa kembali email dan password Anda.');
            }
        } catch (err) {
            setIsLoading(false);
            setError(err.message || 'Terjadi kesalahan koneksi ke server.');
        }
    };


    const features = [
        { icon: Shield, label: 'Keamanan Terenkripsi', desc: 'Data terlindungi enkripsi 256-bit' },
        { icon: FileCheck, label: 'Alur Persetujuan Berlapis', desc: 'Multi-level approval workflow' },
        { icon: BarChart2, label: 'Audit Trail Terpusat', desc: 'Log aktivitas seluruh tim' },
        { icon: Users, label: 'Multi-Role Access', desc: 'Kontrol akses berbasis peran' },
    ];

    return (
        <div className="h-screen w-screen overflow-hidden flex" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* ===== LEFT PANEL – Branding ===== */}
            <div className="hidden lg:flex lg:w-[42%] relative flex-col justify-between p-12 overflow-hidden"
                style={{ background: 'linear-gradient(160deg, #003a73 0%, #002255 50%, #001838 100%)' }}>

                {/* Animated background shapes */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute w-96 h-96 rounded-full opacity-10 animate-float"
                        style={{ background: 'radial-gradient(circle, #4A90D9, transparent)', top: '-10%', right: '-15%' }} />
                    <div className="absolute w-64 h-64 rounded-full opacity-8 animate-float-slow"
                        style={{ background: 'radial-gradient(circle, #D4A017, transparent)', bottom: '10%', left: '-10%' }} />
                    <div className="absolute w-48 h-48 rounded-full opacity-5"
                        style={{ background: 'radial-gradient(circle, #6366f1, transparent)', top: '45%', left: '30%' }} />
                    {/* Grid pattern */}
                    <div className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                            backgroundSize: '40px 40px'
                        }} />
                </div>

                {/* Branding top */}
                <div className="relative z-10 flex items-center gap-4 animate-fade-in">
                    <div className="bg-white p-1.5 rounded-xl shadow-lg flex items-center justify-center w-14 h-14 overflow-hidden">
                        <img src="/nagari-logo.jpg" alt="Logo Bank Nagari" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <div className="text-white font-bold text-xl leading-tight">Nagari SDLC</div>
                        <div className="text-blue-300/60 text-xs tracking-wider">Enterprise Platform</div>
                    </div>
                </div>

                {/* Main content */}
                <div className="relative z-10 animate-slide-up">
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 bg-[#D4A017]/15 border border-[#D4A017]/30 rounded-full px-4 py-1.5 mb-6">
                            <Zap size={13} className="text-[#D4A017]" />
                            <span className="text-[#D4A017] text-xs font-bold tracking-wide">SDLC MANAGEMENT SYSTEM</span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                            Sistem Tata Kelola<br />
                            <span className="text-gradient" style={{ background: 'linear-gradient(135deg, #60a5fa, #D4A017)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                Pengembangan IT
                            </span>
                        </h1>
                        <p className="text-blue-200/70 text-base leading-relaxed max-w-sm">
                            Akses terpusat untuk manajemen proyek, persetujuan dokumen, dan alur kerja SDLC Bank Nagari.
                        </p>
                    </div>

                    {/* Feature list */}
                    <div className="grid grid-cols-2 gap-3">
                        {features.map((f, i) => (
                            <div key={i} className="bg-white/6 border border-white/10 rounded-xl p-3.5 hover:bg-white/10 transition-colors backdrop-blur-sm">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-7 h-7 rounded-lg bg-[#D4A017]/20 flex items-center justify-center">
                                        <f.icon size={14} className="text-[#D4A017]" />
                                    </div>
                                    <span className="text-white text-xs font-semibold">{f.label}</span>
                                </div>
                                <p className="text-blue-200/50 text-[11px]">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="relative z-10 flex items-center gap-2 text-blue-300/50 animate-fade-in">
                    <Shield size={15} />
                    <span className="text-xs font-medium tracking-wider">Sistem Internal Terenkripsi 256‑bit</span>
                </div>
            </div>

            {/* ===== RIGHT PANEL – Form Login ===== */}
            <div className="w-full lg:w-[58%] flex flex-col justify-center items-center bg-[#f8f9fb] p-8 lg:p-16 relative overflow-auto">

                {/* Background subtle decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-30 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #eff6ff, transparent)' }} />
                <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-20 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #fef9c3, transparent)' }} />

                {/* Logo mobile */}
                <div className="lg:hidden absolute top-8 left-8 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#003a73] rounded-xl flex items-center justify-center shadow">
                        <span className="text-[#D4A017] font-bold text-lg">BN</span>
                    </div>
                    <span className="text-xl font-bold text-gray-800">Nagari SDLC</span>
                </div>

                <div className="w-full max-w-md mt-12 lg:mt-0 animate-slide-up relative z-10">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="w-14 h-14 bg-[#003a73] rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-[#003a73]/20">
                            <span className="text-[#D4A017] font-extrabold text-xl">BN</span>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-800 mb-1.5 tracking-tight">
                            Selamat Datang Kembali
                        </h2>
                        <p className="text-gray-500 text-sm">
                            Silakan masuk menggunakan kredensial Bank Nagari Anda.
                        </p>
                    </div>

                    {/* Form */}
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* NIP / Email */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2" htmlFor="username">
                                NIP / Email Korporat
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <User className="text-gray-400" size={18} />
                                </div>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Masukkan NIP atau Email"
                                    className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] text-sm text-gray-800 transition-all outline-none shadow-sm hover:border-gray-300"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2" htmlFor="password">
                                <div className="flex justify-between items-center">
                                    <span>Kata Sandi</span>
                                    <a href="#" className="text-[#00529C] hover:underline text-xs font-semibold normal-case tracking-normal">Lupa sandi?</a>
                                </div>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="text-gray-400" size={18} />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="block w-full pl-11 pr-12 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] text-sm text-gray-800 transition-all outline-none shadow-sm hover:border-gray-300"
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center gap-3">
                            <input
                                id="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 text-[#00529C] focus:ring-[#00529C] border-gray-300 rounded"
                            />
                            <label htmlFor="remember-me" className="text-sm text-gray-600">
                                Ingat saya di perangkat ini
                            </label>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <Link to="/register" className="text-[#00529C] hover:underline">
                                <UserPlus size={14} className="inline mr-1" />
                                Daftar Akun Baru
                            </Link>
                            <Link to="/forgot-password" className="text-[#00529C] hover:underline">
                                Lupa password?
                            </Link>
                        </div>
                        {/* Submit */}
                        {/* Error message */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                                    <span className="text-white text-[10px] font-bold">!</span>
                                </div>
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed btn-shimmer shadow-lg shadow-[#003a73]/20 hover:shadow-xl hover:shadow-[#003a73]/30 hover:-translate-y-0.5"
                            style={{ background: 'linear-gradient(135deg, #003a73, #001838)' }}
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Memproses...
                                </>
                            ) : 'Masuk ke Dashboard'}
                        </button>
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