/**
 * Helper: Mendapatkan Rute Landing Page Utama berdasarkan Role Pengguna.
 * Memastikan setiap role langsung masuk ke Workspace / Tugas utamanya saat login.
 */
export const getDefaultRouteForRole = (role) => {
    switch (role) {
        case 'super_admin':
            return '/dashboard';
        case 'project_manager':
            return '/pm/workspace';
        case 'lead_group':
            return '/workspace/lead';
        case 'analyst':
            return '/workspace/analyst';
        case 'development_lead':
            return '/workspace/dev-lead';
        case 'dev_analyst':
            return '/workspace/dev-analyst';
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
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
                { label: 'Lacak Status Proyek', path: '/track', icon: 'MapPin' },
                { label: 'Manajemen Dokumen', path: '/documents', icon: 'Folders' },
            ],
        },
        {
            label: 'Perencanaan & QA',
            items: [
                { label: 'Workspace QA', path: '/workspace/qa', icon: 'Bug' },
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
            ],
        },
        {
            label: 'Fase 1 (Inisiasi & Review)',
            items: [
                { label: 'Workspace Analyst (Plan)', path: '/workspace/analyst', icon: 'FileText' },
            ],
        },
    ],
    analyst: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace Analyst', path: '/workspace/analyst', icon: 'FileText' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
    ],
    development_lead: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace Development', path: '/workspace/dev-lead', icon: 'Users' },
                { label: 'PM Workspace', path: '/pm/workspace', icon: 'Briefcase' },
                { label: 'Kanban Board', path: '/pm/kanban', icon: 'Kanban' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
    ],
    developer: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Tugas Developer Saya', path: '/my-tasks/dev', icon: 'Code' },
                { label: 'Kanban Board', path: '/pm/kanban', icon: 'Kanban' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
    ],
    project_manager: [
        {
            label: 'UTAMA',
            items: [
                { label: 'PM Workspace', path: '/pm/workspace', icon: 'Briefcase' },
                { label: 'Kanban Board', path: '/pm/kanban', icon: 'Kanban' },
                { label: 'Lacak Status Proyek', path: '/pm/tracker', icon: 'MapPin' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
                { label: 'Manajemen Dokumen', path: '/documents', icon: 'Folders' },
            ],
        },
        {
            label: 'Fase 2 (Pengembangan IT)',
            items: [
                { label: 'Alokasi Tim', path: '/pm/allocation', icon: 'Users' },
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
                { label: 'Terima Dok. QA & Cyber', path: '/pm/review-docs', icon: 'FileCheck' },
                { label: 'Pengajuan Rilis ke INFRA', path: '/pm/release-request', icon: 'Rocket' },
            ],
        },
    ],
    qa_lead: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace QA', path: '/workspace/qa', icon: 'Bug' },
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
    ],
    qa_tester: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Tugas QA Saya', path: '/my-tasks/qa', icon: 'CheckSquare' },
                { label: 'Workspace QA', path: '/workspace/qa', icon: 'Bug' },
            ],
        },
    ],
    cyber_lead: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace Cyber', path: '/workspace/cyber', icon: 'ShieldCheck' },
                { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
    ],
    cyber_team: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Workspace Cyber', path: '/workspace/cyber', icon: 'ShieldCheck' },
                { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
    ],
    pentester: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Tugas Siber Saya', path: '/my-tasks/cyber', icon: 'Lock' },
                { label: 'Workspace Cyber', path: '/workspace/cyber', icon: 'ShieldCheck' },
            ],
        },
    ],
    head_of_it: [
        {
            label: 'UTAMA',
            items: [
                { label: 'Quality Gate', path: '/quality-gate', icon: 'Verified' },
                { label: 'Dashboard Utama', path: '/dashboard', icon: 'LayoutDashboard' },
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
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
                { label: 'Daftar Semua Proyek', path: '/projects', icon: 'List' },
            ],
        },
    ],
};