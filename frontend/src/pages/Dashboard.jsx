import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    Briefcase,
    FileEdit,
    Bug,
    Verified,
    MoreVertical,
    UserPlus,
    FileText,
    CheckCircle,
    PlusCircle,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    Activity,
    Zap,
    Clock,
    AlertTriangle,
} from 'lucide-react';

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const metrics = [
        {
            label: 'Total Proyek Aktif',
            value: '24',
            trend: '+3',
            trendUp: true,
            icon: Briefcase,
            iconBg: 'bg-blue-50',
            iconColor: 'text-[#1A56DB]',
            accentColor: 'from-[#1A56DB]/10 to-transparent',
            borderColor: 'border-blue-100',
        },
        {
            label: 'Tahap Inisiasi',
            value: '8',
            trend: '+1',
            trendUp: true,
            icon: FileEdit,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            accentColor: 'from-amber-500/10 to-transparent',
            borderColor: 'border-amber-100',
        },
        {
            label: 'Pengujian QA & Siber',
            value: '5',
            trend: '-2',
            trendUp: false,
            icon: Bug,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            accentColor: 'from-purple-500/10 to-transparent',
            borderColor: 'border-purple-100',
        },
        {
            label: 'Siap Rilis',
            value: '2',
            trend: '+2',
            trendUp: true,
            icon: Verified,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            accentColor: 'from-emerald-500/10 to-transparent',
            borderColor: 'border-emerald-100',
        },
    ];

    const projects = [
        { name: 'Aplikasi LOS (Loan Origination System)', division: 'Divisi Kredit', phase: 'Fase 4: Rilis', status: 'Menunggu Approval Rilis', statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { name: 'QRIS Mobile Banking', division: 'Divisi Digital Banking', phase: 'Fase 3: Pengujian', status: 'QA Testing', statusColor: 'bg-purple-50 text-purple-700 border-purple-200' },
        { name: 'Update Core Banking v2.4', division: 'Divisi TI', phase: 'Fase 2: Pengembangan', status: 'Development', statusColor: 'bg-amber-50 text-amber-700 border-amber-200' },
        { name: 'Dashboard HRIS Enterprise', division: 'Divisi SDM', phase: 'Fase 1: Inisiasi', status: 'Review Analis', statusColor: 'bg-blue-50 text-blue-700 border-blue-200' },
    ];

    const activities = [
        { icon: Verified, iconBg: 'bg-blue-50 text-[#1A56DB]', text: <><span className="font-semibold">Ahmad Fauzi</span> menyetujui rilis <span className="text-[#1A56DB] font-medium">REL-REQ-2026-0015</span></>, time: '10 menit yang lalu', dot: 'bg-[#1A56DB]' },
        { icon: UserPlus, iconBg: 'bg-purple-50 text-purple-600', text: <><span className="font-semibold">Budi Santoso</span> mengalokasikan tim untuk <span className="text-[#1A56DB] font-medium">QRIS Mobile Banking</span></>, time: '25 menit yang lalu', dot: 'bg-purple-500' },
        { icon: FileText, iconBg: 'bg-amber-50 text-amber-600', text: <><span className="font-semibold">Siti Aminah</span> mengunggah dokumen FSD <span className="text-[#1A56DB] font-medium">Aplikasi LOS</span></>, time: '1 jam yang lalu', dot: 'bg-amber-500' },
        { icon: CheckCircle, iconBg: 'bg-emerald-50 text-emerald-600', text: <><span className="font-semibold">System</span> menyelesaikan Quality Gate otomatis untuk <span className="text-[#1A56DB] font-medium">Core Banking Upgrade</span></>, time: '2 jam yang lalu', dot: 'bg-emerald-500' },
        { icon: PlusCircle, iconBg: 'bg-blue-50 text-[#1A56DB]', text: <><span className="font-semibold">Ahmad Fauzi</span> membuat inisiasi proyek baru <span className="text-[#1A56DB] font-medium">Sistem HRIS Terintegrasi</span></>, time: '3 jam yang lalu', dot: 'bg-sky-500' },
    ];

    const phases = [
        { label: 'Fase 1: Inisiasi & Analisis', count: 8, total: 24, pct: 33, color: 'bg-[#1A56DB]' },
        { label: 'Fase 2: Pengembangan', count: 9, total: 24, pct: 37, color: 'bg-indigo-500' },
        { label: 'Fase 3: Pengujian QA & Cyber', count: 5, total: 24, pct: 21, color: 'bg-purple-500' },
        { label: 'Fase 4: Rilis & Quality Gate', count: 2, total: 24, pct: 9, color: 'bg-emerald-500' },
    ];

    const risks = [
        { label: 'Risiko Tinggi', count: 3, pct: 12.5, color: 'bg-red-500', textColor: 'text-red-600', dot: 'bg-red-500' },
        { label: 'Risiko Sedang', count: 7, pct: 29, color: 'bg-amber-500', textColor: 'text-amber-600', dot: 'bg-amber-500' },
        { label: 'Risiko Rendah', count: 14, pct: 58.5, color: 'bg-emerald-500', textColor: 'text-emerald-600', dot: 'bg-emerald-500' },
    ];

    return (
        <div className="flex flex-col gap-6 p-6 lg:p-8 animate-slide-up">

            {/* Welcome Banner */}
            <section className="relative rounded-2xl overflow-hidden shadow-md text-white"
                style={{ background: 'linear-gradient(135deg, #003a73 0%, #001838 60%, #0a2a5a 100%)' }}>

                {/* Background decorations */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #4A90D9, transparent 70%)' }} />
                    <div className="absolute right-1/4 bottom-0 w-48 h-48 rounded-full opacity-5"
                        style={{ background: 'radial-gradient(circle, #D4A017, transparent 70%)' }} />
                    <div className="absolute -left-8 -bottom-8 w-48 h-48 rounded-full opacity-5"
                        style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
                    <Building2 size={220} className="absolute -right-4 top-1/2 -translate-y-1/2 opacity-5" />
                </div>

                <div className="relative z-10 p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="bg-[#D4A017]/20 text-[#D4A017] text-xs font-bold px-3 py-1 rounded-full border border-[#D4A017]/30 flex items-center gap-1.5">
                                    <Zap size={12} />
                                    SDLC Dashboard Aktif
                                </span>
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight mb-2">
                                Selamat Datang, {user?.name}! 👋
                            </h2>
                            <p className="text-blue-200/80 text-base max-w-xl">
                                Pantau dan kelola seluruh siklus pengembangan proyek SDLC Bank Nagari dari satu dasbor terpadu.
                            </p>
                        </div>
                        <div className="flex gap-3 shrink-0">
                            <button
                                onClick={() => navigate('/projects/new')}
                                className="flex items-center gap-2 bg-[#D4A017] hover:bg-[#b8861a] text-[#001838] font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-[#D4A017]/30 btn-shimmer text-sm"
                            >
                                <PlusCircle size={18} />
                                Proyek Baru
                            </button>
                            <button
                                onClick={() => navigate('/projects')}
                                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-5 py-2.5 rounded-xl border border-white/20 transition-all text-sm"
                            >
                                <Activity size={18} />
                                Semua Proyek
                            </button>
                        </div>
                    </div>

                    {/* Quick stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/10">
                        {[
                            { label: 'Proyek Selesai Bulan Ini', value: '6', icon: CheckCircle },
                            { label: 'Deadline Minggu Ini', value: '3', icon: Clock },
                            { label: 'Butuh Perhatian', value: '2', icon: AlertTriangle },
                            { label: 'Anggota Tim Aktif', value: '47', icon: UserPlus },
                        ].map((s, i) => (
                            <div key={i} className="bg-white/8 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-sm hover:bg-white/12 transition-colors cursor-default">
                                <div className="flex items-center gap-2 text-blue-200/70 text-xs mb-1">
                                    <s.icon size={13} />
                                    {s.label}
                                </div>
                                <div className="text-white font-bold text-xl">{s.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Metrics Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {metrics.map((m, i) => (
                    <div key={i} className={`bg-white rounded-xl p-5 shadow-sm border ${m.borderColor} card-hover relative overflow-hidden animate-slide-up-${i + 1}`}>
                        {/* Gradient accent */}
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${m.accentColor}`} />

                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-11 h-11 rounded-xl ${m.iconBg} ${m.iconColor} flex items-center justify-center shadow-sm`}>
                                <m.icon size={22} />
                            </div>
                            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${m.trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                {m.trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {m.trend} bulan ini
                            </span>
                        </div>
                        <div className="text-3xl font-extrabold text-gray-800 mb-1">{m.value}</div>
                        <div className="text-gray-500 text-sm font-medium">{m.label}</div>
                    </div>
                ))}
            </section>

            {/* Charts Row */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Distribusi Fase */}
                <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-bold text-gray-800">Distribusi Proyek per Fase</h3>
                        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">24 Total Proyek</span>
                    </div>
                    <div className="space-y-5">
                        {phases.map((p, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium text-gray-700">{p.label}</span>
                                    <span className="text-gray-500 font-semibold">{p.count} Proyek <span className="text-gray-400 font-normal">({p.pct}%)</span></span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`${p.color} h-2.5 rounded-full animate-progress`}
                                        style={{ width: `${p.pct}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Analisis Risiko */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-bold text-gray-800">Analisis Risiko</h3>
                        <AlertTriangle size={18} className="text-amber-500" />
                    </div>
                    <div className="space-y-5 flex-1">
                        {risks.map((r, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className={`font-semibold flex items-center gap-2 ${r.textColor}`}>
                                        <span className={`w-2.5 h-2.5 rounded-full ${r.dot}`} />
                                        {r.label}
                                    </span>
                                    <span className="text-gray-600 font-bold">{r.count}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                    <div className={`${r.color} h-2.5 rounded-full animate-progress`} style={{ width: `${r.pct}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100 leading-relaxed">
                        Berdasarkan parameter keterlambatan milestone dan ketersediaan resource.
                    </p>
                </div>
            </section>

            {/* Tabel Proyek Prioritas */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-base font-bold text-gray-800">Daftar Proyek Prioritas</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Proyek yang memerlukan perhatian segera</p>
                    </div>
                    <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-sm font-semibold text-[#1A56DB] hover:text-[#1A56DB]/80 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all">
                        Lihat Semua <ArrowRight size={15} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/60">
                                <th className="py-3 px-5">Nama Proyek</th>
                                <th className="py-3 px-5">Divisi</th>
                                <th className="py-3 px-5">Fase</th>
                                <th className="py-3 px-5">Status</th>
                                <th className="py-3 px-5 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {projects.map((proj, idx) => (
                                <tr key={idx} className="table-row-hover group">
                                    <td className="py-4 px-5 font-semibold text-gray-800 group-hover:text-[#1A56DB] transition-colors">{proj.name}</td>
                                    <td className="py-4 px-5 text-gray-500">{proj.division}</td>
                                    <td className="py-4 px-5 text-gray-500 text-xs">{proj.phase}</td>
                                    <td className="py-4 px-5">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${proj.statusColor}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                            {proj.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-5 text-center">
                                        <button className="text-gray-300 hover:text-[#1A56DB] hover:bg-blue-50 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                            <MoreVertical size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Aktivitas Terkini */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-gray-800">Aktivitas Terkini</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Pembaruan real-time dari seluruh tim</p>
                    </div>
                    <Activity size={18} className="text-gray-400" />
                </div>
                <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[3.3rem] top-0 bottom-0 w-px bg-gray-100" />
                    {activities.map((act, idx) => (
                        <div key={idx} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/70 transition-colors relative">
                            <div className={`w-10 h-10 rounded-full ${act.iconBg} flex items-center justify-center shrink-0 relative z-10 ring-4 ring-white`}>
                                <act.icon size={18} />
                            </div>
                            <div className="flex-1 pt-1">
                                <p className="text-sm text-gray-700 leading-relaxed">{act.text}</p>
                                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                    <Clock size={11} />
                                    {act.time}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}