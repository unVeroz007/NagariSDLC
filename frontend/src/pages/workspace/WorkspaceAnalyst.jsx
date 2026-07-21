import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
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
} from 'lucide-react';
import { reviewQueue } from '../../data/mockData';

export default function WorkspaceAnalyst() {
    const { user } = useAuth();
    const [selectedProject, setSelectedProject] = useState(reviewQueue[0]);
    const [decision, setDecision] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);

    const handleSubmit = () => {
        if (!decision) {
            alert('Pilih keputusan terlebih dahulu!');
            return;
        }
        if (!notes.trim()) {
            alert('Masukkan catatan analisis!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            alert(`Proyek ${selectedProject?.name} berhasil di-review dengan keputusan: ${decision}`);
            setIsSubmitting(false);
            // Remove from queue
            const index = reviewQueue.indexOf(selectedProject);
            if (index > -1) reviewQueue.splice(index, 1);
            if (reviewQueue.length > 0) {
                setSelectedProject(reviewQueue[0]);
                setDecision('');
                setNotes('');
                setUploadedFile(null);
            } else {
                setSelectedProject(null);
            }
        }, 1000);
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
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'New':
                return 'bg-gray-100 text-gray-600 border-gray-200';
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

    if (!selectedProject) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb] flex items-center justify-center">
                <div className="text-center py-20 animate-scale-in">
                    <div className="w-24 h-24 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <CheckCircle size={48} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Semua Proyek Selesai Direview</h2>
                    <p className="text-gray-500">Tidak ada tugas review yang menunggu.</p>
                    <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-3 inline-block text-emerald-700 text-sm font-medium">
                        Antrean kosong — Luar biasa! 🚀
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-6 md:p-8 bg-[#f8f9fb] animate-slide-up">
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
                                        {new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
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
                    {/* Header Detail */}
                    <div className="p-6 border-b border-gray-200 bg-gray-50/50 shrink-0">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-xs text-gray-500 font-bold tracking-wider uppercase block mb-1">Detail Proyek</span>
                                <h2 className="text-2xl font-bold text-gray-800">{selectedProject.name}</h2>
                            </div>
                            <button className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 transition-colors">
                                <File size={18} />
                            </button>
                        </div>
                        {selectedProject.leadNote && (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mt-4 flex gap-3 text-amber-900 text-sm shadow-sm">
                                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                                <p className="text-sm"><strong>Instruksi Lead:</strong> {selectedProject.leadNote}</p>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Documents */}
                        <div className="mb-6 border-b border-gray-200 pb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <FileText size={20} className="text-[#1A56DB]" />
                                Dokumen Inisiasi Peminta
                            </h3>
                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">BRD_AntiFraud_v1.pdf</p>
                                        <p className="text-xs text-gray-500">2.4 MB • Diunggah 12 Okt 2023</p>
                                    </div>
                                </div>
                                <button className="px-4 py-2 border border-[#1A56DB] text-[#1A56DB] rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2 text-sm">
                                    <Eye size={16} />
                                    View &amp; Baca
                                </button>
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

                            {/* Uploaded File */}
                            <div className="flex items-center justify-between p-3 border border-emerald-500/30 bg-emerald-50/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0">
                                        <CheckCircle size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">FSD_AntiFraud_Citra.docx</p>
                                        <p className="text-xs text-gray-500">1.4 MB</p>
                                    </div>
                                </div>
                                <button className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                                    <Trash2 size={18} />
                                </button>
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
                </div>
            </div>
        </div>
    );
}