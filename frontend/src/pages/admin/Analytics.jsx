import { useAuth } from '../../contexts/AuthContext';
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
} from 'lucide-react';
import { analyticsData } from '../../data/mockData';

export default function Analytics() {
    const { user } = useAuth();

    const kpiData = [
        {
            label: 'Avg. Cycle Time',
            value: analyticsData.avgCycleTime.value,
            unit: 'Hari',
            change: analyticsData.avgCycleTime.change,
            icon: Timer,
            iconBg: 'bg-blue-100',
            iconColor: 'text-[#1A56DB]',
            trend: 'down',
        },
        {
            label: 'Success Rate Rilis',
            value: analyticsData.successRate.value,
            unit: '%',
            change: analyticsData.successRate.change,
            icon: CheckCircle,
            iconBg: 'bg-green-100',
            iconColor: 'text-emerald-600',
            trend: 'up',
        },
        {
            label: 'Bug Density',
            value: analyticsData.bugDensity.value,
            unit: '/ modul',
            change: 0,
            icon: Bug,
            iconBg: 'bg-red-100',
            iconColor: 'text-red-500',
            trend: 'none',
        },
        {
            label: 'Project Velocity',
            value: analyticsData.velocity.value,
            unit: '%',
            change: 0,
            icon: Gauge,
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            trend: 'none',
        },
    ];

    // Mencari nilai max untuk skala chart
    const maxReleaseValue = Math.max(...analyticsData.releaseTrend.map(d => d.value));

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fb]">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Analitik Kinerja SDLC</h2>
                    <p className="text-sm text-gray-500 mt-1">Monitoring performa tim, kecepatan rilis, dan kesehatan proyek.</p>
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
                    {/* Bar Chart Left */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-6">Proyek Selesai per Divisi</h3>
                        <div className="space-y-5">
                            {analyticsData.divisions.map((div, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between font-semibold text-sm text-gray-700 mb-2">
                                        <span>{div.name}</span>
                                        <span>{div.value} Proyek</span>
                                    </div>
                                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-[#1A56DB] h-full rounded-full"
                                            style={{ width: `${div.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Progress Bars Right */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-6">Penyebab Keterlambatan Terbanyak</h3>
                        <div className="space-y-5">
                            {analyticsData.delays.map((delay) => (
                                <div key={delay.rank} className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm">
                                        {delay.rank}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
                                            <span>{delay.reason}</span>
                                            <span>{delay.percentage}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${delay.rank === 1 ? 'bg-amber-500' :
                                                        delay.rank === 2 ? 'bg-amber-500/80' :
                                                            delay.rank === 3 ? 'bg-amber-500/60' :
                                                                'bg-amber-500/40'
                                                    }`}
                                                style={{ width: `${delay.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                        <svg className="absolute inset-0 w-full h-full pt-16 pb-12 px-8 pointer-events-none" preserveAspectRatio="none">
                            {(() => {
                                const points = analyticsData.releaseTrend.map((d, i) => {
                                    const x = (i / (analyticsData.releaseTrend.length - 1)) * 100;
                                    const y = 100 - (d.value / maxReleaseValue) * 85;
                                    return `${x},${y}`;
                                }).join(' ');
                                return (
                                    <>
                                        <polyline
                                            points={points}
                                            fill="none"
                                            stroke="#1a56db"
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

                        {/* Data points & labels */}
                        {analyticsData.releaseTrend.map((d, idx) => {
                            const height = (d.value / maxReleaseValue) * 85;
                            const isLast = idx === analyticsData.releaseTrend.length - 1;
                            return (
                                <div key={idx} className="flex flex-col items-center justify-end h-full z-10 relative">
                                    <div
                                        className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${isLast ? 'bg-[#D4A017]' : 'bg-[#1A56DB]'
                                            }`}
                                        style={{ marginBottom: `${height}%` }}
                                    />
                                    <span className={`text-xs font-semibold mt-2 ${isLast ? 'text-gray-800' : 'text-gray-500'}`}>
                                        {d.month}
                                    </span>
                                    {isLast && (
                                        <div className="absolute bottom-[calc(35px+2%)] bg-white border border-gray-200 shadow-lg rounded-lg p-2 mb-2 w-max text-center">
                                            <p className="text-xs text-gray-500">Juni</p>
                                            <p className="text-sm font-bold text-[#1A56DB]">{d.value} Rilis</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}