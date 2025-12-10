import { useState, useRef, useEffect } from 'react';
import { History, Download, Check, ChevronDown } from 'lucide-react';
import type { Extension } from '../../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface VersionDropdownProps {
    versions: Extension[];
    currentVersion: Extension | null;
    onSelectVersion: (ext: Extension) => void;
    onDownload: (ext: Extension) => void;
}

export function VersionDropdown({ versions, currentVersion, onSelectVersion, onDownload }: VersionDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (!versions || versions.length <= 1) return null;

    // Sort versions DESC (newest first) for the dropdown
    const sortedVersions = [...versions].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors border border-slate-200 dark:border-zinc-800"
            >
                <History className="w-4 h-4" />
                <span>{versions.length} Versions</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-[300px] overflow-y-auto scrollbar-hide py-1">
                        {sortedVersions.map((version, index) => {
                            const isCurrent = currentVersion?.id === version.id;
                            const isLatest = index === 0;

                            return (
                                <div
                                    key={version.id}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer group",
                                        isCurrent && "bg-slate-50 dark:bg-zinc-800/50"
                                    )}
                                    onClick={() => {
                                        onSelectVersion(version);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className="flex-1 min-w-0 mr-3">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-sm font-medium truncate",
                                                isCurrent ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
                                            )}>
                                                v{version.version || '0.1.0'}
                                            </span>
                                            {isLatest && (
                                                <span className="text-[10px] uppercase tracking-wider font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                                                    Latest
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                            {(() => {
                                                const d = new Date(version.created_at);
                                                return isNaN(d.getTime()) ? 'Just now' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            })()}
                                            {' · '}
                                            {version.prompt.slice(0, 20)}...
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-blue-400 mr-2" />}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDownload(version);
                                            }}
                                            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100/50 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-all shadow-sm hover:shadow cursor-pointer"
                                            title="Download this version"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>
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
