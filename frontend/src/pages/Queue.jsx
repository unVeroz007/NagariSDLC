import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Search,
    Bell,
    Filter,
    ChevronLeft,
    ChevronRight,
    Eye,
    Clock,
    AlertCircle,
    CheckCircle,
    XCircle,
    User,
    Calendar,
    FileText,
    ArrowRight,
    MoreHorizontal,
    RefreshCw,
    Download,
    Users,
    Briefcase,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Data dummy untuk antrean review (semua status dari berbagai fase)
const reviewQueueData = [
    {
        id: 'PRJ-2026-041',
        name: 'Sistem Anti-Fraud Baru',
        division: 'Divisi Kepatuhan',
        phase: 'Fase 1: Inisiasi',
        status: 'Menunggu Disposisi',
        statusColor: 'bg-amber-100 text-amber-700',
        priority: 'High',
        submittedAt: '2026-07-19T09:00:00',
        analyst: null,
        documents: 2,
    },
    {
        id: 'PRJ-2026-040',
        name: 'Dashboard HRIS Internal',
        division: 'Divisi SDM',
        phase: 'Fase 1: Inisiasi',
        status: 'Menunggu Disposisi',
        statusColor: 'bg-amber-100 text-amber-700',
        priority: 'Medium',
        submittedAt: '2026-07-18T14:30:00',
        analyst: null,
        documents: 1,
    },
    {
        id: 'PRJ-2026-038',
        name: 'Mobile Banking V3',
        division: 'Divisi Digital Banking',
        phase: 'Fase 1: Inisiasi',
        status: 'Disposisi ke Analyst',
        statusColor: 'bg-blue-100 text-blue-700',
        priority: 'High',
        submittedAt: '2026-07-17T11:00:00',
        analyst: 'Citra Kirana',
        documents: 3,
    },
    {
        id: 'PRJ-2026-035',
        name: 'Update Core Banking API',
        division: 'Divisi TI',
        phase: 'Fase 1: Inisiasi',
        status: 'Review Selesai',
        statusColor: 'bg-emerald-100 text-emerald-700',
        priority: 'Medium',
        submittedAt: '2026-07-15T10:00:00',
        analyst: 'Fajar Ramadhan',
        documents: 2,
    },
    {
        id: 'PRJ-2026-032',
        name: 'Sistem Pengaduan Nasabah',
        division: 'Divisi Layanan',
        phase: 'Fase 1: Inisiasi',
        status: 'Ditolak',
        statusColor: 'bg-red-100 text-red-700',
        priority: 'Low',
        submittedAt: '2026-07-12T08:30:00',
        analyst: 'Eka Putra',
        documents: 1,
    },
];

const statusOptions = ['Semua Status', 'Menunggu Disposisi', 'Disposisi ke Analyst', 'Review Selesai', 'Ditolak'];
const priorityOptions = ['Semua Prioritas', 'High', 'Medium', 'Low'];
const phaseOptions = ['Semua Fase', 'Fase 1: Inisiasi'];

export default function Queue() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Semua Status');
    const [priorityFilter, setPriorityFilter] = useState('Semua Prioritas');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Filter data
    const filteredData = useMemo(() => {
        let result = reviewQueueData;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(item =>
                item.id.toLowerCase().includes(term) ||
                item.name.toLowerCase().includes(term) ||
                item.division.toLowerCase().includes(term)
            );
        }

        if (statusFilter !== 'Semua Status') {
            result = result.filter(item => item.status === statusFilter);
        }

        if (priorityFilter !== 'Semua Prioritas') {
            result = result.filter(item => item.priority === priorityFilter);
        }

        return result;
    }, [searchTerm, statusFilter, priorityFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentItems = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getPriorityBadge = (priority) => {
        const colors = {
            High: 'bg-red-100 text-red-700 border-red-200',
            Medium: 'bg-amber-100 text-amber-700 border-amber-200',
            Low: 'bg-blue-100 text-blue-700 border-blue-200',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${colors[priority] || 'bg-gray-100 text-gray-700'}`}>
                {priority}
            </span>
        );
    };

    const getStatusIcon = (status) => {
        if (status === 'Menunggu Disposisi') return <Clock size={14} className="text-amber-500" />;
        if (status === 'Disposisi ke Analyst') return <User size={14} className="text-blue-500" />;
        if (status === 'Review Selesai') return <CheckCircle size={14} className="text-emerald-500" />;
        if (status === 'Ditolak') return <XCircle size={14} className="text-red-500" />;
        return <AlertCircle size={14} className="text-gray-400" />;
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8f9fb] overflow-hidden">
            {/* Topbar */}
            <header className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 shrink-0 z-10">
                <div className="flex items-center text-sm text-gray-500">
                    <span className="hover:text-[#1A56DB] cursor-pointer">Beranda</span>
                    <ChevronLeft size={16} className="mx-2 text-gray-300" />
                    <span className="hover:text-[#1A56DB] cursor-pointer">Fase 1</span>
                    <ChevronLeft size={16} className="mx-2 text-gray-300" />
                    <span className="font-semibold text-gray-800">Antrean Review</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative hidden md:block">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari ID atau Nama Proyek..."
                            className="pl-10 pr-4 py-2 w-64 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none bg-gray-50"
                        />
                    </div>
                    <button className="p-2 text-gray-500 hover:text-[#1A56DB] hover:bg-gray-100 rounded-full transition-colors relative">
                        <Bell size={20} />
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-[#003a73] text-white flex items-center justify-center font-bold text-sm">
                        {user?.name?.charAt(0) || 'L'}
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Antrean Review</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Daftar semua pengajuan proyek yang menunggu disposisi dan review dari Lead Group.
                            </p>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-[#003a73] text-white rounded-lg font-semibold text-sm hover:bg-[#002a5a] transition-colors shadow-sm">
                            <RefreshCw size={16} />
                            Refresh Data
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white"
                        >
                            {statusOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white"
                        >
                            {priorityOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <button className="px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <Filter size={16} />
                            Filter Lainnya
                        </button>
                        <span className="text-sm text-gray-500 ml-auto">
                            {filteredData.length} pengajuan ditemukan
                        </span>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                                        <th className="px-6 py-4">ID Proyek</th>
                                        <th className="px-6 py-4">Nama Proyek</th>
                                        <th className="px-6 py-4">Divisi</th>
                                        <th className="px-6 py-4">Prioritas</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Tanggal</th>
                                        <th className="px-6 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-sm">
                                    {currentItems.length > 0 ? (
                                        currentItems.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4 font-semibold text-[#1A56DB]">{item.id}</td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="font-medium text-gray-800">{item.name}</div>
                                                        <div className="text-xs text-gray-400">{item.phase}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">{item.division}</td>
                                                <td className="px-6 py-4">{getPriorityBadge(item.priority)}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.statusColor}`}>
                                                        {getStatusIcon(item.status)}
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 text-xs">{formatDate(item.submittedAt)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => navigate('/workspace/lead')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1A56DB] text-white rounded-lg text-xs font-medium hover:bg-[#1349c2] transition-colors"
                                                    >
                                                        <Eye size={14} />
                                                        Detail
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center">
                                                    <Inbox size={40} className="text-gray-300 mb-2" />
                                                    <p>Tidak ada data yang sesuai dengan filter</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {filteredData.length > 0 && (
                            <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                    Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} dari {filteredData.length}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let pageNum = i + 1;
                                        if (totalPages > 5 && currentPage > 3) {
                                            pageNum = currentPage - 2 + i;
                                            if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                                        }
                                        if (pageNum > 0 && pageNum <= totalPages) {
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`px-3 py-1 rounded text-sm font-medium ${pageNum === currentPage
                                                            ? 'bg-[#1A56DB] text-white'
                                                            : 'border border-gray-200 bg-white hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        }
                                        return null;
                                    })}
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}