import { useMemo, useState } from 'react';
import { useProjects } from '../contexts/ProjectContext';
import { qualityGateService } from '../services/api';
import ProjectTypeBadge from '../components/ProjectTypeBadge';
import toast from 'react-hot-toast';

import {
    CheckCircle,
    AlertTriangle,
    Shield,
    FileText,
    X,
    Server,
    Loader,
    ListChecks,
    User,
    Building,
    Timer,
    Calendar,
    XCircle,
} from 'lucide-react';

/**
 * Ikon per pilar kelayakan. Kuncinya sama dengan `key` yang dikirim
 * ReleaseReadinessService, sehingga penambahan pilar di backend cukup diikuti satu
 * entri di sini — dan pilar tanpa ikon tetap tampil memakai ikon bawaan.
 */
const PILLAR_ICONS = {
    requirements: FileText,
    qa: CheckCircle,
    cyber: Shield,
    release_plan: Server,
};

/**
 * Tampilan badge dan ikon per status pilar.
 *
 * Tiga status berasal dari backend: `ready` (terpenuhi), `attention` (sedang
 * berjalan atau baru sebagian), dan `missing` (belum ada buktinya). Sebelumnya
 * seluruh pilar selalu hijau karena isinya ditulis tetap di berkas ini.
 */
const PILLAR_APPEARANCE = {
    ready: {
        badge: 'bg-emerald-100 text-emerald-700',
        icon: 'text-emerald-500',
        Icon: CheckCircle,
    },
    attention: {
        badge: 'bg-amber-100 text-amber-700',
        icon: 'text-amber-500',
        Icon: AlertTriangle,
    },
    missing: {
        badge: 'bg-red-100 text-red-700',
        icon: 'text-red-500',
        Icon: XCircle,
    },
};

const appearanceOf = (status) => PILLAR_APPEARANCE[status] || PILLAR_APPEARANCE.missing;

const formatDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function QualityGate() {
    const { projects, refreshData } = useProjects();

    // Antrean Quality Gate hanya berisi proyek yang benar-benar sudah diajukan PM
    // ke Grup Infrastruktur. UAT_PASSED dikeluarkan karena statusnya adalah keluaran
    // UAT internal di Fase 2 — belum melewati sign-off QA & Keamanan Siber, sehingga
    // menampilkannya di sini berarti menawarkan persetujuan go-live untuk proyek yang
    // backend pasti tolak.
    const queueList = useMemo(
        () => projects.filter((p) => String(p.status || '').toUpperCase() === 'PENDING_GOLIVE'),
        [projects]
    );

    // Pilihan disimpan sebagai id, bukan objek proyek. Menyimpan objeknya membuat
    // panel detail menampilkan salinan basi setiap kali daftar proyek disegarkan
    // polling — termasuk setelah keputusan Head of IT sendiri tersimpan.
    const [selectedId, setSelectedId] = useState(null);
    const [decisionMode, setDecisionMode] = useState(null); // 'approve' | 'reject' | null
    const [approvalNotes, setApprovalNotes] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selected = useMemo(() => {
        if (queueList.length === 0) return null;
        return queueList.find((p) => String(p.id) === String(selectedId)) || queueList[0];
    }, [queueList, selectedId]);

    const release = selected?.releaseRequest || null;
    const readiness = selected?.releaseReadiness || null;
    const pillars = readiness?.pillars || [];
    const blocking = readiness?.blocking || [];

    const closeDialog = () => {
        setDecisionMode(null);
        setApprovalNotes('');
        setRejectionReason('');
    };

    const handleApprove = async () => {
        if (!selected) return;
        setIsSubmitting(true);
        try {
            await qualityGateService.approve(selected.id, approvalNotes.trim());
            toast.success(`Rilis ${selected.name} disetujui. Proyek berstatus LIVE_PRODUCTION.`);
            closeDialog();
            setSelectedId(null);
            await refreshData();
        } catch (err) {
            toast.error(err.message || 'Gagal menyetujui rilis.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!selected) return;
        const reason = rejectionReason.trim();
        if (reason.length < 10) {
            toast.error('Alasan penolakan minimal 10 karakter agar dapat ditindaklanjuti pengaju.');
            return;
        }
        setIsSubmitting(true);
        try {
            // Endpoint khusus Quality Gate: alasan tersimpan pada baris pengajuan
            // rilis beserta identitas penolaknya, dan transisi status ke REJECTED
            // tetap melewati ProjectWorkflowService.
            await qualityGateService.reject(selected.id, reason);
            toast.success(`Pengajuan rilis ${selected.name} ditolak dan dikembalikan ke pengaju.`);
            closeDialog();
            setSelectedId(null);
            await refreshData();
        } catch (err) {
            toast.error(err.message || 'Gagal menolak rilis.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!selected) {
        return (
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Tidak Ada Antrean Quality Gate</h2>
                    <p className="text-gray-500 mt-2">Belum ada pengajuan rilis yang menunggu keputusan go-live.</p>
                </div>
            </div>
        );
    }

    const targetReleaseDate = formatDate(release?.target_release_date) || formatDate(selected.targetDate);

    return (
        <div className="flex-1 overflow-y-auto bg-[#f8f9fb] p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-800">Quality Gate Approval</h1>
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <ListChecks size={14} /> Fase 4 Compliance
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Portal evaluasi final &amp; persetujuan rilis ke lingkungan produksi Bank Nagari.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Antrean Rilis */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                        <h2 className="font-bold text-gray-800 text-sm tracking-wide uppercase">
                            Antrean Permohonan Rilis ({queueList.length})
                        </h2>
                        <div className="space-y-3">
                            {queueList.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedId(item.id)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                        String(selected.id) === String(item.id)
                                            ? 'border-[#1a365d] bg-blue-50/40 ring-2 ring-[#1a365d]/10'
                                            : 'border-gray-100 hover:border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-mono font-bold text-gray-500">
                                            {item.reqId || item.id}
                                        </span>
                                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                            Menunggu Approval
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-gray-800 text-sm line-clamp-1">{item.name}</h3>
                                    {item.project_type && (
                                        <div className="mt-1.5"><ProjectTypeBadge type={item.project_type} /></div>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                        <Building size={12} />
                                        <span>{item.division || 'Belum ada data divisi'}</span>
                                    </div>
                                    {item.releaseReadiness && !item.releaseReadiness.is_ready && (
                                        <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-amber-700">
                                            <AlertTriangle size={12} />
                                            <span>{item.releaseReadiness.blocking.length} pilar perlu diperiksa</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Detail Checklist 4 Pilar */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                        <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div>
                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    {selected.reqId || selected.id}
                                </span>
                                <h2 className="text-xl font-bold text-gray-800 mt-1">{selected.name}</h2>
                                <p className="text-xs text-gray-500">
                                    {selected.division || 'Belum ada data divisi'} •{' '}
                                    {selected.type === 'RBB' ? 'Mayor Release (RBB)' : 'Minor Release'}
                                </p>
                                {selected.project_type && (
                                    <div className="mt-1.5"><ProjectTypeBadge type={selected.project_type} /></div>
                                )}
                            </div>
                            <div className="text-xs bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5 min-w-[240px]">
                                <div className="flex items-center gap-1.5">
                                    <User size={14} className="text-gray-400 shrink-0" />
                                    <span className="text-gray-500">Pengaju:</span>
                                    <span className="font-medium text-gray-700">
                                        {release?.requester?.name
                                            || (typeof selected.pm === 'object' ? selected.pm?.name : selected.pm)
                                            || 'Belum ditugaskan'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={14} className="text-gray-400 shrink-0" />
                                    <span className="text-gray-500">Target rilis:</span>
                                    <span className="font-medium text-gray-700">
                                        {targetReleaseDate || 'Belum ditentukan'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Timer size={14} className="text-gray-400 shrink-0" />
                                    <span className="text-gray-500">Downtime:</span>
                                    <span className="font-medium text-gray-700">
                                        {release?.downtime_estimate || 'Belum diisi pengaju'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Checklist 4 Pilar — dihitung backend dari data tersimpan */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Checklist 4 Pilar Kelayakan SDLC
                                </h3>
                                {readiness && (
                                    <span
                                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                            readiness.is_ready
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}
                                    >
                                        {readiness.is_ready ? 'Seluruh pilar terpenuhi' : `${blocking.length} pilar perlu diperiksa`}
                                    </span>
                                )}
                            </div>

                            {!readiness ? (
                                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-600">
                                    Penilaian kelayakan belum tersedia untuk proyek ini. Muat ulang halaman; bila tetap
                                    kosong, data pendukung (dokumen, laporan pengujian, pengajuan rilis) belum terbaca.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {pillars.map((pillar) => {
                                        const appearance = appearanceOf(pillar.status);
                                        const StatusIcon = appearance.Icon;
                                        const PillarIcon = PILLAR_ICONS[pillar.key] || FileText;
                                        return (
                                            <div
                                                key={pillar.key}
                                                className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-start gap-2.5">
                                                        <StatusIcon size={20} className={`${appearance.icon} shrink-0 mt-0.5`} />
                                                        <div>
                                                            <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                                                                <PillarIcon size={13} className="text-gray-400" />
                                                                {pillar.label}
                                                            </h4>
                                                            <p className="text-xs text-gray-500 mt-0.5">{pillar.description}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`${appearance.badge} px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap`}>
                                                        {pillar.status_label}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-600 leading-relaxed pl-[30px]">
                                                    {pillar.detail}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Rencana Rollback — apa adanya dari pengajuan PM */}
                        <div
                            className={`p-4 rounded-xl border ${
                                release?.rollback_plan
                                    ? 'bg-amber-50/50 border-amber-200/60'
                                    : 'bg-red-50/60 border-red-200'
                            }`}
                        >
                            <h3
                                className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ${
                                    release?.rollback_plan ? 'text-amber-800' : 'text-red-800'
                                }`}
                            >
                                <AlertTriangle
                                    size={14}
                                    className={release?.rollback_plan ? 'text-amber-600' : 'text-red-600'}
                                />
                                Rencana Rollback (Rollback Plan)
                            </h3>
                            <p
                                className={`text-xs leading-relaxed whitespace-pre-wrap ${
                                    release?.rollback_plan ? 'text-amber-900 font-mono' : 'text-red-900 font-semibold'
                                }`}
                            >
                                {release?.rollback_plan
                                    || 'Pengaju belum mengisi prosedur rollback. Keputusan go-live tanpa prosedur pemulihan berarti tidak ada rencana bila deployment gagal.'}
                            </p>
                        </div>

                        {/* Catatan rilis dari pengaju, bila ada */}
                        {release?.notes && (
                            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                    Catatan Rilis dari Pengaju
                                </h3>
                                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{release.notes}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setDecisionMode('reject')}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                <X size={16} /> Tolak Rilis
                            </button>
                            <button
                                onClick={() => setDecisionMode('approve')}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
                            >
                                <CheckCircle size={16} /> Approve Rilis Produksi
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dialog keputusan Quality Gate */}
            {decisionMode && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-100">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">
                                    {decisionMode === 'approve' ? 'Setujui Rilis Produksi' : 'Tolak Pengajuan Rilis'}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {selected.reqId || selected.id} • {selected.name}
                                </p>
                            </div>
                            <button
                                onClick={closeDialog}
                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
                                type="button"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {decisionMode === 'approve' ? (
                            <>
                                {blocking.length > 0 && (
                                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                                        <p className="font-bold flex items-center gap-1.5 mb-1">
                                            <AlertTriangle size={14} /> Pilar yang belum terpenuhi
                                        </p>
                                        <ul className="list-disc pl-5 space-y-0.5">
                                            {blocking.map((label) => (
                                                <li key={label}>{label}</li>
                                            ))}
                                        </ul>
                                        <p className="mt-2">
                                            Persetujuan tetap dapat diberikan sebagai kewenangan Head of IT, dan catatan
                                            di bawah akan tersimpan pada riwayat status proyek.
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                        Catatan Persetujuan (opsional)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={approvalNotes}
                                        onChange={(e) => setApprovalNotes(e.target.value)}
                                        placeholder="Contoh: disetujui dengan pemantauan ketat 24 jam pertama setelah deployment."
                                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    />
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Alasan Penolakan <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Jelaskan apa yang harus diperbaiki pengaju sebelum rilis diajukan kembali (minimal 10 karakter)."
                                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-200"
                                />
                                <p className="text-[11px] text-gray-500 mt-1.5">
                                    Alasan ini tersimpan pada pengajuan rilis dan riwayat status proyek, lalu proyek
                                    berpindah ke status REJECTED.
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={closeDialog}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={decisionMode === 'approve' ? handleApprove : handleReject}
                                disabled={isSubmitting}
                                className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 ${
                                    decisionMode === 'approve'
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {isSubmitting ? <Loader size={14} className="animate-spin" /> : null}
                                {decisionMode === 'approve' ? 'Setujui Go-Live' : 'Tolak Rilis'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
