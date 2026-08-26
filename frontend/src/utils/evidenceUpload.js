import { documentService } from '../services/api';

/**
 * Unggah berkas bukti pengujian ke lemari dokumen proyek.
 *
 * Bukti pengujian QA dan Audit Keamanan Siber tidak dikirim menempel pada laporannya.
 * Berkasnya diunggah lebih dulu sebagai dokumen proyek bertipe bukti, lalu ID dokumen
 * hasil unggahan itulah yang dirujuk laporan lewat `evidence_document_ids`. Dengan begitu
 * bukti tetap dapat dibuka Lead dan auditor kapan pun — sebelumnya bukti hanya hidup di
 * memori peramban pengirim, sehingga hilang begitu halaman ditutup.
 *
 * Nama berkas final dibuat server (`DocumentController::generateDocumentFileName()`),
 * termasuk penanda unik `DOC-000N` untuk tipe bukti. Karena itu pemanggil tidak perlu
 * menamai ulang berkasnya.
 */

/**
 * Batas berikut adalah cerminan aturan validasi `DocumentController::upload()`.
 * Diperiksa di sisi klien lebih dulu supaya pengguna tidak menunggu unggahan
 * selesai hanya untuk menerima pesan 422.
 */
export const EVIDENCE_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const EVIDENCE_ALLOWED_EXTENSIONS = ['pdf', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'zip'];

export const EVIDENCE_FILE_INPUT_ACCEPT = '.pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip';

/** Batas jumlah ID bukti per laporan, sesuai `SubmitTestReportRequest`. */
export const EVIDENCE_MAX_FILES_PER_REPORT = 50;

export const EVIDENCE_UPLOAD_HINT = 'PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), ZIP — maks. 5 MB per berkas';

const getFileExtension = (fileName) => {
    const parts = String(fileName || '').split('.');

    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/**
 * Periksa satu berkas terhadap batas server.
 *
 * @returns {string|null} pesan penolakan, atau null bila berkas sah.
 */
export function validateEvidenceFile(file) {
    if (!file) return 'Berkas tidak terbaca.';

    const extension = getFileExtension(file.name);

    if (!EVIDENCE_ALLOWED_EXTENSIONS.includes(extension)) {
        return `Format "${file.name}" tidak diizinkan. Gunakan PDF, Excel, gambar (JPG/PNG), atau ZIP.`;
    }

    if (file.size > EVIDENCE_MAX_FILE_SIZE_BYTES) {
        return `Ukuran "${file.name}" melebihi batas 5 MB.`;
    }

    return null;
}

/**
 * Unggah seluruh berkas bukti, lalu kembalikan ID dokumennya.
 *
 * Unggahan dijalankan berurutan, bukan serentak. Nomor dokumen `DOC-000N` diambil dari
 * primary key, sehingga urutan berkas pada nama dokumen tetap sesuai urutan pilihan
 * pengguna, dan kegagalan berhenti pada berkas pertama yang bermasalah.
 *
 * Bila satu berkas gagal, berkas yang sudah terunggah tetap tersimpan di lemari dokumen
 * sementara laporannya belum terkirim. Sisa itu tidak mengotori daftar dokumen per fase
 * karena tipe bukti dikecualikan dari sana, dan berkas yang sama akan diunggah ulang saat
 * pengguna mencoba lagi.
 *
 * @param {File[]} files
 * @param {{ projectId: number|string, documentType: string, contextLabel?: string|null }} options
 * @returns {Promise<Array<{ id: number, fileName: string }>>}
 */
export async function uploadEvidenceFiles(files, { projectId, documentType, contextLabel = null }) {
    const uploaded = [];

    for (const file of files) {
        const response = await documentService.upload(file, {
            project_id: projectId,
            document_type: documentType,
            context_label: contextLabel,
        });

        const documentId = response?.data?.id;

        if (!documentId) {
            throw new Error(`Unggahan bukti "${file.name}" tidak mengembalikan ID dokumen.`);
        }

        uploaded.push({
            id: documentId,
            fileName: response.data.file_name || file.name,
        });
    }

    return uploaded;
}
