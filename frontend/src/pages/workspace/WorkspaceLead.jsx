import RBBBadge from '../../components/RBBBadge';
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
import { analysts } from '../../data/mockData';
import { useProjects } from '../../contexts/ProjectContext';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

export default function WorkspaceLead() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { projects, updateProject, isLoading } = useProjects();
    const dispositionQueue = projects.filter(p => p.status === 'PENDING');
    const verificationQueue = projects.filter(p => p.status === 'ANALYSIS_APPROVED');
    const [activeTab, setActiveTab] = useState('disposition'); // 'disposition' or 'verification'
    
    // Switch queue based on tab
    const activeQueue = activeTab === 'disposition' ? dispositionQueue : verificationQueue;
    const [selectedProject, setSelectedProject] = useState(null);
    
    if (!selectedProject && activeQueue.length > 0) {
        setSelectedProject(activeQueue[0]);
    }
    const [selectedAnalyst, setSelectedAnalyst] = useState('');
    const [deadline, setDeadline] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleVerify = () => {
        setIsSubmitting(true);
        updateProject(selectedProject.id, {
            status: 'READY_FOR_DEVELOPMENT',
            statusColor: 'bg-cyan-100 text-cyan-700 border-cyan-200',
        });

        addNotification(
            'Analisis Disetujui',
            `Hasil analisis untuk ${selectedProject?.name} telah disetujui Lead.`,
            'success',
            '/pm/allocation'
        );
        
        toast.success(`Proyek ${selectedProject?.name} dilanjutkan ke tahap Pengembangan`);
        setIsSubmitting(false);

        const nextQueue = verificationQueue.filter(p => p.id !== selectedProject.id);
        if (nextQueue.length > 0) {
            setSelectedProject(nextQueue[0]);
        } else {
            setSelectedProject(null);
        }
    };

    const handleAssign = () => {
        if (!selectedAnalyst) {
            toast.error('Pilih analyst terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        
        updateProject(selectedProject.id, {
            analyst: selectedAnalyst,
            status: 'IN_REVIEW',
            deadline: deadline || new Date().toISOString(),
            leadNote: notes
        });

        addNotification(
            'Disposisi Berhasil',
            `Proyek ${selectedProject.name} telah ditugaskan ke ${selectedAnalyst}`,
            'info',
            '/workspace/analyst'
        );
        
        toast.success(`Proyek ${selectedProject?.name} berhasil ditugaskan ke ${selectedAnalyst}`);
        navigate('/queue');
        setIsSubmitting(false);

        const nextQueue = dispositionQueue.filter(p => p.id !== selectedProject.id);
        if (nextQueue.length > 0) {
            setSelectedProject(nextQueue[0]);
            setSelectedAnalyst('');
            setNotes('');
        } else {
            setSelectedProject(null);
        }
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
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] flex items-center justify-center">
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
        <div className="flex-1 overflow-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-800">Workspace Lead</h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            Kelola disposisi proyek baru ke analis atau verifikasi hasil analisis.
                        </p>
                    </div>
                    <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                        <button
                            onClick={() => { setActiveTab('disposition'); setSelectedProject(null); }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'disposition' ? 'bg-[#1A56DB] text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        >
                            Disposisi Proyek Baru
                        </button>
                        <button
                            onClick={() => { setActiveTab('verification'); setSelectedProject(null); }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'verification' ? 'bg-[#1A56DB] text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        >
                            Verifikasi Hasil Analisis
                            {verificationQueue.length > 0 && (
                                <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                                    {verificationQueue.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
                {/* LEFT PANEL: Antrean */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">{activeTab === 'disposition' ? 'Antrean Disposisi' : 'Antrean Verifikasi'}</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{activeQueue.length} menunggu</p>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors">
                            <Filter size={16} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/40">
                        {activeQueue.map((project) => (
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
                                <div className="mb-2"><RBBBadge type={project.type} deadline={project.rbbDeadline} /></div>
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
                                <div className="mb-2"><RBBBadge type={selectedProject.type} deadline={selectedProject.rbbDeadline} /></div>
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

                        <div className="grid grid-cols-2 gap-3">
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

                        {/* Action Form (Assignment / Verification) */}
                        {activeTab === 'disposition' ? (
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <User size={20} className="text-[#1A56DB]" />
                                    Form Penugasan Analis
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Pilih System Analyst <span className="text-red-500">*</span></label>
                                        <select
                                            value={selectedAnalyst}
                                            onChange={(e) => setSelectedAnalyst(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-50 outline-none transition-all bg-white"
                                        >
                                            <option value="">-- Pilih Analyst --</option>
                                            {analysts.map((a, i) => (
                                                <option key={i} value={a.name}>{a.name} ({a.load} Proyek Aktif)</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target Selesai Analisis (Opsional)</label>
                                        <input
                                            type="date"
                                            value={deadline}
                                            onChange={(e) => setDeadline(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-50 outline-none transition-all bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Catatan untuk Analis (Opsional)</label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Berikan instruksi khusus atau fokus analisis..."
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-50 outline-none transition-all min-h-[80px] resize-y bg-white text-sm"
                                        ></textarea>
                                    </div>
                                    <div className="pt-2">
                                        <button
                                            onClick={handleAssign}
                                            disabled={isSubmitting || !selectedAnalyst}
                                            className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <Send size={18} />}
                                            Kirim Tugasan Analisis
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
                                <h3 className="text-lg font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                                    <Check size={20} />
                                    Verifikasi Hasil Analisis
                                </h3>
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Keputusan Analis</p>
                                        <p className="font-semibold text-gray-800">{selectedProject.analystResult?.decision || 'Disetujui'}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Catatan Analis</p>
                                        <p className="text-gray-700 text-sm">{selectedProject.analystResult?.notes || 'Tidak ada catatan.'}</p>
                                    </div>
                                    <div className="pt-2">
                                        <button
                                            onClick={handleVerify}
                                            disabled={isSubmitting}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <Send size={18} />}
                                            Lanjutkan ke Pengembangan (Alokasi Tim)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}