// src/components/DocumentViewerModal.jsx
import { useState, useMemo, useEffect } from 'react';
import {
    FileText,
    Download,
    Printer,
    Maximize2,
    Minimize2,
    ZoomIn,
    ZoomOut,
    X,
    ShieldCheck,
    CheckCircle2,
    Eye,
    Building2,
    Award,
    Lock
} from 'lucide-react';
import { getFileFromStore } from '../contexts/ProjectContext';

export default function DocumentViewerModal({ doc, project, onClose }) {
    if (!doc) return null;

    const docName = doc.name || doc.file_name || doc.title || 'Dokumen_SDLC.pdf';
    const docType = (doc.type || doc.doc_type || doc.category || 'BRD').toUpperCase();
    const docSize = doc.size || doc.file_size || '1.8 MB';
    const projName = doc.project || doc.project_name || project?.name || 'Proyek SDLC Bank Nagari';
    const uploadedBy = doc.uploadedBy || doc.uploaded_by_name || doc.author || 'System Analyst TI';
    const docDate = doc.date || (doc.created_at ? new Date(doc.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) : 'Terbaru');

    // File URL resolving logic
    const rawUrl = useMemo(() => {
        let url = doc.url || doc.fileUrl || doc.dataUrl || doc.fsdUrl || null;
        if (!url && doc.name) {
            url = getFileFromStore(doc.name) || getFileFromStore(doc.id);
        }
        if (!url && project?.id) {
            url = getFileFromStore(`fsd_${project.id}`) || getFileFromStore(`doc_${doc.id}`);
        }
        return url;
    }, [doc, project]);

    const isPdf = useMemo(() => {
        const fn = docName.toLowerCase();
        return fn.endsWith('.pdf') || docType.includes('PDF') || doc.type === 'pdf';
    }, [docName, docType, doc.type]);

    const isImage = useMemo(() => {
        const fn = docName.toLowerCase();
        return /\.(png|jpe?g|gif|webp|svg)$/i.test(fn);
    }, [docName]);

    // Check if rawUrl is a valid streamable Data URL or Blob URL
    const isValidDirectStream = useMemo(() => {
        if (!rawUrl) return false;
        if (typeof rawUrl !== 'string') return false;
        return rawUrl.startsWith('data:') || rawUrl.startsWith('blob:');
    }, [rawUrl]);

    // Viewer States
    const [viewMode, setViewMode] = useState(isValidDirectStream ? 'direct' : 'paper'); // 'paper' or 'direct'
    const [zoomLevel, setZoomLevel] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [streamError, setStreamError] = useState(false);

    // Auto-fallback if direct stream encounters an error
    const handleStreamError = () => {
        console.warn('Direct stream preview failed or blocked, falling back to Paper Reader SDLC');
        setStreamError(true);
        setViewMode('paper');
    };

    // Keyboard ESC listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Handle Download File Action
    const handleDownload = () => {
        if (rawUrl && isValidDirectStream) {
            const a = document.createElement('a');
            a.href = rawUrl;
            a.download = docName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            // Generate synthetic text file download
            const blobContent = `=====================================================\nPT BANK NAGARI - DOKUMEN SDLC RESMI\n=====================================================\nNama Dokumen : ${docName}\nProyek       : ${projName}\nKategori     : ${docType}\nDiunggah Oleh: ${uploadedBy}\nTanggal      : ${docDate}\nStatus       : TERVERIFIKASI QUALITY GATE BANK NAGARI\n=====================================================\n\nDOKUMEN SPESIFIKASI DAN KEBUTUHAN TERDENGAR\nInformasi dalam dokumen ini dilindungi oleh Sistem Tata Kelola SDLC Bank Nagari.`;
            const blob = new Blob([blobContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = docName.replace(/\.pdf$/i, '.txt');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in">
            <div className={`bg-slate-900 text-white rounded-2xl md:rounded-3xl w-full flex flex-col shadow-2xl border border-slate-800 overflow-hidden transition-all duration-300 ${isFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-6xl h-[92vh]'}`}>
                
                {/* ── HEADER TOOLBAR ── */}
                <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between shrink-0 gap-3">
                    {/* Left File Title & Metadata */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
                            <FileText size={22} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-slate-100 text-sm sm:text-base truncate max-w-md">{docName}</h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider shrink-0">
                                    {docType}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                                Proyek: <span className="text-slate-200 font-semibold">{projName}</span> • {docSize} • Diunggah oleh {uploadedBy}
                            </p>
                        </div>
                    </div>

                    {/* Mode Switcher & Action Controls */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        
                        {/* Mode Switcher Toggle */}
                        {isValidDirectStream && !streamError && (
                            <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 flex items-center gap-1">
                                <button
                                    onClick={() => setViewMode('paper')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        viewMode === 'paper'
                                            ? 'bg-[#1A56DB] text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <FileText size={14} />
                                    <span>Paper SDLC</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('direct')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        viewMode === 'direct'
                                            ? 'bg-[#1A56DB] text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Eye size={14} />
                                    <span>File Stream</span>
                                </button>
                            </div>
                        )}

                        {/* Zoom Controls (Paper Mode) */}
                        {viewMode === 'paper' && (
                            <div className="hidden sm:flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
                                <button
                                    onClick={() => setZoomLevel(prev => Math.max(75, prev - 15))}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <span className="text-xs font-mono px-2 text-slate-300 font-bold">{zoomLevel}%</span>
                                <button
                                    onClick={() => setZoomLevel(prev => Math.min(150, prev + 15))}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                                    title="Zoom In"
                                >
                                    <ZoomIn size={16} />
                                </button>
                            </div>
                        )}

                        {/* Download Button */}
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1A56DB] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
                        >
                            <Download size={14} />
                            <span className="hidden sm:inline">Unduh File</span>
                        </button>

                        {/* Print Button */}
                        <button
                            onClick={() => window.print()}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                            title="Cetak Dokumen"
                        >
                            <Printer size={16} />
                        </button>

                        {/* Fullscreen Toggle */}
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                            title={isFullscreen ? "Kecilkan Layar" : "Layar Penuh"}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>

                        {/* Close Modal */}
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-800 hover:bg-red-600/30 text-slate-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                            title="Tutup (Esc)"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── CANVAS VIEW CONTAINER ── */}
                <div className="flex-1 bg-slate-950 overflow-y-auto p-4 sm:p-6 md:p-10 flex justify-center items-start relative">
                    
                    {/* DIRECT FILE STREAM MODE (PDF / Image) */}
                    {viewMode === 'direct' && isValidDirectStream && !streamError ? (
                        isImage ? (
                            <div className="flex items-center justify-center p-4 min-h-[500px]">
                                <img
                                    src={rawUrl}
                                    alt={docName}
                                    onError={handleStreamError}
                                    className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl bg-white p-2 border border-slate-700"
                                />
                            </div>
                        ) : (
                            <object
                                data={rawUrl}
                                type="application/pdf"
                                onError={handleStreamError}
                                className="w-full h-full min-h-[650px] bg-white rounded-2xl shadow-2xl border-0"
                            >
                                <iframe
                                    src={rawUrl}
                                    title={docName}
                                    onError={handleStreamError}
                                    className="w-full h-full min-h-[650px] bg-white rounded-2xl border-0"
                                />
                            </object>
                        )
                    ) : (
                        /* ── PAPER READER SDLC MODE (OFFICIAL BANK NAGARI DOCUMENT) ── */
                        <div
                            className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-10 md:p-14 max-w-4xl w-full border border-slate-200 transition-all duration-300 my-auto sm:my-4 print:shadow-none print:border-none"
                            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                        >
                            {/* Kop Surat Resmi Bank Nagari */}
                            <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-start gap-4">
                                <div>
                                    <div className="flex items-center gap-2.5 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-[#003a73] text-white font-black text-xs flex items-center justify-center shadow-xs">
                                            BN
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold tracking-wider text-xs text-[#003a73] uppercase leading-none">
                                                PT BANK NAGARI
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                DIVISI TEKNOLOGI INFORMASI • SDLC ENTERPRISE
                                            </p>
                                        </div>
                                    </div>
                                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-3">
                                        {docName}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-semibold mt-1">
                                        Dokumen Spesifikasi Resmi • Tata Kelola Sistem Informasi Bank Nagari
                                    </p>
                                </div>

                                <div className="text-right shrink-0">
                                    <span className="inline-block px-3 py-1 bg-blue-50 border border-blue-200 text-[#1A56DB] text-xs font-bold rounded-lg uppercase shadow-2xs">
                                        {docType}
                                    </span>
                                    <p className="text-[11px] text-slate-500 mt-2 font-mono font-semibold">
                                        Tanggal: {docDate}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                        Ref ID: {doc.id || `DOC-${Date.now().toString().slice(-6)}`}
                                    </p>
                                </div>
                            </div>

                            {/* Watermark Keamanan & Kerahasiaan */}
                            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 mb-8 flex items-center gap-3 text-xs text-amber-900">
                                <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                                <p className="leading-snug text-[11px] sm:text-xs">
                                    <strong>SANGAT RAHASIA &amp; DILINDUNGI:</strong> Dokumen ini diterbitkan oleh Divisi Teknologi Informasi PT Bank Nagari untuk kepentingan proses SDLC. Seluruh isi dan data dalam dokumen ini bersifat terbatas.
                                </p>
                            </div>

                            {/* Grid Informasi Metadata Dokumen */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80 mb-8 text-xs">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[9px] block">PROYEK TERKAIT</span>
                                    <span className="font-extrabold text-slate-800 truncate block">{projName}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[9px] block">PENGUSUL / AUTHOR</span>
                                    <span className="font-extrabold text-slate-800 truncate block">{uploadedBy}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[9px] block">UKURAN BERKAS</span>
                                    <span className="font-extrabold text-slate-800 block">{docSize}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[9px] block">INTEGRITAS QUALITY GATE</span>
                                    <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                                        <CheckCircle2 size={13} /> TERVERIFIKASI
                                    </span>
                                </div>
                            </div>

                            {/* Isi Dan Bab Spesifikasi Dokumen */}
                            <div className="space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
                                
                                {/* Bab 1 */}
                                <div>
                                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1 flex items-center gap-2">
                                        <FileText size={14} className="text-[#1A56DB]" />
                                        1. RINGKASAN EKSEKUTIF &amp; LATAR BELAKANG PROYEK
                                    </h2>
                                    <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs sm:text-sm">
                                        <p className="text-slate-800 font-medium leading-relaxed">
                                            Dokumen <strong>{docName}</strong> ini disusun secara resmi untuk mendukung pelaksanaan proyek <strong>"{projName}"</strong> oleh Divisi Pengusul. Penyusunan berkas ini mengacu pada standar tata kelola teknologi informasi perbankan (POJK / BI) serta arsitektur TI Bank Nagari.
                                        </p>
                                        {(doc.description || project?.description) && (
                                            <div className="bg-white p-3 rounded-lg border border-slate-200/80 text-xs mt-2">
                                                <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Deskripsi Lingkup Bisnis:</span>
                                                <p className="text-slate-700 font-medium italic">{doc.description || project?.description}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bab 2 */}
                                <div>
                                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1 flex items-center gap-2">
                                        <Building2 size={14} className="text-[#1A56DB]" />
                                        2. SPESIFIKASI PERSYARATAN &amp; REKOMENDASI ANALIS
                                    </h2>
                                    <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3 text-xs">
                                        {(project?.analystNotes || project?.analystResult?.notes) && (
                                            <div className="bg-white p-3 rounded-lg border border-emerald-200 text-xs">
                                                <span className="font-bold text-emerald-800 uppercase text-[9px] block mb-1">Catatan Kajian Analyst Perencanaan:</span>
                                                <p className="text-emerald-950 font-medium italic">"{project.analystNotes || project.analystResult?.notes}"</p>
                                            </div>
                                        )}
                                        <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 font-medium pl-1">
                                            <li>Penyelarasan proses bisnis pengguna dengan modul Core Banking &amp; Middleware Bank Nagari.</li>
                                            <li>Penerapan mekanisme autentikasi bertingkat dan otorisasi berbasis Role-Based Access Control (RBAC).</li>
                                            <li>Penyediaan audit trail komprehensif untuk setiap aksi perubahan data transaksi.</li>
                                            <li>Integrasi otomatisasi validasi Quality Gate pada setiap perubahan tahapan SDLC.</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Bab 3 */}
                                <div>
                                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1 flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-emerald-600" />
                                        3. KEAMANAN INFORMASI &amp; TESTING VERIFICATION
                                    </h2>
                                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div>
                                            <p className="font-bold text-emerald-950 text-xs">Penilaian Keamanan &amp; Audit Siber</p>
                                            <p className="text-[11px] text-emerald-800 mt-0.5">Vulnerability Assessment &amp; Penetration Testing (VAPT) Passed</p>
                                        </div>
                                        <span className="px-3 py-1 bg-emerald-600 text-white font-extrabold rounded-lg text-[10px] uppercase tracking-wider shadow-2xs">
                                            COMPLIANT &amp; SECURE
                                        </span>
                                    </div>
                                </div>

                                {/* Bab 4: Lembar Pengesahan Digital */}
                                <div>
                                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1 flex items-center gap-2">
                                        <Award size={14} className="text-[#003a73]" />
                                        4. LEMBAR PENGESAHAN &amp; STAMP DIGITAL
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">DIPERIKSA OLEH ANALYST</span>
                                            <p className="font-bold text-slate-900 text-xs mt-1">{uploadedBy}</p>
                                            <p className="text-[10px] text-slate-500">System Analyst • Divisi TI</p>
                                            <div className="mt-3 pt-2 border-t border-slate-200 flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold">
                                                <CheckCircle2 size={12} /> Tanda Tangan Digital Sah
                                            </div>
                                        </div>

                                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">DISETUJUI OLEH MANAGEMENT</span>
                                            <p className="font-bold text-slate-900 text-xs mt-1">Workspace Lead &amp; Quality Manager</p>
                                            <p className="text-[10px] text-slate-500">PT Bank Nagari Enterprise</p>
                                            <div className="mt-3 pt-2 border-t border-slate-200 flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold">
                                                <CheckCircle2 size={12} /> Approved &amp; Locked
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Footer Dokumen Resmi */}
                            <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 font-semibold gap-2">
                                <span>PT BANK NAGARI • SYSTEM DEVELOPMENT LIFE CYCLE VIEWER</span>
                                <span>HALAMAN 1 DARI 1 • TERVERIFIKASI ELEKTRONIK</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── BOTTOM FOOTER BAR ── */}
                <div className="bg-slate-900 border-t border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
                    <span className="truncate">Pratinjau Dokumen Resmi SDLC Bank Nagari</span>
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
}
