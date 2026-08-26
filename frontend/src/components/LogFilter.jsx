// src/components/LogFilter.jsx
import { Search, X, Calendar, User, Folder, Tag } from 'lucide-react';

export default function LogFilter({
    searchTerm,
    setSearchTerm,
    filterRole,
    setFilterRole,
    filterAction,
    setFilterAction,
    filterProject,
    setFilterProject,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    onReset,
    roles,
    actions,
    projects,
}) {
    const hasFilters = searchTerm || filterRole || filterAction || filterProject || dateFrom || dateTo;

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Cari user, tindakan, proyek..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
                    />
                </div>

                {/* Role Filter */}
                <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none min-w-[140px]"
                >
                    <option value="">Semua Role</option>
                    {roles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>

                {/* Action Filter */}
                <select
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none min-w-[140px]"
                >
                    <option value="">Semua Tindakan</option>
                    {actions.map((action) => (
                        <option key={action} value={action}>{action}</option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {/* Project Filter */}
                <div className="relative flex-1 sm:max-w-[200px]">
                    <Folder size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
                    >
                        <option value="">Semua Proyek</option>
                        {projects.map((project) => (
                            <option key={project} value={project}>{project}</option>
                        ))}
                    </select>
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
                    />
                    <span className="text-gray-400 text-sm">-</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00529C] focus:border-[#00529C] outline-none"
                    />
                </div>

                {/* Reset */}
                {hasFilters && (
                    <button
                        onClick={onReset}
                        className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                    >
                        <X size={16} />
                        Reset Filter
                    </button>
                )}
            </div>

            {/* Active filters badges */}
            {hasFilters && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {searchTerm && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                            <Search size={12} />
                            {searchTerm}
                            <button onClick={() => setSearchTerm('')} className="hover:text-blue-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {filterRole && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                            <User size={12} />
                            {filterRole}
                            <button onClick={() => setFilterRole('')} className="hover:text-purple-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {filterAction && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                            <Tag size={12} />
                            {filterAction}
                            <button onClick={() => setFilterAction('')} className="hover:text-amber-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}