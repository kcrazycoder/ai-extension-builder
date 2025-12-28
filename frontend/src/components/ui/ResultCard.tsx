import { useState } from 'react';
import { Loader2, Download, AlertCircle, Package, Plug, X } from 'lucide-react';
import type { Extension } from '../../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ResultCardProps {
    extension: Extension;
    onDownload: (ext: Extension) => void;
    onConnectPreview?: (ext: Extension) => void;
    onDisconnectPreview?: (ext: Extension) => void;
    isConnected?: boolean;
    isConnecting?: boolean;
}

export function ResultCard({ extension, onDownload, onConnectPreview, onDisconnectPreview, isConnected, isConnecting }: ResultCardProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
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

    const handleConnect = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onConnectPreview) onConnectPreview(extension);
    };

    const handleDisconnect = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDisconnectPreview) {
            setIsDisconnecting(true);
            try {
                await onDisconnectPreview(extension);
            } finally {
                setIsDisconnecting(false);
            }
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
                                {extension.name || 'Generated Package'}
                            </h3>
                            <span className="text-xs font-mono text-slate-400">
                                v{extension.version || '0.1.0'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 ml-auto sm:ml-0">
                                Ready
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {extension.description || 'Ready for download.'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <style>{`
                        @keyframes gentleScale {
                            0%, 100% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(0.97); opacity: 0.7; }
                        }
                        .animate-gentle-scale {
                            animation: gentleScale 1.2s infinite ease-in-out;
                        }
                    `}</style>

                    {/* Connect/Disconnect Preview Button */}
                    {onConnectPreview && (
                        <button
                            onClick={isConnected ? handleDisconnect : handleConnect}
                            disabled={isConnecting || isDisconnecting}
                            className={cn(
                                "group/connect relative flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 border shadow-sm overflow-hidden",
                                isConnected
                                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400"
                                    : isConnecting || isDisconnecting
                                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 cursor-wait"
                                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow active:scale-[0.98]"
                            )}
                        >
                            {isDisconnecting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isConnecting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isConnected ? (
                                <X className="w-4 h-4" />
                            ) : (
                                <Plug className="w-4 h-4" />
                            )}
                            <span>
                                {isDisconnecting ? 'Stopping...' : isConnecting ? 'Connecting...' : isConnected ? 'Stop' : 'Test Locally'}
                            </span>
                        </button>
                    )}

                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className={cn(
                            "group/btn relative flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 border shadow-sm overflow-hidden",
                            // Base styles (Idle)
                            !isDownloading && "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow active:scale-[0.98]",
                            // Loading styles (Thinking Vibe)
                            isDownloading && "bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200/50 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 cursor-wait shadow-none",
                            "disabled:opacity-100"
                        )}
                    >
                        {/* Background Shimmer Effect on Hover (Idle only) */}
                        {!isDownloading && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/50 dark:via-zinc-700/50 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                        )}

                        <span className={cn(
                            "relative flex items-center gap-2",
                            isDownloading && "animate-gentle-scale"
                        )}>
                            <Download className={cn(
                                "w-4 h-4 transition-colors",
                                isDownloading ? "text-indigo-500 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 group-hover/btn:text-slate-700 dark:group-hover/btn:text-slate-200"
                            )} />
                            <span>Download Zip</span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
