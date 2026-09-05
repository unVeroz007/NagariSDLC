import { getParallelTestingBadge, PROJECT_STATUS_LABEL } from '../../constants/projectStatus';
import { getProjectPriorityClass, getProjectPriorityLabel } from '../../constants/projectPriority';
import { POLLING_INTERVAL_MS } from '../../constants/polling';
import { getChangeRequestStatusLabel } from '../../constants/uatChangeRequest';
import { getTaskReturnRoundTag, isFixTask } from '../../constants/returnRound';
import { useVisibilityPolling } from '../../hooks/usePolling';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import {
    generateDocumentName,
    formatFileSize,
    formatDocSizeLabel,
} from '../../utils/documentNaming';
import { documentService, taskService, activityLogService, projectService, userService } from '../../services/api';
import ChatBox from '../../components/ChatBox';
import SITUATWizard from '../../components/SITUATWizard';
import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Filter,
    Plus,
    User,
    Calendar,
    Clock,
    CheckCircle,
    AlertCircle,
    Info,
    Edit,
    FileText,
    FolderOpen,
    Activity,
    Eye,
    Briefcase,
    MessageSquare,
    Paperclip,
    Trash2,
    X,
    ShieldCheck,
    Download,
    Upload,
    RotateCcw,
    Undo2,
} from 'lucide-react';

// Pemetaan status task antara enum backend dan label UI. Keduanya murni — tidak
// menyentuh state komponen — sehingga diletakkan di lingkup modul: selain hemat
// alokasi per render, penempatannya di atas komponen memastikan `normalizeTask`
// tidak lagi memanggilnya sebelum deklarasi (temporal dead zone).
const mapTaskStatusToEnum = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'selesai' || s === 'done') return 'done';
    if (s === 'sedang dikerjakan' || s === 'in progress' || s === 'in_progress' || s === 'review' || s === 'code review') return 'in_progress';
    if (s === 'hold') return 'hold';
    if (s === 'take down' || s === 'take_down') return 'take_down';
    return 'todo';
};

const mapTaskStatusToLabel = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'done' || s === 'selesai') return 'Selesai';
    if (s === 'in_progress' || s === 'sedang dikerjakan' || s === 'review' || s === 'code review') return 'Sedang Dikerjakan';
    if (s === 'hold') return 'Hold';
    if (s === 'take_down' || s === 'take down') return 'Take Down';
    return 'Belum Mulai';
};

// Batasan unggahan pada tab Dokumen.
const ALLOWED_DOC_EXTS = ['.pdf', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.zip'];
const MAX_DOC_SIZE_MB = 5;

// Pilihan filter status pada toolbar tabel task. Nilainya adalah label UI, sama
// seperti yang disimpan `normalizeTask`, sehingga perbandingannya langsung.
//
// `REVISION_STATUS_FILTER` bukan status di basis data: `TaskStatus` tidak memiliki
// nilai revisi, dan task yang direvisi tetap berstatus `in_progress`. Revisi ditandai
// `revision_note` beserta jejak siapa dan kapan memintanya. Filternya tetap disediakan
// karena inilah pekerjaan yang paling mudah terlupakan — sebelumnya satu-satunya cara
// menemukannya adalah menyisir seluruh tabel baris per baris.
const REVISION_STATUS_FILTER = 'Perlu Revisi';

// Juga bukan status di basis data, dan bukan pula kerabat `REVISION_STATUS_FILTER`:
// ini menyaring task yang lahir dari putaran pengembalian jalur pengujian
// (`return_round_id` terisi). Disediakan karena justru task inilah yang menahan
// pengajuan ulang satu jalur — selama satu saja belum selesai, jalurnya tidak dapat
// diajukan kembali — sehingga perlu bisa dipisahkan dari pekerjaan biasa.
const FIX_TASK_FILTER = 'Task Perbaikan';
const TASK_STATUS_FILTERS = ['Belum Mulai', 'Sedang Dikerjakan', REVISION_STATUS_FILTER, FIX_TASK_FILTER, 'Selesai', 'Hold', 'Take Down'];

// Aturan penyaringan satu pilihan filter. Ditaruh satu tempat karena dua pembaca
// memakainya — daftar task dan angka hitungan di sebelah tiap pilihan pada dropdown —
// dan keduanya tidak boleh berbeda: filter yang menampilkan lima baris namun berangka
// nol lebih membingungkan daripada tidak ada angka sama sekali.
const matchesTaskFilter = (task, filter) => {
    if (!filter) return true;
    if (filter === REVISION_STATUS_FILTER) return Boolean(task?.revisionNote);
    if (filter === FIX_TASK_FILTER) return isFixTask(task);
    return task?.status === filter;
};

// Tanggal target selesai hasil kajian analis.
//
// Nilainya disimpan di dalam `devAnalystResult.estimation` / `analystResult.estimation`
// sebagai tanggal ISO (kedua formulir analis memakai `input type="date"`), bukan di
// kolom `projects.estimation` — kolom itu tidak ada dan tidak pernah dikirim API.
const getAnalystTargetDate = (project) => {
    const raw = project?.devAnalystResult?.estimation || project?.analystResult?.estimation || null;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatLongDate = (value) => {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Versi ringkas untuk kolom tabel. Mengembalikan null (bukan "Invalid Date") bila
// nilainya kosong atau tidak dapat diurai, agar pemanggil dapat memilih tampilannya.
const formatShortDate = (value) => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Sisa hari menuju sebuah tanggal, dibulatkan ke hari penuh dan minimal 1.
// Dipakai untuk mengisi awal kolom "durasi pengerjaan" pada modal edit proyek.
const daysUntil = (value) => {
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target.getTime() - startOfToday.getTime()) / 86400000);
    return diffDays > 0 ? diffDays : null;
};

// Dokumen SIT/UAT (bukti task, hasil review, berita acara, dsb.) disembunyikan
// dari daftar umum — tampil di panel per-task / wizard SIT-UAT. Nilai dan fungsi
// filternya murni, jadi diletakkan di lingkup modul supaya identitasnya stabil
// antar render (dipakai sebagai dependency useMemo di DocumentSection).
const HIDDEN_DOC_TYPES = ['SIT_TASK_EVIDENCE', 'SIT_SIGNOFF', 'UAT_PREP', 'UAT_EXEC', 'UAT_APPROVAL'];
const visibleDocs = (list) => Array.isArray(list)
    ? list.filter(d => !HIDDEN_DOC_TYPES.includes((d.document_type || d.type || '').toUpperCase()))
    : [];

export default function TaskDetail() {
    const { user } = useAuth();
    const { projects, updateProject, refreshDataSilent } = useProjects();
    const { id: projectId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    // Nilai `uat-approvals` dipertahankan apa adanya meski halaman tujuannya kini memuat
    // SIT sekaligus: halaman persetujuan gabungan masih mengirim nilai itu, dan tautan
    // lama yang sudah tersimpan pengguna harus tetap mengenali asalnya.
    const openedFromApprovals = searchParams.get('from') === 'uat-approvals';

    // Mode VIEWER: developer & analyst hanya bisa melihat (read-only).
    // Kecuali developer tetap bisa update status task miliknya sendiri (di My Tasks).
    const isViewerOnly = ['developer', 'analyst', 'head_of_it', 'lead_group'].includes(user?.role);

    // Reset posisi scroll browser ke paling atas (0, 0) saat laman dibuka
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [projectId]);

    const project = useMemo(() => {
        if (!projectId) return null;

        // 1. Cari di ProjectContext (data dinamis & ter-update)
        const ctxFound = (projects || []).find((p) =>
            String(p.id).toLowerCase() === String(projectId).toLowerCase() ||
            String(p.reqId || p.req_id || '').toLowerCase() === String(projectId).toLowerCase()
        );

        if (ctxFound) {
            return {
                ...ctxFound,
                id: ctxFound.id,
                name: ctxFound.name,
                code: ctxFound.id,
                // Pertahankan objek pm & analyst utuh (dengan id) agar bisa di-assign sebagai assignee task
                pm: ctxFound.pm,
                analyst: ctxFound.analyst,
                division: typeof ctxFound.division === 'object' ? (ctxFound.division?.name || '') : (ctxFound.division || ''),
                status: ctxFound.status || 'IN_DEVELOPMENT',
                progress: ctxFound.progress ?? 0,
                tasks: Array.isArray(ctxFound.tasks) ? ctxFound.tasks : []
            };
        }

        // 2. Tidak ditemukan berarti tidak ditemukan.
        //    Sebelumnya di sini ada fallback ke projects[0], sehingga membuka URL task
        //    proyek yang tidak ada — atau yang tidak boleh diakses pengguna — malah
        //    menampilkan data proyek lain, dan aksi task di halaman ini akan tertulis ke
        //    proyek yang salah. Pemanggil sudah punya penanganan "Proyek tidak ditemukan".
        return null;
    }, [projectId, projects]);

    // ── Data SIT/UAT: ambil selalu segar dari API saat project berubah,
    //    agar bukti revisi dari tab SIT selalu tampil di Manajemen Task. ──
    const [sitUatData, setSitUatData] = useState(null);
    const projectIdForSit = project?.id ?? null;

    const fetchSitUatData = useCallback(() => {
        if (!projectIdForSit) return;
        projectService.getById(projectIdForSit)
            .then(res => {
                const raw = res?.data || res;
                const sd = raw?.sitUatData || raw?.sit_uat_data || null;
                if (sd) setSitUatData(sd);
            })
            .catch(() => {});
    }, [projectIdForSit]);

    useEffect(() => {
        let cancelled = false;
        if (!projectIdForSit) return undefined;
        // Selalu ambil dari context (auto-refresh berkala) agar tidak pernah kosong/stale
        const ctxData = project?.sitUatData || project?.sit_uat_data || null;

        const loadFresh = async () => {
            try {
                const res = await projectService.getById(projectIdForSit);
                if (cancelled) return;
                const raw = res?.data || res;
                const sd = raw?.sitUatData || raw?.sit_uat_data || null;
                if (sd) setSitUatData(sd);
                else if (ctxData) setSitUatData(ctxData);
            } catch {
                if (!cancelled && ctxData) setSitUatData(ctxData);
            }
        };
        loadFresh();
        return () => { cancelled = true; };
    }, [projectIdForSit, project?.sitUatData, project?.sit_uat_data]);

    // Polling ringan agar data SIT/UAT sinkron — selang waktunya dipusatkan di
    // `constants/polling.js` dan berhenti saat tab tidak terlihat.
    useVisibilityPolling(fetchSitUatData, POLLING_INTERVAL_MS.sitUatData, {
        enabled: Boolean(projectIdForSit),
    });


    // Bagian proyek yang dibaca hook-hook di bawah diambil ke variabel lokal supaya
    // dependency-nya persis nilai yang dipakai, bukan objek `project` seutuhnya.
    const projectTeam = project?.team;
    const projectPm = project?.pm;
    const projectAnalyst = project?.analyst;
    const projectTasks = project?.tasks;
    const projectSitUatCamel = project?.sitUatData;
    const projectSitUatSnake = project?.sit_uat_data;
    const projectStatusHistories = project?.status_histories;
    const activeProjectId = project?.id;

    // Daftar anggota tim proyek yang sah menjadi assignee task.
    // HANYA developer yang sudah dialokasikan ke proyek ini (ditambah PM/Analyst proyek).
    // Tidak ada fallback hardcode — task wajib diserahkan ke orang yang terlibat di proyek.
    const teamMembers = useMemo(() => {
        const rawTeam = Array.isArray(projectTeam) ? projectTeam : [];
        const members = rawTeam
            .map(m => {
                if (!m) return null;
                if (typeof m === 'object') {
                    return {
                        id: m.user_id ?? m.id ?? null,
                        name: m.name || 'Developer',
                        email: m.email || null,
                        role: m.role || 'Developer',
                    };
                }
                return { id: null, name: String(m), email: null, role: 'Developer' };
            })
            .filter(m => m && m.name);

        // Tambahkan PM & Analyst proyek bila tersedia (supaya bisa juga di-assign bila dibutuhkan)
        const seen = new Set(members.map(m => m.name.toLowerCase()));
        const addPerson = (p, role) => {
            if (!p) return;
            const name = typeof p === 'object' ? (p.name || p.email || null) : String(p);
            if (!name) return;
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            members.push({
                id: (typeof p === 'object' && (p.id ?? p.user_id)) ? (p.id ?? p.user_id) : null,
                name,
                email: (typeof p === 'object' ? p.email : null) || null,
                role,
            });
        };
        if (projectPm) addPerson(projectPm, 'Project Manager');
        if (projectAnalyst) addPerson(projectAnalyst, 'System Analyst');

        return members;
    }, [projectTeam, projectPm, projectAnalyst]);

    const [activeTab, setActiveTab] = useState(() => (
        searchParams.get('tab') === 'sit_uat' ? 'sit_uat' : 'tasks'
    )); // tasks, sit_uat, documents, activity
    const { addNotification } = useNotifications();

    const [searchTask, setSearchTask] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
    const [tasks, setTasks] = useState([]);

    // Normalisasi task dari backend -> shape yang dipakai UI
    const normalizeTask = (t) => ({
        id: t?.id,
        name: t?.title || t?.name,
        title: t?.title || t?.name,
        description: t?.description || '',
        assignee: t?.assignee_detail?.name || t?.assignee?.name || t?.assignee || '',
        assignee_id: t?.assignee_id ?? t?.assignee_detail?.id ?? null,
        deadline: t?.due_date || t?.deadline || '',
        priority: t?.priority || 'Medium',
        status: mapTaskStatusToLabel(t?.status),
        revisionNote: t?.revision_note || '',
        revisionRequestedAt: t?.revision_requested_at || null,
        revisionRequestedBy: t?.revision_requested_by || '',
        // Penanda asal task perbaikan. Jalur dan nomor putaran hanya terisi bila relasi
        // `returnRound` dimuat — endpoint daftar task tidak memuatnya — jadi labelnya
        // dibentuk dari `project.return_rounds`; lihat `constants/returnRound.js`.
        returnRoundId: t?.return_round_id ?? null,
        returnRoundTrack: t?.return_round_track ?? null,
        returnRoundNumber: t?.return_round_number ?? null,
    });

    // Resolusi nama assignee -> id anggota tim proyek (fallback: cari di tasks yg sudah ada)
    const resolveAssigneeId = (value) => {
        if (!value) return null;
        if (typeof value === 'object') return value.id ?? value.user_id ?? null;
        const str = String(value).trim();
        if (!str) return null;

        // Jika value adalah id numerik anggota tim, langsung kembalikan
        if (/^\d+$/.test(str)) {
            const byId = teamMembers.find(m => m.id != null && Number(m.id) === Number(str));
            if (byId) return byId.id;
            return Number(str);
        }

        const found = teamMembers.find(m => {
            const name = String(m.name || '').toLowerCase();
            return name === str.toLowerCase() || name.includes(str.toLowerCase()) || str.toLowerCase().includes(name);
        });
        if (found?.id) return found.id;
        // fallback: cocokkan dengan assignee yang sudah ter-record di task lain
        const existing = (tasks || []).find(t => String(t.assignee || '').toLowerCase() === str.toLowerCase());
        return existing?.assignee_id ?? null;
    };

    // Load task dari backend saat project berubah
    useEffect(() => {
        let cancelled = false;
        if (project?.id) {
            taskService.getByProject(project.id)
                .then(res => {
                    if (cancelled) return;
                    const list = Array.isArray(res?.data) ? res.data.map(normalizeTask) : [];
                    setTasks(list);
                })
                .catch(() => {
                    if (!cancelled) setTasks([]);
                });
        }
        return () => { cancelled = true; };
    }, [project?.id]);

    // Sinkronkan otomatis dengan data task dari ProjectContext (hasil polling/refresh
    // real-time). Setiap task yang sudah ada di-update status & catatan revisi agar
    // perubahan dari tab lain (mis. revisi SIT) langsung terlihat tanpa refresh manual.
    //
    // Penggabungan ini tetap memakai effect: `tasks` bukan salinan murni dari context —
    // isinya berasal dari `taskService.getByProject` dan diubah langsung oleh aksi di
    // halaman ini (tambah, ubah, minta revisi), sehingga tidak bisa dihitung ulang dari
    // prop saat render. Aturan react-hooks dimatikan khusus di baris ini.
    useEffect(() => {
        const ctxTasks = Array.isArray(project?.tasks) ? project.tasks : [];
        if (ctxTasks.length === 0) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- gabungkan pembaruan dari polling, lihat catatan di atas
        setTasks(prev => {
            const next = prev.map(t => {
                const match = ctxTasks.find(ct => String(ct.id) === String(t.id));
                if (!match) return t;
                return {
                    ...t,
                    name: match.title || match.name || t.name,
                    title: match.title || match.name || t.name,
                    description: match.description ?? t.description,
                    assignee: match.assignee_detail?.name || match.assignee?.name || match.assignee || t.assignee,
                    assignee_id: match.assignee_id ?? match.assignee_detail?.id ?? t.assignee_id,
                    deadline: match.due_date || match.deadline || t.deadline,
                    priority: match.priority || t.priority,
                    status: mapTaskStatusToLabel(match.status),
                    revisionNote: match.revision_note || '',
                    revisionRequestedAt: match.revision_requested_at || null,
                    revisionRequestedBy: match.revision_requested_by || '',
                    // Penanda putaran pengembalian ikut disegarkan supaya task yang baru
                    // ditandai dari halaman Putaran Pengembalian langsung terlihat di sini.
                    // Nilai lama dipertahankan bila context mengirimnya kosong, karena
                    // `ProjectResource` memangkas kolom yang relasinya tidak dimuat.
                    returnRoundId: match.return_round_id ?? t.returnRoundId ?? null,
                    returnRoundTrack: match.return_round_track ?? t.returnRoundTrack ?? null,
                    returnRoundNumber: match.return_round_number ?? t.returnRoundNumber ?? null,
                };
            });
            // Tambahkan task baru yang ada di context tapi belum di state lokal
            const existingIds = new Set(prev.map(t => String(t.id)));
            const newTasks = ctxTasks
                .filter(ct => !existingIds.has(String(ct.id)))
                .map(ct => ({
                    id: ct.id,
                    name: ct.title || ct.name,
                    title: ct.title || ct.name,
                    description: ct.description || '',
                    assignee: ct.assignee_detail?.name || ct.assignee?.name || ct.assignee || '',
                    assignee_id: ct.assignee_id ?? ct.assignee_detail?.id ?? null,
                    deadline: ct.due_date || ct.deadline || '',
                    priority: ct.priority || 'Medium',
                    status: mapTaskStatusToLabel(ct.status),
                    revisionNote: ct.revision_note || '',
                    revisionRequestedAt: ct.revision_requested_at || null,
                    revisionRequestedBy: ct.revision_requested_by || '',
                    returnRoundId: ct.return_round_id ?? null,
                    returnRoundTrack: ct.return_round_track ?? null,
                    returnRoundNumber: ct.return_round_number ?? null,
                }));
            return [...next, ...newTasks];
        });
    }, [project?.tasks, project?.id]);
    
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        assignee: '',
        deadline: '',
        priority: 'Medium',
        description: '',
    });

    const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [isSubmittingTask, setIsSubmittingTask] = useState(false); // guard double-submit (tambah/edit task)

    // ── Komentar & Riwayat Task (dokumentasi tiap tahap, per-task) ──────────
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [taskLogs, setTaskLogs] = useState({});      // taskId -> [activity logs]
    const [taskLogsLoading, setTaskLogsLoading] = useState({}); // taskId -> bool

    const loadTaskLogs = useCallback(async (taskId) => {
        if (taskLogsLoading[taskId]) return;
        setTaskLogsLoading(prev => ({ ...prev, [taskId]: true }));
        try {
            const res = await activityLogService.getByTask(taskId);
            const list = Array.isArray(res?.data) ? res.data : [];
            setTaskLogs(prev => ({ ...prev, [taskId]: list }));
        } catch {
            setTaskLogs(prev => ({ ...prev, [taskId]: [] }));
        } finally {
            setTaskLogsLoading(prev => ({ ...prev, [taskId]: false }));
        }
    }, [taskLogsLoading]);

    const toggleTaskLog = (taskId) => {
        setExpandedTaskId(prev => (prev === taskId ? null : taskId));
        if (expandedTaskId !== taskId && !taskLogs[taskId]) {
            loadTaskLogs(taskId);
        }
    };

    const fmtShortDateTime = (iso) => {
        if (!iso) return '-';
        try {
            return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return '-';
        }
    };

    const getTaskActionMeta = (action) => {
        const map = {
            create_task: { label: 'Task Dibuat', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
            update_task_status: { label: 'Status Diubah', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
            update_task: { label: 'Task Diperbarui', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
            delete_task: { label: 'Task Dihapus', cls: 'bg-red-50 text-red-600 border-red-200' },
            request_task_revision: { label: 'Revisi Diminta', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
            task_revision_completed: { label: 'Revisi Selesai', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        };
        return map[action] || { label: action, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
    };

    /**
     * Data wizard SIT/UAT yang dipakai seluruh turunan per task.
     *
     * Sumbernya dua: objek proyek dari `ProjectContext` (paling baru karena
     * ikut polling daftar proyek) dan hasil `fetchSitUatData` (dipakai ketika
     * proyek belum termuat di context, misalnya saat halaman dibuka langsung
     * lewat URL). Objek context dipakai bila isinya tidak kosong, sebab proyek
     * yang belum pernah masuk SIT mengembalikan objek kosong dan bukan null.
     */
    const resolvedSitUatData = useMemo(() => {
        const ctxSit = projectSitUatCamel || projectSitUatSnake || null;
        return (ctxSit && Object.keys(ctxSit).length > 0 ? ctxSit : sitUatData) || ctxSit || sitUatData || {};
    }, [projectSitUatCamel, projectSitUatSnake, sitUatData]);

    // ── Bukti SIT per task (dari sitUatData.sit2_task_approvals) ────────────
    // Normalisasi: backend kadang mengembalikan object {taskId: approval} ATAU
    // array [approval, ...] (akibat PHP integer-key). Di sini di-map ke object
    // keyed by task id menggunakan urutan project.tasks.
    const getTaskApprovalMap = useMemo(() => {
        const raw = resolvedSitUatData?.sit2_task_approvals || {};
        const taskIds = Array.isArray(projectTasks) ? projectTasks.map(t => t.id) : [];
        const map = {};
        if (Array.isArray(raw)) {
            raw.forEach((v, i) => {
                if (v && typeof v === 'object') {
                    const key = taskIds[i] !== undefined ? String(taskIds[i]) : String(i);
                    map[key] = v;
                }
            });
        } else if (raw && typeof raw === 'object') {
            for (const [k, v] of Object.entries(raw)) {
                if (v && typeof v === 'object') {
                    // Backend bisa kirim "task_10" (prefix) atau "10"
                    const cleanKey = String(k).replace(/^task_/, '');
                    map[cleanKey] = v;
                }
            }
        }
        return map;
    }, [projectTasks, resolvedSitUatData]);

    const getTaskSitApproval = (taskId) => {
        try {
            const key = String(taskId);
            return getTaskApprovalMap[key] || null;
        } catch {
            return null;
        }
    };

    const getTaskSitAttachments = (taskId) => {
        const approval = getTaskSitApproval(taskId);
        if (!approval) return [];
        return Array.isArray(approval.attachments) ? approval.attachments : [];
    };

    const getTaskSitApprovedAt = (taskId) => {
        const approval = getTaskSitApproval(taskId);
        if (!approval) return null;
        return approval.approvedAt || null;
    };

    /**
     * Rangkuman hasil UAT Internal (Tahap 2) per task, keyed by id task.
     *
     * Menggabungkan skenario dan permintaan tambahan. Status verifikasi menunjukkan
     * tahap perbaikan; lampiran verifikasi legacy tetap dibaca sebagai bukti historis.
     */
    const taskUatInfoMap = useMemo(() => {
        const map = {};

        (Array.isArray(resolvedSitUatData?.uat2_scenarios) ? resolvedSitUatData.uat2_scenarios : [])
            .filter(scenario => scenario?.taskId != null)
            .forEach(scenario => {
                map[String(scenario.taskId)] = {
                    source: 'scenario',
                    title: scenario.scenario || '',
                    result: scenario.result || '',
                    changeType: scenario.changeType || '',
                    request: scenario.request || '',
                    comment: scenario.comment || '',
                    verificationStatus: scenario.verificationStatus || '',
                    attachments: Array.isArray(scenario.attachments) ? scenario.attachments : [],
                    verificationAttachments: Array.isArray(scenario.verificationAttachments)
                        ? scenario.verificationAttachments
                        : [],
                };
            });

        (Array.isArray(resolvedSitUatData?.uat2_additional_requests) ? resolvedSitUatData.uat2_additional_requests : [])
            .filter(request => request?.taskId != null)
            .forEach(request => {
                map[String(request.taskId)] = {
                    source: 'additional_request',
                    title: request.title || '',
                    // Permintaan tambahan selalu berarti ada yang harus dikerjakan,
                    // sehingga hasilnya disamakan dengan skenario yang direvisi agar
                    // penyajian di tabel tidak perlu bercabang.
                    result: 'revision',
                    changeType: request.changeType || '',
                    request: request.detail || '',
                    comment: request.comment || '',
                    verificationStatus: request.verificationStatus || '',
                    attachments: Array.isArray(request.attachments) ? request.attachments : [],
                    verificationAttachments: Array.isArray(request.verificationAttachments)
                        ? request.verificationAttachments
                        : [],
                };
            });

        return map;
    }, [resolvedSitUatData]);

    const getTaskUatInfo = (taskId) => taskUatInfoMap[String(taskId)] || null;

    /**
     * Change Request UAT yang menaungi sebuah task, keyed by id task.
     *
     * Hanya CR yang masih hidup dipetakan — permintaan yang sudah `superseded`
     * tidak lagi mewakili pekerjaan apa pun. Bila satu task pernah direvisi lebih
     * dari sekali, entri terakhirlah yang menang karena itulah siklus berjalan.
     *
     * Dipakai kolom Revisi untuk membedakan revisi Minor dari Mayor beserta
     * kemajuannya. Sebelumnya kolom itu hanya menampilkan "Menunggu" tanpa
     * menyebut tingkat perubahannya, padahal konsekuensinya berbeda tajam:
     * Mayor menahan rilis sampai SIT ulang, Minor hanya menahan persetujuan final.
     */
    const taskChangeRequestMap = useMemo(() => {
        const map = {};
        (Array.isArray(resolvedSitUatData?.uat_change_requests) ? resolvedSitUatData.uat_change_requests : [])
            .filter(request => request?.taskId != null && request?.status !== 'superseded')
            .forEach(request => {
                map[String(request.taskId)] = request;
            });
        return map;
    }, [resolvedSitUatData]);

    const getTaskChangeRequest = (taskId) => taskChangeRequestMap[String(taskId)] || null;

    /**
     * UAT sedang menunggu dijalankan ulang dari Tahap 1.
     *
     * Revisi Mayor mengarsipkan seluruh putaran UAT yang berjalan ke `uat_cycles`
     * lalu mengosongkan `uat2_scenarios` & `uat2_additional_requests`, sehingga
     * kolom UAT setiap task kembali kosong. Tanpa penanda ini kolom kosong itu
     * terbaca "belum pernah diuji", padahal task-nya sudah diuji dan hasilnya
     * memicu pengulangan. Kunci lama `uat2_resume_after_sit` ikut dibaca karena
     * baris yang sudah ada di basis data masih memakainya.
     */
    const isUatRestartPending = resolvedSitUatData?.uat_restart_after_sit === true
        || resolvedSitUatData?.uat2_resume_after_sit === true
        || (Array.isArray(resolvedSitUatData?.uat_cycles) && resolvedSitUatData.uat_cycles.length > 0);

    /**
     * Unduh bukti pengujian dengan auth header.
     *
     * Tautan `<a href>` langsung ke endpoint dokumen gagal 401 karena tidak
     * membawa token, dan Laravel merespons dengan `Route [login] not defined`.
     *
     * `evidenceKind` hanya menentukan nama berkas cadangan ketika dokumennya
     * tidak memiliki nama asli; bukti SIT dan bukti UAT sama-sama melewati jalur
     * ini.
     */
    const downloadSitAttachment = async (doc, evidenceKind = 'sit') => {
        const fallbackName = `bukti-${evidenceKind}`;
        try {
            if (doc?.docId) {
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = doc.originalName || doc.name || fallbackName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else if (doc?.url?.startsWith('blob:')) {
                const a = document.createElement('a');
                a.href = doc.url;
                a.download = doc.originalName || doc.name || fallbackName;
                a.click();
            } else {
                toast('Berkas belum tersedia untuk diunduh.');
            }
        } catch (err) {
            toast.error(`Gagal mengunduh bukti: ${err.message}`);
        }
    };

    /**
     * Buka pratinjau bukti pengujian dengan auth header, di dalam modal aplikasi.
     *
     * `evidenceKind` memilih judul dan jenis dokumen yang ditampilkan pada
     * header pratinjau, sebab bukti SIT dan bukti UAT tersimpan sebagai jenis
     * dokumen yang berbeda (`SIT_TASK_EVIDENCE` dan `UAT_EVIDENCE`).
     */
    const [sitPreviewDoc, setSitPreviewDoc] = useState(null);
    const viewSitAttachment = async (doc, evidenceKind = 'sit') => {
        const isUat = evidenceKind === 'uat';
        const fallbackLabel = isUat ? 'Bukti UAT' : 'Bukti SIT';
        const documentType = isUat ? 'UAT_EVIDENCE' : 'SIT_TASK_EVIDENCE';
        try {
            if (doc?.docId) {
                const loadingId = toast.loading('Membuka berkas...');
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                toast.dismiss(loadingId);
                setSitPreviewDoc({
                    id: doc.docId,
                    name: doc.originalName || doc.name || fallbackLabel,
                    original_filename: doc.originalName || doc.name,
                    url,
                    type: (doc.type || 'FILE'),
                    document_type: documentType,
                });
            } else if (doc?.url?.startsWith('blob:')) {
                setSitPreviewDoc({
                    id: doc.docId || null,
                    name: doc.originalName || doc.name || fallbackLabel,
                    original_filename: doc.originalName || doc.name,
                    url: doc.url,
                    type: (doc.type || 'FILE'),
                    document_type: documentType,
                });
            } else {
                toast('Berkas belum tersedia untuk dilihat.');
            }
        } catch (err) {
            toast.error(`Gagal membuka bukti: ${err.message}`);
        }
    };
    
    // Modal Edit Proyek & Alokasi PM
    const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
    const [isSavingProjectEdit, setIsSavingProjectEdit] = useState(false);
    const [editProjectForm, setEditProjectForm] = useState({
        pmId: '',
        description: '',
        estimation: '30',
    });

    // Kandidat PM diambil dari daftar pengguna nyata, bukan daftar nama tetap.
    const [pmCandidates, setPmCandidates] = useState([]);
    const [isPmCandidatesLoading, setIsPmCandidatesLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        userService.getAll()
            .then(res => {
                if (!isMounted) return;
                const usersList = Array.isArray(res) ? res : res?.data || [];
                const pmUsers = usersList.filter(candidate => {
                    const roleName = (candidate.role?.name || candidate.role || '').toString().toLowerCase();
                    return roleName === 'project_manager' || roleName === 'dev_analyst';
                });

                setPmCandidates(pmUsers.map(candidate => ({
                    id: candidate.id,
                    name: candidate.name,
                    division: typeof candidate.division === 'string'
                        ? candidate.division
                        : (candidate.division?.name || candidate.division_detail?.name || ''),
                })));
            })
            .catch(() => {
                if (isMounted) setPmCandidates([]);
            })
            .finally(() => {
                if (isMounted) setIsPmCandidatesLoading(false);
            });

        return () => { isMounted = false; };
    }, []);

    // Beban proyek aktif per PM, dihitung dari id agar tidak bergantung pada
    // kecocokan teks nama yang mudah salah.
    const pmActiveProjectCount = useMemo(() => {
        const counter = new Map();

        (projects || []).forEach(item => {
            const pmId = typeof item.pm === 'object' ? item.pm?.id : null;
            const resolvedPmId = pmId ?? item.pm_id ?? null;
            const isFinished = item.status === 'LIVE_PRODUCTION'
                || item.status === 'CANCELLED'
                || item.status === 'REJECTED';

            if (!resolvedPmId || isFinished) return;

            counter.set(Number(resolvedPmId), (counter.get(Number(resolvedPmId)) || 0) + 1);
        });

        return counter;
    }, [projects]);

    const analystTargetDate = getAnalystTargetDate(project);
    const analystTargetDateLabel = analystTargetDate ? formatLongDate(analystTargetDate) : null;
    const projectDeadlineLabel = project?.deadline ? formatLongDate(project.deadline) : null;

    const handleOpenEditProjectModal = () => {
        const currentPmId = (typeof project?.pm === 'object' ? project.pm?.id : null) ?? project?.pm_id ?? '';

        // Durasi diisi awal dari tenggat yang sedang berlaku, lalu target analis sebagai
        // cadangan. Sebelumnya diisi dari `project.estimation` yang tidak pernah ada,
        // sehingga kolom ini selalu menampilkan 30 hari dan menimpa tenggat asli begitu
        // formulir disimpan.
        const currentDurationDays = daysUntil(project?.deadline) ?? (analystTargetDate ? daysUntil(analystTargetDate) : null);

        setEditProjectForm({
            pmId: currentPmId ? String(currentPmId) : '',
            description: project?.description || '',
            estimation: String(currentDurationDays ?? 30),
        });
        setIsEditProjectModalOpen(true);
    };

    const handleSaveProjectEdit = async (e) => {
        e.preventDefault();
        if (isSavingProjectEdit) return;
        if (!editProjectForm.pmId) {
            toast.error('Pilih Project Manager penanggung jawab!');
            return;
        }

        const days = parseInt(editProjectForm.estimation || '30', 10) || 30;
        const calcDeadline = new Date();
        calcDeadline.setDate(calcDeadline.getDate() + days);
        const deadlineIso = calcDeadline.toISOString().split('T')[0];

        // Backend hanya menerima `pm_id`; mengirim nama saja membuat penugasan ini
        // tidak pernah tersimpan. `current_stage_deadline` adalah kolom yang memang
        // dibaca backend untuk tenggat tahap berjalan.
        //
        // Hasil `updateProject` ditunggu dan kegagalannya ditangani: versi sebelumnya
        // memanggilnya tanpa `await` maupun `.catch()` lalu langsung menutup modal, jadi
        // penggantian PM yang gagal tersimpan tetap terlihat seperti berhasil.
        setIsSavingProjectEdit(true);
        try {
            await updateProject(project.id, {
                pm_id: Number(editProjectForm.pmId),
                description: editProjectForm.description,
                current_stage_deadline: deadlineIso,
            });
            toast.success('Perubahan proyek berhasil disimpan.');
            setIsEditProjectModalOpen(false);
        } catch (err) {
            toast.error(`Gagal menyimpan perubahan proyek: ${err.message || 'Terjadi kesalahan'}`);
        } finally {
            setIsSavingProjectEdit(false);
        }
    };

    const handleAddTask = async (e) => {
        e.preventDefault();

        // Cegah double-submit saat request sedang diproses
        if (isSubmittingTask) return;

        if (!newTask.title.trim()) {
            toast.error('Nama task wajib diisi!');
            return;
        }

        // Resolusi assignee -> id anggota tim proyek
        const assigneeId = resolveAssigneeId(newTask.assignee);
        if (newTask.assignee && !assigneeId) {
            toast.error('Assignee tidak valid. Pilih dari anggota tim proyek.');
            return;
        }

        const payload = {
            title: newTask.title.trim(),
            description: newTask.description || '',
            assignee_id: assigneeId || null,
            due_date: newTask.deadline || null,
            priority: newTask.priority || 'Medium',
            status: mapTaskStatusToEnum('Belum Mulai'),
        };

        setIsSubmittingTask(true);
        const loadingToastId = toast.loading('Menyimpan task... Mohon tunggu.', { duration: Infinity });
        try {
            const res = await taskService.create(project.id, payload);
            const created = normalizeTask(res?.data);
            setTasks(prev => [...prev, created]);
            toast.dismiss(loadingToastId);
            toast.success(`Task "${newTask.title}" berhasil ditambahkan!`);
            setIsAddTaskModalOpen(false);
            setNewTask({ title: '', assignee: '', deadline: '', priority: 'Medium', description: '' });
            // Sinkronkan ProjectContext agar task baru tampil di semua laman
            refreshDataSilent?.();
        } catch (err) {
            toast.dismiss(loadingToastId);
            toast.error(`Gagal menambah task: ${err.message}`);
        } finally {
            setIsSubmittingTask(false);
        }
    };

    const handleEditTask = async (e) => {
        e.preventDefault();

        // Cegah double-submit saat request sedang diproses
        if (isSubmittingTask) return;

        if (!editingTask.name.trim()) {
            toast.error('Nama task wajib diisi!');
            return;
        }

        const assigneeId = resolveAssigneeId(editingTask.assignee);
        if (editingTask.assignee && !assigneeId) {
            toast.error('Assignee tidak valid. Pilih dari anggota tim proyek.');
            return;
        }

        const payload = {
            title: editingTask.name.trim(),
            description: editingTask.description || '',
            assignee_id: assigneeId ?? null,
            due_date: editingTask.deadline || null,
            priority: editingTask.priority || 'Medium',
            status: mapTaskStatusToEnum(editingTask.status),
        };

        setIsSubmittingTask(true);
        const loadingToastId = toast.loading('Menyimpan perubahan task... Mohon tunggu.', { duration: Infinity });
        try {
            const res = await taskService.update(editingTask.id, payload);
            const updated = normalizeTask(res?.data);
            setTasks(prev => prev.map(t => t.id === editingTask.id ? updated : t));
            toast.dismiss(loadingToastId);
            toast.success(`Task "${editingTask.name}" berhasil diperbarui!`);
            setIsEditTaskModalOpen(false);
            // Sinkronkan ProjectContext agar data task di semua laman ikut ter-update
            refreshDataSilent?.();
        } catch (err) {
            toast.dismiss(loadingToastId);
            toast.error(`Gagal memperbarui task: ${err.message}`);
        } finally {
            setIsSubmittingTask(false);
        }
    };

    const handleDeleteTask = async (taskToDelete) => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus task "${taskToDelete.name}"?`)) {
            try {
                await taskService.delete(taskToDelete.id);
                setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
                toast.success(`Task "${taskToDelete.name}" berhasil dihapus!`);
                // Sinkronkan ProjectContext agar task terhapus hilang di semua laman
                refreshDataSilent?.();
            } catch (err) {
                toast.error(`Gagal menghapus task: ${err.message}`);
            }
        }
    };

    // Pencarian nama task digabung dengan filter status. `task.name` bisa kosong bila
    // backend mengirim task tanpa judul, jadi nilainya dinormalkan lebih dulu agar
    // `.toLowerCase()` tidak melempar pada data seperti itu.
    const filteredTasks = useMemo(() => {
        const keyword = searchTask.trim().toLowerCase();
        return tasks.filter((task) => {
            const matchesKeyword = !keyword || String(task.name || '').toLowerCase().includes(keyword);
            // "Perlu Revisi" dan "Task Perbaikan" bukan kolom status — keduanya disaring
            // dari catatan revisi dan dari `return_round_id`; lihat `matchesTaskFilter`.
            const matchesStatus = matchesTaskFilter(task, statusFilter);
            return matchesKeyword && matchesStatus;
        });
    }, [tasks, searchTask, statusFilter]);

    const getStatusBadge = (status) => {
        const configs = {
            Selesai: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            'Sedang Dikerjakan': 'bg-blue-100 text-blue-800 border-blue-200',
            'Belum Mulai': 'bg-gray-100 text-gray-600 border-gray-200',
            'Hold': 'bg-amber-100 text-amber-800 border-amber-200',
            'Take Down': 'bg-red-100 text-red-700 border-red-200',
        };
        return configs[status] || configs['Belum Mulai'];
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Selesai':
                return <CheckCircle size={14} className="text-emerald-600" />;
            case 'Sedang Dikerjakan':
                return <Clock size={14} className="text-blue-600" />;
            case 'Hold':
                return <AlertCircle size={14} className="text-amber-600" />;
            case 'Take Down':
                return <AlertCircle size={14} className="text-red-600" />;
            default:
                return <AlertCircle size={14} className="text-gray-400" />;
        }
    };

    const getStatusSelectClass = (status) => {
        const configs = {
            Selesai: 'border-emerald-300 bg-emerald-50 text-emerald-700',
            'Sedang Dikerjakan': 'border-blue-300 bg-blue-50 text-blue-700',
            'Belum Mulai': 'border-gray-300 bg-gray-50 text-gray-600',
            'Hold': 'border-amber-300 bg-amber-50 text-amber-700',
            'Take Down': 'border-red-300 bg-red-50 text-red-700',
        };
        return configs[status] || configs['Belum Mulai'];
    };

    // Progress dihitung dari task NON-TAKE-DOWN (konsisten dengan gate SIT/UAT).
    // Task berstatus "Take Down" tidak dihitung sebagai tugas yang harus diselesaikan.
    const progressEligibleTasks = tasks.filter(t => {
        const st = String(t.status || '').toLowerCase();
        return st !== 'take_down' && st !== 'take down';
    });
    const completedTasks = progressEligibleTasks.filter((t) => {
        const st = String(t.status || '').toLowerCase();
        return st === 'selesai' || st === 'done' || t.done === true;
    }).length;
    const progress = progressEligibleTasks.length === 0 ? 0 : Math.round((completedTasks / progressEligibleTasks.length) * 100);

    // 📜 Log Aktivitas Proyek — dari status_histories (transisi status) + activity_logs (task & proyek)
    const [taskActivityLogs, setTaskActivityLogs] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);

    const fetchTaskActivityLogs = useCallback(async () => {
        if (!activeProjectId) return;
        setActivityLoading(true);
        try {
            const res = await activityLogService.getByProject(activeProjectId, 200);
            const logs = Array.isArray(res?.data) ? res.data : [];
            setTaskActivityLogs(logs);
        } catch {
            // Abaikan error — status_histories tetap tampil
        } finally {
            setActivityLoading(false);
        }
    }, [activeProjectId]);

    // Load saat project berubah & polling agar kegiatan baru langsung tercatat.
    // Selang waktunya dipusatkan di `constants/polling.js`; polling berhenti saat
    // tab tidak terlihat sehingga tab yang ditinggalkan tidak terus memukul API.
    useVisibilityPolling(fetchTaskActivityLogs, POLLING_INTERVAL_MS.activityLog, {
        enabled: Boolean(activeProjectId),
        immediate: true,
        resetKey: activeProjectId ?? null,
    });

    // Gabungkan status_histories + activity_logs, urutkan berdasarkan waktu terbaru
    const activityItems = useMemo(() => {
        const items = [];

        // 1) Riwayat transisi status proyek
        const histories = Array.isArray(projectStatusHistories) ? projectStatusHistories : [];
        histories.forEach((h, i) => {
            items.push({
                id: `hist-${h.id ?? i}`,
                kind: 'status',
                fromStatus: h.from_status ?? null,
                toStatus: h.to_status ?? null,
                actorName: (h.changed_by && typeof h.changed_by === 'object' ? (h.changed_by.name || '') : '') || 'Sistem',
                description: null,
                notes: h.notes || null,
                createdAt: h.created_at || null,
            });
        });

        // 2) Log aktivitas dari activity_logs (create/update task, status proyek, dsb.)
        (taskActivityLogs || []).forEach((l, i) => {
            items.push({
                id: `log-${l.id ?? i}`,
                kind: l.action?.includes('task') ? 'task' : 'project',
                action: l.action || null,
                actionLabel: l.actionLabel || l.action || 'Aktivitas',
                description: l.description || null,
                actorName: l.user || 'Sistem',
                createdAt: l.timestamp || null,
                fromStatus: l.metadata?.from_status ?? null,
                toStatus: l.metadata?.to_status ?? null,
            });
        });

        return items.sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
        });
    }, [projectStatusHistories, taskActivityLogs]);

    const statusLabel = (st) => {
        if (!st) return null;
        return PROJECT_STATUS_LABEL[st] || st;
    };

    if (!project) {
        return (
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] flex items-center justify-center">
                <div className="text-center py-20 animate-scale-in">
                    <div className="w-24 h-24 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
                        <Briefcase size={44} className="text-gray-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Proyek tidak ditemukan</h2>
                    <p className="text-gray-500 mb-6">Proyek yang Anda cari tidak ada atau sudah dihapus.</p>
                    <button
                        onClick={() => navigate('/pm/workspace')}
                        className="px-6 py-3 bg-[#00529C] text-white rounded-xl font-bold hover:bg-[#004080] transition-all shadow-md shadow-[#00529C]/20"
                    >
                        Kembali ke PM Workspace
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
                {/* Back Button — viewer (developer/analyst) kembali ke Daftar Proyek */}
                <button
                    onClick={() => navigate(openedFromApprovals ? '/approvals' : (isViewerOnly ? '/projects' : '/pm/tasks'))}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#00529C] transition-colors text-sm mb-2"
                >
                    <ChevronLeft size={18} />
                    {openedFromApprovals ? 'Kembali ke Persetujuan Saya' : 'Kembali ke Daftar Proyek'}
                </button>

                {/* Project Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                {project.req_id || project.reqId || project.id}
                            </span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800">{project.name}</h1>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                            {(() => {
                                const badge = getParallelTestingBadge(project);
                                return (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.colorClass}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                        {badge.label}
                                    </span>
                                );
                            })()}
                            {/* Prioritas. Sebelumnya kelasnya diambil dari `project.priorityColor`
                                yang tidak pernah dikirim API mana pun, jadi lencana ini selalu
                                tampil tanpa warna, dan nilainya tampil mentah dalam bahasa
                                Inggris sementara layar lain sudah memakai label Indonesia. */}
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getProjectPriorityClass(project.priority)}`}>
                                <AlertCircle size={14} />
                                {getProjectPriorityLabel(project.priority)}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {(user?.role === 'super_admin' || user?.role === 'head_of_it' || user?.role === 'development_lead') && (
                            <button 
                                onClick={handleOpenEditProjectModal}
                                className="px-4 py-2 rounded-lg bg-[#00529C] text-white hover:bg-[#004080] transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm cursor-pointer"
                                title="Khusus Super Admin & Ketua Grup untuk penyesuaian alokasi PM"
                            >
                                <Edit size={16} />
                                Edit Proyek & PM
                            </button>
                        )}
                    </div>
                </div>

                {/* Bento Grid: Progress + Info */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Progress Card */}
                    <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-center">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-1">Progress Keseluruhan</h3>
                                <p className="text-sm text-gray-500">Status penyelesaian task utama dalam milestone ini.</p>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-[#00529C] block">{progress}%</span>
                                <span className="text-xs text-gray-500">{completedTasks} dari {progressEligibleTasks.length} Task Selesai</span>
                            </div>
                        </div>
                        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#00529C] rounded-full transition-all duration-1000 ease-in-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Project Info Summary */}
                    <div className="col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-bold text-gray-800">Informasi Utama</h3>
                                {/* Target selesai hasil kajian analis. Sebelumnya lencana ini
                                    membaca `project.estimation` yang tidak pernah ada, jadi tidak
                                    pernah tampil sama sekali; nilainya juga dilabeli "Hari Kerja"
                                    padahal yang tersimpan adalah tanggal target. */}
                                {analystTargetDateLabel && (
                                    <span className="text-xs px-2.5 py-1 bg-blue-50 text-[#00529C] border border-blue-200 rounded-full font-extrabold shadow-2xs">
                                        Target Analis: {analystTargetDateLabel}
                                    </span>
                                )}
                            </div>
                            {/* Deskripsi apa adanya. Fallback sebelumnya adalah satu paragraf
                                promosi karangan yang tampil seolah-olah deskripsi asli proyek. */}
                            <p className={`text-sm mb-4 leading-relaxed p-3.5 rounded-xl border ${project.description
                                ? 'text-gray-600 bg-gray-50/70 border-gray-100/80'
                                : 'text-gray-400 italic bg-gray-50/70 border-gray-100/80'
                                }`}>
                                {project.description || 'Deskripsi proyek belum diisi.'}
                            </p>

                            {/* Tech Stack & Analyst Note Badge jika ada */}
                            {(project.techStack || project.devAnalystResult?.techStack) && (
                                <div className="mb-4 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs">
                                    <span className="font-bold text-emerald-900 block mb-0.5">Rekomendasi Tech Stack:</span>
                                    <span className="text-emerald-700 font-semibold">{project.techStack || project.devAnalystResult?.techStack}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3.5 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-50 text-[#00529C] shrink-0">
                                    <Calendar size={18} />
                                </div>
                                <div>
                                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">TENGGAT WAKTU PROYEK</span>
                                    {/* Tenggat apa adanya. Fallback sebelumnya menghitung
                                        "hari ini + 30 hari" lalu menampilkannya seperti tenggat
                                        resmi, padahal tidak ada tenggat yang pernah ditetapkan. */}
                                    <span className={`block text-sm font-bold ${projectDeadlineLabel ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                                        {projectDeadlineLabel || 'Belum ditetapkan'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-50 text-[#00529C] shrink-0">
                                    <User size={18} />
                                </div>
                                <div>
                                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">PROJECT MANAGER</span>
                                    <span className="block text-sm font-bold text-gray-800">
                                        {typeof project.pm === 'object' ? (project.pm?.name || 'Belum Dialokasi') : (project.pm || project.pmName || project.assignedPM || 'Belum Dialokasi')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation & Task Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-[500px]">
                    {/* Tabs */}
                    <div className="border-b border-gray-200 bg-gray-50/50 flex overflow-x-auto px-4">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'tasks'
                                ? 'border-[#00529C] text-[#00529C] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Manajemen Task
                        </button>
                        <button
                            onClick={() => setActiveTab('documents')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'documents'
                                ? 'border-[#00529C] text-[#00529C] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Dokumen
                        </button>
                        <button
                            onClick={() => setActiveTab('sit_uat')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'sit_uat'
                                ? 'border-emerald-600 text-emerald-700 bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <ShieldCheck size={15} />
                            SIT &amp; UAT Internal
                            {(project?.status === 'IN_DEVELOPMENT' || project?.status === 'SIT_PASSED' || project?.status === 'UAT_IN_PROGRESS') && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'activity'
                                ? 'border-[#00529C] text-[#00529C] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Log Aktivitas
                        </button>
                    </div>

                    {/* Task Management Content */}
                    {activeTab === 'tasks' && (
                        <>
                            {/* Toolbar */}
                            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            value={searchTask}
                                            onChange={(e) => setSearchTask(e.target.value)}
                                            placeholder="Cari task..."
                                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none transition-all"
                                        />
                                    </div>
                                    {/* Filter status. Tombolnya sebelumnya tidak memiliki `onClick`
                                        sama sekali, jadi terlihat dapat diklik namun tidak pernah
                                        menyaring apa pun. */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsStatusFilterOpen(prev => !prev)}
                                            className={`px-3 py-2 border rounded-lg text-sm transition-colors flex items-center gap-2 cursor-pointer ${statusFilter
                                                ? 'border-[#00529C] bg-blue-50 text-[#00529C] font-semibold'
                                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <Filter size={16} />
                                            <span className="hidden sm:inline">{statusFilter || 'Filter'}</span>
                                        </button>
                                        {isStatusFilterOpen && (
                                            <>
                                                <button
                                                    type="button"
                                                    aria-label="Tutup filter"
                                                    onClick={() => setIsStatusFilterOpen(false)}
                                                    className="fixed inset-0 z-10 cursor-default"
                                                />
                                                <div className="absolute left-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1.5">
                                                    <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status Task</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setStatusFilter(''); setIsStatusFilterOpen(false); }}
                                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer ${!statusFilter ? 'text-[#00529C] font-semibold' : 'text-gray-600'}`}
                                                    >
                                                        Semua Status
                                                    </button>
                                                    {TASK_STATUS_FILTERS.map(label => (
                                                        <button
                                                            key={label}
                                                            type="button"
                                                            onClick={() => { setStatusFilter(label); setIsStatusFilterOpen(false); }}
                                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between ${statusFilter === label ? 'text-[#00529C] font-semibold' : 'text-gray-600'}`}
                                                        >
                                                            <span>{label}</span>
                                                            {/* Hitungannya memakai predikat yang sama dengan tabelnya. */}
                                                            <span className="text-[10px] text-gray-400">
                                                                {tasks.filter(t => matchesTaskFilter(t, label)).length}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {!isViewerOnly && (
                                    <button onClick={() => setIsAddTaskModalOpen(true)} className="px-4 py-2 rounded-lg bg-[#00529C] text-white hover:bg-[#004080] transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm whitespace-nowrap">
                                        <Plus size={16} />
                                        Tambah Task
                                    </button>
                                )}
                            </div>

                            {/* Task Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[900px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                            <th className="py-3 px-4">Nama Task</th>
                                            <th className="py-3 px-4">Assignee</th>
                                            <th className="py-3 px-4">Deadline</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-center">Revisi</th>
                                            <th className="py-3 px-4 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {filteredTasks.map((task) => {
                                            const hasRevision = !!(task.revisionNote);
                                            const isExpanded = expandedTaskId === task.id;
                                            const logs = taskLogs[task.id] || [];
                                            const logsLoading = taskLogsLoading[task.id];
                                            const sitAttachments = getTaskSitAttachments(task.id);
                                            const sitApprovedAt = getTaskSitApprovedAt(task.id);
                                            const sitApproval = getTaskSitApproval(task.id);
                                            const sitOk = sitApproval?.approved === true;
                                            const sitComment = sitApproval?.comment || '';
                                            // Hasil UAT Internal (Tahap 2) untuk task ini.
                                            const uatInfo = getTaskUatInfo(task.id);
                                            const uatAttachments = uatInfo?.attachments || [];
                                            const uatVerificationAttachments = uatInfo?.verificationAttachments || [];
                                            const uatAccepted = uatInfo?.result === 'accepted';
                                            const uatRevision = uatInfo?.result === 'revision';
                                            // Change Request UAT yang menaungi task ini, bila ada.
                                            const uatChangeRequest = getTaskChangeRequest(task.id);
                                            // Putaran pengembalian yang melahirkan task ini, bila ada. Sengaja
                                            // dipisahkan dari `hasRevision`: keduanya penanda yang berbeda —
                                            // `revision_note` datang dari siklus Change Request UAT, sedangkan
                                            // penanda ini dari pengembalian jalur pengujian oleh Lead QA atau
                                            // Lead Keamanan Siber, dan hanya penanda ini yang menahan pengajuan
                                            // ulang jalurnya.
                                            const returnRoundTag = getTaskReturnRoundTag(task, project);
                                            return (
                                                <Fragment key={task.id}>
                                                <tr className="hover:bg-gray-50/70 transition-colors group">
                                                <td className="py-4 px-4 font-medium text-gray-800">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {task.name}
                                                        {hasRevision && (
                                                            <span title={`Revisi diminta oleh ${task.revisionRequestedBy || '-'} — ${task.revisionNote}`}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 border border-orange-200 text-orange-700 cursor-help">
                                                                <RotateCcw size={10} /> Revisi
                                                            </span>
                                                        )}
                                                        {/* Lencana penuh, bukan bergaris seperti lencana "Revisi" di
                                                            sebelahnya. Bobot yang jelas berbeda itu disengaja: dua
                                                            penanda ini berasal dari dua mekanisme berbeda dan tidak
                                                            boleh terbaca sebagai satu hal, sekalipun sebuah task dapat
                                                            memikul keduanya sekaligus. Warna penuhnya sama dengan
                                                            lencana putaran di halaman Putaran Pengembalian. */}
                                                        {returnRoundTag && (
                                                            <span title={returnRoundTag.title}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white cursor-help">
                                                                <Undo2 size={10} /> {returnRoundTag.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {hasRevision && (
                                                        <p className="text-[11px] text-orange-600 mt-1 bg-orange-50 border border-orange-100 rounded-lg px-2 py-1">
                                                            <span className="font-bold">{task.revisionRequestedBy || 'PM'}:</span> {task.revisionNote}
                                                        </p>
                                                    )}
                                                    {/*
                                                      * Ringkasan proses persetujuan per task: SIT lebih dulu,
                                                      * lalu UAT Internal. Sebelumnya hanya baris SIT yang tampil,
                                                      * sehingga status UAT satu task — diterima atau jenis
                                                      * revisinya — hanya bisa dilihat dengan membuka wizard
                                                      * SIT/UAT. Jumlah bukti kini diberi label sumbernya,
                                                      * sebab dua angka bersebelahan tanpa keterangan tidak
                                                      * membedakan bukti SIT dari bukti UAT.
                                                      */}
                                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                        {hasRevision ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 border border-orange-200 text-orange-700">
                                                                <RotateCcw size={10} /> Dalam Revisi
                                                            </span>
                                                        ) : (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sitOk ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                                                <CheckCircle size={10} /> SIT {sitOk ? 'Disetujui' : 'Belum di-OK'}
                                                            </span>
                                                        )}
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sitAttachments.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                                            <Paperclip size={10} /> {sitAttachments.length} Bukti SIT
                                                        </span>

                                                        {uatInfo ? (
                                                            <>
                                                                <span
                                                                    title={uatInfo.request || uatInfo.comment || undefined}
                                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${uatAccepted
                                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                                        : uatRevision
                                                                            ? 'bg-orange-50 border-orange-200 text-orange-700'
                                                                            : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                                                                >
                                                                    <ShieldCheck size={10} /> UAT {uatAccepted
                                                                        ? 'Diterima'
                                                                        : uatRevision
                                                                            ? `Revisi ${uatInfo.changeType === 'mayor' ? 'Mayor' : uatInfo.changeType === 'minor' ? 'Minor' : ''}`.trim()
                                                                            : 'Belum Diuji'}
                                                                </span>
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${uatAttachments.length > 0 ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                                                    <Paperclip size={10} /> {uatAttachments.length} Bukti UAT
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-gray-50 border-gray-200 text-gray-400">
                                                                <ShieldCheck size={10} /> {isUatRestartPending ? 'UAT Ulang Belum Dieksekusi' : 'UAT Belum Dijalankan'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    {task.assignee ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                                                {task.assignee.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                                            </div>
                                                            <span>{task.assignee}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-gray-400 italic">
                                                            <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-300 bg-gray-50">
                                                                <User size={12} />
                                                            </div>
                                                            <span>Unassigned</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-gray-500">
                                                    {/* Task tanpa `due_date` sebelumnya menampilkan
                                                        teks "Invalid Date" karena tanggalnya diformat
                                                        tanpa pemeriksaan lebih dulu. */}
                                                    {formatShortDate(task.deadline) || <span className="text-gray-300 italic">Tanpa deadline</span>}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(task.status)}`}>
                                                        {getStatusIcon(task.status)}
                                                        {task.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    {/*
                                                      * Kolom ini menjawab satu pertanyaan: apakah task ini
                                                      * masih menyimpan pekerjaan revisi. Tingkat perubahannya
                                                      * ikut disebut karena Minor dan Mayor menahan hal yang
                                                      * berbeda — Minor menahan persetujuan final UAT, Mayor
                                                      * menahan rilis sampai SIT ulang lulus.
                                                      */}
                                                    {hasRevision ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${uatChangeRequest?.type === 'mayor'
                                                                ? 'bg-red-100 text-red-700 border-red-200'
                                                                : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                                                <RotateCcw size={10} />
                                                                {uatChangeRequest?.type === 'mayor'
                                                                    ? 'Mayor'
                                                                    : uatChangeRequest?.type === 'minor'
                                                                        ? 'Minor'
                                                                        : 'Menunggu'}
                                                            </span>
                                                            {uatChangeRequest && (
                                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${getChangeRequestStatusLabel(uatChangeRequest.status).pillCls}`}>
                                                                    {getChangeRequestStatusLabel(uatChangeRequest.status).label}
                                                                </span>
                                                            )}
                                                            {!task.assignee && (
                                                                <span className="text-[9px] font-bold text-red-500">Belum ditugaskan</span>
                                                            )}
                                                        </div>
                                                    ) : uatChangeRequest && ['resolved', 'sit_verified'].includes(uatChangeRequest.status) ? (
                                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${getChangeRequestStatusLabel(uatChangeRequest.status).pillCls}`}>
                                                            {getChangeRequestStatusLabel(uatChangeRequest.status).label}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => toggleTaskLog(task.id)}
                                                            className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                                            title={isExpanded ? 'Tutup Komentar & Riwayat' : 'Buka Komentar & Riwayat'}
                                                        >
                                                            {isExpanded ? <ChevronRight size={18} /> : <MessageSquare size={18} />}
                                                        </button>
                                                        {!isViewerOnly && (
                                                            <>
                                                                <button 
                                                                    onClick={() => { setEditingTask(task); setIsEditTaskModalOpen(true); }}
                                                                    className="text-gray-400 hover:text-amber-500 p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                                                                    title="Edit Task"
                                                                >
                                                                    <Edit size={18} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteTask(task)}
                                                                    className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                                    title="Hapus Task"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-gray-50/50">
                                                    <td colSpan={6} className="py-4 px-6">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <MessageSquare size={15} className="text-[#00529C]" />
                                                                <h5 className="font-bold text-sm text-gray-800">Komentar & Riwayat — {task.name}</h5>
                                                            </div>
                                                            <button onClick={() => toggleTaskLog(task.id)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Tutup">
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                        {hasRevision && (
                                                            <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs">
                                                                <p className="font-bold text-orange-800 flex items-center gap-1.5">
                                                                    <RotateCcw size={13} /> Catatan Revisi Terakhir
                                                                </p>
                                                                <p className="text-orange-700 mt-1 leading-relaxed">{task.revisionNote}</p>
                                                                <p className="text-[10px] text-orange-500 mt-1">
                                                                    Oleh: {task.revisionRequestedBy || 'PM'} • {fmtShortDateTime(task.revisionRequestedAt)}
                                                                </p>
                                                                {/* Lampiran bukti yang menyertai permintaan revisi */}
                                                                {sitAttachments.length > 0 && (
                                                                    <div className="mt-2 pt-2 border-t border-orange-200">
                                                                        <p className="font-bold text-orange-800 flex items-center gap-1.5 mb-1.5">
                                                                            <Paperclip size={12} /> Bukti Permintaan Revisi ({sitAttachments.length})
                                                                        </p>
                                                                        <div className="space-y-1.5">
                                                                            {sitAttachments.map(doc => (
                                                                                <div key={doc.id} className="flex items-center gap-2 p-1.5 bg-white/70 rounded-lg border border-orange-200 hover:border-orange-400 transition-all group">
                                                                                    <div className="w-7 h-7 bg-orange-100 text-orange-600 rounded-md flex items-center justify-center font-bold text-[8px] shrink-0">
                                                                                        {doc.type || 'FILE'}
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className="text-[10px] font-semibold text-gray-700 truncate">{doc.originalName || doc.name}</p>
                                                                                        <p className="text-[9px] text-gray-400">{formatDocSizeLabel(doc)}</p>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                                                                        {doc.url && (
                                                                                            <>
                                                                                                <button onClick={() => viewSitAttachment(doc)} title="Lihat"
                                                                                                    className="p-1 text-gray-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
                                                                                                    <Eye size={12} />
                                                                                                </button>
                                                                                                <button onClick={() => downloadSitAttachment(doc)} title="Unduh"
                                                                                                    className="p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer">
                                                                                                    <Download size={12} />
                                                                                                </button>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* ── Bukti SIT & Persetujuan (dokumentasi uji) ── */}
                                                        <div className="mb-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Paperclip size={13} className="text-[#00529C]" />
                                                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Bukti SIT & Persetujuan</p>
                                                            </div>
                                                            <div className={`rounded-xl border p-3 text-xs ${sitOk ? 'bg-emerald-50/60 border-emerald-200' : 'bg-blue-50/60 border-blue-200'}`}>
                                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        {sitOk
                                                                            ? <CheckCircle size={15} className="text-emerald-600" />
                                                                            : <AlertCircle size={15} className="text-blue-500" />}
                                                                        <span className={`font-bold ${sitOk ? 'text-emerald-800' : 'text-blue-800'}`}>
                                                                            {sitOk ? 'Task Disetujui Lolos SIT' : (hasRevision ? 'Dalam Revisi' : 'Belum Disetujui di SIT')}
                                                                        </span>
                                                                    </div>
                                                                    {sitApprovedAt && (
                                                                        <span className="text-[10px] text-gray-500">
                                                                            Disetujui: {fmtShortDateTime(sitApprovedAt)} oleh {sitApproval?.approvedBy || 'PM'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {sitComment && (
                                                                    <p className="mt-2 text-gray-700 bg-white/70 rounded-lg p-2 border border-gray-100">
                                                                        <span className="font-bold text-gray-600">Komentar SIT:</span> {sitComment}
                                                                    </p>
                                                                )}
                                                                {hasRevision ? (
                                                                    // Sedang revisi: bukti ditampilkan di bagian Revisi di atas, bukan di sini.
                                                                    <p className="mt-2 text-gray-400 italic flex items-center gap-1.5">
                                                                        <RotateCcw size={12} /> Task sedang dalam revisi. Bukti & catatan revisi tampil pada bagian <strong>Revisi</strong> di atas. Bukti SIT akan tampil di sini setelah task disetujui.
                                                                    </p>
                                                                ) : sitAttachments.length === 0 ? (
                                                                    <p className="mt-2 text-gray-400 italic flex items-center gap-1.5">
                                                                        <Paperclip size={12} /> Belum ada bukti dilampirkan untuk task ini di SIT.
                                                                    </p>
                                                                ) : (
                                                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                                        {sitAttachments.map(doc => (
                                                                            <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 hover:border-blue-200 transition-all group">
                                                                                <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center font-bold text-[8px] shrink-0">
                                                                                    {doc.type || 'FILE'}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-[10px] font-semibold text-gray-700 truncate">{doc.originalName || doc.name}</p>
                                                                                    <p className="text-[9px] text-gray-400">{formatDocSizeLabel(doc)}</p>
                                                                                </div>
                                                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                                                                    {doc.url && (
                                                                                        <>
                                                                                            <button onClick={() => viewSitAttachment(doc)} title="Lihat"
                                                                                                className="p-1 text-gray-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
                                                                                                <Eye size={12} />
                                                                                            </button>
                                                                                            <button onClick={() => downloadSitAttachment(doc)} title="Unduh"
                                                                                                className="p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer">
                                                                                                <Download size={12} />
                                                                                            </button>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* ── Hasil UAT Internal & Bukti (Tahap 2 UAT) ── */}
                                                        {/*
                                                          * Bagian ini melengkapi blok SIT di atas. Sebelumnya detail
                                                          * task hanya memuat sisi SIT, sehingga hasil UAT Internal —
                                                          * diterima atau direvisi, jenis perubahannya, permintaan
                                                          * penguji, dan lampirannya — tidak pernah terlihat dari
                                                          * halaman manajemen task.
                                                          */}
                                                        <div className="mb-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <ShieldCheck size={13} className="text-violet-600" />
                                                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Hasil UAT Internal & Bukti</p>
                                                            </div>
                                                            {!uatInfo ? (
                                                                <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 text-xs text-gray-400 italic flex items-center gap-1.5">
                                                                    <ShieldCheck size={12} /> {isUatRestartPending
                                                                        ? 'Revisi mayor membuat UAT dijalankan ulang dari Tahap 1. Hasil UAT task ini akan tampil kembali setelah skenarionya dieksekusi pada putaran baru.'
                                                                        : 'Task ini belum diuji pada UAT Internal.'}
                                                                </div>
                                                            ) : (
                                                                <div className={`rounded-xl border p-3 text-xs ${uatAccepted ? 'bg-emerald-50/60 border-emerald-200' : uatRevision ? 'bg-orange-50/60 border-orange-200' : 'bg-gray-50/60 border-gray-200'}`}>
                                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                                        <div className="flex items-center gap-2">
                                                                            {uatAccepted
                                                                                ? <CheckCircle size={15} className="text-emerald-600" />
                                                                                : <AlertCircle size={15} className="text-orange-500" />}
                                                                            <span className={`font-bold ${uatAccepted ? 'text-emerald-800' : uatRevision ? 'text-orange-800' : 'text-gray-600'}`}>
                                                                                {uatAccepted
                                                                                    ? 'Diterima pada UAT Internal'
                                                                                    : uatRevision
                                                                                        ? `Diminta Revisi ${uatInfo.changeType === 'mayor' ? 'Mayor' : uatInfo.changeType === 'minor' ? 'Minor' : ''}`.trim()
                                                                                        : 'Belum Ada Hasil UAT'}
                                                                            </span>
                                                                            {uatInfo.source === 'additional_request' && (
                                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                                                                                    Permintaan Tambahan UAT
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {uatInfo.title && (
                                                                        <p className="mt-2 text-gray-600">
                                                                            <span className="font-bold text-gray-500">Skenario / Judul:</span> {uatInfo.title}
                                                                        </p>
                                                                    )}
                                                                    {uatInfo.request && (
                                                                        <p className="mt-2 text-gray-700 bg-white/70 rounded-lg p-2 border border-orange-100">
                                                                            <span className="font-bold text-orange-700">Permintaan Penguji:</span> {uatInfo.request}
                                                                        </p>
                                                                    )}
                                                                    {uatInfo.comment && (
                                                                        <p className="mt-2 text-gray-700 bg-white/70 rounded-lg p-2 border border-gray-100">
                                                                            <span className="font-bold text-gray-600">Catatan UAT:</span> {uatInfo.comment}
                                                                        </p>
                                                                    )}
                                                                    {uatAttachments.length === 0 ? (
                                                                        <p className="mt-2 text-gray-400 italic flex items-center gap-1.5">
                                                                            <Paperclip size={12} /> Belum ada bukti dilampirkan untuk task ini di UAT Internal.
                                                                        </p>
                                                                    ) : (
                                                                        <div className="mt-2">
                                                                            <p className="font-bold text-gray-600 flex items-center gap-1.5 mb-1.5">
                                                                                <Paperclip size={12} /> Bukti UAT ({uatAttachments.length})
                                                                            </p>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                                                {uatAttachments.map(doc => (
                                                                                    <div key={doc.docId || doc.id || doc.name} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 hover:border-violet-200 transition-all group">
                                                                                        <div className="w-7 h-7 bg-violet-100 text-violet-600 rounded-md flex items-center justify-center font-bold text-[8px] shrink-0">
                                                                                            {doc.type || 'FILE'}
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <p className="text-[10px] font-semibold text-gray-700 truncate">{doc.originalName || doc.name}</p>
                                                                                            <p className="text-[9px] text-gray-400">{formatDocSizeLabel(doc)}</p>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                                                                            <button onClick={() => viewSitAttachment(doc, 'uat')} title="Lihat"
                                                                                                className="p-1 text-gray-500 hover:text-violet-600 rounded hover:bg-violet-50 transition-colors cursor-pointer">
                                                                                                <Eye size={12} />
                                                                                            </button>
                                                                                            <button onClick={() => downloadSitAttachment(doc, 'uat')} title="Unduh"
                                                                                                className="p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer">
                                                                                                <Download size={12} />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {/*
                                                                      * Lampiran dari alur verifikasi terarah revisi Mayor yang
                                                                      * sudah dihapus. Tidak akan ada yang baru, tetapi berkas
                                                                      * yang sudah pernah diunggah tetap ditampilkan agar bukti
                                                                      * lama tidak hilang dari konteks task-nya.
                                                                      */}
                                                                    {uatVerificationAttachments.length > 0 && (
                                                                        <div className="mt-2 pt-2 border-t border-violet-200">
                                                                            <p className="font-bold text-violet-700 flex items-center gap-1.5 mb-1.5">
                                                                                <Paperclip size={12} /> Bukti Verifikasi Revisi ({uatVerificationAttachments.length}) — arsip alur lama
                                                                            </p>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                                                {uatVerificationAttachments.map(doc => (
                                                                                    <div key={doc.docId || doc.id || doc.name} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 hover:border-violet-200 transition-all group">
                                                                                        <div className="w-7 h-7 bg-violet-100 text-violet-600 rounded-md flex items-center justify-center font-bold text-[8px] shrink-0">
                                                                                            {doc.type || 'FILE'}
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <p className="text-[10px] font-semibold text-gray-700 truncate">{doc.originalName || doc.name}</p>
                                                                                            <p className="text-[9px] text-gray-400">{formatDocSizeLabel(doc)}</p>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                                                                            <button onClick={() => viewSitAttachment(doc, 'uat')} title="Lihat"
                                                                                                className="p-1 text-gray-500 hover:text-violet-600 rounded hover:bg-violet-50 transition-colors cursor-pointer">
                                                                                                <Eye size={12} />
                                                                                            </button>
                                                                                            <button onClick={() => downloadSitAttachment(doc, 'uat')} title="Unduh"
                                                                                                className="p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer">
                                                                                                <Download size={12} />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Riwayat Aktivitas Task</p>
                                                            {logsLoading && <span className="text-[10px] text-gray-400">Memuat...</span>}
                                                        </div>
                                                        {logsLoading ? (
                                                            <div className="py-6 text-center text-gray-400 text-xs">Memuat riwayat...</div>
                                                        ) : logs.length === 0 ? (
                                                            <div className="py-6 text-center text-gray-400 text-xs">
                                                                Belum ada aktivitas tercatat untuk task ini.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {logs.map(log => {
                                                                    const meta = getTaskActionMeta(log.action);
                                                                    return (
                                                                        <div key={log.id} className="flex items-start gap-3 p-2.5 bg-white rounded-xl border border-gray-100">
                                                                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold border ${meta.cls}`}>
                                                                                {meta.label}
                                                                            </span>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-[11px] text-gray-700 leading-relaxed">{log.description}</p>
                                                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                                                    {log.user || 'System'} • {fmtShortDateTime(log.timestamp)}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                            </Fragment>
                                            );
                                        })}
                                        {/* Tanpa baris ini, tabel yang kosong hanya menyisakan
                                            barisan header tanpa keterangan apa pun — tampak seperti
                                            gagal memuat, padahal bisa jadi memang belum ada task
                                            atau pencariannya tidak menemukan apa-apa. */}
                                        {filteredTasks.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center">
                                                    <FolderOpen size={28} className="mx-auto text-gray-300 mb-2" />
                                                    <p className="text-sm text-gray-500 font-semibold">
                                                        {tasks.length === 0 ? 'Belum ada task pada proyek ini.' : 'Tidak ada task yang cocok.'}
                                                    </p>
                                                    {tasks.length > 0 && (
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            Ubah kata pencarian atau hapus filter status.
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Ringkasan jumlah baris. Sebelumnya di sini juga ada dua tombol
                                panah halaman yang selalu `disabled` — tabel ini tidak memakai
                                paginasi, jadi kontrol itu dihapus daripada dibiarkan mati. */}
                            <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex justify-between items-center mt-auto">
                                <span className="text-sm text-gray-500">
                                    Menampilkan {filteredTasks.length} dari {tasks.length} task
                                </span>
                                {statusFilter && (
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('')}
                                        className="text-xs font-semibold text-[#00529C] hover:underline cursor-pointer"
                                    >
                                        Hapus filter &quot;{statusFilter}&quot;
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* ═══════════════════════════════════════════════════════════
                         SIT & UAT INTERNAL TAB — Multi-Step Wizard Component
                        ═══════════════════════════════════════════════════════════ */}
                    {activeTab === 'sit_uat' && (
                        <SITUATWizard
                            project={project}
                            updateProject={updateProject}
                            refreshProject={refreshDataSilent}
                            addNotification={addNotification}
                            navigate={navigate}
                            isViewer={isViewerOnly}
                            initialSitStep={searchParams.get('sitStep')}
                            initialUatStep={searchParams.get('uatStep')}
                        />
                    )}


                    {/* Dokumen Tab */}
                    {activeTab === 'documents' && (
                        <DocumentSection project={project} user={user} />
                    )}

                    {/* Activity Tab — Log Aktivitas Proyek (status_histories + activity_logs) */}
                    {activeTab === 'activity' && (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                        <Activity size={18} className="text-[#00529C]" />
                                        Log Aktivitas Proyek
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Riwayat lengkap dari awal pengajuan s/d sekarang (status &amp; task) — real-time.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {activityLoading && (
                                        <span className="text-[11px] text-gray-400">Menyinkronkan...</span>
                                    )}
                                    {activityItems.length > 0 && (
                                        <span className="text-xs bg-blue-50 text-[#00529C] px-2.5 py-1 rounded-full font-bold">
                                            {activityItems.length} Aktivitas
                                        </span>
                                    )}
                                </div>
                            </div>

                            {activityItems.length === 0 ? (
                                <div className="py-12 text-center text-gray-400">
                                    <Activity size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-sm font-medium text-gray-500">Belum ada aktivitas tercatat</p>
                                    <p className="text-xs mt-1">Log aktivitas akan terisi otomatis saat status proyek atau task berubah.</p>
                                </div>
                            ) : (
                                <div className="relative pl-6">
                                    {/* Garis vertikal timeline */}
                                    <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gray-200" />
                                    <div className="space-y-5">
                                        {activityItems.map((act) => {
                                            const isTask = act.kind === 'task';
                                            const fromLbl = statusLabel(act.fromStatus);
                                            const toLbl = statusLabel(act.toStatus);
                                            const timeStr = act.createdAt
                                                ? new Date(act.createdAt).toLocaleDateString('id-ID', {
                                                      day: 'numeric', month: 'short', year: 'numeric',
                                                      hour: '2-digit', minute: '2-digit',
                                                  })
                                                : '-';
                                            return (
                                                <div key={act.id} className="relative flex items-start gap-3">
                                                    <span className={`absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-2 bg-white flex items-center justify-center ${
                                                        isTask ? 'border-amber-400' : 'border-[#00529C]'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isTask ? 'bg-amber-400' : 'bg-[#00529C]'}`} />
                                                    </span>
                                                    <div className="flex-1 bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition-shadow">
                                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                                            <div className="flex items-center gap-2 flex-wrap text-sm">
                                                                {/* Status change: from → to */}
                                                                {act.kind === 'status' && fromLbl && (
                                                                    <>
                                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600">{fromLbl}</span>
                                                                        <span className="text-gray-400">→</span>
                                                                    </>
                                                                )}
                                                                {act.kind === 'status' && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#00529C]/10 text-[#00529C] border border-[#00529C]/20">
                                                                        {toLbl || act.toStatus}
                                                                    </span>
                                                                )}
                                                                {act.kind === 'task' && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                        {act.actionLabel}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] text-gray-400">{timeStr}</span>
                                                        </div>
                                                        <div className="mt-2 text-xs text-gray-600 flex items-center gap-1.5">
                                                            <User size={12} className="text-gray-400" />
                                                            <span className="font-semibold text-gray-700">{act.actorName}</span>
                                                        </div>
                                                        {/* Deskripsi (untuk task log) / notes (untuk status) */}
                                                        {act.kind === 'task' && act.description && (
                                                            <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">{act.description}</p>
                                                        )}
                                                        {act.kind === 'status' && act.notes && (
                                                            <p className="mt-1.5 text-xs text-gray-500 italic leading-relaxed bg-gray-50 rounded-lg p-2 border border-gray-100">
                                                                “{act.notes}”
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Chat Box Diskusi Proyek (Inline di Bagian Bawah) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-base">
                            <MessageSquare size={20} className="text-[#1a365d]" /> Diskusi Proyek: {project.name}
                        </h3>
                        <ChatBox projectId={project.id} projectName={project.name} className="max-h-[420px]" />
                    </div>
                </div>
            </div>

            {/* Modal Tambah Task */}
            {isAddTaskModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h3 className="text-lg font-semibold text-gray-800">Tambah Task Baru</h3>
                            <button
                                onClick={() => setIsAddTaskModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <form onSubmit={handleAddTask} className="space-y-4">
                                {/* Nama Task */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Nama Task <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newTask.title}
                                        onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                                        placeholder="Masukkan nama task..."
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
                                        required
                                    />
                                </div>

                                {/* Deskripsi */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Deskripsi
                                    </label>
                                    <textarea
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                                        placeholder="Masukkan deskripsi task..."
                                        rows={3}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none resize-none"
                                    />
                                </div>

                                {/* Assignee & Deadline */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Assignee
                                        </label>
                                        <select
                                            value={newTask.assignee}
                                            onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none bg-white"
                                        >
                                            <option value="">Pilih Anggota Tim...</option>
                                            {teamMembers.map((mem) => {
                                                const activeCount = tasks.filter(t => (t.assignee || '').toLowerCase().includes(mem.name.toLowerCase()) && t.status !== 'Selesai' && t.status !== 'done').length;
                                                return (
                                                    <option key={mem.id ?? mem.name} value={mem.id ?? mem.name}>
                                                        {mem.name} (Beban: {activeCount} Task Aktif)
                                                    </option>
                                                );
                                            })}
                                            {teamMembers.length === 0 && (
                                                <option value="" disabled>Belum ada tim teralokasi</option>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Deadline
                                        </label>
                                        <input
                                            type="date"
                                            value={newTask.deadline}
                                            onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Priority */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Prioritas
                                    </label>
                                    <div className="flex gap-3">
                                        {['High', 'Medium', 'Low'].map((p) => (
                                            <label key={p} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="priority"
                                                    value={p}
                                                    checked={newTask.priority === p}
                                                    onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                                                    className="w-4 h-4 text-[#00529C]"
                                                />
                                                <span className={`text-sm font-medium ${
                                                    p === 'High' ? 'text-red-600' : p === 'Medium' ? 'text-amber-600' : 'text-blue-600'
                                                }`}>
                                                    {p}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddTaskModalOpen(false)}
                                        disabled={isSubmittingTask}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingTask}
                                        className="px-4 py-2 bg-[#003a73] text-white rounded-lg font-medium hover:bg-[#002a5a] transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {isSubmittingTask ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                Menyimpan...
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={16} />
                                                Tambah Task
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Edit Task */}
            {isEditTaskModalOpen && editingTask && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#00529C] to-[#003a73]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                    <Edit size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Edit Task</h3>
                                    <p className="text-[11px] text-white/70">Perbarui detail, alokasi & status task</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-white ${getStatusBadge(editingTask.status)}`}>
                                    {getStatusIcon(editingTask.status)}
                                    {editingTask.status}
                                </span>
                                <button
                                    onClick={() => setIsEditTaskModalOpen(false)}
                                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(92vh-140px)]">
                            {/* ── Panel Revisi (jika task sedang direvisi) ── */}
                            {editingTask.revisionNote && (
                                <div className="mb-5 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
                                    <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                                        <RotateCcw size={16} className="text-orange-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-orange-800">Permintaan Revisi</p>
                                        <p className="text-xs text-orange-700 mt-1 leading-relaxed">{editingTask.revisionNote}</p>
                                        <p className="text-[10px] text-orange-500 mt-1">
                                            Oleh: {editingTask.revisionRequestedBy || 'PM'} • {fmtShortDateTime(editingTask.revisionRequestedAt)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleEditTask} className="space-y-5">
                                {/* ── 1. Informasi Task ── */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center">
                                            <FileText size={13} className="text-[#00529C]" />
                                        </div>
                                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Informasi Task</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                Nama Task <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={editingTask.name}
                                                onChange={(e) => setEditingTask({...editingTask, name: e.target.value})}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
                                                placeholder="Contoh: Implementasi Modul Approval"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                Deskripsi Task
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={editingTask.description || ''}
                                                onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none resize-none"
                                                placeholder="Jelaskan detail pekerjaan yang harus diselesaikan..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── 2. Detail Task ── */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center">
                                            <Calendar size={13} className="text-indigo-600" />
                                        </div>
                                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Detail Task</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                Prioritas
                                            </label>
                                            <select
                                                value={editingTask.priority || 'Medium'}
                                                onChange={(e) => setEditingTask({...editingTask, priority: e.target.value})}
                                                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none ${editingTask.priority === 'High' ? 'border-red-300 bg-red-50 text-red-700 font-semibold' : editingTask.priority === 'Low' ? 'border-gray-300 bg-gray-50 text-gray-500' : 'border-amber-300 bg-amber-50 text-amber-700 font-semibold'}`}
                                            >
                                                <option value="High">🔴 High</option>
                                                <option value="Medium">🟡 Medium</option>
                                                <option value="Low">🟢 Low</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                Deadline
                                            </label>
                                            <input
                                                type="date"
                                                value={editingTask.deadline || ''}
                                                onChange={(e) => setEditingTask({...editingTask, deadline: e.target.value})}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── 3. Alokasi & Status ── */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center">
                                            <User size={13} className="text-emerald-600" />
                                        </div>
                                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Alokasi & Status</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                Assignee
                                            </label>
                                            <select
                                                value={editingTask.assignee || ''}
                                                onChange={(e) => setEditingTask({...editingTask, assignee: e.target.value})}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none bg-white"
                                            >
                                                <option value="">Pilih Anggota Tim...</option>
                                                {teamMembers.map((mem) => {
                                                    const activeCount = tasks.filter(t => (t.assignee || '').toLowerCase().includes(mem.name.toLowerCase()) && t.status !== 'Selesai' && t.status !== 'done').length;
                                                    return (
                                                        <option key={mem.id ?? mem.name} value={mem.id ?? mem.name}>
                                                            {mem.name} (Beban: {activeCount} Task Aktif)
                                                        </option>
                                                    );
                                                })}
                                                {teamMembers.length === 0 && (
                                                    <option value="" disabled>Belum ada tim teralokasi</option>
                                                )}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                Status
                                            </label>
                                            <select
                                                value={editingTask.status}
                                                onChange={(e) => setEditingTask({...editingTask, status: e.target.value})}
                                                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none font-semibold ${getStatusSelectClass(editingTask.status)}`}
                                            >
                                                <option value="Belum Mulai">Belum Mulai</option>
                                                <option value="Sedang Dikerjakan">Sedang Dikerjakan</option>
                                                <option value="Hold">Hold</option>
                                                <option value="Selesai">Selesai</option>
                                                <option value="Take Down">Take Down</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
                                        <Info size={12} />
                                        Status <strong>Selesai</strong> akan menandai revisi selesai & task siap diverifikasi di SIT.
                                    </p>
                                </div>

                                {/* Footer */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditTaskModalOpen(false)}
                                        disabled={isSubmittingTask}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingTask}
                                        className="px-4 py-2 bg-[#00529C] text-white rounded-lg font-medium hover:bg-[#004080] transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                                    >
                                        {isSubmittingTask ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                Menyimpan...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={16} /> Simpan Perubahan
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EDIT PROYEK & ALOKASI PM */}
            {isEditProjectModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4">
                            <div className="flex items-center gap-2">
                                <User className="text-[#00529C]" size={20} />
                                <h3 className="text-lg font-bold text-gray-800">Edit Proyek & Alokasi PM</h3>
                            </div>
                            <button
                                onClick={() => setIsEditProjectModalOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveProjectEdit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Project Manager (PM) Penanggung Jawab *
                                </label>
                                <select
                                    value={editProjectForm.pmId}
                                    onChange={(e) => setEditProjectForm({...editProjectForm, pmId: e.target.value})}
                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#00529C] outline-none bg-white"
                                    disabled={isPmCandidatesLoading || pmCandidates.length === 0}
                                >
                                    <option value="">
                                        {isPmCandidatesLoading
                                            ? 'Memuat daftar Project Manager...'
                                            : pmCandidates.length === 0
                                                ? 'Tidak ada akun Project Manager tersedia'
                                                : '-- Pilih Project Manager --'}
                                    </option>
                                    {pmCandidates.map(candidate => {
                                        const activeCount = pmActiveProjectCount.get(Number(candidate.id)) || 0;

                                        return (
                                            <option key={candidate.id} value={String(candidate.id)}>
                                                {candidate.name}{candidate.division ? ` — ${candidate.division}` : ''} (Beban: {activeCount} Proyek Aktif)
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Estimasi Durasi Pengerjaan (Hari Kerja) *
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        value={editProjectForm.estimation}
                                        onChange={(e) => setEditProjectForm({...editProjectForm, estimation: e.target.value})}
                                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#00529C] outline-none"
                                    />
                                    <span className="absolute right-3.5 top-2.5 text-xs text-gray-400 font-bold">Hari</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Deskripsi & Latar Belakang Proyek
                                </label>
                                <textarea
                                    rows={3}
                                    value={editProjectForm.description}
                                    onChange={(e) => setEditProjectForm({...editProjectForm, description: e.target.value})}
                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#00529C] outline-none"
                                    placeholder="Masukkan deskripsi ringkas proyek..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditProjectModalOpen(false)}
                                    disabled={isSavingProjectEdit}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingProjectEdit}
                                    className="px-5 py-2 bg-[#00529C] text-white rounded-xl font-bold text-xs hover:bg-[#004080] transition-colors shadow-md shadow-[#00529C]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSavingProjectEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Pratinjau Bukti SIT */}
            {sitPreviewDoc && (
                <DocumentViewerModal
                    doc={{
                        name: sitPreviewDoc.name || 'Bukti SIT',
                        url: sitPreviewDoc.url,
                        type: sitPreviewDoc.type || 'FILE',
                        size: sitPreviewDoc.size,
                        author: 'Tim SIT',
                    }}
                    project={project}
                    onClose={() => {
                        if (sitPreviewDoc.url?.startsWith('blob:')) URL.revokeObjectURL(sitPreviewDoc.url);
                        setSitPreviewDoc(null);
                    }}
                />
            )}
        </div>
    );
}

/**
 * Komponen Dokumen Tab — pakai data dokumen yang sudah di-embed di project (instant),
 * dengan fallback fetch API setelah upload untuk memastikan daftar terbaru.
 */
function DocumentSection({ project, user }) {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [previewDoc, setPreviewDoc] = useState(null);
    const fileInputRef = useRef(null);

    // Tab dokumen di halaman ini tidak menyediakan pemilih jenis dokumen, sehingga
    // unggahan dari sini selalu diberi jenis BRD. Sebelumnya nilai ini disimpan di
    // state dengan setter yang tidak pernah dipanggil, yang menyiratkan ada pemilih.
    const selectedDocType = 'BRD';

    // Sumber utama: project.documents (sudah di-embed backend) — instant, tanpa request tambahan.
    // Daftar dokumen dihitung langsung dari data proyek — tidak lagi disalin ke state
    // oleh effect. Hasil pengambilan ulang setelah unggah dipakai sebagai penimpa
    // sementara, dan penimpa itu dibuang begitu data dokumen proyek ikut diperbarui.
    const projectDocs = useMemo(() => visibleDocs(project?.documents), [project?.documents]);
    const [refreshedDocs, setRefreshedDocs] = useState(null);
    const [syncedDocuments, setSyncedDocuments] = useState(project?.documents);
    if (project?.documents !== syncedDocuments) {
        setSyncedDocuments(project?.documents);
        setRefreshedDocs(null);
    }
    const docs = refreshedDocs ?? projectDocs;

    // Refresh dari API (dipakai setelah upload agar daftar selalu terbaru)
    const fetchDocs = async () => {
        if (!project?.id) return;
        setLoading(true);
        try {
            const res = await documentService.getAll(project.id);
            if (res && res.data) {
                setRefreshedDocs(visibleDocs(res.data));
            }
        } catch {
            // Abaikan error — data embedded tetap tersedia
        } finally {
            setLoading(false);
        }
    };

    // Handle file upload
    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_DOC_EXTS.includes(ext)) {
            toast.error('Format yang diizinkan: PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), ZIP!');
            return;
        }
        if (file.size > MAX_DOC_SIZE_MB * 1024 * 1024) {
            toast.error(`Ukuran file melebihi batas ${MAX_DOC_SIZE_MB}MB!`);
            return;
        }

        setUploading(true);
        try {
            const finalName = generateDocumentName(project.req_id || project.reqId || `REQ-${project.id}`, selectedDocType, project.title || project.name || 'Proyek');
            const ext = file.name.split('.').pop();
            const renamedFile = new File([file], `${finalName}.${ext}`, { type: file.type });

            await documentService.upload(renamedFile, {
                project_id: project.id,
                document_type: selectedDocType,
                original_filename: file.name,
            });

            toast.success('Dokumen berhasil diunggah!');
            await fetchDocs(); // Refresh list
        } catch (err) {
            toast.error(`Gagal upload: ${err.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Handle View / Preview
    const handleView = async (doc) => {
        try {
            toast.loading('Memuat pratinjau...', { id: 'preview-load' });
            const blob = await documentService.download(doc.id);
            const url = URL.createObjectURL(blob);
            setPreviewDoc({
                ...doc,
                previewBlobUrl: url,
            });
            toast.dismiss('preview-load');
        } catch {
            toast.error('Gagal memuat pratinjau dokumen.', { id: 'preview-load' });
        }
    };

    // Handle download
    const handleDownload = async (doc) => {
        try {
            const blob = await documentService.download(doc.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.file_name || doc.original_filename || 'Dokumen';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Mengunduh dokumen...');
        } catch {
            toast.error('Gagal mengunduh dokumen.');
        }
    };

    // File extension icon helper
    const getExtColor = (filename) => {
        const fn = (filename || '').toLowerCase();
        if (fn.endsWith('.pdf')) return 'bg-red-50 text-red-500 border-red-200';
        if (fn.endsWith('.xlsx') || fn.endsWith('.xls')) return 'bg-green-50 text-green-600 border-green-200';
        if (fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.png')) return 'bg-yellow-50 text-yellow-600 border-yellow-200';
        if (fn.endsWith('.zip')) return 'bg-purple-50 text-purple-600 border-purple-200';
        return 'bg-gray-50 text-gray-500 border-gray-200';
    };

    const getExtLabel = (filename) => {
        const ext = (filename || '').split('.').pop()?.toUpperCase() || 'FILE';
        return ext.substring(0, 4);
    };

    const isPrivileged = ['super_admin', 'head_of_it', 'lead_group', 'project_manager', 'development_lead'].includes(user?.role);

    // Filter docs by search
    const filteredDocs = useMemo(() => {
        if (!searchQuery.trim()) return docs;
        const q = searchQuery.toLowerCase();
        return docs.filter(d =>
            (d.original_filename || d.file_name || d.name || '').toLowerCase().includes(q) ||
            (d.document_type || '').toLowerCase().replace(/_/g, ' ').includes(q) ||
            (d.uploader?.name || '').toLowerCase().includes(q)
        );
    }, [docs, searchQuery]);

    return (
        <div className="p-6">
            {/* Header + Search + Upload */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-800">Dokumen Proyek</h3>
                    <div className="relative mt-2 max-w-sm">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari nama, tipe, atau uploader..."
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] outline-none transition-all"
                        />
                    </div>
                </div>
                {isPrivileged && (
                    <div className="flex items-center gap-2 shrink-0">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                            onChange={handleUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="px-4 py-2 bg-[#00529C] text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm hover:bg-[#004080] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {uploading ? (
                                <><Clock size={16} className="animate-spin" /> Mengunggah...</>
                            ) : (
                                <><Upload size={16} /> Unggah Dokumen</>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Document List */}
            {loading ? (
                <div className="py-12 text-center text-gray-400">
                    <Clock size={32} className="mx-auto animate-spin mb-3" />
                    <p className="text-sm">Memuat dokumen...</p>
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                    <FolderOpen size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium">{searchQuery ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}</p>
                    <p className="text-xs mt-1">{searchQuery ? 'Coba kata kunci lain' : 'Unggah dokumen pertama untuk proyek ini.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocs.map((doc) => (
                        <div key={doc.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-[#00529C] hover:shadow-md transition-all cursor-pointer group bg-white">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] border ${getExtColor(doc.file_name || doc.name)}`}>
                                {getExtLabel(doc.file_name || doc.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-[#00529C] transition-colors" title={doc.file_name || doc.original_filename || doc.name}>
                                    {doc.file_name || doc.original_filename || doc.name || 'Dokumen'}
                                </p>
                                {doc.original_filename && doc.original_filename !== doc.file_name && (
                                    <p className="text-[10px] text-gray-400 truncate" title={doc.original_filename}>
                                        File asli: {doc.original_filename}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    <span>{formatFileSize(doc.file_size)}</span>
                                    <span>•</span>
                                    <span>{doc.document_type?.replace(/_/g, ' ')}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                    <User size={10} /> {doc.author || doc.uploader?.name || 'Unknown'}
                                    <span className="mx-1">•</span>
                                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                </p>
                            </div>
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleView(doc); }}
                                    className="text-gray-400 hover:text-[#00529C] p-1.5 rounded hover:bg-blue-50 cursor-pointer"
                                    title="Lihat Dokumen"
                                >
                                    <Eye size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                                    className="text-gray-400 hover:text-[#00529C] p-1.5 rounded hover:bg-blue-50 cursor-pointer"
                                    title="Unduh"
                                >
                                    <Download size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Pratinjau Dokumen */}
            {previewDoc && (
                <DocumentViewerModal
                    doc={{
                        name: previewDoc.original_filename || previewDoc.file_name || 'Dokumen',
                        url: previewDoc.previewBlobUrl || `/api/v1/documents/${previewDoc.id}/download`,
                        type: previewDoc.document_type || 'Dokumen',
                        size: formatFileSize(previewDoc.file_size),
                        author: previewDoc.uploader?.name || 'Unknown',
                        created_at: previewDoc.created_at,
                    }}
                    project={project}
                    onClose={() => {
                        if (previewDoc.previewBlobUrl) URL.revokeObjectURL(previewDoc.previewBlobUrl);
                        setPreviewDoc(null);
                    }}
                />
            )}
        </div>
    );
}
