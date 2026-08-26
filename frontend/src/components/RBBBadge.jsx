import { AlertTriangle } from 'lucide-react';

export default function RBBBadge({ type, deadline }) {
  const normType = String(type || '').toUpperCase().replace('-', '_');

  // Jika RBB
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

  // Jika Non-RBB
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
      Non-RBB
    </span>
  );
}

