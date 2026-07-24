import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    Shield,
    FolderOpen,
    FileText,
    Upload,
    CloudUpload,
    Link as LinkIcon,
    Send,
    X,
    CheckCircle,
    ChevronRight,
    Bell,
    Search,
    Settings,
    LogOut,
    User,
    Lock,
    AlertCircle,
    FileCheck,
    Eye,
} from 'lucide-react';

export default function CyberRequest() {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        projectId: '🔴 [RBB] Aplikasi Loan Origination System (LOS)',
        targetUrl: 'https://staging-los.banknagari.co.id',
        notes: '',
    });
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mock data untuk dokumen yang sudah terverifikasi
    const verifiedDocs = [
        { name: 'BRD & FSD Dokumen', phase: 'Fase 1', status: 'Locked & Verified', icon: 'FileText' },
        { name: 'QA_SignOff_Report_LOS.pdf', phase: 'Fase 3', size: '2.4 MB', date: '12 Mar 2026', status: 'QA Passed', icon: 'FileCheck' },
    ];

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

    const handleRemoveFile = (index) => {
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTimeout(() => {
            alert('Pengajuan Cyber Security berhasil dikirim ke antrean!');
            setIsSubmitting(false);
            setUploadedFiles([]);
        }, 1500);
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        Form Pengajuan Uji Keamanan Siber (Cyber Security)
                    </h1>
                    <p className="text-sm text-gray-500">
                        Serahkan proyek yang telah lolos kualifikasi QA untuk dilakukan penetration testing dan audit keamanan.
                    </p>
                </div>

                {/* Form Container */}
                <form className="space-y-6" onSubmit={handleSubmit}>
                    {/* Section 1: Otorisasi & Konteks */}
                    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 bg-gray-50/50">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#1A56DB]">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-800">Informasi Proyek &amp; Otorisasi</h2>
                                    <p className="text-sm text-gray-500">Detail tiket dan pengaju form ini.</p>
                                </div>
                                <div className="ml-auto">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 text-amber-800 font-mono text-sm font-semibold border border-amber-200">
                                        <FileText size={16} />
                                        CYB-REQ-2026-0312
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-2">Nama Proyek</label>
                                    <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 font-medium">
                                        Aplikasi Loan Origination System (LOS)
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-2">QA Lead / PIC Pengaju</label>
                                    <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3 text-gray-800 font-medium">
                                        <CheckCircle size={18} className="text-emerald-500" />
                                        {user?.name || 'Anita Rahman'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Document Vault */}
                    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#1A56DB]">
                                <FolderOpen size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800">Document Vault</h2>
                                <p className="text-sm text-gray-500">Dokumen kumulatif dari fase sebelumnya yang dilampirkan otomatis.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {verifiedDocs.map((doc, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-2 opacity-50">
                                        {doc.icon === 'FileText' ? <FileText size={40} className="text-gray-300" /> : <FileCheck size={40} className="text-gray-300" />}
                                    </div>
                                    <div className="flex items-center gap-2 mb-3 relative z-10">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded ${doc.phase === 'Fase 1' ? 'bg-gray-200 text-gray-600' : 'bg-blue-50 text-[#1A56DB]'
                                            }`}>
                                            {doc.phase}
                                        </span>
                                        <span className="text-xs font-medium text-gray-500">{doc.phase === 'Fase 1' ? 'Inisiasi' : 'QA Testing'}</span>
                                    </div>
                                    <h3 className="font-medium text-gray-800 mb-4 relative z-10">{doc.name}</h3>
                                    {doc.size && (
                                        <p className="text-xs text-gray-500 mb-4 relative z-10">{doc.size} • Diunggah {doc.date}</p>
                                    )}
                                    <div className={`mt-auto flex items-center gap-2 text-sm px-3 py-1.5 rounded-md w-fit border ${doc.status === 'Locked & Verified'
                                        ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                                        : 'text-blue-600 bg-blue-50 border-blue-200'
                                        }`}>
                                        {doc.status === 'Locked & Verified' ? <Lock size={16} /> : <CheckCircle size={16} />}
                                        <span className="font-medium">{doc.status}</span>
                                    </div>
                                </div>
                            ))}
                            {/* Dropzone */}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer group">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3 group-hover:bg-blue-50 group-hover:text-[#1A56DB] transition-colors">
                                    <Upload size={24} />
                                </div>
                                <h3 className="font-medium text-gray-700 text-sm mb-1">Unggah Topologi/Arsitektur</h3>
                                <p className="text-xs text-gray-400">Opsional (PDF, PNG max 5MB)</p>
                                <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    className="hidden"
                                    id="topology-upload"
                                    onChange={handleFileUpload}
                                />
                                <label
                                    htmlFor="topology-upload"
                                    className="mt-3 px-3 py-1 text-xs font-medium text-[#1A56DB] border border-[#1A56DB] rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                                >
                                    Pilih File
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Parameters */}
                    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">
                                    URL Target / IP Address <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <LinkIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.targetUrl}
                                        readOnly
                                        className="pl-10 block w-full rounded-lg border-gray-200 bg-gray-50 py-2.5 text-gray-600 font-medium focus:border-[#1A56DB] focus:ring-[#1A56DB] text-sm"
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-gray-400">Target environment harus berada di jaringan staging atau pre-production.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">
                                    Catatan Khusus untuk Tim Security
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Masukkan instruksi khusus, area fokus, atau pengecualian (exclude path) jika ada..."
                                    rows={4}
                                    className="block w-full rounded-lg border-gray-200 bg-white py-2.5 px-3 text-gray-700 focus:border-[#1A56DB] focus:ring-[#1A56DB] text-sm resize-none"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Uploaded Files */}
                    {uploadedFiles.length > 0 && (
                        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">File Terupload:</h4>
                            {uploadedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2">
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
                        </section>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-4 pt-4">
                        <button
                            type="button"
                            className="px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#1A56DB] text-white font-semibold text-sm hover:bg-[#1349c2] transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Shield size={18} />
                            {isSubmitting ? 'Memproses...' : 'Kirim ke Antrean Siber'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}