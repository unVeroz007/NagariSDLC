import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Clock3,
    ListChecks, Loader2, RefreshCw, ShieldCheck, Target, UserCheck, XCircle,
} from 'lucide-react';
import { internalSitApprovalService, internalUatApprovalService, projectService } from '../../services/api';

const formatDate = (value) => value
    ? new Date(value).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
    : '-';

/**
 * Format tanggal tanpa jam.
 *
 * Kedua jalur mengirim tanggal dengan bentuk yang berbeda: `uat_date` berasal dari
 * `sit_uat_data.uat1_startDate`, yaitu nilai `<input type="date">` berformat
 * `YYYY-MM-DD`, sedangkan `sit_date` berasal dari `sit2_submitted_at` yang berformat
 * ISO lengkap. Keduanya tetap harus terbaca sebagai tanggal berbahasa Indonesia, bukan
 * "2026-08-14". Nilai yang tidak dapat diurai dikembalikan utuh, bukan menjadi
 * "Invalid Date".
 */
const formatDateOnly = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? String(value)
        : parsed.toLocaleDateString('id-ID', { dateStyle: 'long' });
};

/**
 * Ambil satu sumber inbox dan ubah kegagalannya menjadi bagian dari hasil, bukan
 * penolakan promise.
 *
 * Seseorang bisa memegang slot persetujuan UAT tanpa memegang slot SIT, dan
 * sebaliknya. Karena itu gangguan pada satu endpoint tidak boleh mengosongkan daftar
 * milik jalur yang lain — error dibawa sebagai nilai supaya `Promise.all` di bawah
 * selalu selesai dan kartu yang berhasil dimuat tetap tampil. Akun yang memang tidak
 * punya slot tetap dijawab sukses oleh backend dengan `pending_count: 0`, jadi keadaan
 * itu bukan error dan tidak perlu ditangani di sini.
 */
const loadSource = (loader) => loader()
    .then((result) => ({ ...result, error: '' }))
    .catch((loadError) => ({ items: [], pendingCount: 0, error: loadError.message }));

/**
 * Inbox persetujuan SIT. `internalSitApprovalService` sudah membuka envelope dan
 * langsung mengembalikan `{ pending_count, items }`, berbeda dengan layanan UAT di
 * bawah yang masih meneruskan seluruh envelope `{ status, message, data }`.
 */
const fetchSitAssignments = () => internalSitApprovalService.getMyAssignments()
    .then((data) => ({
        items: data?.items || [],
        pendingCount: data?.pending_count || 0,
    }));

/** Inbox persetujuan UAT internal pada putaran approval yang sedang aktif. */
const fetchUatAssignments = () => internalUatApprovalService.getMyAssignments()
    .then((response) => ({
        items: response?.data?.items || [],
        pendingCount: response?.data?.pending_count || 0,
    }));

/** Kedua jalur diminta serentak supaya halaman tidak menunggu dua kali bolak-balik. */
const fetchAllSources = () => Promise.all([
    loadSource(fetchSitAssignments),
    loadSource(fetchUatAssignments),
]).then(([sit, uat]) => ({ sit, uat }));

const EMPTY_SOURCE = { items: [], pendingCount: 0, error: '' };

/** Yang belum diputuskan didahulukan setelah kedua daftar disatukan. */
const byPendingFirst = (first, second) =>
    (first.status === 'pending' ? 0 : 1) - (second.status === 'pending' ? 0 : 1);

const STATUS_PRESENTATION = {
    pending: { label: 'Menunggu keputusan Anda', classes: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock3 },
    approved: { label: 'Sudah disetujui', classes: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
    rejected: { label: 'Ditolak / revisi', classes: 'border-red-200 bg-red-50 text-red-700', icon: XCircle },
};

/**
 * Penanda jalur persetujuan.
 *
 * Satu inbox memuat dua tanda tangan yang akibatnya sangat berbeda — SIT menutup
 * pengujian integrasi internal, UAT menutup penerimaan pengguna — sehingga jenisnya
 * harus terbaca sebelum seseorang menekan tombol setuju. Warnanya mengikuti wizard
 * SIT/UAT: SIT teal, UAT biru.
 */
const KIND_PRESENTATION = {
    sit: { label: 'SIT', title: 'Persetujuan SIT', classes: 'border-teal-200 bg-teal-50 text-teal-700' },
    uat: { label: 'UAT', title: 'Persetujuan UAT', classes: 'border-blue-200 bg-blue-50 text-blue-700' },
};

/**
 * Cakupan pengujian SIT.
 *
 * `targeted_retest` adalah pengujian ulang atas sebagian task saja, jadi angka
 * "total task" pada kartu memang lebih kecil dari jumlah task proyek. Tanpa keterangan
 * ini, penyetuju mudah membaca angka tersebut sebagai cakupan yang menyusut karena
 * kekeliruan.
 */
const SIT_SCOPE_PRESENTATION = {
    targeted_retest: {
        label: 'SIT ulang terbatas',
        hint: 'Hanya task yang diperbaiki setelah temuan UAT yang diuji ulang, bukan seluruh task proyek.',
        classes: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    full: {
        label: 'Cakupan penuh',
        hint: 'Seluruh task proyek ini termasuk dalam cakupan pengujian SIT.',
        classes: 'border-slate-200 bg-slate-50 text-slate-600',
    },
};

function MetricTile({ label, value }) {
    return (
        <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-lg font-bold text-slate-800">{value}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        </div>
    );
}

/** Satu slot tanda tangan SIT beserta keadaannya. */
function SlotChip({ label, done, detail }) {
    return (
        <div className={`rounded-xl border p-2.5 ${done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <p className={`flex items-center gap-1 text-[10px] font-bold ${done ? 'text-emerald-700' : 'text-slate-500'}`}>
                {done ? <CheckCircle2 size={11} /> : <Clock3 size={11} />} {label}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>
        </div>
    );
}

/**
 * Isi kartu untuk assignment SIT: progres task, temuan, cakupan, dan ketiga slot
 * tanda tangan supaya penyetuju tahu siapa lagi yang masih ditunggu.
 */
function SitSummaryBody({ assignment }) {
    const summary = assignment.summary || {};
    const scope = SIT_SCOPE_PRESENTATION[summary.scopeMode] || SIT_SCOPE_PRESENTATION.full;

    return (
        <>
            <div className="grid grid-cols-2 gap-2">
                <MetricTile label="Task Disetujui" value={`${summary.approvedTask ?? 0}/${summary.totalTask ?? 0}`} />
                <MetricTile label="Task Bertemuan" value={summary.defectTask ?? 0} />
            </div>

            <div className={`mt-3 rounded-xl border p-3 ${scope.classes}`}>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
                    <Target size={12} /> {scope.label}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed">{scope.hint}</p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <SlotChip
                    label="Developer"
                    done={(summary.developerRequired ?? 0) > 0 && summary.developerApproved >= summary.developerRequired}
                    detail={`${summary.developerApproved ?? 0} dari ${summary.developerRequired ?? 0} developer`}
                />
                <SlotChip
                    label="Analyst / Project Manager"
                    done={summary.pmApproved === true}
                    detail={summary.pmApproved === true ? 'Sudah menyetujui' : 'Belum menyetujui'}
                />
                <SlotChip
                    label="Pimpinan Grup Pengembangan"
                    done={summary.developmentLeadApproved === true}
                    detail={summary.developmentLeadApproved === true ? 'Sudah menyetujui' : 'Belum menyetujui'}
                />
            </div>

            <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <p><strong className="text-slate-700">Unit:</strong> {assignment.project.division || '-'}</p>
                <p><strong className="text-slate-700">Eksekusi SIT selesai:</strong> {formatDateOnly(assignment.project.sit_date)}</p>
            </div>
        </>
    );
}

/** Isi kartu untuk assignment UAT: rekap hasil eksekusi skenario dan putaran approval. */
function UatSummaryBody({ assignment }) {
    const summary = assignment.summary || {};

    return (
        <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                    ['Dieksekusi', summary.executedCount ?? 0],
                    ['Diterima', summary.acceptedCount ?? 0],
                    ['Revisi Minor', summary.minorCount ?? 0],
                    ['Revisi Mayor', summary.majorCount ?? 0],
                ].map(([label, value]) => <MetricTile key={label} label={label} value={value} />)}
            </div>

            <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <p><strong className="text-slate-700">Unit:</strong> {assignment.project.division || '-'}</p>
                <p><strong className="text-slate-700">Tanggal UAT:</strong> {formatDateOnly(assignment.project.uat_date)}</p>
                <p><strong className="text-slate-700">Putaran:</strong> {assignment.round?.number ?? '-'}</p>
            </div>
        </>
    );
}

function ApprovalAssignmentCard({ assignment, onOpenWizard, onApproveSit }) {
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const presentation = STATUS_PRESENTATION[assignment.status] || STATUS_PRESENTATION.pending;
    const kind = KIND_PRESENTATION[assignment.kind] || KIND_PRESENTATION.uat;
    const StatusIcon = presentation.icon;
    const isSit = assignment.kind === 'sit';
    const isPending = assignment.status === 'pending';

    /**
     * `onApproveSit` selalu selesai dengan boolean dan tidak pernah ditolak, sehingga
     * hasilnya cukup dibaca dari `then` tanpa penanganan penolakan di sini.
     */
    const submitSitApproval = () => {
        setSubmitting(true);
        onApproveSit(assignment, note.trim())
            .then((saved) => { if (saved) setNote(''); })
            .finally(() => setSubmitting(false));
    };

    return (
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <div className="border-b border-slate-100 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${kind.classes}`}>
                                {kind.label}
                            </span>
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
                        <p className="mt-0.5 text-xs font-bold text-blue-800">{kind.title}</p>
                        <p className="text-[10px] font-semibold text-blue-600">{assignment.approval_role_label}</p>
                    </div>
                </div>
            </div>

            <div className="p-5">
                {isSit ? <SitSummaryBody assignment={assignment} /> : <UatSummaryBody assignment={assignment} />}

                {assignment.decided_at || assignment.decision_note ? (
                    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs italic text-slate-600">
                        {assignment.decision_note ? `“${assignment.decision_note}” · ` : 'Keputusan Anda tercatat · '}
                        {formatDate(assignment.decided_at)}
                    </p>
                ) : null}

                {/*
                  * Persetujuan SIT diselesaikan di halaman ini. Inilah inti permintaan
                  * pemilik produk: sebelumnya tanda tangan SIT hanya bisa diberikan lewat
                  * pop-up di dalam wizard, sehingga menyetujui banyak proyek berarti
                  * membuka dan menutup detail proyek satu per satu. Tombol tolak tidak
                  * pernah dirender karena `can_reject` pada assignment SIT selalu false —
                  * temuan dicatat per task pada Tahap 2, lalu proyek dipindahkan ke
                  * SIT_REVISION.
                  */}
                {isSit && isPending ? (
                    <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold text-teal-800">
                            <UserCheck size={13} /> Setujui SIT sebagai {assignment.approval_role_label}
                        </p>
                        <textarea
                            rows={2}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Catatan persetujuan (opsional)..."
                            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
                        />
                        <button type="button" onClick={submitSitApproval} disabled={submitting}
                            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-700 disabled:bg-slate-300">
                            {submitting
                                ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</>
                                : <><CheckCircle2 size={16} /> Setujui SIT</>}
                        </button>
                    </div>
                ) : null}

                {/*
                  * Bukti UAT yang harus dibaca sebelum menandatangani berada di wizard, jadi
                  * jalur UAT tetap memakai tautan dalam. Untuk SIT tautan yang sama menjadi
                  * jalan memeriksa bukti per task sebelum menyetujui, karena itu sifatnya
                  * sekunder.
                  */}
                <button type="button" onClick={() => onOpenWizard(assignment)}
                    className={isSit
                        ? 'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50'
                        : `mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-colors ${isPending ? 'bg-[#00529C] hover:bg-[#003f79]' : 'bg-slate-600 hover:bg-slate-700'}`}>
                    {isSit
                        ? <><ListChecks size={15} /> Lihat Detail SIT</>
                        : <>
                            {isPending ? <UserCheck size={16} /> : <ClipboardCheck size={16} />}
                            {isPending ? 'Tinjau Detail & Beri Keputusan' : 'Lihat Detail Persetujuan'}
                            <ArrowRight size={15} />
                        </>}
                </button>
            </div>
        </article>
    );
}

export default function MyApprovals() {
    const navigate = useNavigate();
    const [sources, setSources] = useState({ sit: EMPTY_SOURCE, uat: EMPTY_SOURCE });
    const [kindFilter, setKindFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [loading, setLoading] = useState(true);

    /**
     * Muat ulang hanya inbox SIT.
     *
     * Dipakai setelah persetujuan SIT tersimpan supaya kartunya berpindah ke keadaan
     * "sudah disetujui" tanpa memuat ulang jalur UAT yang tidak berubah.
     */
    const refreshSit = useCallback(() => loadSource(fetchSitAssignments)
        .then((result) => setSources((previous) => ({ ...previous, sit: result }))), []);

    // setState hanya dipanggil dari callback promise, bukan dari badan efek: setState
    // sinkron di dalam efek memicu render berantai (`react-hooks/set-state-in-effect`).
    useEffect(() => {
        let cancelled = false;
        fetchAllSources()
            .then((result) => { if (!cancelled) setSources(result); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const refreshAll = () => {
        setLoading(true);
        fetchAllSources()
            .then(setSources)
            .finally(() => setLoading(false));
    };

    /**
     * Kirim persetujuan SIT untuk satu proyek.
     *
     * Selalu selesai dengan boolean dan tidak pernah ditolak, supaya kartu pemanggil
     * dapat menyimpulkan hasilnya dari nilai balik tanpa bergantung pada penolakan
     * promise.
     */
    const approveSit = useCallback(async (assignment, note) => {
        try {
            await projectService.submitSitApproval(assignment.project.id, note);
        } catch (submitError) {
            toast.error(`Gagal menyimpan persetujuan: ${submitError.message}`);
            return false;
        }
        toast.success('Persetujuan SIT Anda berhasil disimpan.');
        await refreshSit();
        return true;
    }, [refreshSit]);

    const openWizard = (assignment) => {
        // Nilai `from=uat-approvals` dipertahankan meski halaman ini kini juga memuat
        // SIT: `TaskDetail` memakainya untuk mengarahkan tombol kembali ke sini, dan
        // tautan lama yang sudah tersebar harus tetap berfungsi. Hanya jalur UAT yang
        // membawa `uatStep` karena wizard belum mengenal parameter langkah untuk SIT.
        const stepParam = assignment.kind === 'uat' ? '&uatStep=3' : '';
        navigate(`/pm/tasks/${assignment.project.id}?tab=sit_uat${stepParam}&from=uat-approvals`);
    };

    const { sit, uat } = sources;
    const allAssignments = [...sit.items, ...uat.items].sort(byPendingFirst);
    const pendingTotal = sit.pendingCount + uat.pendingCount;
    const kindTabs = [
        { key: 'all', label: 'Semua', pending: pendingTotal, total: allAssignments.length },
        { key: 'sit', label: 'SIT', pending: sit.pendingCount, total: sit.items.length },
        { key: 'uat', label: 'UAT', pending: uat.pendingCount, total: uat.items.length },
    ];
    const visibleAssignments = allAssignments
        .filter((assignment) => kindFilter === 'all' || assignment.kind === kindFilter)
        .filter((assignment) => statusFilter === 'all' || assignment.status === 'pending');

    const failedSources = [
        sit.error ? `persetujuan SIT (${sit.error})` : null,
        uat.error ? `persetujuan UAT (${uat.error})` : null,
    ].filter(Boolean);

    return (
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
            <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#003a73] to-[#005ca8] p-6 text-white shadow-lg">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-white/15 p-3"><ShieldCheck size={24} /></div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Approval Internal</p>
                            <h1 className="mt-1 text-2xl font-bold">Persetujuan Saya</h1>
                            <p className="mt-1 max-w-2xl text-sm text-blue-100">Seluruh persetujuan SIT dan UAT yang menunggu keputusan Anda tersedia di satu tempat. Persetujuan SIT dapat langsung diberikan dari halaman ini, sedangkan persetujuan UAT dibuka di wizard agar bukti dan dokumen finalnya dapat ditinjau lebih dahulu.</p>
                        </div>
                    </div>
                    <div className="rounded-xl bg-white/10 px-5 py-3 text-center">
                        <p className="text-3xl font-bold">{pendingTotal}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-100">Perlu Keputusan</p>
                    </div>
                </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    {kindTabs.map((tab) => (
                        <button key={tab.key} type="button" onClick={() => setKindFilter(tab.key)}
                            className={`rounded-lg px-4 py-2 text-xs font-bold ${kindFilter === tab.key ? 'bg-[#00529C] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {tab.label} ({statusFilter === 'pending' ? tab.pending : tab.total})
                        </button>
                    ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                        <button type="button" onClick={() => setStatusFilter('pending')} className={`rounded-lg px-4 py-2 text-xs font-bold ${statusFilter === 'pending' ? 'bg-[#00529C] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Perlu Keputusan</button>
                        <button type="button" onClick={() => setStatusFilter('all')} className={`rounded-lg px-4 py-2 text-xs font-bold ${statusFilter === 'all' ? 'bg-[#00529C] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Semua Status</button>
                    </div>
                    <button type="button" onClick={refreshAll} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:text-slate-300">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Perbarui
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex min-h-72 items-center justify-center"><Loader2 className="animate-spin text-[#00529C]" size={30} /></div>
            ) : failedSources.length === 2 ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                    <AlertCircle size={18} className="mb-2" />
                    Daftar persetujuan gagal dimuat: {failedSources.join(' dan ')}.
                </div>
            ) : (
                <>
                    {/*
                      * Kegagalan satu jalur ditampilkan sebagai peringatan, bukan sebagai
                      * halaman error, supaya assignment jalur lain yang sudah berhasil dimuat
                      * tetap dapat dikerjakan.
                      */}
                    {failedSources.length === 1 ? (
                        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <p>Daftar {failedSources[0]} gagal dimuat, jadi bagian itu mungkin belum lengkap. Coba tekan Perbarui.</p>
                        </div>
                    ) : null}

                    {visibleAssignments.length === 0 ? (
                        // Pesan kosong dibedakan menurut filter aktif: pada filter "Semua
                        // Status", kalimat "tidak ada yang menunggu" salah karena yang kosong
                        // adalah seluruh assignment, bukan hanya yang berstatus pending.
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                            <CheckCircle2 className="mx-auto text-emerald-500" size={36} />
                            <h2 className="mt-3 font-bold text-slate-700">
                                {statusFilter === 'pending' ? 'Tidak ada persetujuan yang menunggu' : 'Belum ada assignment persetujuan'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-400">
                                {statusFilter === 'pending' && allAssignments.length > 0
                                    ? 'Seluruh assignment Anda sudah diputuskan. Pilih "Semua Status" untuk melihat riwayatnya.'
                                    : 'Assignment baru muncul otomatis ketika eksekusi SIT masuk tahap persetujuan atau PM memulai Persetujuan Final UAT.'}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                            {visibleAssignments.map((assignment) => (
                                <ApprovalAssignmentCard
                                    key={assignment.id}
                                    assignment={assignment}
                                    onOpenWizard={openWizard}
                                    onApproveSit={approveSit}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
