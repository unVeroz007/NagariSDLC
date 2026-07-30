import { useState, useEffect, useMemo } from 'react';
import RBBBadge from '../../components/RBBBadge';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { taskService } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Plus,
    Search,
    Bell,
    Settings,
    MoreHorizontal,
    Clock,
    Paperclip,
    MessageSquare,
    AlertTriangle,
    Lock,
    Inbox,
    ChevronRight,
    User,
    Check,
    X,
    Eye,
    Edit,
    Trash2,
    Tag,
    Users,
    Calendar,
    List,
    Kanban as KanbanIcon,
    ArrowRight,
    Briefcase,
    Layers,
    Filter,
} from 'lucide-react';

const MODE = import.meta.env.VITE_API_MODE || 'mock';

const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getStatusBadgeStyle = (status) => {
    switch (status) {
        case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'IN_REVIEW': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'ANALYSIS_APPROVED': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        case 'DEV_ANALYSIS': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'DEV_ANALYSIS_DONE': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'READY_FOR_DEVELOPMENT': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
        case 'IN_DEVELOPMENT': return 'bg-blue-100 text-blue-800 border-blue-200 font-bold';
        case 'RETURN_TO_DEV': return 'bg-red-100 text-red-800 border-red-200 font-bold animate-pulse';
        case 'READY_FOR_QA': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'QA_IN_PROGRESS': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'QA_PASSED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'CYBER_IN_PROGRESS': return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'CYBER_PASSED': return 'bg-teal-100 text-teal-800 border-teal-200';
        case 'PENDING_GOLIVE': return 'bg-orange-100 text-orange-800 border-orange-200 font-bold';
        case 'LIVE_PRODUCTION': return 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
};

export default function Kanban() {
    const { user } = useAuth();
    const { projects } = useProjects();
    const navigate = useNavigate();

    const [viewMode, setViewMode] = useState('project'); // 'project' | 'task'
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [divisionFilter, setDivisionFilter] = useState('All');
    const [tasks, setTasks] = useState([]);

    // SDLC Project Columns
    const sdlcColumns = [
        {
            id: 'phase1',
            title: 'Fase 1: Inisiasi & Review',
            color: 'border-blue-500 bg-blue-50/30',
            statuses: ['PENDING', 'IN_REVIEW', 'ANALYSIS_APPROVED'],
        },
        {
            id: 'phase2',
            title: 'Fase 2: Analisis & Desain',
            color: 'border-indigo-500 bg-indigo-50/30',
            statuses: ['DEV_ANALYSIS', 'DEV_ANALYSIS_DONE', 'READY_FOR_DEVELOPMENT'],
        },
        {
            id: 'phase3',
            title: 'Fase 3: Pengembangan IT',
            color: 'border-amber-500 bg-amber-50/30',
            statuses: ['IN_DEVELOPMENT', 'RETURN_TO_DEV'],
        },
        {
            id: 'phase4',
            title: 'Fase 4: Pengujian QA & Cyber',
            color: 'border-purple-500 bg-purple-50/30',
            statuses: ['READY_FOR_QA', 'QA_IN_PROGRESS', 'QA_PASSED', 'CYBER_IN_PROGRESS', 'CYBER_PASSED'],
        },
        {
            id: 'phase5',
            title: 'Fase 5: Rilis & Quality Gate',
            color: 'border-emerald-500 bg-emerald-50/30',
            statuses: ['READY_FOR_UAT', 'UAT_PASSED', 'PENDING_GOLIVE', 'LIVE_PRODUCTION'],
        },
    ];

    // Filter projects for Project SDLC view
    const filteredProjects = useMemo(() => {
        let result = [...(projects || [])];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                String(p.reqId || p.req_id || p.id || '').toLowerCase().includes(term) ||
                String(p.name || p.title || '').toLowerCase().includes(term)
            );
        }
        if (divisionFilter !== 'All') {
            result = result.filter(p => {
                const divStr = typeof p.division === 'object' ? p.division?.name : p.division;
                return divStr === divisionFilter;
            });
        }
        return result;
    }, [projects, searchTerm, divisionFilter]);

    // Fetch tasks if in task view
    useEffect(() => {
        if (viewMode === 'task' && selectedProjectId) {
            const fetchTasks = async () => {
                try {
                    const res = await taskService.getByProject(selectedProjectId);
                    const taskList = res?.data ?? [];
                    setTasks(taskList.map(t => ({
                        id: t.id,
                        stage: t.status || 'todo',
                        code: `TSK-${t.id}`,
                        title: t.title,
                        description: t.description,
                        assignee: t.assignee?.name || 'Belum Dialokasi',
                        assigneeAvatar: getInitials(t.assignee?.name),
                        deadline: t.due_date || 'TBD',
                    })));
                } catch {
                    setTasks([]);
                }
            };
            fetchTasks();
        }
    }, [viewMode, selectedProjectId]);

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-800">Kanban Board Status SDLC Proyek</h2>
                    <p className="text-gray-500 text-sm mt-1">Visualisasi posisi seluruh proyek di setiap fase &amp; langkah SDLC Bank Nagari.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Filter Input Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari ID / Nama Proyek..."
                            className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] shadow-xs w-64"
                        />
                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* SDLC PROJECT KANBAN BOARD (ALL PROJECTS PER PHASE)       */}
            {/* ======================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
                {sdlcColumns.map(col => {
                    const colProjects = filteredProjects.filter(p => col.statuses.includes(p.status));

                    return (
                        <div
                            key={col.id}
                            className={`bg-white p-4 rounded-2xl border-t-4 ${col.color} border-x border-b border-gray-200/70 shadow-sm min-h-[550px] flex flex-col`}
                        >
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                <h3 className="font-bold text-gray-800 text-xs leading-tight">{col.title}</h3>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-extrabold rounded-full text-xs">
                                    {colProjects.length}
                                </span>
                            </div>

                            <div className="flex-1 space-y-3">
                                {colProjects.length === 0 ? (
                                    <div className="h-36 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-xs font-medium text-center p-3">
                                        Tidak ada proyek di fase ini
                                    </div>
                                ) : (
                                    colProjects.map(p => (
                                        <div
                                            key={p.id}
                                            className="p-3.5 bg-white hover:bg-blue-50/40 rounded-xl border border-gray-200 shadow-xs hover:shadow-md transition-all group"
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[11px] font-mono font-bold text-[#1A56DB]">
                                                    {p.reqId || p.req_id || `REQ-${p.id}`}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 font-bold rounded-md border ${getStatusBadgeStyle(p.status)}`}>
                                                    {p.status}
                                                </span>
                                            </div>

                                            <h4 className="font-bold text-gray-800 text-xs mb-2 line-clamp-2 group-hover:text-[#1A56DB] transition-colors">
                                                {p.name || p.title}
                                            </h4>

                                            <div className="text-[11px] text-gray-500 space-y-1 mb-3 pt-2 border-t border-gray-100">
                                                <div className="flex items-center justify-between">
                                                    <span>Divisi:</span>
                                                    <span className="font-medium text-gray-700">{p.division}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>PM:</span>
                                                    <span className="font-semibold text-gray-800">{typeof p.pm === 'object' ? p.pm?.name : p.pm}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => navigate(`/pm/tasks/${p.id}`)}
                                                className="w-full py-2 bg-[#1A56DB] text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <List size={13} />
                                                <span>Detail Task &amp; Pekerjaan Dev</span>
                                                <ArrowRight size={13} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}