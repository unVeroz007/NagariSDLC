import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck,
    Clock3, Loader2, RefreshCw, ShieldCheck, UserCheck, XCircle,
} from 'lucide-react';
import { internalUatApprovalService } from '../../services/api';

const formatDate = (value) => value
    ? new Date(value).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
    : '-';

const STATUS_PRESENTATION = {
    pending: { label: 'Menunggu keputusan Anda', classes: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock3 },
    approved: { label: 'Sudah disetujui', classes: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
    rejected: { label: 'Ditolak / revisi', classes: 'border-red-200 bg-red-50 text-red-700', icon: XCircle },
};

function ApprovalAssignmentCard({ assignment, onOpen }) {
    const presentation = STATUS_PRESENTATION[assignment.status] || STATUS_PRESENTATION.pending;
    const StatusIcon = presentation.icon;
    const summary = assignment.summary || {};

    return (
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <div className="border-b border-slate-100 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-[#00529C]">{assignment.project.req_id}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${presentation.classes}`}>
                                <StatusIcon size={11} /> {presentation.label}
                            </span>
                        </div>
                        <h2 className="mt-2 text-base font-bold text-slate-800">{assignment.project.title}</h2>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{assignment.project.description || 'Tidak ada deskripsi proyek.'}</p>
                    </div>
                    <div className="shrink-0 rounded-xl bg-blue-50 px-3 py-2 text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">Tugas Anda</p>
                        <p className="mt-0.5 text-xs font-bold text-blue-800">{assignment.approval_role_label}</p>
                    </div>
                </div>
            </div>

            <div className="p-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                        ['Dieksekusi', summary.executedCount ?? 0],
                        ['Diterima', summary.acceptedCount ?? 0],
                        ['Revisi Minor', summary.minorCount ?? 0],
                        ['Revisi Mayor', summary.majorCount ?? 0],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-slate-50 p-3 text-center">
                            <p className="text-lg font-bold text-slate-800">{value}</p>
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                    <p><strong className="text-slate-700">Unit:</strong> {assignment.project.division || '-'}</p>
                    <p><strong className="text-slate-700">Tanggal UAT:</strong> {assignment.project.uat_date || '-'}</p>
                    <p><strong className="text-slate-700">Putaran:</strong> {assignment.round.number}</p>
                </div>

                {assignment.decision_note ? (
                    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs italic text-slate-600">“{assignment.decision_note}” · {formatDate(assignment.decided_at)}</p>
                ) : null}

                <button type="button" onClick={() => onOpen(assignment)}
                    className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-colors ${assignment.status === 'pending' ? 'bg-[#00529C] hover:bg-[#003f79]' : 'bg-slate-600 hover:bg-slate-700'}`}>
                    {assignment.status === 'pending' ? <UserCheck size={16} /> : <ClipboardCheck size={16} />}
                    {assignment.status === 'pending' ? 'Tinjau Detail & Beri Keputusan' : 'Lihat Detail Persetujuan'}
                    <ArrowRight size={15} />
                </button>
            </div>
        </article>
    );
}

export default function InternalUatApprovals() {
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [filter, setFilter] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadAssignments = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await internalUatApprovalService.getMyAssignments();
            setAssignments(response?.data?.items || []);
            setPendingCount(response?.data?.pending_count || 0);
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        internalUatApprovalService.getMyAssignments()
            .then(response => {
                if (cancelled) return;
                setAssignments(response?.data?.items || []);
                setPendingCount(response?.data?.pending_count || 0);
            })
            .catch(loadError => {
                if (!cancelled) setError(loadError.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const visibleAssignments = filter === 'pending'
        ? assignments.filter(assignment => assignment.status === 'pending')
        : assignments;

    const openAssignment = (assignment) => {
        navigate(`/pm/tasks/${assignment.project.id}?tab=sit_uat&uatStep=3&from=uat-approvals`);
    };

    return (
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
            <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#003a73] to-[#005ca8] p-6 text-white shadow-lg">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-white/15 p-3"><ShieldCheck size={24} /></div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Approval Internal</p>
                            <h1 className="mt-1 text-2xl font-bold">Persetujuan UAT Saya</h1>
                            <p className="mt-1 max-w-2xl text-sm text-blue-100">Seluruh proyek yang menunggu keputusan Anda tersedia di satu tempat. Tinjau hasil, dokumen final, dan matrix approval sebelum menyetujui atau meminta revisi.</p>
                        </div>
                    </div>
                    <div className="rounded-xl bg-white/10 px-5 py-3 text-center">
                        <p className="text-3xl font-bold">{pendingCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-100">Perlu Keputusan</p>
                    </div>
                </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    <button type="button" onClick={() => setFilter('pending')} className={`rounded-lg px-4 py-2 text-xs font-bold ${filter === 'pending' ? 'bg-[#00529C] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Perlu Keputusan ({pendingCount})</button>
                    <button type="button" onClick={() => setFilter('all')} className={`rounded-lg px-4 py-2 text-xs font-bold ${filter === 'all' ? 'bg-[#00529C] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Putaran Aktif ({assignments.length})</button>
                </div>
                <button type="button" onClick={loadAssignments} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:text-slate-300">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Perbarui
                </button>
            </div>

            {loading ? (
                <div className="flex min-h-72 items-center justify-center"><Loader2 className="animate-spin text-[#00529C]" size={30} /></div>
            ) : error ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><AlertCircle size={18} className="mb-2" />{error}</div>
            ) : visibleAssignments.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <CheckCircle2 className="mx-auto text-emerald-500" size={36} />
                    <h2 className="mt-3 font-bold text-slate-700">Tidak ada approval yang menunggu</h2>
                    <p className="mt-1 text-sm text-slate-400">Assignment baru akan muncul otomatis ketika PM memulai Persetujuan Final UAT.</p>
                </div>
            ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {visibleAssignments.map(assignment => <ApprovalAssignmentCard key={assignment.id} assignment={assignment} onOpen={openAssignment} />)}
                </div>
            )}
        </div>
    );
}
