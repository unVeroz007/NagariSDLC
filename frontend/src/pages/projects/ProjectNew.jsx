import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { useProjects } from '../../contexts/ProjectContext';
import { divisionService } from '../../services/api';
import {
    User,
    Info,
    CloudUpload,
    Upload,
    CheckCircle,
    CheckCircle2,
    Trash2,
    Send,
    Save,
    HelpCircle,
    ChevronRight,
    AlertCircle,
    X,
    Eye,
    Download,
} from 'lucide-react';
import { mockProjects, dispositionQueue } from '../../data/mockData';

export default function ProjectNew() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { addProject } = useProjects();
    const fileInputRef = useRef(null);

    const defaultDivisions = [
        'Divisi Pengembangan TI',
        'Divisi Operasional & Infra TI',
        'Divisi Cyber Security',
        'Divisi Quality Assurance TI',
        'Divisi Strategi Perbankan Digital',
        'Divisi Kredit',
        'Divisi Dana & Jasa',
        'Divisi Kepatuhan',
        'Divisi Manajemen Risiko',
        'Divisi Audit Internal',
        'Divisi SDM',
    ];

    const [divisionList, setDivisionList] = useState(defaultDivisions);

    useEffect(() => {
        const fetchDivisions = async () => {
            try {
                const res = await divisionService.getAll();
                if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
                    const apiNames = res.data.map(d => d.name || d.code);
                    // Merge API divisions with default divisions cleanly
                    const merged = Array.from(new Set([...apiNames, ...defaultDivisions]));
                    setDivisionList(merged);
                }
            } catch (err) {
                console.warn('Could not fetch divisions from API, using default list:', err);
            }
        };
        fetchDivisions();
    }, []);

    // Form state & modal states
    const [formData, setFormData] = useState({
        projectName: '',
        division: user?.department || 'Divisi Pengembangan TI',
        priority: 'Medium',
        type: 'RBB', // Klasifikasi RBB / Non-RBB ditentukan sejak awal inisiasi divisi
        targetDate: '',
        description: '',
    });

    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedProject, setSubmittedProject] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    const showError = (msg) => {
        setErrorMessage(msg);
        setTimeout(() => setErrorMessage(''), 4000);
    };

    const handleCloseModal = () => {
        setSubmittedProject(null);
        setFormData({
            projectName: '',
            division: user?.department || 'Divisi Pengembangan TI',
            priority: 'Medium',
            type: 'RBB',
            targetDate: '',
            description: '',
        });
        setUploadedFiles([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errorMessage) setErrorMessage('');
    };

    // Process files and convert to Data URL for in-browser PDF previewing
    const processFiles = async (files) => {
        const fileArray = Array.from(files);
        const nonPdf = fileArray.filter(f => !f.name.toLowerCase().endsWith('.pdf'));
        
        if (nonPdf.length > 0) {
            setErrorMessage('Demi integritas dokumen SDLC Bank Nagari & pratinjau langsung di browser, mohon unggah berkas berformat PDF (.pdf).');
            setTimeout(() => setErrorMessage(''), 5000);
        }

        const validPdfFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (validPdfFiles.length === 0) return;

        const filePromises = validPdfFiles.map((file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                let defaultType = 'brd';
                const fn = file.name.toLowerCase();
                if (fn.includes('fsd')) defaultType = 'fsd';
                else if (fn.includes('qa') || fn.includes('test') || fn.includes('siber') || fn.includes('cyber')) defaultType = 'qa_report';
                else if (fn.includes('uat')) defaultType = 'uat_doc';
                else if (fn.includes('legal') || fn.includes('kontrak')) defaultType = 'legal';

                reader.onload = (e) => {
                    resolve({
                        name: file.name,
                        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
                        type: defaultType,
                        doc_type: defaultType,
                        status: 'success',
                        url: e.target.result,
                    });
                };
                reader.onerror = () => {
                    resolve({
                        name: file.name,
                        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
                        type: defaultType,
                        doc_type: defaultType,
                        status: 'success',
                        url: URL.createObjectURL(file),
                    });
                };
                reader.readAsDataURL(file);
            });
        });

        const newFiles = await Promise.all(filePromises);
        setUploadedFiles((prev) => [...prev, ...newFiles]);
    };

    const handleFileTypeChange = (index, newDocType) => {
        setUploadedFiles((prev) => prev.map((f, i) => i === index ? { ...f, doc_type: newDocType, type: newDocType } : f));
    };

    // Handle file upload
    const handleFileUpload = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFiles(files);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle delete file
    const handleDeleteFile = (index) => {
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Handle drag & drop
    const handleDrop = (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFiles(files);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Handle Save as Draft
    const handleSaveDraft = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!formData.projectName.trim()) {
            showError('Nama proyek wajib diisi untuk menyimpan draft!');
            return;
        }

        setIsSubmitting(true);
        try {
            const draftProject = {
                name: formData.projectName,
                description: formData.description || 'Draft pengajuan proyek',
                division: formData.division || 'Divisi TI',
                priority: formData.priority,
                targetDate: formData.targetDate || 'TBD',
                status: 'DRAFT',
                type: formData.type || 'RBB',
                documents: uploadedFiles,
            };

            const res = await addProject(draftProject);

            addNotification(
                'Draft Proyek Tersimpan',
                `Draft "${formData.projectName}" (${formData.type || 'RBB'}) berhasil disimpan.`,
                'info',
                '/projects'
            );

            setIsSubmitting(false);
            setSubmittedProject({
                ...draftProject,
                id: res?.data?.id || `DRAFT-${Date.now()}`,
                isDraft: true,
            });
        } catch (err) {
            console.error('[ProjectNew] Draft error:', err);
            setIsSubmitting(false);
            const msg = err?.response?.data?.message || err?.message || 'Gagal menyimpan draft proyek.';
            showError(msg);
        }
    };

    // Handle Submit Ajukan Proyek
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!formData.projectName.trim()) {
            showError('Nama proyek wajib diisi!');
            return;
        }
        if (!formData.targetDate) {
            showError('Target tanggal selesai wajib diisi!');
            return;
        }

        setIsSubmitting(true);

        try {
            const newProject = {
                name: formData.projectName,
                description: formData.description || 'Pengajuan proyek baru oleh ' + (user?.name || 'PIC'),
                division: formData.division || 'Divisi TI',
                priority: formData.priority,
                targetDate: formData.targetDate || 'TBD',
                status: 'PENDING',
                type: formData.type || 'RBB',
                documents: uploadedFiles,
            };

            const res = await addProject(newProject);

            addNotification(
                'Proyek Baru Diajukan',
                `Proyek "${formData.projectName}" menunggu review dari Lead Group.`,
                'info',
                '/queue'
            );

            setIsSubmitting(false);
            setSubmittedProject({
                ...newProject,
                id: res?.data?.id || `PRJ-${Date.now()}`,
                isDraft: false,
            });
        } catch (err) {
            console.error('[ProjectNew] Submit error:', err);
            setIsSubmitting(false);
            const serverMsg = err?.response?.data?.message;
            const valErrors = err?.response?.data?.errors;
            let detail = serverMsg || err?.message || 'Gagal mengajukan proyek.';
            if (valErrors && typeof valErrors === 'object') {
                const firstKey = Object.keys(valErrors)[0];
                if (firstKey && valErrors[firstKey][0]) {
                    detail = `${detail}: ${valErrors[firstKey][0]}`;
                }
            }
            showError(detail);
        }
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 md:px-8 md:py-5 relative bg-[#f8f9fb]">
            {/* Background effect */}
            <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none -z-10 transform translate-x-1/4 -translate-y-1/4"></div>

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

                {errorMessage && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold animate-shake shadow-xs">
                        <AlertCircle size={18} className="text-red-500 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

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
                                <label className="text-sm font-semibold text-gray-600">Unit Kerja PIC</label>
                                <input
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 cursor-not-allowed font-semibold transition-all"
                                    disabled
                                    type="text"
                                    value={formData.division || user?.department || 'Divisi Pengembangan TI'}
                                />
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
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all text-sm font-medium"
                                    placeholder="Contoh: Digital Loan Enhancement Phase II"
                                    type="text"
                                    required
                                />
                            </div>

                            {/* Seksi Klasifikasi Tipe Proyek (RBB / Non-RBB) dari Awal Inisiasi */}
                            <div className="space-y-2 md:col-span-2 bg-gradient-to-r from-purple-50/70 to-blue-50/50 p-4 sm:p-5 rounded-xl border border-purple-100/90 shadow-2xs">
                                <div className="mb-1">
                                    <label className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5">
                                        Klasifikasi Tipe Proyek SDLC <span className="text-red-500">*</span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-600 mb-3">
                                    Pilih tipe pengajuan proyek Anda. Klasifikasi ini akan menjadi acuan prioritas penanganan dari Fase Inisiasi hingga Go-Live.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${formData.type === 'RBB' ? 'border-purple-600 bg-purple-50/80 shadow-xs' : 'border-gray-200 bg-white hover:border-purple-200'}`}>
                                        <input
                                            type="radio"
                                            name="type"
                                            value="RBB"
                                            checked={formData.type === 'RBB'}
                                            onChange={handleChange}
                                            className="mt-1 text-purple-600 focus:ring-purple-500"
                                        />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-extrabold text-xs text-purple-900 uppercase tracking-wider bg-purple-200/90 text-purple-900 px-2 py-0.5 rounded border border-purple-300">RBB</span>
                                                <span className="font-bold text-xs text-gray-800">Rencana Bisnis Bank</span>
                                            </div>
                                            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                                                Proyek strategis prioritas utama yang terdaftar dalam Rencana Bisnis Bank Nagari dengan target jadwal yang ketat.
                                            </p>
                                        </div>
                                    </label>
                                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${formData.type === 'Non-RBB' ? 'border-slate-600 bg-slate-50/80 shadow-xs' : 'border-gray-200 bg-white hover:border-slate-200'}`}>
                                        <input
                                            type="radio"
                                            name="type"
                                            value="Non-RBB"
                                            checked={formData.type === 'Non-RBB'}
                                            onChange={handleChange}
                                            className="mt-1 text-slate-600 focus:ring-slate-500"
                                        />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider bg-slate-200 text-slate-800 px-2 py-0.5 rounded border border-slate-300">Non-RBB</span>
                                                <span className="font-bold text-xs text-gray-800">Non-RBB (Insidental)</span>
                                            </div>
                                            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                                                Proyek operasional rutin, insidental, atau penyempurnaan sistem internal divisi dengan target fleksibel.
                                            </p>
                                        </div>
                                    </label>
                                </div>
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
                                    {divisionList.map((div) => (
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
                                <label className="text-sm font-semibold text-gray-600">
                                    Target Selesai (Estimasi) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="targetDate"
                                    value={formData.targetDate}
                                    onChange={handleChange}
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A56DB] focus:border-[#1A56DB] transition-all text-sm cursor-pointer"
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
                                Tarik file PDF ke sini atau <span className="text-[#1A56DB] font-bold">Pilih Dokumen PDF</span>
                            </p>
                            <p className="text-blue-600 text-xs font-semibold mt-2.5 flex items-center justify-center gap-1.5 bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-200">
                                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                                Format Resmi SDLC: Berkas PDF (.pdf) untuk Pratinjau Langsung di Browser (Maks 10MB per file)
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,application/pdf"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>

                        {/* File List */}
                        {uploadedFiles.length > 0 && (
                            <div className="mt-8 space-y-3">
                                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                    Tentukan Jenis Dokumen SDLC untuk Setiap File:
                                </p>
                                {uploadedFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl gap-4 group"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center font-bold text-xs shrink-0">
                                                PDF
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-800 truncate">{file.name}</p>
                                                <p className="text-[11px] text-gray-500">{file.size} • Siap Dipratinjau</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2.5 shrink-0">
                                            {/* Tombol Lihat / Pratinjau Dokumen PDF */}
                                            <button
                                                type="button"
                                                onClick={() => setPreviewFile(file)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1A56DB] rounded-lg border border-blue-200 transition-all text-xs font-bold shadow-2xs active:scale-95 cursor-pointer"
                                                title="Lihat / Pratinjau Dokumen PDF"
                                            >
                                                <Eye size={15} />
                                                <span>Lihat Dokumen</span>
                                            </button>

                                            {/* Selector Kategori Dokumen SDLC */}
                                            <select
                                                value={file.doc_type || 'brd'}
                                                onChange={(e) => handleFileTypeChange(index, e.target.value)}
                                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#1A56DB] outline-none shadow-2xs"
                                            >
                                                <option value="brd">BRD (Business Requirement Document)</option>
                                                <option value="fsd">FSD (Functional Specification Document)</option>
                                                <option value="qa_report">Laporan Testing QA &amp; Siber</option>
                                                <option value="uat_doc">Berita Acara UAT</option>
                                                <option value="legal">Dokumen Kontrak &amp; Legal</option>
                                            </select>

                                            <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteFile(index)}
                                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                title="Hapus File"
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
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 pb-2 border-t border-gray-200/60 mt-2">
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm active:scale-95 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                            <Save size={16} />
                            Simpan sebagai Draft
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-6 py-2.5 bg-[#003a73] text-white font-bold rounded-xl hover:bg-[#002a5a] transition-all text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-900/20 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <span>{isSubmitting ? 'Memproses...' : 'Ajukan Proyek'}</span>
                            <Send size={16} />
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

            {/* Modal Sukses Enterprise */}
            {submittedProject && (
                <div
                    onClick={handleCloseModal}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-gray-100 transform transition-all animate-scale-up text-center relative overflow-hidden"
                    >
                        {/* Close X Button */}
                        <button
                            onClick={handleCloseModal}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors z-20 cursor-pointer"
                            title="Tutup Modal &amp; Kembali ke Form"
                        >
                            <X size={20} />
                        </button>

                        {/* Light ambient glow */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Animated Icon */}
                        <div className="mx-auto w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
                            <CheckCircle className="w-10 h-10 text-emerald-600 animate-pulse" />
                        </div>

                        <h3 className="text-2xl font-black text-gray-800 mb-2">
                            {submittedProject.isDraft ? 'Draft Berhasil Disimpan!' : 'Proyek Berhasil Diajukan!'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                            {submittedProject.isDraft
                                ? 'Draft proyek Anda telah tersimpan. Anda dapat melanjutkannya kapan saja.'
                                : 'Pengajuan proyek Anda telah tercatat dan masuk ke antrean review Lead Group.'}
                        </p>

                        {/* Summary Card */}
                        <div className="bg-gray-50 rounded-2xl p-4 text-left border border-gray-100 mb-6 space-y-2 text-xs">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-200/60">
                                <span className="text-gray-400 font-semibold">NAMA PROYEK</span>
                                <span className="font-bold text-gray-800 text-sm truncate max-w-[180px]">{submittedProject.name}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-gray-400 font-semibold">DIVISI</span>
                                <span className="font-semibold text-gray-700">{submittedProject.division}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-gray-400 font-semibold">STATUS</span>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                    {submittedProject.isDraft ? 'DRAFT' : 'PENDING (Menunggu Review)'}
                                </span>
                            </div>
                            {submittedProject.documents && submittedProject.documents.length > 0 && (
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-gray-400 font-semibold">DOKUMEN</span>
                                    <span className="font-bold text-[#1A56DB]">
                                        📄 {submittedProject.documents.length} File Terlampir
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Navigation Actions */}
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => navigate(`/pm/tracker?projectId=${submittedProject.id}`, { state: { projectId: submittedProject.id } })}
                                className="w-full py-3 px-5 bg-gradient-to-r from-[#1A56DB] to-[#003a73] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                            >
                                <span>Lacak Status Proyek</span>
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => navigate('/documents')}
                                className="w-full py-2.5 px-5 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-all text-sm cursor-pointer"
                            >
                                Manajemen Dokumen Terpusat
                            </button>
                            <button
                                onClick={() => navigate('/projects')}
                                className="w-full py-2.5 px-5 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-sm cursor-pointer"
                            >
                                Lihat Daftar Semua Proyek
                            </button>
                            <button
                                onClick={handleCloseModal}
                                className="w-full py-2.5 px-5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <X size={16} />
                                <span>Tutup &amp; Buat Pengajuan Baru</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Pratinjau Dokumen PDF */}
            {previewFile && (
                <div
                    onClick={() => setPreviewFile(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl max-w-5xl w-full h-[85vh] shadow-2xl border border-gray-100 flex flex-col relative overflow-hidden animate-scale-up"
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center font-bold text-xs shrink-0">
                                    PDF
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-gray-800 truncate max-w-lg">{previewFile.name}</h3>
                                    <p className="text-xs text-gray-500">{previewFile.size} • Pratinjau Berkas PDF</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {previewFile.url && (
                                    <a
                                        href={previewFile.url}
                                        download={previewFile.name}
                                        className="p-2 text-gray-600 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold border border-gray-200"
                                        title="Unduh File"
                                    >
                                        <Download size={16} />
                                        <span className="hidden sm:inline">Unduh</span>
                                    </a>
                                )}
                                <button
                                    onClick={() => setPreviewFile(null)}
                                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                    title="Tutup Pratinjau"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body (PDF Viewer) */}
                        <div className="flex-1 bg-gray-100 p-2 sm:p-4 overflow-hidden relative">
                            {previewFile.url ? (
                                <iframe
                                    src={previewFile.url}
                                    title={previewFile.name}
                                    className="w-full h-full rounded-xl border border-gray-200 bg-white shadow-inner"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-white rounded-xl">
                                    <AlertCircle size={40} className="text-amber-500 mb-3" />
                                    <p className="text-gray-800 font-bold">Pratinjau tidak tersedia</p>
                                    <p className="text-gray-500 text-xs mt-1">Berkas PDF tidak dapat dimuat di browser.</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
                            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                                <CheckCircle2 size={14} className="text-emerald-600" /> Dokumen siap terlampir dalam pengajuan
                            </span>
                            <button
                                onClick={() => setPreviewFile(null)}
                                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                            >
                                Tutup Pratinjau
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}