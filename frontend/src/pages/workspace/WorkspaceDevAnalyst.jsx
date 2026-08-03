import RBBBadge from '../../components/RBBBadge';
import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
    Download,
    Eye,
    CheckCircle2,
    Clock,
    Send,
    Save,
    FileText,
    Users,
    Filter,
    Calendar,
    ChevronRight,
    Upload,
    CloudUpload,
    Trash2,
    Briefcase,
    FolderOpen,
    Cpu,
    Layers,
    X,
    UserCheck,
    MessageSquare
} from 'lucide-react';
import { useProjects, saveFileToStore, getFileFromStore } from '../../contexts/ProjectContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';

const resolveAllProjectDocs = (project) => {
    if (!project) return [];
    
    const docsMap = new Map();

    // 1. Initial BRD & documents in project.documents
    if (Array.isArray(project.documents) && project.documents.length > 0) {
        project.documents.forEach(d => {
            const docName = d.name || d.file_name || 'Dokumen_SDLC.pdf';
            const key = d.id || docName;
            const isFsd = (d.type === 'fsd' || d.doc_type === 'fsd' || docName.toLowerCase().includes('fsd') || docName.toLowerCase().includes('kajian'));
            docsMap.set(key, {
                ...d,
                name: docName,
                size: d.size || d.file_size || '2.0 MB',
                label: isFsd 
                    ? 'Hasil Kajian FSD (Perencanaan TI)' 
                    : (d.type === 'brd' || d.doc_type === 'brd' || d.category === 'brd' || docName.toLowerCase().includes('brd') || docName.toLowerCase().includes('laprak') || docName.toLowerCase().includes('form') || docName.toLowerCase().includes('kebutuhan') || docName.toLowerCase().includes('bimbingan')) 
                    ? 'Dokumen BRD Inisiasi' 
                    : (d.type === 'fsd_dev' || d.doc_type === 'fsd_dev')
                    ? 'Spesifikasi Arsitektur (Dev)'
                    : (d.label || 'Dokumen SDLC Terlampir')
            });
        });
    }

    // 2. FSD Perencanaan Document
    if (project.fsdDocument && (project.fsdDocument.name || project.fsdDocument.file_name)) {
        const name = project.fsdDocument.name || project.fsdDocument.file_name;
        docsMap.set(name, {
            ...project.fsdDocument,
            name,
            size: project.fsdDocument.size || project.fsdDocument.file_size || '1.8 MB',
            label: 'Hasil Kajian FSD (Perencanaan TI)'
        });
    }

    // 3. FSD File from Analyst Result / Planning Phase (Guaranteed Minimum 2 Docs)
    const analystFsdName = project.analystResult?.fsdFile || `Mustafa Fathur Rahman - FSD Kajian Perencanaan.pdf`;
    let hasFsd = false;
    for (const doc of docsMap.values()) {
        if (doc.label?.includes('FSD') || doc.name?.toLowerCase().includes('fsd') || doc.type === 'fsd') {
            hasFsd = true;
            break;
        }
    }
    if (!hasFsd) {
        docsMap.set(analystFsdName, {
            id: `FSD-PLN-${project.id}`,
            name: analystFsdName,
            size: '1.8 MB',
            type: 'fsd',
            url: project.analystResult?.fsdUrl || null,
            label: 'Hasil Kajian FSD (Perencanaan TI)'
        });
    }

    // 4. FSD Dev / Spesifikasi Arsitektur Document
    if (project.fsdDevDocument && (project.fsdDevDocument.name || project.fsdDevDocument.file_name)) {
        const name = project.fsdDevDocument.name || project.fsdDevDocument.file_name;
        docsMap.set(name, { ...project.fsdDevDocument, name, label: 'Spesifikasi Arsitektur (Dev)' });
    }

    return Array.from(docsMap.values());
};

export default function WorkspaceDevAnalyst() {
    const { user } = useAuth();
    const { projects, updateProject, isLoading } = useProjects();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();

    const [previewDoc, setPreviewDoc] = useState(null);

    // Filter antrean proyek yang sedang ditugaskan ke Analyst Pengembangan (status DEV_ANALYSIS)
    const reviewQueue = useMemo(() => {
        return projects.filter(p => p.status === 'DEV_ANALYSIS');
    }, [projects]);

    const [selectedProjectState, setSelectedProject] = useState(null);
    const selectedProject = selectedProjectState || reviewQueue[0] || null;

    const [decision, setDecision] = useState('Disetujui (Layak Develop)');
    const [techStack, setTechStack] = useState('Microservices Java Spring Boot + React JS + PostgreSQL');
    const [notes, setNotes] = useState('');
    const [estimationDays, setEstimationDays] = useState('30 Hari Kerja');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            const MAX_SIZE = 5 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                toast.error(`Dokumen "${file.name}" ditolak karena ukurannya melebihi batas maksimal 5MB!`);
                e.target.value = '';
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            const fileObj = {
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
                type: 'fsd_dev',
                doc_type: 'fsd_dev',
                url: objectUrl,
                rawFile: file,
                uploadedAt: new Date().toISOString()
            };
            saveFileToStore(file.name, objectUrl);
            if (selectedProject?.id) {
                saveFileToStore(`fsd_dev_${selectedProject.id}`, objectUrl);
            }
            setUploadedFile(fileObj);
            toast.success(`Dokumen Arsitektur Teknis "${file.name}" berhasil diunggah.`);
        }
    };

    // Convert Data URL / Store URL to Blob URL for embedded PDF reading
    const previewBlobUrl = useMemo(() => {
        if (!previewDoc) return null;
        let rawUrl = previewDoc.url || previewDoc.fileUrl || previewDoc.dataUrl;
        if (!rawUrl && previewDoc.name) {
            rawUrl = getFileFromStore(previewDoc.name) || getFileFromStore(previewDoc.id);
        }
        if (!rawUrl && selectedProject) {
            rawUrl = getFileFromStore(`fsd_${selectedProject.id}`) || selectedProject.analystResult?.fsdUrl;
        }

        if (!rawUrl) {
            const docTitle = (previewDoc.name || 'Dokumen_SDLC.pdf').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
            const projName = selectedProject?.name || 'Proyek SDLC';
            const divName = selectedProject?.division || 'Divisi TI';
            const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 280 >>\nstream\nBT\n/F1 18 Tf\n50 720 Td\n(PT BANK NAGARI - DOKUMEN SDLC RESMI) Tj\n0 -35 Td\n/F1 14 Tf\n(Nama Berkas: ${docTitle}) Tj\n0 -25 Td\n(Proyek: ${projName}) Tj\n0 -25 Td\n(Divisi Peminta: ${divName}) Tj\n0 -25 Td\n(Status: Terverifikasi Quality Gate SDLC Bank Nagari) Tj\n0 -30 Td\n/F1 11 Tf\n(Dokumen ini adalah berkas spesifikasi & kelengkapan proyek SDLC.) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000244 00000 n\n0000000575 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n654\n%%EOF`;
            const blob = new Blob([pdfContent], { type: 'application/pdf' });
            return URL.createObjectURL(blob);
        }

        if (rawUrl.startsWith('data:')) {
            try {
                const parts = rawUrl.split(',');
                const mimeMatch = parts[0].match(/:(.*?);/);
                const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                const blob = new Blob([u8arr], { type: mime });
                return URL.createObjectURL(blob);
            } catch (e) {
                return rawUrl;
            }
        }
        return rawUrl;
    }, [previewDoc, selectedProject]);

    const handleSubmit = async () => {
        if (!decision) {
            toast.error('Pilih keputusan review arsitektur teknis!');
            return;
        }
        if (!notes.trim()) {
            toast.error('Masukkan catatan analisis arsitektur teknis!');
            return;
        }
        setIsSubmitting(true);

        try {
            const fsdDevDoc = uploadedFile ? {
                id: `FSD-DEV-${Date.now()}`,
                name: uploadedFile.name,
                size: uploadedFile.size,
                type: 'fsd_dev',
                doc_type: 'fsd_dev',
                url: uploadedFile.url,
                uploadedAt: uploadedFile.uploadedAt || new Date().toISOString()
            } : {
                id: `FSD-DEV-${Date.now()}`,
                name: `Spesifikasi_Arsitektur_${selectedProject?.id || 'Dev'}.pdf`,
                size: '2.1 MB',
                type: 'fsd_dev',
                doc_type: 'fsd_dev',
                uploadedAt: new Date().toISOString()
            };

            const existingDocs = selectedProject?.documents || [];
            const newDocs = [fsdDevDoc, ...existingDocs];

            await updateProject(selectedProject.id, {
                status: 'DEV_ANALYSIS_DONE',
                statusColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                devAnalystDecision: decision,
                devAnalystNotes: notes,
                techStack: techStack,
                fsdDevDocument: fsdDevDoc,
                documents: newDocs,
                devAnalystResult: {
                    decision,
                    techStack,
                    notes,
                    estimation: estimationDays || '30 Hari Kerja',
                    analystName: user?.name || 'Citra Kirana (Dev Analyst)',
                    submittedAt: new Date().toISOString()
                }
            });

            addNotification(
                'Kajian Teknis Pengembangan Selesai',
                `System Analyst Pengembangan (${user?.name || 'Analis Dev'}) telah merampungkan kajian arsitektur teknis untuk "${selectedProject?.name}". Proyek siap ditunjuk PM.`,
                'success',
                '/workspace/dev-lead'
            );
            toast.success(`Kajian teknis arsitektur untuk "${selectedProject?.name}" selesai! Dikirim ke Ketua Grup Pengembangan (Tab 3: Siap Tunjuk PM).`);
            setIsSubmitting(false);
            setSelectedProject(null);
            setNotes('');
            setUploadedFile(null);
            navigate('/workspace/dev-lead');
        } catch (err) {
            console.error('Error submitting dev analyst review:', err);
            toast.error('Gagal mengirim kajian teknis.');
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 bg-[#f8f9fb]">
                <LoadingSpinner label="Memuat Workspace System Analyst Pengembangan..." />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Grup Pengembangan IT
                            </span>
                            <span className="text-xs text-gray-400">• Arsitektur &amp; Kelayakan Teknis</span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-gray-800">Workspace System Analyst (Pengembangan)</h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            Kaji kelayakan arsitektur teknis IT, struktur spesifikasi sistem, dan tentukan estimasi waktu pengerjaan proyek.
                        </p>
                    </div>
                </div>
            </div>

            {/* Content Body (Standard 2-Column Split Layout) */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* LEFT PANEL: Antrean Tugas Analyst Dev */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-100px)]">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-slate-50/60">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Tugas Kajian Teknis</h2>
                            <p className="text-xs text-gray-500 mt-0.5">{reviewQueue.length} proyek menunggu analisa</p>
                        </div>
                        <Filter size={16} className="text-gray-400" />
                    </div>

                    <div className="max-lg:max-h-[280px] flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/40 flex flex-col justify-start">
                        {reviewQueue.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 my-auto">
                                <CheckCircle2 size={36} className="mx-auto mb-2 opacity-50 text-emerald-600" />
                                <h4 className="text-xs font-bold text-gray-700">Tidak Ada Proyek Menunggu Kajian</h4>
                                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                                    Belum ada proyek yang ditugaskan oleh Ketua Grup Pengembangan.
                                </p>
                            </div>
                        ) : (
                            reviewQueue.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProject(project)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${selectedProject?.id === project.id
                                            ? 'bg-blue-50/70 border-[#1A56DB] shadow-md ring-2 ring-blue-100'
                                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-xs'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                            {project.id}
                                        </span>
                                        <RBBBadge type={project.type} deadline={project.rbbDeadline} />
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-sm leading-snug line-clamp-2">
                                        {project.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 line-clamp-2">{project.description}</p>
                                    
                                    {project.leadNote && (
                                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                                            <span className="font-bold block text-[10px] text-amber-700 uppercase">Arahan Dev Lead:</span>
                                            <p className="italic truncate">{project.leadNote}</p>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                                        <span>Peminta: <strong>{project.division}</strong></span>
                                        <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                                            <Clock size={10} /> Sedang Analisa
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Form & Detail Kajian Teknis */}
                {!selectedProject ? (
                    <div className="w-full lg:w-2/3 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden items-center justify-center p-12 text-center text-gray-400 min-h-[400px]">
                        <div>
                            <FileText size={48} className="mx-auto mb-3 opacity-40 text-blue-600" />
                            <h3 className="font-bold text-gray-700 text-base">Pilih Proyek dari Antrean</h3>
                            <p className="text-xs text-gray-500 mt-1 max-w-sm">
                                Pilih proyek pada antrean sebelah kiri untuk meninjau dokumen kelengkapan dan mengisi kajian arsitektur teknis IT.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="w-full lg:w-2/3 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm">
                            {/* Detail Header */}
                            <div className="p-5 border-b border-gray-100 shrink-0 bg-slate-50/50 flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                            {selectedProject.id}
                                        </span>
                                        <RBBBadge type={selectedProject.type} deadline={selectedProject.rbbDeadline} />
                                        <span className="text-xs text-gray-500">Target Selesai: <strong>{selectedProject.targetDate}</strong></span>
                                    </div>
                                    <h2 className="text-lg font-black text-gray-800">{selectedProject.name}</h2>
                                    <p className="text-xs text-gray-600 mt-1">Divisi Pengusul: <strong>{selectedProject.division}</strong></p>
                                </div>
                            </div>

                            {/* Scrollable Form Body */}
                            <div className="p-6 space-y-6">
                                {/* Card Hasil Kajian Perencanaan TI (Fase 1) */}
                                <div className="bg-emerald-50/80 p-4.5 rounded-xl border border-emerald-200 space-y-3 shadow-2xs">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                                            <CheckCircle2 size={16} className="text-emerald-600" />
                                            Hasil Kajian Perencanaan TI (Fase 1)
                                        </p>
                                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                                            {selectedProject.analystDecision || selectedProject.analystResult?.decision || 'Disetujui (Layak Develop)'}
                                        </span>
                                    </div>

                                    {/* Notes from System Analyst Perencanaan */}
                                    {(selectedProject.analystNotes || selectedProject.analystResult?.notes) && (
                                        <div className="bg-white/90 p-3 rounded-lg border border-emerald-100 text-xs">
                                            <span className="font-bold text-gray-500 text-[10px] uppercase block mb-0.5">Catatan &amp; Rekomendasi Analyst Perencanaan:</span>
                                            <p className="text-gray-700 italic text-[11px] leading-relaxed">{selectedProject.analystNotes || selectedProject.analystResult?.notes}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Pesan & Arahan Khusus dari Ketua Grup Pengembangan (Lead Dev) */}
                                <div className="bg-blue-50/90 p-4.5 rounded-xl border border-blue-200 space-y-2 shadow-2xs">
                                    <p className="font-bold text-[#1a365d] uppercase tracking-wider flex items-center gap-1.5 text-xs">
                                        <MessageSquare size={16} className="text-[#1A56DB]" />
                                        Pesan &amp; Arahan Khusus dari Ketua Grup Pengembangan (Lead Dev)
                                    </p>
                                    <div className="bg-white p-3 rounded-lg border border-blue-100 text-xs">
                                        <p className="text-gray-800 font-medium italic text-[11px] sm:text-xs leading-relaxed">
                                            "{selectedProject.devLeadNote || selectedProject.leadNote || selectedProject.assignmentNote || 'Tolong kaji kelayakan arsitektur teknis IT, pola integrasi middleware, struktur spesifikasi sistem, serta tentukan estimasi waktu pengerjaan.'}"
                                        </p>
                                        {selectedProject.assignedAnalystAt && (
                                            <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
                                                Ditugaskan pada: {new Date(selectedProject.assignedAnalystAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* 1. Dokumen Kelengkapan Proyek (BRD & FSD Perencanaan) */}
                                <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                                    <h3 className="text-xs font-extrabold text-[#1a365d] uppercase tracking-wider flex items-center gap-1.5">
                                        <FolderOpen size={16} className="text-[#1A56DB]" />
                                        1. Berkas &amp; Dokumen SDLC Proyek (Semua Tahap: Inisiasi &amp; Perencanaan)
                                    </h3>
                                    <div className="space-y-2">
                                        {resolveAllProjectDocs(selectedProject).map((doc, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-white hover:border-blue-300 transition-colors shadow-2xs">
                                                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                                    <div className="w-9 h-9 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px]">
                                                        PDF
                                                    </div>
                                                    <div className="truncate min-w-0">
                                                        <p className="text-xs font-semibold text-gray-800 truncate">{doc.name}</p>
                                                        <p className="text-[11px] text-gray-500">{doc.size || '2.4 MB'} • {doc.label || 'Dokumen SDLC Terlampir'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewDoc(doc)}
                                                        className="px-3 py-1.5 border border-[#1A56DB] text-[#1A56DB] hover:bg-blue-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                                        title="View & Baca Dokumen"
                                                    >
                                                        <Eye size={13} />
                                                        <span>View &amp; Baca</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const rawUrl = doc.url || doc.fileUrl || doc.dataUrl || getFileFromStore(doc.name) || getFileFromStore(doc.id);
                                                            const fileName = doc.name || 'Dokumen_SDLC.pdf';
                                                            if (rawUrl) {
                                                                const link = document.createElement('a');
                                                                link.href = rawUrl;
                                                                link.download = fileName;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                toast.success(`Mengunduh file "${fileName}"...`);
                                                            } else {
                                                                const textContent = `PT BANK NAGARI - DOKUMEN SDLC\n===============================\nNama Dokumen: ${fileName}\nProyek: ${selectedProject.name}\nTanggal: ${new Date().toLocaleDateString('id-ID')}`;
                                                                const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                                                                const url = URL.createObjectURL(blob);
                                                                const link = document.createElement('a');
                                                                link.href = url;
                                                                link.download = fileName.endsWith('.pdf') ? fileName.replace('.pdf', '_ringkasan.txt') : `${fileName}.txt`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                URL.revokeObjectURL(url);
                                                                toast.success(`Mengunduh salinan berkas "${fileName}"...`);
                                                            }
                                                        }}
                                                        className="p-1.5 text-gray-500 hover:text-[#1A56DB] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Unduh Dokumen"
                                                    >
                                                        <Download size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. Form Kajian Arsitektur Teknis IT */}
                                <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-100 space-y-4">
                                    <h3 className="text-xs font-extrabold text-[#1a365d] uppercase tracking-wider flex items-center gap-1.5">
                                        <Cpu size={16} className="text-[#1A56DB]" />
                                        2. Formulir Kajian Arsitektur Teknis &amp; Spesifikasi IT
                                    </h3>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Keputusan Review Arsitektur Teknis <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={decision}
                                                onChange={(e) => setDecision(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#1A56DB] outline-none"
                                            >
                                                <option value="Disetujui (Layak Develop)">Disetujui (Layak Develop &amp; Lanjut ke Tunjuk PM)</option>
                                                <option value="Disetujui dengan Rekomendasi Arsitektur">Disetujui dengan Rekomendasi Arsitektur Khusus</option>
                                                <option value="Perlu Penyesuaian Lingkup">Perlu Penyesuaian Lingkup Teknis</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Rekomendasi Stack Teknologi &amp; Arsitektur Sistem <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={techStack}
                                                onChange={(e) => setTechStack(e.target.value)}
                                                placeholder="Contoh: Microservices Java Spring Boot + React JS + PostgreSQL + RabbitMQ"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#1A56DB] outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Estimasi Waktu Pengerjaan IT (Mandays) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={estimationDays}
                                                onChange={(e) => setEstimationDays(e.target.value)}
                                                placeholder="Contoh: 45 Hari Kerja (3 Sprint)"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#1A56DB] outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Catatan Analisis Spesifikasi Arsitektur Teknis <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Tuliskan spesifikasi arsitektur teknis, integrasi API, struktur basis data, dan pertimbangan keamanan IT..."
                                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 focus:border-[#1A56DB] outline-none leading-relaxed"
                                            />
                                        </div>

                                        {/* Upload Berkas FSD Dev / Spesifikasi Arsitektur */}
                                        <div className="space-y-2 pt-2 border-t border-blue-100">
                                            <label className="block text-xs font-bold text-gray-700">
                                                Unggah Berkas Spesifikasi Arsitektur Teknis (Optional)
                                            </label>
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-blue-200 bg-white p-4 rounded-xl text-center cursor-pointer hover:bg-blue-50/50 transition-colors flex items-center justify-center gap-3"
                                            >
                                                <Upload size={18} className="text-[#1A56DB]" />
                                                <span className="text-xs font-semibold text-gray-700">
                                                    {uploadedFile ? uploadedFile.name : 'Pilih Berkas Spesifikasi PDF (.pdf)'}
                                                </span>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    accept=".pdf"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Submit */}
                            <div className="p-4 border-t border-gray-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !notes.trim()}
                                    className="px-6 py-3 bg-[#1a365d] hover:bg-[#0f2342] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                                >
                                    {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <Send size={15} />}
                                    <span>Kirim Hasil Kajian Teknis ke Ketua Grup Pengembangan</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            {/* MODAL VIEWER DOKUMEN (Analyst Dev Viewer) */}
            {previewDoc && (
                <DocumentViewerModal
                    doc={previewDoc}
                    project={selectedProject}
                    onClose={() => setPreviewDoc(null)}
                />
            )}
        </div>
    );
}
