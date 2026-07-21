// Data dummy untuk proyek
export const mockProjects = [
    {
        id: 'PRJ-2026-088',
        name: 'Aplikasi LOS Baru',
        description: 'Modernisasi Loan Origination System',
        division: 'Divisi Kredit',
        pm: { name: 'Budi Santoso', initial: 'BS' },
        phase: 'Fase 4: Rilis',
        status: 'Quality Gate',
        statusColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        targetDate: '12 Okt 2024',
    },
    {
        id: 'PRJ-2026-089',
        name: 'Integrasi QRIS Mobile',
        description: 'Penambahan fitur pembayaran merchant',
        division: 'Divisi Dana & Jasa',
        pm: { name: 'Andi Pratama', initial: 'AP' },
        phase: 'Fase 3: Pengujian',
        status: 'QA Testing',
        statusColor: 'bg-purple-100 text-purple-700 border-purple-200',
        targetDate: '30 Nov 2024',
    },
    {
        id: 'PRJ-2026-092',
        name: 'Dashboard HRIS',
        description: 'Modul analitik performa pegawai',
        division: 'Divisi SDM',
        pm: null,
        phase: 'Fase 1: Inisiasi',
        status: 'Review Analis',
        statusColor: 'bg-blue-50 text-blue-700 border-blue-200',
        targetDate: '15 Jan 2025',
    },
    {
        id: 'PRJ-2026-093',
        name: 'Update Core Banking',
        description: 'Pembaruan modul tabungan versi 4.2',
        division: 'Divisi TI',
        pm: { name: 'Rina W', initial: 'RW' },
        phase: 'Fase 2: Pengembangan',
        status: 'Development',
        statusColor: 'bg-amber-50 text-amber-600 border-amber-200',
        targetDate: '05 Sep 2024',
    },
    {
        id: 'PRJ-2026-095',
        name: 'Sistem Anti-Fraud',
        description: 'Deteksi anomali transaksi realtime',
        division: 'Divisi Kepatuhan',
        pm: null,
        phase: 'Fase 1: Inisiasi',
        status: 'Inisiasi (Baru)',
        statusColor: 'bg-gray-100 text-gray-600 border-gray-200',
        targetDate: '20 Feb 2025',
    },
    {
        id: 'PRJ-2026-096',
        name: 'Mobile Banking v3',
        description: 'Redesign UI/UX dan fitur biometrik',
        division: 'Divisi Digital Banking',
        pm: { name: 'Dewi L', initial: 'DL' },
        phase: 'Fase 3: Pengujian',
        status: 'Cyber Testing',
        statusColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        targetDate: '10 Des 2024',
    },
    {
        id: 'PRJ-2026-097',
        name: 'Sistem Pengaduan Nasabah',
        description: 'Integrasi dengan CRM dan chatbot AI',
        division: 'Divisi Layanan',
        pm: { name: 'Fajar H', initial: 'FH' },
        phase: 'Fase 2: Pengembangan',
        status: 'In Progress',
        statusColor: 'bg-blue-100 text-blue-700 border-blue-200',
        targetDate: '25 Jan 2025',
    },
    {
        id: 'PRJ-2026-098',
        name: 'Audit Trail Terpusat',
        description: 'Centralized logging untuk seluruh aplikasi internal',
        division: 'Divisi TI',
        pm: { name: 'Gilang P', initial: 'GP' },
        phase: 'Fase 4: Rilis',
        status: 'UAT Passed',
        statusColor: 'bg-teal-100 text-teal-700 border-teal-200',
        targetDate: '01 Okt 2024',
    },
];

// Fungsi untuk mendapatkan statistik
export const getProjectStats = (projects) => {
    const total = projects.length;
    const inProgress = projects.filter(p =>
        p.status.includes('Development') || p.status.includes('In Progress')
    ).length;
    const pendingReview = projects.filter(p =>
        p.status.includes('Review') || p.status.includes('Inisiasi')
    ).length;
    const completed = projects.filter(p =>
        p.status.includes('Gate') || p.status.includes('Passed') || p.status.includes('Selesai')
    ).length;
    return { total, inProgress, pendingReview, completed };
};


export const mockDocuments = [
    {
        id: 1,
        project_id: 'PRJ-2026-088',
        project_name: 'Aplikasi LOS Baru',
        doc_type: 'brd',
        doc_type_label: 'BRD',
        file_name: 'BRD_Aplikasi_LOS_v2.1.pdf',
        file_size: '2.4 MB',
        uploaded_by: 'Ahmad Fauzi',
        version: '2.1',
        created_at: '2026-01-15T09:30:00',
    },
    {
        id: 2,
        project_id: 'PRJ-2026-088',
        project_name: 'Aplikasi LOS Baru',
        doc_type: 'fsd',
        doc_type_label: 'FSD',
        file_name: 'FSD_Aplikasi_LOS_v1.8.docx',
        file_size: '1.8 MB',
        uploaded_by: 'Siti Aminah',
        version: '1.8',
        created_at: '2026-02-10T14:20:00',
    },
    {
        id: 3,
        project_id: 'PRJ-2026-089',
        project_name: 'Integrasi QRIS Mobile',
        doc_type: 'brd',
        doc_type_label: 'BRD',
        file_name: 'BRD_QRIS_Mobile.pdf',
        file_size: '3.1 MB',
        uploaded_by: 'Budi Santoso',
        version: '1.0',
        created_at: '2026-01-20T11:00:00',
    },
    {
        id: 4,
        project_id: 'PRJ-2026-089',
        project_name: 'Integrasi QRIS Mobile',
        doc_type: 'qa_report',
        doc_type_label: 'Laporan QA',
        file_name: 'QA_Report_QRIS_v2.pdf',
        file_size: '1.2 MB',
        uploaded_by: 'Dewi Lestari',
        version: '2.0',
        created_at: '2026-03-05T09:15:00',
    },
    {
        id: 5,
        project_id: 'PRJ-2026-092',
        project_name: 'Dashboard HRIS',
        doc_type: 'brd',
        doc_type_label: 'BRD',
        file_name: 'BRD_Dashboard_HRIS.pdf',
        file_size: '2.0 MB',
        uploaded_by: 'Andi Pratama',
        version: '1.2',
        created_at: '2026-02-01T13:45:00',
    },
    {
        id: 6,
        project_id: 'PRJ-2026-093',
        project_name: 'Update Core Banking',
        doc_type: 'fsd',
        doc_type_label: 'FSD',
        file_name: 'FSD_Core_Banking_v3.0.docx',
        file_size: '4.2 MB',
        uploaded_by: 'Rina Wati',
        version: '3.0',
        created_at: '2026-01-25T10:30:00',
    },
    {
        id: 7,
        project_id: 'PRJ-2026-093',
        project_name: 'Update Core Banking',
        doc_type: 'qa_report',
        doc_type_label: 'Laporan QA',
        file_name: 'QA_Report_Core_Banking_v2.1.pdf',
        file_size: '1.5 MB',
        uploaded_by: 'Dewi Lestari',
        version: '2.1',
        created_at: '2026-03-12T08:00:00',
    },
    {
        id: 8,
        project_id: 'PRJ-2026-093',
        project_name: 'Update Core Banking',
        doc_type: 'cyber_report',
        doc_type_label: 'Laporan Pentest',
        file_name: 'Pentest_Report_Core_Banking_v1.0.pdf',
        file_size: '2.8 MB',
        uploaded_by: 'Gilang P',
        version: '1.0',
        created_at: '2026-03-20T16:30:00',
    },
    {
        id: 9,
        project_id: 'PRJ-2026-095',
        project_name: 'Sistem Anti-Fraud',
        doc_type: 'brd',
        doc_type_label: 'BRD',
        file_name: 'BRD_Anti_Fraud.pdf',
        file_size: '1.9 MB',
        uploaded_by: 'Fajar H',
        version: '1.0',
        created_at: '2026-02-15T09:00:00',
    },
    {
        id: 10,
        project_id: 'PRJ-2026-096',
        project_name: 'Mobile Banking v3',
        doc_type: 'uat_doc',
        doc_type_label: 'Dokumen UAT',
        file_name: 'UAT_Report_Mobile_Banking_v3.pdf',
        file_size: '3.5 MB',
        uploaded_by: 'Andi Pratama',
        version: '1.0',
        created_at: '2026-04-01T10:00:00',
    },
    {
        id: 11,
        project_id: 'PRJ-2026-097',
        project_name: 'Sistem Pengaduan Nasabah',
        doc_type: 'brd',
        doc_type_label: 'BRD',
        file_name: 'BRD_Pengaduan_Nasabah.pdf',
        file_size: '2.2 MB',
        uploaded_by: 'Budi Santoso',
        version: '1.1',
        created_at: '2026-03-01T14:00:00',
    },
    {
        id: 12,
        project_id: 'PRJ-2026-098',
        project_name: 'Audit Trail Terpusat',
        doc_type: 'fsd',
        doc_type_label: 'FSD',
        file_name: 'FSD_Audit_Trail.docx',
        file_size: '2.6 MB',
        uploaded_by: 'Siti Aminah',
        version: '2.0',
        created_at: '2026-02-20T11:30:00',
    },
];

// Fungsi untuk mendapatkan statistik dokumen
export const getDocumentStats = (docs) => {
    const total = docs.length;
    const byType = {};
    docs.forEach(doc => {
        byType[doc.doc_type] = (byType[doc.doc_type] || 0) + 1;
    });
    return { total, byType };
};

export const queueProjects = [
    {
        id: 'PRJ-2023-041',
        name: 'Sistem Anti-Fraud Baru',
        division: 'Divisi Kepatuhan',
        priority: 'High',
        submittedAt: '1 Jam lalu',
        budget: 'Rp 450M',
        targetDate: 'Agustus 2026',
        status: 'Menunggu Analis',
        documents: [
            { name: 'BRD_AntiFraud_v1.pdf', size: '2.4 MB', uploadedAt: '14 Feb', icon: 'pdf' },
            { name: 'Referensi_Sistem_Lama.docx', size: '1.1 MB', uploadedAt: '14 Feb', icon: 'docx' },
        ],
        analyst: null,
        deadline: null,
        notes: '',
    },
    {
        id: 'PRJ-2023-040',
        name: 'Dashboard HRIS Internal',
        division: 'Divisi SDM',
        priority: 'Medium',
        submittedAt: 'Kemarin, 14:30',
        budget: 'Rp 250M',
        targetDate: 'November 2026',
        status: 'Menunggu Analis',
        documents: [
            { name: 'BRD_HRIS_v2.pdf', size: '3.1 MB', uploadedAt: '13 Feb', icon: 'pdf' },
        ],
        analyst: null,
        deadline: null,
        notes: '',
    },
    // tambahkan lebih banyak jika diperlukan
];

// Daftar analis untuk dropdown
export const analysts = [
    { id: 1, name: 'Citra Kirana', workload: 'Rendah' },
    { id: 2, name: 'Fajar Ramadhan', workload: 'Sedang' },
    { id: 3, name: 'Eka Putra', workload: 'Tinggi' },
];

export const reviewQueue = [
    {
        id: 'PRJ-2026-041',
        name: 'Sistem Anti-Fraud Baru',
        division: 'Divisi Kepatuhan',
        priority: 'High',
        status: 'In Progress',
        submittedAt: '2026-07-19T09:00:00',
        deadline: '2026-07-21T12:00:00',
        leadNote: 'Cek irisan core banking',
        documents: [
            { name: 'BRD_AntiFraud_v1.pdf', size: '2.4 MB', type: 'pdf', uploadedAt: '2026-07-19' },
            { name: 'Referensi_Sistem_Lama.docx', size: '1.1 MB', type: 'docx', uploadedAt: '2026-07-19' },
        ],
        analyst: null,
        statusReview: 'pending', // pending, in_progress, approved, rejected
    },
    {
        id: 'PRJ-2026-040',
        name: 'Dashboard HRIS Internal',
        division: 'Divisi SDM',
        priority: 'Medium',
        status: 'New',
        submittedAt: '2026-07-18T14:30:00',
        deadline: '2026-07-23T17:00:00',
        leadNote: '',
        documents: [
            { name: 'BRD_HRIS_v1.pdf', size: '1.8 MB', type: 'pdf', uploadedAt: '2026-07-18' },
        ],
        analyst: null,
        statusReview: 'pending',
    },
];

// Data dummy untuk disposisi (Workspace Lead)
export const dispositionQueue = [
    {
        id: 'PRJ-2026-041',
        name: 'Sistem Anti-Fraud Baru',
        division: 'Divisi Kepatuhan',
        priority: 'High',
        submittedAt: '2026-07-19T09:00:00',
        budget: 'Rp 450M',
        targetDate: 'Agustus 2026',
        status: 'Menunggu Analis',
        documents: [
            { name: 'BRD_AntiFraud_v1.pdf', size: '2.4 MB', type: 'pdf' },
            { name: 'Referensi_Sistem_Lama.docx', size: '1.1 MB', type: 'docx' },
        ],
        assignedAnalyst: null,
    },
    {
        id: 'PRJ-2026-040',
        name: 'Dashboard HRIS Internal',
        division: 'Divisi SDM',
        priority: 'Medium',
        submittedAt: '2026-07-18T14:30:00',
        budget: 'Rp 250M',
        targetDate: 'September 2026',
        status: 'Menunggu Analis',
        documents: [
            { name: 'BRD_HRIS_v1.pdf', size: '1.8 MB', type: 'pdf' },
        ],
        assignedAnalyst: null,
    },
];

export const allocationProjects = [
    {
        id: 'PRJ-2023-089',
        name: 'Sistem Anti-Fraud Baru',
        division: 'Divisi Kepatuhan',
        priority: 'Tinggi',
        status: 'Siap Development',
        submittedAt: '2026-07-20T09:00:00',
        analyst: 'Citra Kirana',
        approvedAt: '2026-07-20T14:30:00',
        documents: ['BRD_AntiFraud_v1.pdf', 'FSD_AntiFraud_v1.docx'],
    },
    {
        id: 'PRJ-2023-090',
        name: 'Upgrade Mobile Banking v4',
        division: 'Divisi Digital Banking',
        priority: 'Sedang',
        status: 'Siap Development',
        submittedAt: '2026-07-19T10:00:00',
        analyst: 'Fajar Ramadhan',
        approvedAt: '2026-07-19T16:00:00',
        documents: ['BRD_MobileBanking_v4.pdf', 'FSD_MobileBanking_v4.docx'],
    },
    {
        id: 'PRJ-2023-091',
        name: 'Dashboard HRIS Internal',
        division: 'Divisi SDM',
        priority: 'Rendah',
        status: 'Siap Development',
        submittedAt: '2026-07-18T13:00:00',
        analyst: 'Citra Kirana',
        approvedAt: '2026-07-18T17:30:00',
        documents: ['BRD_HRIS.pdf'],
    },
];

// Data dummy untuk kandidat PM
export const pmCandidates = [
    { id: 1, name: 'Andi Wijaya', initial: 'AW', department: 'IT Core Systems', workload: 2, workloadLabel: 'Rendah', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 2, name: 'Siska Pratama', initial: 'SP', department: 'Digital Banking', workload: 4, workloadLabel: 'Sedang', workloadColor: 'bg-amber-100 text-amber-700' },
    { id: 3, name: 'Rahmat Hidayat', initial: 'RH', department: 'IT Infrastructure', workload: 6, workloadLabel: 'Tinggi', workloadColor: 'bg-red-100 text-red-700' },
    { id: 4, name: 'Dewi Lestari', initial: 'DL', department: 'IT Security', workload: 3, workloadLabel: 'Sedang', workloadColor: 'bg-amber-100 text-amber-700' },
];

// Data dummy untuk tim developer
export const teamMembers = [
    { id: 1, name: 'Dimas Anggara', role: 'Backend Dev (Java)', workload: 1, workloadLabel: 'Rendah', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 2, name: 'Eka Putri', role: 'Frontend Dev (React)', workload: 2, workloadLabel: 'Rendah', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 3, name: 'Fani Wijaya', role: 'QA Engineer', workload: 3, workloadLabel: 'Sedang', workloadColor: 'bg-amber-100 text-amber-700' },
    { id: 4, name: 'Gilang Pratama', role: 'Security Analyst', workload: 5, workloadLabel: 'Tinggi', workloadColor: 'bg-red-100 text-red-700' },
    { id: 5, name: 'Rina Wati', role: 'Backend Dev (Node.js)', workload: 1, workloadLabel: 'Rendah', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 6, name: 'Budi Santoso', role: 'DevOps Engineer', workload: 2, workloadLabel: 'Rendah', workloadColor: 'bg-emerald-100 text-emerald-700' },
];

export const kanbanTasks = [
    {
        id: 'BN-1042',
        title: 'Setup Core Banking Integration Env',
        description: 'Initial provision of dev environments for the new mobile banking API gateway.',
        stage: 'inisiasi',
        assignee: 'Citra K',
        priority: 'High',
        labels: ['DevOps'],
        subtasks: { total: 3, done: 1 },
        attachments: 2,
        comments: 1,
        timeEstimate: '2 days',
        isRework: false,
        reworkNote: '',
    },
    {
        id: 'BN-1045',
        title: 'Vendor Security Compliance Review',
        description: 'Review security compliance of third-party vendors.',
        stage: 'inisiasi',
        assignee: 'Budi S',
        priority: 'Medium',
        labels: ['Security'],
        subtasks: { total: 5, done: 2 },
        attachments: 1,
        comments: 0,
        timeEstimate: '5 days',
        isRework: false,
        reworkNote: '',
    },
    {
        id: 'BN-1038',
        title: 'Define User Roles for CMS',
        description: 'Mapping out permissions for Admin, Editor, and Viewer roles in the new content management system.',
        stage: 'analisis',
        assignee: 'Joko D',
        priority: 'Medium',
        labels: ['UX', 'Security'],
        subtasks: { total: 4, done: 2 },
        attachments: 0,
        comments: 3,
        timeEstimate: '3 days',
        isRework: false,
        reworkNote: '',
    },
    {
        id: 'BN-1022',
        title: 'Database Schema Refactoring',
        description: 'Refactor database schema for better performance.',
        stage: 'desain',
        assignee: 'Rina W',
        priority: 'High',
        labels: ['Database'],
        subtasks: { total: 6, done: 2 },
        attachments: 2,
        comments: 5,
        timeEstimate: '4 days',
        isRework: true,
        reworkNote: '"Need to split the historical data partitions before we can approve this schema."',
    },
    {
        id: 'BN-1039',
        title: 'Wireframing Dashboard V2',
        description: 'Creating high-fidelity mocks for the executive reporting view.',
        stage: 'desain',
        assignee: 'Dewi L',
        priority: 'Medium',
        labels: ['UI/UX'],
        subtasks: { total: 4, done: 2 },
        attachments: 3,
        comments: 2,
        timeEstimate: '2 days',
        isRework: false,
        reworkNote: '',
    },
    {
        id: 'BN-1040',
        title: 'API Gateway Rate Limiting',
        description: 'Implement rate limiting for API Gateway.',
        stage: 'desain',
        assignee: 'Andi P',
        priority: 'Low',
        labels: ['Backend'],
        subtasks: { total: 3, done: 1 },
        attachments: 0,
        comments: 1,
        timeEstimate: '3 days',
        isRework: false,
        reworkNote: '',
    },
    {
        id: 'BN-1043',
        title: 'Frontend Build Pipeline Setup',
        description: 'Setup CI/CD for frontend application deployment.',
        stage: 'pembangunan',
        assignee: 'Dimas A',
        priority: 'Medium',
        labels: ['DevOps', 'Frontend'],
        subtasks: { total: 4, done: 3 },
        attachments: 1,
        comments: 2,
        timeEstimate: '1 day',
        isRework: false,
        reworkNote: '',
    },
    {
        id: 'BN-1044',
        title: 'Backend API Testing',
        description: 'Unit and integration testing for new API endpoints.',
        stage: 'pengujian',
        assignee: 'QA Team',
        priority: 'High',
        labels: ['Backend', 'Testing'],
        subtasks: { total: 8, done: 4 },
        attachments: 2,
        comments: 3,
        timeEstimate: '3 days',
        isRework: false,
        reworkNote: '',
    },
    {
        id: 'BN-0988',
        title: 'UAT for Biometric Login',
        description: 'User acceptance testing for biometric login feature.',
        stage: 'pengujian',
        assignee: 'QA Team',
        priority: 'High',
        labels: ['QA'],
        subtasks: { total: 8, done: 5 },
        attachments: 1,
        comments: 4,
        timeEstimate: '2 days',
        isRework: false,
        reworkNote: '',
    },
    {
        id: 'BN-0990',
        title: 'Production Deployment v2.4',
        description: 'Deploy version 2.4 to production environment.',
        stage: 'deployment',
        assignee: 'Ops Team',
        priority: 'High',
        labels: ['DevOps'],
        subtasks: { total: 6, done: 6 },
        attachments: 0,
        comments: 2,
        timeEstimate: '1 day',
        isRework: false,
        reworkNote: '',
    },
];

export const kanbanStages = [
    { id: 'inisiasi', label: 'Inisiasi', color: 'bg-slate-400' },
    { id: 'analisis', label: 'Analisis', color: 'bg-blue-400' },
    { id: 'desain', label: 'Desain', color: 'bg-[#1A56DB]' },
    { id: 'pembangunan', label: 'Pembangunan', color: 'bg-purple-400' },
    { id: 'pengujian', label: 'Pengujian', color: 'bg-orange-400' },
    { id: 'deployment', label: 'Deployment', color: 'bg-green-400' },
];

export const taskProjects = [
    {
        id: 'PRJ-2023-001',
        name: 'Modernisasi Core Banking v2.4',
        status: 'Sedang Berjalan',
        statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        progress: 65,
        pm: 'Budi Santoso',
        priority: 'Kritis',
        priorityColor: 'bg-red-100 text-red-700 border-red-200',
        deadline: '2026-08-30',
        budget: 'Rp 4.5 Miliar',
        tasks: [
            { id: 1, name: 'Setup Database Schema', assignee: 'Budi Santoso', deadline: '2026-07-12', status: 'Selesai', statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            { id: 2, name: 'Integrasi API Gateway', assignee: 'Fajar Nugroho', deadline: '2026-07-15', status: 'Sedang Dikerjakan', statusColor: 'bg-amber-100 text-amber-700 border-amber-200' },
            { id: 3, name: 'Modul Laporan', assignee: null, deadline: '2026-07-20', status: 'Belum Mulai', statusColor: 'bg-gray-100 text-gray-600 border-gray-200' },
            { id: 4, name: 'Security Audit Preparation', assignee: 'Andi Wijaya', deadline: '2026-07-22', status: 'Belum Mulai', statusColor: 'bg-gray-100 text-gray-600 border-gray-200' },
            { id: 5, name: 'User Acceptance Test Plan', assignee: 'Siska Pratama', deadline: '2026-07-25', status: 'Belum Mulai', statusColor: 'bg-gray-100 text-gray-600 border-gray-200' },
        ],
    },
    {
        id: 'PRJ-2023-042',
        name: 'QRIS Mobile Banking Integration',
        status: 'Kritis',
        statusColor: 'bg-red-100 text-red-700 border-red-200',
        progress: 30,
        pm: 'Siti Aminah',
        priority: 'Kritis',
        priorityColor: 'bg-red-100 text-red-700 border-red-200',
        deadline: '2026-09-15',
        budget: 'Rp 2.8 Miliar',
        tasks: [
            { id: 6, name: 'QRIS API Integration', assignee: 'Rina Wati', deadline: '2026-07-10', status: 'Selesai', statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            { id: 7, name: 'Mobile SDK Setup', assignee: 'Fajar Nugroho', deadline: '2026-07-18', status: 'Sedang Dikerjakan', statusColor: 'bg-amber-100 text-amber-700 border-amber-200' },
            { id: 8, name: 'Payment Flow Testing', assignee: null, deadline: '2026-07-30', status: 'Belum Mulai', statusColor: 'bg-gray-100 text-gray-600 border-gray-200' },
        ],
    },
    {
        id: 'PRJ-2022-088',
        name: 'Migrasi Database CRM',
        status: 'Selesai',
        statusColor: 'bg-blue-100 text-blue-700 border-blue-200',
        progress: 100,
        pm: 'Joko Anwar',
        priority: 'Rendah',
        priorityColor: 'bg-blue-100 text-blue-700 border-blue-200',
        deadline: '2026-06-30',
        budget: 'Rp 1.2 Miliar',
        tasks: [
            { id: 9, name: 'Database Migration Script', assignee: 'Budi Santoso', deadline: '2026-06-15', status: 'Selesai', statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            { id: 10, name: 'Data Validation', assignee: 'Andi Wijaya', deadline: '2026-06-25', status: 'Selesai', statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        ],
    },
    {
        id: 'PRJ-2024-005',
        name: 'Implementasi AI Chatbot',
        status: 'Sedang Berjalan',
        statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        progress: 15,
        pm: 'Rina Gunawan',
        priority: 'Sedang',
        priorityColor: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        deadline: '2026-10-20',
        budget: 'Rp 3.0 Miliar',
        tasks: [
            { id: 11, name: 'NLP Model Training', assignee: 'Fajar Nugroho', deadline: '2026-08-01', status: 'Sedang Dikerjakan', statusColor: 'bg-amber-100 text-amber-700 border-amber-200' },
            { id: 12, name: 'Chatbot UI Design', assignee: 'Siska Pratama', deadline: '2026-08-15', status: 'Belum Mulai', statusColor: 'bg-gray-100 text-gray-600 border-gray-200' },
        ],
    },
];

export const qaQueue = [
    {
        id: 'QA-REQ-2026-0842',
        projectId: 'PRJ-2026-089',
        projectName: 'Aplikasi LOS Baru',
        pm: 'Budi Santoso',
        submittedAt: '2026-07-19T09:00:00',
        status: 'Menunggu Disposisi',
        priority: 'High',
        stagingUrl: 'https://staging-los.banknagari.co.id',
        documents: [
            { name: 'BRD_LOS_v1.2.pdf', size: '2.4 MB', type: 'pdf' },
            { name: 'FSD_LOS_Final.docx', size: '1.8 MB', type: 'docx' },
            { name: 'SIT_Report_LOS.xlsx', size: '500 KB', type: 'xlsx' },
        ],
        assignedTo: null,
        targetDate: null,
        notes: '',
    },
    {
        id: 'QA-REQ-2026-0841',
        projectId: 'PRJ-2026-088',
        projectName: 'Integrasi QRIS Mobile',
        pm: 'Dian Sastro',
        submittedAt: '2026-07-18T14:30:00',
        status: 'Menunggu Disposisi',
        priority: 'Medium',
        stagingUrl: 'https://staging-qris.banknagari.co.id',
        documents: [
            { name: 'BRD_QRIS_v1.0.pdf', size: '1.8 MB', type: 'pdf' },
            { name: 'FSD_QRIS.docx', size: '2.1 MB', type: 'docx' },
        ],
        assignedTo: null,
        targetDate: null,
        notes: '',
    },
];

// Data dummy untuk tugas QA (My Tasks)
export const myQaTasks = [
    {
        id: 'QA-REQ-2026-0842',
        projectId: 'PRJ-2026-089',
        projectName: 'Aplikasi LOS Baru',
        pm: 'Budi Santoso',
        assignedBy: 'Anita Rahman',
        assignedAt: '2026-07-20T10:00:00',
        targetDate: '2026-07-30',
        status: 'In Progress',
        priority: 'High',
        stagingUrl: 'https://staging-los.banknagari.co.id',
        documents: [
            { name: 'BRD_LOS_v1.2.pdf', size: '2.4 MB', type: 'pdf' },
            { name: 'FSD_LOS_Final.docx', size: '1.8 MB', type: 'docx' },
            { name: 'SIT_Report_LOS.xlsx', size: '500 KB', type: 'xlsx' },
        ],
        instruction: 'Tolong fokus pada stress testing di modul kalkulasi bunga. Pastikan skenario edge-case suku bunga floating tervalidasi dengan data mock terbaru.',
        qaResult: null,
        qaNotes: '',
        attachment: null,
    },
    {
        id: 'QA-REQ-2026-0840',
        projectId: 'PRJ-2026-087',
        projectName: 'Modul CRM Retail',
        pm: 'Fajar H',
        assignedBy: 'Anita Rahman',
        assignedAt: '2026-07-18T09:00:00',
        targetDate: '2026-07-28',
        status: 'Draft',
        priority: 'Medium',
        stagingUrl: 'https://staging-crm.banknagari.co.id',
        documents: [
            { name: 'BRD_CRM_v1.0.pdf', size: '1.2 MB', type: 'pdf' },
        ],
        instruction: '',
        qaResult: null,
        qaNotes: '',
        attachment: null,
    },
];

// Data dummy untuk QA testers (anggota tim)
export const qaTesters = [
    { id: 1, name: 'Dimas Anggara', initial: 'DA' },
    { id: 2, name: 'Siti Rahmawati', initial: 'SR' },
    { id: 3, name: 'Fajar Setiawan', initial: 'FS' },
];

export const cyberQueue = [
    {
        id: 'CYB-REQ-2026-0312',
        projectName: 'Aplikasi Loan Origination System (LOS)',
        requester: 'Anita Rahman',
        submittedAt: '2 jam lalu',
        status: 'Menunggu Audit',
        priority: 'High',
        description: 'Pengajuan audit keamanan untuk sistem LOS baru sebelum masuk fase UAT dan rilis ke production. Sistem ini menangani data PII nasabah.',
        stagingUrl: 'https://staging-los.banknagari.co.id',
        documents: [
            { name: 'BRD_Final.pdf', size: '2.4 MB', type: 'Requirements' },
            { name: 'FSD_v2.docx', size: '1.8 MB', type: 'System Design' },
            { name: 'QA_SignOff_Report.pdf', size: '450 KB', type: 'Passed' },
        ],
    },
    {
        id: 'CYB-REQ-2026-0310',
        projectName: 'Update Core Banking API',
        requester: 'Budi Santoso',
        submittedAt: '5 jam lalu',
        status: 'In Progress',
        priority: 'Medium',
        description: 'Audit keamanan pada API Core Banking yang baru di-upgrade.',
        stagingUrl: 'https://staging-core.banknagari.co.id',
        documents: [
            { name: 'BRD_Core_v2.pdf', size: '3.1 MB', type: 'Requirements' },
            { name: 'API_Specs.docx', size: '2.2 MB', type: 'Technical' },
        ],
    },
    {
        id: 'CYB-REQ-2026-0308',
        projectName: 'Mobile Banking v4.0',
        requester: 'Dewi Lestari',
        submittedAt: '1 hari lalu',
        status: 'Menunggu Audit',
        priority: 'High',
        description: 'Audit keamanan mobile app dan backend API.',
        stagingUrl: 'https://staging-mobile.banknagari.co.id',
        documents: [
            { name: 'BRD_Mobile_v4.pdf', size: '2.8 MB', type: 'Requirements' },
            { name: 'FSD_Mobile_v4.docx', size: '2.5 MB', type: 'System Design' },
        ],
    },
];

// Data dummy untuk tugas Cyber (Tugas Siber Saya)
export const cyberTasks = [
    {
        id: 'CYB-REQ-2026-0312',
        projectName: 'Aplikasi Loan Origination System (LOS)',
        status: 'In Progress',
        deadline: 'Jumat, 17:00',
        leadNote: 'Lakukan metode Blackbox testing. Fokus audit pada API Gateway dan validasi otentikasi JWT.',
        stagingUrl: 'https://staging-los.banknagari.co.id',
        documents: [
            { name: 'BRD & FSD Bundle', size: '12.4 MB', type: 'Verified' },
            { name: 'QA Sign-Off Report', size: '2.1 MB', type: 'QA Passed' },
            { name: 'Arsitektur & Topologi', size: '4.5 MB', type: 'Draft' },
        ],
        hasReport: true,
        reportName: 'Pentest_Report_LOS_Final.pdf',
        reportSize: '3.2 MB',
    },
];

// Data dummy untuk pentester
export const pentesters = [
    { id: 1, name: 'Rizal Pratama', role: 'Senior Pentester' },
    { id: 2, name: 'Sari Indah', role: 'Security Analyst' },
    { id: 3, name: 'Budi Santoso', role: 'Junior Pentester' },
];

// Data dummy untuk Quality Gate
export const qualityGateQueue = [
    {
        id: 'REL-REQ-2026-0015',
        projectName: 'Aplikasi LOS Baru',
        requester: 'Divisi Kredit Consumer',
        schedule: '15 Juli 2026, 23:00 WIB',
        downtime: '120 Menit',
        pm: 'Budi Santoso',
        status: 'Menunggu Approval',
        priority: 'Mayor Release',
        documents: [
            { name: 'Dokumen BRD & FSD', status: 'Lengkap', verified: true },
            { name: 'Laporan QA & UAT', status: 'Lulus QA', verified: true },
            { name: 'Security Pentest', status: 'Aman', verified: true },
            { name: 'Kesiapan Infrastruktur', status: 'Siap', verified: true },
        ],
        rollbackPlan: 'Restore database dari backup snapshot terakhir (15/07) dan revert branch ke versi v1.4 pada server Load Balancer.',
    },
    {
        id: 'REL-REQ-2026-0012',
        projectName: 'Update Core Banking API',
        requester: 'Divisi TI',
        schedule: 'TBD',
        downtime: '60 Menit',
        pm: 'Dewi Lestari',
        status: 'Draft',
        priority: 'Patch Release',
        documents: [
            { name: 'Dokumen BRD & FSD', status: 'Lengkap', verified: true },
            { name: 'Laporan QA & UAT', status: 'Lulus QA', verified: true },
            { name: 'Security Pentest', status: 'Aman', verified: true },
            { name: 'Kesiapan Infrastruktur', status: 'Siap', verified: true },
        ],
        rollbackPlan: 'Rollback ke versi sebelumnya melalui CI/CD pipeline.',
    },
];

// Data dummy untuk Manajemen User
export const users = [
    { id: 'USR-001', name: 'Budi Santoso', email: 'budi.santoso@banknagari.co.id', role: 'Project Manager', department: 'Divisi TI', status: 'Aktif', initial: 'BS', avatarBg: 'bg-tertiary-container/20' },
    { id: 'USR-002', name: 'Citra Kirana', email: 'citra.kirana@banknagari.co.id', role: 'System Analyst', department: 'Divisi TI', status: 'Aktif', initial: 'CK', avatarBg: 'bg-secondary-container/20' },
    { id: 'USR-003', name: 'Dimas Anggara', email: 'dimas.anggara@banknagari.co.id', role: 'QA Tester', department: 'Divisi TI', status: 'Aktif', initial: 'DA', avatarBg: 'bg-error-container/20' },
    { id: 'USR-004', name: 'Rizal Pratama', email: 'rizal.pratama@banknagari.co.id', role: 'Pentester', department: 'Divisi Kepatuhan', status: 'Aktif', initial: 'RP', avatarBg: 'bg-primary-container/20' },
    { id: 'USR-005', name: 'Siti Rahmawati', email: 'siti.rahmawati@banknagari.co.id', role: 'QA Automation', department: 'Divisi TI', status: 'Non-Aktif', initial: 'SR', avatarBg: 'bg-surface-variant' },
];

// Data dummy untuk Audit Trail
export const auditLogs = [
    { id: 1, time: '12 Okt 2023, 14:30', user: 'Hendra Setiawan', action: 'Approve Go-Live', project: 'Aplikasi LOS Baru', ip: '192.168.1.50', status: 'Success', statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { id: 2, time: '12 Okt 2023, 13:15', user: 'Rizal Pratama', action: 'Upload Pentest Report', project: 'Aplikasi LOS Baru', ip: '192.168.1.12', status: 'Info', statusColor: 'bg-blue-100 text-blue-700 border-blue-200' },
    { id: 3, time: '12 Okt 2023, 11:45', user: 'Citra Kirana', action: 'Reject Deployment', project: 'Dashboard HRIS', ip: '192.168.1.22', status: 'Warning', statusColor: 'bg-red-100 text-red-700 border-red-200' },
    { id: 4, time: '12 Okt 2023, 10:20', user: 'Budi Santoso', action: 'Update Kanban Task', project: 'Aplikasi LOS Baru', ip: '192.168.1.45', status: 'Success', statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { id: 5, time: '12 Okt 2023, 09:00', user: 'Sistem', action: 'Auto-Lock Column', project: 'Aplikasi LOS Baru', ip: 'System', status: 'System', statusColor: 'bg-purple-100 text-purple-700 border-purple-200' },
    { id: 6, time: '12 Okt 2023, 08:15', user: 'Ahmad Fauzi', action: 'User Login', project: 'Dashboard Utama', ip: '192.168.1.1', status: 'Success', statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

// Data dummy untuk Analitik SDLC
export const analyticsData = {
    avgCycleTime: { value: 32, change: -5, unit: 'Hari' },
    successRate: { value: 94.5, change: 2, unit: '%' },
    bugDensity: { value: 0.4, unit: '/ modul' },
    velocity: { value: 85, unit: '%' },
    divisions: [
        { name: 'Kredit', value: 24, percentage: 80 },
        { name: 'Teknologi Informasi', value: 18, percentage: 60 },
        { name: 'Dana & Jasa', value: 12, percentage: 40 },
        { name: 'SDM', value: 8, percentage: 25 },
    ],
    delays: [
        { rank: 1, reason: 'Development (Coding)', percentage: 45 },
        { rank: 2, reason: 'QA Testing (Bug Fixes)', percentage: 30 },
        { rank: 3, reason: 'Audit Cyber Security', percentage: 15 },
        { rank: 4, reason: 'UAT User', percentage: 10 },
    ],
    releaseTrend: [
        { month: 'Jan', value: 4 },
        { month: 'Feb', value: 6 },
        { month: 'Mar', value: 10 },
        { month: 'Apr', value: 8 },
        { month: 'Mei', value: 15 },
        { month: 'Jun', value: 18 },
    ],
};

export default mockProjects;