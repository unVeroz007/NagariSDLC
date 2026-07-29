import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import toast from 'react-hot-toast';
import {
    Users,
    UserPlus,
    Calendar,
    Clock,
    FileText,
    Folder,
    Link,
    Copy,
    Eye,
    Send,
    Check,
    X,
    MoreVertical,
    Search,
    Bell,
    Inbox,
    AlertCircle,
    ChevronRight,
    FileCheck,
    FileSpreadsheet,
    File,
    User,
    CalendarDays,
    CheckCircle,
    XCircle,
    Clock3,
    ListTodo,
    UserCheck,
    Award,
    Building,
    AlertTriangle,
    ShieldAlert,
    ArrowRight,
} from 'lucide-react';

export default function WorkspaceQA() {
    const { user } = useAuth();
    const { projects, updateProjectStatus } = useProjects();
    const { addNotification } = useNotifications();

    // Filter real projects from database ready for QA
    const qaProjects = useMemo(() => {
        return (projects || []).filter(p =>
            ['READY_FOR_QA', 'QA_IN_PROGRESS'].includes(p.status)
        );
    }, [projects]);

    const [selectedProject, setSelectedProject] = useState(null);
    const activeProject = selectedProject || qaProjects[0] || null;

    const [assignee, setAssignee] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAssign = async () => {
        if (!activeProject) return;
        if (!assignee) {
            toast.error('Pilih anggota QA Tester!');
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProjectStatus(activeProject.id, 'QA_IN_PROGRESS', `Disposisi QA Tester: ${assignee}. ${notes}`);
            toast.success(`Proyek ${activeProject.name} berhasil didisposisikan ke QA Tester (${assignee})!`);
            addNotification('Disposisi QA', `Proyek ${activeProject.name} telah didisposisikan ke ${assignee}.`, 'info');
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan disposisi QA.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800">Workspace QA Lead</h2>
                <p className="text-gray-500 text-sm mt-1">Kelola antrean pengujian QA dan disposisi tester dari database backend.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* List Panel */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center justify-between">
                        <span>Antrean QA ({qaProjects.length})</span>
                    </h3>

                    <div className="space-y-3">
                        {qaProjects.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                                Tidak ada proyek dalam antrean pengujian QA saat ini.
                            </div>
                        ) : (
                            qaProjects.map(p => (
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
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
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
                            Pilih proyek di sebelah kiri untuk memproses disposisi QA.
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                                <div>
                                    <span className="text-xs font-mono font-bold text-[#1A56DB]">{activeProject.reqId || activeProject.req_id}</span>
                                    <h3 className="text-lg font-extrabold text-gray-800 mt-0.5">{activeProject.name || activeProject.title}</h3>
                                </div>
                                <span className="px-3 py-1 bg-purple-50 text-purple-700 font-bold rounded-full text-xs border border-purple-200">
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
                            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-4">
                                <h4 className="font-bold text-sm text-[#1A56DB]">Form Disposisi QA Tester</h4>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Pilih QA Tester *</label>
                                    <select
                                        value={assignee}
                                        onChange={(e) => setAssignee(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                                    >
                                        <option value="">-- Pilih Tester --</option>
                                        <option value="Siti Rahmawati (QA Tester)">Siti Rahmawati (qatester@nagari.co.id)</option>
                                        <option value="Eko Prasetyo (QA Lead)">Eko Prasetyo (qalead@nagari.co.id)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Catatan / Instruksi Khusus</label>
                                    <textarea
                                        rows={3}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Masukkan instruksi khusus pengujian..."
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                                    />
                                </div>

                                <button
                                    onClick={handleAssign}
                                    disabled={isSubmitting}
                                    className="w-full py-2.5 bg-[#1A56DB] hover:bg-[#1546b8] text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
                                >
                                    <Send size={14} />
                                    <span>Simpan & Disposisikan QA</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}