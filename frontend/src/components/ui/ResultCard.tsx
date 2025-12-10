import { useState } from 'react';
import { Loader2, Download, AlertCircle, Package, FileCode } from 'lucide-react';
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
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                {/* Info Section */}
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 group-hover/card:border-indigo-100 dark:group-hover/card:border-indigo-900/50 transition-colors">
                        <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                Extension Package
                            </h3>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                Ready
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <FileCode className="w-3.5 h-3.5" />
                            <span>Source Code & Manifest</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
                            <span className="font-mono">v{extension.version || '0.1.0'}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={cn(
                        "flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm active:scale-95",
                        "bg-indigo-600 hover:bg-indigo-500 text-white",
                        "dark:bg-indigo-600 dark:hover:bg-indigo-500",
                        "disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
                    )}
                >
                    {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    {isDownloading ? 'Downloading...' : 'Download Assets'}
                </button>
            </div>
        </div>
    );
}
