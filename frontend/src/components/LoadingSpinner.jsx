// src/components/LoadingSpinner.jsx
export default function LoadingSpinner({ size = 'md', text = 'Memuat data...', inline = false }) {
    const sizes = {
        sm: 'w-4 h-4 border-2',
        md: 'w-10 h-10 border-4',
        lg: 'w-16 h-16 border-4',
    };

    if (inline || size === 'sm') {
        return (
            <div
                className={`${sizes[size] || 'w-4 h-4 border-2'} border-white/40 border-t-white rounded-full animate-spin inline-block shrink-0`}
            ></div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div
                className={`${sizes[size]} border-gray-200 border-t-[#00529C] rounded-full animate-spin`}
            ></div>
            {text && <p className="mt-4 text-gray-500 text-sm">{text}</p>}
        </div>
    );
}