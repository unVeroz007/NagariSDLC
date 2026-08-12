import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
    UserX,
    UserCheck,
    CheckCircle2,
} from 'lucide-react';
import { useProjects, getFileFromStore, getProjectRealDocuments } from '../../contexts/ProjectContext';
import { userService } from '../../services/api';
import { documentService } from '../../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';
import { getDocExtLabel, getDocIconStyle } from '../../utils/documentNaming';

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
    const [projectSearch, setProjectSearch] = useState('');
    const [analysts, setAnalysts] = useState([]);

    // Search filter helper untuk antrean
    const applyProjectSearch = (list) => {
        if (!projectSearch.trim()) return list;
        const term = projectSearch.toLowerCase();
        return list.filter(p =>
            String(p.id || '').toLowerCase().includes(term) ||
            String(p.title || p.name || '').toLowerCase().includes(term) ||
            String(p.division || '').toLowerCase().includes(term)
        );
    };

    // Helper: extract analyst name from various shapes (string, object from API, null)
    const analystName = (p) => {
        if (!p) return '';
        const a = p.analyst || p.assignedAnalyst;
        if (!a) return '';
        let name = typeof a === 'object' ? (a?.name || '') : String(a);
        if (name && name.includes('(')) {
            name = name.split('(')[0].trim();
        }
        return name;
    };

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
    const activeQueue = applyProjectSearch(
        activeTab === 'disposition' 
            ? dispositionQueue 
            : activeTab === 'analyzing' 
                ? analyzingQueue 
                : verificationQueue
    );
    const [selectedProject, setSelectedProject] = useState(null);

    // Re-sync selectedProject to latest project data after each loadProjects refresh
    useEffect(() => {
        if (!selectedProject) return;
        const fresh = (projects || []).find(p => String(p.id) === String(selectedProject.id)
            || String(p.reqId || p.req_id) === String(selectedProject.reqId || selectedProject.req_id));
        if (fresh) setSelectedProject(fresh);
    }, [projects]);

    // Set default selected project
    const currentSelected = selectedProject || activeQueue[0] || null;

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
    
    // State untuk aksi penolakan/revision proyek
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRevisionForm, setShowRevisionForm] = useState(false);
    const [revisionNotes, setRevisionNotes] = useState('');

    const handleDownloadDoc = async (doc) => {
        if (!doc?.id) return;
        try {
            const blob = await documentService.download(doc.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.name || 'dokumen.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Gagal mengunduh dokumen.');
        }
    };

    // Searchable analyst dropdown state
    const [analystSearch, setAnalystSearch] = useState('');
    const [isAnalystDropdownOpen, setIsAnalystDropdownOpen] = useState(false);
    const [isAnalystLoading, setIsAnalystLoading] = useState(false);
    const analystDropdownRef = useRef(null);
    const analystSearchRef = useRef(null);

    // Load analysts from API (users with analyst roles)
    useEffect(() => {
        const loadAnalysts = async () => {
            setIsAnalystLoading(true);
            try {
                const res = await userService.getAll();
                const users = res.data || res || [];
                const analystRoles = ['analyst'];
                const filtered = users.filter(u => {
                    const roleName = u.role_detail?.name || u.role || '';
                    return analystRoles.includes(roleName);
                }).map(u => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    department: u.division_detail?.name || u.division || 'IT',
                    workload: 0,
                }));
                setAnalysts(filtered);
            } catch {
                setAnalysts([]);
            } finally {
                setIsAnalystLoading(false);
            }
        };
        loadAnalysts();
    }, []);

    // Close analyst dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (analystDropdownRef.current && !analystDropdownRef.current.contains(e.target)) {
                setIsAnalystDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate active workload per analyst
    const analystWorkloads = useMemo(() => {
        const counts = {};
        const finishedAnalysis = ['ANALYSIS_APPROVED','LIVE_PRODUCTION','CANCELLED','REJECTED','READY_FOR_DEVELOPMENT','DEV_ANALYSIS','DEV_ANALYSIS_DONE','IN_DEVELOPMENT','DEV_COMPLETED','SIT_IN_PROGRESS','SIT_PASSED','SIT_REVISION','READY_FOR_QA','QA_IN_PROGRESS','QA_PASSED','RETURN_TO_DEV','CYBER_IN_PROGRESS','CYBER_PASSED','READY_FOR_UAT','UAT_IN_PROGRESS','UAT_PASSED','UAT_REVISION_SIT','UAT_REVISION_DEV','PENDING_GOLIVE','ON_HOLD'];
        (analysts || []).forEach(a => { counts[a.name] = 0; });
        (projects || []).forEach(p => {
            const analystName3 = typeof p.assignedAnalyst === 'object' ? (p.assignedAnalyst?.name || '')
                : (typeof p.analyst === 'object' ? (p.analyst?.name || '') : String(p.assignedAnalyst || p.analyst || ''));
            if (analystName3 && counts[analystName3] !== undefined) {
                if (!finishedAnalysis.includes(p.status)) counts[analystName3]++;
            }
        });
        return counts;
    }, [projects, analysts]);

    // Filtered analysts based on search
    const filteredAnalysts = useMemo(() => {
        if (!analystSearch.trim()) return analysts || [];
        const q = analystSearch.toLowerCase();
        return (analysts || []).filter(a =>
            a.name.toLowerCase().includes(q) ||
            a.email.toLowerCase().includes(q) ||
            a.department.toLowerCase().includes(q)
        );
    }, [analystSearch, analysts]);

    const handleVerify = async () => {
        if (!currentSelected) return;
        setIsSubmitting(true);
        try {
            await updateProject(currentSelected.id, {
                status: 'READY_FOR_DEVELOPMENT',
                statusColor: 'bg-[#00529C]/10 text-[#00529C] border-blue-200',
            });

            addNotification(
                'Analisis Diverifikasi Lead',
                `Hasil analisis teknis untuk ${currentSelected?.title || currentSelected?.name} telah diverifikasi oleh Lead Perencanaan dan diteruskan ke Lead Pengembangan untuk alokasi tim.`,
                'success',
                '/workspace/dev-lead'
            );
            
            toast.success(`Hasil analisis ${currentSelected?.title || currentSelected?.name} berhasil diverifikasi & dikirim ke Lead Pengembangan!`);

            const nextQueue = verificationQueue.filter(p => p.id !== currentSelected.id);
            if (nextQueue.length > 0) {
                setSelectedProject(nextQueue[0]);
            } else {
                setSelectedProject(null);
            }
        } catch (err) {
            toast.error('Gagal verifikasi: ' + (err.message || 'Terjadi kesalahan'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!currentSelected) return;
        if (!rejectNotes.trim()) {
            toast.error('Alasan penolakan dari Lead wajib diisi agar User tahu penyebab proyek ditolak!');
            return;
        }
        if (!window.confirm('Apakah Anda yakin ingin MENOLAK proyek ini? Status tidak dapat dibatalkan tanpa perbaikan dari peminta.')) {
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProject(currentSelected.id, {
                status: 'REJECTED',
                rejection_reason: rejectNotes,
                rejectionReason: rejectNotes,
                notes: rejectNotes,
            });
            addNotification(
                'Proyek Ditolak oleh Lead',
                `Proyek ${currentSelected?.title || currentSelected?.name} DITOLAK oleh Lead Perencanaan. Catatan: ${rejectNotes}`,
                'warning',
                '/track'
            );
            toast.success('Proyek ditolak dan dikembalikan ke User.');
            setShowRejectForm(false);
            setRejectNotes('');
            const nextQueue = verificationQueue.filter(p => p.id !== currentSelected.id);
            if (nextQueue.length > 0) {
                setSelectedProject(nextQueue[0]);
            } else {
                setSelectedProject(null);
            }
        } catch (err) {
            toast.error('Gagal menolak: ' + (err.message || 'Terjadi kesalahan'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevision = async () => {
        if (!currentSelected) return;
        if (!revisionNotes.trim()) {
            toast.error('Catatan revisi wajib diisi untuk memberi panduan ke Analyst!');
            return;
        }
        if (!window.confirm('Apakah Anda yakin ingin mengembalikan proyek ini ke Analyst untuk direvisi?')) {
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProject(currentSelected.id, {
                status: 'IN_REVIEW',
                notes: revisionNotes,
                leadNote: revisionNotes,
                leadNotes: revisionNotes,
            });
            addNotification(
                'Kajian Dikembalikan ke Analyst',
                `Proyek ${currentSelected?.title || currentSelected?.name} dikembalikan ke Analyst oleh Lead Perencanaan. Arahan: ${revisionNotes}`,
                'info',
                '/workspace/analyst'
            );
            toast.success('Proyek dikembalikan ke Analyst untuk direvisi.');
            setShowRevisionForm(false);
            setRevisionNotes('');
            const nextQueue = verificationQueue.filter(p => p.id !== currentSelected.id);
            if (nextQueue.length > 0) {
                setSelectedProject(nextQueue[0]);
            } else {
                setSelectedProject(null);
            }
        } catch (err) {
            toast.error('Gagal mengembalikan: ' + (err.message || 'Terjadi kesalahan'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssign = () => {
        if (!currentSelected) return;
        if (!selectedAnalyst) {
            toast.error('Pilih analyst terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        
        const assignedNote = notes && notes.trim() !== '' ? notes.trim() : null;

        updateProject(currentSelected.id, {
            analyst: selectedAnalyst,
            assignedAnalyst: selectedAnalyst,
            status: 'IN_REVIEW',
            deadline: deadline || null,
            leadNote: assignedNote,
            leadNotes: assignedNote,
            notes: assignedNote,
            assignmentNote: assignedNote,
            dispositionNotes: assignedNote
        });

        addNotification(
            'Disposisi Berhasil',
            `Proyek ${currentSelected.title || currentSelected.name} telah ditugaskan ke ${selectedAnalyst}`,
            'info',
            '/workspace/analyst'
        );
        
        toast.success(`Proyek "${currentSelected?.title || currentSelected?.name}" berhasil ditugaskan ke System Analyst ${selectedAnalyst}!`);
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
                            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${activeTab === 'disposition' ? 'bg-[#00529C] text-white shadow-md' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                        >
                            Disposisi Proyek Baru
                        </button>
                        <button
                            onClick={() => { setActiveTab('analyzing'); setSelectedProject(null); }}
                            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'analyzing' ? 'bg-[#00529C] text-white shadow-md' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
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
                            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'verification' ? 'bg-[#00529C] text-white shadow-md' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT PANEL: Antrean */}
                <div className="flex flex-col overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-sm lg:col-span-1 lg:max-h-[calc(100vh-160px)]">
                    <div className="p-4 border-b border-gray-100 shrink-0">


                        <div>
                            <h2 className="text-base font-bold text-gray-800">
                                {activeTab === 'disposition' && 'Antrean Disposisi Baru'}
                                {activeTab === 'analyzing' && 'Proyek Sedang Dikaji Analyst'}
                                {activeTab === 'verification' && 'Antrean Verifikasi FSD'}
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {activeTab === 'disposition' && `${activeQueue.length} proyek menunggu penugasan analis`}
                                {activeTab === 'analyzing' && `${activeQueue.length} proyek dalam kajian teknis`}
                                {activeTab === 'verification' && `${activeQueue.length} proyek menunggu verifikasi FSD`}
                            </p>
                        </div>
                    </div>
                    <div className="p-3 border-b border-gray-100 shrink-0">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={projectSearch}
                                onChange={(e) => setProjectSearch(e.target.value)}
                                placeholder="Cari proyek (ID, nama, divisi)..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/40">
                        {activeQueue.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => {
                                    setSelectedProject(project);
                                    // Reset deadline: gunakan nilai dari proyek jika ada, jika tidak kosongkan
                                    if (project.deadline || project.current_stage_deadline) {
                                        setDeadline((project.deadline || project.current_stage_deadline).split('T')[0]);
                                    } else {
                                        setDeadline('');
                                    }
                                    setSelectedAnalyst('');
                                    setNotes('');
                                    setAnalystSearch('');
                                }}
                                className={`p-4 rounded-xl cursor-pointer transition-all relative overflow-hidden group ${
                                    selectedProject?.id === project.id
                                        ? 'bg-white border-2 border-[#00529C] shadow-md'
                                        : 'bg-white border border-gray-200 hover:border-[#00529C]/40 hover:shadow-md'
                                }`}
                            >
                                {selectedProject?.id === project.id && (
                                    <div className="absolute left-0 top-0 w-1 h-full bg-[#00529C] rounded-l-xl" />
                                )}
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityColor(project.priority)}`}>
                                        {project.priority === 'High' ? '🔴 Tinggi' : project.priority === 'Medium' ? '🟡 Sedang' : '🟢 Rendah'}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {new Date(project.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                                <div className="mb-2"><div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={project.type} deadline={project.rbbDeadline} status={project.status} /><ProjectTypeBadge type={project.project_type} /></div></div>
                                <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-[#00529C] transition-colors">{project.title || project.name}</h3>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Users size={13} />
                                    <span>{project.division}</span>
                                </div>

                                {/* Info Status Analis — sesuai tab aktif */}
                                {activeTab === 'disposition' && (
                                    <div className="flex items-center gap-1.5 mt-2.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                                        <UserX size={13} className="text-gray-400 shrink-0" />
                                        <span className="text-[11px] text-gray-500 font-medium">
                                            Belum didisposisi ke analis
                                        </span>
                                    </div>
                                )}
                                {activeTab === 'analyzing' && (
                                    <div className="flex items-center gap-1.5 mt-2.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                        <UserCheck size={13} className="text-amber-600 shrink-0" />
                                        <span className="text-[11px] text-amber-700 font-medium truncate">
                                            Analis: {analystName(project) || 'Belum ditugaskan'}
                                        </span>
                                    </div>
                                )}
                                {activeTab === 'verification' && (
                                    <div className="flex items-center gap-1.5 mt-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                        <span className="text-[11px] text-emerald-700 font-medium truncate">
                                            Hasil dari: {analystName(project) || 'Analis'}
                                        </span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-2.5 mt-2.5 border-t border-gray-100">
                                    <span className="text-[10px] font-bold text-[#00529C] bg-blue-50 px-2 py-0.5 rounded">{project.reqId || project.req_id || project.id}</span>
                                    <span className="text-[10px] text-gray-400">{project.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT PANEL: Detail & Form */}
                <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm">
                    {!currentSelected ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-scale-in min-h-[400px]">
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
                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{currentSelected.reqId || currentSelected.req_id || currentSelected.id}</span>
                                </div>
                                <div className="mb-2"><div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={currentSelected.type} deadline={currentSelected.rbbDeadline} status={currentSelected.status} /><ProjectTypeBadge type={currentSelected.project_type} /></div></div>
                                <h2 className="text-2xl font-extrabold text-gray-800">{currentSelected.title || currentSelected.name}</h2>
                                <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                    <Users size={15} />
                                    <span>{currentSelected.division}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPreviewModalOpen(true)}
                                className="p-2.5 text-gray-400 hover:text-[#00529C] hover:bg-blue-50 rounded-xl transition-colors border border-gray-200 cursor-pointer"
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

                    <div className="p-6 space-y-6">
                        {/* Documents — hanya dokumen inisiasi (BRD, Memo, Lampiran) */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <FolderOpen size={20} className="text-[#00529C]" />
                                Dokumen Inisiasi
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(() => {
                                    const allDocs = getProjectRealDocuments(currentSelected);
                                    const initDocs = allDocs.filter(d => {
                                        const t = (d.type || d.doc_type || d.document_type || '').toUpperCase();
                                        const n = (d.name || '').toLowerCase();
                                        return t === 'BRD' || t === 'MEMO' || t === 'LAMPIRAN'
                                            || n.includes('/brd/') || n.includes('/memo/') || n.includes('/lampiran/');
                                    });
                                    const docs = initDocs.length > 0 ? initDocs : allDocs;
                                    if (docs.length === 0) return (
                                        <div className="col-span-2 p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50 text-center text-xs text-gray-400 italic">
                                            Peminta belum mengunggah dokumen inisiasi.
                                        </div>
                                    );
                                    return docs.map((doc, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 hover:border-gray-300 transition-colors group">
                                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                            <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 font-bold text-[10px] ${getDocIconStyle(doc.name || doc.file_name || doc.type || '')}`}>
                                                {getDocExtLabel(doc.name || doc.file_name || doc.type || '')}
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
                                                className="px-3 py-1.5 border border-[#00529C] text-[#00529C] hover:bg-blue-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
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
                                                        const textContent = `PT BANK NAGARI - DOKUMEN SDLC\n===============================\nNama Dokumen: ${fileName}\nProyek: ${currentSelected?.title || currentSelected?.name || 'Proyek SDLC'}\nTanggal: ${new Date().toLocaleDateString('id-ID')}`;
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
                                                className="p-2 text-gray-500 hover:text-[#00529C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                title="Unduh Dokumen"
                                            >
                                                <Download size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ));
                            })()}
                            </div>
                        </div>

                        <hr className="border-gray-200 mb-6" />

                        {/* Action Form (Assignment / Monitoring / Verification) */}
                        {activeTab === 'disposition' ? (
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <User size={20} className="text-[#00529C]" />
                                    Form Penugasan Analis
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Pilih System Analyst <span className="text-red-500">*</span></label>
                                        <div className="relative" ref={analystDropdownRef}>
                                            {/* Trigger Input */}
                                            <div
                                                onClick={() => {
                                                    setIsAnalystDropdownOpen(!isAnalystDropdownOpen);
                                                    setTimeout(() => analystSearchRef.current?.focus(), 50);
                                                }}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus-within:border-[#00529C] focus-within:ring-2 focus-within:ring-blue-50 transition-all bg-white cursor-pointer flex items-center justify-between"
                                            >
                                                {selectedAnalyst ? (
                                                    <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                                                        <span className="w-7 h-7 rounded-full bg-[#00529C] text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                            {selectedAnalyst.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                        </span>
                                                        <div>
                                                            <span className="block leading-tight">{selectedAnalyst}</span>
                                                            <span className="text-[10px] text-gray-400 font-normal">{analystWorkloads[selectedAnalyst] || 0} proyek aktif</span>
                                                        </div>
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">Ketik nama atau email untuk mencari...</span>
                                                )}
                                                <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isAnalystDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </div>

                                            {/* Dropdown Panel */}
                                            {isAnalystDropdownOpen && (
                                                <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-scale-up">
                                                    {/* Search Input */}
                                                    <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                                                        <div className="relative">
                                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                ref={analystSearchRef}
                                                                type="text"
                                                                value={analystSearch}
                                                                onChange={(e) => setAnalystSearch(e.target.value)}
                                                                onFocus={() => setIsAnalystDropdownOpen(true)}
                                                                placeholder="Cari berdasarkan nama, email, atau departemen..."
                                                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] outline-none transition-all"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Analyst List */}
                                                    <div className="max-h-[260px] overflow-y-auto">
                                                        {isAnalystLoading ? (
                                                            <div className="p-6 text-center">
                                                                <LoadingSpinner size="sm" />
                                                                <p className="text-sm text-gray-500 font-medium mt-2">Memuat daftar analis...</p>
                                                            </div>
                                                        ) : filteredAnalysts.length === 0 ? (
                                                            <div className="p-6 text-center">
                                                                <Search size={24} className="mx-auto text-gray-300 mb-2" />
                                                                <p className="text-sm text-gray-500 font-medium">Tidak ditemukan analis</p>
                                                                <p className="text-xs text-gray-400">{analystSearch ? 'Coba kata kunci lain' : 'Belum ada user dengan role analyst'}</p>
                                                            </div>
                                                        ) : (
                                                            filteredAnalysts.map((a, i) => {
                                                                const workload = analystWorkloads[a.name] || 0;
                                                                const isSelected = selectedAnalyst === a.name;
                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        onClick={() => {
                                                                            setSelectedAnalyst(a.name);
                                                                            setIsAnalystDropdownOpen(false);
                                                                            setAnalystSearch('');
                                                                        }}
                                                                        className={`px-4 py-3 cursor-pointer transition-all flex items-center gap-3 ${
                                                                            isSelected
                                                                                ? 'bg-[#00529C]/5 border-l-3 border-[#00529C]'
                                                                                : 'hover:bg-blue-50/50 border-l-3 border-transparent'
                                                                        }`}
                                                                    >
                                                                        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00529C] to-[#004080] text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                                            {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                                        </span>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm font-semibold text-gray-800 truncate">{a.name}</span>
                                                                                {isSelected && <Check size={14} className="text-[#00529C] shrink-0" />}
                                                                            </div>
                                                                        </div>
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                                                            workload >= 3 ? 'bg-red-100 text-red-600' : workload >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                                                        }`}>
                                                                            {workload} aktif
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>

                                                    {/* Quick Clear */}
                                                    {selectedAnalyst && (
                                                        <div className="p-2 border-t border-gray-100 bg-gray-50/30">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedAnalyst('');
                                                                    setAnalystSearch('');
                                                                }}
                                                                className="w-full text-center py-1.5 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                            >
                                                                Hapus Pilihan
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target Selesai Analisis (Opsional)</label>
                                        <input
                                            type="date"
                                            value={deadline}
                                            onChange={(e) => setDeadline(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#00529C] focus:ring-2 focus:ring-blue-50 outline-none transition-all bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Catatan untuk Analis (Opsional)</label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Berikan instruksi khusus atau fokus analisis..."
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#00529C] focus:ring-2 focus:ring-blue-50 outline-none transition-all min-h-[80px] resize-y bg-white text-sm"
                                        ></textarea>
                                    </div>

                                    {selectedAnalyst && (
                                        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1.5 animate-fade-in">
                                            <span className="font-bold text-blue-900 block text-[11px] uppercase tracking-wider">Ringkasan Penunjukan Analyst Plan:</span>
                                            <div className="flex flex-wrap items-center justify-between text-blue-950 font-semibold gap-2">
                                                <span>Analyst Terpilih: <strong className="text-[#00529C] font-bold">{selectedAnalyst}</strong></span>
                                                <span>Beban Kerja Saat Ini: <strong className="text-gray-800 font-bold">{
                                                    (projects || []).filter(p => {
            const analystName2 = typeof p.assignedAnalyst === 'object' ? (p.assignedAnalyst?.name || '') : (analystName(p) || String(p.analyst || p.assignedAnalyst || ''));
                                                        const matches = analystName2.toLowerCase().includes(selectedAnalyst.toLowerCase());
                                                        const isFinished = p.status === 'LIVE_PRODUCTION' || p.status === 'CANCELLED' || p.status === 'REJECTED';
                                                        return matches && !isFinished;
                                                    }).length
                                                } Proyek Aktif</strong></span>
                                                <span>Perkiraan Selesai Kajian: <strong className="text-emerald-700 font-bold">{(() => {
                                                    const targetD = deadline ? new Date(deadline) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
                                                    return targetD.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                                                })()}</strong></span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <button
                                            onClick={handleAssign}
                                            disabled={isSubmitting || !selectedAnalyst}
                                            className="w-full bg-[#00529C] hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                                            {analystName(currentSelected) || 'Belum Ditugaskan'}
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
                                    {(() => {
                                        // Ambil dokumen dari list uploadedDocs di analystResult
                                        const analystDocIds = currentSelected?.analyst_docs || currentSelected?.analystResult?.uploadedDocs || [];
                                        if (!analystDocIds.length) return (
                                            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs text-center text-xs text-gray-400 italic">
                                                Analis belum melampirkan dokumen kajian.
                                            </div>);
                                        // Cocokkan dengan dokumen real dari API
                                        const allApiDocs = getProjectRealDocuments(currentSelected);
                                        const analystDocs = analystDocIds
                                            .map(docRef => allApiDocs.find(d => String(d.id) === String(docRef.id)))
                                            .filter(Boolean);
                                        if (analystDocs.length === 0) return (
                                            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs text-center text-xs text-gray-400 italic">
                                                Analis belum melampirkan dokumen kajian.
                                            </div>);
                                        return analystDocs.map((doc, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${getDocIconStyle(doc.name || doc.file_name || '')}`}>
                                                        {getDocExtLabel(doc.name || doc.file_name || '')}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BERKAS KAJIAN TEKNIS</p>
                                                        <p className="font-bold text-gray-800 text-sm truncate">{doc.name}</p>
                                                        <p className="text-[11px] text-gray-500">{doc.size || 'N/A'} • {new Date(doc.created_at || doc.uploadedAt || Date.now()).toLocaleDateString('id-ID', {day:'numeric',month:'short'})}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button type="button" onClick={() => setPreviewFsdDoc(doc)}
                                                        className="px-3 py-1.5 border border-[#00529C] text-[#00529C] rounded-lg font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5 text-xs cursor-pointer">
                                                        <Eye size={14} /> View &amp; Baca
                                                    </button>
                                                    <button type="button" onClick={() => handleDownloadDoc(doc)}
                                                        className="p-2 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer" title="Unduh">
                                                        <Download size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ));
                                    })()}

                                    {(() => {
                                        const dec = currentSelected.analystDecision || currentSelected.analystResult?.decision || 'Disetujui';
                                        const isRejectRec = String(dec).toLowerCase().includes('ditolak') || String(dec).toLowerCase().includes('tidak');
                                        return (
                                            <div className={`p-4 rounded-xl border shadow-xs ${isRejectRec ? 'bg-red-50 border-red-200' : 'bg-white border-emerald-100'}`}>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Keputusan &amp; Rekomendasi Analis</p>
                                                <p className={`font-bold text-base ${isRejectRec ? 'text-red-700' : 'text-emerald-800'}`}>{dec}</p>
                                                {isRejectRec && (
                                                    <p className="text-xs text-red-600 mt-1 font-medium">
                                                        ⚠️ Analis merekomendasikan penolakan proyek. Silakan periksa catatan teknis analis di bawah, lalu klik "Tolak Proyek (Kembalikan ke User)" atau "Kembalikan ke Analyst (Revisi)".
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })()}
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
                                    <div className="pt-2 space-y-3">
                                        <button
                                            onClick={handleVerify}
                                            disabled={isSubmitting}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                        >
                                            {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <Send size={18} />}
                                            Lanjutkan ke Pengembangan (Alokasi Tim)
                                        </button>

                                        {/* Opsi Revision & Penolakan */}
                                        {!showRevisionForm && !showRejectForm && (
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowRevisionForm(true); setShowRejectForm(false); }}
                                                    disabled={isSubmitting}
                                                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                                                >
                                                    <AlertCircle size={16} />
                                                    Kembalikan ke Analyst (Revisi)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowRejectForm(true); setShowRevisionForm(false); }}
                                                    disabled={isSubmitting}
                                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                                                >
                                                    <X size={16} />
                                                    Tolak Proyek (Kembalikan ke User)
                                                </button>
                                            </div>
                                        )}

                                        {showRevisionForm && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 animate-scale-up">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                                        <AlertCircle size={14} /> Kembalikan ke Analyst
                                                    </p>
                                                    <button onClick={() => setShowRevisionForm(false)} className="text-amber-500 hover:text-amber-700"><X size={16} /></button>
                                                </div>
                                                <textarea
                                                    rows={3}
                                                    value={revisionNotes}
                                                    onChange={(e) => setRevisionNotes(e.target.value)}
                                                    placeholder="Tuliskan arahan perbaikan/komentar untuk Analyst (wajib diisi)..."
                                                    className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleRevision}
                                                    disabled={isSubmitting}
                                                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                                                >
                                                    {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <Send size={16} />}
                                                    Konfirmasi Kembalikan ke Analyst
                                                </button>
                                            </div>
                                        )}

                                        {showRejectForm && (
                                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 animate-scale-up">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                                                        <X size={14} /> Tolak Proyek
                                                    </p>
                                                    <button onClick={() => setShowRejectForm(false)} className="text-red-400 hover:text-red-700"><X size={16} /></button>
                                                </div>
                                                <textarea
                                                    rows={3}
                                                    value={rejectNotes}
                                                    onChange={(e) => setRejectNotes(e.target.value)}
                                                    placeholder="Tuliskan alasan penolakan & perbaikan yang harus dilakukan User (wajib diisi)..."
                                                    className="w-full px-3.5 py-2.5 bg-white border border-red-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleReject}
                                                    disabled={isSubmitting}
                                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                                                >
                                                    {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <X size={16} />}
                                                    Konfirmasi Tolak Proyek
                                                </button>
                                            </div>
                                        )}
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
                    <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl animate-scale-up border border-gray-100">
                        <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-[#00529C] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                        {currentSelected.reqId || currentSelected.req_id || currentSelected.id}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityColor(currentSelected.priority)}`}>
                                        {currentSelected.priority === 'High' ? '🔴 High Priority' : currentSelected.priority === 'Medium' ? '🟡 Medium' : '🟢 Low'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">{currentSelected.title || currentSelected.name}</h3>
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
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2">
                                    <p className="font-bold text-gray-400 uppercase">Pemohon</p>
                                    <p className="font-semibold text-gray-800 mt-0.5">
                                        {typeof currentSelected.creator === 'object'
                                            ? (currentSelected.creator?.name || '—')
                                            : (currentSelected.creator || currentSelected.createdBy || '—')}
                                    </p>
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
                <DocumentViewerModal
                    doc={previewFsdDoc}
                    project={currentSelected}
                    onClose={() => setPreviewFsdDoc(null)}
                />
            )}
        </div>
    );
}
