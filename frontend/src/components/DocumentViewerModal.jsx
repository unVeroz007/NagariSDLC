// src/components/DocumentViewerModal.jsx
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    FileText,
    Download,
    Printer,
    Maximize2,
    Minimize2,
    X,
    Eye,
    Loader2,
} from 'lucide-react';
import { getFileFromStore } from '../contexts/ProjectContext';
import { documentService } from '../services/api';

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

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoadingUrl, setIsLoadingUrl] = useState(false);
    const [safeUrl, setSafeUrl] = useState(null);

    // File URL resolving logic
    useEffect(() => {
        let isMounted = true;
        let createdBlobUrl = null;

        const loadUrl = async () => {
            let url = doc.url || doc.fileUrl || doc.dataUrl || doc.fsdUrl || null;
            if (!url && doc.name) url = getFileFromStore(doc.name) || getFileFromStore(doc.id);
            if (!url && project?.id) url = getFileFromStore(`fsd_${project.id}`) || getFileFromStore(`doc_${doc.id}`);

            // Coba dapatkan Numeric ID untuk API download
            let numericId = null;
            if (typeof doc.id === 'number') {
                numericId = doc.id;
            } else if (url && url.includes('/documents/')) {
                const match = url.match(/\/documents\/(\d+)\/download/);
                if (match) numericId = parseInt(match[1], 10);
            }

            // Jika ini API URL yang membutuhkan Bearer Token Auth
            if (numericId) {
                setIsLoadingUrl(true);
                try {
                    const blob = await documentService.download(numericId);
                    createdBlobUrl = URL.createObjectURL(blob);
                    if (isMounted) setSafeUrl(createdBlobUrl);
                } catch {
                    if (isMounted) setSafeUrl(null);
                } finally {
                    if (isMounted) setIsLoadingUrl(false);
                }
            } else if (url && !url.includes('/api/v1/documents')) {
                // Hanya gunakan raw URL jika ini DataURL (base64) atau Blob URL lokal
                if (isMounted) setSafeUrl(url);
            } else {
                if (isMounted) setSafeUrl(null);
            }
        };

        loadUrl();
        return () => {
            isMounted = false;
            if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
        };
    }, [doc, project]);

    const isImage = useMemo(() => {
        const fn = docName.toLowerCase();
        return /\.(png|jpe?g|gif|webp|svg)$/i.test(fn);
    }, [docName]);

    // Tipe file yang bisa dirender inline di browser (PDF & gambar saja).
    // Excel/Word/ZIP dsb tidak bisa ditampilkan di <object>/<iframe> → tampilkan panel info + tombol unduh.
    const canInlinePreview = useMemo(() => {
        const fn = docName.toLowerCase();
        return /\.(pdf|png|jpe?g|gif|webp|svg)$/i.test(fn);
    }, [docName]);

    // Label tipe file untuk file non-preview (Excel/Word/ZIP)
    const nonPreviewLabel = useMemo(() => {
        const fn = docName.toLowerCase();
        if (/\.(xlsx|xls)$/i.test(fn)) return 'Microsoft Excel';
        if (/\.(docx|doc)$/i.test(fn)) return 'Microsoft Word';
        if (/\.(zip|rar|7z)$/i.test(fn)) return 'Arsip Terkompresi';
        if (/\.(csv)$/i.test(fn)) return 'CSV';
        return 'Berkas';
    }, [docName]);

    // Keyboard ESC listener & body scroll lock for perfect screen centering
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        if (typeof document !== 'undefined') {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (typeof document !== 'undefined') {
                document.body.style.overflow = 'unset';
            }
        };
    }, [onClose]);

    // Handle Download File Action
    const handleDownload = () => {
        if (safeUrl) {
            const a = document.createElement('a');
            a.href = safeUrl;
            a.download = docName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            const blobContent = `=====================================================\nPT BANK NAGARI - DOKUMEN SDLC RESMI\n=====================================================\nNama Dokumen : ${docName}\nProyek       : ${projName}\nKategori     : ${docType}\nDiunggah Oleh: ${uploadedBy}\nTanggal      : ${docDate}\n=====================================================\n\n${doc.content || 'Dokumen SDLC Resmi Bank Nagari'}`;
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

    const modalContent = (
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen bg-slate-950/85 backdrop-blur-md z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-8 animate-fade-in overflow-hidden">
            <div className={`bg-slate-900 text-white rounded-2xl md:rounded-3xl w-full flex flex-col shadow-2xl border border-slate-700/80 overflow-hidden transition-all duration-300 ${isFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-5xl h-[90vh]'}`}>
                
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

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Download Button */}
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00529C] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
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

                {/* ── CANVAS VIEW CONTAINER (DIRECT ORIGINAL FILE DISPLAY) ── */}
                <div className="flex-1 bg-slate-950 overflow-y-auto p-3 sm:p-5 md:p-6 flex items-center justify-center relative min-h-0">
                    {isLoadingUrl ? (
                        <div className="flex flex-col items-center text-slate-400 gap-3">
                            <Loader2 size={32} className="animate-spin" />
                            <span className="text-sm">Memuat dokumen aman...</span>
                        </div>
                    ) : isImage && safeUrl ? (
                        <div className="flex items-center justify-center p-2 w-full h-full">
                            <img
                                src={safeUrl}
                                alt={docName}
                                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-white p-2 border border-slate-700 mx-auto my-auto"
                            />
                        </div>
                    ) : canInlinePreview && safeUrl ? (
                        <object
                            data={safeUrl}
                            type="application/pdf"
                            className="w-full h-full min-h-[650px] bg-white rounded-2xl shadow-2xl border-0"
                        >
                            <iframe
                                src={safeUrl}
                                title={docName}
                                className="w-full h-full min-h-[650px] bg-white rounded-2xl border-0"
                            />
                        </object>
                    ) : !canInlinePreview ? (
                        /* File tidak dapat dipratinjau inline (Excel/Word/ZIP) — tampilkan panel info + unduh */
                        <div className="flex flex-col items-center justify-center text-center p-10 w-full h-full bg-white rounded-2xl shadow-2xl">
                            <div className="w-20 h-20 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 mb-2">File {nonPreviewLabel}</h3>
                            <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                                Dokumen <strong className="text-slate-700">{docName}</strong> berformat <strong>{nonPreviewLabel}</strong>.
                                Berkas jenis ini tidak dapat ditampilkan langsung di dalam jendela pratinjau.
                                Silakan unduh untuk membuka dan melihat isinya.
                            </p>
                            <div className="flex items-center gap-2 mb-6 text-xs text-slate-400">
                                <span>Ukuran: {docSize}</span>
                                <span>•</span>
                                <span>Diunggah: {uploadedBy}</span>
                            </div>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-6 py-3 bg-[#00529C] hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer active:scale-95"
                            >
                                <Download size={16} />
                                Unduh {nonPreviewLabel}
                            </button>
                        </div>
                    ) : (
                        /* Error / Not Loaded State */
                        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-400">
                            <FileText size={48} className="mb-4 text-slate-600" />
                            <h3 className="text-lg font-semibold text-slate-200 mb-2">
                                Tidak dapat memuat dokumen
                            </h3>
                            <p className="text-sm max-w-md mb-4">
                                Berkas <strong className="text-slate-100">{docName}</strong> gagal dimuat. 
                                Pastikan koneksi stabil dan Anda memiliki izin akses ke dokumen ini.
                            </p>
                            <button
                                onClick={handleDownload}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                <Download size={16} />
                                Coba Unduh Manual
                            </button>
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

    if (typeof document !== 'undefined' && document.body) {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
}
