import { getParallelTestingBadge } from '../../constants/projectStatus';
import RBBBadge from '../../components/RBBBadge';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import {
    generateDocumentName,
    DOCUMENT_TYPES,
    getDocumentTypeInfo,
    formatFileSize,
} from '../../utils/documentNaming';
import { documentService } from '../../services/api';
import ChatBox from '../../components/ChatBox';
import SITUATDocumentModal from '../../components/SITUATDocumentModal';
import SITUATWizard from '../../components/SITUATWizard';
import { useState, useMemo, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects, getFileFromStore } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
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
    CheckCircle2,
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
    ShieldCheck,
    Server,
    CheckSquare,
    Download,
    Upload,
    Lock,
    Send,
    FileCheck,
    ArrowRight,
} from 'lucide-react';
import { taskProjects } from '../../data/mockData';


export default function TaskDetail() {
    const { user } = useAuth();
    const { projects, updateProject } = useProjects();
    const { id: projectId } = useParams();
    const navigate = useNavigate();

    // Reset posisi scroll browser ke paling atas (0, 0) saat laman dibuka
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [projectId]);

    const project = useMemo(() => {
        if (!projectId) return null;

        // 1. Cari di ProjectContext (data dinamis & ter-update)
        const ctxFound = (projects || []).find((p) =>
            String(p.id).toLowerCase() === String(projectId).toLowerCase() ||
            String(p.reqId || p.req_id || '').toLowerCase() === String(projectId).toLowerCase()
        );

        if (ctxFound) {
            return {
                ...ctxFound,
                id: ctxFound.id,
                name: ctxFound.name,
                code: ctxFound.id,
                pm: typeof ctxFound.pm === 'object' ? (ctxFound.pm?.name || 'Budi Santoso') : (ctxFound.pm || ctxFound.pmName || 'Budi Santoso'),
                division: typeof ctxFound.division === 'object' ? (ctxFound.division?.name || 'Divisi TI') : (ctxFound.division || 'Divisi TI'),
                status: ctxFound.status || 'IN_DEVELOPMENT',
                progress: ctxFound.progress || 60,
                tasks: Array.isArray(ctxFound.tasks) ? ctxFound.tasks : []
            };
        }

        // 2. Fallback ke taskProjects mockData jika belum ada di context
        let found = taskProjects.find((p) => String(p.id).toLowerCase() === String(projectId).toLowerCase());
        if (found) return found;

        // 3. Fallback default project
        return (projects && projects[0]) || taskProjects[0] || null;
    }, [projectId, projects]);


    // Filter Assignee anggota tim proyek (HANYA Pekerja Teknis/Dev/Analyst, tanpa Management Roles)
    const validAssignees = useMemo(() => {
        const isManagementOrLeader = (nameStr) => {
            const n = String(nameStr || '').toLowerCase();
            return (
                n.includes('super admin') ||
                n.includes('head of it') ||
                n.includes('lead group') ||
                n.includes('cyber lead') ||
                n.includes('qa lead') ||
                n.includes('budi santoso (head') ||
                n.includes('dewi lestari (lead') ||
                n.includes('fajar nugroho (dev lead')
            );
        };

        const rawTeam = Array.isArray(project?.team) && project.team.length > 0 ? project.team : [];
        const filtered = rawTeam
            .map(m => (typeof m === 'object' ? m.name : String(m)))
            .filter(name => name && !isManagementOrLeader(name));

        if (filtered.length > 0) return filtered;

        // Fallback default: 5 Developer resmi
        return ['Dimas Anggara', 'Eka Putri', 'Fani Wijaya', 'Gilang Pratama', 'Rina Wati'];
    }, [project?.team]);

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
                        onClick={() => navigate('/pm/workspace')}
                        className="px-6 py-3 bg-[#00529C] text-white rounded-xl font-bold hover:bg-[#004080] transition-all shadow-md shadow-[#00529C]/20"
                    >
                        Kembali ke PM Workspace
                    </button>
                </div>
            </div>
        );
    }

    const [activeTab, setActiveTab] = useState('tasks'); // tasks, sit_uat, documents, activity
    const { addNotification } = useNotifications();

    // ─── SIT & UAT Internal State & Helpers ──────────────────────────────────
    const fmtName = (val, fb = 'Tim TI') => {
        if (!val) return fb;
        if (typeof val === 'object') return val.name || val.label || fb;
        return String(val);
    };
    const [sitUatState, setSitUatState] = useState({
        stagingUrl: project?.stagingUrl || '',
        sitCoverage: project?.sitCoverage || '',
        sitNotes: project?.sitNotes || '',
        uatScenarios: project?.uatScenarios || '',
        uatNotes: project?.uatNotes || '',
        sitUatFiles: project?.sitUatFiles || [],
    });
    const [sitUatSubmitting, setSitUatSubmitting] = useState(false);
    const [sitUatDocOpen, setSitUatDocOpen] = useState(false);
    const sitFileInputRef = useRef(null);

    const handleSITUATFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const newDocs = files.map(file => {
            const url = URL.createObjectURL(file);
            return {
                id: `situatdoc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                name: file.name,
                size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                type: file.name.split('.').pop().toUpperCase(),
                url,
                uploadedAt: new Date().toISOString(),
                category: 'BAST_SIT_UAT',
            };
        });
        setSitUatState(prev => ({ ...prev, sitUatFiles: [...prev.sitUatFiles, ...newDocs] }));
        toast.success(`${files.length} berkas bukti SIT & UAT berhasil dilampirkan.`);
    };

    const handleSaveSITUAT = (targetStatus) => {
        setSitUatSubmitting(true);
        updateProject(project.id, { status: targetStatus, sitPassedAt: new Date().toISOString(), sitPassedBy: fmtName(user?.name, 'Tim TI'), ...sitUatState });
        if (addNotification) {
            addNotification(
                targetStatus === 'DEV_COMPLETED' ? 'BAST Dev Diterbitkan' : 'SIT Diverifikasi',
                targetStatus === 'DEV_COMPLETED' ? `Proyek ${project.name} LULUS SIT & UAT. Siap QA & Siber.` : `Proyek ${project.name} Lulus SIT. Lanjut ke UAT Internal.`,
                'success', '/pm/workspace'
            );
        }
        toast.success(targetStatus === 'DEV_COMPLETED' ? `BAST Diterbitkan! Proyek "${project.name}" resmi DEV_COMPLETED.` : `SIT Lulus! Proyek "${project.name}" siap UAT Internal.`);
        setSitUatSubmitting(false);
    };
    // ─────────────────────────────────────────────────────────────────────────

    const [searchTask, setSearchTask] = useState('');
    const [tasks, setTasks] = useState(project ? (project.tasks || []) : []);
    
    // Auto sync state tasks bila data project di ProjectContext ter-update
    useEffect(() => {
        if (project?.tasks && Array.isArray(project.tasks)) {
            setTasks(project.tasks);
        }
    }, [project?.tasks]);
    
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
    
    // Modal Edit Proyek & Alokasi PM
    const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
    const [editProjectForm, setEditProjectForm] = useState({
        pmName: '',
        description: '',
        estimation: '30',
    });

    const handleOpenEditProjectModal = () => {
        const rawPM = typeof project?.pm === 'object'
            ? (project.pm?.name || '')
            : String(project?.pm || project?.pmName || project?.assignedPM || '');

        let resolvedPM = '';
        if (rawPM && rawPM !== 'Belum Dialokasi') {
            const pms = ['Budi Santoso', 'Dewi Lestari', 'Andi Wijaya', 'Citra Kirana'];
            const foundPM = pms.find(name => rawPM.toLowerCase().includes(name.toLowerCase()));
            resolvedPM = foundPM || rawPM;
        }

        setEditProjectForm({
            pmName: resolvedPM,
            description: project?.description || '',
            estimation: project?.estimation ? String(project.estimation).replace(/[^0-9]/g, '') || '30' : '30',
        });
        setIsEditProjectModalOpen(true);
    };

    const handleSaveProjectEdit = (e) => {
        e.preventDefault();
        if (!editProjectForm.pmName) {
            toast.error('Pilih Project Manager penanggung jawab!');
            return;
        }

        const days = parseInt(editProjectForm.estimation || '30', 10) || 30;
        const calcDeadline = new Date();
        calcDeadline.setDate(calcDeadline.getDate() + days);
        const deadlineIso = calcDeadline.toISOString().split('T')[0];

        updateProject(project.id, {
            pm: { name: editProjectForm.pmName, initial: editProjectForm.pmName.split(' ').map(n=>n[0]).join('').slice(0, 2) },
            pmName: editProjectForm.pmName,
            assignedPM: editProjectForm.pmName,
            description: editProjectForm.description,
            estimation: `${days} Hari Kerja`,
            deadline: deadlineIso,
            targetDate: deadlineIso,
            rbbDeadline: deadlineIso,
        });

        toast.success('Informasi proyek & alokasi PM berhasil diperbarui!');
        setIsEditProjectModalOpen(false);
    };

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
            id: Date.now(),
            name: newTask.title,
            title: newTask.title,
            description: newTask.description || '',
            assignee: newTask.assignee || 'Belum Dialokasi',
            deadline: newTask.deadline || new Date().toISOString().split('T')[0],
            priority: newTask.priority || 'Medium',
            status: 'Belum Mulai',
            statusColor: 'bg-gray-100 text-gray-600 border-gray-200'
        };

        const currentTasks = Array.isArray(project?.tasks) ? project.tasks : tasks;
        const newTasks = [...currentTasks, task];

        setTasks(newTasks);
        if (project?.id) updateProject(project.id, { tasks: newTasks });

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

        const currentTasks = Array.isArray(project?.tasks) ? project.tasks : tasks;
        const updatedTasks = currentTasks.map(t => t.id === editingTask.id ? editingTask : t);

        setTasks(updatedTasks);
        if (project?.id) updateProject(project.id, { tasks: updatedTasks });

        toast.success(`Task "${editingTask.name}" berhasil diperbarui!`);
        setIsEditTaskModalOpen(false);
    };

    const handleDeleteTask = (taskToDelete) => {
        if(window.confirm(`Apakah Anda yakin ingin menghapus task "${taskToDelete.name}"?`)) {
            const currentTasks = Array.isArray(project?.tasks) ? project.tasks : tasks;
            const updatedTasks = currentTasks.filter(t => t.id !== taskToDelete.id);

            setTasks(updatedTasks);
            if (project?.id) updateProject(project.id, { tasks: updatedTasks });
            
            toast.success(`Task "${taskToDelete.name}" berhasil dihapus!`);
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

    const completedTasks = tasks.filter((t) => {
        const st = String(t.status || '').toLowerCase();
        return st === 'selesai' || st === 'done' || t.done === true;
    }).length;
    const progress = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/pm/tasks')}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#00529C] transition-colors text-sm mb-2"
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
                            {(() => {
                                const badge = getParallelTestingBadge(project);
                                return (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.colorClass}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                        {badge.label}
                                    </span>
                                );
                            })()}
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
                        {(user?.role === 'super_admin' || user?.role === 'head_of_it' || user?.role === 'development_lead') && (
                            <button 
                                onClick={handleOpenEditProjectModal}
                                className="px-4 py-2 rounded-lg bg-[#00529C] text-white hover:bg-[#004080] transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm cursor-pointer"
                                title="Khusus Super Admin & Ketua Grup untuk penyesuaian alokasi PM"
                            >
                                <Edit size={16} />
                                Edit Proyek & PM
                            </button>
                        )}
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
                                <span className="text-2xl font-bold text-[#00529C] block">{progress}%</span>
                                <span className="text-xs text-gray-500">{completedTasks} dari {tasks.length} Task Selesai</span>
                            </div>
                        </div>
                        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#00529C] rounded-full transition-all duration-1000 ease-in-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Project Info Summary */}
                    <div className="col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-bold text-gray-800">Informasi Utama</h3>
                                {project.estimation && (
                                    <span className="text-xs px-2.5 py-1 bg-blue-50 text-[#00529C] border border-blue-200 rounded-full font-extrabold shadow-2xs">
                                        {String(project.estimation).includes('Hari') ? project.estimation : `${project.estimation} Hari Kerja`}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed bg-gray-50/70 p-3.5 rounded-xl border border-gray-100/80">
                                {project.description || "Proyek ini difokuskan pada peningkatan kualitas, penambahan fitur strategis, serta memastikan sistem berjalan sesuai dengan standar keamanan dan performa Bank Nagari."}
                            </p>

                            {/* Tech Stack & Analyst Note Badge jika ada */}
                            {(project.techStack || project.devAnalystResult?.techStack) && (
                                <div className="mb-4 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs">
                                    <span className="font-bold text-emerald-900 block mb-0.5">Rekomendasi Tech Stack:</span>
                                    <span className="text-emerald-700 font-semibold">{project.techStack || project.devAnalystResult?.techStack}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3.5 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-50 text-[#00529C] shrink-0">
                                    <Calendar size={18} />
                                </div>
                                <div>
                                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">TENGGAT WAKTU PROYEK</span>
                                    <span className="block text-sm font-bold text-gray-800">
                                        {project.deadline && !isNaN(new Date(project.deadline).getTime()) ? (
                                            new Date(project.deadline).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                            })
                                        ) : (
                                            (() => {
                                                const d = new Date();
                                                d.setDate(d.getDate() + 30);
                                                return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                                            })()
                                        )}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-50 text-[#00529C] shrink-0">
                                    <User size={18} />
                                </div>
                                <div>
                                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">PROJECT MANAGER</span>
                                    <span className="block text-sm font-bold text-gray-800">
                                        {typeof project.pm === 'object' ? (project.pm?.name || 'Belum Dialokasi') : (project.pm || project.pmName || project.assignedPM || 'Belum Dialokasi')}
                                    </span>
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
                                ? 'border-[#00529C] text-[#00529C] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Manajemen Task
                        </button>
                        <button
                            onClick={() => setActiveTab('documents')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'documents'
                                ? 'border-[#00529C] text-[#00529C] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Dokumen
                        </button>
                        <button
                            onClick={() => setActiveTab('sit_uat')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'sit_uat'
                                ? 'border-emerald-600 text-emerald-700 bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <ShieldCheck size={15} />
                            SIT &amp; UAT Internal
                            {(project?.status === 'IN_DEVELOPMENT' || project?.status === 'SIT_PASSED' || project?.status === 'UAT_IN_PROGRESS') && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'activity'
                                ? 'border-[#00529C] text-[#00529C] bg-white'
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
                                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all"
                                        />
                                    </div>
                                    <button className="px-3 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2">
                                        <Filter size={16} />
                                        <span className="hidden sm:inline">Filter</span>
                                    </button>
                                </div>
                                <button onClick={() => setIsAddTaskModalOpen(true)} className="px-4 py-2 rounded-lg bg-[#00529C] text-white hover:bg-[#004080] transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm whitespace-nowrap">
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

                    {/* ═══════════════════════════════════════════════════════════
                         SIT & UAT INTERNAL TAB — Multi-Step Wizard Component
                        ═══════════════════════════════════════════════════════════ */}
                    {activeTab === 'sit_uat' && (
                        <SITUATWizard
                            project={project}
                            updateProject={updateProject}
                            addNotification={addNotification}
                            navigate={navigate}
                        />
                    )}


                    {/* Dokumen Tab */}
                    {activeTab === 'documents' && (
                        <DocumentSection project={project} user={user} />
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
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
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
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none resize-none"
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
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none bg-white"
                                        >
                                            <option value="">Pilih Anggota Tim...</option>
                                            {validAssignees.map((memName, idx) => {
                                                const activeCount = (project?.tasks || []).filter(t => (t.assignee || '').toLowerCase().includes(memName.toLowerCase()) && t.status !== 'Selesai' && t.status !== 'DONE').length;
                                                return (
                                                    <option key={idx} value={memName}>
                                                        {memName} (Beban: {activeCount} Task Aktif)
                                                    </option>
                                                );
                                            })}
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
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
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
                                                    className="w-4 h-4 text-[#00529C]"
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
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
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
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none bg-white"
                                        >
                                            <option value="">Pilih Anggota Tim...</option>
                                            {validAssignees.map((memName, idx) => {
                                                const activeCount = (project?.tasks || []).filter(t => (t.assignee || '').toLowerCase().includes(memName.toLowerCase()) && t.status !== 'Selesai' && t.status !== 'DONE').length;
                                                return (
                                                    <option key={idx} value={memName}>
                                                        {memName} (Beban: {activeCount} Task Aktif)
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <select
                                            value={editingTask.status}
                                            onChange={(e) => setEditingTask({...editingTask, status: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
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
                                        className="px-4 py-2 bg-[#00529C] text-white rounded-lg font-medium hover:bg-[#004080] transition-colors flex items-center gap-2"
                                    >
                                        Simpan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EDIT PROYEK & ALOKASI PM */}
            {isEditProjectModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4">
                            <div className="flex items-center gap-2">
                                <User className="text-[#00529C]" size={20} />
                                <h3 className="text-lg font-bold text-gray-800">Edit Proyek & Alokasi PM</h3>
                            </div>
                            <button
                                onClick={() => setIsEditProjectModalOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveProjectEdit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Project Manager (PM) Penanggung Jawab *
                                </label>
                                <select
                                    value={editProjectForm.pmName}
                                    onChange={(e) => setEditProjectForm({...editProjectForm, pmName: e.target.value})}
                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#00529C] outline-none bg-white"
                                >
                                    <option value="">-- Pilih Project Manager --</option>
                                    {[
                                        'Budi Santoso',
                                        'Dewi Lestari',
                                        'Andi Wijaya',
                                        'Citra Kirana',
                                    ].map(name => {
                                        const activeCount = (projects || []).filter(p => {
                                            const pmNameStr = typeof p.pm === 'object' ? (p.pm?.name || '') : String(p.pmName || p.pm || p.assignedPM || '');
                                            return pmNameStr.toLowerCase().includes(name.toLowerCase()) && p.status !== 'LIVE_PRODUCTION' && p.status !== 'COMPLETED';
                                        }).length;
                                        return (
                                            <option key={name} value={name}>
                                                {name} (Beban: {activeCount} Proyek Aktif)
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Estimasi Durasi Pengerjaan (Hari Kerja) *
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        value={editProjectForm.estimation}
                                        onChange={(e) => setEditProjectForm({...editProjectForm, estimation: e.target.value})}
                                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#00529C] outline-none"
                                    />
                                    <span className="absolute right-3.5 top-2.5 text-xs text-gray-400 font-bold">Hari</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Deskripsi & Latar Belakang Proyek
                                </label>
                                <textarea
                                    rows={3}
                                    value={editProjectForm.description}
                                    onChange={(e) => setEditProjectForm({...editProjectForm, description: e.target.value})}
                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#00529C] outline-none"
                                    placeholder="Masukkan deskripsi ringkas proyek..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditProjectModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-[#00529C] text-white rounded-xl font-bold text-xs hover:bg-[#004080] transition-colors shadow-md shadow-[#00529C]/20 cursor-pointer"
                                >
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Komponen Dokumen Tab — fetch dari API, upload, lihat, hapus, download
 */
function DocumentSection({ project, user }) {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState('BRD');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewDoc, setPreviewDoc] = useState(null);
    const fileInputRef = useRef(null);

    const ALLOWED_EXTS = ['.pdf', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.zip'];
    const MAX_SIZE_MB = 5;

    // Fetch documents from API
    const fetchDocs = async () => {
        if (!project?.id) return;
        setLoading(true);
        try {
            const res = await documentService.getAll(project.id);
            if (res && res.data) {
                setDocs(res.data);
            }
        } catch (err) {
            console.warn('[DocumentSection] Failed to load docs:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocs();
    }, [project?.id]);

    // Handle file upload
    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_EXTS.includes(ext)) {
            toast.error('Format yang diizinkan: PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), ZIP!');
            return;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(`Ukuran file melebihi batas ${MAX_SIZE_MB}MB!`);
            return;
        }

        setUploading(true);
        try {
            const finalName = generateDocumentName(project.req_id || project.reqId || `REQ-${project.id}`, selectedDocType, project.title || project.name || 'Proyek');
            const ext = file.name.split('.').pop();
            const renamedFile = new File([file], `${finalName}.${ext}`, { type: file.type });

            await documentService.upload(renamedFile, {
                project_id: project.id,
                document_type: selectedDocType,
                original_filename: file.name,
            });

            toast.success('Dokumen berhasil diunggah!');
            await fetchDocs(); // Refresh list
        } catch (err) {
            toast.error(`Gagal upload: ${err.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Handle delete
    const handleDelete = async (docId, docName) => {
        if (!confirm(`Hapus dokumen "${docName}"?`)) return;
        try {
            await documentService.delete(docId);
            toast.success('Dokumen berhasil dihapus.');
            setDocs(prev => prev.filter(d => d.id !== docId));
        } catch (err) {
            toast.error(`Gagal hapus: ${err.message}`);
        }
    };

    // Handle View / Preview
    const handleView = async (doc) => {
        try {
            toast.loading('Memuat pratinjau...', { id: 'preview-load' });
            const blob = await documentService.download(doc.id);
            const url = URL.createObjectURL(blob);
            setPreviewDoc({
                ...doc,
                previewBlobUrl: url,
            });
            toast.dismiss('preview-load');
        } catch {
            toast.error('Gagal memuat pratinjau dokumen.', { id: 'preview-load' });
        }
    };

    // Handle download
    const handleDownload = async (doc) => {
        try {
            const blob = await documentService.download(doc.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.original_filename || doc.file_name || 'Dokumen';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Mengunduh dokumen...');
        } catch {
            toast.error('Gagal mengunduh dokumen.');
        }
    };

    // File extension icon helper
    const getExtColor = (filename) => {
        const fn = (filename || '').toLowerCase();
        if (fn.endsWith('.pdf')) return 'bg-red-50 text-red-500 border-red-200';
        if (fn.endsWith('.xlsx') || fn.endsWith('.xls')) return 'bg-green-50 text-green-600 border-green-200';
        if (fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.png')) return 'bg-yellow-50 text-yellow-600 border-yellow-200';
        if (fn.endsWith('.zip')) return 'bg-purple-50 text-purple-600 border-purple-200';
        return 'bg-gray-50 text-gray-500 border-gray-200';
    };

    const getExtLabel = (filename) => {
        const ext = (filename || '').split('.').pop()?.toUpperCase() || 'FILE';
        return ext.substring(0, 4);
    };

    const isPrivileged = ['super_admin', 'head_of_it', 'lead_group', 'project_manager', 'development_lead'].includes(user?.role);

    // Filter docs by search
    const filteredDocs = useMemo(() => {
        if (!searchQuery.trim()) return docs;
        const q = searchQuery.toLowerCase();
        return docs.filter(d =>
            (d.original_filename || d.file_name || d.name || '').toLowerCase().includes(q) ||
            (d.document_type || '').toLowerCase().replace(/_/g, ' ').includes(q) ||
            (d.uploader?.name || '').toLowerCase().includes(q)
        );
    }, [docs, searchQuery]);

    return (
        <div className="p-6">
            {/* Header + Search + Upload */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-800">Dokumen Proyek</h3>
                    <div className="relative mt-2 max-w-sm">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari nama, tipe, atau uploader..."
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] outline-none transition-all"
                        />
                    </div>
                </div>
                {isPrivileged && (
                    <div className="flex items-center gap-2 shrink-0">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                            onChange={handleUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="px-4 py-2 bg-[#00529C] text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm hover:bg-[#004080] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {uploading ? (
                                <><Clock size={16} className="animate-spin" /> Mengunggah...</>
                            ) : (
                                <><Upload size={16} /> Unggah Dokumen</>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Document List */}
            {loading ? (
                <div className="py-12 text-center text-gray-400">
                    <Clock size={32} className="mx-auto animate-spin mb-3" />
                    <p className="text-sm">Memuat dokumen...</p>
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                    <FolderOpen size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium">{searchQuery ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}</p>
                    <p className="text-xs mt-1">{searchQuery ? 'Coba kata kunci lain' : 'Unggah dokumen pertama untuk proyek ini.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocs.map((doc) => (
                        <div key={doc.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-[#00529C] hover:shadow-md transition-all cursor-pointer group bg-white">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] border ${getExtColor(doc.file_name || doc.name)}`}>
                                {getExtLabel(doc.file_name || doc.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-[#00529C] transition-colors" title={doc.original_filename || doc.file_name}>
                                    {doc.original_filename || doc.file_name || doc.name || 'Dokumen'}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    <span>{formatFileSize(doc.file_size)}</span>
                                    <span>•</span>
                                    <span>{doc.document_type?.replace(/_/g, ' ')}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                    <User size={10} /> {doc.uploader?.name || 'Unknown'}
                                    <span className="mx-1">•</span>
                                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                </p>
                            </div>
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleView(doc); }}
                                    className="text-gray-400 hover:text-[#00529C] p-1.5 rounded hover:bg-blue-50 cursor-pointer"
                                    title="Lihat Dokumen"
                                >
                                    <Eye size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                                    className="text-gray-400 hover:text-[#00529C] p-1.5 rounded hover:bg-blue-50 cursor-pointer"
                                    title="Unduh"
                                >
                                    <Download size={14} />
                                </button>
                                {isPrivileged && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.original_filename || doc.file_name); }}
                                        className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 cursor-pointer"
                                        title="Hapus"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Pratinjau Dokumen */}
            {previewDoc && (
                <DocumentViewerModal
                    doc={{
                        name: previewDoc.original_filename || previewDoc.file_name || 'Dokumen',
                        url: previewDoc.previewBlobUrl || `/api/v1/documents/${previewDoc.id}/download`,
                        type: previewDoc.document_type || 'Dokumen',
                        size: formatFileSize(previewDoc.file_size),
                        author: previewDoc.uploader?.name || 'Unknown',
                        created_at: previewDoc.created_at,
                    }}
                    project={project}
                    onClose={() => {
                        if (previewDoc.previewBlobUrl) URL.revokeObjectURL(previewDoc.previewBlobUrl);
                        setPreviewDoc(null);
                    }}
                />
            )}
        </div>
    );
}
