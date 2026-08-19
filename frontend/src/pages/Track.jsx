import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import ProjectTypeBadge from '../components/ProjectTypeBadge';
import {
    Search,
    Calendar,
    Rocket,
    CheckCircle,
    Code,
    Shield,
    Route,
    FileText,
    User,
    ChevronRight,
    Clock,
    Phone,
    AlertCircle,
    Check,
    Eye,
    RotateCcw,
    Download,
} from 'lucide-react';
import { documentService, projectService } from '../services/api';
import toast from 'react-hot-toast';
import DocumentViewerModal from '../components/DocumentViewerModal';
import { getProjectRealDocuments } from '../contexts/ProjectContext';
import { getDocExtLabel, getDocIconStyle } from '../utils/documentNaming';
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR } from '../constants/projectStatus';

const statusOptions = ['Semua Status', 'Sedang Berjalan', 'Selesai', 'Ditolak'];

export default function Track() {
    const { user } = useAuth();
    const { projects, refreshDataSilent } = useProjects();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [previewDoc, setPreviewDoc] = useState(null);
    const detailPanelRef = useRef(null);
    const navigate = useNavigate();

    // ── Persetujuan UAT & Change Request (business user) ──
    const [uatApproving, setUatApproving] = useState(false);
    const [crModalOpen, setCrModalOpen] = useState(false);
    const [crForm, setCrForm] = useState({ type: 'minor', title: '', detail: '', category: '' });
    const [crSubmitting, setCrSubmitting] = useState(false);

    const handleUatApprove = async (projectId) => {
        setUatApproving(true);
        try {
            await projectService.submitUatApproval(projectId, '');
            toast.success('Persetujuan UAT Anda berhasil disimpan.');
            refreshDataSilent?.();
        } catch (err) {
            toast.error(`Gagal menyimpan persetujuan: ${err.message}`);
        } finally {
            setUatApproving(false);
        }
    };

    const handleCrSubmit = async (projectId) => {
        if (!crForm.title.trim() || !crForm.detail.trim()) {
            toast.error('Judul dan detail change request wajib diisi!');
            return;
        }
        setCrSubmitting(true);
        try {
            await projectService.submitUatChangeRequest(projectId, {
                type: crForm.type,
                title: crForm.title.trim(),
                detail: crForm.detail.trim(),
                category: crForm.category,
            });
            toast.success('Change request UAT berhasil diajukan.');
            setCrModalOpen(false);
            setCrForm({ type: 'minor', title: '', detail: '', category: '' });
        } catch (err) {
            toast.error(`Gagal mengajukan change request: ${err.message}`);
        } finally {
            setCrSubmitting(false);
        }
    };

    const mappedTrackingProjects = useMemo(() => {
        return (projects || []).map(p => ({
            rawId: p.id,
            id: p.reqId || p.req_id || `REQ-${p.id}`,
            name: p.name || p.title || 'Proyek Tanpa Judul',
            status: PROJECT_STATUS_LABEL[p.status] || p.status || 'PENDING',
            statusRaw: p.status || 'PENDING',
            submittedDate: p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : 'Terbaru',
            targetDate: p.targetDate || p.target_date || 'TBD',
            contactPhone: p.contactPhone || p.contact_phone || '',
            pm: typeof p.pm === 'object' ? (p.pm?.name || 'Belum Dialokasi') : (p.pm || 'Belum Dialokasi'),
            pmAvatar: (p.pm?.name || 'BD').substring(0, 2).toUpperCase(),
            description: p.description || 'Pengajuan proyek baru.',
            rejectionReason: p.rejection_reason || p.rejectionReason || null,
            phases: p.phases || [
                {
                    name: 'Fase 1: Inisiasi & Persetujuan',
                    description: 'Pengajuan disetujui oleh manajemen dan dialokasikan ke tim IT.',
                    completed: p.statusRaw !== 'PENDING',
                    items: [
                        { label: 'Pengajuan Selesai', date: 'Terbaru', done: true },
                    ],
                },
                {
                    name: 'Fase 2: Desain & Arsitektur',
                    description: 'Perancangan sistem dan infrastruktur oleh tim teknis.',
                    completed: ['IN_DEVELOPMENT', 'QA_IN_PROGRESS', 'CYBER_IN_PROGRESS', 'LIVE_PRODUCTION'].includes(p.statusRaw),
                    items: [],
                },
                {
                    name: 'Fase 3: Pengembangan & Testing',
                    description: 'Pembuatan kode program dan pengujian kualitas sistem.',
                    completed: ['LIVE_PRODUCTION'].includes(p.statusRaw),
                    isActive: ['IN_DEVELOPMENT', 'QA_IN_PROGRESS', 'CYBER_IN_PROGRESS'].includes(p.statusRaw),
                    items: [],
                },
            ],
        }));
    }, [projects]);

    const [selectedProject, setSelectedProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('Semua Status');

    const listProjects = mappedTrackingProjects;

    useEffect(() => {
        const targetId = location.state?.projectId || searchParams.get('projectId') || searchParams.get('id');
        if (targetId && listProjects.length > 0) {
            const found = listProjects.find(p =>
                String(p.rawId).toLowerCase() === String(targetId).toLowerCase() ||
                String(p.id).toLowerCase() === String(targetId).toLowerCase()
            );
            if (found) {
                setSelectedProject(found);
                return;
            }
        }
        if (!selectedProject && listProjects.length > 0) {
            setSelectedProject(listProjects[0]);
        }
    }, [location.state, searchParams, listProjects]);

    const activeSelected = selectedProject || listProjects[0] || null;

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

    useEffect(() => {
        if (activeSelected) {
            scrollPageToTop();
        }
    }, [activeSelected?.id]);

    const filteredProjects = useMemo(() => {
        let result = listProjects;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                String(p.id).toLowerCase().includes(term) ||
                String(p.name).toLowerCase().includes(term)
            );
        }

        if (filterStatus === 'Sedang Berjalan') {
            result = result.filter(p => p.statusRaw !== 'LIVE_PRODUCTION' && p.statusRaw !== 'REJECTED');
        } else if (filterStatus === 'Selesai') {
            result = result.filter(p => p.statusRaw === 'LIVE_PRODUCTION');
        } else if (filterStatus === 'Ditolak') {
            result = result.filter(p => p.statusRaw === 'REJECTED' || p.rejectionReason);
        }

        return result;
    }, [listProjects, searchTerm, filterStatus]);

    const getStatusBadge = (status) => {
        const colors = {
            'Menunggu Review': 'bg-gray-100 text-gray-700',
            'Review Lead Group': 'bg-amber-100 text-amber-700',
            'Disetujui Analis': 'bg-emerald-100 text-emerald-700',
            'Ditolak': 'bg-red-100 text-red-700',
            'Sedang Dikembangkan': 'bg-blue-100 text-blue-700',
            'Live Production': 'bg-emerald-100 text-emerald-700',
            'Dikembalikan ke Dev': 'bg-red-100 text-red-700',
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    const getPhaseIcon = (phase) => {
        if (phase.completed) return <CheckCircle size={18} className="text-emerald-500" />;
        if (phase.isActive) return <Code size={18} className="text-[#00529C]" />;
        return <Rocket size={18} className="text-gray-400" />;
    };

    const getPhaseCircle = (phase) => {
        if (phase.completed) {
            return (
                <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center shadow-sm">
                    <Check size={20} className="text-emerald-600" />
                </div>
            );
        }
        if (phase.isActive) {
            return (
                <div className="w-10 h-10 rounded-full bg-[#00529C] border-4 border-blue-200 flex items-center justify-center shadow-md relative">
                    <div className="absolute inset-0 rounded-full border-2 border-[#00529C] animate-ping opacity-50"></div>
                    <Code size={20} className="text-white" />
                </div>
            );
        }
        return (
            <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                <Rocket size={20} className="text-gray-400" />
            </div>
        );
    };

    const activeProjectObj = projects.find(p => String(p.id) === String(activeSelected?.rawId));

    return (
        <div className="flex-1 flex flex-col h-screen bg-[#f8f9fb] overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-gray-200 flex flex-col shadow-[4px_0_12px_rgba(0,0,0,0.03)]">
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50 sticky top-0 z-20">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Pengajuan Anda</h2>
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari ID atau Nama Proyek..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all text-sm"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {statusOptions.map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setFilterStatus(opt)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === opt
                                            ? 'bg-blue-100 text-[#00529C]'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/30">
                        {filteredProjects.length > 0 ? (
                            filteredProjects.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProject(project)}
                                    className={`bg-white rounded-xl shadow-sm border relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow group ${activeSelected?.id === project.id
                                            ? 'border-[#00529C] ring-1 ring-[#00529C]'
                                            : 'border-gray-200'
                                        }`}
                                >
                                    {activeSelected?.id === project.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D4A017]"></div>
                                    )}
                                    <div className="p-4 pl-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-gray-500">{project.req_id || project.reqId || project.id}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(project.status)}`}>
                                                    {project.status}
                                                </span>
                                            </div>
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-[#00529C] transition-colors line-clamp-1">
                                            {project.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                                            {project.description}
                                        </p>
                                        <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-100 pt-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-blue-100 text-[#00529C] flex items-center justify-center font-bold text-[10px]">
                                                    {project.pmAvatar}
                                                </div>
                                                <span className="truncate max-w-[100px]">{typeof project.pm === 'object' ? (project.pm?.name || '—') : (project.pm || '—')}</span>
                                            </div>
                                            <span className="text-gray-400">{project.submittedDate}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-500 text-sm">
                                Tidak ada pengajuan yang sesuai
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-gray-50/30 overflow-hidden">
                    <div ref={detailPanelRef} className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 lg:p-10">
                        <div className="max-w-4xl mx-auto">
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className="px-2.5 py-1 bg-gray-100 rounded-md text-xs font-semibold text-gray-600 border border-gray-200">
                                            {activeSelected?.id}
                                        </span>
                                        {activeSelected?.type && (
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${activeSelected.type === 'RBB' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                {activeSelected.type === 'RBB' ? '🔴 RBB (Wajib Selesai)' : '⚪ Non-RBB (Fleksibel)'}
                                            </span>
                                        )}
                                        <ProjectTypeBadge type={activeSelected?.project_type} />
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(activeSelected?.status)}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${activeSelected?.status === 'IN DEVELOPMENT' ? 'bg-blue-500 animate-pulse' : 'bg-current'}`}></span>
                                            {activeSelected?.status}
                                        </span>
                                    </div>
                                    <h1 className="text-2xl font-bold text-gray-800">{activeSelected?.name}</h1>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Deskripsi</p>
                                    <p className="text-sm text-gray-700">{activeSelected?.description}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Target Go-Live</p>
                                    <p className="font-semibold text-gray-800 flex items-center">
                                        <Rocket size={16} className="mr-1.5 text-gray-400" />
                                        {activeSelected?.targetDate}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Nomor Telepon Kontak</p>
                                    <p className="font-semibold text-gray-800 flex items-center">
                                        <Phone size={16} className="mr-1.5 text-green-600" />
                                        {activeSelected?.contactPhone || '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Project Manager</p>
                                    <div className="flex items-center">
                                        <div className="w-6 h-6 rounded-full bg-[#00529C] text-white flex items-center justify-center text-[10px] font-bold mr-2">
                                            {activeSelected?.pmAvatar}
                                        </div>
                                        <p className="font-semibold text-gray-800">{typeof activeSelected?.pm === 'object' ? (activeSelected.pm?.name || '—') : (activeSelected?.pm || '—')}</p>
                                    </div>
                                </div>
                            </div>

                            {activeSelected?.rejectionReason && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-6 animate-scale-up">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-extrabold text-red-800 text-sm mb-1">Proyek Ditolak — Perlu Perbaikan</h4>
                                            <p className="text-xs text-red-600 mb-2">
                                                Tim Perencanaan/Analis telah menolak proyek Anda dengan alasan berikut. Silakan perbaiki dan ajukan kembali.
                                            </p>
                                            <div className="bg-white border border-red-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
                                                {activeSelected.rejectionReason}
                                            </div>
                                        </div>
                                    </div>

                                    {(() => {
                                        const realDocList = getProjectRealDocuments(activeProjectObj);
                                        const initDocs = realDocList.filter(d => {
                                            const t = (d.type || d.doc_type || '').toLowerCase();
                                            const n = (d.name || '').toLowerCase();
                                            return t === 'brd' || n.includes('brd') || t === 'mem' || n.includes('memo')
                                                || t === 'fsd' || n.includes('fsd') || n.includes('kajian')
                                                || t === 'lampiran' || n.includes('lampiran')
                                                || t === 'lainnya';
                                        });
                                        if (initDocs.length === 0) return null;
                                        return (
                                            <div className="mt-4 border-t border-red-200 pt-4">
                                                <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2">
                                                    Dokumen Terlampir (Inisiasi s/d Analisis)
                                                </p>
                                                <div className="space-y-2">
                                                    {initDocs.map((doc, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-red-100 rounded-xl text-xs">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 font-bold text-[9px] ${getDocIconStyle(doc.name || '')}`}>
                                                                    {getDocExtLabel(doc.name || '')}
                                                                </div>
                                                                <span className="font-medium text-gray-700 truncate">{doc.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewDoc(doc)}
                                                                    className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Eye size={12} /> Lihat
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (!doc.id) return;
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
                                                                            alert('Gagal mengunduh dokumen.');
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Download size={12} /> Unduh
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="flex items-center justify-between border-t border-red-200 pt-3 mt-4">
                                        <span className="text-xs text-red-600 font-medium">Status: <strong className="text-red-800">Ditolak</strong></span>
                                        <button
                                            onClick={() => navigate('/projects/new')}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-95"
                                        >
                                            <RotateCcw size={14} />
                                            Ajukan Kembali Proyek
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end mb-6">
                                <button
                                    className="shrink-0 flex items-center px-4 py-2.5 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed opacity-60 transition-colors border border-gray-200 font-semibold text-sm"
                                    disabled
                                >
                                    <FileText size={18} className="mr-2" />
                                    Unduh Ringkasan PDF
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800 mb-8 flex items-center">
                                    <Route size={20} className="mr-2 text-[#00529C]" />
                                    Perjalanan Pengajuan
                                </h2>

                                <div className="relative px-2">
                                    {activeSelected?.phases?.map((phase, idx) => (
                                        <div
                                            key={idx}
                                            className="relative flex gap-6 pb-12 last:pb-0"
                                        >
                                            {idx < activeSelected.phases.length - 1 && (
                                                <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200 z-0"></div>
                                            )}

                                            <div className="relative flex flex-col items-center z-10">
                                                {getPhaseCircle(phase)}
                                            </div>

                                            <div className="flex-1 pt-1">
                                                <h3 className={`font-semibold text-gray-800 mb-1 ${phase.isActive ? 'text-[#00529C]' : ''}`}>
                                                    {phase.name}
                                                </h3>
                                                <p className="text-sm text-gray-500 mb-4">{phase.description}</p>

                                                {phase.items && phase.items.length > 0 && (
                                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                                                        {phase.items.map((item, i) => (
                                                            <div key={i} className="flex items-center gap-3">
                                                                <CheckCircle size={16} className="text-emerald-500" />
                                                                <span className="text-sm text-gray-700">
                                                                    {item.label}
                                                                    <span className="text-xs text-gray-400 ml-2">({item.date})</span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {phase.isActive && phase.activeNote && (
                                                            <div className="flex items-start gap-3 p-3 bg-white rounded border border-blue-200 shadow-sm mt-2">
                                                                <Shield size={18} className="text-[#00529C] animate-pulse mt-0.5" />
                                                                <div>
                                                                    <span className="font-semibold text-sm text-gray-800 block mb-1">
                                                                        {phase.activeNote}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">{phase.activeNoteDetail}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Dokumen Proyek (semua tahap) ── */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mt-6">
                                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                    <FileText size={20} className="mr-2 text-[#00529C]" />
                                    Dokumen Proyek
                                </h2>
                                {(() => {
                                    const realDocs = getProjectRealDocuments(activeProjectObj);
                                    if (realDocs.length === 0) {
                                        return <p className="text-xs text-gray-400 italic">Belum ada dokumen terlampir.</p>;
                                    }
                                    return (
                                        <div className="space-y-2">
                                            {realDocs.map((doc, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 font-bold text-[9px] ${getDocIconStyle(doc.name || '')}`}>
                                                            {getDocExtLabel(doc.name || '')}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-700 truncate">{doc.name}</p>
                                                            <p className="text-[10px] text-gray-400">{doc.size} • {doc.author}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                                        {doc.id && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewDoc(doc)}
                                                                    className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Eye size={12} /> Lihat
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (!doc.id) return;
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
                                                                            alert('Gagal mengunduh dokumen.');
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Download size={12} /> Unduh
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* ── Status Pengujian (SIT/UAT) & Change Request ── */}
                            {(() => {
                                const sd = activeProjectObj?.sitUatData || activeProjectObj?.sit_uat_data || {};
                                const stRaw = activeSelected?.statusRaw;
                                const isUat = ['UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_REVISION_DEV', 'DEV_COMPLETED'].includes(stRaw);
                                const isSit = ['SIT_IN_PROGRESS', 'SIT_REVISION'].includes(stRaw);
                                const uatAppr = sd.uat3_approvals || {};
                                const crs = sd.uat_change_requests || [];
                                const sitAppr = sd.sit3_approvals || {};
                                if (!isSit && !isUat) return null;
                                return (
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mt-6">
                                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                            <Shield size={20} className="mr-2 text-[#00529C]" />
                                            Status Pengujian
                                        </h2>

                                        {/* UAT */}
                                        {isUat && (
                                            <div className="space-y-4">
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                                    <p className="text-xs font-bold text-amber-800 mb-2">Persetujuan UAT</p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                        {[
                                                            { key: 'business_user', label: 'Pemohon' },
                                                            { key: 'pm', label: 'PM' },
                                                            { key: 'development_lead', label: 'Dev Lead' },
                                                        ].map(r => (
                                                            <div key={r.key} className={`p-2.5 rounded-lg border text-center ${uatAppr?.[r.key]?.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                                                <p className="text-[9px] font-bold text-gray-500 uppercase">{r.label}</p>
                                                                <p className={`text-[11px] font-bold mt-0.5 ${uatAppr?.[r.key]?.approved ? 'text-emerald-700' : 'text-gray-400'}`}>
                                                                    {uatAppr?.[r.key]?.approved ? '✓ Disetujui' : 'Menunggu'}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {user?.role === 'business_user' && !uatAppr?.business_user?.approved && (
                                                        <button
                                                            onClick={() => handleUatApprove(activeSelected?.rawId)}
                                                            disabled={uatApproving}
                                                            className="mt-3 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                                                        >
                                                            {uatApproving ? (
                                                                <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                                                            ) : (
                                                                <><CheckCircle size={14} /> Setujui UAT Sebagai Pemohon</>
                                                            )}
                                                        </button>
                                                    )}
                                                    {user?.role === 'business_user' && uatAppr?.business_user?.approved && (
                                                        <p className="mt-3 text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                                            <CheckCircle size={13} /> Anda telah menyetujui UAT.
                                                        </p>
                                                    )}
                                                    {user?.role === 'business_user' && (
                                                        <button
                                                            onClick={() => setCrModalOpen(true)}
                                                            className="mt-2 w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                                                        >
                                                            <RotateCcw size={14} /> Ajukan Change Request
                                                        </button>
                                                    )}
                                                </div>
                                                {crs.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-700 mb-2">Change Request</p>
                                                        <div className="space-y-2">
                                                            {crs.map(cr => (
                                                                <div key={cr.id} className={`p-3 rounded-xl border text-xs ${cr.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : cr.status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="font-bold text-gray-800">{cr.title}</span>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${cr.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : cr.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                                                            {cr.status === 'approved' ? 'Disetujui' : cr.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-gray-600 mt-1">{cr.detail}</p>
                                                                    <p className="text-[10px] text-gray-400 mt-1">Oleh: {cr.submittedBy}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* SIT */}
                                        {isSit && (
                                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                                <p className="text-xs font-bold text-blue-800 mb-2">Persetujuan SIT</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    <div className={`p-2.5 rounded-lg border text-center ${sitAppr?.developer?.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                                        <p className="text-[9px] font-bold text-gray-500 uppercase">Developer</p>
                                                        <p className={`text-[11px] font-bold mt-0.5 ${sitAppr?.developer?.approved ? 'text-emerald-700' : 'text-gray-400'}`}>
                                                            {sitAppr?.developer?.approvedCount ?? 0}/{sitAppr?.developer?.required ?? 0}
                                                        </p>
                                                    </div>
                                                    <div className={`p-2.5 rounded-lg border text-center ${sitAppr?.pm?.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                                        <p className="text-[9px] font-bold text-gray-500 uppercase">PM</p>
                                                        <p className={`text-[11px] font-bold mt-0.5 ${sitAppr?.pm?.approved ? 'text-emerald-700' : 'text-gray-400'}`}>
                                                            {sitAppr?.pm?.approved ? '✓' : 'Menunggu'}
                                                        </p>
                                                    </div>
                                                    <div className={`p-2.5 rounded-lg border text-center ${sitAppr?.development_lead?.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                                        <p className="text-[9px] font-bold text-gray-500 uppercase">Dev Lead</p>
                                                        <p className={`text-[11px] font-bold mt-0.5 ${sitAppr?.development_lead?.approved ? 'text-emerald-700' : 'text-gray-400'}`}>
                                                            {sitAppr?.development_lead?.approved ? '✓' : 'Menunggu'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {previewDoc && (
                <DocumentViewerModal
                    doc={previewDoc}
                    project={activeProjectObj}
                    onClose={() => setPreviewDoc(null)}
                />
            )}

            {/* ── Modal Ajukan Change Request UAT (business user) ── */}
            {crModalOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                                <RotateCcw size={20} className="text-orange-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-base">Ajukan Change Request UAT</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Ajukan pembaruan, permintaan tambahan, atau perbaikan atas hasil UAT.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Tipe Perubahan *</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setCrForm(p => ({ ...p, type: 'minor' }))}
                                        className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${crForm.type === 'minor' ? 'bg-orange-500 border-orange-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-orange-50'}`}>
                                        Minor — Ulang SIT
                                    </button>
                                    <button onClick={() => setCrForm(p => ({ ...p, type: 'mayor' }))}
                                        className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${crForm.type === 'mayor' ? 'bg-red-500 border-red-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-red-50'}`}>
                                        Mayor — Kembali ke Dev
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Judul Change Request *</label>
                                <input type="text" value={crForm.title} onChange={e => setCrForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="Contoh: Perubahan format laporan ekspor" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-orange-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Detail Perubahan *</label>
                                <textarea rows={4} value={crForm.detail} onChange={e => setCrForm(p => ({ ...p, detail: e.target.value }))}
                                    placeholder="Jelaskan secara detail apa yang ingin diubah/ditambahkan/diperbaiki..." className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-orange-500 resize-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Kategori (opsional)</label>
                                <input type="text" value={crForm.category} onChange={e => setCrForm(p => ({ ...p, category: e.target.value }))}
                                    placeholder="Contoh: Fungsionalitas, UI/UX, Data" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-orange-500" />
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end mt-4">
                            <button onClick={() => setCrModalOpen(false)} disabled={crSubmitting}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">
                                Batal
                            </button>
                            <button
                                onClick={() => handleCrSubmit(activeSelected?.rawId)}
                                disabled={!crForm.title.trim() || !crForm.detail.trim() || crSubmitting}
                                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                                {crSubmitting ? 'Mengirim...' : 'Ajukan Change Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
