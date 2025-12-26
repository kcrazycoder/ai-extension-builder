import { useState } from 'react';
import { Download, ChevronDown, ChevronRight, History, Plug, Check, Loader2 } from 'lucide-react';
import type { Extension } from '../../types';

interface VersionHistoryProps {
    versions: Extension[];
    currentVersionId: string;
    onSelectVersion: (ext: Extension) => void;
    onDownload: (ext: Extension) => void;
    onConnectPreview: (ext: Extension) => void;
    connectedExtensions?: Set<string>; // Set of job IDs that are connected
    connectingExtensions?: Set<string>; // Set of job IDs that are connecting
}

export function VersionHistory({
    versions,
    currentVersionId,
    onSelectVersion,
    onDownload,
    onConnectPreview,
    connectedExtensions = new Set(),
    connectingExtensions = new Set()
}: VersionHistoryProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    // Sort Descending for timeline view (Newest First)
    const sortedVersions = [...versions].sort((a, b) =>
        (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime())
    );

    // Count connected versions
    const connectedCount = sortedVersions.filter(v => connectedExtensions.has(v.id)).length;

    if (versions.length === 0) return null;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 mt-4 overflow-hidden shadow-sm">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-50/50 dark:bg-zinc-800/30 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-slate-100 dark:border-zinc-800/50"
            >
                <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                        History
                    </h3>
                    <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                        {versions.length}
                    </span>
                    {connectedCount > 0 && (
                        <span className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {connectedCount} Connected
                        </span>
                    )}
                </div>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            {isExpanded && (
                <div className="py-2 px-0 relative">
                    {/* Vertical Timeline Line */}
                    <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-100 dark:bg-zinc-800" />

                    <div className="space-y-0.5">
                        {sortedVersions.map((version, index) => {
                            const isCurrent = version.id === currentVersionId;
                            const isConnected = connectedExtensions.has(version.id);
                            const isConnecting = connectingExtensions.has(version.id);
                            const isValidDate = version.createdAt && !isNaN(new Date(version.createdAt).getTime());
                            const date = isValidDate ? new Date(version.createdAt!).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            }) : 'Unknown date';

                            // Determine summary to display
                            const summaryText = version.summary || (index === sortedVersions.length - 1 ? "Initial generation" : "Updated extension");
                            const versionTag = version.version || `0.0.${sortedVersions.length - index}`;

                            return (
                                <div
                                    key={version.id}
                                    onClick={() => onSelectVersion(version)}
                                    className={`relative pl-8 pr-2 py-2 group cursor-pointer border-l-2 transition-colors ${isCurrent
                                        ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10'
                                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                                        }`}
                                >
                                    {/* Timeline Node */}
                                    <div className={`absolute left-[15px] top-3 w-2 h-2 rounded-full border-2 bg-white dark:bg-zinc-900 z-10 box-content ${isConnected
                                            ? 'border-emerald-500 bg-emerald-500 dark:border-emerald-400 dark:bg-emerald-400 animate-pulse'
                                            : isCurrent
                                                ? 'border-indigo-500 bg-indigo-500 dark:border-indigo-400 dark:bg-indigo-400'
                                                : 'border-slate-300 dark:border-zinc-600 group-hover:border-slate-400'
                                        }`} />

                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <h4 className={`text-xs font-medium truncate ${isCurrent ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {summaryText}
                                                </h4>
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                                                <span className="font-mono opacity-80">v{versionTag}</span>
                                                <span>•</span>
                                                <span className="truncate">{date}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {/* Preview Connection Button */}
                                            {version.status === 'completed' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onConnectPreview(version);
                                                    }}
                                                    className={`p-1 rounded transition-colors ${isConnected
                                                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                                                            : isConnecting
                                                                ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                                                : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                                        }`}
                                                    title={isConnected ? 'Connected to Preview' : isConnecting ? 'Connecting...' : 'Connect Preview'}
                                                >
                                                    {isConnecting ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : isConnected ? (
                                                        <Check className="w-3 h-3" />
                                                    ) : (
                                                        <Plug className="w-3 h-3" />
                                                    )}
                                                </button>
                                            )}

                                            {/* Download Button */}
                                            {version.status === 'completed' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDownload(version);
                                                    }}
                                                    className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                    title="Download"
                                                >
                                                    <Download className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
