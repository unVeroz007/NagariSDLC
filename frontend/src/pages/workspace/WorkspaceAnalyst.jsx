import RBBBadge from '../../components/RBBBadge';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
    Download,
    Eye,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    Send,
    Save,
    FileText,
    Users,
    Filter,
    Calendar,
    ChevronRight,
    Upload,
    CloudUpload,
    Trash2,
    File,
    Edit3,
    X,
} from 'lucide-react';
import { useProjects } from '../../contexts/ProjectContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

export default function WorkspaceAnalyst() {
    const { user } = useAuth();
    const { projects, updateProject, isLoading } = useProjects();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();

    const [previewDoc, setPreviewDoc] = useState(null);

    // Ambil queue review analis dari status IN_REVIEW atau DEV_ANALYSIS
    const reviewQueue = useMemo(() => {
        const list = projects.filter(p =>
            p.status === 'IN_REVIEW' ||
            p.status === 'DEV_ANALYSIS'
        );
        if (list.length === 0) {
            return [
                {
                    id: 'PRJ-2026-095',
                    name: 'Sistem Anti-Fraud Realtime',
                    division: 'Divisi Kepatuhan',
                    status: 'IN_REVIEW',
                    priority: 'High',
                    type: 'RBB',
                    rbbDeadline: '2026-10-31',
                    deadline: '2026-08-15T09:00:00Z',
                    submittedAt: '2026-07-25T10:00:00Z',
                    leadNote: 'Mohon fokus pada aspek mitigasi risiko transaksi anomali di atas Rp 100 Juta.',
                    documents: [
                        { type: 'brd', name: 'BRD_Sistem_AntiFraud_v1.2.pdf', size: '2.4 MB' },
                        { type: 'fsd', name: 'FSD_Rules_Engine_Draft.docx', size: '1.8 MB' }
                    ],
                    description: 'Sistem deteksi fraud dan pencatatan transaksi mencurigakan secara otomatis.'
                },
                {
                    id: 'PRJ-2026-097',
                    name: 'Sistem Pengaduan Nasabah (CRM & AI)',
                    division: 'Divisi Layanan',
                    status: 'DEV_ANALYSIS',
                    priority: 'Medium',
                    type: 'NON_RBB',
                    deadline: '2026-09-01T09:00:00Z',
                    submittedAt: '2026-07-24T14:00:00Z',
                    leadNote: 'Pastikan integrasi dengan WhatsApp Gateway dan CRM eksisting berjalan lancar.',
                    documents: [
                        { type: 'brd', name: 'BRD_Pengaduan_Nasabah_v2.pdf', size: '3.1 MB' }
                    ],
                    description: 'Integrasi saluran pengaduan nasabah dengan chatbot AI dan tiket otomatis.'
                }
            ];
        }
        return list;
    }, [projects]);

    const [selectedProjectState, setSelectedProjectState] = useState(null);
    const selectedProject = selectedProjectState || reviewQueue[0] || null;

    const [decision, setDecision] = useState('');
    const [projectType, setProjectType] = useState('NON_RBB');
    const [notes, setNotes] = useState('');
    const [estimationDays, setEstimationDays] = useState('30');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);

    // Format tanggal aman cegah Invalid Date
    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === 'TBD') return 'Terbaru';
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) return 'Terbaru';
        return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    };

    const handleSubmit = () => {
        if (!decision) {
            toast.error('Pilih keputusan review!');
            return;
        }
        if (!notes.trim()) {
            toast.error('Masukkan catatan analisis!');
            return;
        }
        setIsSubmitting(true);
        
        // Update project status based on decision
        const isApproved = decision.includes('Disetujui');
        const finalStatus = isApproved ? 'DEV_ANALYSIS_DONE' : 'REJECTED';

        updateProject(selectedProject.id, {
            status: finalStatus,
            statusColor: isApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200',
            analystDecision: decision,
            analystNotes: notes,
            analystResult: {
                decision,
                notes,
                estimation: estimationDays || '30',
                fsdFile: uploadedFile?.name || 'FSD_Technical_Specification.docx'
            },
            type: projectType,
            typeLabel: projectType === 'RBB' ? 'RBB (Wajib Selesai)' : 'Non-RBB (Fleksibel)'
        });

        addNotification(
            'Kajian Analyst Selesai',
            `Kajian teknis untuk ${selectedProject?.name} telah dirampungkan oleh Analyst (${user?.name || 'Citra Kirana'}) dengan status Siap Tunjuk PM.`,
            isApproved ? 'success' : 'warning',
            '/workspace/dev-lead'
        );
        toast.success(`Kajian teknis ${selectedProject?.name} selesai! Dikirim ke Ketua Grup Pengembangan.`);
        navigate('/workspace/dev-lead');
        setIsSubmitting(false);
        
        const nextQueue = reviewQueue.filter(p => p.id !== selectedProject.id);
        if (nextQueue.length > 0) {
            setSelectedProject(nextQueue[0]);
            setDecision('');
            setProjectType('NON_RBB');
            setNotes('');
            setUploadedFile(null);
        } else {
            setSelectedProject(null);
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'High': return 'bg-red-500/10 text-red-600 border-red-200';
            case 'Medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
            case 'Low': return 'bg-green-500/10 text-green-600 border-green-200';
            case 'ANALYSIS_APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'READY_FOR_DEVELOPMENT': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'IN_DEVELOPMENT': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'In Progress':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'New':
                return 'bg-gray-100 text-gray-600 border-gray-200';
            case 'ANALYSIS_APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'READY_FOR_DEVELOPMENT': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'IN_DEVELOPMENT': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    const getFileIcon = (type) => {
        const icons = {
            pdf: 'bg-red-100 text-red-600',
            docx: 'bg-blue-100 text-blue-600',
            xlsx: 'bg-green-100 text-green-600',
        };
        return icons[type] || 'bg-gray-100 text-gray-600';
    };

    const getFileLabel = (type) => {
        const labels = { pdf: 'PDF', docx: 'DOCX', xlsx: 'XLSX' };
        return labels[type] || type.toUpperCase();
    };

    // Hapus full-screen empty state return

    return (
        <div className="flex-1 overflow-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-800">Workspace System Analyst</h1>
                <p className="text-gray-500 mt-1 text-sm">
                    Review kelayakan dokumen inisiasi (BRD) dan buat keputusan teknis sistem.
                </p>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
                {/* LEFT PANEL: Inbox */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Tugas Review</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{reviewQueue.length} antrian menunggu</p>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors">
                            <Filter size={16} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/40">
                        {reviewQueue.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => setSelectedProject(project)}
                                className={`p-4 rounded-xl cursor-pointer transition-all relative overflow-hidden group ${
                                    selectedProject?.id === project.id
                                        ? 'bg-white border-2 border-[#1A56DB] shadow-md'
                                        : 'bg-white border border-gray-200 hover:border-[#1A56DB]/40 hover:shadow-md'
                                }`}
                            >
                                {selectedProject?.id === project.id && (
                                    <div className="absolute left-0 top-0 w-1 h-full bg-[#1A56DB] rounded-l-xl" />
                                )}
                                <div className="flex justify-between items-start mb-2.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(project.status)}`}>
                                        {project.status}
                                    </span>
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <Clock size={11} />
                                        {formatDate(project.deadline || project.submittedAt)}
                                    </span>
                                </div>
                                <div className="mb-2"><RBBBadge type={project.type} deadline={project.rbbDeadline} /></div>
                                <h4 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-[#1A56DB] transition-colors">{project.name}</h4>
                                <p className="text-xs text-gray-500 mb-2.5">Peminta: {project.division}</p>
                                {project.leadNote && (
                                    <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                                        <p className="text-xs italic text-gray-600 flex items-start gap-1.5">
                                            <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                            "{project.leadNote}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT PANEL: Review Form */}
                <div className="w-full lg:w-2/3 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    {!selectedProject ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-scale-in">
                            <div className="w-24 h-24 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 shadow-sm">
                                <CheckCircle size={48} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Semua Proyek Selesai Direview</h2>
                            <p className="text-gray-500 max-w-md mx-auto">
                                Tidak ada tugas review yang menunggu di antrean Anda saat ini.
                            </p>
                            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-3 inline-block text-emerald-700 text-sm font-medium">
                                Antrean kosong — Luar biasa! 🚀
                            </div>
                        </div>
                    ) : (
                        <>
                    {/* Header Detail */}
                    <div className="p-6 border-b border-gray-200 bg-gray-50/50 shrink-0">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-xs text-gray-500 font-bold tracking-wider uppercase block mb-1">Detail Proyek</span>
                                <h2 className="text-2xl font-bold text-gray-800">{selectedProject.name}</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-blue-50 text-[#1A56DB] font-bold px-3 py-1 rounded-lg border border-blue-100">
                                    {selectedProject.id}
                                </span>
                            </div>
                        </div>
                        {selectedProject.leadNote && (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mt-4 flex gap-3 text-amber-900 text-sm shadow-sm">
                                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                                <p className="text-sm"><strong>Instruksi Lead:</strong> {selectedProject.leadNote}</p>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Documents Inisiasi Peminta (Dynamic & Interactive) */}
                        <div className="mb-6 border-b border-gray-200 pb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <FileText size={20} className="text-[#1A56DB]" />
                                Dokumen Inisiasi Peminta
                            </h3>
                            <div className="space-y-3">
                                {(selectedProject.documents || [
                                    { name: 'BRD_Sistem_v1.0.pdf', size: '2.4 MB', type: 'pdf' },
                                    { name: 'FSD_Technical_Draft.docx', size: '1.8 MB', type: 'docx' }
                                ]).map((doc, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50 hover:border-gray-300 transition-all gap-3">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 text-sm">{doc.name}</p>
                                                <p className="text-xs text-gray-500">{doc.size || '1.8 MB'} • Dokumen Terlampir</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => setPreviewDoc(doc)}
                                                className="px-3.5 py-2 border border-[#1A56DB] text-[#1A56DB] rounded-xl font-semibold hover:bg-blue-50 transition-colors flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                                            >
                                                <Eye size={15} />
                                                View &amp; Baca
                                            </button>
                                            <button
                                                onClick={() => toast.success(`Mengunduh ${doc.name}...`)}
                                                className="px-3.5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                                                title="Unduh Dokumen"
                                            >
                                                <Download size={15} />
                                                Unduh
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Decision Form */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Hasil Review &amp; Keputusan Teknis</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Keputusan Review <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={decision}
                                        onChange={(e) => setDecision(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] appearance-none transition-all"
                                    >
                                        <option value="">Pilih Keputusan...</option>
                                        <option value="Disetujui (Layak Develop)">Disetujui (Layak Develop)</option>
                                        <option value="Disetujui dengan Penyesuaian">Disetujui dengan Penyesuaian</option>
                                        <option value="Ditolak">Ditolak</option>
                                    </select>
                                </div>

                                {/* Tipe Proyek */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">
                                        Tipe Proyek <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="projectType"
                                                value="RBB"
                                                checked={projectType === 'RBB'}
                                                onChange={(e) => setProjectType(e.target.value)}
                                                className="w-4 h-4 text-[#1A56DB] focus:ring-[#1A56DB]"
                                            />
                                            <span className="font-medium text-red-600">RBB (Wajib Selesai)</span>
                                            <span className="text-xs text-gray-400">— Target rigid, prioritas tinggi</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="projectType"
                                                value="NON_RBB"
                                                checked={projectType === 'NON_RBB'}
                                                onChange={(e) => setProjectType(e.target.value)}
                                                className="w-4 h-4 text-[#1A56DB] focus:ring-[#1A56DB]"
                                            />
                                            <span className="font-medium text-gray-600">Non-RBB (Fleksibel)</span>
                                            <span className="text-xs text-gray-400">— Deadline fleksibel</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Catatan Analisis Teknis <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Masukkan ringkasan analisis teknis, temuan, atau instruksi penyesuaian..."
                                        rows={4}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Upload FSD */}
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <Upload size={20} className="text-[#1A56DB]" />
                                Unggah Dokumen Analisis Teknis (FSD)
                            </h3>

                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-white hover:bg-gray-50 transition-colors cursor-pointer mb-4">
                                <CloudUpload size={40} className="text-gray-400 mb-2" />
                                <p className="font-semibold text-gray-700">Tarik &amp; Lepas file di sini, atau klik untuk unggah</p>
                                <p className="text-sm text-gray-500 mt-1">PDF, DOCX. Maksimal 5MB</p>
                            </div>

                            {/* Uploaded File (Tanpa tombol Trash) */}
                            <div className="flex items-center justify-between p-3.5 border border-emerald-500/30 bg-emerald-50/50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0">
                                        <CheckCircle size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">FSD_SpesifikasiTeknis_Draft.docx</p>
                                        <p className="text-xs text-gray-500">1.4 MB • Berhasil Diunggah</p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                                    Siap Ditingkatkan
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/30 shrink-0 flex justify-end gap-3">
                        <button className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-all flex items-center gap-2 text-sm">
                            <Save size={16} />
                            Simpan Draft
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20 text-sm btn-shimmer disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Memproses...</>
                            ) : (
                                <><Send size={16} /> Kirim &amp; Lanjutkan</>
                            )}
                        </button>
                    </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── MODAL VIEWER DOKUMEN RESMI SDLC BANK NAGARI ── */}
            {previewDoc && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl animate-scale-up border border-gray-200 my-8">
                        {/* Top Action Bar */}
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#003a73] text-white rounded-xl flex items-center justify-center font-black text-sm shadow-sm">
                                    BN
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">{previewDoc.name}</h3>
                                    <p className="text-xs text-gray-500">Tipe File: {previewDoc.size || '2.4 MB'} • Lembar Kerja Resmi SDLC</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toast.success(`Mengunduh dokumen asli ${previewDoc.name}...`)}
                                    className="px-3.5 py-1.5 bg-[#1A56DB] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                                >
                                    <Download size={14} /> Unduh File Asli
                                </button>
                                <button onClick={() => setPreviewDoc(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Document Body (Simulasi Tampilan Lembar Kerja Dokumen Asli) */}
                        <div className="bg-[#f8f9fb] border border-gray-200 rounded-xl p-6 sm:p-8 max-h-[60vh] overflow-y-auto space-y-6 text-gray-800 font-sans shadow-inner">
                            {/* Header Kop Surat Dokumen */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <span className="text-[10px] font-bold text-[#1A56DB] tracking-widest uppercase bg-blue-50 px-2.5 py-1 rounded border border-blue-100">
                                        SDLC BANK NAGARI ENTERPRISE
                                    </span>
                                    <h2 className="text-xl font-extrabold text-gray-900 mt-2">
                                        BUSINESS REQUIREMENT DOCUMENT (BRD)
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Proyek: <span className="font-semibold text-gray-800">{selectedProject?.name || 'Proyek SDLC'}</span> ({selectedProject?.id || 'PRJ-2026-095'})
                                    </p>
                                </div>
                                <div className="text-right text-xs text-gray-500 border-l sm:border-l-0 border-gray-200 pl-3 sm:pl-0">
                                    <p><strong>Status:</strong> <span className="text-emerald-600 font-bold">DRAFT KAJIAN</span></p>
                                    <p><strong>Versi:</strong> v1.0.2</p>
                                    <p><strong>Tanggal:</strong> {new Date().toLocaleDateString('id-ID')}</p>
                                </div>
                            </div>

                            {/* Bab 1: Latar Belakang */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-3">
                                <h4 className="font-bold text-sm text-[#003a73] uppercase tracking-wider border-b border-gray-100 pb-2">
                                    1. LATAR BELAKANG & TUJUAN BISNIS
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                                    {selectedProject?.description || 'Pengajuan kebutuhan pengembangan sistem baru untuk meningkatkan efisiensi operasional dan kualitas pelayanan nasabah di Bank Nagari.'}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <span className="font-bold text-gray-500 uppercase block mb-1">Divisi Pengusul</span>
                                        <span className="font-semibold text-gray-800">{selectedProject?.division || 'Divisi TI'}</span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <span className="font-bold text-gray-500 uppercase block mb-1">Prioritas Pelaksanaan</span>
                                        <span className="font-semibold text-[#1A56DB]">{selectedProject?.priority || 'High Priority'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bab 2: Lingkup Kebutuhan */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-3">
                                <h4 className="font-bold text-sm text-[#003a73] uppercase tracking-wider border-b border-gray-100 pb-2">
                                    2. RUANG LINGKUP & KEBUTUHAN FUNGSIONAL
                                </h4>
                                <ul className="list-disc pl-5 text-xs sm:text-sm text-gray-700 space-y-1.5">
                                    <li>Pengembangan modul utama dan integrasi antarmuka pengguna (UI/UX).</li>
                                    <li>Validasi data otomatis dan pencatatan audit trail transaksi sesuai standar TI Bank Nagari.</li>
                                    <li>Sistem otorisasi bertingkat (Maker, Checker, Approver) untuk keamanan akses.</li>
                                </ul>
                            </div>

                            {/* Bab 3: Kepatuhan Keamanan */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-3">
                                <h4 className="font-bold text-sm text-[#003a73] uppercase tracking-wider border-b border-gray-100 pb-2">
                                    3. KEPATUHAN KEAMANAN & REGULASI OJK
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                                    Proyek ini tunduk pada aturan POJK No.11/POJK.03/2022 tentang Penyelenggaraan Teknologi Informasi oleh Bank Umum. Seluruh enkripsi data menggunakan sertifikat TLS 1.3 dan standar keamanan Cyber Security Bank Nagari.
                                </p>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 text-xs">
                            <span className="text-gray-400 font-medium">SDLC Bank Nagari Enterprise • Viewer Dokumen</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPreviewDoc(null)}
                                    className="px-5 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                                >
                                    Tutup Viewer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}