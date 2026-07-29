// src/pages/Documents.jsx
import { useState, useMemo } from 'react';
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
    Bell,
    HelpCircle,
    LogOut,
    LayoutDashboard,
    Briefcase,
    Folder,
    PlusCircle,
    UserPlus,
    FileSearch,
    Users,
    Kanban,
    ClipboardList,
    Send,
    CheckSquare,
    ShieldAlert,
    Lock,
    ClipboardCheck,
    ShieldCheck,
    Rocket,
    UserCog,
    History,
    BarChart,
    Settings,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

const mapDocTypeToCategory = (type) => {
    switch (type) {
        case 'brd': return { category: 'Kebutuhan', color: 'bg-tertiary-fixed text-tertiary' };
        case 'fsd': return { category: 'Teknis', color: 'bg-secondary-fixed text-on-secondary-fixed-variant' };
        case 'qa_report':
        case 'cyber_report':
        case 'uat_doc': return { category: 'Testing', color: 'bg-primary-fixed text-on-primary-fixed-variant' };
        default: return { category: 'Umum', color: 'bg-surface-variant text-on-surface-variant' };
    }
};

// Mapping icon
const iconMap = {
    pdf: { icon: File, className: 'text-status-error' },
    word: { icon: FileText, className: 'text-primary' },
    excel: { icon: FileSpreadsheet, className: 'text-status-success' },
};

export default function Documents() {
    const { user } = useAuth();
    const { documents: ctxDocs, isLoading } = useProjects();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('Semua File');
    const [selectedDocs, setSelectedDocs] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

    const tabs = ['Semua File', 'Kebutuhan (BRD/FSD)', 'Teknis & UAT', 'Kontrak/Legal'];

    // Map context documents
    const mappedDocs = useMemo(() => (ctxDocs || []).map(doc => {
        const typeInfo = mapDocTypeToCategory(doc.doc_type);
        let icon = 'pdf';
        if (doc.file_name?.endsWith('.docx')) icon = 'word';
        else if (doc.file_name?.endsWith('.xlsx')) icon = 'excel';
        
        return {
            id: doc.id,
            name: doc.file_name,
            size: doc.file_size,
            project: doc.project_name,
            category: typeInfo.category,
            uploadedBy: doc.uploaded_by_name || 'System User',
            date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('id-ID') : 'Terbaru',
            type: doc.doc_type,
            icon,
            color: typeInfo.color,
        };
    }), [ctxDocs]);

    // Dynamic summary metrics based on real mappedDocs
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

    // Filter dokumen
    const filteredDocs = useMemo(() => {
        let result = [...mappedDocs];

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(
                (doc) =>
                    doc.name.toLowerCase().includes(term) ||
                    doc.project.toLowerCase().includes(term) ||
                    doc.uploadedBy.toLowerCase().includes(term)
            );
        }

        // Tab filter
        if (activeTab === 'Kebutuhan (BRD/FSD)') {
            result = result.filter((doc) => doc.category === 'Kebutuhan');
        } else if (activeTab === 'Teknis & UAT') {
            result = result.filter((doc) => doc.category === 'Teknis' || doc.category === 'Testing');
        } else if (activeTab === 'Kontrak/Legal') {
            result = result.filter((doc) => doc.category === 'Legal');
        }

        return result;
    }, [searchTerm, activeTab, mappedDocs]);

    // Handle checkbox
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

    // Get icon component
    const getDocIcon = (type) => {
        const config = iconMap[type] || { icon: File, className: 'text-gray-400' };
        const Icon = config.icon;
        return <Icon className={`${config.className} w-6 h-6`} />;
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-[#f8f9fb]">
            <div className="max-w-7xl mx-auto space-y-6">
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
                        <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <FolderOpen size={18} />
                            Buat Folder
                        </button>
                        <button className="px-4 py-2 bg-[#003a73] text-white rounded-lg text-sm font-semibold hover:bg-[#002a5a] transition-colors flex items-center gap-2 shadow-sm">
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
                                className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4"
                            >
                                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                                    <Icon size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {item.label}
                                    </p>
                                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{item.value}</h3>
                                    {item.change && (
                                        <p className={`text-sm flex items-center gap-1 mt-1 ${item.changeColor}`}>
                                            <span className="text-[14px]">↑</span>
                                            {item.change} bln ini
                                        </p>
                                    )}
                                    {item.sub && (
                                        <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Workspace Area */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
                    {/* Tabs */}
                    <div className="flex items-center px-4 border-b border-gray-100 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                                    ? 'text-[#1A56DB] border-[#1A56DB]'
                                    : 'text-gray-500 border-transparent hover:text-gray-700'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Filters & Search */}
                    <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50 border-b border-gray-100">
                        <div className="flex flex-wrap items-center gap-2">
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                                <Filter size={16} />
                                Filter
                            </button>
                            <div className="h-6 w-px bg-gray-200"></div>
                            <span className="text-sm text-gray-500">
                                Menampilkan 1-{Math.min(filteredDocs.length, 10)} dari {filteredDocs.length} dokumen
                            </span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-60">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Cari file..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] transition-all"
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

                    {/* Data Table / Grid */}
                    <div className="overflow-auto">
                        {viewMode === 'list' ? (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 border-b border-gray-100 w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedDocs.length === filteredDocs.length && filteredDocs.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300 text-[#1A56DB] focus:ring-[#1A56DB]"
                                            />
                                        </th>
                                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 border-b border-gray-100">
                                            NAMA DOKUMEN
                                        </th>
                                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 border-b border-gray-100">
                                            PROYEK TERKAIT
                                        </th>
                                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 border-b border-gray-100">
                                            KATEGORI
                                        </th>
                                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 border-b border-gray-100">
                                            DIUNGGAH OLEH
                                        </th>
                                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 border-b border-gray-100">
                                            TANGGAL
                                        </th>
                                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 border-b border-gray-100 text-right">
                                            AKSI
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {filteredDocs.length > 0 ? (
                                        filteredDocs.map((doc) => (
                                            <tr
                                                key={doc.id}
                                                className={`hover:bg-gray-50 transition-colors group cursor-pointer ${selectedDocs.includes(doc.id) ? 'bg-blue-50/50' : ''
                                                    }`}
                                            >
                                                <td className="py-3 px-6">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDocs.includes(doc.id)}
                                                        onChange={() => toggleSelectDoc(doc.id)}
                                                        className="rounded border-gray-300 text-[#1A56DB] focus:ring-[#1A56DB]"
                                                    />
                                                </td>
                                                <td className="py-3 px-6">
                                                    <div className="flex items-center gap-3">
                                                        {getDocIcon(doc.icon)}
                                                        <div>
                                                            <p className="font-medium text-gray-800 group-hover:text-[#1A56DB] transition-colors">
                                                                {doc.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500">{doc.size}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-6 text-gray-800">{doc.project}</td>
                                                <td className="py-3 px-6">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${doc.categoryColor}`}
                                                    >
                                                        {doc.category}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-6 text-gray-500">{doc.uploadedBy}</td>
                                                <td className="py-3 px-6 text-gray-500">{doc.date}</td>
                                                <td className="py-3 px-6 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="p-1.5 text-gray-400 hover:text-[#1A56DB] transition-colors" title="Lihat">
                                                            <Eye size={18} />
                                                        </button>
                                                        <button className="p-1.5 text-gray-400 hover:text-[#1A56DB] transition-colors" title="Unduh">
                                                            <Download size={18} />
                                                        </button>
                                                        <button className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="py-8 text-center text-gray-500">
                                                Tidak ada dokumen yang ditemukan.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            // Grid view (sederhana)
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                                {filteredDocs.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                {getDocIcon(doc.icon)}
                                                <div>
                                                    <p className="font-medium text-gray-800 text-sm">{doc.name}</p>
                                                    <p className="text-xs text-gray-500">{doc.size}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${doc.categoryColor}`}>
                                                {doc.category}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">Proyek: {doc.project}</p>
                                        <p className="text-xs text-gray-500">Upload: {doc.uploadedBy}</p>
                                        <div className="flex items-center justify-end gap-1 mt-3 border-t border-gray-100 pt-2">
                                            <button className="p-1.5 text-gray-400 hover:text-[#1A56DB] transition-colors">
                                                <Eye size={16} />
                                            </button>
                                            <button className="p-1.5 text-gray-400 hover:text-[#1A56DB] transition-colors">
                                                <Download size={16} />
                                            </button>
                                            <button className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
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
        </div>
    );
}