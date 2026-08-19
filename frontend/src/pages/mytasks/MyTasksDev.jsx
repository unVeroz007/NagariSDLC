import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import ChatBox from '../../components/ChatBox';
import { taskService, projectService, documentService } from '../../services/api';
import {
    Code,
    Search,
    Calendar,
    Kanban,
    Layers,
    MessageSquare,
    AlertCircle,
    ShieldCheck,
    CheckCircle2,
    Eye,
    Paperclip,
    Download,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Pemetaan status label UI <-> enum backend (TaskStatus: todo, in_progress, hold, done, take_down)
const STATUS_ENUM_TO_LABEL = {
    todo: 'Belum Mulai',
    in_progress: 'Sedang Dikerjakan',
    hold: 'Hold',
    done: 'Selesai',
    take_down: 'Take Down',
};
const STATUS_LABEL_TO_ENUM = {
    'Belum Mulai': 'todo',
    'Sedang Dikerjakan': 'in_progress',
    'Hold': 'hold',
    'Selesai': 'done',
    'Take Down': 'take_down',
};
const STATUS_LABELS = ['Belum Mulai', 'Sedang Dikerjakan', 'Hold', 'Selesai', 'Take Down'];

const mapTaskStatusToLabel = (status) => {
    const s = String(status || '').toLowerCase();
    if (STATUS_ENUM_TO_LABEL[s]) return STATUS_ENUM_TO_LABEL[s];
    // Terima label UI yang sudah benar (misal dari data lama)
    if (STATUS_LABELS.includes(status)) return status;
    // Migrasi status lama 'review' (Code Review) -> dianggap Sedang Dikerjakan
    if (s === 'review' || s === 'code review') return 'Sedang Dikerjakan';
    return 'Belum Mulai';
};

export default function MyTasksDev() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { projects, refreshData, isLoading } = useProjects();
    const { addNotification } = useNotifications();

    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTask, setSelectedTask] = useState(null);
    const [updatingTaskId, setUpdatingTaskId] = useState(null);

    // Ambil task NYATA dari backend: hanya task di proyek tempat developer ini menjadi anggota tim
    // DAN yang assignee-nya adalah developer yang sedang login.
    const devTasks = useMemo(() => {
        const isPrivileged = user?.role && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);
        const tasks = [];
        (projects || []).forEach(p => {
            if (!Array.isArray(p.tasks)) return;
            p.tasks.forEach(t => {
                const assigneeId = t.assignee_id ?? t.assignee_detail?.id ?? null;
                const assigneeName = t.assignee_detail?.name || t.assignee || '';

                // Tentukan kepemilikan: task ini untuk developer yang login?
                const isMine = isPrivileged
                    ? false // privileged user tidak melihat daftar "saya" (mereka lihat semua via kanban)
                    : (user?.id && assigneeId != null && Number(assigneeId) === Number(user.id))
                        || (user?.name && assigneeName && assigneeName.toLowerCase() === user.name.toLowerCase());

                if (!isMine) return;

                tasks.push({
                    id: t.id,
                    title: t.title || t.name || 'Task Pengembangan',
                    projectId: p.id,
                    projectName: p.name,
                    assignee: assigneeName,
                    priority: t.priority || 'Medium',
                    deadline: t.due_date || t.deadline || '',
                    status: mapTaskStatusToLabel(t.status),
                    revisionNote: t.revision_note || '',
                    revisionRequestedBy: t.revision_requested_by || '',
                    revisionRequestedAt: t.revision_requested_at || null,
                    // Bukti lampiran SIT (yang perlu diperiksa saat revisi)
                    sitAttachments: (() => {
                        try {
                            const approvals = p.sitUatData?.sit2_task_approvals || p.sit_uat_data?.sit2_task_approvals || {};
                            let entry = null;
                            // Backend bisa kirim "task_10" (prefix) atau "10"
                            if (Array.isArray(approvals)) {
                                const idx = (p.tasks || []).findIndex(pt => Number(pt.id) === Number(t.id));
                                entry = idx >= 0 ? approvals[idx] : null;
                            } else {
                                entry = approvals[`task_${t.id}`] ?? approvals[t.id] ?? approvals[String(t.id)] ?? null;
                            }
                            return entry?.attachments || [];
                        } catch {
                            return [];
                        }
                    })(),
                });
            });
        });
        return tasks;
    }, [projects, user]);

    // Filter berdasarkan pencarian & status
    const filteredTasks = useMemo(() => {
        return devTasks.filter(task => {
            const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
            const matchesSearch =
                String(task.title).toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(task.projectName).toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(task.id).toLowerCase().includes(searchTerm.toLowerCase());

            return matchesStatus && matchesSearch;
        });
    }, [devTasks, statusFilter, searchTerm]);

    const handleUpdateStatus = async (task, newStatusLabel) => {
        const enumStatus = STATUS_LABEL_TO_ENUM[newStatusLabel];
        if (!enumStatus || !task?.id) {
            toast.error('Status tidak valid.');
            return;
        }

        setUpdatingTaskId(task.id);
        try {
            await taskService.update(task.id, { status: enumStatus });

            toast.success(`Status task "${task.title}" diperbarui menjadi: ${newStatusLabel}`);
            addNotification(
                'Perubahan Status Task Developer',
                `Task "${task.title}" diperbarui oleh ${user?.name || 'Developer'} menjadi status: ${newStatusLabel}`,
                'info',
                '/pm/kanban'
            );

            // Muat ulang data proyek agar status terbaru tercermin di semua laman.
            await refreshData();
        } catch (err) {
            toast.error(`Gagal memperbarui status: ${err.message}`);
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Belum Mulai':
                return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'Sedang Dikerjakan':
                return 'bg-blue-100 text-blue-800 border-blue-200 font-bold';
            case 'Hold':
                return 'bg-amber-100 text-amber-800 border-amber-200 font-bold';
            case 'Selesai':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
            case 'Take Down':
                return 'bg-red-100 text-red-800 border-red-200 font-bold';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'High':
                return 'bg-red-50 text-red-600 border-red-200 font-semibold';
            case 'Medium':
                return 'bg-amber-50 text-amber-600 border-amber-200 font-semibold';
            case 'Low':
                return 'bg-green-50 text-green-600 border-green-200 font-semibold';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    // ── Persetujuan SIT (Developer sebagai assignee) ──
    // Hanya muncul setelah Eksekusi SIT (Tahap 2) selesai: semua task dicentang OK
    // dan PM menekan "Simpan & Lanjut Review" (activeSitStep >= 3).
    const [sitApprovingId, setSitApprovingId] = useState(null);
    const sitPendingProjects = useMemo(() => {
        return (projects || []).filter(p => {
            const st = String(p.status || '').toUpperCase();
            if (st !== 'SIT_IN_PROGRESS') return false;
            // Gate: Tahap 2 (Eksekusi) harus sudah tuntas sebelum persetujuan muncul
            const sitUat = p.sitUatData || p.sit_uat_data || {};
            const activeSitStep = Number(sitUat.activeSitStep || 1);
            if (activeSitStep < 3) return false;
            // Developer ini harus jadi assignee minimal 1 task
            const isAssignee = Array.isArray(p.tasks) && p.tasks.some(t =>
                (t.assignee_id ?? t.assignee_detail?.id) != null &&
                Number(t.assignee_id ?? t.assignee_detail?.id) === Number(user?.id)
            );
            if (!isAssignee) return false;
            const ap = p.sitUatData?.sit3_approvals || p.sit_uat_data?.sit3_approvals || {};
            const devList = ap?.developer?.developers || [];
            // Sembunyikan hanya jika user ini sudah approve
            return !devList.some(d => Number(d.userId ?? d.approvedById) === Number(user?.id));
        });
    }, [projects, user]);

    const handleSitApproval = async (projectId) => {
        setSitApprovingId(projectId);
        try {
            await projectService.submitSitApproval(projectId, '');
            toast.success('Persetujuan SIT Anda berhasil disimpan.');
            await refreshData();
        } catch (err) {
            toast.error(`Gagal menyimpan persetujuan: ${err.message}`);
        } finally {
            setSitApprovingId(null);
        }
    };

    // ── Lihat / Unduh bukti lampiran SIT (untuk task yang direvisi) ──
    const [previewSitDoc, setPreviewSitDoc] = useState(null);
    const [sitDocLoading, setSitDocLoading] = useState(false);
    const viewSitAttachment = async (doc) => {
        try {
            if (doc?.docId) {
                setSitDocLoading(true);
                const loadingId = toast.loading('Membuka berkas...');
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                toast.dismiss(loadingId);
                setSitDocLoading(false);
                setPreviewSitDoc({ doc, blobUrl: url });
            } else if (doc?.url?.startsWith('blob:')) {
                setPreviewSitDoc({ doc, blobUrl: doc.url });
            } else {
                toast.info('Berkas belum tersedia untuk dilihat.');
            }
        } catch (err) {
            setSitDocLoading(false);
            toast.error(`Gagal membuka berkas: ${err.message}`);
        }
    };
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
            }
        } catch (err) {
            toast.error(`Gagal mengunduh bukti: ${err.message}`);
        }
    };

    if (isLoading) {
        return <LoadingSpinner text="Memuat Tugas Developer Saya..." />;
    }

    return (
        <div className="flex-1 overflow-y-auto bg-[#f8f9fb] p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-extrabold text-gray-800">Tugas Developer Saya</h1>
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Code size={14} /> IT Programmer
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Kelola dan update status tugas pengembangan perangkat lunak yang ditugaskan kepada Anda.
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/pm/kanban')}
                        className="inline-flex items-center justify-center px-4 py-2.5 bg-[#1a365d] hover:bg-[#0f2342] text-white font-bold rounded-xl text-xs transition-all shadow-sm gap-2 shrink-0"
                    >
                        <Kanban size={16} />
                        Buka Kanban Board
                    </button>
                </div>

                {/* Filter Bar */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Search */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari tugas atau proyek..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-600 focus:bg-white transition-all"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                        {['ALL', 'Belum Mulai', 'Sedang Dikerjakan', 'Hold', 'Selesai', 'Take Down'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                    statusFilter === st
                                        ? 'bg-[#1a365d] text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {st === 'ALL' ? 'Semua Status' : st}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Panel Persetujuan SIT (Developer) */}
                {sitPendingProjects.length > 0 && (
                    <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
                            <h3 className="font-bold text-teal-800 text-sm flex items-center gap-2">
                                <ShieldCheck size={16} /> Persetujuan SIT — Menunggu Anda
                            </h3>
                            <span className="text-[10px] font-bold text-teal-600 bg-white px-2 py-0.5 rounded-full border border-teal-200">
                                {sitPendingProjects.length} proyek
                            </span>
                        </div>
                        <div className="p-3 space-y-2">
                            <p className="text-[11px] text-gray-500">
                                Tahap SIT telah selesai dilaksanakan. Berikan persetujuan Anda sebagai <strong>Developer</strong> agar SIT dapat dinilai lulus.
                            </p>
                            {sitPendingProjects.map(p => {
                                const ap = p.sitUatData?.sit3_approvals || p.sit_uat_data?.sit3_approvals || {};
                                const devList = ap?.developer?.developers || [];
                                const required = ap?.developer?.required ?? 0;
                                return (
                                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-800 text-xs truncate">{p.name}</p>
                                        <p className="text-[10px] text-gray-400">{p.reqId || p.req_id || `REQ-${p.id}`}</p>
                                        {required > 0 && (
                                            <p className="text-[10px] text-teal-600 mt-0.5">
                                                {devList.length} dari {required} developer telah menyetujui
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => navigate(`/pm/tasks/${p.id}`)}
                                            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <Eye size={13} /> Lihat Detail
                                        </button>
                                        <button
                                            onClick={() => handleSitApproval(p.id)}
                                            disabled={sitApprovingId === p.id}
                                            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                                        >
                                            {sitApprovingId === p.id ? (
                                                <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                                            ) : (
                                                <><CheckCircle2 size={14} /> Setujui SIT</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Task Table Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <Layers size={16} className="text-blue-600" />
                            Daftar Tugas ({filteredTasks.length})
                        </h3>
                        <span className="text-xs text-gray-500 font-medium">
                            Pengguna: <strong>{user?.name || 'Developer'}</strong>
                        </span>
                    </div>

                    {filteredTasks.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Code size={48} className="mx-auto mb-3 opacity-40 text-blue-600" />
                            <h4 className="font-bold text-gray-700 text-base">Tidak Ada Tugas Ditemukan</h4>
                            <p className="text-xs text-gray-500 mt-1">Tidak ada tugas yang sesuai dengan filter saat ini.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-bold uppercase">
                                        <th className="p-4">Kode &amp; Judul Task</th>
                                        <th className="p-4">Proyek</th>
                                        <th className="p-4">Priority</th>
                                        <th className="p-4">Deadline</th>
                                        <th className="p-4">Status Saat Ini</th>
                                        <th className="p-4 text-center">Update Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                     {filteredTasks.map((task) => (
                                        <tr
                                            key={task.id}
                                            onClick={() => setSelectedTask(task)}
                                            className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${
                                                selectedTask?.id === task.id ? 'bg-blue-50/40 font-bold border-l-4 border-l-[#1a365d]' : ''
                                            }`}
                                        >
                                            <td className="p-4 font-semibold text-gray-800 max-w-xs">
                                                <span className="font-mono text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold mr-2">
                                                    {task.id}
                                                </span>
                                                <div className="mt-1 font-bold text-gray-900 line-clamp-2">{task.title}</div>
                                                {task.revisionNote && (
                                                    <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg text-[11px] text-orange-800">
                                                        <div className="flex items-center gap-1 font-bold mb-0.5">
                                                            <AlertCircle size={11} className="text-orange-500" />
                                                            Permintaan Revisi dari PM
                                                        </div>
                                                        <p className="leading-relaxed">{task.revisionNote}</p>
                                                        {task.revisionRequestedBy && (
                                                            <p className="text-[10px] text-orange-600 mt-1">Oleh: {task.revisionRequestedBy}</p>
                                                        )}
                                                        {/* Bukti lampiran SIT yang perlu diperbaiki */}
                                                        {task.sitAttachments && task.sitAttachments.length > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-orange-200">
                                                                <p className="text-[10px] font-bold text-orange-700 mb-1 flex items-center gap-1">
                                                                    <Paperclip size={10} /> Bukti dari SIT ({task.sitAttachments.length})
                                                                </p>
                                                                <div className="space-y-1">
                                                                    {task.sitAttachments.map(doc => (
                                                                        <div key={doc.id} className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2 py-1 border border-orange-100">
                                                                            <span className="text-[10px] font-semibold text-gray-700 truncate flex-1">{doc.originalName || doc.name}</span>
                                                                            {doc.url && (
                                                                                <>
                                                                                    <button onClick={() => viewSitAttachment(doc)} title="Lihat"
                                                                                        className="p-1 text-gray-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
                                                                                        <Eye size={11} />
                                                                                    </button>
                                                                                    <button onClick={() => downloadSitAttachment(doc)} title="Unduh"
                                                                                        className="p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer">
                                                                                        <Download size={11} />
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                <div className="font-semibold text-gray-800 line-clamp-1">{task.projectName}</div>
                                                <span className="text-[10px] text-gray-400">{task.projectId}</span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[11px] border ${getPriorityBadge(task.priority)}`}>
                                                    {task.priority}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={13} className="text-gray-400" />
                                                    <span>{task.deadline || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs border ${getStatusBadge(task.status)}`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <select
                                                    value={task.status}
                                                    disabled={updatingTaskId === task.id}
                                                    onChange={(e) => handleUpdateStatus(task, e.target.value)}
                                                    className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 bg-white cursor-pointer hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {STATUS_LABELS.map((st) => (
                                                        <option key={st} value={st}>{st}</option>
                                                    ))}
                                                </select>
                                                {updatingTaskId === task.id && (
                                                    <span className="block text-[10px] text-blue-600 mt-1">Menyimpan...</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Seksi Chat Discussion Per Proyek */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-base">
                        <MessageSquare size={20} className="text-[#1a365d]" /> Diskusi Proyek
                    </h3>
                    {selectedTask ? (
                        <ChatBox
                            projectId={selectedTask.projectId}
                            projectName={selectedTask.projectName}
                            maxHeight="400px"
                        />
                    ) : (
                        <div className="bg-gray-50 p-8 rounded-xl border border-gray-200 text-center text-gray-400 text-sm font-medium">
                            Pilih task untuk melihat diskusi proyek.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Pratinjau Bukti SIT */}
            {previewSitDoc && (
                <div className="fixed inset-0 z-[99997] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50/70">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center font-bold text-[9px] shrink-0">
                                    {(previewSitDoc.doc?.type || 'FILE')}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-800 truncate">{previewSitDoc.doc?.originalName || previewSitDoc.doc?.name}</p>
                                    <p className="text-[10px] text-gray-400">{previewSitDoc.doc?.size}</p>
                                </div>
                            </div>
                            <button onClick={() => setPreviewSitDoc(null)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-gray-100 p-4">
                            {previewSitDoc.blobUrl && (
                                <iframe src={previewSitDoc.blobUrl} title="Pratinjau Bukti SIT" className="w-full h-[60vh] rounded-xl bg-white border border-gray-200" />
                            )}
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50/70">
                            <button onClick={() => downloadSitAttachment(previewSitDoc.doc)} className="px-4 py-2 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                                <Download size={13} /> Unduh Berkas
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
