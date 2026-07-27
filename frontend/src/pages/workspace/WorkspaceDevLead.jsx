import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import RBBBadge from '../../components/RBBBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    Inbox,
    Search as SearchIcon,
    Users,
    CheckCircle2,
    Clock,
    FileText,
    UserCheck,
    Send,
    AlertCircle,
    X,
    Calendar,
    Briefcase,
    Shield,
    Check,
    ChevronRight,
    Building
} from 'lucide-react';
import toast from 'react-hot-toast';
import { analysts, pmCandidates } from '../../data/mockData';

export default function WorkspaceDevLead() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { projects, updateProject, isLoading } = useProjects();

    const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' | 'analyzing' | 'ready_pm'
    const [selectedProject, setSelectedProject] = useState(null);

    // Modal Assign Analyst State
    const [isAnalystModalOpen, setIsAnalystModalOpen] = useState(false);
    const [targetProjectForAnalyst, setTargetProjectForAnalyst] = useState(null);
    const [selectedAnalystId, setSelectedAnalystId] = useState('');
    const [leadNote, setLeadNote] = useState('');

    // Form Assign PM State
    const [selectedPM, setSelectedPM] = useState('');
    const [estimationDays, setEstimationDays] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Proyek Masuk (READY_FOR_DEV)
    const incomingProjects = projects.filter(p =>
        p.status === 'READY_FOR_DEV' || p.status === 'PENDING'
    );

    // 2. Proyek Sedang Dikaji Analyst (DEV_ANALYSIS)
    const analyzingProjects = projects.filter(p =>
        p.status === 'DEV_ANALYSIS' || p.status === 'ANALYST_REVIEW'
    );

    // 3. Proyek Siap Tunjuk PM (DEV_ANALYSIS_DONE)
    const readyForPMProjects = projects.filter(p =>
        p.status === 'DEV_ANALYSIS_DONE' || p.status === 'READY_FOR_DEVELOPMENT' || p.status === 'ANALYSIS_APPROVED'
    );

    // Buka modal tugaskan analyst
    const handleOpenAnalystModal = (project) => {
        setTargetProjectForAnalyst(project);
        setSelectedAnalystId('');
        setLeadNote('');
        setIsAnalystModalOpen(true);
    };

    // Submit penugasan Analyst
    const handleAssignAnalyst = () => {
        if (!selectedAnalystId) {
            toast.error('Pilih System Analyst!');
            return;
        }

        const chosenAnalyst = analysts.find(a => a.id === parseInt(selectedAnalystId));
        if (!chosenAnalyst) return;

        setIsSubmitting(true);

        setTimeout(() => {
            updateProject(targetProjectForAnalyst.id, {
                status: 'DEV_ANALYSIS',
                statusColor: 'bg-amber-100 text-amber-700 border-amber-200',
                assignedAnalyst: chosenAnalyst,
                leadNote: leadNote || 'Tolong kaji kelayakan arsitektur teknis dan estimasi mandays.',
                assignedAnalystAt: new Date().toISOString()
            });

            addNotification(
                'Tugas Kajian Teknis Baru',
                `Anda ditugaskan oleh Ketua Grup Pengembangan untuk mengkaji proyek ${targetProjectForAnalyst.name}.`,
                'info',
                '/workspace/analyst'
            );

            toast.success(`Analyst ${chosenAnalyst.name} berhasil ditugaskan!`);
            setIsSubmitting(false);
            setIsAnalystModalOpen(false);
            setTargetProjectForAnalyst(null);
        }, 500);
    };

    // Submit Penunjukan PM
    const handleAssignPM = () => {
        if (!selectedProject) {
            toast.error('Pilih proyek terlebih dahulu!');
            return;
        }
        if (!selectedPM) {
            toast.error('Pilih Project Manager penanggung jawab!');
            return;
        }

        setIsSubmitting(true);

        const pmDetails = pmCandidates.find(pm => pm.id === parseInt(selectedPM));

        setTimeout(() => {
            updateProject(selectedProject.id, {
                status: 'IN_DEVELOPMENT',
                statusColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                pm: pmDetails,
                estimation: estimationDays || selectedProject.analystResult?.estimation || '30',
                assignedBy: user?.name,
                assignedPMAt: new Date().toISOString()
            });

            addNotification(
                'Penugasan PM Proyek Baru',
                `Anda telah ditunjuk oleh Ketua Grup Pengembangan sebagai PM untuk proyek ${selectedProject.name}. Silakan alokasikan tim & kelola proyek.`,
                'success',
                '/pm/workspace'
            );

            toast.success(`PM ${pmDetails?.name || ''} berhasil ditunjuk untuk memimpin proyek!`);
            setIsSubmitting(false);
            setSelectedProject(null);
            setSelectedPM('');
            setEstimationDays('');
            navigate('/pm/workspace');
        }, 600);
    };

    if (isLoading) {
        return <LoadingSpinner text="Memuat Workspace Ketua Grup..." />;
    }

    return (
        <div className="flex-1 overflow-y-auto bg-[#f8f9fb] p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-extrabold text-gray-800">Workspace Ketua Grup Pengembangan</h1>
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <UserCheck size={14} /> Dev Governance
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Kelola alur penerimaan proyek dari Perencanaan, penugasan System Analyst, dan penunjukan Project Manager.
                        </p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 bg-white rounded-2xl p-1.5 shadow-sm">
                    <button
                        onClick={() => { setActiveTab('incoming'); setSelectedProject(null); }}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'incoming'
                                ? 'bg-[#1a365d] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <Inbox size={18} />
                        Tab 1: 📥 Proyek Masuk
                        <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                            activeTab === 'incoming' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                        }`}>
                            {incomingProjects.length}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('analyzing'); setSelectedProject(null); }}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'analyzing'
                                ? 'bg-[#1a365d] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <SearchIcon size={18} />
                        Tab 2: 🔍 Sedang Dikaji Analyst
                        <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                            activeTab === 'analyzing' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {analyzingProjects.length}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('ready_pm'); setSelectedProject(null); }}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'ready_pm'
                                ? 'bg-[#1a365d] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <CheckCircle2 size={18} />
                        Tab 3: ✅ Siap Tunjuk PM
                        <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                            activeTab === 'ready_pm' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                            {readyForPMProjects.length}
                        </span>
                    </button>
                </div>

                {/* TAB 1: PROYEK MASUK */}
                {activeTab === 'incoming' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Inbox className="text-blue-600" size={24} />
                                <div>
                                    <h3 className="font-bold text-blue-900 text-sm">Proyek Baru dari Perencanaan</h3>
                                    <p className="text-xs text-blue-700">Tugaskan System Analyst untuk mengkaji kebutuhan teknis & dokumen FSD.</p>
                                </div>
                            </div>
                        </div>

                        {incomingProjects.length === 0 ? (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                                <Inbox size={48} className="text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-700">Tidak Ada Proyek Masuk</h3>
                                <p className="text-sm text-gray-500 mt-1">Semua proyek telah ditugaskan ke Analyst.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {incomingProjects.map(project => (
                                    <div key={project.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{project.id}</span>
                                                <RBBBadge type={project.type} deadline={project.rbbDeadline} />
                                            </div>
                                            <h3 className="font-bold text-gray-800 text-base mb-1">{project.name}</h3>
                                            <p className="text-xs text-gray-500 line-clamp-2 mb-3">{project.description}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-600 mb-4 bg-gray-50 p-2 rounded-lg">
                                                <Building size={14} className="text-gray-400" />
                                                <span>{project.division}</span>
                                                <span className="text-gray-300">•</span>
                                                <Calendar size={14} className="text-gray-400" />
                                                <span>Target: {project.targetDate}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleOpenAnalystModal(project)}
                                            className="w-full bg-[#1a365d] hover:bg-[#0f2342] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <UserCheck size={14} />
                                            Tugaskan Analyst
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: SEDANG DIKAJI ANALYST */}
                {activeTab === 'analyzing' && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Clock className="text-amber-600" size={24} />
                                <div>
                                    <h3 className="font-bold text-amber-900 text-sm">Proyek Dalam Kajian Analyst</h3>
                                    <p className="text-xs text-amber-700">Analyst sedang menyusun FSD, spesifikasi arsitektur, dan estimasi mandays.</p>
                                </div>
                            </div>
                        </div>

                        {analyzingProjects.length === 0 ? (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                                <Clock size={48} className="text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-700">Tidak Ada Proyek Sedang Dikaji</h3>
                                <p className="text-sm text-gray-500 mt-1">Belum ada proyek yang sedang ditelaah oleh Analyst.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {analyzingProjects.map(project => (
                                    <div key={project.id} className="bg-white p-5 rounded-2xl border border-amber-200/60 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{project.id}</span>
                                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Clock size={10} /> Sedang Dikaji
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-gray-800 text-base mb-1">{project.name}</h3>
                                            <p className="text-xs text-gray-500 line-clamp-2 mb-3">{project.description}</p>
                                            
                                            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 mb-4">
                                                <div className="text-xs text-amber-900 font-semibold mb-1 flex items-center gap-1.5">
                                                    <Users size={13} className="text-amber-700" />
                                                    Analyst Bertugas: {project.assignedAnalyst?.name || 'Citra Kirana'}
                                                </div>
                                                <p className="text-[11px] text-amber-700 italic">
                                                    "{project.leadNote || 'Dalam penyusunan FSD & estimasi.'}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: SIAP TUNJUK PM */}
                {activeTab === 'ready_pm' && (
                    <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
                        {/* KIRI: Daftar Proyek Selesai Kajian */}
                        <div className="w-full lg:w-1/3 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
                                <h3 className="font-bold text-gray-800 text-sm">Pilih Proyek Siap Ditunjuk PM ({readyForPMProjects.length})</h3>
                                <p className="text-xs text-gray-500">Proyek yang telah selesai dikaji oleh Analyst.</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {readyForPMProjects.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">
                                        <CheckCircle2 size={36} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs">Belum ada proyek selesai dikaji.</p>
                                    </div>
                                ) : (
                                    readyForPMProjects.map(project => (
                                        <div
                                            key={project.id}
                                            onClick={() => { setSelectedProject(project); setSelectedPM(''); setEstimationDays(''); }}
                                            className={`p-4 rounded-xl cursor-pointer transition-all border ${
                                                selectedProject?.id === project.id
                                                    ? 'bg-blue-50 border-[#1a365d] ring-2 ring-[#1a365d]/10'
                                                    : 'bg-white border-gray-200 hover:border-blue-300'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-1.5">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{project.id}</span>
                                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">FSD Selesai</span>
                                            </div>
                                            <h4 className="font-bold text-gray-800 text-sm mb-1">{project.name}</h4>
                                            <p className="text-xs text-gray-500 line-clamp-1">{project.division}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* KANAN: Detail Kajian & Form Penunjukan PM */}
                        <div className="w-full lg:w-2/3 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                            {!selectedProject ? (
                                <div className="flex-1 flex items-center justify-center p-12 text-center text-gray-400">
                                    <div>
                                        <UserCheck size={48} className="mx-auto mb-3 opacity-40 text-blue-600" />
                                        <h3 className="font-bold text-gray-700 text-base">Pilih Proyek dari Daftar di Kiri</h3>
                                        <p className="text-xs text-gray-500 mt-1">Pilih proyek untuk melihat hasil kajian Analyst dan menunjuk PM penanggung jawab.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    <div className="border-b border-gray-100 pb-4">
                                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{selectedProject.id}</span>
                                        <h2 className="text-xl font-extrabold text-gray-800 mt-1">{selectedProject.name}</h2>
                                        <p className="text-xs text-gray-500">{selectedProject.division} • Target: {selectedProject.targetDate}</p>
                                    </div>

                                    {/* Hasil Kajian Analyst */}
                                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
                                        <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <FileText size={15} className="text-emerald-700" /> Hasil Kajian Teknis System Analyst
                                        </h4>
                                        <div className="text-sm font-semibold text-emerald-900">
                                            Keputusan: {selectedProject.analystResult?.decision || 'Disetujui untuk IT Development'}
                                        </div>
                                        <p className="text-xs text-emerald-800 leading-relaxed font-mono">
                                            "{selectedProject.analystResult?.notes || 'Dokumen FSD telah diselesaikan dan arsitektur siap dibangun.'}"
                                        </p>
                                        <div className="text-xs text-emerald-700 font-semibold pt-1">
                                            Estimasi Pengerjaan: {selectedProject.analystResult?.estimation || '30'} Mandays / Hari
                                        </div>
                                    </div>

                                    {/* Form Penunjukan PM */}
                                    <div className="space-y-4 pt-2">
                                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                            <Users size={16} className="text-blue-600" /> Form Penunjukan Project Manager (PM)
                                        </h3>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Pilih Project Manager <span className="text-red-500">*</span></label>
                                            <select
                                                value={selectedPM}
                                                onChange={(e) => setSelectedPM(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium bg-white"
                                            >
                                                <option value="">-- Pilih Project Manager --</option>
                                                {pmCandidates.map(pm => (
                                                    <option key={pm.id} value={pm.id}>
                                                        {pm.name} - {pm.department} (Beban: {pm.workload} Proyek Aktif)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Estimasi Pengerjaan Final (Hari)</label>
                                            <input
                                                type="number"
                                                value={estimationDays || selectedProject.analystResult?.estimation || ''}
                                                onChange={(e) => setEstimationDays(e.target.value)}
                                                placeholder="Misal: 30"
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm bg-white"
                                            />
                                        </div>

                                        <div className="pt-3">
                                            <button
                                                onClick={handleAssignPM}
                                                disabled={isSubmitting}
                                                className="w-full bg-[#1a365d] hover:bg-[#0f2342] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                                            >
                                                <Send size={16} />
                                                Tunjuk PM & Mulai Pengembangan
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL TUGASKAN ANALYST (TAB 1) */}
            {isAnalystModalOpen && targetProjectForAnalyst && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <UserCheck size={18} className="text-blue-600" />
                                Penugasan System Analyst
                            </h3>
                            <button onClick={() => setIsAnalystModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-xl text-xs text-blue-900 font-medium">
                            Proyek: <strong>{targetProjectForAnalyst.name}</strong> ({targetProjectForAnalyst.id})
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Pilih Analyst Bertugas <span className="text-red-500">*</span></label>
                            <select
                                value={selectedAnalystId}
                                onChange={(e) => setSelectedAnalystId(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 bg-white"
                            >
                                <option value="">-- Pilih System Analyst --</option>
                                {analysts.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} (Beban Kerja: {a.workload})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Catatan Arahan untuk Analyst</label>
                            <textarea
                                rows={3}
                                value={leadNote}
                                onChange={(e) => setLeadNote(e.target.value)}
                                placeholder="Misal: Tolak ukur arsitektur microservices dan integrasi API core banking..."
                                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setIsAnalystModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleAssignAnalyst}
                                disabled={isSubmitting}
                                className="px-5 py-2 text-xs font-bold text-white bg-[#1a365d] hover:bg-[#0f2342] rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <Send size={13} />
                                Kirim Tugas ke Analyst
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
