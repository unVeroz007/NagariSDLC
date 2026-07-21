import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    Shield,
    FolderOpen,
    Link as LinkIcon,
    Copy,
    Send,
    Ban,
    User,
    Clock,
    Calendar,
    ChevronRight,
    Search,
    Bell,
    History,
    HelpCircle,
    FileText,
    File,
    CheckCircle,
    AlertCircle,
    Eye,
    MoreVertical,
    Users,
    Filter,
    Inbox,
    ChevronDown,
} from 'lucide-react';

// Mock data untuk antrean cyber
const cyberQueue = [
    {
        id: 'CYB-REQ-2026-0312',
        projectName: 'Aplikasi LOS Baru',
        projectDesc: 'Pengajuan audit keamanan untuk sistem LOS baru sebelum masuk fase UAT dan rilis ke production. Sistem ini menangani data PII nasabah.',
        submittedBy: 'Anita Rahman',
        submittedAt: '2 jam lalu',
        status: 'Menunggu Audit',
        stagingUrl: 'https://staging-los.banknagari.co.id',
        documents: [
            { name: 'BRD_Final.pdf', size: '2.4 MB', type: 'pdf', label: 'Requirements' },
            { name: 'FSD_v2.docx', size: '1.8 MB', type: 'docx', label: 'System Design' },
            { name: 'QA_SignOff_Report.pdf', size: '450 KB', type: 'pdf', label: 'Passed' },
        ],
    },
    {
        id: 'CYB-REQ-2026-0310',
        projectName: 'Update Core Banking API',
        projectDesc: 'Audit keamanan untuk API core banking yang terintegrasi dengan sistem mobile banking.',
        submittedBy: 'Budi Santoso',
        submittedAt: '5 jam lalu',
        status: 'In Progress',
        stagingUrl: 'https://staging-api.banknagari.co.id',
        documents: [
            { name: 'BRD_API_v2.pdf', size: '1.2 MB', type: 'pdf', label: 'Requirements' },
            { name: 'FSD_API_v3.docx', size: '2.1 MB', type: 'docx', label: 'System Design' },
        ],
    },
    {
        id: 'CYB-REQ-2026-0308',
        projectName: 'Mobile Banking v4.0',
        projectDesc: 'Audit keamanan untuk aplikasi mobile banking versi terbaru dengan fitur biometrik.',
        submittedBy: 'Dian Sastro',
        submittedAt: '1 hari lalu',
        status: 'Menunggu Audit',
        stagingUrl: 'https://staging-mobile.banknagari.co.id',
        documents: [
            { name: 'BRD_Mobile_v4.pdf', size: '3.1 MB', type: 'pdf', label: 'Requirements' },
            { name: 'FSD_Mobile_v4.docx', size: '2.8 MB', type: 'docx', label: 'System Design' },
            { name: 'QA_Report_Mobile.pdf', size: '1.2 MB', type: 'pdf', label: 'Passed' },
        ],
    },
];

// Mock data untuk pentester
const pentesters = [
    { id: 1, name: 'Rizal Pratama', role: 'Senior Pentester' },
    { id: 2, name: 'Sari Indah', role: 'Security Analyst' },
    { id: 3, name: 'Budi Santoso', role: 'Junior Pentester' },
];

export default function WorkspaceCyber() {
    const { user } = useAuth();
    const [selectedProject, setSelectedProject] = useState(cyberQueue[0]);
    const [selectedPentester, setSelectedPentester] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [instructions, setInstructions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssign = () => {
        if (!selectedPentester) {
            alert('Pilih pentester terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            alert(`Pengajuan cyber untuk ${selectedProject?.projectName} berhasil ditugaskan ke ${selectedPentester}`);
            setIsSubmitting(false);
            // Remove from queue
            const index = cyberQueue.indexOf(selectedProject);
            if (index > -1) cyberQueue.splice(index, 1);
            if (cyberQueue.length > 0) {
                setSelectedProject(cyberQueue[0]);
                setSelectedPentester('');
                setTargetDate('');
                setInstructions('');
            } else {
                setSelectedProject(null);
            }
        }, 1500);
    };

    const handleReject = () => {
        if (!confirm('Yakin ingin menolak pengajuan ini?')) return;
        const index = cyberQueue.indexOf(selectedProject);
        if (index > -1) cyberQueue.splice(index, 1);
        if (cyberQueue.length > 0) {
            setSelectedProject(cyberQueue[0]);
        } else {
            setSelectedProject(null);
        }
        alert('Pengajuan ditolak!');
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Menunggu Audit':
                return (
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock size={12} />
                        {status}
                    </span>
                );
            case 'In Progress':
                return (
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle size={12} />
                        {status}
                    </span>
                );
            default:
                return (
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                        {status}
                    </span>
                );
        }
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'pdf': return <FileText size={20} className="text-red-500" />;
            case 'docx': return <File size={20} className="text-blue-500" />;
            default: return <File size={20} className="text-gray-400" />;
        }
    };

    const getFileBg = (type) => {
        switch (type) {
            case 'pdf': return 'bg-red-100 text-red-500';
            case 'docx': return 'bg-blue-100 text-blue-600';
            default: return 'bg-gray-100 text-gray-500';
        }
    };

    if (!selectedProject) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                        <Shield size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Semua Pengajuan Selesai</h2>
                    <p className="text-gray-500 mt-2">Tidak ada antrean pengajuan keamanan siber yang menunggu.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8f9fb] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="hover:text-[#1A56DB] cursor-pointer">Beranda</span>
                    <ChevronRight size={16} className="text-gray-300" />
                    <span>Fase 3</span>
                    <ChevronRight size={16} className="text-gray-300" />
                    <span className="text-[#1A56DB] font-semibold">Workspace Cyber</span>
                </div>
                <div className="mt-1">
                    <h2 className="text-2xl font-bold text-gray-800">Workspace Keamanan Siber (Cyber)</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Tinjau antrean audit keamanan dan disposisi pentester.
                    </p>
                </div>
            </div>

            {/* Split Layout */}
            <div className="flex-1 overflow-hidden p-6 gap-6 flex">
                {/* LEFT PANEL: Inbox */}
                <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <Inbox size={18} className="text-[#1A56DB]" />
                            Antrean Pengajuan
                        </h3>
                        <span className="bg-blue-100 text-[#1A56DB] px-2.5 py-0.5 rounded-full text-xs font-bold">
                            {cyberQueue.length} Active
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {cyberQueue.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => {
                                    setSelectedProject(project);
                                    setSelectedPentester('');
                                    setTargetDate('');
                                    setInstructions('');
                                }}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedProject?.id === project.id
                                        ? 'border-[#1A56DB] bg-blue-50/50 relative'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                {selectedProject?.id === project.id && (
                                    <div className="absolute right-0 top-0 w-1 h-full bg-[#1A56DB] rounded-r-lg"></div>
                                )}
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-[#1A56DB]">{project.id}</span>
                                    {getStatusBadge(project.status)}
                                </div>
                                <h4 className="font-semibold text-gray-800 mb-1">{project.projectName}</h4>
                                <div className="flex items-center text-xs text-gray-500 mt-3">
                                    <User size={14} className="mr-1" />
                                    <span>{project.submittedBy}</span>
                                    <span className="mx-2">•</span>
                                    <Clock size={14} className="mr-1" />
                                    <span>{project.submittedAt}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT PANEL: Detail */}
                <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Detail Header */}
                    <div className="p-6 border-b border-gray-200 bg-gray-50/50 shrink-0">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-gray-200 px-3 py-1 rounded-md text-sm font-bold text-gray-600">
                                {selectedProject.id}
                            </span>
                            {getStatusBadge(selectedProject.status)}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">{selectedProject.projectName}</h3>
                        <p className="text-sm text-gray-500 mt-2 max-w-2xl">
                            {selectedProject.projectDesc}
                        </p>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Documents & Access */}
                        <section>
                            <h4 className="font-semibold text-gray-700 mb-4 flex items-center">
                                <FolderOpen size={18} className="mr-2 text-[#1A56DB]" />
                                Berkas Kumulatif &amp; Akses
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                {selectedProject.documents.map((doc, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center p-3 border border-gray-200 rounded-lg bg-white hover:border-[#1A56DB] cursor-pointer transition-colors ${doc.label === 'Passed' ? 'relative overflow-hidden' : ''
                                            }`}
                                    >
                                        {doc.label === 'Passed' && (
                                            <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 rounded-r-lg"></div>
                                        )}
                                        <div className={`w-10 h-10 ${getFileBg(doc.type)} rounded flex items-center justify-center mr-3 shrink-0`}>
                                            {getFileIcon(doc.type)}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {doc.size} • {doc.label}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Staging URL */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-center justify-between">
                                <div className="flex items-center">
                                    <LinkIcon size={18} className="text-gray-400 mr-3" />
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                                            Target URL (Staging)
                                        </p>
                                        <a
                                            href={selectedProject.stagingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#1A56DB] hover:underline text-sm"
                                        >
                                            {selectedProject.stagingUrl}
                                        </a>
                                    </div>
                                </div>
                                <button
                                    className="p-2 text-gray-400 hover:text-[#1A56DB] hover:bg-white rounded transition-colors"
                                    title="Copy URL"
                                    onClick={() => {
                                        navigator.clipboard.writeText(selectedProject.stagingUrl);
                                        alert('URL berhasil disalin!');
                                    }}
                                >
                                    <Copy size={18} />
                                </button>
                            </div>
                        </section>

                        <hr className="border-gray-200" />

                        {/* Form Disposisi */}
                        <section className="bg-gray-50/50 p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h4 className="font-semibold text-gray-700 mb-4 flex items-center">
                                <User size={18} className="mr-2 text-[#1A56DB]" />
                                Form Disposisi Tugas
                            </h4>

                            <div className="grid grid-cols-1 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Pilih Anggota Tim Cyber <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={selectedPentester}
                                            onChange={(e) => setSelectedPentester(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg appearance-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] text-sm"
                                        >
                                            <option value="">Pilih Pentester...</option>
                                            {pentesters.map((p) => (
                                                <option key={p.id} value={p.name}>
                                                    {p.name} ({p.role})
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Target Selesai Audit <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Instruksi Khusus (Opsional)
                                </label>
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder="Masukkan catatan tambahan untuk pentester..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] text-sm resize-none"
                                />
                            </div>
                        </section>
                    </div>

                    {/* Action Footer */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50/50 shrink-0 flex justify-between items-center">
                        <button
                            onClick={handleReject}
                            className="px-6 py-2.5 border border-red-500 text-red-500 hover:bg-red-50 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
                        >
                            <Ban size={18} />
                            Tolak Pengajuan
                        </button>
                        <button
                            onClick={handleAssign}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-[#003a73] text-white hover:bg-[#002a5a] rounded-lg font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Send size={18} />
                            {isSubmitting ? 'Memproses...' : 'Tugaskan Pentester'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}