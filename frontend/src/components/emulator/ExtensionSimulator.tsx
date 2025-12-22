import { useEffect, useRef, useState } from 'react';
import type { Extension } from '../../types';
import { EmulatorEngine } from '../../emulator';
import { Terminal, RotateCcw, X, Loader2, Copy, Check, FlaskConical } from 'lucide-react';
import { apiClient } from '../../api';
import JSZip from 'jszip';

interface SimulatorProps {
    extension: Extension;
    onClose: () => void;
}

// Defines the test extension files used for the "Self-Diagnostic" feature

const TEST_EXTENSION_FILES = {
    "manifest.json": JSON.stringify({
        "manifest_version": 3,
        "name": "Simulator Diagnostic",
        "version": "1.0",
        "permissions": ["alarms", "storage", "cookies", "bookmarks"],
        "background": { "service_worker": "background.js" },
        "action": { "default_popup": "popup.html" }
    }, null, 2),
    "popup.html": `<!DOCTYPE html>
                    <html>
                    <body style="width:300px; padding:10px; font-family:sans-serif;">
                    <h3>🧪 Self-Diagnostic</h3>
                    <div id="status">Running tests...</div>
                    <script src="popup.js"></script>
                    </body>
                    </html>`,
    "background.js": `
                    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
                        if (msg.type === 'PING') sendResponse({ type: 'PONG', success: true });
                    });
                    `,
    "popup.js": `
const log = (msg, pass) => {
    const el = document.createElement('div');
    el.innerText = (pass ? '✅ ' : '❌ ') + msg;
    el.style.color = pass ? 'green' : 'red';
    document.body.appendChild(el);
    console.log((pass ? '✅ PASS: ' : '❌ FAIL: ') + msg);
};

async function runTests() {
    try {
        // 1. Alarms
        await chrome.alarms.create('test-alarm', { delayInMinutes: 0.1 });
        log('Alarms: Create OK', true);

        // 2. Storage
        await chrome.storage.local.set({test: 123});
        const val = await chrome.storage.local.get('test');
        log('Storage: Set/Get OK (' + val.test + ')', val.test === 123);

        // 3. Cookies
        await chrome.cookies.set({url: 'https://example.com', name: 'test', value: 'cookie'});
        log('Cookies: Set OK', true);

        // 4. Runtime Message (Background)
        const resp = await chrome.runtime.sendMessage({type: 'PING'});
        log('Runtime: Background Ping (' + resp?.success + ')', resp?.success === true);
    } catch(e) {
        log('EXCEPTION: ' + e.message, false);
    }
}
runTests();
`
};
// Inline script to be injected into the iframe to mock the Chrome API
// This runs INSIDE the iframe (sandbox)
const CHROME_MOCK_SCRIPT = `
        (function () {
            const listeners = new Set();
            const alarmListeners = new Set();
            let storageData = {};

            // Polyfill EyeDropper
            if (!window.EyeDropper) {
                window.EyeDropper = class {
                    open() {
                        console.log('[Emulator] EyeDropper opened');
                        window.parent.postMessage({ type: 'emulator.log', message: '🎨 EyeDropper API called. Returning mock color #6366f1.' }, '*');
                        return Promise.resolve({ sRGBHex: '#6366f1' });
                    }
                };
            }

            const log = (msg) => window.parent.postMessage({ type: 'emulator.log', message: msg }, '*');

            window.chrome = {
                runtime: {
                    id: 'mock-extension-id',
                    getURL: (path) => path,
                    getManifest: () => ({ version: '1.0.0', name: 'Mock Extension' }),
                    sendMessage: (arg1, arg2, arg3) => {
                        // Polymorphic argument handling
                        let message = arg1;
                        let callback = arg3 || arg2;

                        if (typeof arg1 === 'string') {
                            message = arg2;
                            callback = arg3;
                        } else {
                            message = arg1;
                            if (typeof arg2 === 'function') callback = arg2;
                        }

                        log(\`📤 runtime.sendMessage: \${JSON.stringify(message)}\`);

                return new Promise((resolve) => {
                    let responseReceived = false;
                    const sendResponse = (data) => {
                        if (responseReceived) return;
                        responseReceived = true;
                        if (callback && typeof callback === 'function') callback(data);
                        resolve(data);
                    };

                    // Dispatch to listeners
                    // We need to pass sendResponse so listeners can reply
                    const anyAsync = window.chrome.runtime.onMessage._dispatch(message, { id: 'mock-sender' }, sendResponse);
                    
                    // If no listener returned true (async), resolve immediately (or timeout)
                    if (!anyAsync) {
                         // If synchronous, they might have called sendResponse immediately. 
                         // If not, we resolve with default.
                         if (!responseReceived) {
                             sendResponse({ success: true, warning: "No listener responded" });
                         }
                    }
                });
            },
            onMessage: {
                addListener: (cb) => listeners.add(cb),
                removeListener: (cb) => listeners.delete(cb),
                _dispatch: (msg, sender, resp) => {
                    let anyAsync = false;
                    listeners.forEach(cb => {
                        const ret = cb(msg, sender, resp);
                        if (ret === true) anyAsync = true;
                    });
                    return anyAsync;
                }
            }
        },
        storage: {
            local: {
                get: (keys, cb) => {
                    let res = {};
                    if (typeof keys === 'string') {
                        if (storageData[keys] !== undefined) res[keys] = storageData[keys];
                    } else if (keys === null) {
                        res = { ...storageData };
                    } else {
                         // Assume object with defaults
                         for (let k in keys) {
                             res[k] = storageData[k] !== undefined ? storageData[k] : keys[k];
                         }
                    }
                    if(cb) cb(res);
                    return Promise.resolve(res);
                },
                set: (items, cb) => {
                    log(\`💾 storage.local.set: \${JSON.stringify(items)}\`);
                    Object.assign(storageData, items);
                    if(cb) cb();
                    return Promise.resolve();
                },
                remove: (keys, cb) => {
                    log(\`💾 storage.local.remove: \${JSON.stringify(keys)}\`);
                    if (typeof keys === 'string') {
                        delete storageData[keys];
                    } else if (Array.isArray(keys)) {
                        keys.forEach(k => delete storageData[k]);
                    }
                    if(cb) cb();
                    return Promise.resolve();
                }
            },
            sync: {
                get: (k, cb) => window.chrome.storage.local.get(k, cb),
                set: (i, cb) => window.chrome.storage.local.set(i, cb),
                remove: (k, cb) => window.chrome.storage.local.remove(k, cb)
            }
        },
        tabs: {
            query: (info, cb) => {
                const res = [{id: 1, active: true, url: 'https://example.com', title: 'Example Page'}];
                if(cb) cb(res);
                return Promise.resolve(res);
            },
            create: (p) => {
                log(\`📄 tabs.create: \${p.url}\`);
                return Promise.resolve({id: Math.random()});
            },
            sendMessage: (tabId, msg, opt, cb) => {
                if(typeof opt === 'function') { cb = opt; opt = {}; }
                log(\`📨 tabs.sendMessage (Tab \${tabId}): \${JSON.stringify(msg)}\`);
                const response = {success: true};
                if(cb) cb(response);
                return Promise.resolve(response);
            },
            captureVisibleTab: (wid, opt, cb) => {
                const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAfhAJ/wlseOgAAAABJRU5ErkJggg==";
                if(cb) cb(img);
                return Promise.resolve(img);
            }
        },
        scripting: {
            executeScript: (inj, cb) => {
                log(\`📜 scripting.executeScript (Tab \${inj.target.tabId})\`);
                const res = [{result: null}];
                if(cb) cb(res);
                return Promise.resolve(res);
            },
            insertCSS: (inj, cb) => {
                log(\`🎨 scripting.insertCSS (Tab \${inj.target.tabId})\`);
                if(cb) cb();
                return Promise.resolve();
            }
        },
        alarms: {
            create: (name, alarmInfo) => {
                const delayInMinutes = alarmInfo.delayInMinutes || (alarmInfo.when ? (alarmInfo.when - Date.now()) / 60000 : 0.1);
                const delayMs = delayInMinutes * 60 * 1000;
                
                log(\`⏰ alarms.create: "\${name}" (Delay: \${delayInMinutes.toFixed(2)}m)\`);
                
                // Clear existing if any (simplistic)
                
                setTimeout(() => {
                    log(\`🔔 Alarm Fired: "\${name}"\`);
                    alarmListeners.forEach(cb => cb({name}));
                }, delayMs); 
            },
            clear: (name, cb) => {
                log(\`🔕 alarms.clear: "\${name}"\`);
                if(cb) cb(true);
            },
            get: (name, cb) => {
                 // Mock return
                 if(cb) cb(null);
                 return Promise.resolve(null);
            },
            getAll: (cb) => {
                 if(cb) cb([]);
                 return Promise.resolve([]);
            },
            onAlarm: {
                addListener: (cb) => alarmListeners.add(cb),
                removeListener: (cb) => alarmListeners.delete(cb)
            }
        },
        action: {
            setBadgeText: (details, cb) => {
                log(\`🏷️ action.setBadgeText: "\${details.text}"\`);
                if (cb) cb();
            },
            setTitle: (details, cb) => {
                log(\`🏷️ action.setTitle: "\${details.title}"\`);
                if (cb) cb();
            },
            setIcon: (details, cb) => {
                 log(\`🖼️ action.setIcon\`);
                 if (cb) cb();
            }
        },
        notifications: {
            create: (id, options, cb) => {
                // Polymorphic: (options, cb) or (id, options, cb)
                if (typeof id === 'object') {
                    cb = options;
                    options = id;
                    id = Math.random().toString(36);
                }
                const notifId = id || Math.random().toString(36);
                const title = options?.title || 'Notification';
                const message = options?.message || 'No message';
                log(\`📢 notifications.create: "\${title}" - \${message}\`);
                if(cb) cb(notifId);
                return Promise.resolve(notifId);
            }
        },
        contextMenus: {
            create: (props, cb) => {
                log(\`🖱️ contextMenus.create: "\${props.title}"\`);
                if(cb) cb();
            },
            removeAll: (cb) => { if(cb) cb(); }
        },
        cookies: {
            get: (details, cb) => {
                log(\`🍪 cookies.get: \${details.name}\`);
                if(cb) cb(null);
                return Promise.resolve(null);
            },
            getAll: (details, cb) => {
                log(\`🍪 cookies.getAll\`);
                if(cb) cb([]);
                return Promise.resolve([]);
            },
            set: (details, cb) => {
                log(\`🍪 cookies.set: \${details.name} = \${details.value}\`);
                if(cb) cb(details);
                return Promise.resolve(details);
            },
            remove: (details, cb) => {
                log(\`🍪 cookies.remove: \${details.name}\`);
                if(cb) cb(details);
                return Promise.resolve(details);
            }
        },
        bookmarks: {
            getTree: (cb) => {
                const tree = [{
                    id: '0', title: '', children: [
                        {id: '1', title: 'Bookmarks Bar', children: [
                            {id: '10', title: 'Example', url: 'https://example.com'}
                        ]},
                        {id: '2', title: 'Other Bookmarks', children: []}
                    ]
                }];
                if(cb) cb(tree);
                return Promise.resolve(tree);
            },
            create: (bm, cb) => {
                log(\`🔖 bookmarks.create: \${bm.title}\`);
                if(cb) cb(bm);
                return Promise.resolve(bm);
            }
        },
        webRequest: {
            onBeforeRequest: { addListener: () => {}, removeListener: () => {} },
            onCompleted: { addListener: () => {}, removeListener: () => {} },
            onErrorOccurred: { addListener: () => {}, removeListener: () => {} }
        },
        windows: {
            create: (d, cb) => {
                log(\`WINDOW: create\`);
                if(cb) cb({id: 99});
                return Promise.resolve({id: 99});
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
    const [copySuccess, setCopySuccess] = useState(false);
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

    // Helper to bundler simple imports (naive implementation for this specific project structure)
    // Matches: import { handleMessage } from './features.js';
    const bundleModules = (content: string, files: Record<string, string>) => {
        return content.replace(/import\s+\{\s*(\w+)\s*\}\s+from\s+['"]\.\/([^'"]+)['"];?/g, (match, _, fileName) => {
            if (files[fileName]) {
                // Return the content of the imported file, stripping "export" keyword to merge scopes
                // This is a specific hack for the Router -> Features pattern
                let imported = stripSourceMaps(files[fileName]);
                imported = imported.replace(/export\s+async\s+function/g, 'async function');
                imported = imported.replace(/export\s+function/g, 'function');
                return `// Inlined ${fileName}\n${imported}\n`;
            }
            return match; // Keep if not found (will likely fail in browser but better than empty)
        });
    };

    // Helper to strip source map comments to prevent "URL constructor" errors in srcdoc
    const stripSourceMaps = (content: string) => {
        return content
            .replace(/\/\/[#@]\s*(sourceMappingURL|sourceURL)=.*$/mg, '')
            .replace(/\/\*+[#@]\s*(sourceMappingURL|sourceURL)=[\s\S]*?\*\//mg, '');
    };

    // Construct the srcdoc content when files change
    useEffect(() => {
        if (Object.keys(extensionFiles).length === 0) return;

        // 1. Find the entry point (popup.html)
        interface Manifest {
            action?: { default_popup?: string };
            browser_action?: { default_popup?: string };
            background?: { service_worker?: string; type?: string };
        }
        let manifest: Manifest = {};
        try {
            if (extensionFiles['manifest.json']) {
                manifest = JSON.parse(extensionFiles['manifest.json']);
            } else {
                setLogs(p => [...p, '⚠️ manifest.json NOT FOUND in files!']);
            }
        } catch {
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
                inlineScript.textContent = stripSourceMaps(extensionFiles[src]);
                el.replaceWith(inlineScript);
                setLogs(p => [...p, `🔗 Inlined script: ${src}`]);
            }
        });

        // Inline Styles
        doc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
            const href = el.getAttribute('href');
            if (href && extensionFiles[href]) {
                const style = doc.createElement('style');
                style.textContent = stripSourceMaps(extensionFiles[href]);
                el.replaceWith(style);
                setLogs(p => [...p, `🔗 Inlined style: ${href}`]);
            }
        });

        // 3. Inject Background Script (Service Worker) if present
        // We inject it BEFORE other scripts so it can register listeners
        if (manifest.background?.service_worker) {
            const swPath = manifest.background.service_worker;
            if (extensionFiles[swPath]) {
                const swScript = doc.createElement('script');
                // Use module if specified (Manifest V3 is usually module)
                if (manifest.background.type === 'module') {
                    swScript.setAttribute('type', 'module');
                }

                // Bundle imports (handles background.js -> features.js)
                let swContent = stripSourceMaps(extensionFiles[swPath]);
                swContent = bundleModules(swContent, extensionFiles);

                swScript.textContent = swContent;

                if (doc.head) {
                    doc.head.insertBefore(swScript, doc.head.firstChild);
                    // setLogs(p => [...p, `⚙️ Inlined background script: ${swPath}`]); // Cannot use setLogs inside render loop easily or it might cause render issues if not careful, but this is inside useEffect.
                }
            }
        }

        // 4. Inject Mock Script at the TOP of head (must be first)
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

        const finalHtml = stripSourceMaps(doc.documentElement.outerHTML);
        setIframeContent(finalHtml);
        setLogs(p => [...p, '🚀 Content prepared for Injection.']);

    }, [extensionFiles]);


    // Initial Setup (Engine)
    useEffect(() => {
        // Start Engine
        const engine = new EmulatorEngine(extension, () => {
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
            } else if (data.type === 'emulator.log') {
                setLogs(p => [...p, `[API] ${data.message}`]);
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            engine.stop();
            window.removeEventListener('message', handleMessage);
        };
    }, [extension.id, extension]);

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
                    <button
                        onClick={() => setExtensionFiles(TEST_EXTENSION_FILES)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Load Test Extension"
                    >
                        <FlaskConical className="w-4 h-4" />
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(logs.join('\n'));
                                setCopySuccess(true);
                                setTimeout(() => setCopySuccess(false), 2000);
                            }}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                            title="Copy all logs"
                        >
                            {copySuccess ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            {copySuccess ? 'Copied' : 'Copy'}
                        </button>
                        <div className="w-px h-3 bg-slate-700" />
                        <button onClick={() => setLogs([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
                    </div>
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
