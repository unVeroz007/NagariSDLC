/**
 * Penyimpanan URL berkas sementara + pembacaan daftar dokumen proyek.
 *
 * Isinya dipisah dari `contexts/ProjectContext.jsx` karena tidak memerlukan React:
 * keduanya fungsi murni terhadap argumen (dan satu penyimpanan proses) sehingga bisa
 * dipakai layar mana pun tanpa ikut memuat provider.
 */
import { isEvidenceDocumentType, formatDocSizeLabel } from './documentNaming';

// Peta URL objek hasil `URL.createObjectURL` untuk pratinjau berkas yang baru
// diunggah pada sesi ini. Disimpan di window agar tetap satu peta walau modul
// dimuat ulang oleh HMR saat pengembangan.
if (typeof window !== 'undefined') {
    window.__nagariFileStore = window.__nagariFileStore || new Map();
}

export const saveFileToStore = (key, url) => {
    if (typeof window !== 'undefined' && window.__nagariFileStore && key && url) {
        window.__nagariFileStore.set(String(key), url);
    }
};

export const getFileFromStore = (key) => {
    if (typeof window !== 'undefined' && window.__nagariFileStore && key) {
        return window.__nagariFileStore.get(String(key));
    }
    return null;
};

/**
 * Ekstrak dokumen dari objek proyek untuk ditampilkan di antarmuka.
 * Backend mengembalikan dokumen via relasi `documents` pada ProjectResource.
 *
 * Lampiran bukti per task/skenario SIT & UAT (SIT_TASK_EVIDENCE, UAT_EVIDENCE)
 * dikecualikan secara default karena hanya bermakna di konteks task/skenario-nya
 * (panel eksekusi SIT & wizard SIT/UAT). Daftar ini dipakai sebagai dokumen
 * per fase/aktivitas — BRD, MEMO, FSD, Berita Acara SIT/UAT, dsb.
 *
 * @param {object|null} project
 * @param {{ includeEvidence?: boolean }} [options] - set includeEvidence: true
 *        bila pemanggil memang perlu menampilkan lampiran bukti SIT/UAT.
 */
export const getProjectRealDocuments = (project, { includeEvidence = false } = {}) => {
    if (!project) return [];

    // API mode: documents already embedded in project from backend
    if (Array.isArray(project.documents)) {
        return project.documents
            .filter(d => includeEvidence || !isEvidenceDocumentType(d.document_type || d.type))
            .map((d, idx) => ({
                // Kunci daftar React. Sebelumnya `doc-${Math.random()}`, yang berubah setiap
                // pemanggilan sehingga React membongkar-pasang ulang seluruh baris pada tiap
                // render. Indeks stabil selama urutan datanya stabil.
                id: d.id || `doc-${project.id ?? 'x'}-${idx}`,
                name: d.file_name || d.name || 'Dokumen tanpa nama',
                type: d.document_type || d.type || 'LAINNYA',
                // `documents.file_size` berisi jumlah byte. Sebelumnya angka itu diteruskan
                // apa adanya ke layar, jadi yang tampil adalah "2458123" bukan "2.34 MB",
                // dengan teks "N/A" bila kosong. Format dilakukan di sini agar semua
                // konsumen daftar ini menampilkan hal yang sama.
                size: formatDocSizeLabel(d),
                uploadedAt: d.created_at || d.uploaded_at || null,
                // Nama pengunggah apa adanya. Nilai bawaan sebelumnya "Tim SDLC" tampak
                // seperti data sungguhan padahal tidak ada pengunggah yang tercatat.
                author: d.uploader?.name || d.author || null,
                url: d.id && !d.url ? `${import.meta.env.VITE_API_URL}/documents/${d.id}/download` : (d.url || null),
            }));
    }
    return [];
};
