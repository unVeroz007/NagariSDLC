import { Download, Eye, Paperclip, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentService } from '../services/api';

/**
 * Kartu laporan pengujian untuk layar review Lead (QA & Audit Keamanan Siber).
 *
 * Sumber datanya adalah `qa_report` / `cyber_report` dari `ProjectResource`, yaitu baris
 * `test_reports` yang tersimpan di database — bukan lagi payload titipan klien. Kedua
 * jalur memakai kartu yang sama karena bentuk laporannya identik; hanya istilahnya yang
 * berbeda, sehingga perbedaan itu diwakili prop dan bukan salinan JSX kedua.
 *
 * @param {object} props
 * @param {object|null} props.report - laporan jalur terkait, null bila belum masuk.
 * @param {string} props.testerLabel - sebutan pelaksana pengujian ("Analis QA", "Pentester").
 * @param {string} props.severityLabel - sebutan tingkat temuan ("Severity", "Tingkat Risiko").
 * @param {string} props.notesLabel - judul blok catatan temuan.
 * @param {string} props.evidenceLabel - judul blok berkas bukti.
 * @param {string} props.emptyMessage - pesan saat laporan belum masuk.
 * @param {(doc: object) => void} props.onPreview - membuka pratinjau berkas bukti.
 */
export default function TestReportReviewCard({
    report,
    testerLabel = 'Pelaksana Pengujian',
    severityLabel = 'Severity',
    notesLabel = 'Catatan Temuan',
    evidenceLabel = 'Bukti Pengujian / Evidence',
    emptyMessage = 'Laporan pengujian belum masuk.',
    onPreview,
}) {
    if (!report) {
        return (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-400 italic">
                {emptyMessage}
            </div>
        );
    }

    const evidence = Array.isArray(report.evidence) ? report.evidence : [];

    /**
     * Bentuk dokumen yang dipahami `DocumentViewerModal`.
     *
     * Bukti tidak punya URL publik: berkasnya diambil lewat `documentService.download(id)`
     * yang menyertakan token. Karena itu hanya `id` yang wajib benar — modal mengunduh
     * sendiri berkasnya dan membuat object URL sementara.
     */
    const toViewerDoc = (item) => ({
        id: item.id,
        name: item.file_name || item.original_filename,
        type: item.document_type,
        size: item.file_size,
        author: item.author,
        uploadedAt: item.created_at,
    });

    const handleDownload = async (item) => {
        try {
            const blob = await documentService.download(item.id);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = item.file_name || item.original_filename || `evidence-${item.id}`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(err.message || 'Gagal mengunduh berkas bukti.');
        }
    };

    const submittedAt = report.submitted_at
        ? new Date(report.submitted_at).toLocaleString('id-ID')
        : '-';

    return (
        <div className="space-y-3">
            {/* Identitas pelaksana & penilaiannya */}
            <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-gray-700 flex items-center gap-1.5">
                        <User size={13} className="text-emerald-600" />
                        {testerLabel}: <strong>{report.tester_name || '-'}</strong>
                    </span>
                    <span
                        className={`px-2.5 py-0.5 rounded-full font-extrabold text-[11px] shrink-0 ${
                            report.is_pass ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                    >
                        {report.result_label || '-'}
                    </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                    <span>{severityLabel}: <strong className="text-gray-700">{report.severity || '-'}</strong></span>
                    <span>•</span>
                    {/*
                     * Ringkasan checklist hanya ada pada laporan lama: cakupan pengujian kini
                     * ditulis bebas di `tested_scenarios` dan ditampilkan sebagai blok teks di
                     * bawah. Barisnya disembunyikan bila kosong daripada menampilkan
                     * "Checklist: -" yang menyesatkan Lead saat me-review.
                     */}
                    {report.checklist_summary && (
                        <>
                            <span>Checklist: <strong className="text-gray-700">{report.checklist_summary}</strong></span>
                            <span>•</span>
                        </>
                    )}
                    <span>Dikirim: <strong className="text-gray-700">{submittedAt}</strong></span>
                </div>
                {report.tested_scenarios && (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-xs font-bold text-gray-600 mb-1">Skenario yang diuji:</p>
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{report.tested_scenarios}</p>
                    </div>
                )}
                {report.notes && (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-xs font-bold text-gray-600 mb-1">{notesLabel}:</p>
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{report.notes}</p>
                    </div>
                )}
            </div>

            {/* Berkas bukti — tersimpan di lemari dokumen proyek, bukan di memori browser */}
            {evidence.length > 0 && (
                <div>
                    <h5 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Paperclip size={13} className="text-emerald-600" /> {evidenceLabel} ({evidence.length})
                    </h5>
                    <div className="space-y-2">
                        {evidence.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Paperclip size={13} className="text-emerald-600 shrink-0" />
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-bold text-gray-800 truncate">
                                            {item.file_name || item.original_filename}
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            {item.file_size || 'N/A'}
                                            {item.created_at ? ` • ${new Date(item.created_at).toLocaleString('id-ID')}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => onPreview?.(toViewerDoc(item))}
                                        className="px-2 py-1 bg-[#1a365d] text-white rounded-lg text-xs font-bold hover:bg-[#0f2342] transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                        <Eye size={11} /> Lihat
                                    </button>
                                    <button
                                        onClick={() => handleDownload(item)}
                                        className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                        <Download size={11} /> Unduh
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
