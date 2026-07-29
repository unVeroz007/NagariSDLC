import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import toast from 'react-hot-toast';
import {
    Shield,
    FolderOpen,
    Link as LinkIcon,
    Copy,
    Send,
    Ban,
    User,
    Clock,
    Calendar,
    ChevronRight,
    Search,
    Bell,
    History,
    HelpCircle,
    FileText,
    File,
    CheckCircle,
    AlertCircle,
    Eye,
    MoreVertical,
    Users,
    Filter,
    Inbox,
    ChevronDown,
    XCircle,
    ShieldAlert,
    AlertTriangle,
    ArrowRight,
    UserCheck,
    X,
} from 'lucide-react';

export default function WorkspaceCyber() {
    const { user } = useAuth();
    const { projects, updateProjectStatus } = useProjects();
    const { addNotification } = useNotifications();

    // Filter real projects from database ready for Cyber Security audit
    const cyberProjects = useMemo(() => {
        return (projects || []).filter(p =>
            ['QA_PASSED', 'CYBER_IN_PROGRESS'].includes(p.status)
        );
    }, [projects]);

    const [selectedProject, setSelectedProject] = useState(null);
    const activeProject = selectedProject || cyberProjects[0] || null;

    const [selectedPentester, setSelectedPentester] = useState('');
    const [instructions, setInstructions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssign = async () => {
        if (!activeProject) return;
        if (!selectedPentester) {
            toast.error('Pilih Pentester terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProjectStatus(activeProject.id, 'CYBER_IN_PROGRESS', `Disposisi Pentester: ${selectedPentester}. ${instructions}`);
            toast.success(`Proyek ${activeProject.name} berhasil didisposisikan ke Pentester (${selectedPentester})!`);
            addNotification('Disposisi Pentest', `Proyek ${activeProject.name} telah didisposisikan ke ${selectedPentester}.`, 'info');
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan disposisi Pentester.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800">Workspace Cyber Security Lead</h2>
                <p className="text-gray-500 text-sm mt-1">Kelola antrean audit penetration testing dari database backend.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* List Panel */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center justify-between">
                        <span>Antrean Pentest ({cyberProjects.length})</span>
                    </h3>

                    <div className="space-y-3">
                        {cyberProjects.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                Tidak ada proyek dalam antrean audit siber saat ini.
                            </div>
                        ) : (
                            cyberProjects.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedProject(p)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        activeProject?.id === p.id
                                            ? 'border-[#1A56DB] bg-blue-50/50 shadow-xs'
                                            : 'border-gray-100 hover:border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-mono font-bold text-[#1A56DB]">{p.reqId || p.req_id}</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                                            {p.status}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1">{p.name || p.title}</h4>
                                    <p className="text-xs text-gray-500 flex items-center gap-2">
                                        <span>Divisi: {p.division}</span>
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Detail & Action Panel */}
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    {!activeProject ? (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm">
                            <Inbox size={40} className="mb-2 text-gray-300" />
                            Pilih proyek di sebelah kiri untuk memproses audit siber.
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                                <div>
                                    <span className="text-xs font-mono font-bold text-[#1A56DB]">{activeProject.reqId || activeProject.req_id}</span>
                                    <h3 className="text-lg font-extrabold text-gray-800 mt-0.5">{activeProject.name || activeProject.title}</h3>
                                </div>
                                <span className="px-3 py-1 bg-orange-50 text-orange-700 font-bold rounded-full text-xs border border-orange-200">
                                    {activeProject.status}
                                </span>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Deskripsi Proyek</label>
                                    <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">{activeProject.description || 'Tidak ada deskripsi.'}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Divisi Peminta</label>
                                        <span className="text-xs font-semibold text-gray-800">{activeProject.division}</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Target Selesai</label>
                                        <span className="text-xs font-semibold text-gray-800">{activeProject.targetDate}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Disposisi Form */}
                            <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 space-y-4">
                                <h4 className="font-bold text-sm text-orange-700">Form Disposisi Pentest (Cyber Security)</h4>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Pilih Pentester *</label>
                                    <select
                                        value={selectedPentester}
                                        onChange={(e) => setSelectedPentester(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    >
                                        <option value="">-- Pilih Pentester --</option>
                                        <option value="Rizal Pratama (Pentester)">Rizal Pratama (pentester@nagari.co.id)</option>
                                        <option value="Gita Savitri (Cyber Lead)">Gita Savitri (cyberlead@nagari.co.id)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Instruksi Pentest</label>
                                    <textarea
                                        rows={3}
                                        value={instructions}
                                        onChange={(e) => setInstructions(e.target.value)}
                                        placeholder="Petunjuk khusus pentest (misal: fokus pada modul payment gateway)..."
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>

                                <button
                                    onClick={handleAssign}
                                    disabled={isSubmitting}
                                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
                                >
                                    <Shield size={14} />
                                    <span>Simpan & Disposisikan Pentest</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}