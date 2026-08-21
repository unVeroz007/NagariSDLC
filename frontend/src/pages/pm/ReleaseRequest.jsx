import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useProjects } from '../../contexts/ProjectContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import RBBBadge from '../../components/RBBBadge';
import ProjectTypeBadge from '../../components/ProjectTypeBadge';
import toast from 'react-hot-toast';
import { generateDocumentName, DOCUMENT_TYPES, formatFileSize } from '../../utils/documentNaming';
import { PROJECT_STATUS, canRequestFinalUat } from '../../constants/projectStatus';
import {
    Rocket,
    Search,
    ShieldCheck,
    CloudUpload,
    CheckCircle,
    Send,
    Calendar,
    Clock,
    AlertCircle,
    FileText,
    Upload,
    X,
    Server,
    Building,
    User,
    Download,
    Eye,
    Copy
} from 'lucide-react';

export default function ReleaseRequest() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { projects, updateProject, isLoading } = useProjects();
    const rightPanelRef = useRef(null);

    // Filter proyek siap diajukan ke Grup INFRA.
    // Syarat: kedua jalur pengujian (QA & Keamanan Siber) sudah dinyatakan lulus,
    // dibaca dari kolom jalur qa_status/cyber_status — bukan dari status utama —
    // supaya urutan siapa yang sign-off lebih dulu tidak mengubah hasilnya.
    // PENDING_GOLIVE tetap ditampilkan karena sudah diajukan ke INFRA dan sedang
    // menunggu proses quality gate.
    const readyProjects = useMemo(() => {
        let list = projects.filter(p => {
            const st = String(p.status || '').toUpperCase();
            return canRequestFinalUat(p) || st === PROJECT_STATUS.PENDING_GOLIVE;
        });

        const isPrivileged = user?.role && ['super_admin', 'lead_group', 'head_of_it', 'development_lead'].includes(user.role);
        if (!isPrivileged && user?.id) {
            const pmId = user.id;
            list = list.filter(p => {
                const pmObjId = typeof p.pm === 'object' ? p.pm?.id : null;
                return pmObjId && pmObjId === pmId;
            });
        }

        return list;
    }, [projects, user]);


    const [selectedProject, setSelectedProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDocPreview, setSelectedDocPreview] = useState(null);

    const [formData, setFormData] = useState({
        releaseDate: '',
        downtime: '30 Menit (Pemeliharaan Terjadwal)',
        releaseNotes: '',
        rollbackProcedure: '',
        dbScriptAttached: true,
        infraTopologyVerified: true,
    });
    const [uploadedFile, setUploadedFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auto select proyek pertama
    useEffect(() => {
        if (readyProjects.length > 0 && !selectedProject) {
            setSelectedProject(readyProjects[0]);
        }
    }, [readyProjects]);

    const scrollPageToTop = () => {
        if (rightPanelRef.current) {
            rightPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const mainContainer = rightPanelRef.current?.closest('main') || document.querySelector('main');
        if (mainContainer) {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        if (selectedProject) {
            scrollPageToTop();
        }
    }, [selectedProject?.id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const MAX_SIZE = 5 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                toast.error(`Dokumen "${file.name}" ditolak karena ukurannya melebihi batas maksimal 5MB!`);
                e.target.value = '';
                return;
            }
            const ext = file.name.split('.').pop() || '';
            const autoName = generateDocumentName(
                selectedProject?.req_id || selectedProject?.id,
                DOCUMENT_TYPES.RELEASE_PLAN.code,
                selectedProject?.title || selectedProject?.name
            ) + '.' + ext;
            setUploadedFile({
                name: autoName,
                originalName: file.name,
                size: formatFileSize(file.size),
                rawFile: file,
                url: URL.createObjectURL(file),
            });
            toast.success(`File paket migrasi ${autoName} berhasil diunggah!`);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProject) {
            toast.error('Pilih proyek yang akan diajukan ke Grup INFRA terlebih dahulu!');
            return;
        }
        if (!formData.releaseDate) {
            toast.error('Tentukan target tanggal rilis / deployment produksi!');
            return;
        }

        setIsSubmitting(true);
        try {
            await updateProject(selectedProject.id, {
                status: PROJECT_STATUS.PENDING_GOLIVE,
                releaseDate: formData.releaseDate,
                downtime: formData.downtime,
                rollbackPlan: formData.rollbackProcedure,
                releaseNotes: formData.releaseNotes
            });

            addNotification(
                'Pengajuan Migrasi INFRA Berhasil',
                `Proyek ${selectedProject.name} telah diajukan ke Grup INFRA (Quality Gate).`,
                'info',
                '/quality-gate'
            );
            toast.success(`Pengajuan migrasi ke Grup INFRA untuk ${selectedProject.name} berhasil!`);
            navigate('/quality-gate');
        } catch (err) {
            toast.error(err.message || 'Gagal mengajukan rilis ke Grup INFRA.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const projectDocsList = useMemo(() => {
        if (!selectedProject) return [];
        return [
            {
                id: 1,
                name: `BRD_FSD_${selectedProject.id}_Verified.pdf`,
                type: 'BRD & FSD (Sign-off Analyst TI)',
                size: '2.4 MB',
                content: `DOKUMEN SPESIFIKASI BISNIS & FUNGSIONAL (BRD/FSD)\nProyek: ${selectedProject.name}\nID: ${selectedProject.id}\nStatus: Terverifikasi & Disetujui.`
            },
            {
                id: 2,
                name: `QA_SignOff_Report_${selectedProject.id}.pdf`,
                type: 'Laporan QA Passed (Sign-off Lead QA)',
                size: '1.9 MB',
                content: `LAPORAN VERIFIKASI PENGUJIANKA QA\nNomor: QA-SIGN/${selectedProject.id}/2026\n\nStatus: PASSED 100% (Verifikasi oleh Lead QA Siti Rahmawati).`
            },
            {
                id: 3,
                name: `Cyber_Pentest_Cleared_${selectedProject.id}.pdf`,
                type: 'Laporan Pentest Cleared (Sign-off Lead Cyber)',
                size: '2.1 MB',
                content: `LAPORAN VERIFIKASI KEAMANAN SIBER\nNomor: CYBER-PASS/${selectedProject.id}/2026\n\nStatus: PENTEST CLEARED (Disetujui oleh Lead Cyber Rian Hidayat).`
            }
        ];
    }, [selectedProject]);

    if (isLoading) {
        return <LoadingSpinner text="Memuat Laman Pengajuan Rilis INFRA..." />;
    }

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header Laman */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Form Pengajuan Migrasi &amp; Rilis ke Grup INFRA</h2>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <Rocket size={14} /> SDLC Phase 4 Infrastructure Release
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Kirimkan paket dokumen SDLC yang sudah diverifikasi oleh Lead QA &amp; Lead Cyber ke Tim Infrastruktur untuk proses Quality Gate &amp; Go-Live Production.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LIST PANEL: Proyek Siap Migrasi (Panel Kiri) */}
                <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
                    <div className="shrink-0 pb-3 border-b border-gray-100 space-y-3 mb-3">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <Server size={16} className="text-emerald-600" />
                            Pilih Proyek Selesai QA &amp; Cyber ({readyProjects.length})
                        </h3>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari ID / Nama Proyek..."
                                className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {readyProjects.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedProject(p)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                    selectedProject?.id === p.id
                                        ? 'border-2 border-emerald-600 bg-emerald-50/40 shadow-sm'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.id}</span>
                                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={p.type} /><ProjectTypeBadge type={p.project_type} /></div>
                                </div>
                                <h4 className="font-bold text-gray-800 text-xs line-clamp-1 mb-1.5">{p.name}</h4>
                                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                                    <span>{p.division}</span>
                                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{p.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FORM PANEL: Form Pengajuan ke Grup INFRA (Panel Kanan) */}
                <div ref={rightPanelRef} className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-210px)] scroll-smooth">
                    {!selectedProject ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-20">
                            <Rocket size={48} className="mb-3 text-gray-300" />
                            <p className="font-bold text-gray-600">Pilih Proyek di Panel Kiri</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Header Proyek */}
                            <div className="pb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                        {selectedProject.id}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap"><RBBBadge type={selectedProject.type} deadline={selectedProject.rbbDeadline} /><ProjectTypeBadge type={selectedProject.project_type} /></div>
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{selectedProject.name}</h3>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                    <Building size={14} className="text-gray-400" />
                                    <span>Divisi: <strong className="text-gray-700">{selectedProject.division}</strong></span>
                                    <span>•</span>
                                    <User size={14} className="text-gray-400" />
                                    <span>PM: <strong className="text-gray-700">{typeof selectedProject.pm === 'object' ? selectedProject.pm?.name : (selectedProject.pm || 'Budi Santoso')}</strong></span>
                                </p>
                            </div>

                            {/* Verification Badges (QA & Cyber Sign-off) */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <ShieldCheck size={15} className="text-emerald-600" />
                                    Status Verifikasi Sign-Off Laporan SDLC
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5">
                                        <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-emerald-900 block">QA Verified</span>
                                            <span className="text-[10px] text-emerald-700">Lulus Testing Lead QA</span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5">
                                        <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-emerald-900 block">Cyber Verified</span>
                                            <span className="text-[10px] text-emerald-700">Lulus Pentest Lead Cyber</span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5">
                                        <Server size={18} className="text-emerald-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-emerald-900 block">Infra Topology</span>
                                            <span className="text-[10px] text-emerald-700">Server &amp; DMZ Verified</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dokumen Terlampir yang Diserahkan ke Tim Infra */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <FileText size={15} className="text-[#1a365d]" />
                                        Dokumen SDLC &amp; Sign-Off yang Diserahkan ke Tim Infra ({projectDocsList.length})
                                    </span>
                                </h4>
                                <div className="space-y-2">
                                    {projectDocsList.map(doc => (
                                        <div key={doc.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <FileText size={16} className="text-emerald-600 shrink-0" />
                                                <div className="truncate">
                                                    <span className="font-bold text-gray-800 text-xs truncate block">{doc.name}</span>
                                                    <span className="text-[10px] text-gray-500">{doc.type} • {doc.size}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDocPreview(doc)}
                                                className="px-3 py-1 bg-[#1a365d] text-white rounded-lg text-xs font-bold hover:bg-[#0f2342] transition-all flex items-center gap-1 cursor-pointer shrink-0"
                                            >
                                                <Eye size={12} />
                                                Pratinjau
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Parameter Rilis & Migrasi Infrastruktur */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                                        Target Tanggal Go-Live Production <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="date"
                                            name="releaseDate"
                                            value={formData.releaseDate}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                                        Estimasi Downtime Window Server
                                    </label>
                                    <select
                                        name="downtime"
                                        value={formData.downtime}
                                        onChange={handleChange}
                                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    >
                                        <option value="Zero Downtime">Zero Downtime (Tanpa Penghentian Layanan)</option>
                                        <option value="15 Menit">15 Menit (Pemeliharaan Terjadwal Malam Hari)</option>
                                        <option value="30 Menit">30 Menit (Pemeliharaan Server Database)</option>
                                        <option value="60 Menit">60 Menit (Major Core System Deployment)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Rencana Pemulihan (Rollback Plan) */}
                            <div>
                                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                                    Prosedur Pemulihan (Rollback Plan Procedure) <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    name="rollbackProcedure"
                                    rows={3}
                                    value={formData.rollbackProcedure}
                                    onChange={handleChange}
                                    placeholder="Tuliskan prosedur rollback jika terjadi kegagalan sistem saat deployment di server produksi..."
                                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    required
                                />
                            </div>

                            {/* Upload Paket Binary / Script Migrasi SQL */}
                            <div>
                                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                                    Unggah File Paket Binary / Script SQL Migrasi Database
                                </label>
                                <div className="border-2 border-dashed border-gray-200 hover:border-emerald-400 bg-gray-50/50 rounded-2xl p-5 text-center transition-all">
                                    <CloudUpload size={32} className="text-emerald-600 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-gray-700">Tarik &amp; lepas file zip paket migrasi di sini, atau klik untuk memilih</p>
                                    <p className="text-[10px] text-gray-400 mt-1">Format dukungan: ZIP, TAR.GZ, SQL, DDL (Maksimal 5 MB)</p>
                                    <input
                                        type="file"
                                        accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="release-file-input"
                                    />
                                    <label
                                        htmlFor="release-file-input"
                                        className="mt-3 inline-block px-4 py-2 bg-white border border-gray-300 hover:border-emerald-600 text-gray-700 font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                                    >
                                        Pilih File Paket Migrasi
                                    </label>
                                </div>

                                {uploadedFile && (
                                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-emerald-600" />
                                            <span className="font-bold text-gray-800">{uploadedFile.name}</span>
                                            <span className="text-gray-500">({uploadedFile.size})</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setUploadedFile(null)}
                                            className="text-red-500 hover:text-red-700 p-1"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Action Button Submit ke Grup INFRA */}
                            <div className="pt-4 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    <Rocket size={18} />
                                    <span>Kirim Pengajuan Migrasi ke Grup INFRA (Quality Gate)</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* MODAL PRATINJAU DOKUMEN SDLC */}
            {selectedDocPreview && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-scale-up overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 border border-gray-100 my-8">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                                    BN
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                        Dokumen Resmi SDLC Bank Nagari
                                    </span>
                                    <h3 className="font-extrabold text-gray-800 text-base mt-0.5">
                                        {selectedDocPreview.name}
                                    </h3>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDocPreview(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl space-y-4 max-h-[60vh] overflow-y-auto font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {selectedDocPreview.content}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                onClick={() => {
                                    toast.success(`Dokumen ${selectedDocPreview.name} berhasil diunduh!`);
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <Download size={14} />
                                Unduh Laporan (PDF)
                            </button>
                            <button
                                onClick={() => setSelectedDocPreview(null)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}