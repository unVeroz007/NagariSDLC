import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects, getProjectRealDocuments } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import RBBBadge from '../../components/RBBBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';

import {
    Shield,
    FolderOpen,
    Link as LinkIcon,
    Copy,
    Send,
    Ban,
    User,
    Clock,
    Calendar,
    ChevronRight,
    Search,
    Bell,
    History,
    HelpCircle,
    FileText,
    File,
    CheckCircle,
    AlertCircle,
    Eye,
    MoreVertical,
    Users,
    Filter,
    Inbox,
    ChevronDown,
    XCircle,
    ShieldAlert,
    AlertTriangle,
    ArrowRight,
    UserCheck,
    X,
    Building,
    Download,
    Check,
    CheckCircle2,
    Bug,
    Sparkles,
    FileCheck,
    Info,
    Paperclip,
    ClipboardList
} from 'lucide-react';

const qaTeamMembers = [
    { id: 1, name: 'Siti Rahmawati', role: 'Senior QA Automation', email: 'qatester@nagari.co.id', activeLoad: 1 },
    { id: 2, name: 'Rian Hidayat', role: 'Functional QA Tester', email: 'rian.qa@nagari.co.id', activeLoad: 0 },
    { id: 3, name: 'Bayu Perkasa', role: 'Mobile QA Specialist', email: 'bayu.qa@nagari.co.id', activeLoad: 1 },
    { id: 4, name: 'Eko Prasetyo', role: 'Lead QA Engineer', email: 'qalead@nagari.co.id', activeLoad: 2 },
];

export default function WorkspaceQA() {
    const { user } = useAuth();
    const { projects, updateProjectStatus } = useProjects();
    const { addNotification } = useNotifications();

    const [activeTab, setActiveTab] = useState('DISPOSITION'); // 'DISPOSITION' | 'REVIEW_LEAD'

    // Tab 1 (Disposisi): proyek dari PM yang sudah diajukan ke QA Lead untuk ditunjuk testernya
    const qaProjects = useMemo(() => {
        let list = (projects || []).filter(p => {
            const qaSt = String(p.qaStatus || p.qa_status || '').toUpperCase();
            const st = String(p.status || '').toUpperCase();
            return (qaSt === 'SUBMITTED' || st === 'READY_FOR_QA') && qaSt !== 'IN_PROGRESS' && qaSt !== 'PASSED';
        });
        const isPrivileged = user?.role && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);
        if (!isPrivileged && user?.name) {
            list = list.filter(p => String(p.qaAssignee || '').toLowerCase().includes(user.name.toLowerCase()));
        }
        return list;
    }, [projects, user]);

    // Tab 2 (Review Lead): proyek yang laporan Analis-nya sudah masuk (qaStatus === 'REVIEW')
    const reviewLeadProjects = useMemo(() => {
        let list = (projects || []).filter(p => {
            const qaSt = String(p.qaStatus || p.qa_status || '').toUpperCase();
            return qaSt === 'REVIEW';
        });
        const isPrivileged = user?.role && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);
        if (!isPrivileged && user?.name) {
            list = list.filter(p => String(p.qaAssignee || '').toLowerCase().includes(user.name.toLowerCase()));
        }
        return list;
    }, [projects, user]);

    const activeList = activeTab === 'DISPOSITION' ? qaProjects : reviewLeadProjects;

    const [selectedProject, setSelectedProject] = useState(null);
    const activeProject = selectedProject || activeList[0] || null;

    const [assignee, setAssignee] = useState('');
    const [notes, setNotes] = useState('');
    const [leadApprovalNote, setLeadApprovalNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDocPreview, setSelectedDocPreview] = useState(null);

    const rightPanelRef = useRef(null);

    const scrollPageToTop = () => {
        if (rightPanelRef.current) {
            rightPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const mainContainer = rightPanelRef.current?.closest('main') || document.querySelector('main');
        if (mainContainer) {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        if (activeProject) {
            scrollPageToTop();
        }
    }, [activeProject?.id, activeTab]);

    const { updateProject } = useProjects();

    const handleAssign = async () => {
        if (!activeProject) return;
        if (!assignee) {
            toast.error('Pilih anggota QA Tester!');
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProject(activeProject.id, {
                qaStatus: 'IN_PROGRESS',
                qaAssignee: assignee,
                qaLeadNotes: notes,
                qa_lead_notes: notes,
                status: activeProject.status === 'READY_FOR_QA' ? 'QA_IN_PROGRESS' : activeProject.status
            });
            toast.success(`Proyek ${activeProject.name} berhasil didisposisikan ke QA Tester (${assignee})!`);
            addNotification('Disposisi QA', `Proyek ${activeProject.name} telah didisposisikan ke ${assignee}.`, 'info');
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan disposisi QA.');
        } finally {
            setIsSubmitting(false);
        }
    };


    // Lead QA menyetujui & mengembalikan hasil QA ke Tim Pengembangan / PM
    const handleApproveQAByLead = async () => {
        if (!activeProject) return;
        setIsSubmitting(true);
        try {
            const isCyberPassed = String(activeProject.cyberStatus || '').toUpperCase() === 'PASSED';
            const testerIsPass = activeProject.testerResult?.isPass !== false;
            const newQaStatus = testerIsPass ? 'PASSED' : 'FAILED';
            const newStatus = !testerIsPass
                ? 'RETURN_TO_DEV'
                : isCyberPassed ? 'TESTING_PASSED' : 'QA_PASSED';
            await updateProject(activeProject.id, {
                qaStatus: newQaStatus,
                qa_status: newQaStatus,
                qaPassedAt: new Date().toISOString(),
                qaLeadApprovalNote: leadApprovalNote,
                qa_lead_approval_note: leadApprovalNote,
                status: newStatus
            });
            toast.success(`Sign-off Lead QA untuk proyek "${activeProject.name}" berhasil! Status: ${newQaStatus}.`);
            addNotification(
                'Sign-off Lead QA Disetujui',
                `Proyek ${activeProject.name} mendapat sign-off Lead QA (${newQaStatus}). Hasil dikembalikan ke PM.`,
                testerIsPass ? 'success' : 'warning',
                '/pm/release-request'
            );
            setLeadApprovalNote('');
        } catch (err) {
            toast.error(err.message || 'Gagal memproses approval Lead QA.');
        } finally {
            setIsSubmitting(false);
        }
    };


    // Real SDLC Documents List gathered from all phases
    const projectDocuments = useMemo(() => {
        return getProjectRealDocuments(activeProject);
    }, [activeProject]);


    const handleCopyStagingUrl = (url) => {
        navigator.clipboard.writeText(url);
        toast.success('Staging URL berhasil disalin!');
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header Laman */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Workspace Lead Quality Assurance (QA)</h2>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={14} /> QA Governance &amp; Sign-Off
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Disposisikan tim QA Tester, tinjau laporan pengujian, dan berikan persetujuan Sign-off resmi Lead QA sebelum diserahkan ke Tim Pengembangan.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LIST PANEL DENGAN TAB SWITCHER (Panel Kiri) */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
                    {/* Tab Navigation */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl mb-3 shrink-0">
                        <button
                            onClick={() => {
                                setActiveTab('DISPOSITION');
                                setSelectedProject(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeTab === 'DISPOSITION'
                                    ? 'bg-white text-[#1a365d] shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <UserCheck size={14} />
                            <span>1. Disposisi QA ({qaProjects.length})</span>
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('REVIEW_LEAD');
                                setSelectedProject(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeTab === 'REVIEW_LEAD'
                                    ? 'bg-white text-blue-700 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <FileCheck size={14} />
                            <span>2. Review Lead ({reviewLeadProjects.length})</span>
                        </button>
                    </div>

                    {/* List Proyek */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {activeList.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                Tidak ada proyek dalam tab ini saat ini.
                            </div>
                        ) : (
                            activeList.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        setSelectedProject(p);
                                        scrollPageToTop();
                                    }}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        activeProject?.id === p.id
                                            ? 'border-2 border-[#1a365d] bg-blue-50/40 shadow-sm'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.id}</span>
                                        <RBBBadge type={p.type} />
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1.5">{p.name || p.title}</h4>
                                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                        <span>Divisi: <strong className="text-gray-700">{p.division}</strong></span>
                                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                            p.status === 'QA_PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                                        }`}>
                                            {p.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* DETAIL & REVIEW PANEL (Panel Kanan) */}
                <div ref={rightPanelRef} className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-210px)] scroll-smooth">
                    {!activeProject ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-20">
                            <Inbox size={48} className="mb-3 text-gray-300" />
                            <p className="font-bold text-gray-600">Pilih Proyek dari Antrean</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Header Detail Proyek */}
                            <div className="pb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                        {activeProject.id}
                                    </span>
                                    <RBBBadge type={activeProject.type} deadline={activeProject.rbbDeadline} />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{activeProject.name || activeProject.title}</h3>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                    <Building size={14} className="text-gray-400" />
                                    <span>Divisi: <strong className="text-gray-700">{activeProject.division}</strong></span>
                                    <span>•</span>
                                    <Calendar size={14} className="text-gray-400" />
                                    <span>Target Finish: <strong className="text-gray-700">{activeProject.targetDate || '2026-09-30'}</strong></span>
                                </p>
                            </div>

                            {/* Staging URL */}
                            <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-xl flex items-center justify-between gap-2">
                                <div className="overflow-hidden">
                                    <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Target Staging URL Pengujian QA</div>
                                    <div className="text-xs font-mono text-blue-700 truncate font-semibold">
                                        {activeProject.stagingUrl || 'https://staging-app.banknagari.co.id'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCopyStagingUrl(activeProject.stagingUrl || 'https://staging-app.banknagari.co.id')}
                                    className="p-1.5 bg-white text-blue-600 hover:bg-blue-100 rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer"
                                    title="Salin Target URL"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>

                            {/* Deskripsi & Scope System */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText size={15} className="text-[#1a365d]" />
                                    Deskripsi &amp; Lingkup Pengujian QA
                                </h4>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                                    {activeProject.description || 'Pengembangan modul aplikasi dan integrasi layanan perbankan digital SDLC Bank Nagari.'}
                                </div>
                            </div>

                            {/* Catatan Teknis PM / Lead */}
                            {(activeProject.qaNotes || activeProject.qa_notes || activeProject.notes) && (
                                <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-blue-600" />
                                        Catatan Teknis Pengajuan (PM / Pengaju Proyek)
                                    </h4>
                                    <p className="text-xs text-blue-950 font-medium leading-relaxed whitespace-pre-wrap">
                                        {activeProject.qaNotes || activeProject.qa_notes || activeProject.notes}
                                    </p>
                                </div>
                            )}

                            {(activeProject.qaLeadNotes || activeProject.qa_lead_notes) && (
                                <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl space-y-1">
                                    <h4 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Info size={14} className="text-purple-600" />
                                        Arahan &amp; Instruksi Disposisi Lead QA
                                    </h4>
                                    <p className="text-xs text-purple-950 font-medium leading-relaxed whitespace-pre-wrap">
                                        {activeProject.qaLeadNotes || activeProject.qa_lead_notes}
                                    </p>
                                </div>
                            )}


                            {/* Dokumen SDLC & Sign-off */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <FolderOpen size={15} className="text-[#1a365d]" />
                                        Dokumen SDLC &amp; Lembar Sign-Off Resmi ({projectDocuments.length})
                                    </span>
                                </h4>

                                <div className="space-y-2.5">
                                    {projectDocuments.map(doc => (
                                        <div key={doc.id} className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between hover:border-blue-300 transition-all shadow-xs">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                    <FileText size={18} />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h5 className="font-bold text-gray-800 text-xs truncate">{doc.name}</h5>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                                        {doc.type} • {doc.size} • Penulis: {doc.author}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setSelectedDocPreview(doc)}
                                                className="px-3 py-1.5 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                                            >
                                                <Eye size={13} />
                                                <span>Pratinjau Dokumen</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* KONTEN BERDASARKAN TAB AKTIF */}
                            {activeTab === 'DISPOSITION' ? (
                                /* TAB 1: FORM DISPOSISI QA TESTER */
                                <div className="p-5 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-4 shadow-xs">
                                    <div className="flex items-center gap-2 border-b border-blue-200/80 pb-3">
                                        <UserCheck size={18} className="text-blue-700" />
                                        <h4 className="font-extrabold text-sm text-blue-900">Form Disposisi Penugasan QA Tester</h4>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Pilih Anggota QA Tester <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={assignee}
                                                onChange={(e) => setAssignee(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            >
                                                <option value="">-- Pilih QA Tester --</option>
                                                {qaTeamMembers.map(a => (
                                                    <option key={a.id} value={a.name}>
                                                        {a.name} - {a.role} (Beban: {a.activeLoad} Pengujian Aktif)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Instruksi Pengujian Fungsional</label>
                                            <textarea
                                                rows={3}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Misal: Lakukan pengujian skenario transaksi utama, validasi error message form, dan stress test..."
                                                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            />
                                        </div>

                                        <button
                                            onClick={handleAssign}
                                            disabled={isSubmitting}
                                            className="w-full py-3 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            <Send size={16} />
                                            <span>Simpan &amp; Disposisikan ke QA Tester</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* TAB 2: REVIEW & APPROVAL LEAD QA — Membaca Laporan Nyata dari Analis */
                                <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-4 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                                        <div className="flex items-center gap-2">
                                            <FileCheck size={18} className="text-emerald-700" />
                                            <h4 className="font-extrabold text-sm text-emerald-900">Review Laporan Analis QA &amp; Sign-Off Lead QA</h4>
                                        </div>
                                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            Menunggu Review Lead
                                        </span>
                                    </div>

                                    {/* Laporan Nyata dari Analis QA */}
                                    {activeProject.testerResult ? (
                                        <div className="space-y-3">
                                            {/* Info Tester & Keputusan */}
                                            <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-2.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-gray-700 flex items-center gap-1.5"><User size={13} className="text-emerald-600" /> Analis: <strong>{activeProject.testerResult.testerName}</strong></span>
                                                    <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[11px] ${activeProject.testerResult.isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                        {activeProject.testerResult.decision}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                                    <span>Severity: <strong className="text-gray-700">{activeProject.testerResult.severity}</strong></span>
                                                    <span>•</span>
                                                    <span>Checklist: <strong className="text-gray-700">{activeProject.testerResult.checklistSummary}</strong></span>
                                                    <span>•</span>
                                                    <span>Dikirim: <strong className="text-gray-700">{activeProject.testerResult.submittedAt ? new Date(activeProject.testerResult.submittedAt).toLocaleString('id-ID') : '-'}</strong></span>
                                                </div>
                                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                    <p className="text-xs font-bold text-gray-600 mb-1">Catatan Temuan:</p>
                                                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{activeProject.testerResult.notes}</p>
                                                </div>
                                            </div>

                                            {/* Evidence Files */}
                                            {activeProject.testerResult.evidence?.length > 0 && (
                                                <div>
                                                    <h5 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                        <Paperclip size={13} className="text-emerald-600" /> Bukti Pengujian / Evidence ({activeProject.testerResult.evidence.length})
                                                    </h5>
                                                    <div className="space-y-2">
                                                        {activeProject.testerResult.evidence.map(ev => (
                                                            <div key={ev.id} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <Paperclip size={13} className="text-emerald-600 shrink-0" />
                                                                    <div className="overflow-hidden">
                                                                        <p className="text-xs font-bold text-gray-800 truncate">{ev.name}</p>
                                                                        <p className="text-[10px] text-gray-400">{ev.size} • {ev.uploadedAt}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <button onClick={() => setSelectedDocPreview(ev)}
                                                                        className="px-2 py-1 bg-[#1a365d] text-white rounded-lg text-xs font-bold hover:bg-[#0f2342] transition-all flex items-center gap-1 cursor-pointer">
                                                                        <Eye size={11} /> Lihat
                                                                    </button>
                                                                    <button onClick={() => { if (ev.url) { const a = document.createElement('a'); a.href = ev.url; a.download = ev.name; a.click(); } else toast.error('File tidak tersedia untuk diunduh.'); }}
                                                                        className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 cursor-pointer">
                                                                        <Download size={11} /> Unduh
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-400 italic">
                                            Laporan dari Analis QA belum masuk. Proyek ini belum selesai diuji.
                                        </div>
                                    )}

                                    {/* Action Review Lead QA */}
                                    <div className="space-y-3 pt-2 border-t border-emerald-200">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-800 mb-1.5">Catatan Verifikasi &amp; Approval Lead QA</label>
                                            <textarea
                                                rows={2}
                                                value={leadApprovalNote}
                                                onChange={(e) => setLeadApprovalNote(e.target.value)}
                                                placeholder="Tuliskan catatan verifikasi & keputusan sign-off Lead QA sebelum dikembalikan ke PM..."
                                                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                            />
                                        </div>

                                        <button
                                            onClick={handleApproveQAByLead}
                                            disabled={isSubmitting || !activeProject.testerResult}
                                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            <CheckCircle size={18} />
                                            <span>Sign-Off Lead QA &amp; Kembalikan Hasil ke PM</span>
                                        </button>
                                        <p className="text-[10px] text-gray-400 text-center">Hasil akan diteruskan ke PM Proyek. Jika keduanya (QA &amp; Cyber) PASSED, PM bisa ajukan ke Infrastruktur.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL PRATINJAU DOKUMEN SDLC RESMI */}
            {selectedDocPreview && (
                <DocumentViewerModal
                    doc={selectedDocPreview}
                    project={activeProject}
                    onClose={() => setSelectedDocPreview(null)}
                />
            )}

        </div>
    );
}