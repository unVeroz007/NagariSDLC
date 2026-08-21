// src/components/SITTaskExecution.jsx
// Tabel eksekusi/persetujuan TASK-LEVEL untuk tahap SIT "Eksekusi Pengujian".
//
// Setiap task developer (kecuali TAKE DOWN) ditampilkan dengan:
//   a) Tombol OK / Batalkan OK    → tanda task LOLOS SIT (alur MAJU)
//   b) Komentar / Temuan (textarea)→ catatan hasil uji task tsb
//   c) Lampiran Bukti per-task    → screenshot / file pendukung tiap task
//   d) Tombol Revisi              → alur MUNDUR: task dikembalikan ke developer
//
// Skema data approvals (tersimpan di sitUatData.sit2_task_approvals):
//   { [taskId]: {
//       approved: bool,
//       comment:  string,
//       attachments: [{ id, name, originalName, size, type, url, uploadedAt }],
//       approvedAt: ISO|null,
//       approvedBy: string|null,
//       revisedAt:  ISO|null,
//       revisedBy:  string|null,
//   } }
//
// Gate kelulusan: lanjut Review & Sign-Off hanya jika seluruh task dalam scope
// SIT saat ini memiliki approved === true.
import { useState, useMemo, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
    Check, AlertCircle, RotateCcw, MessageSquare, User, Paperclip,
    X, Eye, Download, ShieldCheck, FileText, Clock, CalendarCheck, Trash2
} from 'lucide-react';
import { documentService } from '../services/api';

const TASK_STATUS_LABEL = {
    todo: 'Belum Mulai',
    in_progress: 'Sedang Dikerjakan',
    hold: 'Hold',
    done: 'Selesai',
    take_down: 'Take Down',
};

const fmtDateTime = (iso) => {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return null;
    }
};

export default function SITTaskExecution({
    project,
    approvals,
    onApprovalsChange,
    onRequestRevision,
    taskIds = null,
    isTargetedRetest = false,
    readOnly = false,
}) {
    const taskIdSet = useMemo(
        () => Array.isArray(taskIds) ? new Set(taskIds.map(Number)) : null,
        [taskIds]
    );
    // SIT awal menampilkan seluruh task aktif; SIT ulang hanya task dalam scope.
    const tasks = useMemo(() => {
        if (!Array.isArray(project?.tasks)) return [];
        return project.tasks
            .map(t => ({
                id: t.id,
                title: t.title || t.name || 'Task',
                status: String(t.status || 'todo').toLowerCase(),
                assigneeName: t.assignee_detail?.name || t.assignee || 'Belum Dialokasi',
                priority: t.priority || 'Medium',
                revisionNote: t.revision_note || '',
            }))
            .filter(t => t.status !== 'take_down'
                && (!taskIdSet || taskIdSet.has(Number(t.id))));
    }, [project?.tasks, taskIdSet]);

    // State komentar & lampiran per task (sementara sebelum disimpan)
    const [comments, setComments] = useState({});
    const [draftAttachments, setDraftAttachments] = useState({}); // taskId -> File[]
    const fileInputRefs = useRef({});

    const approvedCount = tasks.filter(t => {
        const a = approvals?.[t.id];
        return typeof a === 'object' ? a.approved === true : a === true;
    }).length;
    const allApproved = tasks.length > 0 && approvedCount === tasks.length;

    // Inisialisasi komentar dari approvals tersimpan
    useEffect(() => {
        const init = {};
        tasks.forEach(t => {
            const a = approvals?.[t.id];
            const comment = typeof a === 'object' ? (a.comment || '') : '';
            if (comment) init[t.id] = comment;
        });
        setComments(init);
    }, [approvals, tasks]);

    const getApproval = (taskId) => {
        const key = String(taskId);
        const a = approvals?.[key] ?? approvals?.[taskId];
        if (typeof a === 'object') return a;
        if (a === true) return { approved: true, comment: '', attachments: [] };
        if (a === false) return { approved: false, comment: '', attachments: [] };
        return { approved: false, comment: '', attachments: [] };
    };

    const patchApproval = (taskId, patch) => {
        const key = String(taskId);
        const current = getApproval(key);
        onApprovalsChange?.({
            ...(approvals || {}),
            [key]: { ...current, ...patch },
        });
    };

    // ── Alur MAJU: toggle OK ───────────────────────────────────────────────
    const handleToggleOk = (taskId) => {
        if (readOnly) return;
        const current = getApproval(taskId);
        if (current.approved) {
            // Batalkan persetujuan
            patchApproval(taskId, { approved: false, approvedAt: null, approvedBy: null });
            toast('Persetujuan task dibatalkan.', { icon: '↩️' });
        } else {
            patchApproval(taskId, {
                approved: true,
                approvedAt: new Date().toISOString(),
                approvedBy: project?.pm?.name || 'PM',
            });
            toast.success(`Task disetujui lolos SIT.`);
        }
    };

    const handleCommentChange = (taskId, val) => {
        setComments(prev => ({ ...prev, [taskId]: val }));
    };

    const handleSaveComment = (taskId) => {
        const comment = (comments[taskId] || '').trim();
        patchApproval(taskId, { comment });
        toast.success('Komentar / temuan task disimpan.');
    };

    // ── Lampiran bukti per task (upload ke server agar permanen) ────────────
    const [uploadingTaskId, setUploadingTaskId] = useState(null);
    const handlePickFiles = async (taskId, files) => {
        if (!files?.length || !project?.id) return;
        const list = Array.from(files);
        const current = getApproval(taskId);
        setUploadingTaskId(taskId);
        try {
            // Upload PARALLEL agar beberapa file selesai bersamaan (bukan satu per satu).
            // context_label membuat nama masking tiap bukti berbeda & terlacak ke task-nya.
            const results = await Promise.allSettled(
                list.map(f => documentService.upload(f, {
                    project_id: project.id,
                    document_type: 'SIT_TASK_EVIDENCE',
                    original_filename: f.name,
                    context_label: `TASK-${taskId}`,
                }))
            );
            const newAttachments = [];
            results.forEach((result, i) => {
                const f = list[i];
                if (result.status === 'fulfilled') {
                    const doc = result.value?.data || {};
                    newAttachments.push({
                        id: `taskdoc_${taskId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                        docId: doc.id || null,
                        name: doc.file_name || f.name,
                        originalName: doc.original_filename || f.name,
                        size: doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : `${(f.size / 1024 / 1024).toFixed(2)} MB`,
                        type: (f.name.split('.').pop() || 'file').toUpperCase(),
                        url: doc.id ? `${import.meta.env.VITE_API_URL}/documents/${doc.id}/download` : URL.createObjectURL(f),
                        uploadedAt: new Date().toISOString(),
                    });
                } else {
                    toast.error(`Gagal mengunggah "${f.name}": ${result.reason?.message || 'Error'}`);
                }
            });

            if (newAttachments.length > 0) {
                patchApproval(taskId, { attachments: [...(current.attachments || []), ...newAttachments] });
                toast.success(`${newAttachments.length} berkas bukti dilampirkan.`);
            }
        } finally {
            setUploadingTaskId(null);
            if (fileInputRefs.current[taskId]) fileInputRefs.current[taskId].value = '';
        }
    };

    const handleRemoveAttachment = async (taskId, docId) => {
        const current = getApproval(taskId);
        const target = (current.attachments || []).find(d => d.id === docId);
        patchApproval(taskId, { attachments: (current.attachments || []).filter(d => d.id !== docId) });
        toast('Berkas bukti dihapus.', { icon: '🗑️' });
        // Hapus juga dari server jika pernah diupload
        if (target?.docId) {
            try {
                await documentService.delete(target.docId);
            } catch {
                // non-kritis — file di server tetap ada tapi tidak lagi di-referensikan
            }
        }
    };

    // Download dengan auth header (bukan langsung <a href> yang gagal 401).
    const downloadFile = async (doc) => {
        try {
            if (doc?.docId) {
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = doc.originalName || doc.name || 'bukti';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else if (doc?.url?.startsWith('blob:')) {
                const a = document.createElement('a');
                a.href = doc.url;
                a.download = doc.originalName || doc.name || 'bukti';
                a.click();
            } else {
                toast.info('Berkas belum tersedia untuk diunduh.');
            }
        } catch (err) {
            toast.error(`Gagal mengunduh bukti: ${err.message}`);
        }
    };

    // ── Buka pratinjau dalam aplikasi (modal) — download blob + tampilkan ──
    const [viewingDoc, setViewingDoc] = useState(null); // { doc, blobUrl }
    const [viewLoading, setViewLoading] = useState(false);

    const viewFile = async (doc) => {
        try {
            if (doc?.docId) {
                setViewLoading(true);
                const loadingId = toast.loading('Membuka berkas...');
                const blob = await documentService.download(doc.docId);
                const url = URL.createObjectURL(blob);
                setViewingDoc({ doc, blobUrl: url });
                toast.dismiss(loadingId);
                setViewLoading(false);
            } else if (doc?.url?.startsWith('blob:')) {
                setViewingDoc({ doc, blobUrl: doc.url });
            } else {
                toast.info('Berkas belum tersedia untuk dilihat.');
            }
        } catch (err) {
            setViewLoading(false);
            toast.error(`Gagal membuka bukti: ${err.message}`);
        }
    };

    const closeViewer = () => {
        setViewingDoc(null);
    };

    // ── Alur MUNDUR: Revisi ────────────────────────────────────────────────
    // Catatan: jejak revisedAt/revisedBy diisi oleh wizard SETELAH API sukses,
    // jadi di sini cukup meneruskan task ke wizard (modal arahan revisi).
    const handleRequestRevision = (task) => {
        if (readOnly) return;
        onRequestRevision?.(task);
    };

    const statusBadge = (st) => {
        const label = TASK_STATUS_LABEL[st] || st;
        const map = {
            done: 'bg-emerald-100 text-emerald-700',
            in_progress: 'bg-blue-100 text-blue-700',
            hold: 'bg-amber-100 text-amber-700',
            take_down: 'bg-red-100 text-red-700',
            todo: 'bg-gray-100 text-gray-600',
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${map[st] || 'bg-gray-100 text-gray-600'}`}>
                {label}
            </span>
        );
    };

    if (tasks.length === 0) {
        return (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-center text-xs text-indigo-700">
                <Check size={24} className="mx-auto mb-2 text-indigo-500" />
                {isTargetedRetest
                    ? 'Tidak ada task Change Request Mayor yang valid pada scope SIT ulang ini.'
                    : 'Belum ada task developer yang tercatat di proyek ini. Buat task terlebih dahulu pada tab Manajemen Task.'}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Ringkasan status persetujuan */}
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs ${allApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <div className="flex items-center gap-2 font-semibold">
                    {allApproved ? <Check size={15} className="text-emerald-600" /> : <AlertCircle size={15} className="text-amber-600" />}
                    {allApproved
                        ? `Semua ${tasks.length} task dalam scope disetujui — SIT dapat lanjut ke Review & Sign-Off.`
                        : `${approvedCount} dari ${tasks.length} task dalam scope disetujui. Lanjut hanya jika semuanya dicentang OK.`}
                </div>
            </div>

            {/* Tabel task */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                        <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 text-[11px] font-bold uppercase">
                            <th className="p-3 text-center w-14">OK</th>
                            <th className="p-3">Task</th>
                            <th className="p-3">Assignee</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 w-64">Komentar / Temuan</th>
                            <th className="p-3 w-48">Lampiran Bukti</th>
                            <th className="p-3 text-center w-40">Revisi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                        {tasks.map(task => {
                            const a = getApproval(task.id);
                            const isOk = a.approved;
                            const approvedAt = fmtDateTime(a.approvedAt);
                            const revisedAt = fmtDateTime(a.revisedAt);
                            return (
                                <tr key={task.id} className={`align-top hover:bg-gray-50 transition-colors ${isOk ? 'bg-emerald-50/30' : ''}`}>
                                    {/* OK */}
                                    <td className="p-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleOk(task.id)}
                                            disabled={readOnly}
                                            title={isOk ? 'Batalkan persetujuan' : 'Setujui task lolos SIT'}
                                            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all mx-auto ${readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${isOk ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-200' : 'bg-white border-gray-300 text-gray-300 hover:border-emerald-400 hover:text-emerald-400'}`}
                                        >
                                            <Check size={18} />
                                        </button>
                                        {isOk && approvedAt && (
                                            <div className="mt-1 flex flex-col items-center gap-0.5 text-[9px] text-emerald-600">
                                                <CalendarCheck size={10} />
                                                <span className="font-semibold leading-tight">{approvedAt}</span>
                                                <span className="text-emerald-500">oleh {a.approvedBy || 'PM'}</span>
                                            </div>
                                        )}
                                        {revisedAt && !isOk && (
                                            <div className="mt-1 flex flex-col items-center gap-0.5 text-[9px] text-orange-500">
                                                <RotateCcw size={10} />
                                                <span className="font-semibold leading-tight">Revisi {revisedAt}</span>
                                            </div>
                                        )}
                                    </td>
                                    {/* Task */}
                                    <td className="p-3">
                                        <p className="font-semibold text-gray-800">{task.title}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                            Prioritas: <span className={`font-semibold ${task.priority === 'High' ? 'text-red-500' : task.priority === 'Low' ? 'text-gray-500' : 'text-amber-500'}`}>{task.priority}</span>
                                        </p>
                                        {task.revisionNote && (
                                            <p className="text-[10px] text-orange-600 mt-1 flex items-start gap-1 bg-orange-50 border border-orange-100 rounded-lg p-1.5">
                                                <RotateCcw size={10} className="mt-0.5 shrink-0" /> {task.revisionNote}
                                            </p>
                                        )}
                                    </td>
                                    {/* Assignee */}
                                    <td className="p-3">
                                        <div className="flex items-center gap-1.5 text-gray-600">
                                            <User size={12} className="text-gray-400" />
                                            {task.assigneeName}
                                        </div>
                                    </td>
                                    {/* Status */}
                                    <td className="p-3 text-center">{statusBadge(task.status)}</td>
                                    {/* Komentar / Temuan */}
                                    <td className="p-3 w-64">
                                        <textarea
                                            rows={2}
                                            value={comments[task.id] || ''}
                                            onChange={e => handleCommentChange(task.id, e.target.value)}
                                            onBlur={() => handleSaveComment(task.id)}
                                            disabled={readOnly}
                                            placeholder="Catatan temuan, bukti hasil uji, dsb..."
                                            className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[11px] outline-none focus:border-indigo-400 resize-y min-h-[44px] disabled:bg-gray-100"
                                        />
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <label className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${readOnly || uploadingTaskId === task.id ? 'cursor-wait opacity-60' : 'cursor-pointer'} bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100`}>
                                                {uploadingTaskId === task.id ? (
                                                    <>
                                                        <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                                        Mengunggah...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Paperclip size={11} />
                                                        {isOk ? 'Tambah Bukti' : 'Lampirkan Bukti'}
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                                    ref={el => { fileInputRefs.current[task.id] = el; }}
                                                    onChange={e => handlePickFiles(task.id, e.target.files)}
                                                    className="hidden"
                                                    disabled={readOnly || uploadingTaskId === task.id}
                                                />
                                            </label>
                                            <span className="text-[10px] text-gray-400">
                                                {(a.attachments || []).length} berkas
                                            </span>
                                        </div>
                                    </td>
                                    {/* Lampiran Bukti */}
                                    <td className="p-3 w-56">
                                        {(a.attachments || []).length === 0 ? (
                                            <div className="flex flex-col items-center justify-center gap-1 py-3 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/60 text-center">
                                                <Paperclip size={16} className="text-gray-300" />
                                                <span className="text-[10px] font-semibold text-gray-400">Belum ada</span>
                                                <span className="text-[9px] text-gray-300">Bukti dilampirkan per task</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                                                    <Paperclip size={10} /> {(a.attachments || []).length} Berkas
                                                </span>
                                                {(a.attachments || []).map(doc => (
                                                    <div key={doc.id} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-lg border border-gray-100 hover:border-indigo-200 transition-all group">
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
                                                                    <button onClick={() => viewFile(doc)} title="Lihat" disabled={viewLoading}
                                                                        className="p-1 text-gray-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50">
                                                                        {viewLoading ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full inline-block animate-spin" /> : <Eye size={12} />}
                                                                    </button>
                                                                    <button onClick={() => downloadFile(doc)} title="Unduh"
                                                                        className="p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer">
                                                                        <Download size={12} />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {!readOnly && (
                                                                <button onClick={() => handleRemoveAttachment(task.id, doc.id)} title="Hapus"
                                                                    className="p-1 text-gray-500 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    {/* Revisi */}
                                    <td className="p-3 text-center w-40">
                                        <div className="flex flex-col items-center gap-1.5">
                                            {task.revisionNote ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-orange-100 border border-orange-300 text-orange-800 w-full justify-center">
                                                    <RotateCcw size={11} /> Sedang Direvisi
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-gray-100 border border-gray-200 text-gray-500 w-full justify-center">
                                                    Belum ada
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleRequestRevision(task)}
                                                disabled={readOnly}
                                                className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 border border-orange-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm w-full justify-center"
                                            >
                                                <RotateCcw size={12} /> Revisi
                                            </button>
                                            <p className="text-[9px] text-gray-400">Kembalikan ke developer</p>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Modal Pratinjau Berkas (in-app) ── */}
            {viewingDoc && (
                <div className="fixed inset-0 z-[99997] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50/70">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-[9px] shrink-0">
                                    {(viewingDoc.doc?.type || 'FILE')}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-800 truncate">{viewingDoc.doc?.originalName || viewingDoc.doc?.name}</p>
                                    <p className="text-[10px] text-gray-400">{viewingDoc.doc?.size}</p>
                                </div>
                            </div>
                            <button onClick={closeViewer} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-gray-100 p-4">
                            {viewingDoc.blobUrl && (
                                <iframe
                                    src={viewingDoc.blobUrl}
                                    title="Pratinjau Berkas"
                                    className="w-full h-[60vh] rounded-xl bg-white border border-gray-200"
                                />
                            )}
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50/70">
                            <button onClick={() => downloadFile(viewingDoc.doc)} className="px-4 py-2 bg-[#00529C] hover:bg-[#004080] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                                <Download size={13} /> Unduh Berkas
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
