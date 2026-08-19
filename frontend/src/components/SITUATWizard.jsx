// src/components/SITUATWizard.jsx
// Wizard Multi-Step SIT & UAT Internal untuk Proyek Bank Nagari (Versi Refactored)
//
// Business logic yang diterapkan:
//  1) Gatekeeper SIT: proyek hanya boleh masuk SIT jika SEMUA task developer berstatus
//     "Selesai/Done". Task berstatus "TAKE DOWN" DIABAIKAN (tidak dihitung syarat/progress).
//  2) Alur revisi task terintegrasi: PM dapat mengembalikan task ke developer (status →
//     in_progress) lengkap dengan catatan/arahan revisi, tersimpan & tampil di board developer.
//  3) Tab "Eksekusi Pengujian" menampilkan tabel seluruh task developer, tiap baris punya
//     checkbox OK, kolom komentar/temuan, dan tombol Kembalikan/Revisi.
//  4) Lanjut ke "Review & Sign-Off" / UAT HANYA jika SEMUA task dicentang OK.
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
    ShieldCheck, Server, CheckSquare, Lock, CheckCircle2,
    Upload, X, FileText, ArrowRight, ArrowLeft, AlertTriangle,
    RotateCcw, Send, Paperclip, Info, ChevronRight, Clock,
    Eye, Download, Printer, Building2, ClipboardList, Bug,
    UserCheck, FileCheck, BookOpen, Users, Trash2, Plus
} from 'lucide-react';
import { generateDocumentName, getDocumentTypeInfo, formatFileSize } from '../utils/documentNaming';
import { taskService, projectService, documentService } from '../services/api';
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

// ─── Constants ───────────────────────────────────────────────────────────────
const SIT_STATUSES = ['IN_DEVELOPMENT', 'SIT_IN_PROGRESS', 'SIT_REVISION', 'RETURN_TO_DEV'];
const UAT_STATUSES = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_REVISION_DEV'];
const DONE_STATUSES = ['DEV_COMPLETED'];

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
function DocList({ docs, onRemove, onView, onDownload, onTypeChange, docTypeOptions, readOnly = false }) {
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
                            {doc.url && (
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
                            disabled={readOnly}
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
export default function SITUATWizard({ project, updateProject, addNotification, navigate, refreshProject, isViewer = false }) {
    const status = project?.status || 'IN_DEVELOPMENT';
    const sitUatData = project?.sitUatData || {};
    const { user } = useAuth();

    // Role user saat ini → apakah dia pemegang hak approval SIT.
    // PM (dev_analyst / project_manager) = Analyst Pengembangan.
    const currentRoleKey = ['developer', 'development_lead'].includes(user?.role)
        ? user.role
        : (['dev_analyst', 'project_manager'].includes(user?.role) ? 'pm' : null);
    // Approval SIT dari role (disimpan di sitUatData.sit3_approvals)
    const sit3Approvals = sitUatData.sit3_approvals || {};

    // Jumlah developer (assignee task unik) yang harus approve
    const requiredDeveloperCount = useMemo(() => {
        if (!Array.isArray(project?.tasks)) return 0;
        return new Set(
            project.tasks
                .map(t => t.assignee_id ?? t.assignee_detail?.id)
                .filter(id => id != null)
                .map(id => Number(id))
        ).size;
    }, [project?.tasks]);

    // Jumlah developer yang sudah approve
    const approvedDeveloperCount = useMemo(() => {
        const devList = sit3Approvals?.developer?.developers || [];
        return devList.length;
    }, [sit3Approvals?.developer?.developers]);

    // Semua approval lengkap: semua developer + PM (Analyst Pengembangan) + development_lead
    const devApproved = requiredDeveloperCount > 0 && approvedDeveloperCount >= requiredDeveloperCount;
    const allSitApproved = devApproved
        && sit3Approvals?.pm?.approved === true
        && sit3Approvals?.development_lead?.approved === true;

    // ── State ─────────────────────────────────────────────────────────────
    const [activeSitStep, setActiveSitStep] = useState(sitUatData.activeSitStep || 1);
    const [activeUatStep, setActiveUatStep] = useState(sitUatData.activeUatStep || 1);

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

    // Revision & modal state (SIT/UAT level)
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const [revisionType, setRevisionType] = useState(null); // 'SIT_TO_DEV' | 'UAT_TO_SIT' | 'UAT_TO_DEV'
    const [revisionNotes, setRevisionNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Pratinjau dokumen (modal) & status upload
    const [previewDoc, setPreviewDoc] = useState(null);
    const [uploadingCategory, setUploadingCategory] = useState(null);

    // Revision history (SIT/UAT level)
    const revisions = sitUatData.revisions || [];

    // ── File upload refs ───────────────────────────────────────────────────
    const sit3FileRef = useRef(null);
    const uat1FileRef = useRef(null);
    const uat2FileRef = useRef(null);
    const uat3FileRef = useRef(null);

    // ── Upload dokumen SIT/UAT dengan MASKING nama & PILIHAN tipe file ──
    // File ditambahkan sebagai draft (tipe bisa dipilih), nama di-masking sesuai
    // format XXX/GPTD/TIPE/DD-BulanYYYY_NamaProyek. Upload ke server terjadi
    // saat tipe dipilih / saat step disimpan.
    const getDefaultDocType = (cat) => ({
        'SIT_SIGNOFF': 'SIT_SIGNOFF',
        'UAT_PREP': 'UAT_PLAN',
        'UAT_EXEC': 'UAT_RESULT',
        'UAT_APPROVAL': 'UAT_SIGNOFF',
    }[cat] || 'LAINNYA');

    const docTypeOptions = (cat) => {
        const base = Object.entries({
            BRD: 'BRD', MEMO: 'Memo', LAMPIRAN: 'Lampiran', LAINNYA: 'Lainnya',
            FSD: 'FSD', ARSITEKTUR: 'Arsitektur', SIT_PLAN: 'Test Plan SIT',
            SIT_RESULT: 'Hasil SIT', SIT_SIGNOFF: 'Berita Acara SIT',
            UAT_PLAN: 'Skenario UAT', UAT_RESULT: 'Hasil UAT', UAT_SIGNOFF: 'Berita Acara UAT',
            QA_REPORT: 'Laporan QA', QA_SIGNOFF: 'QA Sign-Off',
            CYBER_REPORT: 'Laporan Siber', CYBER_SIGNOFF: 'Cyber Sign-Off',
            RELEASE_PLAN: 'Rencana Rilis', SPREADSHEET: 'Spreadsheet',
            GAMBAR: 'Gambar/Screenshot', ARSIP: 'Arsip ZIP',
        });
        return base;
    };

    const maskedDocName = (docType) => generateDocumentName(
        project?.req_id || project?.id,
        docType,
        project?.title || project?.name
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

    const onUpload = (e, setter, key, cat) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        addDraftDocs(setter, files, cat);
        if (e.target) e.target.value = '';
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
    // Task TAKE DOWN diabaikan; syarat masuk SIT = semua task tersisa berstatus done.
    const taskGate = useCallback(() => {
        const taskList = Array.isArray(project?.tasks) ? project.tasks : [];
        const eligible = taskList.filter(t => String(t.status || '').toLowerCase() !== 'take_down');
        const doneTasks = eligible.filter(t => String(t.status || '').toLowerCase() === 'done');
        const incompleteTasks = eligible.filter(t => String(t.status || '').toLowerCase() !== 'done');
        return {
            total: eligible.length,
            done: doneTasks.length,
            incomplete: incompleteTasks.map(t => ({ id: t.id, title: t.title || t.name || 'Task', status: t.status })),
            canStart: eligible.length > 0 && incompleteTasks.length === 0,
        };
    }, [project?.tasks]);

    // ── Derived stats dari task approvals (untuk ringkasan & dokumen) ─────
    const eligibleTaskIds = useMemo(() => {
        if (!Array.isArray(project?.tasks)) return [];
        return project.tasks
            .filter(t => String(t.status || '').toLowerCase() !== 'take_down')
            .map(t => t.id);
    }, [project?.tasks]);

    const approvedTaskCount = eligibleTaskIds.filter(id => {
        const a = sit2Approvals?.[id];
        return typeof a === 'object' ? a.approved === true : a === true;
    }).length;

    const defectTaskCount = eligibleTaskIds.filter(id => {
        const a = sit2Approvals?.[id];
        const comment = typeof a === 'object' ? (a.comment || '') : '';
        return comment.trim().length > 0;
    }).length;

    // ── Completion check per step ──────────────────────────────────────────
    const sit1Done = sitDone || (status === 'SIT_IN_PROGRESS' && activeSitStep > 1);
    const sit2Done = sitDone || (status === 'SIT_IN_PROGRESS' && activeSitStep > 2);
    const sit3Done = sitDone;
    const uat1Done = uatDone || (status === 'UAT_IN_PROGRESS' && activeUatStep > 1);
    const uat2Done = uatDone || (status === 'UAT_IN_PROGRESS' && activeUatStep > 2);
    const uat3Done = uatDone;

    // ── Persist helper ─────────────────────────────────────────────────────
    // Bersihkan docs dari field yang tidak bisa diserialize (rawFile, blob url)
    const sanitizeDocs = (docs) => (docs || []).map(({ rawFile, isUploading, ...rest }) => rest);

    const buildSitUatData = (overrides = {}) => ({
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
        uat2_executedCount: uat2.executedCount, uat2_passedCount: uat2.passedCount,
        uat2_findings: uat2.findings, uat2_execNotes: uat2.execNotes,
        uat2_docs: sanitizeDocs(uat2.docs),
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
            toast.error(`Tidak dapat memulai SIT: masih ada ${gate.incomplete.length} task belum selesai (${names}). Semua task harus berstatus Selesai, kecuali Take Down.`);
            return;
        }
        updateProject(project.id, { status: 'SIT_IN_PROGRESS', sitUatData: buildSitUatData({ activeSitStep: 1 }) });
        toast.success(`Pengujian SIT dimulai untuk proyek "${project.name}".`);
    };

    const handleSaveSITStep = async (step) => {
        // Validasi: dari Eksekusi (step 2) -> Review (step 3) hanya jika SEMUA task disetujui OK
        if (step === 2) {
            const eligibleIds = Array.isArray(project?.tasks)
                ? project.tasks.filter(t => String(t.status || '').toLowerCase() !== 'take_down').map(t => t.id)
                : [];
            const approvedIds = eligibleIds.filter(id => {
                const a = sit2Approvals?.[id];
                return typeof a === 'object' ? a.approved === true : a === true;
            }).length;
            if (eligibleIds.length === 0 || approvedIds !== eligibleIds.length) {
                toast.error(`Lanjut ke Review & Sign-Off memerlukan SEMUA ${eligibleIds.length} task disetujui (OK). Saat ini ${approvedIds} disetujui.`);
                return;
            }
        }
        // Upload draft dokumen yang belum di-upload (agar docId tersimpan di sitUatData)
        setSubmitting(true);
        await uploadAllDrafts(setSit3, sit3.docs);
        const nextStep = step + 1;
        setActiveSitStep(nextStep);
        updateProject(project.id, { status: 'SIT_IN_PROGRESS', sitUatData: buildSitUatData({ activeSitStep: nextStep }) });
        toast.success(`SIT Tahap ${step} tersimpan. Lanjut ke Tahap ${nextStep}.`);
        setSubmitting(false);
    };

    const handleSITPass = async () => {
        setSubmitting(true);
        await uploadAllDrafts(setSit3, sit3.docs);
        updateProject(project.id, {
            status: 'SIT_PASSED',
            sitPassedAt: new Date().toISOString(),
            sitUatData: buildSitUatData({ activeSitStep: 3, activeUatStep: 1 }),
        });
        addNotification?.('SIT Lulus!', `Proyek "${project.name}" lulus SIT. UAT Internal dapat dimulai.`, 'success', '/pm/workspace');
        toast.success(`🎉 SIT Lulus! Proyek siap melanjutkan ke UAT Internal.`);
        setSubmitting(false);
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
        // Auto-fill peserta UAT dari proyek: pemohon (creator), PM, analyst, developer
        const participants = [];
        const addP = (name, role) => {
            if (name && !participants.some(p => p.name === name)) participants.push({ name, role, unit: '' });
        };
        addP(sf(project?.creator, ''), 'Pemohon');
        addP(sf(project?.pm, ''), 'PM / Analyst Pengembangan');
        addP(sf(project?.analyst, ''), 'System Analyst');
        (Array.isArray(project?.tasks) ? project.tasks : []).forEach(t => {
            addP(t.assignee_detail?.name || t.assignee, 'Developer');
        });
        setUat1(prev => ({ ...prev, participants: prev.participants.length > 0 ? prev.participants : participants }));
        updateProject(project.id, { status: 'UAT_IN_PROGRESS', sitUatData: buildSitUatData({ activeUatStep: 1 }) });
        toast.success(`Pengujian UAT Internal dimulai untuk proyek "${project.name}".`);
    };

    // ── Handler peserta UAT ──
    const handleAddUatParticipant = () => {
        setUat1(prev => ({ ...prev, participants: [...prev.participants, { name: '', role: '', unit: '' }] }));
    };
    const handleRemoveUatParticipant = (idx) => {
        setUat1(prev => ({ ...prev, participants: prev.participants.filter((_, i) => i !== idx) }));
    };
    const handleUatParticipantChange = (idx, field, val) => {
        setUat1(prev => ({
            ...prev,
            participants: prev.participants.map((p, i) => i === idx ? { ...p, [field]: val } : p),
        }));
    };

    // Skenario UAT otomatis dari task (nama task sebagai daftar skenario)
    const uatScenarioTasks = useMemo(() => {
        if (!Array.isArray(project?.tasks)) return [];
        return project.tasks.filter(t => String(t.status || '').toLowerCase() !== 'take_down');
    }, [project?.tasks]);

    const handleSaveUATStep = async (step) => {
        const nextStep = step + 1;
        setSubmitting(true);
        if (step === 1) await uploadAllDrafts(setUat1, uat1.docs);
        if (step === 2) await uploadAllDrafts(setUat2, uat2.docs);
        setActiveUatStep(nextStep);
        updateProject(project.id, { status: 'UAT_IN_PROGRESS', sitUatData: buildSitUatData({ activeUatStep: nextStep }) });
        toast.success(`UAT Tahap ${step} tersimpan. Lanjut ke Tahap ${nextStep}.`);
        setSubmitting(false);
    };

    const handleUATPass = async () => {
        setSubmitting(true);
        await uploadAllDrafts(setUat3, uat3.docs);
        updateProject(project.id, {
            status: 'DEV_COMPLETED',
            uatPassedAt: new Date().toISOString(),
            sitUatData: buildSitUatData({ activeUatStep: 3 }),
        });
        addNotification?.('BAST Diterbitkan — DEV COMPLETED!', `Proyek "${project.name}" lulus SIT & UAT Internal. Siap QA & Siber.`, 'success', '/pm/workspace');
        toast.success(`🎉 BAST Diterbitkan! Proyek resmi berstatus DEV_COMPLETED.`);
        setSubmitting(false);
    };

    // ── Persetujuan UAT multi-role: business_user (pemohon), pm, development_lead ──
    // Role user saat ini untuk approval UAT
    const uatCurrentRoleKey = ['development_lead'].includes(user?.role)
        ? 'development_lead'
        : (['dev_analyst', 'project_manager'].includes(user?.role) ? 'pm' : (user?.role === 'business_user' ? 'business_user' : null));
    const uat3Approvals = sitUatData.uat3_approvals || {};
    const allUatApproved = ['business_user', 'pm', 'development_lead'].every(
        rk => uat3Approvals?.[rk]?.approved === true
    );

    const [uatApprovalNote, setUatApprovalNote] = useState('');
    const [uatApprovalSubmitting, setUatApprovalSubmitting] = useState(false);
    const handleSubmitUatApproval = async () => {
        if (!uatCurrentRoleKey || !project?.id) return;
        if (uat3Approvals?.[uatCurrentRoleKey]?.approved) {
            toast.info('Anda sudah memberikan persetujuan UAT.');
            return;
        }
        setUatApprovalSubmitting(true);
        try {
            await projectService.submitUatApproval(project.id, uatApprovalNote.trim());
            toast.success('Persetujuan UAT Anda berhasil disimpan.');
            setUatApprovalNote('');
            refreshProject?.();
        } catch (err) {
            toast.error(`Gagal menyimpan persetujuan: ${err.message}`);
        } finally {
            setUatApprovalSubmitting(false);
        }
    };

    // ── Change Request UAT (diajukan business_user) ──
    const uatChangeRequests = sitUatData.uat_change_requests || [];
    const [showCrModal, setShowCrModal] = useState(false);
    const [crForm, setCrForm] = useState({ type: 'minor', title: '', detail: '', category: '' });
    const [crSubmitting, setCrSubmitting] = useState(false);
    const handleSubmitChangeRequest = async () => {
        if (!crForm.title.trim() || !crForm.detail.trim()) {
            toast.error('Judul dan detail change request wajib diisi!');
            return;
        }
        setCrSubmitting(true);
        try {
            await projectService.submitUatChangeRequest(project.id, {
                type: crForm.type,
                title: crForm.title.trim(),
                detail: crForm.detail.trim(),
                category: crForm.category,
            });
            toast.success('Change request UAT berhasil diajukan.');
            setShowCrModal(false);
            setCrForm({ type: 'minor', title: '', detail: '', category: '' });
            refreshProject?.();
        } catch (err) {
            toast.error(`Gagal mengajukan change request: ${err.message}`);
        } finally {
            setCrSubmitting(false);
        }
    };

    // Putuskan change request (oleh PM/Dev Lead/admin)
    const [crDecisionSubmitting, setCrDecisionSubmitting] = useState(null);
    const handleDecideChangeRequest = async (cr, decision) => {
        setCrDecisionSubmitting(cr.id);
        try {
            const note = window.prompt(
                `Catatan ${decision === 'approved' ? 'persetujuan' : 'penolakan'} change request "${cr.title}" (opsional):`,
                ''
            );
            await projectService.decideUatChangeRequest(project.id, { cr_id: cr.id, decision, note: note || '' });
            toast.success(`Change request ${decision === 'approved' ? 'disetujui' : 'ditolak'}.`);
            refreshProject?.();
        } catch (err) {
            toast.error(`Gagal memproses change request: ${err.message}`);
        } finally {
            setCrDecisionSubmitting(null);
        }
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
        addNotification?.(
            revisionType === 'UAT_TO_SIT' ? 'UAT Dikembalikan ke SIT' : 'UAT Dikembalikan ke Development',
            `Proyek "${project.name}" mengalami ${revisionType === 'UAT_TO_SIT' ? 'revisi minor (ulang SIT)' : 'revisi mayor (kembali ke dev)'}.`,
            'warning',
            '/pm/workspace'
        );
        toast.warning(`Revisi ${revisionType === 'UAT_TO_SIT' ? 'minor (ulang SIT)' : 'mayor (kembali ke dev)'} diproses.`);
        setRevisionNotes('');
        setShowRevisionModal(false);
        setSubmitting(false);
    };

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
                    <h4 className="font-bold text-sm text-gray-800">Syarat Masuk SIT (Gate) — Task Developer</h4>
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
                                        ? 'Semua task telah selesai. SIT siap dimulai.'
                                        : 'Masih ada task belum selesai. Selesaikan seluruh task (kecuali "Take Down") sebelum memulai SIT.'}
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
                        <p className="text-xs text-red-800 mt-0.5">Issue kritis ditemukan saat UAT. Pengembangan harus diulang. SIT dan UAT akan dimulai dari awal.</p>
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
                                    Lengkapi environment yang akan diuji. Jumlah skenario otomatis mengikuti task yang sudah Selesai.
                                </p>

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
                                            ? 'Semua task sudah Selesai — SIT siap dilaksanakan.'
                                            : `Masih ada ${taskGate().incomplete.length} task belum selesai. Selesai-kan semua task agar skenario tercatat otomatis.`}
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
                                            {approvedTaskCount === taskGate().total
                                                ? ' ✓ Semua task disetujui — siap lanjut ke Review & Sign-Off.'
                                                : ' ⚠ Masih ada task belum disetujui (OK). Lanjut hanya jika SEMUA task dicentang OK.'}
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
                                        Centang <strong>OK</strong> pada setiap task yang sudah lolos &amp; disetujui tim. Lampirkan <strong>bukti</strong> (screenshot/file) per task melalui kolom <strong>Lampiran Bukti</strong>. Gunakan <strong>Revisi</strong> untuk mengembalikan task ke developer. Lanjut ke Review &amp; Sign-Off hanya jika SEMUA task disetujui.
                                    </p>
                                    <SITTaskExecution
                                        project={project}
                                        approvals={sit2Approvals}
                                        onApprovalsChange={handleApprovalsChange}
                                        onRequestRevision={setShowTaskRevisionModal}
                                    />
                                </div>

                                {!sitDone && (status === 'SIT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeSitStep === 2 && (
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => handleSaveSITStep(2)} disabled={taskGate().total === 0 || approvedTaskCount !== taskGate().total}
                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer">
                                            Simpan &amp; Lanjut Review <ArrowRight size={14} />
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
                                                const devList = ap?.developers || [];
                                                detail = devApproved
                                                    ? `✓ ${approvedDeveloperCount}/${requiredDeveloperCount} developer menyetujui`
                                                    : devList.length > 0
                                                        ? `${devList.length}/${requiredDeveloperCount} developer menyetujui`
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
                                    {currentRoleKey === 'developer' && !devApproved && !sitDone && (
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
                                    {currentRoleKey === 'developer' && devApproved && (
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
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Hasil Review / Berita Acara SIT</label>
                                        {!sitDone && (
                                            <label className={`px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${uploadingCategory === 'SIT_SIGNOFF' ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}>
                                                {uploadingCategory === 'SIT_SIGNOFF' ? (
                                                    <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Mengunggah...</>
                                                ) : (
                                                    <><Upload size={12} /> Upload</>
                                                )}
                                                <input type="file" ref={sit3FileRef} multiple accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={e => onUpload(e, setSit3, 'docs', 'SIT_SIGNOFF')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={sit3.docs} onRemove={i => onRemoveDoc(setSit3, i)} onView={viewDoc} onDownload={downloadDoc} onTypeChange={(i, t) => changeDocType(setSit3, i, t)} docTypeOptions={docTypeOptions('SIT_SIGNOFF')} readOnly={sitDone} />
                                </div>

                                {/* Action buttons (hanya non-viewer) */}
                                {!sitDone && !isViewer && (status === 'SIT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeSitStep === 3 && (
                                    <div className="flex flex-col sm:flex-row gap-3 justify-between pt-2 border-t border-gray-100">
                                        <button
                                            onClick={() => { setRevisionType('SIT_TO_DEV'); setShowRevisionModal(true); }}
                                            className="px-5 py-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                                        >
                                            <RotateCcw size={14} /> SIT Perlu Revisi — Kembalikan ke Dev
                                        </button>
                                        <button
                                            onClick={handleSITPass}
                                            disabled={submitting || !sit3.reviewNotes || !allSitApproved}
                                            title={allSitApproved ? '' : 'Semua persetujuan (Developer, PM / Analyst Pengembangan, Development Lead) harus lengkap terlebih dahulu'}
                                            className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 ${allSitApproved && sit3.reviewNotes ? 'bg-teal-600 hover:bg-teal-700 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'}`}
                                        >
                                            <CheckCircle2 size={14} /> SIT Lulus — Lanjut ke UAT Internal
                                        </button>
                                    </div>
                                )}
                                {!allSitApproved && !sitDone && !isViewer && (
                                    <p className="text-[10px] text-gray-400 text-right">
                                        Tombol "SIT Lulus" aktif setelah Developer, PM / Analyst Pengembangan, dan Development Lead menyetujui.
                                    </p>
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

                                {/* Informasi proyek & unit */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Unit / Divisi Peminta *</label>
                                        <input type="text" value={uat1.unit} onChange={e => setUat1(p => ({ ...p, unit: e.target.value }))}
                                            placeholder={project?.division || 'Contoh: Divisi Operasional'} disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Tanggal Pelaksanaan *</label>
                                        <input type="date" value={uat1.startDate} onChange={e => setUat1(p => ({ ...p, startDate: e.target.value }))} disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Sampai Tanggal *</label>
                                        <input type="date" value={uat1.endDate} onChange={e => setUat1(p => ({ ...p, endDate: e.target.value }))} disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                </div>

                                {/* Disiapkan oleh */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Disiapkan Oleh (PM / Analis Pengembangan) *</label>
                                    <input type="text" value={uat1.preparedBy} onChange={e => setUat1(p => ({ ...p, preparedBy: e.target.value }))}
                                        placeholder="Nama PM / Perwakilan Divisi" disabled={uatDone}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                </div>

                                {/* Peserta yang terlibat */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Peserta yang Terlibat</label>
                                        {!uatDone && (
                                            <button onClick={handleAddUatParticipant} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer">
                                                <Plus size={12} /> Tambah Peserta
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 mb-3">
                                        Otomatis terisi dari pemohon, PM, analis, dan developer proyek. Tambahkan pihak lain bila diperlukan.
                                    </p>
                                    {uat1.participants.length === 0 ? (
                                        <p className="text-[11px] text-gray-400 italic">Belum ada peserta. Mulai UAT untuk mengisi otomatis.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {uat1.participants.map((p, idx) => (
                                                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                                                    <input type="text" value={p.name} onChange={e => handleUatParticipantChange(idx, 'name', e.target.value)}
                                                        placeholder="Nama peserta" disabled={uatDone}
                                                        className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                                    <input type="text" value={p.role} onChange={e => handleUatParticipantChange(idx, 'role', e.target.value)}
                                                        placeholder="Peran (Pemohon/PM/Developer/dll)" disabled={uatDone}
                                                        className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                                    <input type="text" value={p.unit} onChange={e => handleUatParticipantChange(idx, 'unit', e.target.value)}
                                                        placeholder="Unit / Divisi" disabled={uatDone}
                                                        className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 bg-gray-50 disabled:bg-gray-100" />
                                                    {!uatDone && (
                                                        <button onClick={() => handleRemoveUatParticipant(idx)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
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

                                {/* Dokumen */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Skenario UAT / Use Case Matrix</label>
                                        {!uatDone && (
                                            <label className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors">
                                                <Upload size={12} /> Upload
                                                <input type="file" ref={uat1FileRef} multiple accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={e => onUpload(e, setUat1, 'docs', 'UAT_PREP')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={uat1.docs} onRemove={i => onRemoveDoc(setUat1, i)} onView={viewDoc} onDownload={downloadDoc} onTypeChange={(i, t) => changeDocType(setUat1, i, t)} docTypeOptions={docTypeOptions('UAT_PREP')} readOnly={uatDone} />
                                </div>
                                {!uatDone && (status === 'UAT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeUatStep === 1 && (
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => handleSaveUATStep(1)} disabled={!uat1.unit || !uat1.startDate || !uat1.endDate || !uat1.preparedBy}
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
                                        <input type="number" value={uat2.executedCount} onChange={e => setUat2(p => ({ ...p, executedCount: e.target.value }))}
                                            placeholder="Contoh: 20" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Skenario Diterima *</label>
                                        <input type="number" value={uat2.passedCount} onChange={e => setUat2(p => ({ ...p, passedCount: e.target.value }))}
                                            placeholder="Contoh: 19" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Temuan / CR</label>
                                        <input type="number" value={uat2.findings} onChange={e => setUat2(p => ({ ...p, findings: e.target.value }))}
                                            placeholder="Contoh: 1" disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 bg-gray-50 disabled:bg-gray-100" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Catatan Hasil UAT &amp; Temuan Detail</label>
                                    <textarea rows={3} value={uat2.execNotes} onChange={e => setUat2(p => ({ ...p, execNotes: e.target.value }))}
                                        placeholder="Catatan hasil pengujian, temuan bug/CR, status perbaikan..." disabled={uatDone}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Dokumen: Bukti Eksekusi UAT &amp; Sign-off Sheet</label>
                                        {!uatDone && (
                                            <label className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors">
                                                <Upload size={12} /> Upload
                                                <input type="file" ref={uat2FileRef} multiple accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={e => onUpload(e, setUat2, 'docs', 'UAT_EXEC')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={uat2.docs} onRemove={i => onRemoveDoc(setUat2, i)} onView={viewDoc} onDownload={downloadDoc} onTypeChange={(i, t) => changeDocType(setUat2, i, t)} docTypeOptions={docTypeOptions('UAT_EXEC')} readOnly={uatDone} />
                                </div>
                                {!uatDone && (status === 'UAT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeUatStep === 2 && (
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => handleSaveUATStep(2)} disabled={!uat2.executedCount || !uat2.passedCount}
                                            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer">
                                            Simpan &amp; Lanjut Persetujuan Final <ArrowRight size={14} />
                                        </button>
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
                                            { label: 'Dieksekusi', val: uat2.executedCount || '-' },
                                            { label: 'Diterima', val: uat2.passedCount || '-' },
                                        ].map(s => (
                                            <div key={s.label} className="bg-white rounded-lg p-2.5 border border-slate-200">
                                                <p className="text-slate-500 text-[9px] font-bold uppercase">{s.label}</p>
                                                <p className="font-bold text-slate-800 text-xs mt-0.5">{s.val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Persetujuan Multi-Role UAT ── */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ShieldCheck size={15} className="text-emerald-600" />
                                        <h6 className="font-bold text-sm text-gray-800">Persetujuan UAT</h6>
                                        <span className="ml-auto text-[10px] font-bold text-gray-500">
                                            {['business_user', 'pm', 'development_lead'].filter(rk => uat3Approvals?.[rk]?.approved).length} / 3 disetujui
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { key: 'business_user', label: 'Pemohon (Business User)', desc: 'Perwakilan unit peminta', color: 'amber', icon: <Users size={16} className="text-amber-500" /> },
                                            { key: 'pm', label: 'PM / Analyst Pengembangan', desc: 'Project Manager proyek', color: 'indigo', icon: <UserCheck size={16} className="text-indigo-500" /> },
                                            { key: 'development_lead', label: 'Development Lead', desc: 'Pimpinan pengembangan', color: 'emerald', icon: <ShieldCheck size={16} className="text-emerald-500" /> },
                                        ].map(r => {
                                            const ap = uat3Approvals?.[r.key];
                                            const approved = ap?.approved === true;
                                            const colorMap = { amber: 'amber', indigo: 'indigo', emerald: 'emerald' }[r.color];
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
                                                    {approved ? (
                                                        <p className="text-[10px] text-emerald-700 mt-1.5">
                                                            ✓ {ap.approvedBy} • {fmtDate(ap.at)}
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] text-gray-300 mt-1.5">Belum memberikan persetujuan</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Form approval untuk role saat ini */}
                                    {uatCurrentRoleKey && !uat3Approvals?.[uatCurrentRoleKey]?.approved && !uatDone && (
                                        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                            <p className="text-[11px] font-bold text-emerald-800 mb-2 flex items-center gap-1.5">
                                                <UserCheck size={13} /> Anda (sebagai {uatCurrentRoleKey === 'development_lead' ? 'Development Lead' : uatCurrentRoleKey === 'pm' ? 'PM / Analyst Pengembangan' : 'Pemohon (Business User)'}) dapat menyetujui UAT
                                            </p>
                                            <textarea
                                                rows={2}
                                                value={uatApprovalNote}
                                                onChange={e => setUatApprovalNote(e.target.value)}
                                                placeholder="Catatan persetujuan (opsional)..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-white resize-none"
                                            />
                                            <button
                                                onClick={handleSubmitUatApproval}
                                                disabled={uatApprovalSubmitting}
                                                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                {uatApprovalSubmitting ? (
                                                    <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                                                ) : (
                                                    <><CheckCircle2 size={13} /> Setujui UAT</>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    {uatCurrentRoleKey && uat3Approvals?.[uatCurrentRoleKey]?.approved && (
                                        <p className="text-[10px] text-emerald-600 mt-2 flex items-center gap-1">
                                            <CheckCircle2 size={11} /> Anda telah menyetujui UAT pada proyek ini.
                                        </p>
                                    )}
                                </div>

                                {/* ── Change Request UAT ── */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <RotateCcw size={14} className="text-orange-500" />
                                            <h6 className="font-bold text-sm text-gray-800">Change Request UAT</h6>
                                        </div>
                                        {user?.role === 'business_user' && !uatDone && (
                                            <button onClick={() => setShowCrModal(true)} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer">
                                                <Plus size={12} /> Ajukan Change Request
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 mb-2">
                                        Pemohon dapat mengajukan pembaruan, permintaan tambahan, atau perbaikan (minor/mayor). Mayor akan kembali ke development, minor mengulang SIT.
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
                                                        {cr.status === 'pending' && user?.role !== 'business_user' && !uatDone && (
                                                            <div className="flex gap-2 mt-2">
                                                                <button
                                                                    onClick={() => handleDecideChangeRequest(cr, 'approved')}
                                                                    disabled={crDecisionSubmitting === cr.id}
                                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                                                >
                                                                    Setujui (perbaiki)
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDecideChangeRequest(cr, 'rejected')}
                                                                    disabled={crDecisionSubmitting === cr.id}
                                                                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 border border-red-300 text-red-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                                                >
                                                                    Tolak
                                                                </button>
                                                            </div>
                                                        )}
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
                                            placeholder="Pernyataan persetujuan: semua skenario bisnis telah diverifikasi dan dinyatakan memenuhi kebutuhan FSD..." disabled={uatDone}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50 resize-none disabled:bg-gray-100" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Disetujui Oleh</label>
                                        <input type="text" value={uat3.approvedBy} onChange={e => setUat3(p => ({ ...p, approvedBy: e.target.value }))}
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
                                                <input type="file" ref={uat3FileRef} multiple accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={e => onUpload(e, setUat3, 'docs', 'UAT_APPROVAL')} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <DocList docs={uat3.docs} onRemove={i => onRemoveDoc(setUat3, i)} onView={viewDoc} onDownload={downloadDoc} onTypeChange={(i, t) => changeDocType(setUat3, i, t)} docTypeOptions={docTypeOptions('UAT_APPROVAL')} readOnly={uatDone} />
                                </div>
                                {/* Action buttons */}
                                {!uatDone && (status === 'UAT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeUatStep === 3 && (
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
                                            disabled={submitting || !allUatApproved}
                                            title={allUatApproved ? '' : 'Semua persetujuan (Pemohon, PM, Development Lead) harus lengkap terlebih dahulu'}
                                            className={`w-full px-6 py-3 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${allUatApproved ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'}`}
                                        >
                                            <Send size={16} /> UAT Lulus — Tetapkan DEV_COMPLETED &amp; Lanjut ke QA / Siber
                                        </button>
                                        {!allUatApproved && (
                                            <p className="text-[10px] text-gray-400 text-center">
                                                Tombol "UAT Lulus" aktif setelah Pemohon, PM, dan Development Lead menyetujui.
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

            {/* ─── MODAL: Revision tingkat SIT/UAT ─── */}
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

            {/* ─── MODAL: Ajukan Change Request UAT ─── */}
            {showCrModal && (
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
                            <button onClick={() => setShowCrModal(false)} disabled={crSubmitting}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">
                                Batal
                            </button>
                            <button
                                onClick={handleSubmitChangeRequest}
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