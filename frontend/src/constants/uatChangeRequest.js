/**
 * Label dan gaya status Change Request UAT.
 *
 * Backend menulis status ini di beberapa tempat sepanjang siklus revisi:
 * - `open` / `in_progress` saat revisi ditetapkan dari kesimpulan eksekusi UAT
 *   (`UatExecutionService::holdForMajorRevision()` untuk Mayor dan
 *   `UatExecutionService::holdForMinorRevision()` untuk Minor);
 * - `resolved` saat developer menyelesaikan task revisinya (`TaskController::update()`);
 * - `sit_verified` saat SIT ulang lulus (`ProjectWorkflowService`) — hanya berlaku bagi
 *   revisi Mayor, karena revisi Minor tidak mengulang SIT;
 * - `superseded` saat permintaan lama tidak lagi berlaku, yaitu ketika siklus diulang
 *   penuh oleh revisi Mayor atau ketika hasil UAT terbaru tidak lagi meminta perubahan.
 *
 * Nilai `pending` / `approved` / `rejected` berasal dari pengajuan lama lewat endpoint
 * change request manual, sedangkan `uat_verified` hanya tersisa pada data lama:
 * penulisnya adalah alur verifikasi terarah revisi Mayor yang sudah dihapus.
 *
 * Tabelnya dipusatkan di sini supaya halaman pemohon (`Track.jsx`) dan wizard SIT/UAT
 * tidak pernah menampilkan dua label berbeda untuk satu status yang sama.
 */
export const CHANGE_REQUEST_STATUS_LABEL = {
    open: {
        label: 'Belum Dikerjakan',
        cardCls: 'bg-amber-50 border-amber-200',
        pillCls: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    in_progress: {
        label: 'Sedang Dikerjakan',
        cardCls: 'bg-blue-50 border-blue-200',
        pillCls: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    resolved: {
        label: 'Selesai Dikerjakan',
        cardCls: 'bg-indigo-50 border-indigo-200',
        pillCls: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    },
    sit_verified: {
        label: 'Lulus SIT Ulang',
        cardCls: 'bg-violet-50 border-violet-200',
        pillCls: 'bg-violet-100 text-violet-700 border-violet-200',
    },
    uat_verified: {
        label: 'Diverifikasi di UAT',
        cardCls: 'bg-emerald-50 border-emerald-200',
        pillCls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    superseded: {
        label: 'Tidak Berlaku',
        cardCls: 'bg-gray-50 border-gray-200',
        pillCls: 'bg-gray-100 text-gray-600 border-gray-200',
    },
    approved: {
        label: 'Disetujui',
        cardCls: 'bg-emerald-50 border-emerald-200',
        pillCls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    rejected: {
        label: 'Ditolak',
        cardCls: 'bg-red-50 border-red-200',
        pillCls: 'bg-red-100 text-red-700 border-red-200',
    },
    pending: {
        label: 'Menunggu',
        cardCls: 'bg-amber-50 border-amber-200',
        pillCls: 'bg-amber-100 text-amber-700 border-amber-200',
    },
};

/**
 * Status yang berarti permintaan perubahan masih menunggu tim pengembangan.
 * Dipakai untuk menghitung sisa pekerjaan revisi yang menahan persetujuan final.
 */
export const CHANGE_REQUEST_OPEN_STATUSES = ['open', 'in_progress'];

export function getChangeRequestStatusLabel(status) {
    return CHANGE_REQUEST_STATUS_LABEL[status] || CHANGE_REQUEST_STATUS_LABEL.pending;
}
