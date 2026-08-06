import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMasterData } from '../../contexts/MasterDataContext';
import { userService } from '../../services/api';
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
    Loader2,
    RefreshCw,
} from 'lucide-react';

export default function UsersManagement() {
    const { user: currentUser } = useAuth();
    const { roles: masterRoles, divisions: masterDivisions } = useMasterData();

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Data from API
    const [usersList, setUsersList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch users from API
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await userService.getAll();
            if (res && res.data && Array.isArray(res.data)) {
                const formatted = res.data.map(u => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role?.name || 'developer',
                    roleLabel: u.role?.display_name || u.role?.name || 'Developer',
                    roleId: u.role?.id || null,
                    department: u.division?.name || '-',
                    divisionId: u.division?.id || null,
                    status: u.is_active ? 'active' : 'inactive',
                    initial: u.name?.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) || 'U',
                    phoneNumber: u.phone_number || '',
                    createdAt: u.created_at,
                }));
                setUsersList(formatted);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
            toast.error('Gagal memuat data pengguna dari server.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Form Data States
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role_id: '',
        division_id: '',
        phone_number: '',
        is_active: true,
    });

    // Handle Open Add Modal
    const handleOpenAddModal = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            role_id: masterRoles[0]?.id || '',
            division_id: masterDivisions[0]?.id || '',
            phone_number: '',
            is_active: true,
        });
        setIsAddModalOpen(true);
    };

    // Handle Open Edit Modal
    const handleOpenEditModal = (u) => {
        setEditingUser(u);
        setFormData({
            name: u.name,
            email: u.email,
            password: '',
            role_id: u.roleId || '',
            division_id: u.divisionId || '',
            phone_number: u.phoneNumber || '',
            is_active: u.status === 'active',
        });
        setIsEditModalOpen(true);
    };

    // Handle Save New User → API
    const handleAddUserSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.email.trim()) {
            toast.error('Nama dan Email wajib diisi!');
            return;
        }
        if (!formData.password || formData.password.length < 8) {
            toast.error('Password minimal 8 karakter!');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role_id: parseInt(formData.role_id),
                division_id: formData.division_id ? parseInt(formData.division_id) : null,
                phone_number: formData.phone_number || null,
            };
            await userService.create(payload);
            toast.success(`Pengguna "${formData.name}" berhasil ditambahkan & tersimpan ke database!`);
            setIsAddModalOpen(false);
            await fetchUsers(); // Refresh from DB
        } catch (err) {
            toast.error(`Gagal menambahkan pengguna: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Save Edited User → API
    const handleEditUserSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Nama wajib diisi!');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                name: formData.name,
                role_id: parseInt(formData.role_id),
                division_id: formData.division_id ? parseInt(formData.division_id) : null,
                phone_number: formData.phone_number || null,
                is_active: formData.is_active,
            };
            if (formData.password && formData.password.length >= 8) {
                payload.password = formData.password;
            }
            await userService.update(editingUser.id, payload);
            toast.success(`Data pengguna "${formData.name}" berhasil diperbarui di database!`);
            setIsEditModalOpen(false);
            setEditingUser(null);
            await fetchUsers();
        } catch (err) {
            toast.error(`Gagal memperbarui pengguna: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Delete User → API
    const handleDeleteUser = async (u) => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus pengguna "${u.name}" (${u.email})?`)) {
            try {
                await userService.delete(u.id);
                toast.success(`Pengguna "${u.name}" berhasil dihapus dari database.`);
                await fetchUsers();
            } catch (err) {
                toast.error(`Gagal menghapus pengguna: ${err.message}`);
            }
        }
    };

    // Helper display role label
    const getDisplayRole = (u) => {
        return u.roleLabel || u.role;
    };

    // Filter users
    const filteredUsers = usersList.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(u.id).toLowerCase().includes(searchTerm.toLowerCase());
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
            cyber_lead: 'bg-rose-100 text-rose-700 border-rose-200',
            pentester: 'bg-red-100 text-red-700 border-red-200',
            head_of_it: 'bg-orange-100 text-orange-700 border-orange-200',
            business_user: 'bg-sky-100 text-sky-700 border-sky-200',
            developer: 'bg-[#003a73]/10 text-[#003a73] border-blue-200',
        };
        return colors[roleKey] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#f8f9fb]">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-[#003a73] mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Memuat data pengguna...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Manajemen Pengguna</h1>
                    <p className="text-sm text-gray-500 mt-1">Kelola akses, peran (role), dan status aktif pengguna sistem NagariSDLC.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchUsers}
                        className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        onClick={handleOpenAddModal}
                        className="bg-[#003a73] text-white py-2.5 px-5 rounded-xl font-semibold flex items-center gap-2 hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer"
                    >
                        <UserPlus size={18} />
                        Tambah Pengguna Baru
                    </button>
                </div>
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
                                        {usersList.length === 0
                                            ? 'Belum ada pengguna terdaftar di database.'
                                            : 'Tidak ada data pengguna yang sesuai dengan pencarian/filter.'
                                        }
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
                                                    <div className="text-xs text-gray-400 font-mono">ID: {u.id}</div>
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
                                <label className="block text-xs font-bold text-gray-700 mb-1">Password Baru (kosongkan jika tidak diubah)</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Minimal 8 karakter..."
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Departemen / Divisi</label>
                                <select
                                    value={formData.division_id}
                                    onChange={(e) => setFormData({ ...formData, division_id: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer"
                                >
                                    <option value="">-- Tidak ada divisi --</option>
                                    {masterDivisions.map((dept) => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Role / Peran Pengguna</label>
                                <select
                                    value={formData.role_id}
                                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer text-[#003a73]"
                                >
                                    {masterRoles.map((r) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">No. Handphone</label>
                                <input
                                    type="tel"
                                    value={formData.phone_number}
                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    placeholder="08xxxxxxxxxx"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Status Pengguna</label>
                                <select
                                    value={formData.is_active ? 'active' : 'inactive'}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
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
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 rounded-xl bg-[#003a73] text-white text-xs font-bold hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {isSaving && <Loader2 size={14} className="animate-spin" />}
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
                                <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Minimal 8 karakter"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Departemen / Divisi</label>
                                <select
                                    value={formData.division_id}
                                    onChange={(e) => setFormData({ ...formData, division_id: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer"
                                >
                                    <option value="">-- Tidak ada divisi --</option>
                                    {masterDivisions.map((dept) => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Role / Peran Pengguna</label>
                                <select
                                    value={formData.role_id}
                                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none bg-white cursor-pointer text-[#003a73]"
                                >
                                    {masterRoles.map((r) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">No. Handphone (opsional)</label>
                                <input
                                    type="tel"
                                    value={formData.phone_number}
                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    placeholder="08xxxxxxxxxx"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                />
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
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 rounded-xl bg-[#003a73] text-white text-xs font-bold hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {isSaving && <Loader2 size={14} className="animate-spin" />}
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