import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    Rocket,
    ChevronRight,
    Search,
    Bell,
    Settings,
    Settings2,
    ShieldCheck,
    CloudUpload,
    Activity,
    CheckCircle,
    Network,
    CheckSquare,
    Shield,
    Info,
    Save,
    Send,
    Calendar,
    Clock,
    AlertCircle,
    FileText,
    Upload,
    X,
} from 'lucide-react';
import { mockProjects } from '../../data/mockData';

export default function ReleaseRequest() {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        projectId: '',
        releaseDate: '',
        downtime: 'Tidak ada downtime (Zero Downtime)',
        releaseNotes: '',
        rollbackProcedure: '',
    });
    const [uploadedFile, setUploadedFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mock release ticket number
    const ticketNumber = 'REL-REQ-2026-0015';

    // Handle form change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Handle file upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile({
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
            });
        }
    };

    const handleRemoveFile = () => {
        setUploadedFile(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            setUploadedFile({
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
            });
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Handle submit
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.projectId) {
            alert('Pilih proyek terlebih dahulu!');
            return;
        }
        if (!formData.releaseDate) {
            alert('Tentukan jadwal rilis!');
            return;
        }
        if (!formData.releaseNotes.trim()) {
            alert('Masukkan release notes!');
            return;
        }
        if (!formData.rollbackProcedure.trim()) {
            alert('Masukkan prosedur rollback!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            alert(`Pengajuan rilis ${ticketNumber} berhasil dikirim ke Quality Gate!`);
            setIsSubmitting(false);
            // Reset form
            setFormData({
                projectId: '',
                releaseDate: '',
                downtime: 'Tidak ada downtime (Zero Downtime)',
                releaseNotes: '',
                rollbackProcedure: '',
            });
            setUploadedFile(null);
        }, 1500);
    };

    // Compliance documents (mock data)
    const complianceDocs = [
        { id: 'brd', icon: FileText, label: 'BRD', sub: 'Business Req. Doc', verified: true },
        { id: 'fsd', icon: Network, label: 'FSD & TSD', sub: 'System Design', verified: true },
        { id: 'qa', icon: CheckSquare, label: 'QA Sign-Off', sub: 'UAT Passed', verified: true },
        { id: 'cyber', icon: Shield, label: 'Pentest Report', sub: 'Cyber Security Cleared', verified: true },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        Form Pengajuan Rilis Produksi (Go-Live)
                    </h2>
                    <p className="text-sm text-gray-500">
                        Lengkapi parameter deployment. Tiket ini memerlukan verifikasi Quality Gate (QA &amp; Cyber Security) sebelum rilis ke Production.
                    </p>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    {/* SECTION 1: Parameter Deployment */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center">
                            <Settings2 size={20} className="text-[#1A56DB] mr-2" />
                            <h3 className="font-semibold text-gray-800">Parameter Deployment</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">No. Tiket Rilis</label>
                                <input
                                    className="w-full px-4 py-2 bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold rounded-lg text-sm focus:ring-0 cursor-not-allowed"
                                    readOnly
                                    type="text"
                                    value={ticketNumber}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    Proyek / Aplikasi <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="projectId"
                                    value={formData.projectId}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white"
                                    required
                                >
                                    <option value="">Pilih proyek...</option>
                                    {mockProjects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name} ({project.id})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    Jadwal Rilis (Target) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    name="releaseDate"
                                    value={formData.releaseDate}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    Kebutuhan Downtime <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="downtime"
                                    value={formData.downtime}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white"
                                >
                                    <option>Ya, butuh downtime (Full)</option>
                                    <option>Ya, butuh downtime (Parsial)</option>
                                    <option selected>Tidak ada downtime (Zero Downtime)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: Compliance Passport */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
                            <div className="flex items-center">
                                <ShieldCheck size={20} className="text-[#1A56DB] mr-2" />
                                <h3 className="font-semibold text-gray-800">Compliance Passport</h3>
                            </div>
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md border border-emerald-200">
                                4/4 Validated
                            </span>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-500 mb-4">
                                Dokumen wajib berikut telah terverifikasi secara otomatis dari fase sebelumnya.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                {complianceDocs.map((doc) => {
                                    const Icon = doc.icon;
                                    return (
                                        <div
                                            key={doc.id}
                                            className="border border-emerald-300 bg-emerald-50/50 rounded-lg p-4 flex flex-col justify-between"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <Icon size={28} className="text-emerald-600" />
                                                <CheckCircle size={20} className="text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">{doc.label}</p>
                                                <p className="text-xs text-gray-500">{doc.sub}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Upload User Manual */}
                            <div
                                className={`border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer ${uploadedFile ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-300'
                                    }`}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={() => document.getElementById('user-manual-upload')?.click()}
                            >
                                {uploadedFile ? (
                                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm max-w-md mx-auto">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <FileText size={20} className="text-[#1A56DB]" />
                                            <div className="flex flex-col items-start min-w-0">
                                                <span className="font-medium text-sm text-gray-800 truncate max-w-full">
                                                    {uploadedFile.name}
                                                </span>
                                                <span className="text-xs text-gray-500">{uploadedFile.size}</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <CloudUpload size={32} className="text-gray-400 mx-auto mb-2" />
                                        <p className="text-sm font-semibold text-gray-700 mb-1">
                                            Unggah User Manual (Opsional)
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            Drag &amp; drop file PDF atau klik untuk mencari. Max 10MB.
                                        </p>
                                    </>
                                )}
                                <input
                                    type="file"
                                    id="user-manual-upload"
                                    className="hidden"
                                    accept=".pdf"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: Rencana Mitigasi */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center">
                            <Activity size={20} className="text-[#1A56DB] mr-2" />
                            <h3 className="font-semibold text-gray-800">Catatan Rilis &amp; Mitigasi</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    Release Notes <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    name="releaseNotes"
                                    value={formData.releaseNotes}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Deskripsikan fitur baru, perbaikan bug, atau perubahan konfigurasi..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white resize-none"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    Prosedur Rollback (Mitigasi) <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    name="rollbackProcedure"
                                    value={formData.rollbackProcedure}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Langkah-langkah detail jika deployment gagal dan perlu dikembalikan ke versi sebelumnya..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] bg-white resize-none"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1 flex items-center">
                                    <Info size={14} className="mr-1" />
                                    Wajib diisi sebagai syarat persetujuan IT Ops.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: Actions */}
                    <div className="flex items-center justify-end space-x-4 pt-4 pb-8">
                        <button
                            type="button"
                            className="px-6 py-2.5 border border-gray-300 text-gray-700 bg-white rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Save size={16} />
                            Simpan Draft
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-[#003a73] text-white rounded-lg text-sm font-semibold hover:bg-[#002a5a] transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Rocket size={18} />
                            {isSubmitting ? 'Memproses...' : 'Ajukan ke Quality Gate'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}