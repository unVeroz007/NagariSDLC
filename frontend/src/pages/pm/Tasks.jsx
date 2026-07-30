import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import {
    Search,
    User,
    Filter,
    Clock,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    ArrowUpRight,
    Briefcase,
    TrendingUp,
} from 'lucide-react';

export default function Tasks() {
    const { user } = useAuth();
    const { projects } = useProjects();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const mappedProjects = useMemo(() => {
        return (projects || []).map(p => ({
            id: p.reqId || p.req_id || `REQ-${p.id}`,
            realId: p.id,
            name: p.name || p.title || 'Proyek Tanpa Judul',
            pm: typeof p.pm === 'object' ? (p.pm?.name || 'Belum Dialokasi') : (p.pm || 'Belum Dialokasi'),
            status: p.status || 'PENDING',
            progress: p.status === 'LIVE_PRODUCTION' ? 100 : (p.status === 'IN_DEVELOPMENT' ? 50 : 25),
        }));
    }, [projects]);

    const filteredProjects = useMemo(() => {
        return mappedProjects.filter((project) => {
            const matchSearch =
                project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(project.id).toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = statusFilter ? project.status === statusFilter : true;
            return matchSearch && matchStatus;
        });
    }, [mappedProjects, searchTerm, statusFilter]);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'IN_DEVELOPMENT': return <Clock size={14} className="text-emerald-600" />;
            case 'REJECTED': return <AlertCircle size={14} className="text-red-600" />;
            case 'LIVE_PRODUCTION': return <CheckCircle size={14} className="text-blue-600" />;
            default: return <Briefcase size={14} className="text-gray-500" />;
        }
    };

    const getProgressColor = (pct) => {
        if (pct === 100) return 'bg-blue-500';
        if (pct >= 50) return 'bg-emerald-500';
        return 'bg-amber-500';
    };

    const handleSelectProject = (projectId) => {
        navigate(`/pm/tasks/${projectId}`);
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800">Manajemen Task</h2>
                <p className="text-gray-500 text-sm mt-1">Pilih proyek dari database backend untuk mengelola task dan sub-task tim development.</p>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Cari ID atau Nama Proyek..."
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] text-sm shadow-sm transition-all"
                    />
                </div>
                <div className="flex gap-2.5 w-full md:w-auto">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] shadow-sm"
                    >
                        <option value="">Semua Status</option>
                        <option value="PENDING">Menunggu Review</option>
                        <option value="IN_DEVELOPMENT">Sedang Dikembangkan</option>
                        <option value="LIVE_PRODUCTION">Live Production</option>
                    </select>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {filteredProjects.length === 0 ? (
                    <div className="col-span-3 bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400 font-medium">
                        Tidak ada proyek ditemukan di database.
                    </div>
                ) : (
                    filteredProjects.map((project) => (
                        <div key={project.realId} className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-mono font-bold">
                                        {project.id}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                                        {getStatusIcon(project.status)}
                                        {project.status}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-800 text-base mb-2 line-clamp-1">{project.name}</h3>
                                <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-4">
                                    <User size={13} className="text-gray-400" /> PM: <span className="font-semibold text-gray-700">{project.pm}</span>
                                </p>
                            </div>

                            <div>
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                                        <span>Progress Proyek</span>
                                        <span>{project.progress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${getProgressColor(project.progress)} rounded-full transition-all duration-500`} style={{ width: `${project.progress}%` }}></div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSelectProject(project.realId)}
                                    className="w-full py-2.5 px-4 bg-[#1A56DB] hover:bg-[#1546b8] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer active:scale-95"
                                >
                                    <span>Kelola Task &amp; Pekerjaan Dev</span>
                                    <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}