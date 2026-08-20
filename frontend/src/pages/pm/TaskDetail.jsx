import { getParallelTestingBadge, PROJECT_STATUS_LABEL } from '../../constants/projectStatus';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import {
    generateDocumentName,
    DOCUMENT_TYPES,
    getDocumentTypeInfo,
    formatFileSize,
} from '../../utils/documentNaming';
import { documentService, taskService, activityLogService, projectService } from '../../services/api';
import ChatBox from '../../components/ChatBox';
import SITUATDocumentModal from '../../components/SITUATDocumentModal';
import SITUATWizard from '../../components/SITUATWizard';
import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects, getFileFromStore } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Filter,
    Plus,
    MoreVertical,
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
    BarChart,
    Settings,
    Eye,
    Briefcase,
    Users,
    Target,
    MessageSquare,
    Paperclip,
    Link,
    Trash2,
    X,
    ShieldCheck,
    Server,
    CheckSquare,
    Download,
    Upload,
    Lock,
    Send,
    FileCheck,
    RotateCcw,
} from 'lucide-react';

export default function TaskDetail() {
    const { user } = useAuth();
    const { projects, updateProject, refreshDataSilent } = useProjects();
    const { id: projectId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const openedFromUatApprovals = searchParams.get('from') === 'uat-approvals';

    // Mode VIEWER: developer & analyst hanya bisa melihat (read-only).
    // Kecuali developer tetap bisa update status task miliknya sendiri (di My Tasks).
    const isViewerOnly = ['developer', 'analyst', 'head_of_it', 'lead_group'].includes(user?.role);
    const isDeveloperAssignee = user?.role === 'developer';

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
                division: typeof ctxFound.division === 'object' ? (ctxFound.division?.name || 'Divisi TI') : (ctxFound.division || 'Divisi TI'),
                status: ctxFound.status || 'IN_DEVELOPMENT',
                progress: ctxFound.progress || 60,
                tasks: Array.isArray(ctxFound.tasks) ? ctxFound.tasks : []
            };
        }

        // 2. Fallback default project
        return (projects && projects[0]) || null;
    }, [projectId, projects]);

    // ── Data SIT/UAT: ambil selalu segar dari API saat project berubah,
    //    agar bukti revisi dari tab SIT selalu tampil di Manajemen Task. ──
    const [sitUatData, setSitUatData] = useState(null);
    useEffect(() => {
        let cancelled = false;
        if (!project?.id) return undefined;
        // Selalu ambil dari context (auto-refresh 30s) agar tidak pernah kosong/stale
        const ctxData = project?.sitUatData || project?.sit_uat_data || null;
        if (ctxData) {
            setSitUatData(ctxData);
        }
        const fetchSitData = () => projectService.getById(project.id)
            .then(res => {
                if (cancelled) return;
                const raw = res?.data || res;
                const sd = raw?.sitUatData || raw?.sit_uat_data || null;
                if (sd) setSitUatData(sd);
            })
            .catch(() => {});
        fetchSitData();
        // Polling ringan agar data SIT/UAT sinkron — cukup jarang & hanya saat tab aktif
        const sitPollTimer = setInterval(() => {
            if (document.visibilityState === 'visible') fetchSitData();
        }, 20000);
        return () => {
            cancelled = true;
            clearInterval(sitPollTimer);
        };
    }, [project?.id, project?.sitUatData, project?.sit_uat_data]);


    // Daftar anggota tim proyek yang sah menjadi assignee task.
    // HANYA developer yang sudah dialokasikan ke proyek ini (ditambah PM/Analyst proyek).
    // Tidak ada fallback hardcode — task wajib diserahkan ke orang yang terlibat di proyek.
    const teamMembers = useMemo(() => {
        const rawTeam = Array.isArray(project?.team) ? project.team : [];
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
        if (project?.pm) addPerson(project.pm, 'Project Manager');
        if (project?.analyst) addPerson(project.analyst, 'System Analyst');

        return members;
    }, [project?.team, project?.pm, project?.analyst]);

    const [activeTab, setActiveTab] = useState(() => (
        searchParams.get('tab') === 'sit_uat' ? 'sit_uat' : 'tasks'
    )); // tasks, sit_uat, documents, activity
    const { addNotification } = useNotifications();

    // ─── SIT & UAT Internal State & Helpers ──────────────────────────────────
    const fmtName = (val, fb = 'Tim TI') => {
        if (!val) return fb;
        if (typeof val === 'object') return val.name || val.label || fb;
        return String(val);
    };
    const [sitUatState, setSitUatState] = useState({
        stagingUrl: project?.stagingUrl || '',
        sitCoverage: project?.sitCoverage || '',
        sitNotes: project?.sitNotes || '',
        uatScenarios: project?.uatScenarios || '',
        uatNotes: project?.uatNotes || '',
        sitUatFiles: project?.sitUatFiles || [],
    });
    const [sitUatSubmitting, setSitUatSubmitting] = useState(false);
    const [sitUatDocOpen, setSitUatDocOpen] = useState(false);
    const sitFileInputRef = useRef(null);

    const handleSITUATFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const newDocs = files.map(file => {
            const url = URL.createObjectURL(file);
            return {
                id: `situatdoc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                name: file.name,
                size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                type: file.name.split('.').pop().toUpperCase(),
                url,
                uploadedAt: new Date().toISOString(),
                category: 'BAST_SIT_UAT',
            };
        });
        setSitUatState(prev => ({ ...prev, sitUatFiles: [...prev.sitUatFiles, ...newDocs] }));
        toast.success(`${files.length} berkas bukti SIT & UAT berhasil dilampirkan.`);
    };

    const handleSaveSITUAT = (targetStatus) => {
        setSitUatSubmitting(true);
        updateProject(project.id, { status: targetStatus, sitPassedAt: new Date().toISOString(), sitPassedBy: fmtName(user?.name, 'Tim TI'), ...sitUatState });
        if (addNotification) {
            addNotification(
                targetStatus === 'DEV_COMPLETED' ? 'BAST Dev Diterbitkan' : 'SIT Diverifikasi',
                targetStatus === 'DEV_COMPLETED' ? `Proyek ${project.name} LULUS SIT & UAT. Siap QA & Siber.` : `Proyek ${project.name} Lulus SIT. Lanjut ke UAT Internal.`,
                'success', '/pm/workspace'
            );
        }
        toast.success(targetStatus === 'DEV_COMPLETED' ? `BAST Diterbitkan! Proyek "${project.name}" resmi DEV_COMPLETED.` : `SIT Lulus! Proyek "${project.name}" siap UAT Internal.`);
        setSitUatSubmitting(false);
    };
    // ─────────────────────────────────────────────────────────────────────────

    const [searchTask, setSearchTask] = useState('');
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
    useEffect(() => {
        const ctxTasks = Array.isArray(project?.tasks) ? project.tasks : [];
        if (ctxTasks.length === 0) return;
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

    // ── Bukti SIT per task (dari sitUatData.sit2_task_approvals) ────────────
    // Normalisasi: backend kadang mengembalikan object {taskId: approval} ATAU
    // array [approval, ...] (akibat PHP integer-key). Di sini di-map ke object
    // keyed by task id menggunakan urutan project.tasks.
    const getTaskApprovalMap = useMemo(() => {
        const ctxSit = project?.sitUatData || project?.sit_uat_data || null;
        const sitUat = (ctxSit && Object.keys(ctxSit).length > 0 ? ctxSit : sitUatData) || ctxSit || sitUatData || {};
        const raw = sitUat?.sit2_task_approvals || {};
        const taskIds = Array.isArray(project?.tasks) ? project.tasks.map(t => t.id) : [];
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
    }, [project?.tasks, project?.sitUatData, project?.sit_uat_data, sitUatData]);

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

    // Download bukti SIT dengan auth header (hindari 401 / Route [login] not defined).
    const downloadSitAttachment = async (doc) => {
        try {
            if (doc?.docId) {
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = doc.originalName || doc.name || 'bukti-sit';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else if (doc?.url?.startsWith('blob:')) {
                const a = document.createElement('a');
                a.href = doc.url;
                a.download = doc.originalName || doc.name || 'bukti-sit';
                a.click();
            } else {
                toast.info('Berkas belum tersedia untuk diunduh.');
            }
        } catch (err) {
            toast.error(`Gagal mengunduh bukti: ${err.message}`);
        }
    };

    // Buka pratinjau bukti SIT dengan auth header — tampilkan dalam modal in-app.
    const [sitPreviewDoc, setSitPreviewDoc] = useState(null);
    const viewSitAttachment = async (doc) => {
        try {
            if (doc?.docId) {
                const loadingId = toast.loading('Membuka berkas...');
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                toast.dismiss(loadingId);
                setSitPreviewDoc({
                    id: doc.docId,
                    name: doc.originalName || doc.name || 'Bukti SIT',
                    original_filename: doc.originalName || doc.name,
                    url,
                    type: (doc.type || 'FILE'),
                    document_type: 'SIT_TASK_EVIDENCE',
                });
            } else if (doc?.url?.startsWith('blob:')) {
                setSitPreviewDoc({
                    id: doc.docId || null,
                    name: doc.originalName || doc.name || 'Bukti SIT',
                    original_filename: doc.originalName || doc.name,
                    url: doc.url,
                    type: (doc.type || 'FILE'),
                    document_type: 'SIT_TASK_EVIDENCE',
                });
            } else {
                toast.info('Berkas belum tersedia untuk dilihat.');
            }
        } catch (err) {
            toast.error(`Gagal membuka bukti: ${err.message}`);
        }
    };
    
    // Modal Edit Proyek & Alokasi PM
    const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
    const [editProjectForm, setEditProjectForm] = useState({
        pmName: '',
        description: '',
        estimation: '30',
    });

    const handleOpenEditProjectModal = () => {
        const rawPM = typeof project?.pm === 'object'
            ? (project.pm?.name || '')
            : String(project?.pm || project?.pmName || project?.assignedPM || '');

        let resolvedPM = '';
        if (rawPM && rawPM !== 'Belum Dialokasi') {
            const pms = ['Budi Santoso', 'Dewi Lestari', 'Andi Wijaya', 'Citra Kirana'];
            const foundPM = pms.find(name => rawPM.toLowerCase().includes(name.toLowerCase()));
            resolvedPM = foundPM || rawPM;
        }

        setEditProjectForm({
            pmName: resolvedPM,
            description: project?.description || '',
            estimation: project?.estimation ? String(project.estimation).replace(/[^0-9]/g, '') || '30' : '30',
        });
        setIsEditProjectModalOpen(true);
    };

    const handleSaveProjectEdit = (e) => {
        e.preventDefault();
        if (!editProjectForm.pmName) {
            toast.error('Pilih Project Manager penanggung jawab!');
            return;
        }

        const days = parseInt(editProjectForm.estimation || '30', 10) || 30;
        const calcDeadline = new Date();
        calcDeadline.setDate(calcDeadline.getDate() + days);
        const deadlineIso = calcDeadline.toISOString().split('T')[0];

        updateProject(project.id, {
            pm: { name: editProjectForm.pmName, initial: editProjectForm.pmName.split(' ').map(n=>n[0]).join('').slice(0, 2) },
            pmName: editProjectForm.pmName,
            assignedPM: editProjectForm.pmName,
            description: editProjectForm.description,
            estimation: `${days} Hari Kerja`,
            deadline: deadlineIso,
            targetDate: deadlineIso,
            rbbDeadline: deadlineIso,
        });

        toast.success('Informasi proyek & alokasi PM berhasil diperbarui!');
        setIsEditProjectModalOpen(false);
    };

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

    const filteredTasks = tasks.filter((task) =>
        task.name.toLowerCase().includes(searchTask.toLowerCase())
    );

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
        if (!project?.id) return;
        setActivityLoading(true);
        try {
            const res = await activityLogService.getByProject(project.id, 200);
            const logs = Array.isArray(res?.data) ? res.data : [];
            setTaskActivityLogs(logs);
        } catch {
            // Abaikan error — status_histories tetap tampil
        } finally {
            setActivityLoading(false);
        }
    }, [project?.id]);

    // Load saat project berubah & polling real-time (~15s) agar kegiatan baru langsung tercatat
    useEffect(() => {
        fetchTaskActivityLogs();
        const interval = setInterval(fetchTaskActivityLogs, 15000);
        return () => clearInterval(interval);
    }, [fetchTaskActivityLogs]);

    // Gabungkan status_histories + activity_logs, urutkan berdasarkan waktu terbaru
    const activityItems = useMemo(() => {
        const items = [];

        // 1) Riwayat transisi status proyek
        const histories = Array.isArray(project?.status_histories) ? project.status_histories : [];
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
    }, [project?.status_histories, taskActivityLogs]);

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
                    onClick={() => navigate(openedFromUatApprovals ? '/approvals/uat' : (isViewerOnly ? '/projects' : '/pm/tasks'))}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#00529C] transition-colors text-sm mb-2"
                >
                    <ChevronLeft size={18} />
                    {openedFromUatApprovals ? 'Kembali ke Persetujuan UAT Saya' : 'Kembali ke Daftar Proyek'}
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
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${project.priorityColor}`}>

                                <AlertCircle size={14} />
                                {project.priority}
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
                                {project.estimation && (
                                    <span className="text-xs px-2.5 py-1 bg-blue-50 text-[#00529C] border border-blue-200 rounded-full font-extrabold shadow-2xs">
                                        {String(project.estimation).includes('Hari') ? project.estimation : `${project.estimation} Hari Kerja`}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed bg-gray-50/70 p-3.5 rounded-xl border border-gray-100/80">
                                {project.description || "Proyek ini difokuskan pada peningkatan kualitas, penambahan fitur strategis, serta memastikan sistem berjalan sesuai dengan standar keamanan dan performa Bank Nagari."}
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
                                    <span className="block text-sm font-bold text-gray-800">
                                        {project.deadline && !isNaN(new Date(project.deadline).getTime()) ? (
                                            new Date(project.deadline).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                            })
                                        ) : (
                                            (() => {
                                                const d = new Date();
                                                d.setDate(d.getDate() + 30);
                                                return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                                            })()
                                        )}
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
                                    <button className="px-3 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2">
                                        <Filter size={16} />
                                        <span className="hidden sm:inline">Filter</span>
                                    </button>
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
                                            return (
                                                <Fragment key={task.id}>
                                                <tr className="hover:bg-gray-50/70 transition-colors group">
                                                <td className="py-4 px-4 font-medium text-gray-800">
                                                    <div className="flex items-center gap-2">
                                                        {task.name}
                                                        {hasRevision && (
                                                            <span title={`Revisi diminta oleh ${task.revisionRequestedBy || '-'} — ${task.revisionNote}`}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 border border-orange-200 text-orange-700 cursor-help">
                                                                <RotateCcw size={10} /> Revisi
                                                            </span>
                                                        )}
                                                    </div>
                                                    {hasRevision && (
                                                        <p className="text-[11px] text-orange-600 mt-1 bg-orange-50 border border-orange-100 rounded-lg px-2 py-1">
                                                            <span className="font-bold">{task.revisionRequestedBy || 'PM'}:</span> {task.revisionNote}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                        {hasRevision ? (
                                                            <>
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 border border-orange-200 text-orange-700">
                                                                    <RotateCcw size={10} /> Dalam Revisi
                                                                </span>
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sitAttachments.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                                                    <Paperclip size={10} /> {sitAttachments.length} Bukti
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sitOk ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                                                    <CheckCircle size={10} /> SIT {sitOk ? 'Disetujui' : 'Belum di-OK'}
                                                                </span>
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sitAttachments.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                                                    <Paperclip size={10} /> {sitAttachments.length} Bukti
                                                                </span>
                                                            </>
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
                                                    {new Date(task.deadline).toLocaleDateString('id-ID', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    })}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(task.status)}`}>
                                                        {getStatusIcon(task.status)}
                                                        {task.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    {hasRevision ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                                            <RotateCcw size={10} /> Menunggu
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
                                                                                        <p className="text-[9px] text-gray-400">{doc.size}</p>
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
                                                                                    <p className="text-[9px] text-gray-400">{doc.size}</p>
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
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex justify-between items-center mt-auto">
                                <span className="text-sm text-gray-500">
                                    Menampilkan {filteredTasks.length} task
                                </span>
                                <div className="flex gap-1">
                                    <button className="p-1 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-50" disabled>
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button className="p-1 rounded text-gray-400 hover:bg-gray-200 disabled:opacity-50" disabled>
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
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
                                    value={editProjectForm.pmName}
                                    onChange={(e) => setEditProjectForm({...editProjectForm, pmName: e.target.value})}
                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#00529C] outline-none bg-white"
                                >
                                    <option value="">-- Pilih Project Manager --</option>
                                    {[
                                        'Budi Santoso',
                                        'Dewi Lestari',
                                        'Andi Wijaya',
                                        'Citra Kirana',
                                    ].map(name => {
                                        const activeCount = (projects || []).filter(p => {
                                            const pmNameStr = typeof p.pm === 'object' ? (p.pm?.name || '') : String(p.pmName || p.pm || p.assignedPM || '');
                                            return pmNameStr.toLowerCase().includes(name.toLowerCase()) && p.status !== 'LIVE_PRODUCTION' && p.status !== 'COMPLETED';
                                        }).length;
                                        return (
                                            <option key={name} value={name}>
                                                {name} (Beban: {activeCount} Proyek Aktif)
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
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-[#00529C] text-white rounded-xl font-bold text-xs hover:bg-[#004080] transition-colors shadow-md shadow-[#00529C]/20 cursor-pointer"
                                >
                                    Simpan Perubahan
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
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState('BRD');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewDoc, setPreviewDoc] = useState(null);
    const fileInputRef = useRef(null);

    const ALLOWED_EXTS = ['.pdf', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.zip'];
    const MAX_SIZE_MB = 5;

    // Sumber utama: project.documents (sudah di-embed backend) — instant, tanpa request tambahan.
    // Dokumen SIT/UAT (bukti task, hasil review, berita acara, dsb.) disembunyikan
    // dari daftar umum — tampil di panel per-task / wizard SIT-UAT.
    const HIDDEN_DOC_TYPES = ['SIT_TASK_EVIDENCE', 'SIT_SIGNOFF', 'UAT_PREP', 'UAT_EXEC', 'UAT_APPROVAL'];
    const visibleDocs = (list) => Array.isArray(list)
        ? list.filter(d => !HIDDEN_DOC_TYPES.includes((d.document_type || d.type || '').toUpperCase()))
        : [];

    useEffect(() => {
        setDocs(visibleDocs(project?.documents));
    }, [project?.id, project?.documents]);

    // Refresh dari API (dipakai setelah upload agar daftar selalu terbaru)
    const fetchDocs = async () => {
        if (!project?.id) return;
        setLoading(true);
        try {
            const res = await documentService.getAll(project.id);
            if (res && res.data) {
                setDocs(visibleDocs(res.data));
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
        if (!ALLOWED_EXTS.includes(ext)) {
            toast.error('Format yang diizinkan: PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), ZIP!');
            return;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(`Ukuran file melebihi batas ${MAX_SIZE_MB}MB!`);
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
