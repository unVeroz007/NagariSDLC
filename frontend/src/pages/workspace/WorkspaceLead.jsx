import RBBBadge from '../../components/RBBBadge';
import { useState, useMemo } from 'react';
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
import { useProjects, getFileFromStore } from '../../contexts/ProjectContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

export default function WorkspaceLead() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { addNotification } = useNotifications();
    const { projects, updateProject, isLoading } = useProjects();

    const initialTab = searchParams.get('tab') === 'verification' ? 'verification' : 'disposition';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [previewFsdDoc, setPreviewFsdDoc] = useState(null);

    // Filter 1: Antrean Disposisi Proyek Baru (Proyek PENDING yang BELUM ditugaskan ke Analyst)
    const dispositionQueue = useMemo(() => {
        return projects.filter(p => p.status === 'PENDING');
    }, [projects]);

    // Filter 2: Antrean Sedang Dikaji Analyst (Proyek IN_REVIEW yang sedang dianalisis oleh System Analyst)
    const analyzingQueue = useMemo(() => {
        return projects.filter(p => p.status === 'IN_REVIEW' || p.status === 'PLANNING_ANALYSIS');
    }, [projects]);

    // Filter 3: Antrean Verifikasi Hasil Analisis (Proyek yang SUDAH selesai dikaji oleh Analyst Perencanaan)
    const verificationQueue = useMemo(() => {
        return projects.filter(p =>
            p.status === 'ANALYSIS_APPROVED' ||
            p.status === 'ANALYST_SUBMITTED' ||
            p.status === 'VERIFICATION_PENDING'
        );
    }, [projects]);

    // Switch queue based on tab ('disposition' | 'analyzing' | 'verification')
    const activeQueue = activeTab === 'disposition' 
        ? dispositionQueue 
        : activeTab === 'analyzing' 
            ? analyzingQueue 
            : verificationQueue;
    const [selectedProject, setSelectedProject] = useState(null);
    
    // Set default selected project
    const currentSelected = selectedProject || activeQueue[0] || null;

    // Convert Data URL / Store URL to Real Blob URL for embedded PDF reading in Workspace Lead
    const previewFsdBlobUrl = useMemo(() => {
        if (!previewFsdDoc) return null;
        let rawUrl = previewFsdDoc.url || previewFsdDoc.fileUrl || previewFsdDoc.dataUrl;
        if (!rawUrl && previewFsdDoc.name) {
            rawUrl = getFileFromStore(previewFsdDoc.name) || getFileFromStore(previewFsdDoc.id);
        }
        if (!rawUrl && currentSelected) {
            rawUrl = getFileFromStore(`fsd_${currentSelected.id}`) || currentSelected.analystResult?.fsdUrl;
        }

        if (!rawUrl) {
            const docTitle = (previewFsdDoc.name || 'Dokumen_SDLC.pdf').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
            const projName = currentSelected?.name || 'Proyek SDLC';
            const divName = currentSelected?.division || 'Divisi TI';
            const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 280 >>\nstream\nBT\n/F1 18 Tf\n50 720 Td\n(PT BANK NAGARI - DOKUMEN SDLC RESMI) Tj\n0 -35 Td\n/F1 14 Tf\n(Nama Berkas: ${docTitle}) Tj\n0 -25 Td\n(Proyek: ${projName}) Tj\n0 -25 Td\n(Divisi Peminta: ${divName}) Tj\n0 -25 Td\n(Status: Terverifikasi Quality Gate SDLC Bank Nagari) Tj\n0 -30 Td\n/F1 11 Tf\n(Dokumen ini adalah berkas spesifikasi & kelengkapan proyek SDLC.) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000244 00000 n\n0000000575 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n654\n%%EOF`;
            const blob = new Blob([pdfContent], { type: 'application/pdf' });
            return URL.createObjectURL(blob);
        }

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
    }, [previewFsdDoc, currentSelected]);

    const currentFsdDoc = useMemo(() => {
        if (!currentSelected) return null;
        if (currentSelected.fsdDocument?.name || currentSelected.fsdDocument?.file_name) {
            return {
                name: currentSelected.fsdDocument.name || currentSelected.fsdDocument.file_name,
                size: currentSelected.fsdDocument.size || currentSelected.fsdDocument.file_size || '1.8 MB',
                url: currentSelected.fsdDocument.url || currentSelected.fsdDocument.fileUrl || null
            };
        }
        if (Array.isArray(currentSelected.documents) && currentSelected.documents.length > 0) {
            const found = currentSelected.documents.find(d => 
                d.type === 'fsd' || d.doc_type === 'fsd' || (d.name && d.name.toLowerCase().includes('fsd'))
            ) || currentSelected.documents[0];
            if (found) {
                return {
                    name: found.name || found.file_name,
                    size: found.size || found.file_size || '1.8 MB',
                    url: found.url || found.fileUrl || null
                };
            }
        }
        if (currentSelected.analystResult?.fsdFile) {
            return {
                name: currentSelected.analystResult.fsdFile,
                size: '1.8 MB',
                url: currentSelected.analystResult.fsdUrl || null
            };
        }
        return {
            name: currentSelected.documents?.[0]?.name || 'Dokumen_SDLC.pdf',
            size: '1.8 MB',
            url: null
        };
    }, [currentSelected]);

    const [selectedAnalyst, setSelectedAnalyst] = useState('');
    const [deadline, setDeadline] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleVerify = () => {
        if (!currentSelected) return;
        setIsSubmitting(true);
        updateProject(currentSelected.id, {
            status: 'READY_FOR_DEVELOPMENT',
            statusColor: 'bg-[#1A56DB]/10 text-[#1A56DB] border-blue-200',
        });

        addNotification(
            'Analisis Diverifikasi Lead',
            `Hasil analisis teknis untuk ${currentSelected?.name} telah diverifikasi oleh Lead Perencanaan dan diteruskan ke Lead Pengembangan untuk alokasi tim.`,
            'success',
            '/workspace/dev-lead'
        );
        
        toast.success(`Hasil analisis ${currentSelected?.name} berhasil diverifikasi & dikirim ke Lead Pengembangan!`);
        setIsSubmitting(false);

        const nextQueue = verificationQueue.filter(p => p.id !== currentSelected.id);
        if (nextQueue.length > 0) {
            setSelectedProject(nextQueue[0]);
        } else {
            setSelectedProject(null);
        }
    };

    const handleAssign = () => {
        if (!currentSelected) return;
        if (!selectedAnalyst) {
            toast.error('Pilih analyst terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        
        updateProject(currentSelected.id, {
            analyst: selectedAnalyst,
            status: 'IN_REVIEW',
            deadline: deadline || new Date().toISOString(),
            leadNote: notes
        });

        addNotification(
            'Disposisi Berhasil',
            `Proyek ${currentSelected.name} telah ditugaskan ke ${selectedAnalyst}`,
            'info',
            '/workspace/analyst'
        );
        
        toast.success(`Proyek "${currentSelected?.name}" berhasil ditugaskan ke System Analyst ${selectedAnalyst}!`);
        setIsSubmitting(false);

        const nextQueue = dispositionQueue.filter(p => p.id !== currentSelected.id);
        if (nextQueue.length > 0) {
            setSelectedProject(nextQueue[0]);
            setSelectedAnalyst('');
            setNotes('');
        } else {
            setSelectedProject(null);
            setSelectedAnalyst('');
            setNotes('');
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

    // Hapus full-screen empty state return

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
                    <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm flex-wrap gap-1">
                        <button
                            onClick={() => { setActiveTab('disposition'); setSelectedProject(null); }}
                            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${activeTab === 'disposition' ? 'bg-[#1A56DB] text-white shadow-md' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                        >
                            Disposisi Proyek Baru
                        </button>
                        <button
                            onClick={() => { setActiveTab('analyzing'); setSelectedProject(null); }}
                            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'analyzing' ? 'bg-[#1A56DB] text-white shadow-md' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                        >
                            <span>Sedang Dikaji Analyst</span>
                            {analyzingQueue.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'analyzing' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                    {analyzingQueue.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setActiveTab('verification'); setSelectedProject(null); }}
                            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'verification' ? 'bg-[#1A56DB] text-white shadow-md' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                        >
                            <span>Verifikasi Hasil Analisis</span>
                            {verificationQueue.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'verification' ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                                    {verificationQueue.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-220px)] lg:min-h-[600px]">
                {/* LEFT PANEL: Antrean */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden shrink-0 lg:h-full">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">
                                {activeTab === 'disposition' ? 'Antrean Disposisi Baru' : activeTab === 'analyzing' ? 'Proyek Sedang Dikaji Analyst' : 'Antrean Verifikasi FSD'}
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">{activeQueue.length} proyek</p>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors">
                            <Filter size={16} />
                        </button>
                    </div>
                    <div className="max-lg:max-h-[280px] flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/40">
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
                                <div className="mb-2"><RBBBadge type={project.type} deadline={project.rbbDeadline} status={project.status} /></div>
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
                <div className="w-full lg:w-2/3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col lg:h-full">
                    {!currentSelected ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-scale-in">
                            <div className="w-24 h-24 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 shadow-sm">
                                <Check size={48} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Semua Proyek Selesai Diproses</h2>
                            <p className="text-gray-500 max-w-md mx-auto">
                                Tidak ada antrean proyek baru yang perlu didisposisi atau diverifikasi saat ini.
                            </p>
                            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-3 inline-block text-emerald-700 text-sm font-medium">
                                Antrean kosong — Kerja bagus! 🎉
                            </div>
                        </div>
                    ) : (
                        <>
                    {/* Header Info */}
                    <div className="p-6 border-b border-gray-100 shrink-0">
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <div className="flex items-center gap-2.5 mb-1.5">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getPriorityColor(currentSelected.priority)}`}>
                                        {currentSelected.priority === 'High' ? '🔴 High Priority' : currentSelected.priority === 'Medium' ? '🟡 Medium' : '🟢 Low'}
                                    </span>
                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{currentSelected.id}</span>
                                </div>
                                <div className="mb-2"><RBBBadge type={currentSelected.type} deadline={currentSelected.rbbDeadline} status={currentSelected.status} /></div>
                                <h2 className="text-2xl font-extrabold text-gray-800">{currentSelected.name}</h2>
                                <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                    <Users size={15} />
                                    <span>{currentSelected.division}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPreviewModalOpen(true)}
                                className="p-2.5 text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 rounded-xl transition-colors border border-gray-200 cursor-pointer"
                                title="Lihat Detail Proyek"
                            >
                                <Eye size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Target Selesai</p>
                                <p className="text-base font-extrabold text-gray-800">{currentSelected.targetDate}</p>
                            </div>
                            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                                <div className="flex items-center gap-1.5 text-amber-600">
                                    <Clock size={14} />
                                    <p className="text-base font-extrabold">{currentSelected.status || 'Menunggu'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:flex-1 lg:overflow-y-auto p-6">
                        {/* Documents */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <FolderOpen size={20} className="text-[#1A56DB]" />
                                Dokumen Inisiasi
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {((currentSelected.documents && currentSelected.documents.length > 0)
                                    ? currentSelected.documents
                                    : [{ id: 'BRD-01', name: `${currentSelected.name}_BRD_Inisiasi.pdf`, size: '2.4 MB', type: 'pdf', category: 'brd' }]
                                ).map((doc, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 hover:border-gray-300 transition-colors group">
                                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                            <div className={`w-10 h-10 rounded ${getFileIcon(doc.type)} flex items-center justify-center shrink-0 font-bold text-[10px]`}>
                                                {getFileLabel(doc.type)}
                                            </div>
                                            <div className="truncate min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{doc.name}</p>
                                                <p className="text-xs text-gray-500">{doc.size || '2.4 MB'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewFsdDoc(doc)}
                                                className="px-3 py-1.5 border border-[#1A56DB] text-[#1A56DB] hover:bg-blue-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                                title="View & Baca Dokumen"
                                            >
                                                <Eye size={14} />
                                                <span>View</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const rawUrl = doc.url || doc.fileUrl || doc.dataUrl || getFileFromStore(doc.name) || getFileFromStore(doc.id);
                                                    const fileName = doc.name || 'Dokumen_SDLC.pdf';
                                                    if (rawUrl) {
                                                        const link = document.createElement('a');
                                                        link.href = rawUrl;
                                                        link.download = fileName;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        toast.success(`Mengunduh file "${fileName}"...`);
                                                    } else {
                                                        const textContent = `PT BANK NAGARI - DOKUMEN SDLC\n===============================\nNama Dokumen: ${fileName}\nProyek: ${currentSelected?.name || 'Proyek SDLC'}\nTanggal: ${new Date().toLocaleDateString('id-ID')}`;
                                                        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                                                        const url = URL.createObjectURL(blob);
                                                        const link = document.createElement('a');
                                                        link.href = url;
                                                        link.download = fileName.endsWith('.pdf') ? fileName.replace('.pdf', '_ringkasan.txt') : `${fileName}.txt`;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        URL.revokeObjectURL(url);
                                                        toast.success(`Mengunduh salinan berkas "${fileName}"...`);
                                                    }
                                                }}
                                                className="p-2 text-gray-500 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                title="Unduh Dokumen"
                                            >
                                                <Download size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <hr className="border-gray-200 mb-6" />

                        {/* Action Form (Assignment / Monitoring / Verification) */}
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
                                            className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <Send size={18} />}
                                            Kirim Tugasan Analisis
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'analyzing' ? (
                            <div className="bg-amber-50/70 rounded-xl p-6 border border-amber-200 space-y-4">
                                <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                                    <Clock size={20} className="text-amber-700" />
                                    Status Pemantauan Kajian System Analyst
                                </h3>
                                <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-gray-400 uppercase">System Analyst Bertugas:</span>
                                        <span className="font-extrabold text-amber-900 bg-amber-100 px-3 py-1 rounded-lg">
                                            {currentSelected?.analyst || currentSelected?.assignedAnalyst?.name || 'Ahmad Rifai'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-gray-400 uppercase">Status Pengerjaan:</span>
                                        <span className="font-bold text-amber-700 flex items-center gap-1">
                                            <Clock size={13} /> Sedang Analisa Kelayakan Bisnis &amp; FSD
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-gray-400 uppercase">Lembar Kerja Analyst:</span>
                                        <span className="font-semibold text-blue-700">Workspace System Analyst Perencanaan</span>
                                    </div>
                                </div>
                                {currentSelected?.leadNote && (
                                    <div className="bg-white p-4 rounded-xl border border-amber-100 text-xs">
                                        <span className="font-bold text-gray-400 uppercase block mb-1">Catatan Arahan dari Lead:</span>
                                        <p className="text-gray-700 leading-relaxed italic">{currentSelected.leadNote}</p>
                                    </div>
                                )}
                                <div className="p-3 bg-amber-100/60 rounded-xl text-xs text-amber-900 font-medium leading-relaxed">
                                    ℹ️ Proyek sedang dikaji secara aktif oleh Analyst. Setelah Analyst menyelesaikan kajian FSD, proyek akan otomatis berpindah ke tab <strong>Verifikasi Hasil Analisis</strong> untuk Anda tinjau.
                                </div>
                            </div>
                        ) : (
                            <div className="bg-emerald-50/70 rounded-xl p-6 border border-emerald-200">
                                <h3 className="text-lg font-bold text-emerald-900 mb-4 flex items-center gap-2">
                                    <Check size={20} className="text-emerald-700" />
                                    Verifikasi Hasil Analisis System Analyst
                                </h3>
                                <div className="space-y-4">
                                    {/* Berkas Kajian Teknis (FSD) Terlampir */}
                                    <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-200">
                                                FSD
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BERKAS KAJIAN TEKNIS (FSD)</p>
                                                <p className="font-bold text-gray-800 text-sm truncate">
                                                    {currentFsdDoc?.name || `FSD_${currentSelected?.name?.replace(/\s+/g, '_') || 'Dokumen'}.pdf`}
                                                </p>
                                                <p className="text-[11px] text-gray-500">
                                                    {currentFsdDoc?.size || '1.8 MB'} • Terlampir Hasil Kajian Analis
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewFsdDoc(currentFsdDoc)}
                                                className="px-3 py-1.5 border border-[#1A56DB] text-[#1A56DB] rounded-lg font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                                            >
                                                <Eye size={14} />
                                                View &amp; Baca FSD
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const doc = currentFsdDoc;
                                                    const rawUrl = doc?.url;
                                                    const fileName = doc?.name || `FSD_${currentSelected?.name?.replace(/\s+/g, '_') || 'Dokumen'}.pdf`;
                                                    if (rawUrl) {
                                                        const link = document.createElement('a');
                                                        link.href = rawUrl;
                                                        link.download = fileName;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        toast.success(`Mengunduh file FSD "${fileName}"...`);
                                                    } else {
                                                        const textContent = `PT BANK NAGARI - DOKUMEN FSD RESMI\n===================================\nDokumen: ${fileName}\nProyek: ${currentSelected.name}\nAnalis: ${currentSelected.analystResult?.analystName || 'System Analyst'}\nStatus Kajian: ${currentSelected.analystResult?.decision || 'Disetujui'}`;
                                                        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                                                        const url = URL.createObjectURL(blob);
                                                        const link = document.createElement('a');
                                                        link.href = url;
                                                        link.download = fileName.endsWith('.pdf') ? fileName.replace('.pdf', '_ringkasan.txt') : `${fileName}.txt`;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        URL.revokeObjectURL(url);
                                                        toast.success(`Mengunduh salinan berkas FSD "${fileName}"...`);
                                                    }
                                                }}
                                                className="p-2 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer"
                                                title="Unduh FSD"
                                            >
                                                <Download size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Keputusan Analis</p>
                                        <p className="font-bold text-emerald-800 text-base">{currentSelected.analystDecision || currentSelected.analystResult?.decision || 'Disetujui'}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Catatan &amp; Rekomendasi Analis</p>
                                        <p className="text-gray-700 text-sm leading-relaxed italic">{currentSelected.analystNotes || currentSelected.analystResult?.notes || currentSelected.notes || '(System Analyst tidak memberikan catatan khusus)'}</p>
                                    </div>
                                    {currentSelected.analystResult?.estimation && (
                                        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Estimasi Pengerjaan</p>
                                            <p className="font-semibold text-gray-800 text-sm">{currentSelected.analystResult.estimation}</p>
                                        </div>
                                    )}
                                    <div className="pt-2">
                                        <button
                                            onClick={handleVerify}
                                            disabled={isSubmitting}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                        >
                                            {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <Send size={18} />}
                                            Lanjutkan ke Pengembangan (Alokasi Tim)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── MODAL: Detail Preview Proyek (Tombol Mata) ── */}
            {isPreviewModalOpen && currentSelected && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-scale-up border border-gray-100">
                        <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-[#1A56DB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                        {currentSelected.id}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityColor(currentSelected.priority)}`}>
                                        {currentSelected.priority === 'High' ? '🔴 High Priority' : currentSelected.priority === 'Medium' ? '🟡 Medium' : '🟢 Low'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">{currentSelected.name}</h3>
                            </div>
                            <button onClick={() => setIsPreviewModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-1">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Deskripsi Proyek</p>
                                <p className="text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs sm:text-sm">
                                    {currentSelected.description || 'Pengajuan proyek SDLC baru Bank Nagari.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <p className="font-bold text-gray-400 uppercase">Divisi Inisiator</p>
                                    <p className="font-semibold text-gray-800 mt-0.5">{currentSelected.division}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <p className="font-bold text-gray-400 uppercase">Target Selesai</p>
                                    <p className="font-semibold text-gray-800 mt-0.5">{currentSelected.targetDate}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Dokumen Terkait</p>
                                <div className="space-y-2">
                                    {(currentSelected.documents || []).map((doc, i) => (
                                        <div key={i} className="flex items-center justify-between p-2.5 bg-blue-50/40 border border-blue-100 rounded-xl text-xs">
                                            <span className="font-semibold text-gray-800">{doc.name}</span>
                                            <span className="text-gray-500">{doc.size}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {currentSelected.analystResult && (
                                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 text-xs space-y-1">
                                    <p className="font-bold text-emerald-800 uppercase">Hasil Analisis System Analyst</p>
                                    <p className="font-semibold text-emerald-900">Keputusan: {currentSelected.analystResult.decision}</p>
                                    <p className="text-emerald-700">Catatan: {currentSelected.analystResult.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end mt-5 pt-3 border-t border-gray-100">
                            <button
                                onClick={() => setIsPreviewModalOpen(false)}
                                className="px-5 py-2 bg-[#003a73] text-white font-bold rounded-xl text-sm hover:bg-[#002a5a] transition-all cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL VIEWER DOKUMEN FSD (Lead Perencanaan) ── */}
            {previewFsdDoc && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl animate-scale-up border border-gray-200 my-8">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-700 text-white rounded-xl flex items-center justify-center font-extrabold text-xs shadow-sm">
                                    FSD
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">{previewFsdDoc.name}</h3>
                                    <p className="text-xs text-gray-500">Hasil Kajian Analisis Teknis • Terverifikasi SDLC</p>
                                </div>
                            </div>
                            <button onClick={() => setPreviewFsdDoc(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-[#f8f9fb] border border-gray-200 rounded-xl p-3 sm:p-6 max-h-[70vh] overflow-y-auto space-y-6 text-gray-800 font-sans shadow-inner flex justify-center items-start">
                            {previewFsdBlobUrl ? (
                                <object
                                    data={previewFsdBlobUrl}
                                    type="application/pdf"
                                    className="w-full h-full min-h-[650px] w-full bg-white rounded-xl shadow-md border border-gray-200"
                                >
                                    <embed
                                        src={previewFsdBlobUrl}
                                        type="application/pdf"
                                        className="w-full h-full min-h-[650px]"
                                    />
                                    <iframe
                                        src={previewFsdBlobUrl}
                                        title={previewFsdDoc.name}
                                        className="w-full h-full min-h-[650px] bg-white rounded-xl border-0"
                                    />
                                </object>
                            ) : (
                                <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-200 shadow-xs space-y-6 w-full text-gray-800">
                                    {/* Kop Surat Dokumen Resmi SDLC */}
                                    <div className="bg-[#003a73] text-white p-6 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <span className="text-[10px] font-extrabold tracking-widest uppercase bg-white/20 px-2.5 py-1 rounded text-white border border-white/30">
                                                SDLC BANK NAGARI ENTERPRISE
                                            </span>
                                            <h2 className="text-lg sm:text-xl font-black mt-2 text-white">
                                                FUNCTIONAL SPECIFICATION DOCUMENT (FSD)
                                            </h2>
                                            <p className="text-xs text-blue-100 mt-1 font-medium">
                                                Proyek: <span className="font-bold text-white">{currentSelected?.name}</span> ({currentSelected?.id})
                                            </p>
                                        </div>
                                        <div className="text-right text-xs text-blue-100 border-l sm:border-l-0 border-white/20 pl-3 sm:pl-0 font-mono">
                                            <p>STATUS: <span className="font-bold text-emerald-300">DIVERIFIKASI</span></p>
                                            <p>VERSI: v1.0.0-FSD</p>
                                            <p>TANGGAL: {new Date().toLocaleDateString('id-ID')}</p>
                                        </div>
                                    </div>

                                    {/* Bab 1: Latar Belakang & Ringkasan Kajian */}
                                    <div className="bg-gray-50/70 p-5 rounded-xl border border-gray-200 space-y-2">
                                        <h4 className="font-bold text-xs text-[#003a73] uppercase tracking-wider border-b border-gray-200 pb-2">
                                            1. RINGKASAN KAJIAN ANALISIS TEKNIS (ANALYST RESULT)
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                                            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs">
                                                <span className="font-bold text-gray-400 uppercase block mb-1 text-[10px]">Keputusan Analyst</span>
                                                <span className="font-extrabold text-emerald-700 text-sm">{currentSelected?.analystResult?.decision || 'Disetujui (Layak Develop)'}</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs">
                                                <span className="font-bold text-gray-400 uppercase block mb-1 text-[10px]">Estimasi Pengerjaan</span>
                                                <span className="font-extrabold text-[#1A56DB] text-sm">{currentSelected?.analystResult?.estimation || '30 Hari Kerja'}</span>
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs mt-2 text-xs">
                                            <span className="font-bold text-gray-400 uppercase block mb-1 text-[10px]">Catatan & Instuksi Analis</span>
                                            <p className="text-gray-700 font-medium leading-relaxed">
                                                {currentSelected?.analystResult?.notes || 'Spesifikasi teknis telah lengkap dan divalidasi sesuai standar arsitektur perbankan.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Bab 2: Ruang Lingkup Arsitektur Sistem */}
                                    <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-3 text-xs sm:text-sm">
                                        <h4 className="font-bold text-xs text-[#003a73] uppercase tracking-wider border-b border-gray-100 pb-2">
                                            2. SPESIFIKASI ARSITEKTUR & INTEGRASI SISTEM
                                        </h4>
                                        <ul className="list-disc pl-5 text-gray-700 space-y-2">
                                            <li>Integrasi API Middleware Gateway dengan infrastruktur Core Banking Bank Nagari.</li>
                                            <li>Penerapan autentikasi dua faktor (2FA) & mekanisme SSL Pinning pada jalur komunikasi data.</li>
                                            <li>Fitur otorisasi akses bertingkat (*Role-Based Access Control*) untuk menjaga integritas data nasabah.</li>
                                        </ul>
                                    </div>

                                    {/* Bab 3: Kepatuhan Keamanan Siber */}
                                    <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-2 text-xs sm:text-sm">
                                        <h4 className="font-bold text-xs text-[#003a73] uppercase tracking-wider border-b border-gray-100 pb-2">
                                            3. KEPATUHAN KEAMANAN SIBER & REGULASI POJK
                                        </h4>
                                        <p className="text-gray-600 leading-relaxed">
                                            Seluruh rancangan spesifikasi teknis dalam dokumen FSD ini telah memenuhi ketentuan POJK No.11/POJK.03/2022 tentang Penyelenggaraan Teknologi Informasi oleh Bank Umum serta petunjuk teknis Siber Divisi TI Bank Nagari.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 text-xs">
                            <span className="text-gray-400 font-medium">SDLC Bank Nagari Enterprise • Viewer FSD</span>
                            <button
                                onClick={() => setPreviewFsdDoc(null)}
                                className="px-5 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                                Tutup Viewer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}