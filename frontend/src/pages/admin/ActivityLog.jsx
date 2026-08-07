// src/pages/admin/ActivityLog.jsx
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useActivityLog } from '../../contexts/ActivityContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import LogFilter from '../../components/LogFilter';
import LogTimeline from '../../components/LogTimeline';
import LogDetailModal from '../../components/LogDetailModal';
import { CheckCircle, AlertCircle } from 'lucide-react';
import {
    ChevronLeft,
    ChevronRight,
    LayoutGrid,
    List,
    Download,
    RefreshCw,
    Activity,
    Calendar,
    Clock,
    Users,
    Folder,
    Inbox,
    Eye,
} from 'lucide-react';

export default function ActivityLog() {
    const { user } = useAuth();
    const { activities, isLoading, refreshData, lastUpdated } = useActivityLog();
    const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Extract unique values untuk filter
    const roles = useMemo(() => [...new Set(activities.map(a => a.role).filter(Boolean))], [activities]);
    const actions = useMemo(() => [...new Set(activities.map(a => a.actionLabel).filter(Boolean))], [activities]);
    const projects = useMemo(() => [...new Set(activities.map(a => a.project).filter(Boolean))], [activities]);

    // Filter data
    const filteredActivities = useMemo(() => {
        let result = [...activities];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(a =>
                a.user?.toLowerCase().includes(term) ||
                a.actionLabel?.toLowerCase().includes(term) ||
                a.description?.toLowerCase().includes(term) ||
                a.project?.toLowerCase().includes(term)
            );
        }

        if (filterRole) {
            result = result.filter(a => a.role === filterRole);
        }

        if (filterAction) {
            result = result.filter(a => a.actionLabel === filterAction);
        }

        if (filterProject) {
            result = result.filter(a => a.project === filterProject);
        }

        if (dateFrom) {
            result = result.filter(a => new Date(a.timestamp) >= new Date(dateFrom));
        }

        if (dateTo) {
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59);
            result = result.filter(a => new Date(a.timestamp) <= endDate);
        }

        return result;
    }, [activities, searchTerm, filterRole, filterAction, filterProject, dateFrom, dateTo]);

    // Pagination
    const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
    const currentActivities = filteredActivities.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleViewDetail = (activity) => {
        setSelectedActivity(activity);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedActivity(null);
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setFilterRole('');
        setFilterAction('');
        setFilterProject('');
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    const [toast, setToast] = useState(null);

    const handleExport = () => {
        setToast('Fitur export akan segera hadir! Data dapat diexport ke CSV/PDF.');
        setTimeout(() => setToast(null), 3000);
    };

    if (isLoading) {
        return <LoadingSpinner text="Memuat activity log..." />;
    }

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-5 bg-[#f8f9fb]">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Activity size={24} className="text-[#00529C]" />
                            <h1 className="text-2xl font-bold text-gray-800">Activity Log</h1>
                            <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-1 rounded-full">
                                {filteredActivities.length}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Rekam jejak seluruh aktivitas pengguna dalam sistem secara real-time.
                            {lastUpdated && (
                                <span className="text-xs text-gray-400 ml-2">
                                    Terakhir diperbarui: {new Date(lastUpdated).toLocaleTimeString('id-ID')}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={refreshData}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <RefreshCw size={16} />
                            Refresh
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-[#003a73] text-white rounded-lg font-medium text-sm hover:bg-[#002a5a] transition-colors shadow-sm"
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#00529C] flex items-center justify-center">
                            <Activity size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Total Aktivitas</p>
                            <p className="text-xl font-bold text-gray-800">{activities.length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Berhasil</p>
                            <p className="text-xl font-bold text-gray-800">
                                {activities.filter(a => a.status === 'success').length}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Peringatan</p>
                            <p className="text-xl font-bold text-gray-800">
                                {activities.filter(a => a.status === 'warning' || a.status === 'danger').length}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <Users size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">User Aktif</p>
                            <p className="text-xl font-bold text-gray-800">
                                {new Set(activities.map(a => a.user)).size}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <LogFilter
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    filterRole={filterRole}
                    setFilterRole={setFilterRole}
                    filterAction={filterAction}
                    setFilterAction={setFilterAction}
                    filterProject={filterProject}
                    setFilterProject={setFilterProject}
                    dateFrom={dateFrom}
                    setDateFrom={setDateFrom}
                    dateTo={dateTo}
                    setDateTo={setDateTo}
                    onReset={handleResetFilters}
                    roles={roles}
                    actions={actions}
                    projects={projects}
                />

                {/* View Toggle */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'timeline'
                                ? 'bg-[#00529C] text-white'
                                : 'text-gray-500 hover:bg-gray-100'
                                }`}
                        >
                            <LayoutGrid size={16} className="inline mr-1" />
                            Timeline
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'table'
                                ? 'bg-[#00529C] text-white'
                                : 'text-gray-500 hover:bg-gray-100'
                                }`}
                        >
                            <List size={16} className="inline mr-1" />
                            Tabel
                        </button>
                    </div>
                    <span className="text-sm text-gray-500">
                        Menampilkan {filteredActivities.length} aktivitas
                    </span>
                </div>

                {/* Content */}
                {filteredActivities.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12">
                        <EmptyState
                            title="Tidak Ada Aktivitas"
                            description="Tidak ada aktivitas yang sesuai dengan filter yang dipilih."
                            icon={Inbox}
                            actionText="Reset Filter"
                            onAction={handleResetFilters}
                        />
                    </div>
                ) : viewMode === 'timeline' ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <LogTimeline
                            activities={currentActivities}
                            onViewDetail={handleViewDetail}
                        />
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        {/* Table View */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                                        <th className="px-4 py-3">Waktu</th>
                                        <th className="px-4 py-3">User</th>
                                        <th className="px-4 py-3">Tindakan</th>
                                        <th className="px-4 py-3">Proyek</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-center">Detail</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-sm">
                                    {currentActivities.map((activity) => (
                                        <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                                {new Date(activity.timestamp).toLocaleString('id-ID', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                                        {activity.userAvatar || activity.user?.charAt(0) || 'U'}
                                                    </div>
                                                    <span className="font-medium text-gray-800">{activity.user}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">{activity.actionLabel}</td>
                                            <td className="px-4 py-3 text-gray-500">{activity.project || '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${activity.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                                                    activity.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                                                        activity.status === 'danger' ? 'bg-red-100 text-red-700' :
                                                            activity.status === 'system' ? 'bg-purple-100 text-purple-700' :
                                                                'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {activity.status === 'success' ? '✅' :
                                                        activity.status === 'warning' ? '⚠️' :
                                                            activity.status === 'danger' ? '❌' :
                                                                'ℹ️'}
                                                    {activity.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleViewDetail(activity)}
                                                    className="text-gray-400 hover:text-[#00529C] hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                    Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredActivities.length)} dari {filteredActivities.length}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let pageNum = i + 1;
                                        if (totalPages > 5 && currentPage > 3) {
                                            pageNum = currentPage - 2 + i;
                                            if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                                        }
                                        if (pageNum > 0 && pageNum <= totalPages) {
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`px-3 py-1 rounded text-sm font-medium ${pageNum === currentPage
                                                        ? 'bg-[#00529C] text-white'
                                                        : 'border border-gray-200 bg-white hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        }
                                        return null;
                                    })}
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <LogDetailModal
                activity={selectedActivity}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
            />
        </div>
    );
}