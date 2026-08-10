import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService } from '../../services/api';
import {
    Timer,
    CheckCircle,
    Bug,
    Gauge,
    ChevronRight,
    Bell,
    Settings,
    HelpCircle,
    TrendingUp,
    TrendingDown,
    BarChart,
    Activity,
    Loader2,
    Users,
} from 'lucide-react';

export default function Analytics() {
    const { user } = useAuth();
    const [analyticsData, setAnalyticsData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setIsLoading(true);
            try {
                const res = await dashboardService.getAnalytics();
                if (res && res.data) {
                    setAnalyticsData(res.data);
                }
            } catch {
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (isLoading || !analyticsData) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#f8f9fb]">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-[#003a73] mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Memuat data analitik...</p>
                </div>
            </div>
        );
    }

    const kpiData = [
        {
            label: 'Avg. Cycle Time',
            value: analyticsData.avg_cycle_time?.value ?? 0,
            unit: 'Hari',
            change: analyticsData.avg_cycle_time?.change ?? 0,
            icon: Timer,
            iconBg: 'bg-blue-100',
            iconColor: 'text-[#00529C]',
            trend: 'down',
        },
        {
            label: 'Success Rate Rilis',
            value: analyticsData.success_rate?.value ?? 0,
            unit: '%',
            change: analyticsData.success_rate?.change ?? 0,
            icon: CheckCircle,
            iconBg: 'bg-green-100',
            iconColor: 'text-emerald-600',
            trend: 'up',
        },
        {
            label: 'Bug Density',
            value: analyticsData.bug_density?.value ?? 0,
            unit: '/ modul',
            change: analyticsData.bug_density?.change ?? 0,
            icon: Bug,
            iconBg: 'bg-red-100',
            iconColor: 'text-red-500',
            trend: 'none',
        },
        {
            label: 'Proyek Selesai',
            value: analyticsData.velocity?.value ?? 0,
            unit: 'proyek',
            change: analyticsData.velocity?.change ?? 0,
            icon: Gauge,
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            trend: 'none',
        },
    ];

    const releaseTrend = analyticsData.release_trend || [];
    const maxReleaseValue = Math.max(...releaseTrend.map(d => d.value), 1);

    // Status distribution for bar chart
    const statusDistribution = analyticsData.status_distribution || {};
    const statusLabels = {
        PENDING: 'Pending',
        APPROVED: 'Disetujui',
        IN_DEVELOPMENT: 'Pengembangan',
        QA_IN_PROGRESS: 'QA Testing',
        CYBER_IN_PROGRESS: 'Cyber Audit',
        PENDING_GOLIVE: 'Menunggu Go-Live',
        LIVE_PRODUCTION: 'Produksi',
    };
    const statusColors = {
        PENDING: 'bg-amber-400',
        APPROVED: 'bg-blue-400',
        IN_DEVELOPMENT: 'bg-indigo-500',
        QA_IN_PROGRESS: 'bg-teal-500',
        CYBER_IN_PROGRESS: 'bg-rose-500',
        PENDING_GOLIVE: 'bg-orange-500',
        LIVE_PRODUCTION: 'bg-emerald-500',
    };
    const totalStatusCount = Object.values(statusDistribution).reduce((a, b) => a + b, 0) || 1;

    // Developer workloads
    const workloads = analyticsData.developer_workloads || [];

    // Role distribution
    const roleDistribution = analyticsData.role_distribution || [];

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Analitik Kinerja SDLC</h2>
                        <p className="text-sm text-gray-500 mt-1">Monitoring performa tim, kecepatan rilis, dan kesehatan proyek — data real dari database.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-semibold text-emerald-700">Live dari Database</span>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpiData.map((kpi, idx) => {
                        const Icon = kpi.icon;
                        return (
                            <div key={idx} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-sm font-semibold text-gray-500">{kpi.label}</h3>
                                    <div className={`w-8 h-8 rounded-lg ${kpi.iconBg} flex items-center justify-center ${kpi.iconColor}`}>
                                        <Icon size={20} />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-gray-800">{kpi.value}</span>
                                    <span className="text-sm text-gray-500">{kpi.unit}</span>
                                    {kpi.change !== 0 && (
                                        <span className={`text-xs font-semibold flex items-center ${kpi.trend === 'up' ? 'text-emerald-600' : 'text-red-500'
                                            }`}>
                                            {kpi.trend === 'up' ? <TrendingUp size={14} className="mr-0.5" /> : <TrendingDown size={14} className="mr-0.5" />}
                                            {Math.abs(kpi.change)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status Distribution */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-6">Distribusi Status Proyek</h3>
                        <div className="space-y-5">
                            {Object.entries(statusDistribution).map(([status, count]) => (
                                <div key={status}>
                                    <div className="flex justify-between font-semibold text-sm text-gray-700 mb-2">
                                        <span>{statusLabels[status] || status}</span>
                                        <span>{count} Proyek</span>
                                    </div>
                                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                        <div
                                            className={`${statusColors[status] || 'bg-gray-400'} h-full rounded-full transition-all duration-500`}
                                            style={{ width: `${(count / totalStatusCount) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {Object.keys(statusDistribution).length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-4">Belum ada data proyek.</p>
                            )}
                        </div>
                    </div>

                    {/* Role Distribution */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-6">Distribusi Pengguna per Role</h3>
                        <div className="space-y-5">
                            {roleDistribution.map((item, idx) => {
                                const totalUsers = analyticsData.total_users || 1;
                                const pct = ((item.count / totalUsers) * 100).toFixed(0);
                                return (
                                    <div key={idx}>
                                        <div className="flex justify-between font-semibold text-sm text-gray-700 mb-2">
                                            <span>{item.role}</span>
                                            <span>{item.count} pengguna ({pct}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                            <div
                                                className="bg-[#00529C] h-full rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {roleDistribution.length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-4">Belum ada data pengguna.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Line Chart - Release Trend */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 h-[400px] flex flex-col relative overflow-hidden">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 relative z-10">Tren Proyek Rilis (6 Bulan Terakhir)</h3>

                    <div className="flex-1 flex items-end justify-between px-8 pb-8 pt-12 relative">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pt-16 pb-12 px-8 pointer-events-none">
                            <div className="border-t border-gray-200 w-full opacity-50"></div>
                            <div className="border-t border-gray-200 w-full opacity-50"></div>
                            <div className="border-t border-gray-200 w-full opacity-50"></div>
                            <div className="border-t border-gray-200 w-full opacity-50"></div>
                        </div>

                        {/* SVG Line Chart */}
                        {releaseTrend.length > 1 && (
                            <svg className="absolute inset-0 w-full h-full pt-16 pb-12 px-8 pointer-events-none" preserveAspectRatio="none">
                                {(() => {
                                    const points = releaseTrend.map((d, i) => {
                                        const x = (i / (releaseTrend.length - 1)) * 100;
                                        const y = 100 - (d.value / maxReleaseValue) * 85;
                                        return `${x},${y}`;
                                    }).join(' ');
                                    return (
                                        <>
                                            <polyline
                                                points={points}
                                                fill="none"
                                                stroke="#00529C"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="4"
                                            />
                                            <polyline
                                                points={`${points} ${100},100 0,100`}
                                                fill="rgba(26, 86, 219, 0.08)"
                                                stroke="none"
                                            />
                                        </>
                                    );
                                })()}
                            </svg>
                        )}

                        {/* Data points & labels */}
                        {releaseTrend.map((d, idx) => {
                            const height = (d.value / maxReleaseValue) * 85;
                            const isLast = idx === releaseTrend.length - 1;
                            return (
                                <div key={idx} className="flex flex-col items-center justify-end h-full z-10 relative">
                                    <div
                                        className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${isLast ? 'bg-[#D4A017]' : 'bg-[#00529C]'
                                            }`}
                                        style={{ marginBottom: `${height}%` }}
                                    />
                                    <span className={`text-xs font-semibold mt-2 ${isLast ? 'text-gray-800' : 'text-gray-500'}`}>
                                        {d.month}
                                    </span>
                                    {isLast && d.value > 0 && (
                                        <div className="absolute bottom-[calc(35px+2%)] bg-white border border-gray-200 shadow-lg rounded-lg p-2 mb-2 w-max text-center">
                                            <p className="text-xs text-gray-500">{d.month}</p>
                                            <p className="text-sm font-bold text-[#00529C]">{d.value} Rilis</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {releaseTrend.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <p className="text-sm text-gray-400">Belum ada data rilis.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Developer Workload */}
                {workloads.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                            <Users size={20} className="text-[#003a73]" />
                            Beban Kerja Developer
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {workloads.map((dev, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="w-10 h-10 rounded-full bg-[#003a73]/10 text-[#003a73] flex items-center justify-center font-bold text-sm">
                                        {dev.name?.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) || 'U'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-gray-800 truncate">{dev.name}</p>
                                        <p className="text-xs text-gray-500">{dev.workload} proyek aktif</p>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${dev.workload >= 3 ? 'bg-red-100 text-red-700' :
                                        dev.workload >= 2 ? 'bg-amber-100 text-amber-700' :
                                            'bg-emerald-100 text-emerald-700'
                                        }`}>
                                        {dev.workload >= 3 ? 'Tinggi' : dev.workload >= 2 ? 'Sedang' : 'Rendah'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
                        <p className="text-3xl font-bold text-[#003a73]">{analyticsData.total_projects ?? 0}</p>
                        <p className="text-sm text-gray-500 mt-1">Total Proyek</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
                        <p className="text-3xl font-bold text-[#003a73]">{analyticsData.total_users ?? 0}</p>
                        <p className="text-sm text-gray-500 mt-1">Total Pengguna</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
                        <p className="text-3xl font-bold text-[#003a73]">{analyticsData.total_tasks ?? 0}</p>
                        <p className="text-sm text-gray-500 mt-1">Total Task</p>
                    </div>
                </div>
            </div>
        </div>
    );
}