import { useEffect, useRef, useState } from 'react';
import type { Extension } from '../../types';
import { EmulatorEngine } from '../../emulator';
import { Terminal, RotateCcw, X } from 'lucide-react';
import { createChromeMock } from '../../emulator/bridge';
import type { EmulatorMessage } from '../../emulator/bridge';

interface SimulatorProps {
    extension: Extension;
    onClose: () => void;
}

export function ExtensionSimulator({ extension, onClose }: SimulatorProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const engineRef = useRef<EmulatorEngine | null>(null);

    // Initial Setup
    useEffect(() => {
        // Start Engine
        const engine = new EmulatorEngine(extension, (msg: string) => {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
        });

        engineRef.current = engine;
        engine.start();

        // Load Background Code (from extension object if available?)
        // Assuming we need to fetch or extract from extension.files mock
        // For MVP, we'll try to use a placeholder or assume files are injected later.

        // Cleanup
        return () => {
            engine.stop();
        };
    }, [extension.id]);

    // Handle Iframe injection
    const handleIframeLoad = () => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) return;

        // Inject Polyfill into Iframe
        // We can't inject 'import' statements easily into iframe without module support
        // We'll attach the mock object directly to the window

        // Challenge: Iframe is 'about:blank' so same-origin holds.
        const win = iframe.contentWindow as any;

        const chromeMock = createChromeMock(
            (msg: EmulatorMessage) => {
                // Route message from Popup -> Engine -> Background
                // For MVP, we just log it or would send to engine
                setLogs(p => [...p, `[Popup] Message sent: ${msg.type}`]);
            },
            'popup',
            {} // Shared storage ref? 
        );

        win.chrome = chromeMock;

        // Inject styles
        // ToDO: Fetch styles.css from extension

        // Inject popup.html content
        // ToDO: Fetch popup.html from extension

        // Inject popup.js
        // ToDO: Fetch popup.js

        setLogs(p => [...p, 'Frontend: Iframe loaded & injected.']);
    };

    // Helper to extract file content
    // Since 'extension' object currently just has 'files' if we returned it from AI,
    // OR we need to fetch. 
    // Let's assume for this component we want to render roughly what's there.
    // Ideally we pass a map of files { "popup.html": "...", "style.css": "..." }

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-96 shadow-2xl absolute right-0 top-0 bottom-0 z-40 animate-in slide-in-from-right">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-2 text-slate-200">
                    <Terminal className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-sm">Extension Simulator</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Beta</span>
                </div>
                <div className="flex items-center gap-2">
                    <button title="Reload" className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Area: Iframe Container */}
            <div className="flex-1 bg-slate-100 relative items-center justify-center flex overflow-hidden">
                <div className="w-[320px] h-[400px] bg-white shadow-lg rounded-lg overflow-hidden border border-slate-300 transform transition-transform">
                    {/* The Simulated Popup */}
                    <iframe
                        ref={iframeRef}
                        className="w-full h-full"
                        sandbox="allow-scripts allow-forms allow-popups allow-modals"
                        onLoad={handleIframeLoad}
                        src="about:blank"
                    />
                </div>
            </div>

            {/* Logs Console */}
            <div className="h-48 bg-black flex flex-col border-t border-slate-800">
                <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Console Output</span>
                    <button onClick={() => setLogs([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
                    {logs.length === 0 && <span className="text-slate-700 italic">No logs yet...</span>}
                    {logs.map((log, i) => (
                        <div key={i} className="text-slate-300 break-words">{log}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}
