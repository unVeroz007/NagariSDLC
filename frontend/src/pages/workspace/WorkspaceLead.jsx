import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    User,
    Download,
    FileText,
    Calendar,
    Clock,
    Filter,
    Eye,
    Check,
    X,
    AlertCircle,
    ChevronRight,
    Plus,
    Send,
    Search,
    Users,
    FolderOpen,
    List,
} from 'lucide-react';
import { dispositionQueue, analysts, reviewQueue } from '../../data/mockData';

export default function WorkspaceLead() {
    const { user } = useAuth();
    const [selectedProject, setSelectedProject] = useState(dispositionQueue[0]);
    const [selectedAnalyst, setSelectedAnalyst] = useState('');
    const [deadline, setDeadline] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssign = () => {
        if (!selectedAnalyst) {
            alert('Pilih analyst terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            alert(`Proyek ${selectedProject?.name} berhasil ditugaskan ke ${selectedAnalyst}`);
            setIsSubmitting(false);
            // Tambahkan ke reviewQueue agar muncul di Workspace Analyst
            const newReviewTask = {
                ...selectedProject,
                status: 'New',
                deadline: deadline || new Date().toISOString(),
                leadNote: notes,
                analyst: selectedAnalyst,
                statusReview: 'pending',
            };
            reviewQueue.unshift(newReviewTask);

            // Reset form
            setSelectedAnalyst('');
            setDeadline('');
            setNotes('');
            // Remove from queue (simulasi)
            const index = dispositionQueue.indexOf(selectedProject);
            if (index > -1) dispositionQueue.splice(index, 1);
            if (dispositionQueue.length > 0) {
                setSelectedProject(dispositionQueue[0]);
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
                        <Check size={48} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Semua Proyek Sudah Ditugaskan</h2>
                    <p className="text-gray-500">Tidak ada antrean proyek baru yang perlu disposisi.</p>
                    <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-3 inline-block text-emerald-700 text-sm font-medium">
                        Inbox kosong — Kerja bagus! 🎉
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-6 md:p-8 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-800">Disposisi System Analyst</h1>
                <p className="text-gray-500 mt-1 text-sm">
                    Tugaskan Analis Sistem untuk meninjau proyek baru dan menyusun dokumen analisis persyaratan teknis.
                </p>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
                {/* LEFT PANEL: Antrean */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Antrean Proyek</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{dispositionQueue.length} menunggu disposisi</p>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors">
                            <Filter size={16} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/40">
                        {dispositionQueue.map((project) => (
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
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityColor(project.priority)}`}>
                                        {project.priority === 'High' ? '🔴 Tinggi' : project.priority === 'Medium' ? '🟡 Sedang' : '🟢 Rendah'}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {new Date(project.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                                <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-[#1A56DB] transition-colors">{project.name}</h3>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Users size={13} />
                                    <span>{project.division}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2.5 mt-2.5 border-t border-gray-100">
                                    <span className="text-[10px] font-bold text-[#1A56DB] bg-blue-50 px-2 py-0.5 rounded">{project.id}</span>
                                    <span className="text-[10px] text-gray-400">{project.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT PANEL: Detail & Form */}
                <div className="w-full lg:w-2/3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    {/* Header Info */}
                    <div className="p-6 border-b border-gray-100 shrink-0">
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <div className="flex items-center gap-2.5 mb-1.5">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getPriorityColor(selectedProject.priority)}`}>
                                        {selectedProject.priority === 'High' ? '🔴 High Priority' : selectedProject.priority === 'Medium' ? '🟡 Medium' : '🟢 Low'}
                                    </span>
                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{selectedProject.id}</span>
                                </div>
                                <h2 className="text-2xl font-extrabold text-gray-800">{selectedProject.name}</h2>
                                <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                    <Users size={15} />
                                    <span>{selectedProject.division}</span>
                                </div>
                            </div>
                            <button className="p-2.5 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-xl transition-colors border border-gray-200">
                                <Eye size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Budget Estimasi</p>
                                <p className="text-base font-extrabold text-gray-800">{selectedProject.budget}</p>
                            </div>
                            <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Target Selesai</p>
                                <p className="text-base font-extrabold text-gray-800">{selectedProject.targetDate}</p>
                            </div>
                            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                                <div className="flex items-center gap-1.5 text-amber-600">
                                    <Clock size={14} />
                                    <p className="text-base font-extrabold">Menunggu</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Documents */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <FolderOpen size={20} className="text-[#1A56DB]" />
                                Dokumen Inisiasi
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {selectedProject.documents.map((doc, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 hover:border-gray-300 transition-colors group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-10 h-10 rounded ${getFileIcon(doc.type)} flex items-center justify-center shrink-0 font-bold text-[10px]`}>
                                                {getFileLabel(doc.type)}
                                            </div>
                                            <div className="truncate">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{doc.name}</p>
                                                <p className="text-xs text-gray-500">{doc.size}</p>
                                            </div>
                                        </div>
                                        <button className="p-2 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                                            <Download size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <hr className="border-gray-200 mb-6" />

                        {/* Assignment Form */}
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <User size={20} className="text-[#1A56DB]" />
                                Form Penugasan Analis
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Pilih System Analyst <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedAnalyst}
                                        onChange={(e) => setSelectedAnalyst(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] appearance-none transition-all cursor-pointer"
                                    >
                                        <option value="">Pilih analis yang tersedia...</option>
                                        {analysts.map((a) => (
                                            <option key={a.id} value={a.name}>
                                                {a.name} (Beban: {a.load})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Batas Waktu Analisis (SLA) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Catatan Khusus untuk Analis
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Tambahkan instruksi spesifik, poin perhatian, atau konteks tambahan..."
                                        rows={3}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-4 border-t border-gray-100 shrink-0 flex justify-end gap-3 bg-gray-50/30">
                        <button className="px-5 py-2.5 bg-white border border-red-200 text-red-500 rounded-xl font-semibold hover:bg-red-50 hover:border-red-300 transition-all flex items-center gap-2 text-sm">
                            <X size={16} />
                            Kembalikan
                        </button>
                        <button
                            onClick={handleAssign}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-[#003a73] text-white rounded-xl font-bold hover:bg-[#002a5a] transition-all flex items-center gap-2 shadow-md shadow-[#003a73]/20 text-sm btn-shimmer disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Memproses...</>
                            ) : (
                                <><User size={16} /> Tugaskan Analis</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}