/**
 * Perjalanan proyek: satu sumber kebenaran untuk timeline fase SDLC.
 *
 * `PROJECT_STATUS_SPINE` menentukan urutan maju, `JOURNEY_PHASES` menentukan titik
 * tampilan, dan `JOURNEY_DETOURS` menempatkan revisi/penundaan. QA dan Siber dinilai
 * dari kolom jalurnya karena berjalan paralel. Histori melengkapi tanggal dan siklus.
 */

import {
    PROJECT_STATUS,
    PROJECT_STATUS_LABEL,
    TRACK_STATUS,
    getCyberTrackStatus,
    getQaTrackStatus,
} from './projectStatus';

/**
 * Urutan maju seluruh status utama.
 *
 * Status simpangan (REJECTED, *_REVISION, RETURN_TO_DEV, ON_HOLD, CANCELLED)
 * sengaja TIDAK ada di sini: memberi mereka posisi maju berarti sebuah revisi
 * ikut menaikkan progres. Posisinya ditentukan `JOURNEY_DETOURS` di bawah.
 *
 * READY_FOR_UAT ikut masuk walau tidak lagi punya transisi apa pun di backend,
 * supaya proyek lama yang berhenti di status itu tetap punya posisi yang benar.
 */
export const PROJECT_STATUS_SPINE = [
    PROJECT_STATUS.PENDING,
    PROJECT_STATUS.IN_REVIEW,
    PROJECT_STATUS.ANALYSIS_APPROVED,
    PROJECT_STATUS.READY_FOR_DEVELOPMENT,
    PROJECT_STATUS.DEV_ANALYSIS,
    PROJECT_STATUS.DEV_ANALYSIS_DONE,
    PROJECT_STATUS.IN_DEVELOPMENT,
    PROJECT_STATUS.SIT_IN_PROGRESS,
    PROJECT_STATUS.SIT_PASSED,
    PROJECT_STATUS.UAT_IN_PROGRESS,
    PROJECT_STATUS.UAT_PASSED,
    PROJECT_STATUS.DEV_COMPLETED,
    PROJECT_STATUS.READY_FOR_QA,
    PROJECT_STATUS.QA_IN_PROGRESS,
    PROJECT_STATUS.QA_PASSED,
    PROJECT_STATUS.CYBER_IN_PROGRESS,
    PROJECT_STATUS.CYBER_PASSED,
    PROJECT_STATUS.READY_FOR_UAT,
    PROJECT_STATUS.PENDING_GOLIVE,
    PROJECT_STATUS.LIVE_PRODUCTION,
];

/** Urutan tahap pada satu jalur pengujian paralel (QA maupun Keamanan Siber). */
const TRACK_STATUS_SPINE = [
    TRACK_STATUS.SUBMITTED,
    TRACK_STATUS.IN_PROGRESS,
    TRACK_STATUS.REVIEW,
    TRACK_STATUS.PASSED,
];

/**
 * Fase dan titik yang ditampilkan pada timeline.
 *
 * `historyStatus` menunjuk status utama yang tanggalnya dipakai sebagai cap waktu
 * titik ini. Untuk titik jalur paralel nilainya bisa kosong: tahap "menunggu review
 * lead" tidak pernah mengubah status utama, jadi memang tidak punya baris riwayat.
 */
export const JOURNEY_PHASES = [
    {
        id: 'phase1',
        label: 'Fase 1',
        sublabel: 'Inisiasi & Review',
        description: 'Pengajuan diterima, ditelaah Lead Grup Perencanaan, lalu dinyatakan layak dikerjakan.',
        milestones: [
            {
                status: PROJECT_STATUS.PENDING,
                label: 'Pengajuan Diterima',
                description: 'Formulir pengajuan beserta lampirannya tercatat di sistem dan masuk antrian review.',
            },
            {
                status: PROJECT_STATUS.IN_REVIEW,
                label: 'Review Lead Grup Perencanaan',
                description: 'Lead grup menelaah kebutuhan, menunjuk analis, dan menilai kelayakan pengajuan.',
            },
            {
                status: PROJECT_STATUS.ANALYSIS_APPROVED,
                label: 'Hasil Analisis Disetujui',
                description: 'Analisis kebutuhan selesai dan pengajuan disetujui untuk diteruskan ke pengembangan.',
            },
        ],
    },
    {
        id: 'phase2',
        label: 'Fase 2',
        sublabel: 'Pengembangan IT',
        description: 'Alokasi tim, analisis teknis, pembuatan sistem, lalu pengujian internal SIT dan UAT.',
        milestones: [
            {
                status: PROJECT_STATUS.READY_FOR_DEVELOPMENT,
                label: 'Tim Pengembang Dialokasikan',
                description: 'Project Manager dan tim developer ditetapkan untuk mengerjakan proyek ini.',
            },
            {
                status: PROJECT_STATUS.DEV_ANALYSIS,
                label: 'Analisis Teknis',
                description: 'Analis pengembangan menyusun rancangan teknis dan memecah kebutuhan menjadi task.',
            },
            {
                status: PROJECT_STATUS.DEV_ANALYSIS_DONE,
                label: 'Analisis Teknis Selesai',
                description: 'Rancangan teknis disetujui dan siap dieksekusi tim developer.',
            },
            {
                status: PROJECT_STATUS.IN_DEVELOPMENT,
                label: 'Pengembangan Berjalan',
                description: 'Tim developer mengerjakan task sesuai rancangan yang sudah disetujui.',
            },
            {
                status: PROJECT_STATUS.SIT_IN_PROGRESS,
                label: 'Pengujian SIT',
                description: 'Tim internal menguji keterhubungan antar modul sebelum sistem diperlihatkan ke pemohon.',
            },
            {
                status: PROJECT_STATUS.SIT_PASSED,
                label: 'SIT Dinyatakan Lulus',
                description: 'Seluruh task lulus uji integrasi dan disetujui developer, analis, serta Lead Pengembangan.',
            },
            {
                status: PROJECT_STATUS.UAT_IN_PROGRESS,
                label: 'UAT Bersama Pemohon',
                description: 'Pemohon mencoba sistem, mencatat temuan, dan menandatangani hasil pengujian.',
            },
            {
                status: PROJECT_STATUS.UAT_PASSED,
                label: 'UAT Dinyatakan Lulus',
                description: 'Hasil UAT disetujui pemohon dan penanda tangan internal tanpa permintaan revisi tersisa.',
            },
            {
                status: PROJECT_STATUS.DEV_COMPLETED,
                label: 'Pengembangan Selesai',
                description: 'Pekerjaan pengembangan ditutup dan proyek siap diajukan ke QA serta Keamanan Siber.',
            },
        ],
    },
    {
        id: 'phase3qa',
        label: 'Fase 3A',
        sublabel: 'Quality Assurance',
        description: 'Pengujian mutu oleh Grup Perencanaan dan Quality Assurance. Berjalan paralel dengan Fase 3B.',
        trackKey: 'qa',
        milestones: [
            {
                trackStatus: TRACK_STATUS.SUBMITTED,
                historyStatus: PROJECT_STATUS.READY_FOR_QA,
                label: 'Diajukan ke Tim QA',
                description: 'Project Manager mengajukan proyek beserta ruang lingkup pengujian ke Lead QA.',
            },
            {
                trackStatus: TRACK_STATUS.IN_PROGRESS,
                historyStatus: PROJECT_STATUS.QA_IN_PROGRESS,
                label: 'Pengujian QA Berjalan',
                description: 'Analis QA menjalankan skenario uji dan mencatat temuannya.',
            },
            {
                trackStatus: TRACK_STATUS.REVIEW,
                label: 'Review Lead QA',
                description: 'Lead QA menelaah laporan pengujian sebelum memberi keputusan lulus.',
            },
            {
                trackStatus: TRACK_STATUS.PASSED,
                historyStatus: PROJECT_STATUS.QA_PASSED,
                label: 'QA Dinyatakan Lulus',
                description: 'Jalur QA ditutup dengan hasil lulus.',
            },
        ],
    },
    {
        id: 'phase3cyber',
        label: 'Fase 3B',
        sublabel: 'Keamanan Siber',
        description: 'Audit keamanan dan penetration testing. Berjalan paralel dengan Fase 3A.',
        trackKey: 'cyber',
        milestones: [
            {
                trackStatus: TRACK_STATUS.SUBMITTED,
                label: 'Diajukan ke Tim Keamanan Siber',
                description: 'Project Manager mengajukan proyek untuk diaudit keamanannya.',
            },
            {
                trackStatus: TRACK_STATUS.IN_PROGRESS,
                historyStatus: PROJECT_STATUS.CYBER_IN_PROGRESS,
                label: 'Pentest Berjalan',
                description: 'Tim keamanan siber menguji ketahanan sistem dan mencatat temuannya.',
            },
            {
                trackStatus: TRACK_STATUS.REVIEW,
                label: 'Review Lead Keamanan Siber',
                description: 'Lead keamanan siber menelaah laporan pentest sebelum memberi keputusan lulus.',
            },
            {
                trackStatus: TRACK_STATUS.PASSED,
                historyStatus: PROJECT_STATUS.CYBER_PASSED,
                label: 'Keamanan Siber Dinyatakan Lulus',
                description: 'Jalur keamanan siber ditutup dengan hasil lulus.',
            },
        ],
    },
    {
        id: 'phase4',
        label: 'Fase 4',
        sublabel: 'Rilis & Kepatuhan',
        description: 'Pengajuan go-live ke Grup Infrastruktur, keputusan Quality Gate, lalu penerapan ke produksi.',
        milestones: [
            {
                status: PROJECT_STATUS.PENDING_GOLIVE,
                label: 'Menunggu Persetujuan Go-Live',
                description: 'Rencana rilis diajukan dan menunggu keputusan Quality Gate dari Head of IT.',
            },
            {
                status: PROJECT_STATUS.LIVE_PRODUCTION,
                label: 'Berjalan di Produksi',
                description: 'Sistem sudah diterapkan di lingkungan produksi dan dapat digunakan.',
            },
        ],
    },
];

/**
 * Status yang bukan kemajuan, melainkan simpangan dari alur.
 *
 * `anchorStatus` adalah titik tempat simpangan ini ditempelkan — biasanya tahap
 * yang pekerjaannya diulang. `anchorStatus: null` berarti titiknya diambil dari
 * riwayat: penundaan dan pembatalan bisa terjadi dari tahap mana pun, sehingga
 * satu titik tetap akan selalu salah untuk sebagian proyek.
 */
export const JOURNEY_DETOURS = {
    [PROJECT_STATUS.REJECTED]: {
        anchorStatus: PROJECT_STATUS.IN_REVIEW,
        state: 'rejected',
        label: 'Pengajuan Ditolak',
        description: 'Pengajuan tidak dilanjutkan. Alasan penolakan tercantum pada rincian proyek.',
    },
    [PROJECT_STATUS.SIT_REVISION]: {
        anchorStatus: PROJECT_STATUS.IN_DEVELOPMENT,
        state: 'revision',
        label: 'Revisi Hasil SIT',
        description: 'Temuan pengujian SIT dikembalikan ke tim developer untuk diperbaiki.',
    },
    [PROJECT_STATUS.UAT_REVISION_SIT]: {
        anchorStatus: PROJECT_STATUS.SIT_IN_PROGRESS,
        state: 'revision',
        label: 'Revisi UAT — Ulang SIT',
        description: 'Perbaikan atas temuan UAT harus lulus pengujian SIT lagi sebelum UAT diulang.',
    },
    [PROJECT_STATUS.UAT_REVISION_DEV]: {
        anchorStatus: PROJECT_STATUS.IN_DEVELOPMENT,
        state: 'revision',
        label: 'Revisi UAT — Kembali ke Developer',
        description: 'Temuan pada pertemuan UAT dikembalikan ke tim developer untuk diperbaiki.',
    },
    [PROJECT_STATUS.RETURN_TO_DEV]: {
        anchorStatus: PROJECT_STATUS.IN_DEVELOPMENT,
        state: 'revision',
        label: 'Dikembalikan ke Developer',
        description: 'Temuan dari jalur pengujian QA atau Keamanan Siber sedang diperbaiki tim developer.',
    },
    [PROJECT_STATUS.ON_HOLD]: {
        anchorStatus: null,
        state: 'revision',
        label: 'Proyek Ditunda',
        description: 'Proyek dihentikan sementara. Perjalanan dilanjutkan dari tahap terakhir yang tercatat.',
    },
    [PROJECT_STATUS.CANCELLED]: {
        anchorStatus: null,
        state: 'rejected',
        label: 'Proyek Dibatalkan',
        description: 'Proyek dihentikan dan tidak dilanjutkan ke tahap berikutnya.',
    },
};

/** Status akhir yang tidak akan pernah maju lagi. */
const TERMINATED_STATUSES = [PROJECT_STATUS.REJECTED, PROJECT_STATUS.CANCELLED];

const normalizeStatus = (value) => String(value || '').trim().toUpperCase();

const readProjectStatus = (project) => normalizeStatus(project?.status) || PROJECT_STATUS.PENDING;

/**
 * Riwayat status proyek, terbaru lebih dulu.
 *
 * Bentuk key-nya berbeda tergantung asal objeknya (`status_histories` dari
 * `ProjectResource`, `statusHistories` bila sudah melewati normalisasi lokal),
 * jadi keduanya dibaca. Baris tanpa `to_status` dibuang karena tidak bisa
 * dipetakan ke titik mana pun.
 */
const readStatusHistory = (project) => {
    const rows = project?.status_histories || project?.statusHistories || [];
    if (!Array.isArray(rows)) return [];

    return rows
        .map((row) => ({
            status: normalizeStatus(row?.to_status ?? row?.toStatus),
            fromStatus: normalizeStatus(row?.from_status ?? row?.fromStatus) || null,
            at: row?.created_at || row?.createdAt || null,
            by: row?.changed_by?.name || row?.changedBy?.name || null,
            notes: row?.notes || null,
        }))
        .filter((row) => row.status !== '');
};

/**
 * Cap waktu terbaru per status.
 *
 * Relasi `statusHistories` sudah diurutkan menurun oleh backend, sehingga entri
 * pertama untuk sebuah status adalah yang paling baru. Yang dipakai memang yang
 * terbaru: pada siklus yang diulang (revisi Mayor UAT mengulang SIT lalu UAT),
 * tanggal yang berguna bagi pemohon adalah tanggal putaran terakhir.
 */
const indexHistoryByStatus = (history) => {
    const stamps = new Map();
    for (const row of history) {
        if (!stamps.has(row.status)) stamps.set(row.status, row);
    }

    return stamps;
};

/** Titik maju terakhir yang tercatat di riwayat, dipakai sebagai jangkar simpangan. */
const lastSpineStatusFromHistory = (history) => {
    for (const row of history) {
        if (PROJECT_STATUS_SPINE.includes(row.status)) return row.status;
    }

    return null;
};

/**
 * Posisi proyek pada urutan maju, beserta simpangan yang sedang berlaku.
 *
 * Dipisah sebagai fungsi sendiri karena dipakai dua kali: menilai titik dan
 * menilai fase. Keduanya harus memakai jangkar yang sama, kalau tidak sebuah fase
 * bisa dinyatakan selesai sementara titik di dalamnya masih menunggu.
 */
const resolveJourneyPosition = (project) => {
    const currentStatus = readProjectStatus(project);
    const history = readStatusHistory(project);
    const detour = JOURNEY_DETOURS[currentStatus] || null;

    const anchorStatus = detour
        ? (detour.anchorStatus || lastSpineStatusFromHistory(history) || PROJECT_STATUS.PENDING)
        : currentStatus;

    return {
        currentStatus,
        history,
        stamps: indexHistoryByStatus(history),
        detour,
        anchorStatus,
        anchorIndex: PROJECT_STATUS_SPINE.indexOf(anchorStatus),
        isTerminated: TERMINATED_STATUSES.includes(currentStatus),
    };
};

/**
 * Keadaan satu titik pada tulang punggung status: completed, active, revision,
 * rejected, atau pending.
 *
 * Riwayat diperiksa lebih dulu daripada perbandingan posisi. Proyek yang sedang
 * direvisi berada pada posisi yang lebih awal daripada tahap yang sudah pernah
 * dilewatinya — tanpa riwayat, tahap SIT yang sudah lulus akan kembali tampil
 * "belum dimulai" hanya karena pekerjaannya sedang diperbaiki.
 */
const resolveSpineMilestoneState = (status, position) => {
    if (status === position.anchorStatus) {
        if (position.detour) return position.detour.state;

        return 'active';
    }

    const index = PROJECT_STATUS_SPINE.indexOf(status);
    if (position.anchorIndex >= 0 && index >= 0 && position.anchorIndex > index) return 'completed';
    if (position.stamps.has(status)) return 'completed';

    return 'pending';
};

/**
 * Keadaan satu titik pada jalur pengujian paralel.
 *
 * Dinilai dari kolom jalur, bukan dari status utama, karena QA dan Keamanan Siber
 * berjalan bersamaan: saat satu jalur memegang penunjuk siklus, status utama tidak
 * mengatakan apa pun tentang jalur yang lain. TRACK_STATUS.FAILED tidak punya titik
 * sendiri — ia menandai tahap pengujian sebagai temuan yang harus diperbaiki.
 */
const resolveTrackMilestoneState = (trackStatus, milestoneTrackStatus) => {
    const currentIndex = TRACK_STATUS_SPINE.indexOf(trackStatus);
    const milestoneIndex = TRACK_STATUS_SPINE.indexOf(milestoneTrackStatus);

    if (trackStatus === TRACK_STATUS.FAILED) {
        return milestoneTrackStatus === TRACK_STATUS.IN_PROGRESS ? 'revision' : 'pending';
    }

    if (currentIndex < 0) return 'pending';
    if (currentIndex > milestoneIndex) return 'completed';
    if (currentIndex === milestoneIndex) {
        return milestoneTrackStatus === TRACK_STATUS.PASSED ? 'completed' : 'active';
    }

    return 'pending';
};

/**
 * Keadaan sebuah fase disimpulkan dari titik-titik di dalamnya, bukan dihitung
 * ulang dari status. Menghitungnya dua kali adalah cara termudah membuat judul fase
 * bertentangan dengan isinya.
 */
const resolvePhaseState = (milestones) => {
    if (milestones.some((milestone) => milestone.state === 'rejected')) return 'rejected';
    if (milestones.some((milestone) => milestone.state === 'revision')) return 'revision';
    if (milestones.some((milestone) => milestone.state === 'active')) return 'active';
    if (milestones.every((milestone) => milestone.state === 'completed')) return 'completed';
    if (milestones.some((milestone) => milestone.state === 'completed')) return 'active';

    return 'pending';
};

/**
 * Bangun perjalanan lengkap sebuah proyek untuk ditampilkan sebagai timeline.
 *
 * Menerima objek proyek apa adanya dari `ProjectContext` (hasil `ProjectResource`),
 * jadi pemanggil tidak perlu memuat apa pun tambahan: status jalur dan riwayat
 * status sudah ikut pada payload proyek.
 *
 * @returns {{
 *   currentStatus: string,
 *   currentStatusLabel: string,
 *   detour: object | null,
 *   progress: number,
 *   phases: Array<object>,
 * }}
 */
export const getProjectJourney = (project) => {
    const position = resolveJourneyPosition(project);
    const trackStatusByKey = {
        qa: getQaTrackStatus(project),
        cyber: getCyberTrackStatus(project),
    };

    const phases = JOURNEY_PHASES.map((phase) => {
        const milestones = phase.milestones.map((milestone) => {
            const historyStatus = milestone.historyStatus || milestone.status || null;
            const stamp = historyStatus ? position.stamps.get(historyStatus) : null;
            const state = phase.trackKey
                ? resolveTrackMilestoneState(trackStatusByKey[phase.trackKey], milestone.trackStatus)
                : resolveSpineMilestoneState(milestone.status, position);

            return {
                key: milestone.status || `${phase.id}-${milestone.trackStatus}`,
                label: milestone.label,
                description: milestone.description,
                state,
                at: stamp?.at || null,
                by: stamp?.by || null,
                notes: stamp?.notes || null,
                // Simpangan hanya ditempelkan pada titik jangkarnya, supaya keterangan
                // "sedang direvisi" muncul tepat pada tahap yang pekerjaannya diulang.
                detour: !phase.trackKey && milestone.status === position.anchorStatus
                    ? position.detour
                    : null,
            };
        });

        return {
            id: phase.id,
            label: phase.label,
            sublabel: phase.sublabel,
            description: phase.description,
            trackKey: phase.trackKey || null,
            state: resolvePhaseState(milestones),
            milestones,
        };
    });

    // Kemajuan dihitung dari titik yang sudah DICAPAI, bukan hanya yang sudah
    // ditutup. Tahap yang sedang dikerjakan ikut dihitung karena proyek yang baru
    // saja diajukan memang sudah bergerak, dan melaporkannya 0% membuat pemohon
    // menyimpulkan pengajuannya belum masuk.
    const allMilestones = phases.flatMap((phase) => phase.milestones);
    const reachedCount = allMilestones
        .filter((milestone) => ['completed', 'active', 'revision'].includes(milestone.state))
        .length;
    const progress = position.currentStatus === PROJECT_STATUS.LIVE_PRODUCTION
        ? 100
        : position.isTerminated
            ? 0
            : Math.round((reachedCount / allMilestones.length) * 100);

    return {
        currentStatus: position.currentStatus,
        currentStatusLabel: PROJECT_STATUS_LABEL[position.currentStatus] || position.currentStatus,
        detour: position.detour,
        progress,
        phases,
    };
};

/**
 * Persentase kemajuan proyek.
 *
 * Dihitung dari jumlah titik yang benar-benar sudah dilewati, bukan dari posisi
 * status pada satu daftar. Perhitungan lama memakai `indexOf` pada daftar yang
 * tidak memuat status SIT/UAT, sehingga proyek yang sedang diuji internal selalu
 * dilaporkan 0%.
 */
export const getProjectProgress = (project) => getProjectJourney(project).progress;
