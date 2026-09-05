/**
 * Label dan gaya status Change Request UAT.
 *
 * Status aktif bergerak dari open/in_progress ke resolved atau sit_verified;
 * superseded menutup permintaan yang tak lagi berlaku. Status pending, approved,
 * rejected, dan uat_verified dipertahankan untuk data legacy.
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
