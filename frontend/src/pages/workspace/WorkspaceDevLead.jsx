import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects, getFileFromStore } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import RBBBadge from '../../components/RBBBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
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
    Shield,
    Check,
    ChevronRight,
    Building,
    Eye,
    Download,
    FolderOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { analysts, pmCandidates } from '../../data/mockData';

const resolveAllProjectDocs = (project) => {
    if (!project) return [];
    
    const docsMap = new Map();

    // 1. Initial BRD & documents in project.documents
    if (Array.isArray(project.documents) && project.documents.length > 0) {
        project.documents.forEach(d => {
            const key = d.id || d.name || d.file_name;
            docsMap.set(key, {
                ...d,
                name: d.name || d.file_name || 'Dokumen_SDLC.pdf',
                size: d.size || d.file_size || '2.0 MB',
                label: (d.type === 'brd' || d.doc_type === 'brd' || d.category === 'brd') 
                    ? 'Dokumen BRD Inisiasi' 
                    : (d.type === 'fsd' || d.doc_type === 'fsd') 
                    ? 'Dokumen FSD Perencanaan TI' 
                    : (d.type === 'fsd_dev' || d.doc_type === 'fsd_dev')
                    ? 'Spesifikasi Arsitektur (Dev)'
                    : (d.label || 'Dokumen SDLC Terlampir')
            });
        });
    }

    // 2. FSD Perencanaan Document
    if (project.fsdDocument && (project.fsdDocument.name || project.fsdDocument.file_name)) {
        const name = project.fsdDocument.name || project.fsdDocument.file_name;
        if (!docsMap.has(name)) {
            docsMap.set(name, { ...project.fsdDocument, name, label: 'Hasil Kajian FSD (Perencanaan TI)' });
        }
    }

    // 3. FSD Dev / Spesifikasi Arsitektur Document
    if (project.fsdDevDocument && (project.fsdDevDocument.name || project.fsdDevDocument.file_name)) {
        const name = project.fsdDevDocument.name || project.fsdDevDocument.file_name;
        if (!docsMap.has(name)) {
            docsMap.set(name, { ...project.fsdDevDocument, name, label: 'Spesifikasi Arsitektur (Dev)' });
        }
    }

    const list = Array.from(docsMap.values());
    if (list.length > 0) return list;

    return [
        { id: 'DOC-01', name: 'Dokumen_SDLC_Terlampir.pdf', size: '2.4 MB', label: 'Dokumen SDLC Terlampir' }
    ];
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
    const [leadNote, setLeadNote] = useState('');
    const [previewDoc, setPreviewDoc] = useState(null);

    const previewBlobUrl = useMemo(() => {
        if (!previewDoc) return null;
        let rawUrl = previewDoc.url || previewDoc.fileUrl || previewDoc.dataUrl;
        if (!rawUrl && previewDoc.name) {
            rawUrl = getFileFromStore(previewDoc.name) || getFileFromStore(previewDoc.id);
        }
        if (!rawUrl && targetProjectForAnalyst) {
            rawUrl = getFileFromStore(`fsd_${targetProjectForAnalyst.id}`) || targetProjectForAnalyst.analystResult?.fsdUrl;
        }

        if (!rawUrl) {
            const docTitle = (previewDoc.name || 'Dokumen_SDLC.pdf').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
            const projName = targetProjectForAnalyst?.name || selectedProject?.name || 'Proyek SDLC';
            const divName = targetProjectForAnalyst?.division || selectedProject?.division || 'Divisi TI';
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
    }, [previewDoc, targetProjectForAnalyst, selectedProject]);

    // Form Assign PM State
    const [selectedPM, setSelectedPM] = useState('');
    const [estimationDays, setEstimationDays] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    // 4. Proyek Sedang Dikembangkan (Hanya proyek yang sudah ditunjuk PM & sedang dalam koding/dev IT)
    const inDevelopmentProjects = applySearch(projects.filter(p =>
        p.status === 'IN_DEVELOPMENT'
    ));

    // 5. Proyek Selesai & Go Live
    const completedProjects = applySearch(projects.filter(p =>
        p.status === 'LIVE_PRODUCTION' || p.status === 'QA_PASSED' || p.status === 'CYBER_PASSED'
    ));


    // Buka modal tugaskan analyst
    const handleOpenAnalystModal = (project) => {
        setTargetProjectForAnalyst(project);
        setSelectedAnalystId('');
        setLeadNote('');
        setIsAnalystModalOpen(true);
    };

    // Submit penugasan Analyst
    const handleAssignAnalyst = () => {
        if (!selectedAnalystId) {
            toast.error('Pilih System Analyst!');
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
                leadNote: leadNote || 'Tolong kaji kelayakan arsitektur teknis dan estimasi mandays.',
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
        if (!selectedPM) {
            toast.error('Pilih Project Manager penanggung jawab!');
            return;
        }

        setIsSubmitting(true);

        const pmDetails = pmCandidates.find(pm => pm.id === parseInt(selectedPM));

        setTimeout(() => {
            updateProject(selectedProject.id, {
                status: 'IN_DEVELOPMENT',
                statusColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                pm: pmDetails,
                estimation: estimationDays || selectedProject.analystResult?.estimation || '30',
                assignedBy: user?.name,
                assignedPMAt: new Date().toISOString()
            });

            addNotification(
                'Penugasan PM Proyek Baru',
                `Anda telah ditunjuk oleh Ketua Grup Pengembangan sebagai PM untuk proyek ${selectedProject.name}. Silakan alokasikan tim & kelola proyek.`,
                'success',
                '/pm/workspace'
            );

            toast.success(`PM ${pmDetails?.name || ''} berhasil ditunjuk untuk memimpin proyek!`);
            setIsSubmitting(false);
            setSelectedProject(null);
            setSelectedPM('');
            setEstimationDays('');
            navigate('/pm/workspace');
        }, 600);
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
                            Kelola alur penerimaan proyek dari Perencanaan, penugasan System Analyst, penunjukan Project Manager, hingga monitoring status pengembangan dan rilis.
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
                        <span>Tab 3: Siap Tunjuk PM</span>
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
                                    <p className="text-xs text-blue-700">Pelajari detail proyek dan deskripsi kebutuhan sebelum menugaskan System Analyst.</p>
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
                                    <div key={project.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">{project.id}</span>
                                                <RBBBadge type={project.type} deadline={project.rbbDeadline} />
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
                                    <p className="text-xs text-amber-700">Proyek sedang dalam tahap analisa oleh System Analyst.</p>
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
                                    <div key={project.id} className="bg-white p-5 rounded-2xl border border-amber-200/60 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{project.id}</span>
                                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <Clock size={10} /> Sedang Analisa
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-gray-800 text-base mb-1">{project.name}</h3>
                                            <p className="text-xs text-gray-500 line-clamp-2 mb-3">{project.description}</p>
                                            
                                            {/* Info Analyst Tanpa Komentar Progress */}
                                            <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100 mb-2">
                                                <div className="text-xs text-amber-900 font-semibold flex items-center gap-1.5">
                                                    <Users size={14} className="text-amber-700 shrink-0" />
                                                    Analyst Bertugas: <span className="font-bold text-amber-950">{project.assignedAnalyst?.name || 'Citra Kirana'}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    updateProject(project.id, {
                                                        status: 'DEV_ANALYSIS_DONE',
                                                        statusColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                                                        devAnalystCompletedAt: new Date().toISOString()
                                                    });
                                                    toast.success(`Kajian teknis untuk "${project.name}" disetujui! Proyek masuk ke Tab 3 (Siap Tunjuk PM).`);
                                                }}
                                                className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
                                            >
                                                <CheckCircle2 size={15} />
                                                <span>Selesaikan Kajian &amp; Lanjut ke Tunjuk PM</span>
                                            </button>
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
                                <h3 className="font-bold text-gray-800 text-sm">Pilih Proyek Siap Ditunjuk PM ({readyForPMProjects.length})</h3>
                                <p className="text-xs text-gray-500">Proyek yang telah selesai dikaji oleh Analyst.</p>
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
                                            key={project.id}
                                            onClick={() => { setSelectedProject(project); setSelectedPM(''); setEstimationDays(''); }}
                                            className={`p-4 rounded-xl cursor-pointer transition-all border ${
                                                selectedProject?.id === project.id
                                                    ? 'bg-blue-50 border-[#1a365d] ring-2 ring-[#1a365d]/10'
                                                    : 'bg-white border-gray-200 hover:border-blue-300'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-1.5">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{project.id}</span>
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

                                    {/* Hasil Kajian Teknis System Analyst Pengembangan (Sinkron) */}
                                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4.5 space-y-3">
                                        <div className="flex justify-between items-center border-b border-emerald-200/60 pb-2 flex-wrap gap-2">
                                            <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                                                <FileText size={15} className="text-emerald-700" />
                                                Hasil Kajian Teknis System Analyst (Pengembangan)
                                            </h4>
                                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                                {selectedProject.devAnalystResult?.analystName || selectedProject.assignedAnalyst?.name || 'System Analyst Dev'}
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

                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/60">
                                            <span className="font-semibold text-emerald-900">
                                                Estimasi Waktu IT: <strong className="text-emerald-950">{selectedProject.devAnalystResult?.estimation || '30 Hari Kerja'}</strong>
                                            </span>

                                            {(selectedProject.fsdDevDocument || selectedProject.documents?.find(d => d.type === 'fsd_dev')) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewDoc(selectedProject.fsdDevDocument || selectedProject.documents.find(d => d.type === 'fsd_dev'))}
                                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                                >
                                                    <Eye size={13} />
                                                    <span>View FSD Dev</span>
                                                </button>
                                            )}
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
                                                            <div className="w-9 h-9 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px]">
                                                                PDF
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

                                    {/* Form Penunjukan PM */}
                                    <div className="space-y-4 pt-2">
                                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                            <Users size={16} className="text-blue-600" /> Form Penunjukan Project Manager (PM)
                                        </h3>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Pilih Project Manager <span className="text-red-500">*</span></label>
                                            <select
                                                value={selectedPM}
                                                onChange={(e) => setSelectedPM(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium bg-white"
                                            >
                                                <option value="">-- Pilih Project Manager --</option>
                                                {pmCandidates.map(pm => (
                                                    <option key={pm.id} value={pm.id}>
                                                        {pm.name} - {pm.department} (Beban: {pm.workload} Proyek Aktif)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Estimasi Pengerjaan Final (Hari)</label>
                                            <input
                                                type="number"
                                                value={estimationDays || selectedProject.analystResult?.estimation || ''}
                                                onChange={(e) => setEstimationDays(e.target.value)}
                                                placeholder="Misal: 30"
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm bg-white"
                                            />
                                        </div>

                                        <div className="pt-3">
                                            <button
                                                onClick={handleAssignPM}
                                                disabled={isSubmitting}
                                                className="w-full bg-[#1a365d] hover:bg-[#0f2342] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                                            >
                                                <Send size={16} />
                                                Tunjuk PM &amp; Mulai Pengembangan
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
                                    <div key={project.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">{project.id}</span>
                                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                                    Sedang Dikembangkan
                                                </span>
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

                                        <button
                                            onClick={() => navigate('/pm/tracker')}
                                            className="w-full bg-[#1a365d] hover:bg-[#0f2342] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                        >
                                            <span>Lacak Status &amp; Progress Proyek</span>
                                            <ChevronRight size={15} />
                                        </button>
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
                                    <div key={project.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">{project.id}</span>
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
                                    <span className="text-[10px] font-extrabold text-[#1A56DB] uppercase tracking-widest bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                        {targetProjectForAnalyst.id}
                                    </span>
                                    <RBBBadge type={targetProjectForAnalyst.type} deadline={targetProjectForAnalyst.rbbDeadline} />
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
                                    <Briefcase size={14} className="text-[#1A56DB]" />
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
                            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <p className="font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                                        <CheckCircle2 size={14} className="text-emerald-600" />
                                        Hasil Kajian &amp; Berkas Perencanaan TI (Fase 1)
                                    </p>
                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                        {targetProjectForAnalyst.analystDecision || targetProjectForAnalyst.analystResult?.decision || 'Disetujui (Layak Develop)'}
                                    </span>
                                </div>
                                
                                {/* Display FSD Document from Planning */}
                                {(() => {
                                    const fsd = targetProjectForAnalyst.fsdDocument || 
                                        (targetProjectForAnalyst.documents && targetProjectForAnalyst.documents.find(d => d.type === 'fsd' || d.doc_type === 'fsd')) ||
                                        (targetProjectForAnalyst.analystResult?.fsdFile ? { name: targetProjectForAnalyst.analystResult.fsdFile, size: '1.8 MB', url: targetProjectForAnalyst.analystResult.fsdUrl } : null) ||
                                        (targetProjectForAnalyst.documents && targetProjectForAnalyst.documents[0] ? targetProjectForAnalyst.documents[0] : null);
                                    
                                    if (!fsd) return null;
                                    
                                    return (
                                        <div className="bg-white p-3 rounded-lg border border-emerald-200 flex items-center justify-between gap-2 shadow-2xs">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 border border-emerald-200">
                                                    FSD
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-800 truncate">{fsd.name}</p>
                                                    <p className="text-[10px] text-gray-500">{fsd.size || '1.8 MB'} • Dokumen FSD Perencanaan TI</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setPreviewDoc(fsd)}
                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 shadow-2xs"
                                            >
                                                <Eye size={12} />
                                                <span>View FSD</span>
                                            </button>
                                        </div>
                                    );
                                })()}

                                {/* Notes from System Analyst & Lead Perencanaan */}
                                {(targetProjectForAnalyst.analystNotes || targetProjectForAnalyst.analystResult?.notes) && (
                                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 text-xs">
                                        <span className="font-bold text-gray-500 text-[10px] uppercase block">Catatan System Analyst Perencanaan:</span>
                                        <p className="text-gray-700 italic text-[11px] mt-0.5">{targetProjectForAnalyst.analystNotes || targetProjectForAnalyst.analystResult?.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* 2. Dokumen Kelengkapan Proyek (View & Download Interactive) */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                                <p className="font-bold text-[#1a365d] uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                                    <FolderOpen size={14} className="text-[#1A56DB]" />
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
                                                    className="px-3 py-1.5 border border-[#1A56DB] text-[#1A56DB] hover:bg-blue-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
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
                                                    className="p-1.5 text-gray-500 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
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
                                    <UserCheck size={14} className="text-[#1A56DB]" />
                                    3. Penunjukan System Analyst
                                </p>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Pilih System Analyst <span className="text-red-500">*</span></label>
                                    <select
                                        value={selectedAnalystId}
                                        onChange={(e) => setSelectedAnalystId(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 bg-white font-semibold"
                                    >
                                        <option value="">-- Pilih System Analyst --</option>
                                        {analysts.map(a => (
                                            <option key={a.id} value={a.id}>
                                                {a.name} (Beban Kerja: {a.workload} Proyek Aktif)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Catatan Arahan Khusus untuk Analyst (Opsional)</label>
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
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl animate-scale-up border border-gray-200 my-8">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-700 text-white rounded-xl flex items-center justify-center font-extrabold text-xs shadow-sm">
                                    PDF
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">{previewDoc.name}</h3>
                                    <p className="text-xs text-gray-500">Dokumen Kelengkapan Proyek • Terverifikasi SDLC Bank Nagari</p>
                                </div>
                            </div>
                            <button onClick={() => setPreviewDoc(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-[#f8f9fb] border border-gray-200 rounded-xl p-3 sm:p-6 max-h-[70vh] overflow-y-auto space-y-6 text-gray-800 font-sans shadow-inner flex justify-center items-start">
                            {previewBlobUrl ? (
                                <object
                                    data={previewBlobUrl}
                                    type="application/pdf"
                                    className="w-full h-full min-h-[650px] bg-white rounded-xl shadow-md border border-gray-200"
                                >
                                    <embed
                                        src={previewBlobUrl}
                                        type="application/pdf"
                                        className="w-full h-full min-h-[650px]"
                                    />
                                    <iframe
                                        src={previewBlobUrl}
                                        title={previewDoc.name}
                                        className="w-full h-full min-h-[650px] bg-white rounded-xl border-0"
                                    />
                                </object>
                            ) : (
                                <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-200 shadow-xs space-y-6 w-full text-gray-800">
                                    <div className="bg-[#003a73] text-white p-6 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <span className="text-[10px] font-extrabold tracking-widest uppercase bg-white/20 px-2.5 py-1 rounded text-white border border-white/30">
                                                SDLC BANK NAGARI ENTERPRISE
                                            </span>
                                            <h2 className="text-lg sm:text-xl font-black mt-2 text-white">
                                                BUSINESS REQUIREMENT DOCUMENT (BRD)
                                            </h2>
                                            <p className="text-xs text-blue-100 mt-1 font-medium">
                                                Proyek: <span className="font-bold text-white">{targetProjectForAnalyst?.name}</span> ({targetProjectForAnalyst?.id})
                                            </p>
                                        </div>
                                        <div className="text-right text-xs text-blue-100 font-mono">
                                            <p>STATUS: <span className="font-bold text-emerald-300">INISIASI DISAMPAIKAN</span></p>
                                            <p>PEMINTA: {targetProjectForAnalyst?.division}</p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50/70 p-5 rounded-xl border border-gray-200 space-y-2 text-xs">
                                        <h4 className="font-bold text-[#003a73] uppercase tracking-wider border-b border-gray-200 pb-2">
                                            1. LINGKUP &amp; DESKRIPSI KEBUTUHAN SISTEM
                                        </h4>
                                        <p className="text-gray-700 leading-relaxed pt-1">
                                            {targetProjectForAnalyst?.description || 'Pengajuan inisiasi kebutuhan sistem baru untuk mendukung operasional Divisi Bank Nagari.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 text-xs">
                            <span className="text-gray-400 font-medium">SDLC Bank Nagari Enterprise • Viewer Inisiasi BRD</span>
                            <button
                                onClick={() => setPreviewDoc(null)}
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
