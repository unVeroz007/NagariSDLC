import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    History,
    Search,
    Download,
    ChevronLeft,
    ChevronRight,
    Bell,
    CheckCircle,
    AlertCircle,
    Info,
    Activity,
    List,
    Bot,
    Shield,
    User,
    Calendar,
    Filter,
    MoreVertical,
    Eye,
    FileText,
    Server,
    Database,
    Clock,
    Home,
    BarChart,
    Settings,
    LogOut,
    FileCheck,
    XCircle,
    ChevronRight as ChevronRightIcon,
} from 'lucide-react';

// Mock data audit logs
const auditLogs = [
    {
        id: 1,
        time: '12 Okt 2023, 14:30',
        user: 'Hendra Setiawan',
        action: 'Approve Go-Live',
        project: 'Aplikasi LOS Baru',
        ip: '192.168.1.50',
        status: 'Success',
        type: 'user',
    },
    {
        id: 2,
        time: '12 Okt 2023, 13:15',
        user: 'Rizal Pratama',
        action: 'Upload Pentest Report',
        project: 'Aplikasi LOS Baru',
        ip: '192.168.1.12',
        status: 'Info',
        type: 'user',
    },
    {
        id: 3,
        time: '12 Okt 2023, 11:45',
        user: 'Citra Kirana',
        action: 'Reject Deployment',
        project: 'Dashboard HRIS',
        ip: '192.168.1.22',
        status: 'Warning',
        type: 'user',
    },
    {
        id: 4,
        time: '12 Okt 2023, 10:20',
        user: 'Budi Santoso',
        action: 'Update Kanban Task',
        project: 'Aplikasi LOS Baru',
        ip: '192.168.1.45',
        status: 'Success',
        type: 'user',
    },
    {
        id: 5,
        time: '12 Okt 2023, 09:00',
        user: 'Sistem',
        action: 'Auto-Lock Column',
        project: 'Aplikasi LOS Baru',
        ip: 'System',
        status: 'System',
        type: 'system',
    },
    {
        id: 6,
        time: '12 Okt 2023, 08:15',
        user: 'Ahmad Fauzi',
        action: 'User Login',
        project: 'Dashboard Utama',
        ip: '192.168.1.1',
        status: 'Success',
        type: 'user',
    },
];

// Stats
const stats = {
    total: 248,
    approvals: 12,
    warnings: 3,
    system: 5,
};

export default function AuditTrail() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Success':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Success
                    </span>
                );
            case 'Info':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        Info
                    </span>
                );
            case 'Warning':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Warning
                    </span>
                );
            case 'System':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        System
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        {status}
                    </span>
                );
        }
    };

    const filteredLogs = auditLogs.filter((log) => {
        const matchSearch =
            log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.ip.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = roleFilter ? log.type === roleFilter : true;
        return matchSearch && matchRole;
    });

    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const currentLogs = filteredLogs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F7F8FA]">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Log Aktivitas Sistem</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Rekam jejak seluruh tindakan pengguna dalam sistem untuk keperluan audit.
                        </p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-[#1A56DB] font-semibold hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap">
                        <Download size={18} />
                        Export CSV/PDF
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center">
                            <List size={24} />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 font-medium mb-1">Total Aktivitas</div>
                            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 font-medium mb-1">Persetujuan</div>
                            <div className="text-2xl font-bold text-gray-800">{stats.approvals}</div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 font-medium mb-1">Peringatan</div>
                            <div className="text-2xl font-bold text-gray-800">{stats.warnings}</div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <Bot size={24} />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 font-medium mb-1">Sistem</div>
                            <div className="text-2xl font-bold text-gray-800">{stats.system}</div>
                        </div>
                    </div>
                </div>

                {/* Table Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-5 border-b border-gray-200 bg-gray-50/50 flex flex-wrap gap-4 items-center justify-between">
                        <div className="relative w-full md:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari user, tindakan, IP..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] shadow-sm bg-white outline-none"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="py-2 pl-3 pr-8 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] shadow-sm bg-white text-gray-700 cursor-pointer outline-none"
                            >
                                <option value="">Semua Tipe</option>
                                <option value="user">User</option>
                                <option value="system">System</option>
                            </select>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    className="py-2 px-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] shadow-sm bg-white text-gray-500 cursor-pointer outline-none"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    className="py-2 px-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] shadow-sm bg-white text-gray-500 cursor-pointer outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                    <th className="px-6 py-4">Waktu</th>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Tindakan</th>
                                    <th className="px-6 py-4">Proyek / Modul</th>
                                    <th className="px-6 py-4">IP Address</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-sm">
                                {currentLogs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className={`hover:bg-gray-50/70 transition-colors ${log.status === 'Warning' ? 'bg-red-50/30' : ''
                                            }`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{log.time}</td>
                                        <td className="px-6 py-4 font-medium text-gray-800">
                                            {log.type === 'system' ? (
                                                <div className="flex items-center gap-2">
                                                    <Bot size={14} className="text-purple-600" />
                                                    {log.user}
                                                </div>
                                            ) : (
                                                log.user
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-700">{log.action}</td>
                                        <td className="px-6 py-4 text-gray-500">{log.project}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{log.ip}</td>
                                        <td className="px-6 py-4">{getStatusBadge(log.status)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredLogs.length > 0 && (
                        <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between text-sm text-gray-500">
                            <span>
                                Menampilkan {(currentPage - 1) * itemsPerPage + 1}-
                                {Math.min(currentPage * itemsPerPage, filteredLogs.length)} dari {filteredLogs.length} entri
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-8 h-8 flex items-center justify-center rounded font-medium text-sm ${currentPage === i + 1
                                                ? 'bg-[#1A56DB] text-white'
                                                : 'border border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                {totalPages > 3 && (
                                    <>
                                        <span className="px-2 text-gray-400">...</span>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 font-medium text-sm"
                                        >
                                            {totalPages}
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}