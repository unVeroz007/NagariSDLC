/**
 * Helper: Mendapatkan Rute Landing Page Utama berdasarkan Role Pengguna.
 * Memastikan setiap role langsung masuk ke Workspace / Tugas utamanya saat login.
 *
 * Kunci role di sini adalah `roles.name` dari database, bukan `App\Enums\UserRole`.
 * Keduanya tidak identik: enum memuat 12 peran baku, sementara tabel `roles` dapat
 * ditambah Super Admin lewat `POST /roles`. Karena itu alias seperti `dev_analyst`,
 * `cyber_team`, dan `dev_team` tetap dipertahankan — backend pun masih mencocokkan
 * `dev_analyst` secara harfiah di `ProjectAccessService` dan `ProjectWorkflowService`.
 *
 * Rute bawaan `/dashboard` hanya terbuka untuk `super_admin` dan `head_of_it`. Role
 * yang tidak tercantum di bawah akan ditolak di sana; `ProtectedRoute` mendeteksi
 * pengalihan yang menunjuk ke halaman yang sama dan mengarahkannya ke
 * `/unauthorized` supaya tidak berputar tanpa henti.
 */
export const getDefaultRouteForRole = (role) => {
    switch (role) {
        case 'super_admin':
            return '/dashboard';
        case 'project_manager':
            // Legacy — redirect to same as dev_analyst
            return '/pm/workspace';
        case 'lead_group':
            return '/workspace/lead';
        case 'analyst':
            return '/workspace/analyst';
        case 'development_lead':
            return '/workspace/dev-lead';
        case 'dev_analyst':
            return '/pm/workspace';
        case 'developer':
        case 'dev_team':
            return '/my-tasks/dev';
        case 'qa_lead':
            return '/workspace/qa';
        case 'qa_tester':
            return '/my-tasks/qa';
        case 'cyber_lead':
        case 'cyber_team':
            return '/workspace/cyber';
        case 'pentester':
            return '/my-tasks/cyber';
        case 'head_of_it':
            return '/quality-gate';
        case 'business_user':
            return '/track';
        default:
            return '/dashboard';
    }
};

export const menuSections = {
    super_admin: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Persetujuan Saya', path: '/approvals', icon: 'UserCheck' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
                { label: 'Lacak Status Proyek', path: '/pm/tracker', icon: 'MapPin' },
                { label: 'Manajemen Dokumen', path: '/documents', icon: 'Folders' },
            ],
        },
        {
            label: 'Fase 1 (Inisiasi & Review)',
            items: [
                { label: 'Inisiasi Proyek Baru', path: '/projects/new', icon: 'PlusCircle' },
                { label: 'Lacak Pengajuan', path: '/track', icon: 'Search' },
                { label: 'Antrean Review', path: '/queue', icon: 'Clock' },
                { label: 'Workspace Lead', path: '/workspace/lead', icon: 'UserCheck' },
                { label: 'Workspace Analyst (Plan)', path: '/workspace/analyst', icon: 'FileText' },
                { label: 'Workspace Dev Lead', path: '/workspace/dev-lead', icon: 'Users' },
                { label: 'Workspace Analyst (Dev)', path: '/workspace/dev-analyst', icon: 'Cpu' },
            ],
        },
        {
            label: 'Fase 2 (Pengembangan IT)',
            items: [
                { label: 'PM Workspace', path: '/pm/workspace', icon: 'Briefcase' },
                { label: 'Alokasi Tim', path: '/pm/allocation', icon: 'Users' },
                { label: 'Kanban Board', path: '/pm/kanban', icon: 'Kanban' },
                { label: 'Tugas Developer Saya', path: '/my-tasks/dev', icon: 'Code' },
            ],
        },
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Pengajuan QA', path: '/pm/qa-request', icon: 'Send' },
                { label: 'Workspace QA', path: '/workspace/qa', icon: 'Bug' },
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
                { label: 'Pengajuan Cyber', path: '/pm/cyber-request', icon: 'Shield' },
                { label: 'Workspace Cyber', path: '/workspace/cyber', icon: 'ShieldCheck' },
                { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
                { label: 'Putaran Pengembalian', path: '/pm/return-rounds', icon: 'Undo2' },
            ],
        },
        {
            label: 'Fase 4 (Rilis & Kepatuhan)',
            items: [
                { label: 'Terima Dok. QA & Cyber', path: '/pm/review-docs', icon: 'FileCheck' },
                { label: 'Pengajuan Rilis ke INFRA', path: '/pm/release-request', icon: 'Rocket' },
                { label: 'Quality Gate', path: '/quality-gate', icon: 'Verified' },
            ],
        },
        {
            label: 'Administrasi',
            items: [
                { label: 'Manajemen User', path: '/admin/users', icon: 'Users' },
                { label: 'Manajemen Divisi', path: '/admin/divisions', icon: 'Building' },
                { label: 'Manajemen Grup', path: '/admin/groups', icon: 'Network' },
                { label: 'Manajemen Role', path: '/admin/roles', icon: 'Shield' },
                { label: 'Activity Log', path: '/admin/activity-log', icon: 'Activity' },
                { label: 'Analitik SDLC', path: '/analytics', icon: 'BarChart' },
                { label: 'Pengaturan Sistem', path: '/admin/settings', icon: 'Settings' },
            ],
        },
    ],
    lead_group: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace Lead', path: '/workspace/lead', icon: 'UserCheck' },
                { label: 'Antrean Review', path: '/queue', icon: 'Clock' },
                // { label: 'Persetujuan Saya', path: '/approvals', icon: 'ShieldCheck' },
                { label: 'Workspace Analyst', path: '/workspace/analyst', icon: 'FileText' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
                { label: 'Manajemen Dokumen', path: '/documents', icon: 'Folders' },
            ],
            
        },
        {
            label: 'Fase 3 (Pengujian QA)',
            items: [
                { label: 'Workspace QA', path: '/workspace/qa', icon: 'Bug' },
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
            ],
        },


    ],
    analyst: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace Analyst', path: '/workspace/analyst', icon: 'FileText' },
                // { label: 'Persetujuan Saya', path: '/approvals', icon: 'ShieldCheck' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
            ],
        },
        // Analis Perencanaan dan analis QA adalah kumpulan orang yang sama pada dua fase
        // berbeda — lihat `constants/roles.js`. Karena itu analis Fase 1 juga memegang
        // halaman pengujian QA: disposisi QA dari QA Lead bisa jatuh kepadanya, dan tanpa
        // menu ini pekerjaan itu tidak punya pintu masuk.
        {
            label: 'Fase 3 (Pengujian QA)',
            items: [
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
                { label: 'Workspace QA', path: '/workspace/qa', icon: 'Bug' },
            ],
        },
    ],
    development_lead: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace Development', path: '/workspace/dev-lead', icon: 'Users' },
                { label: 'Persetujuan Saya', path: '/approvals', icon: 'ShieldCheck' },
                { label: 'Lacak Status Proyek', path: '/pm/tracker', icon: 'MapPin' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
                { label: 'Manajemen Dokumen', path: '/documents', icon: 'Folders' },
            ],
        },
        {
            label: 'Fase 2 (Pengembangan IT)',
            items: [
                { label: 'Workspace Analis (Dev)', path: '/workspace/dev-analyst', icon: 'Cpu' },
                { label: 'PM Workspace', path: '/pm/workspace', icon: 'Briefcase' },
                { label: 'Alokasi Tim', path: '/pm/allocation', icon: 'Users' },
                { label: 'Kanban Board', path: '/pm/kanban', icon: 'Kanban' },
                { label: 'Tugas Developer Saya', path: '/my-tasks/dev', icon: 'Code' },
            ],
        },
        // Lead Pengembangan menindak pengajuan QA/Cyber dan menerima dokumen hasilnya;
        // putaran pengembalian dibacanya untuk menelusuri perbaikan, hak menindak tetap
        // milik Analis Pengembangan pemegang proyek (dibatasi `pm_id` di halaman).
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Pengajuan QA', path: '/pm/qa-request', icon: 'Send' },
                { label: 'Pengajuan Cyber', path: '/pm/cyber-request', icon: 'Shield' },
                { label: 'Putaran Pengembalian', path: '/pm/return-rounds', icon: 'Undo2' },
            ],
        },
        {
            label: 'Fase 4 (Rilis & Kepatuhan)',
            items: [
                { label: 'Terima Dok. QA & Cyber', path: '/pm/review-docs', icon: 'FileCheck' },
                { label: 'Pengajuan Rilis ke INFRA', path: '/pm/release-request', icon: 'Rocket' },
            ],
        },
    ],
    developer: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Tugas Developer Saya', path: '/my-tasks/dev', icon: 'Code' },
                { label: 'Persetujuan Saya', path: '/approvals', icon: 'UserCheck' },
                { label: 'Kanban Board', path: '/pm/kanban', icon: 'Kanban' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
            ],
        },
        // Task perbaikan developer lahir dari putaran pengembalian; halaman ini yang
        // menjelaskan temuan apa yang menjadi dasarnya.
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Putaran Pengembalian', path: '/pm/return-rounds', icon: 'Undo2' },
            ],
        },
    ],
    project_manager: [
        // PM legacy — tetap ada tapi fungsinya sudah digabung ke dev_analyst
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace Analis (Dev)', path: '/workspace/dev-analyst', icon: 'Cpu' },
                { label: 'PM Workspace', path: '/pm/workspace', icon: 'Briefcase' },
                { label: 'Persetujuan Saya', path: '/approvals', icon: 'UserCheck' },
                { label: 'Lacak Status Proyek', path: '/pm/tracker', icon: 'MapPin' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
                { label: 'Manajemen Dokumen', path: '/documents', icon: 'Folders' },
            ],
        },
        {
            label: 'Fase 2 (Pengembangan IT)',
            items: [
                { label: 'Alokasi Tim', path: '/pm/allocation', icon: 'Users' },
                { label: 'Kanban Board', path: '/pm/kanban', icon: 'Kanban' },
                { label: 'Tugas Developer Saya', path: '/my-tasks/dev', icon: 'Code' },
            ],
        },
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Pengajuan QA', path: '/pm/qa-request', icon: 'Send' },
                { label: 'Pengajuan Cyber', path: '/pm/cyber-request', icon: 'Shield' },
                { label: 'Putaran Pengembalian', path: '/pm/return-rounds', icon: 'Undo2' },
            ],
        },
        {
            label: 'Fase 4 (Rilis & Kepatuhan)',
            items: [
                { label: 'Terima Dok. QA & Cyber', path: '/pm/review-docs', icon: 'FileCheck' },
                { label: 'Pengajuan Rilis ke INFRA', path: '/pm/release-request', icon: 'Rocket' },
            ],
        },
    ],
    qa_tester: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
                { label: 'Workspace QA', path: '/workspace/qa', icon: 'Bug' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
            ],
        },
        {
            label: 'Fase 1 (Perencanaan)',
            items: [
                { label: 'Workspace Analyst', path: '/workspace/analyst', icon: 'FileText' },
            ],
        },
    ],
    cyber_lead: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace Cyber', path: '/workspace/cyber', icon: 'ShieldCheck' },
                { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
            ],
        },
        // Sama seperti Lead QA: membaca perbaikan atas temuan keamanan yang
        // dikembalikannya, tanpa hak menindak putarannya (dibatasi `pm_id` di halaman).
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Putaran Pengembalian', path: '/pm/return-rounds', icon: 'Undo2' },
            ],
        },
    ],
    // cyber_team: [
    //     {
    //         label: 'UTAMA',
    //         items: [
    //             { label: 'Workspace Cyber', path: '/workspace/cyber', icon: 'ShieldCheck' },
    //             { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
    //             { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
    //         ],
    //     },
    // ],
    pentester: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
                { label: 'Workspace Cyber', path: '/workspace/cyber', icon: 'ShieldCheck' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
            ],
        },
    ],
    head_of_it: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Quality Gate', path: '/quality-gate', icon: 'Verified' },
                { label: 'Persetujuan Saya', path: '/approvals', icon: 'UserCheck' },
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
                { label: 'Manajemen Dokumen', path: '/documents', icon: 'Folders' },
            ],
        },
        {
            label: 'Fase 1 (Inisiasi & Review)',
            items: [
                { label: 'Inisiasi Proyek Baru', path: '/projects/new', icon: 'PlusCircle' },
                { label: 'Lacak Pengajuan', path: '/track', icon: 'Search' },
            ],
        },
        {
            label: 'Administrasi',
            items: [
                { label: 'Analitik SDLC', path: '/analytics', icon: 'BarChart' },
            ],
        },
    ],
    business_user: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Lacak Pengajuan', path: '/track', icon: 'Search' },
                { label: 'Inisiasi Proyek Baru', path: '/projects/new', icon: 'PlusCircle' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List', end: true },
            ],
        },
    ],
};

/**
 * Seluruh butir menu milik sebuah role, diratakan menjadi satu daftar.
 *
 * Dipakai halaman Manajemen Role untuk menyusun pilihan "Akses Menu": Super Admin hanya
 * boleh MENGURANGI menu yang memang dimiliki role tersebut di sini. Pembatasan menu
 * bersifat mengurangi saja — tidak ada cara memberi sebuah role menu yang tidak
 * tercantum pada `menuSections`, karena rutenya tetap dijaga `ProtectedRoute` dan
 * middleware `role:` di backend.
 *
 * @param {string} roleName Kunci teknis role (`roles.name`).
 * @returns {Array<{ path: string, label: string, section: string }>}
 */
export const getMenuItemsForRole = (roleName) => {
    const sections = menuSections[roleName] || [];

    return sections.flatMap(section =>
        section.items.map(item => ({
            path: item.path,
            label: item.label,
            section: section.label,
        }))
    );
};

/**
 * Saring susunan menu memakai daftar path yang diizinkan bagi sebuah role.
 *
 * Daftar kosong atau `null` berarti TANPA pembatasan, sama seperti di backend
 * (`Role::menuAccessPaths()`). Perlakuan itu disengaja: menganggap daftar kosong sebagai
 * pembatasan nyata akan mengosongkan seluruh sidebar hanya karena tidak ada yang
 * dicentang, dan role tanpa akses Administrasi tidak punya cara membatalkannya sendiri.
 *
 * Section yang seluruh butirnya tersaring habis ikut dibuang supaya tidak ada judul
 * kelompok kosong yang menggantung.
 *
 * @param {Array} sections Susunan menu asal `menuSections`.
 * @param {Array<string>|null|undefined} allowedPaths Daftar path yang diizinkan.
 */
export const filterSectionsByMenuAccess = (sections, allowedPaths) => {
    if (!Array.isArray(allowedPaths) || allowedPaths.length === 0) {
        return sections;
    }

    const allowed = new Set(allowedPaths);

    return sections
        .map(section => ({ ...section, items: section.items.filter(item => allowed.has(item.path)) }))
        .filter(section => section.items.length > 0);
};
