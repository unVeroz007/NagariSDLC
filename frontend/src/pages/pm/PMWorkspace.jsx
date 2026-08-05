// src/pages/pm/PMWorkspace.jsx
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import RBBBadge from '../../components/RBBBadge';
import { getParallelTestingBadge } from '../../constants/projectStatus';


import {
    LayoutDashboard,
    Users,
    ClipboardList,
    Clock,
    Calendar,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    PlusCircle,
    Filter,
    Search,
    Bell,
    Settings,
    HelpCircle,
    User,
    Briefcase,
    Activity,
    Zap,
    TrendingUp,
    TrendingDown,
    MoreVertical,
    Eye,
    FileText,
    MessageSquare,
    Paperclip,
    ChevronRight,
    ChevronLeft,
    CalendarDays,
    Timer,
    Flame,
    Award,
    Target,
    BarChart,
    Send,
    Shield,
    FileCheck,
    Rocket,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PMWorkspace() {
    const { user } = useAuth();
    const { projects, isLoading, refreshData, updateProject } = useProjects();
    const { notifications, addNotification } = useNotifications();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'projects' | 'tasks'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedPMFilter, setSelectedPMFilter] = useState('ALL');



    // Auto-refresh data
    useEffect(() => {
        const interval = setInterval(refreshData, 60000); // setiap 1 menit
        return () => clearInterval(interval);
    }, [refreshData]);

    // 📋 Ekstraksi 4 PM resmi (Budi Santoso, Dewi Lestari, Andi Wijaya, Citra Kirana)
    const pmList = useMemo(() => {
        return ['Budi Santoso', 'Dewi Lestari', 'Andi Wijaya', 'Citra Kirana'];
    }, []);

    // 🔍 Filter proyek khusus per akun PM (Strict 4 PM Personalization)
    const myProjects = useMemo(() => {
        if (!projects || projects.length === 0) return [];

        // Jika akun yang login adalah PM (Project Manager), tampilkan HANYA proyek milik PM tersebut!
        if (user?.role === 'project_manager' || user?.role === 'pm') {
            const userName = (user?.name || '').toLowerCase();
            const userEmail = (user?.email || '').toLowerCase();

            return projects.filter(p => {
                const pmName = typeof p.pm === 'object' ? (p.pm?.name || '') : String(p.pm || '');
                const assignedPM = String(p.assignedPM || p.pmName || '');

                const matchesBudi = (userEmail.includes('pm1') || userName.includes('budi')) && (pmName.toLowerCase().includes('budi') || assignedPM.toLowerCase().includes('budi'));
                const matchesDewi = (userEmail.includes('pm2') || userName.includes('dewi')) && (pmName.toLowerCase().includes('dewi') || assignedPM.toLowerCase().includes('dewi'));
                const matchesAndi = (userEmail.includes('pm3') || userEmail === 'pm@nagari.co.id' || userName.includes('andi')) && (pmName.toLowerCase().includes('andi') || assignedPM.toLowerCase().includes('andi'));
                const matchesCitra = (userEmail.includes('pm4') || userName.includes('citra')) && (pmName.toLowerCase().includes('citra') || assignedPM.toLowerCase().includes('citra'));

                if (userEmail.includes('pm1') || userName.includes('budi')) return matchesBudi;
                if (userEmail.includes('pm2') || userName.includes('dewi')) return matchesDewi;
                if (userEmail.includes('pm3') || userEmail === 'pm@nagari.co.id' || userName.includes('andi')) return matchesAndi;
                if (userEmail.includes('pm4') || userName.includes('citra')) return matchesCitra;

                return (
                    (pmName && pmName.toLowerCase().includes(userName)) ||
                    (assignedPM && assignedPM.toLowerCase().includes(userName)) ||
                    p.pmId === user?.id
                );
            });
        }

        // Jika role Admin / Lead, filter berdasarkan pilihan dropdown PM jika dipilih
        if (selectedPMFilter && selectedPMFilter !== 'ALL') {
            const targetName = selectedPMFilter.toLowerCase();
            return projects.filter(p => {
                const pmName = typeof p.pm === 'object' ? (p.pm?.name || '') : String(p.pm || '');
                const assignedPM = String(p.assignedPM || p.pmName || '');
                return (
                    pmName.toLowerCase().includes(targetName) ||
                    assignedPM.toLowerCase().includes(targetName)
                );
            });
        }

        return projects;
    }, [projects, user, selectedPMFilter]);

    // 📊 Statistik
    const stats = useMemo(() => {
        const total = myProjects.length;
        const inProgress = myProjects.filter(p => p.status === 'IN_DEVELOPMENT' || p.status === 'DEV_ANALYSIS_DONE' || p.status === 'ANALYSIS_APPROVED').length;
        const inReview = myProjects.filter(p => p.status === 'READY_FOR_QA' || p.status === 'QA_IN_PROGRESS' || p.status === 'CYBER_IN_PROGRESS').length;
        const completed = myProjects.filter(p => p.status === 'LIVE_PRODUCTION' || p.status === 'UAT_PASSED' || p.status === 'CYBER_PASSED' || p.status === 'QA_PASSED').length;
        const onHold = myProjects.filter(p => p.status === 'ON_HOLD').length;
        const rbbCount = myProjects.filter(p => p.type === 'RBB').length;
        const nearDeadline = myProjects.filter(p => {
            if (p.type !== 'RBB' || !p.rbbDeadline) return false;
            const daysLeft = (new Date(p.rbbDeadline) - new Date()) / (1000 * 60 * 60 * 24);
            return daysLeft < 30 && daysLeft > 0;
        }).length;

        return { total, inProgress, inReview, completed, onHold, rbbCount, nearDeadline };
    }, [myProjects]);

    // 📋 Task aggregator dari semua proyek
    const allTasks = useMemo(() => {
        const tasks = [];
        myProjects.forEach(project => {
            if (project.tasks && project.tasks.length > 0) {
                project.tasks.forEach(task => {
                    tasks.push({
                        ...task,
                        projectName: project.name,
                        projectId: project.id,
                        projectStatus: project.status,
                    });
                });
            }
        });
        return tasks;
    }, [myProjects]);

    // ⏳ Task statistik
    const taskStats = useMemo(() => {
        const total = allTasks.length;
        const done = allTasks.filter(t => {
            const st = String(t.status || '').toLowerCase();
            return st === 'done' || st === 'selesai' || t.done === true;
        }).length;
        const inProgress = allTasks.filter(t => {
            const st = String(t.status || '').toLowerCase();
            return st === 'in progress' || st === 'in_progress' || st === 'to do' || st === 'todo' || st === 'belum mulai';
        }).length;
        const overdue = allTasks.filter(t => {
            if (!t.deadline) return false;
            const st = String(t.status || '').toLowerCase();
            return new Date(t.deadline) < new Date() && st !== 'done' && st !== 'selesai';
        }).length;
        return { total, done, inProgress, overdue };
    }, [allTasks]);

    // 🕐 Aktivitas terkini (dari notifikasi + event)
    const recentActivities = useMemo(() => {
        const activityList = notifications.slice(0, 8).map(n => ({
            id: n.id,
            type: n.type || 'info',
            title: n.title || 'Aktivitas',
            message: n.message || '',
            time: n.createdAt || new Date().toISOString(),
            project: n.project || 'Sistem',
        }));
        return activityList;
    }, [notifications]);

    // 📋 Filter proyek berdasarkan search
    const filteredProjects = useMemo(() => {
        if (!searchTerm) return myProjects;
        const term = searchTerm.toLowerCase();
        return myProjects.filter(p =>
            p.name?.toLowerCase().includes(term) ||
            p.id?.toLowerCase().includes(term) ||
            p.status?.toLowerCase().includes(term)
        );
    }, [myProjects, searchTerm]);

    // 🎯 Ambil proyek untuk ditampilkan di detail
    useEffect(() => {
        if (myProjects.length > 0 && !selectedProject) {
            setSelectedProject(myProjects[0]);
        }
    }, [myProjects, selectedProject]);

    // 📊 Progress proyek (untuk ditampilkan di card & tabel)
    const getProjectProgress = (project) => {
        if (!project || !Array.isArray(project.tasks) || project.tasks.length === 0) {
            if (project?.status === 'LIVE_PRODUCTION' || project?.status === 'UAT_PASSED') return 100;
            return 0;
        }
        const doneCount = project.tasks.filter(t => {
            const st = String(t.status || '').toLowerCase();
            return st === 'selesai' || st === 'done' || t.done === true;
        }).length;
        return Math.round((doneCount / project.tasks.length) * 100);
    };

    // 🎨 Warna status
    const getStatusColor = (status) => {
        const colors = {
            'PENDING': 'bg-gray-100 text-gray-700 border-gray-200',
            'IN_REVIEW': 'bg-blue-100 text-blue-700 border-blue-200',
            'ANALYSIS_APPROVED': 'bg-cyan-100 text-cyan-700 border-cyan-200',
            'IN_DEVELOPMENT': 'bg-indigo-100 text-indigo-700 border-indigo-200',
            'READY_FOR_QA': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'QA_IN_PROGRESS': 'bg-orange-100 text-orange-700 border-orange-200',
            'RETURN_TO_DEV': 'bg-red-100 text-red-700 border-red-200',
            'QA_PASSED': 'bg-teal-100 text-teal-700 border-teal-200',
            'CYBER_IN_PROGRESS': 'bg-purple-100 text-purple-700 border-purple-200',
            'CYBER_PASSED': 'bg-violet-100 text-violet-700 border-violet-200',
            'READY_FOR_UAT': 'bg-lime-100 text-lime-700 border-lime-200',
            'UAT_PASSED': 'bg-green-100 text-green-700 border-green-200',
            'PENDING_GOLIVE': 'bg-amber-100 text-amber-700 border-amber-200',
            'LIVE_PRODUCTION': 'bg-emerald-100 text-emerald-700 border-emerald-200',
            'REJECTED': 'bg-red-200 text-red-800 border-red-200',
            'ON_HOLD': 'bg-slate-100 text-slate-600 border-slate-200',
            'CANCELLED': 'bg-gray-200 text-gray-500 border-gray-200',
        };
        return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const getStatusLabel = (status) => {
        const labels = {
            'PENDING': 'Menunggu',
            'IN_REVIEW': 'Review',
            'ANALYSIS_APPROVED': 'Siap Dev',
            'IN_DEVELOPMENT': 'Development',
            'READY_FOR_QA': 'Siap QA',
            'QA_IN_PROGRESS': 'QA Progress',
            'RETURN_TO_DEV': 'Rework',
            'QA_PASSED': 'QA Lulus',
            'CYBER_IN_PROGRESS': 'Cyber Progress',
            'CYBER_PASSED': 'Cyber Lulus',
            'READY_FOR_UAT': 'Siap UAT',
            'UAT_PASSED': 'UAT Lulus',
            'PENDING_GOLIVE': 'Menunggu Go-Live',
            'LIVE_PRODUCTION': 'Live',
            'REJECTED': 'Ditolak',
            'ON_HOLD': 'Ditahan',
            'CANCELLED': 'Dibatalkan',
        };
        return labels[status] || status;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const getTimeAgo = (timestamp) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return 'Baru saja';
        if (diffMin < 60) return `${diffMin}m`;
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j`;
        if (diffMin < 10080) return `${Math.floor(diffMin / 1440)}h`;
        return formatDate(timestamp);
    };

    if (isLoading) {
        return <LoadingSpinner text="Memuat workspace PM..." />;
    }

    return (
        <div className="p-6 md:p-8 bg-[#f8f9fb] min-h-full">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Greeting */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Briefcase size={24} className="text-[#1A56DB]" />
                            PM Workspace
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Selamat datang, {user?.name}! Kelola semua proyek dan alur tugas yang Anda awasi.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {(user?.role === 'super_admin' || user?.role === 'head_of_it' || user?.role === 'development_lead') && pmList.length > 0 && (
                            <div className="flex items-center gap-2 bg-white border border-gray-300 px-3 py-2 rounded-xl shadow-2xs">
                                <Users size={16} className="text-[#1A56DB]" />
                                <span className="text-xs font-bold text-gray-600">Filter Akun PM:</span>
                                <select
                                    value={selectedPMFilter}
                                    onChange={(e) => setSelectedPMFilter(e.target.value)}
                                    className="text-xs font-extrabold text-gray-800 bg-transparent outline-none cursor-pointer"
                                >
                                    <option value="ALL">Semua Proyek PM (Global)</option>
                                    {pmList.map((pmName, idx) => (
                                        <option key={idx} value={pmName}>
                                            {pmName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button
                            onClick={() => navigate('/pm/kanban')}
                            className="flex items-center gap-2 px-4 py-2 bg-[#003a73] text-white text-xs font-bold rounded-xl hover:bg-[#002a5a] transition-colors shadow-sm cursor-pointer"
                        >
                            <LayoutDashboard size={16} />
                            Buka Kanban Board
                        </button>
                    </div>
                </div>

                {/* Quick SDLC Action Bar */}
                <div className="bg-gradient-to-r from-[#003a73] to-[#1A56DB] p-4 rounded-2xl text-white shadow-md space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
                            <Zap size={15} className="text-amber-400" />
                            Navigasi Cepat Tahapan SDLC (Project Manager)
                        </h3>
                        <span className="text-[11px] bg-white/20 text-white px-2.5 py-0.5 rounded-full font-semibold">
                            {myProjects.length} Proyek SDLC
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                        <button
                            onClick={() => navigate('/pm/allocation')}
                            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-white/15 text-left transition-all group cursor-pointer active:scale-95"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-amber-300">
                                <Users size={14} />
                                <span>1. Alokasi Tim</span>
                            </div>
                            <p className="text-[10px] text-blue-200 mt-0.5">Tunjuk Dev &amp; QA</p>
                        </button>
                        <button
                            onClick={() => navigate('/pm/kanban')}
                            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-white/15 text-left transition-all group cursor-pointer active:scale-95"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-amber-300">
                                <LayoutDashboard size={14} />
                                <span>2. Kanban Board</span>
                            </div>
                            <p className="text-[10px] text-blue-200 mt-0.5">Sprint &amp; Task Dev</p>
                        </button>
                        <button
                            onClick={() => navigate('/pm/qa-request')}
                            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-white/15 text-left transition-all group cursor-pointer active:scale-95"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-amber-300">
                                <Send size={14} />
                                <span>3. Pengajuan QA</span>
                            </div>
                            <p className="text-[10px] text-blue-200 mt-0.5">Uji Perangkat Lunak</p>
                        </button>
                        <button
                            onClick={() => navigate('/pm/cyber-request')}
                            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-white/15 text-left transition-all group cursor-pointer active:scale-95"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-amber-300">
                                <Shield size={14} />
                                <span>4. Audit Siber</span>
                            </div>
                            <p className="text-[10px] text-blue-200 mt-0.5">Pentest Keamanan</p>
                        </button>
                        <button
                            onClick={() => navigate('/pm/review-docs')}
                            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-white/15 text-left transition-all group cursor-pointer active:scale-95"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-amber-300">
                                <FileCheck size={14} />
                                <span>5. Terima Hasil QA</span>
                            </div>
                            <p className="text-[10px] text-blue-200 mt-0.5">Review Sign-Off</p>
                        </button>
                        <button
                            onClick={() => navigate('/pm/release-request')}
                            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-white/15 text-left transition-all group cursor-pointer active:scale-95"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-amber-300">
                                <Rocket size={14} />
                                <span>6. Rilis INFRA</span>
                            </div>
                            <p className="text-[10px] text-blue-200 mt-0.5">Deploy Production</p>
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500">Total Proyek</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500">Development</p>
                        <p className="text-2xl font-bold text-indigo-600">{stats.inProgress}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500">Pengujian</p>
                        <p className="text-2xl font-bold text-orange-500">{stats.inReview}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500">Selesai</p>
                        <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500">RBB Aktif</p>
                        <p className="text-2xl font-bold text-red-600">{stats.rbbCount}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm relative">
                        <p className="text-xs text-gray-500">Deadline Mendekat</p>
                        <p className="text-2xl font-bold text-amber-600">{stats.nearDeadline}</p>
                        {stats.nearDeadline > 0 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'overview'
                            ? 'border-[#1A56DB] text-[#1A56DB]'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Activity size={16} />
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'projects'
                            ? 'border-[#1A56DB] text-[#1A56DB]'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Briefcase size={16} />
                        Proyek Saya
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                            {myProjects.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'tasks'
                            ? 'border-[#1A56DB] text-[#1A56DB]'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <ClipboardList size={16} />
                        Tasks
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                            {allTasks.length}
                        </span>
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Task Progress Ring */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <Target size={18} className="text-[#1A56DB]" />
                                Task Progress Overview
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-3xl font-bold text-gray-800">{taskStats.total}</div>
                                    <p className="text-xs text-gray-500">Total Task</p>
                                </div>
                                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                                    <div className="text-3xl font-bold text-emerald-600">{taskStats.done}</div>
                                    <p className="text-xs text-gray-500">Selesai</p>
                                </div>
                                <div className="text-center p-4 bg-blue-50 rounded-lg">
                                    <div className="text-3xl font-bold text-blue-600">{taskStats.inProgress}</div>
                                    <p className="text-xs text-gray-500">Dalam Pengerjaan</p>
                                </div>
                                <div className="text-center p-4 bg-red-50 rounded-lg">
                                    <div className="text-3xl font-bold text-red-600">{taskStats.overdue}</div>
                                    <p className="text-xs text-gray-500">Overdue</p>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activities */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <Activity size={18} className="text-[#1A56DB]" />
                                Aktivitas Terkini
                            </h3>
                            {recentActivities.length > 0 ? (
                                <div className="space-y-3">
                                    {recentActivities.map((act, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                            <div className={`w-2 h-2 rounded-full mt-2 ${act.type === 'success' ? 'bg-emerald-500' :
                                                act.type === 'warning' ? 'bg-amber-500' :
                                                    act.type === 'danger' ? 'bg-red-500' :
                                                        'bg-blue-500'
                                                }`} />
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-700">
                                                    <span className="font-semibold">{act.title}</span>
                                                    <span className="text-gray-500"> — {act.message}</span>
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {getTimeAgo(act.time)} • {act.project}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">Belum ada aktivitas terkini.</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'projects' && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 text-sm">Daftar Proyek</h3>
                            <div className="relative w-full sm:w-64">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Cari nama, ID, atau status..."
                                    className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A56DB] outline-none bg-white w-full shadow-xs"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                                        <th className="px-6 py-4">Proyek</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Progress</th>
                                        <th className="px-6 py-4">Tipe</th>
                                        <th className="px-6 py-4">Deadline</th>
                                        <th className="px-6 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-sm">
                                    {filteredProjects.map((project) => {
                                        const progress = getProjectProgress(project);
                                        return (
                                            <tr key={project.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4 cursor-pointer group-hover:bg-blue-50/40" onClick={() => navigate(`/pm/tasks/${project.id}`)}>
                                                    <div>
                                                        <span className="font-semibold text-gray-800 group-hover:text-[#1A56DB] transition-colors">{project.name}</span>
                                                        <p className="text-xs text-gray-400">{project.id}</p>
                                                    </div>
                                                </td>
                                                 <td className="px-6 py-4">
                                                     {(() => {
                                                         const badge = getParallelTestingBadge(project);
                                                         return (
                                                             <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.colorClass}`}>
                                                                 {badge.label}
                                                             </span>
                                                         );
                                                     })()}
                                                 </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                            <div className="bg-[#1A56DB] h-full rounded-full" style={{ width: `${progress}%` }} />
                                                        </div>
                                                        <span className="text-xs font-medium text-gray-600">{progress}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <RBBBadge type={project.type} deadline={project.rbbDeadline} />
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 text-xs">
                                                    {project.rbbDeadline ? formatDate(project.rbbDeadline) : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => navigate(`/pm/tasks/${project.id}`)}
                                                            className="text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                                            title="Lihat Detail Proyek & Manajemen Task"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {filteredProjects.length === 0 && (
                            <div className="p-8 text-center text-gray-400">Tidak ada proyek yang sesuai dengan filter.</div>
                        )}
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                                        <th className="px-6 py-4">Task</th>
                                        <th className="px-6 py-4">Proyek</th>
                                        <th className="px-6 py-4">Assignee</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Priority</th>
                                        <th className="px-6 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-sm">
                                    {allTasks.map((task, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-4 cursor-pointer group-hover:bg-blue-50/40" onClick={() => navigate(`/pm/tasks/${task.projectId}`)}>
                                                <span className="font-semibold text-gray-800 group-hover:text-[#1A56DB] transition-colors">{task.name || task.title || 'Task'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 font-medium cursor-pointer hover:text-[#1A56DB]" onClick={() => navigate(`/pm/tasks/${task.projectId}`)}>
                                                {task.projectName || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-gray-600">{task.assignee || 'Belum Dialokasi'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${String(task.status || '').toLowerCase() === 'done' || String(task.status || '').toLowerCase() === 'selesai' || task.done === true
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {String(task.status || '').toLowerCase() === 'done' || String(task.status || '').toLowerCase() === 'selesai' || task.done === true ? 'Selesai' : (task.status || 'Dalam Pengerjaan')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${task.priority === 'High' ? 'bg-red-100 text-red-600' :
                                                    task.priority === 'Medium' ? 'bg-amber-100 text-amber-600' :
                                                        'bg-blue-100 text-blue-600'
                                                    }`}>
                                                    {task.priority || 'Medium'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => navigate(`/pm/tasks/${task.projectId}`)}
                                                    className="text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                                    title="Lihat Detail Proyek & Progress SDLC"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {allTasks.length === 0 && (
                            <div className="p-8 text-center text-gray-400">Belum ada task di proyek Anda.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}