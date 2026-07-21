import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    Shield,
    ChevronRight,
    Search,
    Bell,
    Calendar,
    Link as LinkIcon,
    Send,
    Save,
    CloudUpload,
    Delete,
    CheckCircle,
    FileText,
    FileCheck,
    Eye,
    Lock,
    AlertTriangle,
    Clock,
    User,
    AlertCircle,
    MoreVertical,
    Upload,
    X,
    File,
    ShieldCheck,
    History,
    HelpCircle,
    FolderOpen,
    Copy,
} from 'lucide-react';
import { cyberTasks } from '../../data/mockData';

export default function MyTasksCyber() {
    const { user } = useAuth();
    const [selectedTask, setSelectedTask] = useState(cyberTasks[0]);
    const [securityStatus, setSecurityStatus] = useState('');
    const [notes, setNotes] = useState('');
    const [uploadedFile, setUploadedFile] = useState({
        name: 'Pentest_Report_LOS_Final.pdf',
        size: '3.2 MB',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = () => {
        if (!securityStatus) {
            alert('Pilih status keamanan sistem!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            alert(`Hasil audit keamanan untuk ${selectedTask?.projectName} berhasil dikirim!`);
            setIsSubmitting(false);
            const index = cyberTasks.indexOf(selectedTask);
            if (index > -1) cyberTasks.splice(index, 1);
            if (cyberTasks.length > 0) {
                setSelectedTask(cyberTasks[0]);
                setSecurityStatus('');
                setNotes('');
                setUploadedFile(null);
            } else {
                setSelectedTask(null);
            }
        }, 1500);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile({
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
            });
        }
    };

    const handleRemoveFile = () => {
        setUploadedFile(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            setUploadedFile({
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
            });
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const getStatusBadge = (status) => {
        if (status === 'In Progress') {
            return (
                <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border border-amber-200">
                    In Progress
                </span>
            );
        }
        return (
            <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">
                {status}
            </span>
        );
    };

    const getDocumentBadge = (type) => {
        switch (type) {
            case 'Verified':
                return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">Verified</span>;
            case 'QA Passed':
                return <span className="px-2 py-0.5 bg-blue-100 text-[#1A56DB] text-[10px] font-bold rounded uppercase">QA Passed</span>;
            case 'Draft':
                return <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded uppercase">Draft</span>;
            default:
                return null;
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
                    <p className="text-gray-500 mt-2">Tidak ada tugas penetrasi yang sedang dikerjakan.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8f9fb] overflow-hidden">
            {/* Topbar */}
            <header className="h-16 bg-white shadow-sm border-b border-gray-200 flex justify-between items-center px-6 shrink-0 z-10">
                <div className="flex items-center text-sm font-medium text-gray-500">
                    <span className="hover:text-[#1A56DB] cursor-pointer">Beranda</span>
                    <ChevronRight size={16} className="mx-2 text-gray-300" />
                    <span>Fase 3</span>
                    <ChevronRight size={16} className="mx-2 text-gray-300" />
                    <span className="text-gray-800 font-semibold">Tugas Siber Saya</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative hidden md:block">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari tugas..."
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none w-64 bg-gray-50 transition-all"
                        />
                    </div>
                    <button className="relative p-2 text-gray-500 hover:text-[#1A56DB] transition-colors rounded-full hover:bg-gray-100">
                        <Bell size={20} />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                    </button>
                    <div className="w-9 h-9 rounded-full bg-[#1A56DB] text-white flex items-center justify-center font-bold text-sm shadow-sm ml-2 border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity">
                        {user?.name?.charAt(0) || 'R'}
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Workspace Keamanan Siber (Cyber)</h1>
                    <p className="text-sm text-gray-500">Daftar tugas penetrasi (pentest) dan pelaporan hasil audit keamanan.</p>
                </div>

                {/* Split Layout */}
                <div className="flex-1 flex gap-6 min-h-0">
                    {/* LEFT PANEL */}
                    <div className="w-1/3 flex flex-col gap-4">
                        <h2 className="font-semibold text-gray-800 flex items-center justify-between">
                            Tugas Pentest Saya
                            <span className="bg-blue-100 text-[#1A56DB] text-xs px-2 py-1 rounded-full">{cyberTasks.length}</span>
                        </h2>
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {cyberTasks.map((task) => (
                                <div
                                    key={task.id}
                                    onClick={() => {
                                        setSelectedTask(task);
                                        setSecurityStatus('');
                                        setNotes('');
                                    }}
                                    className={`bg-white rounded-xl p-4 shadow-sm border-2 cursor-pointer transition-all hover:shadow-md ${selectedTask?.id === task.id
                                        ? 'border-[#1A56DB]'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="px-2 py-1 bg-blue-100 text-[#1A56DB] text-xs font-semibold rounded">
                                            {task.status}
                                        </span>
                                        <div className="flex items-center gap-1 text-red-500 text-xs font-medium">
                                            <Clock size={14} />
                                            {task.deadline}
                                        </div>
                                    </div>
                                    <div className="text-xs font-semibold text-gray-500 mb-1">{task.id}</div>
                                    <h3 className="font-semibold text-gray-800 mb-2">{task.projectName}</h3>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        {/* Detail Header */}
                        <div className="p-6 border-b border-gray-200 bg-gray-50/50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-xs font-semibold text-[#1A56DB] mb-1 font-mono">{selectedTask.id}</div>
                                    <h2 className="text-xl font-bold text-gray-800">{selectedTask.projectName}</h2>
                                </div>
                                {getStatusBadge(selectedTask.status)}
                            </div>
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Lead Note */}
                            {selectedTask.leadNote && (
                                <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex gap-3 items-start border border-amber-200">
                                    <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-sm">Instruksi Ketua:</p>
                                        <p className="text-sm text-amber-700/80">{selectedTask.leadNote}</p>
                                    </div>
                                </div>
                            )}

                            {/* Target URL */}
                            <div>
                                <label className="font-semibold text-sm text-gray-700 block mb-2">Target URL</label>
                                <a href={selectedTask.stagingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#1A56DB] hover:underline text-sm">
                                    <LinkIcon size={16} />
                                    {selectedTask.stagingUrl}
                                </a>
                            </div>

                            {/* Reference Documents */}
                            <div className="pt-4 border-t border-gray-200">
                                <label className="font-semibold text-sm text-gray-700 block mb-3">Pratinjau Dokumen Referensi</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {selectedTask.documents.map((doc, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                {doc.type === 'Verified' && <FileCheck size={18} className="text-emerald-500" />}
                                                {doc.type === 'QA Passed' && <ShieldCheck size={18} className="text-[#1A56DB]" />}
                                                {doc.type === 'Draft' && <FileText size={18} className="text-gray-400" />}
                                                <div>
                                                    <p className="font-medium text-sm text-gray-800">{doc.name}</p>
                                                    <p className="text-[10px] text-gray-500">{doc.size}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                {getDocumentBadge(doc.type)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Form */}
                            <div className="space-y-4 pt-4 border-t border-gray-200">
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-2">
                                        Status Keamanan Sistem <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={securityStatus}
                                        onChange={(e) => setSecurityStatus(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] px-4 py-2.5"
                                    >
                                        <option value="">Pilih status akhir...</option>
                                        <option value="aman">Aman (Tidak ditemukan celah kritikal)</option>
                                        <option value="rentan">Rentan (Perlu perbaikan segera)</option>
                                        <option value="kritis">Kritis (Sistem tidak layak rilis)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-2">
                                        Catatan Teknis Kerentanan
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Tuliskan temuan teknis secara singkat..."
                                        rows={4}
                                        className="w-full rounded-lg border border-gray-300 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] px-4 py-3 resize-none"
                                    />
                                </div>
                            </div>

                            {/* Upload */}
                            <div className="pt-4 border-t border-gray-200">
                                <label className="font-semibold text-sm text-gray-700 block mb-2">
                                    Laporan Pentest Lengkap <span className="text-red-500">*</span>
                                </label>
                                <div
                                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer ${uploadedFile ? 'border-emerald-300' : 'border-gray-300'
                                        }`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onClick={() => document.getElementById('pentest-upload')?.click()}
                                >
                                    {uploadedFile ? (
                                        <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm w-full max-w-md mx-auto">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 rounded bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex flex-col items-start min-w-0">
                                                    <span className="font-medium text-sm text-gray-800 truncate max-w-full">
                                                        {uploadedFile.name}
                                                    </span>
                                                    <span className="text-xs text-gray-500">{uploadedFile.size}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pl-2">
                                                <CheckCircle size={18} className="text-emerald-500" />
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <CloudUpload size={40} className="text-gray-400 mx-auto mb-3" />
                                            <p className="text-sm text-gray-600 font-medium mb-1">Tarik &amp; Lepas Dokumen Hasil Pentest</p>
                                            <p className="text-sm text-gray-400">atau klik untuk mencari file (PDF, DOCX, ZIP max 50MB)</p>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        id="pentest-upload"
                                        className="hidden"
                                        accept=".pdf,.docx,.zip"
                                        onChange={handleFileUpload}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-gray-200 bg-gray-50/50 shrink-0 flex justify-end gap-4">
                            <button className="px-4 py-2 rounded-lg font-semibold text-[#1A56DB] bg-white border border-[#1A56DB] hover:bg-blue-50 transition-colors text-sm flex items-center gap-2">
                                <Save size={16} />
                                Simpan Draft
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-6 py-2 rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <Send size={16} />
                                {isSubmitting ? 'Memproses...' : 'Kirim Hasil Audit Keamanan'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}