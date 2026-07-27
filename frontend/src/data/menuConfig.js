export const menuSections = {
    super_admin: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
                { label: 'Lacak Status Proyek', path: '/pm/tracker', icon: 'MapPin' },
                { label: 'Manajemen Dokumen', path: '/documents', icon: 'Folders' },
            ],
        },
        {
            label: 'Fase 1 (Inisiasi & Review)',
            items: [
                { label: 'Inisiasi Proyek Baru', path: '/projects/new', icon: 'PlusCircle' },
                { label: 'Antrean Review', path: '/queue', icon: 'Clock' },
                { label: 'Workspace Lead', path: '/workspace/lead', icon: 'UserCheck' },
                { label: 'Workspace Analyst', path: '/workspace/analyst', icon: 'FileText' },
                { label: 'Workspace Development', path: '/workspace/dev-lead', icon: 'Users' },
            ],
        },
        {
            label: 'Fase 2 (Pengembangan IT)',
            items: [
                { label: 'Alokasi Tim', path: '/pm/allocation', icon: 'Users' },
                { label: 'Kanban Board', path: '/pm/kanban', icon: 'Kanban' },
                { label: 'Manajemen Task', path: '/pm/tasks', icon: 'ClipboardList' },
            ],
        },
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Pengajuan QA', path: '/pm/qa-request', icon: 'Send' },
                { label: 'Workspace QA', path: '/workspace/qa', icon: 'Bug' },
                { label: 'Pengajuan Cyber', path: '/pm/cyber-request', icon: 'Shield' },
                { label: 'Workspace Cyber', path: '/workspace/cyber', icon: 'ShieldCheck' },
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
                { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
            ],
        },
        {
            label: 'Fase 4 (Rilis & Kepatuhan)',
            items: [
                { label: 'Pengajuan Rilis', path: '/pm/release-request', icon: 'Rocket' },
                { label: 'Quality Gate', path: '/quality-gate', icon: 'Verified' },
            ],
        },
        {
            label: 'Administrasi',
            items: [
                { label: 'Manajemen User', path: '/admin/users', icon: 'Users' },
                { label: 'Activity Log', path: '/admin/activity-log', icon: 'Activity' },
                { label: 'Analitik SDLC', path: '/analytics', icon: 'BarChart' },
                { label: 'Pengaturan Sistem', path: '/admin/settings', icon: 'Settings' },
            ],
        },
    ],
    // --- Role lain bisa ditambahkan di sini dengan struktur yang sama ---
    lead_group: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
        {
            label: 'Fase 1 (Inisiasi & Review)',
            items: [
                { label: 'Workspace Lead', path: '/workspace/lead', icon: 'UserCheck' },
                { label: 'Antrean Review', path: '/queue', icon: 'Clock' },
            ],
        },
    ],
    analyst: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
        {
            label: 'Fase 1 (Inisiasi & Review)',
            items: [
                { label: 'Workspace Analyst', path: '/workspace/analyst', icon: 'FileText' },
            ],
        },
    ],
    development_lead: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Workspace Development', path: '/workspace/dev-lead', icon: 'Users' },
            ],
        },
    ],
    project_manager: [
        {
            label: 'UTAMA',
            items: [
                { label: 'PM Workspace', path: '/pm/workspace', icon: 'Briefcase' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
                { label: 'Lacak Status Proyek', path: '/pm/tracker', icon: 'MapPin' },
                { label: 'Manajemen Dokumen', path: '/documents', icon: 'Folders' },
            ],
        },
        {
            label: 'Fase 2 (Pengembangan IT)',
            items: [
                { label: 'Alokasi Tim', path: '/pm/allocation', icon: 'Users' },
                { label: 'Kanban Board', path: '/pm/kanban', icon: 'Kanban' },
                { label: 'Manajemen Task', path: '/pm/tasks', icon: 'ClipboardList' },
            ],
        },
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Pengajuan QA', path: '/pm/qa-request', icon: 'Send' },
                { label: 'Pengajuan Cyber', path: '/pm/cyber-request', icon: 'Shield' },
            ],
        },
        {
            label: 'Fase 4 (Rilis & Kepatuhan)',
            items: [
                { label: 'Pengajuan Rilis', path: '/pm/release-request', icon: 'Rocket' },
            ],
        },
    ],
    qa_lead: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Workspace QA', path: '/workspace/qa', icon: 'Bug' },
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
            ],
        },
    ],
    qa_tester: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
            ],
        },
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
            ],
        },
    ],
    cyber_lead: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Workspace Cyber', path: '/workspace/cyber', icon: 'ShieldCheck' },
                { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
            ],
        },
    ],
    pentester: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
            ],
        },
        {
            label: 'Fase 3 (Pengujian)',
            items: [
                { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
            ],
        },
    ],
    head_of_it: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
        {
            label: 'Fase 4 (Rilis & Kepatuhan)',
            items: [
                { label: 'Quality Gate', path: '/quality-gate', icon: 'Verified' },
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
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Lacak Pengajuan', path: '/track', icon: 'Search' },
            ],
        },
        {
            label: 'Fase 1 (Inisiasi & Review)',
            items: [
                { label: 'Inisiasi Proyek Baru', path: '/projects/new', icon: 'PlusCircle' },
            ],
        },
    ],
};