import { useState, useMemo } from 'react';
import { useProjects } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import RBBBadge from '../components/RBBBadge';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Inbox,
  UserCheck,
  Hourglass,
  ClipboardCheck,
  Filter
} from 'lucide-react';

export default function Queue() {
  const { user } = useAuth();
  const { projects, isLoading, refreshData } = useProjects();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'in_review' | 'completed'
  const [typeFilter, setTypeFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter proyek berdasarkan status & tipe
  const filteredProjects = useMemo(() => {
    let result = [];

    if (activeTab === 'pending') {
      result = projects.filter(p => p.status === 'PENDING');
    } else if (activeTab === 'in_review') {
      result = projects.filter(p => p.status === 'IN_REVIEW');
    } else if (activeTab === 'completed') {
      result = projects.filter(p => p.status === 'ANALYSIS_APPROVED' || p.status === 'REJECTED');
    }

    if (typeFilter !== 'All') {
      result = result.filter(p => {
        const norm = (p.type || '').toUpperCase().replace('-', '_');
        if (typeFilter === 'RBB') return norm === 'RBB';
        if (typeFilter === 'NON_RBB') return norm === 'NON_RBB' || norm !== 'RBB';
        return true;
      });
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => {
        const idStr = String(p.reqId || p.req_id || p.id || '').toLowerCase();
        const nameStr = String(p.name || p.title || '').toLowerCase();
        const divStr = String(typeof p.division === 'object' ? p.division?.name : p.division || '').toLowerCase();
        return idStr.includes(term) || nameStr.includes(term) || divStr.includes(term);
      });
    }

    // Sorting (terbaru dulu)
    result.sort((a, b) => (b.id || 0) - (a.id || 0));

    return result;
  }, [projects, activeTab, searchTerm, typeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const currentItems = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Count per tab
  const pendingCount = projects.filter(p => p.status === 'PENDING').length;
  const inReviewCount = projects.filter(p => p.status === 'IN_REVIEW').length;
  const completedCount = projects.filter(p => p.status === 'ANALYSIS_APPROVED' || p.status === 'REJECTED').length;

  const getStatusBadge = (status) => {
    const configs = {
      'PENDING': {
        label: 'Menunggu Disposisi',
        icon: <Clock size={14} className="text-amber-500" />,
        className: 'bg-amber-100 text-amber-700 border-amber-200',
      },
      'IN_REVIEW': {
        label: 'Sedang Direview',
        icon: <Hourglass size={14} className="text-blue-500 animate-spin" />,
        className: 'bg-blue-100 text-blue-700 border-blue-200',
      },
      'ANALYSIS_APPROVED': {
        label: 'Selesai (Disetujui)',
        icon: <CheckCircle size={14} className="text-emerald-500" />,
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      },
      'REJECTED': {
        label: 'Selesai (Ditolak)',
        icon: <XCircle size={14} className="text-red-500" />,
        className: 'bg-red-100 text-red-700 border-red-200',
      },
    };
    return configs[status] || configs['PENDING'];
  };

  const getActionButton = (project) => {
    if (project.status === 'PENDING') {
      return (
        <button
          onClick={() => navigate('/workspace/lead')}
          className="px-3 py-1.5 bg-[#1A56DB] text-white rounded-lg text-xs font-medium hover:bg-[#1349c2] transition-colors flex items-center gap-1"
        >
          <UserCheck size={14} />
          Disposisi
        </button>
      );
    } else if (project.status === 'IN_REVIEW') {
      return (
        <button
          onClick={() => alert(`Proyek ${project.name} sedang direview oleh Analyst`)}
          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium cursor-not-allowed flex items-center gap-1"
          disabled
        >
          <Hourglass size={14} />
          Menunggu
        </button>
      );
    } else {
      return (
        <button
          onClick={() => navigate('/workspace/lead')}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1"
        >
          <ClipboardCheck size={14} />
          Verifikasi
        </button>
      );
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Memuat antrean..." />;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8f9fb] overflow-y-auto">
      {/* Content */}
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Antrean Review</h1>
              <p className="text-sm text-gray-500 mt-1">
                Kelola disposisi dan pantau progress review dari Analyst.
              </p>
            </div>
            
            {/* Dropdown Filter Tipe */}
            <div className="relative shrink-0 sm:w-64">
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 shadow-xs focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] outline-none cursor-pointer appearance-none transition-all hover:border-gray-300"
              >
                <option value="All">Semua Tipe Proyek</option>
                <option value="RBB">Tipe: RBB (Wajib Selesai)</option>
                <option value="NON_RBB">Tipe: Non-RBB (Fleksibel)</option>
              </select>
              <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A56DB] pointer-events-none" />
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-x-auto">
            <button
              onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'border-[#1A56DB] text-[#1A56DB]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock size={16} />
              Menunggu Disposisi
              {pendingCount > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('in_review'); setCurrentPage(1); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'in_review'
                  ? 'border-[#1A56DB] text-[#1A56DB]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Hourglass size={16} />
              Sedang Direview
              {inReviewCount > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                  {inReviewCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('completed'); setCurrentPage(1); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'completed'
                  ? 'border-[#1A56DB] text-[#1A56DB]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardCheck size={16} />
              Selesai Direview
              {completedCount > 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                  {completedCount}
                </span>
              )}
            </button>
          </div>
          
          <div className="text-sm text-gray-500 bg-white px-6 py-3 border-b border-gray-100 font-medium">
            {activeTab === 'pending' && 'Proyek yang belum ditugaskan ke Analyst. Klik "Disposisi" untuk menugaskan.'}
            {activeTab === 'in_review' && 'Proyek yang sedang direview oleh Analyst. Tunggu hasil review.'}
            {activeTab === 'completed' && 'Proyek yang sudah selesai direview. Klik "Verifikasi" untuk melanjutkan.'}
          </div>

          {/* Table */}
          <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                    <th className="px-6 py-4">ID Proyek</th>
                    <th className="px-6 py-4">Nama Proyek</th>
                    <th className="px-6 py-4">Divisi</th>
                    <th className="px-6 py-4">Tipe</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {currentItems.length > 0 ? (
                    currentItems.map((project) => {
                      const statusConfig = getStatusBadge(project.status);
                      return (
                        <tr key={project.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-4 font-semibold text-[#1A56DB]">{project.id}</td>
                          <td className="px-6 py-4 font-medium text-gray-800">{project.name}</td>
                          <td className="px-6 py-4 text-gray-500">{project.division || '-'}</td>
                          <td className="px-6 py-4">
                            <RBBBadge type={project.type} deadline={project.rbbDeadline} />
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusConfig.className}`}>
                              {statusConfig.icon}
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 flex justify-end">
                            {getActionButton(project)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <Inbox size={40} className="text-gray-300 mb-2" />
                          <p>Tidak ada proyek dengan status ini</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredProjects.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredProjects.length)} dari {filteredProjects.length}
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
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            pageNum === currentPage
                              ? 'bg-[#1A56DB] text-white'
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
        </div>
      </div>
    </div>
  );
}