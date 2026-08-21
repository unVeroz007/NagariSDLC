// src/components/SITUATWizard.jsx
// Wizard Multi-Step SIT & UAT Internal untuk Proyek Bank Nagari (Versi Refactored)
//
// Business logic yang diterapkan:
//  1) Gatekeeper SIT: SIT awal memakai semua task aktif; SIT ulang UAT Mayor hanya
//     memakai task Change Request pada scope siklus aktif. TAKE DOWN selalu diabaikan.
//  2) Alur revisi task terintegrasi: PM dapat mengembalikan task ke developer (status →
//     in_progress) lengkap dengan catatan/arahan revisi, tersimpan & tampil di board developer.
//  3) Tab "Eksekusi Pengujian" menampilkan task sesuai scope SIT, tiap baris punya
//     checkbox OK, kolom komentar/temuan, dan tombol Kembalikan/Revisi.
//  4) Lanjut ke "Review & Sign-Off" / UAT hanya jika semua task dalam scope dicentang OK.
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
    ShieldCheck, Server, CheckSquare, Lock, CheckCircle2,
    Upload, X, FileText, ArrowRight, ArrowLeft, AlertTriangle,
    RotateCcw, Send, Paperclip, Info, ChevronRight, Clock,
    Eye, Download, Printer, Building2, ClipboardList, Bug,
    UserCheck, FileCheck, BookOpen, Users, Trash2, Plus, Check, Edit, Save, RefreshCw, Link2
} from 'lucide-react';
import { generateDocumentName, getDocumentTypeInfo, formatFileSize } from '../utils/documentNaming';
import { taskService, projectService, documentService, userService } from '../services/api';
import SITTaskExecution from './SITTaskExecution';
import DocumentViewerModal from './DocumentViewerModal';

// ─── Helper: safely render object or string field ────────────────────────────
const sf = (val, fb = '-') => {
    if (!val) return fb;
    if (typeof val === 'object') return String(val.name || val.label || val.initial || fb);
    return String(val);
};

// ─── Helper: format timestamp ────────────────────────────────────────────────
const fmtDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Format yang diterima backend untuk verifikasi link: 08..., 8..., atau +62...
// Nilai hanya dinormalisasi untuk validasi; input asli tetap ditampilkan kepada PM.
const normalizeIndonesianPhone = (value) => {
    let digits = String(value || '').replace(/\D+/g, '');
    if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
    if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
    if (digits.startsWith('8')) digits = `62${digits}`;
    return /^62[0-9]{8,13}$/.test(digits) ? digits : null;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const SIT_STATUSES = ['IN_DEVELOPMENT', 'SIT_IN_PROGRESS', 'SIT_REVISION', 'RETURN_TO_DEV'];
const UAT_STATUSES = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_REVISION_DEV'];
const DONE_STATUSES = ['DEV_COMPLETED'];
const SIT_SIGN_OFF_DOCUMENT_TYPES = ['SIT_RESULT', 'SIT_SIGNOFF'];
const UAT_PREPARATION_DOCUMENT_TYPES = ['UNDANGAN', 'UAT_PLAN', 'LAMPIRAN', 'LAINNYA'];
const UAT_APPROVAL_ROLES = [
    { value: 'requester', label: 'Pemohon Proyek', side: 'requester' },
    { value: 'requester_group_lead', label: 'Pimpinan Grup Pemohon', side: 'requester' },
    { value: 'requester_division_lead', label: 'Pimpinan Divisi Pemohon', side: 'requester' },
    { value: 'developer', label: 'Developer', side: 'it' },
    { value: 'analyst_pm', label: 'Analyst / Project Manager', side: 'it' },
    { value: 'development_group_lead', label: 'Pimpinan Grup Pengembangan', side: 'it' },
    { value: 'technology_division_lead', label: 'Pimpinan Divisi Teknologi dan Digitalisasi', side: 'it' },
];
const REQUIRED_SINGLE_UAT_APPROVAL_ROLES = UAT_APPROVAL_ROLES
    .filter(role => role.value !== 'developer')
    .map(role => role.value);
const UAT_INTERNAL_ACCOUNT_ROLES = {
    developer: ['developer'],
    analyst_pm: ['project_manager', 'dev_analyst', 'analyst'],
    development_group_lead: ['development_lead', 'lead_group'],
    technology_division_lead: ['head_of_it'],
};

const participantId = () => globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;

const buildUatExecutionScenarios = (savedScenarios, tasks, savedAdditionalRequests = []) => {
    const additionalRequestTaskIds = new Set(
        (Array.isArray(savedAdditionalRequests) ? savedAdditionalRequests : [])
            .map(item => Number(item?.taskId))
            .filter(Boolean)
    );
    const savedByTask = new Map(
        (Array.isArray(savedScenarios) ? savedScenarios : [])
            .filter(item => item?.taskId != null)
            .map(item => [Number(item.taskId), item])
    );

    return (Array.isArray(tasks) ? tasks : [])
        .filter(task => String(task.status || '').toLowerCase() !== 'take_down'
            && !additionalRequestTaskIds.has(Number(task.id)))
        .map(task => {
            const saved = savedByTask.get(Number(task.id));
            return {
                id: saved?.id || `task_${task.id}`,
                taskId: Number(task.id),
                scenario: saved?.scenario || task.title || task.name || `Task ${task.id}`,
                result: saved?.result || '',
                changeType: saved?.changeType || '',
                request: saved?.request || '',
                comment: saved?.comment || '',
                attachments: Array.isArray(saved?.attachments) ? saved.attachments : [],
                verificationStatus: saved?.verificationStatus || null,
                verificationResult: saved?.verificationResult || '',
                verificationComment: saved?.verificationComment || '',
                verificationAttachments: Array.isArray(saved?.verificationAttachments)
                    ? saved.verificationAttachments
                    : [],
            };
        });
};

const buildUatAdditionalRequests = (savedRequests) => (
    Array.isArray(savedRequests) ? savedRequests : []
).map(request => ({
    id: request.id || `uat_request_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title: request.title || '',
    changeType: request.changeType || '',
    detail: request.detail || '',
    comment: request.comment || '',
    attachments: Array.isArray(request.attachments) ? request.attachments : [],
    taskId: request.taskId || null,
    verificationStatus: request.verificationStatus || null,
    verificationResult: request.verificationResult || '',
    verificationComment: request.verificationComment || '',
    verificationAttachments: Array.isArray(request.verificationAttachments)
        ? request.verificationAttachments
        : [],
}));

// 🔓 MODE PEMERIKSAAN/UNLOCK: bila true, seluruh tahapan SIT & UAT dapat dibuka
// dan diedit tanpa terkunci status proyek (untuk keperluan cek/testing/development).
// Set false untuk kembali ke alur terkunci normal.
const UNLOCK_ALL_STAGES = true;

// ─── Sub-step definitions ────────────────────────────────────────────────────
const SIT_STEPS = [
    { id: 1, title: 'Persiapan SIT', icon: <BookOpen size={15} />, desc: 'Environment & Skenario', color: 'blue' },
    { id: 2, title: 'Eksekusi Pengujian', icon: <Bug size={15} />, desc: 'Persetujuan Task & Defect Log', color: 'indigo' },
    { id: 3, title: 'Review & Sign-Off', icon: <FileCheck size={15} />, desc: 'Verifikasi & Keputusan', color: 'teal' },
];
const UAT_STEPS = [
    { id: 1, title: 'Persiapan Skenario UAT', icon: <ClipboardList size={15} />, desc: 'Skenario Bisnis & Peserta', color: 'amber' },
    { id: 2, title: 'Eksekusi UAT Internal', icon: <UserCheck size={15} />, desc: 'Pengujian Fungsi & Temuan', color: 'orange' },
    { id: 3, title: 'Persetujuan Final', icon: <CheckCircle2 size={15} />, desc: 'Sign-off & Terbitkan BAST', color: 'emerald' },
];

// ─── File Upload Helper ─────────────────────────────────────────────────────
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

// ─── DocList ────────────────────────────────────────────────────────────────
// Menampilkan daftar dokumen dengan:
//  - dropdown PILIHAN TIPE FILE (di-masking sesuai format XXX/GPTD/TIPE/...)
//  - tombol Lihat / Unduh / Hapus
function DocList({ docs, onRemove, onView, onDownload, onTypeChange, docTypeOptions, readOnly = false, allowTypeChange = true }) {
    if (!docs?.length) return (
        <div className="mt-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-center text-gray-400 text-xs">
            <FileText size={20} className="mx-auto mb-1 text-gray-300" />
            Belum ada berkas dilampirkan
        </div>
    );
    return (
        <div className="mt-2 space-y-2">
            {docs.map((doc, i) => (
                <div key={doc.id || i} className={`p-2.5 bg-gray-50 rounded-xl border transition-all ${doc.color ? `border-transparent` : 'border-gray-100'} hover:border-blue-200 group`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[9px] shrink-0 ${doc.color || 'bg-blue-100 text-blue-600'}`}>
                            {doc.type || 'DOC'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{doc.originalName}</p>
                            <p className="text-[10px] text-gray-400 truncate font-mono">
                                <span className="text-amber-700">→ {doc.maskedName || doc.name}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {(doc.docId || doc.url) && (
                                <>
                                    <button onClick={() => onView?.(doc)} title="Lihat"
                                        className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer">
                                        <Eye size={14} />
                                    </button>
                                    <button onClick={() => onDownload?.(doc)} title="Unduh"
                                        className="p-1.5 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer">
                                        <Download size={14} />
                                    </button>
                                </>
                            )}
                            {!readOnly && (
                                <button onClick={() => onRemove?.(i)} title="Hapus"
                                    className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Tipe:</label>
                        <select
                            value={doc.doc_type || 'LAINNYA'}
                            onChange={(e) => onTypeChange?.(i, e.target.value)}
                            disabled={readOnly || !allowTypeChange}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-[10px] font-bold text-gray-700 focus:ring-2 focus:ring-[#00529C] outline-none cursor-pointer disabled:bg-gray-100"
                        >
                            {(docTypeOptions || []).map(([code, label]) => (
                                <option key={code} value={code}>{label}</option>
                            ))}
                        </select>
                        {doc.isUploading && <span className="text-[10px] text-gray-400 flex items-center gap-1"><span className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" /> Mengunggah...</span>}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── RevisionBanner ─────────────────────────────────────────────────────────
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

// ─── StepTab ────────────────────────────────────────────────────────────────
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

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function SITUATWizard({ project, updateProject, addNotification, navigate, refreshProject, isViewer = false, initialUatStep = null }) {
    const status = project?.status || 'IN_DEVELOPMENT';
    const sitUatData = project?.sitUatData || {};
    const { user } = useAuth();
    const sitRetestCycle = Number(sitUatData.uat_hold?.cycle || 0);
    const isTargetedSitRetest = sitUatData.uat2_resume_after_sit === true && sitRetestCycle > 0;
    const sitRetestTaskIds = useMemo(() => {
        if (!isTargetedSitRetest) return [];

        const savedScope = sitUatData.sit_retest_scope || {};
        const scopedIds = Number(savedScope.cycle || 0) === sitRetestCycle
            ? (savedScope.taskIds || [])
            : [];
        const fallbackIds = (sitUatData.uat_change_requests || [])
            .filter(request => request.type === 'mayor' && Number(request.cycle || 0) === sitRetestCycle)
            .map(request => request.taskId);

        return [...new Set((scopedIds.length > 0 ? scopedIds : fallbackIds)
            .map(Number)
            .filter(Boolean))];
    }, [isTargetedSitRetest, sitRetestCycle, sitUatData.sit_retest_scope, sitUatData.uat_change_requests]);
    const sitRetestTaskIdSet = useMemo(() => new Set(sitRetestTaskIds), [sitRetestTaskIds]);
    const sitScopeTasks = useMemo(() => {
        const tasks = Array.isArray(project?.tasks) ? project.tasks : [];

        return tasks.filter(task => String(task.status || '').toLowerCase() !== 'take_down'
            && (!isTargetedSitRetest || sitRetestTaskIdSet.has(Number(task.id))));
    }, [isTargetedSitRetest, project?.tasks, sitRetestTaskIdSet]);

    // Role user saat ini → apakah dia pemegang hak approval SIT.
    // PM (dev_analyst / project_manager) = Analyst Pengembangan.
    const currentRoleKey = ['developer', 'development_lead'].includes(user?.role)
        ? user.role
        : (['dev_analyst', 'project_manager'].includes(user?.role) ? 'pm' : null);
    // Approval SIT dari role (disimpan di sitUatData.sit3_approvals)
    const sit3Approvals = sitUatData.sit3_approvals || {};

    // Jumlah developer (assignee task unik) yang harus approve
    const requiredDeveloperIds = useMemo(() => (
        [...new Set(
            sitScopeTasks
                .map(t => t.assignee_id ?? t.assignee_detail?.id)
                .filter(id => id != null)
                .map(id => Number(id))
        )]
    ), [sitScopeTasks]);
    const requiredDeveloperCount = requiredDeveloperIds.length;

    // Jumlah developer yang sudah approve
    const approvedDeveloperCount = useMemo(() => {
        const devList = sit3Approvals?.developer?.developers || [];
        const requiredIdSet = new Set(requiredDeveloperIds);
        return devList.filter(approval => requiredIdSet.has(Number(
            approval.userId ?? approval.approvedById
        ))).length;
    }, [requiredDeveloperIds, sit3Approvals?.developer?.developers]);
    const isCurrentUserRequiredDeveloper = user?.role === 'developer'
        && requiredDeveloperIds.includes(Number(user?.id));
    const hasCurrentDeveloperApproved = (sit3Approvals?.developer?.developers || []).some(
        approval => Number(approval.userId ?? approval.approvedById) === Number(user?.id)
    );

    // Semua approval lengkap: semua developer + PM (Analyst Pengembangan) + development_lead
    const devApproved = requiredDeveloperCount > 0 && approvedDeveloperCount >= requiredDeveloperCount;
    const allSitApproved = devApproved
        && sit3Approvals?.pm?.approved === true
        && sit3Approvals?.development_lead?.approved === true;

    // ── State ─────────────────────────────────────────────────────────────
    const [activeSitStep, setActiveSitStep] = useState(sitUatData.activeSitStep || 1);
    const [activeUatStep, setActiveUatStep] = useState(() => {
        const requestedStep = Number(initialUatStep);
        return [1, 2, 3].includes(requestedStep) ? requestedStep : (sitUatData.activeUatStep || 1);
    });

    // SIT Step 1 data
    const [sit1, setSit1] = useState({
        stagingUrl: sitUatData.sit1_stagingUrl || '',
    });
    // ── Normalisasi approvals: selalu object keyed by taskId (hindari array/index) ──
    // Data lama bisa tersimpan sebagai array (index 0,1,...) akibat bug lama;
    // backend kini mengirim prefix "task_" untuk memastikan object JSON.
    const normalizeApprovals = (raw) => {
        if (!raw) return {};
        if (Array.isArray(raw)) {
            // Array → coba map index ke task id dari project.tasks (urut)
            const taskIds = (Array.isArray(project?.tasks) ? project.tasks : []).map(t => t.id);
            const out = {};
            raw.forEach((v, i) => {
                if (v && typeof v === 'object') {
                    const key = taskIds[i] !== undefined ? String(taskIds[i]) : String(i);
                    out[key] = v;
                }
            });
            return out;
        }
        if (typeof raw === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(raw)) {
                // Backend bisa kirim "task_10" (prefix) atau "10"
                const cleanKey = String(k).replace(/^task_/, '');
                if (v && typeof v === 'object' && ('approved' in v || 'comment' in v || 'attachments' in v || 'approvedAt' in v)) {
                    out[cleanKey] = v;
                }
            }
            return out;
        }
        return {};
    };

    // SIT Step 2 data (derived otomatis dari task; tanpa input manual)
    const [sit2Approvals, setSit2Approvals] = useState(() => normalizeApprovals(sitUatData.sit2_task_approvals));
    const [taskRevisions, setTaskRevisions] = useState({}); // taskId -> notes baru (untuk modal revisi task)
    const [showTaskRevisionModal, setShowTaskRevisionModal] = useState(null); // task object
    // SIT Step 3 data
    const [sit3, setSit3] = useState({
        reviewNotes: sitUatData.sit3_reviewNotes || '',
        docs: sitUatData.sit3_docs || [],
    });

    // UAT Step 1 data — Persiapan Skenario UAT
    const [uat1, setUat1] = useState({
        scenarioList: sitUatData.uat1_scenarioList || '',        // daftar skenario (derived dari task, editable)
        preparedBy: sitUatData.uat1_preparedBy || '',            // disiapkan oleh (PM)
        prepNotes: sitUatData.uat1_prepNotes || '',              // catatan persiapan
        // Peserta yang terlibat dalam UAT
        participants: sitUatData.uat1_participants || [],        // [{name, role, unit}]
        // Jadwal pelaksanaan UAT
        startDate: sitUatData.uat1_startDate || '',
        endDate: sitUatData.uat1_endDate || '',
        // Unit / divisi peminta
        unit: sitUatData.uat1_unit || '',
        docs: sitUatData.uat1_docs || [],
    });
    const [uatInternalUsers, setUatInternalUsers] = useState([]);

    useEffect(() => {
        let cancelled = false;
        if (activeUatStep !== 1) return undefined;
        userService.getAll()
            .then(response => {
                if (!cancelled) setUatInternalUsers((response?.data || []).filter(account => account.is_active !== false));
            })
            .catch(() => {
                if (!cancelled) setUatInternalUsers([]);
            });
        return () => { cancelled = true; };
    }, [activeUatStep]);
    // UAT Step 2 data — hasil dicatat per skenario/task, bukan angka manual.
    const [uat2, setUat2] = useState({
        scenarios: buildUatExecutionScenarios(
            sitUatData.uat2_scenarios,
            project?.tasks,
            sitUatData.uat2_additional_requests
        ),
        additionalRequests: buildUatAdditionalRequests(sitUatData.uat2_additional_requests),
        execNotes: sitUatData.uat2_summary?.notes || sitUatData.uat2_execNotes || '',
    });
    // UAT Step 3 data
    const [uat3, setUat3] = useState({
        approvalNotes: sitUatData.uat3_approvalNotes || '',
        approvedBy: sitUatData.uat3_approvedBy || '',
        docs: sitUatData.uat3_docs || [],
    });

    // Revision & modal state (SIT/UAT level)
    const [submitting, setSubmitting] = useState(false);
    const [savingUatDraft, setSavingUatDraft] = useState(false);

    // Pratinjau dokumen (modal) & status upload
    const [previewDoc, setPreviewDoc] = useState(null);
    const [uploadingCategory, setUploadingCategory] = useState(null);
    const [uploadingUatScenarioId, setUploadingUatScenarioId] = useState(null);

    const hasUploadedSitSignOffDocument = useMemo(
        () => (sit3.docs || []).some(doc => (
            Boolean(doc?.docId)
            && SIT_SIGN_OFF_DOCUMENT_TYPES.includes(doc.doc_type)
            && doc.isUploading !== true
        )),
        [sit3.docs]
    );
    const hasSitReviewNotes = sit3.reviewNotes.trim().length > 0;
    const isSitSignOffUploading = uploadingCategory === 'SIT_SIGNOFF';
    const isUatApprovalUploading = uploadingCategory === 'UAT_APPROVAL';
    const canPassSit = allSitApproved
        && hasSitReviewNotes
        && hasUploadedSitSignOffDocument
        && !isSitSignOffUploading;
    const sitPassBlockedReason = isSitSignOffUploading
        ? 'Tunggu hingga dokumen selesai diunggah.'
        : !hasUploadedSitSignOffDocument
            ? 'Unggah minimal satu dokumen Hasil Review / Berita Acara SIT terlebih dahulu.'
            : !hasSitReviewNotes
                ? 'Catatan Review Akhir / Keputusan wajib diisi.'
                : !allSitApproved
                    ? 'Semua persetujuan Developer, PM / Analyst Pengembangan, dan Development Lead harus lengkap.'
                    : '';

    // Revision history (SIT/UAT level)
    const revisions = sitUatData.revisions || [];

    // ── File upload refs ───────────────────────────────────────────────────
    const sit3FileRef = useRef(null);
    const uat1FileRef = useRef(null);
    const uat3FileRef = useRef(null);

    // ── Upload dokumen SIT/UAT dengan MASKING nama & PILIHAN tipe file ──
    // File ditambahkan sebagai draft (tipe bisa dipilih), nama di-masking sesuai
    // format XXX/GPTD/TIPE/DD-BulanYYYY_NamaProyek. Upload ke server terjadi
    // saat tipe dipilih / saat step disimpan.
    const getDefaultDocType = (cat) => ({
        'SIT_SIGNOFF': 'SIT_SIGNOFF',
        'UAT_PREP': 'UNDANGAN',
        'UAT_EXEC': 'UAT_EVIDENCE',
        'UAT_APPROVAL': 'UAT_SIGNOFF',
    }[cat] || 'LAINNYA');

    const docTypeOptions = (cat) => {
        const base = Object.entries({
            BRD: 'BRD', MEMO: 'Memo', LAMPIRAN: 'Lampiran', LAINNYA: 'Lainnya',
            FSD: 'FSD', ARSITEKTUR: 'Arsitektur', SIT_PLAN: 'Test Plan SIT',
            SIT_RESULT: 'Hasil SIT', SIT_SIGNOFF: 'Berita Acara SIT',
            UNDANGAN: 'Undangan', UAT_PLAN: 'Skenario UAT',
            UAT_RESULT: 'Hasil UAT', UAT_EVIDENCE: 'Bukti Temuan UAT', UAT_SIGNOFF: 'Berita Acara UAT',
            QA_REPORT: 'Laporan QA', QA_SIGNOFF: 'QA Sign-Off',
            CYBER_REPORT: 'Laporan Siber', CYBER_SIGNOFF: 'Cyber Sign-Off',
            RELEASE_PLAN: 'Rencana Rilis', SPREADSHEET: 'Spreadsheet',
            GAMBAR: 'Gambar/Screenshot', ARSIP: 'Arsip ZIP',
        });
        if (cat === 'SIT_SIGNOFF') {
            return base.filter(([code]) => SIT_SIGN_OFF_DOCUMENT_TYPES.includes(code));
        }
        if (cat === 'UAT_PREP') {
            return base.filter(([code]) => UAT_PREPARATION_DOCUMENT_TYPES.includes(code));
        }
        return base.filter(([code]) => code !== 'UNDANGAN');
    };

    const maskedDocName = (docType, discriminators = []) => generateDocumentName(
        project?.req_id || project?.id,
        docType,
        project?.title || project?.name,
        discriminators
    );

    // Penanda item untuk nama masking lampiran bukti UAT. Dikirim ke server sebagai
    // `context_label` supaya tiap lampiran bertipe UAT_EVIDENCE bernama berbeda dan
    // langsung terbaca berasal dari task / item mana.
    const uatItemLabel = (item, index, fallbackPrefix) => (
        item?.taskId ? `TASK-${item.taskId}` : `${fallbackPrefix}-${index + 1}`
    );

    const addDraftDocs = (setter, files, cat) => {
        const defaultType = getDefaultDocType(cat);
        const drafts = Array.from(files).map(f => {
            const typeInfo = getDocumentTypeInfo(defaultType);
            const masked = maskedDocName(defaultType);
            const ext = (f.name.split('.').pop() || 'file').toLowerCase();
            return {
                id: `${cat}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                docId: null,
                name: masked + '.' + ext,
                originalName: f.name,
                maskedName: masked + '.' + ext,
                size: formatFileSize(f.size),
                type: ext.toUpperCase(),
                url: URL.createObjectURL(f),
                rawFile: f,
                uploadedAt: new Date().toISOString(),
                category: cat,
                doc_type: defaultType,
                color: typeInfo.color,
                isUploading: false,
            };
        });
        setter(prev => ({ ...prev, docs: [...(prev.docs || []), ...drafts] }));
        toast.success(`${drafts.length} berkas ditambahkan. Pilih tipe lalu tersimpan otomatis.`);
    };

    const changeDocType = async (setter, idx, newDocType) => {
        let target = null;
        setter(prev => {
            const list = prev.docs || [];
            target = list[idx] || null;
            const info = getDocumentTypeInfo(newDocType);
            const ext = target?.name?.split('.').pop() || 'file';
            const newName = maskedDocName(newDocType) + '.' + ext;
            const updated = list.map((d, i) => i === idx ? { ...d, doc_type: newDocType, color: info.color, name: newName, maskedName: newName } : d);
            return { ...prev, docs: updated };
        });
        // Upload ulang ke server jika sudah pernah (nama berubah)
        if (target?.docId) {
            try { await documentService.delete(target.docId); } catch { /* ignore */ }
            await uploadDocToServer(setter, idx, newDocType);
        }
    };

    const uploadDocToServer = async (setter, idx, docType) => {
        let target = null;
        setter(prev => {
            const list = prev.docs || [];
            target = list[idx] || null;
            return { ...prev, docs: list.map((d, i) => i === idx ? { ...d, isUploading: true } : d) };
        });
        if (!target?.rawFile || !project?.id) return;
        try {
            const res = await documentService.upload(target.rawFile, {
                project_id: project.id,
                document_type: docType || target.doc_type || 'LAINNYA',
                original_filename: target.originalName,
            });
            const doc = res?.data || {};
            const ext = (target.originalName.split('.').pop() || 'file').toLowerCase();
            const masked = generateDocumentName(project?.req_id || project?.id, docType || target.doc_type || 'LAINNYA', project?.title || project?.name);
            setter(prev => {
                const list = prev.docs || [];
                return { ...prev, docs: list.map((d, i) => i === idx ? {
                    ...d,
                    docId: doc.id || null,
                    name: masked + '.' + ext,
                    maskedName: masked + '.' + ext,
                    url: doc.id ? `${import.meta.env.VITE_API_URL}/documents/${doc.id}/download` : d.url,
                    isUploading: false,
                } : d) };
            });
            toast.success('Berkas diunggah ke server.');
        } catch (err) {
            setter(prev => {
                const list = prev.docs || [];
                return { ...prev, docs: list.map((d, i) => i === idx ? { ...d, isUploading: false } : d) };
            });
            toast.error(`Gagal mengunggah: ${err.message}`);
        }
    };

    // Upload semua draft yang belum di-upload (dipakai saat simpan step / tombol selesai)
    const uploadAllDrafts = async (setter, docs) => {
        const drafts = (docs || []).map((d, i) => ({ d, i })).filter(x => !x.d.docId && x.d.rawFile);
        for (const { d, i } of drafts) {
            await uploadDocToServer(setter, i, d.doc_type);
        }
    };

    /**
     * Dokumen sign-off SIT adalah gate wajib. Berkas langsung diunggah dan
     * referensinya dipersist sebelum tombol kelulusan SIT dapat digunakan.
     */
    const uploadSitSignOffDocuments = async (files) => {
        if (!project?.id || !files.length || isSitSignOffUploading) return;

        setUploadingCategory('SIT_SIGNOFF');
        const uploadedDocs = [];
        const failedFiles = [];

        try {
            for (const file of files) {
                try {
                    const documentType = 'SIT_SIGNOFF';
                    const response = await documentService.upload(file, {
                        project_id: project.id,
                        document_type: documentType,
                        original_filename: file.name,
                    });
                    const serverDocument = response?.data || {};
                    if (!serverDocument.id) {
                        throw new Error('Server tidak mengembalikan ID dokumen yang valid.');
                    }
                    const extension = (file.name.split('.').pop() || 'file').toLowerCase();
                    const maskedName = serverDocument.file_name
                        || `${maskedDocName(documentType)}.${extension}`;
                    const typeInfo = getDocumentTypeInfo(documentType);

                    uploadedDocs.push({
                        id: `SIT_SIGNOFF_${serverDocument.id}`,
                        docId: serverDocument.id,
                        name: maskedName,
                        originalName: file.name,
                        maskedName,
                        size: formatFileSize(file.size),
                        type: extension.toUpperCase(),
                        url: URL.createObjectURL(file),
                        rawFile: file,
                        uploadedAt: serverDocument.created_at || new Date().toISOString(),
                        category: 'SIT_SIGNOFF',
                        doc_type: documentType,
                        color: typeInfo.color,
                        isUploading: false,
                    });
                } catch (error) {
                    failedFiles.push({ name: file.name, message: error.message });
                }
            }

            if (!uploadedDocs.length) {
                const detail = failedFiles[0]?.message ? `: ${failedFiles[0].message}` : '';
                throw new Error(`Tidak ada dokumen yang berhasil diunggah${detail}`);
            }

            const nextDocs = [...(sit3.docs || []), ...uploadedDocs];

            try {
                await projectService.update(project.id, {
                    sitUatData: buildSitUatData({ sit3_docs: sanitizeDocs(nextDocs) }),
                });
            } catch (error) {
                await Promise.allSettled(
                    uploadedDocs
                        .filter(doc => doc.docId)
                        .map(doc => documentService.delete(doc.docId))
                );
                uploadedDocs.forEach(doc => {
                    if (doc.url?.startsWith('blob:')) URL.revokeObjectURL(doc.url);
                });
                throw new Error(
                    `Dokumen terunggah tetapi gagal ditautkan ke tahap SIT: ${error.message}`,
                    { cause: error }
                );
            }

            setSit3(previous => ({ ...previous, docs: nextDocs }));
            refreshProject?.();

            if (failedFiles.length > 0) {
                toast.error(`${uploadedDocs.length} dokumen berhasil, ${failedFiles.length} gagal diunggah.`);
            } else {
                toast.success('Dokumen Berita Acara SIT berhasil diunggah dan disimpan.');
            }
        } catch (error) {
            toast.error(error.message || 'Gagal mengunggah dokumen Berita Acara SIT.');
        } finally {
            setUploadingCategory(null);
        }
    };

    /**
     * Dokumen persetujuan final langsung diunggah dan ditautkan ke proyek agar
     * approver eksternal dapat memeriksanya sebelum memberikan keputusan.
     */
    const uploadUatApprovalDocuments = async (files) => {
        if (!project?.id || !files.length || isUatApprovalUploading) return;
        if ((uatApprovalMatrix?.approvers || []).some(approver => approver.status !== 'pending')) {
            toast.error('Dokumen tidak dapat diubah setelah keputusan approval pertama tercatat. Buat putaran approval baru terlebih dahulu jika dokumen harus diganti.');
            return;
        }

        setUploadingCategory('UAT_APPROVAL');
        const uploadedDocs = [];
        const failedFiles = [];

        try {
            for (const file of files) {
                try {
                    const documentType = 'UAT_SIGNOFF';
                    const response = await documentService.upload(file, {
                        project_id: project.id,
                        document_type: documentType,
                        original_filename: file.name,
                    });
                    const serverDocument = response?.data || {};
                    if (!serverDocument.id) {
                        throw new Error('Server tidak mengembalikan ID dokumen yang valid.');
                    }

                    const extension = (file.name.split('.').pop() || 'file').toLowerCase();
                    const maskedName = serverDocument.file_name
                        || `${maskedDocName(documentType)}.${extension}`;
                    const typeInfo = getDocumentTypeInfo(documentType);
                    uploadedDocs.push({
                        id: `UAT_APPROVAL_${serverDocument.id}`,
                        docId: serverDocument.id,
                        name: maskedName,
                        originalName: file.name,
                        maskedName,
                        size: formatFileSize(file.size),
                        type: extension.toUpperCase(),
                        url: URL.createObjectURL(file),
                        rawFile: file,
                        uploadedAt: serverDocument.created_at || new Date().toISOString(),
                        category: 'UAT_APPROVAL',
                        doc_type: documentType,
                        color: typeInfo.color,
                        isUploading: false,
                    });
                } catch (error) {
                    failedFiles.push({ name: file.name, message: error.message });
                }
            }

            if (!uploadedDocs.length) {
                const detail = failedFiles[0]?.message ? `: ${failedFiles[0].message}` : '';
                throw new Error(`Tidak ada dokumen yang berhasil diunggah${detail}`);
            }

            const nextDocs = [...(uat3.docs || []), ...uploadedDocs];
            try {
                await projectService.update(project.id, {
                    sitUatData: buildSitUatData({ uat3_docs: sanitizeDocs(nextDocs) }),
                });
            } catch (error) {
                await Promise.allSettled(
                    uploadedDocs.filter(doc => doc.docId).map(doc => documentService.delete(doc.docId))
                );
                uploadedDocs.forEach(doc => {
                    if (doc.url?.startsWith('blob:')) URL.revokeObjectURL(doc.url);
                });
                throw new Error(`Dokumen terunggah tetapi gagal ditautkan ke Persetujuan Final UAT: ${error.message}`, { cause: error });
            }

            setUat3(previous => ({ ...previous, docs: nextDocs }));
            refreshProject?.();
            if (failedFiles.length > 0) {
                toast.error(`${uploadedDocs.length} dokumen berhasil, ${failedFiles.length} gagal diunggah.`);
            } else {
                toast.success('Dokumen Persetujuan Final UAT tersimpan dan tersedia pada link approval eksternal.');
            }
        } catch (error) {
            toast.error(error.message || 'Gagal mengunggah dokumen Persetujuan Final UAT.');
        } finally {
            setUploadingCategory(null);
        }
    };

    const onUpload = (e, setter, cat) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        if (e.target) e.target.value = '';
        if (cat === 'SIT_SIGNOFF') {
            void uploadSitSignOffDocuments(files);
            return;
        }
        if (cat === 'UAT_APPROVAL') {
            void uploadUatApprovalDocuments(files);
            return;
        }
        addDraftDocs(setter, files, cat);
    };

    const removeSitSignOffDocument = async (index) => {
        if (isSitSignOffUploading) return;

        const target = sit3.docs?.[index];
        if (!target) return;

        setUploadingCategory('SIT_SIGNOFF');
        try {
            if (target.docId) {
                await documentService.delete(target.docId);
            }

            const nextDocs = (sit3.docs || []).filter((_, docIndex) => docIndex !== index);
            setSit3(previous => ({ ...previous, docs: nextDocs }));
            await projectService.update(project.id, {
                sitUatData: buildSitUatData({ sit3_docs: sanitizeDocs(nextDocs) }),
            });

            if (target.url?.startsWith('blob:')) URL.revokeObjectURL(target.url);
            refreshProject?.();
            toast('Berkas dihapus.', { icon: '🗑️' });
        } catch (error) {
            toast.error(`Gagal menghapus dokumen: ${error.message}`);
            refreshProject?.();
        } finally {
            setUploadingCategory(null);
        }
    };

    const removeUatApprovalDocument = async (index) => {
        if (isUatApprovalUploading) return;
        if ((uatApprovalMatrix?.approvers || []).some(approver => approver.status !== 'pending')) {
            toast.error('Dokumen tidak dapat dihapus setelah keputusan approval pertama tercatat.');
            return;
        }
        const target = uat3.docs?.[index];
        if (!target) return;

        setUploadingCategory('UAT_APPROVAL');
        try {
            const nextDocs = (uat3.docs || []).filter((_, docIndex) => docIndex !== index);
            await projectService.update(project.id, {
                sitUatData: buildSitUatData({ uat3_docs: sanitizeDocs(nextDocs) }),
            });
            if (target.docId) await documentService.delete(target.docId);

            setUat3(previous => ({ ...previous, docs: nextDocs }));
            if (target.url?.startsWith('blob:')) URL.revokeObjectURL(target.url);
            refreshProject?.();
            toast('Dokumen Persetujuan Final dihapus dan tidak lagi tersedia pada link eksternal.', { icon: '🗑️' });
        } catch (error) {
            toast.error(`Gagal menghapus dokumen: ${error.message}`);
            refreshProject?.();
        } finally {
            setUploadingCategory(null);
        }
    };

    const onRemoveDoc = async (setter, idx) => {
        let removed = null;
        setter(prev => {
            const list = prev.docs || [];
            removed = list[idx] || null;
            return { ...prev, docs: list.filter((_, i) => i !== idx) };
        });
        if (removed?.docId) {
            try { await documentService.delete(removed.docId); } catch { /* ignore */ }
        }
        toast('Berkas dihapus.', { icon: '🗑️' });
    };

    const updateUatScenario = (scenarioId, field, value) => {
        setUat2(previous => ({
            ...previous,
            scenarios: previous.scenarios.map(item => {
                if (item.id !== scenarioId) return item;
                if (field === 'result' && value === 'accepted') {
                    return { ...item, result: value, changeType: '', request: '' };
                }
                return { ...item, [field]: value };
            }),
        }));
    };

    const addUatAdditionalRequest = () => {
        setUat2(previous => ({
            ...previous,
            additionalRequests: [
                ...(previous.additionalRequests || []),
                {
                    id: `uat_request_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    title: '',
                    changeType: '',
                    detail: '',
                    comment: '',
                    attachments: [],
                    taskId: null,
                },
            ],
        }));
    };

    const updateUatAdditionalRequest = (requestId, field, value) => {
        setUat2(previous => ({
            ...previous,
            additionalRequests: (previous.additionalRequests || []).map(item =>
                item.id === requestId ? { ...item, [field]: value } : item
            ),
        }));
    };

    const removeUatAdditionalRequest = async (requestId) => {
        const request = (uat2.additionalRequests || []).find(item => item.id === requestId);
        if (!request || uploadingUatScenarioId) return;

        setUploadingUatScenarioId(requestId);
        try {
            await Promise.allSettled(
                (request.attachments || [])
                    .filter(attachment => attachment.docId)
                    .map(attachment => documentService.delete(attachment.docId))
            );
            setUat2(previous => ({
                ...previous,
                additionalRequests: (previous.additionalRequests || []).filter(item => item.id !== requestId),
            }));
            toast('Permintaan tambahan dihapus.', { icon: '🗑️' });
        } finally {
            setUploadingUatScenarioId(null);
        }
    };

    const uploadUatEvidence = async (scenarioId, files) => {
        if (!project?.id || !files.length || uploadingUatScenarioId) return;

        const scenarioIndex = (uat2.scenarios || []).findIndex(item => item.id === scenarioId);
        const contextLabel = uatItemLabel((uat2.scenarios || [])[scenarioIndex], scenarioIndex, 'SKENARIO');

        setUploadingUatScenarioId(scenarioId);
        const uploaded = [];
        const failed = [];
        try {
            for (const file of files) {
                try {
                    const response = await documentService.upload(file, {
                        project_id: project.id,
                        document_type: 'UAT_EVIDENCE',
                        original_filename: file.name,
                        context_label: contextLabel,
                    });
                    const document = response?.data || {};
                    if (!document.id) throw new Error('Server tidak mengembalikan ID dokumen.');

                    const extension = (file.name.split('.').pop() || 'file').toUpperCase();
                    const maskedName = document.file_name
                        || `${maskedDocName('UAT_EVIDENCE', [contextLabel])}.${extension.toLowerCase()}`;
                    uploaded.push({
                        id: `UAT_EVIDENCE_${document.id}`,
                        docId: document.id,
                        name: maskedName,
                        maskedName,
                        originalName: file.name,
                        size: formatFileSize(file.size),
                        type: extension,
                        uploadedAt: document.created_at || new Date().toISOString(),
                        category: 'UAT_EVIDENCE',
                        doc_type: 'UAT_EVIDENCE',
                        color: getDocumentTypeInfo('UAT_EVIDENCE').color,
                    });
                } catch (error) {
                    failed.push(`${file.name}: ${error.message}`);
                }
            }

            if (uploaded.length > 0) {
                setUat2(previous => ({
                    ...previous,
                    scenarios: previous.scenarios.map(item => item.id === scenarioId
                        ? { ...item, attachments: [...(item.attachments || []), ...uploaded] }
                        : item),
                }));
                toast.success(`${uploaded.length} lampiran bukti UAT berhasil diunggah.`);
            }
            if (failed.length > 0) toast.error(`${failed.length} lampiran gagal diunggah.`);
        } finally {
            setUploadingUatScenarioId(null);
        }
    };

    const uploadUatAdditionalRequestEvidence = async (requestId, files) => {
        if (!project?.id || !files.length || uploadingUatScenarioId) return;

        const requestIndex = (uat2.additionalRequests || []).findIndex(item => item.id === requestId);
        const contextLabel = uatItemLabel((uat2.additionalRequests || [])[requestIndex], requestIndex, 'PERMINTAAN');

        setUploadingUatScenarioId(requestId);
        const uploaded = [];
        const failed = [];
        try {
            for (const file of files) {
                try {
                    const response = await documentService.upload(file, {
                        project_id: project.id,
                        document_type: 'UAT_EVIDENCE',
                        original_filename: file.name,
                        context_label: contextLabel,
                    });
                    const document = response?.data || {};
                    if (!document.id) throw new Error('Server tidak mengembalikan ID dokumen.');
                    const extension = (file.name.split('.').pop() || 'file').toUpperCase();
                    const maskedName = document.file_name
                        || `${maskedDocName('UAT_EVIDENCE', [contextLabel])}.${extension.toLowerCase()}`;
                    uploaded.push({
                        id: `UAT_EVIDENCE_${document.id}`,
                        docId: document.id,
                        name: maskedName,
                        maskedName,
                        originalName: file.name,
                        size: formatFileSize(file.size),
                        type: extension,
                        uploadedAt: document.created_at || new Date().toISOString(),
                        category: 'UAT_EVIDENCE',
                        doc_type: 'UAT_EVIDENCE',
                        color: getDocumentTypeInfo('UAT_EVIDENCE').color,
                    });
                } catch (error) {
                    failed.push(`${file.name}: ${error.message}`);
                }
            }

            if (uploaded.length > 0) {
                setUat2(previous => ({
                    ...previous,
                    additionalRequests: (previous.additionalRequests || []).map(item => item.id === requestId
                        ? { ...item, attachments: [...(item.attachments || []), ...uploaded] }
                        : item),
                }));
                toast.success(`${uploaded.length} lampiran permintaan user berhasil diunggah.`);
            }
            if (failed.length > 0) toast.error(`${failed.length} lampiran gagal diunggah.`);
        } finally {
            setUploadingUatScenarioId(null);
        }
    };

    const removeUatEvidence = async (scenarioId, attachmentIndex) => {
        const scenario = uat2.scenarios.find(item => item.id === scenarioId);
        const attachment = scenario?.attachments?.[attachmentIndex];
        if (!attachment || uploadingUatScenarioId) return;

        setUploadingUatScenarioId(scenarioId);
        try {
            if (attachment.docId) await documentService.delete(attachment.docId);
            setUat2(previous => ({
                ...previous,
                scenarios: previous.scenarios.map(item => item.id === scenarioId
                    ? { ...item, attachments: item.attachments.filter((_, index) => index !== attachmentIndex) }
                    : item),
            }));
            toast('Lampiran bukti dihapus.', { icon: '🗑️' });
        } catch (error) {
            toast.error(`Gagal menghapus lampiran: ${error.message}`);
        } finally {
            setUploadingUatScenarioId(null);
        }
    };

    const removeUatAdditionalRequestEvidence = async (requestId, attachmentIndex) => {
        const request = (uat2.additionalRequests || []).find(item => item.id === requestId);
        const attachment = request?.attachments?.[attachmentIndex];
        if (!attachment || uploadingUatScenarioId) return;

        setUploadingUatScenarioId(requestId);
        try {
            if (attachment.docId) await documentService.delete(attachment.docId);
            setUat2(previous => ({
                ...previous,
                additionalRequests: (previous.additionalRequests || []).map(item => item.id === requestId
                    ? { ...item, attachments: item.attachments.filter((_, index) => index !== attachmentIndex) }
                    : item),
            }));
            toast('Lampiran permintaan user dihapus.', { icon: '🗑️' });
        } catch (error) {
            toast.error(`Gagal menghapus lampiran: ${error.message}`);
        } finally {
            setUploadingUatScenarioId(null);
        }
    };

    const getUatVerificationUploadKey = (source, itemId) => `uat_verification_${source}_${itemId}`;

    const uploadUatMajorVerificationEvidence = async (source, itemId, files) => {
        if (!project?.id || !files.length || uploadingUatScenarioId) return;

        const collectionKey = source === 'scenario' ? 'scenarios' : 'additionalRequests';
        const currentItemIndex = (uat2[collectionKey] || []).findIndex(item => item.id === itemId);
        const currentItem = (uat2[collectionKey] || [])[currentItemIndex];
        const contextLabel = `VERIFIKASI-${uatItemLabel(currentItem, currentItemIndex, source === 'scenario' ? 'SKENARIO' : 'PERMINTAAN')}`;
        const remainingSlots = Math.max(0, 10 - (currentItem?.verificationAttachments || []).length);
        if (remainingSlots === 0) {
            toast.error('Maksimal 10 lampiran bukti untuk setiap item verifikasi Mayor.');
            return;
        }
        const filesToUpload = files.slice(0, remainingSlots);
        if (filesToUpload.length < files.length) {
            toast(`Hanya ${filesToUpload.length} berkas yang diunggah karena batas maksimal 10 lampiran.`, { icon: 'ℹ️' });
        }

        const uploadKey = getUatVerificationUploadKey(source, itemId);
        setUploadingUatScenarioId(uploadKey);
        try {
            const results = await Promise.allSettled(filesToUpload.map(async file => {
                const response = await documentService.upload(file, {
                    project_id: project.id,
                    document_type: 'UAT_EVIDENCE',
                    original_filename: file.name,
                    context_label: contextLabel,
                });
                const document = response?.data || {};
                if (!document.id) throw new Error('Server tidak mengembalikan ID dokumen.');

                const extension = (file.name.split('.').pop() || 'file').toUpperCase();
                const maskedName = document.file_name
                    || `${maskedDocName('UAT_EVIDENCE', [contextLabel])}.${extension.toLowerCase()}`;

                return {
                    id: `UAT_VERIFICATION_EVIDENCE_${document.id}`,
                    docId: document.id,
                    name: maskedName,
                    maskedName,
                    originalName: file.name,
                    size: formatFileSize(file.size),
                    type: extension,
                    uploadedAt: document.created_at || new Date().toISOString(),
                    category: 'UAT_EVIDENCE',
                    doc_type: 'UAT_EVIDENCE',
                    color: getDocumentTypeInfo('UAT_EVIDENCE').color,
                };
            }));
            const uploaded = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);
            const failedCount = results.length - uploaded.length;

            if (uploaded.length > 0) {
                setUat2(previous => ({
                    ...previous,
                    [collectionKey]: (previous[collectionKey] || []).map(item => item.id === itemId
                        ? {
                            ...item,
                            verificationAttachments: [
                                ...(item.verificationAttachments || []),
                                ...uploaded,
                            ],
                        }
                        : item),
                }));
                toast.success(`${uploaded.length} bukti verifikasi Mayor berhasil diunggah.`);
            }
            if (failedCount > 0) {
                toast.error(`${failedCount} lampiran bukti verifikasi gagal diunggah.`);
            }
        } finally {
            setUploadingUatScenarioId(null);
        }
    };

    const removeUatMajorVerificationEvidence = async (source, itemId, attachmentIndex) => {
        const collectionKey = source === 'scenario' ? 'scenarios' : 'additionalRequests';
        const item = (uat2[collectionKey] || []).find(entry => entry.id === itemId);
        const attachment = item?.verificationAttachments?.[attachmentIndex];
        if (!attachment || uploadingUatScenarioId) return;

        const uploadKey = getUatVerificationUploadKey(source, itemId);
        setUploadingUatScenarioId(uploadKey);
        try {
            if (attachment.docId) await documentService.delete(attachment.docId);
            setUat2(previous => ({
                ...previous,
                [collectionKey]: (previous[collectionKey] || []).map(entry => entry.id === itemId
                    ? {
                        ...entry,
                        verificationAttachments: (entry.verificationAttachments || [])
                            .filter((_, index) => index !== attachmentIndex),
                    }
                    : entry),
            }));
            toast('Lampiran bukti verifikasi dihapus.', { icon: '🗑️' });
        } catch (error) {
            toast.error(`Gagal menghapus bukti verifikasi: ${error.message}`);
        } finally {
            setUploadingUatScenarioId(null);
        }
    };

    const viewDoc = async (doc) => {
        try {
            if (doc?.docId) {
                const loadingId = toast.loading('Membuka berkas...');
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                toast.dismiss(loadingId);
                setPreviewDoc({ ...doc, blobUrl: url });
            } else if (doc?.url?.startsWith('blob:')) {
                setPreviewDoc({ ...doc, blobUrl: doc.url });
            } else {
                toast.info('Berkas belum tersedia untuk dilihat.');
            }
        } catch (err) {
            toast.error(`Gagal membuka berkas: ${err.message}`);
        }
    };

    const downloadDoc = async (doc) => {
        try {
            if (doc?.docId) {
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = doc.maskedName || doc.name || 'berkas';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else if (doc?.url?.startsWith('blob:')) {
                const a = document.createElement('a');
                a.href = doc.url;
                a.download = doc.maskedName || doc.name || 'berkas';
                a.click();
            } else {
                toast.info('Berkas belum tersedia untuk diunduh.');
            }
        } catch (err) {
            toast.error(`Gagal mengunduh berkas: ${err.message}`);
        }
    };

    // ── Status helpers ─────────────────────────────────────────────────────
    const stUpper = String(status || '').toUpperCase();

    const isDev = ['IN_DEVELOPMENT', 'DEVELOPMENT', 'DEV_IN_PROGRESS', 'IN_SPRINT', 'READY_FOR_DEVELOPMENT'].includes(stUpper) || UNLOCK_ALL_STAGES;
    const sitActive = isDev || ['SIT_IN_PROGRESS', 'SIT_REVISION', 'UAT_REVISION_DEV', 'RETURN_TO_DEV'].includes(stUpper) || UNLOCK_ALL_STAGES;
    const sitDone = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_PASSED', 'DEV_COMPLETED'].includes(stUpper) && !UNLOCK_ALL_STAGES;
    const uatUnlocked = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_PASSED', 'DEV_COMPLETED'].includes(stUpper) || UNLOCK_ALL_STAGES;
    const uatActive = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT'].includes(stUpper) || UNLOCK_ALL_STAGES;
    const uatDone = ['UAT_PASSED', 'DEV_COMPLETED'].includes(stUpper) && !UNLOCK_ALL_STAGES;
    const isComplete = stUpper === 'DEV_COMPLETED' && !UNLOCK_ALL_STAGES;

    // ── Gate helper: status task developer ────────────────────────────────
    // SIT pertama mencakup semua task aktif. SIT ulang Mayor hanya memakai task
    // dalam scope Change Request siklus aktif.
    const taskGate = useCallback(() => {
        const isReady = task => String(task.status || '').toLowerCase() === 'done'
            && (!isTargetedSitRetest || Boolean(task.assignee_id ?? task.assignee_detail?.id));
        const doneTasks = sitScopeTasks.filter(isReady);
        const incompleteTasks = sitScopeTasks.filter(task => !isReady(task));
        return {
            total: sitScopeTasks.length,
            done: doneTasks.length,
            incomplete: incompleteTasks.map(t => ({ id: t.id, title: t.title || t.name || 'Task', status: t.status })),
            canStart: sitScopeTasks.length > 0 && incompleteTasks.length === 0,
        };
    }, [isTargetedSitRetest, sitScopeTasks]);

    // ── Derived stats dari task approvals (untuk ringkasan & dokumen) ─────
    const eligibleTaskIds = useMemo(() => {
        return sitScopeTasks.map(task => task.id);
    }, [sitScopeTasks]);

    const approvedTaskCount = eligibleTaskIds.filter(id => {
        const a = sit2Approvals?.[id];
        return typeof a === 'object' ? a.approved === true : a === true;
    }).length;

    const defectTaskCount = eligibleTaskIds.filter(id => {
        const a = sit2Approvals?.[id];
        const comment = typeof a === 'object' ? (a.comment || '') : '';
        return comment.trim().length > 0;
    }).length;

    const sit2Validation = useMemo(() => {
        if (eligibleTaskIds.length === 0) return 'Belum ada task yang dapat diuji pada tahap SIT.';

        const incompleteTasks = taskGate().incomplete;
        if (incompleteTasks.length > 0) {
            return `Masih ada ${incompleteTasks.length} task yang belum selesai setelah proses revisi.`;
        }

        if (approvedTaskCount !== eligibleTaskIds.length) {
            return `Semua ${eligibleTaskIds.length} task harus disetujui (OK) sebelum dilanjutkan ke approval.`;
        }

        if (isTargetedSitRetest) {
            const tasksWithoutEvidence = eligibleTaskIds.filter(id => {
                const approval = sit2Approvals?.[id];
                return !Array.isArray(approval?.attachments)
                    || !approval.attachments.some(attachment => Boolean(attachment?.docId));
            });
            if (tasksWithoutEvidence.length > 0) {
                return `${tasksWithoutEvidence.length} task dalam scope SIT ulang belum memiliki lampiran bukti pengujian baru.`;
            }
        }

        const revisedTasksWithoutNewEvidence = eligibleTaskIds.filter(id => {
            const approval = sit2Approvals?.[id];
            if (!approval || typeof approval !== 'object' || !approval.revisedAt) return false;

            const revisedAt = Date.parse(approval.revisedAt);
            return !(approval.attachments || []).some(attachment =>
                attachment.uploadedAt && Date.parse(attachment.uploadedAt) > revisedAt
            );
        });

        if (revisedTasksWithoutNewEvidence.length > 0) {
            return `${revisedTasksWithoutNewEvidence.length} task hasil revisi belum memiliki lampiran bukti baru.`;
        }

        return '';
    }, [approvedTaskCount, eligibleTaskIds, isTargetedSitRetest, sit2Approvals, taskGate]);

    const uat2Summary = useMemo(() => {
        const scenarios = Array.isArray(uat2.scenarios) ? uat2.scenarios : [];
        const additionalRequests = Array.isArray(uat2.additionalRequests) ? uat2.additionalRequests : [];
        const acceptedCount = scenarios.filter(item => item.result === 'accepted').length;
        const minorCount = scenarios.filter(item => item.result === 'revision' && item.changeType === 'minor').length
            + additionalRequests.filter(item => item.changeType === 'minor').length;
        const majorCount = scenarios.filter(item => item.result === 'revision' && item.changeType === 'mayor').length
            + additionalRequests.filter(item => item.changeType === 'mayor').length;
        return {
            executedCount: scenarios.filter(item => ['accepted', 'revision'].includes(item.result)).length,
            acceptedCount,
            revisionCount: minorCount + majorCount,
            minorCount,
            majorCount,
            additionalRequestCount: additionalRequests.length,
            conclusion: majorCount > 0 ? 'major_revision' : (minorCount > 0 ? 'minor_revision' : 'accepted'),
        };
    }, [uat2.additionalRequests, uat2.scenarios]);

    const uat2Validation = useMemo(() => {
        const scenarios = Array.isArray(uat2.scenarios) ? uat2.scenarios : [];
        if (scenarios.length === 0) return 'Belum ada task aktif yang dapat dijadikan skenario UAT.';
        if (scenarios.some(item => !['accepted', 'revision'].includes(item.result))) {
            return 'Tentukan hasil Diterima atau Revisi untuk setiap skenario.';
        }
        if (scenarios.some(item => item.result === 'revision' && !['minor', 'mayor'].includes(item.changeType))) {
            return 'Pilih tipe perubahan Minor atau Mayor untuk setiap skenario revisi.';
        }
        if (scenarios.some(item => item.result === 'revision' && !item.request?.trim())) {
            return 'Detail permintaan perubahan wajib diisi untuk setiap skenario revisi.';
        }
        const additionalRequests = Array.isArray(uat2.additionalRequests) ? uat2.additionalRequests : [];
        if (additionalRequests.some(item => !item.title?.trim())) {
            return 'Judul setiap permintaan tambahan user wajib diisi.';
        }
        if (additionalRequests.some(item => !['minor', 'mayor'].includes(item.changeType))) {
            return 'Pilih tipe Minor atau Mayor untuk setiap permintaan tambahan user.';
        }
        if (additionalRequests.some(item => !item.detail?.trim())) {
            return 'Detail setiap permintaan tambahan user wajib diisi.';
        }
        if (uploadingUatScenarioId) return 'Tunggu hingga seluruh lampiran bukti selesai diunggah.';
        return '';
    }, [uat2.additionalRequests, uat2.scenarios, uploadingUatScenarioId]);
    const uat2IsSubmitted = Boolean(sitUatData.uat2_summary?.submittedAt);
    const uat2VerificationMode = sitUatData.uat2_verification_mode === true;
    const uat2AwaitingMajorVerification = sitUatData.uat2_resume_after_sit === true
        || uat2VerificationMode;
    const uat2EditingLocked = uatDone
        || uat2IsSubmitted
        || status === 'UAT_REVISION_DEV'
        || sitUatData.uat2_resume_after_sit === true
        || uat2VerificationMode;
    const uatMajorVerificationItems = useMemo(() => [
        ...(uat2.scenarios || [])
            .filter(item => item.changeType === 'mayor' && item.verificationStatus === 'pending')
            .map(item => ({ ...item, source: 'scenario', title: item.scenario })),
        ...(uat2.additionalRequests || [])
            .filter(item => item.changeType === 'mayor' && item.verificationStatus === 'pending')
            .map(item => ({ ...item, source: 'additional_request' })),
    ], [uat2.additionalRequests, uat2.scenarios]);
    const uatMajorVerificationValidation = useMemo(() => {
        if (!uat2VerificationMode) return '';
        if (uatMajorVerificationItems.length === 0) return 'Tidak ada item Mayor yang tersedia untuk diverifikasi.';
        if (uatMajorVerificationItems.some(item => !['accepted', 'revision'].includes(item.verificationResult))) {
            return 'Tentukan apakah setiap perbaikan Mayor Diterima atau Masih Revisi.';
        }
        if (uatMajorVerificationItems.some(item => item.verificationResult === 'revision' && !item.verificationComment?.trim())) {
            return 'Alasan wajib diisi untuk perbaikan Mayor yang masih memerlukan revisi.';
        }
        if (uatMajorVerificationItems.some(item => !(item.verificationAttachments || []).some(document => document?.docId))) {
            return 'Unggah minimal satu lampiran bukti verifikasi untuk setiap item Mayor.';
        }
        if (uploadingUatScenarioId) return 'Tunggu hingga seluruh lampiran bukti verifikasi selesai diproses.';
        return '';
    }, [uat2VerificationMode, uatMajorVerificationItems, uploadingUatScenarioId]);

    // ── Completion check per step ──────────────────────────────────────────
    const sit1Done = sitDone || (status === 'SIT_IN_PROGRESS' && activeSitStep > 1);
    const sit2Done = sitDone || (status === 'SIT_IN_PROGRESS' && activeSitStep > 2);
    const sit3Done = sitDone;
    const uat1Done = uatDone || (status === 'UAT_IN_PROGRESS' && activeUatStep > 1);
    const uat2Done = uatDone || (status === 'UAT_IN_PROGRESS' && activeUatStep > 2);
    const uat3Done = uatDone;

    // ── Persist helper ─────────────────────────────────────────────────────
    // Bersihkan docs dari field yang tidak bisa diserialize (rawFile, blob url)
    const sanitizeDocs = (docs) => (docs || []).map(doc => {
        const sanitized = { ...doc };
        delete sanitized.rawFile;
        delete sanitized.isUploading;
        if (sanitized.url?.startsWith('blob:')) delete sanitized.url;
        return sanitized;
    });

    const buildSitUatData = (overrides = {}) => ({
        ...sitUatData,
        activeSitStep, activeUatStep,
        sit1_stagingUrl: sit1.stagingUrl,
        sit2_totalCases: taskGate().done,
        sit2_passedCases: approvedTaskCount,
        sit2_defects: defectTaskCount,
        sit2_task_approvals: sit2Approvals,
        sit3_reviewNotes: sit3.reviewNotes, sit3_docs: sanitizeDocs(sit3.docs),
        uat1_scenarioList: uat1.scenarioList, uat1_preparedBy: uat1.preparedBy,
        uat1_prepNotes: uat1.prepNotes, uat1_docs: sanitizeDocs(uat1.docs),
        uat1_participants: uat1.participants,
        uat1_startDate: uat1.startDate, uat1_endDate: uat1.endDate,
        uat1_unit: uat1.unit,
        uat2_executedCount: uat2Summary.executedCount,
        uat2_passedCount: uat2Summary.acceptedCount,
        uat2_findings: uat2Summary.revisionCount,
        uat2_execNotes: uat2.execNotes,
        uat2_scenarios: (uat2.scenarios || []).map(item => ({
            ...item,
            attachments: sanitizeDocs(item.attachments),
            verificationAttachments: sanitizeDocs(item.verificationAttachments),
        })),
        uat2_additional_requests: (uat2.additionalRequests || []).map(item => ({
            ...item,
            attachments: sanitizeDocs(item.attachments),
            verificationAttachments: sanitizeDocs(item.verificationAttachments),
        })),
        uat3_approvalNotes: uat3.approvalNotes, uat3_approvedBy: uat3.approvedBy,
        uat3_docs: sanitizeDocs(uat3.docs),
        revisions,
        ...overrides,
    });

    // Simpan sitUatData ke backend secara SILENT (tanpa toast & tanpa reload).
    // Dipakai agar perubahan approval/lampiran/komentar langsung tersimpan ke DB
    // sehingga dokumentasi tetap ada saat pindah tab / refresh.
    const persistQueueRef = useRef(Promise.resolve());
    const persistSitUatData = (overrides = {}) => {
        if (!project?.id) return Promise.resolve();
        // Serialisasi: jalankan berurutan agar tidak saling menimpa (race condition)
        const run = persistQueueRef.current.then(async () => {
            try {
                await projectService.update(project.id, {
                    sitUatData: buildSitUatData(overrides),
                });
            } catch {
                // silent — jangan spam error di sini
            }
        });
        persistQueueRef.current = run;
        return run;
    };

    // Perubahan approval/komentar/lampiran task langsung disimpan ke backend
    // agar dokumentasi (bukti revisi, catatan, persetujuan) tetap ada di semua laman.
    const handleApprovalsChange = async (next) => {
        const normalized = normalizeApprovals(next);
        setSit2Approvals(normalized);
        await persistSitUatData({ sit2_task_approvals: normalized });
        // Refresh context agar badge status/bukti di Manajemen Task langsung sinkron
        refreshProject?.();
    };

    // Sinkronkan approvals saat project berubah (refresh/polling)
    useEffect(() => {
        setSit2Approvals(normalizeApprovals(sitUatData.sit2_task_approvals));
    }, [project?.id]);

    // ── Handler: START SIT (gatekeeper) ────────────────────────────────────
    const handleStartSIT = () => {
        const gate = taskGate();
        if (gate.total === 0) {
            toast.error('Belum ada task developer di proyek ini. Buat & selesaikan task terlebih dahulu sebelum memulai SIT.');
            return;
        }
        if (!gate.canStart) {
            const names = gate.incomplete.map(t => t.title).join(', ');
            toast.error(`Tidak dapat memulai SIT: masih ada ${gate.incomplete.length} task dalam scope belum selesai (${names}).`);
            return;
        }
        const startsMajorRevisionCycle = status === 'UAT_REVISION_DEV' || sitUatData.uat2_resume_after_sit === true;
        updateProject(project.id, {
            status: 'SIT_IN_PROGRESS',
            sitUatData: buildSitUatData({
                activeSitStep: 1,
                ...(startsMajorRevisionCycle ? {
                    sit2_task_approvals: {},
                    sit3_reviewNotes: '',
                    sit3_docs: [],
                    sit3_approvals: {},
                    uat3_approvals: {},
                } : {}),
            }),
        });
        toast.success(`Pengujian SIT dimulai untuk proyek "${project.name}".`);
    };

    const handleSaveSITDraft = async () => {
        if (!project?.id) return;

        setSubmitting(true);
        try {
            await projectService.update(project.id, {
                sitUatData: buildSitUatData({
                    activeSitStep: 2,
                    sit2_draft_saved_at: new Date().toISOString(),
                    sit2_submitted_at: null,
                }),
            });
            toast.success('Draft Eksekusi SIT berhasil disimpan. Anda dapat melanjutkan setelah revisi dan lampiran bukti terbaru selesai.');
            refreshProject?.();
        } catch (err) {
            toast.error(`Gagal menyimpan draft Eksekusi SIT: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveSITStep = async (step) => {
        if (step === 2 && sit2Validation) {
            toast.error(sit2Validation);
            return;
        }
        // Upload draft dokumen yang belum di-upload (agar docId tersimpan di sitUatData)
        setSubmitting(true);
        try {
            await uploadAllDrafts(setSit3, sit3.docs);
            const nextStep = step + 1;
            await updateProject(project.id, {
                status: 'SIT_IN_PROGRESS',
                sitUatData: buildSitUatData({
                    activeSitStep: nextStep,
                    ...(step === 2 ? { sit2_submitted_at: new Date().toISOString() } : {}),
                }),
            });
            setActiveSitStep(nextStep);
            toast.success(`SIT Tahap ${step} tersimpan. Lanjut ke Tahap ${nextStep}.`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSITPass = async () => {
        const resumesMajorUatVerification = sitUatData.uat2_resume_after_sit === true;
        if (!hasUploadedSitSignOffDocument) {
            toast.error('Unggah minimal satu dokumen Hasil Review / Berita Acara SIT sebelum melanjutkan ke UAT Internal.');
            return;
        }
        if (!hasSitReviewNotes) {
            toast.error('Catatan Review Akhir / Keputusan wajib diisi.');
            return;
        }
        if (!allSitApproved) {
            toast.error('Semua persetujuan SIT harus lengkap sebelum melanjutkan ke UAT Internal.');
            return;
        }
        if (isSitSignOffUploading) {
            toast.error('Tunggu hingga dokumen selesai diunggah.');
            return;
        }

        setSubmitting(true);
        try {
            await projectService.update(project.id, {
                sitUatData: buildSitUatData({ activeSitStep: 3, activeUatStep: resumesMajorUatVerification ? 2 : 1 }),
            });
            await projectService.updateStatus(project.id, 'SIT_PASSED', sit3.reviewNotes.trim());
            addNotification?.(
                'SIT Lulus!',
                resumesMajorUatVerification
                    ? `Proyek "${project.name}" lulus SIT ulang dan siap memverifikasi perbaikan Mayor di UAT.`
                    : `Proyek "${project.name}" lulus SIT. UAT Internal dapat dimulai.`,
                'success',
                '/pm/workspace'
            );
            toast.success(resumesMajorUatVerification
                ? '🎉 SIT ulang lulus! Lanjutkan verifikasi perbaikan Mayor di UAT Tab 2.'
                : '🎉 SIT Lulus! Proyek siap melanjutkan ke UAT Internal.');
            refreshProject?.();
        } catch (error) {
            toast.error(`SIT belum dapat dinyatakan lulus: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Handler: Persetujuan SIT per role (Developer/Analis/Development Lead) ──
    const [sitApprovalNote, setSitApprovalNote] = useState('');
    const [sitApprovalSubmitting, setSitApprovalSubmitting] = useState(false);
    const handleSubmitSitApproval = async () => {
        if (!currentRoleKey || !project?.id) return;
        if (sit3Approvals?.[currentRoleKey]?.approved) {
            toast.info('Anda sudah memberikan persetujuan SIT.');
            return;
        }
        setSitApprovalSubmitting(true);
        try {
            await projectService.submitSitApproval(project.id, sitApprovalNote.trim());
            toast.success('Persetujuan SIT Anda berhasil disimpan.');
            setSitApprovalNote('');
            refreshProject?.();
        } catch (err) {
            toast.error(`Gagal menyimpan persetujuan: ${err.message}`);
        } finally {
            setSitApprovalSubmitting(false);
        }
    };

    // ── Auto-fill peserta dan unit UAT (Tab 1) ──
    // Peserta otomatis tetap dapat diedit. Approver pihak peminta memakai link
    // pribadi, sedangkan approver IT harus ditautkan ke akun aplikasi.
    // Unit otomatis dari divisi pemohon. Tanggal wajib dipilih sendiri oleh PM.
    const buildUatParticipants = useCallback(() => {
        const participants = [];
        const addP = (name, role, unit = '', phone = '', approval = {}) => {
            if (name && !participants.some(p => p.name === name)) participants.push({
                id: participantId(), name, role, unit, phone,
                isApprover: false, approvalRole: '', approvalMode: '', userId: null,
                ...approval,
            });
        };
        addP(
            sf(project?.creator, ''),
            'Pemohon (Business User)',
            sf(project?.creator?.division_detail || project?.creator?.division, ''),
            '',
            { isApprover: true, approvalRole: 'requester', approvalMode: 'external_link' }
        );
        addP(sf(project?.pm, ''), 'PM / Analyst Pengembangan', 'Divisi Pengembangan TI', '', {
            isApprover: true, approvalRole: 'analyst_pm', approvalMode: 'internal_account', userId: project?.pm?.id || project?.pm_id || null,
        });
        addP(sf(project?.analyst, ''), 'System Analyst', 'Divisi Pengembangan TI');
        (Array.isArray(project?.tasks) ? project.tasks : []).forEach(t => {
            addP(t.assignee_detail?.name || t.assignee, 'Developer', 'Divisi Pengembangan TI', '', {
                isApprover: true, approvalRole: 'developer', approvalMode: 'internal_account', userId: t.assignee_detail?.id || t.assignee_id || null,
            });
        });
        return participants;
    }, [project]);

    useEffect(() => {
        if (activeUatStep !== 1) return;
        setUat1(prev => {
            const updates = {};
            // Isi peserta hanya jika masih kosong
            if (!prev.participants || prev.participants.length === 0) {
                updates.participants = buildUatParticipants();
            }
            // Unit / Divisi Peminta otomatis dari business user (pemohon)
            if (!prev.unit) {
                updates.unit = sf(project?.creator?.division_detail || project?.creator?.division || project?.division, '');
            }
            // Disiapkan Oleh otomatis dari PM / Analyst Pengembangan
            if (!prev.preparedBy) {
                updates.preparedBy = sf(project?.pm, '');
            }
            if (Object.keys(updates).length === 0) return prev;
            return { ...prev, ...updates };
        });
    }, [activeUatStep, project?.id, buildUatParticipants]);

    const handleStartUAT = () => {
        const resumesMajorVerification = sitUatData.uat2_resume_after_sit === true
            || sitUatData.uat2_verification_mode === true;
        // Auto-fill peserta UAT dari proyek: pemohon (creator), PM, analyst, developer
        const participants = (uat1.participants || []).length > 0 ? uat1.participants : buildUatParticipants();
        setUat1(prev => ({ ...prev, participants }));
        setActiveUatStep(resumesMajorVerification ? 2 : 1);
        updateProject(project.id, {
            status: 'UAT_IN_PROGRESS',
            sitUatData: buildSitUatData({
                activeUatStep: resumesMajorVerification ? 2 : 1,
                uat1_participants: participants,
            }),
        });
        toast.success(resumesMajorVerification
            ? `SIT ulang selesai. Verifikasi perbaikan Mayor proyek "${project.name}" dapat dilakukan di UAT Tab 2.`
            : `Pengujian UAT Internal dimulai untuk proyek "${project.name}".`);
    };

    // ── Handler peserta UAT ──
    const [editingUatIdx, setEditingUatIdx] = useState(null); // idx peserta yang sedang diedit (inline)
    const handleAddUatParticipant = () => {
        const participants = [...(uat1.participants || []), {
            id: participantId(), name: '', role: '', unit: '', phone: '',
            isApprover: false, approvalRole: '', approvalMode: '', userId: null,
        }];
        setUat1(prev => ({ ...prev, participants }));
        setEditingUatIdx(participants.length - 1);
        persistSitUatData({ uat1_participants: participants });
    };
    const handleRemoveUatParticipant = (idx) => {
        const participants = (uat1.participants || []).filter((_, i) => i !== idx);
        setUat1(prev => ({ ...prev, participants }));
        persistSitUatData({ uat1_participants: participants });
        if (editingUatIdx === idx) setEditingUatIdx(null);
    };
    const handleUatParticipantChange = (idx, field, val) => {
        const participants = (uat1.participants || []).map((p, i) => {
            if (i !== idx) return p;
            const next = { ...p, id: p.id || participantId(), [field]: val };
            if (field === 'participationType') {
                if (val === 'participant') {
                    return {
                        ...next,
                        isApprover: false,
                        approvalRole: '',
                        approvalMode: '',
                        userId: null,
                        role: '',
                    };
                }
                const approvalRole = UAT_APPROVAL_ROLES.find(item => item.value === val);
                const approvalMode = approvalRole?.side === 'requester' ? 'external_link' : 'internal_account';
                return {
                    ...next,
                    isApprover: true,
                    approvalRole: val,
                    approvalMode,
                    userId: null,
                    role: approvalRole?.label || '',
                    name: approvalMode === 'internal_account' || p.approvalMode === 'internal_account' ? '' : p.name,
                    unit: approvalMode === 'internal_account' || p.approvalMode === 'internal_account' ? '' : p.unit,
                    phone: approvalMode === 'internal_account' || p.approvalMode === 'internal_account' ? '' : p.phone,
                };
            }
            if (field === 'approvalRole') {
                const role = UAT_APPROVAL_ROLES.find(item => item.value === val);
                next.approvalMode = role?.side === 'requester' ? 'external_link' : 'internal_account';
                next.userId = null;
                next.role = role?.label || next.role;
            }
            if (field === 'userId') {
                const account = uatInternalUsers.find(item => Number(item.id) === Number(val));
                if (account) {
                    next.userId = Number(account.id);
                    next.name = account.name;
                    next.unit = account.division || next.unit;
                    next.phone = '';
                    next.role = UAT_APPROVAL_ROLES.find(item => item.value === next.approvalRole)?.label || next.role;
                } else {
                    next.userId = null;
                    next.name = '';
                    next.unit = '';
                    next.phone = '';
                }
            }
            return next;
        });
        setUat1(prev => ({ ...prev, participants }));
        // Tidak langsung persist per ketikan (boros) — persist saat klik "Selesai"
    };
    const handleUatParticipantDone = () => {
        if (editingUatIdx === null) return;
        persistSitUatData({ uat1_participants: uat1.participants });
        setEditingUatIdx(null);
    };

    const projectDeveloperUserIds = new Set(
        (project?.tasks || [])
            .map(task => Number(task.assignee_id || task.assignee?.id || task.assignee_detail?.id))
            .filter(Boolean)
    );

    const uatApproverValidation = (() => {
        const approvers = (uat1.participants || []).filter(participant => participant.isApprover === true);
        for (const role of REQUIRED_SINGLE_UAT_APPROVAL_ROLES) {
            if (approvers.filter(participant => participant.approvalRole === role).length !== 1) {
                return `${UAT_APPROVAL_ROLES.find(item => item.value === role)?.label} wajib ditetapkan tepat satu orang.`;
            }
        }
        if (!approvers.some(participant => participant.approvalRole === 'developer')) {
            return 'Minimal satu Developer wajib ditetapkan sebagai approver.';
        }
        if (approvers.some(participant => !participant.name?.trim())) return 'Nama seluruh approver wajib diisi.';
        if (approvers.some(participant => participant.approvalMode === 'external_link' && !participant.phone?.trim())) {
            return 'Nomor HP seluruh approver pihak peminta wajib diisi.';
        }
        const invalidExternalApprover = approvers.find(participant => (
            participant.approvalMode === 'external_link' && !normalizeIndonesianPhone(participant.phone)
        ));
        if (invalidExternalApprover) {
            return `Nomor HP ${invalidExternalApprover.name || 'approver pihak peminta'} tidak valid. Gunakan format 08... atau +62...`;
        }
        if (approvers.some(participant => participant.approvalMode === 'internal_account' && !participant.userId)) {
            return 'Seluruh approver pihak IT wajib ditautkan ke akun aplikasi.';
        }
        const invalidDeveloper = approvers.find(participant => participant.approvalRole === 'developer'
            && !projectDeveloperUserIds.has(Number(participant.userId)));
        if (invalidDeveloper) {
            return `${invalidDeveloper.name || 'Developer yang dipilih'} bukan developer yang mengerjakan task pada proyek ini.`;
        }
        return '';
    })();

    // Skenario UAT otomatis dari task (nama task sebagai daftar skenario)
    const uatScenarioTasks = useMemo(() => {
        if (!Array.isArray(project?.tasks)) return [];
        const additionalRequestTaskIds = new Set(
            (uat2.additionalRequests || []).map(item => Number(item.taskId)).filter(Boolean)
        );
        return project.tasks.filter(task => String(task.status || '').toLowerCase() !== 'take_down'
            && !additionalRequestTaskIds.has(Number(task.id)));
    }, [project?.tasks, uat2.additionalRequests]);

    const handleSaveUATStep = async (step) => {
        const nextStep = step + 1;
        setSubmitting(true);
        // Tahap 1 memerlukan minimal 1 dokumen undangan UAT
        if (step === 1 && (!uat1.docs || uat1.docs.length === 0)) {
            setSubmitting(false);
            toast.error('Unggah minimal 1 dokumen undangan UAT sebelum lanjut ke Eksekusi.');
            return;
        }
        if (step === 1 && uatApproverValidation) {
            setSubmitting(false);
            toast.error(uatApproverValidation);
            return;
        }
        if (step === 1) await uploadAllDrafts(setUat1, uat1.docs);
        setActiveUatStep(nextStep);
        updateProject(project.id, { status: 'UAT_IN_PROGRESS', sitUatData: buildSitUatData({ activeUatStep: nextStep }) });
        toast.success(`UAT Tahap ${step} tersimpan. Lanjut ke Tahap ${nextStep}.`);
        setSubmitting(false);
    };

    const buildUatExecutionPayload = () => ({
        scenarios: (uat2.scenarios || []).map(item => ({
            id: item.id,
            task_id: item.taskId,
            scenario: item.scenario.trim(),
            result: item.result || null,
            change_type: item.result === 'revision' ? (item.changeType || null) : null,
            request: item.result === 'revision' ? (item.request.trim() || null) : null,
            comment: item.comment?.trim() || null,
            attachments: (item.attachments || []).map(document => ({ docId: document.docId })),
        })),
        additional_requests: (uat2.additionalRequests || []).map(item => ({
            id: item.id,
            title: item.title.trim() || null,
            change_type: item.changeType || null,
            detail: item.detail.trim() || null,
            comment: item.comment?.trim() || null,
            attachments: (item.attachments || []).map(document => ({ docId: document.docId })),
        })),
        notes: uat2.execNotes.trim() || null,
    });

    const handleSaveUATDraft = async () => {
        if (!project?.id) return;
        if (uploadingUatScenarioId) {
            toast.error('Tunggu hingga seluruh lampiran bukti selesai diunggah sebelum menyimpan draft.');
            return;
        }

        setSavingUatDraft(true);
        try {
            await projectService.saveUatExecutionDraft(project.id, buildUatExecutionPayload());
            toast.success('Draft Eksekusi UAT berhasil disimpan. Data masih dapat diperbarui sebelum disubmit final.');
            refreshProject?.();
        } catch (error) {
            toast.error(`Gagal menyimpan draft Eksekusi UAT: ${error.message}`);
        } finally {
            setSavingUatDraft(false);
        }
    };

    const handleSubmitUatExecution = async () => {
        if (uat2Validation) {
            toast.error(uat2Validation);
            return;
        }
        if (uatApproverValidation) {
            setActiveUatStep(1);
            toast.error(`Data approver harus diperbaiki di UAT Tab 1: ${uatApproverValidation}`);
            return;
        }

        setSubmitting(true);
        try {
            const response = await projectService.submitUatExecution(project.id, buildUatExecutionPayload());
            const requiresDevelopmentRevision = response?.meta?.requires_development_revision === true;

            if (requiresDevelopmentRevision) {
                setSit2Approvals({});
                setSit3({ reviewNotes: '', docs: [] });
                setActiveSitStep(1);
                setActiveUatStep(2);
                toast.error('Revisi mayor tercatat sebagai Change Request. Proyek dikembalikan ke developer dan wajib menjalani SIT ulang.');
                addNotification?.(
                    'Change Request Mayor UAT',
                    `Proyek "${project.name}" dikembalikan ke developer. Setelah perbaikan, SIT harus diulang.`,
                    'warning',
                    '/pm/workspace'
                );
            } else {
                setActiveUatStep(3);
                toast.success(uat2Summary.minorCount > 0
                    ? 'Hasil UAT tersimpan. Revisi minor dapat dikerjakan tanpa rollback; lanjut ke Persetujuan Final.'
                    : 'Seluruh skenario diterima. Lanjut ke Persetujuan Final UAT.');
            }
            refreshProject?.();
        } catch (error) {
            toast.error(`Hasil UAT gagal disimpan: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const updateUatMajorVerification = (source, itemId, field, value) => {
        const collectionKey = source === 'scenario' ? 'scenarios' : 'additionalRequests';
        setUat2(previous => ({
            ...previous,
            [collectionKey]: (previous[collectionKey] || []).map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
            ),
        }));
    };

    const handleSubmitUatMajorVerification = async () => {
        if (uatMajorVerificationValidation) {
            toast.error(uatMajorVerificationValidation);
            return;
        }

        setSubmitting(true);
        try {
            const response = await projectService.submitUatMajorVerification(project.id, {
                items: uatMajorVerificationItems.map(item => ({
                    source: item.source,
                    id: item.id,
                    result: item.verificationResult,
                    comment: item.verificationComment?.trim() || null,
                    attachments: (item.verificationAttachments || []).map(document => ({ docId: document.docId })),
                })),
            });
            const requiresAnotherRevision = response?.meta?.requires_development_revision === true;
            if (requiresAnotherRevision) {
                setActiveUatStep(2);
                toast.error('Sebagian perbaikan Mayor masih belum sesuai. UAT kembali di-hold dan Change Request lanjutan dibuat.');
            } else {
                setActiveUatStep(3);
                toast.success('Seluruh perbaikan Mayor diterima. UAT dilanjutkan ke Persetujuan Final.');
            }
            refreshProject?.();
        } catch (error) {
            toast.error(`Verifikasi perbaikan Mayor gagal disimpan: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUATPass = async () => {
        setSubmitting(true);
        try {
            await uploadAllDrafts(setUat3, uat3.docs);
            await projectService.update(project.id, {
                status: 'DEV_COMPLETED',
                uatPassedAt: new Date().toISOString(),
                sitUatData: buildSitUatData({ activeUatStep: 3 }),
            });
            addNotification?.('BAST Diterbitkan — DEV COMPLETED!', `Proyek "${project.name}" lulus SIT & UAT Internal. Siap QA & Siber.`, 'success', '/pm/workspace');
            toast.success('🎉 BAST Diterbitkan! Proyek resmi berstatus DEV_COMPLETED.');
            refreshProject?.();
        } catch (error) {
            toast.error(`UAT belum dapat diselesaikan: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Matrix persetujuan UAT per orang dan per putaran ──
    const [uatApprovalMatrix, setUatApprovalMatrix] = useState(null);
    const [uatMatrixLoading, setUatMatrixLoading] = useState(false);
    const [uatApprovalNote, setUatApprovalNote] = useState('');
    const [uatApprovalSubmitting, setUatApprovalSubmitting] = useState(false);
    const canManageUatApprovals = ['super_admin', 'head_of_it'].includes(user?.role)
        || (['dev_analyst', 'project_manager'].includes(user?.role) && Number(project?.pm?.id || project?.pm_id) === Number(user?.id));
    const allUatApproved = uatApprovalMatrix?.all_approved === true;
    const hasRecordedUatApprovalDecision = (uatApprovalMatrix?.approvers || []).some(
        approver => approver.status !== 'pending'
    );
    const externalUatApprovers = (uatApprovalMatrix?.approvers || []).filter(
        approver => approver.approval_mode === 'external_link'
    );
    const currentUserUatApprovals = (uatApprovalMatrix?.approvers || []).filter(
        approver => approver.approval_mode === 'internal_account' && Number(approver.user_id) === Number(user?.id)
    );

    const loadUatApprovalMatrix = useCallback(async (showLoading = true) => {
        if (!project?.id || activeUatStep < 3) return;
        if (showLoading) setUatMatrixLoading(true);
        try {
            const response = await projectService.getUatApprovalMatrix(project.id);
            setUatApprovalMatrix(response?.data || null);
        } catch (error) {
            if (error.status !== 404) toast.error(`Gagal memuat matrix approval UAT: ${error.message}`);
        } finally {
            setUatMatrixLoading(false);
        }
    }, [activeUatStep, project]);

    useEffect(() => {
        let cancelled = false;
        if (!project?.id || activeUatStep < 3) return undefined;
        projectService.getUatApprovalMatrix(project.id)
            .then(response => {
                if (!cancelled) setUatApprovalMatrix(response?.data || null);
            })
            .catch(error => {
                if (!cancelled && error.status !== 404) toast.error(`Gagal memuat matrix approval UAT: ${error.message}`);
            });
        return () => { cancelled = true; };
    }, [activeUatStep, project?.id]);

    const handleSubmitUatApproval = async (approverId, decision = 'approved') => {
        if (!approverId || !project?.id) return;
        if (decision === 'rejected' && !uatApprovalNote.trim()) {
            toast.error('Alasan penolakan atau permintaan revisi wajib diisi.');
            return;
        }
        setUatApprovalSubmitting(true);
        try {
            await projectService.submitUatApproval(project.id, approverId, decision, uatApprovalNote.trim());
            toast.success(decision === 'approved' ? 'Persetujuan UAT Anda berhasil disimpan.' : 'Penolakan UAT berhasil disimpan.');
            setUatApprovalNote('');
            await loadUatApprovalMatrix();
            refreshProject?.();
        } catch (err) {
            toast.error(`Gagal menyimpan persetujuan: ${err.message}`);
        } finally {
            setUatApprovalSubmitting(false);
        }
    };

    const handleCopyExternalApprovalLink = async (approver) => {
        if (uatApprovalSubmitting) return;
        setUatApprovalSubmitting(true);
        try {
            const response = await projectService.generateUatApprovalLink(project.id, approver.id);
            const url = `${window.location.origin}/uat-approval/${response.data.token}`;
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
                toast.success(`Link pribadi untuk ${approver.name} berhasil dibuat dan disalin.`);
            } else {
                window.prompt(`Salin link pribadi untuk ${approver.name}:`, url);
            }
            await loadUatApprovalMatrix();
        } catch (error) {
            toast.error(`Gagal membuat link: ${error.message}`);
        } finally {
            setUatApprovalSubmitting(false);
        }
    };

    const handleRestartUatApprovalRound = async () => {
        if (!window.confirm('Putaran aktif akan ditutup dan seluruh approval harus dilakukan ulang. Lanjutkan?')) return;
        setUatApprovalSubmitting(true);
        try {
            await projectService.restartUatApprovalRound(project.id);
            await loadUatApprovalMatrix();
            toast.success('Putaran approval UAT baru berhasil dibuat dari peserta terbaru.');
        } catch (error) {
            toast.error(`Gagal membuat putaran baru: ${error.message}`);
        } finally {
            setUatApprovalSubmitting(false);
        }
    };

    const handleSyncUatApprovalRound = async () => {
        if (!window.confirm('Sinkronkan matrix Tab 3 dengan daftar approver terbaru di Tab 1? Approval yang sudah sah tetap dipertahankan.')) return;
        setUatApprovalSubmitting(true);
        try {
            const response = await projectService.syncUatApprovalRound(project.id);
            setUatApprovalMatrix(response?.data || null);
            toast.success('Matrix approval UAT berhasil disinkronkan dengan peserta Tab 1.');
            refreshProject?.();
        } catch (error) {
            toast.error(`Gagal menyinkronkan peserta approval: ${error.message}`);
        } finally {
            setUatApprovalSubmitting(false);
        }
    };

    // Riwayat Change Request, termasuk yang dibentuk otomatis dari UAT Tahap 2.
    const uatChangeRequests = sitUatData.uat_change_requests || [];
    // ── Handler: Kembalikan Task ke Developer (alur revisi task terintegrasi) ──
    const handleReturnTaskRevision = async () => {
        if (!showTaskRevisionModal) return;
        const note = (taskRevisions[showTaskRevisionModal.id] || '').trim();
        if (!note) {
            toast.error('Catatan arahan revisi wajib diisi!');
            return;
        }
        setSubmitting(true);
        try {
            await taskService.requestRevision(showTaskRevisionModal.id, note);
            // Tandai jejak revisi pada approval task (dihapus dari daftar OK)
            const next = { ...(normalizeApprovals(sit2Approvals) || {}) };
            const prev = next[String(showTaskRevisionModal.id)];
            next[String(showTaskRevisionModal.id)] = {
                ...(typeof prev === 'object' && prev !== null ? prev : { approved: false, comment: '', attachments: [] }),
                approved: false, approvedAt: null,
                revisedAt: new Date().toISOString(),
                revisedBy: sf(project?.pm, 'PM'),
            };
            setSit2Approvals(next);
            // Simpan ke backend agar jejak revisi + lampiran bukti tersimpan permanen
            await persistSitUatData({ sit2_task_approvals: next });
            toast.success(`Task "${showTaskRevisionModal.title}" dikembalikan ke developer untuk revisi.`);
            setShowTaskRevisionModal(null);
            setTaskRevisions(prev => { const c = { ...prev }; delete c[showTaskRevisionModal.id]; return c; });
            // Sinkronkan data proyek agar tab Manajemen Task / board developer langsung ter-update
            refreshProject?.();
        } catch (err) {
            toast.error(`Gagal mengirim revisi task: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="p-5 space-y-5">

            {/* ─── Master Phase Stepper ─────────────────────────────────── */}
            <div className="bg-gradient-to-r from-[#003a73] to-[#00529C] rounded-2xl p-5 text-white">
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

            {/* ─── GATE KEEPER SIT: Status Task Developer ───────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck size={16} className="text-sky-600" />
                    <h4 className="font-bold text-sm text-gray-800">Syarat Masuk SIT (Gate) — {isTargetedSitRetest ? 'Scope Revisi Mayor' : 'Task Developer'}</h4>
                </div>
                {(() => {
                    const gate = taskGate();
                    return (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-gray-700">Progress Task:</span>
                                <span className="font-bold text-sky-700">{gate.done}/{gate.total} Selesai</span>
                                {gate.incomplete.length > 0 && (
                                    <span className="text-red-600 font-semibold">({gate.incomplete.length} belum selesai)</span>
                                )}
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${gate.canStart ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                    style={{ width: `${gate.total ? Math.round((gate.done / gate.total) * 100) : 0}%` }} />
                            </div>
                            <p className={`text-xs ${gate.canStart ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {gate.total === 0
                                    ? 'Belum ada task developer. Buat & selesaikan task sebelum memulai SIT.'
                                    : gate.canStart
                                        ? `Semua task ${isTargetedSitRetest ? 'dalam scope revisi ' : ''}telah selesai. SIT siap dimulai.`
                                        : isTargetedSitRetest
                                            ? 'Masih ada task dalam scope revisi yang belum selesai atau belum memiliki assignee.'
                                            : 'Masih ada task yang belum selesai.'}
                            </p>
                        </div>
                    );
                })()}
            </div>

            {/* ─── REVISION ALERTS (tingkat proyek) ─────────────────────── */}
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
                        <p className="text-xs text-red-800 mt-0.5">Change Request mayor harus diselesaikan developer. Setelah perbaikan, jalankan SIT ulang; jika lulus, kembali ke UAT Tab 2 untuk memverifikasi hanya item Mayor sebelum Persetujuan Final.</p>
                    </div>
                </div>
            )}

            {/* ═══ SIT PANEL ═══ */}
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
                {(!sitDone && stUpper !== 'SIT_IN_PROGRESS' && !UNLOCK_ALL_STAGES) && (
                    <div className="p-6">
                        <RevisionBanner revisions={revisions} type="SIT_TO_DEV" />
                        <RevisionBanner revisions={revisions} type="UAT_TO_DEV" />
                        <RevisionBanner revisions={revisions} type="UAT_CHANGE_MAYOR" />
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
                {(stUpper === 'SIT_IN_PROGRESS' || sitDone || UNLOCK_ALL_STAGES) && (
                    <div>
                        {/* Sub-step tabs */}
                        <div className="flex border-b border-gray-100 bg-gray-50/50 px-3 overflow-x-auto">
                            {SIT_STEPS.map(step => (
                                <StepTab
                                    key={step.id}
                                    step={step}
                                    isActive={activeSitStep === step.id}
                                    isCompleted={step.id === 1 ? sit1Done : step.id === 2 ? sit2Done : sit3Done}
                                    onClick={() => (sitDone || UNLOCK_ALL_STAGES || step.id <= activeSitStep) && setActiveSitStep(step.id)}
                                />
                            ))}
                        </div>

                        {/* ── SIT Step 1: Persiapan ──────────────────────── */}
                        {activeSitStep === 1 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <BookOpen size={16} className="text-blue-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 1: Persiapan SIT</h5>
                                    {sit1Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>
                                <p className="text-xs text-gray-500 mb-3">
                                    {isTargetedSitRetest
                                        ? 'SIT ulang ini bersifat terarah. Environment tetap disiapkan, tetapi skenario hanya mencakup task yang terkena Change Request Mayor pada siklus aktif.'
                                        : 'Lengkapi environment yang akan diuji. Jumlah skenario otomatis mengikuti task yang sudah Selesai.'}
                                </p>

                                {isTargetedSitRetest && (
                                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex items-start gap-3 text-violet-800">
                                        <RotateCcw size={16} className="shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold">SIT Ulang Terarah — Siklus #{sitRetestCycle}</p>
                                            <p className="text-[11px] mt-1 leading-relaxed">
                                                Hanya {sitRetestTaskIds.length} task yang terdampak revisi/request Mayor yang diuji ulang. Task lain mempertahankan hasil SIT sebelumnya dan tidak masuk ke tabel eksekusi siklus ini.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Kartu utama: URL Staging + jumlah skenario */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2 bg-white border border-gray-200 rounded-2xl p-4">
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className="w-9 h-9 bg-sky-100 rounded-xl flex items-center justify-center">
                                                <Server size={18} className="text-sky-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-800">URL Environment Staging / Testing</p>
                                                <p className="text-[10px] text-gray-400">Alamat aplikasi yang siap diuji integrasi</p>
                                            </div>
                                        </div>
                                        <input type="text" value={sit1.stagingUrl} onChange={e => setSit1(p => ({ ...p, stagingUrl: e.target.value }))}
                                            placeholder={import.meta.env.VITE_STAGING_URL || "https://staging.banknagari.co.id"} disabled={sitDone}
                                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-2xl p-4 flex flex-col justify-center">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-sky-200">
                                                <CheckSquare size={18} className="text-sky-600" />
                                            </div>
                                            <p className="text-xs font-bold text-sky-800">Jumlah Skenario Uji SIT</p>
                                        </div>
                                        <div className="flex items-end gap-2 mt-3">
                                            <span className="font-black text-4xl text-sky-700 leading-none">{taskGate().done}</span>
                                            <span className="text-[10px] text-sky-600 font-semibold mb-1">task selesai</span>
                                        </div>
                                        <div className="mt-2 h-1.5 bg-sky-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${taskGate().total > 0 ? Math.min(100, Math.round((taskGate().done / taskGate().total) * 100)) : 0}%` }} />
                                        </div>
                                        <p className="text-[10px] text-sky-600/80 mt-1.5">
                                            {taskGate().total > 0
                                                ? `${taskGate().done} dari ${taskGate().total} task selesai`
                                                : 'Belum ada task developer'}
                                        </p>
                                    </div>
                                </div>

                                {/* Info & kesiapan */}
                                <div className={`rounded-xl border p-3 text-xs flex items-center gap-2.5 ${taskGate().canStart ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                                    {taskGate().canStart
                                        ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                        : <AlertTriangle size={15} className="text-amber-500 shrink-0" />}
                                    <span className="font-semibold">
                                        {taskGate().canStart
                                            ? `Semua task ${isTargetedSitRetest ? 'dalam scope revisi ' : ''}sudah Selesai — SIT siap dilaksanakan.`
                                            : `Masih ada ${taskGate().incomplete.length} task dalam scope yang belum selesai.`}
                                    </span>
                                </div>

                                {!sitDone && (status === 'SIT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeSitStep === 1 && (
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => handleSaveSITStep(1)} disabled={!sit1.stagingUrl}
                                            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm">
                                            Simpan &amp; Lanjut Eksekusi <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SIT Step 2: Eksekusi ───────────────────────── */}
                        {activeSitStep === 2 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Bug size={16} className="text-indigo-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 2: Eksekusi &amp; Persetujuan Task SIT</h5>
                                    {sit2Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>

                                {/* Ringkasan statistik otomatis */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Task (Skenario)</p>
                                        <p className="font-black text-xl text-slate-800 mt-1">{taskGate().total}</p>
                                        <p className="text-[10px] text-gray-400">semua task non Take Down</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Task Selesai</p>
                                        <p className="font-black text-xl text-sky-600 mt-1">{taskGate().done}</p>
                                        <p className="text-[10px] text-gray-400">dari total task</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Task Disetujui (OK)</p>
                                        <p className="font-black text-xl text-emerald-600 mt-1">{approvedTaskCount} <span className="text-sm text-gray-400">/ {taskGate().total}</span></p>
                                        <p className="text-[10px] text-gray-400">lolos SIT</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Task dengan Temuan</p>
                                        <p className="font-black text-xl text-orange-500 mt-1">{defectTaskCount}</p>
                                        <p className="text-[10px] text-gray-400">komentar/temuan terisi</p>
                                    </div>
                                </div>

                                {/* Pass rate otomatis */}
                                {taskGate().total > 0 && (
                                    <div className={`rounded-xl p-3 flex items-center gap-3 text-xs ${approvedTaskCount === taskGate().total ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-indigo-50 border border-indigo-200 text-indigo-800'}`}>
                                        <Info size={14} className="shrink-0" />
                                        <span className="font-semibold">
                                            Pass Rate Task: {taskGate().total > 0 ? Math.round((approvedTaskCount / taskGate().total) * 100) : 0}%
                                            {!sit2Validation
                                                ? ' ✓ Seluruh syarat lengkap — siap dilanjutkan ke approval.'
                                                : approvedTaskCount === taskGate().total
                                                    ? ` ⚠ ${sit2Validation}`
                                                    : ' ⚠ Masih ada task dalam scope yang belum disetujui (OK).'}
                                        </span>
                                    </div>
                                )}

                                {/* TABLE PERSETUJUAN TASK DEVELOPER (Syarat Lanjut SIT) */}
                                <div className="pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 size={15} className="text-indigo-600" />
                                        <h5 className="font-bold text-sm text-gray-800">Persetujuan Task Developer (Syarat Lanjut SIT)</h5>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mb-2">
                                        Centang <strong>OK</strong> pada setiap task dalam scope yang sudah lolos. Lampirkan <strong>bukti pengujian baru</strong> per task. Gunakan <strong>Revisi</strong> bila hasil belum sesuai. Lanjut ke Review &amp; Sign-Off hanya jika seluruh task dalam scope disetujui.
                                    </p>
                                    <SITTaskExecution
                                        project={project}
                                        approvals={sit2Approvals}
                                        onApprovalsChange={handleApprovalsChange}
                                        onRequestRevision={setShowTaskRevisionModal}
                                        taskIds={eligibleTaskIds}
                                        isTargetedRetest={isTargetedSitRetest}
                                    />
                                </div>

                                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-indigo-800">
                                    {isTargetedSitRetest
                                        ? <>Simpan sebagai <strong>draft</strong> jika pengujian belum selesai. Finalisasi hanya dapat dilakukan setelah seluruh task dalam scope selesai, disetujui, dan memiliki lampiran bukti baru untuk siklus ini.</>
                                        : <>Simpan sebagai <strong>draft</strong> jika pengujian atau revisi belum selesai. Finalisasi hanya dapat dilakukan setelah seluruh task selesai dan disetujui, serta task hasil revisi memiliki lampiran bukti baru.</>}
                                </div>

                                {!sitDone && (status === 'SIT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeSitStep === 2 && (
                                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                                        <button onClick={handleSaveSITDraft} disabled={submitting || taskGate().total === 0}
                                            className="px-5 py-2.5 bg-white hover:bg-indigo-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-indigo-700 border border-indigo-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer">
                                            {submitting ? <Clock size={14} /> : <Save size={14} />}
                                            {submitting ? 'Menyimpan...' : 'Simpan sebagai Draft'}
                                        </button>
                                        <button onClick={() => handleSaveSITStep(2)} disabled={Boolean(sit2Validation) || submitting}
                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer">
                                            Simpan Final &amp; Lanjut Approval <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SIT Step 3: Sign-off ───────────────────────── */}
                        {activeSitStep === 3 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <FileCheck size={16} className="text-teal-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 3: Review Akhir &amp; Keputusan SIT</h5>
                                    {sit3Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>
                                <p className="text-xs text-gray-500 mb-2">
                                    Ringkasan hasil pengujian otomatis dari data SIT. SIT dinyatakan lulus hanya setelah persetujuan dari <strong>Developer</strong>, <strong>PM / Analyst Pengembangan</strong>, dan <strong>Development Lead</strong> lengkap.
                                </p>

                                {/* ── Ringkasan Hasil SIT (otomatis per bagian) ── */}
                                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs space-y-3">
                                    <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Ringkasan Hasil SIT</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                        {[
                                            { label: 'Environment', val: sit1.stagingUrl || '-', icon: <Server size={13} className="text-sky-500" /> },
                                            { label: 'Skenario Uji', val: `${taskGate().done}`, icon: <CheckSquare size={13} className="text-sky-500" /> },
                                            { label: 'Task Disetujui', val: `${approvedTaskCount} / ${taskGate().total}`, icon: <UserCheck size={13} className="text-emerald-500" /> },
                                            { label: 'Task dengan Temuan', val: `${defectTaskCount}`, icon: <AlertTriangle size={13} className="text-orange-500" /> },
                                            { label: 'Persetujuan', val: allSitApproved ? '3/3 ✓' : `${(devApproved ? 1 : 0) + (sit3Approvals?.pm?.approved ? 1 : 0) + (sit3Approvals?.development_lead?.approved ? 1 : 0)}/3`, icon: <ShieldCheck size={13} className="text-teal-500" /> },
                                        ].map(s => (
                                            <div key={s.label} className="bg-white rounded-xl p-2.5 border border-slate-200">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    {s.icon}
                                                    <p className="text-[9px] font-bold uppercase">{s.label}</p>
                                                </div>
                                                <p className="font-bold text-slate-800 text-xs mt-1 break-all">{s.val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Persetujuan Multi-Role ── */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ShieldCheck size={15} className="text-teal-600" />
                                        <h6 className="font-bold text-sm text-gray-800">Persetujuan SIT</h6>
                                        <span className="ml-auto text-[10px] font-bold text-gray-500">
                                            {approvedDeveloperCount}/{requiredDeveloperCount} Dev • {sit3Approvals?.pm?.approved ? '✓' : '•'} PM • {sit3Approvals?.development_lead?.approved ? '✓' : '•'} Lead
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { key: 'developer', label: 'Developer', desc: requiredDeveloperCount > 0 ? `Semua ${requiredDeveloperCount} pengembang harus menyetujui` : 'Pengembang yang mengerjakan task', color: 'blue', icon: <UserCheck size={16} className="text-blue-500" /> },
                                            { key: 'pm', label: 'PM / Analyst Pengembangan', desc: 'Project Manager proyek', color: 'amber', icon: <Users size={16} className="text-amber-500" /> },
                                            { key: 'development_lead', label: 'Development Lead', desc: 'Pimpinan pengembangan', color: 'emerald', icon: <ShieldCheck size={16} className="text-emerald-500" /> },
                                        ].map(r => {
                                            const isDev = r.key === 'developer';
                                            const ap = sit3Approvals?.[r.key];
                                            let approved = false;
                                            let detail = null;
                                            if (isDev) {
                                                approved = devApproved;
                                                detail = devApproved
                                                    ? `✓ ${approvedDeveloperCount}/${requiredDeveloperCount} developer menyetujui`
                                                    : approvedDeveloperCount > 0
                                                        ? `${approvedDeveloperCount}/${requiredDeveloperCount} developer menyetujui`
                                                        : 'Belum ada developer menyetujui';
                                            } else {
                                                approved = ap?.approved === true;
                                                detail = approved
                                                    ? `✓ ${ap.approvedBy} • ${fmtDate(ap.at)}`
                                                    : 'Belum memberikan persetujuan';
                                            }
                                            const colorMap = { blue: 'blue', amber: 'amber', emerald: 'emerald' }[r.color];
                                            return (
                                                <div key={r.key} className={`rounded-xl border p-3 transition-all ${approved ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${approved ? 'bg-emerald-100' : `bg-${colorMap}-100`}`}>
                                                            {r.icon}
                                                        </div>
                                                        {approved ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold border border-emerald-200 flex items-center gap-1">
                                                                <CheckCircle2 size={9} /> Disetujui
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold">Menunggu</span>
                                                        )}
                                                    </div>
                                                    <p className="font-bold text-gray-800 text-xs mt-2">{r.label}</p>
                                                    <p className="text-[10px] text-gray-400">{r.desc}</p>
                                                    <p className={`text-[10px] mt-1.5 ${approved ? 'text-emerald-700' : 'text-gray-400'}`}>{detail}</p>
                                                    {isDev && (ap?.developers || []).length > 0 && (
                                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                                            {(ap.developers || []).map(d => (
                                                                <span key={d.userId ?? d.name} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-semibold border border-emerald-200">
                                                                    {d.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Form approval untuk role saat ini */}
                                    {currentRoleKey === 'developer' && isCurrentUserRequiredDeveloper && !hasCurrentDeveloperApproved && !sitDone && (
                                        <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
                                            <p className="text-[11px] font-bold text-teal-800 mb-2 flex items-center gap-1.5">
                                                <UserCheck size={13} /> Anda (sebagai Developer) dapat menyetujui SIT
                                            </p>
                                            <textarea
                                                rows={2}
                                                value={sitApprovalNote}
                                                onChange={e => setSitApprovalNote(e.target.value)}
                                                placeholder="Catatan persetujuan (opsional)..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-teal-500 bg-white resize-none"
                                            />
                                            <button
                                                onClick={handleSubmitSitApproval}
                                                disabled={sitApprovalSubmitting}
                                                className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                {sitApprovalSubmitting ? (
                                                    <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                                                ) : (
                                                    <><CheckCircle2 size={13} /> Setujui SIT</>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    {currentRoleKey === 'developer' && isCurrentUserRequiredDeveloper && hasCurrentDeveloperApproved && (
                                        <p className="text-[10px] text-emerald-600 mt-2 flex items-center gap-1">
                                            <CheckCircle2 size={11} /> Anda telah menyetujui SIT pada proyek ini.
                                        </p>
                                    )}
                                    {currentRoleKey && currentRoleKey !== 'developer' && !sit3Approvals?.[currentRoleKey]?.approved && !sitDone && (
                                        <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
                                            <p className="text-[11px] font-bold text-teal-800 mb-2 flex items-center gap-1.5">
                                                <UserCheck size={13} /> Anda (sebagai {currentRoleKey === 'development_lead' ? 'Development Lead' : 'PM / Analyst Pengembangan'}) dapat menyetujui SIT
                                            </p>
                                            <textarea
                                                rows={2}
                                                value={sitApprovalNote}
                                                onChange={e => setSitApprovalNote(e.target.value)}
                                                placeholder="Catatan persetujuan (opsional)..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-teal-500 bg-white resize-none"
                                            />
                                            <button
                                                onClick={handleSubmitSitApproval}
                                                disabled={sitApprovalSubmitting}
                                                className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                {sitApprovalSubmitting ? (
                                                    <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                                                ) : (
                                                    <><CheckCircle2 size={13} /> Setujui SIT</>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    {currentRoleKey && currentRoleKey !== 'developer' && sit3Approvals?.[currentRoleKey]?.approved && (
                                        <p className="text-[10px] text-emerald-600 mt-2 flex items-center gap-1">
                                            <CheckCircle2 size={11} /> Anda telah menyetujui SIT pada proyek ini.
                                        </p>
                                    )}
                                </div>

                                {/* Catatan Review Akhir (PM) */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Review Akhir / Keputusan</label>
                                    <textarea rows={3} value={sit3.reviewNotes} onChange={e => setSit3(p => ({ ...p, reviewNotes: e.target.value }))}
                                        placeholder="Pernyataan keputusan: sistem telah diuji terintegrasi dan dinyatakan memenuhi kriteria SIT..." disabled={sitDone}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-teal-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                </div>

                                {/* Dokumen Hasil Review */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Hasil Review / Berita Acara SIT</label>
                                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold uppercase">Wajib</span>
                                        </div>
                                        {!sitDone && !isViewer && (
                                            <label className={`px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${uploadingCategory === 'SIT_SIGNOFF' ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}>
                                                {uploadingCategory === 'SIT_SIGNOFF' ? (
                                                    <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Mengunggah...</>
                                                ) : (
                                                    <><Upload size={12} /> Upload</>
                                                )}
                                                <input type="file" ref={sit3FileRef} multiple accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip" disabled={isSitSignOffUploading} onChange={e => onUpload(e, setSit3, 'SIT_SIGNOFF')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mb-2">
                                        Minimal satu dokumen harus selesai diunggah ke server sebelum SIT dapat dinyatakan lulus.
                                    </p>
                                    <DocList
                                        docs={sit3.docs}
                                        onRemove={removeSitSignOffDocument}
                                        onView={viewDoc}
                                        onDownload={downloadDoc}
                                        docTypeOptions={docTypeOptions('SIT_SIGNOFF')}
                                        readOnly={sitDone || isSitSignOffUploading}
                                        allowTypeChange={false}
                                    />
                                    {hasUploadedSitSignOffDocument ? (
                                        <p className="mt-2 text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                                            <CheckCircle2 size={11} /> Dokumen wajib telah tersimpan di server.
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-[10px] font-semibold text-amber-700 flex items-center gap-1">
                                            <AlertTriangle size={11} /> Tombol lanjut ke UAT tetap terkunci sampai dokumen berhasil diunggah.
                                        </p>
                                    )}
                                </div>

                                {/* Action buttons (hanya non-viewer) — revisi dilakukan di Tahap 2 */}
                                {!sitDone && !isViewer && (status === 'SIT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeSitStep === 3 && (
                                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
                                        <button
                                            onClick={handleSITPass}
                                            disabled={submitting || !canPassSit}
                                            title={sitPassBlockedReason}
                                            className={`w-full px-6 py-3 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${canPassSit && !submitting ? 'bg-teal-600 hover:bg-teal-700 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'}`}
                                        >
                                            {submitting ? (
                                                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Memproses Kelulusan SIT...</>
                                            ) : (
                                                <><CheckCircle2 size={14} /> {sitUatData.uat2_resume_after_sit ? 'SIT Ulang Lulus — Verifikasi Mayor di UAT' : 'SIT Lulus — Lanjut ke UAT Internal'}</>
                                            )}
                                        </button>
                                        {sitPassBlockedReason && (
                                            <p className="text-[10px] text-amber-700 text-right flex items-center justify-end gap-1">
                                                <Lock size={10} /> {sitPassBlockedReason}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {sitDone && (
                                    <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800">
                                        <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                                        <span className="font-semibold">SIT dinyatakan LULUS. Lanjutkan ke fase UAT Internal.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ UAT PANEL ═══ */}
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
                {(status === 'SIT_PASSED' && !UNLOCK_ALL_STAGES) && (
                    <div className="p-6 text-center">
                        <CheckSquare size={36} className="mx-auto text-amber-400 mb-3" />
                        <p className="text-sm font-semibold text-gray-700 mb-1">
                            {uat2AwaitingMajorVerification ? 'SIT ulang telah lulus! Siap memverifikasi perbaikan Mayor.' : 'SIT telah lulus! Siap memulai UAT Internal.'}
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                            {uat2AwaitingMajorVerification ? 'Hasil UAT sebelumnya tetap terkunci; hanya item Mayor yang perlu diverifikasi ulang oleh user.' : 'Pastikan PM dan perwakilan Divisi Peminta sudah siap untuk pengujian fungsional bisnis.'}
                        </p>
                        <button
                            onClick={handleStartUAT}
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 mx-auto"
                        >
                            <ArrowRight size={16} /> {uat2AwaitingMajorVerification ? 'Verifikasi Perbaikan Mayor' : 'Mulai UAT Internal'}
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
                {(status === 'UAT_IN_PROGRESS' || uatDone || UNLOCK_ALL_STAGES) && (
                    <div>
                        {/* Sub-step tabs */}
                        <div className="flex border-b border-gray-100 bg-gray-50/50 px-3 overflow-x-auto">
                            {UAT_STEPS.map(step => (
                                <StepTab
                                    key={step.id}
                                    step={step}
                                    isActive={activeUatStep === step.id}
                                    isCompleted={step.id === 1 ? uat1Done : step.id === 2 ? uat2Done : uat3Done}
                                    onClick={() => (uatDone || UNLOCK_ALL_STAGES || step.id <= activeUatStep) && setActiveUatStep(step.id)}
                                />
                            ))}
                        </div>

                        {/* ── UAT Step 1: Skenario ─────────────────────── */}
                        {activeUatStep === 1 && (
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <ClipboardList size={16} className="text-amber-600" />
                                    <h5 className="font-bold text-sm text-gray-800">Tahap 1: Persiapan Skenario UAT</h5>
                                    {uat1Done && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>
                                <p className="text-xs text-gray-500 mb-2">
                                    Skenario UAT otomatis mengikuti task yang telah dikerjakan. Lengkapi peserta yang terlibat &amp; jadwal pelaksanaan.
                                </p>

                                {/* Ringkasan skenario otomatis */}
                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
                                    <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center border border-amber-200">
                                        <ClipboardList size={20} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-amber-800">Jumlah Skenario UAT</p>
                                        <div className="flex items-end gap-2 mt-1">
                                            <span className="font-black text-3xl text-amber-700 leading-none">{uatScenarioTasks.length}</span>
                                            <span className="text-[10px] text-amber-600 font-semibold mb-1">skenario dari task</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Daftar skenario (otomatis dari task, bisa diedit) */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Daftar Skenario UAT Bisnis</label>
                                        <span className="text-[10px] text-gray-400">{uatScenarioTasks.length} task terdeteksi</span>
                                    </div>
                                    {uatScenarioTasks.length > 0 && (
                                        <div className="mb-3 rounded-xl bg-gray-50 border border-gray-100 p-2 max-h-32 overflow-y-auto space-y-1">
                                            {uatScenarioTasks.map((t, i) => (
                                                <div key={t.id} className="flex items-center gap-2 text-[11px] text-gray-600">
                                                    <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-md flex items-center justify-center font-bold text-[9px] shrink-0">{i + 1}</span>
                                                    <span className="truncate">{t.title || t.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <textarea rows={3} value={uat1.scenarioList} onChange={e => setUat1(p => ({ ...p, scenarioList: e.target.value }))}
                                        placeholder={uatScenarioTasks.length > 0 ? 'Skenario otomatis dari task di atas. Anda dapat menyesuaikan atau menambahkan detail.' : 'Daftar skenario UAT bisnis...'} disabled={uatDone}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                </div>

                                {/* Informasi proyek: unit peminta, tanggal, disiapkan oleh */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Unit / Divisi Peminta *</label>
                                        <input type="text" value={uat1.unit} onChange={e => setUat1(p => ({ ...p, unit: e.target.value }))}
                                            placeholder="Otomatis dari business user pemohon" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                        <p className="text-[10px] text-gray-400 mt-1">Otomatis dari divisi pemohon (business user).</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Tanggal Pelaksanaan *</label>
                                        <input
                                            type="date"
                                            lang="id-ID"
                                            value={uat1.startDate}
                                            onChange={e => setUat1(p => ({ ...p, startDate: e.target.value }))}
                                            placeholder="dd/mm/yyyy"
                                            aria-label="Tanggal Pelaksanaan UAT"
                                            aria-invalid={!uat1.startDate}
                                            disabled={uatDone}
                                            className={`w-full px-3 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-amber-500 disabled:bg-gray-100 ${uat1.startDate ? 'border-gray-200 bg-gray-50' : 'border-amber-300 bg-amber-50/50 text-gray-500'}`}
                                        />
                                        {!uat1.startDate && !uatDone && (
                                            <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                                                <AlertTriangle size={10} /> Belum dipilih — tentukan tanggal pelaksanaan UAT.
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Disiapkan Oleh (PM / Analis Pengembangan) *</label>
                                        <input type="text" value={uat1.preparedBy} onChange={e => setUat1(p => ({ ...p, preparedBy: e.target.value }))}
                                            placeholder="Otomatis dari PM / Analyst Pengembangan" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                        <p className="text-[10px] text-gray-400 mt-1">Otomatis dari PM / Analyst Pengembangan proyek.</p>
                                    </div>
                                </div>

                                {/* Peserta yang terlibat */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Peserta yang Terlibat</label>
                                        {!uatDone && !isViewer && canManageUatApprovals && (
                                            <button onClick={handleAddUatParticipant} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer">
                                                <Plus size={12} /> Tambah Peserta
                                            </button>
                                        )}
                                    </div>
                                    <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                                        <p className="text-[11px] font-bold text-blue-800">Cara pengisian yang baru</p>
                                        <ol className="mt-1.5 grid gap-1 text-[10px] leading-relaxed text-blue-700 sm:grid-cols-3">
                                            <li><strong>1.</strong> Pilih keterlibatan atau posisi approval.</li>
                                            <li><strong>2.</strong> Pihak IT dipilih dari akun; identitas terisi otomatis.</li>
                                            <li><strong>3.</strong> Link pihak peminta dibuat PM di UAT Tab 3 setelah hasil Tab 2 disimpan final.</li>
                                        </ol>
                                    </div>
                                    {uat1.participants.length === 0 ? (
                                        <p className="text-[11px] text-gray-400 italic">Peserta akan terisi otomatis dari pihak yang terlibat dalam proyek.</p>
                                    ) : (
                                        <div className="border border-gray-200 rounded-xl overflow-x-auto">
                                            <table className="table-auto w-full min-w-[1050px] text-left text-xs">
                                                <thead>
                                                    <tr className="bg-gray-100/80 border-b border-gray-200 text-gray-600 text-[11px] font-bold uppercase tracking-wider">
                                                        <th className="py-2.5 px-4 text-left">Nama Peserta</th>
                                                        <th className="py-2.5 px-4 text-left">Peran / Kedudukan</th>
                                                        <th className="py-2.5 px-4 text-left">Divisi</th>
                                                        <th className="py-2.5 px-4 text-left">No. HP Verifikasi</th>
                                                        <th className="py-2.5 px-4 text-left min-w-72">Keterlibatan &amp; Approval</th>
                                                        <th className="py-2.5 px-4 text-center w-24">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {uat1.participants.map((p, idx) => {
                                                        const isEditing = editingUatIdx === idx;
                                                        const editable = !uatDone && !isViewer && canManageUatApprovals;
                                                        const approvalRole = UAT_APPROVAL_ROLES.find(role => role.value === p.approvalRole);
                                                        const hasInvalidPhone = p.approvalMode === 'external_link'
                                                            && Boolean(p.phone?.trim())
                                                            && !normalizeIndonesianPhone(p.phone);
                                                        const eligibleInternalAccounts = uatInternalUsers.filter(account => (
                                                            (UAT_INTERNAL_ACCOUNT_ROLES[p.approvalRole] || []).includes(account.role)
                                                            && (p.approvalRole !== 'developer' || projectDeveloperUserIds.has(Number(account.id)))
                                                        ));
                                                        return (
                                                            <tr key={idx} className={`hover:bg-amber-50/40 transition-colors ${isEditing ? 'bg-amber-50/60' : ''}`}>
                                                                {/* Nama */}
                                                                <td className="py-2.5 px-4 text-gray-800 font-medium">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={p.name}
                                                                            onChange={e => handleUatParticipantChange(idx, 'name', e.target.value)}
                                                                            placeholder={p.approvalMode === 'internal_account' ? 'Terisi dari akun IT' : 'Nama peserta'}
                                                                            disabled={p.approvalMode === 'internal_account'}
                                                                            className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs focus:outline-none focus:border-amber-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                                                                        />
                                                                    ) : (p.name || <span className="text-gray-400 italic">-</span>)}
                                                                </td>
                                                                {/* Peran */}
                                                                <td className="py-2.5 px-4 text-gray-600">
                                                                    {isEditing ? (
                                                                        p.isApprover === true ? (
                                                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
                                                                                {approvalRole?.label || 'Pilih posisi approval'}
                                                                            </div>
                                                                        ) : (
                                                                            <input
                                                                                type="text"
                                                                                value={p.role}
                                                                                onChange={e => handleUatParticipantChange(idx, 'role', e.target.value)}
                                                                                placeholder="Contoh: Saksi UAT / Pengguna aplikasi"
                                                                                className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs focus:outline-none focus:border-amber-500 bg-white"
                                                                            />
                                                                        )
                                                                    ) : ((p.isApprover ? approvalRole?.label : p.role) || <span className="text-gray-400 italic">-</span>)}
                                                                </td>
                                                                {/* Divisi */}
                                                                <td className="py-2.5 px-4 text-gray-600">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={p.unit}
                                                                            onChange={e => handleUatParticipantChange(idx, 'unit', e.target.value)}
                                                                            placeholder="Divisi"
                                                                            disabled={p.approvalMode === 'internal_account'}
                                                                            className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs focus:outline-none focus:border-amber-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                                                                        />
                                                                    ) : (p.unit || <span className="text-gray-400 italic">-</span>)}
                                                                </td>
                                                                {/* Nomor HP hanya diperlukan untuk approval melalui link eksternal */}
                                                                <td className="py-2.5 px-4 text-gray-600">
                                                                    {p.approvalMode !== 'external_link' ? (
                                                                        <span className="text-[10px] italic text-gray-400">Tidak diperlukan</span>
                                                                    ) : isEditing ? (
                                                                        <div>
                                                                            <input
                                                                                type="tel"
                                                                                inputMode="tel"
                                                                                value={p.phone || ''}
                                                                                onChange={e => handleUatParticipantChange(idx, 'phone', e.target.value)}
                                                                                placeholder="Contoh: 0812-3456-7890"
                                                                                aria-invalid={hasInvalidPhone}
                                                                                className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs focus:outline-none ${hasInvalidPhone ? 'border-red-400 focus:border-red-500' : 'border-amber-300 focus:border-amber-500'}`}
                                                                            />
                                                                            {hasInvalidPhone ? (
                                                                                <p className="mt-1 text-[9px] font-semibold text-red-600">Gunakan format 08... atau +62...</p>
                                                                            ) : null}
                                                                        </div>
                                                                    ) : (p.phone || <span className="font-semibold text-red-600">Belum diisi</span>)}
                                                                </td>
                                                                {/* Konfigurasi approval */}
                                                                <td className="py-2.5 px-4 text-gray-600">
                                                                    {isEditing ? (
                                                                        <div className="space-y-2">
                                                                            <label className="block text-[9px] font-bold uppercase tracking-wide text-gray-500">Pilih keterlibatan</label>
                                                                            <select
                                                                                value={p.isApprover === true ? (p.approvalRole || '') : 'participant'}
                                                                                onChange={e => handleUatParticipantChange(idx, 'participationType', e.target.value)}
                                                                                className="w-full px-2.5 py-2 border border-amber-300 rounded-lg text-xs bg-white focus:outline-none focus:border-amber-500"
                                                                            >
                                                                                <option value="participant">Peserta UAT saja — tidak approval</option>
                                                                                <optgroup label="Pihak Peminta — link pribadi + nomor HP">
                                                                                    {UAT_APPROVAL_ROLES.filter(role => role.side === 'requester').map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                                                                                </optgroup>
                                                                                <optgroup label="Pihak IT — menggunakan akun aplikasi">
                                                                                    {UAT_APPROVAL_ROLES.filter(role => role.side === 'it').map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                                                                                </optgroup>
                                                                            </select>
                                                                            {p.approvalMode === 'internal_account' && (
                                                                                <>
                                                                                    <label className="block text-[9px] font-bold uppercase tracking-wide text-gray-500">Akun pihak IT</label>
                                                                                    <select value={p.userId || ''}
                                                                                        onChange={e => handleUatParticipantChange(idx, 'userId', e.target.value)}
                                                                                        className="w-full px-2.5 py-2 border border-blue-300 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500">
                                                                                        <option value="">Pilih akun sesuai kedudukan</option>
                                                                                        {eligibleInternalAccounts.map(account => <option key={account.id} value={account.id}>{account.name} — {account.role_detail?.display_name || account.role}</option>)}
                                                                                    </select>
                                                                                    {eligibleInternalAccounts.length > 0 ? (
                                                                                        <p className="text-[9px] text-blue-600">{p.approvalRole === 'developer' ? 'Hanya developer yang mengerjakan task proyek ini yang ditampilkan. ' : ''}Nama, divisi, dan kedudukan akan terisi otomatis dari akun yang dipilih. Nomor HP tidak diperlukan karena approval dilakukan melalui akun.</p>
                                                                                    ) : (
                                                                                        <p className="text-[9px] font-semibold text-red-600">Belum ada akun dengan role yang sesuai. Tambahkan atau perbaiki role akun melalui pengelolaan pengguna.</p>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            {p.approvalMode === 'external_link' && (
                                                                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[9px] leading-relaxed text-amber-700">
                                                                                    PM akan membuat link pribadi di <strong>UAT Tab 3</strong>. Penerima wajib memasukkan nomor HP yang dicatat pada baris ini.
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : p.isApprover === true ? (
                                                                        <div>
                                                                            <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-bold ${p.approvalMode === 'external_link' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                                {p.approvalMode === 'external_link' ? 'LINK PRIBADI + NO. HP' : 'AKUN INTERNAL'}
                                                                            </span>
                                                                            <p className="mt-1 font-semibold text-[11px]">{approvalRole?.label || 'Posisi belum dipilih'}</p>
                                                                        </div>
                                                                    ) : <span className="text-gray-400 italic">Peserta saja</span>}
                                                                </td>
                                                                {/* Aksi */}
                                                                <td className="py-2.5 px-4 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {editable && (
                                                                            isEditing ? (
                                                                                <button
                                                                                    onClick={handleUatParticipantDone}
                                                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                                                                    title="Selesai & simpan"
                                                                                >
                                                                                    <Check size={15} />
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => setEditingUatIdx(idx)}
                                                                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                                                    title="Edit peserta"
                                                                                >
                                                                                    <Edit size={15} />
                                                                                </button>
                                                                            )
                                                                        )}
                                                                        {editable && (
                                                                            <button
                                                                                onClick={() => handleRemoveUatParticipant(idx)}
                                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                                                title="Hapus peserta"
                                                                            >
                                                                                <Trash2 size={15} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {uatApproverValidation ? (
                                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                            <span><strong>Konfigurasi approval belum lengkap:</strong> {uatApproverValidation}</span>
                                        </div>
                                    ) : (
                                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-700">
                                            <CheckCircle2 size={14} /> Matrix approver UAT sudah lengkap.
                                        </div>
                                    )}
                                </div>

                                {/* Catatan persiapan */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Persiapan UAT</label>
                                    <input type="text" value={uat1.prepNotes} onChange={e => setUat1(p => ({ ...p, prepNotes: e.target.value }))}
                                        placeholder="Keterangan tambahan..." disabled={uatDone}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                </div>

                                {/* Dokumen Undangan UAT */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div>
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Dokumen Undangan UAT</label>
                                            <p className="text-[11px] text-gray-400 mt-0.5">
                                                Unggah undangan resmi yang ditujukan kepada seluruh pihak yang berkepentingan (pemohon, PM, developer, analis, dll).
                                            </p>
                                        </div>
                                        {!uatDone && (
                                            <label className={`px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${uploadingCategory === 'UAT_PREP' ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}>
                                                {uploadingCategory === 'UAT_PREP' ? (
                                                    <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Mengunggah...</>
                                                ) : (
                                                    <><Upload size={12} /> Upload</>
                                                )}
                                                <input type="file" ref={uat1FileRef} multiple accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={e => onUpload(e, setUat1, 'UAT_PREP')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={uat1.docs} onRemove={i => onRemoveDoc(setUat1, i)} onView={viewDoc} onDownload={downloadDoc} onTypeChange={(i, t) => changeDocType(setUat1, i, t)} docTypeOptions={docTypeOptions('UAT_PREP')} readOnly={uatDone} />
                                </div>

                                {!uatDone && (status === 'UAT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeUatStep === 1 && (
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => handleSaveUATStep(1)} disabled={!uat1.unit || !uat1.startDate || !uat1.preparedBy}
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
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <UserCheck size={16} className="text-orange-600" />
                                        <div>
                                            <h5 className="font-bold text-sm text-gray-800">Tahap 2: Eksekusi UAT Internal &amp; Temuan</h5>
                                            <p className="text-[11px] text-gray-500 mt-0.5">User mencoba dan mendemonstrasikan fungsi proyek secara langsung. Catat keputusan pada setiap skenario.</p>
                                        </div>
                                    </div>
                                    {uat2Done && <span className="shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Selesai ✓</span>}
                                </div>

                                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-[11px] text-blue-800 leading-relaxed">
                                    <Info size={15} className="shrink-0 mt-0.5 text-blue-600" />
                                    <span><strong>Diterima</strong> berarti fungsi sesuai kebutuhan. Jika memilih <strong>Revisi</strong>, tentukan Minor atau Mayor dan tuliskan permintaan user. Minor diperbaiki tanpa memundurkan alur; Mayor menjadi Change Request, kembali ke developer, dan wajib SIT ulang.</span>
                                </div>

                                {(status === 'UAT_REVISION_DEV' || sitUatData.uat2_resume_after_sit === true) && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800">
                                        <Lock size={16} className="shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold">UAT sedang di-hold untuk Change Request Mayor</p>
                                            <p className="text-[11px] mt-1 leading-relaxed">Hasil UAT tetap terkunci sebagai jejak audit. Developer menyelesaikan item Mayor terlebih dahulu, lalu seluruh perubahan menjalani SIT ulang sebelum kembali ke tab ini untuk verifikasi user.</p>
                                        </div>
                                    </div>
                                )}

                                {uat2VerificationMode && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800">
                                        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold">SIT ulang lulus — verifikasi perbaikan Mayor</p>
                                            <p className="text-[11px] mt-1 leading-relaxed">User hanya perlu memeriksa kembali item Mayor di bagian verifikasi. Skenario dan request lain tetap memakai hasil UAT sebelumnya.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {(uat2.scenarios || []).map((scenario, index) => {
                                        const isRevision = scenario.result === 'revision';
                                        const isLocked = uat2EditingLocked;
                                        return (
                                            <div key={scenario.id} className={`rounded-2xl border p-4 ${scenario.changeType === 'mayor' ? 'border-red-200 bg-red-50/30' : isRevision ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
                                                <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start gap-2">
                                                            <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 font-black text-[10px] flex items-center justify-center shrink-0">{index + 1}</span>
                                                            <div>
                                                                <p className="font-bold text-xs text-gray-800 leading-relaxed">{scenario.scenario}</p>
                                                                <p className="text-[10px] text-gray-400 mt-0.5">Referensi task #{scenario.taskId}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full lg:w-48 shrink-0">
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hasil Pengujian *</label>
                                                        <select
                                                            value={scenario.result}
                                                            onChange={event => updateUatScenario(scenario.id, 'result', event.target.value)}
                                                            disabled={isLocked}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-orange-500 disabled:bg-gray-100"
                                                        >
                                                            <option value="">Pilih hasil...</option>
                                                            <option value="accepted">Diterima</option>
                                                            <option value="revision">Revisi</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {isRevision && (
                                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipe Perubahan *</label>
                                                            <select
                                                                value={scenario.changeType}
                                                                onChange={event => updateUatScenario(scenario.id, 'changeType', event.target.value)}
                                                                disabled={isLocked}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-orange-500 disabled:bg-gray-100"
                                                            >
                                                                <option value="">Pilih tipe...</option>
                                                                <option value="minor">Minor — tanpa rollback</option>
                                                                <option value="mayor">Mayor — Change Request</option>
                                                            </select>
                                                        </div>
                                                        <div className="lg:col-span-2">
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Permintaan Perubahan / Perbaikan *</label>
                                                            <textarea
                                                                rows={2}
                                                                value={scenario.request}
                                                                onChange={event => updateUatScenario(scenario.id, 'request', event.target.value)}
                                                                placeholder="Jelaskan kebutuhan user, perilaku yang diharapkan, dan kriteria hasil perbaikannya..."
                                                                disabled={isLocked}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white resize-none focus:outline-none focus:border-orange-500 disabled:bg-gray-100"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Komentar / Catatan Demonstrasi</label>
                                                        <textarea
                                                            rows={2}
                                                            value={scenario.comment}
                                                            onChange={event => updateUatScenario(scenario.id, 'comment', event.target.value)}
                                                            placeholder="Catatan user, kondisi pengujian, atau informasi pendukung..."
                                                            disabled={isLocked}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white resize-none focus:outline-none focus:border-orange-500 disabled:bg-gray-100"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Lampiran Bukti</label>
                                                            {!isLocked && (
                                                                <label className={`px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${uploadingUatScenarioId ? 'opacity-60 pointer-events-none' : ''}`}>
                                                                    {uploadingUatScenarioId === scenario.id ? <Clock size={11} /> : <Paperclip size={11} />}
                                                                    {uploadingUatScenarioId === scenario.id ? 'Mengunggah...' : 'Lampirkan'}
                                                                    <input
                                                                        type="file"
                                                                        multiple
                                                                        accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                                                        className="hidden"
                                                                        onChange={event => {
                                                                            const files = Array.from(event.target.files || []);
                                                                            event.target.value = '';
                                                                            void uploadUatEvidence(scenario.id, files);
                                                                        }}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                        <DocList
                                                            docs={scenario.attachments}
                                                            onRemove={attachmentIndex => removeUatEvidence(scenario.id, attachmentIndex)}
                                                            onView={viewDoc}
                                                            onDownload={downloadDoc}
                                                            docTypeOptions={[["UAT_EVIDENCE", "Bukti Temuan UAT"]]}
                                                            readOnly={isLocked || uploadingUatScenarioId === scenario.id}
                                                            allowTypeChange={false}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <section className="rounded-2xl border border-violet-200 bg-violet-50/30 p-4 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Plus size={15} className="text-violet-600" />
                                                <h6 className="text-xs font-bold text-violet-900">Permintaan Tambahan User</h6>
                                            </div>
                                            <p className="text-[11px] text-violet-700 mt-1 leading-relaxed">
                                                Catat task atau kebutuhan baru yang muncul saat demonstrasi. Minor menjadi tindak lanjut kecil tanpa rollback; Mayor menjadi Change Request, menahan UAT, dan wajib melalui developer serta SIT ulang.
                                            </p>
                                        </div>
                                        {!uat2EditingLocked && (
                                            <button
                                                type="button"
                                                onClick={addUatAdditionalRequest}
                                                className="shrink-0 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <Plus size={13} /> Tambah Request
                                            </button>
                                        )}
                                    </div>

                                    {(uat2.additionalRequests || []).length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-violet-200 bg-white/70 px-4 py-5 text-center text-[11px] text-violet-500">
                                            Tidak ada permintaan tambahan dari user pada sesi UAT ini.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {(uat2.additionalRequests || []).map((request, index) => (
                                                <div key={request.id} className={`rounded-xl border bg-white p-4 ${request.changeType === 'mayor' ? 'border-red-200' : 'border-violet-200'}`}>
                                                    <div className="flex items-center justify-between gap-2 mb-3">
                                                        <p className="text-[11px] font-bold text-gray-700">Request Tambahan #{index + 1}</p>
                                                        {!uat2EditingLocked && (
                                                            <button
                                                                type="button"
                                                                onClick={() => void removeUatAdditionalRequest(request.id)}
                                                                disabled={uploadingUatScenarioId === request.id}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 cursor-pointer"
                                                                title="Hapus request tambahan"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                                        <div className="lg:col-span-2">
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Judul Task / Request Baru *</label>
                                                            <input
                                                                value={request.title}
                                                                onChange={event => updateUatAdditionalRequest(request.id, 'title', event.target.value)}
                                                                placeholder="Contoh: Tambahkan ekspor laporan bulanan"
                                                                disabled={uat2EditingLocked}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:border-violet-500 disabled:bg-gray-100"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipe Permintaan *</label>
                                                            <select
                                                                value={request.changeType}
                                                                onChange={event => updateUatAdditionalRequest(request.id, 'changeType', event.target.value)}
                                                                disabled={uat2EditingLocked}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-violet-500 disabled:bg-gray-100"
                                                            >
                                                                <option value="">Pilih tipe...</option>
                                                                <option value="minor">Minor — tindak lanjut kecil</option>
                                                                <option value="mayor">Mayor — Change Request</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Detail Permintaan *</label>
                                                            <textarea
                                                                rows={3}
                                                                value={request.detail}
                                                                onChange={event => updateUatAdditionalRequest(request.id, 'detail', event.target.value)}
                                                                placeholder="Jelaskan kebutuhan baru, hasil yang diharapkan, dan ruang lingkupnya..."
                                                                disabled={uat2EditingLocked}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white resize-none focus:outline-none focus:border-violet-500 disabled:bg-gray-100"
                                                            />
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mt-3 mb-1">Komentar / Catatan</label>
                                                            <textarea
                                                                rows={2}
                                                                value={request.comment}
                                                                onChange={event => updateUatAdditionalRequest(request.id, 'comment', event.target.value)}
                                                                placeholder="Konteks diskusi, prioritas, atau catatan kesepakatan..."
                                                                disabled={uat2EditingLocked}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white resize-none focus:outline-none focus:border-violet-500 disabled:bg-gray-100"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <label className="block text-[10px] font-bold text-gray-500 uppercase">Lampiran Bukti</label>
                                                                {!uat2EditingLocked && (
                                                                    <label className={`px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${uploadingUatScenarioId ? 'opacity-60 pointer-events-none' : ''}`}>
                                                                        {uploadingUatScenarioId === request.id ? <Clock size={11} /> : <Paperclip size={11} />}
                                                                        {uploadingUatScenarioId === request.id ? 'Mengunggah...' : 'Lampirkan'}
                                                                        <input
                                                                            type="file"
                                                                            multiple
                                                                            accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                                                            className="hidden"
                                                                            onChange={event => {
                                                                                const files = Array.from(event.target.files || []);
                                                                                event.target.value = '';
                                                                                void uploadUatAdditionalRequestEvidence(request.id, files);
                                                                            }}
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>
                                                            <DocList
                                                                docs={request.attachments}
                                                                onRemove={attachmentIndex => removeUatAdditionalRequestEvidence(request.id, attachmentIndex)}
                                                                onView={viewDoc}
                                                                onDownload={downloadDoc}
                                                                docTypeOptions={[["UAT_EVIDENCE", "Bukti Permintaan User"]]}
                                                                readOnly={uat2EditingLocked || uploadingUatScenarioId === request.id}
                                                                allowTypeChange={false}
                                                            />
                                                            {request.taskId && (
                                                                <p className="mt-2 text-[10px] text-slate-500">Task developer terkait: #{request.taskId}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {uat2VerificationMode && (
                                    <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-4 space-y-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <UserCheck size={15} className="text-emerald-700" />
                                                <h6 className="text-xs font-bold text-emerald-900">Verifikasi Ulang Item Mayor oleh User</h6>
                                            </div>
                                            <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                                                Nilai hanya perbaikan Mayor yang sudah diselesaikan developer dan dinyatakan lulus SIT ulang. Setiap item wajib memiliki bukti verifikasi baru. Jika satu item masih revisi, UAT kembali di-hold untuk siklus perbaikan berikutnya.
                                            </p>
                                        </div>

                                        {uatMajorVerificationItems.map((item, index) => (
                                            <div key={`${item.source}_${item.id}`} className="rounded-xl border border-emerald-200 bg-white p-4">
                                                <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start gap-2">
                                                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-black text-[10px] flex items-center justify-center shrink-0">{index + 1}</span>
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase text-emerald-600">{item.source === 'scenario' ? 'Revisi Skenario UAT' : 'Request Tambahan User'}</p>
                                                                <p className="font-bold text-xs text-gray-800 mt-0.5">{item.title}</p>
                                                                <p className="text-[10px] text-gray-500 mt-1">Permintaan awal: {item.source === 'scenario' ? item.request : item.detail}</p>
                                                                {item.taskId && <p className="text-[10px] text-gray-400 mt-0.5">Task developer #{item.taskId}</p>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full lg:w-56 shrink-0">
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hasil Verifikasi *</label>
                                                        <select
                                                            value={item.verificationResult || ''}
                                                            onChange={event => updateUatMajorVerification(item.source, item.id, 'verificationResult', event.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-emerald-500"
                                                        >
                                                            <option value="">Pilih hasil...</option>
                                                            <option value="accepted">Perbaikan Diterima</option>
                                                            <option value="revision">Masih Revisi</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                                        {item.verificationResult === 'revision' ? 'Alasan Masih Revisi *' : 'Catatan Verifikasi'}
                                                    </label>
                                                    <textarea
                                                        rows={2}
                                                        value={item.verificationComment || ''}
                                                        onChange={event => updateUatMajorVerification(item.source, item.id, 'verificationComment', event.target.value)}
                                                        placeholder={item.verificationResult === 'revision' ? 'Jelaskan bagian yang belum sesuai dan hasil yang diharapkan...' : 'Catatan penerimaan atau hasil demonstrasi ulang...'}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white resize-none focus:outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-emerald-800 uppercase">Lampiran Bukti Verifikasi *</label>
                                                            <p className="text-[10px] text-emerald-700 mt-0.5">Lampirkan screenshot, berita acara, hasil demonstrasi, atau bukti pendukung lain untuk item ini.</p>
                                                        </div>
                                                        <label className={`shrink-0 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer ${uploadingUatScenarioId ? 'opacity-60 pointer-events-none' : ''}`}>
                                                            {uploadingUatScenarioId === getUatVerificationUploadKey(item.source, item.id)
                                                                ? <Clock size={11} />
                                                                : <Paperclip size={11} />}
                                                            {uploadingUatScenarioId === getUatVerificationUploadKey(item.source, item.id)
                                                                ? 'Mengunggah...'
                                                                : 'Upload Bukti'}
                                                            <input
                                                                type="file"
                                                                multiple
                                                                accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                                                className="hidden"
                                                                disabled={Boolean(uploadingUatScenarioId)}
                                                                onChange={event => {
                                                                    const files = Array.from(event.target.files || []);
                                                                    event.target.value = '';
                                                                    void uploadUatMajorVerificationEvidence(item.source, item.id, files);
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                    <DocList
                                                        docs={item.verificationAttachments || []}
                                                        onRemove={attachmentIndex => removeUatMajorVerificationEvidence(
                                                            item.source,
                                                            item.id,
                                                            attachmentIndex
                                                        )}
                                                        onView={viewDoc}
                                                        onDownload={downloadDoc}
                                                        docTypeOptions={[["UAT_EVIDENCE", "Bukti Verifikasi Mayor"]]}
                                                        readOnly={Boolean(uploadingUatScenarioId)}
                                                        allowTypeChange={false}
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <div className="flex flex-col items-end gap-1.5 pt-1">
                                            <button
                                                type="button"
                                                onClick={handleSubmitUatMajorVerification}
                                                disabled={submitting || Boolean(uatMajorVerificationValidation)}
                                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                {submitting ? <Clock size={14} /> : <CheckCircle2 size={14} />}
                                                {submitting ? 'Menyimpan Verifikasi...' : 'Simpan Verifikasi Mayor'}
                                            </button>
                                            {uatMajorVerificationValidation && <p className="text-[10px] text-amber-700">{uatMajorVerificationValidation}</p>}
                                        </div>
                                    </section>
                                )}

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                    {[
                                        { label: 'Dieksekusi', value: uat2Summary.executedCount, color: 'text-slate-700' },
                                        { label: 'Diterima', value: uat2Summary.acceptedCount, color: 'text-emerald-700' },
                                        { label: 'Request Baru', value: uat2Summary.additionalRequestCount, color: 'text-violet-700' },
                                        { label: 'Total Revisi', value: uat2Summary.revisionCount, color: 'text-orange-700' },
                                        { label: 'Minor', value: uat2Summary.minorCount, color: 'text-amber-700' },
                                        { label: 'Mayor / CR', value: uat2Summary.majorCount, color: 'text-red-700' },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                                            <p className="text-[9px] font-bold uppercase text-slate-500">{item.label}</p>
                                            <p className={`text-lg font-black mt-0.5 ${item.color}`}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className={`p-4 rounded-xl border flex items-start gap-3 ${uat2Summary.majorCount > 0 ? 'bg-red-50 border-red-200 text-red-800' : uat2Summary.minorCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                                    {uat2Summary.majorCount > 0 ? <AlertTriangle size={17} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={17} className="shrink-0 mt-0.5" />}
                                    <div>
                                        <p className="text-xs font-bold">
                                            Kesimpulan: {uat2Summary.majorCount > 0 ? 'Revisi Mayor / Change Request' : uat2Summary.minorCount > 0 ? 'Revisi Minor' : 'Diterima'}
                                        </p>
                                        <p className="text-[11px] mt-1 leading-relaxed">
                                            {uat2Summary.majorCount > 0
                                                ? 'UAT belum dapat disetujui. Saat disimpan, proyek kembali ke developer; setelah perbaikan wajib SIT ulang, lalu user memverifikasi item Mayor di Tab 2 sebelum Persetujuan Final.'
                                                : uat2Summary.minorCount > 0
                                                    ? 'Perbaikan minor dapat dibantu developer tanpa memundurkan status proyek dan tidak memerlukan SIT ulang.'
                                                    : 'Seluruh skenario yang sudah dinilai diterima dan dapat dilanjutkan ke persetujuan final.'}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Umum Hasil UAT</label>
                                    <textarea rows={3} value={uat2.execNotes} onChange={event => setUat2(previous => ({ ...previous, execNotes: event.target.value }))}
                                        placeholder="Ringkasan demonstrasi, keputusan user, atau tindak lanjut umum..."
                                        disabled={uat2EditingLocked}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                </div>

                                {uat2IsSubmitted && (
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
                                        <Lock size={13} className="shrink-0 mt-0.5" />
                                        <span>Snapshot hasil UAT telah disimpan dan dikunci untuk menjaga jejak audit. Lampiran tetap dapat dilihat dan diunduh.{uat2VerificationMode ? ' Hanya hasil verifikasi item Mayor yang dapat diubah.' : ''}</span>
                                    </div>
                                )}

                                {!uat2IsSubmitted && !uat2VerificationMode && status !== 'UAT_REVISION_DEV' && sitUatData.uat2_resume_after_sit !== true && (
                                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-[11px] text-orange-800 leading-relaxed">
                                        Gunakan <strong>Simpan sebagai Draft</strong> selama hasil pengujian, permintaan perubahan, atau lampiran bukti masih dilengkapi. Draft tidak mengunci data dan tidak menjalankan alur revisi Mayor/Minor. Alur tersebut baru diproses saat hasil UAT disimpan final.
                                    </div>
                                )}

                                {!uatDone && !uat2VerificationMode && (status === 'UAT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeUatStep === 2 && (
                                    <div className="flex flex-col items-end gap-1.5 pt-2">
                                        <div className="w-full flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                            <button
                                                onClick={handleSaveUATDraft}
                                                disabled={savingUatDraft || submitting || uat2IsSubmitted || uploadingUatScenarioId || (uat2.scenarios || []).length === 0 || status === 'UAT_REVISION_DEV' || sitUatData.uat2_resume_after_sit === true}
                                                className="px-5 py-2.5 bg-white hover:bg-orange-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-orange-700 border border-orange-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                {savingUatDraft ? <Clock size={14} /> : <Save size={14} />}
                                                {savingUatDraft ? 'Menyimpan Draft...' : 'Simpan sebagai Draft'}
                                            </button>
                                            <button
                                                onClick={handleSubmitUatExecution}
                                                disabled={Boolean(uat2Validation) || submitting || savingUatDraft || uat2IsSubmitted || status === 'UAT_REVISION_DEV' || sitUatData.uat2_resume_after_sit === true}
                                                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                {submitting ? <Clock size={14} /> : uat2Summary.majorCount > 0 ? <RotateCcw size={14} /> : <ArrowRight size={14} />}
                                                {submitting
                                                    ? 'Menyimpan Hasil UAT...'
                                                    : uat2Summary.majorCount > 0
                                                        ? 'Simpan Final & Kembalikan ke Developer'
                                                        : 'Simpan Final & Lanjut Persetujuan'}
                                            </button>
                                        </div>
                                        {uat2Validation && <p className="text-[10px] text-amber-700">{uat2Validation}</p>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── UAT Step 3: Persetujuan Final ─────────────── */}
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
                                            { label: 'Unit Peminta', val: uat1.unit || project?.division || '-' },
                                            { label: 'Skenario UAT', val: `${uatScenarioTasks.length}` },
                                            { label: 'Dieksekusi', val: uat2Summary.executedCount || '-' },
                                            { label: 'Diterima', val: uat2Summary.acceptedCount || '-' },
                                        ].map(s => (
                                            <div key={s.label} className="bg-white rounded-lg p-2.5 border border-slate-200">
                                                <p className="text-slate-500 text-[9px] font-bold uppercase">{s.label}</p>
                                                <p className="font-bold text-slate-800 text-xs mt-0.5">{s.val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {currentUserUatApprovals.some(item => item.status === 'pending') && !uatDone ? (
                                    <div id="my-uat-approval" className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 shadow-sm">
                                        <p className="flex items-center gap-1.5 text-sm font-bold text-blue-900"><UserCheck size={16} /> Keputusan UAT Menunggu Anda</p>
                                        <p className="mt-1 text-[10px] leading-relaxed text-blue-700">Tinjau ringkasan hasil, matrix persetujuan, dan dokumen Persetujuan Final pada halaman ini sebelum mengirim keputusan.</p>
                                        <button type="button" onClick={() => document.getElementById('uat-final-documents')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100">
                                            <FileText size={12} /> Periksa Dokumen Final
                                        </button>
                                        <textarea rows={2} value={uatApprovalNote} onChange={e => setUatApprovalNote(e.target.value)}
                                            placeholder="Catatan keputusan (wajib jika menolak / meminta revisi)..."
                                            className="mt-3 w-full resize-none rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none" />
                                        <div className="mt-2 space-y-2">
                                            {currentUserUatApprovals.filter(item => item.status === 'pending').map(approver => (
                                                <div key={approver.id} className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-white p-3">
                                                    <div className="mr-auto">
                                                        <p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">Anda bertindak sebagai</p>
                                                        <p className="text-xs font-bold text-gray-800">{approver.approval_role_label}</p>
                                                    </div>
                                                    <button onClick={() => handleSubmitUatApproval(approver.id, 'approved')} disabled={uatApprovalSubmitting}
                                                        className="rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:bg-gray-300"><CheckCircle2 size={13} className="mr-1 inline" />Setujui UAT</button>
                                                    <button onClick={() => handleSubmitUatApproval(approver.id, 'rejected')} disabled={uatApprovalSubmitting}
                                                        className="rounded-lg bg-red-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-red-700 disabled:bg-gray-300"><X size={13} className="mr-1 inline" />Tolak / Minta Revisi</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {/* ── Distribusi link approval pihak peminta ── */}
                                {canManageUatApprovals ? (
                                <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white">
                                    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
                                        <div className="flex items-start gap-2">
                                            <Link2 size={16} className="mt-0.5 shrink-0 text-amber-600" />
                                            <div>
                                                <h6 className="text-sm font-bold text-amber-900">Distribusi Link Approval Pihak Peminta</h6>
                                                <p className="mt-0.5 text-[10px] leading-relaxed text-amber-700">
                                                    PM atau pihak IT membuat satu link pribadi untuk setiap approver, lalu mengirimkannya langsung kepada orang terkait. Penerima membuka link dan memverifikasi nomor HP yang terdaftar sebelum melihat hasil UAT.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        {uatMatrixLoading ? (
                                            <div className="py-5 text-center text-xs text-gray-400">Memuat daftar penerima link...</div>
                                        ) : !uatApprovalMatrix ? (
                                            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 text-[11px] leading-relaxed text-amber-800">
                                                Link belum dapat dibuat. Simpan hasil UAT Tab 2 sebagai <strong>final</strong> terlebih dahulu agar putaran approval dan link pribadi dibuat dengan data hasil pengujian yang terkunci.
                                            </div>
                                        ) : externalUatApprovers.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-gray-300 p-3 text-[11px] text-gray-500">
                                                Belum ada approver pihak peminta. Tambahkan dan tentukan kedudukannya melalui UAT Tab 1.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {externalUatApprovers.map(approver => {
                                                    const isPending = approver.status === 'pending';
                                                    return (
                                                        <div key={approver.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="truncate text-xs font-bold text-gray-800">{approver.name}</p>
                                                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${approver.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : approver.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                        {approver.status === 'approved' ? 'Sudah menyetujui' : approver.status === 'rejected' ? 'Menolak / revisi' : 'Menunggu approval'}
                                                                    </span>
                                                                </div>
                                                                <p className="mt-0.5 text-[10px] text-gray-500">{approver.approval_role_label}{approver.unit ? ` · ${approver.unit}` : ''}</p>
                                                                <p className="mt-1 text-[10px] font-medium text-gray-600">Verifikasi HP: {approver.phone_masked || 'Nomor belum tersedia'}</p>
                                                            </div>
                                                            {canManageUatApprovals && isPending ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopyExternalApprovalLink(approver)}
                                                                    disabled={uatApprovalSubmitting}
                                                                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-500 px-3 py-2 text-[10px] font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                                >
                                                                    {approver.link_ready ? <RefreshCw size={12} /> : <Link2 size={12} />}
                                                                    {approver.link_ready ? 'Buat Ulang & Salin Link' : 'Buat & Salin Link'}
                                                                </button>
                                                            ) : !canManageUatApprovals && isPending ? (
                                                                <p className="shrink-0 text-[10px] italic text-gray-400">Link dikelola PM / pihak IT</p>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                                <p className="pt-1 text-[9px] leading-relaxed text-gray-400">
                                                    Membuat ulang link akan menggantikan link sebelumnya. Kirim hanya link terbaru kepada penerima yang sesuai.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                ) : null}

                                {/* ── Persetujuan Multi-Role UAT ── */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <ShieldCheck size={15} className="text-emerald-600" />
                                        <div>
                                            <h6 className="font-bold text-sm text-gray-800">Matrix Persetujuan UAT</h6>
                                            <p className="text-[10px] text-gray-400">Putaran {uatApprovalMatrix?.round_number || '-'} · keputusan tercatat per orang</p>
                                        </div>
                                        <span className="ml-auto text-[10px] font-bold text-gray-500">
                                            {uatApprovalMatrix?.approved_count || 0} / {uatApprovalMatrix?.required_count || 0} disetujui
                                        </span>
                                        {canManageUatApprovals && uatApprovalMatrix?.is_out_of_sync && !uatDone && (
                                            <button onClick={handleSyncUatApprovalRound} disabled={uatApprovalSubmitting}
                                                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1">
                                                <RefreshCw size={11} /> Sinkronkan Peserta Tab 1
                                            </button>
                                        )}
                                        {canManageUatApprovals && hasRecordedUatApprovalDecision && !uatDone && (
                                            <button onClick={handleRestartUatApprovalRound} disabled={uatApprovalSubmitting}
                                                className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold flex items-center gap-1">
                                                <RefreshCw size={11} /> Buat Putaran Baru
                                            </button>
                                        )}
                                    </div>
                                    {uatMatrixLoading ? (
                                        <div className="py-8 text-center text-xs text-gray-400">Memuat matrix approval...</div>
                                    ) : !uatApprovalMatrix ? (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Matrix approval belum tersedia. Pastikan hasil UAT Tahap 2 sudah disimpan final.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {[
                                                { side: 'requester', title: 'Pihak Peminta', tone: 'amber' },
                                                { side: 'it', title: 'Pihak Teknologi Informasi', tone: 'blue' },
                                            ].map(group => (
                                                <div key={group.side} className="rounded-xl border border-gray-200 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-2">{group.title}</p>
                                                    <div className="space-y-2">
                                                        {(uatApprovalMatrix.approvers || []).filter(item => item.side === group.side).map(approver => {
                                                            const statusClasses = approver.status === 'approved'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : approver.status === 'rejected'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-gray-100 text-gray-600';
                                                            return (
                                                                <div key={approver.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div>
                                                                            <p className="font-bold text-xs text-gray-800">{approver.name}</p>
                                                                            <p className="text-[10px] text-gray-500">{approver.approval_role_label}{approver.unit ? ` · ${approver.unit}` : ''}</p>
                                                                        </div>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusClasses}`}>
                                                                            {approver.status === 'approved' ? 'Disetujui' : approver.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                                                                        </span>
                                                                    </div>
                                                                    {approver.decision_note ? <p className="mt-2 text-[10px] italic text-gray-600">“{approver.decision_note}”</p> : null}
                                                                    {approver.decided_at ? <p className="mt-1 text-[9px] text-gray-400">{fmtDate(approver.decided_at)}</p> : null}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Riwayat Change Request UAT */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <RotateCcw size={14} className="text-orange-500" />
                                            <h6 className="font-bold text-sm text-gray-800">Riwayat Perubahan UAT</h6>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mb-2">
                                        Permintaan perubahan dicatat pada Tahap 2. Revisi minor tidak memundurkan alur; revisi mayor menjadi Change Request dan mewajibkan perbaikan developer serta SIT ulang.
                                    </p>
                                    {uatChangeRequests.length === 0 ? (
                                        <p className="text-[11px] text-gray-400 italic">Belum ada change request diajukan.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {uatChangeRequests.map(cr => {
                                                const stColor = cr.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : cr.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200';
                                                const stLabel = cr.status === 'approved' ? 'Disetujui' : cr.status === 'rejected' ? 'Ditolak' : 'Menunggu';
                                                return (
                                                    <div key={cr.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${cr.type === 'mayor' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                                    {cr.type === 'mayor' ? 'Mayor' : 'Minor'}
                                                                </span>
                                                                <span className="font-bold text-gray-800 text-xs">{cr.title}</span>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${stColor}`}>{stLabel}</span>
                                                        </div>
                                                        <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">{cr.detail}</p>
                                                        <p className="text-[10px] text-gray-400 mt-1">
                                                            Diajukan oleh: {cr.submittedBy} • {fmtDate(cr.at)}
                                                            {cr.status !== 'pending' && cr.decisionBy && ` • Keputusan: ${cr.decisionBy}`}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Persetujuan Final</label>
                                        <textarea rows={2} value={uat3.approvalNotes} onChange={e => setUat3(p => ({ ...p, approvalNotes: e.target.value }))}
                                            placeholder="Pernyataan persetujuan: semua skenario bisnis telah diverifikasi dan dinyatakan memenuhi kebutuhan FSD..." disabled={uatDone || !canManageUatApprovals}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Disetujui Oleh</label>
                                        <input type="text" value={uat3.approvedBy} onChange={e => setUat3(p => ({ ...p, approvedBy: e.target.value }))}
                                            placeholder="Nama PM, Nama Perwakilan Divisi" disabled={uatDone || !canManageUatApprovals}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                </div>
                                <div id="uat-final-documents">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div>
                                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Form Persetujuan &amp; Tanda Tangan Digital</label>
                                            <p className="mt-0.5 text-[10px] text-gray-400">Setelah upload selesai, dokumen langsung tersedia untuk diperiksa oleh approver eksternal melalui link pribadi.</p>
                                        </div>
                                        {canManageUatApprovals && !uatDone && !hasRecordedUatApprovalDecision && (
                                            <label className={`px-3 py-1.5 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${isUatApprovalUploading ? 'bg-gray-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'}`}>
                                                {isUatApprovalUploading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                                                {isUatApprovalUploading ? 'Mengunggah...' : 'Upload'}
                                                <input type="file" ref={uat3FileRef} multiple disabled={isUatApprovalUploading} accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={e => onUpload(e, setUat3, 'UAT_APPROVAL')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={uat3.docs} onRemove={removeUatApprovalDocument} onView={viewDoc} onDownload={downloadDoc} docTypeOptions={[['UAT_SIGNOFF', 'Berita Acara UAT']]} readOnly={uatDone || !canManageUatApprovals || isUatApprovalUploading || hasRecordedUatApprovalDecision} allowTypeChange={false} />
                                    {hasRecordedUatApprovalDecision && !uatDone ? (
                                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
                                            Dokumen dikunci karena keputusan approval sudah mulai tercatat. Jika dokumen harus diganti, buat putaran approval baru agar seluruh pihak meninjau versi yang sama.
                                        </p>
                                    ) : null}
                                </div>
                                {/* Action buttons */}
                                {canManageUatApprovals && !uatDone && (status === 'UAT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeUatStep === 3 && (
                                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
                                        <button
                                            onClick={handleUATPass}
                                            disabled={submitting || !allUatApproved || sitUatData.uat2_resume_after_sit === true || uat2VerificationMode}
                                            title={allUatApproved ? '' : 'Seluruh persetujuan wajib dari pihak peminta dan pihak IT harus lengkap terlebih dahulu'}
                                            className={`w-full px-6 py-3 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${allUatApproved ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'}`}
                                        >
                                            <Send size={16} /> UAT Lulus — Tetapkan DEV_COMPLETED &amp; Lanjut ke QA / Siber
                                        </button>
                                        {!allUatApproved && (
                                            <p className="text-[10px] text-gray-400 text-center">
                                                Tombol "UAT Lulus" aktif setelah seluruh approver wajib pada putaran aktif menyetujui.
                                            </p>
                                        )}
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

            {/* ─── COMPLETION CARD ─── */}
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

            {/* ─── Audit Trail Revisi ─── */}
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

            {/* ─── MODAL: Kembalikan Task ke Developer ─── */}
            {showTaskRevisionModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                                <RotateCcw size={20} className="text-orange-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-base">Kembalikan Task ke Developer</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Task <strong>"{showTaskRevisionModal.title}"</strong> akan diubah ke <strong>Sedang Dikerjakan (In Progress)</strong> dan arahan revisi dikirim ke developer terkait.</p>
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                Catatan Arahan Revisi untuk Developer <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={4}
                                value={taskRevisions[showTaskRevisionModal.id] || ''}
                                onChange={e => setTaskRevisions(prev => ({ ...prev, [showTaskRevisionModal.id]: e.target.value }))}
                                placeholder="Jelaskan apa yang tidak sesuai, apa yang perlu diperbaiki, dan kriteria yang harus dipenuhi sebelum kembali ke SIT..."
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-orange-500 resize-none"
                                autoFocus
                            />
                            {!(taskRevisions[showTaskRevisionModal.id] || '').trim() && <p className="text-xs text-red-500 mt-1">Catatan revisi wajib diisi.</p>}
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowTaskRevisionModal(null)} disabled={submitting}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">
                                Batal
                            </button>
                            <button
                                onClick={handleReturnTaskRevision}
                                disabled={!(taskRevisions[showTaskRevisionModal.id] || '').trim() || submitting}
                                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Mengirim...' : 'Kirim ke Developer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Pratinjau Dokumen SIT/UAT ── */}
            {previewDoc && (
                <DocumentViewerModal
                    doc={{
                        name: previewDoc.originalName || previewDoc.name || 'Dokumen',
                        url: previewDoc.blobUrl || previewDoc.url,
                        type: previewDoc.type || 'FILE',
                        size: previewDoc.size,
                        author: 'Tim SDLC',
                    }}
                    project={project}
                    onClose={() => {
                        if (previewDoc.blobUrl?.startsWith('blob:')) URL.revokeObjectURL(previewDoc.blobUrl);
                        setPreviewDoc(null);
                    }}
                />
            )}

        </div>
    );
}
