import { useMemo, useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import { taskService, qaRequestService, cyberRequestService } from '../../services/api';
import {
    CYBER_CHECK_TYPE,
    CYBER_CHECK_TYPE_OPTIONS,
    getCyberCheckTypeOption,
    requiresSourceCodeRef,
    requiresTargetUrl,
} from '../../constants/cyberCheckType';
import {
    Undo2,
    Inbox,
    Building,
    Calendar,
    User,
    Bug,
    Shield,
    ShieldAlert,
    Clock,
    MessageSquareWarning,
    ListChecks,
    Plus,
    Send,
    CheckCircle2,
    AlertTriangle,
    Ban,
    Link as LinkIcon,
    Code2,
    X,
} from 'lucide-react';

/**
 * Nilai jalur pengujian pada payload putaran pengembalian.
 *
 * Cermin `App\Enums\TestingTrack`: `qa` dan `cyber`, sama persis dengan isi kolom
 * `test_reports.test_type`. Jangan menambahkan nilai lain di sini tanpa mengubah enum
 * backend lebih dulu.
 */
const RETURN_TRACK = {
    QA: 'qa',
    CYBER: 'cyber',
};

/**
 * Sebutan status task perbaikan. Cermin `App\Enums\TaskStatus`.
 */
const TASK_STATUS_LABEL = {
    todo: 'Belum Mulai',
    in_progress: 'Sedang Dikerjakan',
    hold: 'Hold',
    done: 'Selesai',
    take_down: 'Take Down',
};

/**
 * Status task yang tidak lagi menahan pengajuan ulang.
 *
 * Cermin `ProjectReturnRound::NON_BLOCKING_TASK_STATUSES`, dipakai HANYA untuk menandai
 * task mana yang masih menahan pada daftar. Verdikt gerbangnya sendiri tetap dibaca dari
 * `can_resubmit` dan `resubmit_blocker` milik server — backend hanya mengirim JUMLAH task
 * penahan, bukan daftarnya, sehingga penandaan per baris harus dihitung di layar.
 */
const NON_BLOCKING_TASK_STATUSES = ['done', 'take_down'];

/** Role pemilik putaran: berhak membuat task perbaikan dan mengajukan ulang jalurnya. */
const RETURN_ROUND_OWNER_ROLES = ['project_manager', 'dev_analyst'];

/** Pilihan prioritas task perbaikan. Nilainya cermin `StoreTaskRequest` (`in:High,Medium,Low`). */
const TASK_PRIORITY_OPTIONS = [
    { value: 'High', label: 'Tinggi' },
    { value: 'Medium', label: 'Sedang' },
    { value: 'Low', label: 'Rendah' },
];

const formatDateTime = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Daftar putaran pengembalian satu proyek — sudah terurut terbaru lebih dulu oleh backend. */
const readReturnRounds = (project) => (Array.isArray(project?.return_rounds) ? project.return_rounds : []);

/** Apakah pengguna ini pemilik proyek, sehingga boleh menindak putarannya? */
const canActOnProject = (user, project) => {
    if (!user || !project) return false;

    // Super Admin bertindak pada proyek mana pun, sama seperti gerbang pengajuan jalur
    // pengujian di backend.
    if (user.role === 'super_admin') return true;

    if (!RETURN_ROUND_OWNER_ROLES.includes(user.role)) return false;

    const pmId = project.pm_id ?? (typeof project.pm === 'object' ? project.pm?.id : null);

    return pmId != null && Number(pmId) === Number(user.id);
};

/** Task perbaikan ini masih menahan pengajuan ulang? */
const isBlockingTask = (task) => !NON_BLOCKING_TASK_STATUSES.includes(String(task?.status || ''));

export default function ReturnRounds() {
    const { user } = useAuth();
    const { projects, refreshData } = useProjects();
    const rightPanelRef = useRef(null);

    const [selectedProjectId, setSelectedProjectId] = useState(null);

    // Formulir task perbaikan dan formulir pengajuan ulang hanya terbuka untuk SATU
    // putaran pada satu saat. Yang disimpan adalah id putarannya, sehingga isian satu
    // putaran tidak pernah terbawa ke putaran lain saat panelnya berganti.
    const [taskFormRoundId, setTaskFormRoundId] = useState(null);
    const [taskForm, setTaskForm] = useState({ title: '', description: '', assigneeId: '', priority: 'High', dueDate: '' });
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);

    const [resubmitRoundId, setResubmitRoundId] = useState(null);
    const [resubmitForm, setResubmitForm] = useState(null);
    const [isResubmitting, setIsResubmitting] = useState(false);

    // Kotak masuk pengembalian: proyek yang pernah dikembalikan salah satu jalur
    // pengujiannya, apa pun status putarannya. Tidak disaring kepemilikan PM — halaman
    // ini juga dibaca Lead Pengembangan, developer, Lead QA, dan Lead Keamanan Siber,
    // dan daftar proyek yang boleh dilihat sudah disaring `ProjectAccessService` di
    // backend. Yang dibatasi kepemilikan hanyalah tombol aksinya.
    const returnedProjects = useMemo(
        () => (projects || []).filter((p) => readReturnRounds(p).length > 0),
        [projects]
    );

    // Pilihan disimpan sebagai id supaya panel kanan selalu membaca data proyek terbaru
    // setelah polling menyegarkan daftar, bukan salinan objek saat proyek diklik.
    const activeProject = useMemo(() => {
        if (returnedProjects.length === 0) return null;

        return returnedProjects.find((p) => String(p.id) === String(selectedProjectId))
            || returnedProjects[0];
    }, [returnedProjects, selectedProjectId]);

    const rounds = useMemo(() => readReturnRounds(activeProject), [activeProject]);
    const canAct = useMemo(() => canActOnProject(user, activeProject), [user, activeProject]);

    // Penerima task perbaikan wajib anggota tim proyek — backend menolaknya dengan 422
    // bila bukan. Karena itu pilihannya dibangun dari `team`, bukan dari daftar pengguna.
    const teamMembers = useMemo(
        () => (Array.isArray(activeProject?.team) ? activeProject.team.filter((m) => m?.user_id) : []),
        [activeProject]
    );

    // Kedua formulir adalah draf milik satu proyek: begitu proyeknya berganti, drafnya
    // ditutup pada render yang sama (pola "sesuaikan state saat prop berubah"), bukan
    // lewat effect yang menyisakan satu render dengan isian proyek sebelumnya.
    const [formProjectId, setFormProjectId] = useState(null);
    if ((activeProject?.id ?? null) !== formProjectId) {
        setFormProjectId(activeProject?.id ?? null);
        setTaskFormRoundId(null);
        setResubmitRoundId(null);
        setResubmitForm(null);
    }

    const scrollToTop = () => {
        if (rightPanelRef.current) rightPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const activeProjectKey = activeProject?.id ?? null;

    useEffect(() => {
        if (activeProjectKey === null) return;
        scrollToTop();
    }, [activeProjectKey]);

    const handleOpenTaskForm = (round) => {
        setTaskFormRoundId(round.id);
        setTaskForm({ title: '', description: '', assigneeId: '', priority: 'High', dueDate: '' });
    };

    /**
     * Simpan satu task perbaikan atas putaran yang masih terbuka.
     *
     * `return_round_id` adalah penanda asalnya. Backend memvalidasi bahwa putaran itu
     * milik proyek ini DAN masih terbuka, jadi layar tidak perlu menjaganya sendiri.
     */
    const handleCreateFixTask = async (e, round) => {
        e.preventDefault();
        if (isSubmittingTask) return;

        if (!taskForm.title.trim()) {
            toast.error('Judul task perbaikan wajib diisi.');
            return;
        }

        setIsSubmittingTask(true);
        try {
            await taskService.create(activeProject.id, {
                title: taskForm.title.trim(),
                description: taskForm.description.trim() || null,
                assignee_id: taskForm.assigneeId ? Number(taskForm.assigneeId) : null,
                priority: taskForm.priority,
                due_date: taskForm.dueDate || null,
                return_round_id: round.id,
            });

            toast.success(`Task perbaikan "${taskForm.title.trim()}" berhasil ditambahkan.`);
            setTaskFormRoundId(null);
            setTaskForm({ title: '', description: '', assigneeId: '', priority: 'High', dueDate: '' });
            refreshData();
        } catch (err) {
            toast.error(`Gagal menambah task perbaikan: ${err.message}`);
        } finally {
            setIsSubmittingTask(false);
        }
    };

    /**
     * Isi awal formulir pengajuan ulang satu putaran.
     *
     * Masukan jalur Siber diambil dari pilihan pengajuan sebelumnya bila ada, supaya PM
     * tidak menuliskan ulang alamat target atau rujukan kode yang sama.
     */
    const handleOpenResubmitForm = (round) => {
        setResubmitRoundId(round.id);
        setResubmitForm({
            stagingUrl: activeProject?.stagingUrl || activeProject?.staging_url || '',
            targetDate: '',
            notes: '',
            checkType: activeProject?.cyberCheckType || CYBER_CHECK_TYPE.PENTEST,
            targetUrl: activeProject?.cyberTargetUrl
                || activeProject?.stagingUrl
                || activeProject?.staging_url
                || '',
            sourceCodeRef: activeProject?.cyberSourceCodeRef || '',
        });
    };

    /**
     * Ajukan ulang jalur pengujian yang mengembalikan proyek ini.
     *
     * Memakai endpoint pengajuan jalur yang biasa — endpoint itu jugalah yang menutup
     * putarannya. Tidak ada endpoint "ajukan ulang" tersendiri, sehingga gerbang
     * `ProjectReturnRoundService::assertResubmitAllowed()` berlaku sama untuk halaman ini
     * maupun form pengajuan pengujian biasa.
     */
    const handleResubmit = async (e, round) => {
        e.preventDefault();
        if (isResubmitting || !resubmitForm) return;

        const isCyber = round.track === RETURN_TRACK.CYBER;

        if (isCyber) {
            if (!resubmitForm.checkType) {
                toast.error('Pilih jenis pemeriksaan keamanan siber: Penetration Test atau Secure Code Review.');
                return;
            }
            if (requiresTargetUrl(resubmitForm.checkType) && !resubmitForm.targetUrl.trim()) {
                toast.error('Penetration Test menguji aplikasi berjalan, jadi alamat web target wajib diisi.');
                return;
            }
            if (requiresSourceCodeRef(resubmitForm.checkType) && !resubmitForm.sourceCodeRef.trim()) {
                toast.error('Secure Code Review menelaah kode sumber, jadi rujukan kode wajib diisi.');
                return;
            }
        }

        const submissionNote = [
            `Pengajuan ulang ${round.round_label} oleh ${user?.name || 'Analis Pengembangan'}.`,
            `Seluruh ${round.fix_task_summary?.total ?? 0} task perbaikan dinyatakan selesai.`,
            resubmitForm.notes.trim() ? `Catatan perbaikan: ${resubmitForm.notes.trim()}` : null,
        ].filter(Boolean).join(' ');

        const payload = {
            project_id: activeProject.id,
            staging_url: resubmitForm.stagingUrl.trim() || null,
            target_completion_date: resubmitForm.targetDate || null,
            notes: submissionNote,
        };

        setIsResubmitting(true);
        try {
            if (isCyber) {
                await cyberRequestService.submitRequest({
                    ...payload,
                    // Jenis pemeriksaan WAJIB pada jalur Siber; tanpa nilai ini backend
                    // menolak pengajuannya. Masukan yang tidak relevan dikirim null —
                    // backend memakai `exclude_unless`, jadi nilainya diabaikan.
                    cyber_check_type: resubmitForm.checkType,
                    cyber_target_url: requiresTargetUrl(resubmitForm.checkType) ? resubmitForm.targetUrl.trim() : null,
                    cyber_source_code_ref: requiresSourceCodeRef(resubmitForm.checkType) ? resubmitForm.sourceCodeRef.trim() : null,
                });
            } else {
                await qaRequestService.submitRequest(payload);
            }

            toast.success(`${round.round_label} berhasil diajukan ulang.`);
            setResubmitRoundId(null);
            setResubmitForm(null);
            refreshData();
        } catch (err) {
            toast.error(`Gagal mengajukan ulang: ${err.message}`);
        } finally {
            setIsResubmitting(false);
        }
    };

    const renderFixTaskList = (round) => {
        const fixTasks = Array.isArray(round.fix_tasks) ? round.fix_tasks : [];
        const summary = round.fix_task_summary || { total: 0, blocking: 0, unassigned: 0 };

        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h5 className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ListChecks size={14} className="text-[#00529C]" />
                        Task Perbaikan ({summary.total})
                    </h5>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${summary.blocking > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                            {summary.blocking > 0 ? `${summary.blocking} belum selesai` : 'Semua selesai'}
                        </span>
                        {summary.unassigned > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                                {summary.unassigned} tanpa penerima
                            </span>
                        )}
                    </div>
                </div>

                {fixTasks.length === 0 ? (
                    <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                        Belum ada task perbaikan atas temuan ini. Pengujian tidak dapat diajukan ulang
                        sebelum perbaikannya tercatat sebagai task.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {fixTasks.map((task) => {
                            const blocking = isBlockingTask(task);

                            return (
                                <div
                                    key={task.id}
                                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                                        blocking ? 'bg-white border-amber-200' : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] font-mono font-bold text-gray-500">#{task.id}</span>
                                            <h6 className="font-bold text-gray-800 text-xs">{task.title}</h6>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                            <span>
                                                Penerima:{' '}
                                                <strong className={task.assignee ? 'text-gray-700' : 'text-red-600'}>
                                                    {task.assignee || 'Belum ditugaskan'}
                                                </strong>
                                            </span>
                                            <span>•</span>
                                            <span>Prioritas: <strong className="text-gray-700">{task.priority}</strong></span>
                                            {task.due_date && (
                                                <>
                                                    <span>•</span>
                                                    <span>Tenggat: <strong className="text-gray-700">{formatDate(task.due_date)}</strong></span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                            blocking ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                                        }`}>
                                            {TASK_STATUS_LABEL[task.status] || task.status}
                                        </span>
                                        {blocking && (
                                            <span className="text-[9px] font-bold text-amber-700 flex items-center gap-1">
                                                <Ban size={9} /> Menahan
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderTaskForm = (round) => {
        if (taskFormRoundId !== round.id) {
            return (
                <button
                    type="button"
                    onClick={() => handleOpenTaskForm(round)}
                    className="w-full py-2.5 bg-white hover:bg-gray-50 border-2 border-dashed border-gray-300 hover:border-[#00529C] text-gray-600 hover:text-[#00529C] rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <Plus size={14} /> Buat Task Perbaikan
                </button>
            );
        }

        return (
            <form onSubmit={(e) => handleCreateFixTask(e, round)} className="p-4 bg-white rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus size={14} className="text-[#00529C]" /> Task Perbaikan Baru
                    </h5>
                    <button
                        type="button"
                        onClick={() => setTaskFormRoundId(null)}
                        className="text-gray-400 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-lg cursor-pointer transition-all"
                        title="Tutup formulir"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Judul Task <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={taskForm.title}
                        onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Contoh: Perbaiki validasi unggah berkas pada modul pengajuan"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C]"
                        required
                    />
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Uraian Perbaikan</label>
                    <textarea
                        rows={3}
                        value={taskForm.description}
                        onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Jelaskan temuan yang harus diperbaiki beserta acuan pengujiannya..."
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C]"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Penerima Task</label>
                        <select
                            value={taskForm.assigneeId}
                            onChange={(e) => setTaskForm((prev) => ({ ...prev, assigneeId: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C]"
                        >
                            <option value="">Belum ditugaskan</option>
                            {teamMembers.map((member) => (
                                <option key={member.user_id} value={member.user_id}>
                                    {member.name}{member.role ? ` — ${member.role}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Prioritas</label>
                        <select
                            value={taskForm.priority}
                            onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C]"
                        >
                            {TASK_PRIORITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Tenggat</label>
                        <input
                            type="date"
                            value={taskForm.dueDate}
                            onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C]"
                        />
                    </div>
                </div>

                {teamMembers.length === 0 && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
                        Proyek ini belum memiliki anggota tim, sehingga task perbaikan belum dapat diberi
                        penerima. Alokasikan tim lebih dulu pada halaman Alokasi Tim — pengajuan ulang
                        menuntut setiap task perbaikan memiliki penerima.
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isSubmittingTask}
                    className="w-full py-2.5 bg-[#00529C] hover:bg-[#003d75] text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus size={14} />
                    {isSubmittingTask ? 'Menyimpan task...' : 'Simpan Task Perbaikan'}
                </button>
            </form>
        );
    };

    const renderResubmitSection = (round) => {
        const isOpenForm = resubmitRoundId === round.id && resubmitForm;
        const isCyber = round.track === RETURN_TRACK.CYBER;
        const activeCheckTypeOption = isOpenForm ? getCyberCheckTypeOption(resubmitForm.checkType) : null;

        // Verdikt gerbang milik server. Layar tidak menghitungnya sendiri supaya tombol
        // dan penolakan backend tidak pernah berbeda pendapat.
        if (!round.can_resubmit) {
            return (
                <div className="p-4 rounded-xl bg-gray-100 border border-gray-200 space-y-2">
                    <div className="flex items-center gap-2 text-gray-700">
                        <Clock size={16} />
                        <span className="font-extrabold text-xs">Pengajuan ulang belum tersedia</span>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                        {round.resubmit_blocker || 'Perbaikan atas temuan ini belum lengkap.'}
                    </p>
                    <button
                        type="button"
                        disabled
                        className="w-full py-2.5 bg-gray-200 text-gray-400 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                    >
                        <Send size={14} /> Ajukan Ulang {round.track_label}
                    </button>
                </div>
            );
        }

        if (!isOpenForm) {
            return (
                <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800">
                        <CheckCircle2 size={16} />
                        <span className="font-extrabold text-xs">Seluruh perbaikan selesai — siap diajukan ulang</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                        Setiap task perbaikan pada putaran ini sudah selesai dan memiliki penerima.
                        Ajukan {round.track_label} kembali untuk diuji ulang.
                    </p>
                    <button
                        type="button"
                        onClick={() => handleOpenResubmitForm(round)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <Send size={14} /> Ajukan Ulang {round.track_label}
                    </button>
                </div>
            );
        }

        return (
            <form onSubmit={(e) => handleResubmit(e, round)} className="p-4 rounded-xl bg-white border-2 border-emerald-300 space-y-3">
                <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Send size={14} className="text-emerald-600" /> Pengajuan Ulang {round.track_label}
                    </h5>
                    <button
                        type="button"
                        onClick={() => { setResubmitRoundId(null); setResubmitForm(null); }}
                        className="text-gray-400 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-lg cursor-pointer transition-all"
                        title="Tutup formulir"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/*
                  Jalur Siber menuntut jenis pemeriksaan beserta masukannya, sama seperti
                  form pengajuan Audit Keamanan Siber. Hanya satu masukan yang relevan per
                  jenis pemeriksaan, jadi hanya satu yang ditampilkan.
                */}
                {isCyber && (
                    <>
                        <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-gray-700">
                                Jenis Pemeriksaan Keamanan <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {CYBER_CHECK_TYPE_OPTIONS.map((option) => {
                                    const isActive = resubmitForm.checkType === option.value;
                                    const OptionIcon = option.value === CYBER_CHECK_TYPE.SECURE_CODE ? Code2 : ShieldAlert;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setResubmitForm((prev) => ({ ...prev, checkType: option.value }))}
                                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                isActive
                                                    ? 'border-2 border-orange-500 bg-orange-50/70'
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <OptionIcon size={14} className={isActive ? 'text-orange-600' : 'text-gray-400'} />
                                                <span className={`text-[11px] font-extrabold ${isActive ? 'text-orange-900' : 'text-gray-700'}`}>
                                                    {option.label}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {activeCheckTypeOption && (
                            <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                    {activeCheckTypeOption.inputLabel} <span className="text-red-500">*</span>
                                </label>
                                {resubmitForm.checkType === CYBER_CHECK_TYPE.PENTEST ? (
                                    <div className="relative">
                                        <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="url"
                                            value={resubmitForm.targetUrl}
                                            onChange={(e) => setResubmitForm((prev) => ({ ...prev, targetUrl: e.target.value }))}
                                            placeholder={activeCheckTypeOption.inputPlaceholder}
                                            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                                            required
                                        />
                                    </div>
                                ) : (
                                    <textarea
                                        rows={2}
                                        value={resubmitForm.sourceCodeRef}
                                        onChange={(e) => setResubmitForm((prev) => ({ ...prev, sourceCodeRef: e.target.value }))}
                                        placeholder={activeCheckTypeOption.inputPlaceholder}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                                        required
                                    />
                                )}
                                <p className="text-[10px] text-gray-400 mt-1">{activeCheckTypeOption.inputHelp}</p>
                            </div>
                        )}
                    </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Alamat Lingkungan Uji (Opsional)</label>
                        <div className="relative">
                            <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="url"
                                value={resubmitForm.stagingUrl}
                                onChange={(e) => setResubmitForm((prev) => ({ ...prev, stagingUrl: e.target.value }))}
                                placeholder="https://staging.banknagari.co.id/nama-aplikasi"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Target Tanggal Selesai (Opsional)</label>
                        <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                value={resubmitForm.targetDate}
                                onChange={(e) => setResubmitForm((prev) => ({ ...prev, targetDate: e.target.value }))}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C]"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Catatan Perbaikan untuk Penguji</label>
                    <textarea
                        rows={3}
                        value={resubmitForm.notes}
                        onChange={(e) => setResubmitForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Ringkas perbaikan yang sudah dikerjakan dan bagian mana yang perlu diuji ulang..."
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C]"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isResubmitting}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={14} />
                    {isResubmitting ? 'Mengirim pengajuan...' : `Kirim Pengajuan Ulang ${round.track_label}`}
                </button>
            </form>
        );
    };

    const renderRoundCard = (round) => {
        const isQa = round.track === RETURN_TRACK.QA;
        const TrackIcon = isQa ? Bug : Shield;

        return (
            <div
                key={round.id}
                className={`p-5 rounded-2xl border-2 space-y-4 ${
                    round.is_open
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-gray-200 bg-gray-50/60'
                }`}
            >
                {/* Kepala putaran */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            round.is_open ? 'bg-amber-500 text-white' : 'bg-gray-300 text-white'
                        }`}>
                            <TrackIcon size={17} />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-sm text-gray-800">{round.round_label}</h4>
                            <p className="text-[11px] text-gray-500">
                                {round.track_label} • Pengembalian ke-{round.round_number}
                            </p>
                        </div>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${
                        round.is_open ? 'bg-amber-500 text-white' : 'bg-gray-400 text-white'
                    }`}>
                        {(round.status_label || (round.is_open ? 'Menunggu Perbaikan' : 'Sudah Diajukan Ulang')).toUpperCase()}
                    </span>
                </div>

                {/* Sisi pengujian — siapa mengembalikan dan apa temuannya */}
                <div className="bg-white rounded-xl border border-gray-200 p-3.5 space-y-2.5">
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                            <User size={12} /> Dikembalikan oleh{' '}
                            <strong className="text-gray-800">{round.returned_by_name || 'Tidak tercatat'}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock size={12} /> {formatDateTime(round.returned_at) || 'Tidak tercatat'}
                        </span>
                        {round.severity && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-red-100 text-red-700 flex items-center gap-1">
                                <AlertTriangle size={10} /> Severitas: {round.severity}
                            </span>
                        )}
                    </div>

                    {/* Pesan Lead adalah inti "apa yang salah", jadi diberi ruang paling menonjol. */}
                    <div>
                        <h5 className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <MessageSquareWarning size={14} className="text-red-600" />
                            Alasan Pengembalian
                        </h5>
                        <p className={`p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                            round.lead_notes
                                ? 'bg-red-50 border border-red-200 text-red-950 font-medium'
                                : 'bg-gray-50 border border-gray-200 text-gray-400 italic'
                        }`}>
                            {round.lead_notes || 'Lead tidak menuliskan catatan pengembalian pada putaran ini.'}
                        </p>
                    </div>
                </div>

                {/* Task perbaikan yang diminta putaran ini */}
                {renderFixTaskList(round)}

                {/* Sisi pengembangan */}
                {round.is_open ? (
                    canAct && (
                        <div className="space-y-3 pt-1">
                            {renderTaskForm(round)}
                            {renderResubmitSection(round)}
                        </div>
                    )
                ) : (
                    <div className="p-3.5 rounded-xl bg-white border border-gray-200 space-y-2">
                        <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                                <CheckCircle2 size={12} className="text-emerald-600" /> Diajukan ulang oleh{' '}
                                <strong className="text-gray-800">{round.resubmitted_by_name || 'Tidak tercatat'}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock size={12} /> {formatDateTime(round.resubmitted_at) || 'Tidak tercatat'}
                            </span>
                        </div>
                        {round.resubmit_notes && (
                            <p className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {round.resubmit_notes}
                            </p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Putaran Pengembalian</h2>
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                            <Undo2 size={14} /> Fase 3 kembali ke Fase 2
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Riwayat lengkap proyek yang dikembalikan Lead QA atau Lead Keamanan Siber ke Tim
                        Pengembangan: jalur mana yang menolak, apa temuannya, task perbaikan apa yang
                        dimintanya, dan kapan jalurnya diajukan ulang.
                    </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold shrink-0">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                        <Bug size={14} /> Pengujian QA
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 rounded-xl border border-orange-100">
                        <Shield size={14} /> Audit Keamanan Siber
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LIST PANEL (Panel Kiri) */}
                <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-220px)] overflow-hidden">
                    <div className="text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Undo2 size={14} />
                        Proyek yang Pernah Dikembalikan ({returnedProjects.length})
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {returnedProjects.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                <Inbox size={32} className="mx-auto mb-2 text-gray-300" />
                                Belum ada proyek yang dikembalikan jalur pengujian. Selama kedua jalur
                                menyatakan lulus, halaman ini memang kosong.
                            </div>
                        ) : (
                            returnedProjects.map((p) => {
                                const projectRounds = readReturnRounds(p);
                                const openRounds = projectRounds.filter((r) => r.is_open);
                                const isActive = String(activeProject?.id) === String(p.id);

                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedProjectId(p.id)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                            isActive
                                                ? 'border-2 border-[#00529C] bg-blue-50/40 shadow-sm'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                {p.reqId || p.id}
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={p.type} /><ProjectTypeBadge type={p.project_type} /></div>
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-2">{p.name}</h4>

                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                                                {projectRounds.length} putaran
                                            </span>
                                            {openRounds.length > 0 ? (
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500 text-white flex items-center gap-1">
                                                    <AlertTriangle size={9} /> {openRounds.length} menunggu perbaikan
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                                    <CheckCircle2 size={9} /> Semua sudah diajukan ulang
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* DETAIL PANEL (Panel Kanan) */}
                <div ref={rightPanelRef} className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-220px)] scroll-smooth">
                    {!activeProject ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20 text-center px-6">
                            <Undo2 size={48} className="mb-3 text-gray-300" />
                            <p className="font-bold text-gray-600">Belum ada putaran pengembalian</p>
                            <p className="text-xs text-gray-400 mt-1 max-w-sm leading-relaxed">
                                Putaran pengembalian lahir ketika Lead QA atau Lead Keamanan Siber
                                menyatakan sebuah jalur pengujian TIDAK LULUS. Sampai itu terjadi,
                                tidak ada yang perlu ditinjau di sini.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Header Proyek */}
                            <div className="pb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                        {activeProject.reqId || activeProject.id}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={activeProject.type} /><ProjectTypeBadge type={activeProject.project_type} /></div>
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{activeProject.name}</h3>
                                <div className="flex items-center gap-4 text-xs text-gray-500 mt-1.5 flex-wrap">
                                    <span className="flex items-center gap-1">
                                        <Building size={13} /> {activeProject.division || 'Belum ada data divisi'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar size={13} /> Target: <strong className="text-gray-700">{activeProject.targetDate}</strong>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <User size={13} /> Analis Pengembangan:{' '}
                                        <strong className="text-gray-700">
                                            {(typeof activeProject.pm === 'object' ? activeProject.pm?.name : activeProject.pm) || 'Belum ditugaskan'}
                                        </strong>
                                    </span>
                                </div>
                            </div>

                            {/*
                              Pembaca yang bukan pemilik proyek tetap melihat riwayat lengkapnya,
                              tetapi tanpa tombol aksi. Keterangan ini mencegahnya mencari tombol
                              yang memang tidak pernah ada untuknya.
                            */}
                            {!canAct && (
                                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed flex items-start gap-2">
                                    <Clock size={14} className="shrink-0 mt-0.5" />
                                    <span>
                                        Mode baca saja. Pembuatan task perbaikan dan pengajuan ulang jalur
                                        pengujian hanya dapat dilakukan Analis Pengembangan pemegang proyek ini.
                                    </span>
                                </div>
                            )}

                            {/* Seluruh putaran, terbaru lebih dulu */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Undo2 size={15} className="text-[#00529C]" />
                                    Riwayat Putaran Pengembalian ({rounds.length})
                                </h4>
                                {rounds.map((round) => renderRoundCard(round))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
