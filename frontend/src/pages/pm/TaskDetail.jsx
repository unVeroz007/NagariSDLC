import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Filter,
    Plus,
    MoreVertical,
    User,
    Calendar,
    DollarSign,
    Clock,
    CheckCircle,
    AlertCircle,
    Info,
    Edit,
    Share,
    FileText,
    FolderOpen,
    Activity,
    BarChart,
    Settings,
    Eye,
    Briefcase,
    Users,
    Target,
    MessageSquare,
    Paperclip,
    Link,
    Trash2,
} from 'lucide-react';
import { taskProjects } from '../../data/mockData';

export default function TaskDetail() {
    const { user } = useAuth();
    const { id: projectId } = useParams();
    const navigate = useNavigate();

    const project = taskProjects.find((p) => p.id === projectId);

    if (!project) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb] flex items-center justify-center">
                <div className="text-center py-20 animate-scale-in">
                    <div className="w-24 h-24 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
                        <Briefcase size={44} className="text-gray-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Proyek tidak ditemukan</h2>
                    <p className="text-gray-500 mb-6">Proyek yang Anda cari tidak ada atau sudah dihapus.</p>
                    <button
                        onClick={() => navigate('/pm/tasks')}
                        className="px-6 py-3 bg-[#1A56DB] text-white rounded-xl font-bold hover:bg-[#1346b3] transition-all shadow-md shadow-[#1A56DB]/20"
                    >
                        Kembali ke Daftar Proyek
                    </button>
                </div>
            </div>
        );
    }

    const [activeTab, setActiveTab] = useState('tasks'); // tasks, documents, activity
    const [searchTask, setSearchTask] = useState('');

    const filteredTasks = project.tasks.filter((task) =>
        task.name.toLowerCase().includes(searchTask.toLowerCase())
    );

    const getStatusBadge = (status) => {
        const configs = {
            Selesai: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            'Sedang Dikerjakan': 'bg-amber-100 text-amber-700 border-amber-200',
            'Belum Mulai': 'bg-gray-100 text-gray-600 border-gray-200',
        };
        return configs[status] || configs['Belum Mulai'];
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Selesai':
                return <CheckCircle size={14} className="text-emerald-600" />;
            case 'Sedang Dikerjakan':
                return <Clock size={14} className="text-amber-600" />;
            default:
                return <AlertCircle size={14} className="text-gray-400" />;
        }
    };

    const completedTasks = project.tasks.filter((t) => t.status === 'Selesai').length;
    const progress = Math.round((completedTasks / project.tasks.length) * 100);

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
            <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/pm/tasks')}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#1A56DB] transition-colors text-sm mb-2"
                >
                    <ChevronLeft size={18} />
                    Kembali ke Daftar Proyek
                </button>

                {/* Project Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                {project.id}
                            </span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800">{project.name}</h1>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${project.statusColor}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                {project.status}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${project.priorityColor}`}>
                                <AlertCircle size={14} />
                                {project.priority}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm font-semibold flex items-center gap-2">
                            <Share size={16} />
                            Bagikan
                        </button>
                        <button className="px-4 py-2 rounded-lg bg-[#1A56DB] text-white hover:bg-[#1346b3] transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm">
                            <Edit size={16} />
                            Edit Proyek
                        </button>
                    </div>
                </div>

                {/* Bento Grid: Progress + Info */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Progress Card */}
                    <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-center">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-1">Progress Keseluruhan</h3>
                                <p className="text-sm text-gray-500">Status penyelesaian task utama dalam milestone ini.</p>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-[#1A56DB] block">{progress}%</span>
                                <span className="text-xs text-gray-500">{completedTasks} dari {project.tasks.length} Task Selesai</span>
                            </div>
                        </div>
                        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#1A56DB] rounded-full transition-all duration-1000 ease-in-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Project Info Summary */}
                    <div className="col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Informasi Utama</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-gray-100 text-gray-500">
                                    <Calendar size={18} />
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500 font-semibold">TENGGAT WAKTU</span>
                                    <span className="block text-sm font-semibold text-gray-800">
                                        {new Date(project.deadline).toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                        })}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-gray-100 text-gray-500">
                                    <User size={18} />
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500 font-semibold">PROJECT MANAGER</span>
                                    <span className="block text-sm font-semibold text-gray-800">{project.pm}</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-gray-100 text-gray-500">
                                    <DollarSign size={18} />
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500 font-semibold">ALOKASI BUDGET</span>
                                    <span className="block text-sm font-semibold text-gray-800">{project.budget}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation & Task Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-[500px]">
                    {/* Tabs */}
                    <div className="border-b border-gray-200 bg-gray-50/50 flex overflow-x-auto px-4">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'tasks'
                                ? 'border-[#1A56DB] text-[#1A56DB] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Manajemen Task
                        </button>
                        <button
                            onClick={() => setActiveTab('documents')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'documents'
                                ? 'border-[#1A56DB] text-[#1A56DB] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Dokumen
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'activity'
                                ? 'border-[#1A56DB] text-[#1A56DB] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Log Aktivitas
                        </button>
                    </div>

                    {/* Task Management Content */}
                    {activeTab === 'tasks' && (
                        <>
                            {/* Toolbar */}
                            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            value={searchTask}
                                            onChange={(e) => setSearchTask(e.target.value)}
                                            placeholder="Cari task..."
                                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none transition-all"
                                        />
                                    </div>
                                    <button className="px-3 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2">
                                        <Filter size={16} />
                                        <span className="hidden sm:inline">Filter</span>
                                    </button>
                                </div>
                                <button className="px-4 py-2 rounded-lg bg-[#1A56DB] text-white hover:bg-[#1346b3] transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm whitespace-nowrap">
                                    <Plus size={16} />
                                    Tambah Task
                                </button>
                            </div>

                            {/* Task Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                            <th className="py-3 px-4">Nama Task</th>
                                            <th className="py-3 px-4">Assignee</th>
                                            <th className="py-3 px-4">Deadline</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {filteredTasks.map((task) => (
                                            <tr key={task.id} className="hover:bg-gray-50/70 transition-colors group">
                                                <td className="py-4 px-4 font-medium text-gray-800">{task.name}</td>
                                                <td className="py-4 px-4">
                                                    {task.assignee ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                                                {task.assignee.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                                            </div>
                                                            <span>{task.assignee}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-gray-400 italic">
                                                            <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-300 bg-gray-50">
                                                                <User size={12} />
                                                            </div>
                                                            <span>Unassigned</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-gray-500">
                                                    {new Date(task.deadline).toLocaleDateString('id-ID', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    })}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(task.status)}`}>
                                                        {getStatusIcon(task.status)}
                                                        {task.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <button className="text-gray-400 hover:text-[#1A56DB] p-1 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                        <MoreVertical size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex justify-between items-center mt-auto">
                                <span className="text-sm text-gray-500">
                                    Menampilkan {filteredTasks.length} task
                                </span>
                                <div className="flex gap-1">
                                    <button className="p-1 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-50" disabled>
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button className="p-1 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-50" disabled>
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Dokumen Tab (placeholder) */}
                    {activeTab === 'documents' && (
                        <div className="p-8 text-center text-gray-500">
                            <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-lg font-medium">Belum ada dokumen yang diunggah</p>
                            <p className="text-sm">Dokumen akan muncul di sini setelah diunggah.</p>
                        </div>
                    )}

                    {/* Activity Tab (placeholder) */}
                    {activeTab === 'activity' && (
                        <div className="p-8 text-center text-gray-500">
                            <Activity size={48} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-lg font-medium">Belum ada aktivitas</p>
                            <p className="text-sm">Aktivitas akan muncul di sini seiring berjalannya proyek.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}