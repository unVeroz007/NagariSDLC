import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
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
    Check,
    X,
} from 'lucide-react';
import { myQaTasks, processQaResult } from '../../data/mockData';

export default function MyTasksQA() {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
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
            processQaResult(selectedTask.id, qaResult, qaNotes);
            const isFailed = qaResult === 'Failed';

            addNotification(
                isFailed ? 'Pengujian QA Ditolak (RETURN TO DEV)' : 'Pengujian QA Lulus (QA PASSED)',
                `Pengujian QA untuk ${selectedTask?.projectName} selesai: ${qaResult}. ${isFailed ? 'Proyek dikembalikan ke Tim Dev.' : ''}`,
                isFailed ? 'danger' : 'success',
                '/track'
            );

            alert(
                isFailed
                    ? `⚠️ HASIL DITOLAK (FAILED)!\n\nProyek "${selectedTask?.projectName}" telah dikembalikan ke Tim Pengembangan (RETURN TO DEV) untuk dilakukan perbaikan (rework).`
                    : `✅ HASIL LULUS (PASSED)!\n\nPengujian QA untuk "${selectedTask?.projectName}" berhasil diselesaikan.`
            );
            setIsSubmitting(false);

            const index = myQaTasks.indexOf(selectedTask);
            if (index > -1) myQaTasks.splice(index, 1);
            if (myQaTasks.length > 0) {
                setSelectedTask(myQaTasks[0]);
                setQaResult('');
                setQaNotes('');
            } else {
                setSelectedTask(null);
            }
        }, 1200);
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
            case 'Selesai (QA Passed)':
                return 'bg-green-500/20 text-green-600 border-green-200';
            case 'Dikembalikan ke Dev (QA Failed)':
                return 'bg-red-500/20 text-red-600 border-red-200';
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
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
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
                                            {task.priority}
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Clock size={12} />
                                            {task.targetDate}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Task Details & Form */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        {/* Task Header */}
                        <div className="p-6 border-b border-gray-200 bg-gray-50/50 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-[#1A56DB] tracking-wider uppercase">{selectedTask.id}</span>
                                    <h2 className="text-xl font-bold text-gray-800 mt-1">{selectedTask.projectName}</h2>
                                </div>
                                <span className={`px-3 py-1 text-xs font-bold rounded-md uppercase border ${getPriorityColor(selectedTask.priority)}`}>
                                    {selectedTask.priority} Priority
                                </span>
                            </div>

                            {/* Staging URL */}
                            <div className="flex items-center gap-2 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                                <LinkIcon size={16} className="text-[#1A56DB]" />
                                <span className="text-xs text-gray-500 font-medium">Staging URL:</span>
                                <a href={selectedTask.stagingUrl} target="_blank" rel="noreferrer" className="text-xs text-[#1A56DB] font-bold hover:underline truncate">
                                    {selectedTask.stagingUrl}
                                </a>
                            </div>

                            {/* Instruction Note */}
                            {selectedTask.instruction && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
                                    <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-bold block mb-0.5">Instruksi Pengujian (dari QA Lead):</span>
                                        {selectedTask.instruction}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Form Section */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Status radio selection */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    Status Hasil Pengujian (Overall) <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <label
                                        className={`relative flex items-center p-3.5 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors ${qaResult === 'Passed'
                                                ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
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
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${qaResult === 'Passed' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                                                }`}>
                                                {qaResult === 'Passed' && <Check size={14} className="text-white" />}
                                            </div>
                                            <div>
                                                <span className={`font-bold text-sm block ${qaResult === 'Passed' ? 'text-emerald-700' : 'text-gray-800'}`}>
                                                    Passed (Lulus)
                                                </span>
                                                <span className="text-[11px] text-gray-500">SIT &amp; UAT Berhasil</span>
                                            </div>
                                        </div>
                                    </label>

                                    <label
                                        className={`relative flex items-center p-3.5 border rounded-xl cursor-pointer hover:bg-red-50/60 transition-colors ${qaResult === 'Failed'
                                                ? 'border-red-500 bg-red-50 ring-2 ring-red-500/20'
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
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${qaResult === 'Failed' ? 'border-red-500 bg-red-500' : 'border-gray-300'
                                                }`}>
                                                {qaResult === 'Failed' && <X size={14} className="text-white" />}
                                            </div>
                                            <div>
                                                <span className={`font-bold text-sm block ${qaResult === 'Failed' ? 'text-red-600' : 'text-gray-800'}`}>
                                                    Failed (Ditolak)
                                                </span>
                                                <span className="text-[11px] text-gray-500">Return to Dev / Rework</span>
                                            </div>
                                        </div>
                                    </label>

                                    <label
                                        className={`relative flex items-center p-3.5 border rounded-xl cursor-pointer hover:bg-amber-50/60 transition-colors ${qaResult === 'Passed with Notes'
                                                ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20'
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
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${qaResult === 'Passed with Notes' ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                                                }`}>
                                                {qaResult === 'Passed with Notes' && <AlertCircle size={14} className="text-white" />}
                                            </div>
                                            <div>
                                                <span className={`font-bold text-sm block ${qaResult === 'Passed with Notes' ? 'text-amber-700' : 'text-gray-800'}`}>
                                                    Passed w/ Notes
                                                </span>
                                                <span className="text-[11px] text-gray-500">Lulus dengan catatan minor</span>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Notes Textarea */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Catatan / Temuan Pengujian (Defect / Bug Report) <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={qaNotes}
                                    onChange={(e) => setQaNotes(e.target.value)}
                                    placeholder="Deskripsikan temuan bug, steps to reproduce, atau alasan pengembalian ke tim Dev..."
                                    rows={4}
                                    className="w-full p-3.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none resize-y bg-white"
                                />
                            </div>

                            {/* Document Upload */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Lampiran Laporan (UAT/SIT Report)
                                </label>
                                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50 text-center">
                                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-xs w-full max-w-md mx-auto">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-9 h-9 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                                <FileText size={18} />
                                            </div>
                                            <div className="flex flex-col items-start min-w-0">
                                                <span className="font-semibold text-xs text-gray-800 truncate">
                                                    UIT_Report_LOS_Dimas.pdf
                                                </span>
                                                <span className="text-[10px] text-gray-400">2.4 MB • Ready</span>
                                            </div>
                                        </div>
                                        <CheckCircle size={18} className="text-emerald-500" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50/50 shrink-0 flex justify-end gap-3">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`px-6 py-3 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-70 ${qaResult === 'Failed'
                                        ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                    }`}
                            >
                                <Send size={18} />
                                <span>{isSubmitting ? 'Memproses...' : qaResult === 'Failed' ? 'Tolak & Kembalikan ke Dev' : 'Kirim Hasil Pengujian'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}