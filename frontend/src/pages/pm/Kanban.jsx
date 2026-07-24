import { useState } from 'react';
import RBBBadge from '../../components/RBBBadge';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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

                <h4 className="font-semibold text-gray-800 mb-2 text-sm">{task.title}</h4>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{task.description}</p>

                {/* Labels */}
                {task.labels && task.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                        {task.labels.map((label, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-600 border border-gray-200"
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                )}

                {/* Rework Note */}
                {isRework && task.reworkNote && (
                    <div className="bg-white/70 p-2 rounded text-xs text-red-600 mb-3 border border-red-200 flex gap-2">
                        <MessageSquare size={14} className="shrink-0 mt-0.5" />
                        <span>{task.reworkNote}</span>
                    </div>
                )}

                {/* Subtasks Progress */}
                {task.subtasks && (
                    <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-semibold">
                            <span>Subtasks</span>
                            <span>{task.subtasks.done}/{task.subtasks.total}</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${task.subtasks.done === task.subtasks.total
                                    ? 'bg-green-500'
                                    : 'bg-blue-500'
                                    }`}
                                style={{ width: `${(task.subtasks.done / task.subtasks.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100">
                    <div className="flex -space-x-2">
                        {task.assignee ? (
                            <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                {getInitials(task.assignee)}
                            </div>
                        ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
                                <User size={12} />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                        {task.attachments > 0 && (
                            <span className="flex items-center gap-0.5">
                                <Paperclip size={12} />
                                {task.attachments}
                            </span>
                        )}
                        {task.comments > 0 && (
                            <span className="flex items-center gap-0.5">
                                <MessageSquare size={12} />
                                {task.comments}
                            </span>
                        )}
                        {task.timeEstimate && (
                            <span className="flex items-center gap-0.5">
                                <Clock size={12} />
                                {task.timeEstimate}
                            </span>
                        )}
                        {task.priority && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Render Column
    const renderColumn = (stageId) => {
        const stage = kanbanStages.find((s) => s.id === stageId);
        const stageTasks = tasksByStage[stageId] || [];
        const isActive = stageId === 'desain' || stageId === 'analisis';
        const isLocked = stageId === 'deployment';
        const isEmpty = stageTasks.length === 0;

        let columnClasses = 'w-80 flex flex-col max-h-full rounded-xl border shrink-0 shadow-sm';
        if (stageId === 'desain') {
            columnClasses += ' bg-blue-50/50 border-2 border-primary-fixed-dim shadow-md';
        } else if (isLocked) {
            columnClasses += ' bg-gray-100/50 border-gray-300';
        } else {
            columnClasses += ' bg-white/50 border-gray-200';
        }

        return (
            <div
                key={stageId}
                className={columnClasses}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stageId)}
            >
                <div
                    className={`p-4 border-b rounded-t-xl flex justify-between items-center sticky top-0 z-10 ${stageId === 'desain'
                        ? 'bg-white border-primary-fixed-dim'
                        : isLocked
                            ? 'bg-gray-100/80 border-gray-300'
                            : 'bg-white border-gray-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${stage.color} ${stageId === 'desain' ? 'animate-pulse' : ''}`} />
                        <h3 className={`font-semibold text-gray-800 ${stageId === 'desain' ? 'text-primary' : ''}`}>
                            {stage.label}
                        </h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${stageId === 'desain'
                        ? 'bg-[#1A56DB] text-white'
                        : 'bg-gray-200 text-gray-600'
                        }`}>
                        {stageTasks.length}
                    </span>
                </div>

                <div className="p-3 flex-1 overflow-y-auto kanban-scroll flex flex-col gap-3 min-h-[200px] max-h-[calc(100vh-280px)]">
                    {isEmpty ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg bg-white/50 p-6">
                            {isLocked ? (
                                <>
                                    <Lock size={24} className="text-gray-400" />
                                    <p className="text-sm text-gray-400 text-center">Locked by Release Manager</p>
                                </>
                            ) : (
                                <>
                                    <Inbox size={24} className="text-gray-400" />
                                    <p className="text-sm text-gray-400 text-center">No active tasks</p>
                                </>
                            )}
                        </div>
                    ) : (
                        stageTasks.map((task) => renderTaskCard(task))
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F7F8FA] animate-slide-up">

            {/* Main Content */}
            <main className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex flex-col">
                {/* Page Header & Board Controls */}
                <div className="flex justify-between items-end mb-5 shrink-0 w-full flex-wrap gap-3">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-800">Global Project Flow</h2>
                        <p className="text-sm text-gray-400 mt-0.5">Papan Kanban — kelola tiket secara visual</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Search */}
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari tiket..."
                                className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none w-44 transition-all focus:w-64 shadow-sm focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                            />
                        </div>
                        <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 shadow-sm gap-0.5">
                            {[['active', 'Aktif'], ['completed', 'Selesai'], ['all', 'Semua']].map(([val, label]) => (
                                <button
                                    key={val}
                                    onClick={() => setFilter(val)}
                                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                                        filter === val ? 'bg-[#1A56DB] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button className="flex items-center gap-2 bg-[#003a73] text-white px-4 py-2.5 rounded-xl font-bold hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 text-sm btn-shimmer">
                            <Plus size={15} />
                            Tiket Baru
                        </button>
                    </div>
                </div>

                {/* Kanban Board Container - scroll horizontal dengan kolom seimbang */}
                <div className="flex-1 flex gap-4 pb-4 overflow-x-auto min-h-[500px]">
                    {stageOrder.map((stageId) => renderColumn(stageId))}
                </div>
            </main>
        </div>
    );
}