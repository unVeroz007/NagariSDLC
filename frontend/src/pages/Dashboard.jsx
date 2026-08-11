import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ProjectTypeBadge from '../components/ProjectTypeBadge';
import {
    Building2,
    Briefcase,
    FileEdit,
    Bug,
    Verified,
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
    MapPin,
    Flag,
    Rocket,
    ShieldCheck,
    Users,
    Code,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { PROJECT_STATUS, PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR, getProjectPhaseKey } from '../constants/projectStatus';

export default function Dashboard() {
    const { user } = useAuth();
    const { projects, isLoading, refreshData } = useProjects();
    const { notifications, unreadCount } = useNotifications();
    const navigate = useNavigate();

    // Helper navigasi lacak proyek langsung ke proyek yang dituju
    const handleTrackProject = (projectId) => {
        const isPmOrAdmin = ['project_manager', 'super_admin'].includes(user?.role);
        const targetPath = isPmOrAdmin ? '/pm/tracker' : '/track';
        if (projectId) {
            navigate(`${targetPath}?projectId=${projectId}`, { state: { projectId } });
        } else {
            navigate(targetPath);
        }
    };

    // 📊 Hitung metrics dari data proyek pakai PROJECT_STATUS constants & getProjectPhaseKey
    const metrics = useMemo(() => {
        const total = projects.length;
        const inisiasi = projects.filter(p => getProjectPhaseKey(p.status) === 1).length;
        const pengembangan = projects.filter(p => getProjectPhaseKey(p.status) === 2).length;
        const inisiasiDanDev = inisiasi + pengembangan;
        const pengujian = projects.filter(p => getProjectPhaseKey(p.status) === 3).length;
        const siapRilis = projects.filter(p => getProjectPhaseKey(p.status) === 4).length;

        return [
            {
                label: 'Total Proyek Aktif',
                value: total,
                subLabel: 'Total Keseluruhan Proyek SDLC',
                trend: '+1',
                trendUp: true,
                icon: Briefcase,
                iconBg: 'bg-blue-50',
                iconColor: 'text-[#00529C]',
                accentColor: 'from-[#00529C]/10 to-transparent',
                borderColor: 'border-blue-100',
                onClick: () => navigate('/projects'),
            },
            {
                label: 'Inisiasi & Pengembangan IT',
                value: inisiasiDanDev,
                subLabel: `${inisiasi} Inisiasi · ${pengembangan} Dev`,
                trend: `+${inisiasiDanDev}`,
                trendUp: true,
                icon: Code,
                iconBg: 'bg-indigo-50',
                iconColor: 'text-indigo-600',
                accentColor: 'from-indigo-500/10 to-transparent',
                borderColor: 'border-indigo-100',
                onClick: () => navigate('/pm/kanban'),
            },
            {
                label: 'Pengujian QA & Siber',
                value: pengujian,
                subLabel: 'QA Testing & Pentest Siber',
                trend: pengujian > 0 ? `+${pengujian}` : '0',
                trendUp: pengujian > 0,
                icon: Bug,
                iconBg: 'bg-purple-50',
                iconColor: 'text-purple-600',
                accentColor: 'from-purple-500/10 to-transparent',
                borderColor: 'border-purple-100',
                onClick: () => navigate('/workspace/qa'),
            },
            {
                label: 'Siap Rilis / Quality Gate',
                value: siapRilis,
                subLabel: 'UAT & Quality Gate Final',
                trend: siapRilis > 0 ? `+${siapRilis}` : '0',
                trendUp: true,
                icon: Verified,
                iconBg: 'bg-emerald-50',
                iconColor: 'text-emerald-600',
                accentColor: 'from-emerald-500/10 to-transparent',
                borderColor: 'border-emerald-100',
                onClick: () => navigate('/quality-gate'),
            },
        ];
    }, [projects, navigate]);

    // 📊 Distribusi fase — pakai getProjectPhaseKey (100% sinkron DB & realtime)
    const phases = useMemo(() => {
        const activeProjects = projects.filter(p => {
            const st = String(p?.status || '').toUpperCase();
            return st !== PROJECT_STATUS.CANCELLED;
        });
        const total = activeProjects.length || 1;

        const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
        activeProjects.forEach(p => {
            const pKey = getProjectPhaseKey(p.status);
            counts[pKey] = (counts[pKey] || 0) + 1;
        });

        const phaseList = [
            { label: 'Fase 1: Inisiasi & Analisis', count: counts[1], color: 'bg-[#00529C]' },
            { label: 'Fase 2: Pengembangan', count: counts[2], color: 'bg-indigo-500' },
            { label: 'Fase 3: Pengujian QA & Cyber', count: counts[3], color: 'bg-purple-500' },
            { label: 'Fase 4: Rilis & Quality Gate', count: counts[4], color: 'bg-emerald-500' },
        ];

        return phaseList.map(item => ({
            ...item,
            total,
            pct: Math.round((item.count / total) * 100),
        }));
    }, [projects]);

    // 📊 Analisis risiko pakai PROJECT_STATUS constants & deadline (100% sinkron DB)
    const risks = useMemo(() => {
        const total = projects.length || 1;
        const now = Date.now();
        const sevenDays = 7 * 86400000;

        let high = 0;
        let medium = 0;
        let low = 0;

        projects.forEach(p => {
            const isNearDeadline = p.rbbDeadline && (new Date(p.rbbDeadline).getTime() - now <= sevenDays);
            const isTargetNear = p.targetDate && p.targetDate !== 'TBD' && (new Date(p.targetDate).getTime() - now <= sevenDays);

            if (
                p.status === PROJECT_STATUS.REJECTED ||
                p.status === PROJECT_STATUS.RETURN_TO_DEV ||
                p.priority === 'High' ||
                (p.type === 'RBB' && isNearDeadline) ||
                isTargetNear
            ) {
                high++;
            } else if (
                [
                    PROJECT_STATUS.PENDING,
                    PROJECT_STATUS.IN_REVIEW,
                    PROJECT_STATUS.DEV_ANALYSIS,
                    PROJECT_STATUS.QA_IN_PROGRESS,
                    PROJECT_STATUS.CYBER_IN_PROGRESS,
                    PROJECT_STATUS.PENDING_GOLIVE,
                ].includes(p.status) ||
                p.priority === 'Medium'
            ) {
                medium++;
            } else {
                low++;
            }
        });

        return [
            { label: 'Risiko Tinggi', count: high, pct: Math.round((high / total) * 100), color: 'bg-red-500', textColor: 'text-red-600', dot: 'bg-red-500' },
            { label: 'Risiko Sedang', count: medium, pct: Math.round((medium / total) * 100), color: 'bg-amber-500', textColor: 'text-amber-600', dot: 'bg-amber-500' },
            { label: 'Risiko Rendah', count: low, pct: Math.round((low / total) * 100), color: 'bg-emerald-500', textColor: 'text-emerald-600', dot: 'bg-emerald-500' },
        ];
    }, [projects]);

    // 📋 Proyek prioritas — diurutkan berdasarkan status kritis & jenis proyek RBB
    const priorityProjects = useMemo(() => {
        const priorityOrder = [
            PROJECT_STATUS.REJECTED,
            PROJECT_STATUS.RETURN_TO_DEV,
            PROJECT_STATUS.PENDING_GOLIVE,
            PROJECT_STATUS.UAT_PASSED,
            PROJECT_STATUS.IN_REVIEW,
            PROJECT_STATUS.QA_IN_PROGRESS,
            PROJECT_STATUS.CYBER_IN_PROGRESS,
        ];
        const sorted = [...projects].sort((a, b) => {
            const aRbb = a.type === 'RBB' ? 0 : 1;
            const bRbb = b.type === 'RBB' ? 0 : 1;
            if (aRbb !== bRbb) return aRbb - bRbb;

            const aIdx = priorityOrder.indexOf(a.status);
            const bIdx = priorityOrder.indexOf(b.status);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });
        return sorted.slice(0, 5);
    }, [projects]);

    // 📅 Proyek RBB mendekati deadline (dalam 30 hari)
    const rbbUrgentProjects = useMemo(() => {
        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 86400000);
        return projects
            .filter(p => p.type === 'RBB' && p.rbbDeadline && new Date(p.rbbDeadline) <= thirtyDays
                && p.status !== PROJECT_STATUS.LIVE_PRODUCTION)
            .sort((a, b) => new Date(a.rbbDeadline) - new Date(b.rbbDeadline))
            .slice(0, 3);
    }, [projects]);

    // 📅 Hitung real-time proyek dengan deadline minggu ini (7 hari ke depan)
    const thisWeekDeadlineCount = useMemo(() => {
        const now = Date.now();
        const sevenDaysMs = 7 * 86400000;
        return projects.filter(p => {
            if (p.status === PROJECT_STATUS.LIVE_PRODUCTION || p.status === PROJECT_STATUS.CANCELLED) return false;
            const rawDeadline = p.rbbDeadline || p.targetDate || p.deadline || p.target_date;
            if (!rawDeadline || rawDeadline === 'TBD') return false;
            const deadlineTime = new Date(rawDeadline).getTime();
            if (isNaN(deadlineTime)) return false;

            const diffMs = deadlineTime - now;
            return diffMs <= sevenDaysMs;
        }).length;
    }, [projects]);

    // 🎯 Quick actions berdasarkan role
    const quickActions = useMemo(() => {
        const role = user?.role;
        if (role === 'project_manager') return [
            { label: 'PM Workspace', icon: Briefcase, action: () => navigate('/pm/workspace'), color: 'bg-blue-600' },
            { label: 'Lacak Proyek', icon: MapPin, action: () => handleTrackProject(''), color: 'bg-indigo-600' },
            { label: 'Ajukan QA', icon: Bug, action: () => navigate('/pm/qa-request'), color: 'bg-purple-600' },
            { label: 'Ajukan Rilis', icon: Rocket, action: () => navigate('/pm/release-request'), color: 'bg-emerald-600' },
        ];
        if (role === 'lead_group') return [
            { label: 'Workspace Lead', icon: Verified, action: () => navigate('/workspace/lead'), color: 'bg-amber-600' },
            { label: 'Antrean Review', icon: Clock, action: () => navigate('/queue'), color: 'bg-blue-600' },
        ];
        if (role === 'analyst') return [
            { label: 'Workspace Analyst', icon: FileEdit, action: () => navigate('/workspace/analyst'), color: 'bg-blue-600' },
        ];
        if (role === 'qa_lead') return [
            { label: 'Workspace QA', icon: Bug, action: () => navigate('/workspace/qa'), color: 'bg-[#00529C]' },
            { label: 'Tugas QA Saya', icon: CheckCircle, action: () => navigate('/my-tasks/qa'), color: 'bg-indigo-600' },
        ];
        if (role === 'cyber_team') return [
            { label: 'Workspace Cyber', icon: ShieldCheck, action: () => navigate('/workspace/cyber'), color: 'bg-orange-600' },
            { label: 'Tugas Siber Saya', icon: ShieldCheck, action: () => navigate('/my-tasks/cyber'), color: 'bg-red-600' },
        ];
        // super_admin
        return [
            { label: 'Buat Proyek', icon: PlusCircle, action: () => navigate('/projects/new'), color: 'bg-blue-600' },
            { label: 'Lacak Proyek', icon: MapPin, action: () => handleTrackProject(''), color: 'bg-indigo-600' },
            { label: 'Manajemen User', icon: Users, action: () => navigate('/admin/users'), color: 'bg-gray-700' },
            { label: 'Quality Gate', icon: Verified, action: () => navigate('/quality-gate'), color: 'bg-emerald-600' },
        ];
    }, [user, navigate]);

    // Helper untuk format waktu
    const formatTimeAgo = (timestamp) => {
        const date = new Date(timestamp);
        const diffMs = Date.now() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return 'Baru saja';
        if (diffMin < 60) return `${diffMin} menit yang lalu`;
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)} jam yang lalu`;
        const diffDays = Math.floor(diffMin / 1440);
        return `${diffDays} hari yang lalu`;
    };

    // 🕐 Aktivitas terkini (dari notifikasi)
    const activities = useMemo(() => {
        return notifications.slice(0, 5).map(n => ({
            icon: n.type === 'success' ? CheckCircle :
                n.type === 'warning' ? AlertTriangle :
                    n.type === 'danger' ? Bug :
                        FileText,
            iconBg: n.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                n.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                    n.type === 'danger' ? 'bg-red-50 text-red-500' :
                        'bg-blue-50 text-[#00529C]',
            text: <><span className="font-semibold">{n.title}</span> {n.message}</>,
            time: formatTimeAgo(n.createdAt),
            dot: n.type === 'success' ? 'bg-emerald-500' :
                n.type === 'warning' ? 'bg-amber-500' :
                    n.type === 'danger' ? 'bg-red-500' :
                        'bg-[#00529C]',
        }));
    }, [notifications]);

    // ⏳ Loading state
    if (isLoading) {
        return <LoadingSpinner text="Memuat dashboard..." />;
    }



    return (
        <div className="flex flex-col gap-6 px-6 py-4 lg:px-8 lg:py-5 animate-slide-up">

            {/* Welcome Banner */}
            <section className="relative rounded-2xl overflow-hidden shadow-md text-white"
                style={{ background: 'linear-gradient(135deg, #003a73 0%, #001838 60%, #0a2a5a 100%)' }}>

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
                                {unreadCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                        {unreadCount} notifikasi baru
                                    </span>
                                )}
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
                                className="flex items-center gap-2 bg-[#D4A017] hover:bg-[#b8861a] text-[#001838] font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-[#D4A017]/30 text-sm"
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

                    {/* Quick stats row - 3 Metric Items (Inisiasi, Deadline Minggu Ini, Proyek RBB Aktif) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 pt-6 border-t border-white/10">
                        {[
                            {
                                label: 'Tahap Inisiasi & Review',
                                value: projects.filter(p => getProjectPhaseKey(p.status) === 1).length,
                                icon: FileEdit,
                                color: 'text-amber-300',
                                onClick: () => navigate('/queue')
                            },
                            {
                                label: 'Deadline Minggu Ini',
                                value: thisWeekDeadlineCount,
                                icon: Clock,
                                color: 'text-yellow-300',
                                onClick: () => navigate('/projects')
                            },
                            {
                                label: 'Proyek RBB Aktif',
                                value: projects.filter(p => p.type === 'RBB' && p.status !== PROJECT_STATUS.LIVE_PRODUCTION && p.status !== PROJECT_STATUS.CANCELLED).length,
                                icon: AlertTriangle,
                                color: 'text-red-400',
                                onClick: () => navigate('/projects')
                            },
                        ].map((s, i) => (
                            <div
                                key={i}
                                onClick={s.onClick}
                                className="bg-white/10 hover:bg-white/15 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-sm transition-all cursor-pointer hover:-translate-y-0.5 active:scale-98"
                            >
                                <div className={`flex items-center gap-2 text-xs mb-1 ${s.color || 'text-blue-200/70'}`}>
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
                    <div
                        key={i}
                        onClick={m.onClick}
                        className={`bg-white rounded-xl p-5 shadow-sm border ${m.borderColor} card-hover relative overflow-hidden animate-slide-up-${i + 1} ${m.onClick ? 'cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]' : ''} transition-all`}
                    >
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
                        <div className="text-gray-700 text-sm font-bold">{m.label}</div>
                        {m.subLabel && <div className="text-xs text-gray-400 font-medium mt-1">{m.subLabel}</div>}
                    </div>
                ))}
            </section>

            {/* Quick Actions + RBB Deadline Row */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Quick Actions */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Zap size={16} className="text-[#D4A017]" /> Aksi Cepat
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {quickActions.map((a, i) => (
                            <button
                                key={i}
                                onClick={a.action}
                                className={`flex items-center gap-3 p-3 ${a.color} text-white rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all shadow-sm`}
                            >
                                <a.icon size={18} />
                                <span className="leading-tight text-left">{a.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* RBB Deadline */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Flag size={16} className="text-red-500" /> Deadline RBB Mendekat
                        <span className="ml-auto text-xs text-gray-400 font-normal">30 hari ke depan</span>
                    </h3>
                    {rbbUrgentProjects.length > 0 ? (
                        <div className="space-y-3">
                            {rbbUrgentProjects.map((p, i) => {
                                const rawDeadline = p.rbbDeadline || p.targetDate || p.deadline;
                                const daysLeft = Math.ceil((new Date(rawDeadline).getTime() - Date.now()) / 86400000);
                                const displayDays = isNaN(daysLeft) ? 'TBD' : (daysLeft < 0 ? `Terlewat ${Math.abs(daysLeft)}h` : (daysLeft === 0 ? 'Hari ini' : `${daysLeft}h`));

                                return (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-red-50/70 rounded-xl border border-red-100 hover:bg-red-100/60 transition-colors cursor-pointer" onClick={() => handleTrackProject(p.id)}>
                                        <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                                            <Flag size={16} className="text-red-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                                            <p className="text-xs text-gray-500">{p.id} · {p.division}</p>
                                            {p.project_type && (
                                                <div className="mt-1"><ProjectTypeBadge type={p.project_type} /></div>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-sm font-bold ${daysLeft <= 7 ? 'text-red-600' : 'text-amber-600'}`}>{displayDays}</p>
                                            <p className="text-[10px] text-gray-400">tersisa</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <CheckCircle size={32} className="text-emerald-400 mb-2" />
                            <p className="text-sm text-gray-500">Tidak ada RBB mendekati deadline.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Charts Row */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-bold text-gray-800">Distribusi Proyek per Fase</h3>
                        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{projects.length} Total Proyek</span>
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
                    <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-sm font-semibold text-[#00529C] hover:text-[#00529C]/80 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all">
                        Lihat Semua <ArrowRight size={15} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px] table-fixed">
                        <colgroup>
                            <col className="w-[32%]" />
                            <col className="w-[24%]" />
                            <col className="w-[20%]" />
                            <col className="w-[14%]" />
                            <col className="w-[10%]" />
                        </colgroup>
                        <thead>
                            <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/60">
                                <th className="py-3 px-5">Nama Proyek</th>
                                <th className="py-3 px-4">Divisi</th>
                                <th className="py-3 px-4">PM</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-5 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {priorityProjects.map((proj, idx) => (
                                <tr key={idx} className="table-row-hover group">
                                    <td className="py-4 px-5">
                                        <p className="font-semibold text-gray-800 group-hover:text-[#00529C] transition-colors truncate">{proj.name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{proj.id}</p>
                                        {proj.project_type && (
                                            <div className="mt-1.5"><ProjectTypeBadge type={proj.project_type} /></div>
                                        )}
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-slate-700 text-xs font-medium border border-slate-200/60 max-w-full">
                                            <Building2 size={13} className="text-slate-400 shrink-0" />
                                            <span className="truncate">{proj.division || 'Divisi TI'}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-gray-500 text-sm">{proj.pm?.name || '—'}</td>
                                    <td className="py-4 px-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                            PROJECT_STATUS_COLOR[proj.status] || 'bg-gray-50 text-gray-700 border-gray-200'
                                        }`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                            {PROJECT_STATUS_LABEL[proj.status] || proj.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-5 text-center">
                                        <button
                                            onClick={() => handleTrackProject(proj.id)}
                                            className="text-xs font-semibold text-[#00529C] bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-lg border border-[#00529C]/30 transition-all shadow-sm"
                                        >
                                            Lacak
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {priorityProjects.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center text-gray-400 text-sm">
                                        Belum ada proyek yang memerlukan perhatian khusus.
                                    </td>
                                </tr>
                            )}
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
                    <div className="absolute left-[3.3rem] top-0 bottom-0 w-px bg-gray-100" />
                    {activities.length > 0 ? (
                        activities.map((act, idx) => (
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
                        ))
                    ) : (
                        <div className="py-8 text-center text-gray-400 text-sm">
                            Belum ada aktivitas terkini.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}