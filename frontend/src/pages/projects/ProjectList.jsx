import { useState, useMemo } from 'react';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
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
    ChevronLeft,
    ChevronRight,
    Filter,
    UserX,
    ArrowUpRight,
    Building2,
} from 'lucide-react';
import { getProjectStats } from '../../data/mockData';
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR } from '../../constants/projectStatus';

export default function ProjectList() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { projects, isLoading } = useProjects();
    const [searchTerm, setSearchTerm] = useState('');
    const [divisionFilter, setDivisionFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Role yang boleh menginisiasi proyek baru
    const canCreateProject = ['super_admin', 'head_of_it', 'business_user'].includes(user?.role);
    // Role yang boleh membuka detail proyek via tracker/track
    const canViewDetail = ['super_admin', 'head_of_it', 'lead_group', 'project_manager', 'dev_analyst', 'development_lead', 'business_user'].includes(user?.role);

    const stats = getProjectStats(projects);

    const filteredProjects = useMemo(() => {
        let result = [...projects];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p => {
                const idStr = String(p.reqId || p.req_id || p.id || '').toLowerCase();
                const nameStr = String(p.name || p.title || '').toLowerCase();
                const descStr = String(p.description || '').toLowerCase();
                return idStr.includes(term) || nameStr.includes(term) || descStr.includes(term);
            });
        }
        if (divisionFilter) {
            result = result.filter(p => {
                const divName = typeof p.division === 'object' ? p.division?.name : p.division;
                return divName === divisionFilter;
            });
        }
        if (statusFilter) result = result.filter(p => (p.status || '').includes(statusFilter));
        if (typeFilter) {
            result = result.filter(p => {
                const normType = String(p.type || '').toUpperCase().replace('-', '_');
                const normFilter = String(typeFilter).toUpperCase().replace('-', '_');
                if (normFilter === 'RBB') return normType === 'RBB';
                if (normFilter === 'NON_RBB') return normType === 'NON_RBB' || normType === 'NONRBB' || normType !== 'RBB';
                return normType === normFilter;
            });
        }

        switch (sortBy) {
            case 'newest': result.sort((a, b) => (b.id || 0) - (a.id || 0)); break;
            case 'oldest': result.sort((a, b) => (a.id || 0) - (b.id || 0)); break;
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
        { label: 'Total Proyek', value: stats.total, icon: Folder, iconBg: 'bg-blue-50', iconColor: 'text-[#00529C]', border: 'border-blue-100' },
        { label: 'Dalam Pengerjaan', value: stats.inProgress, icon: Bolt, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', border: 'border-amber-100' },
        { label: 'Menunggu Review', value: stats.pendingReview, icon: ClipboardCheck, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', border: 'border-purple-100' },
        { label: 'Selesai', value: stats.completed, icon: CheckCircle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', border: 'border-emerald-100' },
    ];

    if (isLoading) return <LoadingSpinner text="Memuat daftar proyek..." />;


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
                        {canCreateProject && (
                            <button
                                onClick={() => navigate('/projects/new')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#003a73] rounded-xl text-sm font-bold text-white hover:bg-[#002a5a] shadow-md shadow-[#003a73]/20 transition-all hover:shadow-lg hover:shadow-[#003a73]/30 hover:-translate-y-0.5 btn-shimmer"
                            >
                                <Plus size={16} />
                                Proyek Baru
                            </button>
                        )}
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
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex gap-2.5 flex-wrap">
                            <select
                                value={divisionFilter}
                                onChange={(e) => { setDivisionFilter(e.target.value); setCurrentPage(1); }}
                                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] shadow-sm"
                            >
                                <option value="">Semua Divisi</option>
                                {uniqueDivisions.map(div => <option key={div} value={div}>{div}</option>)}
                            </select>
                            <select
                                value={typeFilter}
                                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] shadow-sm"
                            >
                                <option value="">Semua Tipe</option>
                                <option value="RBB">RBB (Wajib Selesai)</option>
                                <option value="NON_RBB">Non-RBB (Fleksibel)</option>
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] shadow-sm"
                            >
                                <option value="">Semua Status</option>
                                {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] shadow-sm"
                            >
                                <option value="newest">Terbaru</option>
                                <option value="oldest">Terlama</option>
                                <option value="id_asc">ID (A-Z)</option>
                            </select>
                            <button className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-[#00529C] hover:border-[#00529C]/30 transition-colors shadow-sm">
                                <Filter size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1000px] table-fixed">
                            <colgroup>
                                <col className="w-[12%]" />
                                <col className="w-[19%]" />
                                <col className="w-[22%]" />
                                <col className="w-[17%]" />
                                <col className="w-[14%]" />
                                <col className="w-[10%]" />
                                <col className="w-[6%]" />
                            </colgroup>
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-400 border-b border-gray-100 text-xs uppercase tracking-wider font-bold">
                                    <th className="pl-5 pr-4 py-3.5">ID Proyek</th>
                                    <th className="px-4 py-3.5">Nama Proyek</th>
                                    <th className="px-3 py-3.5">Divisi Peminta</th>
                                    <th className="px-3 py-3.5">Project Manager</th>
                                    <th className="px-3 py-3.5">Fase / Status</th>
                                    <th className="px-3 py-3.5">Target Selesai</th>
                                    <th className="pr-5 pl-2 py-3.5 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {currentProjects.length > 0 ? (
                                    currentProjects.map((project) => {
                                        const isPmOrAdmin = ['project_manager', 'super_admin', 'dev_analyst', 'development_lead', 'head_of_it'].includes(user?.role);
                                        const isBusinessUser = user?.role === 'business_user';
                                        const targetPath = isPmOrAdmin ? '/pm/tracker' : (isBusinessUser ? '/track' : null);
                                        const handleNavigate = () => {
                                            if (targetPath) {
                                                navigate(`${targetPath}?projectId=${project.id}`, { state: { projectId: project.id } });
                                            }
                                        };

                                        return (
                                            <tr
                                                key={project.id}
                                                onClick={canViewDetail ? handleNavigate : undefined}
                                                className={`group hover:bg-blue-50/40 transition-colors ${canViewDetail ? 'cursor-pointer' : ''}`}
                                            >
                                                <td className="pl-5 pr-4 py-4">
                                                    <span className="font-bold text-[#00529C] bg-blue-50 px-2.5 py-1 rounded-lg text-xs border border-blue-100/80">{project.reqId || project.id}</span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div>
                                                        <div className="font-semibold text-gray-800 group-hover:text-[#00529C] transition-colors truncate">{project.title || project.name}</div>
                                                        <div className="text-xs text-gray-400 truncate mt-0.5 font-normal">{project.description}</div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-slate-700 text-xs font-medium border border-slate-200/60 max-w-full">
                                                        <Building2 size={13} className="text-slate-400 shrink-0" />
                                                        <span className="truncate">{project.division}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    {project.pm ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00529C] to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm shrink-0">
                                                                {project.pm.initial || (project.pm.name || 'PM').substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="text-gray-700 font-medium truncate">{project.pm.name}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-gray-400">
                                                            <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0">
                                                                <UserX size={13} />
                                                            </div>
                                                            <span className="italic text-xs">Belum Dialokasi</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="flex flex-col gap-1.5 items-start">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <RBBBadge type={project.type} deadline={project.rbbDeadline} status={project.status} />
                                                            <ProjectTypeBadge type={project.project_type} />
                                                        </div>
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                                                            PROJECT_STATUS_COLOR[project.status] || project.statusColor || 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            <span className="w-1 h-1 rounded-full bg-current" />
                                                            {PROJECT_STATUS_LABEL[project.status] || project.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-gray-500 text-sm">{project.targetDate}</td>
                                                <td className="pr-5 pl-2 py-4 text-center">
                                                    {canViewDetail && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNavigate();
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#00529C] text-xs font-bold rounded-lg border border-[#00529C]/30 transition-all shadow-sm active:scale-95"
                                                        >
                                                            <span>Detail</span>
                                                            <ArrowUpRight size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-14 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-14 h-14 bg-blue-50 text-[#00529C] rounded-2xl flex items-center justify-center mb-1">
                                                    <Folder size={28} />
                                                </div>
                                                <p className="text-gray-800 font-bold text-base">Belum Ada Proyek</p>
                                                <p className="text-gray-500 text-xs">Belum ada proyek yang terdaftar di sistem. Mulai dengan membuat proyek SDLC pertama Anda.</p>
                                                {canCreateProject && (
                                                    <button
                                                        onClick={() => navigate('/projects/new')}
                                                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#003a73] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#002a5a] transition-all"
                                                    >
                                                        <Plus size={15} />
                                                        <span>Buat Proyek Baru</span>
                                                    </button>
                                                )}
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
                                                className={`w-8 h-8 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors ${pageNum === currentPage ? 'bg-[#00529C] text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
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