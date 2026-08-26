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
import toast from 'react-hot-toast';
import { documentService } from '../services/api';
import { getFileFromStore } from '../utils/projectDocuments';
import { formatDocSizeLabel } from '../utils/documentNaming';

/**
 * Picu unduhan berkas dengan nama aslinya.
 *
 * Memakai anchor `download`, bukan `window.open`. Membuka blob URL di tab baru
 * menyimpan berkasnya dengan nama UUID milik URL tersebut — nama dokumen resmi
 * (mis. `REQ-2026-014-BRD-Mobile-Banking.pdf`) hilang, padahal justru nama itulah
 * yang menjadi rujukan pada berita acara.
 */
const triggerAnchorDownload = (url, fileName) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
};

export default function DocumentViewerModal({ doc, project, onClose }) {
    // React mewajibkan jumlah dan urutan hook sama pada setiap render, sehingga
    // pemeriksaan "dokumen kosong" dilakukan setelah semua hook dipanggil. Bila
    // early return diletakkan di atas hook, mengganti prop `doc` menjadi null
    // tanpa melepas komponen ini akan memicu "Rendered fewer hooks than
    // expected" dan seluruh layar ikut mati.
    const hasDoc = Boolean(doc);

    // Metadata dokumen tidak boleh diisi nilai karangan: ukuran, tipe, dan nama
    // pengunggah adalah bagian dari jejak audit dokumen. Bila datanya tidak
    // dikirim API, yang ditampilkan adalah tanda kosong, bukan contoh.
    const docId = doc?.id ?? null;
    const docName = doc?.name || doc?.file_name || doc?.title || 'Dokumen tanpa nama';
    const docType = (doc?.type || doc?.doc_type || doc?.category || 'DOKUMEN').toUpperCase();
    // Ukuran diformat lewat helper bersama. Sebagian pemanggil meneruskan
    // `file_size` mentah dalam byte, dan sebelumnya angka itu tampil apa adanya —
    // "2458123" alih-alih "2.34 MB".
    const docSize = formatDocSizeLabel(doc);
    const projName = doc?.project || doc?.project_name || project?.name || '-';
    const uploadedBy = doc?.uploadedBy || doc?.uploaded_by_name || doc?.author || '-';

    // Kunci pencarian berkas diambil sebagai nilai skalar supaya dependensi efek
    // di bawah tidak ikut berubah setiap kali induk membuat ulang objek `doc`.
    const embeddedUrl = doc?.url || doc?.fileUrl || doc?.dataUrl || null;
    const docStoreKey = doc?.name ?? null;

    const [safeUrl, setSafeUrl] = useState(null);
    const [isLoadingUrl, setIsLoadingUrl] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!hasDoc) return undefined;

        let cancelled = false;
        let createdUrl = null;

        const loadUrl = async () => {
            // 1. Cek direct URL dari doc object (Blob URL, Data URL, dll dari preview)
            const directUrl = embeddedUrl;
            if (directUrl && (directUrl.startsWith('blob:') || directUrl.startsWith('data:'))) {
                if (!cancelled) {
                    setSafeUrl(directUrl);
                    setIsLoadingUrl(false);
                }
                return;
            }

            // 2. Cek dari file store (cache lokal)
            const storedUrl = getFileFromStore(docStoreKey) || getFileFromStore(docId);
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
    }, [hasDoc, docId, embeddedUrl, docStoreKey]);

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

    useEffect(() => {
        if (!hasDoc) return undefined;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        if (typeof document !== 'undefined') document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (typeof document !== 'undefined') document.body.style.overflow = 'unset';
        };
    }, [hasDoc, onClose]);

    if (!hasDoc) return null;

    const handleDownload = async () => {
        if (isDownloading) return;

        // Berkas yang pratinjaunya sudah ada di memori (hasil unggah pada sesi ini)
        // langsung diunduh dari URL tersebut; tidak ada gunanya memanggil API untuk
        // berkas yang belum tentu punya baris di Document Vault.
        const localUrl = (embeddedUrl && (embeddedUrl.startsWith('blob:') || embeddedUrl.startsWith('data:')))
            ? embeddedUrl
            : [getFileFromStore(docStoreKey), getFileFromStore(docId)]
                .find((url) => url && (url.startsWith('blob:') || url.startsWith('data:')));

        if (localUrl) {
            triggerAnchorDownload(localUrl, docName);
            return;
        }

        if (!docId) {
            toast.error('Dokumen ini belum tersimpan di server sehingga belum dapat diunduh.');
            return;
        }

        // Blob-nya diambil ulang di sini, bukan memakai `safeUrl`. URL pratinjau
        // dicabut saat modal ditutup, jadi unduhan yang bergantung padanya bisa mati
        // di tengah jalan bila pengguna menutup modal lebih dulu.
        setIsDownloading(true);
        try {
            const blob = await documentService.download(docId);
            const url = URL.createObjectURL(blob);
            triggerAnchorDownload(url, docName);
            URL.revokeObjectURL(url);
        } catch (err) {
            // Kegagalan unduh sebelumnya ditelan diam-diam: tombolnya tampak berfungsi,
            // tidak ada berkas yang turun, dan tidak ada satu pun keterangan alasannya.
            toast.error(`Gagal mengunduh "${docName}": ${err.message}`);
        } finally {
            setIsDownloading(false);
        }
    };

    /**
     * Buka dokumen pada tab baru agar dapat dicetak dari penampil bawaan peramban.
     *
     * Tombol ini sebelumnya memanggil `window.print()`, yang mencetak halaman
     * aplikasi — bukan dokumennya. Pratinjau berada di dalam `<object>`/`<iframe>`
     * tersendiri, sehingga hasil cetaknya adalah tangkapan antarmuka modal berlatar
     * gelap, lengkap dengan tombol-tombolnya.
     */
    const handlePrint = () => {
        if (!safeUrl) {
            toast.error('Dokumen belum selesai dimuat, jadi belum dapat dicetak.');
            return;
        }
        const printWindow = window.open(safeUrl, '_blank', 'noopener');
        if (!printWindow) {
            toast.error('Peramban memblokir jendela baru. Izinkan pop-up untuk mencetak dokumen ini.');
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
                            disabled={isDownloading}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00529C] hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
                        >
                            <Download size={14} />
                            <span className="hidden sm:inline">{isDownloading ? 'Mengunduh...' : 'Unduh File'}</span>
                        </button>
                        <button
                            onClick={handlePrint}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                            title="Cetak Dokumen (dibuka di tab baru)"
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
