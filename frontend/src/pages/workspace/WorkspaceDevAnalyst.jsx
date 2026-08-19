import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import { useState, useMemo, useRef, useEffect } from 'react';
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
    Search,
    Calendar,
    ChevronRight,
    Upload,
    CloudUpload,
    Trash2,
    FolderOpen,
    Cpu,
    Layers,
    X,
    UserCheck,
    MessageSquare,
    ShieldCheck
} from 'lucide-react';
import { useProjects, saveFileToStore, getFileFromStore } from '../../contexts/ProjectContext';
import { userService, documentService, projectService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';
import { generateDocumentName, DOCUMENT_TYPES, formatFileSize, getDocExtLabel, getDocIconStyle } from '../../utils/documentNaming';

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
    const { projects, updateProject, isLoading, refreshDataSilent } = useProjects();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();

    // ── Persetujuan SIT (PM / Analyst Pengembangan) ──
    // Hanya muncul setelah Eksekusi SIT (Tahap 2) selesai (activeSitStep >= 3).
    const sitProjects = (projects || []).filter(p => {
        const st = String(p.status || '').toUpperCase();
        if (st !== 'SIT_IN_PROGRESS' && st !== 'SIT_REVISION') return false;
        const sitUat = p.sitUatData || p.sit_uat_data || {};
        return Number(sitUat.activeSitStep || 1) >= 3;
    });
    const [sitApprovingId, setSitApprovingId] = useState(null);
    const handleSitApproval = async (projectId) => {
        setSitApprovingId(projectId);
        try {
            await projectService.submitSitApproval(projectId, '');
            toast.success('Persetujuan SIT Anda berhasil disimpan.');
            refreshDataSilent?.();
        } catch (err) {
            toast.error(`Gagal menyimpan persetujuan: ${err.message}`);
        } finally {
            setSitApprovingId(null);
        }
    };

    const [previewDoc, setPreviewDoc] = useState(null);

    const [selectedAnalystFilter, setSelectedAnalystFilter] = useState(() => {
        if (user?.role === 'super_admin' || user?.role === 'lead_group' || user?.role === 'development_lead') return 'ALL';
        return 'ALL'; // All dev analysts can see all team tasks
    });
    const [devAnalystList, setDevAnalystList] = useState([]);

    // Load PM candidates for filter dropdown
    useEffect(() => {
        const loadPMs = async () => {
            try {
                const res = await userService.getAll();
                const users = res.data || res || [];
                setDevAnalystList(users.filter(u => (u.role_detail?.name || u.role || '') === 'project_manager'));
            } catch {
                setDevAnalystList([]);
            }
        };
        loadPMs();
    }, []);

    // Helper to safely extract analyst name from string or object
    const getAnalystName = (p) => {
        if (!p) return '';
        const a = p.analyst || p.assignedAnalyst;
        if (!a) return '';
        let name = typeof a === 'object' ? (a?.name || '') : String(a);
        if (name && name.includes('(')) {
            name = name.split('(')[0].trim();
        }
        return name;
    };

    // Filter antrean proyek yang sedang di tahap DEV_ANALYSIS
    const reviewQueue = useMemo(() => {
        let list = projects.filter(p => p.status === 'DEV_ANALYSIS');

        if (selectedAnalystFilter === 'MY_PROJECTS') {
            list = list.filter(p => {
                const analystId = p.analyst?.id || (typeof p.assignedAnalyst === 'object' ? p.assignedAnalyst?.id : null);
                if (analystId && user?.id) return analystId === user.id;
                const analystName = getAnalystName(p);
                return analystName.toLowerCase().includes((user?.name || '').split('(')[0].trim().toLowerCase());
            });
        } else if (selectedAnalystFilter !== 'ALL') {
            list = list.filter(p => {
                const analystName = getAnalystName(p);
                return analystName.toLowerCase().includes(selectedAnalystFilter.split('(')[0].trim().toLowerCase());
            });
        }

        return list;
    }, [projects, selectedAnalystFilter, user]);

    const [selectedProjectState, setSelectedProject] = useState(null);
    const [projectSearch, setProjectSearch] = useState('');

    const applyProjectSearch = (list) => {
        if (!projectSearch.trim()) return list;
        const term = projectSearch.toLowerCase();
        return list.filter(p =>
            String(p.id || '').toLowerCase().includes(term) ||
            String(p.name || '').toLowerCase().includes(term) ||
            String(p.division || '').toLowerCase().includes(term)
        );
    };

    const selectedProject = selectedProjectState || reviewQueue[0] || null;
    const [decision, setDecision] = useState('Disetujui (Layak Develop)');
    const [techStack, setTechStack] = useState('Microservices Java Spring Boot + React JS + PostgreSQL');
    const [notes, setNotes] = useState('');
    const [estimationDays, setEstimationDays] = useState('30');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const fileInputRef = useRef(null);

    // Tipe dokumen yang relevan untuk kajian Analis Pengembangan (Fase 2)
    const DEV_ANALYST_DOC_TYPES = ['FSD', 'ARSITEKTUR', 'MEMO', 'LAMPIRAN', 'SIT_PLAN', 'LAINNYA'];
    // Tipe default untuk berkas yang baru diunggah (bisa diubah per file setelah upload)
    const DEFAULT_DOC_TYPE = 'ARSITEKTUR';

    const handleFileUpload = (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newFiles = [];
        Array.from(files).forEach(file => {
            const MAX_SIZE = 5 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                toast.error(`Dokumen "${file.name}" ditolak karena ukurannya melebihi batas maksimal 5MB!`);
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            const docTypeCode = DEFAULT_DOC_TYPE;
            const autoDocName = generateDocumentName(
                selectedProject?.req_id || selectedProject?.id,
                docTypeCode,
                selectedProject?.title || selectedProject?.name
            );
            const fileObj = {
                name: autoDocName + '.' + (file.name.split('.').pop() || 'pdf'),
                originalName: file.name,
                size: formatFileSize(file.size),
                type: docTypeCode.toLowerCase(),
                doc_type: docTypeCode,
                url: objectUrl,
                rawFile: file,
                uploadedAt: new Date().toISOString(),
            };
            saveFileToStore(autoDocName, objectUrl);
            if (selectedProject?.id) {
                saveFileToStore(`fsd_dev_${selectedProject.id}`, objectUrl);
            }
            newFiles.push(fileObj);
        });

        setUploadedFiles(prev => [...prev, ...newFiles]);
        if (newFiles.length > 0) toast.success(`${newFiles.length} dokumen berhasil diunggah.`);
        e.target.value = '';
    };

    const removeUploadedFile = (idx) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const handleFileTypeChange = (index, newDocType) => {
        setUploadedFiles(prev => prev.map((f, i) => {
            if (i !== index) return f;
            const projectReqId = selectedProject?.req_id || selectedProject?.id || 'REQ-PENDING';
            const projectName = selectedProject?.title || selectedProject?.name || 'Proyek_Baru';
            const newName = generateDocumentName(projectReqId, newDocType, projectName);
            const fileExt = f.rawFile ? f.rawFile.name.split('.').pop() : 'pdf';
            return {
                ...f,
                doc_type: newDocType,
                type: newDocType.toLowerCase(),
                name: newName + '.' + fileExt.toLowerCase(),
            };
        }));
    };

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
            const uploadedDocIds = [];

            // Upload semua dokumen ke backend secara permanen
            if (uploadedFiles.length > 0 && selectedProject?.id) {
                for (const uf of uploadedFiles) {
                    if (!uf.rawFile) continue;
                    const docTypeCode = uf.doc_type || 'ARSITEKTUR';
                    try {
                        const uploadRes = await documentService.upload(uf.rawFile, {
                            project_id: selectedProject.id,
                            document_type: docTypeCode,
                            original_filename: uf.originalName || uf.rawFile.name,
                        });
                        if (uploadRes?.data) {
                            uploadedDocIds.push({
                                id: uploadRes.data.id,
                                name: uploadRes.data.file_name,
                                size: formatFileSize(uploadRes.data.file_size || 0),
                                doc_type: docTypeCode,
                            });
                        }
                    } catch (uploadErr) {
                        toast.error(`Gagal mengunggah "${uf.originalName}": ${uploadErr.message}`);
                    }
                }
            }

            await updateProject(selectedProject.id, {
                status: 'DEV_ANALYSIS_DONE',
                devAnalystResult: {
                    decision,
                    techStack,
                    notes,
                    estimation: estimationDays || null,
                    analystName: user?.name || null,
                    submittedAt: new Date().toISOString(),
                    uploadedDocs: uploadedDocIds,
                },
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
            setUploadedFiles([]);
        } catch (err) {
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

            {/* Panel Persetujuan SIT (PM / Analyst Pengembangan) */}
            {sitProjects.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-4 py-3 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
                        <h3 className="font-bold text-teal-800 text-sm flex items-center gap-2">
                            <ShieldCheck size={16} /> Persetujuan SIT
                        </h3>
                        <span className="text-[10px] font-bold text-teal-600 bg-white px-2 py-0.5 rounded-full border border-teal-200">
                            {sitProjects.length} proyek
                        </span>
                    </div>
                    <div className="p-3 space-y-2">
                        <p className="text-[11px] text-gray-500">
                            Kelengkapan persetujuan SIT dari <strong>Developer</strong>, <strong>PM / Analyst Pengembangan</strong>, dan <strong>Development Lead</strong>. Berikan persetujuan Anda jika Anda adalah PM proyek.
                        </p>
                        {sitProjects.map(p => {
                            const ap = p.sitUatData?.sit3_approvals || p.sit_uat_data?.sit3_approvals || {};
                            const devList = ap?.developer?.developers || [];
                            const requiredDev = ap?.developer?.required ?? 0;
                            const devDone = requiredDev > 0 && devList.length >= requiredDev;
                            const pmDone = ap?.pm?.approved === true;
                            const leadDone = ap?.development_lead?.approved === true;
                            const isMyProject = p.pm_id != null && Number(p.pm_id) === Number(user?.id);
                            return (
                                <div key={p.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-xs truncate">{p.name}</p>
                                            <p className="text-[10px] text-gray-400">{p.reqId || p.req_id || `REQ-${p.id}`}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => navigate(`/pm/tasks/${p.id}`)}
                                                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                                            >
                                                <Eye size={13} /> Lihat Detail
                                            </button>
                                            {isMyProject && !pmDone && (
                                                <button
                                                    onClick={() => handleSitApproval(p.id)}
                                                    disabled={sitApprovingId === p.id}
                                                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                                                >
                                                    {sitApprovingId === p.id ? (
                                                        <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                                                    ) : (
                                                        <><CheckCircle2 size={14} /> Setujui SIT</>
                                                    )}
                                                </button>
                                            )}
                                            {isMyProject && pmDone && (
                                                <span className="px-3 py-2 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-xl border border-emerald-200 flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> Anda telah setujui
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        <div className={`p-2 rounded-lg border text-center ${devDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                            <p className="text-[9px] font-bold text-gray-500 uppercase">Developer</p>
                                            <p className={`text-[10px] font-bold mt-0.5 ${devDone ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                {devList.length}/{requiredDev} {devDone ? '✓' : ''}
                                            </p>
                                        </div>
                                        <div className={`p-2 rounded-lg border text-center ${pmDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                            <p className="text-[9px] font-bold text-gray-500 uppercase">PM / Analis Dev</p>
                                            <p className={`text-[10px] font-bold mt-0.5 ${pmDone ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                {pmDone ? '✓ Disetujui' : 'Menunggu'}
                                            </p>
                                        </div>
                                        <div className={`p-2 rounded-lg border text-center ${leadDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                            <p className="text-[9px] font-bold text-gray-500 uppercase">Dev Lead</p>
                                            <p className={`text-[10px] font-bold mt-0.5 ${leadDone ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                {leadDone ? '✓ Disetujui' : 'Menunggu'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Top Filter Control Bar */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-[#00529C]" />
                    <span className="text-sm font-bold text-gray-800">Filter Antrean Proyek:</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {(user?.role === 'super_admin' || user?.role === 'lead_group' || user?.role === 'development_lead') && (
                        <>
                            <button
                                onClick={() => setSelectedAnalystFilter('ALL')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    selectedAnalystFilter === 'ALL'
                                        ? 'bg-[#1a365d] text-white shadow-xs'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                🌐 Semua Proyek Global
                            </button>

                            <select
                                value={['ALL', 'MY_PROJECTS'].includes(selectedAnalystFilter) ? '' : selectedAnalystFilter}
                                onChange={(e) => setSelectedAnalystFilter(e.target.value || 'ALL')}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-700 outline-none focus:border-[#00529C]"
                            >
                                <option value="">-- Filter Per Dev Analis (PM) --</option>
                                {devAnalystList.map(a => (
                                    <option key={a.id} value={a.name}>{a.name}</option>
                                ))}
                            </select>
                        </>
                    )}

                    <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#00529C] text-white shadow-xs">
                        👤 Proyek Tugas Saya
                    </span>
                </div>
            </div>

            {/* Content Body (Standard 2-Column Split Layout - Equalized Height) */}
            <div className="flex flex-col lg:flex-row gap-6 items-stretch min-h-[650px]">
                {/* LEFT PANEL: Antrean Tugas Analyst Dev */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden shrink-0 min-h-[600px] flex-1">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-slate-50/60">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Tugas Kajian Teknis</h2>
                            <p className="text-xs text-gray-500 mt-0.5">{reviewQueue.length} proyek dalam antrean</p>
                        </div>
                    </div>
                    <div className="p-3 border-b border-gray-100 shrink-0">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={projectSearch}
                                onChange={(e) => setProjectSearch(e.target.value)}
                                placeholder="Cari proyek..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs focus:ring-2 focus:ring-[#00529C]/20 focus:border-[#00529C] outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/40 flex flex-col justify-start min-h-[500px]">
                        {applyProjectSearch(reviewQueue).length === 0 ? (
                            <div className="p-8 text-center text-gray-400 my-auto">
                                <CheckCircle2 size={36} className="mx-auto mb-2 opacity-50 text-emerald-600" />
                                <h4 className="text-xs font-bold text-gray-700">Tidak Ada Proyek Menunggu Kajian</h4>
                                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                                    Belum ada proyek yang ditugaskan oleh Ketua Grup Pengembangan.
                                </p>
                            </div>
                        ) : (
                            applyProjectSearch(reviewQueue).map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProject(project)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${selectedProject?.id === project.id
                                            ? 'bg-blue-50/70 border-[#00529C] shadow-md ring-2 ring-blue-100'
                                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-xs'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                            {project.req_id || project.reqId || project.id}
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={project.type} deadline={project.rbbDeadline} /><ProjectTypeBadge type={project.project_type} /></div>
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-sm leading-snug line-clamp-2">
                                        {project.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 line-clamp-2">{project.description}</p>
                                    
                                    {(project.leadNote || project.latest_note) && (
                                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                                            <span className="font-bold block text-[10px] text-amber-700 uppercase">Arahan Dev Lead:</span>
                                            <p className="italic truncate">{project.leadNote || project.latest_note}</p>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                                        <span>Peminta: <strong>{project.division}</strong></span>
                                        <div className="flex items-center gap-2">
                                            {(project.deadline || project.current_stage_deadline) && (
                                                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <Clock size={10} /> Deadline: {new Date(project.deadline || project.current_stage_deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </span>
                                            )}
                                            <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                                                <Clock size={10} /> Sedang Analisa
                                            </span>
                                        </div>
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
                                        <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={selectedProject.type} deadline={selectedProject.rbbDeadline} /><ProjectTypeBadge type={selectedProject.project_type} /></div>
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
                                        <MessageSquare size={16} className="text-[#00529C]" />
                                        Pesan &amp; Arahan Khusus dari Ketua Grup Pengembangan (Lead Dev)
                                    </p>
                                    <div className="bg-white p-3 rounded-lg border border-blue-100 text-xs">
                                        <p className="text-gray-800 font-medium italic text-[11px] sm:text-xs leading-relaxed">
                                            "{selectedProject.devLeadNote || selectedProject.leadNote || selectedProject.latest_note || selectedProject.assignmentNote || 'Tolong kaji kelayakan arsitektur teknis IT, pola integrasi middleware, struktur spesifikasi sistem, serta tentukan estimasi waktu pengerjaan.'}"
                                        </p>
                                        {selectedProject.assignedAnalystAt && (
                                            <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
                                                Ditugaskan pada: {new Date(selectedProject.assignedAnalystAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                        {(selectedProject.deadline || selectedProject.current_stage_deadline) && (
                                            <p className="text-[10px] text-amber-700 mt-1 font-mono font-bold">
                                                Target selesai: {new Date(selectedProject.deadline || selectedProject.current_stage_deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* 1. Dokumen Kelengkapan Proyek (BRD & FSD Perencanaan) */}
                                <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                                    <h3 className="text-xs font-extrabold text-[#1a365d] uppercase tracking-wider flex items-center gap-1.5">
                                        <FolderOpen size={16} className="text-[#00529C]" />
                                        1. Berkas &amp; Dokumen SDLC Proyek (Semua Tahap: Inisiasi &amp; Perencanaan)
                                    </h3>
                                    <div className="space-y-2">
                                        {resolveAllProjectDocs(selectedProject).map((doc, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-white hover:border-blue-300 transition-colors shadow-2xs">
                                                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] ${getDocIconStyle(doc.name || '')}`}>
                                                        {getDocExtLabel(doc.name || '')}
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
                                                        className="px-3 py-1.5 border border-[#00529C] text-[#00529C] hover:bg-blue-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
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
                                                        className="p-1.5 text-gray-500 hover:text-[#00529C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
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
                                        <Cpu size={16} className="text-[#00529C]" />
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
                                                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#00529C] outline-none"
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
                                                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#00529C] outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                Target SIT Dilakukan
                                            </label>
                                            <input
                                                type="date"
                                                value={estimationDays}
                                                onChange={(e) => setEstimationDays(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-[#00529C] outline-none"
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
                                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 focus:border-[#00529C] outline-none leading-relaxed"
                                            />
                                        </div>

                                        {/* Upload Berkas FSD Dev / Spesifikasi Arsitektur (Multi-file) */}
                                        <div className="space-y-2 pt-2 border-t border-blue-100">
                                            <label className="block text-xs font-bold text-gray-700">
                                                Unggah Dokumen Kajian Arsitektur Teknis (Opsional)
                                            </label>

                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-blue-200 bg-white p-4 rounded-xl text-center cursor-pointer hover:bg-blue-50/50 transition-colors flex flex-col items-center justify-center gap-2"
                                            >
                                                <Upload size={20} className="text-[#00529C]" />
                                                <span className="text-xs font-semibold text-gray-700">
                                                    Klik untuk unggah satu/beberapa berkas (PDF, Excel, Gambar, ZIP — maks 5MB/file)
                                                </span>
                                                <span className="text-[10px] text-gray-400">Setelah diunggah, pilih tipe dokumen untuk tiap berkas.</span>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    multiple
                                                />
                                            </div>

                                            {/* Daftar Berkas Terunggah */}
                                            {uploadedFiles.length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pilih tipe dokumen untuk tiap berkas:</span>
                                                    </div>
                                                    {uploadedFiles.map((uf, idx) => (
                                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-blue-200 bg-blue-50/60 rounded-xl gap-2">
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] ${getDocIconStyle(uf.name || '')}`}>
                                                                    {getDocExtLabel(uf.name || '')}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-gray-800 truncate">{uf.name}</p>
                                                                    <p className="text-[11px] text-gray-500">{uf.size} • Asli: {uf.originalName}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewDoc(uf)}
                                                                    className="px-2.5 py-1 border border-[#00529C] text-[#00529C] hover:bg-blue-50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                    title="Pratinjau Dokumen"
                                                                >
                                                                    <Eye size={13} /> Pratinjau
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const rawUrl = uf.url || getFileFromStore(uf.name);
                                                                        const fileName = uf.name || 'Dokumen_SDLC.pdf';
                                                                        if (rawUrl) {
                                                                            const link = document.createElement('a');
                                                                            link.href = rawUrl;
                                                                            link.download = fileName;
                                                                            document.body.appendChild(link);
                                                                            link.click();
                                                                            document.body.removeChild(link);
                                                                            toast.success(`Mengunduh file "${fileName}"...`);
                                                                        } else {
                                                                            toast.error('Berkas belum tersedia untuk diunduh.');
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                                    title="Unduh Dokumen"
                                                                >
                                                                    <Download size={13} /> Unduh
                                                                </button>
                                                                <select
                                                                    value={uf.doc_type || 'ARSITEKTUR'}
                                                                    onChange={(e) => handleFileTypeChange(idx, e.target.value)}
                                                                    className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#00529C] outline-none cursor-pointer"
                                                                >
                                                                    {DEV_ANALYST_DOC_TYPES.map((dt) => (
                                                                        <option key={dt} value={dt}>{dt}</option>
                                                                    ))}
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeUploadedFile(idx)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Hapus Berkas"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
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
