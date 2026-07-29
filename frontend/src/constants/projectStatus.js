/**
 * Konstanta status proyek yang terstandarisasi untuk seluruh aplikasi NagariSDLC.
 * Gunakan konstanta ini di SEMUA komponen, jangan hardcode string status langsung.
 *
 * ⚠️  PENTING: Nilai string di sini HARUS cocok 100% dengan enum ProjectStatus.php di Backend!
 *
 * Alur status (sesuai Blueprint BE):
 * PENDING → IN_REVIEW → ANALYSIS_APPROVED / REJECTED
 *   → READY_FOR_DEVELOPMENT → DEV_ANALYSIS → DEV_ANALYSIS_DONE
 *   → IN_DEVELOPMENT → READY_FOR_QA → QA_IN_PROGRESS
 *   → QA_PASSED / RETURN_TO_DEV
 *   → CYBER_IN_PROGRESS → CYBER_PASSED
 *   → READY_FOR_UAT → UAT_PASSED → PENDING_GOLIVE → LIVE_PRODUCTION
 * Special: ON_HOLD, CANCELLED (bisa dari status manapun kecuali LIVE_PRODUCTION)
 */

export const PROJECT_STATUS = {
    // Fase 1: Inisiasi & Review
    PENDING: 'PENDING',
    IN_REVIEW: 'IN_REVIEW',
    ANALYSIS_APPROVED: 'ANALYSIS_APPROVED',
    REJECTED: 'REJECTED',

    // Fase 2: Pengembangan
    READY_FOR_DEVELOPMENT: 'READY_FOR_DEVELOPMENT',
    DEV_ANALYSIS: 'DEV_ANALYSIS',
    DEV_ANALYSIS_DONE: 'DEV_ANALYSIS_DONE',
    IN_DEVELOPMENT: 'IN_DEVELOPMENT',

    // Fase 3: QA Testing
    READY_FOR_QA: 'READY_FOR_QA',
    QA_IN_PROGRESS: 'QA_IN_PROGRESS',
    RETURN_TO_DEV: 'RETURN_TO_DEV',
    QA_PASSED: 'QA_PASSED',

    // Fase 4: Cyber Security
    CYBER_IN_PROGRESS: 'CYBER_IN_PROGRESS',
    CYBER_PASSED: 'CYBER_PASSED',

    // Fase 5: UAT & Rilis
    READY_FOR_UAT: 'READY_FOR_UAT',
    UAT_PASSED: 'UAT_PASSED',
    PENDING_GOLIVE: 'PENDING_GOLIVE',
    LIVE_PRODUCTION: 'LIVE_PRODUCTION',

    // Special
    ON_HOLD: 'ON_HOLD',
    CANCELLED: 'CANCELLED',
};

/**
 * Label tampilan (Bahasa Indonesia) untuk setiap status.
 */
export const PROJECT_STATUS_LABEL = {
    [PROJECT_STATUS.PENDING]: 'Menunggu Review',
    [PROJECT_STATUS.IN_REVIEW]: 'Review Lead Group',
    [PROJECT_STATUS.ANALYSIS_APPROVED]: 'Disetujui Analis',
    [PROJECT_STATUS.REJECTED]: 'Ditolak',
    [PROJECT_STATUS.READY_FOR_DEVELOPMENT]: 'Siap Development',
    [PROJECT_STATUS.DEV_ANALYSIS]: 'Analisis Dev',
    [PROJECT_STATUS.DEV_ANALYSIS_DONE]: 'Analisis Dev Selesai',
    [PROJECT_STATUS.IN_DEVELOPMENT]: 'Sedang Dikembangkan',
    [PROJECT_STATUS.READY_FOR_QA]: 'Siap QA Testing',
    [PROJECT_STATUS.QA_IN_PROGRESS]: 'Sedang QA Testing',
    [PROJECT_STATUS.RETURN_TO_DEV]: 'Dikembalikan ke Dev',
    [PROJECT_STATUS.QA_PASSED]: 'QA Lulus',
    [PROJECT_STATUS.CYBER_IN_PROGRESS]: 'Sedang Pentest',
    [PROJECT_STATUS.CYBER_PASSED]: 'Cyber Lulus',
    [PROJECT_STATUS.READY_FOR_UAT]: 'Siap UAT',
    [PROJECT_STATUS.UAT_PASSED]: 'UAT Lulus',
    [PROJECT_STATUS.PENDING_GOLIVE]: 'Menunggu Go-Live',
    [PROJECT_STATUS.LIVE_PRODUCTION]: 'Live Production',
    [PROJECT_STATUS.ON_HOLD]: 'Ditunda',
    [PROJECT_STATUS.CANCELLED]: 'Dibatalkan',
};

/**
 * Warna badge CSS untuk setiap status.
 */
export const PROJECT_STATUS_COLOR = {
    [PROJECT_STATUS.PENDING]: 'bg-gray-100 text-gray-600 border-gray-200',
    [PROJECT_STATUS.IN_REVIEW]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    [PROJECT_STATUS.ANALYSIS_APPROVED]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [PROJECT_STATUS.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
    [PROJECT_STATUS.READY_FOR_DEVELOPMENT]: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    [PROJECT_STATUS.DEV_ANALYSIS]: 'bg-blue-50 text-blue-600 border-blue-200',
    [PROJECT_STATUS.DEV_ANALYSIS_DONE]: 'bg-blue-100 text-blue-700 border-blue-200',
    [PROJECT_STATUS.IN_DEVELOPMENT]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [PROJECT_STATUS.READY_FOR_QA]: 'bg-purple-50 text-purple-600 border-purple-200',
    [PROJECT_STATUS.QA_IN_PROGRESS]: 'bg-purple-100 text-purple-700 border-purple-200',
    [PROJECT_STATUS.RETURN_TO_DEV]: 'bg-orange-100 text-orange-700 border-orange-200',
    [PROJECT_STATUS.QA_PASSED]: 'bg-teal-100 text-teal-700 border-teal-200',
    [PROJECT_STATUS.CYBER_IN_PROGRESS]: 'bg-orange-100 text-orange-700 border-orange-200',
    [PROJECT_STATUS.CYBER_PASSED]: 'bg-teal-100 text-teal-700 border-teal-200',
    [PROJECT_STATUS.READY_FOR_UAT]: 'bg-blue-100 text-blue-700 border-blue-200',
    [PROJECT_STATUS.UAT_PASSED]: 'bg-teal-100 text-teal-700 border-teal-200',
    [PROJECT_STATUS.PENDING_GOLIVE]: 'bg-amber-100 text-amber-700 border-amber-200',
    [PROJECT_STATUS.LIVE_PRODUCTION]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [PROJECT_STATUS.ON_HOLD]: 'bg-gray-100 text-gray-500 border-gray-200',
    [PROJECT_STATUS.CANCELLED]: 'bg-red-50 text-red-500 border-red-200',
};

/**
 * Urutan fase untuk timeline tracker.
 * Digunakan di halaman Lacak Status Proyek.
 */
export const PHASE_TIMELINE = [
    {
        phase: 'Fase 1: Inisiasi & Review',
        statuses: [
            PROJECT_STATUS.PENDING,
            PROJECT_STATUS.IN_REVIEW,
            PROJECT_STATUS.ANALYSIS_APPROVED,
        ],
        description: 'Pengajuan, review Lead Group, dan analisis proyek.',
    },
    {
        phase: 'Fase 2: Pengembangan IT',
        statuses: [
            PROJECT_STATUS.READY_FOR_DEVELOPMENT,
            PROJECT_STATUS.DEV_ANALYSIS,
            PROJECT_STATUS.DEV_ANALYSIS_DONE,
            PROJECT_STATUS.IN_DEVELOPMENT,
        ],
        description: 'Alokasi tim, analisis teknis, development, dan manajemen task.',
    },
    {
        phase: 'Fase 3: QA Testing',
        statuses: [
            PROJECT_STATUS.READY_FOR_QA,
            PROJECT_STATUS.QA_IN_PROGRESS,
            PROJECT_STATUS.QA_PASSED,
        ],
        description: 'Pengujian fungsional dan non-fungsional oleh tim QA.',
    },
    {
        phase: 'Fase 4: Cyber Security',
        statuses: [
            PROJECT_STATUS.CYBER_IN_PROGRESS,
            PROJECT_STATUS.CYBER_PASSED,
        ],
        description: 'Audit keamanan dan penetration testing.',
    },
    {
        phase: 'Fase 5: UAT & Rilis',
        statuses: [
            PROJECT_STATUS.READY_FOR_UAT,
            PROJECT_STATUS.UAT_PASSED,
            PROJECT_STATUS.PENDING_GOLIVE,
            PROJECT_STATUS.LIVE_PRODUCTION,
        ],
        description: 'User Acceptance Test, Quality Gate oleh Head of IT, dan deployment ke production.',
    },
];

/**
 * Helper: Cek apakah proyek sudah melewati fase tertentu.
 */
export const isStatusPassed = (currentStatus, targetStatus) => {
    const allStatuses = Object.values(PROJECT_STATUS);
    const currentIdx = allStatuses.indexOf(currentStatus);
    const targetIdx = allStatuses.indexOf(targetStatus);
    return currentIdx >= targetIdx;
};
