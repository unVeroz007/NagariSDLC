import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    Search,
    Bell,
    ChevronRight,
    Send,
    Save,
    Eye,
    Link as LinkIcon,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle,
    XCircle,
    AlertCircle,
    Info,
    FileText,
    Table,
    File,
    Download,
    Upload,
    Trash2,
    User,
    Users,
    Folder,
    Check,
    X,
} from 'lucide-react';
import { myQaTasks } from '../../data/mockData';

export default function MyTasksQA() {
    const { user } = useAuth();
    const [selectedTask, setSelectedTask] = useState(myQaTasks[0]);
    const [qaResult, setQaResult] = useState('');
    const [qaNotes, setQaNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = () => {
        if (!qaResult) {
            alert('Pilih status hasil pengujian!');
            return;
        }
        if (!qaNotes.trim()) {
            alert('Masukkan catatan pengujian!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            alert(`Hasil pengujian untuk ${selectedTask?.projectName} berhasil dikirim!\nStatus: ${qaResult}`);
            setIsSubmitting(false);
            // Remove from tasks
            const index = myQaTasks.indexOf(selectedTask);
            if (index > -1) myQaTasks.splice(index, 1);
            if (myQaTasks.length > 0) {
                setSelectedTask(myQaTasks[0]);
                setQaResult('');
                setQaNotes('');
            } else {
                setSelectedTask(null);
            }
        }, 1500);
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'High': return 'bg-red-500/10 text-red-600 border-red-200';
            case 'Medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
            case 'Low': return 'bg-green-500/10 text-green-600 border-green-200';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'In Progress':
                return 'bg-yellow-500/20 text-yellow-600 border-yellow-200';
            case 'Draft':
                return 'bg-gray-100 text-gray-500 border-gray-200';
            case 'Selesai':
                return 'bg-green-500/20 text-green-600 border-green-200';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'pdf': return { icon: FileText, color: 'text-red-600' };
            case 'docx': return { icon: FileText, color: 'text-blue-600' };
            case 'xlsx': return { icon: Table, color: 'text-green-600' };
            default: return { icon: File, color: 'text-gray-600' };
        }
    };

    if (!selectedTask) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Semua Tugas Selesai</h2>
                    <p className="text-gray-500 mt-2">Tidak ada tugas QA yang menunggu.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#f8f9fb] overflow-hidden">
            {/* Topbar */}
            <header className="h-16 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-6 shrink-0 z-10">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Beranda</span>
                    <ChevronRight size={16} />
                    <span>Fase 3</span>
                    <ChevronRight size={16} />
                    <span className="text-[#1A56DB] font-semibold">Tugas QA Saya</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari tiket..."
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] w-64 bg-gray-50"
                        />
                    </div>
                    <button className="p-2 text-gray-500 hover:text-[#1A56DB] transition-colors relative rounded-full hover:bg-gray-100">
                        <Bell size={20} />
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>
                    <div className="w-9 h-9 rounded-full bg-[#D4A017] text-white flex items-center justify-center font-bold text-sm cursor-pointer">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col gap-2 shrink-0">
                    <h1 className="text-2xl font-bold text-gray-800">Eksekusi Pengujian (QA)</h1>
                    <p className="text-sm text-gray-500">Daftar tugas pengujian sistem dan form pelaporan hasil (SIT/UAT).</p>
                </div>

                {/* Split Layout */}
                <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                    {/* LEFT: Task List */}
                    <div className="w-full lg:w-1/3 flex flex-col gap-4 bg-white rounded-xl shadow-sm p-4 overflow-hidden border border-gray-200 shrink-0 lg:shrink">
                        <div className="flex justify-between items-center mb-2 shrink-0">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                Tugas Saya <span className="bg-blue-50 text-[#1A56DB] px-2 py-0.5 rounded-full text-xs font-bold">{myQaTasks.length}</span>
                            </h2>
                        </div>
                        <div className="relative shrink-0">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Filter ID/Nama..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none bg-gray-50"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 mt-2 pr-1 pb-2">
                            {myQaTasks.map((task) => (
                                <div
                                    key={task.id}
                                    onClick={() => {
                                        setSelectedTask(task);
                                        setQaResult('');
                                        setQaNotes('');
                                    }}
                                    className={`p-4 rounded-lg cursor-pointer transition-all ${selectedTask?.id === task.id
                                            ? 'border-2 border-[#1A56DB] bg-blue-50/50 shadow-sm relative'
                                            : 'border border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
                                        }`}
                                >
                                    {selectedTask?.id === task.id && (
                                        <div className="absolute right-0 top-0 w-1 h-full bg-[#1A56DB] rounded-r-lg"></div>
                                    )}
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-[#1A56DB] tracking-wider">{task.id}</span>
                                        <span className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider ${getStatusBadge(task.status)}`}>
                                            {task.status}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-gray-800 mb-3 leading-tight">{task.projectName}</h3>
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md border ${getPriorityColor(task.priority)}`}>
                                            <AlertTriangle size={12} />
                                            {task.priority} Priority
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Calendar size={14} />
                                            H-{Math.ceil((new Date(task.targetDate) - new Date()) / (1000 * 60 * 60 * 24))}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Execution Form */}
                    <div className="w-full lg:w-2/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
                        {/* Form Header */}
                        <div className="p-5 border-b border-gray-200 bg-gray-50/50 shrink-0 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-2xl font-bold text-gray-800">{selectedTask.projectName}</h2>
                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wider border ${getStatusBadge(selectedTask.status)}`}>
                                        {selectedTask.status}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500">Ticket ID: <span className="font-mono text-gray-700">{selectedTask.id}</span></p>
                            </div>
                            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors shadow-sm">
                                <Eye size={18} />
                                Lihat Dokumen
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Info Box */}
                            {selectedTask.instruction && (
                                <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800">
                                    <Info size={24} className="mt-0.5 shrink-0" />
                                    <div>
                                        <h4 className="font-semibold text-sm mb-1">Instruksi Ketua QA ({selectedTask.assignedBy}):</h4>
                                        <p className="text-sm text-blue-700/80 leading-relaxed">{selectedTask.instruction}</p>
                                    </div>
                                </div>
                            )}

                            {/* Staging Info */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-gray-500">Environment Target</span>
                                    <div className="flex items-center gap-2">
                                        <LinkIcon size={18} className="text-gray-400" />
                                        <a href="#" className="text-[#1A56DB] font-medium hover:underline text-sm break-all">
                                            {selectedTask.stagingUrl}
                                        </a>
                                    </div>
                                </div>
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full border border-yellow-200 uppercase tracking-widest shadow-sm">
                                    Staging
                                </span>
                            </div>

                            <hr className="border-gray-200" />

                            {/* Execution Form */}
                            <div className="space-y-5">
                                <h3 className="text-lg font-semibold text-gray-800 border-l-4 border-[#1A56DB] pl-3">Laporan Hasil Pengujian</h3>

                                {/* Status Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Status Hasil (Overall) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <label
                                            className={`relative flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${qaResult === 'Passed'
                                                    ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                                                    : 'border-gray-200'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="qa_status"
                                                value="Passed"
                                                checked={qaResult === 'Passed'}
                                                onChange={(e) => setQaResult(e.target.value)}
                                                className="hidden"
                                            />
                                            <div className="flex items-center gap-3 w-full">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${qaResult === 'Passed' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                                                    }`}>
                                                    {qaResult === 'Passed' && <Check size={14} className="text-white" />}
                                                </div>
                                                <span className={`font-medium ${qaResult === 'Passed' ? 'text-green-600' : 'text-gray-700'}`}>
                                                    Passed
                                                </span>
                                            </div>
                                        </label>

                                        <label
                                            className={`relative flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${qaResult === 'Failed'
                                                    ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                                                    : 'border-gray-200'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="qa_status"
                                                value="Failed"
                                                checked={qaResult === 'Failed'}
                                                onChange={(e) => setQaResult(e.target.value)}
                                                className="hidden"
                                            />
                                            <div className="flex items-center gap-3 w-full">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${qaResult === 'Failed' ? 'border-red-500 bg-red-500' : 'border-gray-300'
                                                    }`}>
                                                    {qaResult === 'Failed' && <X size={14} className="text-white" />}
                                                </div>
                                                <span className={`font-medium ${qaResult === 'Failed' ? 'text-red-600' : 'text-gray-700'}`}>
                                                    Failed
                                                </span>
                                            </div>
                                        </label>

                                        <label
                                            className={`relative flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${qaResult === 'Passed with Notes'
                                                    ? 'border-yellow-500 bg-yellow-50 ring-1 ring-yellow-500'
                                                    : 'border-gray-200'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="qa_status"
                                                value="Passed with Notes"
                                                checked={qaResult === 'Passed with Notes'}
                                                onChange={(e) => setQaResult(e.target.value)}
                                                className="hidden"
                                            />
                                            <div className="flex items-center gap-3 w-full">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${qaResult === 'Passed with Notes' ? 'border-yellow-500 bg-yellow-500' : 'border-gray-300'
                                                    }`}>
                                                    {qaResult === 'Passed with Notes' && <AlertCircle size={14} className="text-white" />}
                                                </div>
                                                <span className={`font-medium ${qaResult === 'Passed with Notes' ? 'text-yellow-600' : 'text-gray-700'}`}>
                                                    Passed w/ Notes
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Notes Textarea */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex justify-between">
                                        Catatan Pengujian
                                        <span className="text-xs text-gray-400 font-normal">Markdown supported</span>
                                    </label>
                                    <textarea
                                        value={qaNotes}
                                        onChange={(e) => setQaNotes(e.target.value)}
                                        placeholder="Deskripsikan temuan, steps to reproduce bug (jika ada), atau catatan khusus lainnya..."
                                        rows={5}
                                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none resize-y bg-white"
                                    />
                                </div>

                                {/* Document Upload */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Lampiran Bukti Pengujian (UAT/SIT Report) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50 text-center hover:bg-gray-100/50 transition-colors relative">
                                        <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm w-full max-w-md mx-auto">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 rounded bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex flex-col items-start min-w-0">
                                                    <span className="font-medium text-sm text-gray-800 truncate max-w-full">
                                                        UIT_Report_LOS_Dimas.pdf
                                                    </span>
                                                    <span className="text-xs text-gray-500">2.4 MB</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pl-2">
                                                <CheckCircle size={20} className="text-green-500" />
                                                <button className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-5 border-t border-gray-200 bg-gray-50/50 shrink-0 flex justify-end gap-3">
                            <button className="px-5 py-2.5 bg-white border border-[#1A56DB] text-[#1A56DB] font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2">
                                <Save size={18} />
                                Simpan Draft
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <Send size={18} />
                                {isSubmitting ? 'Memproses...' : 'Kirim Hasil & Selesai'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}