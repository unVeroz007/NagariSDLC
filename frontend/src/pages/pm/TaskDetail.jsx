import RBBBadge from '../../components/RBBBadge';
import ChatBox from '../../components/ChatBox';
import { useState } from 'react';
import toast from 'react-hot-toast';
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
    X,
} from 'lucide-react';
import { taskProjects } from '../../data/mockData';

export default function TaskDetail() {
    const { user } = useAuth();
    const { id: projectId } = useParams();
    const navigate = useNavigate();

    const project = taskProjects.find((p) => p.id === projectId);

    if (!project) {
        return (
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] flex items-center justify-center">
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
    const [tasks, setTasks] = useState(project ? project.tasks : []);
    
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        assignee: '',
        deadline: '',
        priority: 'Medium',
        description: '',
    });

    const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    
    const [isProjectChatOpen, setIsProjectChatOpen] = useState(false);
    const [newChatMessage, setNewChatMessage] = useState('');
    const [chatMessages, setChatMessages] = useState([
        { id: 1, sender: 'Budi Santoso', time: '10:00', text: 'Tolong pastikan dokumentasi sudah lengkap.' },
        { id: 2, sender: 'Anda', time: '10:05', text: 'Baik, sedang saya siapkan.' },
    ]);

    const handleAddTask = (e) => {
        e.preventDefault();

        if (!newTask.title.trim()) {
            toast.error('Nama task wajib diisi!');
            return;
        }

        const task = {
            id: tasks.length + 1,
            name: newTask.title,
            description: newTask.description || '',
            assignee: newTask.assignee || null,
            deadline: newTask.deadline || new Date().toISOString().split('T')[0],
            priority: newTask.priority || 'Medium',
            status: 'Belum Mulai',
            statusColor: 'bg-gray-100 text-gray-600 border-gray-200'
        };

        const newTasks = [...tasks, task];
        setTasks(newTasks);
        
        // Mutate in-memory mock data
        project.tasks = newTasks;

        toast.success(`Task "${task.name}" berhasil ditambahkan!`);
        setIsAddTaskModalOpen(false);
        setNewTask({ title: '', assignee: '', deadline: '', priority: 'Medium', description: '' });
    };

    const handleEditTask = (e) => {
        e.preventDefault();
        
        if (!editingTask.name.trim()) {
            toast.error('Nama task wajib diisi!');
            return;
        }

        const updatedTasks = tasks.map(t => t.id === editingTask.id ? editingTask : t);
        setTasks(updatedTasks);
        
        // Mutate in-memory mock data
        const projTaskIndex = project.tasks.findIndex(t => t.id === editingTask.id);
        if(projTaskIndex !== -1) project.tasks[projTaskIndex] = editingTask;

        toast.success(`Task "${editingTask.name}" berhasil diperbarui!`);
        setIsEditTaskModalOpen(false);
    };

    const handleDeleteTask = (task) => {
        if(window.confirm(`Apakah Anda yakin ingin menghapus task "${task.name}"?`)) {
            const updatedTasks = tasks.filter(t => t.id !== task.id);
            setTasks(updatedTasks);
            
            // Mutate in-memory mock data
            const projTaskIndex = project.tasks.findIndex(t => t.id === task.id);
            if(projTaskIndex !== -1) project.tasks.splice(projTaskIndex, 1);
            
            toast.success(`Task "${task.name}" berhasil dihapus!`);
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if(!newChatMessage.trim()) return;

        const newMessage = {
            id: chatMessages.length + 1,
            sender: 'Anda',
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            text: newChatMessage
        };

        setChatMessages([...chatMessages, newMessage]);
        setNewChatMessage('');
    };

    const filteredTasks = tasks.filter((task) =>
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
            case 'ANALYSIS_APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'READY_FOR_DEVELOPMENT': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'IN_DEVELOPMENT': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            default:
                return <AlertCircle size={14} className="text-gray-400" />;
        }
    };

    const completedTasks = tasks.filter((t) => t.status === 'Selesai').length;
    const progress = Math.round((completedTasks / tasks.length) * 100);

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
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
                        <button className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm">
                            <Share size={16} />
                            Bagikan
                        </button>
                        <button 
                            onClick={() => toast('Fitur Edit Proyek akan segera hadir di pembaruan berikutnya!', { icon: '🚧' })}
                            className="px-4 py-2 rounded-lg bg-[#1A56DB] text-white hover:bg-[#1346b3] transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm"
                        >
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
                                <span className="text-xs text-gray-500">{completedTasks} dari {tasks.length} Task Selesai</span>
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
                    <div className="col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Informasi Utama</h3>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                                {project.description || "Proyek ini difokuskan pada peningkatan kualitas, penambahan fitur strategis, serta memastikan sistem berjalan sesuai dengan standar keamanan dan performa Bank Nagari."}
                            </p>
                        </div>
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
                                <button onClick={() => setIsAddTaskModalOpen(true)} className="px-4 py-2 rounded-lg bg-[#1A56DB] text-white hover:bg-[#1346b3] transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm whitespace-nowrap">
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
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => { setEditingTask(task); setIsEditTaskModalOpen(true); }}
                                                            className="text-gray-400 hover:text-amber-500 p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                                                            title="Edit Task"
                                                        >
                                                            <Edit size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteTask(task)}
                                                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                            title="Hapus Task"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
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

                    {/* Dokumen Tab */}
                    {activeTab === 'documents' && (
                        <div className="p-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">Dokumen Proyek</h3>
                                    <p className="text-sm text-gray-500">Kelola dan lihat dokumen terkait proyek ini.</p>
                                </div>
                                <button className="px-4 py-2 bg-[#1A56DB] text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm hover:bg-[#1346b3] transition-colors">
                                    <Plus size={16} />
                                    Unggah Dokumen
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[
                                    { name: 'BRD_Final_v2.pdf', type: 'PDF', date: '10 Ags 2026', size: '2.4 MB', uploader: 'Budi Santoso' },
                                    { name: 'FSD_Draft_Rev.docx', type: 'DOCX', date: '12 Ags 2026', size: '1.1 MB', uploader: 'Citra Kirana' },
                                    { name: 'API_Documentation.pdf', type: 'PDF', date: '15 Ags 2026', size: '3.5 MB', uploader: 'Dimas Anggara' },
                                    { name: 'UI_Mockups.fig', type: 'FIG', date: '16 Ags 2026', size: '12.8 MB', uploader: 'Fani Wijaya' },
                                    { name: 'Security_Audit.pdf', type: 'PDF', date: '18 Ags 2026', size: '1.9 MB', uploader: 'Eka Putri' },
                                ].map((doc, i) => (
                                    <div key={i} className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-[#1A56DB] hover:shadow-md transition-all cursor-pointer group bg-white">
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                                            doc.type === 'PDF' ? 'bg-red-50 text-red-500' :
                                            doc.type === 'DOCX' ? 'bg-blue-50 text-blue-500' :
                                            doc.type === 'FIG' ? 'bg-purple-50 text-purple-500' :
                                            'bg-gray-50 text-gray-500'
                                        }`}>
                                            <FileText size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-[#1A56DB] transition-colors">{doc.name}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                <span>{doc.size}</span>
                                                <span>•</span>
                                                <span>{doc.date}</span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                                <User size={10} /> {doc.uploader}
                                            </p>
                                        </div>
                                        <button className="text-gray-400 hover:text-[#1A56DB] p-1.5 rounded hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all">
                                            <MoreVertical size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
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

                    {/* Chat Box Diskusi Proyek (Inline di Bagian Bawah) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-base">
                            <MessageSquare size={20} className="text-[#1a365d]" /> Diskusi Proyek: {project.name}
                        </h3>
                        <ChatBox projectId={project.id} projectName={project.name} className="max-h-[420px]" />
                    </div>
                </div>
            </div>

            {/* Modal Tambah Task */}
            {isAddTaskModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h3 className="text-lg font-semibold text-gray-800">Tambah Task Baru</h3>
                            <button
                                onClick={() => setIsAddTaskModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <form onSubmit={handleAddTask} className="space-y-4">
                                {/* Nama Task */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Nama Task <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newTask.title}
                                        onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                                        placeholder="Masukkan nama task..."
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none"
                                        required
                                    />
                                </div>

                                {/* Deskripsi */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Deskripsi
                                    </label>
                                    <textarea
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                                        placeholder="Masukkan deskripsi task..."
                                        rows={3}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none resize-none"
                                    />
                                </div>

                                {/* Assignee & Deadline */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Assignee
                                        </label>
                                        <select
                                            value={newTask.assignee}
                                            onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none"
                                        >
                                            <option value="">Pilih assignee...</option>
                                            <option value="Budi Santoso">Budi Santoso</option>
                                            <option value="Citra Kirana">Citra Kirana</option>
                                            <option value="Dimas Anggara">Dimas Anggara</option>
                                            <option value="Eka Putri">Eka Putri</option>
                                            <option value="Fani Wijaya">Fani Wijaya</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Deadline
                                        </label>
                                        <input
                                            type="date"
                                            value={newTask.deadline}
                                            onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Priority */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Prioritas
                                    </label>
                                    <div className="flex gap-3">
                                        {['High', 'Medium', 'Low'].map((p) => (
                                            <label key={p} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="priority"
                                                    value={p}
                                                    checked={newTask.priority === p}
                                                    onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                                                    className="w-4 h-4 text-[#1A56DB]"
                                                />
                                                <span className={`text-sm font-medium ${
                                                    p === 'High' ? 'text-red-600' : p === 'Medium' ? 'text-amber-600' : 'text-blue-600'
                                                }`}>
                                                    {p}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddTaskModalOpen(false)}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-[#003a73] text-white rounded-lg font-medium hover:bg-[#002a5a] transition-colors flex items-center gap-2"
                                    >
                                        <Plus size={16} />
                                        Tambah Task
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Edit Task */}
            {isEditTaskModalOpen && editingTask && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h3 className="text-lg font-semibold text-gray-800">Edit Task</h3>
                            <button
                                onClick={() => setIsEditTaskModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <form onSubmit={handleEditTask} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Nama Task <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editingTask.name}
                                        onChange={(e) => setEditingTask({...editingTask, name: e.target.value})}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Assignee
                                        </label>
                                        <select
                                            value={editingTask.assignee || ''}
                                            onChange={(e) => setEditingTask({...editingTask, assignee: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none"
                                        >
                                            <option value="">Pilih assignee...</option>
                                            <option value="Budi Santoso">Budi Santoso</option>
                                            <option value="Citra Kirana">Citra Kirana</option>
                                            <option value="Dimas Anggara">Dimas Anggara</option>
                                            <option value="Eka Putri">Eka Putri</option>
                                            <option value="Fani Wijaya">Fani Wijaya</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <select
                                            value={editingTask.status}
                                            onChange={(e) => setEditingTask({...editingTask, status: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none"
                                        >
                                            <option value="Belum Mulai">Belum Mulai</option>
                                            <option value="Sedang Dikerjakan">Sedang Dikerjakan</option>
                                            <option value="Selesai">Selesai</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditTaskModalOpen(false)}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-[#1A56DB] text-white rounded-lg font-medium hover:bg-[#1346b3] transition-colors flex items-center gap-2"
                                    >
                                        Simpan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
