// src/components/SITUATWizard.jsx
// ─── Wizard Multi-Step SIT & UAT Internal untuk Proyek Bank Nagari ─────────
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
    ShieldCheck, Server, CheckSquare, Lock, CheckCircle2,
    Upload, X, FileText, ArrowRight, ArrowLeft, AlertTriangle,
    RotateCcw, Send, Paperclip, Info, ChevronRight, Clock,
    Eye, Download, Printer, Building2, ClipboardList, Bug,
    UserCheck, FileCheck, BookOpen
} from 'lucide-react';


// ─── Helper: safely render object or string field ────────────────────────────
const sf = (val, fb = '-') => {
    if (!val) return fb;
    if (typeof val === 'object') return String(val.name || val.label || val.initial || fb);
    return String(val);
};

// ─── Helper: format timestamp ─────────────────────────────────────────────────
const fmtDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ─── Constants ────────────────────────────────────────────────────────────────
const SIT_STATUSES = ['IN_DEVELOPMENT', 'SIT_IN_PROGRESS', 'SIT_REVISION', 'RETURN_TO_DEV'];
const UAT_STATUSES = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_REVISION_DEV'];
const DONE_STATUSES = ['DEV_COMPLETED'];

// ─── Sub-step definitions ─────────────────────────────────────────────────────
const SIT_STEPS = [
    { id: 1, title: 'Persiapan SIT', icon: <BookOpen size={15} />, desc: 'Test Plan & Environment', color: 'blue' },
    { id: 2, title: 'Eksekusi Pengujian', icon: <Bug size={15} />, desc: 'Test Cases & Defect Log', color: 'indigo' },
    { id: 3, title: 'Review & Sign-Off', icon: <FileCheck size={15} />, desc: 'Verifikasi & Keputusan', color: 'teal' },
];
const UAT_STEPS = [
    { id: 1, title: 'Persiapan Skenario UAT', icon: <ClipboardList size={15} />, desc: 'Skenario Bisnis & Peserta', color: 'amber' },
    { id: 2, title: 'Eksekusi UAT Internal', icon: <UserCheck size={15} />, desc: 'Pengujian Fungsi & Temuan', color: 'orange' },
    { id: 3, title: 'Persetujuan Final', icon: <CheckCircle2 size={15} />, desc: 'Sign-off & Terbitkan BAST', color: 'emerald' },
];

// ─── File Upload Helper ────────────────────────────────────────────────────────
function useFileUpload(category) {
    const inputRef = useRef(null);
    const createEntries = (files) => files.map(file => ({
        id: `${category}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: file.name.split('.').pop().toUpperCase(),
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
        category,
    }));
    return { inputRef, createEntries };
}

// ─── DocList — small list of uploaded files ────────────────────────────────────
function DocList({ docs, onRemove, readOnly = false }) {
    if (!docs?.length) return (
        <div className="mt-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-center text-gray-400 text-xs">
            <FileText size={20} className="mx-auto mb-1 text-gray-300" />
            Belum ada berkas dilampirkan
        </div>
    );
    return (
        <div className="mt-2 space-y-1.5">
            {docs.map((doc, i) => (
                <div key={doc.id || i} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-all group">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-[9px] shrink-0">
                        {doc.type || 'DOC'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{doc.name}</p>
                        <p className="text-[10px] text-gray-400">{doc.size} • {fmtDate(doc.uploadedAt)}</p>
                    </div>
                    {!readOnly && (
                        <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0">
                            <X size={13} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── RevisionBanner — shown when a revision was requested ─────────────────────
function RevisionBanner({ revisions, type }) {
    const filtered = (revisions || []).filter(r => r.type === type);
    if (!filtered.length) return null;
    const latest = filtered[filtered.length - 1];
    return (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
            <div>
                <p className="text-xs font-bold text-orange-900">Catatan Revisi Terakhir ({fmtDate(latest.at)})</p>
                <p className="text-xs text-orange-800 mt-1 leading-relaxed">{latest.notes}</p>
                <p className="text-[10px] text-orange-600 mt-1">Oleh: {latest.by}</p>
            </div>
        </div>
    );
}

// ─── StepTab — sub-step tab button ────────────────────────────────────────────
function StepTab({ step, isActive, isCompleted, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${isActive
                ? 'border-current text-[#003a73] bg-blue-50/50'
                : isCompleted
                    ? 'border-transparent text-emerald-600 hover:text-gray-700'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
        >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isActive ? 'bg-[#003a73] text-white' : isCompleted ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {isCompleted ? '✓' : step.id}
            </span>
            <span className="hidden sm:inline">{step.title}</span>
            <span className="sm:hidden">{step.id}</span>
        </button>
    );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function SITUATWizard({ project, updateProject, addNotification, navigate }) {
    const status = project?.status || 'IN_DEVELOPMENT';
    const sitUatData = project?.sitUatData || {};

    // ── State ─────────────────────────────────────────────────────────────────
    const [activeSitStep, setActiveSitStep] = useState(sitUatData.activeSitStep || 1);
    const [activeUatStep, setActiveUatStep] = useState(sitUatData.activeUatStep || 1);

    // SIT Step 1 data
    const [sit1, setSit1] = useState({
        stagingUrl: sitUatData.sit1_stagingUrl || '',
        testEnv: sitUatData.sit1_testEnv || '',
        scenarioCount: sitUatData.sit1_scenarioCount || '',
        prepNotes: sitUatData.sit1_prepNotes || '',
        docs: sitUatData.sit1_docs || [],
    });
    // SIT Step 2 data
    const [sit2, setSit2] = useState({
        totalCases: sitUatData.sit2_totalCases || '',
        passedCases: sitUatData.sit2_passedCases || '',
        defects: sitUatData.sit2_defects || '',
        execNotes: sitUatData.sit2_execNotes || '',
        docs: sitUatData.sit2_docs || [],
    });
    // SIT Step 3 data
    const [sit3, setSit3] = useState({
        reviewNotes: sitUatData.sit3_reviewNotes || '',
        docs: sitUatData.sit3_docs || [],
    });

    // UAT Step 1 data
    const [uat1, setUat1] = useState({
        scenarioList: sitUatData.uat1_scenarioList || '',
        preparedBy: sitUatData.uat1_preparedBy || '',
        prepNotes: sitUatData.uat1_prepNotes || '',
        docs: sitUatData.uat1_docs || [],
    });
    // UAT Step 2 data
    const [uat2, setUat2] = useState({
        executedCount: sitUatData.uat2_executedCount || '',
        passedCount: sitUatData.uat2_passedCount || '',
        findings: sitUatData.uat2_findings || '',
        execNotes: sitUatData.uat2_execNotes || '',
        docs: sitUatData.uat2_docs || [],
    });
    // UAT Step 3 data
    const [uat3, setUat3] = useState({
        approvalNotes: sitUatData.uat3_approvalNotes || '',
        approvedBy: sitUatData.uat3_approvedBy || '',
        docs: sitUatData.uat3_docs || [],
    });

    // Revision & modal state
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const [revisionType, setRevisionType] = useState(null); // 'SIT_TO_DEV' | 'UAT_TO_SIT' | 'UAT_TO_DEV'
    const [revisionNotes, setRevisionNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);


    // Revision history
    const revisions = sitUatData.revisions || [];

    // ── File upload refs ──────────────────────────────────────────────────────
    const sit1FileRef = useRef(null);
    const sit2FileRef = useRef(null);
    const sit3FileRef = useRef(null);
    const uat1FileRef = useRef(null);
    const uat2FileRef = useRef(null);
    const uat3FileRef = useRef(null);

    const mkDocs = (files, cat) => Array.from(files).map(f => ({
        id: `${cat}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: f.name,
        size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
        type: f.name.split('.').pop().toUpperCase(),
        url: URL.createObjectURL(f),
        uploadedAt: new Date().toISOString(),
        category: cat,
    }));

    const onUpload = (e, setter, key, cat) => {
        const docs = mkDocs(e.target.files, cat);
        if (!docs.length) return;
        setter(prev => ({ ...prev, docs: [...(prev.docs || []), ...docs] }));
        toast.success(`${docs.length} berkas dilampirkan.`);
    };

    const onRemoveDoc = (setter, idx) => {
        setter(prev => ({ ...prev, docs: prev.docs.filter((_, i) => i !== idx) }));
    };

    // ── Persist helper — saves current form state to project ─────────────────
    const buildSitUatData = (overrides = {}) => ({
        activeSitStep, activeUatStep,
        sit1_stagingUrl: sit1.stagingUrl, sit1_testEnv: sit1.testEnv,
        sit1_scenarioCount: sit1.scenarioCount, sit1_prepNotes: sit1.prepNotes,
        sit1_docs: sit1.docs,
        sit2_totalCases: sit2.totalCases, sit2_passedCases: sit2.passedCases,
        sit2_defects: sit2.defects, sit2_execNotes: sit2.execNotes,
        sit2_docs: sit2.docs,
        sit3_reviewNotes: sit3.reviewNotes, sit3_docs: sit3.docs,
        uat1_scenarioList: uat1.scenarioList, uat1_preparedBy: uat1.preparedBy,
        uat1_prepNotes: uat1.prepNotes, uat1_docs: uat1.docs,
        uat2_executedCount: uat2.executedCount, uat2_passedCount: uat2.passedCount,
        uat2_findings: uat2.findings, uat2_execNotes: uat2.execNotes,
        uat2_docs: uat2.docs,
        uat3_approvalNotes: uat3.approvalNotes, uat3_approvedBy: uat3.approvedBy,
        uat3_docs: uat3.docs,
        revisions,
        ...overrides,
    });

    // ── Action handlers ────────────────────────────────────────────────────────
    const handleStartSIT = () => {
        updateProject(project.id, { status: 'SIT_IN_PROGRESS', sitUatData: buildSitUatData({ activeSitStep: 1 }) });
        toast.success(`Pengujian SIT dimulai untuk proyek "${project.name}".`);
    };

    const handleSaveSITStep = (step) => {
        const nextStep = step + 1;
        setActiveSitStep(nextStep);
        updateProject(project.id, { status: 'SIT_IN_PROGRESS', sitUatData: buildSitUatData({ activeSitStep: nextStep }) });
        toast.success(`✅ SIT Tahap ${step} tersimpan. Lanjut ke Tahap ${nextStep}.`);
    };

    const handleSITPass = () => {
        setSubmitting(true);
        updateProject(project.id, {
            status: 'SIT_PASSED',
            sitPassedAt: new Date().toISOString(),
            sitUatData: buildSitUatData({ activeSitStep: 3, activeUatStep: 1 }),
        });
        addNotification?.('SIT Lulus!', `Proyek "${project.name}" lulus SIT. UAT Internal dapat dimulai.`, 'success', '/pm/workspace');
        toast.success(`🎉 SIT Lulus! Proyek siap melanjutkan ke UAT Internal.`);
        setSubmitting(false);
    };

    const handleSITRevision = () => {
        if (!revisionNotes.trim()) { toast.error('Catatan revisi wajib diisi!'); return; }
        setSubmitting(true);
        const newRevision = { type: 'SIT_TO_DEV', notes: revisionNotes.trim(), at: new Date().toISOString(), by: sf(project?.pm, 'Tim TI') };
        const newRevisions = [...revisions, newRevision];
        updateProject(project.id, {
            status: 'SIT_REVISION',
            sitUatData: buildSitUatData({ revisions: newRevisions, activeSitStep: 1 }),
        });
        addNotification?.('Revisi SIT Diminta', `Proyek "${project.name}" dikembalikan ke Development karena SIT gagal.`, 'warning', '/pm/workspace');
        toast.error(`↩️ Revisi diminta. Proyek kembali ke Development.`);
        setRevisionNotes('');
        setShowRevisionModal(false);
        setSubmitting(false);
    };

    const handleStartUAT = () => {
        updateProject(project.id, { status: 'UAT_IN_PROGRESS', sitUatData: buildSitUatData({ activeUatStep: 1 }) });
        toast.success(`Pengujian UAT Internal dimulai untuk proyek "${project.name}".`);
    };

    const handleSaveUATStep = (step) => {
        const nextStep = step + 1;
        setActiveUatStep(nextStep);
        updateProject(project.id, { status: 'UAT_IN_PROGRESS', sitUatData: buildSitUatData({ activeUatStep: nextStep }) });
        toast.success(`✅ UAT Tahap ${step} tersimpan. Lanjut ke Tahap ${nextStep}.`);
    };

    const handleUATPass = () => {
        setSubmitting(true);
        updateProject(project.id, {
            status: 'DEV_COMPLETED',
            uatPassedAt: new Date().toISOString(),
            sitUatData: buildSitUatData({ activeUatStep: 3 }),
        });
        addNotification?.('✅ BAST Diterbitkan — DEV COMPLETED!', `Proyek "${project.name}" lulus SIT & UAT Internal. Siap QA & Siber.`, 'success', '/pm/workspace');
        toast.success(`🎉 BAST Diterbitkan! Proyek resmi berstatus DEV_COMPLETED.`);
        setSubmitting(false);
    };

    const handleUATRevision = () => {
        if (!revisionNotes.trim()) { toast.error('Catatan revisi wajib diisi!'); return; }
        setSubmitting(true);
        const newStatus = revisionType === 'UAT_TO_SIT' ? 'UAT_REVISION_SIT' : 'UAT_REVISION_DEV';
        const newRevision = { type: revisionType, notes: revisionNotes.trim(), at: new Date().toISOString(), by: sf(project?.pm, 'Tim TI') };
        const newRevisions = [...revisions, newRevision];
        const nextActiveSit = revisionType === 'UAT_TO_SIT' ? 1 : (sitUatData.activeSitStep || 1);
        updateProject(project.id, {
            status: newStatus,
            sitUatData: buildSitUatData({ revisions: newRevisions, activeUatStep: 1, activeSitStep: nextActiveSit }),
        });
        addNotification?.('Revisi UAT Diminta', `Proyek "${project.name}" dikembalikan ${revisionType === 'UAT_TO_SIT' ? 'ke SIT' : 'ke Development'}.`, 'warning', '/pm/workspace');
        toast.error(`↩️ Revisi diminta. Proyek kembali ke ${revisionType === 'UAT_TO_SIT' ? 'SIT' : 'Development'}.`);
        setRevisionNotes('');
        setShowRevisionModal(false);
        setSubmitting(false);
    };

    // ── Status helpers ─────────────────────────────────────────────────────────
    const stUpper = String(status || '').toUpperCase();
    const isDev = ['IN_DEVELOPMENT', 'DEVELOPMENT', 'DEV_IN_PROGRESS', 'IN_SPRINT', 'READY_FOR_DEVELOPMENT'].includes(stUpper);
    const sitActive = isDev || ['SIT_IN_PROGRESS', 'SIT_REVISION', 'UAT_REVISION_DEV', 'RETURN_TO_DEV'].includes(stUpper);
    const sitDone = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_PASSED', 'DEV_COMPLETED'].includes(stUpper);
    const uatUnlocked = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_PASSED', 'DEV_COMPLETED'].includes(stUpper);
    const uatActive = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT'].includes(stUpper);
    const uatDone = ['UAT_PASSED', 'DEV_COMPLETED'].includes(stUpper);
    const isComplete = stUpper === 'DEV_COMPLETED';


    // ── Completion check per step ──────────────────────────────────────────────
    const sit1Done = sitDone || (status === 'SIT_IN_PROGRESS' && activeSitStep > 1);
    const sit2Done = sitDone || (status === 'SIT_IN_PROGRESS' && activeSitStep > 2);
    const sit3Done = sitDone;
    const uat1Done = uatDone || (status === 'UAT_IN_PROGRESS' && activeUatStep > 1);
    const uat2Done = uatDone || (status === 'UAT_IN_PROGRESS' && activeUatStep > 2);
    const uat3Done = uatDone;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="p-5 space-y-5">

            {/* ─── Master Phase Stepper ─────────────────────────────────── */}
            <div className="bg-gradient-to-r from-[#003a73] to-[#1a56db] rounded-2xl p-5 text-white">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center border border-white/20">
                            <ShieldCheck size={22} className="text-emerald-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base">Verifikasi SIT &amp; UAT Internal</h3>
                            <p className="text-blue-200 text-xs">{sf(project?.id)} • {sf(project?.name)}</p>
                        </div>
                    </div>
                </div>


                {/* Phase progress bar */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {[
                        { label: 'Development', icon: <Server size={13} />, done: true },
                        { label: 'SIT Persiapan', icon: <BookOpen size={13} />, done: sit1Done },
                        { label: 'SIT Eksekusi', icon: <Bug size={13} />, done: sit2Done },
                        { label: 'SIT Sign-off', icon: <FileCheck size={13} />, done: sit3Done },
                        { label: 'UAT Skenario', icon: <ClipboardList size={13} />, done: uat1Done },
                        { label: 'UAT Eksekusi', icon: <UserCheck size={13} />, done: uat2Done },
                        { label: 'Persetujuan', icon: <CheckCircle2 size={13} />, done: uat3Done },
                        { label: 'DEV Completed', icon: <Lock size={13} />, done: isComplete },
                    ].map((ph, i, arr) => (
                        <div key={i} className="flex items-center gap-1 shrink-0">
                            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${ph.done ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200' : 'bg-white/10 border-white/20 text-white/60'}`}>
                                {ph.done ? <CheckCircle2 size={11} className="text-emerald-400" /> : ph.icon}
                                <span className="hidden sm:inline">{ph.label}</span>
                            </div>
                            {i < arr.length - 1 && <ChevronRight size={12} className="text-white/30 shrink-0" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── REVISION ALERTS ──────────────────────────────────────── */}
            {status === 'SIT_REVISION' && (
                <div className="p-4 bg-orange-50 border border-orange-300 rounded-2xl flex items-start gap-3">
                    <RotateCcw size={18} className="text-orange-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-orange-900 text-sm">SIT Memerlukan Revisi</p>
                        <p className="text-xs text-orange-800 mt-0.5">Proyek dikembalikan ke Development. Selesaikan revisi lalu mulai SIT kembali dari Tahap 1.</p>
                    </div>
                </div>
            )}
            {status === 'UAT_REVISION_SIT' && (
                <div className="p-4 bg-orange-50 border border-orange-300 rounded-2xl flex items-start gap-3">
                    <RotateCcw size={18} className="text-orange-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-orange-900 text-sm">UAT Memerlukan Ulang SIT</p>
                        <p className="text-xs text-orange-800 mt-0.5">Ditemukan issue integrasi saat UAT. Tim TI harus mengulangi SIT sebelum UAT dapat dilanjutkan.</p>
                    </div>
                </div>
            )}
            {status === 'UAT_REVISION_DEV' && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-2xl flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-red-900 text-sm">UAT Memerlukan Revisi Mayor ke Development</p>
                        <p className="text-xs text-red-800 mt-0.5">Issue kritis ditemukan saat UAT. Pengembangan harus diulang. SIT dan UAT akan dimulai dari awal.</p>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                                   SIT PANEL
                ═══════════════════════════════════════════════════════════════ */}
            <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${sitDone ? 'border-teal-200' : sitActive ? 'border-sky-300' : 'border-gray-200'}`}>
                {/* SIT Panel Header */}
                <div className={`px-5 py-4 flex items-center justify-between ${sitDone ? 'bg-teal-50' : sitActive ? 'bg-sky-50' : 'bg-gray-50'} border-b`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sitDone ? 'bg-teal-600 text-white' : sitActive ? 'bg-sky-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            <Server size={18} />
                        </div>
                        <div>
                            <h4 className={`font-bold text-sm ${sitDone ? 'text-teal-900' : sitActive ? 'text-sky-900' : 'text-gray-600'}`}>
                                FASE 1: System Integration Testing (SIT)
                            </h4>
                            <p className="text-xs text-gray-500">Verifikasi integrasi sistem, API, dan database secara teknis</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {sitDone && <span className="px-3 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full border border-teal-300">✅ LULUS</span>}
                        {status === 'SIT_IN_PROGRESS' && <span className="px-3 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-full border border-sky-300 animate-pulse">🔄 BERLANGSUNG</span>}
                        {['SIT_REVISION', 'UAT_REVISION_DEV'].includes(status) && <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-300">↩️ REVISI</span>}
                    </div>
                </div>

                {/* SIT not started */}
                {(!sitDone && stUpper !== 'SIT_IN_PROGRESS') && (
                    <div className="p-6">
                        <RevisionBanner revisions={revisions} type="SIT_TO_DEV" />
                        <RevisionBanner revisions={revisions} type="UAT_TO_DEV" />
                        <div className="text-center py-4">
                            <Server size={36} className="mx-auto text-sky-400 mb-3" />
                            <p className="text-sm font-semibold text-gray-700 mb-1">
                                {['SIT_REVISION', 'UAT_REVISION_DEV'].includes(stUpper) ? 'Siap untuk memulai ulang SIT?' : 'Pengembangan selesai? Mulai SIT sekarang.'}
                            </p>
                            <p className="text-xs text-gray-500 mb-4">Pastikan environment staging sudah siap dan test plan sudah disiapkan.</p>
                            <button
                                onClick={handleStartSIT}
                                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 mx-auto"
                            >
                                <ArrowRight size={16} /> Mulai Pengujian SIT
                            </button>
                        </div>
                    </div>
                )}

                {/* SIT Active or Done */}
                {(stUpper === 'SIT_IN_PROGRESS' || sitDone) && (

                    <div>
                        {/* Sub-step tabs */}
                        <div className="flex border-b border-gray-100 bg-gray-50/50 px-3 overflow-x-auto">
                            {SIT_STEPS.map(step => (
                                <StepTab
                                    key={step.id}
                                    step={step}
                                    isActive={activeSitStep === step.id}
                                    isCompleted={step.id === 1 ? sit1Done : step.id === 2 ? sit2Done : sit3Done}
                                    onClick={() => (sitDone || step.id <= activeSitStep) && setActiveSitStep(step.id)}
                                />
                            ))}
                        </div>

                        {/* ── SIT Step 1: Persiapan ──────────────────────── */}
                        {activeSitStep === 1 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <BookOpen size={16} className="text-blue-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 1: Persiapan &amp; Test Plan SIT</h5>
                                    {sit1Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">URL Environment Staging / Testing *</label>
                                        <input type="text" value={sit1.stagingUrl} onChange={e => setSit1(p => ({...p, stagingUrl: e.target.value}))}
                                            placeholder="https://staging.banknagari.co.id" disabled={sitDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:border-sky-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Versi / Environment yang Diuji *</label>
                                        <input type="text" value={sit1.testEnv} onChange={e => setSit1(p => ({...p, testEnv: e.target.value}))}
                                            placeholder="Contoh: v1.2.3-staging / PostgreSQL 14" disabled={sitDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Jumlah Skenario Uji SIT</label>
                                        <input type="number" value={sit1.scenarioCount} onChange={e => setSit1(p => ({...p, scenarioCount: e.target.value}))}
                                            placeholder="Contoh: 45" disabled={sitDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Persiapan</label>
                                        <input type="text" value={sit1.prepNotes} onChange={e => setSit1(p => ({...p, prepNotes: e.target.value}))}
                                            placeholder="Keterangan tambahan..." disabled={sitDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Test Plan SIT</label>
                                        {!sitDone && (
                                            <label className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors">
                                                <Upload size={12} /> Upload
                                                <input type="file" ref={sit1FileRef} multiple accept=".pdf,.docx,.xlsx" onChange={e => onUpload(e, setSit1, 'docs', 'SIT_PREP')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={sit1.docs} onRemove={i => onRemoveDoc(setSit1, i)} readOnly={sitDone} />
                                </div>
                                {!sitDone && status === 'SIT_IN_PROGRESS' && activeSitStep === 1 && (
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => handleSaveSITStep(1)} disabled={!sit1.stagingUrl || !sit1.testEnv}
                                            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer">
                                            Simpan &amp; Lanjut Eksekusi <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SIT Step 2: Eksekusi ──────────────────────── */}
                        {activeSitStep === 2 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Bug size={16} className="text-indigo-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 2: Eksekusi Test Cases &amp; Defect Log</h5>
                                    {sit2Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Total Test Cases *</label>
                                        <input type="number" value={sit2.totalCases} onChange={e => setSit2(p => ({...p, totalCases: e.target.value}))}
                                            placeholder="Contoh: 45" disabled={sitDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Test Cases Lulus *</label>
                                        <input type="number" value={sit2.passedCases} onChange={e => setSit2(p => ({...p, passedCases: e.target.value}))}
                                            placeholder="Contoh: 43" disabled={sitDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Jumlah Defect Ditemukan</label>
                                        <input type="number" value={sit2.defects} onChange={e => setSit2(p => ({...p, defects: e.target.value}))}
                                            placeholder="Contoh: 2" disabled={sitDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                </div>
                                {sit2.totalCases && sit2.passedCases && (
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-3 text-xs">
                                        <Info size={14} className="text-indigo-500 shrink-0" />
                                        <span className="text-indigo-800 font-semibold">
                                            Pass Rate: {Math.round((Number(sit2.passedCases) / Number(sit2.totalCases)) * 100)}%
                                            {Math.round((Number(sit2.passedCases) / Number(sit2.totalCases)) * 100) >= 90
                                                ? ' ✅ Memenuhi Threshold (≥90%)' : ' ⚠️ Di bawah threshold — pertimbangkan revisi'}
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Ringkasan Hasil Eksekusi &amp; Temuan</label>
                                    <textarea rows={3} value={sit2.execNotes} onChange={e => setSit2(p => ({...p, execNotes: e.target.value}))}
                                        placeholder="Ringkasan hasil testing: apa yang berhasil, apa yang gagal, tindak lanjut defect..." disabled={sitDone}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Hasil Test Cases &amp; Screenshot Bukti</label>
                                        {!sitDone && (
                                            <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors">
                                                <Upload size={12} /> Upload
                                                <input type="file" ref={sit2FileRef} multiple onChange={e => onUpload(e, setSit2, 'docs', 'SIT_EXEC')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={sit2.docs} onRemove={i => onRemoveDoc(setSit2, i)} readOnly={sitDone} />
                                </div>
                                {!sitDone && status === 'SIT_IN_PROGRESS' && activeSitStep === 2 && (
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => handleSaveSITStep(2)} disabled={!sit2.totalCases || !sit2.passedCases}
                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer">
                                            Simpan &amp; Lanjut Review <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SIT Step 3: Sign-off ─────────────────────── */}
                        {activeSitStep === 3 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileCheck size={16} className="text-teal-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 3: Review Akhir &amp; Keputusan SIT</h5>
                                    {sit3Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>
                                {/* Summary card */}
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs space-y-2">
                                    <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">Ringkasan Hasil SIT</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Staging URL', val: sit1.stagingUrl || '-' },
                                            { label: 'Environment', val: sit1.testEnv || '-' },
                                            { label: 'Total Test Cases', val: sit2.totalCases || '-' },
                                            { label: 'Lulus / Defect', val: `${sit2.passedCases || '-'} / ${sit2.defects || '0'}` },
                                        ].map(s => (
                                            <div key={s.label} className="bg-white rounded-lg p-2.5 border border-slate-200">
                                                <p className="text-slate-500 text-[9px] font-bold uppercase">{s.label}</p>
                                                <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">{s.val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Review Akhir &amp; Rekomendasi Dev Lead *</label>
                                    <textarea rows={3} value={sit3.reviewNotes} onChange={e => setSit3(p => ({...p, reviewNotes: e.target.value}))}
                                        placeholder="Tuliskan kesimpulan review SIT, apakah semua defect sudah ditangani, rekomendasi ke depan..." disabled={sitDone}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-teal-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Laporan &amp; Rekomendasi SIT Final</label>
                                        {!sitDone && (
                                            <label className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors">
                                                <Upload size={12} /> Upload
                                                <input type="file" ref={sit3FileRef} multiple accept=".pdf,.docx" onChange={e => onUpload(e, setSit3, 'docs', 'SIT_SIGNOFF')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={sit3.docs} onRemove={i => onRemoveDoc(setSit3, i)} readOnly={sitDone} />
                                </div>
                                {/* Action buttons */}
                                {!sitDone && status === 'SIT_IN_PROGRESS' && activeSitStep === 3 && (
                                    <div className="flex flex-col sm:flex-row gap-3 justify-between pt-2 border-t border-gray-100">
                                        <button
                                            onClick={() => { setRevisionType('SIT_TO_DEV'); setShowRevisionModal(true); }}
                                            className="px-5 py-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                                        >
                                            <RotateCcw size={14} /> SIT Perlu Revisi — Kembalikan ke Dev
                                        </button>
                                        <button
                                            onClick={handleSITPass}
                                            disabled={submitting || !sit3.reviewNotes}
                                            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer active:scale-95"
                                        >
                                            <CheckCircle2 size={14} /> SIT Lulus — Lanjut ke UAT Internal
                                        </button>
                                    </div>
                                )}
                                {sitDone && (
                                    <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800">
                                        <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                                        <span className="font-semibold">SIT telah diverifikasi dan dinyatakan LULUS. UAT Internal dapat dimulai.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                                   UAT PANEL
                ═══════════════════════════════════════════════════════════════ */}
            <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${uatDone ? 'border-emerald-200' : uatActive ? 'border-amber-300' : uatUnlocked ? 'border-amber-200' : 'border-gray-200 opacity-60'}`}>
                {/* UAT Panel Header */}
                <div className={`px-5 py-4 flex items-center justify-between border-b ${uatDone ? 'bg-emerald-50' : uatActive ? 'bg-amber-50' : uatUnlocked ? 'bg-amber-50/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${uatDone ? 'bg-emerald-600 text-white' : uatActive ? 'bg-amber-500 text-white' : uatUnlocked ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            <CheckSquare size={18} />
                        </div>
                        <div>
                            <h4 className={`font-bold text-sm ${uatDone ? 'text-emerald-900' : uatActive ? 'text-amber-900' : uatUnlocked ? 'text-amber-800' : 'text-gray-500'}`}>
                                FASE 2: User Acceptance Testing (UAT) Internal
                            </h4>
                            <p className="text-xs text-gray-500">Verifikasi fungsional bisnis oleh PM &amp; perwakilan Divisi Peminta</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {uatDone && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-300">✅ LULUS</span>}
                        {uatActive && status !== 'SIT_PASSED' && <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-300 animate-pulse">🔄 BERLANGSUNG</span>}
                        {!uatUnlocked && <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full border border-gray-200">🔒 Tunggu SIT Lulus</span>}
                        {['UAT_REVISION_SIT', 'UAT_REVISION_DEV'].includes(status) && <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-300">↩️ REVISI</span>}
                    </div>
                </div>

                {/* Locked state */}
                {!uatUnlocked && (
                    <div className="p-8 text-center text-gray-400">
                        <Lock size={32} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm font-semibold">UAT Internal terkunci</p>
                        <p className="text-xs mt-1">Selesaikan &amp; verifikasi SIT terlebih dahulu untuk membuka fase ini.</p>
                    </div>
                )}

                {/* UAT ready to start */}
                {status === 'SIT_PASSED' && (
                    <div className="p-6 text-center">
                        <CheckSquare size={36} className="mx-auto text-amber-400 mb-3" />
                        <p className="text-sm font-semibold text-gray-700 mb-1">SIT telah lulus! Siap memulai UAT Internal.</p>
                        <p className="text-xs text-gray-500 mb-4">Pastikan PM dan perwakilan Divisi Peminta sudah siap untuk pengujian fungsional bisnis.</p>
                        <button
                            onClick={handleStartUAT}
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 mx-auto"
                        >
                            <ArrowRight size={16} /> Mulai UAT Internal
                        </button>
                    </div>
                )}

                {/* UAT Revision from UAT back to SIT */}
                {status === 'UAT_REVISION_SIT' && (
                    <div className="p-6 text-center">
                        <RevisionBanner revisions={revisions} type="UAT_TO_SIT" />
                        <p className="text-sm font-semibold text-gray-700 mb-4">Selesaikan revisi SIT, lalu mulai ulang UAT.</p>
                        <button onClick={handleStartUAT} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 mx-auto">
                            <ArrowRight size={16} /> Mulai Ulang UAT Internal
                        </button>
                    </div>
                )}

                {/* UAT Active or Done */}
                {(status === 'UAT_IN_PROGRESS' || uatDone) && (
                    <div>
                        {/* Sub-step tabs */}
                        <div className="flex border-b border-gray-100 bg-gray-50/50 px-3 overflow-x-auto">
                            {UAT_STEPS.map(step => (
                                <StepTab
                                    key={step.id}
                                    step={step}
                                    isActive={activeUatStep === step.id}
                                    isCompleted={step.id === 1 ? uat1Done : step.id === 2 ? uat2Done : uat3Done}
                                    onClick={() => (uatDone || step.id <= activeUatStep) && setActiveUatStep(step.id)}
                                />
                            ))}
                        </div>

                        {/* ── UAT Step 1: Skenario ──────────────────────── */}
                        {activeUatStep === 1 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <ClipboardList size={16} className="text-amber-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 1: Persiapan Skenario UAT</h5>
                                    {uat1Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Daftar Skenario UAT Bisnis *</label>
                                        <textarea rows={3} value={uat1.scenarioList} onChange={e => setUat1(p => ({...p, scenarioList: e.target.value}))}
                                            placeholder="1. Login dan autentikasi pengguna&#10;2. Proses transaksi transfer&#10;3. ..." disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Disiapkan Oleh (PM / User) *</label>
                                        <input type="text" value={uat1.preparedBy} onChange={e => setUat1(p => ({...p, preparedBy: e.target.value}))}
                                            placeholder="Nama PM / Perwakilan Divisi" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Persiapan UAT</label>
                                        <input type="text" value={uat1.prepNotes} onChange={e => setUat1(p => ({...p, prepNotes: e.target.value}))}
                                            placeholder="Keterangan tambahan..." disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Skenario UAT / Use Case Matrix</label>
                                        {!uatDone && (
                                            <label className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors">
                                                <Upload size={12} /> Upload
                                                <input type="file" ref={uat1FileRef} multiple onChange={e => onUpload(e, setUat1, 'docs', 'UAT_PREP')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={uat1.docs} onRemove={i => onRemoveDoc(setUat1, i)} readOnly={uatDone} />
                                </div>
                                {!uatDone && status === 'UAT_IN_PROGRESS' && activeUatStep === 1 && (
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => handleSaveUATStep(1)} disabled={!uat1.scenarioList || !uat1.preparedBy}
                                            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer">
                                            Simpan &amp; Lanjut Eksekusi UAT <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── UAT Step 2: Eksekusi ─────────────────────── */}
                        {activeUatStep === 2 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <UserCheck size={16} className="text-orange-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 2: Eksekusi UAT Internal &amp; Temuan</h5>
                                    {uat2Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Skenario Dieksekusi *</label>
                                        <input type="number" value={uat2.executedCount} onChange={e => setUat2(p => ({...p, executedCount: e.target.value}))}
                                            placeholder="Contoh: 20" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Skenario Diterima *</label>
                                        <input type="number" value={uat2.passedCount} onChange={e => setUat2(p => ({...p, passedCount: e.target.value}))}
                                            placeholder="Contoh: 19" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Temuan / CR</label>
                                        <input type="number" value={uat2.findings} onChange={e => setUat2(p => ({...p, findings: e.target.value}))}
                                            placeholder="Contoh: 1" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Hasil UAT &amp; Temuan Detail</label>
                                    <textarea rows={3} value={uat2.execNotes} onChange={e => setUat2(p => ({...p, execNotes: e.target.value}))}
                                        placeholder="Catatan hasil pengujian, temuan bug/CR, status perbaikan..." disabled={uatDone}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Bukti Eksekusi UAT &amp; Sign-off Sheet</label>
                                        {!uatDone && (
                                            <label className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors">
                                                <Upload size={12} /> Upload
                                                <input type="file" ref={uat2FileRef} multiple onChange={e => onUpload(e, setUat2, 'docs', 'UAT_EXEC')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={uat2.docs} onRemove={i => onRemoveDoc(setUat2, i)} readOnly={uatDone} />
                                </div>
                                {!uatDone && status === 'UAT_IN_PROGRESS' && activeUatStep === 2 && (
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => handleSaveUATStep(2)} disabled={!uat2.executedCount || !uat2.passedCount}
                                            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer">
                                            Simpan &amp; Lanjut Persetujuan Final <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── UAT Step 3: Persetujuan Final ────────────── */}
                        {activeUatStep === 3 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 3: Persetujuan Final &amp; Penerbitan BAST</h5>
                                    {uat3Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>
                                {/* UAT Summary */}
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs space-y-2">
                                    <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">Ringkasan Hasil UAT</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Disiapkan Oleh', val: uat1.preparedBy || '-' },
                                            { label: 'Skenario Dieksekusi', val: uat2.executedCount || '-' },
                                            { label: 'Diterima', val: uat2.passedCount || '-' },
                                            { label: 'Temuan', val: uat2.findings || '0' },
                                        ].map(s => (
                                            <div key={s.label} className="bg-white rounded-lg p-2.5 border border-slate-200">
                                                <p className="text-slate-500 text-[9px] font-bold uppercase">{s.label}</p>
                                                <p className="font-bold text-slate-800 text-xs mt-0.5">{s.val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Persetujuan Final *</label>
                                        <textarea rows={2} value={uat3.approvalNotes} onChange={e => setUat3(p => ({...p, approvalNotes: e.target.value}))}
                                            placeholder="Pernyataan persetujuan: semua skenario bisnis telah diverifikasi dan dinyatakan memenuhi kebutuhan FSD..." disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Disetujui Oleh (PM + Perwakilan Divisi) *</label>
                                        <input type="text" value={uat3.approvedBy} onChange={e => setUat3(p => ({...p, approvedBy: e.target.value}))}
                                            placeholder="Nama PM, Nama Perwakilan Divisi" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Form Persetujuan &amp; Tanda Tangan Digital</label>
                                        {!uatDone && (
                                            <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors">
                                                <Upload size={12} /> Upload
                                                <input type="file" ref={uat3FileRef} multiple accept=".pdf,.docx" onChange={e => onUpload(e, setUat3, 'docs', 'UAT_APPROVAL')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={uat3.docs} onRemove={i => onRemoveDoc(setUat3, i)} readOnly={uatDone} />
                                </div>
                                {/* Action buttons */}
                                {!uatDone && status === 'UAT_IN_PROGRESS' && activeUatStep === 3 && (
                                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <button
                                                onClick={() => { setRevisionType('UAT_TO_SIT'); setShowRevisionModal(true); }}
                                                className="flex-1 px-4 py-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                <RotateCcw size={13} /> Revisi Minor — Ulang SIT
                                            </button>
                                            <button
                                                onClick={() => { setRevisionType('UAT_TO_DEV'); setShowRevisionModal(true); }}
                                                className="flex-1 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                <AlertTriangle size={13} /> Revisi Mayor — Kembali ke Dev
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleUATPass}
                                            disabled={submitting || !uat3.approvalNotes || !uat3.approvedBy}
                                            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
                                        >
                                            <Send size={16} /> UAT Lulus — Tetapkan DEV_COMPLETED &amp; Lanjut ke QA / Siber
                                        </button>
                                    </div>
                                )}
                                {uatDone && (
                                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                                        <Lock size={16} className="text-emerald-600 shrink-0" />
                                        <span className="font-semibold">UAT Internal selesai. Proyek berstatus DEV_COMPLETED dan siap diajukan ke QA &amp; Siber.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                              COMPLETION CARD
                ═══════════════════════════════════════════════════════════════ */}
            {isComplete && (
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 border border-white/30">
                            <Lock size={24} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-lg">🎉 Pengujian SIT &amp; UAT Internal Selesai — DEV COMPLETED!</h4>
                            <p className="text-emerald-100 text-xs mt-1 leading-relaxed">
                                Proyek <strong>{sf(project?.name)}</strong> telah lulus seluruh pengujian SIT &amp; UAT Internal.
                                Source code dibekukan (<em>code freeze</em>). Silakan ajukan proyek ke pengujian independen QA &amp; Pentest Siber.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <button
                                    onClick={() => navigate?.('/pm/qa-request')}
                                    className="px-5 py-2 bg-white text-emerald-700 font-bold text-xs rounded-xl hover:bg-emerald-50 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                                >
                                    <ArrowRight size={13} /> Ajukan ke QA Testing
                                </button>
                                <button
                                    onClick={() => navigate?.('/pm/cyber-request')}
                                    className="px-5 py-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <ArrowRight size={13} /> Ajukan ke Pentest Siber
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* ─── Audit Trail Revisi ───────────────────────────────────── */}
            {revisions.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Clock size={13} /> Riwayat Revisi ({revisions.length})
                    </h4>
                    <div className="space-y-2">
                        {revisions.map((rev, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100 text-xs">
                                <RotateCcw size={13} className="text-orange-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-orange-900">
                                        {rev.type === 'SIT_TO_DEV' ? 'SIT → Revisi ke Dev' : rev.type === 'UAT_TO_SIT' ? 'UAT → Ulang SIT' : 'UAT → Revisi ke Dev'}
                                        <span className="ml-2 font-normal text-orange-600">• {fmtDate(rev.at)}</span>
                                    </p>
                                    <p className="text-orange-800 mt-0.5">{rev.notes}</p>
                                    <p className="text-orange-500 mt-0.5">Oleh: {rev.by}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Revision Modal ───────────────────────────────────────── */}
            {showRevisionModal && (
                <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                                <AlertTriangle size={20} className="text-orange-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-base">
                                    {revisionType === 'SIT_TO_DEV' && 'Konfirmasi Revisi SIT → Development'}
                                    {revisionType === 'UAT_TO_SIT' && 'Konfirmasi Revisi UAT → Ulang SIT'}
                                    {revisionType === 'UAT_TO_DEV' && 'Konfirmasi Revisi UAT → Development (Mayor)'}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {revisionType === 'SIT_TO_DEV' && 'Proyek akan dikembalikan ke tim Development.'}
                                    {revisionType === 'UAT_TO_SIT' && 'Tim TI harus mengulangi SIT sebelum UAT dilanjutkan.'}
                                    {revisionType === 'UAT_TO_DEV' && 'Pengembangan ulang diperlukan. SIT dan UAT akan diulang dari awal.'}
                                </p>
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                Catatan Revisi / Alasan Penolakan <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={4}
                                value={revisionNotes}
                                onChange={e => setRevisionNotes(e.target.value)}
                                placeholder="Jelaskan secara detail apa yang perlu diperbaiki, defect apa yang ditemukan, dan kriteria apa yang harus dipenuhi sebelum pengujian ulang..."
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-orange-500 resize-none"
                                autoFocus
                            />
                            {!revisionNotes.trim() && <p className="text-xs text-red-500 mt-1">Catatan revisi wajib diisi.</p>}
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => { setShowRevisionModal(false); setRevisionNotes(''); }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer">
                                Batal
                            </button>
                            <button
                                onClick={revisionType === 'SIT_TO_DEV' ? handleSITRevision : handleUATRevision}
                                disabled={!revisionNotes.trim() || submitting}
                                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                                Konfirmasi &amp; Kirim Revisi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}



