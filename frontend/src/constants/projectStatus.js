/**
 * Konstanta status proyek yang terstandarisasi untuk seluruh aplikasi NagariSDLC.
 * Gunakan konstanta ini di SEMUA komponen, jangan hardcode string status langsung.
 *
 * ⚠️  PENTING: Nilai string di sini HARUS cocok 100% dengan enum ProjectStatus.php di Backend!
 *
 * Bentuk alur menurut state machine backend (ProjectWorkflowService::$allowedTransitions):
 *
 *   PENDING → IN_REVIEW → ANALYSIS_APPROVED → READY_FOR_DEVELOPMENT
 *     → DEV_ANALYSIS → DEV_ANALYSIS_DONE → IN_DEVELOPMENT
 *     → SIT_IN_PROGRESS → SIT_PASSED → UAT_IN_PROGRESS → UAT_PASSED → DEV_COMPLETED
 *
 *   DEV_COMPLETED ─┬→ READY_FOR_QA → QA_IN_PROGRESS → QA_PASSED ─┬→ PENDING_GOLIVE
 *                  └→ CYBER_IN_PROGRESS → CYBER_PASSED ──────────┘   → LIVE_PRODUCTION
 *
 * DEV_COMPLETED adalah titik cabang, bukan sambungan ke satu antrean berikutnya: backend
 * membuka READY_FOR_QA, QA_IN_PROGRESS, DAN CYBER_IN_PROGRESS sekaligus dari sana. Kedua
 * jalur pengujian berjalan paralel, dan QA_PASSED serta CYBER_PASSED sengaja dibuat
 * simetris supaya jalur mana pun yang sign-off lebih dulu tetap dapat menerima sign-off
 * jalur lain. Karena itu status utama tidak pernah cukup untuk menyimpulkan berapa jalur
 * yang sudah lulus — pakai kolom jalurnya lewat canRequestGoLive() di bawah. Syarat "kedua
 * jalur wajib lulus" dijaga di titik gabungnya, oleh
 * ProjectWorkflowService::validateTransitionPrerequisites() pada transisi menuju
 * PENDING_GOLIVE, bukan oleh bentuk matriks transisinya.
 *
 * Cabangnya bisa berbalik: sign-off TIDAK LULUS seorang Lead pada salah satu jalur
 * memindahkan status utama ke RETURN_TO_DEV dan membuka satu putaran pengembalian
 * (`project_return_rounds`) pada jalur yang menolak. Jalur itu baru boleh diajukan ulang
 * setelah setiap task perbaikan bertanda putaran tersebut punya penerima dan selesai —
 * gerbang ProjectReturnRoundService::assertResubmitAllowed(), dipasang di
 * TestingTrackService::submitRequest(). Rinciannya ada di `docs/WORKFLOW.md` bagian 5.
 *
 * Simpangan fase pengembangan tidak digambar di atas agar bentuk alurnya tetap terbaca,
 * tetapi statusnya ada dan terpakai: SIT_REVISION, UAT_REVISION_SIT (menuntut SIT dijalankan
 * ulang), dan UAT_REVISION_DEV (kembali ke pengembangan). UAT_PASSED sendiri hanya keluaran
 * opsional UAT internal, bukan gerbang rilis. Daftar lengkap seluruh anggota enum ada pada
 * peta di bawah, bukan pada header ini.
 *
 * Tidak ada UAT final setelah QA & Siber. Begitu kedua jalur pengujian lulus, PM langsung
 * mengajukan go-live ke Grup Infrastruktur. READY_FOR_UAT masih menjadi anggota enum backend
 * namun sudah tidak punya satu pun transisi masuk maupun keluar — hanya tersisa untuk
 * membaca riwayat lama.
 *
 * Special: ON_HOLD hanya dapat dimasuki dari IN_DEVELOPMENT, dan CANCELLED hanya dari
 * PENDING. Keduanya BUKAN "dari status mana pun" seperti yang tertulis pada header ini
 * sebelumnya — matriks backend memberi masing-masing satu pintu masuk saja.
 */

/**
 * Nomor fase pada komentar blok di bawah mengikuti PHASE_KEY_BY_STATUS — peta itulah yang
 * benar-benar dibaca layar. Alurnya EMPAT fase: QA dan Keamanan Siber duduk bersama di
 * Fase 3 karena keduanya paralel, dan rilis produksi ada di Fase 4. Sebelumnya blok-blok
 * ini memecah QA (Fase 3), Siber (Fase 4), dan rilis (Fase 5), sehingga satu berkas
 * menomori fasenya sendiri dengan dua cara yang berbeda.
 *
 * Urutan key di sini bukan detail internal: `pages/pm/Tasks.jsx` memakai
 * Object.values(PROJECT_STATUS) sebagai urutan tampil dropdown filter status. Karena itu
 * ada dua key yang tetap duduk di blok fase yang bukan fasenya, masing-masing dengan
 * catatan di tempatnya.
 */
export const PROJECT_STATUS = {
    // Fase 1: inisiasi & analisis perencanaan
    PENDING: 'PENDING',
    IN_REVIEW: 'IN_REVIEW',
    ANALYSIS_APPROVED: 'ANALYSIS_APPROVED',
    REJECTED: 'REJECTED',

    // Fase 2: pengembangan, termasuk siklus SIT & UAT internal
    READY_FOR_DEVELOPMENT: 'READY_FOR_DEVELOPMENT',
    DEV_ANALYSIS: 'DEV_ANALYSIS',
    DEV_ANALYSIS_DONE: 'DEV_ANALYSIS_DONE',
    IN_DEVELOPMENT: 'IN_DEVELOPMENT',
    SIT_IN_PROGRESS: 'SIT_IN_PROGRESS',
    SIT_PASSED: 'SIT_PASSED',
    SIT_REVISION: 'SIT_REVISION',
    UAT_IN_PROGRESS: 'UAT_IN_PROGRESS',
    UAT_REVISION_SIT: 'UAT_REVISION_SIT',
    UAT_REVISION_DEV: 'UAT_REVISION_DEV',
    // Penanda selesainya seluruh pekerjaan pengembangan, jadi masih Fase 2 — bukan status
    // pertama Fase 3. Backend memperlakukannya sama: DEV_COMPLETED adalah gerbang masuk
    // pengujian (TestingTrackService::SUBMITTABLE_MAIN_STATUSES), bukan pengujian itu sendiri.
    DEV_COMPLETED: 'DEV_COMPLETED',

    // Fase 3: dua jalur pengujian paralel — QA & Keamanan Siber
    READY_FOR_QA: 'READY_FOR_QA',
    QA_IN_PROGRESS: 'QA_IN_PROGRESS',
    // Dipetakan ke Fase 2 oleh PHASE_KEY_BY_STATUS, bukan Fase 3: proyek yang dikembalikan
    // sedang berada di pengembangan, bukan di antrean pengujian. Key-nya tetap di sini
    // karena urutan deklarasi ikut menentukan urutan dropdown filter — lihat catatan pada
    // docblock di atas.
    RETURN_TO_DEV: 'RETURN_TO_DEV',
    QA_PASSED: 'QA_PASSED',
    CYBER_IN_PROGRESS: 'CYBER_IN_PROGRESS',
    CYBER_PASSED: 'CYBER_PASSED',

    // Fase 4: rilis produksi
    //
    // READY_FOR_UAT & UAT_PASSED tidak lagi menjadi gerbang rilis. READY_FOR_UAT sudah
    // tidak punya transisi apa pun di backend (legacy, hanya untuk riwayat) dan karena itu
    // dipetakan ke fase rilis. UAT_PASSED adalah keluaran opsional UAT internal, sehingga
    // PHASE_KEY_BY_STATUS memetakannya ke Fase 2 — key-nya tetap di blok ini dengan alasan
    // urutan yang sama seperti RETURN_TO_DEV di atas.
    READY_FOR_UAT: 'READY_FOR_UAT',
    UAT_PASSED: 'UAT_PASSED',
    PENDING_GOLIVE: 'PENDING_GOLIVE',
    LIVE_PRODUCTION: 'LIVE_PRODUCTION',

    // Special: di luar alur maju. PHASE_KEY_BY_STATUS memetakan keduanya ke Fase 1.
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
    [PROJECT_STATUS.SIT_IN_PROGRESS]: 'Pengujian SIT Berlangsung',
    [PROJECT_STATUS.SIT_PASSED]: 'SIT Lulus',
    [PROJECT_STATUS.SIT_REVISION]: 'Revisi SIT → Dev',
    [PROJECT_STATUS.UAT_IN_PROGRESS]: 'UAT Internal Berlangsung',
    [PROJECT_STATUS.UAT_PASSED]: 'UAT Internal Lulus',
    // Bukan legacy, walau namanya mirip dengan READY_FOR_UAT di bawah. Statusnya hidup:
    // dapat dicapai dari UAT_IN_PROGRESS, punya transisi keluar ke SIT_IN_PROGRESS dan
    // UAT_IN_PROGRESS, punya entri rolePermissions, serta punya layarnya sendiri di
    // `components/SITUATWizard.jsx`. Inilah status revisi UAT mayor yang mengulang siklus
    // SIT lalu UAT dari awal, jadi menandainya "(Legacy)" membuat pengguna bank menyangka
    // proyeknya nyangkut di alur usang.
    [PROJECT_STATUS.UAT_REVISION_SIT]: 'Revisi UAT → Ulang SIT',
    [PROJECT_STATUS.UAT_REVISION_DEV]: 'Revisi UAT → Kembali Dev',
    [PROJECT_STATUS.DEV_COMPLETED]: 'Dev Selesai — Siap QA & Siber',
    [PROJECT_STATUS.READY_FOR_QA]: 'Siap QA Testing',
    [PROJECT_STATUS.QA_IN_PROGRESS]: 'Sedang QA Testing',
    // Sebutan lengkap "Developer", bukan singkatan "Dev". Statusnya dibaca juga oleh
    // pemohon di halaman Lacak Status Proyek, dan label ini adalah satu-satunya sebutan
    // yang dipakai seluruh layar — lihat `constants/projectJourney.js` serta peta warna
    // di `pages/Track.jsx`, keduanya mengacu ke sini.
    [PROJECT_STATUS.RETURN_TO_DEV]: 'Dikembalikan ke Developer',
    [PROJECT_STATUS.QA_PASSED]: 'QA Lulus',
    [PROJECT_STATUS.CYBER_IN_PROGRESS]: 'Sedang Pentest',
    [PROJECT_STATUS.CYBER_PASSED]: 'Cyber Lulus',
    // Legacy: UAT final setelah QA & Siber sudah dihapus dari alur. Label tetap ada
    // supaya riwayat status lama tidak tampil sebagai kode mentah.
    [PROJECT_STATUS.READY_FOR_UAT]: 'Siap UAT Final (Legacy)',
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
    [PROJECT_STATUS.SIT_IN_PROGRESS]: 'bg-sky-100 text-sky-700 border-sky-200',
    [PROJECT_STATUS.SIT_PASSED]: 'bg-teal-100 text-teal-700 border-teal-200',
    [PROJECT_STATUS.SIT_REVISION]: 'bg-orange-100 text-orange-700 border-orange-200',
    [PROJECT_STATUS.UAT_IN_PROGRESS]: 'bg-amber-100 text-amber-700 border-amber-200',
    [PROJECT_STATUS.UAT_PASSED]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [PROJECT_STATUS.UAT_REVISION_SIT]: 'bg-orange-100 text-orange-700 border-orange-200',
    [PROJECT_STATUS.UAT_REVISION_DEV]: 'bg-red-100 text-red-700 border-red-200',
    [PROJECT_STATUS.DEV_COMPLETED]: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
    [PROJECT_STATUS.READY_FOR_QA]: 'bg-purple-50 text-purple-600 border-purple-200',
    [PROJECT_STATUS.QA_IN_PROGRESS]: 'bg-purple-100 text-purple-700 border-purple-200',
    // Oranye, sekelompok dengan SIT_REVISION dan UAT_REVISION_SIT: pengembalian dari
    // jalur pengujian adalah pekerjaan ulang, bukan kegagalan. Merah di peta ini
    // menandakan penolakan atau penghentian (REJECTED, CANCELLED), dan kuning-amber
    // menandakan menunggu atau sedang berjalan.
    [PROJECT_STATUS.RETURN_TO_DEV]: 'bg-orange-100 text-orange-700 border-orange-200',
    [PROJECT_STATUS.QA_PASSED]: 'bg-teal-100 text-teal-700 border-teal-200',
    [PROJECT_STATUS.CYBER_IN_PROGRESS]: 'bg-orange-100 text-orange-700 border-orange-200',
    [PROJECT_STATUS.CYBER_PASSED]: 'bg-teal-100 text-teal-700 border-teal-200',
    // Legacy — lihat catatan pada PROJECT_STATUS_LABEL.
    [PROJECT_STATUS.READY_FOR_UAT]: 'bg-gray-100 text-gray-600 border-gray-200',
    [PROJECT_STATUS.PENDING_GOLIVE]: 'bg-amber-100 text-amber-700 border-amber-200',
    [PROJECT_STATUS.LIVE_PRODUCTION]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [PROJECT_STATUS.ON_HOLD]: 'bg-gray-100 text-gray-500 border-gray-200',
    [PROJECT_STATUS.CANCELLED]: 'bg-red-50 text-red-500 border-red-200',
};

/**
 * Pemetaan status ke nomor fase, satu entri per anggota App\Enums\ProjectStatus.
 *
 * Daftarnya sengaja hanya memuat nilai enum. Versi sebelumnya juga mencocokkan
 * status karangan seperti 'IN_SPRINT', 'CODING', atau 'UAT_INTERNAL' dan menutupnya
 * dengan pencocokan potongan kata (mis. semua status ber-'DEV' jadi Fase 2). Tidak
 * satu pun nilai itu bisa muncul karena kolom `projects.status` dibatasi enum, dan
 * pencocokan potongan kata itu justru menyembunyikan salah pemetaan: 'DEV_COMPLETED'
 * dan 'RETURN_TO_DEV' ikut tertangkap kata 'DEV' walau nomor fasenya harus eksplisit.
 *
 * Status yang tidak dikenal jatuh ke Fase 1 lewat getProjectPhaseKey.
 */
const PHASE_KEY_BY_STATUS = {
    // Fase 1: perencanaan & analisis
    [PROJECT_STATUS.PENDING]: 1,
    [PROJECT_STATUS.IN_REVIEW]: 1,
    [PROJECT_STATUS.ANALYSIS_APPROVED]: 1,
    [PROJECT_STATUS.REJECTED]: 1,
    [PROJECT_STATUS.ON_HOLD]: 1,
    [PROJECT_STATUS.CANCELLED]: 1,

    // Fase 2: pengembangan, termasuk siklus SIT & UAT internal
    [PROJECT_STATUS.READY_FOR_DEVELOPMENT]: 2,
    [PROJECT_STATUS.DEV_ANALYSIS]: 2,
    [PROJECT_STATUS.DEV_ANALYSIS_DONE]: 2,
    [PROJECT_STATUS.IN_DEVELOPMENT]: 2,
    [PROJECT_STATUS.SIT_IN_PROGRESS]: 2,
    [PROJECT_STATUS.SIT_PASSED]: 2,
    [PROJECT_STATUS.SIT_REVISION]: 2,
    [PROJECT_STATUS.UAT_IN_PROGRESS]: 2,
    [PROJECT_STATUS.UAT_PASSED]: 2,
    [PROJECT_STATUS.UAT_REVISION_SIT]: 2,
    [PROJECT_STATUS.UAT_REVISION_DEV]: 2,
    [PROJECT_STATUS.DEV_COMPLETED]: 2,
    [PROJECT_STATUS.RETURN_TO_DEV]: 2,

    // Fase 3: dua jalur pengujian independen QA & Keamanan Siber
    [PROJECT_STATUS.READY_FOR_QA]: 3,
    [PROJECT_STATUS.QA_IN_PROGRESS]: 3,
    [PROJECT_STATUS.QA_PASSED]: 3,
    [PROJECT_STATUS.CYBER_IN_PROGRESS]: 3,
    [PROJECT_STATUS.CYBER_PASSED]: 3,

    // Fase 4: rilis. READY_FOR_UAT hanya sisa riwayat lama, dipetakan ke fase rilis.
    [PROJECT_STATUS.READY_FOR_UAT]: 4,
    [PROJECT_STATUS.PENDING_GOLIVE]: 4,
    [PROJECT_STATUS.LIVE_PRODUCTION]: 4,
};

/**
 * Helper: Pemetaan status proyek ke Nomor Fase SDLC (1, 2, 3, 4)
 * Digunakan untuk Grafik Distribusi Proyek Dashboard & Laporan SDLC Enterprise.
 */
export const getProjectPhaseKey = (status) => {
    if (!status) return 1;
    const st = String(status).trim().toUpperCase();
    return PHASE_KEY_BY_STATUS[st] ?? 1;
};

/**
 * Status jalur pengujian independen QA & Keamanan Siber.
 * Mirror dari backend App\Enums\TrackStatus (kolom projects.qa_status & projects.cyber_status).
 *
 * Dipisahkan dari PROJECT_STATUS karena projects.status hanya menyimpan SATU
 * penunjuk siklus utama, sedangkan dua jalur ini berjalan paralel dan bisa
 * maju-mundur sendiri tanpa saling menimpa.
 */
export const TRACK_STATUS = {
    NOT_SUBMITTED: 'NOT_SUBMITTED',
    SUBMITTED: 'SUBMITTED',
    IN_PROGRESS: 'IN_PROGRESS',
    REVIEW: 'REVIEW',
    PASSED: 'PASSED',
    FAILED: 'FAILED',
};

export const TRACK_STATUS_LABEL = {
    [TRACK_STATUS.NOT_SUBMITTED]: 'Belum Diajukan',
    [TRACK_STATUS.SUBMITTED]: 'Sudah Diajukan',
    [TRACK_STATUS.IN_PROGRESS]: 'Sedang Dikerjakan',
    [TRACK_STATUS.REVIEW]: 'Menunggu Review Lead',
    [TRACK_STATUS.PASSED]: 'Lulus',
    [TRACK_STATUS.FAILED]: 'Tidak Lulus',
};

/**
 * Baca status jalur QA dari objek proyek, apa pun bentuk key-nya
 * (camelCase dari state lokal, snake_case dari ProjectResource).
 */
export const getQaTrackStatus = (project) =>
    String(project?.qaStatus || project?.qa_status || TRACK_STATUS.NOT_SUBMITTED).trim().toUpperCase();

export const getCyberTrackStatus = (project) =>
    String(project?.cyberStatus || project?.cyber_status || TRACK_STATUS.NOT_SUBMITTED).trim().toUpperCase();

/** Jalur sudah dinyatakan lulus oleh Lead. */
export const isTrackPassed = (trackStatus) =>
    String(trackStatus || '').trim().toUpperCase() === TRACK_STATUS.PASSED;

/** Jalur sedang berjalan: sudah diajukan namun belum ada keputusan akhir. */
export const isTrackActive = (trackStatus) =>
    [TRACK_STATUS.SUBMITTED, TRACK_STATUS.IN_PROGRESS, TRACK_STATUS.REVIEW]
        .includes(String(trackStatus || '').trim().toUpperCase());

/**
 * Gate go-live: dua jalur pengujian harus lulus sebelum PM boleh mengajukan
 * migrasi & rilis ke Grup Infrastruktur. Tidak ada UAT final setelah QA & Siber.
 *
 * Sengaja dihitung dari kolom jalur — bukan dari status utama — supaya urutan
 * siapa yang sign-off lebih dulu tidak mengubah hasilnya. Aturan yang sama
 * ditegakkan backend pada ProjectWorkflowService::validateTransitionPrerequisites()
 * untuk transisi menuju PENDING_GOLIVE.
 */
export const canRequestGoLive = (project) =>
    isTrackPassed(getQaTrackStatus(project)) && isTrackPassed(getCyberTrackStatus(project));

/**
 * Status utama yang secara sah boleh naik ke READY_FOR_QA menurut matriks transisi
 * backend (ProjectWorkflowService::$allowedTransitions).
 *
 * Di luar daftar ini, pengajuan QA hanya menulis kolom qa_status dan sengaja TIDAK
 * menyentuh status utama — misalnya saat jalur Siber sedang memegang penunjuk siklus
 * (CYBER_IN_PROGRESS / CYBER_PASSED). Menyertakan status di kasus itu hanya
 * menghasilkan 422 tanpa menambah informasi apa pun.
 */
export const STATUSES_ALLOWING_READY_FOR_QA = [
    PROJECT_STATUS.DEV_COMPLETED,
    PROJECT_STATUS.RETURN_TO_DEV,
];

export const canAdvanceStatusToReadyForQa = (status) =>
    STATUSES_ALLOWING_READY_FOR_QA.includes(String(status || '').trim().toUpperCase());

/**
 * Status utama tempat fase pengujian QA masih bisa dimulai atau dilanjutkan.
 *
 * Proyek yang lolos filter ini boleh diajukan PM, didisposisi QA Lead, lalu di-sign-off
 * tanpa ditolak state machine.
 *
 * IN_DEVELOPMENT, SIT_PASSED, dan UAT_PASSED sengaja tidak masuk. Pengujian QA dan
 * Keamanan Siber baru boleh dimulai setelah seluruh pekerjaan pengembangan — termasuk
 * SIT dan UAT Internal — dinyatakan selesai, dan penanda selesainya adalah
 * DEV_COMPLETED. UAT_PASSED hanyalah keluaran opsional UAT internal yang masih harus
 * melewati DEV_COMPLETED lebih dulu.
 *
 * RETURN_TO_DEV tetap masuk atas keputusan pengguna: proyek yang dikembalikan karena
 * defect boleh diajukan ulang langsung setelah perbaikan, tanpa dipaksa mengulang
 * seluruh siklus SIT/UAT.
 *
 * Status pengujian yang sedang berjalan (READY_FOR_QA sampai CYBER_PASSED) ikut masuk
 * karena dua jalur berjalan paralel: penunjuk siklus bisa sedang dipegang jalur lain
 * saat PM mengajukan jalur yang belum berjalan.
 *
 * Daftar ini harus tetap cermin `TestingTrackService::SUBMITTABLE_MAIN_STATUSES`.
 */
export const STATUSES_ALLOWING_QA_TRACK_START = [
    PROJECT_STATUS.DEV_COMPLETED,
    PROJECT_STATUS.RETURN_TO_DEV,
    PROJECT_STATUS.READY_FOR_QA,
    PROJECT_STATUS.QA_IN_PROGRESS,
    PROJECT_STATUS.QA_PASSED,
    PROJECT_STATUS.CYBER_IN_PROGRESS,
    PROJECT_STATUS.CYBER_PASSED,
];

/** Padanan STATUSES_ALLOWING_QA_TRACK_START untuk jalur Keamanan Siber. */
export const STATUSES_ALLOWING_CYBER_TRACK_START = [
    PROJECT_STATUS.DEV_COMPLETED,
    PROJECT_STATUS.RETURN_TO_DEV,
    PROJECT_STATUS.READY_FOR_QA,
    PROJECT_STATUS.QA_IN_PROGRESS,
    PROJECT_STATUS.QA_PASSED,
    PROJECT_STATUS.CYBER_IN_PROGRESS,
    PROJECT_STATUS.CYBER_PASSED,
];

export const canStartQaTrack = (status) =>
    STATUSES_ALLOWING_QA_TRACK_START.includes(String(status || '').trim().toUpperCase());

export const canStartCyberTrack = (status) =>
    STATUSES_ALLOWING_CYBER_TRACK_START.includes(String(status || '').trim().toUpperCase());

/**
 * Helper komposit untuk melacak status pengujian paralel QA & Siber secara akurat.
 * Mencegah konflik status tertimpa saat QA & Pentest Siber berjalan bersamaan.
 */
export const getParallelTestingBadge = (project) => {
    if (!project) return { label: 'Development', colorClass: 'bg-cyan-100 text-cyan-800 border-cyan-200' };

    const status = String(project.status || '').toUpperCase();
    const qa = getQaTrackStatus(project);
    const cyber = getCyberTrackStatus(project);

    // Cek jika QA dan Siber 100% LULUS DUA-DUANYA
    if ((qa === 'PASSED' || status === 'QA_PASSED') && (cyber === 'PASSED' || status === 'CYBER_PASSED')) {
        return {
            label: '🎉 QA & Siber LULUS',
            colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
            isComplete: true
        };
    }

    // Ada jalur yang dinyatakan TIDAK LULUS — tampilkan lebih dulu supaya defect
    // tidak tertutup oleh label jalur lain yang masih berjalan.
    if (qa === TRACK_STATUS.FAILED || cyber === TRACK_STATUS.FAILED) {
        const failedTracks = [
            qa === TRACK_STATUS.FAILED ? 'QA' : null,
            cyber === TRACK_STATUS.FAILED ? 'Siber' : null,
        ].filter(Boolean).join(' & ');

        return {
            label: `⚠️ ${failedTracks} Tidak Lulus`,
            colorClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
            isFailed: true
        };
    }

    // Cek jika PARALEL DUA-DUANYA sedang berjalan aktif
    const qaActive = ['SUBMITTED', 'IN_PROGRESS', 'READY_FOR_QA', 'QA_IN_PROGRESS'].includes(qa) || ['READY_FOR_QA', 'QA_IN_PROGRESS'].includes(status);
    const cyberActive = ['SUBMITTED', 'IN_PROGRESS', 'CYBER_IN_PROGRESS'].includes(cyber) || status === 'CYBER_IN_PROGRESS';

    if (qaActive && cyberActive) {
        return {
            label: '⚡ QA & Siber Berlangsung (Paralel)',
            colorClass: 'bg-blue-100 text-blue-900 border-blue-300 font-bold animate-pulse',
            isParallel: true
        };
    }

    // QA Lulus, Cyber sedang berjalan
    if ((qa === 'PASSED' || status === 'QA_PASSED') && cyberActive) {
        return {
            label: '✅ QA Lulus • 🛡️ Pentest Siber',
            colorClass: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
            isParallel: true
        };
    }

    // Cyber Lulus, QA sedang berjalan
    if ((cyber === 'PASSED' || status === 'CYBER_PASSED') && qaActive) {
        return {
            label: '✅ Siber Lulus • 🔍 QA Testing',
            colorClass: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold',
            isParallel: true
        };
    }

    // Hanya QA aktif
    if (qaActive) {
        return {
            label: '🔍 QA Testing Berlangsung',
            colorClass: 'bg-indigo-100 text-indigo-800 border-indigo-200 font-bold',
            isQA: true
        };
    }

    // Hanya Siber aktif
    if (cyberActive) {
        return {
            label: '🛡️ Pentest Siber Berlangsung',
            colorClass: 'bg-purple-100 text-purple-800 border-purple-200 font-bold',
            isCyber: true
        };
    }

    // QA saja yang lulus
    if (qa === 'PASSED' || status === 'QA_PASSED') {
        return {
            label: '✅ QA Lulus (Siap Siber)',
            colorClass: 'bg-teal-100 text-teal-800 border-teal-200 font-bold'
        };
    }

    // Siber saja yang lulus
    if (cyber === 'PASSED' || status === 'CYBER_PASSED') {
        return {
            label: '✅ Pentest Siber Lulus (Siap QA)',
            colorClass: 'bg-purple-100 text-purple-900 border-purple-200 font-bold'
        };
    }

    // Default status label biasa
    const label = PROJECT_STATUS_LABEL[status] || status || 'Dalam Pengerjaan';
    const colorClass = PROJECT_STATUS_COLOR[status] || 'bg-gray-100 text-gray-700 border-gray-200';
    return { label, colorClass };
};


