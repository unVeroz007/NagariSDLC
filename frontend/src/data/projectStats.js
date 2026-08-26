import { PROJECT_STATUS } from '../constants/projectStatus';

/**
 * Statistik ringkas daftar proyek untuk kartu ikhtisar.
 *
 * Perhitungannya memakai nilai enum App\Enums\ProjectStatus, bukan pencocokan
 * potongan kata pada label. Versi sebelumnya membaca `p.status.includes('Gate')`
 * dan `includes('Selesai')` — dua teks yang tidak pernah ada di kolom status —
 * sekaligus menghitung setiap status ber-'Passed' sebagai proyek selesai, sehingga
 * kartu "Selesai" melaporkan proyek yang bahkan belum melewati Quality Gate.
 * Pencocokan potongan kata itu juga bisa melempar TypeError ketika `status` null.
 */

// Sedang dikerjakan: sudah lepas dari meja analisis Fase 1 dan belum go-live.
const IN_PROGRESS_STATUSES = [
    PROJECT_STATUS.READY_FOR_DEVELOPMENT,
    PROJECT_STATUS.DEV_ANALYSIS,
    PROJECT_STATUS.DEV_ANALYSIS_DONE,
    PROJECT_STATUS.IN_DEVELOPMENT,
    PROJECT_STATUS.SIT_IN_PROGRESS,
    PROJECT_STATUS.SIT_PASSED,
    PROJECT_STATUS.SIT_REVISION,
    PROJECT_STATUS.UAT_IN_PROGRESS,
    PROJECT_STATUS.UAT_REVISION_SIT,
    PROJECT_STATUS.UAT_REVISION_DEV,
    PROJECT_STATUS.UAT_PASSED,
    PROJECT_STATUS.DEV_COMPLETED,
    PROJECT_STATUS.READY_FOR_QA,
    PROJECT_STATUS.QA_IN_PROGRESS,
    PROJECT_STATUS.QA_PASSED,
    PROJECT_STATUS.CYBER_IN_PROGRESS,
    PROJECT_STATUS.CYBER_PASSED,
    PROJECT_STATUS.RETURN_TO_DEV,
    PROJECT_STATUS.READY_FOR_UAT,
];

// Menunggu keputusan orang lain: review Fase 1 dan Quality Gate Head of IT.
const PENDING_REVIEW_STATUSES = [
    PROJECT_STATUS.PENDING,
    PROJECT_STATUS.IN_REVIEW,
    PROJECT_STATUS.ANALYSIS_APPROVED,
    PROJECT_STATUS.PENDING_GOLIVE,
];

// Selesai hanya berarti sudah berjalan di produksi.
const COMPLETED_STATUSES = [PROJECT_STATUS.LIVE_PRODUCTION];

const countByStatus = (projects, statuses) =>
    projects.filter((p) => statuses.includes(String(p?.status || '').toUpperCase())).length;

export const getProjectStats = (projects) => {
    const list = Array.isArray(projects) ? projects : [];

    return {
        total: list.length,
        inProgress: countByStatus(list, IN_PROGRESS_STATUSES),
        pendingReview: countByStatus(list, PENDING_REVIEW_STATUSES),
        completed: countByStatus(list, COMPLETED_STATUSES),
    };
};
