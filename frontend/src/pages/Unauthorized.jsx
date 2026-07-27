// src/pages/Unauthorized.jsx
import { useNavigate } from 'react-router-dom';
import { ShieldX, Home, ArrowLeft, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Unauthorized() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#001838] via-[#003a73] to-[#1A56DB] flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
                {/* Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-10 text-center shadow-2xl">
                    {/* Ikon */}
                    <div className="flex items-center justify-center mb-6">
                        <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-400/40">
                            <ShieldX size={48} className="text-red-300" />
                        </div>
                    </div>

                    {/* Kode error */}
                    <div className="text-6xl font-black text-white/20 mb-2 tracking-tighter select-none">403</div>

                    {/* Judul */}
                    <h1 className="text-2xl font-bold text-white mb-3">Akses Ditolak</h1>

                    {/* Deskripsi */}
                    <p className="text-white/60 text-sm leading-relaxed mb-2">
                        Anda tidak memiliki izin untuk mengakses halaman ini.
                    </p>
                    {user && (
                        <p className="text-white/40 text-xs mb-8">
                            Anda login sebagai <span className="text-white/70 font-semibold">{user.name}</span> dengan role{' '}
                            <span className="text-white/70 font-semibold">{user.role?.replace(/_/g, ' ')}</span>.
                        </p>
                    )}

                    {/* Tombol aksi */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-medium transition-all"
                        >
                            <ArrowLeft size={16} />
                            Kembali
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-[#003a73] rounded-xl text-sm font-bold hover:bg-gray-100 transition-all shadow-lg"
                        >
                            <Home size={16} />
                            Ke Beranda
                        </button>
                    </div>

                    {/* Garis pemisah */}
                    <div className="mt-8 pt-6 border-t border-white/10">
                        <p className="text-white/40 text-xs mb-3">Bukan akun yang tepat?</p>
                        <button
                            onClick={() => { logout(); navigate('/login'); }}
                            className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-lg border border-red-400/20 transition-all mx-auto"
                        >
                            <LogIn size={14} />
                            Ganti Akun / Login Ulang
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-white/30 text-xs mt-6">
                    NagariSDLC — Sistem Manajemen SDLC Internal Bank Nagari
                </p>
            </div>
        </div>
    );
}
