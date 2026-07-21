import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
import { taskProjects } from '../../data/mockData';

export default function Tasks() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');

    const filteredProjects = taskProjects.filter((project) => {
        const matchSearch =
            project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter ? project.status === statusFilter : true;
        return matchSearch && matchStatus;
    });

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Sedang Berjalan': return <Clock size={14} className="text-emerald-600" />;
            case 'Kritis': return <AlertCircle size={14} className="text-red-600" />;
            case 'Selesai': return <CheckCircle size={14} className="text-blue-600" />;
            default: return <Briefcase size={14} className="text-gray-500" />;
        }
    };

    const getProgressColor = (pct) => {
        if (pct === 100) return 'bg-blue-500';
        if (pct >= 60) return 'bg-emerald-500';
        if (pct >= 30) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const handleSelectProject = (projectId) => {
        navigate(`/pm/tasks/${projectId}`);
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800">Manajemen Task</h2>
                <p className="text-gray-500 text-sm mt-1">Pilih proyek untuk mengelola task dan sub-task tim development.</p>
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
                        <option value="Sedang Berjalan">Sedang Berjalan</option>
                        <option value="Kritis">Kritis</option>
                        <option value="Selesai">Selesai</option>
                    </select>
                    <select
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] shadow-sm"
                    >
                        <option value="">Semua Departemen</option>
                        <option value="IT Core">IT Core</option>
                        <option value="Digital Banking">Digital Banking</option>
                        <option value="Infrastruktur">Infrastruktur</option>
                    </select>
                </div>
            </div>

            {/* Project Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((project, idx) => (
                    <div
                        key={project.id}
                        onClick={() => handleSelectProject(project.id)}
                        className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer flex flex-col group animate-slide-up-${Math.min(idx + 1, 4)}`}
                    >
                        {/* Card top */}
                        <div className="flex justify-between items-start mb-4">
                            <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${project.statusColor}`}>
                                {getStatusIcon(project.status)}
                                {project.status}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{project.id}</span>
                        </div>

                        <h3 className="text-base font-bold text-gray-800 mb-2 group-hover:text-[#1A56DB] transition-colors leading-snug">
                            {project.name}
                        </h3>

                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1A56DB] to-indigo-600 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                                {project.pm?.charAt(0) || 'P'}
                            </div>
                            <span className="text-sm text-gray-500">PM: {project.pm}</span>
                        </div>

                        <div className="mb-4">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${project.priorityColor}`}>
                                {project.priority}
                            </span>
                        </div>

                        {/* Progress section */}
                        <div className="mt-auto">
                            <div className="flex justify-between text-xs mb-2">
                                <span className="font-semibold text-gray-600 flex items-center gap-1">
                                    <TrendingUp size={12} /> Progress
                                </span>
                                <span className={`font-extrabold ${
                                    project.progress === 100 ? 'text-blue-600' :
                                    project.progress >= 60 ? 'text-emerald-600' :
                                    project.progress >= 30 ? 'text-amber-600' : 'text-red-600'
                                }`}>{project.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                                <div
                                    className={`h-2 rounded-full animate-progress ${getProgressColor(project.progress)}`}
                                    style={{ width: `${project.progress}%` }}
                                />
                            </div>

                            <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#1A56DB] to-indigo-600 text-white font-bold text-sm py-2.5 rounded-xl hover:shadow-md hover:shadow-[#1A56DB]/30 transition-all group-hover:gap-3 btn-shimmer">
                                Kelola Task <ArrowUpRight size={15} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredProjects.length === 0 && (
                <div className="text-center py-20 animate-scale-in">
                    <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <Briefcase size={36} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">Tidak ada proyek yang ditemukan.</p>
                    <p className="text-gray-400 text-sm mt-1">Coba ubah filter pencarian Anda.</p>
                </div>
            )}
        </div>
    );
}