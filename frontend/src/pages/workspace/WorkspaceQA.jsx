import RBBBadge from '../../components/RBBBadge';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    Users,
    UserPlus,
    Calendar,
    Clock,
    FileText,
    Folder,
    Link,
    Copy,
    Eye,
    Send,
    Check,
    X,
    MoreVertical,
    Search,
    Bell,
    Inbox,
    AlertCircle,
    ChevronRight,
    FileCheck,
    FileSpreadsheet,
    File,
    User,
    CalendarDays,
    CheckCircle,
    XCircle,
    Clock3,
    ListTodo,
    UserCheck,
    Award,
    Building,
} from 'lucide-react';

// Mock data untuk antrean QA
const qaQueue = [
    {
        id: 'QA-REQ-2026-0842',
        projectName: 'Aplikasi LOS Baru',
        projectId: 'PRJ-2026-088',
        pm: 'Budi Santoso',
        submittedAt: '2026-07-19T09:00:00',
        status: 'Menunggu Disposisi',
        priority: 'High',
        stagingUrl: 'https://staging-los.banknagari.co.id',
        documents: [
            { name: 'BRD_LOS_v1.2.pdf', type: 'pdf', size: '2.4 MB' },
            { name: 'FSD_LOS_Final.docx', type: 'docx', size: '1.8 MB' },
            { name: 'SIT_Report_LOS.xlsx', type: 'xlsx', size: '500 KB' },
        ],
        assignedTo: null,
        targetDate: null,
        notes: '',
    },
    {
        id: 'QA-REQ-2026-0841',
        projectName: 'Integrasi QRIS Mobile',
        projectId: 'PRJ-2026-089',
        pm: 'Dian Sastro',
        submittedAt: '2026-07-17T14:30:00',
        status: 'Menunggu Disposisi',
        priority: 'Medium',
        stagingUrl: 'https://staging-qris.banknagari.co.id',
        documents: [
            { name: 'BRD_QRIS_v2.0.pdf', type: 'pdf', size: '1.8 MB' },
            { name: 'FSD_QRIS_v2.0.docx', type: 'docx', size: '2.1 MB' },
        ],
        assignedTo: null,
        targetDate: null,
        notes: '',
    },
    {
        id: 'QA-REQ-2026-0840',
        projectName: 'Update Core Banking v2.4',
        projectId: 'PRJ-2026-093',
        pm: 'Rina Wati',
        submittedAt: '2026-07-15T10:00:00',
        status: 'Dalam Pengujian',
        priority: 'High',
        stagingUrl: 'https://staging-core.banknagari.co.id',
        documents: [
            { name: 'BRD_Core_v2.4.pdf', type: 'pdf', size: '3.2 MB' },
            { name: 'FSD_Core_v2.4.docx', type: 'docx', size: '2.8 MB' },
            { name: 'UAT_Plan_Core.xlsx', type: 'xlsx', size: '1.2 MB' },
        ],
        assignedTo: 'Dimas Anggara',
        targetDate: '2026-07-25',
        notes: 'Fokus pada modul tabungan dan integrasi API',
    },
];

// Daftar QA Tester
const qaTesters = [
    { id: 1, name: 'Dimas Anggara', load: 'Sedang' },
    { id: 2, name: 'Siti Rahmawati', load: 'Rendah' },
    { id: 3, name: 'Fajar Setiawan', load: 'Tinggi' },
];

export default function WorkspaceQA() {
    const { user } = useAuth();
    const [selectedRequest, setSelectedRequest] = useState(qaQueue[0]);
    const [assignee, setAssignee] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Menunggu Disposisi':
                return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Dalam Pengujian':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Selesai':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default:
                return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Menunggu Disposisi':
                return <Clock size={14} />;
            case 'Dalam Pengujian':
                return <UserCheck size={14} />;
            case 'Selesai':
                return <CheckCircle size={14} />;
            default:
                return <AlertCircle size={14} />;
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'High': return 'bg-red-100 text-red-700';
            case 'Medium': return 'bg-amber-100 text-amber-700';
            case 'Low': return 'bg-emerald-100 text-emerald-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'pdf':
                return { icon: FileText, color: 'text-red-500', bg: 'bg-red-50' };
            case 'docx':
                return { icon: File, color: 'text-blue-500', bg: 'bg-blue-50' };
            case 'xlsx':
                return { icon: FileSpreadsheet, color: 'text-emerald-500', bg: 'bg-emerald-50' };
            default:
                return { icon: File, color: 'text-gray-500', bg: 'bg-gray-50' };
        }
    };

    const handleAssign = () => {
        if (!assignee) {
            alert('Pilih QA Tester terlebih dahulu!');
            return;
        }
        if (!targetDate) {
            alert('Masukkan target selesai pengujian!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            alert(
                `Pengujian untuk ${selectedRequest?.projectName} berhasil ditugaskan ke ${assignee}!\nTarget Selesai: ${targetDate}`
            );
            setIsSubmitting(false);
            // Update status dan remove from queue
            const index = qaQueue.indexOf(selectedRequest);
            if (index > -1) {
                qaQueue[index].status = 'Dalam Pengujian';
                qaQueue[index].assignedTo = assignee;
                qaQueue[index].targetDate = targetDate;
                qaQueue[index].notes = notes;
            }
            // Reset form
            setAssignee('');
            setTargetDate('');
            setNotes('');
            // Refresh selected
            setSelectedRequest(qaQueue[index]);
        }, 1500);
    };

    const handleReject = () => {
        if (!confirm('Yakin ingin menolak pengajuan ini?')) return;
        const index = qaQueue.indexOf(selectedRequest);
        if (index > -1) {
            qaQueue.splice(index, 1);
            if (qaQueue.length > 0) {
                setSelectedRequest(qaQueue[0]);
            } else {
                setSelectedRequest(null);
            }
        }
        alert('Pengajuan ditolak dan dikembalikan ke PM.');
    };

    if (!selectedRequest) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Semua Pengajuan Telah Diproses</h2>
                    <p className="text-gray-500 mt-2">Tidak ada antrean pengujian yang menunggu.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Workspace Quality Assurance (QA)</h2>
                <p className="text-gray-500 text-sm mt-1">
                    Kelola antrean pengujian dan disposisi tugas ke anggota QA.
                </p>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
                {/* LEFT PANEL: Antrean Masuk */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <Inbox size={18} className="text-[#1A56DB]" />
                            Antrean Masuk ({qaQueue.length})
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                        {qaQueue.map((request) => {
                            const isSelected = selectedRequest?.id === request.id;
                            return (
                                <div
                                    key={request.id}
                                    onClick={() => {
                                        setSelectedRequest(request);
                                        setAssignee('');
                                        setTargetDate('');
                                        setNotes('');
                                    }}
                                    className={`p-4 rounded-lg cursor-pointer transition-all ${isSelected
                                        ? 'bg-blue-50 border-2 border-[#1A56DB] shadow-sm relative'
                                        : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-semibold text-[#1A56DB]">
                                            {request.id}
                                        </span>
                                        <span
                                            className={`text-xs font-semibold px-2 py-0.5 rounded border ${getStatusBadge(
                                                request.status
                                            )}`}
                                        >
                                            {request.status}
                                        </span>
                                    </div>
                                    <h4 className="font-semibold text-gray-800 text-sm mb-2">
                                        {request.projectName}
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <User size={14} />
                                        <span>Dari: {request.pm}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                                        <Clock size={14} />
                                        <span>
                                            {new Date(request.submittedAt).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                    {request.assignedTo && (
                                        <div className="mt-2 text-xs text-blue-600 font-medium">
                                            Assignee: {request.assignedTo}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT PANEL: Detail & Form */}
                <div className="w-full lg:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    {/* Header Right Panel */}
                    <div className="p-6 border-b border-gray-200 bg-gray-50/50 flex justify-between items-start flex-shrink-0">
                        <div>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="bg-blue-50 text-[#1A56DB] px-2 py-1 rounded text-xs font-bold">
                                    {selectedRequest.id}
                                </span>
                                <span
                                    className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 border ${getStatusBadge(
                                        selectedRequest.status
                                    )}`}
                                >
                                    {getStatusIcon(selectedRequest.status)}
                                    {selectedRequest.status}
                                </span>
                                <span
                                    className={`px-2 py-1 rounded text-xs font-bold ${getPriorityColor(
                                        selectedRequest.priority
                                    )}`}
                                >
                                    {selectedRequest.priority}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectedRequest.projectName}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <Building size={16} />
                                <span>ID: {selectedRequest.projectId}</span>
                                <span className="text-gray-300">|</span>
                                <User size={16} />
                                <span>PM: {selectedRequest.pm}</span>
                            </div>
                        </div>
                        <button className="text-gray-400 hover:text-[#1A56DB] transition-colors">
                            <MoreVertical size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                        {/* Staging Environment */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Link size={18} className="text-gray-400" />
                                Lingkungan Uji (Staging)
                            </h4>
                            <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Link size={18} className="text-[#1A56DB]" />
                                    <a
                                        href="#"
                                        className="text-[#1A56DB] hover:underline text-sm font-medium"
                                    >
                                        {selectedRequest.stagingUrl}
                                    </a>
                                </div>
                                <button className="text-gray-400 hover:text-[#1A56DB] transition-colors">
                                    <Copy size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Documents */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Folder size={18} className="text-gray-400" />
                                Dokumen Referensi
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {selectedRequest.documents.map((doc, idx) => {
                                    const { icon: Icon, color, bg } = getFileIcon(doc.type);
                                    return (
                                        <div
                                            key={idx}
                                            className="border border-gray-200 rounded-lg p-3 flex items-start gap-3 bg-white hover:shadow-md transition-shadow cursor-pointer group"
                                        >
                                            <div className={`p-2 rounded ${bg}`}>
                                                <Icon size={24} className={color} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">
                                                    {doc.name}
                                                </p>
                                                <p className="text-xs text-gray-500">{doc.size}</p>
                                            </div>
                                            <button className="text-gray-400 hover:text-[#1A56DB] transition-colors opacity-0 group-hover:opacity-100">
                                                <Eye size={18} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Assignment Form */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                <UserCheck size={18} className="text-[#1A56DB]" />
                                Form Disposisi Pengujian
                            </h4>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                                            Pilih Anggota QA <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={assignee}
                                            onChange={(e) => setAssignee(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white"
                                        >
                                            <option value="">Pilih QA Tester...</option>
                                            {qaTesters.map((tester) => (
                                                <option key={tester.id} value={tester.name}>
                                                    {tester.name} (Beban: {tester.load})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                                            Target Selesai Pengujian <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={targetDate}
                                            onChange={(e) => setTargetDate(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                                        Instruksi Khusus (Opsional)
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Masukkan instruksi khusus untuk tester..."
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white resize-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-4">
                                <button
                                    onClick={handleReject}
                                    className="px-4 py-2 border border-red-500 text-red-500 rounded-lg font-semibold text-sm hover:bg-red-50 transition-colors flex items-center gap-2"
                                >
                                    <X size={18} />
                                    Tolak Pengajuan
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-[#003a73] text-white rounded-lg font-semibold text-sm hover:bg-[#002a5a] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    <UserPlus size={18} />
                                    {isSubmitting ? 'Memproses...' : 'Tugaskan Pengujian'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}