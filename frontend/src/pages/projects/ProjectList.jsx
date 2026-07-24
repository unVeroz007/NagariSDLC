import { useState, useMemo } from 'react';
import RBBBadge from '../../components/RBBBadge';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../contexts/ProjectContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
    Search,
    Download,
    Plus,
    Folder,
    Bolt,
    ClipboardCheck,
    CheckCircle,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    Filter,
    User,
    UserX,
    ArrowUpRight,
} from 'lucide-react';
import { mockProjects, getProjectStats } from '../../data/mockData';

export default function ProjectList() {
    const navigate = useNavigate();
    const { projects, isLoading } = useProjects();
    const [searchTerm, setSearchTerm] = useState('');
    const [divisionFilter, setDivisionFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const stats = getProjectStats(projects);

    const filteredProjects = useMemo(() => {
        let result = [...projects];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.id.toLowerCase().includes(term) ||
                p.name.toLowerCase().includes(term) ||
                p.description.toLowerCase().includes(term)
            );
        }
        if (divisionFilter) result = result.filter(p => p.division === divisionFilter);
        if (statusFilter) result = result.filter(p => p.status.includes(statusFilter));
        if (typeFilter) result = result.filter(p => p.type === typeFilter);
        switch (sortBy) {
            case 'newest': result.sort((a, b) => b.id.localeCompare(a.id)); break;
            case 'oldest': result.sort((a, b) => a.id.localeCompare(b.id)); break;
            case 'id_asc': result.sort((a, b) => a.id.localeCompare(b.id)); break;
            default: break;
        }
        return result;
    }, [projects, searchTerm, divisionFilter, statusFilter, typeFilter, sortBy]);

    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const currentProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const goToPage = (page) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };
    const uniqueDivisions = [...new Set(projects.map(p => p.division))];
    const uniqueStatuses = [...new Set(projects.map(p => p.status))];

    const statCards = [
        { label: 'Total Proyek', value: stats.total, icon: Folder, iconBg: 'bg-blue-50', iconColor: 'text-[#1A56DB]', border: 'border-blue-100' },
        { label: 'Dalam Pengerjaan', value: stats.inProgress, icon: Bolt, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', border: 'border-amber-100' },
        { label: 'Menunggu Review', value: stats.pendingReview, icon: ClipboardCheck, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', border: 'border-purple-100' },
        { label: 'Selesai', value: stats.completed, icon: CheckCircle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', border: 'border-emerald-100' },
    ];

    if (isLoading) return <LoadingSpinner text="Memuat daftar proyek..." />;
    if (projects.length === 0) return (
        <div className="px-6 py-4 md:px-8 md:py-5">
            <EmptyState title="Belum Ada Proyek" description="Belum ada proyek yang terdaftar." actionText="Buat Proyek Baru" onAction={() => navigate('/projects/new')} />
        </div>
    );

    return (
        <div className="px-6 py-4 md:px-8 md:py-5 animate-slide-up">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">
                            Portofolio &amp; Daftar Proyek
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Pantau seluruh proyek dari tahap inisiasi hingga rilis produksi.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-all hover:shadow-md">
                            <Download size={16} />
                            Export
                        </button>
                        <button
                            onClick={() => navigate('/projects/new')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#003a73] rounded-xl text-sm font-bold text-white hover:bg-[#002a5a] shadow-md shadow-[#003a73]/20 transition-all hover:shadow-lg hover:shadow-[#003a73]/30 hover:-translate-y-0.5 btn-shimmer"
                        >
                            <Plus size={16} />
                            Proyek Baru
                        </button>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {statCards.map((s, i) => (
                        <div key={i} className={`bg-white p-4 rounded-xl shadow-sm border ${s.border} card-hover flex items-center gap-4 animate-slide-up-${i + 1}`}>
                            <div className={`w-12 h-12 rounded-xl ${s.iconBg} ${s.iconColor} flex items-center justify-center shrink-0`}>
                                <s.icon size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{s.label}</p>
                                <p className="text-2xl font-extrabold text-gray-800">{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Table Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                    {/* Filter Bar */}
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center bg-gray-50/30">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                placeholder="Cari ID atau nama proyek..."
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex gap-2.5 flex-wrap">
                            <select
                                value={divisionFilter}
                                onChange={(e) => { setDivisionFilter(e.target.value); setCurrentPage(1); }}
                                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] shadow-sm"
                            >
                                <option value="">Semua Divisi</option>
                                {uniqueDivisions.map(div => <option key={div} value={div}>{div}</option>)}
                            </select>
                            <select
                                value={typeFilter}
                                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] shadow-sm"
                            >
                                <option value="">Semua Tipe</option>
                                <option value="RBB">RBB (Wajib Selesai)</option>
                                <option value="NON_RBB">Non-RBB (Fleksibel)</option>
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] shadow-sm"
                            >
                                <option value="">Semua Status</option>
                                {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] shadow-sm"
                            >
                                <option value="newest">Terbaru</option>
                                <option value="oldest">Terlama</option>
                                <option value="id_asc">ID (A-Z)</option>
                            </select>
                            <button className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-[#1A56DB] hover:border-[#1A56DB]/30 transition-colors shadow-sm">
                                <Filter size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-400 border-b border-gray-100 text-xs uppercase tracking-wider font-bold">
                                    <th className="px-5 py-3.5">ID Proyek</th>
                                    <th className="px-5 py-3.5">Nama Proyek</th>
                                    <th className="px-5 py-3.5">Divisi Peminta</th>
                                    <th className="px-5 py-3.5">Project Manager</th>
                                    <th className="px-5 py-3.5">Fase / Status</th>
                                    <th className="px-5 py-3.5">Target Selesai</th>
                                    <th className="px-5 py-3.5 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {currentProjects.length > 0 ? (
                                    currentProjects.map((project) => (
                                        <tr key={project.id} className="group hover:bg-blue-50/30 transition-colors cursor-pointer">
                                            <td className="px-5 py-4">
                                                <span className="font-bold text-[#1A56DB] bg-blue-50 px-2.5 py-1 rounded-lg text-xs">{project.id}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div>
                                                    <div className="font-semibold text-gray-800 group-hover:text-[#1A56DB] transition-colors">{project.name}</div>
                                                    <div className="text-xs text-gray-400 truncate w-48 xl:w-64 mt-0.5">{project.description}</div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-gray-500 text-sm">{project.division}</td>
                                            <td className="px-5 py-4">
                                                {project.pm ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1A56DB] to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                                                            {project.pm.initial}
                                                        </div>
                                                        <span className="text-gray-700 font-medium">{project.pm.name}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-gray-400">
                                                        <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center">
                                                            <UserX size={13} />
                                                        </div>
                                                        <span className="italic text-xs">Belum Dialokasi</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${project.type === 'RBB' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {project.type === 'RBB' ? '🔴 RBB' : '⚪ Non-RBB'}
                                                    </span>
                                                    <RBBBadge type={project.type} deadline={project.rbbDeadline} />
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${project.statusColor}`}>
                                                        <span className="w-1 h-1 rounded-full bg-current" />
                                                        {project.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-gray-500 text-sm">{project.targetDate}</td>
                                            <td className="px-5 py-4 text-center">
                                                <button className="p-2 text-gray-300 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                    <ArrowUpRight size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                                                    <Folder size={32} className="text-gray-400" />
                                                </div>
                                                <p className="text-gray-500 font-medium">Tidak ada proyek yang ditemukan</p>
                                                <p className="text-gray-400 text-sm">Coba ubah filter pencarian Anda</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredProjects.length > 0 && (
                        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                                Menampilkan <span className="font-bold text-gray-700">
                                    {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredProjects.length)}
                                </span> dari <span className="font-bold text-gray-700">{filteredProjects.length}</span> proyek
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
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
                                            <button key={pageNum} onClick={() => goToPage(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors ${pageNum === currentPage ? 'bg-[#1A56DB] text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                {pageNum}
                                            </button>
                                        );
                                    }
                                    return null;
                                })}
                                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
                                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}