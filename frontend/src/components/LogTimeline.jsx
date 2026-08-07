// src/components/LogTimeline.jsx
import { Calendar, Clock, Eye, ChevronRight } from 'lucide-react';
import { actionMap } from '../contexts/ActivityContext';

export default function LogTimeline({ activities, onViewDetail }) {
    const getStatusColor = (status) => {
        switch (status) {
            case 'success': return 'bg-emerald-500';
            case 'warning': return 'bg-amber-500';
            case 'danger': return 'bg-red-500';
            case 'system': return 'bg-purple-500';
            case 'ANALYSIS_APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'READY_FOR_DEVELOPMENT': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'IN_DEVELOPMENT': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            default: return 'bg-blue-500';
        }
    };

    const getStatusDot = (status) => {
        const colors = {
            success: 'bg-emerald-500 ring-emerald-200',
            warning: 'bg-amber-500 ring-amber-200',
            danger: 'bg-red-500 ring-red-200',
            system: 'bg-purple-500 ring-purple-200',
            info: 'bg-blue-500 ring-blue-200',
        };
        return colors[status] || 'bg-blue-500 ring-blue-200';
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return 'Baru saja';
        if (diffMin < 60) return `${diffMin} menit yang lalu`;
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)} jam yang lalu`;
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    return (
        <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-4">
                {activities.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">
                        Tidak ada aktivitas yang ditemukan.
                    </div>
                ) : (
                    activities.map((activity, index) => {
                        const actionConfig = actionMap[activity.action] || { icon: 'activity', color: 'text-gray-600', bg: 'bg-gray-50' };
                        const isLast = index === activities.length - 1;

                        return (
                            <div key={activity.id} className="relative pl-12">
                                {/* Timeline dot */}
                                <div className={`absolute left-3 top-4 w-4 h-4 rounded-full ${getStatusDot(activity.status)} ring-4 ring-white z-10`} />

                                {/* Card */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
                                    <div className="flex flex-col sm:flex-row justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1">
                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                                                {activity.userAvatar || getInitials(activity.user)}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                {/* User & Action */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-gray-800">{activity.user}</span>
                                                    <span className="text-gray-400 text-sm">·</span>
                                                    <span className={`text-sm font-medium ${actionConfig.color}`}>
                                                        {activity.actionLabel}
                                                    </span>
                                                    {activity.project && (
                                                        <>
                                                            <span className="text-gray-400 text-sm">·</span>
                                                            <span className="text-sm text-[#00529C] font-medium hover:underline cursor-pointer">
                                                                {activity.project}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Description */}
                                                <p className="text-sm text-gray-600 mt-1">{activity.description}</p>

                                                {/* Timestamp */}
                                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {formatTime(activity.timestamp)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} />
                                                        {new Date(activity.timestamp).toLocaleDateString('id-ID', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        })}
                                                    </span>
                                                    {activity.ip && activity.ip !== 'System' && (
                                                        <span className="font-mono text-[10px] bg-gray-100 px-2 py-0.5 rounded">
                                                            {activity.ip}
                                                        </span>
                                                    )}
                                                    {activity.role && (
                                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-500">
                                                            {activity.role}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => onViewDetail(activity)}
                                                className="p-1.5 text-gray-400 hover:text-[#00529C] hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Lihat Detail"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}