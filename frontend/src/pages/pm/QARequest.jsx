import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
    FileText,
    FolderOpen,
    Upload,
    CloudUpload,
    Calendar,
    Link as LinkIcon,
    Send,
    X,
    CheckCircle,
    ChevronRight,
    Bell,
    Search,
    LayoutGrid,
    Download,
    LogOut,
    User,
    Briefcase,
    Clock,
    FileCheck,
    AlertCircle,
} from 'lucide-react';
import { useProjects } from '../../contexts/ProjectContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

export default function QARequest() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { projects, updateProject, isLoading } = useProjects();
    const [formData, setFormData] = useState({
        projectId: '',
        targetDate: '',
        stagingUrl: '',
        technicalNotes: '',
    });
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Daftar proyek yang siap QA (status sudah selesai development)
    const readyProjects = projects.filter(
        (p) => p.status === 'Development' || p.status === 'Ready for QA'
    );

    // Handle form change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Handle file upload
    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        const newFiles = files.map((file) => ({
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
            type: file.type,
        }));
        setUploadedFiles((prev) => [...prev, ...newFiles]);
        if (e.target) e.target.value = '';
    };

    // Handle drag & drop
    const handleDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const newFiles = files.map((file) => ({
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
            type: file.type,
        }));
        setUploadedFiles((prev) => [...prev, ...newFiles]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Handle remove file
    const handleRemoveFile = (index) => {
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Handle submit
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.projectId) {
            alert('Pilih proyek terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            addNotification(
                'Pengajuan QA Siap',
                `Proyek ${formData.projectId} siap untuk pengujian QA.`,
                'info',
                '/workspace/qa'
            );
            alert(`Pengajuan QA untuk proyek ${formData.projectId} berhasil dikirim!`);
            navigate('/pm/qa-request');
            setIsSubmitting(false);
            // Reset form
            setFormData({ projectId: '', targetDate: '', stagingUrl: '', technicalNotes: '' });
            setUploadedFiles([]);
        }, 1500);
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-1">
                        Form Pengajuan Quality Assurance (QA)
                    </h2>
                    <p className="text-gray-500 text-sm">
                        Lengkapi detail di bawah untuk menyerahkan proyek ke tahap pengujian (SIT &amp; UIT).
                    </p>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    {/* 1. Detail Pengajuan */}
                    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200 pb-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center">
                                <FileText size={18} />
                            </div>
                            1. Detail Pengajuan
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">
                                    No. Tiket QA (Auto-generated)
                                </label>
                                <div className="px-4 py-2.5 bg-blue-50/50 border border-blue-200 rounded-lg font-mono text-[#1A56DB] font-semibold">
                                    QA-REQ-2026-0842
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">
                                    Pilih Proyek Selesai <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="projectId"
                                    value={formData.projectId}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB]"
                                    required
                                >
                                    <option value="">Pilih proyek...</option>
                                    {readyProjects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.type === 'RBB' ? '🔴 [RBB] ' : ''}{project.name} ({project.id})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">
                                    Project Manager
                                </label>
                                <input
                                    type="text"
                                    value={user?.name || 'Budi Santoso'}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">
                                    Target Selesai QA <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Calendar
                                        size={18}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    />
                                    <input
                                        type="date"
                                        name="targetDate"
                                        value={formData.targetDate}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB]"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. Brankas Dokumen Proyek */}
                    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200 pb-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center">
                                <FolderOpen size={18} />
                            </div>
                            2. Brankas Dokumen Proyek
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Dokumen pendukung dari tahap inisiasi dan desain telah ditarik secara otomatis.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            {/* BRD */}
                            <div className="border border-gray-200 rounded-lg p-4 flex items-start gap-3 bg-gray-50">
                                <CheckCircle size={20} className="text-emerald-500 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-gray-800 text-sm">BRD Final</h4>
                                    <p className="text-xs text-gray-500 mt-1">v2.1 • 2.4 MB</p>
                                    <a href="#" className="text-xs text-[#1A56DB] hover:underline mt-2 inline-block">
                                        Lihat Dokumen
                                    </a>
                                </div>
                            </div>
                            {/* FSD */}
                            <div className="border border-gray-200 rounded-lg p-4 flex items-start gap-3 bg-gray-50">
                                <CheckCircle size={20} className="text-emerald-500 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-gray-800 text-sm">FSD &amp; Technical Spec</h4>
                                    <p className="text-xs text-gray-500 mt-1">v1.0 • 4.1 MB</p>
                                    <a href="#" className="text-xs text-[#1A56DB] hover:underline mt-2 inline-block">
                                        Lihat Dokumen
                                    </a>
                                </div>
                            </div>
                            {/* Upload Hasil Unit Test */}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:border-[#1A56DB] transition-colors cursor-pointer group">
                                <Upload
                                    size={28}
                                    className="text-gray-400 group-hover:text-[#1A56DB] mb-2 transition-colors"
                                />
                                <h4 className="text-sm font-semibold text-gray-700 group-hover:text-[#1A56DB]">
                                    Hasil Unit Test <span className="text-red-500">*</span>
                                </h4>
                                <p className="text-xs text-gray-400 mt-1">PDF/Zip (Max 10MB)</p>
                                <input
                                    type="file"
                                    accept=".pdf,.zip,.rar"
                                    className="hidden"
                                    id="unit-test-upload"
                                    onChange={handleFileUpload}
                                />
                                <label
                                    htmlFor="unit-test-upload"
                                    className="mt-2 px-3 py-1 text-xs font-medium text-[#1A56DB] border border-[#1A56DB] rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                                >
                                    Pilih File
                                </label>
                            </div>
                        </div>

                        {/* Dropzone */}
                        <div
                            className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer"
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onClick={() => document.getElementById('additional-upload')?.click()}
                        >
                            <CloudUpload size={32} className="text-gray-400 mb-3" />
                            <h4 className="font-semibold text-gray-700 mb-1">Tarik &amp; Lepas Dokumen Tambahan</h4>
                            <p className="text-sm text-gray-500">atau klik untuk memilih file dari komputer Anda</p>
                            <input
                                type="file"
                                multiple
                                className="hidden"
                                id="additional-upload"
                                onChange={handleFileUpload}
                            />
                        </div>

                        {/* Uploaded Files List */}
                        {uploadedFiles.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <h4 className="text-sm font-semibold text-gray-700">File Terupload:</h4>
                                {uploadedFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileCheck size={18} className="text-emerald-500" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{file.name}</p>
                                                <p className="text-xs text-gray-500">{file.size}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(idx)}
                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 3. Lingkungan & Akses Testing */}
                    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200 pb-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center">
                                <LinkIcon size={18} />
                            </div>
                            3. Lingkungan &amp; Akses Testing
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">
                                    URL Staging / Testing Environment
                                </label>
                                <div className="relative">
                                    <LinkIcon
                                        size={18}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    />
                                    <input
                                        type="url"
                                        name="stagingUrl"
                                        value={formData.stagingUrl}
                                        onChange={handleChange}
                                        placeholder="https://staging.banknagari.co.id/los-v2"
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">
                                    Catatan Teknis untuk Tim QA
                                </label>
                                <textarea
                                    name="technicalNotes"
                                    value={formData.technicalNotes}
                                    onChange={handleChange}
                                    rows={4}
                                    placeholder="Mohon perhatikan khusus pada modul kalkulasi bunga anuitas dan integrasi API dengan sistem OJK SLIK..."
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] resize-y"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-4 pt-4">
                        <button
                            type="button"
                            className="px-6 py-2.5 border border-gray-300 bg-white rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-[#003a73] text-white rounded-lg font-semibold flex items-center gap-2 hover:bg-[#002a5a] shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Send size={18} />
                            {isSubmitting ? 'Memproses...' : 'Kirim ke Antrean QA'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}