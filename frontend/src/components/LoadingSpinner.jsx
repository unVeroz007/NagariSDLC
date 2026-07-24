// src/components/LoadingSpinner.jsx
export default function LoadingSpinner({ size = 'md', text = 'Memuat data...' }) {
    const sizes = {
        sm: 'w-6 h-6 border-2',
        md: 'w-10 h-10 border-4',
        lg: 'w-16 h-16 border-4',
    };

    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div
                className={`${sizes[size]} border-gray-200 border-t-[#1A56DB] rounded-full animate-spin`}
            ></div>
            {text && <p className="mt-4 text-gray-500 text-sm">{text}</p>}
        </div>
    );
}