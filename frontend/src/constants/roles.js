/**
 * Grup Perencanaan dan Quality Assurance — sumber acuan otorisasi untuk grup ini.
 *
 * Mencakup role Perencanaan dan QA yang dikerjakan kelompok personel yang sama.
 * Tabel `groups` hanya mengatur tampilan; otorisasi tetap berasal dari daftar ini.
 * Sinkronkan setiap perubahan dengan konstanta `App\Enums\UserRole` di backend.
 */

/** Nama resmi grup, untuk dipakai apa adanya di teks antarmuka. */
export const PLANNING_QA_GROUP_LABEL = 'Grup Perencanaan dan Quality Assurance';

/**
 * Analis anggota grup — berhak menerima penugasan Fase 1 maupun disposisi QA.
 *
 * Cermin `UserRole::PLANNING_QA_ANALYST_ROLES`.
 */
export const PLANNING_QA_ANALYST_ROLES = ['analyst', 'qa_tester'];

/**
 * Lead pada grup ini. `lead_group` memimpin sisi Perencanaan, `qa_lead` sisi QA.
 *
 * Cermin `UserRole::PLANNING_QA_LEAD_ROLES`.
 */
export const PLANNING_QA_LEAD_ROLES = ['lead_group', 'qa_lead'];

/**
 * Seluruh anggota grup, lead maupun analis.
 */
export const PLANNING_QA_GROUP_ROLES = [
    ...PLANNING_QA_LEAD_ROLES,
    ...PLANNING_QA_ANALYST_ROLES,
];

/**
 * Role yang boleh membuka halaman kerja grup ini — Workspace Analyst (Fase 1),
 * Workspace QA, dan Tugas QA Saya (Fase 3).
 *
 * Halamannya tetap terpisah per fase, tetapi seluruh anggota grup boleh membukanya
 * karena orangnya sama: `analyst` mengerjakan disposisi QA, `qa_tester` mengerjakan
 * penugasan Fase 1, dan kedua Lead perlu membaca fase pasangannya untuk mengatur
 * pembagian kerja.
 *
 * Membuka halaman tidak sama dengan membuka proyek orang lain: daftar proyek tetap
 * disaring `App\Services\ProjectAccessService` di backend, sehingga anggota grup hanya
 * melihat proyek yang memang menjadi tanggung jawabnya.
 */
export const PLANNING_QA_PAGE_ROLES = [
    'super_admin',
    ...PLANNING_QA_LEAD_ROLES,
    ...PLANNING_QA_ANALYST_ROLES,
];

/**
 * Role yang sah menerima disposisi pengujian QA.
 *
 * Cermin `TestingTrack::QA->testerRoles()`: seluruh analis grup, ditambah QA Lead yang
 * pada tim kecil kadang mengerjakan pengujiannya sendiri. Dipakai penyaring daftar
 * personel di Workspace QA — sebelumnya penyaring itu memakai uji substring `'qa'` pada
 * nama role, yang mustahil menemukan `analyst` dan akan ikut meloloskan role baru mana
 * pun yang namanya kebetulan memuat "qa".
 */
export const QA_DISPOSITION_ROLES = [...PLANNING_QA_ANALYST_ROLES, 'qa_lead'];

/**
 * Baca nama role dari objek user, apa pun bentuk payload-nya.
 *
 * `userService.getAll()` mengembalikan `role_detail.name`, sementara konteks autentikasi
 * menyimpan `role` sebagai string. Keduanya dipakai bergantian di banyak halaman.
 */
export const readRoleName = (user) => (
    user?.role_detail?.name || user?.role || ''
).toString().toLowerCase();

/** Apakah pengguna ini analis pada Grup Perencanaan dan Quality Assurance? */
export const isPlanningQaAnalyst = (user) => PLANNING_QA_ANALYST_ROLES.includes(readRoleName(user));

/** Apakah pengguna ini sah menerima disposisi pengujian QA? */
export const isQaDispositionEligible = (user) => QA_DISPOSITION_ROLES.includes(readRoleName(user));
