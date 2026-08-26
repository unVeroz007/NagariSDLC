import { useState } from 'react';
import { useMasterData } from '../../contexts/MasterDataContext';
import {
    Network,
    Plus,
    Search,
    Edit,
    Trash2,
    X,
    Users,
    Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Manajemen Grup Kerja (Super Admin).
 *
 * Grup adalah pengelompokan ROLE, sementara divisi adalah unit tempat PENGGUNA berada.
 * Keduanya tidak saling menggantikan: satu grup kerja bisa berisi role dari beberapa
 * divisi, dan satu divisi bisa memiliki pegawai dari beberapa grup.
 *
 * Yang penting dipahami sebelum memindahkan role antar grup: grup TIDAK menentukan hak
 * apa pun. Hak persetujuan, hak mengubah status proyek, dan cakupan proyek yang terlihat
 * semuanya ditentukan kode role di backend (`ProjectWorkflowService`,
 * `ProjectAccessService`). Memindahkan role ke grup lain hanya mengubah pengelompokan
 * dan tampilan.
 */
export default function GroupsManagement() {
    const { groups, addGroup, editGroup, deleteGroup } = useMasterData();
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
    });

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.code && g.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        g.roles.some(r => (r.display_name || r.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleOpenAdd = () => {
        setFormData({ code: '', name: '', description: '' });
        setIsAddModalOpen(true);
    };

    const handleOpenEdit = (g) => {
        setEditingGroup(g);
        setFormData({ code: g.code, name: g.name, description: g.description || '' });
        setIsEditModalOpen(true);
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Nama grup wajib diisi!');
            return;
        }
        if (!formData.code.trim()) {
            toast.error('Kode grup wajib diisi!');
            return;
        }
        const ok = await addGroup(formData);
        if (ok) {
            setIsAddModalOpen(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Nama grup wajib diisi!');
            return;
        }
        const ok = await editGroup(editingGroup.id, formData);
        if (ok) {
            setIsEditModalOpen(false);
            setEditingGroup(null);
        }
    };

    const handleDelete = (g) => {
        // Penghalang sesungguhnya ada di backend, yang menolak penghapusan grup berisi
        // role. Pemeriksaan di sini hanya supaya penjelasannya muncul tanpa perjalanan
        // ke server.
        if (g.rolesCount > 0) {
            toast.error(
                `Grup "${g.name}" masih memiliki ${g.rolesCount} role. Pindahkan role tersebut ke grup lain lebih dulu di halaman Manajemen Role.`
            );
            return;
        }
        if (window.confirm(`Apakah Anda yakin ingin menghapus grup "${g.name}" (${g.code})?`)) {
            deleteGroup(g.id);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Network size={26} className="text-[#003a73]" /> Manajemen Grup Kerja
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Kelompokkan peran (roles) ke dalam grup kerja sesuai pembagian fungsi di Divisi Teknologi Informasi.
                    </p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-[#003a73] text-white py-2.5 px-5 rounded-xl font-semibold flex items-center gap-2 hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer"
                >
                    <Plus size={18} />
                    Tambah Grup Baru
                </button>
            </div>

            {/* Catatan batas wewenang. Penting supaya grup tidak dianggap gerbang otorisasi. */}
            <div className="mb-6 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 leading-relaxed">
                    Grup kerja mengelompokkan <span className="font-bold">peran</span>, sedangkan divisi adalah unit tempat{' '}
                    <span className="font-bold">pengguna</span> berada. Memindahkan peran antar grup mengubah pengelompokan
                    dan tampilan, <span className="font-bold">bukan</span> hak persetujuan maupun hak mengubah status proyek —
                    hak tersebut tetap ditentukan oleh kode peran.
                </p>
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
                            placeholder="Cari nama, kode, atau peran di dalam grup..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:border-[#00529C] focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="text-xs font-semibold text-gray-500 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        Total {groups.length} Grup Terdaftar
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                                <th className="py-4 px-6">Kode Grup</th>
                                <th className="py-4 px-6">Nama Grup</th>
                                <th className="py-4 px-6">Peran di Dalamnya</th>
                                <th className="py-4 px-6 text-center">Pengguna</th>
                                <th className="py-4 px-6">Deskripsi</th>
                                <th className="py-4 px-6 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredGroups.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        Tidak ada grup yang ditemukan.
                                    </td>
                                </tr>
                            ) : (
                                filteredGroups.map((g) => (
                                    <tr key={g.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="py-4 px-6">
                                            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-100">
                                                {g.code}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                            {g.name}
                                        </td>
                                        <td className="py-4 px-6">
                                            {g.roles.length === 0 ? (
                                                <span className="text-xs text-gray-400">Belum ada peran</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5 max-w-sm">
                                                    {g.roles.map(r => (
                                                        <span
                                                            key={r.id}
                                                            className="text-[11px] font-medium text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded"
                                                            title={r.name}
                                                        >
                                                            {r.display_name || r.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700">
                                                <Users size={13} className="text-gray-400" />
                                                {g.usersCount}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-gray-600 text-xs max-w-xs">
                                            {g.description || '-'}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(g)}
                                                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Edit Grup"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(g)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        g.rolesCount > 0
                                                            ? 'text-gray-300 cursor-not-allowed'
                                                            : 'text-red-600 hover:text-red-800 hover:bg-red-50 cursor-pointer'
                                                    }`}
                                                    title={g.rolesCount > 0 ? 'Pindahkan peran di dalam grup ini lebih dulu' : 'Hapus Grup'}
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
            </div>

            {/* MODAL TAMBAH GRUP */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <Network size={18} className="text-[#003a73]" /> Tambah Grup Kerja
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
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Grup</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Contoh: Grup Perencanaan dan Quality Assurance"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Kode Grup (Unik)</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '-') })}
                                    placeholder="Contoh: PERENCANAAN-QA"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                    Huruf besar, angka, dan tanda hubung. Kode inilah yang dipakai mencocokkan grup antar lingkungan.
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Deskripsi Fungsi</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Penjelasan fungsi dan kewajiban grup ini..."
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
                                    Tambah Grup
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EDIT GRUP */}
            {isEditModalOpen && editingGroup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <Edit size={18} className="text-[#003a73]" /> Edit Grup Kerja
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
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Grup</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Kode Grup</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '-') })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Deskripsi Fungsi</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                />
                            </div>

                            {/* Anggota grup diubah dari halaman Manajemen Role, karena yang disimpan
                                adalah `roles.group_id` — bukan daftar anggota pada grup. */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5">
                                <p className="text-[11px] font-bold text-gray-600 mb-1">
                                    Peran di dalam grup ini ({editingGroup.rolesCount})
                                </p>
                                {editingGroup.roles.length === 0 ? (
                                    <p className="text-[11px] text-gray-500">Belum ada peran.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {editingGroup.roles.map(r => (
                                            <span key={r.id} className="text-[11px] font-medium text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded">
                                                {r.display_name || r.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-[11px] text-gray-500 mt-1.5">
                                    Penempatan peran diatur di halaman Manajemen Role.
                                </p>
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
