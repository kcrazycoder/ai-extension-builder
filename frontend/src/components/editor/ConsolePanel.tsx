import React, { useEffect, useRef } from 'react';
import { XCircle, AlertTriangle, Info, Terminal, Trash2 } from 'lucide-react';

export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
}

interface ConsolePanelProps {
    logs: LogEntry[];
    onClear: () => void;
    height?: number;
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({ logs, onClear, height = 200 }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const getIcon = (level: string) => {
        switch (level) {
            case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'info': return <Info className="w-4 h-4 text-blue-500" />;
            default: return <Terminal className="w-4 h-4 text-gray-500" />;
        }
    };

    const getColor = (level: string) => {
        switch (level) {
            case 'error': return 'text-red-400 bg-red-900/10';
            case 'warn': return 'text-yellow-400 bg-yellow-900/10';
            case 'info': return 'text-blue-300';
            default: return 'text-gray-300';
        }
    };

    return (
        <div className="flex flex-col bg-[#1e1e1e] border-t border-[#333]" style={{ height }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#333] select-none">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    <Terminal size={14} />
                    <span>Console Output</span>
                    <span className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full text-[10px] min-w-[20px] text-center">
                        {logs.length}
                    </span>
                </div>
                <button
                    onClick={onClear}
                    className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                    title="Clear Console"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Log List */}
            <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-1">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                        <Terminal size={24} className="opacity-20" />
                        <p>No logs yet. Run the extension to see output.</p>
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div
                            key={index}
                            className={`flex items-start gap-2 p-1 rounded hover:bg-white/5 ${getColor(log.level)}`}
                        >
                            <div className="mt-0.5 opacity-80 shrink-0">
                                {getIcon(log.level)}
                            </div>
                            <div className="flex-1 break-all whitespace-pre-wrap">
                                <span className="opacity-50 mr-2 text-[10px]">
                                    [{new Date(log.timestamp).toLocaleTimeString()}]
                                </span>
                                {log.message}
                            </div>
                        </div>
                    ))
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
