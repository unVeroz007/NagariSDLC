import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Search,
    Bell,
    LogOut,
    Calendar,
    Rocket,
    CheckCircle,
    Code,
    Shield,
    Route,
    FileText,
    User,
    ChevronRight,
    Clock,
    AlertCircle,
    ArrowRight,
    Check,
    MoreHorizontal,
    Filter,
    Eye,
    Download,
} from 'lucide-react';
import { mockProjects } from '../data/mockData';

// Data dummy untuk tracking (proyek yang diajukan oleh business_user)
const trackingProjects = [
    {
        id: 'REQ-2026-011',
        name: 'Sistem Anti-Fraud Baru',
        status: 'IN DEVELOPMENT',
        statusColor: 'bg-blue-100 text-blue-700',
        submittedDate: '12 Okt 2025',
        targetDate: '28 Feb 2026',
        pm: 'Budi Santoso',
        pmAvatar: 'BS',
        description: 'Sistem deteksi anomali transaksi berbasis machine learning untuk mencegah fraud.',
        phases: [
            {
                name: 'Fase 1: Inisiasi & Persetujuan',
                description: 'Pengajuan disetujui oleh manajemen dan dialokasikan ke tim IT.',
                completed: true,
                items: [
                    { label: 'Review Bisnis Selesai', date: '15 Okt 2025', done: true },
                    { label: 'Alokasi Anggaran Disetujui', date: '20 Okt 2025', done: true },
                ],
            },
            {
                name: 'Fase 2: Desain & Arsitektur',
                description: 'Perancangan sistem dan infrastruktur oleh tim teknis.',
                completed: true,
                items: [],
            },
            {
                name: 'Fase 3: Pengembangan & Testing',
                description: 'Pembuatan kode program dan pengujian kualitas sistem.',
                completed: false,
                isActive: true,
                items: [
                    { label: 'Pengembangan Backend', date: 'Selesai', done: true },
                    { label: 'Integrasi API', date: 'Selesai', done: true },
                ],
                activeNote: 'Uji Siber sedang berjalan',
                activeNoteDetail: 'Tim security sedang memvalidasi keamanan enkripsi data. Estimasi selesai: 5 Nov 2025.',
            },
            {
                name: 'Fase 4: Rilis & Deployment',
                description: 'Penerapan ke lingkungan produksi dan serah terima.',
                completed: false,
                isActive: false,
                items: [],
            },
        ],
    },
    {
        id: 'REQ-2025-089',
        name: 'Update Dashboard Pelaporan',
        status: 'LIVE',
        statusColor: 'bg-emerald-100 text-emerald-700',
        submittedDate: '05 Jul 2025',
        targetDate: '15 Sep 2025',
        pm: 'Dewi Lestari',
        pmAvatar: 'DL',
        description: 'Pembaruan dashboard pelaporan dengan visualisasi data real-time.',
        phases: [
            {
                name: 'Fase 1: Inisiasi & Persetujuan',
                description: 'Pengajuan disetujui.',
                completed: true,
                items: [{ label: 'Review Bisnis Selesai', date: '10 Jul 2025', done: true }],
            },
            {
                name: 'Fase 2: Desain & Arsitektur',
                description: 'Perancangan sistem.',
                completed: true,
                items: [],
            },
            {
                name: 'Fase 3: Pengembangan & Testing',
                description: 'Pengembangan dan testing.',
                completed: true,
                items: [],
            },
            {
                name: 'Fase 4: Rilis & Deployment',
                description: 'Sudah live di produksi.',
                completed: true,
                isActive: false,
                items: [],
            },
        ],
    },
    {
        id: 'REQ-2026-005',
        name: 'Mobile Banking V3',
        status: 'RETURN TO DEV',
        statusColor: 'bg-red-100 text-red-700',
        submittedDate: '20 Sep 2025',
        targetDate: '15 Jan 2026',
        pm: 'Andi Pratama',
        pmAvatar: 'AP',
        description: 'Versi terbaru mobile banking dengan fitur biometrik.',
        phases: [
            {
                name: 'Fase 1: Inisiasi & Persetujuan',
                description: 'Pengajuan disetujui.',
                completed: true,
                items: [{ label: 'Review Bisnis Selesai', date: '25 Sep 2025', done: true }],
            },
            {
                name: 'Fase 2: Desain & Arsitektur',
                description: 'Perancangan sistem.',
                completed: true,
                items: [],
            },
            {
                name: 'Fase 3: Pengembangan & Testing',
                description: 'Dikembalikan ke tim dev karena bug kritikal.',
                completed: false,
                isActive: true,
                items: [],
                activeNote: 'Rework: Bug pada modul autentikasi biometrik',
                activeNoteDetail: 'Tim QA menemukan celah keamanan pada login biometrik. Perbaikan sedang dilakukan.',
            },
        ],
    },
];

// Filter status options
const statusOptions = ['Semua Status', 'Sedang Berjalan', 'Selesai'];

export default function Track() {
    const { user } = useAuth();
    const [selectedProject, setSelectedProject] = useState(trackingProjects[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('Semua Status');

    // Filter projects
    const filteredProjects = useMemo(() => {
        let result = trackingProjects;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.id.toLowerCase().includes(term) ||
                p.name.toLowerCase().includes(term)
            );
        }

        if (filterStatus === 'Sedang Berjalan') {
            result = result.filter(p => p.status !== 'LIVE');
        } else if (filterStatus === 'Selesai') {
            result = result.filter(p => p.status === 'LIVE');
        }

        return result;
    }, [searchTerm, filterStatus]);

    // Get status badge
    const getStatusBadge = (status) => {
        const colors = {
            'IN DEVELOPMENT': 'bg-blue-100 text-blue-700',
            'LIVE': 'bg-emerald-100 text-emerald-700',
            'RETURN TO DEV': 'bg-red-100 text-red-700',
            'PENDING': 'bg-gray-100 text-gray-700',
            'IN REVIEW': 'bg-amber-100 text-amber-700',
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    // Get status icon for timeline
    const getPhaseIcon = (phase) => {
        if (phase.completed) {
            return <CheckCircle size={18} className="text-emerald-500" />;
        }
        if (phase.isActive) {
            return <Code size={18} className="text-[#1A56DB]" />;
        }
        return <Rocket size={18} className="text-gray-400" />;
    };

    const getPhaseCircle = (phase) => {
        if (phase.completed) {
            return (
                <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center shadow-sm">
                    <Check size={20} className="text-emerald-600" />
                </div>
            );
        }
        if (phase.isActive) {
            return (
                <div className="w-10 h-10 rounded-full bg-[#1A56DB] border-4 border-blue-200 flex items-center justify-center shadow-md relative">
                    <div className="absolute inset-0 rounded-full border-2 border-[#1A56DB] animate-ping opacity-50"></div>
                    <Code size={20} className="text-white" />
                </div>
            );
        }
        return (
            <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                <Rocket size={20} className="text-gray-400" />
            </div>
        );
    };

    if (!selectedProject) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
                        <FileText size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Tidak Ada Pengajuan</h2>
                    <p className="text-gray-500 mt-2">Anda belum memiliki pengajuan proyek.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-screen bg-[#f8f9fb] overflow-hidden">
            {/* Top App Bar */}
            <header className="h-16 bg-white shadow-sm flex justify-between items-center px-6 shrink-0 z-10 border-b border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                    <span className="hover:text-[#1A56DB] cursor-pointer">Beranda</span>
                    <ChevronRight size={16} className="mx-2 text-gray-300" />
                    <span className="font-semibold text-gray-800">Lacak Pengajuan</span>
                </div>
                <div className="flex items-center gap-4">
                    <button className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors relative">
                        <Bell size={20} />
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div className="flex items-center gap-3 cursor-pointer">
                        <span className="font-semibold text-sm hidden sm:block">{user?.name || 'Siti Aminah'}</span>
                        <div className="w-8 h-8 rounded-full bg-[#003a73] text-white flex items-center justify-center font-bold text-sm">
                            {user?.name?.charAt(0) || 'S'}
                        </div>
                    </div>
                </div>
            </header>

            {/* Split Panel Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel (List) */}
                <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-gray-200 flex flex-col shadow-[4px_0_12px_rgba(0,0,0,0.03)]">
                    {/* Search & Filters */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50 sticky top-0 z-20">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Pengajuan Anda</h2>
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari ID atau Nama Proyek..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] outline-none transition-all text-sm"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {statusOptions.map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setFilterStatus(opt)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === opt
                                            ? 'bg-blue-100 text-[#1A56DB]'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Project List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/30">
                        {filteredProjects.length > 0 ? (
                            filteredProjects.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProject(project)}
                                    className={`bg-white rounded-xl shadow-sm border relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow group ${selectedProject?.id === project.id
                                            ? 'border-[#1A56DB] ring-1 ring-[#1A56DB]'
                                            : 'border-gray-200'
                                        }`}
                                >
                                    {selectedProject?.id === project.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D4A017]"></div>
                                    )}
                                    <div className="p-4 pl-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-semibold text-gray-500">{project.id}</span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(project.status)}`}>
                                                {project.status}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-[#1A56DB] transition-colors">
                                            {project.name}
                                        </h3>
                                        <div className="flex items-center text-xs text-gray-500 mt-3">
                                            <Calendar size={14} className="mr-1" />
                                            {project.submittedDate}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-500 text-sm">
                                Tidak ada pengajuan yang sesuai
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel (Details) */}
                <div className="flex-1 flex flex-col bg-gray-50/30 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
                        <div className="max-w-4xl mx-auto">
                            {/* Detail Header */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className="px-2.5 py-1 bg-gray-100 rounded-md text-xs font-semibold text-gray-600 border border-gray-200">
                                            {selectedProject.id}
                                        </span>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(selectedProject.status)}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${selectedProject.status === 'IN DEVELOPMENT' ? 'bg-blue-500 animate-pulse' : 'bg-current'
                                                }`}></span>
                                            {selectedProject.status}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-bold text-gray-800 mb-4">{selectedProject.name}</h1>
                                    <div className="flex flex-wrap gap-x-8 gap-y-4">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Tanggal Pengajuan</p>
                                            <p className="font-semibold text-gray-800 flex items-center">
                                                <Calendar size={16} className="mr-1.5 text-gray-400" />
                                                {selectedProject.submittedDate}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Target Go-Live</p>
                                            <p className="font-semibold text-gray-800 flex items-center">
                                                <Rocket size={16} className="mr-1.5 text-gray-400" />
                                                {selectedProject.targetDate}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Project Manager</p>
                                            <div className="flex items-center">
                                                <div className="w-6 h-6 rounded-full bg-[#1A56DB] text-white flex items-center justify-center text-[10px] font-bold mr-2">
                                                    {selectedProject.pmAvatar}
                                                </div>
                                                <p className="font-semibold text-gray-800">{selectedProject.pm}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="shrink-0 flex items-center px-4 py-2.5 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed opacity-60 transition-colors border border-gray-200 font-semibold text-sm"
                                    disabled
                                >
                                    <FileText size={18} className="mr-2" />
                                    Unduh Ringkasan PDF
                                </button>
                            </div>

                            {/* Timeline Section */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800 mb-8 flex items-center">
                                    <Route size={20} className="mr-2 text-[#1A56DB]" />
                                    Perjalanan Pengajuan
                                </h2>

                                <div className="relative px-2">
                                    {selectedProject.phases.map((phase, idx) => (
                                        <div
                                            key={idx}
                                            className="relative flex gap-6 pb-12 last:pb-0"
                                        >
                                            {/* Timeline line */}
                                            {idx < selectedProject.phases.length - 1 && (
                                                <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200 z-0"></div>
                                            )}

                                            {/* Icon */}
                                            <div className="relative flex flex-col items-center z-10">
                                                {getPhaseCircle(phase)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 pt-1">
                                                <h3 className={`font-semibold text-gray-800 mb-1 ${phase.isActive ? 'text-[#1A56DB]' : ''}`}>
                                                    {phase.name}
                                                </h3>
                                                <p className="text-sm text-gray-500 mb-4">{phase.description}</p>

                                                {/* Phase items */}
                                                {phase.items && phase.items.length > 0 && (
                                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                                                        {phase.items.map((item, i) => (
                                                            <div key={i} className="flex items-center gap-3">
                                                                <CheckCircle size={16} className="text-emerald-500" />
                                                                <span className="text-sm text-gray-700">
                                                                    {item.label}
                                                                    <span className="text-xs text-gray-400 ml-2">({item.date})</span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {/* Active note */}
                                                        {phase.isActive && phase.activeNote && (
                                                            <div className="flex items-start gap-3 p-3 bg-white rounded border border-blue-200 shadow-sm mt-2">
                                                                <Shield size={18} className="text-[#1A56DB] animate-pulse mt-0.5" />
                                                                <div>
                                                                    <span className="font-semibold text-sm text-gray-800 block mb-1">
                                                                        {phase.activeNote}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">{phase.activeNoteDetail}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}