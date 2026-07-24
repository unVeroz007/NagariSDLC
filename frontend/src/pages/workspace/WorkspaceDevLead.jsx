import RBBBadge from '../../components/RBBBadge';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Check,
    AlertCircle,
    User,
    Calendar,
    Clock,
    Briefcase,
    FileText,
    Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { pmCandidates, developerCandidates } from '../../data/mockData';

export default function WorkspaceDevLead() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addNotification } = useNotifications();
    const { projects, updateProject, isLoading } = useProjects();
    
    // Antrean proyek dengan status READY_FOR_DEVELOPMENT
    const readyProjects = projects.filter(p => p.status === 'READY_FOR_DEVELOPMENT');
    
    const [selectedProject, setSelectedProject] = useState(null);
    if (!selectedProject && readyProjects.length > 0) {
        setSelectedProject(readyProjects[0]);
    }

    const [selectedPM, setSelectedPM] = useState('');
    const [selectedTeam, setSelectedTeam] = useState([]);
    const [estimationDays, setEstimationDays] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleToggleDev = (devId) => {
        if (selectedTeam.includes(devId)) {
            setSelectedTeam(selectedTeam.filter(id => id !== devId));
        } else {
            setSelectedTeam([...selectedTeam, devId]);
        }
    };

    const handleAssign = () => {
        if (!selectedPM) {
            toast.error('Pilih Project Manager!');
            return;
        }
        if (selectedTeam.length === 0) {
            toast.error('Pilih minimal 1 developer!');
            return;
        }
        if (!estimationDays) {
            toast.error('Masukkan estimasi pengerjaan!');
            return;
        }

        setIsSubmitting(true);
        
        // Find full details of selected PM and team to save in project context
        const pmDetails = pmCandidates.find(pm => pm.id === parseInt(selectedPM));
        const teamDetails = developerCandidates.filter(dev => selectedTeam.includes(dev.id));

        updateProject(selectedProject.id, {
            status: 'IN_DEVELOPMENT',
            statusColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
            pm: pmDetails,
            team: teamDetails,
            estimation: estimationDays,
            assignedBy: user?.name,
            assignedAt: new Date().toISOString(),
        });

        // Notifikasi ke PM
        addNotification(
            'Proyek Siap Dikelola',
            `Anda ditunjuk sebagai PM untuk proyek ${selectedProject.name}. Silakan kelola di Kanban Board.`,
            'success',
            '/pm/kanban'
        );

        toast.success('Proyek berhasil dialokasikan ke tim!');
        setIsSubmitting(false);
        navigate('/pm/allocation');

        const nextQueue = readyProjects.filter(p => p.id !== selectedProject.id);
        if (nextQueue.length > 0) {
            setSelectedProject(nextQueue[0]);
            setSelectedPM('');
            setSelectedTeam([]);
            setEstimationDays('');
        } else {
            setSelectedProject(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#f8f9fb]">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        );
    }

    if (!selectedProject) {
        return (
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] flex items-center justify-center">
                <div className="text-center py-20 animate-scale-in">
                    <div className="w-24 h-24 rounded-3xl bg-cyan-100 text-cyan-600 flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Check size={48} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Tidak Ada Proyek Siap Alokasi</h2>
                    <p className="text-gray-500">Semua proyek telah berhasil diatur tim pengembangannya.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb] animate-slide-up">
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-800">Workspace Development Lead</h1>
                <p className="text-gray-500 mt-1 text-sm">
                    Tentukan Project Manager dan alokasikan tim developer untuk proyek yang siap dikembangkan.
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)] min-h-[600px]">
                {/* KIRI: Daftar Proyek */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Proyek Siap Alokasi</h2>
                            <p className="text-xs text-gray-500 mt-0.5">{readyProjects.length} proyek menunggu</p>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {readyProjects.map(project => (
                            <div
                                key={project.id}
                                onClick={() => setSelectedProject(project)}
                                className={`p-4 rounded-xl cursor-pointer transition-all relative overflow-hidden group ${
                                    selectedProject?.id === project.id
                                        ? 'bg-blue-50 border border-[#1A56DB] shadow-sm'
                                        : 'bg-white border border-gray-200 hover:border-[#1A56DB]/40'
                                }`}
                            >
                                {selectedProject?.id === project.id && (
                                    <div className="absolute left-0 top-0 w-1 h-full bg-[#1A56DB]" />
                                )}
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-[#1A56DB] bg-white px-2 py-0.5 rounded border border-blue-100">{project.id}</span>
                                </div>
                                <div className="mb-2"><RBBBadge type={project.type} deadline={project.rbbDeadline} /></div>
                                <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-[#1A56DB] transition-colors">{project.name}</h3>
                                <p className="text-xs text-gray-500 line-clamp-2">{project.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* KANAN: Detail & Form Alokasi */}
                <div className="w-full lg:w-2/3 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-200 shrink-0 bg-gray-50/50">
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded mb-2 inline-block">{selectedProject.id}</span>
                        <h2 className="text-2xl font-extrabold text-gray-800 mb-2">{selectedProject.name}</h2>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1.5"><Briefcase size={16} /> {selectedProject.division}</span>
                            <span className="flex items-center gap-1.5"><Calendar size={16} /> Target: {selectedProject.targetDate}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Summary / Detail Khusus */}
                        <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
                            <h3 className="text-sm font-bold text-cyan-800 mb-2 flex items-center gap-2">
                                <FileText size={16} /> Catatan & Keputusan Analis
                            </h3>
                            <p className="text-sm text-cyan-900 mb-2 font-medium">{selectedProject.analystResult?.decision || 'Disetujui'}</p>
                            <p className="text-sm text-cyan-700 italic">"{selectedProject.analystResult?.notes || 'Tidak ada catatan.'}"</p>
                        </div>

                        {/* Form Penentuan PM & Tim */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2">
                                <Users size={20} className="text-[#1A56DB]" /> Susun Tim Pengembangan
                            </h3>
                            
                            {/* Pilih PM */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Pilih Project Manager (PM) <span className="text-red-500">*</span></label>
                                <select
                                    value={selectedPM}
                                    onChange={(e) => setSelectedPM(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-50 outline-none transition-all bg-white"
                                >
                                    <option value="">-- Pilih Project Manager --</option>
                                    {pmCandidates.map(pm => (
                                        <option key={pm.id} value={pm.id}>{pm.name} - {pm.department} (Beban: {pm.workload} Proyek)</option>
                                    ))}
                                </select>
                            </div>

                            {/* Pilih Tim Developer */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Pilih Developer <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-gray-200 p-4 rounded-xl bg-gray-50/50">
                                    {developerCandidates.map(dev => (
                                        <label key={dev.id} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 hover:shadow-sm">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-[#1A56DB] rounded border-gray-300 focus:ring-[#1A56DB]"
                                                checked={selectedTeam.includes(dev.id)}
                                                onChange={() => handleToggleDev(dev.id)}
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-800">{dev.name}</span>
                                                <span className="text-xs text-gray-500">{dev.skill} • Beban: {dev.workload}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Estimasi Pengerjaan */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Estimasi Pengerjaan (Hari) <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={estimationDays}
                                        onChange={(e) => setEstimationDays(e.target.value)}
                                        placeholder="Misal: 30"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-50 outline-none transition-all bg-white"
                                    />
                                    <span className="absolute right-4 top-2.5 text-gray-400 text-sm font-medium">Hari</span>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4">
                                <button
                                    onClick={handleAssign}
                                    disabled={isSubmitting}
                                    className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <Send size={18} />}
                                    Kirim ke PM & Mulai Development
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
