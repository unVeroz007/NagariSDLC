import { useState } from 'react';
import { useMasterData } from '../../contexts/MasterDataContext';
import {
    Shield,
    Plus,
    Search,
    Edit,
    Trash2,
    X,
    Lock,
    Key,
    Calendar,
    FileText,
    CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RolesManagement() {
    const { roles, addRole, editRole, deleteRole } = useMasterData();
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        menuAccess: '',
    });

    // Filter Roles
    const filteredRoles = roles.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        String(r.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.menuAccess && r.menuAccess.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleOpenAdd = () => {
        setFormData({ name: '', code: '', description: '', menuAccess: '' });
        setIsAddModalOpen(true);
    };

    const handleOpenEdit = (r) => {
        setEditingRole(r);
        setFormData({
            name: r.name,
            code: r.code,
            description: r.description || '',
            menuAccess: r.menuAccess || '',
        });
        setIsEditModalOpen(true);
    };

    const handleAddSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Nama role wajib diisi!');
            return;
        }
        addRole(formData);
        setIsAddModalOpen(false);
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Nama role wajib diisi!');
            return;
        }
        editRole(editingRole.id, formData);
        setIsEditModalOpen(false);
        setEditingRole(null);
    };

    const handleDelete = (r) => {
        if (r.code === 'super_admin') {
            toast.error('Role "Super Admin" adalah role sistem utama dan TIDAK BISA dihapus!');
            return;
        }
        if (window.confirm(`Apakah Anda yakin ingin menghapus role "${r.name}" (${r.code})?`)) {
            deleteRole(r.id);
        }
    };

    const getRoleBadgeColor = (code) => {
        if (code === 'super_admin') return 'bg-purple-100 text-purple-700 border-purple-200';
        if (code === 'lead_group') return 'bg-amber-100 text-amber-700 border-amber-200';
        if (code === 'analyst') return 'bg-cyan-100 text-cyan-700 border-cyan-200';
        if (code === 'development_lead') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (code === 'project_manager') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        if (code === 'qa_lead') return 'bg-teal-100 text-teal-700 border-teal-200';
        if (code === 'qa_tester') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (code === 'cyber_team') return 'bg-rose-100 text-rose-700 border-rose-200';
        if (code === 'pentester') return 'bg-red-100 text-red-700 border-red-200';
        if (code === 'head_of_it') return 'bg-orange-100 text-orange-700 border-orange-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Shield size={26} className="text-[#003a73]" /> Manajemen Peran (Roles)
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Kelola data master hak akses, peran (roles), dan otorisasi menu SDLC Bank Nagari.</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-[#003a73] text-white py-2.5 px-5 rounded-xl font-semibold flex items-center gap-2 hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer"
                >
                    <Plus size={18} />
                    Tambah Role Baru
                </button>
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
                            placeholder="Cari nama, kode, atau menu akses role..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="text-xs font-semibold text-gray-500 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                        Total {roles.length} Role Terdaftar
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                                <th className="py-4 px-6">ID & Kode Role</th>
                                <th className="py-4 px-6">Nama Role</th>
                                <th className="py-4 px-6">Hak Akses Menu</th>
                                <th className="py-4 px-6">Deskripsi & Wewenang</th>
                                <th className="py-4 px-6 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredRoles.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">
                                        Tidak ada role yang ditemukan.
                                    </td>
                                </tr>
                            ) : (
                                filteredRoles.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md border ${getRoleBadgeColor(r.code)}`}>
                                                    {r.code}
                                                </span>
                                                <span className="text-xs text-gray-400 font-mono">{r.id}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                            {r.name}
                                            {r.code === 'super_admin' && (
                                                <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold border border-purple-200">
                                                    SYSTEM LOCK
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                                                <Key size={12} className="text-gray-500" />
                                                {r.menuAccess || 'Modul Standar'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-gray-600 text-xs max-w-md">
                                            {r.description || '-'}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(r)}
                                                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Edit Role"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                {r.code !== 'super_admin' ? (
                                                    <button
                                                        onClick={() => handleDelete(r)}
                                                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Hapus Role"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                ) : (
                                                    <span className="p-2 text-gray-300 cursor-not-allowed" title="Role Super Admin Tidak Busa Dihapus">
                                                        <Lock size={18} />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL TAMBAH ROLE */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <Shield size={18} className="text-[#003a73]" /> Tambah Role Baru
                            </h3>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Role</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Contoh: Compliance Auditor"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Kode Role (Unik)</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                    placeholder="Contoh: compliance_auditor"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Hak Akses Menu Utama</label>
                                <input
                                    type="text"
                                    value={formData.menuAccess}
                                    onChange={(e) => setFormData({ ...formData, menuAccess: e.target.value })}
                                    placeholder="Contoh: Audit Trail, Quality Gate"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Deskripsi Wewenang</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Penjelasan wewenang dan cakupan peran..."
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
                                    className="flex-1 py-2.5 rounded-xl bg-[#003a73] text-white text-xs font-bold hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer"
                                >
                                    Tambah Role
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EDIT ROLE */}
            {isEditModalOpen && editingRole && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <Edit size={18} className="text-[#003a73]" /> Edit Data Role
                            </h3>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Role</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Kode Role</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    disabled={editingRole.code === 'super_admin'}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                    className={`w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold outline-none ${editingRole.code === 'super_admin' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-blue-100 focus:border-[#003a73]'}`}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Hak Akses Menu Utama</label>
                                <input
                                    type="text"
                                    value={formData.menuAccess}
                                    onChange={(e) => setFormData({ ...formData, menuAccess: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Deskripsi Wewenang</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                />
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
        </div>
    );
}
