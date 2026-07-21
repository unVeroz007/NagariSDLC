import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
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

// Mock data untuk antrean Quality Gate
const qualityGateQueue = [
    {
        id: 'REL-REQ-2026-0015',
        projectName: 'Aplikasi LOS Baru',
        division: 'Divisi Kredit Consumer',
        type: 'Mayor Release',
        goLiveDate: '15 Juli 2026, 23:00 WIB',
        downtime: '120 Menit',
        pm: { name: 'Budi Santoso', initial: 'BS' },
        status: 'Menunggu Approval',
        documents: {
            brd: { status: 'Lengkap', icon: FileText, label: 'Dokumen BRD & FSD', desc: 'Business & Functional Requirements' },
            qa: { status: 'Lulus QA', icon: CheckCircle, label: 'Laporan QA & UAT', desc: 'Sign-off dari bisnis user' },
            security: { status: 'Aman', icon: Shield, label: 'Security Pentest', desc: 'Tidak ada critical vulnerability' },
            infra: { status: 'Siap', icon: Server, label: 'Kesiapan Infrastruktur', desc: 'Server Produksi terskalakan' },
        },
        rollbackPlan: 'Restore database dari backup snapshot terakhir (15/07) dan revert branch ke versi v1.4 pada server Load Balancer.',
    },
    {
        id: 'REL-REQ-2026-0012',
        projectName: 'Update Core Banking API',
        division: 'Divisi TI Core',
        type: 'Patch Release',
        goLiveDate: 'TBD',
        downtime: '30 Menit',
        pm: { name: 'Andi Wijaya', initial: 'AW' },
        status: 'Draft',
        documents: {
            brd: { status: 'Lengkap', icon: FileText, label: 'Dokumen BRD & FSD', desc: 'Business & Functional Requirements' },
            qa: { status: 'Lulus QA', icon: CheckCircle, label: 'Laporan QA & UAT', desc: 'Sign-off dari bisnis user' },
            security: { status: 'Aman', icon: Shield, label: 'Security Pentest', desc: 'Tidak ada critical vulnerability' },
            infra: { status: 'Siap', icon: Server, label: 'Kesiapan Infrastruktur', desc: 'Server Produksi terskalakan' },
        },
        rollbackPlan: 'Rollback ke versi sebelumnya melalui deployment pipeline.',
    },
];

export default function QualityGate() {
    const { user } = useAuth();
    const [selectedRelease, setSelectedRelease] = useState(qualityGateQueue[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleApprove = () => {
        if (!confirm(`Setujui rilis ${selectedRelease?.id} untuk produksi?`)) return;
        setIsSubmitting(true);
        setTimeout(() => {
            alert(`Rilis ${selectedRelease?.id} berhasil disetujui untuk produksi!`);
            setIsSubmitting(false);
            const index = qualityGateQueue.indexOf(selectedRelease);
            if (index > -1) qualityGateQueue.splice(index, 1);
            if (qualityGateQueue.length > 0) {
                setSelectedRelease(qualityGateQueue[0]);
            } else {
                setSelectedRelease(null);
            }
        }, 1500);
    };

    const handleReject = () => {
        if (!confirm(`Tolak rilis ${selectedRelease?.id}?`)) return;
        const index = qualityGateQueue.indexOf(selectedRelease);
        if (index > -1) qualityGateQueue.splice(index, 1);
        if (qualityGateQueue.length > 0) {
            setSelectedRelease(qualityGateQueue[0]);
        } else {
            setSelectedRelease(null);
        }
        alert(`Rilis ${selectedRelease?.id} ditolak!`);
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
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
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
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Quality Gate &amp; Approval Rilis</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Verifikasi kepatuhan akhir (compliance) dan persetujuan rilis ke lingkungan Produksi.
                </p>
            </div>

            {/* Split Layout */}
            <div className="flex flex-col lg:flex-row gap-6 min-h-0">
                {/* Left Panel: Inbox */}
                <div className="w-full lg:w-1/3 flex flex-col space-y-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Inbox size={20} />
                        Menunggu Review
                    </h3>

                    {qualityGateQueue.map((release) => (
                        <div
                            key={release.id}
                            onClick={() => setSelectedRelease(release)}
                            className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all ${selectedRelease?.id === release.id
                                    ? 'border-l-4 border-l-amber-500 border-amber-200 shadow-md'
                                    : 'border-gray-200 hover:shadow-md hover:border-gray-300'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold text-gray-800">{release.id}</span>
                                {getStatusBadge(release.status)}
                            </div>
                            <h4 className="text-lg font-bold text-[#1A56DB] mb-1">{release.projectName}</h4>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">
                                    {release.type}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 flex items-center border-t border-gray-100 pt-2">
                                <Calendar size={14} className="mr-1" />
                                Jadwal Go-Live: {release.goLiveDate}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Panel: Executive Review */}
                <div className="w-full lg:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    {/* Review Header */}
                    <div className="p-6 border-b border-gray-200 bg-gray-50/50">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">
                                    {selectedRelease.id} : {selectedRelease.projectName}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Requested by: {selectedRelease.division}
                                </p>
                            </div>
                            <button className="text-[#1A56DB] hover:text-[#1A56DB]/70">
                                <ExternalLink size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs font-semibold text-gray-500 mb-1">Jadwal Rilis</p>
                                <p className="font-bold text-gray-800 text-sm">{selectedRelease.goLiveDate}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs font-semibold text-gray-500 mb-1">Est. Downtime</p>
                                <p className="font-bold text-gray-800 text-sm">{selectedRelease.downtime}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg flex items-center">
                                <div className="w-8 h-8 rounded-full bg-[#1A56DB] text-white flex items-center justify-center font-bold text-xs mr-2">
                                    {selectedRelease.pm.initial}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Project Manager</p>
                                    <p className="font-bold text-gray-800 text-sm">{selectedRelease.pm.name}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Review Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Documents & Compliance */}
                        <section>
                            <h3 className="font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
                                Status Dokumen &amp; Kepatuhan
                            </h3>
                            <div className="space-y-3">
                                {Object.entries(selectedRelease.documents).map(([key, doc]) => {
                                    const Icon = doc.icon;
                                    return (
                                        <div
                                            key={key}
                                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50"
                                        >
                                            <div className="flex items-center">
                                                {getDocIcon(doc.status)}
                                                <div>
                                                    <p className="font-semibold text-sm text-gray-800">{doc.label}</p>
                                                    <p className="text-xs text-gray-500">{doc.desc}</p>
                                                </div>
                                            </div>
                                            {getDocStatusBadge(doc.status)}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Rollback Plan */}
                        <section>
                            <h3 className="font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
                                Rollback Plan
                            </h3>
                            <div className="bg-red-50/50 border border-red-200 p-4 rounded-lg flex items-start">
                                <AlertTriangle size={20} className="text-red-500 mr-3 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-bold text-sm text-red-800 mb-1">Prosedur Darurat</p>
                                    <p className="text-sm text-gray-700">{selectedRelease.rollbackPlan}</p>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50/50 flex justify-end space-x-4">
                        <button
                            onClick={handleReject}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-red-500 text-red-500 font-bold hover:bg-red-50 transition-colors"
                        >
                            <X size={18} />
                            Tolak Rilis
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <CheckCircle size={18} />
                            {isSubmitting ? 'Memproses...' : 'Setujui Rilis Produksi'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}