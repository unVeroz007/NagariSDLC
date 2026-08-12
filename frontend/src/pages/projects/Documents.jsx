// src/pages/projects/Documents.jsx
import { useState, useMemo, useRef } from 'react';
import {
    FolderOpen,
    FileText,
    FileSpreadsheet,
    File,
    Search,
    Filter,
    Grid3X3,
    List,
    Eye,
    Download,
    Trash2,
    Plus,
    Upload,
    ChevronRight,
    X,
    CheckCircle2,
    Folder,
    Printer,
    Maximize2,
    Minimize2,
    ZoomIn,
    ZoomOut,
    ShieldCheck,
    Verified,
    FileCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { documentService } from '../../services/api';
import { getDocExtLabel, getDocIconStyle } from '../../utils/documentNaming';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';

const mapDocTypeToCategory = (type, fileName = '') => {
    const t = (type || '').toLowerCase();
    const fn = (fileName || '').toLowerCase();

    if (t === 'brd' || fn.includes('brd') || fn.includes('kebutuhan') || fn.includes('bimbingan')) {
        return { category: 'Kebutuhan', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    if (t === 'fsd' || t === 'qa_report' || t === 'cyber_report' || fn.includes('fsd') || fn.includes('test') || fn.includes('qa') || fn.includes('cyber') || fn.includes('siber') || fn.includes('article')) {
        return { category: 'Teknis', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
    }
    if (t === 'uat_doc' || t === 'testing' || fn.includes('uat') || fn.includes('berita')) {
        return { category: 'Testing', color: 'bg-purple-100 text-purple-700 border-purple-200' };
    }
    if (t === 'legal' || t === 'kontrak' || fn.includes('legal') || fn.includes('kontrak') || fn.includes('perjanjian')) {
        return { category: 'Legal', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    }
    return { category: 'Kebutuhan', color: 'bg-blue-100 text-blue-700 border-blue-200' };
};

const iconMap = {
    pdf: { icon: File, className: 'text-red-500' },
    word: { icon: FileText, className: 'text-blue-600' },
    excel: { icon: FileSpreadsheet, className: 'text-emerald-600' },
};

export default function Documents() {
    const { user } = useAuth();
    const { projects, documents: ctxDocs, addDocument, deleteDocument, isLoading } = useProjects();

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('Semua File');
    const [selectedDocs, setSelectedDocs] = useState([]);
    const [viewMode, setViewMode] = useState('list');

    // Modals & Viewer states
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Form states
    const [folderName, setFolderName] = useState('');
    const [customFolders, setCustomFolders] = useState([
        { id: 'f1', name: 'BRD & FSD Kebutuhan', color: 'bg-blue-50 border-blue-200 text-[#1A56DB]' },
        { id: 'f2', name: 'Laporan Test QA & Siber', color: 'bg-purple-50 border-purple-200 text-purple-700' },
        { id: 'f3', name: 'Berita Acara UAT & Legal', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    ]);

    const [uploadProject, setUploadProject] = useState('');
    const [uploadDocType, setUploadDocType] = useState('brd');
    const [uploadFileName, setUploadFileName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);

    const fileInputRef = useRef(null);

    const tabs = ['Semua File', 'Kebutuhan (BRD/FSD)', 'Teknis & UAT', 'Kontrak/Legal'];

    const showToast = (msg, type = 'success') => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const isPdfDoc = useMemo(() => {
        if (!previewDoc) return false;
        const fileName = (previewDoc.name || '').toLowerCase();
        return fileName.endsWith('.pdf') || previewDoc.type === 'pdf';
    }, [previewDoc]);

    const isImageDoc = useMemo(() => {
        if (!previewDoc) return false;
        const fileName = (previewDoc.name || '').toLowerCase();
        return /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
    }, [previewDoc]);

    // Convert Data URL to Blob URL ONLY for PDFs/Images to prevent browser forced downloads
    const previewBlobUrl = useMemo(() => {
        if (!previewDoc) return null;
        if (!isPdfDoc && !isImageDoc) return null;

        const rawUrl = previewDoc.url || previewDoc.fileUrl || previewDoc.dataUrl;
        if (!rawUrl) return null;

        if (rawUrl.startsWith('data:')) {
            try {
                const parts = rawUrl.split(',');
                const mimeMatch = parts[0].match(/:(.*?);/);
                const mime = mimeMatch ? mimeMatch[1] : (isPdfDoc ? 'application/pdf' : 'image/png');
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                const blob = new Blob([u8arr], { type: mime });
                return URL.createObjectURL(blob);
            } catch (e) {
                console.warn('Failed to convert Data URL to Blob:', e);
                return rawUrl;
            }
        }
        return rawUrl;
    }, [previewDoc, isPdfDoc, isImageDoc]);

    // Map API documents only (DocumentVault) — no synthetic entries
    const allDocs = useMemo(() => {
        const projectDocs = (projects || []).flatMap(p => {
            const pName = p.name || p.title || 'Proyek SDLC';

            if (!Array.isArray(p.documents)) return [];

            return p.documents.map((doc, idx) => ({
                id: doc.id || `DOC-PRJ-${p.id}-${idx}`,
                name: doc.file_name || doc.name || 'Dokumen.pdf',
                size: doc.file_size || doc.size || 'N/A',
                type: doc.document_type || doc.doc_type || doc.type || 'lainnya',
                project: pName,
                uploadedBy: doc.author || doc.uploader?.name || p.creator?.name || user?.name || 'PIC Proyek',
                date: doc.created_at || doc.uploadedAt || p.submittedAt || 'Terbaru',
            }));
        });

        const combined = [...projectDocs];

        const unique = [];
        const seen = new Set();
        combined.forEach(d => {
            const key = d.id || `${d.name}-${d.project}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(d);
            }
        });

        return unique;
    }, [ctxDocs, projects, user]);

    const mappedDocs = useMemo(() => (allDocs || []).map(doc => {
        const fileName = doc.file_name || doc.name || 'Dokumen.pdf';
        const typeInfo = mapDocTypeToCategory(doc.doc_type || doc.type, fileName);
        let icon = 'pdf';
        if (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')) icon = 'word';
        else if (fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')) icon = 'excel';

        return {
            id: doc.id,
            name: fileName,
            size: doc.file_size || doc.size || '1.5 MB',
            project: doc.project_name || doc.project || 'Proyek SDLC',
            category: typeInfo.category,
            uploadedBy: doc.uploaded_by_name || doc.uploadedBy || user?.name || 'System User',
            date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('id-ID') : (doc.date || 'Terbaru'),
            type: doc.doc_type || doc.type || 'brd',
            url: doc.url || doc.fileUrl || doc.dataUrl || null,
            icon,
            color: typeInfo.color,
        };
    }), [allDocs, user]);


    // Summary metrics
    const summaryData = useMemo(() => {
        const total = mappedDocs.length;
        const pdf = mappedDocs.filter(d => d.name?.toLowerCase().endsWith('.pdf')).length;
        const word = mappedDocs.filter(d => d.name?.toLowerCase().endsWith('.docx') || d.name?.toLowerCase().endsWith('.doc')).length;
        const excel = mappedDocs.filter(d => d.name?.toLowerCase().endsWith('.xlsx') || d.name?.toLowerCase().endsWith('.xls')).length;

        return [
            { label: 'Total Dokumen', value: total.toLocaleString(), icon: FolderOpen, sub: `${total} dokumen tersimpan` },
            { label: 'File PDF', value: pdf.toLocaleString(), icon: File, sub: 'BRD, FSD, Kontrak' },
            { label: 'File Word', value: word.toLocaleString(), icon: FileText, sub: 'Draft, Notulensi, UAT' },
            { label: 'File Excel', value: excel.toLocaleString(), icon: FileSpreadsheet, sub: 'Matrix, Timeline, Data' },
        ];
    }, [mappedDocs]);

    // Interactive Folder Categories (Unified with Filter Navigation)
    const folderCategories = useMemo(() => {
        const total = mappedDocs.length;
        const kebutuhan = mappedDocs.filter(d => d.category === 'Kebutuhan').length;
        const teknis = mappedDocs.filter(d => d.category === 'Teknis' || d.category === 'Testing').length;
        const legal = mappedDocs.filter(d => d.category === 'Legal').length;

        return [
            {
                id: 'cat_all',
                tabName: 'Semua File',
                title: 'Semua Dokumen',
                subtitle: 'Seluruh berkas SDLC',
                count: total,
                icon: FolderOpen,
                activeClass: 'bg-gradient-to-r from-[#003a73] to-[#1A56DB] text-white border-[#003a73] shadow-md',
                defaultClass: 'bg-white border-gray-200 text-gray-800 hover:border-blue-300 hover:bg-blue-50/40',
                badgeClass: 'bg-white/20 text-white',
                badgeDefaultClass: 'bg-blue-50 text-[#1A56DB]',
            },
            {
                id: 'cat_brd',
                tabName: 'Kebutuhan (BRD/FSD)',
                title: 'BRD & FSD Kebutuhan',
                subtitle: 'Spesifikasi sistem & bisnis',
                count: kebutuhan,
                icon: FileText,
                activeClass: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-md',
                defaultClass: 'bg-white border-gray-200 text-gray-800 hover:border-blue-300 hover:bg-blue-50/40',
                badgeClass: 'bg-white/20 text-white',
                badgeDefaultClass: 'bg-blue-50 text-[#1A56DB]',
            },
            {
                id: 'cat_qa',
                tabName: 'Teknis & UAT',
                title: 'Laporan Test QA & Siber',
                subtitle: 'Hasil pengujian & keamanan',
                count: teknis,
                icon: ShieldCheck,
                activeClass: 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white border-purple-600 shadow-md',
                defaultClass: 'bg-white border-gray-200 text-gray-800 hover:border-purple-300 hover:bg-purple-50/40',
                badgeClass: 'bg-white/20 text-white',
                badgeDefaultClass: 'bg-purple-50 text-purple-700',
            },
            {
                id: 'cat_legal',
                tabName: 'Kontrak/Legal',
                title: 'Berita Acara UAT & Legal',
                subtitle: 'Kontrak, Notulensi & Legalitas',
                count: legal,
                icon: Verified,
                activeClass: 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-600 shadow-md',
                defaultClass: 'bg-white border-gray-200 text-gray-800 hover:border-emerald-300 hover:bg-emerald-50/40',
                badgeClass: 'bg-white/20 text-white',
                badgeDefaultClass: 'bg-emerald-50 text-emerald-700',
            },
        ];
    }, [mappedDocs]);

    // Filter dokumen
    const filteredDocs = useMemo(() => {
        let result = [...mappedDocs];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(
                (doc) =>
                    doc.name.toLowerCase().includes(term) ||
                    doc.project.toLowerCase().includes(term) ||
                    doc.uploadedBy.toLowerCase().includes(term)
            );
        }

        if (activeTab === 'Kebutuhan (BRD/FSD)') {
            result = result.filter((doc) => doc.category === 'Kebutuhan');
        } else if (activeTab === 'Teknis & UAT') {
            result = result.filter((doc) => doc.category === 'Teknis' || doc.category === 'Testing');
        } else if (activeTab === 'Kontrak/Legal') {
            result = result.filter((doc) => doc.category === 'Legal');
        }

        return result;
    }, [searchTerm, activeTab, mappedDocs]);

    // Handle File selection for upload
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const MAX_SIZE = 5 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                showToast(`Dokumen "${file.name}" ditolak karena ukurannya melebihi batas maksimal 5MB!`, 'error');
                e.target.value = '';
                return;
            }
            if (!file.name.toLowerCase().endsWith('.pdf')) {
                showToast('Mohon unggah berkas PDF (.pdf) untuk pratinjau langsung di browser!', 'error');
                e.target.value = '';
                return;
            }
            setSelectedFile(file);
            if (!uploadFileName) {
                setUploadFileName(file.name);
            }
        }
    };

    // Submit Buat Folder
    const handleCreateFolder = (e) => {
        e.preventDefault();
        if (!folderName.trim()) return;

        const newFolder = {
            id: `f_${Date.now()}`,
            name: folderName,
            color: 'bg-blue-50 border-blue-200 text-[#1A56DB]',
        };
        setCustomFolders(prev => [...prev, newFolder]);
        showToast(`Folder "${folderName}" berhasil dibuat!`);
        setFolderName('');
        setIsFolderModalOpen(false);
    };

    // Submit Unggah Dokumen
    const handleUploadSubmit = (e) => {
        e.preventDefault();
        const docName = uploadFileName || selectedFile?.name || 'Dokumen_Baru.pdf';
        const projName = uploadProject || (projects[0]?.name || 'Modul Pelaporan OJK Terpusat');
        const calcSize = selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : '1.8 MB';

        const dataUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;
        addDocument({
            id: Date.now(),
            file_name: docName,
            file_size: calcSize,
            project_name: projName,
            doc_type: uploadDocType,
            url: dataUrl,
            uploaded_by_name: user?.name || 'Super Admin',
            created_at: new Date().toISOString(),
        });

        showToast(`Dokumen "${docName}" berhasil diunggah!`);
        setIsUploadModalOpen(false);
        setUploadFileName('');
        setSelectedFile(null);
    };

    // Download & Delete handlers
    const handleDownload = async (doc) => {
        if (!doc.id) {
            toast.error('Dokumen tidak memiliki ID.');
            return;
        }
        try {
            const blob = await documentService.download(doc.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.name || 'dokumen.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Gagal mengunduh dokumen. File mungkin telah dipindahkan.');
        }
    };

    const handleDeleteDoc = (id, name) => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus dokumen "${name}"?`)) {
            deleteDocument(id);
            showToast(`Dokumen "${name}" berhasil dihapus.`, 'warning');
        }
    };

    // Delete Folder handler
    const handleDeleteFolder = (id, name, e) => {
        e.stopPropagation();
        if (window.confirm(`Apakah Anda yakin ingin menghapus folder "${name}"?`)) {
            setCustomFolders(prev => prev.filter(f => f.id !== id));
            showToast(`Folder "${name}" telah dihapus.`, 'warning');
        }
    };

    const toggleSelectAll = () => {
        if (selectedDocs.length === filteredDocs.length) {
            setSelectedDocs([]);
        } else {
            setSelectedDocs(filteredDocs.map((doc) => doc.id));
        }
    };

    const toggleSelectDoc = (id) => {
        setSelectedDocs((prev) =>
            prev.includes(id) ? prev.filter((docId) => docId !== id) : [...prev, id]
        );
    };

    const getDocIcon = (type) => {
        const config = iconMap[type] || { icon: File, className: 'text-gray-400' };
        const Icon = config.icon;
        return <Icon className={`${config.className} w-6 h-6`} />;
    };

    if (isLoading) return <LoadingSpinner text="Memuat dokumen..." />;

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-[#f8f9fb]">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Toast Message */}
                {toastMessage && (
                    <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white font-medium text-sm transition-all animate-bounce ${
                        toastMessage.type === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'
                    }`}>
                        <CheckCircle2 size={18} />
                        {toastMessage.msg}
                    </div>
                )}

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
                            Manajemen Dokumen Terpusat
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Kelola, bagikan, dan amankan seluruh dokumen SDLC.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsFolderModalOpen(true)}
                            className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
                        >
                            <FolderOpen size={18} className="text-[#1A56DB]" />
                            Buat Folder
                        </button>
                        <button
                            onClick={() => setIsUploadModalOpen(true)}
                            className="px-4 py-2.5 bg-[#003a73] text-white rounded-xl text-sm font-semibold hover:bg-[#002a5a] transition-colors flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
                        >
                            <Upload size={18} />
                            Unggah Dokumen
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {summaryData.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={item.label}
                                className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4"
                            >
                                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1A56DB] flex items-center justify-center shrink-0">
                                    <Icon size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        {item.label}
                                    </p>
                                    <h3 className="text-2xl font-extrabold text-gray-800 mt-0.5">{item.value}</h3>
                                    {item.sub && (
                                        <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Unified Interactive Folder Categories */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <Folder size={18} className="text-[#1A56DB]" /> Folder &amp; Kategori Dokumen
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Pilih folder kategori di bawah untuk memfilter berkas dokumen SDLC</p>
                        </div>
                        <button onClick={() => setIsFolderModalOpen(true)} className="text-xs font-bold text-[#1A56DB] hover:underline flex items-center gap-1 cursor-pointer">
                            <Plus size={14} /> Tambah Folder
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                        {folderCategories.map((cat) => {
                            const Icon = cat.icon;
                            const isActive = activeTab === cat.tabName;
                            return (
                                <div
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.tabName)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                                        isActive ? cat.activeClass : cat.defaultClass
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                            isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#1A56DB]'
                                        }`}>
                                            <Icon size={22} />
                                        </div>
                                        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                                            isActive ? cat.badgeClass : cat.badgeDefaultClass
                                        }`}>
                                            {cat.count} File
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold truncate">{cat.title}</h4>
                                        <p className={`text-xs mt-0.5 ${isActive ? 'text-white/80' : 'text-gray-400'}`}>{cat.subtitle}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Workspace Area */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">

                    {/* Filters & Search */}
                    <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50 border-b border-gray-100">
                        <div className="flex flex-wrap items-center gap-2">
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                                <Filter size={16} />
                                Filter
                            </button>
                            <div className="h-6 w-px bg-gray-200"></div>
                            <span className="text-sm text-gray-500">
                                Menampilkan {filteredDocs.length} dokumen
                            </span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-60">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Cari file dokumen..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'text-[#1A56DB] bg-blue-50' : 'text-gray-400 hover:bg-gray-100'
                                        }`}
                                >
                                    <Grid3X3 size={18} />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'text-[#1A56DB] bg-blue-50' : 'text-gray-400 hover:bg-gray-100'
                                        }`}
                                >
                                    <List size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Data Table / Grid / Empty State */}
                    <div className="overflow-auto">
                        {filteredDocs.length === 0 ? (
                            <div className="p-8">
                                <EmptyState
                                    title="Belum Ada Dokumen"
                                    description="Belum ada dokumen yang sesuai dengan kategori ini. Mulai dengan mengunggah dokumen baru."
                                    icon={FolderOpen}
                                    actionText="Unggah Dokumen"
                                    onAction={() => setIsUploadModalOpen(true)}
                                />
                            </div>
                        ) : viewMode === 'list' ? (
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="bg-gray-50/70 border-b border-gray-100">
                                    <tr className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                                        <th className="py-3.5 px-5 w-12 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedDocs.length === filteredDocs.length && filteredDocs.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300 text-[#1A56DB] focus:ring-[#1A56DB]"
                                            />
                                        </th>
                                        <th className="py-3.5 px-5">NAMA DOKUMEN</th>
                                        <th className="py-3.5 px-5">PROYEK TERKAIT</th>
                                        <th className="py-3.5 px-5">KATEGORI</th>
                                        <th className="py-3.5 px-5">DIUNGGAH OLEH</th>
                                        <th className="py-3.5 px-5">TANGGAL</th>
                                        <th className="py-3.5 px-5 text-center">AKSI</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-sm">
                                    {filteredDocs.map((doc) => (
                                        <tr
                                            key={doc.id}
                                            className={`hover:bg-blue-50/30 transition-colors group ${selectedDocs.includes(doc.id) ? 'bg-blue-50/50' : ''}`}
                                        >
                                            <td className="py-4 px-5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDocs.includes(doc.id)}
                                                    onChange={() => toggleSelectDoc(doc.id)}
                                                    className="rounded border-gray-300 text-[#1A56DB] focus:ring-[#1A56DB]"
                                                />
                                            </td>
                                            <td className="py-4 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] ${getDocIconStyle(doc.name || '')}`}>
                                                        {getDocExtLabel(doc.name || '')}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-800 group-hover:text-[#1A56DB] transition-colors">
                                                            {doc.name}
                                                        </p>
                                                        <p className="text-xs text-gray-400">{doc.size}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-5 text-gray-700 font-medium">{doc.project}</td>
                                            <td className="py-4 px-5">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${doc.color}`}>
                                                    {doc.category}
                                                </span>
                                            </td>
                                            <td className="py-4 px-5 text-gray-500">{doc.uploadedBy}</td>
                                            <td className="py-4 px-5 text-gray-500 text-xs">{doc.date}</td>
                                            <td className="py-4 px-5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => setPreviewDoc(doc)}
                                                        className="p-1.5 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Lihat Detail"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(doc)}
                                                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                        title="Unduh"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDoc(doc.id, doc.name)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Hapus"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                                {filteredDocs.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all bg-white flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] ${getDocIconStyle(doc.name || '')}`}>
                                                        {getDocExtLabel(doc.name || '')}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-sm">{doc.name}</p>
                                                        <p className="text-xs text-gray-400">{doc.size}</p>
                                                    </div>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${doc.color}`}>
                                                    {doc.category}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 font-medium">Proyek: <span className="text-gray-800">{doc.project}</span></p>
                                            <p className="text-xs text-gray-400 mt-1">Oleh: {doc.uploadedBy}</p>
                                        </div>
                                        <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t border-gray-100">
                                            <button onClick={() => setPreviewDoc(doc)} className="p-1.5 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors">
                                                <Eye size={16} />
                                            </button>
                                            <button onClick={() => handleDownload(doc)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                                <Download size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteDoc(doc.id, doc.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── MODAL: Buat Folder Baru ── */}
            {isFolderModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl animate-scale-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <FolderOpen size={20} className="text-[#1A56DB]" />
                                Buat Folder Baru
                            </h3>
                            <button onClick={() => setIsFolderModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateFolder} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nama Folder</label>
                                <input
                                    type="text"
                                    required
                                    value={folderName}
                                    onChange={e => setFolderName(e.target.value)}
                                    placeholder="Contoh: Dokumen Spesifikasi Kebutuhan"
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsFolderModalOpen(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-[#003a73] text-white rounded-xl text-sm font-bold hover:bg-[#002a5a] shadow-md"
                                >
                                    Simpan Folder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: Unggah Dokumen ── */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl animate-scale-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Upload size={20} className="text-[#1A56DB]" />
                                Unggah Dokumen SDLC
                            </h3>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Pilih Proyek SDLC</label>
                                <select
                                    value={uploadProject}
                                    onChange={e => setUploadProject(e.target.value)}
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1A56DB] bg-white"
                                >
                                    <option value="">Pilih Proyek Terkait...</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.name}>{p.reqId || p.id} - {p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Jenis Dokumen (Fase SDLC)</label>
                                <select
                                    value={uploadDocType}
                                    onChange={e => setUploadDocType(e.target.value)}
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1A56DB] bg-white"
                                >
                                    <option value="brd">BRD (Business Requirement Document)</option>
                                    <option value="fsd">FSD (Functional Specification Document)</option>
                                    <option value="qa_report">Laporan Testing QA</option>
                                    <option value="cyber_report">Laporan Audit Cyber Security</option>
                                    <option value="uat_doc">Berita Acara UAT</option>
                                    <option value="legal">Kontrak / Dokumen Legal</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">File Dokumen</label>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".pdf,application/pdf"
                                    className="hidden"
                                />
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-blue-200 hover:border-[#1A56DB] rounded-xl p-6 text-center cursor-pointer bg-blue-50/30 hover:bg-blue-50/60 transition-colors"
                                >
                                    <Upload size={32} className="mx-auto text-[#1A56DB] mb-2" />
                                    {selectedFile ? (
                                        <div>
                                            <p className="text-sm font-bold text-[#1A56DB]">{selectedFile.name}</p>
                                            <p className="text-xs text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • PDF Terverifikasi</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">Klik untuk memilih berkas dokumen PDF</p>
                                            <p className="text-xs text-blue-600 font-semibold mt-1 bg-white py-1 px-2.5 rounded-lg border border-blue-200 inline-block shadow-2xs">
                                                Format Resmi SDLC: Berkas PDF (.pdf) untuk Pratinjau Langsung (maks 25 MB)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nama Tampilan File</label>
                                <input
                                    type="text"
                                    value={uploadFileName}
                                    onChange={e => setUploadFileName(e.target.value)}
                                    placeholder="Contoh: BRD_SistemPelaporan_v1.0.pdf"
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1A56DB]"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-[#003a73] text-white rounded-xl text-sm font-bold hover:bg-[#002a5a] shadow-md flex items-center gap-1.5"
                                >
                                    <Upload size={16} />
                                    Unggah Sekarang
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: PRATINJAU DOKUMEN LANGSUNG ── */}
            {previewDoc && (
                <DocumentViewerModal
                    doc={previewDoc}
                    onClose={() => setPreviewDoc(null)}
                />
            )}
        </div>
    );
}