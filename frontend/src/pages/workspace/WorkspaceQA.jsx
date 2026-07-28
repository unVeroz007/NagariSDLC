import RBBBadge from '../../components/RBBBadge';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import toast from 'react-hot-toast';
import { qaQueue, qaTesters, rejectQaRequest } from '../../data/mockData';
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
    AlertTriangle,
    ShieldAlert,
    ArrowRight,
} from 'lucide-react';

export default function WorkspaceQA() {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const [queueList, setQueueList] = useState([...qaQueue]);
    const [selectedRequest, setSelectedRequest] = useState(queueList[0] || null);
    const [assignee, setAssignee] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal States
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const getStatusBadge = (status) => {
        if (!status) return 'bg-gray-100 text-gray-600 border-gray-200';
        if (status.includes('Dikembalikan') || status.includes('Failed') || status.includes('Rejected') || status === 'RETURN TO DEV') {
            return 'bg-red-100 text-red-700 border-red-200 font-bold';
        }
        switch (status) {
            case 'Menunggu Disposisi':
                return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Dalam Pengujian':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Selesai':
            case 'Selesai (QA Passed)':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default:
                return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        if (!status) return <AlertCircle size={14} />;
        if (status.includes('Dikembalikan') || status.includes('Failed') || status.includes('Rejected')) {
            return <XCircle size={14} className="text-red-600" />;
        }
        switch (status) {
            case 'Menunggu Disposisi':
                return <Clock size={14} />;
            case 'Dalam Pengujian':
                return <UserCheck size={14} />;
            case 'Selesai':
            case 'Selesai (QA Passed)':
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
            toast.error('Pilih QA Tester terlebih dahulu!');
            return;
        }
        if (!targetDate) {
            toast.error('Masukkan target selesai pengujian!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            toast.success(`Pengujian ${selectedRequest?.projectName} berhasil ditugaskan ke ${assignee}!`);
            setIsSubmitting(false);

            const updated = queueList.map(item => {
                if (item.id === selectedRequest.id) {
                    return {
                        ...item,
                        status: 'Dalam Pengujian',
                        assignedTo: assignee,
                        targetDate: targetDate,
                        notes: notes || item.notes,
                    };
                }
                return item;
            });

            setQueueList(updated);
            const current = updated.find(i => i.id === selectedRequest.id);
            setSelectedRequest(current);
            setAssignee('');
            setTargetDate('');
            setNotes('');
        }, 800);
    };

    const openRejectModal = () => {
        setRejectReason(notes || 'Dokumen BRD/FSD atau Lingkungan Staging belum siap.');
        setIsRejectModalOpen(true);
    };

    const handleConfirmReject = (e) => {
        e.preventDefault();
        if (!rejectReason.trim()) {
            toast.error('Masukkan alasan penolakan proyek!');
            return;
        }

        setIsSubmitting(true);
        setTimeout(() => {
            rejectQaRequest(selectedRequest.id, rejectReason);

            addNotification(
                'Pengajuan QA Ditolak (RETURN TO DEV)',
                `Proyek ${selectedRequest?.projectName} ditolak & dikembalikan ke Tim Dev: ${rejectReason}`,
                'danger',
                '/track'
            );

            toast.error(`Pengajuan QA ditolak & dikembalikan ke Tim Dev.`);

            setIsSubmitting(false);
            setIsRejectModalOpen(false);

            const updated = queueList.map(item => {
                if (item.id === selectedRequest.id) {
                    return {
                        ...item,
                        status: 'Dikembalikan ke Dev (QA Rejected)',
                        notes: rejectReason,
                    };
                }
                return item;
            });

            setQueueList(updated);
            const current = updated.find(i => i.id === selectedRequest.id);
            setSelectedRequest(current);
        }, 800);
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

    const isRejected = selectedRequest?.status?.includes('Dikembalikan') || selectedRequest?.status?.includes('Failed') || selectedRequest?.status?.includes('Rejected');

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Workspace Quality Assurance (QA)</h2>
                <p className="text-gray-500 text-sm mt-1">
                    Kelola antrean pengujian, disposisi ke tester, atau kembalikan proyek ke Dev jika terdapat bug/penolakan.
                </p>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
                {/* LEFT PANEL: Antrean Masuk */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <Inbox size={18} className="text-[#1A56DB]" />
                            Antrean QA ({queueList.length})
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                        {queueList.map((request) => {
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
                                    className={`p-4 rounded-xl cursor-pointer transition-all ${isSelected
                                        ? 'bg-blue-50/60 border-2 border-[#1A56DB] shadow-sm relative'
                                        : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-[#1A56DB]">
                                            {request.id}
                                        </span>
                                        <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(
                                                request.status
                                            )}`}
                                        >
                                            {request.status}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm mb-2">
                                        {request.projectName}
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <User size={14} />
                                        <span>PM: {request.pm}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                        <Clock size={14} />
                                        <span>
                                            Submitted: {new Date(request.submittedAt).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'short',
                                            })}
                                        </span>
                                    </div>
                                    {request.assignedTo && (
                                        <div className="mt-2 text-xs text-blue-600 font-medium flex items-center gap-1">
                                            <UserCheck size={13} />
                                            <span>Tester: {request.assignedTo}</span>
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
                                <span className="bg-blue-50 text-[#1A56DB] px-2.5 py-1 rounded text-xs font-bold">
                                    {selectedRequest.id}
                                </span>
                                <span
                                    className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 border ${getStatusBadge(
                                        selectedRequest.status
                                    )}`}
                                >
                                    {getStatusIcon(selectedRequest.status)}
                                    {selectedRequest.status}
                                </span>
                                <span
                                    className={`px-2.5 py-1 rounded text-xs font-bold ${getPriorityColor(
                                        selectedRequest.priority
                                    )}`}
                                >
                                    {selectedRequest.priority} Priority
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectedRequest.projectName}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <Building size={16} />
                                <span>ID Proyek: {selectedRequest.projectId}</span>
                                <span className="text-gray-300">|</span>
                                <User size={16} />
                                <span>PM: {selectedRequest.pm}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                        {/* Banner Jika Proyek Ditolak / Returned to Dev */}
                        {isRejected && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 shadow-xs space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                        <AlertTriangle size={22} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-red-800 text-sm tracking-tight">
                                                LAPORAN HASIL QA: DITOLAK &amp; DIKEMBALIKAN (RETURN TO DEV)
                                            </h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 uppercase">
                                                Defect Report
                                            </span>
                                        </div>
                                        <p className="text-xs text-red-700 mt-1 leading-relaxed">
                                            Pengujian oleh Tester menghasilkan status <strong>FAILED</strong>. Proyek secara otomatis dikembalikan ke tim Pengembangan untuk perbaikan (*rework*).
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white border border-red-200 rounded-lg p-3 text-xs space-y-1.5 text-gray-700">
                                    <div className="flex justify-between font-semibold text-gray-800 pb-1 border-b border-gray-100">
                                        <span>Catatan / Temuan Bug dari Tester:</span>
                                        <span className="text-gray-500 font-normal">Tester: {selectedRequest.assignedTo || 'Dimas Anggara'}</span>
                                    </div>
                                    <p className="text-red-900 font-mono bg-red-50/50 p-2 rounded border border-red-100">
                                        "{selectedRequest.notes || 'Ditemukan defect/bug kritikal pada modul. Diperlukan koding perbaikan dan re-test.'}"
                                    </p>
                                    <div className="flex items-center justify-between pt-1 text-[11px] text-gray-500">
                                        <span>Lampiran Laporan: <strong>UIT_Report_LOS_Dimas.pdf (2.4 MB)</strong></span>
                                        <span className="text-[#1A56DB] font-bold hover:underline cursor-pointer">Lihat Laporan Dokumen PDF &rarr;</span>
                                    </div>
                                </div>
                            </div>
                        )}

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
                                        href={selectedRequest.stagingUrl}
                                        target="_blank"
                                        rel="noreferrer"
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
                                Dokumen Referensi Pengujian
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
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Assignment / Action Form */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                <UserCheck size={18} className="text-[#1A56DB]" />
                                Aksi &amp; Form Disposisi Pengujian QA
                            </h4>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                                            Pilih Anggota QA Tester <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={assignee}
                                            onChange={(e) => setAssignee(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white"
                                        >
                                            <option value="">Pilih QA Tester...</option>
                                            {qaTesters.map((tester) => (
                                                <option key={tester.id} value={tester.name}>
                                                    {tester.name} (Beban: {tester.load || 'Sedang'})
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
                                        Catatan / Instruksi Khusus / Alasan Penolakan
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Masukkan instruksi khusus atau alasan pengembalian ke tim Dev..."
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white resize-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-4">
                                <button
                                    onClick={openRejectModal}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 border border-red-500 text-red-600 rounded-lg font-bold text-sm hover:bg-red-50 transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                                >
                                    <X size={18} />
                                    Tolak &amp; Kembalikan ke Dev
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-[#003a73] text-white rounded-lg font-bold text-sm hover:bg-[#002a5a] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 cursor-pointer"
                                >
                                    <UserPlus size={18} />
                                    {isSubmitting ? 'Memproses...' : 'Tugaskan Pengujian'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL KONFIRMASI PENOLAKAN QA LEAD */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="bg-gradient-to-br from-red-600 to-rose-900 p-6 text-white text-center relative">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/20">
                                <ShieldAlert size={32} className="text-white animate-pulse" />
                            </div>
                            <h3 className="text-lg font-extrabold tracking-tight">KONFIRMASI PENOLAKAN QA</h3>
                            <p className="text-xs text-white/80 mt-1">Kembalikan proyek ke Tim Pengembangan (RETURN TO DEV)</p>
                        </div>
                        <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
                            <div className="bg-red-50/60 border border-red-100 rounded-xl p-3.5 text-xs text-red-800">
                                <strong>Proyek:</strong> {selectedRequest?.projectName} ({selectedRequest?.id})
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Alasan Penolakan &amp; Catatan Perbaikan <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Jelaskan kendala, defect, atau alasan pengembalian proyek ke Dev..."
                                    rows={4}
                                    className="w-full p-3 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-70"
                                >
                                    {isSubmitting ? 'Memproses...' : 'Ya, Kembalikan ke Dev'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}