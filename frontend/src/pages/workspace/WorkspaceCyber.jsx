import RBBBadge from '../../components/RBBBadge';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import toast from 'react-hot-toast';
import { cyberQueue, pentesters, mockProjects } from '../../data/mockData';
import {
    Shield,
    FolderOpen,
    Link as LinkIcon,
    Copy,
    Send,
    Ban,
    User,
    Clock,
    Calendar,
    ChevronRight,
    Search,
    Bell,
    History,
    HelpCircle,
    FileText,
    File,
    CheckCircle,
    AlertCircle,
    Eye,
    MoreVertical,
    Users,
    Filter,
    Inbox,
    ChevronDown,
    XCircle,
    ShieldAlert,
    AlertTriangle,
    ArrowRight,
    UserCheck,
    X,
} from 'lucide-react';

export default function WorkspaceCyber() {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const [queueList, setQueueList] = useState([...cyberQueue]);
    const [selectedProject, setSelectedProject] = useState(queueList[0] || null);
    const [selectedPentester, setSelectedPentester] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [instructions, setInstructions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal States
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const handleAssign = () => {
        if (!selectedPentester) {
            toast.error('Pilih Pentester terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            addNotification(
                'Tugas Cyber Ditugaskan',
                `${selectedPentester} ditugaskan untuk audit ${selectedProject?.projectName}.`,
                'success',
                '/my-tasks/cyber'
            );
            toast.success(`Pengajuan cyber untuk ${selectedProject?.projectName} berhasil ditugaskan ke ${selectedPentester}`);
            setIsSubmitting(false);

            const updated = queueList.map(item => {
                if (item.id === selectedProject.id) {
                    return {
                        ...item,
                        status: 'In Progress',
                        assignedTo: selectedPentester,
                        targetDate: targetDate,
                        instructions: instructions,
                    };
                }
                return item;
            });

            setQueueList(updated);
            const current = updated.find(i => i.id === selectedProject.id);
            setSelectedProject(current);
            setSelectedPentester('');
            setTargetDate('');
            setInstructions('');
        }, 800);
    };

    const openRejectModal = () => {
        setRejectReason(instructions || 'Sistem Staging/API tidak dapat diakses atau Dokumen Arsitektur belum lengkap.');
        setIsRejectModalOpen(true);
    };

    const handleConfirmReject = (e) => {
        e.preventDefault();
        if (!rejectReason.trim()) {
            toast.error('Masukkan alasan penolakan audit siber!');
            return;
        }

        setIsSubmitting(true);

        setTimeout(() => {
            // Update status proyek di mockProjects
            const proj = mockProjects.find(p => p.name === selectedProject?.projectName);
            if (proj) {
                proj.status = 'RETURN TO DEV';
                proj.phase = 'Fase 2: Pengembangan';
                proj.statusColor = 'bg-red-100 text-red-700 border-red-200';
                proj.reworkNotes = `Cyber Audit Rejected: ${rejectReason}`;
            }

            addNotification(
                'Audit Siber Ditolak (RETURN TO DEV)',
                `Audit siber ${selectedProject?.projectName} ditolak & dikembalikan ke Tim Dev: ${rejectReason}`,
                'danger',
                '/track'
            );

            toast.error(`Pengajuan Audit Siber ditolak & dikembalikan ke Tim Dev.`);

            setIsSubmitting(false);
            setIsRejectModalOpen(false);

            const updated = queueList.map(item => {
                if (item.id === selectedProject.id) {
                    return {
                        ...item,
                        status: 'Dikembalikan ke Dev (Cyber Rejected)',
                        notes: rejectReason,
                    };
                }
                return item;
            });

            setQueueList(updated);
            const current = updated.find(i => i.id === selectedProject.id);
            setSelectedProject(current);
        }, 800);
    };

    const getStatusBadge = (status) => {
        if (!status) return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">Draft</span>;
        if (status.includes('Dikembalikan') || status.includes('Failed') || status.includes('Rejected') || status === 'RETURN TO DEV') {
            return (
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-red-200 flex items-center gap-1">
                    <XCircle size={12} className="text-red-600" />
                    {status}
                </span>
            );
        }
        switch (status) {
            case 'Menunggu Audit':
                return (
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock size={12} />
                        {status}
                    </span>
                );
            case 'In Progress':
                return (
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Shield size={12} />
                        {status}
                    </span>
                );
            case 'Selesai':
            case 'Clean':
                return (
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle size={12} />
                        {status}
                    </span>
                );
            default:
                return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">{status}</span>;
        }
    };

    if (!selectedProject) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Semua Pengajuan Siber Diproses</h2>
                    <p className="text-gray-500 mt-2">Tidak ada antrean audit siber yang menunggu saat ini.</p>
                </div>
            </div>
        );
    }

    const isRejected = selectedProject?.status?.includes('Dikembalikan') || selectedProject?.status?.includes('Failed') || selectedProject?.status?.includes('Rejected');

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Workspace Cyber Security</h2>
                <p className="text-gray-500 text-sm mt-1">
                    Kelola pengajuan audit Penetration Testing dan disposisi ke Pentester.
                </p>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
                {/* LEFT PANEL: Antrean Cyber */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <Inbox size={18} className="text-purple-600" />
                            Antrean Audit Siber ({queueList.length})
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                        {queueList.map((project) => {
                            const isSelected = selectedProject?.id === project.id;
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => {
                                        setSelectedProject(project);
                                        setSelectedPentester('');
                                        setTargetDate('');
                                        setInstructions('');
                                    }}
                                    className={`p-4 rounded-xl cursor-pointer transition-all ${isSelected
                                            ? 'bg-purple-50/60 border-2 border-purple-600 shadow-sm relative'
                                            : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-purple-700">{project.id}</span>
                                        {getStatusBadge(project.status)}
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm mb-2">{project.projectName}</h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <User size={14} />
                                        <span>Pengaju: {project.submittedBy || project.requester}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                        <Clock size={14} />
                                        <span>Submitted: {project.submittedAt}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT PANEL: Details & Form */}
                <div className="w-full lg:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    {/* Right Header */}
                    <div className="p-6 border-b border-gray-200 bg-gray-50/50 flex justify-between items-start flex-shrink-0">
                        <div>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded text-xs font-bold">
                                    {selectedProject.id}
                                </span>
                                {getStatusBadge(selectedProject.status)}
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">{selectedProject.projectName}</h3>
                            <p className="text-xs text-gray-500 mt-1">{selectedProject.projectDesc || selectedProject.description}</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                        {/* Banner Jika Audit Ditolak */}
                        {isRejected && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 shadow-xs space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                        <ShieldAlert size={22} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-red-800 text-sm">
                                            AUDIT SIBER DITOLAK &amp; DIKEMBALIKAN KE DEV (RETURN TO DEV)
                                        </h4>
                                        <p className="text-xs text-red-700 mt-1 leading-relaxed">
                                            Pengajuan audit siber ditolak. Proyek dikembalikan ke tim Dev untuk remediasi celah keamanan.
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white border border-red-200 rounded-lg p-3 text-xs text-gray-800 font-mono">
                                    "{selectedProject.notes || 'Ditemukan celah keamanan atau lingkungan uji staging belum dapat diakses secara utuh.'}"
                                </div>
                            </div>
                        )}

                        {/* Staging URL */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <LinkIcon size={18} className="text-gray-400" />
                                Target URL Staging Audit
                            </h4>
                            <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Shield size={18} className="text-purple-600" />
                                    <a href={selectedProject.stagingUrl} target="_blank" rel="noreferrer" className="text-purple-700 hover:underline text-sm font-medium">
                                        {selectedProject.stagingUrl}
                                    </a>
                                </div>
                                <button className="text-gray-400 hover:text-purple-600">
                                    <Copy size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Documents */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <FolderOpen size={18} className="text-gray-400" />
                                Dokumen Referensi Audit
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {selectedProject.documents.map((doc, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-lg p-3 flex items-start gap-3 bg-white hover:shadow-md transition-shadow">
                                        <div className="p-2 rounded bg-purple-50 text-purple-700">
                                            <FileText size={22} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                                            <p className="text-xs text-gray-500">{doc.size}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Disposisi Form */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <UserCheck size={18} className="text-purple-600" />
                                Disposisi Audit Penetration Testing
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                                        Pilih Pentester <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedPentester}
                                        onChange={(e) => setSelectedPentester(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                                    >
                                        <option value="">Pilih Pentester...</option>
                                        {pentesters.map((p) => (
                                            <option key={p.id} value={p.name}>
                                                {p.name} ({p.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Target Selesai Audit</label>
                                    <input
                                        type="date"
                                        value={targetDate}
                                        onChange={(e) => setTargetDate(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Instruksi / Catatan Audit</label>
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder="Petunjuk khusus pentest (misal: fokus modul payment gateway)..."
                                    rows={3}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 bg-white resize-none"
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                                <button
                                    onClick={openRejectModal}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 border border-red-500 text-red-600 font-bold rounded-lg text-sm hover:bg-red-50 transition-colors flex items-center gap-2 cursor-pointer"
                                >
                                    <X size={18} />
                                    Tolak &amp; Kembalikan ke Dev
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-purple-700 text-white font-bold rounded-lg text-sm hover:bg-purple-800 transition-colors flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-70"
                                >
                                    <UserCheck size={18} />
                                    {isSubmitting ? 'Memproses...' : 'Tugaskan Audit Siber'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL REJECT SIBER */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="bg-gradient-to-br from-red-600 to-rose-900 p-6 text-white text-center relative">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/20">
                                <ShieldAlert size={32} className="text-white animate-pulse" />
                            </div>
                            <h3 className="text-lg font-extrabold tracking-tight">KONFIRMASI PENOLAKAN AUDIT SIBER</h3>
                            <p className="text-xs text-white/80 mt-1">Kembalikan proyek ke Tim Pengembangan (RETURN TO DEV)</p>
                        </div>
                        <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
                            <div className="bg-red-50/60 border border-red-100 rounded-xl p-3.5 text-xs text-red-800">
                                <strong>Proyek:</strong> {selectedProject?.projectName} ({selectedProject?.id})
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Alasan Penolakan &amp; Catatan Remediasi <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Jelaskan alasan penolakan pengajuan audit siber..."
                                    rows={4}
                                    className="w-full p-3 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="flex-1 py-3 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    ❌ Batal / Cek Ulang
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-70"
                                >
                                    {isSubmitting ? 'Memproses...' : '🚨 Ya, Kembalikan ke Dev'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}