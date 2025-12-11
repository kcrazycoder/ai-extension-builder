import { useState, useRef, useEffect } from 'react';
import { History, Download, ChevronDown } from 'lucide-react';
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

    if (!versions || versions.length === 0) return null;

    // Correct Sort Logic: Newest first (DESC)
    const finalVersions = [...versions].sort((a, b) => {
        const valA = a.created_at || a.createdAt;
        const valB = b.created_at || b.createdAt;
        const dateA = valA ? new Date(valA).getTime() : 0;
        const dateB = valB ? new Date(valB).getTime() : 0;
        return dateB - dateA; // Newest first
    });

    const activeVer = currentVersion || finalVersions[0];

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "group flex items-center justify-between w-[160px] h-8 px-2.5 rounded-lg text-sm font-medium transition-all duration-200 border",
                    isOpen
                        ? "bg-slate-50 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 shadow-sm"
                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800"
                )}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <History className={cn("flex-shrink-0 w-3.5 h-3.5 transition-colors", isOpen ? "text-slate-600 dark:text-slate-400" : "text-slate-400 group-hover:text-slate-500")} />
                    {finalVersions[0].id === activeVer.id && (
                        <span className="flex-shrink-0 text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1 py-px rounded-[4px] border border-emerald-100 dark:border-emerald-800/50">
                            Latest
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="font-mono truncate">v{activeVer.version || '0.1.0'}</span>
                    <ChevronDown className={cn("flex-shrink-0 w-3 h-3 opacity-50 transition-transform duration-200", isOpen && "rotate-180")} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden z-30 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="px-3 py-2 bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Version History</span>
                        <span className="text-xs text-slate-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700">{finalVersions.length} builds</span>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-700 p-1">
                        {finalVersions.map((version, index) => {
                            const isCurrent = currentVersion?.id === version.id;
                            const isLatest = index === 0;
                            const createdDate = new Date(version.created_at || version.createdAt || NaN);

                            return (
                                <div
                                    key={version.id}
                                    className={cn(
                                        "relative flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer group mb-0.5",
                                        isCurrent
                                            ? "bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700"
                                            : "hover:bg-slate-50 dark:hover:bg-zinc-800/50 border border-transparent hover:border-slate-100 dark:hover:border-zinc-800"
                                    )}
                                    onClick={() => {
                                        onSelectVersion(version);
                                        setIsOpen(false);
                                    }}
                                >
                                    {/* Timeline Node */}
                                    <div className="flex flex-col items-center mt-1">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900",
                                            isCurrent ? "bg-indigo-600 ring-indigo-100 dark:ring-indigo-900" : "bg-slate-300 dark:bg-zinc-700 ring-transparent"
                                        )} />
                                        {index !== finalVersions.length - 1 && (
                                            <div className="w-px h-full bg-slate-100 dark:bg-zinc-800 my-1 absolute top-5 left-[19px]" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {isLatest && (
                                                    <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30 px-1 py-px rounded">
                                                        New
                                                    </span>
                                                )}
                                                <span className={cn(
                                                    "text-sm font-semibold font-mono",
                                                    isCurrent ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"
                                                )}>
                                                    v{version.version || '0.1.0'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                {isNaN(createdDate.getTime()) ? '' : createdDate.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                                            <div className={cn(
                                                "text-xs truncate leading-relaxed pr-2",
                                                isCurrent ? "text-slate-600 dark:text-slate-400" : "text-slate-500 dark:text-slate-500"
                                            )}>
                                                {version.prompt}
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDownload(version);
                                                }}
                                                className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded shadow-sm hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
                                            >
                                                <Download className="w-3 h-3" />
                                                Download ZIP
                                            </button>
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
