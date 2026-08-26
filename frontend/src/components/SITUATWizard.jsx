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
    ShieldCheck,
    Server,
    CheckSquare,
    Lock,
    CheckCircle2,
    Upload,
    X,
    FileText,
    ArrowRight,
    AlertTriangle,
    RotateCcw,
    Send,
    Paperclip,
    Info,
    ChevronRight,
    Clock,
    Eye,
    Download,
    ClipboardList,
    Bug,
    UserCheck,
    FileCheck,
    BookOpen,
    Users,
    Trash2,
    Plus,
    Check,
    Edit,
    Save,
    RefreshCw,
    Link2,
} from 'lucide-react';
import { generateDocumentName, getDocumentTypeInfo, formatFileSize } from '../utils/documentNaming';
import { taskService, projectService, documentService, userService } from '../services/api';
import { CHANGE_REQUEST_OPEN_STATUSES, getChangeRequestStatusLabel } from '../constants/uatChangeRequest';
import SITTaskExecution from './SITTaskExecution';
import DocumentViewerModal from './DocumentViewerModal';

// ─── Helper: safely render object or string field ────────────────────────────
// `0` dan `false` sengaja tidak dianggap kosong supaya angka nol tetap tampil.
const sf = (val, fb = '-') => {
    if (val === null || val === undefined || val === '') return fb;
    if (typeof val === 'object') return String(val.name || val.label || val.initial || fb);
    return String(val);
};

// ─── Helper: label waktu penyimpanan draft ───────────────────────────────────
// Jam saja bila draft disimpan hari ini, lengkap dengan tanggal bila lebih lama,
// supaya "tersimpan 14.05" tidak terbaca sebagai penyimpanan beberapa menit lalu
// padahal berasal dari sesi pengisian hari sebelumnya.
const draftSavedLabel = (isoString) => {
    if (!isoString) return '';
    const parsed = new Date(isoString);
    if (Number.isNaN(parsed.getTime())) return '';
    const isToday = parsed.toDateString() === new Date().toDateString();
    return parsed.toLocaleString('id-ID', isToday
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// ─── Helper: format timestamp ────────────────────────────────────────────────
// Tanpa penjaga NaN, timestamp rusak dari `sit_uat_data` lama akan tampil sebagai
// tulisan "Invalid Date" di UI.
const fmtDate = (iso) => {
    if (!iso) return '-';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
const SIT_SIGN_OFF_DOCUMENT_TYPES = ['SIT_RESULT', 'SIT_SIGNOFF'];
const UAT_PREPARATION_DOCUMENT_TYPES = ['UNDANGAN', 'UAT_PLAN', 'LAMPIRAN', 'LAINNYA'];
// Jeda autosave draft Persiapan UAT: cukup lama agar satu kalimat yang sedang
// diketik tidak menghasilkan puluhan permintaan, cukup singkat agar isian sudah
// tersimpan ketika pengguna berpindah laman untuk mencari data pendukung.
const UAT1_AUTOSAVE_DELAY_MS = 1500;
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
    requester: ['business_user'],
    developer: ['developer'],
    analyst_pm: ['project_manager', 'dev_analyst', 'analyst'],
    development_group_lead: ['development_lead', 'lead_group'],
    technology_division_lead: ['head_of_it'],
};
// Cermin `UatApprovalRole::requiredMode()` di backend: hanya pimpinan grup dan pimpinan
// divisi pemohon yang memakai link pribadi, karena keduanya belum tentu memiliki akun
// aplikasi. Pemohon proyek selalu memiliki akun — dialah yang mengajukan proyeknya —
// sehingga persetujuannya dikerjakan langsung di dalam aplikasi.
//
// Aturannya sengaja ditulis satu kali di sini dan dibaca oleh penyeedan peserta,
// penurunan mode saat posisi diganti, serta validasi sebelum simpan. Sebelumnya tiap
// tempat menyimpulkan sendiri dari `side === 'requester'`, dan itulah yang membuat
// wizard mengirim mode yang selalu ditolak backend begitu aturannya berubah.
const UAT_EXTERNAL_LINK_APPROVAL_ROLES = ['requester_group_lead', 'requester_division_lead'];
const uatRequiredApprovalMode = (approvalRole) => (
    UAT_EXTERNAL_LINK_APPROVAL_ROLES.includes(approvalRole) ? 'external_link' : 'internal_account'
);

/**
 * Identitas stabil satu peserta UAT.
 *
 * Wajib berbentuk UUID. Backend memakai `Str::isUuid()` untuk memutuskan apakah
 * `uat_approvers.participant_key` boleh mengikuti id peserta ini; bila id-nya bukan
 * UUID, backend membangkitkan kunci acaknya sendiri sehingga matriks approval tidak
 * akan pernah cocok dengan daftar peserta — matriks selalu dilaporkan tidak sinkron,
 * dan sinkronisasi mencabut lalu menduplikasi seluruh approver.
 *
 * `crypto.randomUUID` hanya ada pada secure context, jadi aplikasi yang diakses lewat
 * HTTP di alamat LAN tidak memilikinya. Cadangannya menyusun UUID v4 sendiri dari
 * `crypto.getRandomValues`, yang tersedia juga di luar secure context.
 */
const participantId = () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // versi 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // varian RFC 4122

    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Latar ikon kartu approval SIT Tahap 3, ditulis sebagai kelas utuh agar terdeteksi
// pemindai Tailwind.
const SIT3_ROLE_ICON_BG = {
    blue: 'bg-blue-100',
    amber: 'bg-amber-100',
    emerald: 'bg-emerald-100',
};

// Peserta yang tersimpan sebelum kolom `id` diperkenalkan tidak punya identitas stabil.
// Backfill di sini supaya editor inline dan React key selalu punya kunci yang tidak
// berubah saat baris lain dihapus.
//
// Mode approver sekaligus diselaraskan dengan `uatRequiredApprovalMode()`. Roster yang
// disimpan sebelum posisi pemohon berpindah ke akun internal masih membawa
// `external_link`, dan baris seperti itu pasti ditolak backend saat disimpan ulang.
// Memperbaikinya di sini bukan kemewahan: memilih ulang opsi yang sudah terpilih tidak
// memicu `change` pada `<select>`, sehingga PM tidak punya cara wajar menurunkan modenya
// kembali tanpa berpindah posisi lalu kembali. Nomor HP yang tidak lagi terpakai
// dikosongkan agar tidak tersimpan sebagai data yatim.
const normalizeUatParticipants = (savedParticipants) => (
    Array.isArray(savedParticipants) ? savedParticipants : []
).map(participant => {
    const withId = participant?.id ? participant : { ...participant, id: participantId() };
    if (withId?.isApprover !== true || !withId.approvalRole) return withId;
    const requiredMode = uatRequiredApprovalMode(withId.approvalRole);
    if (withId.approvalMode === requiredMode) return withId;
    return {
        ...withId,
        approvalMode: requiredMode,
        phone: requiredMode === 'internal_account' ? '' : withId.phone,
    };
});

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

// 🔓 MODE PEMERIKSAAN/UNLOCK: escape hatch khusus debug lokal. Bila true, seluruh
// tahapan SIT & UAT dapat dibuka dan diedit tanpa memperhatikan status proyek,
// sehingga tombol aksi bisa memicu transisi yang ditolak backend.
// WAJIB tetap `false` di staging dan produksi.
const UNLOCK_ALL_STAGES = false;

// ─── Status Gate SIT & UAT ───────────────────────────────────────────────────
// Daftar status di bawah ini adalah cermin dari `allowedTransitions` pada
// `backend/app/Services/ProjectWorkflowService.php`. Bila state machine backend
// berubah, daftar ini harus disesuaikan agar tombol aksi tidak pernah menawarkan
// transisi yang akan ditolak backend.

// Status tempat tombol "Mulai Pengujian SIT" sah ditekan, yaitu status yang
// memang mengizinkan transisi ke SIT_IN_PROGRESS.
const SIT_STARTABLE_STATUSES = ['IN_DEVELOPMENT', 'SIT_REVISION', 'UAT_REVISION_DEV'];

// Status tempat SIT sedang berjalan atau sedang menunggu dikerjakan ulang.
// Dipakai hanya untuk aksen visual kartu SIT.
const SIT_ACTIVE_STATUSES = ['SIT_IN_PROGRESS', 'SIT_REVISION', 'UAT_REVISION_DEV'];

// Status yang berarti pelaksanaan SIT sudah selesai sehingga wizard tampil
// read-only. Seluruh fase sesudah UAT Internal ikut disertakan supaya berita
// acara SIT tetap dapat dibaca untuk keperluan audit ketika proyek sudah berada
// di QA, Siber, UAT bisnis, maupun produksi.
const SIT_COMPLETED_STATUSES = [
    'SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT', 'UAT_PASSED', 'DEV_COMPLETED',
    'RETURN_TO_DEV', 'READY_FOR_QA', 'QA_IN_PROGRESS', 'QA_PASSED',
    'CYBER_IN_PROGRESS', 'CYBER_PASSED', 'READY_FOR_UAT',
    'PENDING_GOLIVE', 'LIVE_PRODUCTION',
];

// Status yang berarti UAT Internal sudah selesai. Alasannya sama dengan
// SIT_COMPLETED_STATUSES: berita acara UAT Internal harus tetap terbaca setelah
// proyek bergerak ke fase berikutnya.
const UAT_COMPLETED_STATUSES = [
    'UAT_PASSED', 'DEV_COMPLETED', 'RETURN_TO_DEV', 'READY_FOR_QA',
    'QA_IN_PROGRESS', 'QA_PASSED', 'CYBER_IN_PROGRESS', 'CYBER_PASSED',
    'READY_FOR_UAT', 'PENDING_GOLIVE', 'LIVE_PRODUCTION',
];

// Status tempat UAT Internal sedang berjalan. Dipakai untuk aksen visual saja.
const UAT_ACTIVE_STATUSES = ['SIT_PASSED', 'UAT_IN_PROGRESS', 'UAT_REVISION_SIT'];

// Status tempat kartu UAT Internal boleh dibuka, baik untuk dikerjakan maupun
// dibaca sebagai riwayat.
const UAT_UNLOCKED_STATUSES = SIT_COMPLETED_STATUSES;

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
export default function SITUATWizard({ project, updateProject, addNotification, navigate, refreshProject, isViewer = false, initialSitStep = null, initialUatStep = null }) {
    const status = project?.status || 'IN_DEVELOPMENT';
    const sitUatData = project?.sitUatData || {};
    const { user } = useAuth();
    const sitRetestCycle = Number(sitUatData.uat_hold?.cycle || 0);

    // Revisi Mayor kini memulai ulang kedua siklus: seluruh task diuji ulang di SIT,
    // lalu UAT dijalankan lagi dari Tahap 1. Penanda backend berganti nama menjadi
    // `uat_restart_after_sit`, tetapi baris yang tersimpan sebelum perubahan masih
    // membawa `uat2_resume_after_sit`. Keduanya dibaca di satu tempat agar tidak ada
    // cabang UI yang kelewat saat kunci lama akhirnya hilang dari data produksi.
    const isUatRestartPending = sitUatData.uat_restart_after_sit === true
        || sitUatData.uat2_resume_after_sit === true;

    // Revisi Minor tidak memundurkan siklus: SIT tidak diulang dan Tahap 3 tetap
    // terbuka dengan roster penanda tangan yang sama. Yang ditahan hanya keputusan
    // persetujuannya, sampai seluruh Change Request Minor selesai dikerjakan tim
    // pengembangan. Bacanya dari `uat_hold` — penanda yang sama yang dipakai
    // `Project::isUatMinorRevisionPending()` di backend — supaya UI dan gerbang
    // servernya tidak pernah berbeda pendapat.
    const isUatMinorRevisionPending = sitUatData.uat_hold?.reason === 'minor_revision'
        && sitUatData.uat_hold?.status === 'developer_revision';

    // Dua pertanyaan yang dulu dijawab satu variabel dan sekarang harus dipisah:
    // (1) apakah SIT ini bagian dari siklus revisi — tetap memperketat syarat bukti
    //     pengujian baru per task; dan
    // (2) apakah scope-nya dipersempit ke task tertentu — sekarang hanya berlaku untuk
    //     baris lama yang masih menyimpan `sit_retest_scope.mode === 'targeted'`,
    //     karena re-test baru selalu 'full' dengan `taskIds: []`.
    const isSitRevisionCycle = isUatRestartPending && sitRetestCycle > 0;
    const sitRetestScope = sitUatData.sit_retest_scope || {};
    const isTargetedSitRetest = isSitRevisionCycle
        && sitRetestScope.mode === 'targeted';
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

    // Daftar task diambil ke variabel lokal supaya dependency memo di bawah persis
    // sama dengan nilai yang dibaca (bukan objek `project` seutuhnya).
    const projectTasks = project?.tasks;

    const sitScopeTasks = useMemo(() => {
        const tasks = Array.isArray(projectTasks) ? projectTasks : [];

        return tasks.filter(task => String(task.status || '').toLowerCase() !== 'take_down'
            && (!isTargetedSitRetest || sitRetestTaskIdSet.has(Number(task.id))));
    }, [isTargetedSitRetest, projectTasks, sitRetestTaskIdSet]);

    // Role user saat ini → apakah dia pemegang hak approval SIT.
    // PM (dev_analyst / project_manager) = Analyst Pengembangan.
    const currentRoleKey = ['developer', 'development_lead'].includes(user?.role)
        ? user.role
        : (['dev_analyst', 'project_manager'].includes(user?.role) ? 'pm' : null);
    // Approval SIT dari role (disimpan di sitUatData.sit3_approvals)
    const sit3Approvals = sitUatData.sit3_approvals || {};

    // Daftar developer yang wajib menyetujui hasil SIT.
    //
    // Gabungan dua himpunan, sama dengan `Project::sitApprovalDeveloperIds()` di
    // backend: seluruh developer pada tim proyek, ditambah penerima task pada scope
    // SIT yang sedang berjalan (bila ada yang tidak tercatat sebagai anggota tim).
    // Sebelumnya hanya penerima task yang dihitung, sehingga developer lain pada tim
    // yang sama tidak pernah dimintai persetujuan meskipun ikut memikul hasil rilis.
    //
    // Penanda "developer" diambil dari `user_role` (role global pengguna), bukan dari
    // `role` anggota tim yang berupa teks bebas jabatan dalam proyek.
    const projectTeam = project?.team;
    const requiredDeveloperIds = useMemo(() => {
        const teamDeveloperIds = (Array.isArray(projectTeam) ? projectTeam : [])
            .filter(member => member?.user_role === 'developer')
            .map(member => member.user_id);

        const scopeAssigneeIds = sitScopeTasks.map(t => t.assignee_id ?? t.assignee_detail?.id);

        return [...new Set(
            [...teamDeveloperIds, ...scopeAssigneeIds]
                .filter(id => id != null)
                .map(id => Number(id))
        )];
    }, [projectTeam, sitScopeTasks]);
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
    // Tab SIT awal boleh ditentukan lewat query `?sitStep=` agar inbox "Persetujuan Saya"
    // dapat menautkan langsung ke Tahap 3. Nilainya dibatasi maksimal langkah yang sudah
    // tercatat di backend: tautan tidak boleh menjadi jalan pintas melewati tahap yang
    // belum dikerjakan, sebab `buildSitUatData` akan ikut menaikkan langkah tersimpan
    // begitu wizard disimpan dari tab yang dibuka.
    const [activeSitStep, setActiveSitStep] = useState(() => {
        const savedStep = Number(sitUatData.activeSitStep) || 1;
        const requestedStep = Number(initialSitStep);
        return [1, 2, 3].includes(requestedStep) ? Math.min(requestedStep, savedStep) : savedStep;
    });
    const [activeUatStep, setActiveUatStep] = useState(() => {
        // Sama seperti `?sitStep=`: tautan dari inbox tidak boleh menjadi jalan pintas ke
        // tahap yang belum dikerjakan. Tanpa clamp ini `?uatStep=3` membuka Persetujuan
        // Final walau eksekusi UAT belum pernah disimpan, dan penyimpanan berikutnya ikut
        // menaikkan langkah tersimpan ke 3 — progres proyek jadi berbohong.
        const savedStep = Number(sitUatData.activeUatStep) || 1;
        const requestedStep = Number(initialUatStep);
        return [1, 2, 3].includes(requestedStep) ? Math.min(requestedStep, savedStep) : savedStep;
    });

    // Langkah tertinggi yang tercatat di backend. `activeSitStep`/`activeUatStep` hanya
    // menyatakan tab yang sedang dibuka, sehingga menengok kembali ke tab sebelumnya
    // tidak boleh dianggap sebagai kemunduran progres: nilai tersimpan inilah acuan
    // "sudah pernah sampai mana", dipakai oleh penanda selesai, navigasi tab, dan
    // penjaga di `buildSitUatData` agar penyimpanan tidak pernah menurunkan langkah.
    const storedActiveSitStep = Number(sitUatData.activeSitStep) || 1;
    const storedActiveUatStep = Number(sitUatData.activeUatStep) || 1;
    const reachedSitStep = Math.max(activeSitStep, storedActiveSitStep);

    // Pengecualian untuk restart UAT akibat revisi Mayor: backend mengarsipkan lalu
    // MENGHAPUS hasil Tahap 2 dan putaran approval Tahap 3, jadi tahap itu memang tidak
    // selesai lagi. Mempertahankan high-water mark di sini akan menandai Tahap 2/3
    // "Selesai ✓" untuk data yang sudah tidak ada dan membuat tab-nya bisa dilompati
    // tanpa dieksekusi. Selama sebuah siklus revisi pernah terjadi dan snapshot hasil UAT
    // belum difinalkan ulang, satu-satunya acuan yang jujur adalah langkah tersimpan.
    // Data lama dari alur verifikasi Mayor tetap membawa `uat2_summary.submittedAt`,
    // sehingga perilaku high-water mark-nya tidak berubah.
    const uatProgressWasReset = sitRetestCycle > 0 && !sitUatData.uat2_summary?.submittedAt;
    const reachedUatStep = uatProgressWasReset
        ? storedActiveUatStep
        : Math.max(activeUatStep, storedActiveUatStep);

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
    // Inisialisasi lazy: argumen `useState` biasa dievaluasi setiap render walau
    // hasilnya dibuang. `normalizeUatParticipants` sampai membuat UUID baru tiap render,
    // jadi bentuk fungsi dipakai agar hanya berjalan sekali.
    const [uat1, setUat1] = useState(() => ({
        scenarioList: sitUatData.uat1_scenarioList || '',        // daftar skenario (derived dari task, editable)
        preparedBy: sitUatData.uat1_preparedBy || '',            // disiapkan oleh (PM)
        prepNotes: sitUatData.uat1_prepNotes || '',              // catatan persiapan
        // Peserta yang terlibat dalam UAT
        participants: normalizeUatParticipants(sitUatData.uat1_participants), // [{id, name, role, unit, phone, ...}]
        // Jadwal pelaksanaan UAT
        startDate: sitUatData.uat1_startDate || '',
        endDate: sitUatData.uat1_endDate || '',
        // Unit / divisi peminta
        unit: sitUatData.uat1_unit || '',
        docs: sitUatData.uat1_docs || [],
    }));
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
    const [uat2, setUat2] = useState(() => ({
        scenarios: buildUatExecutionScenarios(
            sitUatData.uat2_scenarios,
            project?.tasks,
            sitUatData.uat2_additional_requests
        ),
        additionalRequests: buildUatAdditionalRequests(sitUatData.uat2_additional_requests),
        execNotes: sitUatData.uat2_summary?.notes || sitUatData.uat2_execNotes || '',
    }));
    // UAT Step 3 data
    const [uat3, setUat3] = useState({
        approvalNotes: sitUatData.uat3_approvalNotes || '',
        approvedBy: sitUatData.uat3_approvedBy || '',
        docs: sitUatData.uat3_docs || [],
    });

    // Revision & modal state (SIT/UAT level)
    const [submitting, setSubmitting] = useState(false);
    const [savingUatDraft, setSavingUatDraft] = useState(false);
    // Draft Persiapan UAT (tab 1). `uat1DraftSavedAt` menampung waktu penyimpanan
    // terakhir — baik dari autosave maupun tombol "Simpan sebagai Draft" — supaya
    // pengguna tahu isian formulirnya sudah tersimpan sebelum ia berpindah laman
    // untuk mencari data pendukung.
    const [savingUat1Draft, setSavingUat1Draft] = useState(false);
    const [uat1DraftSavedAt, setUat1DraftSavedAt] = useState(sitUatData.uat1_draft_saved_at || null);

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

    /**
     * Mengubah tipe dokumen draft sekaligus nama maskingnya.
     *
     * `docs` wajib dikirim oleh pemanggil, bukan dibaca dari dalam updater `setState`.
     * React hanya menjalankan updater secara sinkron lewat optimasi eager state, yaitu
     * ketika komponen belum punya update tertunda. Karena pemanggil di halaman ini
     * hampir selalu memicu setState lain lebih dulu, pola lama (menugaskan variabel
     * luar dari dalam updater) menghasilkan `null` dan berkas gagal diproses.
     */
    const changeDocType = async (setter, docs, idx, newDocType) => {
        const target = (docs || [])[idx] || null;
        if (!target) return;

        const info = getDocumentTypeInfo(newDocType);
        const ext = (target.name?.split('.').pop() || 'file').toLowerCase();
        const newName = `${maskedDocName(newDocType)}.${ext}`;
        setter(prev => ({
            ...prev,
            docs: (prev.docs || []).map((d, i) => (
                i === idx ? { ...d, doc_type: newDocType, color: info.color, name: newName, maskedName: newName } : d
            )),
        }));

        if (!target.docId) return;

        // Nama masking di server mengikuti tipe dokumen, sehingga berkas yang sudah
        // terunggah perlu diganti. API dokumen belum punya endpoint update metadata,
        // jadi caranya hapus lalu unggah ulang — dan itu hanya aman bila salinan lokal
        // (`rawFile`) masih ada. Setelah halaman dimuat ulang `rawFile` sudah hilang,
        // maka dokumen dibiarkan utuh agar tidak terhapus permanen tanpa pengganti.
        if (!target.rawFile) {
            toast('Tipe diperbarui pada wizard. Nama berkas di server tetap memakai tipe lama; hapus lalu unggah ulang bila perlu diselaraskan.', { icon: 'ℹ️' });
            return;
        }

        try {
            await documentService.delete(target.docId);
        } catch (error) {
            toast.error(`Gagal mengganti berkas lama di server: ${error.message}`);
            return;
        }
        await uploadDocToServer(setter, docs, idx, newDocType);
    };

    /**
     * Mengunggah satu draft ke server. Mengembalikan objek dokumen versi terbaru
     * (sudah berisi `docId`) supaya pemanggil bisa langsung mempersist referensinya,
     * atau `null` bila upload gagal / tidak ada berkas yang perlu diunggah.
     */
    const uploadDocToServer = async (setter, docs, idx, docType) => {
        const target = (docs || [])[idx] || null;
        if (!target?.rawFile || !project?.id) return null;

        const resolvedType = docType || target.doc_type || 'LAINNYA';
        setter(prev => ({
            ...prev,
            docs: (prev.docs || []).map((d, i) => (i === idx ? { ...d, isUploading: true } : d)),
        }));
        try {
            const res = await documentService.upload(target.rawFile, {
                project_id: project.id,
                document_type: resolvedType,
                original_filename: target.originalName,
            });
            const doc = res?.data || {};
            const ext = (target.originalName?.split('.').pop() || 'file').toLowerCase();
            const masked = generateDocumentName(project?.req_id || project?.id, resolvedType, project?.title || project?.name);
            const patch = {
                docId: doc.id || null,
                doc_type: resolvedType,
                name: `${masked}.${ext}`,
                maskedName: `${masked}.${ext}`,
                url: doc.id ? `${import.meta.env.VITE_API_URL}/documents/${doc.id}/download` : target.url,
                isUploading: false,
            };
            setter(prev => ({
                ...prev,
                docs: (prev.docs || []).map((d, i) => (i === idx ? { ...d, ...patch } : d)),
            }));
            toast.success('Berkas diunggah ke server.');
            return { ...target, ...patch };
        } catch (err) {
            setter(prev => ({
                ...prev,
                docs: (prev.docs || []).map((d, i) => (i === idx ? { ...d, isUploading: false } : d)),
            }));
            toast.error(`Gagal mengunggah: ${err.message}`);
            return null;
        }
    };

    /**
     * Mengunggah semua draft yang belum punya `docId` (dipakai saat simpan step /
     * tombol selesai). Mengembalikan daftar dokumen terbaru; pemanggil harus memakai
     * hasil ini untuk `buildSitUatData` karena state React belum ter-update di closure
     * render yang sedang berjalan. Melempar error bila ada draft yang gagal diunggah
     * supaya langkah tidak dilaporkan sukses padahal berkasnya tidak tersimpan.
     */
    const uploadAllDrafts = async (setter, docs) => {
        const list = [...(docs || [])];
        let failed = 0;
        for (let idx = 0; idx < list.length; idx += 1) {
            const draft = list[idx];
            if (draft.docId || !draft.rawFile) continue;
            const uploaded = await uploadDocToServer(setter, list, idx, draft.doc_type);
            if (uploaded) list[idx] = uploaded;
            else failed += 1;
        }
        if (failed > 0) throw new Error(`${failed} berkas gagal diunggah. Periksa koneksi lalu coba lagi.`);
        return list;
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
            // Referensi di `sit_uat_data` dilepas lebih dulu supaya link approval eksternal
            // tidak pernah menunjuk dokumen yang sudah terhapus. Konsekuensinya, bila
            // penghapusan berkas gagal, yang tertinggal hanya berkas tanpa referensi.
            await projectService.update(project.id, {
                sitUatData: buildSitUatData({ uat3_docs: sanitizeDocs(nextDocs) }),
            });
            // State disamakan tepat setelah referensi terlepas, sebelum penghapusan berkas,
            // agar daftar tidak lagi menampilkan dokumen yang sudah tidak tercatat.
            setUat3(previous => ({ ...previous, docs: nextDocs }));

            if (target.docId) {
                try {
                    await documentService.delete(target.docId);
                } catch (error) {
                    toast.error(`Dokumen dilepas dari proyek, tetapi berkasnya gagal dihapus di server: ${error.message}`);
                    refreshProject?.();
                    return;
                }
            }
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

    /**
     * Menghapus satu berkas dari daftar wizard sekaligus dari server bila sudah
     * terunggah. `docs` dikirim eksplisit dengan alasan yang sama seperti
     * `changeDocType`: membaca state dari dalam updater tidak dijamin sinkron.
     */
    const onRemoveDoc = async (setter, docs, idx) => {
        const removed = (docs || [])[idx] || null;
        if (!removed) return;

        setter(prev => ({ ...prev, docs: (prev.docs || []).filter((_, i) => i !== idx) }));

        if (removed.docId) {
            try {
                await documentService.delete(removed.docId);
            } catch (error) {
                toast.error(`Berkas dihapus dari daftar, tetapi gagal dihapus di server: ${error.message}`);
                return;
            }
        }
        // Draft memegang object URL hasil `URL.createObjectURL`; lepaskan agar memori
        // blob tidak tertahan sampai tab ditutup.
        if (removed.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url);
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

    const viewDoc = async (doc) => {
        try {
            if (doc?.docId) {
                const loadingId = toast.loading('Membuka berkas...');
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                toast.dismiss(loadingId);
                // `ownsBlobUrl` menandai object URL yang dibuat khusus untuk pratinjau ini,
                // jadi aman di-revoke saat modal ditutup.
                setPreviewDoc({ ...doc, blobUrl: url, ownsBlobUrl: true });
            } else if (doc?.url?.startsWith('blob:')) {
                // Draft memakai object URL milik daftar dokumen. Jangan di-revoke saat modal
                // ditutup, karena berkasnya masih dipakai baris daftar dan pratinjau berikutnya.
                setPreviewDoc({ ...doc, blobUrl: doc.url, ownsBlobUrl: false });
            } else {
                toast('Berkas belum tersedia untuk dilihat.');
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
                toast('Berkas belum tersedia untuk diunduh.');
            }
        } catch (err) {
            toast.error(`Gagal mengunduh berkas: ${err.message}`);
        }
    };

    // ── Status helpers ─────────────────────────────────────────────────────
    const stUpper = String(status || '').toUpperCase();

    const isDev = ['IN_DEVELOPMENT', 'READY_FOR_DEVELOPMENT'].includes(stUpper) || UNLOCK_ALL_STAGES;
    const sitActive = isDev || SIT_ACTIVE_STATUSES.includes(stUpper) || UNLOCK_ALL_STAGES;
    const sitDone = SIT_COMPLETED_STATUSES.includes(stUpper) && !UNLOCK_ALL_STAGES;
    const uatUnlocked = UAT_UNLOCKED_STATUSES.includes(stUpper) || UNLOCK_ALL_STAGES;
    const uatActive = UAT_ACTIVE_STATUSES.includes(stUpper) || UNLOCK_ALL_STAGES;
    const uatDone = UAT_COMPLETED_STATUSES.includes(stUpper) && !UNLOCK_ALL_STAGES;
    const isComplete = stUpper === 'DEV_COMPLETED' && !UNLOCK_ALL_STAGES;

    // Tombol "Mulai Pengujian SIT" hanya boleh muncul pada status yang memang
    // mengizinkan transisi ke SIT_IN_PROGRESS. Di luar itu wizard tampil sebagai
    // panel informasi read-only agar pengguna tidak menekan tombol yang pasti
    // ditolak backend.
    const sitStartable = !sitDone && stUpper !== 'SIT_IN_PROGRESS'
        && SIT_STARTABLE_STATUSES.includes(stUpper) && !UNLOCK_ALL_STAGES;
    const sitUnavailable = !sitDone && stUpper !== 'SIT_IN_PROGRESS'
        && !SIT_STARTABLE_STATUSES.includes(stUpper) && !UNLOCK_ALL_STAGES;
    const sitUnavailableReason = stUpper === 'ON_HOLD'
        ? 'Proyek sedang ditahan sementara (ON_HOLD). Lanjutkan kembali ke tahap pengembangan sebelum menjalankan SIT.'
        : ['REJECTED', 'CANCELLED'].includes(stUpper)
            ? 'Proyek tidak dilanjutkan, sehingga pengujian SIT tidak tersedia.'
            : 'Pengujian SIT terbuka setelah proyek masuk tahap pengembangan (IN_DEVELOPMENT) dan seluruh task developer selesai.';

    // ── Gate helper: status task developer ────────────────────────────────
    // SIT pertama maupun SIT ulang siklus revisi mencakup seluruh task aktif. Scope yang
    // dipersempit ke sebagian task hanya tersisa pada data lama (`mode: 'targeted'`),
    // dan di sanalah assignee wajib ada karena task-nya berasal dari Change Request.
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

        // Setiap siklus revisi menuntut bukti pengujian baru, bukan warisan siklus lalu.
        // Karena scope SIT ulang kini mencakup seluruh task, syarat ini berlaku merata.
        if (isSitRevisionCycle) {
            const tasksWithoutEvidence = eligibleTaskIds.filter(id => {
                const approval = sit2Approvals?.[id];
                return !Array.isArray(approval?.attachments)
                    || !approval.attachments.some(attachment => Boolean(attachment?.docId));
            });
            if (tasksWithoutEvidence.length > 0) {
                return `${tasksWithoutEvidence.length} task pada SIT ulang belum memiliki lampiran bukti pengujian baru.`;
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
    }, [approvedTaskCount, eligibleTaskIds, isSitRevisionCycle, sit2Approvals, taskGate]);

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

    // Tahap 2 dikunci hanya oleh dua sebab yang benar-benar sah:
    // 1. snapshot hasil UAT sudah difinalkan (`uat2_summary.submittedAt`) — dikunci
    //    backend juga, jadi UI tidak boleh menawarkan pengeditan; dan
    // 2. eksekusi memang belum boleh berjalan karena proyek sedang berada di tangan
    //    developer atau menunggu SIT ulang.
    // Dulu penanda restart ikut mengunci selamanya karena hasil lama "dibekukan" untuk
    // verifikasi item Mayor. Sekarang restart berarti seluruh skenario dieksekusi ulang
    // dari nol, sehingga begitu proyek kembali UAT_IN_PROGRESS tanpa restart tertunda,
    // Tahap 2 harus bisa diisi seperti putaran pertama.
    //
    // Pengecualian sebab (1): putaran yang berkesimpulan revisi Minor masih menahan
    // persetujuan, dan unit peminta berhak mengajukan permintaan revisi berikutnya atas
    // proyek yang sama. Backend pun membuka kuncinya pada keadaan yang sama persis
    // (`UatExecutionService::submit()`), dan mengarsipkan putaran lama ke `uat_cycles`
    // lebih dulu sehingga snapshot auditnya tetap utuh.
    const uat2EditingLocked = uatDone
        || (uat2IsSubmitted && !isUatMinorRevisionPending)
        || status === 'UAT_REVISION_DEV'
        || isUatRestartPending;

    // ── Completion check per step ──────────────────────────────────────────
    // Memakai langkah tertinggi yang pernah dicapai, bukan tab yang sedang dibuka:
    // membuka kembali tab 1 tidak menghapus tanda selesai tab-tab sebelumnya.
    const sit1Done = sitDone || (status === 'SIT_IN_PROGRESS' && reachedSitStep > 1);
    const sit2Done = sitDone || (status === 'SIT_IN_PROGRESS' && reachedSitStep > 2);
    const sit3Done = sitDone;
    const uat1Done = uatDone || (status === 'UAT_IN_PROGRESS' && reachedUatStep > 1);
    const uat2Done = uatDone || (status === 'UAT_IN_PROGRESS' && reachedUatStep > 2);
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

    /**
     * Susun payload `sitUatData` dari seluruh state wizard.
     *
     * `options.allowStepRewind` hanya dipakai oleh transisi yang memang memulai ulang
     * sebuah fase (mulai SIT, mulai/ulang UAT). Di luar itu langkah wizard dijaga agar
     * tidak pernah turun: `activeSitStep`/`activeUatStep` mengikuti tab yang sedang
     * dibuka, jadi tanpa penjaga ini satu simpan otomatis saat pengguna menengok tab 1
     * akan menuliskan langkah 1 ke DB dan mengunci kembali tab-tab yang sudah selesai —
     * inilah penyebab alur UAT bisa berhenti di tengah persetujuan.
     */
    const buildSitUatData = (overrides = {}, options = {}) => {
        const { allowStepRewind = false } = options;
        const merged = {
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
        };

        if (!allowStepRewind) {
            merged.activeSitStep = Math.max(Number(merged.activeSitStep) || 1, storedActiveSitStep);
            merged.activeUatStep = Math.max(Number(merged.activeUatStep) || 1, storedActiveUatStep);
        }

        return merged;
    };

    // Simpan sitUatData ke backend secara SILENT (tanpa toast & tanpa reload).
    // Dipakai agar perubahan approval/lampiran/komentar langsung tersimpan ke DB
    // sehingga dokumentasi tetap ada saat pindah tab / refresh.
    // Mengembalikan `true` bila penyimpanan berhasil, agar penanda autosave hanya
    // diperbarui ketika datanya benar-benar sampai ke server.
    const persistQueueRef = useRef(Promise.resolve());
    const persistSitUatData = (overrides = {}) => {
        if (!project?.id) return Promise.resolve(false);
        // Serialisasi: jalankan berurutan agar tidak saling menimpa (race condition)
        const run = persistQueueRef.current.then(async () => {
            try {
                await projectService.update(project.id, {
                    sitUatData: buildSitUatData(overrides),
                });
                return true;
            } catch {
                // silent — jangan spam error di sini
                return false;
            }
        });
        persistQueueRef.current = run;
        return run;
    };

    // ── Autosave draft Persiapan Skenario UAT (tab 1) ──────────────────────
    // Isian tab 1 sebelumnya baru tersimpan saat tombol "Simpan & Lanjut" ditekan,
    // sehingga pengguna yang berpindah laman untuk mencari data pendukung (unit
    // peminta, jadwal, nama penyiap) kehilangan seluruh isian dan harus mengulang
    // dari awal. Peserta dan dokumen sudah punya jalur simpannya sendiri, jadi yang
    // diikuti di sini hanya field teks dan jadwal.
    const uat1AutosaveSnapshot = JSON.stringify({
        scenarioList: uat1.scenarioList,
        preparedBy: uat1.preparedBy,
        prepNotes: uat1.prepNotes,
        unit: uat1.unit,
        startDate: uat1.startDate,
        endDate: uat1.endDate,
    });
    const lastUat1AutosaveRef = useRef(uat1AutosaveSnapshot);
    const uat1AutosaveEnabled = activeUatStep === 1
        && !uatDone
        && Boolean(project?.id)
        && (status === 'UAT_IN_PROGRESS' || UNLOCK_ALL_STAGES);

    // `persistSitUatData` dibuat ulang setiap render, jadi versi terbarunya disimpan
    // pada ref: memasukkannya sebagai dependency effect di bawah akan menyetel ulang
    // penundaan autosave pada setiap render dan penyimpanan tidak pernah terjadi.
    const persistSitUatDataRef = useRef(persistSitUatData);
    useEffect(() => {
        persistSitUatDataRef.current = persistSitUatData;
    });

    useEffect(() => {
        if (!uat1AutosaveEnabled) return undefined;
        if (uat1AutosaveSnapshot === lastUat1AutosaveRef.current) return undefined;

        const timer = setTimeout(() => {
            const savedAt = new Date().toISOString();
            persistSitUatDataRef.current({ uat1_draft_saved_at: savedAt })
                .then(saved => {
                    if (!saved) return;
                    // Ditandai hanya bila datanya benar-benar sampai ke server, sehingga
                    // penyimpanan yang gagal masih terkirim ulang pada perubahan berikutnya.
                    lastUat1AutosaveRef.current = uat1AutosaveSnapshot;
                    setUat1DraftSavedAt(savedAt);
                });
        }, UAT1_AUTOSAVE_DELAY_MS);

        return () => clearTimeout(timer);
    }, [uat1AutosaveEnabled, uat1AutosaveSnapshot]);

    // Perubahan approval/komentar/lampiran task langsung disimpan ke backend
    // agar dokumentasi (bukti revisi, catatan, persetujuan) tetap ada di semua laman.
    const handleApprovalsChange = async (next) => {
        const normalized = normalizeApprovals(next);
        setSit2Approvals(normalized);
        await persistSitUatData({ sit2_task_approvals: normalized });
        // Refresh context agar badge status/bukti di Manajemen Task langsung sinkron
        refreshProject?.();
    };

    // Sinkronkan state yang berasal dari data tersimpan saat komponen dipakai untuk
    // proyek lain tanpa remount. Pola "sesuaikan state saat prop berubah" (bandingkan id
    // sebelumnya) dipakai agar penyesuaian terjadi pada render yang sama, bukan lewat
    // effect yang memicu render kedua setelah UI proyek baru sempat tampil dengan data
    // lama.
    //
    // `uat1` ikut disinkronkan karena `buildSitUatData` selalu menuliskan
    // `uat1_participants` dari state ini. Tanpa sinkronisasi, satu penyimpanan apa pun
    // setelah wizard berpindah proyek akan menimpa roster penanda tangan proyek baru
    // dengan roster proyek sebelumnya — kebocoran lintas proyek yang paling mahal karena
    // daftar penanda tangan UAT tidak boleh pernah hilang.
    const [syncedProjectId, setSyncedProjectId] = useState(project?.id);
    if (project?.id !== syncedProjectId) {
        setSyncedProjectId(project?.id);
        setSit2Approvals(normalizeApprovals(sitUatData.sit2_task_approvals));
        setUat1({
            scenarioList: sitUatData.uat1_scenarioList || '',
            preparedBy: sitUatData.uat1_preparedBy || '',
            prepNotes: sitUatData.uat1_prepNotes || '',
            participants: normalizeUatParticipants(sitUatData.uat1_participants),
            startDate: sitUatData.uat1_startDate || '',
            endDate: sitUatData.uat1_endDate || '',
            unit: sitUatData.uat1_unit || '',
            docs: sitUatData.uat1_docs || [],
        });
    }

    // ── Handler: START SIT (gatekeeper) ────────────────────────────────────
    const handleStartSIT = async () => {
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
        const startsMajorRevisionCycle = status === 'UAT_REVISION_DEV' || isUatRestartPending;
        setSubmitting(true);
        try {
            // Transisi status harus dipastikan diterima backend sebelum sukses dilaporkan;
            // tanpa await, penolakan otorisasi/workflow tetap tampil sebagai notifikasi sukses.
            await updateProject(project.id, {
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
                }, { allowStepRewind: true }),
            });
            toast.success(`Pengujian SIT dimulai untuk proyek "${project.name}".`);
        } catch (error) {
            toast.error(`SIT belum dapat dimulai: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
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
        // Upload draft dokumen yang belum di-upload. Hasilnya dipakai langsung sebagai
        // override karena state `sit3` di closure ini masih versi sebelum upload,
        // sehingga tanpa override `docId` tersimpan null di `sitUatData`.
        setSubmitting(true);
        try {
            const nextSit3Docs = await uploadAllDrafts(setSit3, sit3.docs);
            const nextStep = step + 1;
            await updateProject(project.id, {
                status: 'SIT_IN_PROGRESS',
                sitUatData: buildSitUatData({
                    activeSitStep: nextStep,
                    sit3_docs: sanitizeDocs(nextSit3Docs),
                    ...(step === 2 ? { sit2_submitted_at: new Date().toISOString() } : {}),
                }),
            });
            setActiveSitStep(nextStep);
            toast.success(`SIT Tahap ${step} tersimpan. Lanjut ke Tahap ${nextStep}.`);
        } catch (error) {
            toast.error(`SIT Tahap ${step} gagal disimpan: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSITPass = async () => {
        const restartsUatFromStart = isUatRestartPending;
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
                // Fase UAT selalu dibuka dari Tahap 1, termasuk pada restart akibat revisi
                // Mayor: seluruh skenario disiapkan dan dieksekusi ulang, bukan hanya item
                // Mayor-nya. Karena itu penurunan langkah di sini memang disengaja dan
                // `allowStepRewind` wajib menyertainya — tanpa itu penjaga di
                // `buildSitUatData` akan menaikkan kembali langkah ke nilai tersimpan (3)
                // dan UAT tampak sudah selesai.
                sitUatData: buildSitUatData(
                    { activeSitStep: 3, activeUatStep: 1 },
                    { allowStepRewind: true }
                ),
            });
            await projectService.updateStatus(project.id, 'SIT_PASSED', sit3.reviewNotes.trim());
            addNotification?.(
                'SIT Lulus!',
                restartsUatFromStart
                    ? `Proyek "${project.name}" lulus SIT ulang. UAT Internal dijalankan ulang dari Tahap 1 (persiapan skenario).`
                    : `Proyek "${project.name}" lulus SIT. UAT Internal dapat dimulai.`,
                'success',
                '/pm/workspace'
            );
            toast.success(restartsUatFromStart
                ? '🎉 SIT ulang lulus! UAT Internal dijalankan ulang dari Tahap 1 — seluruh skenario diuji kembali.'
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

        // Developer tidak menempati satu slot `approved` seperti PM dan Development
        // Lead: persetujuannya tercatat sebagai baris pada
        // `sit3_approvals.developer.developers[]`. Memeriksa `approved` di sana selalu
        // menghasilkan undefined, sehingga penjaga ini dulu tidak pernah menahan
        // pengiriman ganda milik developer.
        const alreadyApproved = currentRoleKey === 'developer'
            ? hasCurrentDeveloperApproved
            : sit3Approvals?.[currentRoleKey]?.approved === true;

        if (alreadyApproved) {
            toast('Anda sudah memberikan persetujuan SIT.');
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
    // Peserta otomatis tetap dapat diedit. Pimpinan pihak peminta memakai link pribadi,
    // sedangkan pemohon dan seluruh pihak IT harus ditautkan ke akun aplikasi.
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
            // Slot pemohon langsung ditautkan ke akun pengaju proyek: backend menuntut
            // `userId` slot ini sama dengan `created_by`, jadi menebaknya di sini lebih
            // baik daripada membiarkan PM memilih di antara seluruh akun business user.
            {
                isApprover: true,
                approvalRole: 'requester',
                approvalMode: uatRequiredApprovalMode('requester'),
                userId: Number(project?.creator?.id || project?.creator_id) || null,
            }
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

    // Prefill draf UAT langkah 1 (peserta, unit peminta, disiapkan oleh) selama isinya
    // masih kosong. Dijalankan saat langkah 1 dibuka atau proyeknya berganti, pada
    // render yang sama — dulu lewat effect, sehingga formulir sempat tampil kosong satu
    // render sebelum terisi. Nilai awal kunci sengaja null agar prefill juga berjalan
    // pada render pertama.
    const uat1PrefillKey = `${activeUatStep}:${project?.id ?? ''}`;
    const [syncedUat1PrefillKey, setSyncedUat1PrefillKey] = useState(null);
    if (uat1PrefillKey !== syncedUat1PrefillKey) {
        setSyncedUat1PrefillKey(uat1PrefillKey);
        if (activeUatStep === 1) {
            setUat1(prev => {
                const updates = {};
                // Roster penanda tangan UAT hanya boleh dibangkitkan sekali, yaitu ketika
                // proyek belum pernah menyimpannya. "Belum pernah diisi" dan "sengaja
                // dikosongkan PM" tidak bisa dibedakan dari state: `normalizeUatParticipants`
                // memetakan undefined maupun [] menjadi [] yang sama. Karena restart revisi
                // Mayor membawa alur ini kembali ke Tahap 1, menebak dari panjang array
                // berarti setiap restart menimpa roster kurasi PM dengan daftar bawaan —
                // padahal orang yang sama harus terbawa dan tidak boleh ditulis ulang.
                // Jadi sinyalnya diambil dari data mentah sebelum normalisasi: prefill hanya
                // jalan bila kuncinya benar-benar belum ada (atau bukan array).
                const storedParticipants = sitUatData.uat1_participants;
                if (!Array.isArray(storedParticipants) && (prev.participants || []).length === 0) {
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
        }
    }

    const handleStartUAT = async () => {
        const restartsUatFromStart = isUatRestartPending;
        // Roster penanda tangan tidak pernah dibangun ulang bila sudah ada isinya: pada
        // restart revisi Mayor orang yang sama harus terbawa, PM hanya boleh menambah.
        const participants = (uat1.participants || []).length > 0 ? uat1.participants : buildUatParticipants();
        // Restart maupun UAT pertama sama-sama dimulai dari Tahap 1 (persiapan skenario).
        const nextStep = 1;
        setSubmitting(true);
        try {
            await updateProject(project.id, {
                status: 'UAT_IN_PROGRESS',
                sitUatData: buildSitUatData({
                    activeUatStep: nextStep,
                    uat1_participants: participants,
                }, { allowStepRewind: true }),
            });
            setUat1(prev => ({ ...prev, participants }));
            setActiveUatStep(nextStep);
            toast.success(restartsUatFromStart
                ? `SIT ulang selesai. UAT Internal proyek "${project.name}" dijalankan ulang dari Tahap 1; daftar penanda tangan sebelumnya tetap terpakai.`
                : `Pengujian UAT Internal dimulai untuk proyek "${project.name}".`);
        } catch (error) {
            toast.error(`UAT Internal belum dapat dimulai: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Handler peserta UAT ──
    // Peserta dilacak dengan `id` stabil, bukan indeks: menghapus baris di atas baris
    // yang sedang diedit akan menggeser indeks sehingga form editor berpindah ke orang lain.
    const [editingUatId, setEditingUatId] = useState(null);
    const handleAddUatParticipant = () => {
        const newParticipant = {
            id: participantId(), name: '', role: '', unit: '', phone: '',
            isApprover: false, approvalRole: '', approvalMode: '', userId: null,
        };
        const participants = [...(uat1.participants || []), newParticipant];
        setUat1(prev => ({ ...prev, participants }));
        setEditingUatId(newParticipant.id);
        persistSitUatData({ uat1_participants: participants });
    };
    const handleRemoveUatParticipant = (idx) => {
        const removed = (uat1.participants || [])[idx];
        const participants = (uat1.participants || []).filter((_, i) => i !== idx);
        // Roster kosong yang tersimpan adalah kerusakan data, bukan sekadar tampilan:
        // daftar penanda tangan UAT harus terbawa antar siklus dan tidak boleh diketik
        // ulang. Karena itu backend menolak menyimpannya — `ProjectController` menahan
        // setiap kiriman yang mengosongkan `uat1_participants` dan mengembalikan nilai
        // tersimpan. Menghapus baris terakhir dari sini akan tampak berhasil di layar
        // lalu diam-diam dibatalkan saat halaman dimuat ulang, jadi peringatannya
        // disampaikan lebih dulu dan penghapusannya tidak dilanjutkan.
        if (participants.length === 0) {
            toast.error('Daftar penanda tangan UAT tidak boleh dikosongkan. Peserta ini terbawa ke setiap siklus revisi; ganti datanya bila salah, atau tambahkan penggantinya lebih dulu sebelum menghapus yang terakhir.');
            return;
        }
        setUat1(prev => ({ ...prev, participants }));
        persistSitUatData({ uat1_participants: participants });
        if (removed && editingUatId === removed.id) setEditingUatId(null);
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
                const approvalMode = uatRequiredApprovalMode(val);
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
                next.approvalMode = uatRequiredApprovalMode(val);
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
        if (editingUatId === null) return;
        persistSitUatData({ uat1_participants: uat1.participants });
        setEditingUatId(null);
    };

    const projectDeveloperUserIds = new Set(
        (project?.tasks || [])
            .map(task => Number(task.assignee_id || task.assignee?.id || task.assignee_detail?.id))
            .filter(Boolean)
    );
    // Akun pengaju proyek. `creator_id` selalu dikirim ProjectResource, sedangkan
    // `creator` hanya ada ketika relasinya dimuat, jadi keduanya dibaca berurutan.
    const projectCreatorUserId = Number(project?.creator?.id || project?.creator_id) || null;

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
        // Baris yang ditandai approver tetapi posisinya belum dipilih tidak dapat dinilai
        // lebih jauh — backend menolaknya dengan pesan yang sama.
        if (approvers.some(participant => !UAT_APPROVAL_ROLES.some(role => role.value === participant.approvalRole))) {
            return 'Jenis atau metode approval tidak valid.';
        }
        // Metode approval tiap posisi dipatok backend, sehingga baris yang modenya tidak
        // cocok pasti ditolak saat disimpan. Pesannya disamakan kata per kata dengan
        // `UatApprovalService::validateParticipants()` agar aturan yang sama tidak pernah
        // dibaca pengguna dalam dua rumusan yang berbeda.
        const mismatchedModeApprover = approvers.find(participant => (
            participant.approvalMode !== uatRequiredApprovalMode(participant.approvalRole)
        ));
        if (mismatchedModeApprover) {
            return uatRequiredApprovalMode(mismatchedModeApprover.approvalRole) === 'external_link'
                ? 'Pimpinan grup dan pimpinan divisi pemohon menggunakan link approval eksternal.'
                : 'Posisi ini wajib menggunakan akun internal aplikasi.';
        }
        if (approvers.some(participant => participant.approvalMode === 'external_link' && !participant.phone?.trim())) {
            return 'Nomor HP approver yang memakai link approval eksternal wajib diisi.';
        }
        const invalidExternalApprover = approvers.find(participant => (
            participant.approvalMode === 'external_link' && !normalizeIndonesianPhone(participant.phone)
        ));
        if (invalidExternalApprover) {
            return `Nomor HP ${invalidExternalApprover.name || 'approver pihak peminta'} tidak valid. Gunakan format 08... atau +62...`;
        }
        if (approvers.some(participant => participant.approvalMode === 'internal_account' && !participant.userId)) {
            return 'Approver internal wajib terhubung ke akun aktif.';
        }
        // Slot pemohon terikat ke akun yang benar-benar mengajukan proyek: gerbang baca
        // matriks memakai `created_by`, sementara gerbang keputusan in-app memakai
        // `user_id`, jadi dua akun berbeda membuat persetujuannya tidak pernah bisa dikirim.
        // Dilewati bila identitas pengaju tidak ikut terkirim, supaya wizard tidak memblokir
        // penyimpanan atas dasar data yang sekadar belum dimuat.
        const misassignedRequester = projectCreatorUserId !== null
            && approvers.some(participant => participant.approvalRole === 'requester'
                && Number(participant.userId) !== projectCreatorUserId);
        if (misassignedRequester) {
            return 'Approver pemohon harus akun yang mengajukan proyek ini.';
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
        if (!Array.isArray(projectTasks)) return [];
        const additionalRequestTaskIds = new Set(
            (uat2.additionalRequests || []).map(item => Number(item.taskId)).filter(Boolean)
        );
        return projectTasks.filter(task => String(task.status || '').toLowerCase() !== 'take_down'
            && !additionalRequestTaskIds.has(Number(task.id)));
    }, [projectTasks, uat2.additionalRequests]);

    /**
     * Simpan isian Persiapan Skenario UAT (tab 1) sebagai draft.
     *
     * Berbeda dari "Simpan & Lanjut": tidak ada validasi kelengkapan approver, tidak
     * ada perpindahan tahap, dan status proyek tidak disentuh. Dokumen undangan yang
     * masih berupa draft tetap diunggah lebih dulu supaya `docId`-nya ikut tersimpan —
     * tanpa itu lampiran akan hilang saat halaman dimuat ulang.
     */
    const handleSaveUAT1Draft = async () => {
        if (!project?.id) return;
        if (uploadingCategory === 'UAT_PREP') {
            toast.error('Tunggu hingga dokumen undangan selesai diunggah sebelum menyimpan draft.');
            return;
        }

        setSavingUat1Draft(true);
        try {
            const nextUat1Docs = await uploadAllDrafts(setUat1, uat1.docs);
            const savedAt = new Date().toISOString();
            await projectService.update(project.id, {
                sitUatData: buildSitUatData({
                    uat1_docs: sanitizeDocs(nextUat1Docs),
                    uat1_draft_saved_at: savedAt,
                }),
            });
            // Autosave tidak perlu mengulang perubahan yang sudah ikut tersimpan di sini.
            lastUat1AutosaveRef.current = uat1AutosaveSnapshot;
            setUat1DraftSavedAt(savedAt);
            toast.success('Draft Persiapan UAT berhasil disimpan. Isian dapat dilanjutkan kapan saja tanpa mengulang dari awal.');
            refreshProject?.();
        } catch (error) {
            toast.error(`Gagal menyimpan draft Persiapan UAT: ${error.message}`);
        } finally {
            setSavingUat1Draft(false);
        }
    };

    const handleSaveUATStep = async (step) => {
        // Kembali ke langkah yang tertinggi, bukan sekadar satu langkah maju: pengguna
        // yang menengok kembali ke tab 1 saat proses persetujuan berjalan harus kembali
        // ke tab tempat ia berhenti, tidak dipaksa melewati tab 2 yang sudah final.
        const nextStep = Math.max(step + 1, storedActiveUatStep);
        // Tahap 1 memerlukan minimal 1 dokumen undangan UAT
        if (step === 1 && (!uat1.docs || uat1.docs.length === 0)) {
            toast.error('Unggah minimal 1 dokumen undangan UAT sebelum lanjut ke Eksekusi.');
            return;
        }
        if (step === 1 && uatApproverValidation) {
            toast.error(uatApproverValidation);
            return;
        }
        setSubmitting(true);
        try {
            // Sama seperti SIT: hasil upload dipakai sebagai override supaya `docId`
            // dokumen undangan benar-benar tersimpan di `sitUatData`.
            const overrides = { activeUatStep: nextStep };
            if (step === 1) {
                const nextUat1Docs = await uploadAllDrafts(setUat1, uat1.docs);
                overrides.uat1_docs = sanitizeDocs(nextUat1Docs);
            }
            await updateProject(project.id, {
                status: 'UAT_IN_PROGRESS',
                sitUatData: buildSitUatData(overrides),
            });
            setActiveUatStep(nextStep);
            setUat1DraftSavedAt(new Date().toISOString());
            lastUat1AutosaveRef.current = uat1AutosaveSnapshot;
            toast.success(`UAT Tahap ${step} tersimpan. Lanjut ke Tahap ${nextStep}.`);
        } catch (error) {
            toast.error(`UAT Tahap ${step} gagal disimpan: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
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
                // Backend mengarsipkan hasil UAT putaran ini ke `uat_cycles` lalu
                // mengosongkan seluruh data eksekusi Tahap 2 dan approval SIT. State lokal
                // harus mengikuti: kunci-kunci ini tidak dilindungi
                // SERVER_MANAGED_SIT_UAT_KEYS, jadi wizard yang masih ter-mount akan
                // menuliskan kembali data basi itu pada penyimpanan berikutnya.
                setSit2Approvals({});
                setSit3({ reviewNotes: '', docs: [] });
                setActiveSitStep(1);
                // `uat2Summary` (executedCount/passedCount/findings) diturunkan dari kedua
                // koleksi ini, jadi mengosongkannya sekaligus menihilkan angka ringkasan.
                setUat2({
                    scenarios: [],
                    additionalRequests: [],
                    execNotes: '',
                });
                // Kembali ke Tahap 1: setelah SIT ulang lulus, seluruh skenario disiapkan
                // dan diuji ulang dari awal. `uat1.participants` sengaja tidak disentuh —
                // roster penanda tangan terbawa lintas siklus.
                setActiveUatStep(1);
                toast.error('Revisi mayor tercatat sebagai Change Request. Proyek dikembalikan ke developer, wajib SIT ulang menyeluruh, lalu UAT dijalankan ulang dari Tahap 1.');
                addNotification?.(
                    'Change Request Mayor UAT',
                    `Proyek "${project.name}" dikembalikan ke developer. Setelah perbaikan, SIT diulang untuk seluruh task dan UAT dijalankan ulang dari awal.`,
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

    const handleUATPass = async () => {
        setSubmitting(true);
        try {
            const nextUat3Docs = await uploadAllDrafts(setUat3, uat3.docs);
            await projectService.update(project.id, {
                status: 'DEV_COMPLETED',
                uatPassedAt: new Date().toISOString(),
                sitUatData: buildSitUatData({ activeUatStep: 3, uat3_docs: sanitizeDocs(nextUat3Docs) }),
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
    // Sisi pemohon hanya berwenang menyetujui — penolakan dan permintaan revisinya sudah
    // tercatat saat eksekusi UAT. Kewenangan dibaca dari `can_reject` milik matriks, bukan
    // dari daftar posisi di klien, supaya tombol yang tampil tidak pernah menyimpang dari
    // `UatApprovalRole::canReject()`. Nilai yang belum terisi diperlakukan sebagai boleh,
    // agar respons lama tidak kehilangan tombol yang sah.
    const canRejectUatAsCurrentUser = currentUserUatApprovals.some(
        approver => approver.status === 'pending' && approver.can_reject !== false
    );

    // Dipakai untuk refresh imperatif setelah keputusan approval dikirim.
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

    // Pemuatan awal saat UAT Tahap 3 dibuka. Sengaja tidak memanggil
    // `loadUatApprovalMatrix` agar effect tidak memanggil setState secara sinkron.
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
    // Permintaan yang masih menunggu tim pengembangan. Dipakai Tahap 3 untuk
    // menjelaskan mengapa persetujuan finalnya belum boleh ditutup.
    const openUatChangeRequests = uatChangeRequests
        .filter(request => CHANGE_REQUEST_OPEN_STATUSES.includes(request?.status));
    const openMinorChangeRequests = openUatChangeRequests
        .filter(request => request?.type !== 'mayor');
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
                    <h4 className="font-bold text-sm text-gray-800">Syarat Masuk SIT (Gate) — {isTargetedSitRetest ? 'Scope Revisi Mayor (Data Lama)' : 'Task Developer'}</h4>
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
                                        ? `Semua task ${isTargetedSitRetest ? 'dalam scope revisi ' : ''}telah selesai. SIT ${isSitRevisionCycle ? 'ulang ' : ''}siap dimulai.`
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
                        <p className="text-xs text-red-800 mt-0.5">Change Request mayor harus diselesaikan developer. Setelah perbaikan, SIT diulang untuk <strong>seluruh task</strong>; jika lulus, UAT dijalankan ulang dari Tahap 1 — seluruh skenario disiapkan dan diuji kembali sebelum Persetujuan Final. Daftar penanda tangan UAT tetap terpakai.</p>
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

                {/* SIT belum dimulai, tetapi status proyek mengizinkan SIT dimulai */}
                {sitStartable && (
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

                {/* SIT belum tersedia pada status proyek saat ini */}
                {sitUnavailable && (
                    <div className="p-6">
                        <div className="text-center py-4">
                            <Lock size={32} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-sm font-semibold text-gray-600 mb-1">Pengujian SIT belum tersedia</p>
                            <p className="text-xs text-gray-500 max-w-md mx-auto">{sitUnavailableReason}</p>
                            <p className="text-[11px] text-gray-400 mt-3">
                                Status proyek saat ini: <span className="font-bold text-gray-600">{stUpper || '-'}</span>
                            </p>
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
                                    onClick={() => (sitDone || UNLOCK_ALL_STAGES || step.id <= reachedSitStep) && setActiveSitStep(step.id)}
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
                                        ? 'SIT ulang ini memakai scope lama yang terarah. Environment tetap disiapkan, tetapi skenario hanya mencakup task yang terkena Change Request Mayor pada siklus aktif.'
                                        : isSitRevisionCycle
                                            ? 'SIT dijalankan ulang setelah revisi Mayor. Seluruh task diuji ulang dari awal, bukan hanya yang terdampak, dan setiap task perlu lampiran bukti pengujian baru.'
                                            : 'Lengkapi environment yang akan diuji. Jumlah skenario otomatis mengikuti task yang sudah Selesai.'}
                                </p>

                                {isSitRevisionCycle && (
                                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex items-start gap-3 text-violet-800">
                                        <RotateCcw size={16} className="shrink-0 mt-0.5" />
                                        <div>
                                            {isTargetedSitRetest ? (
                                                <>
                                                    <p className="text-xs font-bold">SIT Ulang Terarah (Scope Lama) — Siklus #{sitRetestCycle}</p>
                                                    <p className="text-[11px] mt-1 leading-relaxed">
                                                        Hanya {sitRetestTaskIds.length} task yang terdampak revisi/request Mayor yang diuji ulang. Task lain mempertahankan hasil SIT sebelumnya dan tidak masuk ke tabel eksekusi siklus ini.
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-xs font-bold">SIT ulang siklus #{sitRetestCycle} — seluruh task diuji ulang</p>
                                                    <p className="text-[11px] mt-1 leading-relaxed">
                                                        Revisi Mayor memulai ulang kedua siklus: {taskGate().total} task diuji ulang menyeluruh, lalu UAT dijalankan lagi dari Tahap 1 (persiapan skenario). Daftar penanda tangan UAT tetap terpakai dan tidak perlu diisi ulang.
                                                    </p>
                                                </>
                                            )}
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
                                            ? `Semua task ${isTargetedSitRetest ? 'dalam scope revisi ' : ''}sudah Selesai — SIT ${isSitRevisionCycle ? 'ulang ' : ''}siap dilaksanakan.`
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
                                    {/* `isTargetedRetest` di komponen ini hanya memilih pesan "scope SIT ulang"
                                        ketika daftar task kosong, jadi yang relevan adalah scope yang benar-benar
                                        dipersempit (data lama) — bukan siklus revisinya. */}
                                    <SITTaskExecution
                                        project={project}
                                        approvals={sit2Approvals}
                                        onApprovalsChange={handleApprovalsChange}
                                        onRequestRevision={setShowTaskRevisionModal}
                                        taskIds={eligibleTaskIds}
                                        isTargetedRetest={isTargetedSitRetest}
                                        // Persetujuan dan bukti task SIT hanya boleh disunting selama
                                        // SIT masih berjalan. `sitDone` sudah bernilai true begitu proyek
                                        // melewati SIT (SIT_PASSED sampai produksi), dan sesuai komentar
                                        // SIT_COMPLETED_STATUSES tab ini memang tampil read-only pada saat
                                        // itu — tabnya tetap bisa dibuka untuk dibaca sebagai berita acara,
                                        // tetapi seluruh aksi (OK, revisi, lampiran) dibekukan. Peninjau
                                        // juga tidak pernah boleh menyunting. Server menegakkan hal yang
                                        // sama lewat SIT_FROZEN_STATUSES di ProjectController::update().
                                        readOnly={isViewer || sitDone}
                                    />
                                </div>

                                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-indigo-800">
                                    {isTargetedSitRetest
                                        ? <>Simpan sebagai <strong>draft</strong> jika pengujian belum selesai. Finalisasi hanya dapat dilakukan setelah seluruh task dalam scope selesai, disetujui, dan memiliki lampiran bukti baru untuk siklus ini.</>
                                        : isSitRevisionCycle
                                            ? <>Simpan sebagai <strong>draft</strong> jika pengujian ulang belum selesai. Finalisasi hanya dapat dilakukan setelah <strong>seluruh task</strong> diuji ulang, disetujui, dan memiliki lampiran bukti pengujian baru untuk siklus ini.</>
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
                                            { key: 'developer', label: 'Developer', desc: requiredDeveloperCount > 0 ? `Semua ${requiredDeveloperCount} developer tim proyek harus menyetujui` : 'Developer pada tim proyek', color: 'blue', icon: <UserCheck size={16} className="text-blue-500" /> },
                                            { key: 'pm', label: 'PM / Analyst Pengembangan', desc: 'Project Manager proyek', color: 'amber', icon: <Users size={16} className="text-amber-500" /> },
                                            { key: 'development_lead', label: 'Development Lead', desc: 'Pimpinan pengembangan', color: 'emerald', icon: <ShieldCheck size={16} className="text-emerald-500" /> },
                                        ].map(r => {
                                            const isDev = r.key === 'developer';
                                            const ap = sit3Approvals?.[r.key];
                                            let approved;
                                            let detail;
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
                                            // Kelas Tailwind ditulis utuh, tidak diinterpolasi: Tailwind 4
                                            // memindai teks sumber apa adanya sehingga `bg-${x}-100`
                                            // tidak pernah menghasilkan kelas dari baris ini.
                                            const iconBgClass = SIT3_ROLE_ICON_BG[r.color] || 'bg-gray-100';
                                            return (
                                                <div key={r.key} className={`rounded-xl border p-3 transition-all ${approved ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${approved ? 'bg-emerald-100' : iconBgClass}`}>
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
                                    {/*
                                      * Developer yang membuka proyek ini tanpa berada pada timnya tidak
                                      * punya slot persetujuan. Tanpa keterangan ini, layarnya hanya
                                      * memperlihatkan kartu status tanpa penjelasan mengapa formulir
                                      * persetujuan tidak muncul.
                                      */}
                                    {currentRoleKey === 'developer' && !isCurrentUserRequiredDeveloper && !sitDone && (
                                        <p className="text-[10px] text-gray-500 mt-2 flex items-start gap-1">
                                            <Info size={11} className="shrink-0 mt-0.5" /> Persetujuan SIT hanya diberikan developer yang tercatat pada tim proyek ini.
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
                                                <><CheckCircle2 size={14} /> {isUatRestartPending ? 'SIT Ulang Lulus — Jalankan Ulang UAT dari Tahap 1' : 'SIT Lulus — Lanjut ke UAT Internal'}</>
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
                            {isUatRestartPending ? 'SIT ulang telah lulus! UAT dijalankan ulang dari awal.' : 'SIT telah lulus! Siap memulai UAT Internal.'}
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                            {isUatRestartPending ? 'Seluruh skenario disiapkan dan diuji ulang mulai Tahap 1. Daftar penanda tangan UAT sebelumnya tetap terpakai — PM hanya perlu menambah bila ada peserta baru.' : 'Pastikan PM dan perwakilan Divisi Peminta sudah siap untuk pengujian fungsional bisnis.'}
                        </p>
                        <button
                            onClick={handleStartUAT}
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 mx-auto"
                        >
                            <ArrowRight size={16} /> {isUatRestartPending ? 'Jalankan Ulang UAT Internal' : 'Mulai UAT Internal'}
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
                                    onClick={() => (uatDone || UNLOCK_ALL_STAGES || step.id <= reachedUatStep) && setActiveUatStep(step.id)}
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
                                    {(uat1.participants || []).length === 0 ? (
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
                                                    {(uat1.participants || []).map((p, idx) => {
                                                        const isEditing = editingUatId !== null && editingUatId === p.id;
                                                        const editable = !uatDone && !isViewer && canManageUatApprovals;
                                                        const approvalRole = UAT_APPROVAL_ROLES.find(role => role.value === p.approvalRole);
                                                        const hasInvalidPhone = p.approvalMode === 'external_link'
                                                            && Boolean(p.phone?.trim())
                                                            && !normalizeIndonesianPhone(p.phone);
                                                        const eligibleInternalAccounts = uatInternalUsers.filter(account => (
                                                            (UAT_INTERNAL_ACCOUNT_ROLES[p.approvalRole] || []).includes(account.role)
                                                            && (p.approvalRole !== 'developer' || projectDeveloperUserIds.has(Number(account.id)))
                                                            // Posisi pemohon hanya boleh diisi akun pengaju proyek. Tanpa penyaring
                                                            // ini seluruh akun business user ikut terdaftar, padahal semua pilihan
                                                            // selain pengaju pasti ditolak backend saat disimpan.
                                                            && (p.approvalRole !== 'requester' || Number(account.id) === projectCreatorUserId)
                                                        ));
                                                        return (
                                                            <tr key={p.id || `uat_participant_${idx}`} className={`hover:bg-amber-50/40 transition-colors ${isEditing ? 'bg-amber-50/60' : ''}`}>
                                                                {/* Nama */}
                                                                <td className="py-2.5 px-4 text-gray-800 font-medium">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={p.name}
                                                                            onChange={e => handleUatParticipantChange(idx, 'name', e.target.value)}
                                                                            placeholder={p.approvalMode === 'internal_account' ? 'Terisi dari akun yang dipilih' : 'Nama peserta'}
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
                                                                                <optgroup label="Pihak Pemohon — pemohon lewat akun, pimpinan lewat link pribadi">
                                                                                    {UAT_APPROVAL_ROLES.filter(role => role.side === 'requester').map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                                                                                </optgroup>
                                                                                <optgroup label="Pihak IT — menggunakan akun aplikasi">
                                                                                    {UAT_APPROVAL_ROLES.filter(role => role.side === 'it').map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                                                                                </optgroup>
                                                                            </select>
                                                                            {p.approvalMode === 'internal_account' && (
                                                                                <>
                                                                                    <label className="block text-[9px] font-bold uppercase tracking-wide text-gray-500">Akun aplikasi</label>
                                                                                    <select value={p.userId || ''}
                                                                                        onChange={e => handleUatParticipantChange(idx, 'userId', e.target.value)}
                                                                                        className="w-full px-2.5 py-2 border border-blue-300 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500">
                                                                                        <option value="">Pilih akun sesuai kedudukan</option>
                                                                                        {eligibleInternalAccounts.map(account => <option key={account.id} value={account.id}>{account.name} — {account.role_detail?.display_name || account.role}</option>)}
                                                                                    </select>
                                                                                    {eligibleInternalAccounts.length > 0 ? (
                                                                                        <p className="text-[9px] text-blue-600">{p.approvalRole === 'developer' ? 'Hanya developer yang mengerjakan task proyek ini yang ditampilkan. ' : ''}{p.approvalRole === 'requester' ? 'Hanya akun yang mengajukan proyek ini yang ditampilkan. ' : ''}Nama, divisi, dan kedudukan akan terisi otomatis dari akun yang dipilih. Nomor HP tidak diperlukan karena approval dilakukan melalui akun.</p>
                                                                                    ) : (
                                                                                        <p className="text-[9px] font-semibold text-red-600">{p.approvalRole === 'requester' ? 'Akun pengaju proyek ini tidak ditemukan. Pastikan akun pemohon masih aktif melalui pengelolaan pengguna.' : 'Belum ada akun dengan role yang sesuai. Tambahkan atau perbaiki role akun melalui pengelolaan pengguna.'}</p>
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
                                                                                    onClick={() => setEditingUatId(p.id || null)}
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
                                    <DocList docs={uat1.docs} onRemove={i => onRemoveDoc(setUat1, uat1.docs, i)} onView={viewDoc} onDownload={downloadDoc} onTypeChange={(i, t) => changeDocType(setUat1, uat1.docs, i, t)} docTypeOptions={docTypeOptions('UAT_PREP')} readOnly={uatDone} />
                                </div>

                                {!uatDone && (status === 'UAT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeUatStep === 1 && (
                                    <div className="space-y-2 pt-2">
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                                            Isian pada tahap ini <strong>tersimpan otomatis</strong> beberapa saat setelah Anda berhenti mengetik, sehingga data tidak hilang saat Anda berpindah laman untuk mencari data pendukung. Gunakan <strong>Simpan sebagai Draft</strong> bila ingin menyimpan sekaligus mengunggah dokumen undangan tanpa memajukan tahap.
                                        </div>
                                        <div className="w-full flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-2">
                                            {uat1DraftSavedAt && (
                                                <span className="sm:mr-auto text-[10px] text-gray-500 flex items-center gap-1">
                                                    <Check size={11} className="text-emerald-500" /> Draft tersimpan {draftSavedLabel(uat1DraftSavedAt)}
                                                </span>
                                            )}
                                            <button
                                                onClick={handleSaveUAT1Draft}
                                                disabled={savingUat1Draft || submitting || uploadingCategory === 'UAT_PREP'}
                                                className="px-5 py-2.5 bg-white hover:bg-amber-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-amber-700 border border-amber-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                {savingUat1Draft ? <Clock size={14} /> : <Save size={14} />}
                                                {savingUat1Draft ? 'Menyimpan Draft...' : 'Simpan sebagai Draft'}
                                            </button>
                                            <button
                                                onClick={() => handleSaveUATStep(1)}
                                                disabled={!uat1.unit || !uat1.startDate || !uat1.preparedBy || savingUat1Draft || submitting}
                                                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                {storedActiveUatStep > 1
                                                    ? `Simpan & Kembali ke Tahap ${storedActiveUatStep}`
                                                    : 'Simpan & Lanjut Eksekusi UAT'} <ArrowRight size={14} />
                                            </button>
                                        </div>
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

                                {(status === 'UAT_REVISION_DEV' || isUatRestartPending) && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800">
                                        <Lock size={16} className="shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold">UAT di-hold — akan dijalankan ulang dari Tahap 1</p>
                                            <p className="text-[11px] mt-1 leading-relaxed">Hasil UAT putaran ini sudah diarsipkan sebagai jejak audit dan tidak dilanjutkan. Developer menyelesaikan item Mayor, seluruh task menjalani SIT ulang, lalu UAT dimulai lagi dari persiapan skenario — setiap skenario dieksekusi ulang, diikuti putaran persetujuan baru. Daftar penanda tangan tetap terpakai.</p>
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
                                                ? 'UAT belum dapat disetujui. Saat disimpan, hasil putaran ini diarsipkan dan proyek kembali ke developer; setelah perbaikan seluruh task wajib SIT ulang, lalu UAT dijalankan kembali dari Tahap 1.'
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

                                {uat2IsSubmitted && !isUatMinorRevisionPending && (
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
                                        <Lock size={13} className="shrink-0 mt-0.5" />
                                        <span>Snapshot hasil UAT telah disimpan dan dikunci untuk menjaga jejak audit. Lampiran tetap dapat dilihat dan diunduh.</span>
                                    </div>
                                )}

                                {/*
                                  * Hold revisi Minor: satu-satunya keadaan yang membuka kembali Tahap 2
                                  * setelah hasilnya final. Unit peminta berhak meminta perbaikan lanjutan
                                  * atas versi yang sedang dikerjakan, dan putaran lama diarsipkan backend
                                  * sebelum ditimpa sehingga jejak auditnya tidak hilang.
                                  */}
                                {uat2IsSubmitted && isUatMinorRevisionPending && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                                        <RotateCcw size={13} className="shrink-0 mt-0.5" />
                                        <span>
                                            Revisi <strong>Minor</strong> sedang dikerjakan tim pengembangan, sehingga hasil UAT masih dapat diperbarui bila ada permintaan perbaikan lanjutan. Menyimpan hasil final lagi akan mengarsipkan putaran sebelumnya beserta persetujuannya, lalu menerbitkan Change Request baru.
                                        </span>
                                    </div>
                                )}

                                {(!uat2IsSubmitted || isUatMinorRevisionPending) && status !== 'UAT_REVISION_DEV' && !isUatRestartPending && (
                                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-[11px] text-orange-800 leading-relaxed">
                                        Gunakan <strong>Simpan sebagai Draft</strong> selama hasil pengujian, permintaan perubahan, atau lampiran bukti masih dilengkapi. Draft tidak mengunci data dan tidak menjalankan alur revisi Mayor/Minor. Alur tersebut baru diproses saat hasil UAT disimpan final.
                                    </div>
                                )}

                                {!uatDone && (!uat2IsSubmitted || isUatMinorRevisionPending) && (status === 'UAT_IN_PROGRESS' || UNLOCK_ALL_STAGES) && activeUatStep === 2 && (
                                    <div className="flex flex-col items-end gap-1.5 pt-2">
                                        <div className="w-full flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                            <button
                                                onClick={handleSaveUATDraft}
                                                disabled={savingUatDraft || submitting || uploadingUatScenarioId || (uat2.scenarios || []).length === 0 || status === 'UAT_REVISION_DEV' || isUatRestartPending}
                                                className="px-5 py-2.5 bg-white hover:bg-orange-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-orange-700 border border-orange-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                {savingUatDraft ? <Clock size={14} /> : <Save size={14} />}
                                                {savingUatDraft ? 'Menyimpan Draft...' : 'Simpan sebagai Draft'}
                                            </button>
                                            <button
                                                onClick={handleSubmitUatExecution}
                                                disabled={Boolean(uat2Validation) || submitting || savingUatDraft || status === 'UAT_REVISION_DEV' || isUatRestartPending}
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

                                {/*
                                  * Hasil UAT sudah final dan tahap berikutnya pernah dibuka: satu-satunya
                                  * tindakan yang tersisa di tab ini adalah kembali ke tahap tersebut.
                                  * Tanpa tombol ini pengguna yang menengok tab 2 hanya melihat dua tombol
                                  * mati dan harus mengulang submit hasil UAT — yang justru membuat
                                  * Change Request baru dan menghentikan alur proyeknya.
                                  */}
                                {!uatDone && uat2IsSubmitted && activeUatStep === 2 && reachedUatStep > 2 && (
                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={() => setActiveUatStep(reachedUatStep)}
                                            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                        >
                                            Lanjut ke Tahap {reachedUatStep}: Persetujuan Final <ArrowRight size={14} />
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
                                            { label: 'Dieksekusi', val: uat2Summary.executedCount || '-' },
                                            { label: 'Diterima', val: uat2Summary.acceptedCount || '-' },
                                            // Jumlah permintaan revisi ikut ditampilkan supaya Tahap 3
                                            // tidak hanya bercerita soal skenario yang lulus. Tanpa
                                            // angka ini, revisi Minor tidak terlihat sama sekali pada
                                            // ringkasan dan mudah terlupakan.
                                            { label: 'Minta Revisi', val: uat2Summary.revisionCount || '-' },
                                            { label: 'Revisi Minor', val: uat2Summary.minorCount || '-' },
                                            { label: 'Revisi Mayor', val: uat2Summary.majorCount || '-' },
                                            { label: 'Revisi Belum Selesai', val: openUatChangeRequests.length || '-' },
                                        ].map(s => (
                                            <div key={s.label} className="bg-white rounded-lg p-2.5 border border-slate-200">
                                                <p className="text-slate-500 text-[9px] font-bold uppercase">{s.label}</p>
                                                <p className="font-bold text-slate-800 text-xs mt-0.5">{s.val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <RevisionBanner revisions={revisions} type="UAT_CHANGE_MINOR" />

                                {/*
                                  * Hold revisi Minor. Tahap 3 tetap terbuka beserta roster
                                  * penandatangannya — yang ditahan hanya keputusannya, karena berita
                                  * acara UAT menjadi dasar rilis dan tidak boleh menyatakan lulus atas
                                  * versi yang perbaikannya belum dikerjakan. Gerbang yang sama
                                  * ditegakkan backend di `UatApprovalService::assertActiveApprover()`
                                  * dan `ProjectWorkflowService`, jadi banner ini menjelaskan
                                  * penolakan yang akan terjadi, bukan menggantikannya.
                                  */}
                                {isUatMinorRevisionPending && !uatDone && (
                                    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                                        <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
                                            <RotateCcw size={16} /> Revisi Minor Sedang Dikerjakan Tim Pengembangan
                                        </p>
                                        <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                                            Persetujuan final dan penetapan DEV_COMPLETED ditahan sampai seluruh Change Request Minor selesai. Siklus UAT tidak diulang dan SIT tidak dijalankan lagi — daftar penanda tangan pada putaran ini tetap berlaku. Penahanannya lepas otomatis begitu developer menyelesaikan task revisinya di Manajemen Task.
                                        </p>
                                        {openMinorChangeRequests.length > 0 && (
                                            <ul className="mt-2 space-y-1">
                                                {openMinorChangeRequests.map(request => (
                                                    <li key={request.id} className="flex items-start gap-1.5 text-[11px] text-amber-900">
                                                        <Clock size={12} className="mt-0.5 shrink-0" />
                                                        <span>
                                                            <span className="font-semibold">{request.title}</span>
                                                            {' — '}
                                                            {getChangeRequestStatusLabel(request.status).label}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                {/*
                                  * Kartu keputusan disembunyikan selama hold revisi Minor: backend
                                  * menolak keputusannya (`UatApprovalService::assertActiveApprover()`),
                                  * jadi menampilkan tombolnya hanya menjanjikan aksi yang pasti gagal.
                                  * Alasannya sudah dijelaskan banner hold di atas.
                                  */}
                                {currentUserUatApprovals.some(item => item.status === 'pending') && !uatDone && !isUatMinorRevisionPending ? (
                                    <div id="my-uat-approval" className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 shadow-sm">
                                        <p className="flex items-center gap-1.5 text-sm font-bold text-blue-900"><UserCheck size={16} /> Keputusan UAT Menunggu Anda</p>
                                        <p className="mt-1 text-[10px] leading-relaxed text-blue-700">Tinjau ringkasan hasil, matrix persetujuan, dan dokumen Persetujuan Final pada halaman ini sebelum mengirim keputusan.</p>
                                        <button type="button" onClick={() => document.getElementById('uat-final-documents')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100">
                                            <FileText size={12} /> Periksa Dokumen Final
                                        </button>
                                        <textarea rows={2} value={uatApprovalNote} onChange={e => setUatApprovalNote(e.target.value)}
                                            placeholder={canRejectUatAsCurrentUser ? 'Catatan keputusan (wajib jika menolak / meminta revisi)...' : 'Catatan persetujuan (opsional)...'}
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
                                                    {approver.can_reject !== false ? (
                                                        <button onClick={() => handleSubmitUatApproval(approver.id, 'rejected')} disabled={uatApprovalSubmitting}
                                                            className="rounded-lg bg-red-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-red-700 disabled:bg-gray-300"><X size={13} className="mr-1 inline" />Tolak / Minta Revisi</button>
                                                    ) : (
                                                        <p className="basis-full text-[9px] leading-relaxed text-blue-600">Posisi ini hanya memberi persetujuan. Penolakan dan permintaan revisi disampaikan pada saat eksekusi UAT.</p>
                                                    )}
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
                                        {openUatChangeRequests.length > 0 && (
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                                                {openUatChangeRequests.length} belum selesai
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 mb-2">
                                        Permintaan perubahan dicatat pada Tahap 2. Revisi <strong>Minor</strong> tidak memundurkan alur dan tidak mengulang SIT, tetapi tetap menjadi Change Request serta task revisi di Manajemen Task, dan persetujuan final ditahan sampai selesai. Revisi <strong>Mayor</strong> mengembalikan proyek ke developer dan mewajibkan SIT ulang sebelum UAT dijalankan lagi dari Tahap 1.
                                    </p>
                                    {uatChangeRequests.length === 0 ? (
                                        <p className="text-[11px] text-gray-400 italic">Belum ada change request diajukan.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {uatChangeRequests.map(cr => {
                                                // Status diambil dari siklus revisi yang sebenarnya
                                                // (`open` … `superseded`), bukan dari kosakata
                                                // approve/reject pengajuan manual yang sudah pensiun.
                                                // Dulu pemetaannya hanya mengenal approved/rejected,
                                                // sehingga setiap permintaan — termasuk yang sudah
                                                // dikerjakan developer — selalu tampil "Menunggu".
                                                const crStatus = getChangeRequestStatusLabel(cr.status);
                                                const isOpenRequest = CHANGE_REQUEST_OPEN_STATUSES.includes(cr.status);
                                                const linkedTask = (project?.tasks || []).find(task => Number(task.id) === Number(cr.taskId));
                                                return (
                                                    <div key={cr.id} className={`p-3 rounded-xl border ${crStatus.cardCls}`}>
                                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${cr.type === 'mayor' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                                    {cr.type === 'mayor' ? 'Mayor' : 'Minor'}
                                                                </span>
                                                                <span className="font-bold text-gray-800 text-xs">{cr.title}</span>
                                                                {cr.cycle ? <span className="text-[9px] font-bold text-gray-400">Siklus {cr.cycle}</span> : null}
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${crStatus.pillCls}`}>{crStatus.label}</span>
                                                        </div>
                                                        <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">{cr.detail}</p>
                                                        {/*
                                                          * Task revisinya ditunjuk langsung agar pemantau Tahap 3
                                                          * tahu pekerjaan ini sudah ada pemiliknya di Manajemen Task
                                                          * — atau justru belum ditugaskan sama sekali.
                                                          */}
                                                        {cr.taskId ? (
                                                            <p className="text-[10px] text-gray-500 mt-1">
                                                                Task revisi: <span className="font-semibold">{linkedTask?.title || `#${cr.taskId}`}</span>
                                                                {isOpenRequest && linkedTask && !linkedTask.assignee ? ' • belum ditugaskan ke developer' : ''}
                                                            </p>
                                                        ) : null}
                                                        <p className="text-[10px] text-gray-400 mt-1">
                                                            Diajukan oleh: {cr.submittedBy} • {fmtDate(cr.at)}
                                                            {cr.resolvedAt ? ` • Selesai: ${fmtDate(cr.resolvedAt)}` : ''}
                                                            {cr.supersededReason ? ` • ${cr.supersededReason}` : ''}
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
                                            disabled={submitting || !allUatApproved || isUatRestartPending || isUatMinorRevisionPending}
                                            title={isUatMinorRevisionPending
                                                ? 'Selesaikan seluruh Change Request Minor terlebih dahulu'
                                                : allUatApproved ? '' : 'Seluruh persetujuan wajib dari pihak peminta dan pihak IT harus lengkap terlebih dahulu'}
                                            className={`w-full px-6 py-3 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${allUatApproved && !isUatMinorRevisionPending ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'}`}
                                        >
                                            <Send size={16} /> UAT Lulus — Tetapkan DEV_COMPLETED &amp; Lanjut ke QA / Siber
                                        </button>
                                        {isUatMinorRevisionPending ? (
                                            <p className="text-[10px] text-amber-700 text-center">
                                                Revisi Minor belum selesai. Tombol "UAT Lulus" aktif setelah seluruh Change Request Minor diselesaikan tim pengembangan.
                                            </p>
                                        ) : !allUatApproved && (
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
                        // Pengunggah diambil dari data dokumen; modal sudah menampilkan '-'
                        // bila tidak tercatat, jadi tidak perlu diisi nama tim yang dikarang.
                        uploadedBy: previewDoc.uploadedBy || previewDoc.uploaded_by_name,
                    }}
                    project={project}
                    onClose={() => {
                        if (previewDoc.ownsBlobUrl && previewDoc.blobUrl?.startsWith('blob:')) {
                            URL.revokeObjectURL(previewDoc.blobUrl);
                        }
                        setPreviewDoc(null);
                    }}
                />
            )}

        </div>
    );
}
