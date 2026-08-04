import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import RBBBadge from '../../components/RBBBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
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
    FileCheck
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
        return (projects || []).filter(p => ['READY_FOR_QA'].includes(p.status));
    }, [projects]);


    // Tab 2 (Review Lead): proyek yang sedang diuji oleh QA Tester (QA_IN_PROGRESS)
    const reviewLeadProjects = useMemo(() => {
        return (projects || []).filter(p => ['QA_IN_PROGRESS'].includes(p.status));
    }, [projects]);

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

    const handleAssign = async () => {
        if (!activeProject) return;
        if (!assignee) {
            toast.error('Pilih anggota QA Tester!');
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProjectStatus(activeProject.id, 'QA_IN_PROGRESS', `Disposisi QA Tester: ${assignee}. ${notes}`);
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
            await updateProjectStatus(activeProject.id, 'QA_PASSED', `Sign-off Lead QA Disetujui: ${leadApprovalNote || 'Seluruh skenario pengujian QA dinyatakan Lulus 100%.'}`);
            toast.success(`Laporan QA proyek ${activeProject.name} resmi disetujui Lead QA & dikembalikan ke Tim Pengembangan (Dev/PM)!`);
            addNotification('Sign-off Lead QA Disetujui', `Proyek ${activeProject.name} telah resmi mengantongi Sign-off Lead QA.`, 'success', '/pm/release-request');
            setLeadApprovalNote('');
        } catch (err) {
            toast.error(err.message || 'Gagal memproses approval Lead QA.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Mock SDLC Documents List
    const projectDocuments = useMemo(() => {
        if (!activeProject) return [];
        return [
            {
                id: 1,
                name: `BRD_${activeProject.id}_Business_Requirement.pdf`,
                type: 'BRD (Business Requirement Document)',
                size: '2.4 MB',
                uploadedAt: '2026-07-20',
                author: 'Analyst TI Bank Nagari',
                content: `DOKUMEN SPESIFIKASI KEBUTUHAN BISNIS (BRD)\nPT BANK PUMUDA KEBANGSAAN (BANK NAGARI)\n\nProyek: ${activeProject.name}\nKode ID: ${activeProject.id}\nDivisi Pengusul: ${activeProject.division || 'Divisi Teknologi Informasi'}\n\nBAB I: PENDAHULUAN\nSistem ini dirancang untuk memenuhi kebutuhan operasional dan integrasi layanan perbankan digital Bank Nagari.`
            },
            {
                id: 2,
                name: `FSD_${activeProject.id}_Functional_Spec.pdf`,
                type: 'FSD (Functional Specification Document)',
                size: '3.8 MB',
                uploadedAt: '2026-07-22',
                author: 'System Analyst TI',
                content: `SPESIFIKASI FUNGSIONAL SISTEM (FSD)\nNomor: FSD/${activeProject.id}/2026\n\nStaging Endpoint: ${activeProject.stagingUrl || 'https://staging-app.banknagari.co.id'}\nTest Account: qa_tester_01 / Pass: NagariSafe#2026`
            },
            {
                id: 3,
                name: `QA_SignOff_Report_${activeProject.id}.pdf`,
                type: 'Lembar Dokumen Sign-Off Resmi Lead QA',
                size: '1.9 MB',
                uploadedAt: '2026-07-28',
                author: 'Siti Rahmawati (QA Lead)',
                content: `LEMBAR VERIFIKASI & SIGN-OFF KUALITAS PENGUJIANKA (QA SIGN-OFF)\nBANK NAGARI IT GOVERNANCE\n\nNomor Surat: QA-PASS/${activeProject.id}/2026\nNama Proyek: ${activeProject.name}\nStatus Pengujian: PASSED (LULUS 100% SKENARIO FUNGSIONAL)\n\nDengan ini Lead QA menyatakan proyek tersebut telah memenuhi standar kualitas fungsional dan diserahkan kembali ke Tim Pengembangan untuk proses pengajuan migrasi ke Grup INFRA.`
            }
        ];
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
                                /* TAB 2: REVIEW & APPROVAL LEAD QA */
                                <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-4 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                                        <div className="flex items-center gap-2">
                                            <FileCheck size={18} className="text-emerald-700" />
                                            <h4 className="font-extrabold text-sm text-emerald-900">Peninjauan Laporan Tester &amp; Sign-Off Lead QA</h4>
                                        </div>
                                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            QA Testing Completed
                                        </span>
                                    </div>

                                    {/* Hasil Pengujian Tester */}
                                    <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-2">
                                        <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                                            <span>Penguji: {activeProject.testerResult?.testerName || 'Siti Rahmawati (Senior QA Engineer)'}</span>
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-extrabold">
                                                {activeProject.testerResult?.decision || 'PASSED (LULUS QA)'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-700 leading-relaxed font-medium bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            {activeProject.testerResult?.notes || 'Seluruh skenario pengujian fungsional telah dites 100% Lulus. Tidak ada defect kritis.'}
                                        </p>
                                    </div>

                                    {/* Action Review Lead QA */}
                                    <div className="space-y-3 pt-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-800 mb-1.5">Catatan Verifikasi &amp; Approval Lead QA</label>
                                            <textarea
                                                rows={2}
                                                value={leadApprovalNote}
                                                onChange={(e) => setLeadApprovalNote(e.target.value)}
                                                placeholder="Tuliskan catatan verifikasi Lead QA sebelum dikembalikan ke Tim Pengembangan..."
                                                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                            />
                                        </div>

                                        <button
                                            onClick={handleApproveQAByLead}
                                            disabled={isSubmitting}
                                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            <CheckCircle size={18} />
                                            <span>Setujui Sign-Off Lead QA &amp; Teruskan ke Tim Pengembangan (Dev/PM)</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL PRATINJAU DOKUMEN SDLC */}
            {selectedDocPreview && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-scale-up overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 border border-gray-100 my-8">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                                    BN
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                        Dokumen Resmi SDLC Bank Nagari
                                    </span>
                                    <h3 className="font-extrabold text-gray-800 text-base mt-0.5">
                                        {selectedDocPreview.name}
                                    </h3>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDocPreview(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl space-y-4 max-h-[60vh] overflow-y-auto font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {selectedDocPreview.content}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                onClick={() => {
                                    toast.success(`Dokumen ${selectedDocPreview.name} berhasil diunduh!`);
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <Download size={14} />
                                Unduh Dokumen (PDF)
                            </button>
                            <button
                                onClick={() => setSelectedDocPreview(null)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}