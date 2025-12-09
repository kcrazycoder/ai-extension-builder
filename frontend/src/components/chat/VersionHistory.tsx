import React from 'react';
import { Clock, GitCommit } from 'lucide-react';
import type { Extension } from '../../types';

interface VersionHistoryProps {
    versions: Extension[];
    currentVersionId: string;
    onSelectVersion: (ext: Extension) => void;
}

export function VersionHistory({ versions, currentVersionId, onSelectVersion }: VersionHistoryProps) {
    if (versions.length === 0) return null;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 mt-6">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Version History
            </h3>
            <div className="space-y-3 relative">
                {/* Timeline Line */}
                <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-zinc-800 -z-10" />

                {versions.map((version, index) => {
                    const isCurrent = version.id === currentVersionId;
                    const date = new Date(version.created_at).toLocaleString();

                    return (
                        <div
                            key={version.id}
                            onClick={() => onSelectVersion(version)}
                            className={`flex items-start gap-4 p-2 rounded-lg cursor-pointer transition-colors ${isCurrent
                                    ? 'bg-primary-50 dark:bg-primary-900/10'
                                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                                }`}
                        >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isCurrent
                                    ? 'bg-primary-500 text-white ring-4 ring-primary-100 dark:ring-primary-900/30'
                                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-500'
                                }`}>
                                <span className="text-xs font-bold">{versions.length - index}</span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium ${isCurrent ? 'text-primary-700 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'
                                    }`}>
                                    {version.prompt.slice(0, 60)}{version.prompt.length > 60 ? '...' : ''}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                                    {date}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
