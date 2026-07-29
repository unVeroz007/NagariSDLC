import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { cyberRequestService } from '../../services/api';
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
} from 'lucide-react';

const MODE = import.meta.env.VITE_API_MODE || 'mock';

export default function MyTasksCyber() {
    const { user } = useAuth();
    const { projects, updateProjectStatus } = useProjects();
    const { addNotification } = useNotifications();

    const cyberTasks = useMemo(() => {
        return (projects || []).filter(p =>
            ['QA_PASSED', 'CYBER_IN_PROGRESS', 'CYBER_PASSED'].includes(p.status)
        );
    }, [projects]);

    const [selectedTask, setSelectedTask] = useState(null);
    const activeTask = selectedTask || cyberTasks[0] || null;

    const [cyberResult, setCyberResult] = useState('');
    const [cyberNotes, setCyberNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmitResult = async () => {
        if (!activeTask) return;
        if (!cyberResult) {
            toast.error('Pilih status hasil audit siber terlebih dahulu!');
            return;
        }
        if (!cyberNotes.trim()) {
            toast.error('Masukkan catatan atau temuan kerentanan keamanan!');
            return;
        }

        setIsSubmitting(true);
        try {
            const isPass = cyberResult === 'PASS';
            const targetStatus = isPass ? 'CYBER_PASSED' : 'RETURN_TO_DEV';

            if (MODE === 'api') {
                await cyberRequestService.create({
                    project_id: activeTask.id,
                    result: isPass ? 'PASS' : 'FAIL',
                    notes: cyberNotes,
                });
            } else {
                await updateProjectStatus(activeTask.id, targetStatus, cyberNotes);
            }

            toast.success(`Hasil Pentest (${cyberResult}) untuk proyek ${activeTask.name} berhasil disimpan!`);
            addNotification('Hasil Pentest', `Audit siber untuk ${activeTask.name} selesai dengan hasil ${cyberResult}.`, isPass ? 'success' : 'warning');
            setCyberResult('');
            setCyberNotes('');
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan hasil pentest siber.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800">Tugas Siber Saya</h2>
                <p className="text-gray-500 text-sm mt-1">Lakukan penetration testing dan catat temuan keamanan dari database backend.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Task List */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 text-sm mb-4">Daftar Audit Pentest ({cyberTasks.length})</h3>

                    <div className="space-y-3">
                        {cyberTasks.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                Tidak ada tugas pentest aktif saat ini.
                            </div>
                        ) : (
                            cyberTasks.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => setSelectedTask(t)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        activeTask?.id === t.id
                                            ? 'border-[#1A56DB] bg-blue-50/50 shadow-xs'
                                            : 'border-gray-100 hover:border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-mono font-bold text-[#1A56DB]">{t.reqId || t.req_id}</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                                            {t.status}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1">{t.name || t.title}</h4>
                                    <p className="text-xs text-gray-500">Divisi: {t.division}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Form & Detail */}
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    {!activeTask ? (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm">
                            Pilih tugas di sebelah kiri untuk mengisi hasil penetration testing.
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                                <div>
                                    <span className="text-xs font-mono font-bold text-[#1A56DB]">{activeTask.reqId || activeTask.req_id}</span>
                                    <h3 className="text-lg font-extrabold text-gray-800 mt-0.5">{activeTask.name || activeTask.title}</h3>
                                </div>
                                <span className="px-3 py-1 bg-orange-50 text-orange-700 font-bold rounded-full text-xs border border-orange-200">
                                    {activeTask.status}
                                </span>
                            </div>

                            <div className="space-y-4 mb-6">
                                <h4 className="font-bold text-sm text-gray-800">Form Laporan Penetration Testing</h4>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Hasil Audit Siber *</label>
                                    <select
                                        value={cyberResult}
                                        onChange={(e) => setCyberResult(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    >
                                        <option value="">-- Pilih Hasil --</option>
                                        <option value="PASS">Passed (Lulus Pentest Siber)</option>
                                        <option value="FAIL">Failed (Ditolak / Pentest Defect)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Catatan / Laporan Vulnerability *</label>
                                    <textarea
                                        rows={4}
                                        value={cyberNotes}
                                        onChange={(e) => setCyberNotes(e.target.value)}
                                        placeholder="Tuliskan hasil audit keamanan, celah kerentanan, atau saran mitigasi..."
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>

                                <button
                                    onClick={handleSubmitResult}
                                    disabled={isSubmitting}
                                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
                                >
                                    <Shield size={14} />
                                    <span>Kirim Laporan Audit Siber</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}