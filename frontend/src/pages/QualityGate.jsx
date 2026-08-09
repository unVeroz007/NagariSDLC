import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { qualityGateService } from '../services/api';
import ProjectTypeBadge from '../components/ProjectTypeBadge';
import toast from 'react-hot-toast';

import {
    CheckCircle,
    ChevronRight,
    Search,
    Bell,
    History,
    HelpCircle,
    Inbox,
    Rocket,
    AlertTriangle,
    Shield,
    FileText,
    Check,
    X,
    Users,
    Clock,
    Calendar,
    Server,
    Database,
    Loader,
    CheckSquare,
    ListChecks,
    ExternalLink,
    User,
    Building,
    Timer,
} from 'lucide-react';


export default function QualityGate() {
    const { user } = useAuth();
    const { projects, updateProject } = useProjects();

    const dynamicQueue = projects
        .filter(p => p.status === 'PENDING_GOLIVE' || p.status === 'UAT_PASSED')
        .map(p => ({
            id: p.id,
            projectId: p.id,
            projectName: p.name,
            division: p.division || 'Divisi TI',
            type: p.type === 'RBB' ? 'Mayor Release (RBB)' : 'Minor Release',
            project_type: p.project_type,
            goLiveDate: p.targetDate || '30 Agustus 2026',
            downtime: p.downtime || '60 Menit',
            pm: p.pm || { name: 'Budi Santoso', initial: 'BS' },
            status: 'Menunggu Approval',
            documents: {
                brd: { status: 'Lengkap', icon: FileText, label: 'Dokumen BRD & FSD', desc: 'Business & Functional Requirements' },
                qa: { status: 'Lulus QA', icon: CheckCircle, label: 'Laporan QA & UAT', desc: 'Sign-off dari bisnis user' },
                security: { status: 'Aman', icon: Shield, label: 'Security Pentest', desc: 'Tidak ada critical vulnerability' },
                infra: { status: 'Siap', icon: Server, label: 'Kesiapan Infrastruktur', desc: 'Server Produksi terskalakan' },
            },
            rollbackPlan: p.rollbackPlan || 'Restore database snapshot & revert versi deployment.',
        }));

    const queueList = dynamicQueue;
    const [selectedRelease, setSelectedRelease] = useState(queueList[0] || null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!selectedRelease && queueList.length > 0) {
            setSelectedRelease(queueList[0]);
        }
    }, [projects]);

    const handleApprove = async () => {
        if (!selectedRelease) return;
        if (!confirm(`Setujui rilis ${selectedRelease.projectName} (${selectedRelease.id}) untuk produksi?`)) return;
        setIsSubmitting(true);
        try {
            // Gunakan qualityGateService.approve() jika mode API
            const mode = import.meta.env.VITE_API_MODE || 'mock';
            if (mode === 'api') {
                await qualityGateService.approve(selectedRelease.projectId || selectedRelease.id, 'Disetujui oleh Head of IT');
            } else {
                await updateProjectStatus(selectedRelease.projectId || selectedRelease.id, 'LIVE_PRODUCTION');
            }
            toast.success(`Rilis ${selectedRelease.projectName} berhasil disetujui untuk produksi (LIVE_PRODUCTION)!`);
            const remaining = queueList.filter(item => item.id !== selectedRelease.id);
            setSelectedRelease(remaining.length > 0 ? remaining[0] : null);
        } catch (err) {
            toast.error(err.message || 'Gagal menyetujui rilis.');
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleReject = async () => {
        if (!selectedRelease) return;
        if (!confirm(`Tolak permohonan rilis ${selectedRelease.projectName}?`)) return;
        setIsSubmitting(true);
        try {
            if (selectedRelease.projectId) {
                await updateProject(selectedRelease.projectId, {
                    status: 'REJECTED',
                });
            }
            toast.error(`Rilis ${selectedRelease.projectName} ditolak.`);
            const remaining = dynamicQueue.filter(item => item.id !== selectedRelease.id);
            setSelectedRelease(remaining.length > 0 ? remaining[0] : null);
        } catch (err) {
            toast.error(err.message || 'Gagal menolak rilis.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        if (status === 'Menunggu Approval') {
            return (
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">
                    Menunggu Approval
                </span>
            );
        }
        return (
            <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">
                {status}
            </span>
        );
    };

    const getDocStatusBadge = (status) => {
        if (status === 'Lengkap' || status === 'Lulus QA' || status === 'Aman' || status === 'Siap') {
            return (
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                    {status}
                </span>
            );
        }
        return (
            <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                {status}
            </span>
        );
    };

    const getDocIcon = (status) => {
        if (status === 'Lengkap' || status === 'Lulus QA' || status === 'Aman' || status === 'Siap') {
            return <CheckCircle size={20} className="text-emerald-500 mr-3 shrink-0" />;
        }
        return <AlertTriangle size={20} className="text-amber-500 mr-3 shrink-0" />;
    };

    if (!selectedRelease) {
        return (
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Semua Rilis Telah Disetujui</h2>
                    <p className="text-gray-500 mt-2">Tidak ada antrean Quality Gate yang menunggu approval.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-[#f8f9fb] p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-800">Quality Gate Approval</h1>
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <ListChecks size={14} /> Fase 4 Compliance
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Portal evaluasi final & persetujuan rilis ke lingkungan produksi Bank Nagari.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Antrean Rilis */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                        <h2 className="font-bold text-gray-800 text-sm tracking-wide uppercase">
                            Antrean Permohonan Rilis ({queueList.length})
                        </h2>
                        <div className="space-y-3">
                            {queueList.map((rel) => (
                                <div
                                    key={rel.id}
                                    onClick={() => setSelectedRelease(rel)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                        selectedRelease.id === rel.id
                                            ? 'border-[#1a365d] bg-blue-50/40 ring-2 ring-[#1a365d]/10'
                                            : 'border-gray-100 hover:border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-mono font-bold text-gray-500">{rel.id}</span>
                                        {getStatusBadge(rel.status)}
                                    </div>
                                    <h3 className="font-semibold text-gray-800 text-sm line-clamp-1">{rel.projectName}</h3>
                                    {rel.project_type && (
                                        <div className="mt-1.5"><ProjectTypeBadge type={rel.project_type} /></div>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                        <Building size={12} />
                                        <span>{rel.division}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Detail Checklist 4 Pilar */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                        <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    {selectedRelease.id}
                                </span>
                                <h2 className="text-xl font-bold text-gray-800 mt-1">{selectedRelease.projectName}</h2>
                                <p className="text-xs text-gray-500">{selectedRelease.division} • {selectedRelease.type}</p>
                                {selectedRelease.project_type && (
                                    <div className="mt-1.5"><ProjectTypeBadge type={selectedRelease.project_type} /></div>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-1.5">
                                    <User size={14} className="text-gray-400" />
                                    <span className="font-medium text-gray-700">{selectedRelease.pm.name}</span>
                                </div>
                                <span className="text-gray-300">|</span>
                                <div className="flex items-center gap-1.5">
                                    <Timer size={14} className="text-gray-400" />
                                    <span className="font-medium text-gray-700">Downtime: {selectedRelease.downtime}</span>
                                </div>
                            </div>
                        </div>

                        {/* Checklist 4 Pilar */}
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                Checklist 4 Pilar Kelayakan SDLC
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.entries(selectedRelease.documents).map(([key, doc]) => {
                                    const DocIcon = doc.icon;
                                    return (
                                        <div key={key} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex items-start justify-between">
                                            <div className="flex items-start">
                                                {getDocIcon(doc.status)}
                                                <div>
                                                    <h4 className="font-semibold text-gray-800 text-sm">{doc.label}</h4>
                                                    <p className="text-xs text-gray-500 mt-0.5">{doc.desc}</p>
                                                </div>
                                            </div>
                                            {getDocStatusBadge(doc.status)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Rollback Plan */}
                        <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-xl">
                            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                <AlertTriangle size={14} className="text-amber-600" /> Rencana Rollback (Rollback Plan)
                            </h3>
                            <p className="text-xs text-amber-900 leading-relaxed font-mono">
                                {selectedRelease.rollbackPlan}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                            <button
                                onClick={handleReject}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold transition-all flex items-center gap-2"
                            >
                                <X size={16} /> Tolak Rilis
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <Loader size={16} className="animate-spin" />
                                ) : (
                                    <CheckCircle size={16} />
                                )}
                                Approve Rilis Produksi
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}