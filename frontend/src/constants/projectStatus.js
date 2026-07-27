/**
 * Konstanta status proyek yang terstandarisasi untuk seluruh aplikasi NagariSDLC.
 * Gunakan konstanta ini di SEMUA komponen, jangan hardcode string status langsung.
 *
 * Alur status:
 * PENDING → LEAD_REVIEW → ANALYST_REVIEW → ANALYSIS_APPROVED
 *   → READY_FOR_DEVELOPMENT → IN_DEVELOPMENT
 *   → READY_FOR_QA → QA_TESTING → QA_PASSED
 *   → READY_FOR_CYBER → CYBER_TESTING → CYBER_PASSED
 *   → READY_FOR_RELEASE → UAT → UAT_PASSED → QUALITY_GATE → COMPLETED
 * (Di mana saja bisa → REJECTED)
 */

export const PROJECT_STATUS = {
    // Fase 1: Inisiasi & Review
    PENDING: 'PENDING',
    LEAD_REVIEW: 'LEAD_REVIEW',
    ANALYST_REVIEW: 'ANALYST_REVIEW',
    ANALYSIS_APPROVED: 'ANALYSIS_APPROVED',
    REJECTED: 'REJECTED',

    // Fase 2: Pengembangan
    READY_FOR_DEVELOPMENT: 'READY_FOR_DEVELOPMENT',
    IN_DEVELOPMENT: 'IN_DEVELOPMENT',

    // Fase 3: QA
    READY_FOR_QA: 'READY_FOR_QA',
    QA_TESTING: 'QA_TESTING',
    QA_PASSED: 'QA_PASSED',

    // Fase 3: Cyber
    READY_FOR_CYBER: 'READY_FOR_CYBER',
    CYBER_TESTING: 'CYBER_TESTING',
    CYBER_PASSED: 'CYBER_PASSED',

    // Fase 4: Rilis
    READY_FOR_RELEASE: 'READY_FOR_RELEASE',
    UAT: 'UAT',
    UAT_PASSED: 'UAT_PASSED',
    QUALITY_GATE: 'QUALITY_GATE',
    COMPLETED: 'COMPLETED',
};

/**
 * Label tampilan (Bahasa Indonesia) untuk setiap status.
 */
export const PROJECT_STATUS_LABEL = {
    [PROJECT_STATUS.PENDING]: 'Menunggu Review',
    [PROJECT_STATUS.LEAD_REVIEW]: 'Review Lead Group',
    [PROJECT_STATUS.ANALYST_REVIEW]: 'Review Analis',
    [PROJECT_STATUS.ANALYSIS_APPROVED]: 'Disetujui Analis',
    [PROJECT_STATUS.REJECTED]: 'Ditolak',
    [PROJECT_STATUS.READY_FOR_DEVELOPMENT]: 'Siap Development',
    [PROJECT_STATUS.IN_DEVELOPMENT]: 'Sedang Dikembangkan',
    [PROJECT_STATUS.READY_FOR_QA]: 'Siap QA',
    [PROJECT_STATUS.QA_TESTING]: 'Sedang QA Testing',
    [PROJECT_STATUS.QA_PASSED]: 'QA Lulus',
    [PROJECT_STATUS.READY_FOR_CYBER]: 'Siap Cyber Security',
    [PROJECT_STATUS.CYBER_TESTING]: 'Sedang Pentest',
    [PROJECT_STATUS.CYBER_PASSED]: 'Cyber Lulus',
    [PROJECT_STATUS.READY_FOR_RELEASE]: 'Siap Rilis',
    [PROJECT_STATUS.UAT]: 'UAT',
    [PROJECT_STATUS.UAT_PASSED]: 'UAT Lulus',
    [PROJECT_STATUS.QUALITY_GATE]: 'Quality Gate',
    [PROJECT_STATUS.COMPLETED]: 'Selesai',
};

/**
 * Warna badge Tailwind CSS untuk setiap status.
 */
export const PROJECT_STATUS_COLOR = {
    [PROJECT_STATUS.PENDING]: 'bg-gray-100 text-gray-600 border-gray-200',
    [PROJECT_STATUS.LEAD_REVIEW]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    [PROJECT_STATUS.ANALYST_REVIEW]: 'bg-amber-100 text-amber-700 border-amber-200',
    [PROJECT_STATUS.ANALYSIS_APPROVED]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [PROJECT_STATUS.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
    [PROJECT_STATUS.READY_FOR_DEVELOPMENT]: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    [PROJECT_STATUS.IN_DEVELOPMENT]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [PROJECT_STATUS.READY_FOR_QA]: 'bg-purple-100 text-purple-700 border-purple-200',
    [PROJECT_STATUS.QA_TESTING]: 'bg-purple-100 text-purple-700 border-purple-200',
    [PROJECT_STATUS.QA_PASSED]: 'bg-teal-100 text-teal-700 border-teal-200',
    [PROJECT_STATUS.READY_FOR_CYBER]: 'bg-orange-100 text-orange-700 border-orange-200',
    [PROJECT_STATUS.CYBER_TESTING]: 'bg-orange-100 text-orange-700 border-orange-200',
    [PROJECT_STATUS.CYBER_PASSED]: 'bg-teal-100 text-teal-700 border-teal-200',
    [PROJECT_STATUS.READY_FOR_RELEASE]: 'bg-blue-100 text-blue-700 border-blue-200',
    [PROJECT_STATUS.UAT]: 'bg-blue-100 text-blue-700 border-blue-200',
    [PROJECT_STATUS.UAT_PASSED]: 'bg-teal-100 text-teal-700 border-teal-200',
    [PROJECT_STATUS.QUALITY_GATE]: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    [PROJECT_STATUS.COMPLETED]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
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
            PROJECT_STATUS.LEAD_REVIEW,
            PROJECT_STATUS.ANALYST_REVIEW,
            PROJECT_STATUS.ANALYSIS_APPROVED,
        ],
        description: 'Pengajuan, review Lead Group, dan analisis proyek.',
    },
    {
        phase: 'Fase 2: Pengembangan IT',
        statuses: [
            PROJECT_STATUS.READY_FOR_DEVELOPMENT,
            PROJECT_STATUS.IN_DEVELOPMENT,
        ],
        description: 'Alokasi tim, development, dan manajemen task.',
    },
    {
        phase: 'Fase 3: QA Testing',
        statuses: [
            PROJECT_STATUS.READY_FOR_QA,
            PROJECT_STATUS.QA_TESTING,
            PROJECT_STATUS.QA_PASSED,
        ],
        description: 'Pengujian fungsional dan non-fungsional oleh tim QA.',
    },
    {
        phase: 'Fase 3: Cyber Security',
        statuses: [
            PROJECT_STATUS.READY_FOR_CYBER,
            PROJECT_STATUS.CYBER_TESTING,
            PROJECT_STATUS.CYBER_PASSED,
        ],
        description: 'Audit keamanan dan penetration testing.',
    },
    {
        phase: 'Fase 4: Rilis & Kepatuhan',
        statuses: [
            PROJECT_STATUS.READY_FOR_RELEASE,
            PROJECT_STATUS.UAT,
            PROJECT_STATUS.UAT_PASSED,
            PROJECT_STATUS.QUALITY_GATE,
            PROJECT_STATUS.COMPLETED,
        ],
        description: 'UAT, Quality Gate, dan deployment ke production.',
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
