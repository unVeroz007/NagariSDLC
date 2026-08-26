import { useMemo, useState } from 'react';
import { useMasterData } from '../../contexts/MasterDataContext';
import { getMenuItemsForRole } from '../../data/menuConfig';
import {
    Shield,
    Plus,
    Search,
    Edit,
    Trash2,
    X,
    Lock,
    Key,
    Network,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RolesManagement() {
    const { roles, groups, addRole, editRole, deleteRole } = useMasterData();
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);

    // Form State
    //
    // `menuAccess` berisi daftar path menu yang dicentang. Kosong berarti TANPA
    // pembatasan — seluruh menu role tersebut tampil. Perlakuan itu sama dengan backend
    // (`Role::menuAccessPaths()`), supaya tidak ada role yang kehilangan seluruh menunya
    // hanya karena tidak ada yang dicentang.
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        groupId: '',
        menuAccess: [],
    });

    // Pilihan menu selalu berasal dari peta menu di kode (`menuSections`), bukan dari
    // daftar bebas. Pembatasan menu bersifat mengurangi: tidak ada cara memberi sebuah
    // role menu yang rutenya memang tidak terbuka untuknya.
    const availableMenuItems = useMemo(
        () => getMenuItemsForRole(formData.code),
        [formData.code]
    );

    const menuSectionGroups = useMemo(() => {
        const bySection = new Map();
        availableMenuItems.forEach(item => {
            if (! bySection.has(item.section)) {
                bySection.set(item.section, []);
            }
            bySection.get(item.section).push(item);
        });
        return Array.from(bySection, ([section, items]) => ({ section, items }));
    }, [availableMenuItems]);

    // Filter Roles
    const filteredRoles = roles.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        String(r.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.groupName && r.groupName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    /**
     * Ringkasan pembatasan menu sebuah role, apa adanya menurut basis data.
     *
     * Kolom ini sebelumnya menampilkan teks tetap "Modul Standar" untuk setiap role —
     * nilai yang tidak pernah dikirim ke server maupun dibaca kembali.
     */
    const describeMenuAccess = (role) => {
        const totalMenus = getMenuItemsForRole(role.code).length;
        const restricted = Array.isArray(role.menuAccess) ? role.menuAccess.length : 0;

        if (totalMenus === 0) {
            return { label: 'Belum ada peta menu', tone: 'bg-amber-50 text-amber-700 border-amber-200' };
        }
        if (restricted === 0) {
            return { label: `Semua menu (${totalMenus})`, tone: 'bg-gray-100 text-gray-700 border-gray-200' };
        }
        return {
            label: `${restricted} dari ${totalMenus} menu`,
            tone: 'bg-blue-50 text-blue-700 border-blue-200',
        };
    };

    const toggleMenuPath = (path) => {
        setFormData(prev => ({
            ...prev,
            menuAccess: prev.menuAccess.includes(path)
                ? prev.menuAccess.filter(p => p !== path)
                : [...prev.menuAccess, path],
        }));
    };

    const handleOpenAdd = () => {
        setFormData({ name: '', code: '', description: '', groupId: '', menuAccess: [] });
        setIsAddModalOpen(true);
    };

    const handleOpenEdit = (r) => {
        setEditingRole(r);
        setFormData({
            name: r.name,
            code: r.code,
            description: r.description || '',
            groupId: r.groupId ? String(r.groupId) : '',
            menuAccess: Array.isArray(r.menuAccess) ? [...r.menuAccess] : [],
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
        // Halaman Administrasi yang mengatur pembatasan menu berada di dalam menu itu
        // sendiri, jadi Super Admin yang membatasi dirinya tidak punya jalan kembali.
        // Backend menolaknya juga; penghalang di sini hanya agar pesannya muncul sebelum
        // permintaan dikirim.
        if (editingRole.code === 'super_admin' && formData.menuAccess.length > 0) {
            toast.error('Akses menu Super Admin tidak dapat dibatasi.');
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

    /**
     * Bagian formulir untuk penempatan grup dan pembatasan menu.
     *
     * Dipakai modal Tambah maupun Edit supaya keduanya tidak pernah menyimpang. Satu-satunya
     * perbedaan adalah Super Admin: aksesnya tidak boleh dibatasi karena halaman
     * Administrasi yang mengatur pembatasan itu sendiri berada di dalam menu.
     */
    const renderGroupAndMenuFields = ({ menuRestrictionLocked = false } = {}) => (
        <>
            <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Grup Kerja</label>
                <select
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium bg-white focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                >
                    <option value="">— Tanpa grup —</option>
                    {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    Grup mengelompokkan role untuk penataan personel dan tampilan. Hak persetujuan
                    serta hak mengubah status proyek tetap ditentukan kode role, bukan grupnya.
                </p>
            </div>

            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">Pembatasan Akses Menu</label>
                    {!menuRestrictionLocked && formData.menuAccess.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, menuAccess: [] })}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                            Bersihkan pilihan
                        </button>
                    )}
                </div>

                {menuRestrictionLocked ? (
                    <p className="text-[11px] text-gray-500 leading-relaxed bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                        Akses menu Super Admin tidak dapat dibatasi. Halaman Administrasi yang mengatur
                        pembatasan ini berada di dalam menu, sehingga membatasinya akan menutup satu-satunya
                        jalan untuk membatalkannya.
                    </p>
                ) : menuSectionGroups.length === 0 ? (
                    <p className="text-[11px] text-gray-500 leading-relaxed bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        Kode role <span className="font-mono font-bold">{formData.code || '—'}</span> belum
                        memiliki peta menu di aplikasi, jadi belum ada menu yang bisa dibatasi. Peta menu
                        ditentukan di kode (<span className="font-mono">data/menuConfig.js</span>); pembatasan
                        di sini hanya dapat mengurangi menu yang sudah ada.
                    </p>
                ) : (
                    <>
                        <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">
                            Tanpa centang sama sekali, seluruh {availableMenuItems.length} menu role ini tampil.
                            Bila ada yang dicentang, hanya menu tercentang yang tampil di sidebar.
                        </p>
                        <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                            {menuSectionGroups.map(({ section, items }) => (
                                <div key={section} className="p-2.5">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{section}</p>
                                    <div className="space-y-1">
                                        {items.map(item => (
                                            <label key={item.path} className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.menuAccess.includes(item.path)}
                                                    onChange={() => toggleMenuPath(item.path)}
                                                    className="mt-0.5 accent-[#003a73] cursor-pointer"
                                                />
                                                <span>
                                                    {item.label}
                                                    <span className="block text-[10px] text-gray-400 font-mono">{item.path}</span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1.5">
                            {formData.menuAccess.length === 0
                                ? 'Saat ini: tanpa pembatasan.'
                                : `Saat ini: ${formData.menuAccess.length} dari ${availableMenuItems.length} menu dipilih.`}
                        </p>
                    </>
                )}
            </div>
        </>
    );

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
                            placeholder="Cari nama, kode, atau grup kerja role..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:border-[#00529C] focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm"
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
                                <th className="py-4 px-6">Grup Kerja</th>
                                <th className="py-4 px-6">Hak Akses Menu</th>
                                <th className="py-4 px-6">Deskripsi & Wewenang</th>
                                <th className="py-4 px-6 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredRoles.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
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
                                            {r.groupName ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                                                    <Network size={12} className="text-indigo-500" />
                                                    {r.groupName}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">Tanpa grup</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            {(() => {
                                                const access = describeMenuAccess(r);
                                                return (
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border ${access.tone}`}>
                                                        <Key size={12} className="opacity-70" />
                                                        {access.label}
                                                    </span>
                                                );
                                            })()}
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
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100">
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
                            {renderGroupAndMenuFields()}
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
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100">
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
                            {renderGroupAndMenuFields({ menuRestrictionLocked: editingRole.code === 'super_admin' })}
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
