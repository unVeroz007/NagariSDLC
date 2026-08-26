import { useState } from 'react';
import { useMasterData } from '../../contexts/MasterDataContext';
import {
    Building,
    Plus,
    Search,
    Edit,
    Trash2,
    X,
    Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DivisionsManagement() {
    const { divisions, addDivision, editDivision, deleteDivision } = useMasterData();
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingDiv, setEditingDiv] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
    });

    // Filter Divisions
    const filteredDivisions = divisions.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.code && d.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        String(d.id).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenAdd = () => {
        setFormData({ name: '', code: '', description: '' });
        setIsAddModalOpen(true);
    };

    const handleOpenEdit = (d) => {
        setEditingDiv(d);
        setFormData({
            name: d.name,
            code: d.code,
            description: d.description || '',
        });
        setIsEditModalOpen(true);
    };

    const handleAddSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Nama divisi wajib diisi!');
            return;
        }
        addDivision(formData);
        setIsAddModalOpen(false);
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Nama divisi wajib diisi!');
            return;
        }
        editDivision(editingDiv.id, formData);
        setIsEditModalOpen(false);
        setEditingDiv(null);
    };

    const handleDelete = (d) => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus divisi "${d.name}" (${d.code})?`)) {
            deleteDivision(d.id);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Building size={26} className="text-[#003a73]" /> Manajemen Divisi
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Kelola data master divisi dan unit kerja di Bank Nagari secara dinamis.</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-[#003a73] text-white py-2.5 px-5 rounded-xl font-semibold flex items-center gap-2 hover:bg-[#002a5a] transition-all shadow-md shadow-[#003a73]/20 cursor-pointer"
                >
                    <Plus size={18} />
                    Tambah Divisi Baru
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
                            placeholder="Cari nama, kode, atau ID divisi..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:border-[#00529C] focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="text-xs font-semibold text-gray-500 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                        Total {divisions.length} Divisi Terdaftar
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                                <th className="py-4 px-6">ID & Kode Divisi</th>
                                <th className="py-4 px-6">Nama Divisi</th>
                                <th className="py-4 px-6">Deskripsi Unit Kerja</th>
                                <th className="py-4 px-6">Tanggal Dibuat</th>
                                <th className="py-4 px-6 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredDivisions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">
                                        Tidak ada divisi yang ditemukan.
                                    </td>
                                </tr>
                            ) : (
                                filteredDivisions.map((d) => (
                                    <tr key={d.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                                                    {d.code}
                                                </span>
                                                <span className="text-xs text-gray-400 font-mono">{d.id}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                            {d.name}
                                        </td>
                                        <td className="py-4 px-6 text-gray-600 text-xs max-w-md">
                                            {d.description || '-'}
                                        </td>
                                        <td className="py-4 px-6 text-xs text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={13} className="text-gray-400" />
                                                <span>{d.createdAt || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(d)}
                                                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Edit Divisi"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(d)}
                                                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Hapus Divisi"
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

            {/* MODAL TAMBAH DIVISI */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <Building size={18} className="text-[#003a73]" /> Tambah Divisi Baru
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
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Divisi / Unit Kerja</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Contoh: Divisi Digital Banking"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Kode Divisi</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="Contoh: DIV-DB"
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Deskripsi Divisi</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Penjelasan fungsi dan tanggung jawab divisi..."
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
                                    Tambah Divisi
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EDIT DIVISI */}
            {isEditModalOpen && editingDiv && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <Edit size={18} className="text-[#003a73]" /> Edit Data Divisi
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
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Divisi / Unit Kerja</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Kode Divisi</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-100 focus:border-[#003a73] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Deskripsi Divisi</label>
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
