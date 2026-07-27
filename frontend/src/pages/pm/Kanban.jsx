import { useState } from 'react';
import RBBBadge from '../../components/RBBBadge';
import { useAuth } from '../../contexts/AuthContext';
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
} from 'lucide-react';
import { kanbanTasks, kanbanStages } from '../../data/mockData';

// Helper untuk mendapatkan initial assignee
const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Helper untuk mendapatkan warna prioritas
const getPriorityColor = (priority) => {
    switch (priority) {
        case 'High': return 'text-red-600 bg-red-100 border-red-200';
        case 'Medium': return 'text-amber-600 bg-amber-100 border-amber-200';
        case 'Low': return 'text-blue-600 bg-blue-100 border-blue-200';
        default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
};

export default function Kanban() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState(kanbanTasks);
    const [filter, setFilter] = useState('active');
    const [searchTerm, setSearchTerm] = useState('');

    // Drag and Drop handlers
    const [draggedTaskId, setDraggedTaskId] = useState(null);

    const handleDragStart = (taskId) => {
        const targetTask = tasks.find(t => t.id === taskId);
        if (user?.role === 'developer' && targetTask?.assignee) {
            const isOwnTask = targetTask.assignee.toLowerCase().includes(user.name.toLowerCase()) ||
                             user.name.toLowerCase().includes(targetTask.assignee.toLowerCase());
            if (!isOwnTask) {
                toast.error(`Anda hanya dapat menggeser task yang ditugaskan kepada Anda (${user.name})!`);
                return;
            }
        }
        setDraggedTaskId(taskId);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (targetStage) => {
        if (draggedTaskId === null) return;

        setTasks((prevTasks) =>
            prevTasks.map((task) =>
                task.id === draggedTaskId
                    ? { ...task, stage: targetStage }
                    : task
            )
        );
        setDraggedTaskId(null);
        toast.success(`Status task berhasil dipindahkan ke: ${targetStage}`);
    };

    // Filter tasks
    const filteredTasks = tasks.filter((task) => {
        const matchSearch =
            task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.description.toLowerCase().includes(searchTerm.toLowerCase());
        if (filter === 'active') return task.stage !== 'deployment' && matchSearch;
        if (filter === 'completed') return task.stage === 'deployment' && matchSearch;
        return matchSearch;
    });

    // Group tasks by stage
    const tasksByStage = {};
    kanbanStages.forEach((stage) => {
        tasksByStage[stage.id] = filteredTasks.filter((t) => t.stage === stage.id);
    });

    // Stage order
    const stageOrder = ['inisiasi', 'analisis', 'desain', 'pembangunan', 'pengujian', 'deployment'];

    // Render Card
    const renderTaskCard = (task) => {
        const stage = kanbanStages.find((s) => s.id === task.stage);
        const isRework = task.isRework;
        const isLocked = task.stage === 'deployment';

        return (
            <div
                key={task.id}
                draggable={!isLocked}
                onDragStart={() => handleDragStart(task.id)}
                onClick={() => navigate(`/pm/tasks/${task.projectId}`)}
                className={`p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing relative group ${isRework
                    ? 'bg-red-50/50 border-2 border-red-500/50'
                    : isLocked
                        ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                        : 'bg-white border-gray-200'
                    }`}
            >
                {isRework && (
                    <div className="absolute -top-3 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 border-2 border-white z-10">
                        <AlertTriangle size={12} />
                        REWORK
                    </div>
                )}

                {task.type && <div className="mb-2"><RBBBadge type={task.type} deadline={task.rbbDeadline} /></div>}
                <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded border ${isRework
                        ? 'text-red-600 bg-white border-red-200'
                        : 'text-[#1A56DB] bg-blue-50 border-blue-200'
                        }`}>
                        {task.id}
                    </span>
                    {!isLocked && (
                        <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal size={16} />
                        </button>
                    )}
                </div>

                <h4 className="font-bold text-gray-800 text-sm mb-1.5 leading-snug hover:text-[#1A56DB] transition-colors">
                    {task.title}
                </h4>

                <p className="text-gray-500 text-xs line-clamp-2 mb-3 leading-relaxed">
                    {task.description}
                </p>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2 text-xs">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {task.assignee && (
                            <div
                                className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center border border-white shadow-sm"
                                title={`Assignee: ${task.assignee}`}
                            >
                                {getInitials(task.assignee)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col bg-[#f8f9fb] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-extrabold text-gray-800">Kanban Board</h1>
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                            <KanbanIcon size={14} /> Agile Development
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        Papan visualisasi alur tugas proyek dari inisiasi hingga deployment produksi.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari task..."
                            className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-600 focus:bg-white transition-all w-48 sm:w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Stage Columns */}
            <div className="flex-1 overflow-x-auto p-6">
                <div className="flex gap-4 min-w-[1200px] h-full items-start">
                    {stageOrder.map((stageId) => {
                        const stage = kanbanStages.find((s) => s.id === stageId);
                        const stageTasks = tasksByStage[stageId] || [];

                        return (
                            <div
                                key={stageId}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(stageId)}
                                className="w-80 bg-gray-100/70 border border-gray-200 rounded-2xl flex flex-col max-h-full shrink-0 shadow-sm"
                            >
                                {/* Column Header */}
                                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white/60 rounded-t-2xl">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${stage?.color || 'bg-gray-400'}`}></div>
                                        <h3 className="font-bold text-gray-800 text-sm">{stage?.label || stageId}</h3>
                                    </div>
                                    <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {stageTasks.length}
                                    </span>
                                </div>

                                {/* Task Cards */}
                                <div className="p-3 overflow-y-auto space-y-3 flex-1 min-h-[150px]">
                                    {stageTasks.length === 0 ? (
                                        <div className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400">
                                            Geser task ke sini
                                        </div>
                                    ) : (
                                        stageTasks.map((t) => renderTaskCard(t))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}