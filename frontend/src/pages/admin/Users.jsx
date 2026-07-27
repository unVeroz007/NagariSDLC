import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMasterData } from '../../contexts/MasterDataContext';
import toast from 'react-hot-toast';
import {
    Users,
    Search,
    Filter,
    Edit,
    Trash2,
    UserPlus,
    Badge,
    Building,
    ChevronLeft,
    ChevronRight,
    CheckCircle,
    XCircle,
    X,
    User,
    Mail,
    Shield,
    Briefcase,
    AlertCircle,
    Check,
} from 'lucide-react';

// Mock Data Pengguna Awal
const INITIAL_USERS = [
    {
        id: 'USR-001',
        name: 'Budi Santoso',
        email: 'budi.santoso@banknagari.co.id',
        role: 'project_manager',
        roleLabel: 'Project Manager',
        department: 'Divisi Teknologi Informasi',
        status: 'active',
        initial: 'BS',
    },
    {
        id: 'USR-002',
        name: 'Citra Kirana',
        email: 'citra.kirana@banknagari.co.id',
        role: 'analyst',
        roleLabel: 'System Analyst',
        department: 'Divisi Teknologi Informasi',
        status: 'active',
        initial: 'CK',
    },
    {
        id: 'USR-003',
        name: 'Dimas Anggara',
        email: 'dimas.anggara@banknagari.co.id',
        role: 'developer',
        roleLabel: 'Developer (Programmer)',
        department: 'Divisi Teknologi Informasi',
        status: 'active',
        initial: 'DA',
    },
    {
        id: 'USR-004',
        name: 'Rizal Pratama',
        email: 'rizal.pratama@banknagari.co.id',
        role: 'cyber_team',
        roleLabel: 'Cyber Team',
        department: 'Divisi Kepatuhan',
        status: 'active',
        initial: 'RP',
    },
    {
        id: 'USR-005',
        name: 'Siti Rahmawati',
        email: 'siti.rahmawati@banknagari.co.id',
        role: 'qa_tester',
        roleLabel: 'QA Tester',
        department: 'Divisi Teknologi Informasi',
        status: 'inactive',
        initial: 'SR',
    },
    {
        id: 'USR-006',
        name: 'Ahmad Fauzi',
        email: 'ahmad.fauzi@banknagari.co.id',
        role: 'super_admin',
        roleLabel: 'Super Admin',
        department: 'Tata Kelola & Audit TI',
        status: 'active',
        initial: 'AF',
    },
    {
        id: 'USR-007',
        name: 'Dewi Lestari',
        email: 'dewi.lestari@banknagari.co.id',
        role: 'qa_lead',
        roleLabel: 'QA Lead',
        department: 'Divisi Teknologi Informasi',
        status: 'active',
        initial: 'DL',
    },
    {
        id: 'USR-008',
        name: 'Hendra Setiawan',
        email: 'hendra.setiawan@banknagari.co.id',
        role: 'head_of_it',
        roleLabel: 'Head of IT',
        department: 'Tata Kelola & Audit TI',
        status: 'active',
        initial: 'HS',
    },
    {
        id: 'USR-009',
        name: 'Eka Putri',
        email: 'eka.putri@banknagari.co.id',
        role: 'developer',
        roleLabel: 'Developer (Programmer)',
        department: 'Divisi Teknologi Informasi',
        status: 'active',
        initial: 'EP',
    },
    {
        id: 'USR-010',
        name: 'Fajar Hidayat',
        email: 'fajar.hidayat@banknagari.co.id',
        role: 'lead_group',
        roleLabel: 'Lead Group',
        department: 'Tata Kelola & Audit TI',
        status: 'active',
        initial: 'FH',
    },
];

export default function UsersManagement() {
    const { user: currentUser } = useAuth();
    const { roles: masterRoles, divisions: masterDivisions } = useMasterData();

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Load users from localStorage or default
    const [usersList, setUsersList] = useState(() => {
        const saved = localStorage.getItem('nagari_sdlc_users_list');
        if (saved) {
            try { return JSON.parse(saved); } catch { }
        }
        return INITIAL_USERS;
    });

    const saveUsersList = (updated) => {
        setUsersList(updated);
        localStorage.setItem('nagari_sdlc_users_list', JSON.stringify(updated));
    };

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Form Data States
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        email: '',
        role: masterRoles[0]?.code || 'developer',
        department: masterDivisions[0]?.name || 'Divisi Teknologi Informasi',
        status: 'active',
    });

    // Handle Open Add Modal
    const handleOpenAddModal = () => {
        const newId = `USR-0${usersList.length + 1}`;
        setFormData({
            id: newId,
            name: '',
            email: '',
            role: masterRoles[0]?.code || 'developer',
            department: masterDivisions[0]?.name || 'Divisi Teknologi Informasi',
            status: 'active',
        });
        setIsAddModalOpen(true);
    };

    // Handle Open Edit Modal
    const handleOpenEditModal = (u) => {
        setEditingUser(u);
        setFormData({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            department: u.department,
            status: u.status,
        });
        setIsEditModalOpen(true);
    };

    // Handle Save New User
    const handleAddUserSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.email.trim()) {
            toast.error('Nama dan Email wajib diisi!');
            return;
        }

        const roleObj = masterRoles.find(r => r.code === formData.role);
        const initials = formData.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);

        const newUserObj = {
            id: formData.id || `USR-0${usersList.length + 1}`,
            name: formData.name,
            email: formData.email,
            role: formData.role,
            roleLabel: roleObj ? roleObj.name : formData.role,
            department: formData.department,
            status: formData.status,
            initial: initials || 'U',
        };

        const updated = [newUserObj, ...usersList];
        saveUsersList(updated);
        toast.success(`Pengguna "${formData.name}" berhasil ditambahkan!`);
        setIsAddModalOpen(false);
    };

    // Handle Save Edited User
    const handleEditUserSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Nama wajib diisi!');
            return;
        }

        const roleObj = masterRoles.find(r => r.code === formData.role);
        const initials = formData.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);

        const updated = usersList.map(u => {
            if (u.id === editingUser.id) {
                return {
                    ...u,
                    name: formData.name,
                    role: formData.role,
                    roleLabel: roleObj ? roleObj.name : formData.role,
                    department: formData.department,
                    status: formData.status,
                    initial: initials || u.initial,
                };
            }
            return u;
        });

        saveUsersList(updated);
        toast.success(`Data pengguna "${formData.name}" berhasil diperbarui!`);
        setIsEditModalOpen(false);
        setEditingUser(null);
    };

    // Handle Delete User
    const handleDeleteUser = (u) => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus pengguna "${u.name}" (${u.email})?`)) {
            const updated = usersList.filter(item => item.id !== u.id);
            saveUsersList(updated);
            toast.success(`Pengguna "${u.name}" berhasil dihapus.`);
        }
    };

    // Helper display role label
    const getDisplayRole = (u) => {
        const found = masterRoles.find(r => r.code === u.role);
        return found ? found.name : (u.roleLabel || u.role);
    };

    // Filter users
    const filteredUsers = usersList.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = roleFilter ? u.role === roleFilter : true;
        return matchSearch && matchRole;
    });

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
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

    const getRoleBadgeColor = (roleKey) => {
        const colors = {
            super_admin: 'bg-purple-100 text-purple-700 border-purple-200',
            lead_group: 'bg-amber-100 text-amber-700 border-amber-200',
            analyst: 'bg-cyan-100 text-cyan-700 border-cyan-200',
            development_lead: 'bg-blue-100 text-blue-700 border-blue-200',
            project_manager: 'bg-indigo-100 text-indigo-700 border-indigo-200',
            qa_lead: 'bg-teal-100 text-teal-700 border-teal-200',
            qa_tester: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            cyber_team: 'bg-rose-100 text-rose-700 border-rose-200',
            pentester: 'bg-red-100 text-red-700 border-red-200',
            head_of_it: 'bg-orange-100 text-orange-700 border-orange-200',
            business_user: 'bg-sky-100 text-sky-700 border-sky-200',
            developer: 'bg-[#003a73]/10 text-[#003a73] border-blue-200',
        };
        return colors[roleKey] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Manajemen Pengguna</h1>
                    <p className="text-sm text-gray-500 mt-1">Kelola akses, peran (role), dan status aktif pengguna sistem NagariSDLC.</p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="bg-[#003a73] text-white py-2.5 px-5 rounded-xl font-semibold flex items-center gap-2 hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer"
                >
                    <UserPlus size={18} />
                    Tambah Pengguna Baru
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Pengguna Aktif</p>
                        <h3 className="text-3xl font-bold text-gray-800 mt-1">{usersList.filter(u => u.status === 'active').length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#1A56DB]">
                        <Users size={26} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Peran (Master Roles)</p>
                        <h3 className="text-3xl font-bold text-gray-800 mt-1">{masterRoles.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                        <Badge size={26} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Departemen (Master Divisi)</p>
                        <h3 className="text-3xl font-bold text-gray-800 mt-1">{masterDivisions.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                        <Building size={26} />
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
                    <div className="relative w-full sm:w-80">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari pengguna berdasarkan nama, email, ID..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full sm:w-56 py-2 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:border-[#1A56DB] outline-none shadow-sm cursor-pointer font-medium text-gray-700"
                        >
                            <option value="">Semua Peran (Master Roles)</option>
                            {masterRoles.map((r) => (
                                <option key={r.id} value={r.code}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                                <th className="py-4 px-6">Nama Lengkap</th>
                                <th className="py-4 px-6">Email</th>
                                <th className="py-4 px-6">Role (Hak Akses)</th>
                                <th className="py-4 px-6">Departemen / Divisi</th>
                                <th className="py-4 px-6">Status</th>
                                <th className="py-4 px-6 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {currentUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        Tidak ada data pengguna yang sesuai dengan pencarian/filter.
                                    </td>
                                </tr>
                            ) : (
                                currentUsers.map((u) => (
                                    <tr key={u.id} className={`hover:bg-gray-50/80 transition-colors group ${u.status === 'inactive' ? 'opacity-60' : ''}`}>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${getRoleBadgeColor(u.role)}`}>
                                                    {u.initial}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[#1a365d] group-hover:text-blue-600 transition-colors">
                                                        {u.name}
                                                    </div>
                                                    <div className="text-xs text-gray-400 font-mono">{u.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-gray-600 font-medium">{u.email}</td>
                                        <td className="py-4 px-6">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${getRoleBadgeColor(u.role)}`}>
                                                {getDisplayRole(u)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-gray-600 font-medium">{u.department}</td>
                                        <td className="py-4 px-6">{getStatusBadge(u.status)}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEditModal(u)}
                                                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Edit User"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(u)}
                                                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Hapus User"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredUsers.length > 0 && (
                    <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-white">
                        <span className="text-xs text-gray-500 font-medium">
                            Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)} dari {filteredUsers.length} pengguna
                        </span>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${pageNum === currentPage
                                        ? 'bg-[#003a73] text-white shadow-sm'
                                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL EDIT USER */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <Edit size={18} className="text-[#003a73]" /> Edit Data Pengguna
                            </h3>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleEditUserSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Lengkap</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Alamat Email (Read-Only)</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    disabled
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-100 text-xs text-gray-500 font-mono cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Departemen / Divisi (Master Data)</label>
                                <select
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer"
                                >
                                    {masterDivisions.map((dept) => (
                                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Role / Peran Pengguna (Master Data)</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer text-[#003a73]"
                                >
                                    {masterRoles.map((r) => (
                                        <option key={r.id} value={r.code}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Status Pengguna</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer"
                                >
                                    <option value="active">Aktif</option>
                                    <option value="inactive">Non-Aktif</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-[#003a73] text-white text-xs font-bold hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer"
                                >
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL TAMBAH USER */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <UserPlus size={18} className="text-[#003a73]" /> Tambah Pengguna Baru
                            </h3>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleAddUserSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Lengkap</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Contoh: Budi Santoso"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Alamat Email Bank Nagari</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="nama@banknagari.co.id"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Departemen / Divisi (Master Data)</label>
                                <select
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer"
                                >
                                    {masterDivisions.map((dept) => (
                                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Role / Peran Pengguna (Master Data)</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer text-[#003a73]"
                                >
                                    {masterRoles.map((r) => (
                                        <option key={r.id} value={r.code}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Status Pengguna</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer"
                                >
                                    <option value="active">Aktif</option>
                                    <option value="inactive">Non-Aktif</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-[#003a73] text-white text-xs font-bold hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer"
                                >
                                    Tambah Pengguna
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}