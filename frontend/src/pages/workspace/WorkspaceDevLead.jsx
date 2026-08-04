import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects, getFileFromStore } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import RBBBadge from '../../components/RBBBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import DocumentViewerModal from '../../components/DocumentViewerModal';
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
            const docName = d.name || d.file_name || 'Dokumen_SDLC.pdf';
            const key = d.id || docName;
            const isFsd = (d.type === 'fsd' || d.doc_type === 'fsd' || docName.toLowerCase().includes('fsd') || docName.toLowerCase().includes('kajian'));
            docsMap.set(key, {
                ...d,
                name: docName,
                size: d.size || d.file_size || '2.0 MB',
                label: isFsd 
                    ? 'Hasil Kajian FSD (Perencanaan TI)' 
                    : (d.type === 'brd' || d.doc_type === 'brd' || d.category === 'brd' || docName.toLowerCase().includes('brd') || docName.toLowerCase().includes('laprak') || docName.toLowerCase().includes('form') || docName.toLowerCase().includes('kebutuhan') || docName.toLowerCase().includes('bimbingan')) 
                    ? 'Dokumen BRD Inisiasi' 
                    : (d.type === 'fsd_dev' || d.doc_type === 'fsd_dev')
                    ? 'Spesifikasi Arsitektur (Dev)'
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

    // 3. FSD File from Analyst Result / Planning Phase (Guaranteed Minimum 2 Docs)
    const analystFsdName = project.analystResult?.fsdFile || `Mustafa Fathur Rahman - FSD Kajian Perencanaan.pdf`;
    let hasFsd = false;
    for (const doc of docsMap.values()) {
        if (doc.label?.includes('FSD') || doc.name?.toLowerCase().includes('fsd') || doc.type === 'fsd') {
            hasFsd = true;
            break;
        }
    }
    if (!hasFsd) {
        docsMap.set(analystFsdName, {
            id: `FSD-PLN-${project.id}`,
            name: analystFsdName,
            size: '1.8 MB',
            type: 'fsd',
            url: project.analystResult?.fsdUrl || null,
            label: 'Hasil Kajian FSD (Perencanaan TI)'
        });
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

    // Helper ekstraksi angka durasi
    const getNumericEstimation = (proj) => {
        if (!proj) return '30';
        const raw = proj.devAnalystResult?.estimation || proj.analystResult?.estimation || proj.estimation || '30';
        const match = String(raw).match(/\d+/);
        return match ? match[0] : '30';
    };

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
                analyst: chosenAnalyst.name,
                analyst_id: chosenAnalyst.id,
                devAnalyst: chosenAnalyst,
                devAnalystName: chosenAnalyst.name,
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
        const chosenPMName = pmDetails?.name || selectedPM;
        const estDays = parseInt(estimationDays || selectedProject.analystResult?.estimation || '30', 10) || 30;
        
        const calcDeadline = new Date();
        calcDeadline.setDate(calcDeadline.getDate() + estDays);
        const deadlineIso = calcDeadline.toISOString().split('T')[0];

        setTimeout(() => {
            updateProject(selectedProject.id, {
                status: 'IN_DEVELOPMENT',
                statusColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                pm: pmDetails ? { id: pmDetails.id, name: pmDetails.name, initial: pmDetails.name.split(' ').map(n=>n[0]).join('').slice(0, 2) } : { name: chosenPMName, initial: 'PM' },
                pmName: chosenPMName,
                assignedPM: chosenPMName,
                pmId: pmDetails?.id || user?.id,
                estimation: `${estDays} Hari Kerja`,
                deadline: deadlineIso,
                targetDate: deadlineIso,
                rbbDeadline: deadlineIso,
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
                                            
                                            {/* Status Pemantauan Analyst */}
                                            <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100 mb-2">
                                                <div className="text-xs text-amber-900 font-semibold flex items-center gap-1.5 mb-1.5">
                                                    <Users size={14} className="text-amber-700 shrink-0" />
                                                    Analyst Bertugas: <span className="font-bold text-amber-950">{project.assignedAnalyst?.name || 'Citra Kirana'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-medium pt-1.5 border-t border-amber-200/50">
                                                    <Clock size={12} className="shrink-0 animate-pulse text-amber-600" />
                                                    <span>Menunggu Analyst menyelesaikan kajian teknis</span>
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
                                            onClick={() => { setSelectedProject(project); setSelectedPM(''); setEstimationDays(getNumericEstimation(project)); }}
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
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Pilih Project Manager <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={selectedPM}
                                                onChange={(e) => setSelectedPM(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium bg-white text-gray-800"
                                            >
                                                <option value="">-- Pilih Project Manager --</option>
                                                {pmWorkloadStats.map(pm => (
                                                    <option key={pm.id} value={pm.id}>
                                                        {pm.name} (Beban: {pm.activeCount} Proyek Aktif)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Estimasi Pengerjaan Final (Hari) <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={estimationDays}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '') {
                                                            setEstimationDays('');
                                                        } else {
                                                            const num = parseInt(val, 10);
                                                            if (!isNaN(num) && num > 0) {
                                                                setEstimationDays(String(num));
                                                            }
                                                        }
                                                    }}
                                                    placeholder="Contoh: 30"
                                                    className="w-full px-4 py-2.5 pr-12 rounded-xl border border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-semibold text-gray-800 bg-white"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                                                    Hari
                                                </span>
                                            </div>
                                        </div>

                                        {selectedPM && (
                                            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1.5 animate-fade-in">
                                                <span className="font-bold text-blue-900 block text-[11px] uppercase tracking-wider">Ringkasan Penunjukan Dev Lead:</span>
                                                <div className="flex flex-wrap items-center justify-between text-blue-950 font-semibold gap-2">
                                                    <span>PM Terpilih: <strong className="text-[#1A56DB] font-bold">{pmWorkloadStats.find(p => String(p.id) === String(selectedPM))?.name}</strong></span>
                                                    <span>Proyek Aktif: <strong className="text-gray-800 font-bold">{pmWorkloadStats.find(p => String(p.id) === String(selectedPM))?.activeCount} Proyek</strong></span>
                                                    <span>Perkiraan Tenggat: <strong className="text-emerald-700 font-bold">{(() => {
                                                        const days = parseInt(estimationDays || '30', 10) || 30;
                                                        const d = new Date();
                                                        d.setDate(d.getDate() + days);
                                                        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                                                    })()}</strong></span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2">
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

                                {/* Notes from System Analyst & Lead Perencanaan */}
                                {(targetProjectForAnalyst.analystNotes || targetProjectForAnalyst.analystResult?.notes) && (
                                    <div className="bg-white/90 p-3 rounded-lg border border-emerald-100 text-xs">
                                        <span className="font-bold text-gray-500 text-[10px] uppercase block mb-0.5">Catatan System Analyst Perencanaan:</span>
                                        <p className="text-gray-700 italic text-[11px] leading-relaxed">{targetProjectForAnalyst.analystNotes || targetProjectForAnalyst.analystResult?.notes}</p>
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
                                        {analysts.map(a => {
                                            const activeCount = (projects || []).filter(p => {
                                                const analystName = typeof p.assignedAnalyst === 'object' 
                                                    ? (p.assignedAnalyst?.name || '') 
                                                    : String(p.assignedAnalyst || p.devAnalyst || p.devAnalystName || p.analyst || '');
                                                const matches = analystName.toLowerCase().includes(a.name.toLowerCase());
                                                const isFinished = p.status === 'LIVE_PRODUCTION' || p.status === 'CANCELLED' || p.status === 'REJECTED';
                                                return matches && !isFinished;
                                            }).length;
                                            return (
                                                <option key={a.id} value={a.id}>
                                                    {a.name} (Beban: {activeCount} Proyek Aktif)
                                                </option>
                                            );
                                        })}
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
                <DocumentViewerModal
                    doc={previewDoc}
                    project={targetProjectForAnalyst || selectedProject}
                    onClose={() => setPreviewDoc(null)}
                />
            )}
        </div>
    );
}
