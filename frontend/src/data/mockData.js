// Data dummy untuk proyek (Dibersihkan untuk pengujian dari awal)
export const mockProjects = [];

// Fungsi untuk mendapatkan statistik
export const getProjectStats = (projects) => {
    const total = projects.length;
    const inProgress = projects.filter(p =>
        p.status.includes('Development') || p.status.includes('In Progress') || p.status === 'IN_DEVELOPMENT'
    ).length;
    const pendingReview = projects.filter(p =>
        p.status.includes('Review') || p.status.includes('Inisiasi') || p.status === 'PENDING'
    ).length;
    const completed = projects.filter(p =>
        p.status.includes('Gate') || p.status.includes('Passed') || p.status.includes('Selesai') || p.status === 'LIVE_PRODUCTION'
    ).length;
    return { total, inProgress, pendingReview, completed };
};

export const mockDocuments = [];

// Fungsi untuk mendapatkan statistik dokumen
export const getDocumentStats = (docs) => {
    const total = docs.length;
    const byType = {};
    docs.forEach(doc => {
        const typeKey = doc.doc_type || doc.type || 'LAINNYA';
        byType[typeKey] = (byType[typeKey] || 0) + 1;
    });
    return { total, byType };
};

export const queueProjects = [];

// Daftar analis untuk dropdown (System Analyst Plan & Dev)
export const analysts = [
    { id: 1, name: 'Citra Kirana', email: 'analyst1@nagari.co.id', department: 'Plan & Business Analyst', workload: 1 },
    { id: 2, name: 'Mustafa Fathur Rahman', email: 'analyst2@nagari.co.id', department: 'Senior Tech & Solution Architect', workload: 0 },
    { id: 3, name: 'Fajar Ramadhan', email: 'analyst3@nagari.co.id', department: 'Core Banking Analyst', workload: 1 },
    { id: 4, name: 'Ahmad Fauzi', email: 'analyst4@nagari.co.id', department: 'Digital Payment Analyst', workload: 0 },
];

export const reviewQueue = [];
export const dispositionQueue = [];
export const allocationProjects = [];

// Data dummy untuk kandidat PM (4 Akun PM Utama)
export const pmCandidates = [
    { id: 1, name: 'Budi Santoso', email: 'pm1@nagari.co.id', department: 'IT Core & Retail Banking', workload: 2 },
    { id: 2, name: 'Dewi Lestari', email: 'pm2@nagari.co.id', department: 'Digital Banking & Mobile', workload: 3 },
    { id: 3, name: 'Andi Wijaya', email: 'pm3@nagari.co.id', department: 'IT Infrastructure & Security', workload: 1 },
    { id: 4, name: 'Citra Kirana', email: 'pm4@nagari.co.id', department: 'Enterprise Systems & Analytics', workload: 2 },
];

// Data dummy untuk kandidat QA Tester (Grup Quality Assurance)
export const qaCandidates = [
    { id: 1, name: 'Siti Rahmawati', email: 'qatester@nagari.co.id', role: 'Senior QA Automation', workload: 1 },
    { id: 2, name: 'Rian Hidayat', email: 'rian.qa@nagari.co.id', role: 'Functional QA Tester', workload: 0 },
    { id: 3, name: 'Bayu Perkasa', email: 'bayu.qa@nagari.co.id', role: 'Mobile QA Specialist', workload: 1 },
    { id: 4, name: 'Eko Prasetyo', email: 'qalead@nagari.co.id', role: 'Lead QA Engineer', workload: 2 },
];

// Data dummy untuk kandidat Pentester (Grup Cyber Security)
export const cyberCandidates = [
    { id: 1, name: 'Rizal Pratama', email: 'pentester@nagari.co.id', role: 'Lead Pentester & VA Specialist', workload: 1 },
    { id: 2, name: 'Kevin Sanjaya', email: 'kevin.cyber@nagari.co.id', role: 'Web & API Security Specialist', workload: 0 },
    { id: 3, name: 'Nadia Utami', email: 'nadia.cyber@nagari.co.id', role: 'Mobile Security Specialist', workload: 1 },
    { id: 4, name: 'Gita Savitri', email: 'cyberlead@nagari.co.id', role: 'Cyber Security Lead', workload: 2 },
];

export const developerCandidates = [
    { id: 71, name: 'Dimas Anggara', email: 'dev1@nagari.co.id', skill: 'Backend (Java)', workload: 1, available: true },
    { id: 72, name: 'Eka Putri', email: 'dev2@nagari.co.id', skill: 'Frontend (React)', workload: 2, available: true },
    { id: 73, name: 'Fani Wijaya', email: 'dev3@nagari.co.id', skill: 'Fullstack & Mobile', workload: 1, available: true },
    { id: 74, name: 'Gilang Pratama', email: 'dev4@nagari.co.id', skill: 'DevOps & Cloud', workload: 1, available: true },
    { id: 75, name: 'Rina Wati', email: 'dev5@nagari.co.id', skill: 'Database (PostgreSQL)', workload: 2, available: true },
];

// Data dummy untuk tim developer
export const teamMembers = [
    { id: 1, name: 'Dimas Anggara', role: 'Backend Dev (Java)', email: 'dev1@nagari.co.id', workload: 1, workloadLabel: 'Tersedia', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 2, name: 'Eka Putri', role: 'Frontend Dev (React)', email: 'dev2@nagari.co.id', workload: 2, workloadLabel: 'Tersedia', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 3, name: 'Fani Wijaya', role: 'Fullstack & Mobile', email: 'dev3@nagari.co.id', workload: 1, workloadLabel: 'Tersedia', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 4, name: 'Gilang Pratama', role: 'DevOps & Cloud', email: 'dev4@nagari.co.id', workload: 1, workloadLabel: 'Tersedia', workloadColor: 'bg-emerald-100 text-emerald-700' },
    { id: 5, name: 'Rina Wati', role: 'Database (PostgreSQL)', email: 'dev5@nagari.co.id', workload: 2, workloadLabel: 'Tersedia', workloadColor: 'bg-emerald-100 text-emerald-700' },
];

export const kanbanStages = [
    { id: 'inisiasi', type: 'RBB', rbbDeadline: '2026-08-02', label: 'Inisiasi', color: 'bg-slate-400' },
    { id: 'analisis', type: 'NON_RBB', rbbDeadline: null, label: 'Analisis', color: 'bg-blue-400' },
    { id: 'desain', type: 'RBB', rbbDeadline: '2026-08-02', label: 'Desain', color: 'bg-[#1A56DB]' },
    { id: 'pembangunan', type: 'NON_RBB', rbbDeadline: null, label: 'Pembangunan', color: 'bg-purple-400' },
    { id: 'pengujian', type: 'RBB', rbbDeadline: '2026-08-02', label: 'Pengujian', color: 'bg-orange-400' },
    { id: 'deployment', type: 'NON_RBB', rbbDeadline: null, label: 'Deployment', color: 'bg-green-400' },
];

export const taskProjects = [];
export const kanbanTasks = [];

export const qaQueue = [];
export const myQaTasks = [];

// Helper untuk memproses hasil QA & Pengembalian Proyek ke Dev
export const processQaResult = (taskId, qaResult, qaNotes) => {
    const task = myQaTasks.find(t => t.id === taskId);
    if (task) {
        task.qaResult = qaResult;
        task.qaNotes = qaNotes;
        if (qaResult === 'Failed') {
            task.status = 'Dikembalikan ke Dev (QA Failed)';
        } else {
            task.status = 'Selesai (QA Passed)';
        }
    }
};

export const rejectQaRequest = (requestId, reason) => {
    const qaItem = qaQueue.find(q => q.id === requestId);
    if (qaItem) {
        qaItem.status = 'Dikembalikan ke Dev (QA Rejected)';
        qaItem.notes = reason;
    }
};

// Data dummy untuk QA testers (anggota tim)
export const qaTesters = [
    { id: 1, name: 'Dimas Anggara', initial: 'DA' },
    { id: 2, name: 'Siti Rahmawati', initial: 'SR' },
    { id: 3, name: 'Fajar Setiawan', initial: 'FS' },
];

export const cyberQueue = [];
export const cyberTasks = [];

// Data dummy untuk pentester
export const pentesters = [
    { id: 1, name: 'Rizal Pratama', role: 'Senior Pentester' },
    { id: 2, name: 'Sari Indah', role: 'Security Analyst' },
    { id: 3, name: 'Budi Santoso', role: 'Junior Pentester' },
];

// Data dummy untuk Quality Gate
export const qualityGateQueue = [];

// Data dummy untuk Manajemen User
export const users = [
    { id: 'USR-001', name: 'Budi Santoso', type: 'RBB', email: 'budi.santoso@banknagari.co.id', role: 'Project Manager', department: 'Divisi TI', status: 'Aktif', initial: 'BS', avatarBg: 'bg-tertiary-container/20' },
    { id: 'USR-002', name: 'Citra Kirana', type: 'NON_RBB', email: 'citra.kirana@banknagari.co.id', role: 'System Analyst', department: 'Divisi TI', status: 'Aktif', initial: 'CK', avatarBg: 'bg-secondary-container/20' },
    { id: 'USR-003', name: 'Dimas Anggara', type: 'RBB', email: 'dimas.anggara@banknagari.co.id', role: 'QA Tester', department: 'Divisi TI', status: 'Aktif', initial: 'DA', avatarBg: 'bg-error-container/20' },
    { id: 'USR-004', name: 'Rizal Pratama', type: 'NON_RBB', email: 'rizal.pratama@banknagari.co.id', role: 'Pentester', department: 'Divisi Kepatuhan', status: 'Aktif', initial: 'RP', avatarBg: 'bg-primary-container/20' },
    { id: 'USR-005', name: 'Siti Rahmawati', type: 'RBB', email: 'siti.rahmawati@banknagari.co.id', role: 'QA Automation', department: 'Divisi TI', status: 'Non-Aktif', initial: 'SR', avatarBg: 'bg-surface-variant' },
];

export const auditLogs = [];

export const analyticsData = {
    avgCycleTime: { value: 0, change: 0, unit: 'Hari' },
    successRate: { value: 100, change: 0, unit: '%' },
    bugDensity: { value: 0, unit: '/ modul' },
    velocity: { value: 0, unit: '%' },
    divisions: [],
    delays: [],
    releaseTrend: [],
};

export const mockNotifications = [];

export default mockProjects;