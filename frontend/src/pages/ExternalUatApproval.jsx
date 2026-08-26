import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    AlertCircle, Building2, CheckCircle2, ClipboardCheck, Download,
    Eye, FileText, Loader2, LockKeyhole, Phone, ShieldCheck, XCircle,
} from 'lucide-react';
import { externalUatApprovalService } from '../services/api';

const formatDate = (value) => value
    ? new Date(value).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
    : '-';

/**
 * Format tanggal tanpa jam.
 *
 * `uat_date` berasal dari `sit_uat_data.uat1_startDate`, yaitu nilai `<input type="date">`
 * berformat `YYYY-MM-DD` — bukan timestamp. Sebelumnya nilai itu dicetak apa adanya,
 * sehingga approver eksternal membaca "2026-08-14" pada halaman resmi persetujuan.
 * Nilai yang tidak dapat diurai dikembalikan utuh, bukan menjadi "Invalid Date".
 */
const formatDateOnly = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? String(value)
        : parsed.toLocaleDateString('id-ID', { dateStyle: 'long' });
};

const resultLabel = (value) => value === 'accepted' ? 'Diterima' : value === 'revision' ? 'Revisi' : '-';

/**
 * Label tipe perubahan. Backend hanya menerima 'minor' atau 'mayor'.
 *
 * Kuncinya dibaca dari `changeType`, bukan `change_type`. Payload permintaan memakai
 * snake_case, tetapi `UatExecutionService` menyimpannya ke `sit_uat_data` sebagai
 * `changeType` dan respons detail approval meneruskan JSON itu apa adanya.
 */
const changeTypeOf = (item) => item?.changeType ?? item?.change_type ?? null;

const changeTypeLabel = (value) => value === 'mayor' ? 'Mayor' : value === 'minor' ? 'Minor' : null;

const canPreviewDocument = (document) => ['pdf', 'jpg', 'jpeg', 'png']
    .includes(String(document?.name || '').split('.').pop()?.toLowerCase());

/**
 * Picu unduhan berkas.
 *
 * Anchor-nya wajib disisipkan ke dokumen sebelum `click()`. Chrome memaafkan anchor
 * lepas, tetapi Firefox mengabaikan `click()` pada elemen yang tidak berada di dalam
 * dokumen — tombol Unduh tampak berfungsi, namun tidak ada berkas yang turun sama
 * sekali. Halaman ini dipakai approver eksternal di luar kendali perangkat kami,
 * sehingga peramban selain Chrome harus ikut ditangani.
 */
const triggerAnchorDownload = (url, fileName) => {
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    window.document.body.appendChild(anchor);
    anchor.click();
    window.document.body.removeChild(anchor);
};

function ApprovalDocumentSection({ title, description, documents, important = false, busyDocumentId, onView, onDownload }) {
    return (
        <section className={`rounded-2xl border bg-white p-6 shadow-sm ${important ? 'border-blue-200' : 'border-slate-200'}`}>
            <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${important ? 'bg-blue-50 text-[#00529C]' : 'bg-slate-100 text-slate-500'}`}>
                    <FileText size={19} />
                </div>
                <div>
                    <h2 className="font-bold">{title}</h2>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
                </div>
            </div>
            {documents.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-xs text-amber-800">
                    Dokumen belum diunggah oleh PM. Hubungi PM apabila dokumen diperlukan sebelum Anda memberikan keputusan.
                </div>
            ) : (
                <div className="mt-4 space-y-2">
                    {documents.map((document) => {
                        const isBusy = Number(busyDocumentId) === Number(document.id);
                        return (
                            <div key={document.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <FileText size={16} className="shrink-0 text-[#00529C]" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">{document.name}</p>
                                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{document.type || 'Dokumen'}</p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {canPreviewDocument(document) ? (
                                        <button type="button" onClick={() => onView(document)} disabled={isBusy}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50 disabled:text-slate-300">
                                            <Eye size={13} /> Lihat
                                        </button>
                                    ) : null}
                                    <button type="button" onClick={() => onDownload(document)} disabled={isBusy}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00529C] px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-800 disabled:bg-slate-300">
                                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Unduh
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default function ExternalUatApproval() {
    const { token } = useParams();
    const [preview, setPreview] = useState(null);
    const [detail, setDetail] = useState(null);
    const [accessToken, setAccessToken] = useState('');
    const [phone, setPhone] = useState('');
    const [note, setNote] = useState('');
    const [identityConfirmed, setIdentityConfirmed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [busyDocumentId, setBusyDocumentId] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        externalUatApprovalService.preview(token)
            .then((response) => {
                if (!cancelled) setPreview(response.data);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [token]);

    /**
     * Ambil detail UAT memakai access token yang sudah dipegang.
     *
     * Dipisahkan dari `verify` supaya kegagalan pada langkah ini dapat diulang tanpa
     * memverifikasi nomor HP lagi. Backend membatasi verifikasi nomor sampai 5 kali
     * sebelum akses terkunci 15 menit, jadi kegagalan sesaat pada pemuatan detail
     * tidak boleh ikut memakan kuota percobaan tersebut.
     */
    const loadDetail = async (activeAccessToken) => {
        const response = await externalUatApprovalService.detail(token, activeAccessToken);
        setDetail(response.data);
    };

    const verify = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            // Access token disimpan lebih dulu. Bila pemuatan detail gagal, tombol pada
            // form berubah menjadi "Coba muat ulang" dan verifikasi nomor tidak diulang.
            let activeAccessToken = accessToken;
            const reusedAccessToken = Boolean(activeAccessToken);
            if (!activeAccessToken) {
                const verification = await externalUatApprovalService.verify(token, phone);
                activeAccessToken = verification.data.access_token;
                setAccessToken(activeAccessToken);
            }
            try {
                await loadDetail(activeAccessToken);
            } catch (detailError) {
                // Token yang diulang pemakaiannya dan tetap gagal dianggap sudah tidak
                // berlaku — dibuang supaya percobaan berikutnya memverifikasi nomor lagi
                // alih-alih terus memakai token mati.
                if (reusedAccessToken) setAccessToken('');
                throw detailError;
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    /**
     * Kirim persetujuan.
     *
     * Link khusus ini dipegang pimpinan grup dan pimpinan divisi unit peminta, dan
     * posisi tersebut hanya berwenang menyetujui — seluruh penolakan serta permintaan
     * revisi sudah diaudit saat UAT berlangsung, sehingga tahap ini tinggal pengesahan
     * hasil yang telah disepakati. Karena itu `decision` ditulis tetap 'approved', bukan
     * diambil dari pilihan pengguna. Sumber kebenaran aturannya ada di
     * `UatApprovalRole::canReject()` yang juga menolak permintaan 'rejected' di backend;
     * kode di sini hanya lapisan keduanya, bukan penentunya.
     */
    const submitDecision = async () => {
        const confirmed = window.confirm('Anda yakin menyetujui hasil UAT ini? Keputusan tidak dapat diubah melalui link ini.');
        if (!confirmed) return;

        setSubmitting(true);
        try {
            const response = await externalUatApprovalService.decide(token, accessToken, 'approved', note.trim());
            setDetail((current) => ({ ...current, approver: response.data }));
            toast.success(response.message);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const downloadDocument = async (document) => {
        if (busyDocumentId) return;
        setBusyDocumentId(document.id);
        try {
            const blob = await externalUatApprovalService.downloadDocument(token, accessToken, document.id);
            const url = URL.createObjectURL(blob);
            // Kedua jenis pemisah path dibersihkan. Nama dokumen resmi dibentuk dari
            // judul proyek, dan judul yang memuat "/" atau "\" membuat sebagian peramban
            // memotong nama berkasnya.
            const fileName = String(document.name || 'dokumen-uat').replaceAll('/', '-').replaceAll('\\', '-');
            triggerAnchorDownload(url, fileName);
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyDocumentId(null);
        }
    };

    const viewDocument = async (document) => {
        if (busyDocumentId) return;
        const previewWindow = window.open('', '_blank');
        setBusyDocumentId(document.id);
        try {
            const blob = await externalUatApprovalService.downloadDocument(token, accessToken, document.id);
            const url = URL.createObjectURL(blob);
            if (previewWindow) {
                previewWindow.location.href = url;
                window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            } else {
                // Tab baru diblokir peramban. Dokumennya diunduh sebagai jalan keluar,
                // dan pengguna diberi tahu alasannya — sebelumnya cabang ini memakai
                // anchor lepas tanpa `download`, yang di Firefox tidak melakukan apa pun
                // sehingga tombol Lihat tampak macet tanpa keterangan.
                const fileName = String(document.name || 'dokumen-uat').replaceAll('/', '-').replaceAll('\\', '-');
                triggerAnchorDownload(url, fileName);
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast('Peramban memblokir tab baru, dokumen diunduh sebagai gantinya.');
            }
        } catch (err) {
            previewWindow?.close();
            toast.error(err.message);
        } finally {
            setBusyDocumentId(null);
        }
    };

    if (loading) return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#00529C]" size={32} />
        </main>
    );

    if (error && !preview) return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
                <AlertCircle className="mx-auto text-red-500" size={36} />
                <h1 className="mt-3 font-bold text-slate-800">Link tidak dapat digunakan</h1>
                <p className="mt-2 text-sm text-slate-500">{error}</p>
            </div>
        </main>
    );

    const finalStatus = detail?.approver?.status || preview?.status;
    const decided = ['approved', 'rejected'].includes(finalStatus);
    const finalApprovalDocuments = (detail?.documents || []).filter(document => document.category === 'final_approval');
    const supportingDocuments = (detail?.documents || []).filter(document => document.category !== 'final_approval');

    return (
        <main className="min-h-screen bg-slate-50 text-slate-800">
            <header className="bg-[#00529C] text-white">
                <div className="mx-auto max-w-5xl px-5 py-5 flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center"><ShieldCheck size={24} /></div>
                    <div>
                        <p className="font-bold">Nagari SDLC</p>
                        <p className="text-xs text-blue-100">Persetujuan Hasil User Acceptance Test</p>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-5xl px-5 py-8">
                {!detail ? (
                    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
                            <LockKeyhole className="text-[#00529C] shrink-0" size={24} />
                            <div>
                                <h1 className="font-bold text-lg">Verifikasi penerima link</h1>
                                <p className="mt-1 text-sm text-slate-500">Link ini ditujukan khusus kepada <strong>{preview?.approver_name}</strong> sebagai {preview?.position}.</p>
                            </div>
                        </div>
                        <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm">
                            <p className="font-semibold text-blue-900">{preview?.project_req_id} — {preview?.project_title}</p>
                            <p className="mt-1 text-xs text-blue-700">Putaran approval ke-{preview?.round_number} · Berlaku sampai {formatDate(preview?.expires_at)}</p>
                        </div>
                        {decided ? (
                            <div className={`mt-5 rounded-xl border p-4 ${finalStatus === 'approved' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                                <p className="font-semibold">Keputusan sudah tercatat: {finalStatus === 'approved' ? 'Disetujui' : 'Ditolak / Revisi'}</p>
                                <p className="text-xs mt-1 text-slate-600">Masukkan nomor HP apabila Anda perlu melihat kembali ringkasan keputusan.</p>
                            </div>
                        ) : null}
                        <form onSubmit={verify} className="mt-5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Nomor HP terdaftar</label>
                            <div className="relative mt-2">
                                <Phone size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="tel"
                                    maxLength={30}
                                    placeholder={`Contoh: 0812••••${preview?.phone_masked?.slice(-4) || '1234'}`}
                                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#00529C]" />
                            </div>
                            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
                            <button disabled={submitting} className="mt-4 w-full rounded-xl bg-[#00529C] px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300">
                                {/*
                                  * Nomor HP yang sudah terverifikasi tidak diverifikasi ulang; yang
                                  * gagal hanyalah pemuatan detail, jadi labelnya harus menyebut
                                  * tindakan yang sebenarnya terjadi.
                                  */}
                                {submitting
                                    ? (accessToken ? 'Memuat ulang...' : 'Memverifikasi...')
                                    : (accessToken ? 'Coba Muat Ulang Hasil UAT' : 'Verifikasi dan Lihat Hasil UAT')}
                            </button>
                        </form>
                        <p className="mt-4 text-center text-[11px] text-slate-400">Nomor HP hanya dicocokkan dengan data yang didaftarkan PM dan tidak dikirimkan OTP.</p>
                    </section>
                ) : (
                    <div className="space-y-5">
                        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-[#00529C]">{detail.project.req_id}</p>
                                    <h1 className="mt-1 text-xl font-bold">{detail.project.title}</h1>
                                    <p className="mt-2 text-sm text-slate-500">{detail.project.description || 'Tidak ada deskripsi proyek.'}</p>
                                </div>
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Putaran {detail.round.round_number}</span>
                            </div>
                            <div className="mt-5 grid gap-3 sm:grid-cols-3 text-sm">
                                <div className="rounded-xl bg-slate-50 p-3"><Building2 size={15} className="text-slate-400" /><p className="mt-2 text-xs text-slate-400">Unit Peminta</p><p className="font-semibold">{detail.project.unit || detail.project.division || '-'}</p></div>
                                <div className="rounded-xl bg-slate-50 p-3"><ClipboardCheck size={15} className="text-slate-400" /><p className="mt-2 text-xs text-slate-400">Tanggal UAT</p><p className="font-semibold">{formatDateOnly(detail.project.uat_date)}</p></div>
                                <div className="rounded-xl bg-slate-50 p-3"><ShieldCheck size={15} className="text-slate-400" /><p className="mt-2 text-xs text-slate-400">Anda menyetujui sebagai</p><p className="font-semibold">{detail.approver.position}</p></div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="font-bold">Ringkasan hasil UAT</h2>
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    ['Dieksekusi', detail.summary?.executedCount || 0],
                                    ['Diterima', detail.summary?.acceptedCount || 0],
                                    ['Minor', detail.summary?.minorCount || 0],
                                    ['Mayor', detail.summary?.majorCount || 0],
                                ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center"><p className="text-xl font-bold">{value}</p><p className="text-xs text-slate-500">{label}</p></div>)}
                            </div>
                            {detail.summary?.notes ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{detail.summary.notes}</p> : null}
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="font-bold">Skenario dan hasil pengujian</h2>
                            <div className="mt-4 space-y-3">
                                {(detail.scenarios || []).length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500">
                                        Tidak ada skenario pengujian yang tercatat pada putaran ini.
                                    </p>
                                ) : null}
                                {(detail.scenarios || []).map((scenario) => (
                                    <div key={scenario.id} className="rounded-xl border border-slate-200 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-semibold text-sm">{scenario.scenario}</p>
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                {/*
                                                  * Tipe perubahan ikut ditampilkan. Ringkasan di atas menghitung
                                                  * jumlah Minor dan Mayor, tetapi sebelumnya approver tidak dapat
                                                  * melihat skenario mana yang tergolong Mayor — padahal justru
                                                  * bobot itulah yang menentukan keputusannya.
                                                  */}
                                                {changeTypeLabel(changeTypeOf(scenario)) ? (
                                                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${changeTypeOf(scenario) === 'mayor' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {changeTypeLabel(changeTypeOf(scenario))}
                                                    </span>
                                                ) : null}
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${scenario.result === 'accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{resultLabel(scenario.result)}</span>
                                            </div>
                                        </div>
                                        {scenario.request ? <p className="mt-2 text-xs text-slate-600"><strong>Permintaan:</strong> {scenario.request}</p> : null}
                                        {scenario.comment ? <p className="mt-1 text-xs text-slate-500"><strong>Catatan:</strong> {scenario.comment}</p> : null}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/*
                          * Permintaan tambahan user.
                          *
                          * Backend sudah mengirim `additional_requests` pada respons detail, tetapi
                          * halaman ini sebelumnya tidak menampilkannya sama sekali. Akibatnya
                          * approver eksternal menandatangani hasil UAT tanpa pernah melihat daftar
                          * permintaan perubahan tambahan — termasuk yang bertipe Mayor — padahal
                          * permintaan itu bagian dari lingkup yang ia setujui.
                          */}
                        {(detail.additional_requests || []).length > 0 ? (
                            <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
                                <h2 className="font-bold">Permintaan tambahan user</h2>
                                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                                    Permintaan perubahan di luar skenario pengujian yang diajukan unit peminta pada putaran UAT ini.
                                </p>
                                <div className="mt-4 space-y-3">
                                    {(detail.additional_requests || []).map((item) => (
                                        <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="font-semibold text-sm">{item.title}</p>
                                                {changeTypeLabel(changeTypeOf(item)) ? (
                                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${changeTypeOf(item) === 'mayor' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {changeTypeLabel(changeTypeOf(item))}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {item.detail ? <p className="mt-2 text-xs text-slate-600"><strong>Detail:</strong> {item.detail}</p> : null}
                                            {item.comment ? <p className="mt-1 text-xs text-slate-500"><strong>Catatan:</strong> {item.comment}</p> : null}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <ApprovalDocumentSection
                            title="Dokumen Persetujuan Final UAT"
                            description="Periksa Form Persetujuan, Berita Acara UAT, atau dokumen tanda tangan digital yang diunggah PM sebelum memberikan keputusan."
                            documents={finalApprovalDocuments}
                            important
                            busyDocumentId={busyDocumentId}
                            onView={viewDocument}
                            onDownload={downloadDocument}
                        />

                        {supportingDocuments.length > 0 ? (
                            <ApprovalDocumentSection
                                title="Dokumen Pendukung UAT"
                                description="Dokumen persiapan dan bukti pengujian yang berkaitan dengan pelaksanaan UAT."
                                documents={supportingDocuments}
                                busyDocumentId={busyDocumentId}
                                onView={viewDocument}
                                onDownload={downloadDocument}
                            />
                        ) : null}

                        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            {decided ? (
                                <div className={`text-center rounded-xl border p-6 ${finalStatus === 'approved' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                                    {finalStatus === 'approved' ? <CheckCircle2 className="mx-auto text-emerald-600" size={36} /> : <XCircle className="mx-auto text-red-600" size={36} />}
                                    <h2 className="mt-3 font-bold">{finalStatus === 'approved' ? 'UAT telah Anda setujui' : 'UAT ditolak / memerlukan revisi'}</h2>
                                    <p className="mt-1 text-sm text-slate-600">Keputusan dicatat pada {formatDate(detail.approver.decided_at)}.</p>
                                    {detail.approver.decision_note ? <p className="mt-3 text-sm italic">“{detail.approver.decision_note}”</p> : null}
                                </div>
                            ) : (
                                <>
                                    <h2 className="font-bold">Keputusan Anda</h2>
                                    <p className="mt-1 text-sm text-slate-500">Pastikan seluruh hasil dan dokumen telah diperiksa sebelum mengirim keputusan.</p>
                                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                                        <div>
                                            <p className="text-sm font-bold">Setujui hasil UAT</p>
                                            <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                                                Pada tahap ini Anda hanya perlu memeriksa lalu menyetujui. Penolakan dan permintaan revisi tidak lagi tersedia di sini karena seluruhnya sudah diaudit bersama unit peminta saat UAT berlangsung.
                                            </p>
                                        </div>
                                    </div>
                                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={5000} placeholder="Catatan persetujuan (opsional)" className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-[#00529C]" />
                                    <label className="mt-3 flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={identityConfirmed} onChange={(event) => setIdentityConfirmed(event.target.checked)} className="mt-0.5" />Saya menyatakan bahwa saya adalah penerima link ini dan bertanggung jawab atas keputusan yang diberikan.</label>
                                    <button onClick={submitDecision} disabled={submitting || !identityConfirmed} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300">{submitting ? 'Menyimpan keputusan...' : 'Setujui Hasil UAT'}</button>
                                </>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </main>
    );
}
