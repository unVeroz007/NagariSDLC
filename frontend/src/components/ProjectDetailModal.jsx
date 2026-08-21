// src/components/ProjectDetailModal.jsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Gaya badge prioritas. Sengaja dimiliki komponen ini sendiri supaya modal bisa
 * dipakai halaman mana pun tanpa harus disuntik helper dari pemanggilnya.
 */
const PRIORITY_STYLE = {
    High: { label: '🔴 High Priority', className: 'bg-red-500/10 text-red-600 border-red-200' },
    Medium: { label: '🟡 Medium', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200' },
    Low: { label: '🟢 Low', className: 'bg-green-500/10 text-green-600 border-green-200' },
};

const FALLBACK_PRIORITY = { label: 'Tanpa Prioritas', className: 'bg-gray-100 text-gray-600 border-gray-200' };

/**
 * Pratinjau ringkas detail proyek.
 *
 * Dirender lewat portal ke `document.body`, bukan di tempat ia dipanggil. Alasannya:
 * kontainer halaman workspace memakai kelas `.animate-slide-up`, dan animasi itu
 * ber-`animation-fill-mode: both` sehingga `transform: translateY(0)` dari keyframe
 * terakhir tetap menempel setelah animasi selesai. Elemen yang punya transform
 * menjadi containing block bagi turunan `position: fixed`, jadi overlay yang
 * dirender di dalam halaman akan terpusat pada kotak halaman yang tinggi dan
 * ter-scroll — bukan pada viewport. Portal memutus rantai itu, sehingga
 * `fixed inset-0` kembali mengacu ke viewport dan dialog selalu muncul di tengah
 * layar tanpa perlu di-scroll.
 *
 * Tata letaknya header/body/footer dengan satu area scroll saja (body), sehingga
 * tidak ada scroll bersarang dan header serta tombol Tutup selalu terlihat.
 */
export default function ProjectDetailModal({ project, onClose }) {
    const panelRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        if (typeof document !== 'undefined') document.body.style.overflow = 'hidden';
        // Pindahkan fokus ke panel agar navigasi keyboard & pembaca layar mulai dari dialog.
        panelRef.current?.focus();
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (typeof document !== 'undefined') document.body.style.overflow = 'unset';
        };
    }, [onClose]);

    if (!project) return null;

    const priority = PRIORITY_STYLE[project.priority] || {
        ...FALLBACK_PRIORITY,
        label: project.priority || FALLBACK_PRIORITY.label,
    };
    const reqId = project.reqId || project.req_id || project.id;
    const requester = typeof project.creator === 'object'
        ? (project.creator?.name || '—')
        : (project.creator || project.createdBy || '—');

    const modalContent = (
        <div
            // Klik area gelap menutup dialog. Guard target mencegah drag seleksi teks
            // yang berakhir di luar panel ikut menutupnya.
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            className="fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center overflow-hidden bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in"
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="project-detail-title"
                className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-2xl outline-none animate-scale-in"
            >
                {/* HEADER — tetap di tempat, tidak ikut men-scroll */}
                <div className="shrink-0 flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-xs font-bold text-[#00529C] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                {reqId}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priority.className}`}>
                                {priority.label}
                            </span>
                        </div>
                        <h3 id="project-detail-title" className="text-lg font-bold text-gray-800 leading-snug">
                            {project.title || project.name}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup detail proyek"
                        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* BODY — satu-satunya area yang men-scroll, dan hanya bila konten melebihi 85vh */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4 text-sm">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Deskripsi Proyek</p>
                        <p className="text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-3.5 leading-relaxed whitespace-pre-line">
                            {project.description || 'Pengajuan proyek SDLC baru Bank Nagari.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Divisi Inisiator</p>
                            <p className="font-semibold text-gray-800 mt-0.5">{project.division || '—'}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Target Selesai</p>
                            <p className="font-semibold text-gray-800 mt-0.5">{project.targetDate || '—'}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 sm:col-span-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pemohon</p>
                            <p className="font-semibold text-gray-800 mt-0.5">{requester}</p>
                        </div>
                    </div>

                    {project.analystResult && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 space-y-1">
                            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Hasil Analisis System Analyst</p>
                            <p className="font-semibold text-emerald-900">Keputusan: {project.analystResult.decision || '—'}</p>
                            <p className="text-emerald-700 leading-relaxed whitespace-pre-line">
                                Catatan: {project.analystResult.notes || '—'}
                            </p>
                        </div>
                    )}
                </div>

                {/* FOOTER — tombol Tutup selalu terjangkau tanpa men-scroll */}
                <div className="shrink-0 flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/60">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-[#003a73] hover:bg-[#002a5a] text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document !== 'undefined' && document.body) {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
}
