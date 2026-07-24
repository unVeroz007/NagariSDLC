// src/components/EmptyState.jsx
import { Inbox } from 'lucide-react';

export default function EmptyState({
    title = 'Tidak ada data',
    description = 'Belum ada data yang tersedia untuk ditampilkan.',
    icon: Icon = Inbox,
    actionText,
    onAction,
}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Icon size={40} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
            <p className="text-gray-500 max-w-md">{description}</p>
            {actionText && onAction && (
                <button
                    onClick={onAction}
                    className="mt-6 px-4 py-2 bg-[#1A56DB] text-white rounded-lg hover:bg-[#1349c2] transition-colors"
                >
                    {actionText}
                </button>
            )}
        </div>
    );
}