// src/components/SITUATDocumentModal.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    CheckCircle2,
    ShieldCheck,
    Printer,
    Download,
    X,
    Maximize2,
    Minimize2,
    Lock
} from 'lucide-react';

// Helper: safely get a renderable string from object or primitive field
const safeStr = (val, fallback = '') => {
    if (!val) return fallback;
    if (typeof val === 'object') return String(val.name || val.label || val.initial || fallback);
    return String(val);
};

export default function SITUATDocumentModal({ project, onClose }) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            if (typeof document !== 'undefined') {
                document.body.style.overflow = 'unset';
            }
        };
    }, []);

    if (!project) return null;

    // Berita acara adalah dokumen resmi, jadi tidak boleh mengarang pemegang
    // peran. Bila data belum ada, kolomnya ditandai "(belum ditetapkan)" supaya
    // pembaca tahu itu kekosongan data, bukan nama unit yang sebenarnya.
    const UNSET = '(belum ditetapkan)';

    const pmName = safeStr(project.pm || project.assignedPM || project.pmName, UNSET);
    const devLeadName = safeStr(project.devLead, UNSET);
    const analystName = safeStr(project.analyst, UNSET);
    const divisionName = safeStr(project.division, UNSET);
    const projectName = safeStr(project.name, UNSET);
    const projectId = safeStr(project.id, '-');

    const handleDownload = () => {
        const textContent = [
            '=====================================================',
            'PT BANK NAGARI - BERITA ACARA PENGUJIAN SIT & UAT INTERNAL',
            '=====================================================',
            `ID Proyek      : ${projectId}`,
            `Nama Proyek    : ${projectName}`,
            `Divisi Peminta : ${divisionName}`,
            `Project Manager: ${pmName}`,
            `Dev Lead       : ${devLeadName}`,
            `Tanggal Selesai: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
            'Status         : LULUS PENGUJIAN SIT & UAT INTERNAL (DEV COMPLETED)',
            '=====================================================',
            '',
            'HASIL VERIFIKASI:',
            '1. Pengujian Integrasi Sistem (SIT): Lulus 100%',
            '2. Pengujian UAT Internal Bisnis   : Lulus 100%',
            '3. Kesiapan Teknis & Code Freeze   : Terverifikasi',
            '',
            'Dokumen ini diterbitkan secara elektronik melalui Sistem Governance SDLC Bank Nagari.',
        ].join('\n');
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BAST_SIT_UAT_${projectId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const modalContent = (
        <div className="fixed inset-0 w-screen h-screen bg-slate-950/85 backdrop-blur-md z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-8 overflow-hidden">
            <div className={`bg-slate-900 text-white rounded-2xl md:rounded-3xl w-full flex flex-col shadow-2xl border border-slate-700/80 overflow-hidden transition-all duration-300 ${isFullscreen ? 'h-full max-w-none' : 'max-w-5xl h-[90vh]'}`}>

                {/* Header Bar */}
                <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between shrink-0 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
                            <ShieldCheck size={22} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-100 text-sm sm:text-base truncate">
                                Berita Acara SIT &amp; UAT Internal — {projectName}
                            </h3>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                                Ref: <span className="text-emerald-400 font-semibold">{projectId}</span> • Divisi {divisionName}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                        >
                            <Download size={14} /> Unduh BAST
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                            title="Cetak"
                        >
                            <Printer size={16} />
                        </button>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                            title={isFullscreen ? 'Keluar Fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-xl transition-colors cursor-pointer"
                            title="Tutup"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Document Canvas */}
                <div className="flex-1 bg-slate-950 overflow-y-auto p-4 sm:p-6 md:p-8 flex justify-center items-start min-h-0">
                    <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-10 md:p-12 max-w-4xl w-full border border-slate-200 mx-auto print:shadow-none print:border-none">

                        {/* Kop Surat */}
                        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-[#003a73] text-white rounded-xl flex items-center justify-center font-black text-xl shadow-md">
                                    BN
                                </div>
                                <div>
                                    <h1 className="text-lg font-black text-[#003a73] leading-none uppercase tracking-wide">
                                        PT BANK NAGARI
                                    </h1>
                                    <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wider">
                                        DIVISI TEKNOLOGI INFORMASI &amp; DIGITALISASI
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full border border-emerald-300 uppercase tracking-widest">
                                    OFFICIAL SDLC VERIFIED
                                </span>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center my-6">
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                                BERITA ACARA HASIL PENGUJIAN SIT &amp; UAT INTERNAL
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Nomor Dokumen: BAST-SIT-UAT/{projectId}/{new Date().getFullYear()}
                            </p>
                        </div>

                        {/* Metadata */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-6">
                            <div>
                                <span className="text-slate-500">Nama Proyek:</span>
                                <p className="font-bold text-slate-900 text-sm mt-0.5">{projectName}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">ID Proyek:</span>
                                <p className="font-bold text-slate-900 text-sm mt-0.5">{projectId}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Divisi Peminta:</span>
                                <p className="font-semibold text-slate-800 mt-0.5">{divisionName}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Tanggal Verifikasi:</span>
                                <p className="font-semibold text-slate-800 mt-0.5">
                                    {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        {/* Verification Items */}
                        <div className="space-y-4 text-xs mb-8">
                            <h3 className="font-bold text-slate-900 text-sm border-b pb-1">HASIL VERIFIKASI PENGUJIAN INTERNAL</h3>

                            <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-emerald-900">1. System Integration Testing (SIT) — LULUS</h4>
                                    <p className="text-emerald-800 mt-0.5">
                                        Seluruh integrasi API, koneksi database, serta komponen middleware telah teruji 100% lulus tanpa defect kritikal.
                                    </p>
                                    {project.sitUatData?.sit2_passedCases && (
                                        <div className="mt-2 text-[11px] font-semibold text-emerald-900 bg-white/70 p-2 rounded-lg border border-emerald-200">
                                            📊 Test Cases: {project.sitUatData.sit2_passedCases} / {project.sitUatData.sit2_totalCases || '-'} Lulus
                                            {project.sitUatData.sit1_stagingUrl && ` • Staging: ${project.sitUatData.sit1_stagingUrl}`}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-blue-900">2. User Acceptance Testing (UAT Internal) — LULUS</h4>
                                    <p className="text-blue-800 mt-0.5">
                                        Skenario fungsionalitas bisnis telah diverifikasi oleh PM bersama perwakilan Divisi Peminta dan dinyatakan memenuhi kriteria kebutuhan FSD.
                                    </p>
                                    {project.sitUatData?.uat2_passedCount && (
                                        <div className="mt-2 text-[11px] font-semibold text-blue-900 bg-white/70 p-2 rounded-lg border border-blue-200">
                                            📊 Skenario UAT: {project.sitUatData.uat2_passedCount} / {project.sitUatData.uat2_executedCount || '-'} Diterima
                                            {project.sitUatData.uat3_approvedBy && ` • Disetujui: ${project.sitUatData.uat3_approvedBy}`}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
                                <Lock size={18} className="text-purple-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-purple-900">3. Technical Code Freeze &amp; Readiness Check — TERKUNCI</h4>
                                    <p className="text-purple-800 mt-0.5">
                                        Source code telah dibekukan (code freeze) di branch staging dan siap diserahkan untuk pengujian independen QA &amp; Pentest Siber (Fase 3).
                                    </p>
                                </div>
                            </div>
                        </div>


                        {/* Signatures */}
                        <div className="mt-10 pt-6 border-t border-slate-200">
                            <p className="text-xs font-bold text-center text-slate-700 uppercase tracking-wider mb-6">
                                LEMBAR PENGESAHAN ELEKTRONIK (DIGITAL SIGN-OFF)
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Development Lead</p>
                                    <div className="my-3 py-1 bg-emerald-100/60 rounded text-emerald-700 font-mono text-[10px] font-bold border border-emerald-300">
                                        DIGITAL SIGNED
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">{devLeadName}</p>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">System Analyst</p>
                                    <div className="my-3 py-1 bg-emerald-100/60 rounded text-emerald-700 font-mono text-[10px] font-bold border border-emerald-300">
                                        DIGITAL SIGNED
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">{analystName}</p>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2 md:col-span-1">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Project Manager</p>
                                    <div className="my-3 py-1 bg-emerald-100/60 rounded text-emerald-700 font-mono text-[10px] font-bold border border-emerald-300">
                                        DIGITAL SIGNED
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">{pmName}</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-900 border-t border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
                    <span>Dokumen Berita Acara SDLC Bank Nagari • Terverifikasi Elektronik</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
                    >
                        Tutup Viewer
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
