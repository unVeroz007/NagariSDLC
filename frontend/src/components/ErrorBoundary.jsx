// src/components/ErrorBoundary.jsx
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Unhandled React Error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/dashboard';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center p-6">
                    <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5">
                            <AlertTriangle size={36} />
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Terjadi Kesalahan Sistem</h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Aplikasi NagariSDLC mengalami kendala yang tidak terduga saat memuat halaman ini.
                        </p>

                        {this.state.error && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-mono text-left mb-6 overflow-x-auto max-h-32 border border-red-200">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={this.handleReload}
                                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 bg-[#1a365d] hover:bg-[#0f2342] text-white rounded-xl font-medium transition-colors text-sm"
                            >
                                <RefreshCw size={16} className="mr-2" />
                                Refresh Halaman
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm"
                            >
                                <Home size={16} className="mr-2" />
                                Ke Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
