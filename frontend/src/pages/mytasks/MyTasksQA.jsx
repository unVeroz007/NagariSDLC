import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { qaRequestService } from '../../services/api';
import RBBBadge from '../../components/RBBBadge';
import toast from 'react-hot-toast';
import {
    Search,
    Bell,
    ChevronRight,
    Send,
    Save,
    Eye,
    Link as LinkIcon,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle,
    XCircle,
    AlertCircle,
    Info,
    FileText,
    Table,
    File,
    Download,
    Upload,
    Trash2,
    Check,
    X,
    ShieldAlert,
    ArrowRight,
    Edit3,
    Copy,
    Building,
    User,
    CheckCircle2,
    FolderOpen,
    Zap,
    Bug
} from 'lucide-react';

const MODE = import.meta.env.VITE_API_MODE || 'mock';

export default function MyTasksQA() {
    const { user } = useAuth();
    const { projects, updateProjectStatus } = useProjects();
    const { addNotification } = useNotifications();

    // Proyek yang didisposisi Lead QA ke tester ini: hanya QA_IN_PROGRESS
    const qaTasks = useMemo(() => {
        return (projects || []).filter(p => ['QA_IN_PROGRESS'].includes(p.status));
    }, [projects]);


    const [selectedTask, setSelectedTask] = useState(null);
    const activeTask = selectedTask || qaTasks[0] || null;

    const [qaResult, setQaResult] = useState('');
    const [defectSeverity, setDefectSeverity] = useState('Minor');
    const [qaNotes, setQaNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDocPreview, setSelectedDocPreview] = useState(null);

    const rightPanelRef = useRef(null);

    // Auto scroll ke atas saat tugas terpilih berubah
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
        if (activeTask) {
            scrollPageToTop();
        }
    }, [activeTask?.id]);

    const handleApplyPresetNote = (presetText) => {
        setQaNotes(prev => prev ? `${prev}\n- ${presetText}` : `- ${presetText}`);
        toast.success('Catatan preset pengujian berhasil ditambahkan!');
    };

    const handleSubmitResult = async () => {
        if (!activeTask) return;
        if (!qaResult) {
            toast.error('Pilih status keputusan pengujian QA (PASS / FAIL)!');
            return;
        }
        if (!qaNotes.trim()) {
            toast.error('Masukkan catatan atau temuan hasil pengujian QA!');
            return;
        }

        setIsSubmitting(true);
        try {
            const isPass = qaResult === 'PASS' || qaResult === 'pass';
            const targetStatus = isPass ? 'QA_PASSED' : 'RETURN_TO_DEV';

            if (MODE === 'api') {
                try {
                    await qaRequestService.create({
                        project_id: activeTask.realId || (typeof activeTask.id === 'number' ? activeTask.id : 1),
                        result: isPass ? 'pass' : 'fail',
                        notes: qaNotes,
                    });
                } catch (apiErr) {
                    console.warn('[MyTasksQA] API submission fallback to local state:', apiErr);
                    await updateProjectStatus(activeTask.id, targetStatus, `Laporan Hasil QA (${qaResult}) [Defect: ${defectSeverity}]: ${qaNotes}`);
                }
            } else {
                await updateProjectStatus(activeTask.id, targetStatus, `Laporan Hasil QA (${qaResult}) [Defect: ${defectSeverity}]: ${qaNotes}`);
            }

            toast.success(`Hasil pengujian QA (${qaResult}) untuk proyek ${activeTask.name} berhasil disimpan!`);
            addNotification('Laporan Pengujian QA', `Pengujian QA untuk ${activeTask.name} selesai dengan hasil ${qaResult}.`, isPass ? 'success' : 'warning');
            setQaResult('');
            setQaNotes('');
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan hasil pengujian QA.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyStagingUrl = (url) => {
        navigator.clipboard.writeText(url);
        toast.success('Staging URL berhasil disalin!');
    };

    const projectDocsList = useMemo(() => {
        if (!activeTask) return [];
        return [
            {
                id: 1,
                name: `BRD_${activeTask.id}_Business_Requirement.pdf`,
                type: 'BRD (Business Requirement Document)',
                size: '2.4 MB',
                content: `DOKUMEN SPESIFIKASI KEBUTUHAN BISNIS (BRD)\nPT BANK PUMUDA KEBANGSAAN (BANK NAGARI)\n\nProyek: ${activeTask.name}\nKode ID: ${activeTask.id}\n\n1. Skenario Pengujian Utama:\n- Verifikasi transaksi finansial & non-finansial.\n- Pengujian integritas data database dan log transaksi.`
            },
            {
                id: 2,
                name: `FSD_${activeTask.id}_Functional_Spec.pdf`,
                type: 'FSD (Functional Specification Document)',
                size: '3.1 MB',
                content: `SPESIFIKASI FUNGSIONAL SISTEM (FSD)\nNomor: FSD/${activeTask.id}/2026\n\nStaging Endpoint: ${activeTask.stagingUrl || 'https://staging-app.banknagari.co.id'}\nTest Credentials: qa_tester_01 / Pass: NagariSafe#2026`
            }
        ];
    }, [activeTask]);

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header Laman */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Tugas Pengujian Quality Assurance (QA)</h2>
                        <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={14} /> QA Testing Execution
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Lakukan pengujian skenario fungsional, verifikasi validasi data, dan input laporan hasil QA.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* List Panel (Panel Kiri) */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
                    <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center justify-between shrink-0 pb-3 border-b border-gray-100">
                        <span className="flex items-center gap-2">
                            <FolderOpen size={16} className="text-purple-600" />
                            Daftar Tugas Pengujian QA ({qaTasks.length})
                        </span>
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {qaTasks.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                Tidak ada tugas pengujian QA yang ditugaskan kepada Anda saat ini.
                            </div>
                        ) : (
                            qaTasks.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => {
                                        setSelectedTask(t);
                                        scrollPageToTop();
                                    }}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        activeTask?.id === t.id
                                            ? 'border-2 border-[#1a365d] bg-purple-50/40 shadow-sm'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{t.id}</span>
                                        <RBBBadge type={t.type} />
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1.5">{t.name || t.title}</h4>
                                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                        <span>Divisi: <strong className="text-gray-700">{t.division}</strong></span>
                                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-purple-100 text-purple-800">
                                            {t.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Detail & Action Panel (Panel Kanan) */}
                <div ref={rightPanelRef} className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-210px)] scroll-smooth">
                    {!activeTask ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-20">
                            <FolderOpen size={48} className="mb-3 text-gray-300" />
                            <p className="font-bold text-gray-600">Pilih Tugas Pengujian dari Panel Kiri</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Header Task */}
                            <div className="pb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                        {activeTask.id}
                                    </span>
                                    <RBBBadge type={activeTask.type} deadline={activeTask.rbbDeadline} />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800">{activeTask.name || activeTask.title}</h3>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                    <Building size={14} className="text-gray-400" />
                                    <span>Divisi: <strong className="text-gray-700">{activeTask.division}</strong></span>
                                    <span>•</span>
                                    <Calendar size={14} className="text-gray-400" />
                                    <span>Target Finish: <strong className="text-gray-700">{activeTask.targetDate || '2026-09-30'}</strong></span>
                                </p>
                            </div>

                            {/* Staging URL Target & Account */}
                            <div className="bg-purple-50/60 border border-purple-200 p-4 rounded-xl flex items-center justify-between gap-3">
                                <div className="overflow-hidden">
                                    <div className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Target Staging Test Environment URL</div>
                                    <div className="text-xs font-mono text-purple-700 truncate font-bold mt-0.5">
                                        {activeTask.stagingUrl || 'https://staging-app.banknagari.co.id'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCopyStagingUrl(activeTask.stagingUrl || 'https://staging-app.banknagari.co.id')}
                                    className="px-3 py-1.5 bg-white text-purple-700 hover:bg-purple-100 rounded-lg transition-colors text-xs font-bold shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    <Copy size={13} />
                                    <span>Salin Link</span>
                                </button>
                            </div>

                            {/* Scope & Deskripsi Proyek */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText size={15} className="text-[#1a365d]" />
                                    Lingkup &amp; Spesifikasi Kebutuhan Pengujian
                                </h4>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                                    {activeTask.description || 'Pengembangan modul aplikasi dan integrasi sistem perbankan digital SDLC Bank Nagari.'}
                                </div>
                            </div>

                            {/* Checklist Skenario Pengujian QA */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <CheckCircle2 size={15} className="text-[#1a365d]" />
                                    Checklist Skenario Pengujian Fungsional (QA Test Cases)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700">
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                                        <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                                        <span>Skenario Positif (Happy Path Transactions)</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                                        <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                                        <span>Validasi Input &amp; Error Handling Message</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                                        <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                                        <span>Pengujian Performa &amp; API Timeout Handling</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                                        <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                                        <span>Kesesuaian Desain UI &amp; Responsivitas Layar</span>
                                    </div>
                                </div>
                            </div>

                            {/* Dokumen SDLC Prasyarat Terlampir */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText size={15} className="text-[#1a365d]" />
                                    Dokumen SDLC Prasyarat ({projectDocsList.length})
                                </h4>
                                <div className="space-y-2">
                                    {projectDocsList.map(doc => (
                                        <div key={doc.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <FileText size={16} className="text-purple-600 shrink-0" />
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

                            {/* Form Input Laporan Hasil Pengujian QA */}
                            <div className="p-5 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-4 shadow-xs">
                                <h4 className="font-extrabold text-sm text-purple-900 border-b border-purple-200/80 pb-2">
                                    Input Laporan Hasil Pengujian QA
                                </h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Keputusan Hasil QA *</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setQaResult('PASS')}
                                                className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer ${
                                                    qaResult === 'PASS'
                                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-500'
                                                }`}
                                            >
                                                <Check size={16} />
                                                <span>PASSED (LULUS QA)</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setQaResult('FAIL')}
                                                className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer ${
                                                    qaResult === 'FAIL'
                                                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-red-500'
                                                }`}
                                            >
                                                <Bug size={16} />
                                                <span>FAILED (DITOLAK / RE-FIX)</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Tingkat Keparahan Bug (Defect Severity)</label>
                                        <select
                                            value={defectSeverity}
                                            onChange={(e) => setDefectSeverity(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-200"
                                        >
                                            <option value="Minor">Minor / Low (Catatan Kosmetik / UI)</option>
                                            <option value="Major">Major / Medium (Perlu Perbaikan Fungsional)</option>
                                            <option value="Critical">Critical Bug (Aplikasi Error / Crash)</option>
                                        </select>
                                    </div>

                                    {/* Preset Buttons */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-bold text-gray-700">Catatan Pengujian &amp; Detail Temuan Bug *</label>
                                            <span className="text-[10px] text-gray-400">Preset cepat:</span>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 mb-1">
                                            <button
                                                type="button"
                                                onClick={() => handleApplyPresetNote('Lulus 100% skenario pengujian fungsional tanpa ada defect.')}
                                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition-all border border-emerald-200 flex items-center gap-1 cursor-pointer"
                                            >
                                                <Check size={11} /> + Lulus 100% Skenario
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleApplyPresetNote('Ditemukan bug pada validasi form input nomor rekening.')}
                                                className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-all border border-red-200 flex items-center gap-1 cursor-pointer"
                                            >
                                                <Bug size={11} /> + Bug Validasi Input
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleApplyPresetNote('Response API gateway mengalami timeout saat beban tinggi.')}
                                                className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-[10px] font-bold transition-all border border-purple-200 flex items-center gap-1 cursor-pointer"
                                            >
                                                <Zap size={11} /> + API Timeout Bug
                                            </button>
                                        </div>

                                        <textarea
                                            rows={4}
                                            value={qaNotes}
                                            onChange={(e) => setQaNotes(e.target.value)}
                                            placeholder="Tuliskan temuan bug, langkah reproduksi (steps to reproduce), atau catatan rekomendasi hasil pengujian..."
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSubmitResult}
                                        disabled={isSubmitting}
                                        className="w-full py-3 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        <Send size={16} />
                                        <span>Kirim Laporan Pengujian QA</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL PRATINJAU DOKUMEN SDLC */}
            {selectedDocPreview && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-scale-up overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 border border-gray-100 my-8">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                                    BN
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
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