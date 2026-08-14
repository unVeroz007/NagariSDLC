// src/components/SITTaskExecution.jsx
// Tabel eksekusi task untuk tahap SIT "Eksekusi Pengujian".
// Setiap task developer ditampilkan dengan:
//   a) Checkbox "Setuju/OK" (tanda tim menyetujui task lolos SIT)
//   b) Kolom komentar / catatan temuan
//   c) Tombol "Kembalikan/Revisi" (memundurkan status task ke developer + simpan catatan revisi)
import { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Check, AlertCircle, RotateCcw, MessageSquare, User, Clock } from 'lucide-react';
import { taskService } from '../services/api';

const TASK_STATUS_LABEL = {
    todo: 'Belum Mulai',
    in_progress: 'Sedang Dikerjakan',
    hold: 'Hold',
    done: 'Selesai',
    take_down: 'Take Down',
};

export default function SITTaskExecution({ project, approvals, onApprovalsChange }) {
    // Semua task proyek (dari project.tasks yang di-embed)
    const tasks = useMemo(() => {
        if (!Array.isArray(project?.tasks)) return [];
        return project.tasks
            .map(t => ({
                id: t.id,
                title: t.title || t.name || 'Task',
                status: t.status || 'todo',
                assigneeName: t.assignee_detail?.name || t.assignee || 'Belum Dialokasi',
                priority: t.priority || 'Medium',
                revisionNote: t.revision_note || '',
            }))
            // Abaikan task TAKE DOWN (tidak dihitung sebagai syarat SIT)
            .filter(t => t.status !== 'take_down');
    }, [project?.tasks]);

    // Local state komentar per task (untuk input realtime sebelum disimpan)
    const [comments, setComments] = useState({});
    const [revisionModal, setRevisionModal] = useState(null); // { taskId, title, note }
    const [busyId, setBusyId] = useState(null);

    const approvedCount = tasks.filter(t => approvals?.[t.id] === true).length;
    const allApproved = tasks.length > 0 && approvedCount === tasks.length;

    // Inisialisasi komentar dari approvals yang tersimpan
    useEffect(() => {
        const init = {};
        (project?.tasks || []).forEach(t => {
            if (approvals?.[t.id]?.note) init[t.id] = approvals[t.id].note;
        });
        setComments(init);
    }, [project?.id, approvals]);

    const handleToggleOk = (taskId) => {
        const next = { ...(approvals || {}) };
        if (next[taskId] && next[taskId] === true) {
            delete next[taskId];
        } else {
            next[taskId] = true;
        }
        onApprovalsChange?.(next);
    };

    const handleCommentChange = (taskId, val) => {
        setComments(prev => ({ ...prev, [taskId]: val }));
    };

    const handleSaveComment = (taskId) => {
        const note = (comments[taskId] || '').trim();
        const next = { ...(approvals || {}) };
        next[taskId] = { approved: !!next[taskId], note };
        onApprovalsChange?.(next);
        toast.success('Komentar task disimpan.');
    };

    const handleRequestRevision = async () => {
        if (!revisionModal) return;
        if (!revisionModal.note?.trim()) {
            toast.error('Catatan revisi wajib diisi!');
            return;
        }
        setBusyId(revisionModal.taskId);
        try {
            await taskService.requestRevision(revisionModal.taskId, revisionModal.note.trim());
            toast.success(`Task "${revisionModal.title}" dikembalikan ke developer untuk revisi.`);
            // Hapus approval task ini (dianggap belum OK)
            const next = { ...(approvals || {}) };
            delete next[revisionModal.taskId];
            onApprovalsChange?.(next);
            setRevisionModal(null);
        } catch (err) {
            toast.error(`Gagal mengirim revisi: ${err.message}`);
        } finally {
            setBusyId(null);
        }
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
                Belum ada task developer yang tercatat di proyek ini. Buat task terlebih dahulu pada tab Manajemen Task.
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
                        ? `Semua ${tasks.length} task disetujui — SIT dapat lanjut ke Review & Sign-Off.`
                        : `${approvedCount} dari ${tasks.length} task disetujui. Lanjut hanya jika SEMUA task dicentang OK.`}
                </div>
            </div>

            {/* Tabel task */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                <table className="w-full text-left border-collapse min-w-[760px]">
                    <thead>
                        <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 text-[11px] font-bold uppercase">
                            <th className="p-3 text-center w-12">OK</th>
                            <th className="p-3">Task</th>
                            <th className="p-3">Assignee</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 w-56">Komentar / Temuan</th>
                            <th className="p-3 text-center">Revisi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                        {tasks.map(task => {
                            const isOk = approvals?.[task.id] === true;
                            return (
                                <tr key={task.id} className={`hover:bg-gray-50 transition-colors ${isOk ? 'bg-emerald-50/30' : ''}`}>
                                    <td className="p-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleOk(task.id)}
                                            title={isOk ? 'Batalkan persetujuan' : 'Setujui task lolos SIT'}
                                            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer mx-auto ${isOk ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300 text-gray-300 hover:border-emerald-400 hover:text-emerald-400'}`}
                                        >
                                            <Check size={16} />
                                        </button>
                                    </td>
                                    <td className="p-3">
                                        <p className="font-semibold text-gray-800">{task.title}</p>
                                        {task.revisionNote && (
                                            <p className="text-[10px] text-orange-600 mt-0.5 flex items-center gap-1">
                                                <RotateCcw size={10} /> Revisi terakhir: {task.revisionNote}
                                            </p>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-1.5 text-gray-600">
                                            <User size={12} className="text-gray-400" />
                                            {task.assigneeName}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">{statusBadge(task.status)}</td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-1.5">
                                            <MessageSquare size={12} className="text-gray-400 shrink-0" />
                                            <input
                                                type="text"
                                                value={comments[task.id] || ''}
                                                onChange={e => handleCommentChange(task.id, e.target.value)}
                                                onBlur={() => handleSaveComment(task.id)}
                                                placeholder="Catatan temuan (opsional)..."
                                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] outline-none focus:border-indigo-400"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setRevisionModal({ taskId: task.id, title: task.title, note: '' })}
                                            disabled={busyId === task.id}
                                            className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <RotateCcw size={12} /> {busyId === task.id ? 'Mengirim...' : 'Revisi'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal konfirmasi revisi */}
            {revisionModal && (
                <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                                <RotateCcw size={20} className="text-orange-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-base">Kembalikan Task untuk Revisi</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Task <strong>"{revisionModal.title}"</strong> akan dikirim kembali ke developer yang bertanggung jawab.</p>
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                Catatan Arahan Revisi <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={4}
                                value={revisionModal.note}
                                onChange={e => setRevisionModal({ ...revisionModal, note: e.target.value })}
                                placeholder="Jelaskan apa yang tidak sesuai, apa yang perlu diperbaiki, dan kriteria yang harus dipenuhi..."
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-orange-500 resize-none"
                                autoFocus
                            />
                            {!revisionModal.note?.trim() && <p className="text-xs text-red-500 mt-1">Catatan revisi wajib diisi.</p>}
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setRevisionModal(null)} disabled={!!busyId}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">
                                Batal
                            </button>
                            <button
                                onClick={handleRequestRevision}
                                disabled={!revisionModal.note?.trim() || !!busyId}
                                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                                {busyId ? 'Mengirim...' : 'Kirim ke Developer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
