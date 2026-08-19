import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { useProjects } from '../../contexts/ProjectContext';
import { divisionService, projectService } from '../../services/api';
import toast from 'react-hot-toast';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import {
    User,
    Info,
    CloudUpload,
    Upload,
    CheckCircle,
    CheckCircle2,
    Trash2,
    Send,
    HelpCircle,
    ChevronRight,
    AlertCircle,
    X,
    Eye,
} from 'lucide-react';
import {
    generateDocumentName,
    INITIATION_DOC_TYPES,
    DOCUMENT_TYPES,
    getDocumentTypeInfo,
    formatFileSize,
} from '../../utils/documentNaming';

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
            } catch {
            }
        };
        fetchDivisions();
    }, []);

    const getUserDivision = (u) => {
        if (!u) return 'Divisi Pemohon';
        if (typeof u.division === 'object' && u.division?.name) return u.division.name;
        if (typeof u.division === 'string' && u.division) return u.division;
        if (u.department) return u.department;
        return 'Divisi Pemohon';
    };

    const currentUserDivision = getUserDivision(user);

    // Form state & modal states
    const [formData, setFormData] = useState({
        projectName: '',
        division: currentUserDivision,
        priority: 'Medium',
        type: 'RBB',
        project_type: 'baru', // Tipe Proyek: baru / perbaikan / update
        targetDate: '',
        description: '',
        contactPhone: '',
    });

    useEffect(() => {
        const divName = getUserDivision(user);
        setFormData((prev) => ({
            ...prev,
            division: divName,
        }));
    }, [user]);

    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
    const [submittedProject, setSubmittedProject] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [nextReqId, setNextReqId] = useState('');

    // Fetch next req_id from backend before showing document previews
    useEffect(() => {
        const fetchReqId = async () => {
            try {
                const res = await projectService.getNextReqId();
                if (res?.data?.req_id) {
                    setNextReqId(res.data.req_id);
                }
            } catch {
                setNextReqId('');
            }
        };
        fetchReqId();
    }, []);

    const showError = (msg) => {
        setErrorMessage(msg);
        setTimeout(() => setErrorMessage(''), 4000);
    };

    const handleCloseModal = () => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        setSubmittedProject(null);
        setFormData({
            projectName: '',
            division: getUserDivision(user),
            priority: 'Medium',
            type: 'RBB',
            project_type: 'baru',
            targetDate: '',
            description: '',
            contactPhone: '',
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
        const MAX_SIZE_MB = 5;
        const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
        const ALLOWED_EXTS = ['.pdf', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.zip'];

        const oversizedFiles = fileArray.filter(f => f.size > MAX_SIZE_BYTES);
        if (oversizedFiles.length > 0) {
            const fileNames = oversizedFiles.map(f => `"${f.name}"`).join(', ');
            const errorMsg = `Dokumen ${fileNames} ditolak karena ukurannya melebihi batas maksimal ${MAX_SIZE_MB}MB.`;
            toast.error(errorMsg);
            showError(errorMsg);
        }

        const unsupportedFiles = fileArray.filter(f => {
            const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
            return !ALLOWED_EXTS.includes(ext);
        });
        if (unsupportedFiles.length > 0) {
            const fileNames = unsupportedFiles.map(f => `"${f.name}"`).join(', ');
            const errorMsg = `Dokumen ${fileNames} ditolak. Format yang diizinkan: PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), dan ZIP.`;
            toast.error(errorMsg);
            showError(errorMsg);
        }

        const validFiles = fileArray.filter(f => {
            const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
            return ALLOWED_EXTS.includes(ext) && f.size <= MAX_SIZE_BYTES;
        });
        if (validFiles.length === 0) return;

        // Deteksi tipe dokumen otomatis dari ekstensi file
        const detectTypeFromExt = (file) => {
            const fn = file.name.toLowerCase();
            if (fn.endsWith('.pdf')) return 'BRD';
            if (fn.endsWith('.xlsx') || fn.endsWith('.xls')) return 'LAINNYA'; // Default spreadsheet → LAINNYA, user bisa ganti
            if (fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.png')) return 'LAMPIRAN';
            if (fn.endsWith('.zip')) return 'LAMPIRAN';
            return 'LAINNYA';
        };

        // Generate nama dokumen otomatis
        const projectReqId = nextReqId || 'REQ-PENDING'; // Real req_id from API, or fallback
        const projectName = formData.projectName || 'Proyek_Baru';

        const filePromises = validFiles.map((file) => {
            return new Promise((resolve) => {
                const detectedType = detectTypeFromExt(file);
                const typeInfo = getDocumentTypeInfo(detectedType);
                const autoName = generateDocumentName(projectReqId, detectedType, projectName);

                let objectUrl = null;
                try {
                    objectUrl = URL.createObjectURL(file);
                } catch {
                    // Some file types may not support createObjectURL
                }

                const isImage = /\.(jpg|jpeg|png)$/i.test(file.name);

                resolve({
                    originalName: file.name,
                    name: autoName + '.' + file.name.split('.').pop().toLowerCase(),
                    size: formatFileSize(file.size),
                    sizeBytes: file.size,
                    type: detectedType,
                    doc_type: detectedType,
                    ext: (file.name.split('.').pop() || 'FILE').toUpperCase(),
                    color: typeInfo.color,
                    status: 'success',
                    url: objectUrl,
                    rawFile: file,
                    isImage: isImage,
                });
            });
        });

        const newFiles = await Promise.all(filePromises);
        setUploadedFiles((prev) => [...prev, ...newFiles]);
    };

    const handleFileTypeChange = (index, newDocType) => {
        setUploadedFiles((prev) => prev.map((f, i) => {
            if (i !== index) return f;
            // Regenerate nama dengan tipe baru & real req_id
            const currentReqId = nextReqId || 'REQ-PENDING';
            const projectName = formData.projectName || 'Proyek_Baru';
            const newName = generateDocumentName(currentReqId, newDocType, projectName);
            const fileExt = f.rawFile ? f.rawFile.name.split('.').pop() : 'pdf';
            return {
                ...f,
                doc_type: newDocType,
                type: newDocType,
                name: newName + '.' + fileExt.toLowerCase(),
                color: getDocumentTypeInfo(newDocType).color,
            };
        }));
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



    // Handle Submit Ajukan Proyek
    const handleSubmit = async (e) => {
        e.preventDefault();
        // 🛑 SYNCHRONOUS REF GUARD — Instantly blocks any secondary/rapid clicks with 0ms latency
        if (isSubmittingRef.current || isSubmitting) return;

        if (!formData.projectName.trim()) {
            toast.error('Nama proyek wajib diisi!');
            showError('Nama proyek wajib diisi!');
            return;
        }
        if (!formData.targetDate) {
            toast.error('Target tanggal selesai wajib diisi!');
            showError('Target tanggal selesai wajib diisi!');
            return;
        }
        if (!formData.contactPhone || !formData.contactPhone.trim()) {
            toast.error('Nomor telepon kontak wajib diisi!');
            showError('Nomor telepon kontak wajib diisi!');
            return;
        }

        isSubmittingRef.current = true;
        setIsSubmitting(true);

        try {
            const submittedName = formData.projectName;
            const userDivision = getUserDivision(user);
            const newProject = {
                name: formData.projectName,
                description: formData.description || 'Pengajuan proyek baru oleh ' + (user?.name || 'PIC'),
                contact_phone: formData.contactPhone || '',
                division: userDivision,
                priority: formData.priority,
                targetDate: formData.targetDate || 'TBD',
                status: 'PENDING',
                type: formData.type || 'RBB',
                project_type: formData.project_type || 'baru',
                documents: uploadedFiles,
            };

            const res = await addProject(newProject);

            // Pop-up Toast Notification
            toast.success(`Pengajuan proyek "${submittedName}" berhasil diajukan!`);

            // Notifikasi Sistem
            addNotification(
                'Proyek Baru Diajukan',
                `Proyek "${submittedName}" menunggu review dari Lead Group.`,
                'info',
                '/queue'
            );

            // Tampilkan Modal Popup Sukses Enterprise
            setSubmittedProject({
                ...newProject,
                id: res?.data?.id || `PRJ-${Date.now()}`,
                isDraft: false,
            });

            // 🔄 RESET FORM & UNGGAHAN AGAR LAMAN KOSONG DAN SIAP UNTUK PENGAJUAN PROYEK BARU
            setFormData({
                projectName: '',
                division: userDivision,
                priority: 'Medium',
                type: 'RBB',
                project_type: 'baru',
                targetDate: '',
                description: '',
                contactPhone: '',
            });
            setUploadedFiles([]);
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        } catch (err) {
            isSubmittingRef.current = false;
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
            toast.error(detail);
            showError(detail);
        }
    };

    // Get file icon based on type
    const getFileIcon = (type) => {
        if (!type) return 'bg-gray-100 text-gray-600';
        const icons = {
            pdf: 'bg-red-100 text-red-600',
            docx: 'bg-blue-100 text-blue-600',
            xlsx: 'bg-green-100 text-green-600',
            pptx: 'bg-orange-100 text-orange-600',
            zip: 'bg-purple-100 text-purple-600',
            image: 'bg-yellow-100 text-yellow-700',
            spreadsheet: 'bg-green-100 text-green-600',
            presentation: 'bg-orange-100 text-orange-600',
            data: 'bg-gray-100 text-gray-600',
            archive: 'bg-purple-100 text-purple-600',
            text: 'bg-slate-100 text-slate-600',
        };
        return icons[String(type).toLowerCase()] || 'bg-gray-100 text-gray-600';
    };

    const getFileLabel = (type) => {
        if (!type) return 'DOC';
        const labels = {
            pdf: 'PDF',
            docx: 'DOCX',
            xlsx: 'XLSX',
            pptx: 'PPTX',
            zip: 'ZIP',
            image: 'IMG',
            spreadsheet: 'XLSX',
            presentation: 'PPTX',
            data: 'DATA',
            archive: 'ZIP',
            text: 'TXT',
            brd: 'BRD',
            fsd: 'FSD',
            qa_report: 'QA',
            uat_doc: 'UAT',
            legal: 'LGL',
            attachment: 'FILE',
        };
        const key = String(type).toLowerCase();
        return labels[key] || String(type).toUpperCase();
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
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#00529C] flex items-center justify-center">
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
                                <label className="text-sm font-semibold text-gray-600">Unit Kerja PIC (Divisi Pemohon)</label>
                                <input
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 font-semibold cursor-not-allowed transition-all"
                                    disabled
                                    readOnly
                                    type="text"
                                    value={getUserDivision(user)}
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
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#00529C] flex items-center justify-center">
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
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] transition-all text-sm font-medium"
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

                            {/* Seksi Tipe Proyek: Baru / Perbaikan / Update */}
                            <div className="space-y-2 md:col-span-2 bg-gradient-to-r from-blue-50/70 to-cyan-50/50 p-4 sm:p-5 rounded-xl border border-blue-100/90 shadow-2xs">
                                <div className="mb-1">
                                    <label className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5">
                                        Tipe Proyek <span className="text-red-500">*</span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-600 mb-3">
                                    Pilih tipe sifat pekerjaan proyek ini. Tipe ini dipertahankan di seluruh alur SDLC hingga Go-Live.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${formData.project_type === 'baru' ? 'border-blue-600 bg-blue-50/80 shadow-xs' : 'border-gray-200 bg-white hover:border-blue-200'}`}>
                                        <input
                                            type="radio"
                                            name="project_type"
                                            value="baru"
                                            checked={formData.project_type === 'baru'}
                                            onChange={handleChange}
                                            className="mt-1 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="font-extrabold text-xs text-blue-900 uppercase tracking-wider bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-200">Baru</span>
                                            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                                                Pengembangan sistem/aplikasi baru dari nol.
                                            </p>
                                        </div>
                                    </label>
                                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${formData.project_type === 'perbaikan' ? 'border-amber-600 bg-amber-50/80 shadow-xs' : 'border-gray-200 bg-white hover:border-amber-200'}`}>
                                        <input
                                            type="radio"
                                            name="project_type"
                                            value="perbaikan"
                                            checked={formData.project_type === 'perbaikan'}
                                            onChange={handleChange}
                                            className="mt-1 text-amber-600 focus:ring-amber-500"
                                        />
                                        <div>
                                            <span className="font-extrabold text-xs text-amber-900 uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">Perbaikan</span>
                                            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                                                Perbaikan bug / defect / penyempurnaan pada sistem berjalan.
                                            </p>
                                        </div>
                                    </label>
                                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${formData.project_type === 'update' ? 'border-emerald-600 bg-emerald-50/80 shadow-xs' : 'border-gray-200 bg-white hover:border-emerald-200'}`}>
                                        <input
                                            type="radio"
                                            name="project_type"
                                            value="update"
                                            checked={formData.project_type === 'update'}
                                            onChange={handleChange}
                                            className="mt-1 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <div>
                                            <span className="font-extrabold text-xs text-emerald-900 uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">Update</span>
                                            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                                                Peningkatan fitur / pembaruan versi pada sistem berjalan.
                                            </p>
                                        </div>
                                    </label>
                                </div>
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
                                                        ? 'bg-[#00529C] text-white border-[#00529C]'
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
                                    Nomor Telepon Kontak <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="contactPhone"
                                    value={formData.contactPhone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] transition-all text-sm"
                                    placeholder="Contoh: 0812-3456-7890"
                                    type="tel"
                                />
                                <p className="text-[11px] text-gray-400">Nomor yang dapat dihubungi untuk keperluan UAT &amp; koordinasi proyek.</p>
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
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] transition-all text-sm cursor-pointer"
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
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] transition-all text-sm"
                                    placeholder="Jelaskan latar belakang dan tujuan utama proyek ini..."
                                    rows={4}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Unggah Dokumen */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#00529C] flex items-center justify-center">
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
                            <div className="w-16 h-16 rounded-full bg-[#00529C] flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                                <Upload size={28} />
                            </div>
                            <p className="text-lg font-semibold text-gray-800">
                                Tarik file ke sini atau <span className="text-[#00529C] font-bold">Pilih Dokumen</span>
                            </p>
                            <p className="text-blue-600 text-xs font-semibold mt-2.5 flex items-center justify-center gap-1.5 bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-200">
                                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                                Format: PDF, Excel (.xls/.xlsx), Gambar (.jpg/.jpeg/.png), ZIP (Maks 5MB per file)
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>

                        {/* File List */}
                        {uploadedFiles.length > 0 && (
                            <div className="mt-8 space-y-3">
                                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                    Daftar Dokumen Terlampir ({uploadedFiles.length})
                                </p>
                                <div className="bg-blue-50/50 border border-blue-200 rounded-lg px-4 py-2 text-[11px] text-blue-700 font-medium">
                                    <strong>Format Penamaan:</strong> XXX/GPTD/TIPE/TT-BULANTAHUN_NamaProyek (nomor XXX otomatis dari ID proyek)
                                </div>
                                {uploadedFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl gap-4 group"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${file.color || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                {file.ext || 'FILE'}
                                            </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-gray-800 truncate" title={file.originalName}>
                                                {file.originalName}
                                            </p>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {file.size} • <span className="text-amber-700 font-medium">→ {file.name}</span>
                                            </p>
                                        </div>
                                        </div>

                                        <div className="flex items-center gap-2.5 shrink-0">
                                            {/* Tombol Lihat / Pratinjau */}
                                            {(file.url && (file.ext === 'PDF' || file.isImage)) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewFile(file)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#00529C] rounded-lg border border-blue-200 transition-all text-xs font-bold shadow-2xs active:scale-95 cursor-pointer"
                                                    title={file.isImage ? 'Lihat Gambar' : 'Pratinjau Dokumen PDF'}
                                                >
                                                    <Eye size={15} />
                                                    <span>{file.isImage ? 'Lihat' : 'Pratinjau'}</span>
                                                </button>
                                            )}

                                            {/* Selector Kategori Dokumen — 4 OPSI (Fase Inisiasi) */}
                                            <select
                                                value={file.doc_type || 'BRD'}
                                                onChange={(e) => handleFileTypeChange(index, e.target.value)}
                                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#00529C] outline-none shadow-2xs cursor-pointer"
                                            >
                                                <option value="BRD">BRD</option>
                                                <option value="MEMO">Memo</option>
                                                <option value="LAMPIRAN">Lampiran</option>
                                                <option value="LAINNYA">Lainnya</option>
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
                            <a href="#" className="hover:text-[#00529C]">Syarat &amp; Ketentuan</a>
                            <a href="#" className="hover:text-[#00529C]">Kebijakan Keamanan</a>
                            <a href="#" className="hover:text-[#00529C]">Pusat Bantuan</a>
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
                            Proyek Berhasil Diajukan!
                        </h3>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                            Pengajuan proyek Anda telah tercatat dan masuk ke antrean review Lead Group.
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
                                    PENDING (Menunggu Review)
                                </span>
                            </div>
                            {submittedProject.documents && submittedProject.documents.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200/60">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-400 font-semibold">DOKUMEN</span>
                                        <span className="font-bold text-[#00529C]">
                                            📄 {submittedProject.documents.length} File Terlampir
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 text-left">
                                        {submittedProject.documents.map((doc, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px] bg-blue-50/50 rounded-lg px-2.5 py-1.5">
                                                <div className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                                                    {(doc.doc_type || doc.type || 'FILE').substring(0, 2)}
                                                </div>
                                                <span className="text-gray-700 font-medium truncate">
                                                    {doc.finalName || doc.originalName || doc.name}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation Actions */}
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => navigate(`/pm/tracker?projectId=${submittedProject.id}`, { state: { projectId: submittedProject.id } })}
                                className="w-full py-3 px-5 bg-gradient-to-r from-[#00529C] to-[#003a73] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
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
                <DocumentViewerModal
                    doc={previewFile}
                    onClose={() => setPreviewFile(null)}
                />
            )}
        </div>
    );
}
