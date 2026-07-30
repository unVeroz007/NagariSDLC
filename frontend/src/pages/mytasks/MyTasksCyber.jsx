import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { cyberRequestService } from '../../services/api';
import RBBBadge from '../../components/RBBBadge';
import toast from 'react-hot-toast';
import {
    Shield,
    ChevronRight,
    Search,
    Bell,
    Calendar,
    Link as LinkIcon,
    Send,
    Save,
    CloudUpload,
    Delete,
    CheckCircle,
    FileText,
    FileCheck,
    Eye,
    Lock,
    AlertTriangle,
    Clock,
    User,
    AlertCircle,
    MoreVertical,
    Upload,
    X,
    File,
    ShieldCheck,
    History,
    HelpCircle,
    FolderOpen,
    Copy,
    ShieldAlert,
    ArrowRight,
    Edit3,
    Check,
    Building,
    ExternalLink
} from 'lucide-react';

const MODE = import.meta.env.VITE_API_MODE || 'mock';

export default function MyTasksCyber() {
    const { user } = useAuth();
    const { projects, updateProjectStatus } = useProjects();
    const { addNotification } = useNotifications();

    // Proyek yang didisposisi Lead Cyber ke pentester: hanya CYBER_IN_PROGRESS
    const cyberTasks = useMemo(() => {
        const filtered = (projects || []).filter(p =>
            ['CYBER_IN_PROGRESS'].includes(p.status)
        );
        if (filtered.length > 0) return filtered;
        return [
            {
                id: 'PRJ-2026-097',
                realId: 97,
                name: 'Audit Trail & Log Security Terpusat',
                division: 'Divisi Kepatuhan & Keamanan',
                status: 'CYBER_IN_PROGRESS',
                type: 'RBB',
                targetDate: '2026-10-01',
                stagingUrl: 'https://staging-siem.banknagari.co.id',
                description: 'Implementasi SIEM terpusat untuk pemantauan akses dan log keamanan server.'
            },
            {
                id: 'PRJ-2026-096',
                realId: 96,
                name: 'Integrasi API Payment Aggregator H2H',
                division: 'Divisi Perbankan Digital',
                status: 'CYBER_IN_PROGRESS',
                type: 'RBB',
                targetDate: '2026-09-15',
                stagingUrl: 'https://staging-payment.banknagari.co.id',
                description: 'Pengembangan integrasi Host-to-Host payment gateway untuk transaksi merchant.'
            }
        ];
    }, [projects]);

    const [selectedTask, setSelectedTask] = useState(null);
    const activeTask = selectedTask || cyberTasks[0] || null;

    const [cyberResult, setCyberResult] = useState('');
    const [cyberNotes, setCyberNotes] = useState('');
    const [riskLevel, setRiskLevel] = useState('Low');
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleSubmitResult = async () => {
        if (!activeTask) return;
        if (!cyberResult) {
            toast.error('Pilih keputusan audit siber (PASS / FAIL)!');
            return;
        }
        if (!cyberNotes.trim()) {
            toast.error('Masukkan catatan atau temuan kerentanan keamanan!');
            return;
        }

        setIsSubmitting(true);
        try {
            const isPass = cyberResult === 'PASS' || cyberResult === 'pass';
            const targetStatus = isPass ? 'CYBER_PASSED' : 'RETURN_TO_DEV';

            if (MODE === 'api') {
                try {
                    await cyberRequestService.create({
                        project_id: activeTask.realId || (typeof activeTask.id === 'number' ? activeTask.id : 1),
                        result: isPass ? 'pass' : 'fail',
                        notes: cyberNotes,
                    });
                } catch (apiErr) {
                    console.warn('[MyTasksCyber] API submission fallback to local state:', apiErr);
                    await updateProjectStatus(activeTask.id, targetStatus, `Hasil Audit Cyber (${cyberResult}) [Risk: ${riskLevel}]: ${cyberNotes}`);
                }
            } else {
                await updateProjectStatus(activeTask.id, targetStatus, `Hasil Audit Cyber (${cyberResult}) [Risk: ${riskLevel}]: ${cyberNotes}`);
            }

            toast.success(`Hasil Pentest (${cyberResult}) untuk proyek ${activeTask.name} berhasil disimpan!`);
            addNotification('Hasil Audit Pentest', `Audit siber untuk ${activeTask.name} selesai dengan hasil ${cyberResult}.`, isPass ? 'success' : 'warning');
            setCyberResult('');
            setCyberNotes('');
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan hasil pentest siber.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyStagingUrl = (url) => {
        navigator.clipboard.writeText(url);
        toast.success('Staging URL berhasil disalin!');
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            {/* Header */}
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-extrabold text-gray-800">Tugas Audit Cyber Security &amp; Pentest</h2>
                        <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <ShieldCheck size={14} /> Penetration Testing Task
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        Lakukan uji kerentanan sistem, periksa celah keamanan OWASP, dan unggah laporan audit siber.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* List Panel */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-210px)] overflow-hidden">
                    <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center justify-between shrink-0 pb-3 border-b border-gray-100">
                        <span className="flex items-center gap-2">
                            <Shield size={16} className="text-orange-600" />
                            Daftar Tugas Audit Siber ({cyberTasks.length})
                        </span>
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {cyberTasks.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                Tidak ada tugas audit siber yang ditugaskan kepada Anda saat ini.
                            </div>
                        ) : (
                            cyberTasks.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => {
                                        setSelectedTask(t);
                                        scrollPageToTop();
                                    }}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        activeTask?.id === t.id
                                            ? 'border-2 border-[#1a365d] bg-orange-50/40 shadow-sm'
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
                                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-orange-100 text-orange-800">
                                            {t.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Detail & Action Panel */}
                <div ref={rightPanelRef} className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-y-auto h-[calc(100vh-210px)] scroll-smooth">
                    {!activeTask ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-20">
                            <FolderOpen size={48} className="mb-3 text-gray-300" />
                            <p className="font-bold text-gray-600">Pilih Tugas Audit dari Panel Kiri</p>
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
                                    <span>Target Finish: <strong className="text-gray-700">{activeTask.targetDate || '2026-10-01'}</strong></span>
                                </p>
                            </div>

                            {/* Staging URL & Info Target */}
                            <div className="bg-orange-50/60 border border-orange-200 p-4 rounded-xl flex items-center justify-between gap-3">
                                <div className="overflow-hidden">
                                    <div className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Target Staging URL Penetration Test</div>
                                    <div className="text-xs font-mono text-orange-600 truncate font-bold mt-0.5">
                                        {activeTask.stagingUrl || 'https://staging-app.banknagari.co.id'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCopyStagingUrl(activeTask.stagingUrl || 'https://staging-app.banknagari.co.id')}
                                    className="px-3 py-1.5 bg-white text-orange-600 hover:bg-orange-100 rounded-lg transition-colors text-xs font-bold shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    <Copy size={13} />
                                    <span>Salin Link</span>
                                </button>
                            </div>

                            {/* Scope & Checklist OWASP Audit */}
                            <div>
                                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <ShieldCheck size={15} className="text-[#1a365d]" />
                                    Checklist Skenario Audit Security (OWASP Top 10)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700">
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                                        <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                                        <span>SQL Injection &amp; Data Sanitization</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                                        <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                                        <span>Broken Authentication &amp; JWT Expiry</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                                        <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                                        <span>Cross-Site Scripting (XSS) &amp; CSRF</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                                        <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                                        <span>API Rate Limiting &amp; DDoS Protection</span>
                                    </div>
                                </div>
                            </div>

                            {/* Form Input Hasil Audit Cyber */}
                            <div className="p-5 bg-orange-50/60 rounded-2xl border border-orange-200 space-y-4 shadow-xs">
                                <h4 className="font-extrabold text-sm text-orange-900 border-b border-orange-200/80 pb-2">
                                    Input Hasil Audit &amp; Temuan Kerentanan Security
                                </h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Keputusan Hasil Pentest *</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setCyberResult('PASS')}
                                                className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer ${
                                                    cyberResult === 'PASS'
                                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-500'
                                                }`}
                                            >
                                                <Check size={16} />
                                                <span>LULUS PENTEST (PASS)</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setCyberResult('FAIL')}
                                                className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer ${
                                                    cyberResult === 'FAIL'
                                                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-red-500'
                                                }`}
                                            >
                                                <AlertTriangle size={16} />
                                                <span>PERLU RE-FIX (FAIL)</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Tingkat Risiko Temuan (Risk Rating)</label>
                                        <select
                                            value={riskLevel}
                                            onChange={(e) => setRiskLevel(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                        >
                                            <option value="Low">Low Risk (Aman / Minor Advisory)</option>
                                            <option value="Medium">Medium Risk (Perlu Perhatian)</option>
                                            <option value="High">High Risk (Bahaya / Wajib Diperbaiki)</option>
                                            <option value="Critical">Critical Risk (Celah Keamanan Fatal)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Catatan Audit &amp; Detail Temuan Celah Keamanan *</label>
                                        <textarea
                                            rows={4}
                                            value={cyberNotes}
                                            onChange={(e) => setCyberNotes(e.target.value)}
                                            placeholder="Tuliskan temuan kerentanan, rekomendasi perbaikan, atau catatan keamanan siber..."
                                            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSubmitResult}
                                        disabled={isSubmitting}
                                        className="w-full py-3 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        <Send size={16} />
                                        <span>Simpan Hasil Audit &amp; Kirim Rekomendasi</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}