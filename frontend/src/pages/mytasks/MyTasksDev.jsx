import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import RBBBadge from '../../components/RBBBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import ChatBox from '../../components/ChatBox';
import {
    Code,
    CheckCircle2,
    Clock,
    AlertCircle,
    Search,
    Calendar,
    Kanban,
    Layers,
    MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_DEV_TASKS = [
    {
        id: 'TSK-101',
        title: 'Integrasi ISO8583 Message Parser & Payment Gateway Middleware',
        projectId: 'PRJ-2026-001',
        projectName: 'Sistem QRIS Dinamis Bank Nagari',
        assignee: 'Dimas Anggara (Developer)',
        assigneeEmail: 'developer@nagari.co.id',
        priority: 'High',
        deadline: '2026-08-15',
        status: 'In Progress'
    },
    {
        id: 'TSK-102',
        title: 'Pengembangan Rest API Endpoint Transaction History & Filter',
        projectId: 'PRJ-2026-002',
        projectName: 'Portal Digital Core Banking Retail',
        assignee: 'Dimas Anggara (Developer)',
        assigneeEmail: 'developer@nagari.co.id',
        priority: 'Medium',
        deadline: '2026-08-20',
        status: 'To Do'
    },
    {
        id: 'TSK-103',
        title: 'Pengujian Unit Test Middleware Security & JWT Authentication',
        projectId: 'PRJ-2026-003',
        projectName: 'Nagari Mobile Banking Revamp',
        assignee: 'Dimas Anggara (Developer)',
        assigneeEmail: 'developer@nagari.co.id',
        priority: 'High',
        deadline: '2026-08-25',
        status: 'Code Review'
    }
];

export default function MyTasksDev() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { projects, updateProject, isLoading } = useProjects();
    const { addNotification } = useNotifications();

    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTask, setSelectedTask] = useState(null);
    const [devTasks, setDevTasks] = useState(() => {
        const saved = localStorage.getItem('nagari_sdlc_dev_tasks');
        if (saved) {
            try { return JSON.parse(saved); } catch { }
        }
        return DEFAULT_DEV_TASKS;
    });

    const saveDevTasks = (updated) => {
        setDevTasks(updated);
        localStorage.setItem('nagari_sdlc_dev_tasks', JSON.stringify(updated));
    };

    // Extract tasks assigned to developer from projects in ProjectContext + local devTasks
    const allCombinedTasks = useMemo(() => {
        const list = [...devTasks];
        (projects || []).forEach(p => {
            if (Array.isArray(p.tasks)) {
                p.tasks.forEach(t => {
                    const exists = list.some(item => String(item.id) === String(t.id));
                    if (!exists) {
                        list.push({
                            id: t.id || `TSK-${Math.floor(100 + Math.random() * 900)}`,
                            title: t.title || t.name || 'Task Pengembangan',
                            projectId: p.id,
                            projectName: p.name,
                            assignee: t.assignee || 'Dimas Anggara',
                            assigneeEmail: t.assigneeEmail || 'developer@nagari.co.id',
                            priority: t.priority || 'Medium',
                            deadline: t.deadline || p.targetDate || '2026-08-30',
                            status: t.status || 'In Progress'
                        });
                    }
                });
            }
        });
        return list;
    }, [projects, devTasks]);

    // Filter tasks untuk developer yang sedang login
    const filteredTasks = useMemo(() => {
        let list = allCombinedTasks;
        const isPrivileged = user?.role && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);
        
        if (!isPrivileged && user?.id) {
            list = list.filter(task => {
                const project = projects?.find(p => String(p.id) === String(task.projectId));
                if (!project || !project.team) return false;
                return project.team.some(t => (typeof t === 'object' ? t.id : t) === user.id);
            });
        }

        return list.filter(task => {
            const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
            const matchesSearch =
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.id.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesStatus && matchesSearch;
        });
    }, [allCombinedTasks, user, projects, statusFilter, searchTerm]);

    const handleUpdateStatus = (taskId, newStatus) => {
        const updated = devTasks.map(t =>
            t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t
        );
        saveDevTasks(updated);

        toast.success(`Status task ${taskId} diperbarui menjadi: ${newStatus}`);
        addNotification(
            'Perubahan Status Task Developer',
            `Task ${taskId} diperbarui oleh ${user?.name || 'Developer'} menjadi status: ${newStatus}`,
            'info',
            '/pm/kanban'
        );
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'To Do':
                return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'In Progress':
                return 'bg-blue-100 text-blue-800 border-blue-200 font-bold';
            case 'Code Review':
                return 'bg-purple-100 text-purple-800 border-purple-200 font-bold';
            case 'Done':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'High':
                return 'bg-red-50 text-red-600 border-red-200 font-semibold';
            case 'Medium':
                return 'bg-amber-50 text-amber-600 border-amber-200 font-semibold';
            case 'Low':
                return 'bg-green-50 text-green-600 border-green-200 font-semibold';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    if (isLoading) {
        return <LoadingSpinner text="Memuat Tugas Developer Saya..." />;
    }

    return (
        <div className="flex-1 overflow-y-auto bg-[#f8f9fb] p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-extrabold text-gray-800">Tugas Developer Saya</h1>
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Code size={14} /> IT Programmer
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Kelola dan update status tugas pengembangan perangkat lunak yang ditugaskan kepada Anda.
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/pm/kanban')}
                        className="inline-flex items-center justify-center px-4 py-2.5 bg-[#1a365d] hover:bg-[#0f2342] text-white font-bold rounded-xl text-xs transition-all shadow-sm gap-2 shrink-0"
                    >
                        <Kanban size={16} />
                        Buka Kanban Board
                    </button>
                </div>

                {/* Filter Bar */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Search */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari tugas atau proyek..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-600 focus:bg-white transition-all"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                        {['ALL', 'To Do', 'In Progress', 'Code Review', 'Done'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                    statusFilter === st
                                        ? 'bg-[#1a365d] text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {st === 'ALL' ? 'Semua Status' : st}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Task Table Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <Layers size={16} className="text-blue-600" />
                            Daftar Tugas ({filteredTasks.length})
                        </h3>
                        <span className="text-xs text-gray-500 font-medium">
                            Pengguna: <strong>{user?.name || 'Developer'}</strong>
                        </span>
                    </div>

                    {filteredTasks.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Code size={48} className="mx-auto mb-3 opacity-40 text-blue-600" />
                            <h4 className="font-bold text-gray-700 text-base">Tidak Ada Tugas Ditemukan</h4>
                            <p className="text-xs text-gray-500 mt-1">Tidak ada tugas yang sesuai dengan filter saat ini.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-bold uppercase">
                                        <th className="p-4">Kode &amp; Judul Task</th>
                                        <th className="p-4">Proyek</th>
                                        <th className="p-4">Priority</th>
                                        <th className="p-4">Deadline</th>
                                        <th className="p-4">Status Saat Ini</th>
                                        <th className="p-4 text-center">Update Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                     {filteredTasks.map((task) => (
                                        <tr
                                            key={task.id}
                                            onClick={() => setSelectedTask(task)}
                                            className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${
                                                selectedTask?.id === task.id ? 'bg-blue-50/40 font-bold border-l-4 border-l-[#1a365d]' : ''
                                            }`}
                                        >
                                            <td className="p-4 font-semibold text-gray-800 max-w-xs">
                                                <span className="font-mono text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold mr-2">
                                                    {task.id}
                                                </span>
                                                <div className="mt-1 font-bold text-gray-900 line-clamp-2">{task.title}</div>
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                <div className="font-semibold text-gray-800 line-clamp-1">{task.projectName}</div>
                                                <span className="text-[10px] text-gray-400">{task.projectId}</span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[11px] border ${getPriorityBadge(task.priority)}`}>
                                                    {task.priority}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={13} className="text-gray-400" />
                                                    <span>{task.deadline}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs border ${getStatusBadge(task.status)}`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <select
                                                    value={task.status}
                                                    onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                                                    className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 bg-white cursor-pointer hover:border-gray-300 transition-all"
                                                >
                                                    <option value="To Do">To Do</option>
                                                    <option value="In Progress">In Progress</option>
                                                    <option value="Code Review">Code Review</option>
                                                    <option value="Done">Done</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Seksi Chat Discussion Per Proyek */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-base">
                        <MessageSquare size={20} className="text-[#1a365d]" /> Diskusi Proyek
                    </h3>
                    {selectedTask ? (
                        <ChatBox
                            projectId={selectedTask.projectId}
                            projectName={selectedTask.projectName}
                            maxHeight="400px"
                        />
                    ) : (
                        <div className="bg-gray-50 p-8 rounded-xl border border-gray-200 text-center text-gray-400 text-sm font-medium">
                            Pilih task untuk melihat diskusi proyek.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
