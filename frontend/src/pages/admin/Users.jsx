import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    Users,
    Search,
    Bell,
    Settings,
    HelpCircle,
    ChevronRight,
    Plus,
    Filter,
    Edit,
    Trash2,
    UserPlus,
    Badge,
    Building,
    ChevronLeft,
    Eye,
    MoreVertical,
    CheckCircle,
    XCircle,
    User,
    Mail,
    Shield,
    Briefcase,
    AlertCircle,
    Download,
    Upload,
} from 'lucide-react';

// Mock data pengguna
const mockUsers = [
    {
        id: 'USR-001',
        name: 'Budi Santoso',
        email: 'budi.santoso@banknagari.co.id',
        role: 'Project Manager',
        department: 'Divisi TI',
        status: 'active',
        initial: 'BS',
    },
    {
        id: 'USR-002',
        name: 'Citra Kirana',
        email: 'citra.kirana@banknagari.co.id',
        role: 'System Analyst',
        department: 'Divisi TI',
        status: 'active',
        initial: 'CK',
    },
    {
        id: 'USR-003',
        name: 'Dimas Anggara',
        email: 'dimas.anggara@banknagari.co.id',
        role: 'QA Tester',
        department: 'Divisi TI',
        status: 'active',
        initial: 'DA',
    },
    {
        id: 'USR-004',
        name: 'Rizal Pratama',
        email: 'rizal.pratama@banknagari.co.id',
        role: 'Pentester',
        department: 'Divisi Kepatuhan',
        status: 'active',
        initial: 'RP',
    },
    {
        id: 'USR-005',
        name: 'Siti Rahmawati',
        email: 'siti.rahmawati@banknagari.co.id',
        role: 'QA Automation',
        department: 'Divisi TI',
        status: 'inactive',
        initial: 'SR',
    },
    {
        id: 'USR-006',
        name: 'Ahmad Fauzi',
        email: 'ahmad.fauzi@banknagari.co.id',
        role: 'Super Admin',
        department: 'IT Governance',
        status: 'active',
        initial: 'AF',
    },
    {
        id: 'USR-007',
        name: 'Dewi Lestari',
        email: 'dewi.lestari@banknagari.co.id',
        role: 'Lead QA',
        department: 'Divisi TI',
        status: 'active',
        initial: 'DL',
    },
    {
        id: 'USR-008',
        name: 'Hendra Setiawan',
        email: 'hendra.setiawan@banknagari.co.id',
        role: 'Head of IT',
        department: 'IT Governance',
        status: 'active',
        initial: 'HS',
    },
];

export default function UsersManagement() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Get unique roles for filter
    const uniqueRoles = [...new Set(mockUsers.map(u => u.role))];

    // Filter users
    const filteredUsers = mockUsers.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = roleFilter ? u.role === roleFilter : true;
        return matchSearch && matchRole;
    });

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const currentUsers = filteredUsers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getStatusBadge = (status) => {
        if (status === 'active') {
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                    Aktif
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5"></span>
                Non-Aktif
            </span>
        );
    };

    const getRoleColor = (role) => {
        const colors = {
            'Super Admin': 'bg-purple-100 text-purple-700',
            'Project Manager': 'bg-blue-100 text-blue-700',
            'System Analyst': 'bg-cyan-100 text-cyan-700',
            'QA Tester': 'bg-emerald-100 text-emerald-700',
            'QA Automation': 'bg-teal-100 text-teal-700',
            'Pentester': 'bg-red-100 text-red-700',
            'Lead QA': 'bg-indigo-100 text-indigo-700',
            'Head of IT': 'bg-amber-100 text-amber-700',
        };
        return colors[role] || 'bg-gray-100 text-gray-700';
    };

    const getInitials = (name) => {
        return name.split(' ').map(n => n.charAt(0)).join('');
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Manajemen Pengguna</h1>
                    <p className="text-sm text-gray-500 mt-1">Kelola akses, peran, dan status pengguna dalam sistem SDLC.</p>
                </div>
                <button className="bg-[#003a73] text-white py-2.5 px-5 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#002a5a] transition-colors shadow-sm">
                    <UserPlus size={18} />
                    Tambah Pengguna Baru
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Pengguna Aktif</p>
                        <h3 className="text-3xl font-bold text-gray-800 mt-1">{mockUsers.filter(u => u.status === 'active').length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[#1A56DB]">
                        <Users size={28} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Peran</p>
                        <h3 className="text-3xl font-bold text-gray-800 mt-1">{uniqueRoles.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                        <Badge size={28} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Departemen</p>
                        <h3 className="text-3xl font-bold text-gray-800 mt-1">
                            {[...new Set(mockUsers.map(u => u.department))].length}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                        <Building size={28} />
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
                    <div className="relative w-full sm:w-80">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari pengguna..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full sm:w-48 py-2 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:border-[#1A56DB] outline-none shadow-sm cursor-pointer"
                        >
                            <option value="">Semua Role</option>
                            {uniqueRoles.map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                        <button className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors shadow-sm">
                            <Filter size={18} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                                <th className="py-4 px-6">Nama Lengkap</th>
                                <th className="py-4 px-6">Email</th>
                                <th className="py-4 px-6">Role</th>
                                <th className="py-4 px-6">Departemen</th>
                                <th className="py-4 px-6">Status</th>
                                <th className="py-4 px-6 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {currentUsers.map((u) => (
                                <tr key={u.id} className={`hover:bg-gray-50 transition-colors group ${u.status === 'inactive' ? 'opacity-60' : ''}`}>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getRoleColor(u.role)}`}>
                                                {u.initial}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm text-gray-800 group-hover:text-[#1A56DB] transition-colors">
                                                    {u.name}
                                                </div>
                                                <div className="text-xs text-gray-500">{u.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-sm text-gray-500">{u.email}</td>
                                    <td className="py-4 px-6">
                                        <span className={`text-sm font-medium px-2 py-0.5 rounded ${getRoleColor(u.role)}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-sm text-gray-500">{u.department}</td>
                                    <td className="py-4 px-6">{getStatusBadge(u.status)}</td>
                                    <td className="py-4 px-6 text-right">
                                        <button className="text-gray-400 hover:text-[#1A56DB] transition-colors p-1">
                                            <Edit size={18} />
                                        </button>
                                        <button className="text-gray-400 hover:text-red-500 transition-colors p-1 ml-1">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredUsers.length > 0 && (
                    <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-white">
                        <span className="text-sm text-gray-500">
                            Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)} dari {filteredUsers.length} pengguna
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                    pageNum = currentPage - 2 + i;
                                    if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                                }
                                if (pageNum > 0 && pageNum <= totalPages) {
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${pageNum === currentPage
                                                ? 'bg-[#1A56DB] text-white'
                                                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                }
                                return null;
                            })}
                            {totalPages > 5 && currentPage < totalPages - 2 && (
                                <span className="px-2 py-1 text-gray-400">...</span>
                            )}
                            {totalPages > 5 && currentPage < totalPages - 2 && (
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    className="px-3 py-1 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                                >
                                    {totalPages}
                                </button>
                            )}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}