import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    Users,
    UserCheck,
    UserPlus,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    ChevronRight,
    Send,
    FileText,
    Building,
    User,
    Check,
    X,
    Eye,
    Filter,
    Search,
    Plus,
    Minus,
    Archive,
    ArrowRight,
} from 'lucide-react';
import { allocationProjects, pmCandidates, teamMembers } from '../../data/mockData';

export default function Allocation() {
    const { user } = useAuth();
    const [selectedProject, setSelectedProject] = useState(allocationProjects[0]);
    const [selectedPM, setSelectedPM] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Handle PM selection
    const handleSelectPM = (pm) => {
        setSelectedPM(pm);
    };

    // Handle team member selection
    const handleToggleTeamMember = (member) => {
        setSelectedTeam((prev) => {
            if (prev.find((m) => m.id === member.id)) {
                return prev.filter((m) => m.id !== member.id);
            } else {
                return [...prev, member];
            }
        });
    };

    // Handle submit
    const handleSubmit = () => {
        if (!selectedPM) {
            alert('Pilih Project Manager terlebih dahulu!');
            return;
        }
        if (selectedTeam.length === 0) {
            alert('Pilih minimal 1 anggota tim!');
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            alert(`Tim untuk proyek ${selectedProject?.name} berhasil dialokasikan!\nPM: ${selectedPM.name}\nTim: ${selectedTeam.map(m => m.name).join(', ')}`);
            setIsSubmitting(false);
            // Remove from queue
            const index = allocationProjects.indexOf(selectedProject);
            if (index > -1) allocationProjects.splice(index, 1);
            if (allocationProjects.length > 0) {
                setSelectedProject(allocationProjects[0]);
                setSelectedPM(null);
                setSelectedTeam([]);
            } else {
                setSelectedProject(null);
            }
        }, 1500);
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'Tinggi': return 'bg-red-500/10 text-red-600 border-red-200';
            case 'Sedang': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
            case 'Rendah': return 'bg-green-500/10 text-green-600 border-green-200';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getWorkloadColor = (label) => {
        switch (label) {
            case 'Rendah': return 'bg-emerald-100 text-emerald-700';
            case 'Sedang': return 'bg-amber-100 text-amber-700';
            case 'Tinggi': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (!selectedProject) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb] flex items-center justify-center">
                <div className="text-center py-20 animate-scale-in">
                    <div className="w-24 h-24 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <CheckCircle size={48} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Semua Proyek Sudah Dialokasikan</h2>
                    <p className="text-gray-500">Tidak ada proyek yang menunggu alokasi tim.</p>
                    <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-3 inline-block text-emerald-700 text-sm font-medium">
                        Tim sudah siap bekerja! 🎉
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#f8f9fb] overflow-hidden animate-slide-up">
            {/* Page Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 shrink-0">
                <div className="mt-0.5">
                    <h2 className="text-2xl font-extrabold text-gray-800">Alokasi Tim Development</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Tunjuk Project Manager (PM) dan susun tim developer untuk proyek yang telah disetujui Analis.
                    </p>
                </div>
            </div>

            {/* Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL: Inbox Proyek */}
                <div className="w-1/3 border-r border-gray-200 bg-gray-50/50 overflow-y-auto p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">Inbox Proyek</h3>
                        <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                            {allocationProjects.length}
                        </span>
                    </div>

                    {allocationProjects.map((project) => (
                        <div
                            key={project.id}
                            onClick={() => {
                                setSelectedProject(project);
                                setSelectedPM(null);
                                setSelectedTeam([]);
                            }}
                            className={`p-4 rounded-xl shadow-sm cursor-pointer transition-all ${selectedProject?.id === project.id
                                    ? 'bg-white border-2 border-[#1A56DB] relative overflow-hidden'
                                    : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md'
                                }`}
                        >
                            {selectedProject?.id === project.id && (
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#1A56DB]"></div>
                            )}
                            <div className="flex justify-between items-start mb-2">
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-1 rounded-md">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Siap Development
                                </span>
                                <span className="text-xs text-gray-500">Hari ini</span>
                            </div>
                            <h4 className="text-lg font-bold text-gray-800 mb-1">{project.name}</h4>
                            <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-3">
                                <Building size={16} />
                                {project.division}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Analis: {project.analyst}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getPriorityColor(project.priority)}`}>
                                    {project.priority}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* RIGHT PANEL: Detail & Form */}
                <div className="w-2/3 bg-white flex flex-col overflow-hidden relative">
                    {/* Background effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

                    <div className="flex-1 overflow-y-auto p-6 pb-32">
                        {/* Project Header */}
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h3 className="text-3xl font-bold text-gray-800">{selectedProject.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {selectedProject.id} • Prioritas {selectedProject.priority}
                                </p>
                            </div>
                        </div>

                        {/* Analyst Approval Alert */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex gap-4 items-start shadow-sm">
                            <div className="bg-[#1A56DB] text-white rounded-full p-2 flex shrink-0 mt-0.5">
                                <CheckCircle size={20} />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-gray-800 mb-1">Disetujui oleh Analis Sistem</h4>
                                <p className="text-sm text-gray-600 mb-2">
                                    Analisis kebutuhan (BRD/FSD) telah disetujui oleh {selectedProject.analyst} pada{' '}
                                    {new Date(selectedProject.approvedAt).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}. Silakan tunjuk tim development.
                                </p>
                                <button className="text-sm font-semibold text-[#1A56DB] hover:underline flex items-center gap-1">
                                    Lihat Dokumen BRD <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* SECTION 1: PM Selection */}
                        <section className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
                            <div className="bg-gray-100/50 p-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    <UserCheck size={20} className="text-[#1A56DB]" />
                                    1. Tunjuk Project Manager (Wajib)
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100/30 border-b border-gray-200 text-gray-500 text-xs uppercase font-semibold">
                                            <th className="p-4">Nama Kandidat</th>
                                            <th className="p-4">Departemen</th>
                                            <th className="p-4">Beban Kerja</th>
                                            <th className="p-4 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {pmCandidates.map((pm) => {
                                            const isSelected = selectedPM?.id === pm.id;
                                            return (
                                                <tr
                                                    key={pm.id}
                                                    className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50 border-l-4 border-l-[#1A56DB]' : ''
                                                        }`}
                                                >
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-[#1A56DB] text-white' : 'bg-gray-200 text-gray-600'
                                                                }`}>
                                                                {pm.initial}
                                                            </div>
                                                            <span className="font-medium text-gray-800">{pm.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-gray-500">{pm.department}</td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pm.workloadColor}`}>
                                                            {pm.workload} Proyek - {pm.workloadLabel}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {isSelected ? (
                                                            <button className="px-4 py-2 rounded-lg bg-[#1A56DB] text-white font-semibold flex items-center gap-2 ml-auto text-sm">
                                                                <CheckCircle size={16} />
                                                                PM Terpilih
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleSelectPM(pm)}
                                                                className="px-4 py-2 rounded-lg border border-[#1A56DB] text-[#1A56DB] font-semibold hover:bg-blue-50 transition-colors text-sm"
                                                            >
                                                                Pilih PM
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* SECTION 2: Developer Team */}
                        <section className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="bg-gray-100/50 p-4 border-b border-gray-200 flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    <Users size={20} className="text-[#1A56DB]" />
                                    2. Susun Tim Developer &amp; QA
                                </h2>
                                <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                    Pilih minimal 1
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100/30 border-b border-gray-200 text-gray-500 text-xs uppercase font-semibold">
                                            <th className="p-4 w-12 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-[#1A56DB] focus:ring-[#1A56DB] w-4 h-4"
                                                    checked={selectedTeam.length === teamMembers.length}
                                                    onChange={() => {
                                                        if (selectedTeam.length === teamMembers.length) {
                                                            setSelectedTeam([]);
                                                        } else {
                                                            setSelectedTeam([...teamMembers]);
                                                        }
                                                    }}
                                                />
                                            </th>
                                            <th className="p-4">Nama Tim</th>
                                            <th className="p-4">Peran/Skill</th>
                                            <th className="p-4">Beban Kerja</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {teamMembers.map((member) => {
                                            const isChecked = selectedTeam.some((m) => m.id === member.id);
                                            return (
                                                <tr
                                                    key={member.id}
                                                    className={`border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer ${isChecked ? 'bg-blue-50/30' : ''
                                                        }`}
                                                    onClick={() => handleToggleTeamMember(member)}
                                                >
                                                    <td className="p-4 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => { }}
                                                            className="rounded border-gray-300 text-[#1A56DB] focus:ring-[#1A56DB] w-4 h-4"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </td>
                                                    <td className="p-4 font-medium text-gray-800">{member.name}</td>
                                                    <td className="p-4 text-gray-500">{member.role}</td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${member.workloadColor}`}>
                                                            {member.workload} Proyek
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Selected Team Summary */}
                        {selectedTeam.length > 0 && (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-gray-700 flex items-center gap-2">
                                    <Users size={16} className="text-[#1A56DB]" />
                                    <span className="font-semibold">Tim terpilih ({selectedTeam.length}):</span>
                                    {selectedTeam.map((m, idx) => (
                                        <span key={m.id}>
                                            {m.name}{idx < selectedTeam.length - 1 ? ', ' : ''}
                                        </span>
                                    ))}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="absolute bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 flex justify-end gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <button className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
                            Batal
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 rounded-lg bg-[#003a73] text-white font-bold flex items-center gap-2 shadow-sm hover:bg-[#002a5a] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Users size={18} />
                            {isSubmitting ? 'Memproses...' : 'Kunci Tim & Mulai Fase Dev'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}