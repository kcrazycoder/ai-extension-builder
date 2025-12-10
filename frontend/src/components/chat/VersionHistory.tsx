import { useState } from 'react';
import { Clock, Download, ChevronDown, ChevronRight } from 'lucide-react';
import type { Extension } from '../../types';

interface VersionHistoryProps {
    versions: Extension[];
    currentVersionId: string;
    onSelectVersion: (ext: Extension) => void;
    onDownload: (ext: Extension) => void;
}

export function VersionHistory({ versions, currentVersionId, onSelectVersion, onDownload }: VersionHistoryProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Sort Descending for timeline view (Newest First)
    const sortedVersions = [...versions].sort((a, b) =>
        (new Date(b.created_at).getTime()) - (new Date(a.created_at).getTime())
    );

    if (versions.length <= 1) return null;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 mt-6 overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Version History ({versions.length})
                </h3>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>

            {isExpanded && (
                <div className="p-4 pt-0 border-t border-slate-100 dark:border-zinc-800/50">
                    <div className="space-y-3 relative mt-4">
                        {/* Timeline Line */}
                        <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-zinc-800 -z-10" />

                        {sortedVersions.map((version, index) => {
                            const isCurrent = version.id === currentVersionId;
                            const isValidDate = version.created_at && !isNaN(new Date(version.created_at).getTime());
                            const date = isValidDate ? new Date(version.created_at).toLocaleString() : 'Date unknown';

                            return (
                                <div
                                    key={version.id}
                                    className={`group flex items-start gap-4 p-2 rounded-lg transition-colors ${isCurrent
                                        ? 'bg-indigo-50 dark:bg-indigo-900/10'
                                        : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                                        }`}
                                >
                                    <div
                                        onClick={() => onSelectVersion(version)}
                                        className={`cursor-pointer w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isCurrent
                                            ? 'bg-indigo-500 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/30'
                                            : 'bg-slate-200 dark:bg-zinc-800 text-slate-500'
                                            }`}
                                    >
                                        <span className="text-xs font-bold">{sortedVersions.length - index}</span>
                                    </div>

                                    <div className="flex-1 min-w-0" onClick={() => onSelectVersion(version)}>
                                        <div className={`text-sm font-medium cursor-pointer ${isCurrent ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                                            }`}>
                                            {version.prompt.slice(0, 60)}{version.prompt.length > 60 ? '...' : ''}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                                            {date}
                                        </div>
                                    </div>

                                    {version.status === 'completed' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDownload(version);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Download this version"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
