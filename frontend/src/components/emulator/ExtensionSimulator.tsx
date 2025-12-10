import { useEffect, useRef, useState } from 'react';
import type { Extension } from '../../types';
import { EmulatorEngine } from '../../emulator';
import { Terminal, RotateCcw, X, Loader2 } from 'lucide-react';
import { apiClient } from '../../api';
import JSZip from 'jszip';

interface SimulatorProps {
    extension: Extension;
    onClose: () => void;
}

// Inline script to be injected into the iframe to mock the Chrome API
// This runs INSIDE the iframe (sandbox)
const CHROME_MOCK_SCRIPT = `
(function() {
    const listeners = new Set();
    
    window.chrome = {
        runtime: {
            getURL: (path) => path,
            sendMessage: (message, responseCallback) => {
                const responseId = responseCallback ? Math.random().toString(36).substring(7) : undefined;
                window.parent.postMessage({
                    type: 'runtime.sendMessage',
                    message,
                    sender: { id: 'mock-id', origin: 'popup' },
                    responseId
                }, '*');
                // Store callback if needed (omitted for MVP)
            },
            onMessage: {
                addListener: (callback) => listeners.add(callback),
                removeListener: (callback) => listeners.delete(callback),
                hasListener: (callback) => listeners.has(callback),
                _dispatch: (message, sender, sendResponse) => {
                    listeners.forEach(cb => cb(message, sender, sendResponse));
                }
            }
        },
        storage: {
            local: {
                get: (keys, callback) => {
                    // Start with empty, parent can sync initial state if needed
                    const result = {}; 
                    if (callback) callback(result);
                    return Promise.resolve(result);
                },
                set: (items, callback) => {
                    window.parent.postMessage({ type: 'storage.set', items }, '*');
                    if (callback) callback();
                    return Promise.resolve();
                }
            }
        },
        tabs: {
            query: (info, cb) => {
                const res = [{id: 1, active: true, url: 'https://example.com'}];
                if(cb) cb(res);
                return Promise.resolve(res);
            },
            create: (p) => {
                console.log('[Emulator] tabs.create', p);
                return Promise.resolve({id: Math.random()});
            }
        }
    };

    // Listen for messages from Parent
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data) return;

        if (data.type === 'runtime.onMessage') {
             window.chrome.runtime.onMessage._dispatch(data.message, data.sender);
        }
    });

    console.log('[Emulator] Chrome Mock Initialized inside Iframe');
})();
`;

export function ExtensionSimulator({ extension, onClose }: SimulatorProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const engineRef = useRef<EmulatorEngine | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [extensionFiles, setExtensionFiles] = useState<Record<string, string>>({});

    // We construct the HTML content to set as srcdoc
    const [iframeContent, setIframeContent] = useState<string>('');

    // Fetch and unzip extension files
    useEffect(() => {
        let mounted = true;

        const loadExtensionFiles = async () => {
            const downloadId = extension.jobId || extension.id;
            if (!downloadId) {
                setLogs(prev => [...prev, '❌ No Job ID or Extension ID found.']);
                return;
            }

            setIsLoading(true);
            setLogs(prev => [...prev, `📦 Fetching extension files (ID: ${downloadId})...`]);

            try {
                const blob = await apiClient.downloadExtension(downloadId);
                console.log('Downloaded blob size:', blob.size);
                const zip = await JSZip.loadAsync(blob);

                const files: Record<string, string> = {};
                // Extract all files as text
                const entries = Object.keys(zip.files);
                console.log('Zip entries:', entries);

                for (const filename of entries) {
                    if (!zip.files[filename].dir) {
                        files[filename] = await zip.files[filename].async("string");
                    }
                }

                if (mounted) {
                    setExtensionFiles(files);
                    setLogs(prev => [...prev, `✅ Loaded ${Object.keys(files).length} files.`]);
                    // Debug: list files
                    setLogs(prev => [...prev, `📂 Files: ${Object.keys(files).join(', ')}`]);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load extension files:", error);
                if (mounted) {
                    setLogs(prev => [...prev, `❌ Failed to load extension files: ${error}`]);
                    setIsLoading(false);
                }
            }
        };

        loadExtensionFiles();

        return () => {
            mounted = false;
        };
    }, [extension.jobId, extension.id]);

    // Construct the srcdoc content when files change
    useEffect(() => {
        if (Object.keys(extensionFiles).length === 0) return;

        // 1. Find the entry point (popup.html)
        let manifest: any = {};
        try {
            if (extensionFiles['manifest.json']) {
                manifest = JSON.parse(extensionFiles['manifest.json']);
            } else {
                setLogs(p => [...p, '⚠️ manifest.json NOT FOUND in files!']);
            }
        } catch (e) {
            setLogs(p => [...p, '⚠️ Failed to parse manifest.json']);
        }

        const popupPath = manifest.action?.default_popup || manifest.browser_action?.default_popup || 'popup.html';
        const popupContent = extensionFiles[popupPath];

        if (!popupContent) {
            setLogs(p => [...p, `⚠️ Popup file '${popupPath}' not found.`]);
            // Try fallback
            const anyHtml = Object.keys(extensionFiles).find(f => f.endsWith('.html'));
            if (anyHtml) {
                setIframeContent(extensionFiles[anyHtml]);
            } else {
                setIframeContent('<html><body>No HTML file found in extension.</body></html>');
            }
            return;
        }

        // 2. Process HTML to inline scripts and styles
        const parser = new DOMParser();
        const doc = parser.parseFromString(popupContent, 'text/html');

        // Inline Scripts
        doc.querySelectorAll('script[src]').forEach((el) => {
            const src = el.getAttribute('src');
            if (src && extensionFiles[src]) {
                const inlineScript = doc.createElement('script');
                inlineScript.textContent = extensionFiles[src];
                el.replaceWith(inlineScript);
                setLogs(p => [...p, `🔗 Inlined script: ${src}`]);
            }
        });

        // Inline Styles
        doc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
            const href = el.getAttribute('href');
            if (href && extensionFiles[href]) {
                const style = doc.createElement('style');
                style.textContent = extensionFiles[href];
                el.replaceWith(style);
                setLogs(p => [...p, `🔗 Inlined style: ${href}`]);
            }
        });

        // 3. Inject Mock Script at the TOP of head
        const mockScript = doc.createElement('script');
        mockScript.textContent = CHROME_MOCK_SCRIPT;
        if (doc.head) {
            doc.head.insertBefore(mockScript, doc.head.firstChild);
        } else {
            // If no head, create one or append to body
            const head = doc.createElement('head');
            head.appendChild(mockScript);
            doc.documentElement.insertBefore(head, doc.body);
        }

        setIframeContent(doc.documentElement.outerHTML);
        setLogs(p => [...p, '🚀 Content prepared for Injection.']);

    }, [extensionFiles]);


    // Initial Setup (Engine)
    useEffect(() => {
        // Start Engine
        const engine = new EmulatorEngine(extension, (_msg: string) => {
            // Log from engine
            // setLogs(prev => [...prev, `[Backend] ${msg}`]);
        });
        engineRef.current = engine;
        engine.start();

        // Listen for messages FROM iframe
        const handleMessage = (event: MessageEvent) => {
            // Security check? Since iframe origin is null/opaque, event.origin might be 'null'
            // We can check source window
            if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;

            const data = event.data;
            if (data.type === 'runtime.sendMessage') {
                setLogs(p => [...p, `[Popup] sendMessage: ${JSON.stringify(data.message)}`]);
                // TODO: Route to backend engine if needed
            } else if (data.type === 'storage.set') {
                setLogs(p => [...p, `[Popup] storage.set: ${JSON.stringify(data.items)}`]);
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            engine.stop();
            window.removeEventListener('message', handleMessage);
        };
    }, [extension.id]);

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
                    <button
                        onClick={() => {
                            // Force re-render of iframe content? 
                            // Just clearing content briefly might trigger reload if we vacillate
                            const current = iframeContent;
                            setIframeContent('');
                            setTimeout(() => setIframeContent(current), 10);
                        }}
                        title="Reload"
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Area: Iframe Container */}
            <div className="flex-1 bg-slate-100 relative items-center justify-center flex overflow-hidden">
                <div className="w-[320px] h-[400px] bg-white shadow-lg rounded-lg overflow-hidden border border-slate-300 transform transition-transform relative">
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center flex-col gap-2">
                            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                            <span className="text-sm text-slate-600 font-medium">Loading Extension...</span>
                        </div>
                    )}
                    {/* The Simulated Popup */}
                    <iframe
                        ref={iframeRef}
                        className="w-full h-full"
                        // Removed allow-same-origin to fix security warning.
                        // We use srcdoc instead of doc.write, so no access to contentDocument needed.
                        sandbox="allow-scripts allow-forms allow-popups allow-modals"
                        srcDoc={iframeContent}
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
