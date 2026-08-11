// src/pages/pm/ProjectTracker.jsx
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useProjects, getFileFromStore } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import {
    Search,
    Filter,
    ChevronRight,
    CheckCircle2,
    Circle,
    Clock,
    XCircle,
    AlertCircle,
    FolderOpen,
    Users,
    Bug,
    ShieldCheck,
    Rocket,
    FileCheck,
    CalendarDays,
    User,
    MapPin,
    Flag,
    FileText,
    Download,
} from 'lucide-react';
import {
    PROJECT_STATUS,
    PROJECT_STATUS_LABEL,
    PROJECT_STATUS_COLOR,
} from '../../constants/projectStatus';

// ────────────────────────────────────────────────────────────
// Helper: Resolve seluruh dokumen ASLI proyek secara real-time
// ────────────────────────────────────────────────────────────
const resolveAllProjectDocs = (project) => {
    if (!project) return [];
    
    const docsMap = new Map();

    // 1. Berkas bawaan / uploaded pada proyek ini
    if (Array.isArray(project.documents) && project.documents.length > 0) {
        project.documents.forEach((d, idx) => {
            const name = d.name || d.file_name || `Dokumen_${idx + 1}.pdf`;
            if (!docsMap.has(name)) {
                docsMap.set(name, {
                    id: d.id || `doc-${idx}`,
                    name: name,
                    size: d.size || d.file_size || '1.8 MB',
                    type: (d.type || d.doc_type || 'BRD').toUpperCase(),
                    category: d.category || 'Inisiasi Peminta',
                    date: d.date || d.uploaded_at || 'Terbaru',
                    url: d.url || d.fileUrl || d.dataUrl || getFileFromStore(name) || null,
                    dataUrl: d.dataUrl || null,
                    rawFile: d.rawFile || null
                });
            }
        });
    }

    // 2. Berkas FSD Perencanaan TI (jika disetujui Analis)
    if (project.fsdDocument && (project.fsdDocument.name || project.fsdDocument.file_name)) {
        const name = project.fsdDocument.name || project.fsdDocument.file_name;
        if (!docsMap.has(name)) {
            docsMap.set(name, {
                id: project.fsdDocument.id || 'doc-fsd-plan',
                name: name,
                size: project.fsdDocument.size || '2.4 MB',
                type: 'FSD (PLAN)',
                category: 'Analisis Teknis TI',
                url: project.fsdDocument.url || project.fsdDocument.fileUrl || getFileFromStore(name) || null
            });
        }
    }

    // 3. Berkas Spesifikasi Arsitektur / FSD Dev (jika disetujui Dev Lead)
    if (project.fsdDevDocument && (project.fsdDevDocument.name || project.fsdDevDocument.file_name)) {
        const name = project.fsdDevDocument.name || project.fsdDevDocument.file_name;
        if (!docsMap.has(name)) {
            docsMap.set(name, {
                id: project.fsdDevDocument.id || 'doc-fsd-dev',
                name: name,
                size: project.fsdDevDocument.size || '3.1 MB',
                type: 'FSD DEV',
                category: 'Spesifikasi Arsitektur',
                url: project.fsdDevDocument.url || project.fsdDevDocument.fileUrl || getFileFromStore(name) || null
            });
        }
    }

    // 4. Lembar Sign-Off QA
    if (project.qaDocument || project.qaSignOffDocument) {
        const doc = project.qaDocument || project.qaSignOffDocument;
        const name = doc.name || doc.file_name;
        if (name && !docsMap.has(name)) {
            docsMap.set(name, {
                id: doc.id || 'doc-qa-pass',
                name: name,
                size: doc.size || '1.4 MB',
                type: 'QA SIGN-OFF',
                category: 'Quality Assurance',
                url: doc.url || doc.fileUrl || getFileFromStore(name) || null
            });
        }
    }

    // 5. Lembar Sign-Off Cyber Security
    if (project.cyberDocument || project.cyberSignOffDocument) {
        const doc = project.cyberDocument || project.cyberSignOffDocument;
        const name = doc.name || doc.file_name;
        if (name && !docsMap.has(name)) {
            docsMap.set(name, {
                id: doc.id || 'doc-cyber-pass',
                name: name,
                size: doc.size || '1.6 MB',
                type: 'CYBER SIGN-OFF',
                category: 'Audit Keamanan',
                url: doc.url || doc.fileUrl || getFileFromStore(name) || null
            });
        }
    }

    // 6. Surat Pass Release Production
    if (project.releaseDocument || project.releaseSignOffDocument) {
        const doc = project.releaseDocument || project.releaseSignOffDocument;
        const name = doc.name || doc.file_name;
        if (name && !docsMap.has(name)) {
            docsMap.set(name, {
                id: doc.id || 'doc-release-pass',
                name: name,
                size: doc.size || '1.1 MB',
                type: 'IZIN RILIS',
                category: 'Quality Gate Production',
                url: doc.url || doc.fileUrl || getFileFromStore(name) || null
            });
        }
    }

    return Array.from(docsMap.values());
};

// ────────────────────────────────────────────────────────────
// Data definisi fase untuk timeline
// ────────────────────────────────────────────────────────────
const PHASES = [
    {
        id: 'phase1',
        label: 'Fase 1',
        sublabel: 'Inisiasi & Review',
        icon: FileCheck,
        color: 'blue',
        bgFrom: 'from-blue-500',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        borderColor: 'border-blue-200',
        activeBg: 'bg-blue-50',
        statuses: [
            PROJECT_STATUS.PENDING,
            PROJECT_STATUS.IN_REVIEW,
            PROJECT_STATUS.ANALYSIS_APPROVED,
        ],
    },
    {
        id: 'phase2',
        label: 'Fase 2',
        sublabel: 'Pengembangan IT',
        icon: FolderOpen,
        color: 'indigo',
        bgFrom: 'from-indigo-500',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        borderColor: 'border-indigo-200',
        activeBg: 'bg-indigo-50',
        statuses: [
            PROJECT_STATUS.READY_FOR_DEVELOPMENT,
            PROJECT_STATUS.DEV_ANALYSIS,
            PROJECT_STATUS.DEV_ANALYSIS_DONE,
            PROJECT_STATUS.IN_DEVELOPMENT,
        ],
    },
    {
        id: 'phase3qa',
        label: 'Fase 3A',
        sublabel: 'Quality Assurance',
        icon: Bug,
        color: 'purple',
        bgFrom: 'from-purple-500',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        borderColor: 'border-purple-200',
        activeBg: 'bg-purple-50',
        statuses: [
            PROJECT_STATUS.READY_FOR_QA,
            PROJECT_STATUS.QA_IN_PROGRESS,
            PROJECT_STATUS.QA_PASSED,
        ],
    },
    {
        id: 'phase3cyber',
        label: 'Fase 3B',
        sublabel: 'Cyber Security',
        icon: ShieldCheck,
        color: 'orange',
        bgFrom: 'from-orange-500',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        borderColor: 'border-orange-200',
        activeBg: 'bg-orange-50',
        statuses: [
            PROJECT_STATUS.CYBER_IN_PROGRESS,
            PROJECT_STATUS.CYBER_PASSED,
        ],
    },
    {
        id: 'phase4',
        label: 'Fase 4',
        sublabel: 'Rilis & Kepatuhan',
        icon: Rocket,
        color: 'emerald',
        bgFrom: 'from-emerald-500',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        borderColor: 'border-emerald-200',
        activeBg: 'bg-emerald-50',
        statuses: [
            PROJECT_STATUS.READY_FOR_UAT,
            PROJECT_STATUS.UAT_PASSED,
            PROJECT_STATUS.PENDING_GOLIVE,
            PROJECT_STATUS.LIVE_PRODUCTION,
        ],
    },
];

// Urutan semua status agar bisa menentukan posisi relatif
const STATUS_ORDER = [
    PROJECT_STATUS.PENDING,
    PROJECT_STATUS.IN_REVIEW,
    PROJECT_STATUS.ANALYSIS_APPROVED,
    PROJECT_STATUS.REJECTED,
    PROJECT_STATUS.READY_FOR_DEVELOPMENT,
    PROJECT_STATUS.DEV_ANALYSIS,
    PROJECT_STATUS.DEV_ANALYSIS_DONE,
    PROJECT_STATUS.IN_DEVELOPMENT,
    PROJECT_STATUS.RETURN_TO_DEV,
    PROJECT_STATUS.READY_FOR_QA,
    PROJECT_STATUS.QA_IN_PROGRESS,
    PROJECT_STATUS.QA_PASSED,
    PROJECT_STATUS.CYBER_IN_PROGRESS,
    PROJECT_STATUS.CYBER_PASSED,
    PROJECT_STATUS.READY_FOR_UAT,
    PROJECT_STATUS.UAT_PASSED,
    PROJECT_STATUS.PENDING_GOLIVE,
    PROJECT_STATUS.LIVE_PRODUCTION,
];

// Tentukan apakah status tertentu sudah dilewati oleh status saat ini
function getStatusState(currentStatus, checkStatus) {
    if (currentStatus === PROJECT_STATUS.REJECTED) {
        return 'rejected';
    }
    const currentIdx = STATUS_ORDER.indexOf(currentStatus);
    const checkIdx = STATUS_ORDER.indexOf(checkStatus);

    if (currentIdx > checkIdx) return 'completed';
    if (currentIdx === checkIdx) return 'active';
    return 'pending';
}

// Tentukan apakah fase sudah selesai, sedang berjalan, atau belum
function getPhaseState(currentStatus, phase) {
    if (currentStatus === PROJECT_STATUS.REJECTED) return 'rejected';

    const currentIdx = STATUS_ORDER.indexOf(currentStatus);
    const phaseStatusIndices = phase.statuses
        .map(s => STATUS_ORDER.indexOf(s))
        .filter(i => i >= 0);

    const minIdx = Math.min(...phaseStatusIndices);
    const maxIdx = Math.max(...phaseStatusIndices);

    if (currentIdx > maxIdx) return 'completed';
    if (currentIdx >= minIdx && currentIdx <= maxIdx) return 'active';
    return 'pending';
}

// ────────────────────────────────────────────────────────────
// Sub-komponen: Card proyek di panel kiri
// ────────────────────────────────────────────────────────────
function ProjectCard({ project, isSelected, onClick }) {
    const statusLabel = PROJECT_STATUS_LABEL[project.status] || project.status;
    const statusColor = PROJECT_STATUS_COLOR[project.status] || 'bg-gray-100 text-gray-600';

    // Hitung % progress berdasarkan posisi status di STATUS_ORDER
    const currentIdx = STATUS_ORDER.indexOf(project.status);
    const progress = project.status === PROJECT_STATUS.LIVE_PRODUCTION
        ? 100
        : project.status === PROJECT_STATUS.REJECTED
        ? 0
        : Math.round(((currentIdx + 1) / STATUS_ORDER.length) * 100);

    return (
        <div
            onClick={onClick}
            className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md group ${
                isSelected
                    ? 'border-[#00529C] bg-blue-50/70 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-[#00529C]/40'
            }`}
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#00529C] mb-0.5">{project.req_id || project.reqId || project.id}</p>
                    <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{project.title || project.name}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={project.type} /><ProjectTypeBadge type={project.project_type} /></div>
            </div>

            <p className="text-xs text-gray-500 mb-3">{project.division || 'Divisi TI'}</p>

            {/* Progress bar */}
            <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-gray-400 font-medium">Progress Fase</span>
                    <span className="text-[10px] font-bold text-gray-600">{progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            project.status === PROJECT_STATUS.COMPLETED
                                ? 'bg-emerald-500'
                                : project.status === PROJECT_STATUS.REJECTED
                                ? 'bg-red-400'
                                : 'bg-[#00529C]'
                        }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Status badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor}`}>
                {statusLabel}
            </span>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// Sub-komponen: Fase item di timeline kanan
// ────────────────────────────────────────────────────────────
function PhaseItem({ phase, currentStatus, isLast }) {
    const PhaseIcon = phase.icon;
    const phaseState = getPhaseState(currentStatus, phase);
    const [isOpen, setIsOpen] = useState(phaseState === 'active');

    const stateConfig = {
        completed: {
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-600',
            border: 'border-emerald-200',
            bg: 'bg-emerald-50',
            label: 'Selesai',
            labelColor: 'text-emerald-600 bg-emerald-100',
            lineBg: 'bg-emerald-300',
        },
        active: {
            iconBg: phase.iconBg,
            iconColor: phase.iconColor,
            border: phase.borderColor,
            bg: phase.activeBg,
            label: 'Sedang Berjalan',
            labelColor: 'text-blue-600 bg-blue-100',
            lineBg: 'bg-[#00529C]',
        },
        pending: {
            iconBg: 'bg-gray-100',
            iconColor: 'text-gray-400',
            border: 'border-gray-200',
            bg: 'bg-gray-50/50',
            label: 'Belum Dimulai',
            labelColor: 'text-gray-500 bg-gray-100',
            lineBg: 'bg-gray-200',
        },
        rejected: {
            iconBg: 'bg-red-100',
            iconColor: 'text-red-500',
            border: 'border-red-200',
            bg: 'bg-red-50',
            label: 'Ditolak',
            labelColor: 'text-red-600 bg-red-100',
            lineBg: 'bg-red-300',
        },
    };

    const cfg = stateConfig[phaseState];

    return (
        <div className="relative">
            {/* Connector line */}
            {!isLast && (
                <div className={`absolute left-6 top-14 w-0.5 h-6 ${cfg.lineBg} z-0`} />
            )}

            <div
                className={`relative z-10 rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden transition-all`}
            >
                {/* Phase header */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center gap-4 p-4 text-left"
                >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                        {phaseState === 'completed' ? (
                            <CheckCircle2 size={22} className="text-emerald-600" />
                        ) : phaseState === 'rejected' ? (
                            <XCircle size={22} className="text-red-500" />
                        ) : (
                            <PhaseIcon size={20} className={cfg.iconColor} />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-800 text-sm">{phase.label}: {phase.sublabel}</p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.labelColor}`}>
                                {cfg.label}
                            </span>
                        </div>
                    </div>
                    <ChevronRight
                        size={18}
                        className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                </button>

                {/* Status steps inside phase */}
                {isOpen && (
                    <div className="px-4 pb-4 space-y-1.5 border-t border-gray-200/60">
                        <div className="pt-3 space-y-1.5">
                            {phase.statuses.map((status) => {
                                const state = getStatusState(currentStatus, status);
                                const label = PROJECT_STATUS_LABEL[status] || status;
                                return (
                                    <div
                                        key={status}
                                        className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                                            state === 'active' ? 'bg-white shadow-sm border border-blue-100' :
                                            state === 'completed' ? 'bg-white/60' : 'opacity-50'
                                        }`}
                                    >
                                        {state === 'completed' ? (
                                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                        ) : state === 'active' ? (
                                            <div className="w-4 h-4 rounded-full border-2 border-[#00529C] bg-white flex items-center justify-center shrink-0">
                                                <div className="w-2 h-2 rounded-full bg-[#00529C] animate-pulse" />
                                            </div>
                                        ) : (
                                            <Circle size={16} className="text-gray-300 shrink-0" />
                                        )}
                                        <span className={`text-sm font-medium ${
                                            state === 'active' ? 'text-[#00529C]' :
                                            state === 'completed' ? 'text-gray-600' : 'text-gray-400'
                                        }`}>
                                            {label}
                                        </span>
                                        {state === 'active' && (
                                            <span className="ml-auto text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                                SAAT INI
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Spacer between phases */}
            {!isLast && <div className="h-3" />}
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────
export default function ProjectTracker() {
    const { projects, isLoading } = useProjects();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const [selectedProject, setSelectedProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPhase, setFilterPhase] = useState('');
    const [previewDoc, setPreviewDoc] = useState(null);
    const detailPanelRef = useRef(null);

    // Convert Data URL / Blob for inline PDF/Document viewing
    const previewBlobUrl = useMemo(() => {
        if (!previewDoc) return null;
        let rawUrl = previewDoc.url || previewDoc.fileUrl || previewDoc.dataUrl;
        if (!rawUrl && previewDoc.name) {
            rawUrl = getFileFromStore(previewDoc.name) || getFileFromStore(previewDoc.id);
        }
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
        let rawUrl = doc.url || doc.fileUrl || doc.dataUrl;
        if (!rawUrl && doc.name) {
            rawUrl = getFileFromStore(doc.name) || getFileFromStore(doc.id);
        }
        const fileName = doc.name || doc.file_name || 'Dokumen_SDLC.pdf';

        if (rawUrl) {
            const link = document.createElement('a');
            link.href = rawUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`Mengunduh berkas "${fileName}"...`);
        } else {
            const textContent = `PT BANK NAGARI - DOKUMEN RESMI SDLC\n=======================================\nNama Dokumen: ${fileName}\nKategori: ${doc.category || doc.type || 'Dokumen SDLC'}\nProyek: ${selectedProject?.name || 'Proyek SDLC'}\nID Proyek: ${selectedProject?.reqId || selectedProject?.id || 'PRJ'}\nDivisi Peminta: ${selectedProject?.division || 'Divisi TI'}\nTanggal Terbit: ${new Date().toLocaleDateString('id-ID')}\nStatus: Terverifikasi Quality Gate SDLC Bank Nagari Enterprise\n=======================================\n\nDokumen ini berisi spesifikasi kebutuhan, arsitektur teknis, serta hasil pengujian dan tata kelola SDLC resmi PT Bank Nagari.`;
            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName.endsWith('.pdf') ? fileName.replace('.pdf', '_Resmi.txt') : `${fileName}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            toast.success(`Mengunduh berkas "${fileName}"...`);
        }
    };

    // Helper untuk scroll paling atas panel detail & container main di MainLayout
    const scrollPageToTop = () => {
        if (detailPanelRef.current) {
            detailPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const mainContainer = detailPanelRef.current?.closest('main') || document.querySelector('main');
        if (mainContainer) {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Auto scroll ke paling atas panel detail & main layout saat proyek dipilih
    useEffect(() => {
        if (selectedProject) {
            scrollPageToTop();
        }
    }, [selectedProject?.id]);

    // Auto seleksi proyek berdasarkan query parameter / location state
    useEffect(() => {
        const targetId = location.state?.projectId || searchParams.get('projectId') || searchParams.get('id');
        if (targetId && projects.length > 0) {
            const found = projects.find(p =>
                String(p.id).toLowerCase() === String(targetId).toLowerCase() ||
                String(p.reqId || p.req_id || '').toLowerCase() === String(targetId).toLowerCase()
            );
            if (found) {
                setSelectedProject(found);
                return;
            }
        }
        // Jika tidak ada ID spesifik dikirim dan selectedProject belum ada, pilih proyek pertama
        if (!selectedProject && projects.length > 0) {
            setSelectedProject(projects[0]);
        }
    }, [location.state, searchParams, projects]);

    // Filter proyek
    const filteredProjects = useMemo(() => {
        let result = projects;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.id.toLowerCase().includes(term) ||
                (p.division || '').toLowerCase().includes(term)
            );
        }
        if (filterPhase) {
            const phase = PHASES.find(ph => ph.id === filterPhase);
            if (phase) {
                result = result.filter(p => phase.statuses.includes(p.status));
            }
        }
        return result;
    }, [projects, searchTerm, filterPhase]);

    // Auto select & scroll
    const handleSelectProject = (project) => {
        setSelectedProject(project);
        scrollPageToTop();
    };

    // Hitung stats for selected project
    const projectPhaseInfo = useMemo(() => {
        if (!selectedProject) return null;
        const currentPhase = PHASES.find(p =>
            p.statuses.includes(selectedProject.status)
        );
        return currentPhase;
    }, [selectedProject]);

    if (isLoading) return <LoadingSpinner text="Memuat data proyek..." />;

    return (
        <div className="flex-1 flex overflow-hidden bg-[#f8f9fb]">
            {/* ── LEFT PANEL: Daftar Proyek ── */}
            <div className="w-[340px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                {/* Header panel kiri */}
                <div className="p-4 border-b border-gray-200 bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-2 mb-3">
                        <MapPin size={18} className="text-[#00529C]" />
                        <h3 className="font-bold text-gray-800">Lacak Status Proyek</h3>
                        <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            {filteredProjects.length} proyek
                        </span>
                    </div>

                    {/* Search */}
                    <div className="relative mb-2">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Cari nama atau ID proyek..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] outline-none bg-white"
                        />
                    </div>

                    {/* Filter fase */}
                    <select
                        value={filterPhase}
                        onChange={e => setFilterPhase(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00529C]/20 outline-none bg-white text-gray-600"
                    >
                        <option value="">Semua Fase</option>
                        {PHASES.map(ph => (
                            <option key={ph.id} value={ph.id}>{ph.label}: {ph.sublabel}</option>
                        ))}
                    </select>
                </div>

                {/* List proyek */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {filteredProjects.length > 0 ? (
                        filteredProjects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isSelected={selectedProject?.id === project.id}
                                onClick={() => handleSelectProject(project)}
                            />
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <Search size={32} className="text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">Tidak ada proyek ditemukan.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── RIGHT PANEL: Detail Tracker ── */}
            <div ref={detailPanelRef} className="flex-1 overflow-y-auto">
                {selectedProject ? (
                    <div className="max-w-3xl mx-auto p-6">
                        {/* Project header */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">ID Proyek</span>
                                            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                {selectedProject.id}
                                            </span>
                                        </div>
                                        <h1 className="text-2xl font-black text-gray-800 leading-tight mb-2">
                                            {selectedProject.title || selectedProject.name}
                                        </h1>
                                        <p className="text-sm text-gray-500 mb-4">
                                            {selectedProject.description || 'Tidak ada deskripsi.'}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={selectedProject.type} /><ProjectTypeBadge type={selectedProject.project_type} /></div>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${PROJECT_STATUS_COLOR[selectedProject.status] || 'bg-gray-100 text-gray-600'}`}>
                                                {PROJECT_STATUS_LABEL[selectedProject.status] || selectedProject.status}
                                            </span>
                                        </div>
                                    </div>
                                    {projectPhaseInfo && (
                                        <div className={`p-4 ${projectPhaseInfo.iconBg} rounded-xl text-center shrink-0`}>
                                            {(() => { const Icon = projectPhaseInfo.icon; return <Icon size={32} className={projectPhaseInfo.iconColor} />; })()}
                                            <p className={`text-xs font-bold mt-1.5 ${projectPhaseInfo.iconColor}`}>{projectPhaseInfo.label}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Info grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
                                    <div>
                                        <p className="text-xs text-gray-400 font-semibold mb-0.5 flex items-center gap-1">
                                            <User size={11} /> Project Manager
                                        </p>
                                        <p className="text-sm font-semibold text-gray-700">
                                            {selectedProject.pm?.name || '— Belum Ditugaskan —'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-semibold mb-0.5 flex items-center gap-1">
                                            <Users size={11} /> Divisi
                                        </p>
                                        <p className="text-sm font-semibold text-gray-700">
                                            {selectedProject.division || '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-semibold mb-0.5 flex items-center gap-1">
                                            <CalendarDays size={11} /> Target Selesai
                                        </p>
                                        <p className="text-sm font-semibold text-gray-700">
                                            {selectedProject.targetDate || '—'}
                                        </p>
                                    </div>
                                    {selectedProject.rbbDeadline && (
                                        <div className="col-span-full">
                                            <p className="text-xs text-gray-400 font-semibold mb-0.5 flex items-center gap-1">
                                                <Flag size={11} className="text-red-500" /> Deadline RBB
                                            </p>
                                            <p className="text-sm font-bold text-red-600">
                                                {new Date(selectedProject.rbbDeadline).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Timeline Fase */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                    <Clock size={18} className="text-[#00529C]" />
                                    Timeline Fase SDLC
                                    <span className="ml-auto text-xs text-gray-500 font-normal">
                                        Klik fase untuk melihat detail langkah
                                    </span>
                                </h2>
                            </div>
                            <div className="p-4">
                                {/* Horizontal phase indicator */}
                                <div className="flex items-center mb-6 overflow-x-auto pb-2">
                                    {PHASES.map((phase, idx) => {
                                        const state = getPhaseState(selectedProject.status, phase);
                                        const PhIcon = phase.icon;
                                        return (
                                            <div key={phase.id} className="flex items-center shrink-0">
                                                <div className={`flex flex-col items-center gap-1`}>
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                                                        state === 'completed' ? 'bg-emerald-100 border-emerald-400' :
                                                        state === 'active' ? `${phase.iconBg} border-current ${phase.iconColor}` :
                                                        'bg-gray-100 border-gray-200'
                                                    }`}>
                                                        {state === 'completed'
                                                            ? <CheckCircle2 size={18} className="text-emerald-600" />
                                                            : <PhIcon size={16} className={state === 'active' ? phase.iconColor : 'text-gray-400'} />
                                                        }
                                                    </div>
                                                    <span className={`text-[9px] font-bold text-center leading-tight max-w-[52px] ${
                                                        state === 'completed' ? 'text-emerald-600' :
                                                        state === 'active' ? phase.iconColor :
                                                        'text-gray-400'
                                                    }`}>
                                                        {phase.label}
                                                    </span>
                                                </div>
                                                {idx < PHASES.length - 1 && (
                                                    <div className={`h-0.5 w-8 mx-1 shrink-0 ${
                                                        state === 'completed' ? 'bg-emerald-400' : 'bg-gray-200'
                                                    }`} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Vertical phase detail */}
                                <div>
                                    {PHASES.map((phase, idx) => (
                                        <PhaseItem
                                            key={phase.id}
                                            phase={phase}
                                            currentStatus={selectedProject.status}
                                            isLast={idx === PHASES.length - 1}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Dokumen Terkait (Realtime & Lengkap) */}
                        {(() => {
                            const allDocs = resolveAllProjectDocs(selectedProject);
                            return (
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FolderOpen size={18} className="text-[#00529C]" />
                                            <h2 className="font-bold text-gray-800">Dokumen Terkait ({allDocs.length})</h2>
                                        </div>
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                                            Realtime Sync
                                        </span>
                                    </div>
                                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {allDocs.map((doc, i) => (
                                            <div
                                                key={doc.id || i}
                                                onClick={() => setPreviewDoc(doc)}
                                                className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-xl border border-gray-200/80 hover:bg-blue-50/70 hover:border-blue-200 transition-all cursor-pointer group shadow-2xs"
                                            >
                                                <div className="w-9 h-9 bg-white rounded-lg shadow-sm flex items-center justify-center shrink-0 border border-gray-100">
                                                    <FileText size={16} className="text-[#00529C]" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-gray-800 truncate group-hover:text-[#00529C] transition-colors">
                                                        {doc.name}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                                            {doc.type}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">•</span>
                                                        <span className="text-[10px] text-gray-500 font-medium">{doc.size}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadFile(doc);
                                                    }}
                                                    title="Unduh Berkas"
                                                    className="p-2 text-gray-400 hover:text-[#00529C] hover:bg-white rounded-lg transition-colors shrink-0 border border-transparent hover:border-blue-200 shadow-2xs cursor-pointer"
                                                >
                                                    <Download size={15} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Catatan Analyst */}
                        {selectedProject.analystResult && (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                    <h2 className="font-bold text-gray-800">Catatan Analis</h2>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle2 size={18} className="text-emerald-600" />
                                        <span className="font-semibold text-emerald-700 text-sm">{selectedProject.analystResult.decision}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed italic">
                                        "{selectedProject.analystResult.notes}"
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Aksi cepat */}
                        <div className="flex flex-wrap gap-3 items-center">
                            <button
                                onClick={() => navigate('/projects')}
                                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                <FolderOpen size={16} />
                                Daftar Semua Proyek
                            </button>

                            {/* Tombol Ajukan QA: Aktif HANYA jika pengembangan telah selesai (READY_FOR_QA) */}
                            {selectedProject.status === PROJECT_STATUS.READY_FOR_QA ? (
                                <button
                                    onClick={() => navigate('/pm/qa-request')}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all shadow-md shadow-purple-600/20 active:scale-95"
                                >
                                    <Bug size={16} />
                                    Ajukan QA
                                </button>
                            ) : selectedProject.status === PROJECT_STATUS.IN_DEVELOPMENT ? (
                                <button
                                    disabled
                                    title="Pengembangan IT masih berlangsung. Selesaikan seluruh modul & task sebelum mengajukan QA."
                                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 border border-gray-200 rounded-xl text-sm font-semibold cursor-not-allowed opacity-75"
                                >
                                    <Bug size={16} />
                                    <span>Ajukan QA</span>
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                                        Dev Masih Berjalan
                                    </span>
                                </button>
                            ) : null}

                            {selectedProject.status === PROJECT_STATUS.QA_PASSED && (
                                <button
                                    onClick={() => navigate('/pm/cyber-request')}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 transition-all shadow-md shadow-orange-600/20 active:scale-95"
                                >
                                    <ShieldCheck size={16} />
                                    Ajukan Cyber
                                </button>
                            )}

                            {selectedProject.status === PROJECT_STATUS.CYBER_PASSED && (
                                <button
                                    onClick={() => navigate('/pm/release-request')}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                                >
                                    <Rocket size={16} />
                                    Ajukan Rilis
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <EmptyState
                            title="Pilih Proyek"
                            description="Pilih salah satu proyek dari daftar di sebelah kiri untuk melihat timeline fase SDLC-nya secara detail."
                            icon={MapPin}
                        />
                    </div>
                )}
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
