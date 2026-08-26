// Badge untuk menampilkan tipe proyek (Baru / Perbaikan / Update)
const PROJECT_TYPE_META = {
    baru:      { label: 'Proyek Baru',    bg: 'bg-blue-50 text-blue-800 border-blue-200',      dot: 'bg-blue-500' },
    perbaikan: { label: 'Perbaikan',      bg: 'bg-amber-50 text-amber-800 border-amber-200',   dot: 'bg-amber-500' },
    update:    { label: 'Update',         bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
};

// Tidak diekspor: satu-satunya pemakai metadata ini adalah badge di bawah.
function getProjectTypeMeta(type) {
    return PROJECT_TYPE_META[type] || { label: 'Proyek Baru', bg: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500' };
}

export default function ProjectTypeBadge({ type, className = '' }) {
    const meta = getProjectTypeMeta(type);
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.bg} ${className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
        </span>
    );
}
