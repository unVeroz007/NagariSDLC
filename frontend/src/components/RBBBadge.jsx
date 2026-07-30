import { AlertTriangle, Clock } from 'lucide-react';

export default function RBBBadge({ type, deadline, status }) {
  const normType = String(type || '').toUpperCase().replace('-', '_');

  // Jika proyek masih dalam pengajuan / inisiasi (status PENDING/DRAFT) atau belum diklasifikasi
  if ((!type || normType === 'BELUM_DIKLASIFIKASI' || type === 'Belum Diklasifikasi') && (status === 'PENDING' || status === 'DRAFT' || !status)) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
        <Clock size={11} className="text-amber-600 shrink-0" />
        Belum Diklasifikasi
      </span>
    );
  }

  if (normType === 'RBB') {
    const isNearDeadline = deadline && (new Date(deadline) - new Date()) < 30 * 24 * 60 * 60 * 1000;
    
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200 shadow-2xs">
          <AlertTriangle size={12} className={isNearDeadline ? 'animate-pulse' : ''} />
          RBB {isNearDeadline && '⚠️'}
        </span>
        {deadline && (
          <span className={`text-[10px] font-medium ${isNearDeadline ? 'text-red-600 animate-pulse' : 'text-gray-500'}`}>
            Deadline: {new Date(deadline).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </span>
        )}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
      Non-RBB
    </span>
  );
}

