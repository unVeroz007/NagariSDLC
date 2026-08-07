// src/components/LogDetailModal.jsx
import { X, Calendar, Clock, User, Folder, Tag, Server, CheckCircle, AlertCircle } from 'lucide-react';
import { actionMap } from '../contexts/ActivityContext';

export default function LogDetailModal({ activity, isOpen, onClose }) {
    if (!isOpen || !activity) return null;

    const actionConfig = actionMap[activity.action] || { icon: 'activity', color: 'text-gray-600', bg: 'bg-gray-50' };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getStatusBadge = (status) => {
        const colors = {
            success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            warning: 'bg-amber-100 text-amber-700 border-amber-200',
            danger: 'bg-red-100 text-red-700 border-red-200',
            system: 'bg-purple-100 text-purple-700 border-purple-200',
            info: 'bg-blue-100 text-blue-700 border-blue-200',
        };
        return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const getStatusLabel = (status) => {
        const labels = {
            success: 'Berhasil',
            warning: 'Peringatan',
            danger: 'Gagal',
            system: 'Sistem',
            info: 'Informasi',
        };
        return labels[status] || status;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${actionConfig.bg} ${actionConfig.color} flex items-center justify-center`}>
                            <span className="material-symbols-outlined text-[24px]">{actionConfig.icon}</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">{activity.actionLabel}</h3>
                            <p className="text-sm text-gray-500">ID: #{activity.id}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <div className="space-y-4">
                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">User</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                                        {activity.userAvatar || activity.user?.charAt(0) || 'U'}
                                    </div>
                                    <span className="font-medium text-gray-800">{activity.user}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</p>
                                <p className="font-medium text-gray-800">{activity.role || '-'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Proyek</p>
                                <p className="font-medium text-gray-800">{activity.project || '-'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</p>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(activity.status)}`}>
                                    {activity.status === 'success' ? <CheckCircle size={12} /> : activity.status === 'warning' ? <AlertCircle size={12} /> : null}
                                    {getStatusLabel(activity.status)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Waktu</p>
                                <p className="font-medium text-gray-800 flex items-center gap-2 text-sm">
                                    <Clock size={14} />
                                    {formatDate(activity.timestamp)}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">IP Address</p>
                                <p className="font-medium text-gray-800 font-mono text-sm">{activity.ip || '-'}</p>
                            </div>
                        </div>

                        {/* Deskripsi */}
                        <div className="space-y-1 pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Deskripsi</p>
                            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                {activity.description}
                            </p>
                        </div>

                        {/* Detail JSON */}
                        {activity.details && Object.keys(activity.details).length > 0 && (
                            <div className="space-y-1 pt-2 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Data Tambahan</p>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 overflow-x-auto">
                                    <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                                        {JSON.stringify(activity.details, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#00529C] text-white rounded-lg font-medium hover:bg-[#004080] transition-colors text-sm"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}