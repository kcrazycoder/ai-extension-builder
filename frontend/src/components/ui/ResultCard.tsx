import { useState } from 'react';
import { Loader2, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    // isCompleted logic removed as it's implicit in the fall-through
    const isFailed = extension.status === 'failed';
    const isProcessing = extension.status === 'processing' || extension.status === 'pending';

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await onDownload(extension);
        } finally {
            setIsDownloading(false);
        }
    };

    if (isProcessing) {
        return (
            <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 flex items-center gap-4 shadow-sm animate-pulse">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="h-4 w-1/3 bg-slate-200 dark:bg-zinc-800 rounded mb-2"></div>
                    <div className="h-3 w-1/2 bg-slate-100 dark:bg-zinc-800/50 rounded"></div>
                </div>
            </div>
        );
    }

    if (isFailed) {
        return (
            <div className="w-full max-w-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h4 className="text-sm font-medium text-red-900 dark:text-red-200">Generation Failed</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{extension.error || 'Unknown error occurred'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="group w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="p-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-600 dark:text-green-500 ring-1 ring-green-100 dark:ring-green-900/30">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                            Extension Ready
                        </h3>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-xs font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-zinc-700">
                            v{extension.version || '0.1.0'}
                        </span>
                    </div>
                </div>

                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm",
                        "bg-slate-900 dark:bg-white text-white dark:text-slate-900",
                        "hover:bg-slate-800 dark:hover:bg-slate-100 hover:shadow-md",
                        "disabled:opacity-70 disabled:cursor-not-allowed"
                    )}
                >
                    {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    {isDownloading ? 'Downloading...' : 'Download'}
                </button>
            </div>
        </div>
    );
}
