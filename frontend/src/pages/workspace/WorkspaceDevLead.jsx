import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects, getFileFromStore, getProjectRealDocuments } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import SITUATDocumentModal from '../../components/SITUATDocumentModal';
import {
    Inbox,
    Search as SearchIcon,
    Users,
    CheckCircle2,
    Clock,
    FileText,
    UserCheck,
    Send,
    AlertCircle,
    X,
    Calendar,
    Briefcase,
    Check,
    Building,
    Eye,
    Download,
    FolderOpen,
    Rocket
} from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../../services/api';
import { projectService } from '../../services/api';
import { getDocExtLabel, getDocIconStyle } from '../../utils/documentNaming';

const resolveAllProjectDocs = (project) => {
    if (!project) return [];
    
    const docsMap = new Map();

    // 1. Initial BRD & documents in project.documents
    if (Array.isArray(project.documents) && project.documents.length > 0) {
        project.documents.forEach(d => {
            const docName = d.name || d.file_name || 'Dokumen_SDLC.pdf';
            const key = d.id || docName;
            const isFsd = (d.type === 'fsd' || d.doc_type === 'fsd' || d.document_type === 'fsd' || docName.toLowerCase().includes('fsd') || docName.toLowerCase().includes('kajian'));
            const isFsdDev = (d.type === 'fsd_dev' || d.doc_type === 'fsd_dev' || d.document_type === 'fsd_dev' || d.document_type === 'FSD_DEV');
            docsMap.set(key, {
                ...d,
                name: docName,
                size: d.size || d.file_size || '2.0 MB',
                label: isFsdDev
                    ? 'Spesifikasi Arsitektur (Dev)'
                    : isFsd 
                    ? 'Hasil Kajian FSD (Perencanaan TI)' 
                    : (d.type === 'brd' || d.doc_type === 'brd' || d.category === 'brd' || d.document_type === 'brd' || d.document_type === 'BRD' || docName.toLowerCase().includes('brd') || docName.toLowerCase().includes('laprak') || docName.toLowerCase().includes('form') || docName.toLowerCase().includes('kebutuhan') || docName.toLowerCase().includes('bimbingan')) 
                    ? 'Dokumen BRD Inisiasi' 
                    : (d.label || 'Dokumen SDLC Terlampir')
            });
        });
    }

    // 2. FSD Perencanaan Document
    if (project.fsdDocument && (project.fsdDocument.name || project.fsdDocument.file_name)) {
        const name = project.fsdDocument.name || project.fsdDocument.file_name;
        docsMap.set(name, {
            ...project.fsdDocument,
            name,
            size: project.fsdDocument.size || project.fsdDocument.file_size || '1.8 MB',
            label: 'Hasil Kajian FSD (Perencanaan TI)'
        });
    }

    // 3. FSD File from real documents uploaded via API (removes old synthetic dummy)
    const realDocs = getProjectRealDocuments(project);
    let hasFsd = false;
    for (const doc of docsMap.values()) {
        if (doc.label?.includes('FSD') || doc.type === 'fsd' || doc.doc_type === 'fsd' || doc.name?.toLowerCase().includes('fsd') || doc.name?.toLowerCase().includes('kajian')) {
            hasFsd = true;
            break;
        }
    }
    if (!hasFsd) {
        for (const d of realDocs) {
            const dt = (d.type || d.doc_type || '').toLowerCase();
            const fn = (d.name || '').toLowerCase();
            if (dt === 'fsd' || dt === 'fsd_dev' || fn.includes('fsd') || fn.includes('kajian')) {
                docsMap.set(d.id || d.name, { ...d, label: 'Hasil Kajian FSD (Perencanaan TI)' });
                hasFsd = true;
                break;
            }
        }
    }
    if (!hasFsd) {
        const fa = project.analystResult?.fsdFile;
        if (fa && fa !== 'Dokumen_SDLC.pdf') {
            docsMap.set(fa, {
                id: `FSD-PLN-${project.req_id || project.reqId || project.id}`,
                name: fa,
                size: '1.8 MB',
                type: 'fsd',
                url: project.analystResult?.fsdUrl || null,
                label: 'Hasil Kajian FSD (Perencanaan TI)',
            });
        }
    }

    // 4. FSD Dev / Spesifikasi Arsitektur Document
    if (project.fsdDevDocument && (project.fsdDevDocument.name || project.fsdDevDocument.file_name)) {
        const name = project.fsdDevDocument.name || project.fsdDevDocument.file_name;
        docsMap.set(name, { ...project.fsdDevDocument, name, label: 'Spesifikasi Arsitektur (Dev)' });
    }

    return Array.from(docsMap.values());
};

export default function WorkspaceDevLead() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { projects, updateProject, isLoading } = useProjects();

    const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' | 'analyzing' | 'ready_pm' | 'in_development' | 'completed'
    const [selectedProject, setSelectedProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal Assign Analyst State
    const [isAnalystModalOpen, setIsAnalystModalOpen] = useState(false);
    const [targetProjectForAnalyst, setTargetProjectForAnalyst] = useState(null);
    const [selectedAnalystId, setSelectedAnalystId] = useState('');
    const [analysisDeadline, setAnalysisDeadline] = useState('');
    const [leadNote, setLeadNote] = useState('');
    const [previewDoc, setPreviewDoc] = useState(null);
    const [sitUatModalProject, setSitUatModalProject] = useState(null);

    // Form Assign PM State
    const [selectedPM, setSelectedPM] = useState('');
    const [estimationDays, setEstimationDays] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [analysts, setAnalysts] = useState([]);
    const [pmCandidates, setPmCandidates] = useState([]);
    const [selectedDeveloperIds, setSelectedDeveloperIds] = useState([]);
    const [developerCandidates, setDeveloperCandidates] = useState([]);
    const [developerSearch, setDeveloperSearch] = useState('');
    const [analystSearch, setAnalystSearch] = useState('');

    // Helper ekstraksi angka durasi
    const getNumericEstimation = (proj) => {
        if (!proj) return '30';
        const raw = proj.devAnalystResult?.estimation || proj.analystResult?.estimation || proj.estimation || '30';
        const match = String(raw).match(/\d+/);
        return match ? match[0] : '30';
    };

    // Load analysts & PM candidates from API
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const res = await userService.getAll();
                const users = res.data || res || [];
                // Dev Lead "Dev Analis (PM)" dropdown: hanya Project Manager
                setAnalysts(users.filter(u => (u.role_detail?.name || u.role || '') === 'project_manager').map(u => ({
                    id: u.id, name: u.name, email: u.email, department: u.division_detail?.name || u.division || 'IT', workload: 0,
                })));
                setPmCandidates(users.filter(u => (u.role_detail?.name || u.role || '') === 'project_manager').map(u => ({
                    id: u.id, name: u.name, email: u.email, department: u.division_detail?.name || u.division || 'IT', workload: 0,
                })));
                // Developer candidates
                setDeveloperCandidates(users.filter(u => (u.role_detail?.name || u.role || '') === 'developer').map(u => ({
                    id: u.id, name: u.name, skill: u.division_detail?.name || 'Developer',
                })));
            } catch {
                setAnalysts([]);
                setPmCandidates([]);
                setDeveloperCandidates([]);
            }
        };
        loadUsers();
    }, []);

    // Search filter helper
    const applySearch = (list) => {
        if (!searchTerm.trim()) return list;
        const term = searchTerm.toLowerCase();
        return list.filter(p =>
            String(p.id || '').toLowerCase().includes(term) ||
            String(p.name || '').toLowerCase().includes(term) ||
            String(p.division || '').toLowerCase().includes(term)
        );
    };

    // 1. Proyek Masuk (Hanya proyek yang SUDAH diverifikasi Lead Perencanaan & resmi diserahkan ke Pengembangan)
    const incomingProjects = applySearch(projects.filter(p =>
        p.status === 'READY_FOR_DEVELOPMENT'
    ));

    // 2. Proyek Sedang Dikaji Analyst (Hanya proyek yang sudah ditunjuk System Analyst Pengembangan oleh Dev Lead)
    const analyzingProjects = applySearch(projects.filter(p =>
        p.status === 'DEV_ANALYSIS'
    ));

    // 3. Proyek Siap Tunjuk PM (Hanya proyek yang SUDAH selesai dikaji oleh Analyst Pengembangan)
    const readyForPMProjects = applySearch(projects.filter(p =>
        p.status === 'DEV_ANALYSIS_DONE'
    ));

    // 4. Proyek Sedang Dikembangkan & Pengujian (Meliputi Coding, SIT, UAT, QA, Pentest Siber)
    const inDevelopmentProjects = applySearch(projects.filter(p => {
        const st = String(p.status || '').toUpperCase();
        return [
            'IN_DEVELOPMENT', 'DEVELOPMENT', 'DEV_IN_PROGRESS', 'IN_SPRINT',
            'SIT_IN_PROGRESS', 'SIT_PASSED', 'SIT_REVISION',
            'UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_REVISION_DEV',
            'DEV_COMPLETED', 'READY_FOR_QA', 'QA_IN_PROGRESS', 'QA_PASSED',
            'CYBER_IN_PROGRESS', 'CYBER_PASSED', 'READY_FOR_UAT', 'UAT_PASSED',
            'RETURN_TO_DEV', 'PENDING_GOLIVE'
        ].includes(st);
    }));


    // 5. Proyek Selesai & Go Live
    const completedProjects = applySearch(projects.filter(p =>
        p.status === 'LIVE_PRODUCTION' || p.status === 'QA_PASSED' || p.status === 'CYBER_PASSED'
    ));

    // 📊 Dynamic Real-Time PM Workload Calculation for Dev Lead Recommendation
    const pmWorkloadStats = useMemo(() => {
        const candidates = [
            { id: 1, name: 'Budi Santoso', email: 'pm1@nagari.co.id', department: 'IT Core & Retail Banking', initial: 'BS' },
            { id: 2, name: 'Dewi Lestari', email: 'pm2@nagari.co.id', department: 'Digital Banking & Mobile', initial: 'DL' },
            { id: 3, name: 'Andi Wijaya', email: 'pm3@nagari.co.id', department: 'IT Infrastructure & Security', initial: 'AW' },
            { id: 4, name: 'Citra Kirana', email: 'pm4@nagari.co.id', department: 'Enterprise Systems & Analytics', initial: 'CK' },
        ];

        return candidates.map(pm => {
            const activeProjects = (projects || []).filter(p => {
                const pmName = typeof p.pm === 'object' ? (p.pm?.name || '') : String(p.pm || '');
                const assignedPM = String(p.assignedPM || p.pmName || '');
                const matches = pmName.toLowerCase().includes(pm.name.toLowerCase()) || assignedPM.toLowerCase().includes(pm.name.toLowerCase());
                const isFinished = p.status === 'LIVE_PRODUCTION' || p.status === 'CANCELLED' || p.status === 'REJECTED';
                return matches && !isFinished;
            });

            const count = activeProjects.length;
            let statusTag = 'Beban Ringan';
            let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
            let recommended = false;

            if (count <= 1) {
                statusTag = 'Beban Ringan (Sangat Rekomendasi)';
                badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                recommended = true;
            } else if (count === 2) {
                statusTag = 'Beban Sedang (Ideal)';
                badgeColor = 'bg-blue-100 text-blue-800 border-blue-300';
            } else {
                statusTag = 'Beban Tinggi (Perlu Pertimbangan)';
                badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
            }

            return {
                ...pm,
                activeCount: count,
                statusTag,
                badgeColor,
                recommended,
                activeProjectsList: activeProjects.map(p => p.name || p.title || `Proyek ${p.id}`)
            };
        });
    }, [projects]);


    // Buka modal tugaskan analyst
    const handleOpenAnalystModal = (project) => {
        setTargetProjectForAnalyst(project);
        setSelectedAnalystId('');
        setAnalystSearch('');
        setAnalysisDeadline('');
        setLeadNote('');
        setIsAnalystModalOpen(true);
    };

    // Submit penugasan Analyst
    const handleAssignAnalyst = () => {
        if (!selectedAnalystId) {
            toast.error('Pilih Dev Analis (PM)!');
            return;
        }

        const chosenAnalyst = analysts.find(a => a.id === parseInt(selectedAnalystId));
        if (!chosenAnalyst) return;

        setIsSubmitting(true);

        setTimeout(() => {
            updateProject(targetProjectForAnalyst.id, {
                status: 'DEV_ANALYSIS',
                statusColor: 'bg-amber-100 text-amber-700 border-amber-200',
                assignedAnalyst: chosenAnalyst,
                analyst: chosenAnalyst.name,
                analyst_id: chosenAnalyst.id,
                pm_id: chosenAnalyst.id,
                pm: chosenAnalyst,
                devAnalyst: chosenAnalyst,
                devAnalystName: chosenAnalyst.name,
                leadNote: leadNote || 'Tolong kaji kelayakan arsitektur teknis dan estimasi mandays.',
                current_stage_deadline: analysisDeadline || null,
                deadline: analysisDeadline || null,
                assignedAnalystAt: new Date().toISOString()
            });

            addNotification(
                'Tugas Kajian Teknis Baru',
                `Anda ditugaskan oleh Ketua Grup Pengembangan untuk mengkaji proyek ${targetProjectForAnalyst.name}.`,
                'info',
                '/workspace/analyst'
            );

            toast.success(`Analyst ${chosenAnalyst.name} berhasil ditugaskan!`);
            setIsSubmitting(false);
            setIsAnalystModalOpen(false);
            setTargetProjectForAnalyst(null);
        }, 500);
    };

    // Submit Penunjukan PM
    const handleAssignPM = () => {
        if (!selectedProject) {
            toast.error('Pilih proyek terlebih dahulu!');
            return;
        }
        if (!estimationDays) {
            toast.error('Tentukan target deadline pengembangan!');
            return;
        }

        setIsSubmitting(true);

        const deadlineIso = estimationDays;

        const devIds = selectedDeveloperIds.length > 0 ? selectedDeveloperIds : [];

        updateProject(selectedProject.id, {
            status: 'IN_DEVELOPMENT',
            deadline: deadlineIso,
            targetDate: deadlineIso,
            current_stage_deadline: deadlineIso,
            team_ids: devIds.length > 0 ? devIds : undefined,
        }).then(() => {
            // After project update, also call allocateTeam endpoint if dev selected
            if (devIds.length > 0) {
                return projectService.allocateTeam(selectedProject.id, devIds.map(id => ({ user_id: id })));
            }
        }).then(() => {
            addNotification(
                'Proyek Masuk Tahap Pengembangan',
                `Proyek ${selectedProject.name} telah memasuki tahap pengembangan. PM telah ditentukan dan tim developer telah dialokasikan.`,
                'success',
                '/pm/workspace'
            );
            toast.success(`Proyek "${selectedProject.name}" telah memasuki tahap pengembangan!`);
            setIsSubmitting(false);
            setSelectedProject(null);
            setSelectedPM('');
            setEstimationDays('');
            setSelectedDeveloperIds([]);
        }).catch(err => {
            toast.error('Gagal memulai pengembangan: ' + (err?.message || 'Error'));
            setIsSubmitting(false);
        });
    };

    if (isLoading) {
        return <LoadingSpinner text="Memuat Workspace Ketua Grup..." />;
    }

    return (
        <div className="flex-1 overflow-y-auto bg-[#f8f9fb] p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-extrabold text-gray-800">Workspace Ketua Grup Pengembangan</h1>
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <UserCheck size={14} /> Dev Governance
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Kelola alur penerimaan proyek dari Perencanaan, penugasan Dev Analis (PM), hingga monitoring status pengembangan dan rilis.
                        </p>
                    </div>

                    {/* Search Bar Input */}
                    <div className="relative w-full md:w-80">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari ID, nama, atau divisi proyek..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] transition-all shadow-xs"
                        />
                    </div>
                </div>

                {/* Tab Navigation (5 Tabs) */}
                <div className="flex overflow-x-auto border-b border-gray-200 bg-white rounded-2xl p-1.5 shadow-sm gap-1">
                    <button
                        onClick={() => { setActiveTab('incoming'); setSelectedProject(null); }}
                        className={`flex-1 py-3 px-3 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'incoming'
                                ? 'bg-[#1a365d] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <Inbox size={16} />
                        <span>Tab 1: Proyek Masuk</span>
                        <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${
                            activeTab === 'incoming' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                        }`}>
                            {incomingProjects.length}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('analyzing'); setSelectedProject(null); }}
                        className={`flex-1 py-3 px-3 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'analyzing'
                                ? 'bg-[#1a365d] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <SearchIcon size={16} />
                        <span>Tab 2: Dikaji Analyst</span>
                        <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${
                            activeTab === 'analyzing' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {analyzingProjects.length}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('ready_pm'); setSelectedProject(null); }}
                        className={`flex-1 py-3 px-3 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'ready_pm'
                                ? 'bg-[#1a365d] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <CheckCircle2 size={16} />
                        <span>Tab 3: Siap Mulai Pengembangan</span>
                        <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${
                            activeTab === 'ready_pm' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                            {readyForPMProjects.length}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('in_development'); setSelectedProject(null); }}
                        className={`flex-1 py-3 px-3 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'in_development'
                                ? 'bg-[#1a365d] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <Clock size={16} />
                        <span>Tab 4: Sedang Dikembangkan</span>
                        <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${
                            activeTab === 'in_development' ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-700'
                        }`}>
                            {inDevelopmentProjects.length}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('completed'); setSelectedProject(null); }}
                        className={`flex-1 py-3 px-3 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                            activeTab === 'completed'
                                ? 'bg-[#1a365d] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <CheckCircle2 size={16} />
                        <span>Tab 5: Proyek Selesai</span>
                        <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${
                            activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                            {completedProjects.length}
                        </span>
                    </button>
                </div>

                {/* TAB 1: PROYEK MASUK */}
                {activeTab === 'incoming' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Inbox className="text-blue-600" size={24} />
                                <div>
                                    <h3 className="font-bold text-blue-900 text-sm">Proyek Baru dari Perencanaan</h3>
                                    <p className="text-xs text-blue-700">Pelajari detail proyek dan deskripsi kebutuhan sebelum menugaskan Dev Analis (PM).</p>
                                </div>
                            </div>
                        </div>

                        {incomingProjects.length === 0 ? (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                                <Inbox size={48} className="text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-700">Tidak Ada Proyek Masuk</h3>
                                <p className="text-sm text-gray-500 mt-1">Semua proyek telah ditugaskan ke Analyst.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {incomingProjects.map(project => (
                                    <div key={project.req_id || project.reqId || project.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">{project.req_id || project.reqId || project.id}</span>
                                                <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={project.type} deadline={project.rbbDeadline} /><ProjectTypeBadge type={project.project_type} /></div>
                                            </div>
                                            <h3 className="font-bold text-gray-800 text-base mb-2">{project.name}</h3>

                                            {/* Box Deskripsi Proyek */}
                                            <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl mb-3">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Deskripsi &amp; Lingkup Proyek</p>
                                                <p className="text-xs text-gray-700 leading-relaxed">{project.description || 'Inisiasi kebutuhan sistem baru Bank Nagari.'}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-blue-50/40 p-2.5 rounded-xl border border-blue-100/60">
                                                <div>
                                                    <span className="font-bold text-gray-400 block text-[10px] uppercase">Divisi Pengusul</span>
                                                    <span className="font-semibold text-gray-800">{project.division}</span>
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-400 block text-[10px] uppercase">Target Selesai</span>
                                                    <span className="font-semibold text-gray-800">{project.targetDate}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleOpenAnalystModal(project)}
                                            className="w-full bg-[#1a365d] hover:bg-[#0f2342] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                        >
                                            <UserCheck size={15} />
                                            Tinjau Detail &amp; Tugaskan Analyst
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: SEDANG DIKAJI ANALYST */}
                {activeTab === 'analyzing' && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Clock className="text-amber-600" size={24} />
                                <div>
                                    <h3 className="font-bold text-amber-900 text-sm">Proyek Dalam Kajian Analyst</h3>
                                    <p className="text-xs text-amber-700">Proyek sedang dalam tahap analisa oleh Dev Analis (PM).</p>
                                </div>
                            </div>
                        </div>

                        {analyzingProjects.length === 0 ? (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                                <Clock size={48} className="text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-700">Tidak Ada Proyek Sedang Dikaji</h3>
                                <p className="text-sm text-gray-500 mt-1">Belum ada proyek yang sedang ditelaah oleh Analyst.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {analyzingProjects.map(project => (
                                    <div key={project.req_id || project.reqId || project.id} className="bg-white p-5 rounded-2xl border border-amber-200/60 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{project.req_id || project.reqId || project.id}</span>
                                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <Clock size={10} /> Sedang Analisa
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-gray-800 text-base mb-1">{project.name}</h3>
                                            <p className="text-xs text-gray-500 line-clamp-2 mb-3">{project.description}</p>
                                            
                                            {/* Status Pemantauan Analyst */}
                                            <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100 mb-2">
                                                <div className="text-xs text-amber-900 font-semibold flex items-center gap-1.5 mb-1.5">
                                                    <Users size={14} className="text-amber-700 shrink-0" />
                                                    Dev Analis (PM): <span className="font-bold text-amber-950">{project.assignedAnalyst?.name || (typeof project.pm === 'object' ? project.pm?.name : project.pm) || '—'}</span>
                                                </div>
                                                {(project.deadline || project.current_stage_deadline) && (
                                                    <div className="text-[10px] text-amber-800 flex items-center gap-1 ml-1 mb-1">
                                                        <Clock size={10} />
                                                        Deadline: {new Date(project.deadline || project.current_stage_deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-medium pt-1.5 border-t border-amber-200/50">
                                                    <Clock size={12} className="shrink-0 animate-pulse text-amber-600" />
                                                    <span>Menunggu Dev Analis menyelesaikan kajian teknis</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: SIAP TUNJUK PM */}
                {activeTab === 'ready_pm' && (
                    <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
                        {/* KIRI: Daftar Proyek Selesai Kajian */}
                        <div className="w-full lg:w-1/3 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
                                <h3 className="font-bold text-gray-800 text-sm">Pilih Proyek Siap Pengembangan ({readyForPMProjects.length})</h3>
                                <p className="text-xs text-gray-500">Proyek yang telah selesai dikaji oleh Dev Analis.</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {readyForPMProjects.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">
                                        <CheckCircle2 size={36} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs">Belum ada proyek selesai dikaji.</p>
                                    </div>
                                ) : (
                                    readyForPMProjects.map(project => (
                                        <div
                                            key={project.req_id || project.reqId || project.id}
                                            onClick={() => { setSelectedProject(project); setSelectedPM(''); setEstimationDays(getNumericEstimation(project)); }}
                                            className={`p-4 rounded-xl cursor-pointer transition-all border ${
                                                selectedProject?.id === project.id
                                                    ? 'bg-blue-50 border-[#1a365d] ring-2 ring-[#1a365d]/10'
                                                    : 'bg-white border-gray-200 hover:border-blue-300'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-1.5">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{project.req_id || project.reqId || project.id}</span>
                                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">FSD Selesai</span>
                                            </div>
                                            <h4 className="font-bold text-gray-800 text-sm mb-1">{project.name}</h4>
                                            <p className="text-xs text-gray-500 line-clamp-1">{project.division}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* KANAN: Detail Kajian & Form Penunjukan PM */}
                        <div className="w-full lg:w-2/3 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                            {!selectedProject ? (
                                <div className="flex-1 flex items-center justify-center p-12 text-center text-gray-400">
                                    <div>
                                        <UserCheck size={48} className="mx-auto mb-3 opacity-40 text-blue-600" />
                                        <h3 className="font-bold text-gray-700 text-base">Pilih Proyek dari Daftar di Kiri</h3>
                                        <p className="text-xs text-gray-500 mt-1">Pilih proyek untuk melihat hasil kajian Analyst dan menunjuk PM penanggung jawab.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    <div className="border-b border-gray-100 pb-4">
                                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{selectedProject.id}</span>
                                        <h2 className="text-xl font-extrabold text-gray-800 mt-1">{selectedProject.name}</h2>
                                        <p className="text-xs text-gray-500">{selectedProject.division} • Target: {selectedProject.targetDate}</p>
                                    </div>

                                     {/* Hasil Kajian Teknis Dev Analis (PM) (Sinkron) */}
                                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4.5 space-y-3">
                                        <div className="flex justify-between items-center border-b border-emerald-200/60 pb-2 flex-wrap gap-2">
                                            <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                                                <FileText size={15} className="text-emerald-700" />
                                                Hasil Kajian Teknis Dev Analis (PM Pengembangan)
                                            </h4>
                                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                                {selectedProject.devAnalystResult?.analystName || selectedProject.assignedAnalyst?.name || 'Dev Analis (PM)'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                            <div className="bg-white p-3 rounded-lg border border-emerald-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Keputusan Review Arsitektur:</span>
                                                <span className="font-bold text-emerald-900">
                                                    {selectedProject.devAnalystResult?.decision || selectedProject.devAnalystDecision || 'Disetujui (Layak Develop)'}
                                                </span>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border border-emerald-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Rekomendasi Tech Stack:</span>
                                                <span className="font-bold text-blue-900">
                                                    {selectedProject.devAnalystResult?.techStack || selectedProject.techStack || 'Microservices Java Spring Boot + React JS'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-white p-3 rounded-lg border border-emerald-100 text-xs">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Catatan Spesifikasi Arsitektur Teknis:</span>
                                                <p className="text-gray-800 leading-relaxed font-mono whitespace-pre-wrap">
                                                    "{selectedProject.devAnalystResult?.notes || selectedProject.devAnalystNotes || 'Arsitektur teknis dan integrasi API telah dikaji dan disiapkan untuk tahap pengembangan.'}"
                                                </p>
                                            </div>
                                            {selectedProject.devAnalystResult?.techStack && (
                                                <div className="bg-white p-3 rounded-lg border border-emerald-100 text-xs">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Rekomendasi Tech Stack:</span>
                                                    <p className="text-gray-800 leading-relaxed">{selectedProject.devAnalystResult.techStack}</p>
                                                </div>
                                            )}

                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/60">
                                            <span className="font-semibold text-emerald-900">
                                                {selectedProject.devAnalystResult?.estimation
                                                    ? <>Target Selesai IT: <strong className="text-emerald-950">{new Date(selectedProject.devAnalystResult.estimation).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></>
                                                    : <>Estimasi Waktu IT: <strong className="text-emerald-950">30 Hari Kerja</strong></>
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {/* Daftar Berkas Dokumen SDLC Proyek (Semua Tahap: Inisiasi, FSD Perencanaan, FSD Dev) */}
                                    <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                                        <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                                            <FolderOpen size={16} className="text-blue-600" />
                                            Daftar Berkas &amp; Dokumen Kelengkapan Proyek (Semua Tahap)
                                        </h4>
                                        <div className="space-y-2">
                                            {resolveAllProjectDocs(selectedProject).map((doc, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-white hover:border-blue-300 transition-colors shadow-2xs">
                                                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] ${getDocIconStyle(doc.name || '')}`}>
                                                                {getDocExtLabel(doc.name || '')}
                                                            </div>
                                                            <div className="truncate min-w-0">
                                                                <p className="text-xs font-semibold text-gray-800 truncate">{doc.name}</p>
                                                                <p className="text-[11px] text-gray-500">{doc.size || '2.0 MB'} • {doc.label || 'Dokumen SDLC Terlampir'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewDoc(doc)}
                                                                className="px-3 py-1.5 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                                                title="View & Baca Dokumen"
                                                            >
                                                                <Eye size={13} />
                                                                <span>View &amp; Baca</span>
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
                                                                        const textContent = `PT BANK NAGARI - DOKUMEN SDLC\n===============================\nNama Dokumen: ${fileName}\nProyek: ${selectedProject.name}\nTanggal: ${new Date().toLocaleDateString('id-ID')}`;
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
                                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Unduh Dokumen"
                                                            >
                                                                <Download size={15} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Finalisasi & Mulai Pengembangan */}
                                    <div className="space-y-4 pt-2">
                                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                            <Rocket size={16} className="text-blue-600" /> Finalisasi &amp; Mulai Pengembangan
                                        </h3>

                                        {/* Info: PM sudah auto-assigned */}
                                        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 text-xs space-y-1">
                                            <span className="font-bold text-blue-900 block text-[11px] uppercase tracking-wider">Project Manager (Otomatis)</span>
                                            <p className="text-blue-800 font-semibold">
                                                {(() => {
                                                    const pmName = typeof selectedProject.pm === 'object'
                                                        ? (selectedProject.pm?.name || '—')
                                                        : (selectedProject.pm || selectedProject.pmName || '—');
                                                    return pmName;
                                                })()}
                                            </p>
                                            <p className="text-blue-600">PM = Dev Analis yang ditugaskan di tahap sebelumnya. Tidak perlu dipilih ulang.</p>
                                        </div>

                                        {/* Pilih Tim Developer */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Alokasi Tim Developer <span className="text-gray-400 font-normal">(Opsional — bisa dialokasikan nanti oleh PM)</span>
                                            </label>
                                            <div className="relative mb-2">
                                                <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={developerSearch}
                                                    onChange={(e) => setDeveloperSearch(e.target.value)}
                                                    placeholder="Cari developer..."
                                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                                {developerCandidates.filter(d => {
                                                    if (!developerSearch.trim()) return true;
                                                    const q = developerSearch.toLowerCase();
                                                    return d.name.toLowerCase().includes(q) || d.skill.toLowerCase().includes(q);
                                                }).map(dev => (
                                                    <label key={dev.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                                        selectedDeveloperIds.includes(dev.id)
                                                            ? 'bg-blue-50 border-blue-300'
                                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                                    }`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedDeveloperIds.includes(dev.id)}
                                                            onChange={() => {
                                                                setSelectedDeveloperIds(prev =>
                                                                    prev.includes(dev.id)
                                                                        ? prev.filter(id => id !== dev.id)
                                                                        : [...prev, dev.id]
                                                                );
                                                            }}
                                                            className="text-[#00529C] focus:ring-[#00529C]"
                                                        />
                                                        <span className="text-xs font-medium text-gray-800">{dev.name}</span>
                                                        <span className="text-[10px] text-gray-400 ml-auto">{dev.skill}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Target Deadline Final */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Target Deadline Pengembangan <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={estimationDays}
                                                onChange={(e) => setEstimationDays(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm bg-white"
                                            />
                                        </div>

                                        {estimationDays && (
                                            <div className="p-3.5 bg-green-50/80 border border-green-200 rounded-xl text-xs space-y-1.5 animate-fade-in">
                                                <span className="font-bold text-green-900 block text-[11px] uppercase tracking-wider">Ringkasan Finalisasi:</span>
                                                <div className="flex flex-wrap items-center justify-between text-green-950 font-semibold gap-2">
                                                    <span>Tenggat: <strong className="text-green-800 font-bold">{new Date(estimationDays).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <button
                                                onClick={handleAssignPM}
                                                disabled={isSubmitting || !estimationDays}
                                                className="w-full bg-[#00529C] hover:bg-[#004080] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                                            >
                                                <Rocket size={16} />
                                                Mulai Pengembangan &amp; Lanjutkan ke Development
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 4: SEDANG DIKEMBANGKAN */}
                {activeTab === 'in_development' && (
                    <div className="space-y-4">
                        <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Clock className="text-cyan-600" size={24} />
                                <div>
                                    <h3 className="font-bold text-cyan-900 text-sm">Proyek Sedang Dikembangkan</h3>
                                    <p className="text-xs text-cyan-700">Daftar proyek yang saat ini sedang dalam proses coding, testing QA, atau Cyber Security.</p>
                                </div>
                            </div>
                        </div>

                        {inDevelopmentProjects.length === 0 ? (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                                <Clock size={48} className="text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-700">Tidak Ada Proyek Sedang Dikembangkan</h3>
                                <p className="text-sm text-gray-500 mt-1">Belum ada proyek yang memasuki tahap pengembangan IT.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {inDevelopmentProjects.map(project => (
                                    <div key={project.req_id || project.reqId || project.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">{project.req_id || project.reqId || project.id}</span>
                                                {(() => {
                                                    const s = String(project.status || '').toUpperCase();
                                                    if (s === 'SIT_IN_PROGRESS') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200 animate-pulse">🔄 SIT Berlangsung</span>;
                                                    if (s === 'SIT_PASSED') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">🔵 SIT LULUS</span>;
                                                    if (s === 'SIT_REVISION') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200">↩️ SIT Revisi</span>;
                                                    if (s === 'UAT_IN_PROGRESS') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">🔄 UAT Internal</span>;
                                                    if (s === 'UAT_REVISION_SIT' || s === 'UAT_REVISION_DEV') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">↩️ UAT Revisi</span>;
                                                    if (s === 'DEV_COMPLETED') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">✅ DEV COMPLETED</span>;
                                                    if (s === 'READY_FOR_QA' || s === 'QA_IN_PROGRESS') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">🔍 QA Testing</span>;
                                                    if (s === 'QA_PASSED') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">✅ QA Lulus</span>;
                                                    if (s === 'CYBER_IN_PROGRESS') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">🛡️ Pentest Siber</span>;
                                                    if (s === 'CYBER_PASSED') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">✅ Siber Lulus</span>;
                                                    if (s === 'RETURN_TO_DEV') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">🚨 Perbaikan Dev</span>;
                                                    if (s === 'PENDING_GOLIVE') return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">🚀 Siap Go Live</span>;
                                                    return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">💻 Coding &amp; Dev</span>;
                                                })()}
                                            </div>

                                            <h3 className="font-bold text-gray-800 text-base mb-2">{project.name}</h3>

                                            <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl mb-3">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Deskripsi Proyek</p>
                                                <p className="text-xs text-gray-700 leading-relaxed">{project.description || 'Pengembangan aplikasi dan integrasi sistem SDLC Bank Nagari.'}</p>
                                            </div>

                                            <div className="space-y-2 text-xs text-gray-600 bg-cyan-50/40 p-3 rounded-xl border border-cyan-100">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-gray-400 text-[10px] uppercase">Project Manager:</span>
                                                    <span className="font-semibold text-gray-800">{typeof project.pm === 'object' ? project.pm?.name : (project.pm || 'Budi Santoso')}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-gray-400 text-[10px] uppercase">Divisi:</span>
                                                    <span className="font-semibold text-gray-800">{project.division}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-gray-400 text-[10px] uppercase">Target Finish:</span>
                                                    <span className="font-semibold text-gray-800">{project.targetDate}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-gray-100">
                                            <button
                                                onClick={() => navigate(`/pm/tasks/${project.req_id || project.reqId || project.id}`)}
                                                className="w-full bg-[#003a73] hover:bg-[#002a5a] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
                                            >
                                                <Eye size={15} />
                                                <span>Lihat Proyek &amp; Progress SDLC</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                            </div>
                        )}
                    </div>
                )}

                {/* TAB 5: PROYEK SELESAI */}
                {activeTab === 'completed' && (
                    <div className="space-y-4">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="text-emerald-600" size={24} />
                                <div>
                                    <h3 className="font-bold text-emerald-900 text-sm">Proyek Selesai &amp; Go Live</h3>
                                    <p className="text-xs text-emerald-700">Daftar proyek yang telah menyelesaikan seluruh tahapan SDLC dan telah aktif di lingkungan produksi.</p>
                                </div>
                            </div>
                        </div>

                        {completedProjects.length === 0 ? (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                                <CheckCircle2 size={48} className="text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-700">Belum Ada Proyek Selesai</h3>
                                <p className="text-sm text-gray-500 mt-1">Belum ada proyek yang telah resmi rilis (Go-Live).</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {completedProjects.map(project => (
                                    <div key={project.req_id || project.reqId || project.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">{project.req_id || project.reqId || project.id}</span>
                                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                                    <Check size={13} /> Live Production
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-gray-800 text-base mb-2">{project.name}</h3>

                                            <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl mb-3">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ringkasan Sistem</p>
                                                <p className="text-xs text-gray-700 leading-relaxed">{project.description || 'Sistem telah lulus pengujian UAT, QA, Cyber Security, dan resmi diluncurkan.'}</p>
                                            </div>

                                            <div className="space-y-2 text-xs text-gray-600 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-gray-400 text-[10px] uppercase">PM Penanggung Jawab:</span>
                                                    <span className="font-semibold text-gray-800">{typeof project.pm === 'object' ? project.pm?.name : (project.pm || 'Siti Aminah')}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-gray-400 text-[10px] uppercase">Divisi Pemohon:</span>
                                                    <span className="font-semibold text-gray-800">{project.division}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-gray-400 text-[10px] uppercase">Status Rilis:</span>
                                                    <span className="font-semibold text-emerald-700">100% Selesai &amp; Go-Live</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => navigate('/pm/tracker')}
                                            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                        >
                                            <Check size={15} />
                                            <span>Lihat Riwayat SDLC Proyek</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL TUGASKAN ANALYST (TAB 1) - Dilengkapi Detail & Deskripsi Proyek & Dokumen Inisiasi */}
            {isAnalystModalOpen && targetProjectForAnalyst && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-scale-up overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-gray-200 my-8">
                        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="text-[10px] font-extrabold text-[#00529C] uppercase tracking-widest bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                        {targetProjectForAnalyst.id}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={targetProjectForAnalyst.type} deadline={targetProjectForAnalyst.rbbDeadline} /><ProjectTypeBadge type={targetProjectForAnalyst.project_type} /></div>
                                </div>
                                <h3 className="font-black text-gray-800 text-xl">
                                    {targetProjectForAnalyst.name}
                                </h3>
                            </div>
                            <button onClick={() => setIsAnalystModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content Scroll Area */}
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                            {/* 1. Detail & Deskripsi Proyek */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3 text-xs">
                                <p className="font-bold text-[#1a365d] uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                                    <Briefcase size={14} className="text-[#00529C]" />
                                    1. Deskripsi &amp; Lingkup Bisnis Proyek
                                </p>
                                <p className="text-gray-800 leading-relaxed text-xs sm:text-sm bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                    {targetProjectForAnalyst.description || 'Pengajuan inisiasi pengembangan sistem baru Bank Nagari.'}
                                </p>
                                <div className="grid grid-cols-2 gap-3 pt-1 text-slate-700 bg-white p-3 rounded-xl border border-slate-200 text-xs">
                                    <div><strong className="text-gray-400 block text-[10px] uppercase">Divisi Pengusul:</strong> <span className="font-bold text-gray-800">{targetProjectForAnalyst.division}</span></div>
                                    <div><strong className="text-gray-400 block text-[10px] uppercase">Target Selesai:</strong> <span className="font-bold text-gray-800">{targetProjectForAnalyst.targetDate}</span></div>
                                </div>
                            </div>

                            {/* Card Hasil Kajian Perencanaan TI (Fase 1) */}
                            <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <p className="font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                                        <CheckCircle2 size={14} className="text-emerald-600" />
                                        Hasil Kajian Perencanaan TI (Fase 1)
                                    </p>
                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                                        {targetProjectForAnalyst.analystDecision || targetProjectForAnalyst.analystResult?.decision || 'Disetujui (Layak Develop)'}
                                    </span>
                                </div>

                                 {/* Notes from PM Analis & Lead Perencanaan */}
                                {(targetProjectForAnalyst.analystNotes || targetProjectForAnalyst.analystResult?.notes) && (
                                    <div className="bg-white/90 p-3 rounded-lg border border-emerald-100 text-xs">
                                        <span className="font-bold text-gray-500 text-[10px] uppercase block mb-0.5">Catatan Lead Perencanaan:</span>
                                        <p className="text-gray-700 italic text-[11px] leading-relaxed">{targetProjectForAnalyst.analystNotes || targetProjectForAnalyst.analystResult?.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* 2. Dokumen Kelengkapan Proyek (View & Download Interactive) */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                                <p className="font-bold text-[#1a365d] uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                                    <FolderOpen size={14} className="text-[#00529C]" />
                                    2. Daftar Berkas &amp; Dokumen SDLC Proyek (Semua Tahap)
                                </p>
                                <div className="space-y-2">
                                    {resolveAllProjectDocs(targetProjectForAnalyst).map((doc, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50 hover:border-gray-300 transition-colors">
                                            <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                                <div className="w-9 h-9 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px]">
                                                    PDF
                                                </div>
                                                <div className="truncate min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{doc.name}</p>
                                                    <p className="text-[11px] text-gray-500">{doc.size || '2.4 MB'} • {doc.label || 'Dokumen SDLC Terlampir'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewDoc(doc)}
                                                    className="px-3 py-1.5 border border-[#00529C] text-[#00529C] hover:bg-blue-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                                    title="View & Baca Dokumen"
                                                >
                                                    <Eye size={13} />
                                                    <span>View &amp; Baca</span>
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
                                                            const textContent = `PT BANK NAGARI - DOKUMEN SDLC\n===============================\nNama Dokumen: ${fileName}\nProyek: ${targetProjectForAnalyst?.name}\nTanggal: ${new Date().toLocaleDateString('id-ID')}`;
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
                                                    className="p-1.5 text-gray-500 hover:text-[#00529C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Unduh Dokumen"
                                                >
                                                    <Download size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Form Penugasan Analyst */}
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                                <p className="font-bold text-[#1a365d] uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                                    <UserCheck size={14} className="text-[#00529C]" />
                                    3. Penunjukan System Analyst
                                </p>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Pilih Dev Analis (PM) <span className="text-red-500">*</span></label>

                                    {/* Nama analis terpilih / search bar */}
                                    <div className="mb-2">
                                        <div className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl border-2 bg-white shadow-sm transition-all ${
                                            selectedAnalystId ? 'border-emerald-400 bg-emerald-50/40' : 'border-[#00529C]'
                                        }`}>
                                            {selectedAnalystId ? (
                                                <UserCheck size={16} className="text-emerald-600 shrink-0" />
                                            ) : (
                                                <SearchIcon size={16} className="text-[#00529C] shrink-0" />
                                            )}
                                            <input
                                                type="text"
                                                value={selectedAnalystId ? (analysts.find(a => String(a.id) === String(selectedAnalystId))?.name || '') : analystSearch}
                                                readOnly={!!selectedAnalystId}
                                                onChange={(e) => { setAnalystSearch(e.target.value); setSelectedAnalystId(''); }}
                                                placeholder={selectedAnalystId ? '' : 'Cari nama atau email Dev Analis (PM)...'}
                                                className={`flex-1 bg-transparent text-xs outline-none ${
                                                    selectedAnalystId ? 'text-emerald-800 font-semibold cursor-default' : 'text-gray-800 placeholder:text-gray-400'
                                                }`}
                                            />
                                            {selectedAnalystId && (() => {
                                                const sel = analysts.find(a => String(a.id) === String(selectedAnalystId));
                                                const activeCount = sel ? (projects || []).filter(p => {
                                                    const assignedId = p.analyst_id || (typeof p.assignedAnalyst === 'object' ? p.assignedAnalyst?.id : null);
                                                    const pmId = p.pm_id || (typeof p.pm === 'object' ? p.pm?.id : null);
                                                    const terminalStatuses = ['LIVE_PRODUCTION', 'CANCELLED', 'REJECTED'];
                                                    const isFinished = terminalStatuses.includes(p.status);
                                                    const isMine = (assignedId != null && Number(assignedId) === Number(sel.id))
                                                        || (pmId != null && Number(pmId) === Number(sel.id));
                                                    return isMine && !isFinished;
                                                }).length : 0;
                                                return (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                                        {activeCount} aktif
                                                    </span>
                                                );
                                            })()}
                                            {(selectedAnalystId || analystSearch) && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedAnalystId(''); setAnalystSearch(''); }}
                                                    className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                                                    title={selectedAnalystId ? 'Hapus pilihan & cari lagi' : 'Hapus kata kunci'}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Daftar Dev Analis (PM) — tampil hanya saat BELUM ada pilihan */}
                                    {!selectedAnalystId && (
                                        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                                    Daftar Dev Analis (PM)
                                                </span>
                                                <span className="text-[10px] text-gray-400">Beban aktif</span>
                                            </div>
                                            <div className="max-h-[220px] overflow-y-auto">
                                                {analysts.length === 0 ? (
                                                    <div className="p-6 text-center">
                                                        <SearchIcon size={24} className="mx-auto text-gray-300 mb-2" />
                                                        <p className="text-sm text-gray-500 font-medium">Belum ada Dev Analis (PM) tersedia</p>
                                                    </div>
                                                ) : (() => {
                                                    const filtered = analysts.filter(a => {
                                                        if (!analystSearch.trim()) return true;
                                                        const q = analystSearch.toLowerCase();
                                                        return a.name.toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q);
                                                    });
                                                    if (filtered.length === 0) {
                                                        return (
                                                            <div className="p-6 text-center">
                                                                <SearchIcon size={24} className="mx-auto text-gray-300 mb-2" />
                                                                <p className="text-sm text-gray-500 font-medium">Tidak ditemukan Dev Analis (PM)</p>
                                                                <p className="text-xs text-gray-400">Coba kata kunci lain</p>
                                                            </div>
                                                        );
                                                    }
                                                    return filtered.map(a => {
                                                        const activeCount = (projects || []).filter(p => {
                                                            const assignedId = p.analyst_id || (typeof p.assignedAnalyst === 'object' ? p.assignedAnalyst?.id : null);
                                                            const pmId = p.pm_id || (typeof p.pm === 'object' ? p.pm?.id : null);
                                                            const terminalStatuses = ['LIVE_PRODUCTION', 'CANCELLED', 'REJECTED'];
                                                            const isFinished = terminalStatuses.includes(p.status);
                                                            const isMine = (assignedId != null && Number(assignedId) === Number(a.id))
                                                                || (pmId != null && Number(pmId) === Number(a.id));
                                                            return isMine && !isFinished;
                                                        }).length;
                                                        return (
                                                            <div
                                                                key={a.id}
                                                                onClick={() => {
                                                                    setSelectedAnalystId(a.id);
                                                                    setAnalystSearch('');
                                                                }}
                                                                className="px-3 py-2.5 cursor-pointer transition-all flex items-center gap-3 border-b border-gray-50 last:border-b-0 hover:bg-blue-50/50 border-l-4 border-l-transparent"
                                                            >
                                                                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00529C] to-[#004080] text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                                    {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                                </span>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-sm font-semibold text-gray-800 truncate block">{a.name}</span>
                                                                    <span className="text-[11px] text-gray-400 truncate block">{a.email}</span>
                                                                </div>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                                                    activeCount >= 3 ? 'bg-red-100 text-red-600' : activeCount >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                                                }`}>
                                                                    {activeCount} aktif
                                                                </span>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Target Selesai Analisis (Opsional)</label>
                                    <input
                                        type="date"
                                        value={analysisDeadline}
                                        onChange={(e) => setAnalysisDeadline(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Catatan Arahan Khusus untuk Dev Analis (Opsional)</label>
                                    <textarea
                                        rows={3}
                                        value={leadNote}
                                        onChange={(e) => setLeadNote(e.target.value)}
                                        placeholder="Tulis instruksi khusus, batasan lingkup, atau fokus kajian arsitektur..."
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 bg-white text-gray-800"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                            <button
                                onClick={() => setIsAnalystModalOpen(false)}
                                className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleAssignAnalyst}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 text-xs font-bold text-white bg-[#1a365d] hover:bg-[#0f2342] rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                            >
                                <Send size={14} />
                                <span>Kirim Tugas ke Analyst</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL VIEWER DOKUMEN (Ketua Grup Pengembangan) */}
            {previewDoc && (
                <DocumentViewerModal
                    doc={previewDoc}
                    project={targetProjectForAnalyst || selectedProject}
                    onClose={() => setPreviewDoc(null)}
                />
            )}

        </div>
    );
}

