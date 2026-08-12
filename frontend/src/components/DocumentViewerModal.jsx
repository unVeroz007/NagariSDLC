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
} from 'lucide-react';
import { documentService } from '../services/api';
import { getFileFromStore } from '../contexts/ProjectContext';

export default function DocumentViewerModal({ doc, project, onClose }) {
    if (!doc) return null;

    const docId = doc.id;
    const docName = doc.name || doc.file_name || doc.title || 'Dokumen_SDLC.pdf';
    const docType = (doc.type || doc.doc_type || doc.category || 'BRD').toUpperCase();
    const docSize = doc.size || doc.file_size || '1.8 MB';
    const projName = doc.project || doc.project_name || project?.name || 'Proyek SDLC Bank Nagari';
    const uploadedBy = doc.uploadedBy || doc.uploaded_by_name || doc.author || 'System Analyst TI';

    const [safeUrl, setSafeUrl] = useState(null);
    const [isLoadingUrl, setIsLoadingUrl] = useState(false);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let createdUrl = null;

        const loadUrl = async () => {
            // 1. Cek direct URL dari doc object (Blob URL, Data URL, dll dari preview)
            const directUrl = doc.url || doc.fileUrl || doc.dataUrl || null;
            if (directUrl && (directUrl.startsWith('blob:') || directUrl.startsWith('data:'))) {
                if (!cancelled) {
                    setSafeUrl(directUrl);
                    setIsLoadingUrl(false);
                }
                return;
            }

            // 2. Cek dari file store (cache lokal)
            const storedUrl = getFileFromStore(doc.name) || getFileFromStore(doc.id);
            if (storedUrl && (storedUrl.startsWith('blob:') || storedUrl.startsWith('data:'))) {
                if (!cancelled) {
                    setSafeUrl(storedUrl);
                    setIsLoadingUrl(false);
                }
                return;
            }

            // 3. API download via docId
            if (!docId) {
                if (!cancelled) { setLoadError(true); setIsLoadingUrl(false); }
                return;
            }
            setIsLoadingUrl(true);
            setLoadError(false);
            try {
                const blob = await documentService.download(docId);
                createdUrl = URL.createObjectURL(blob);
                if (!cancelled) setSafeUrl(createdUrl);
            } catch {
                if (!cancelled) {
                    setSafeUrl(null);
                    setLoadError(true);
                }
            } finally {
                if (!cancelled) setIsLoadingUrl(false);
            }
        };
        loadUrl();
        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [docId, JSON.stringify(doc)]);

    const isImage = useMemo(() => {
        const fn = docName.toLowerCase();
        return /\.(png|jpe?g|gif|webp|svg)$/i.test(fn);
    }, [docName]);

    const nonPreviewLabel = useMemo(() => {
        const fn = docName.toLowerCase();
        if (/\.(xlsx|xls)$/i.test(fn)) return 'Microsoft Excel';
        if (/\.(docx|doc)$/i.test(fn)) return 'Microsoft Word';
        if (/\.(zip|rar|7z)$/i.test(fn)) return 'Arsip Terkompresi';
        return 'Berkas';
    }, [docName]);

    const isNonPreview = useMemo(() => {
        const fn = docName.toLowerCase();
        return /\.(xlsx|xls)$/i.test(fn) || /\.(docx|doc)$/i.test(fn) || /\.(zip|rar|7z)$/i.test(fn);
    }, [docName]);

    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        if (typeof document !== 'undefined') document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (typeof document !== 'undefined') document.body.style.overflow = 'unset';
        };
    }, [onClose]);

    const handleDownload = async () => {
        if (safeUrl) {
            window.open(safeUrl, '_blank');
            return;
        }
        if (!docId) return;
        try {
            const blob = await documentService.download(docId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = docName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            // silent
        }
    };

    const modalContent = (
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen bg-slate-950/85 backdrop-blur-md z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-8 animate-fade-in overflow-hidden">
            <div className={`bg-slate-900 text-white rounded-2xl md:rounded-3xl w-full flex flex-col shadow-2xl border border-slate-700/80 overflow-hidden transition-all duration-300 ${isFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-5xl h-[90vh]'}`}>

                <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between shrink-0 gap-3">
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

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00529C] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
                        >
                            <Download size={14} />
                            <span className="hidden sm:inline">Unduh File</span>
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                            title="Cetak Dokumen"
                        >
                            <Printer size={16} />
                        </button>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                            title={isFullscreen ? "Kecilkan Layar" : "Layar Penuh"}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-800 hover:bg-red-600/30 text-slate-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                            title="Tutup (Esc)"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-slate-950 overflow-y-auto p-3 sm:p-5 md:p-6 flex items-center justify-center relative min-h-0">
                    {/* Non-previewable files (Excel/Word/ZIP) — always show download prompt */}
                    {isNonPreview ? (
                        <div className="flex flex-col items-center justify-center text-center p-10 w-full h-full bg-white rounded-2xl shadow-2xl">
                            <div className="w-20 h-20 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 mb-2">File {nonPreviewLabel}</h3>
                            <p className="text-sm text-slate-500 max-w-md mb-1 leading-relaxed">
                                <strong className="text-slate-700">{docName}</strong>
                            </p>
                            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                                File {nonPreviewLabel} tidak dapat ditampilkan langsung. Silakan unduh untuk membuka di aplikasi {nonPreviewLabel}.
                            </p>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer active:scale-95 shadow-md"
                            >
                                <Download size={16} />
                                Unduh {nonPreviewLabel}
                            </button>
                        </div>
                    ) : isLoadingUrl ? (
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                            <div className="w-10 h-10 border-3 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
                            <span className="text-sm font-medium">Memuat dokumen...</span>
                        </div>
                    ) : isImage && safeUrl ? (
                        <img
                            src={safeUrl}
                            alt={docName}
                            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-white p-2 border border-slate-700 mx-auto my-auto"
                        />
                    ) : safeUrl ? (
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
                    ) : loadError ? (
                        <div className="flex flex-col items-center justify-center text-center p-10 w-full h-full bg-white rounded-2xl shadow-2xl">
                            <div className="w-16 h-16 rounded-full bg-red-100 text-red-500 flex items-center justify-center mb-4">
                                <X size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Gagal Memuat Dokumen</h3>
                            <p className="text-sm text-slate-500 max-w-md mb-4">
                                Dokumen tidak dapat ditampilkan. Silakan coba unduh manual.
                            </p>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#00529C] hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer"
                            >
                                <Download size={16} />
                                Unduh Manual
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-10 w-full h-full bg-white rounded-2xl shadow-2xl">
                            <div className="w-20 h-20 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 mb-2">File {nonPreviewLabel}</h3>
                            <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                                <strong className="text-slate-700">{docName}</strong> tidak dapat ditampilkan langsung. Silakan unduh.
                            </p>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-6 py-3 bg-[#00529C] hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer active:scale-95"
                            >
                                <Download size={16} />
                                Unduh File
                            </button>
                        </div>
                    )}
                </div>

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
