import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import ProjectTypeBadge from '../components/ProjectTypeBadge';
import {
    Search,
    Bell,
    LogOut,
    Calendar,
    Rocket,
    CheckCircle,
    Code,
    Shield,
    Route,
    FileText,
    User,
    ChevronRight,
    Clock,
    AlertCircle,
    ArrowRight,
    Check,
    MoreHorizontal,
    Filter,
    Eye,
    Download,
} from 'lucide-react';

// Filter status options
const statusOptions = ['Semua Status', 'Sedang Berjalan', 'Selesai'];

export default function Track() {
    const { user } = useAuth();
    const { projects } = useProjects();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const detailPanelRef = useRef(null);

    const mappedTrackingProjects = useMemo(() => {
        return (projects || []).map(p => ({
            rawId: p.id,
            id: p.reqId || p.req_id || `REQ-${p.id}`,
            name: p.name || p.title || 'Proyek Tanpa Judul',
            status: p.status || 'PENDING',
            submittedDate: p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : 'Terbaru',
            targetDate: p.targetDate || p.target_date || 'TBD',
            pm: typeof p.pm === 'object' ? (p.pm?.name || 'Belum Dialokasi') : (p.pm || 'Belum Dialokasi'),
            pmAvatar: (p.pm?.name || 'BD').substring(0, 2).toUpperCase(),
            description: p.description || 'Pengajuan proyek baru.',
            rejectionReason: p.rejection_reason || p.rejectionReason || null,
            phases: p.phases || [
                {
                    name: 'Fase 1: Inisiasi & Persetujuan',
                    description: 'Pengajuan disetujui oleh manajemen dan dialokasikan ke tim IT.',
                    completed: p.status !== 'PENDING',
                    items: [
                        { label: 'Pengajuan Selesai', date: 'Terbaru', done: true },
                    ],
                },
                {
                    name: 'Fase 2: Desain & Arsitektur',
                    description: 'Perancangan sistem dan infrastruktur oleh tim teknis.',
                    completed: ['IN_DEVELOPMENT', 'QA_IN_PROGRESS', 'CYBER_IN_PROGRESS', 'LIVE_PRODUCTION'].includes(p.status),
                    items: [],
                },
                {
                    name: 'Fase 3: Pengembangan & Testing',
                    description: 'Pembuatan kode program dan pengujian kualitas sistem.',
                    completed: ['LIVE_PRODUCTION'].includes(p.status),
                    isActive: ['IN_DEVELOPMENT', 'QA_IN_PROGRESS', 'CYBER_IN_PROGRESS'].includes(p.status),
                    items: [],
                },
            ],
        }));
    }, [projects]);

    const [selectedProject, setSelectedProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('Semua Status');

    const listProjects = mappedTrackingProjects;

    // Auto seleksi proyek berdasarkan query parameter / location state
    useEffect(() => {
        const targetId = location.state?.projectId || searchParams.get('projectId') || searchParams.get('id');
        if (targetId && listProjects.length > 0) {
            const found = listProjects.find(p =>
                String(p.rawId).toLowerCase() === String(targetId).toLowerCase() ||
                String(p.id).toLowerCase() === String(targetId).toLowerCase()
            );
            if (found) {
                setSelectedProject(found);
                return;
            }
        }
        if (!selectedProject && listProjects.length > 0) {
            setSelectedProject(listProjects[0]);
        }
    }, [location.state, searchParams, listProjects]);

    const activeSelected = selectedProject || listProjects[0] || null;

    // Helper untuk scroll paling atas panel detail & container main di MainLayout
    const scrollPageToTop = () => {
        if (detailPanelRef.current) {
            detailPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const mainContainer = detailPanelRef.current?.closest('main') || document.querySelector('main');
        if (mainContainer) {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Smooth auto-scroll ke atas detail panel & main layout saat proyek terpilih berubah
    useEffect(() => {
        if (activeSelected) {
            scrollPageToTop();
        }
    }, [activeSelected?.id]);

    // Filter projects
    const filteredProjects = useMemo(() => {
        let result = listProjects;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                String(p.id).toLowerCase().includes(term) ||
                String(p.name).toLowerCase().includes(term)
            );
        }

        if (filterStatus === 'Sedang Berjalan') {
            result = result.filter(p => p.status !== 'LIVE_PRODUCTION');
        } else if (filterStatus === 'Selesai') {
            result = result.filter(p => p.status === 'LIVE_PRODUCTION');
        }

        return result;
    }, [listProjects, searchTerm, filterStatus]);

    // Get status badge
    const getStatusBadge = (status) => {
        const colors = {
            'IN DEVELOPMENT': 'bg-blue-100 text-blue-700',
            'LIVE': 'bg-emerald-100 text-emerald-700',
            'RETURN TO DEV': 'bg-red-100 text-red-700',
            'PENDING': 'bg-gray-100 text-gray-700',
            'IN REVIEW': 'bg-amber-100 text-amber-700',
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    // Get status icon for timeline
    const getPhaseIcon = (phase) => {
        if (phase.completed) {
            return <CheckCircle size={18} className="text-emerald-500" />;
        }
        if (phase.isActive) {
            return <Code size={18} className="text-[#00529C]" />;
        }
        return <Rocket size={18} className="text-gray-400" />;
    };

    const getPhaseCircle = (phase) => {
        if (phase.completed) {
            return (
                <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center shadow-sm">
                    <Check size={20} className="text-emerald-600" />
                </div>
            );
        }
        if (phase.isActive) {
            return (
                <div className="w-10 h-10 rounded-full bg-[#00529C] border-4 border-blue-200 flex items-center justify-center shadow-md relative">
                    <div className="absolute inset-0 rounded-full border-2 border-[#00529C] animate-ping opacity-50"></div>
                    <Code size={20} className="text-white" />
                </div>
            );
        }
        return (
            <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                <Rocket size={20} className="text-gray-400" />
            </div>
        );
    };


    return (
        <div className="flex-1 flex flex-col h-screen bg-[#f8f9fb] overflow-hidden">{/* Split Panel Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel (List) */}
                <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-gray-200 flex flex-col shadow-[4px_0_12px_rgba(0,0,0,0.03)]">
                    {/* Search & Filters */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50 sticky top-0 z-20">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Pengajuan Anda</h2>
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari ID atau Nama Proyek..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all text-sm"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {statusOptions.map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setFilterStatus(opt)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === opt
                                            ? 'bg-blue-100 text-[#00529C]'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Project List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/30">
                        {filteredProjects.length > 0 ? (
                            filteredProjects.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProject(project)}
                                    className={`bg-white rounded-xl shadow-sm border relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow group ${activeSelected?.id === project.id
                                            ? 'border-[#00529C] ring-1 ring-[#00529C]'
                                            : 'border-gray-200'
                                        }`}
                                >
                                    {activeSelected?.id === project.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D4A017]"></div>
                                    )}
                                    <div className="p-4 pl-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-gray-500">{project.id}</span>
                                            </div>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(project.status)}`}>
                                                {project.status}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-[#00529C] transition-colors line-clamp-1">
                                            {project.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                                            {project.description}
                                        </p>
                                        <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-100 pt-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-blue-100 text-[#00529C] flex items-center justify-center font-bold text-[10px]">
                                                    {project.pmAvatar}
                                                </div>
                                                <span className="truncate max-w-[100px]">{typeof project.pm === 'object' ? (project.pm?.name || '—') : (project.pm || '—')}</span>
                                            </div>
                                            <span className="text-gray-400">{project.submittedDate}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-500 text-sm">
                                Tidak ada pengajuan yang sesuai
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel (Details) */}
                <div className="flex-1 flex flex-col bg-gray-50/30 overflow-hidden">
                    <div ref={detailPanelRef} className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 lg:p-10">
                        <div className="max-w-4xl mx-auto">
                            {/* Detail Header */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className="px-2.5 py-1 bg-gray-100 rounded-md text-xs font-semibold text-gray-600 border border-gray-200">
                                            {activeSelected?.id}
                                        </span>
                                        {activeSelected?.type && (
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${activeSelected.type === 'RBB' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                {activeSelected.type === 'RBB' ? '🔴 RBB (Wajib Selesai)' : '⚪ Non-RBB (Fleksibel)'}
                                            </span>
                                        )}
                                        <ProjectTypeBadge type={activeSelected?.project_type} />
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(activeSelected?.status)}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${activeSelected?.status === 'IN DEVELOPMENT' ? 'bg-blue-500 animate-pulse' : 'bg-current'
                                                }`}></span>
                                            {activeSelected?.status}
                                        </span>
                                    </div>
                                    <h1 className="text-2xl font-bold text-gray-800">{activeSelected?.name}</h1>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Deskripsi</p>
                                    <p className="text-sm text-gray-700">{activeSelected?.description}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Target Go-Live</p>
                                    <p className="font-semibold text-gray-800 flex items-center">
                                        <Rocket size={16} className="mr-1.5 text-gray-400" />
                                        {activeSelected?.targetDate}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Project Manager</p>
                                    <div className="flex items-center">
                                        <div className="w-6 h-6 rounded-full bg-[#00529C] text-white flex items-center justify-center text-[10px] font-bold mr-2">
                                            {activeSelected?.pmAvatar}
                                        </div>
                                        <p className="font-semibold text-gray-800">{typeof activeSelected?.pm === 'object' ? (activeSelected.pm?.name || '—') : (activeSelected?.pm || '—')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Alasan Penolakan (jika ditolak) */}
                            {activeSelected?.rejectionReason && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-6 animate-scale-up">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-extrabold text-red-800 text-sm mb-1">Proyek Ditolak — Perlu Perbaikan</h4>
                                            <p className="text-xs text-red-600 mb-2">Berikut adalah catatan dari tim Perencanaan/Analis terkait penolakan proyek Anda. Silakan lakukan perbaikan sesuai arahan dan ajukan kembali.</p>
                                            <div className="bg-white border border-red-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
                                                {activeSelected.rejectionReason}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            <div className="flex justify-end mb-6">
                                <button
                                    className="shrink-0 flex items-center px-4 py-2.5 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed opacity-60 transition-colors border border-gray-200 font-semibold text-sm"
                                    disabled
                                >
                                    <FileText size={18} className="mr-2" />
                                    Unduh Ringkasan PDF
                                </button>
                            </div>

                            {/* Timeline Section */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800 mb-8 flex items-center">
                                    <Route size={20} className="mr-2 text-[#00529C]" />
                                    Perjalanan Pengajuan
                                </h2>

                                <div className="relative px-2">
                                    {activeSelected?.phases?.map((phase, idx) => (
                                        <div
                                            key={idx}
                                            className="relative flex gap-6 pb-12 last:pb-0"
                                        >
                                            {/* Timeline line */}
                                            {idx < activeSelected.phases.length - 1 && (
                                                <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200 z-0"></div>
                                            )}

                                            {/* Icon */}
                                            <div className="relative flex flex-col items-center z-10">
                                                {getPhaseCircle(phase)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 pt-1">
                                                <h3 className={`font-semibold text-gray-800 mb-1 ${phase.isActive ? 'text-[#00529C]' : ''}`}>
                                                    {phase.name}
                                                </h3>
                                                <p className="text-sm text-gray-500 mb-4">{phase.description}</p>

                                                {/* Phase items */}
                                                {phase.items && phase.items.length > 0 && (
                                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                                                        {phase.items.map((item, i) => (
                                                            <div key={i} className="flex items-center gap-3">
                                                                <CheckCircle size={16} className="text-emerald-500" />
                                                                <span className="text-sm text-gray-700">
                                                                    {item.label}
                                                                    <span className="text-xs text-gray-400 ml-2">({item.date})</span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {/* Active note */}
                                                        {phase.isActive && phase.activeNote && (
                                                            <div className="flex items-start gap-3 p-3 bg-white rounded border border-blue-200 shadow-sm mt-2">
                                                                <Shield size={18} className="text-[#00529C] animate-pulse mt-0.5" />
                                                                <div>
                                                                    <span className="font-semibold text-sm text-gray-800 block mb-1">
                                                                        {phase.activeNote}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">{phase.activeNoteDetail}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}