// src/pages/NotFound.jsx
import { useNavigate } from 'react-router-dom';
import { FileSearch, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#001838] via-[#003a73] to-[#1A56DB] flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
                {/* Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-10 text-center shadow-2xl">
                    {/* Ikon */}
                    <div className="flex items-center justify-center mb-6">
                        <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center border-2 border-blue-400/40">
                            <FileSearch size={48} className="text-blue-300" />
                        </div>
                    </div>

                    {/* Kode error */}
                    <div className="text-6xl font-black text-white/20 mb-2 tracking-tighter select-none">404</div>

                    {/* Judul */}
                    <h1 className="text-2xl font-bold text-white mb-3">Halaman Tidak Ditemukan</h1>

                    {/* Deskripsi */}
                    <p className="text-white/60 text-sm leading-relaxed mb-8">
                        Halaman yang Anda cari mungkin sudah dipindahkan, dihapus, atau tidak pernah ada.
                        Periksa kembali URL yang Anda masukkan.
                    </p>

                    {/* Tombol aksi */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
                </div>

                {/* Footer */}
                <p className="text-center text-white/30 text-xs mt-6">
                    NagariSDLC — Sistem Manajemen SDLC Internal Bank Nagari
                </p>
            </div>
        </div>
    );
}
