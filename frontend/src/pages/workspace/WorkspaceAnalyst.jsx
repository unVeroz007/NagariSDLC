import RBBBadge from '../../components/RBBBadge';
import { useState, useMemo, useRef } from 'react';
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
    MessageSquare,
    UserCheck,
} from 'lucide-react';
import { useProjects, saveFileToStore } from '../../contexts/ProjectContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';

export default function WorkspaceAnalyst() {
    const { user } = useAuth();
    const { projects, updateProject, isLoading } = useProjects();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();

    const [previewDoc, setPreviewDoc] = useState(null);

    // Filter antrean proyek yang HANYA SUDAH ditugaskan oleh Lead Perencanaan (Status IN_REVIEW)
    const reviewQueue = useMemo(() => {
        return projects.filter(p =>
            p.status === 'IN_REVIEW' ||
            p.status === 'PLANNING_ANALYSIS' ||
            p.status === 'ANALYSIS_IN_PROGRESS'
        );
    }, [projects]);


    const [selectedProjectState, setSelectedProject] = useState(null);
    const selectedProject = selectedProjectState || reviewQueue[0] || null;

    const [decision, setDecision] = useState('');
    const [projectType, setProjectType] = useState('NON_RBB');
    const [notes, setNotes] = useState('');
    const [estimationDays, setEstimationDays] = useState('30');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            const MAX_SIZE = 5 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                toast.error(`Dokumen "${file.name}" ditolak karena ukurannya melebihi batas maksimal 5MB!`);
                e.target.value = '';
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            const fileObj = {
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
                type: 'fsd',
                doc_type: 'fsd',
                url: objectUrl,
                rawFile: file,
                uploadedAt: new Date().toISOString()
            };
            saveFileToStore(file.name, objectUrl);
            if (selectedProject?.id) {
                saveFileToStore(`fsd_${selectedProject.id}`, objectUrl);
            }
            setUploadedFile(fileObj);
            toast.success(`Dokumen FSD "${file.name}" berhasil diunggah.`);
        }
    };

    // Convert Data URL to Blob URL for inline PDF reading in Workspace Analyst
    const previewBlobUrl = useMemo(() => {
        if (!previewDoc) return null;
        const rawUrl = previewDoc.url || previewDoc.fileUrl || previewDoc.dataUrl;
        if (!rawUrl) return null;

        if (rawUrl.startsWith('data:')) {
            try {
                const parts = rawUrl.split(',');
                const mimeMatch = parts[0].match(/:(.*?);/);
                const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                const blob = new Blob([u8arr], { type: mime });
                return URL.createObjectURL(blob);
            } catch (e) {
                return rawUrl;
            }
        }
        return rawUrl;
    }, [previewDoc]);

    const handleDownloadFile = (doc) => {
        if (!doc) return;
        const rawUrl = doc.url || doc.fileUrl || doc.dataUrl;
        const fileName = doc.name || doc.file_name || 'Dokumen_SDLC.pdf';

        if (rawUrl) {
            const link = document.createElement('a');
            link.href = rawUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`Mengunduh file "${fileName}"...`);
        } else {
            const textContent = `PT BANK NAGARI - DOKUMEN RESMI SDLC\n=======================================\nNama Dokumen: ${fileName}\nProyek: ${selectedProject?.name || 'Proyek SDLC'}\nPengusul: ${selectedProject?.division || 'Divisi Inisiator'}\nTanggal: ${new Date().toLocaleDateString('id-ID')}\nStatus: Terverifikasi Quality Gate SDLC Bank Nagari`;
            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName.endsWith('.pdf') ? fileName.replace('.pdf', '_ringkasan.txt') : `${fileName}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success(`Mengunduh berkas ringkasan "${fileName}"...`);
        }
    };

    // Format tanggal aman cegah Invalid Date
    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === 'TBD') return 'Terbaru';
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) return 'Terbaru';
        return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    };

    const handleSubmit = async () => {
        if (!decision) {
            toast.error('Pilih keputusan review!');
            return;
        }
        if (!notes.trim()) {
            toast.error('Masukkan catatan analisis!');
            return;
        }
        setIsSubmitting(true);
        
        try {
            const isApproved = decision.includes('Disetujui');
            const finalStatus = isApproved ? 'ANALYSIS_APPROVED' : 'REJECTED';

            const fsdDoc = uploadedFile ? {
                id: `FSD-${Date.now()}`,
                name: uploadedFile.name,
                size: uploadedFile.size,
                type: 'fsd',
                doc_type: 'fsd',
                url: uploadedFile.url,
                uploadedAt: uploadedFile.uploadedAt || new Date().toISOString()
            } : (selectedProject?.documents?.[0] ? {
                ...selectedProject.documents[0],
                type: 'fsd',
                doc_type: 'fsd'
            } : {
                id: `FSD-${Date.now()}`,
                name: 'Dokumen_SDLC.pdf',
                size: '1.8 MB',
                type: 'fsd',
                doc_type: 'fsd',
                uploadedAt: new Date().toISOString()
            });

            const existingDocs = selectedProject?.documents || [];
            const newDocs = [fsdDoc, ...existingDocs.filter(d => d.type !== 'fsd')];

            await updateProject(selectedProject.id, {
                status: finalStatus,
                statusColor: isApproved ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-red-100 text-red-700 border-red-200',
                analystDecision: decision,
                analystNotes: notes,
                fsdDocument: fsdDoc,
                documents: newDocs,
                analystResult: {
                    decision,
                    notes,
                    estimation: estimationDays || '30 hari pengerjaan',
                    fsdFile: fsdDoc.name,
                    fsdUrl: fsdDoc.url || null
                },
                type: selectedProject.type || 'RBB',
                typeLabel: (selectedProject.type || 'RBB') === 'RBB' ? 'RBB (Wajib Selesai)' : 'Non-RBB (Fleksibel)'
            });

            addNotification(
                'Kajian Analyst Selesai',
                `Kajian teknis untuk ${selectedProject?.name} telah dirampungkan oleh Analyst (${user?.name || 'Analis SDLC'}) dan dikirim ke Lead Perencanaan untuk Verifikasi Hasil Analisis.`,
                isApproved ? 'success' : 'warning',
                '/workspace/lead?tab=verification'
            );
            toast.success(`Kajian teknis ${selectedProject?.name} selesai! Dikirim ke Lead Perencanaan untuk Verifikasi.`);
            navigate('/workspace/lead?tab=verification');
        } catch (err) {
            console.error('[WorkspaceAnalyst] Submit error:', err);
            toast.error('Terjadi kesalahan saat pengiriman: ' + (err?.message || 'Error'));
        } finally {
            setIsSubmitting(false);
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
        if (!type) return 'bg-gray-100 text-gray-600';
        const icons = {
            pdf: 'bg-red-100 text-red-600',
            docx: 'bg-blue-100 text-blue-600',
            xlsx: 'bg-green-100 text-green-600',
            pptx: 'bg-orange-100 text-orange-600',
            zip: 'bg-purple-100 text-purple-600',
        };
        return icons[String(type).toLowerCase()] || 'bg-gray-100 text-gray-600';
    };

    const getFileLabel = (type) => {
        if (!type) return 'DOC';
        const labels = { pdf: 'PDF', docx: 'DOCX', xlsx: 'XLSX', pptx: 'PPTX', zip: 'ZIP' };
        const key = String(type).toLowerCase();
        return labels[key] || String(type).toUpperCase();
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
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* LEFT PANEL: Inbox */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-100px)]">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Tugas Review</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{reviewQueue.length} antrian menunggu</p>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors">
                            <Filter size={16} />
                        </button>
                    </div>
                    <div className="max-lg:max-h-[280px] flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/40">
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
                                {(project.leadNote || project.leadNotes || project.notes || project.dispositionNotes || project.assignmentNote) && (
                                    <div className="bg-amber-50/90 p-2.5 rounded-lg border border-amber-200 text-xs">
                                        <p className="text-[11px] italic text-amber-900 flex items-start gap-1.5 font-medium leading-relaxed">
                                            <MessageSquare size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                            "{project.leadNote || project.leadNotes || project.notes || project.dispositionNotes || project.assignmentNote}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT PANEL: Review Form */}
                <div className="w-full lg:w-2/3 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
                    {!selectedProject ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-scale-in min-h-[400px]">
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

                        {/* Pesan & Catatan Disposisi dari Lead Perencanaan TI */}
                        {(selectedProject.leadNote || selectedProject.leadNotes || selectedProject.notes || selectedProject.dispositionNotes || selectedProject.assignmentNote) ? (
                            <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-xl mt-4 space-y-1.5 shadow-2xs">
                                <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                                    <MessageSquare size={16} className="text-amber-600" />
                                    Pesan &amp; Catatan Disposisi dari Lead Perencanaan TI:
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-amber-100 text-xs">
                                    <p className="text-gray-800 font-semibold italic text-xs sm:text-sm leading-relaxed">
                                        "{selectedProject.leadNote || selectedProject.leadNotes || selectedProject.notes || selectedProject.dispositionNotes || selectedProject.assignmentNote}"
                                    </p>
                                    {(selectedProject.assignedAnalyst || selectedProject.analyst) && (
                                        <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
                                            Disposisi untuk Analyst: <span className="font-bold text-gray-700">{selectedProject.assignedAnalyst || selectedProject.analyst}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl mt-4 text-xs text-slate-500 flex items-center gap-2 italic">
                                <MessageSquare size={14} className="text-slate-400 shrink-0" />
                                <span>Tidak ada catatan tambahan khusus dari Lead Perencanaan untuk penugasan proyek ini.</span>
                            </div>
                        )}
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Documents Inisiasi Peminta (Dynamic & Interactive) */}
                        <div className="mb-6 border-b border-gray-200 pb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <FileText size={20} className="text-[#1A56DB]" />
                                Dokumen Inisiasi Peminta
                            </h3>
                            <div className="space-y-3">
                                {((selectedProject.documents && selectedProject.documents.length > 0)
                                    ? selectedProject.documents
                                    : [
                                        { id: 'BRD-INIT', name: `${selectedProject.name}_BRD_Inisiasi.pdf`, size: '2.4 MB', type: 'pdf', category: 'brd' }
                                    ]
                                ).map((doc, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50 hover:border-gray-300 transition-all gap-3">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-bold text-xs shrink-0">
                                                PDF
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 text-sm">{doc.name || doc.title || 'Dokumen_Inisiasi.pdf'}</p>
                                                <p className="text-xs text-gray-500">{doc.size || '2.4 MB'} • Dokumen BRD Terlampir Peminta</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewDoc(doc)}
                                                className="px-3.5 py-2 border border-[#1A56DB] text-[#1A56DB] rounded-xl font-semibold hover:bg-blue-50 transition-colors flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                                            >
                                                <Eye size={15} />
                                                View &amp; Baca
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadFile(doc)}
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

                                {/* Klasifikasi Tipe Proyek (Read-only dari Inisiasi Divisi) */}
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                        Klasifikasi Tipe Proyek SDLC
                                    </span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <RBBBadge type={selectedProject?.type} deadline={selectedProject?.rbbDeadline} />
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

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 hover:border-[#1A56DB] rounded-xl p-8 flex flex-col items-center justify-center bg-white hover:bg-blue-50/40 transition-all cursor-pointer mb-4 group"
                            >
                                <CloudUpload size={40} className="text-gray-400 group-hover:text-[#1A56DB] group-hover:scale-110 transition-all mb-2" />
                                <p className="font-semibold text-gray-700 group-hover:text-[#1A56DB] transition-colors">Tarik &amp; Lepas file di sini, atau klik untuk unggah</p>
                                <p className="text-xs text-gray-500 mt-1">Format Berkas PDF Resmi SDLC Bank Nagari (Maksimal 5MB)</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            {/* Dynamic Uploaded File Display */}
                            {uploadedFile && (
                                <div className="flex items-center justify-between p-4 border border-emerald-300 bg-emerald-50 rounded-xl animate-fade-in shadow-2xs">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-2xs">
                                            <CheckCircle size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-800 truncate">{uploadedFile.name}</p>
                                            <p className="text-xs text-gray-500">{uploadedFile.size} • Berhasil Diunggah</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                                            Dokumen FSD Terlampir
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setUploadedFile(null)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Hapus Berkas"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
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
                <DocumentViewerModal
                    doc={previewDoc}
                    project={selectedProject}
                    onClose={() => setPreviewDoc(null)}
                />
            )}
        </div>
    );
}