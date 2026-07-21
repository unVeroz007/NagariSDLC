import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Info,
    CloudUpload,
    Upload,
    CheckCircle,
    Trash2,
    Send,
    Save,
    HelpCircle,
    ChevronRight,
} from 'lucide-react';
import { mockProjects, dispositionQueue } from '../../data/mockData';

export default function ProjectNew() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    // Form state
    const [formData, setFormData] = useState({
        projectName: '',
        division: '',
        priority: 'Medium',
        targetDate: '',
        description: '',
    });

    const [uploadedFiles, setUploadedFiles] = useState([
        { name: 'BRD_Aplikasi_Kredit.pdf', size: '2.4 MB', type: 'pdf', status: 'success' },
        { name: 'FSD_Draft_v1.docx', size: '1.8 MB', type: 'docx', status: 'success' },
        { name: 'Flowchart_Sistem.pdf', size: '4.1 MB', type: 'pdf', status: 'success' },
    ]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Handle input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Handle file upload (simulasi)
    const handleFileUpload = (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            const newFiles = Array.from(files).map((file) => ({
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
                type: file.name.split('.').pop().toLowerCase(),
                status: 'success',
            }));
            setUploadedFiles((prev) => [...prev, ...newFiles]);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle delete file
    const handleDeleteFile = (index) => {
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Handle drag & drop (simulasi)
    const handleDrop = (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const newFiles = Array.from(files).map((file) => ({
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
                type: file.name.split('.').pop().toLowerCase(),
                status: 'success',
            }));
            setUploadedFiles((prev) => [...prev, ...newFiles]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Handle submit
    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Validasi sederhana
        if (!formData.projectName.trim()) {
            alert('Nama proyek wajib diisi!');
            setIsSubmitting(false);
            return;
        }

        // Simulasi submit ke backend
        setTimeout(() => {
            // Generate ID proyek baru
            const lastId = mockProjects.length > 0
                ? parseInt(mockProjects[mockProjects.length - 1].id.split('-')[2])
                : 0;
            const newId = `PRJ-2026-${String(lastId + 1).padStart(3, '0')}`;

            // Tambahkan ke mockProjects
            const newProject = {
                id: newId,
                name: formData.projectName,
                description: formData.description || 'Proyek baru dari ' + user?.name,
                division: formData.division || 'Divisi TI',
                pm: null,
                phase: 'Fase 1: Inisiasi',
                status: 'Inisiasi (Baru)',
                statusColor: 'bg-gray-100 text-gray-600 border-gray-200',
                targetDate: formData.targetDate || 'TBD',
            };
            mockProjects.push(newProject);

            // Tambahkan juga ke dispositionQueue agar muncul di halaman Workspace Lead
            const newDisposition = {
                id: newId,
                name: formData.projectName,
                division: formData.division || 'Divisi TI',
                priority: formData.priority === 'Urgent' ? 'High' : formData.priority,
                submittedAt: new Date().toISOString(),
                budget: 'Menunggu Estimasi',
                targetDate: formData.targetDate || 'TBD',
                status: 'Menunggu Analis',
                documents: uploadedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
                assignedAnalyst: null,
            };
            dispositionQueue.unshift(newDisposition); // Gunakan unshift agar muncul di urutan teratas

            setIsSubmitting(false);
            alert(`Proyek ${newId} berhasil diajukan!`);
            navigate('/track');
        }, 1000);
    };

    // Get file icon based on type
    const getFileIcon = (type) => {
        const icons = {
            pdf: 'bg-red-100 text-red-600',
            docx: 'bg-blue-100 text-blue-600',
            xlsx: 'bg-green-100 text-green-600',
            pptx: 'bg-orange-100 text-orange-600',
            zip: 'bg-purple-100 text-purple-600',
        };
        return icons[type] || 'bg-gray-100 text-gray-600';
    };

    const getFileLabel = (type) => {
        const labels = {
            pdf: 'PDF',
            docx: 'DOCX',
            xlsx: 'XLSX',
            pptx: 'PPTX',
            zip: 'ZIP',
        };
        return labels[type] || type.toUpperCase();
    };

    const divisions = [
        'Divisi Kredit',
        'Divisi Dana & Jasa',
        'Divisi TI',
        'Divisi Operasional',
        'Divisi Kepatuhan',
        'Divisi Manajemen Risiko',
        'Divisi SDM',
        'Divisi Digital Banking',
        'Divisi Perencanaan & Strategi',
        'Divisi Audit Internal',
        'Divisi Treasury & International',
    ];

    const priorities = ['Rendah', 'Medium', 'Urgent'];

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative bg-[#f8f9fb]">
            {/* Background effect */}
            <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none -z-10 transform translate-x-1/3 -translate-y-1/4"></div>

            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
                        Form Inisiasi Proyek Baru
                    </h2>
                    <p className="text-gray-500 mt-1 text-sm">
                        Lengkapi detail proyek di bawah ini untuk memulai alur SDLC di Bank Nagari.
                    </p>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    {/* Section 0: Informasi Pengusul (PIC) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center">
                                <User size={22} />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800">Informasi Pengusul (PIC)</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600">Nama Lengkap PIC</label>
                                <input
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                                    disabled
                                    type="text"
                                    value={user?.name || 'Ahmad Fauzi'}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600">Unit Kerja / Divisi</label>
                                <select
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all text-sm appearance-none"
                                    value={formData.division || user?.department || 'Lead Group / IT Strategy'}
                                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                                >
                                    <option value="Lead Group / IT Strategy">Lead Group / IT Strategy</option>
                                    {divisions.map((div) => (
                                        <option key={div} value={div}>{div}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-semibold text-gray-600">Email</label>
                                <input
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                                    disabled
                                    type="email"
                                    value={user?.email || 'ahmad.fauzi@banknagari.co.id'}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Informasi Dasar */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center">
                                <Info size={22} />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800">Informasi Dasar</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-semibold text-gray-600 flex items-center gap-1">
                                    Nama Proyek <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="projectName"
                                    value={formData.projectName}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all text-sm"
                                    placeholder="Contoh: Digital Loan Enhancement Phase II"
                                    type="text"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600">Unit Kerja / Divisi Inisiator</label>
                                <select
                                    name="division"
                                    value={formData.division}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all text-sm appearance-none"
                                >
                                    <option value="">Pilih Divisi</option>
                                    {divisions.map((div) => (
                                        <option key={div} value={div}>{div}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600">Prioritas Proyek</label>
                                <div className="flex gap-2">
                                    {priorities.map((p) => (
                                        <label key={p} className="flex-1 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="priority"
                                                value={p}
                                                checked={formData.priority === p}
                                                onChange={handleChange}
                                                className="sr-only peer"
                                            />
                                            <div className={`text-center py-2.5 rounded-lg border transition-all text-xs font-bold ${formData.priority === p
                                                ? p === 'Urgent'
                                                    ? 'bg-red-600 text-white border-red-600'
                                                    : p === 'Medium'
                                                        ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                                                        : 'bg-gray-200 text-gray-700 border-gray-300'
                                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}>
                                                {p}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600">Target Selesai (Estimasi)</label>
                                <input
                                    name="targetDate"
                                    value={formData.targetDate}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all text-sm"
                                    type="date"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600">Tanggal Pengajuan</label>
                                <input
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                                    disabled
                                    type="text"
                                    value={new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-semibold text-gray-600">Deskripsi Ringkas Proyek</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all text-sm"
                                    placeholder="Jelaskan latar belakang dan tujuan utama proyek ini..."
                                    rows={4}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Unggah Dokumen */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center">
                                <CloudUpload size={22} />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800">Unggah Dokumen Proyek</h3>
                        </div>

                        {/* Dropzone */}
                        <div
                            className="border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50/50 transition-colors group"
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                        >
                            <div className="w-16 h-16 rounded-full bg-[#1A56DB] flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                                <Upload size={28} />
                            </div>
                            <p className="text-lg font-semibold text-gray-800">
                                Tarik file ke sini atau <span className="text-[#1A56DB] font-bold">Cari File</span>
                            </p>
                            <p className="text-gray-500 text-xs mt-2">
                                Dukungan: PDF, DOCX, XLSX (Maks. 5MB per file)
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.docx,.xlsx,.pptx,.zip"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>

                        {/* File List */}
                        {uploadedFiles.length > 0 && (
                            <div className="mt-8 space-y-3">
                                {uploadedFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded flex items-center justify-center font-bold text-[10px] ${getFileIcon(file.type)}`}>
                                                {getFileLabel(file.type)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">{file.name}</p>
                                                <p className="text-[10px] text-gray-500">{file.size} • Upload Berhasil</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <CheckCircle size={18} className="text-emerald-600" />
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteFile(index)}
                                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-4 py-8">
                        <button
                            type="button"
                            className="w-full sm:w-auto px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm active:scale-95 flex items-center gap-2"
                        >
                            <Save size={18} />
                            Simpan sebagai Draft
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-8 py-3.5 bg-[#003a73] text-white font-bold rounded-xl hover:bg-[#002a5a] transition-all text-sm flex items-center justify-center gap-3 shadow-lg shadow-blue-900/25 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <span>{isSubmitting ? 'Memproses...' : 'Ajukan Proyek'}</span>
                            <Send size={18} />
                        </button>
                    </div>
                </form>

                {/* Footer */}
                <footer className="mt-8 pt-8 border-t border-gray-200">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-gray-500">© 2026 Bank Nagari SDLC Dashboard v2.4.0 • Enterprise Edition</p>
                        <div className="flex gap-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <a href="#" className="hover:text-[#1A56DB]">Syarat &amp; Ketentuan</a>
                            <a href="#" className="hover:text-[#1A56DB]">Kebijakan Keamanan</a>
                            <a href="#" className="hover:text-[#1A56DB]">Pusat Bantuan</a>
                        </div>
                    </div>
                </footer>
            </div>

            {/* Floating Help Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <button className="w-14 h-14 bg-[#D4A017] text-white rounded-full shadow-2xl flex items-center justify-center hover:rotate-12 transition-all group overflow-hidden">
                    <HelpCircle size={28} className="group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    );
}