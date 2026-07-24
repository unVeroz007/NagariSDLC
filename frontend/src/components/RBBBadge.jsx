import { Calendar, AlertTriangle } from 'lucide-react';

export default function RBBBadge({ type, deadline }) {
  if (type === 'RBB') {
    const isNearDeadline = deadline && (new Date(deadline) - new Date()) < 30 * 24 * 60 * 60 * 1000;
    
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 shadow-sm">
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

  if (type === 'NON_RBB') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200 shadow-sm">
        Non-RBB
      </span>
    );
  }

  return null;
}
