import { useState } from 'react';
import { Loader2, Download, AlertCircle, Package } from 'lucide-react';
import type { Extension } from '../../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ResultCardProps {
    extension: Extension;
    onDownload: (ext: Extension) => void;
}

export function ResultCard({ extension, onDownload }: ResultCardProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const isFailed = extension.status === 'failed';
    const isProcessing = extension.status === 'processing' || extension.status === 'pending';

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent parent click
        setIsDownloading(true);
        try {
            await onDownload(extension);
        } finally {
            setIsDownloading(false);
        }
    };

    if (isProcessing) {
        return (
            <div className="w-full bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 flex items-center gap-4 animate-pulse">
                <div className="p-2.5 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                </div>
                <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-48 bg-slate-100 dark:bg-zinc-800/50 rounded" />
                </div>
            </div>
        );
    }

    if (isFailed) {
        return (
            <div className="w-full bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h4 className="text-sm font-medium text-red-900 dark:text-red-200">Generation Failed</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{extension.error || 'Unknown error occurred'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-slate-50 dark:bg-zinc-950/50 rounded-xl overflow-hidden transition-all group/card">
            <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">

                {/* Info Section */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 group-hover/card:border-indigo-100 dark:group-hover/card:border-indigo-900/50 transition-colors hidden sm:block">
                        <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                                {extension.name || 'Extension Package'}
                            </h3>
                            <span className="text-xs font-mono text-slate-400">
                                v{extension.version || '0.1.0'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 ml-auto sm:ml-0">
                                Ready
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {extension.description || 'Source Code & Manifest ready for download.'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                {/* Actions */}
                <style>{`
                    @keyframes gentleScale {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(0.97); opacity: 0.7; }
                    }
                    .animate-gentle-scale {
                        animation: gentleScale 1.2s infinite ease-in-out;
                    }
                `}</style>
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={cn(
                        "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap overflow-hidden relative",
                        // Base styles
                        !isDownloading && "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-slate-300 dark:hover:border-zinc-600 active:scale-95",
                        // Loading styles (Thinking Vibe)
                        isDownloading && "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 cursor-default",
                        "disabled:opacity-100" // Override opacity reduction for this specific loading state
                    )}
                >
                    <span className={cn(
                        "flex items-center gap-2",
                        isDownloading && "animate-gentle-scale font-semibold"
                    )}>
                        <Download className={cn("w-3.5 h-3.5", isDownloading && "text-indigo-600 dark:text-indigo-400")} />
                        <span>Download Zip</span>
                    </span>
                </button>
            </div>
        </div>
    );
}
