import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
    Download,
    Eye,
    CheckCircle,
    Clock,
    Send,
    Save,
    FileText,
    Filter,
    Search,
    Upload,
    CloudUpload,
    Trash2,
    MessageSquare,
    ShieldCheck,
} from 'lucide-react';
import { useProjects } from '../../contexts/ProjectContext';
import { saveFileToStore, getProjectRealDocuments } from '../../utils/projectDocuments';
import { documentService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import toast from 'react-hot-toast';
import { generateDocumentName, DOCUMENT_TYPES, formatFileSize, formatDocSizeLabel, getDocExtLabel, getDocIconStyle } from '../../utils/documentNaming';
import { useNow } from '../../hooks/useNow';
import { PLANNING_QA_GROUP_LABEL } from '../../constants/roles';

export default function WorkspaceAnalyst() {
    const { user } = useAuth();
    const { projects, updateProject, isLoading } = useProjects();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();

    // Perkiraan tenggat kajian dihitung dari waktu sekarang. Nilainya diambil
    // lewat hook agar tidak dipanggil langsung di dalam render.
    const nowMs = useNow();

    const [previewDoc, setPreviewDoc] = useState(null);

    // ── Monitor Persetujuan SIT (read-only untuk System Analyst perencanaan) ──
    // Approval SIT dilakukan oleh Developer, PM (Analyst Pengembangan), & Development Lead.
    const sitProjects = (projects || []).filter(p => {
        const st = String(p.status || '').toUpperCase();
        return st === 'SIT_IN_PROGRESS' || st === 'SIT_REVISION';
    });

    // Role pengawas: berwenang melihat antrean seluruh analis dan menyaringnya.
    // Analis biasa tidak punya kendali ini karena backend sudah membatasi datanya
    // pada proyek yang didisposisikan kepadanya (ProjectAccessService).
    const canFilterAcrossAnalysts = user?.role === 'super_admin' || user?.role === 'lead_group';

    // 'ALL' berarti "seluruh data yang dikirim backend", bukan "seluruh proyek".
    // Untuk analis biasa, backend hanya mengirim proyek miliknya, sehingga nilai ini
    // tidak lagi membocorkan antrean analis lain.
    const [selectedAnalystFilter, setSelectedAnalystFilter] = useState('ALL');

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

    // Antrean dasar: proyek fase review, belum disaring per analis.
    // Dipisah dari reviewQueue supaya daftar pilihan analis tidak menyusut setiap kali
    // satu analis dipilih — kalau diturunkan dari hasil penyaringan, opsi lain hilang
    // dan filter tidak bisa dikembalikan lewat dropdown.
    const reviewQueueBase = useMemo(() => projects.filter(p =>
        p.status === 'IN_REVIEW' ||
        p.status === 'PLANNING_ANALYSIS' ||
        p.status === 'ANALYSIS_IN_PROGRESS'
    ), [projects]);

    // Nama analis untuk dropdown filter, diambil dari data nyata — bukan daftar tetap —
    // agar analis baru langsung muncul dan analis nonaktif tidak tertinggal di UI.
    const analystOptions = useMemo(() => {
        const names = reviewQueueBase
            .map(getAnalystName)
            .filter(Boolean);
        return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'id'));
    }, [reviewQueueBase]);

    // Filter antrean proyek yang HANYA SUDAH ditugaskan oleh Lead Perencanaan (Status IN_REVIEW)
    const reviewQueue = useMemo(() => {
        let list = reviewQueueBase;

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
    }, [reviewQueueBase, selectedAnalystFilter, user]);


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

    // Hasil filter dipakai dua kali (render kartu + teks empty state), jadi dihitung sekali.
    const visibleQueue = applyProjectSearch(reviewQueue);

    // Teks empty state antrean. Kata kunci pencarian diprioritaskan supaya hasil nol
    // tidak terbaca sebagai "antrean memang kosong".
    const queueEmptyCopy = projectSearch.trim()
        ? {
            title: 'Proyek tidak ditemukan',
            description: `Tidak ada proyek pada antrean ini yang cocok dengan "${projectSearch.trim()}".`,
        }
        : {
            title: 'Antrean bersih',
            description: 'Tidak ada tugas review yang menunggu di antrean Anda saat ini.',
        };

    const [decision, setDecision] = useState('');
    const [notes, setNotes] = useState('');
    const [estimationDays, setEstimationDays] = useState('');
    // Unggahan dari panel review analyst selalu berjenis FSD; halaman ini tidak
    // menyediakan pemilih jenis dokumen, jadi nilainya konstan (bukan state).
    const selectedDocType = 'FSD';
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const fileInputRef = useRef(null);

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
            const docTypeCode = DOCUMENT_TYPES[selectedDocType]?.code || 'FSD';
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
                uploadedAt: new Date().toISOString()
            };
            saveFileToStore(autoDocName, objectUrl);
            if (selectedProject?.id) saveFileToStore(`fsd_${selectedProject.id}`, objectUrl);
            newFiles.push(fileObj);
        });
        
        setUploadedFiles(prev => [...prev, ...newFiles]);
        // Berkas baru dipilih di peramban, belum dikirim ke server. Unggahan
        // sebenarnya terjadi di handleSubmit, jadi pesan di sini tidak boleh
        // menyatakan "berhasil diunggah".
        if (newFiles.length > 0) {
            toast.success(`${newFiles.length} dokumen dipilih. Berkas diunggah saat tombol "Kirim & Lanjutkan" ditekan.`);
        }
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

    const handleDownloadFile = (doc) => {
        if (!doc) return;
        const rawUrl = doc.url || doc.fileUrl || doc.dataUrl;
        const fileName = doc.name || doc.file_name || 'Dokumen_SDLC.pdf';

        if (rawUrl) {
            const link = document.createElement('a');
            link.href = rawUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`Mengunduh file "${fileName}"...`);
        } else {
            const textContent = `PT BANK NAGARI - DOKUMEN RESMI SDLC\n=======================================\nNama Dokumen: ${fileName}\nProyek: ${selectedProject?.name || 'Proyek SDLC'}\nPengusul: ${selectedProject?.division || 'Divisi Inisiator'}\nTanggal: ${new Date().toLocaleDateString('id-ID')}\nStatus: Terverifikasi Quality Gate SDLC Bank Nagari`;
            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName.endsWith('.pdf') ? fileName.replace('.pdf', '_ringkasan.txt') : `${fileName}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success(`Mengunduh berkas ringkasan "${fileName}"...`);
        }
    };

    // Format tanggal aman cegah Invalid Date
    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === 'TBD') return 'Terbaru';
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) return 'Terbaru';
        return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    };

    const handleSubmit = async () => {
        if (!decision) {
            toast.error('Pilih keputusan review!');
            return;
        }
        const isApproved = decision.includes('Disetujui');
        if (!isApproved && !notes.trim()) {
            toast.error('Alasan penolakan dan catatan perbaikan wajib diisi agar pengaju proyek tahu penyebab ditolak!');
            return;
        }
        if (!notes.trim()) {
            toast.error('Masukkan catatan analisis!');
            return;
        }
        setIsSubmitting(true);
        
        try {
            // Status akhir mengikuti keputusan analis. "Ditolak" menjadi REJECTED, bukan
            // ANALYSIS_APPROVED: analis berwenang menolak langsung (matriks IN_REVIEW ->
            // REJECTED, dan rolePermissions REJECTED memuat `analyst`). Sebelumnya nilai
            // ini di-hardcode ANALYSIS_APPROVED sehingga penolakan justru meloloskan
            // proyek ke fase berikutnya.
            const finalStatus = isApproved ? 'ANALYSIS_APPROVED' : 'REJECTED';
            const uploadedDocIds = [];
            const failedUploads = [];

            // Upload semua dokumen ke backend
            if (uploadedFiles.length > 0 && selectedProject?.id) {
                for (const uf of uploadedFiles) {
                    if (!uf.rawFile) continue;
                    const docTypeCode = uf.doc_type || 'FSD';
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
                        failedUploads.push(uf.originalName || uf.name);
                        toast.error(`Gagal mengunggah "${uf.originalName}": ${uploadErr.message}`);
                    }
                }
            }

            await updateProject(selectedProject.id, {
                status: finalStatus,
                analystResult: {
                    decision,
                    notes,
                    // Tanggal ISO dari `input type="date"`. Cadangannya dulu berupa teks
                    // "30 hari pengerjaan" — nilai itu masuk ke field yang dibaca sebagai
                    // tanggal oleh WorkspaceDevLead dan TaskDetail, sehingga muncul sebagai
                    // "Invalid Date". Bila analis tidak mengisi tanggal, biarkan kosong.
                    estimation: estimationDays || null,
                    uploadedDocs: uploadedDocIds,
                },
            });

            addNotification(
                isApproved ? 'Kajian Analyst Selesai' : 'Proyek Ditolak Analyst',
                isApproved
                    ? `Kajian teknis untuk ${selectedProject?.name} telah dirampungkan oleh Analyst (${user?.name || 'Analis SDLC'}) dan dikirim ke Lead Perencanaan untuk Verifikasi Hasil Analisis.`
                    : `Proyek ${selectedProject?.name} DITOLAK pada kajian teknis Analyst (${user?.name || 'Analis SDLC'}). Alasan penolakan dan catatan perbaikan telah dicatat untuk pengaju.`,
                isApproved ? 'success' : 'warning',
                isApproved ? '/workspace/lead?tab=verification' : '/workspace/analyst'
            );
            if (isApproved) {
                toast.success(`Kajian teknis ${selectedProject?.name} selesai! Dikirim ke Lead Perencanaan untuk Verifikasi.`);
            } else {
                toast.success(`Proyek ${selectedProject?.name} ditolak. Alasan penolakan tersimpan dan pengaju diberi tahu.`);
            }
            // Kajian tetap terkirim meski ada berkas yang gagal diunggah, tetapi
            // penggunanya harus tahu berkas mana yang belum masuk Document Vault.
            if (failedUploads.length > 0) {
                toast.error(`${failedUploads.length} dokumen belum tersimpan di Document Vault: ${failedUploads.join(', ')}. Unggah ulang dari menu Dokumen.`);
            }
            setSelectedProject(null);
            setDecision('');
            setNotes('');
            setEstimationDays('');
            setUploadedFiles([]);
        } catch (err) {
            toast.error('Terjadi kesalahan saat pengiriman: ' + (err?.message || 'Error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'In Progress':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'New':
                return 'bg-gray-100 text-gray-600 border-gray-200';
            case 'ANALYSIS_APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'READY_FOR_DEVELOPMENT': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'IN_DEVELOPMENT': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    // Hapus full-screen empty state return

    return (
        <div className="flex-1 overflow-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-extrabold text-gray-800">Workspace Analis Perencanaan</h1>
                    {/* Nama grup ditampilkan supaya jelas halaman ini dan Workspace QA
                        dipegang orang yang sama, hanya pada fase yang berbeda. */}
                    <span className="px-2.5 py-1 rounded-full bg-[#00529C]/10 text-[#00529C] text-[11px] font-bold border border-[#00529C]/20">
                        {PLANNING_QA_GROUP_LABEL}
                    </span>
                </div>
                <p className="text-gray-500 mt-1 text-sm">
                    Review kelayakan dokumen inisiasi (BRD) dan buat keputusan teknis sistem. Fase 3
                    (Pengujian QA) untuk grup yang sama ada di menu <span className="font-semibold">Tugas QA Saya</span>.
                </p>
            </div>

            {/* Panel Persetujuan SIT (System Analyst) */}
            {sitProjects.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-4 py-3 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
                        <h3 className="font-bold text-teal-800 text-sm flex items-center gap-2">
                            <ShieldCheck size={16} /> Status Persetujuan SIT
                        </h3>
                        <span className="text-[10px] font-bold text-teal-600 bg-white px-2 py-0.5 rounded-full border border-teal-200">
                            {sitProjects.length} proyek
                        </span>
                    </div>
                    <div className="p-3 space-y-2">
                        <p className="text-[11px] text-gray-500">
                            Pantau kelengkapan persetujuan SIT dari <strong>Developer</strong>, <strong>PM / Analyst Pengembangan</strong>, dan <strong>Development Lead</strong>.
                        </p>
                        {sitProjects.map(p => {
                            const ap = p.sitUatData?.sit3_approvals || p.sit_uat_data?.sit3_approvals || {};
                            const devList = ap?.developer?.developers || [];
                            const requiredDev = ap?.developer?.required ?? 0;
                            // `developers[]` menyimpan seluruh persetujuan yang pernah
                            // tercatat, termasuk milik developer yang sudah keluar dari
                            // tim, jadi panjangnya bukan ukuran kelengkapan.
                            // `approvedCount` dihitung backend hanya dari penyetuju yang
                            // masih wajib. Cadangan `devList.length` dipakai untuk data
                            // lama yang belum memuat field itu.
                            const approvedDev = ap?.developer?.approvedCount ?? devList.length;
                            const devDone = requiredDev > 0 && approvedDev >= requiredDev;
                            const pmDone = ap?.pm?.approved === true;
                            const leadDone = ap?.development_lead?.approved === true;
                            return (
                                <div key={p.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-xs truncate">{p.name}</p>
                                            <p className="text-[10px] text-gray-400">{p.reqId || p.req_id || `REQ-${p.id}`}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/pm/tasks/${p.id}`)}
                                            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <Eye size={13} /> Lihat Detail
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        <div className={`p-2 rounded-lg border text-center ${devDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                            <p className="text-[9px] font-bold text-gray-500 uppercase">Developer</p>
                                            <p className={`text-[10px] font-bold mt-0.5 ${devDone ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                {approvedDev}/{requiredDev} {devDone ? '✓' : ''}
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
                    {/* Hanya super_admin & lead_group yang bisa filter antar analyst */}
                    {canFilterAcrossAnalysts && (
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
                                <option value="">-- Filter Per System Analyst --</option>
                                {analystOptions.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </>
                    )}

                    {/* Analis biasa: penanda bahwa antrean yang tampil memang hanya miliknya.
                        Tidak ditampilkan untuk role pengawas karena antrean mereka lintas analis. */}
                    {! canFilterAcrossAnalysts && (
                        <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#00529C] text-white shadow-xs">
                            👤 Proyek Tugas Saya
                        </span>
                    )}
                </div>
            </div>

            {/* Split Layout
                Grid, bukan flex-row: lebar kolom diatur track (1fr + 2fr) sehingga gap
                dipotong otomatis dan tidak perlu aritmetika w-1/3 + w-2/3 yang saling
                menarik ketika salah satu panel memanjang. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT PANEL: Inbox
                    Wrapper luar hanya berperan sebagai kotak ukur. Pada layar lg panel di
                    dalamnya dipasang absolute + inset-0, sehingga tingginya tidak lagi ikut
                    menentukan tinggi baris grid: tinggi baris murni ditentukan panel kanan
                    (form review), lalu panel antrean menyalin tinggi itu. Hasilnya kedua
                    kolom selalu rata atas-bawah — berhenti tepat di bawah tombol Simpan
                    Draft / Kirim & Lanjutkan — dan ketika daftar proyek lebih panjang yang
                    men-scroll adalah area daftarnya, bukan panel atau lamannya.
                    Di bawah lg layout menumpuk satu kolom, jadi panel kembali mengalir
                    normal dengan batas max-h-[70vh] agar daftar tetap punya scroll sendiri. */}
                <div className="lg:col-span-1 lg:relative">
                    <div className="flex flex-col overflow-hidden bg-white border border-gray-200 rounded-2xl shadow-sm max-h-[70vh] lg:max-h-none lg:absolute lg:inset-0">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-slate-50/60">
                            <div>
                                <h2 className="text-base font-bold text-gray-800">Tugas Review</h2>
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
                        {/* Satu-satunya area yang men-scroll. min-h-0 wajib agar flex item boleh
                            menyusut di bawah tinggi kontennya, syarat overflow-y-auto bekerja. */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-3 bg-gray-50/40">
                            {isLoading && visibleQueue.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-2 py-10">
                                    <LoadingSpinner size="sm" />
                                    <p className="text-xs font-medium text-gray-500">Memuat antrean proyek...</p>
                                </div>
                            ) : visibleQueue.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <EmptyState
                                        icon={projectSearch.trim() ? Search : undefined}
                                        title={queueEmptyCopy.title}
                                        description={queueEmptyCopy.description}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {visibleQueue.map((project) => (
                                        <div
                                            key={project.id}
                                            onClick={() => {
                                                setSelectedProject(project);
                                                setEstimationDays('');
                                                setDecision('');
                                                setNotes('');
                                                setUploadedFiles([]);
                                            }}
                                            className={`p-4 rounded-xl cursor-pointer transition-all relative overflow-hidden group ${
                                                selectedProject?.id === project.id
                                                    ? 'bg-white border-2 border-[#00529C] shadow-md'
                                                    : 'bg-white border border-gray-200 hover:border-[#00529C]/40 hover:shadow-md'
                                            }`}
                                        >
                                            {selectedProject?.id === project.id && (
                                                <div className="absolute left-0 top-0 w-1 h-full bg-[#00529C] rounded-l-xl" />
                                            )}
                                            <div className="flex justify-between items-start mb-2.5">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(project.status)}`}>
                                                    {project.status}
                                                </span>
                                                <span className="text-[10px] flex items-center gap-1 font-bold text-amber-700">
                                                    <Clock size={11} className="text-amber-600" />
                                                    {(() => {
                                                        if (project.deadline || project.current_stage_deadline) {
                                                            return `Deadline: ${formatDate(project.deadline || project.current_stage_deadline)}`;
                                                        }
                                                        // Fallback: 14 hari sejak di-submit jika lead tidak mengisi deadline eksplisit
                                                        const baseDate = new Date(project.assignedAnalystAt || project.submittedAt || nowMs);
                                                        const autoDeadline = new Date(baseDate.setDate(baseDate.getDate() + 14)).toISOString();
                                                        return `Deadline: ${formatDate(autoDeadline)}`;
                                                    })()}
                                                </span>
                                            </div>
                                            <div className="mb-2"><div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={project.type} deadline={project.rbbDeadline} /><ProjectTypeBadge type={project.project_type} /></div></div>
                                            <h4 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-[#00529C] transition-colors">{project.name}</h4>
                                            <p className="text-xs text-gray-500 mb-2.5">Peminta: {project.division}</p>
                                            {(project.leadNote || project.leadNotes || project.notes || project.dispositionNotes || project.assignmentNote || project.latest_note) && (
                                                <div className="bg-amber-50/90 p-2.5 rounded-lg border border-amber-200 text-xs">
                                                    <p className="text-[11px] italic text-amber-900 flex items-start gap-1.5 font-medium leading-relaxed">
                                                        <MessageSquare size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                                        "{project.leadNote || project.leadNotes || project.notes || project.dispositionNotes || project.assignmentNote || project.latest_note}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: Review Form — penentu tinggi baris grid */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
                    {!selectedProject ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-scale-in min-h-[400px]">
                            <div className="w-24 h-24 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 shadow-sm">
                                <CheckCircle size={48} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Semua Proyek Selesai Direview</h2>
                            <p className="text-gray-500 max-w-md mx-auto">
                                Tidak ada tugas review yang menunggu di antrean Anda saat ini.
                            </p>
                            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-3 inline-block text-emerald-700 text-sm font-medium">
                                Antrean kosong — Luar biasa! 🚀
                            </div>
                        </div>
                    ) : (
                        <>
                    {/* Header Detail */}
                    <div className="p-6 border-b border-gray-200 bg-gray-50/50 shrink-0">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-xs text-gray-500 font-bold tracking-wider uppercase block mb-1">Detail Proyek</span>
                                <h2 className="text-2xl font-bold text-gray-800">{selectedProject.name}</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-blue-50 text-[#00529C] font-bold px-3 py-1 rounded-lg border border-blue-100">
                                    {selectedProject.id}
                                </span>
                            </div>
                        </div>

                        {/* Target Selesai Analisis dari Lead */}
                        {(() => {
                            let dlDateStr = selectedProject.deadline || selectedProject.current_stage_deadline;
                            if (!dlDateStr) {
                                const baseDate = new Date(selectedProject.assignedAnalystAt || selectedProject.submittedAt || nowMs);
                                dlDateStr = new Date(baseDate.setDate(baseDate.getDate() + 14)).toISOString();
                            }
                            const dl = new Date(dlDateStr);
                            const isValid = !isNaN(dl.getTime());
                            
                            return isValid && (
                                <div className="flex items-center gap-2 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs">
                                    <Clock size={14} className="text-amber-700 shrink-0" />
                                    <span className="text-amber-900 font-bold">
                                        Target selesai analisis: {formatDate(dlDateStr)}
                                    </span>
                                    {(() => {
                                        const diffDays = Math.ceil((dl - new Date()) / (1000 * 60 * 60 * 24));
                                        if (diffDays < 0) return <span className="font-bold text-red-600">(Terlambat {Math.abs(diffDays)} hari)</span>;
                                        if (diffDays === 0) return <span className="font-bold text-red-600">(Hari ini!)</span>;
                                        return <span className="text-amber-700 font-medium">({diffDays} hari lagi)</span>;
                                    })()}
                                </div>
                            );
                        })()}

                        {/* Pesan & Catatan Disposisi dari Lead Perencanaan TI */}
                        {(selectedProject.leadNote || selectedProject.leadNotes || selectedProject.notes || selectedProject.dispositionNotes || selectedProject.assignmentNote || selectedProject.latest_note) ? (
                            <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-xl mt-4 space-y-1.5 shadow-2xs">
                                <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                                    <MessageSquare size={16} className="text-amber-600" />
                                    Pesan &amp; Catatan Disposisi dari Lead Perencanaan TI:
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-amber-100 text-xs">
                                    <p className="text-gray-800 font-semibold italic text-xs sm:text-sm leading-relaxed">
                                        "{selectedProject.leadNote || selectedProject.leadNotes || selectedProject.notes || selectedProject.dispositionNotes || selectedProject.assignmentNote || selectedProject.latest_note}"
                                    </p>
                                    {(selectedProject.assignedAnalyst || selectedProject.analyst) && (
                                        <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
                                            Disposisi untuk Analyst: <span className="font-bold text-gray-700">{getAnalystName(selectedProject)}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl mt-4 text-xs text-slate-500 flex items-center gap-2 italic">
                                <MessageSquare size={14} className="text-slate-400 shrink-0" />
                                <span>Tidak ada catatan tambahan khusus dari Lead Perencanaan untuk penugasan proyek ini.</span>
                            </div>
                        )}
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Documents Inisiasi Peminta (Dynamic & Interactive) */}
                        <div className="mb-6 border-b border-gray-200 pb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <FileText size={20} className="text-[#00529C]" />
                                Dokumen Inisiasi Peminta
                            </h3>
                            <div className="space-y-3">
                                {(() => {
                                    const realDocs = getProjectRealDocuments(selectedProject);
                                    if (realDocs.length > 0) {
                                        return realDocs.map((doc, idx) => (
                                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50 hover:border-gray-300 transition-all gap-3">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${getDocIconStyle(doc.name || '')}`}>
                                                        {getDocExtLabel(doc.name || '')}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-800 text-sm">{doc.name}</p>
                                                        <p className="text-xs text-gray-500">{formatDocSizeLabel(doc)} • {doc.type || 'Dokumen Inisiasi'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewDoc(doc)}
                                                        className="px-3.5 py-2 border border-[#00529C] text-[#00529C] rounded-xl font-semibold hover:bg-blue-50 transition-colors flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                                                    >
                                                        <Eye size={15} />
                                                        View &amp; Baca
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadFile(doc)}
                                                        className="px-3.5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                                                        title="Unduh Dokumen"
                                                    >
                                                        <Download size={15} />
                                                        Unduh
                                                    </button>
                                                </div>
                                            </div>
                                        ));
                                    }
                                    return (
                                        <div className="p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50 text-center text-xs text-gray-400 italic">
                                            Peminta belum mengunggah dokumen inisiasi untuk proyek ini.
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Decision Form */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Hasil Review &amp; Keputusan Teknis</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Keputusan Review <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={decision}
                                        onChange={(e) => setDecision(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] appearance-none transition-all"
                                    >
                                        <option value="">Pilih Keputusan...</option>
                                        <option value="Disetujui (Layak Develop)">Disetujui (Layak Develop)</option>
                                        <option value="Disetujui dengan Penyesuaian">Disetujui dengan Penyesuaian</option>
                                        <option value="Ditolak">Ditolak</option>
                                    </select>
                                </div>

                                {/* Klasifikasi Tipe Proyek (Read-only dari Inisiasi Divisi) */}
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                        Klasifikasi Tipe Proyek SDLC
                                    </span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={selectedProject?.type} deadline={selectedProject?.rbbDeadline} /><ProjectTypeBadge type={selectedProject?.project_type} /></div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Estimasi Target Selesai Pengerjaan
                                    </label>
                                    <input
                                        type="date"
                                        value={estimationDays}
                                        onChange={(e) => setEstimationDays(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Catatan Analisis Teknis <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Masukkan ringkasan analisis teknis, temuan, atau instruksi penyesuaian..."
                                        rows={4}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Upload FSD */}
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <Upload size={20} className="text-[#00529C]" />
                                Unggah Dokumen Analisis Teknis &amp; Spesifikasi
                            </h3>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 hover:border-[#00529C] rounded-xl p-8 flex flex-col items-center justify-center bg-white hover:bg-blue-50/40 transition-all cursor-pointer mb-4 group"
                            >
                                <CloudUpload size={40} className="text-gray-400 group-hover:text-[#00529C] group-hover:scale-110 transition-all mb-2" />
                                <p className="font-semibold text-gray-700 group-hover:text-[#00529C] transition-colors">Tarik &amp; Lepas file di sini, atau klik untuk unggah</p>
                                <p className="text-xs text-gray-500 mt-1">Format Berkas: PDF, Excel, Gambar, ZIP (Maksimal 5MB per file)</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    multiple
                                />
                            </div>

                            {uploadedFiles.length > 0 && (
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Format Penamaan:</span>
                                    <span className="text-[10px] text-gray-400 italic">XXX/GPTD/TIPE/TT-BULANTAHUN_NamaProyek (nomor XXX otomatis)</span>
                                </div>
                            )}

                            {/* Dynamic Uploaded Files Display */}
                            {uploadedFiles.length > 0 && (
                                <div className="space-y-2">
                                    {uploadedFiles.map((uf, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-emerald-300 bg-emerald-50 rounded-xl animate-fade-in shadow-2xs gap-2">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] ${getDocIconStyle(uf.name || '')}`}>
                                                    {getDocExtLabel(uf.name || '')}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-800 truncate">{uf.name}</p>
                                                    <p className="text-xs text-gray-500">{uf.size} • Asli: {uf.originalName}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewDoc(uf)}
                                                    className="px-2.5 py-1 border border-[#00529C] text-[#00529C] hover:bg-blue-50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Eye size={13} /> Pratinjau
                                                </button>
                                                <select
                                                    value={uf.doc_type || 'FSD'}
                                                    onChange={(e) => handleFileTypeChange(idx, e.target.value)}
                                                    className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#00529C] outline-none cursor-pointer"
                                                >
                                                    <option value="FSD">FSD</option>
                                                    <option value="ARSITEKTUR">Arsitektur</option>
                                                    <option value="BRD">BRD</option>
                                                    <option value="MEMO">Memo</option>
                                                    <option value="LAMPIRAN">Lampiran</option>
                                                    <option value="LAINNYA">Lainnya</option>
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

                    {/* Actions Footer */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/30 shrink-0 flex justify-end gap-3">
                        <button className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-all flex items-center gap-2 text-sm">
                            <Save size={16} />
                            Simpan Draft
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20 text-sm btn-shimmer disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Memproses...</>
                            ) : (
                                <><Send size={16} /> Kirim &amp; Lanjutkan</>
                            )}
                        </button>
                    </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── MODAL VIEWER DOKUMEN RESMI SDLC BANK NAGARI ── */}
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