/* eslint-disable @typescript-eslint/no-explicit-any */
// Types for internal messaging
export type EmulatorMessage =
    | { type: 'runtime.sendMessage'; message: any; sender?: any; responseId?: string }
    | { type: 'runtime.onMessage'; message: any; sender: any }
    | { type: 'log'; level: 'info' | 'warn' | 'error'; content: string[] }
    | { type: 'storage.set'; items: any };

export interface ChromeApiMock {
    runtime: any;
    storage: any;
    tabs: any;
    scripting: any;
}

/**
 * Creates a mock 'chrome' object that communicates via the provided messaging interface.
 * @param postMessageFn Function to send messages to the "other side" (Main Thread)
 * @param contextType 'background' | 'popup'
 */
export function createChromeMock(
    postMessageFn: (msg: EmulatorMessage) => void,
    contextType: 'background' | 'popup',
    storageState: Record<string, any>
): ChromeApiMock {

    const listeners: Set<(...args: any[]) => any> = new Set();

    // Internal handler for incoming messages from the Main Thread
    // (We need a way to trigger this from the outside)
    const dispatchOnMessage = (message: any, sender: any, sendResponse: (response?: any) => void) => {
        listeners.forEach(cb => cb(message, sender, sendResponse));
    };

    return {
        runtime: {
            // id: 'mock-extension-id',
            getURL: (path: string) => path, // Simple mock
            sendMessage: (message: any, responseCallback?: (response: any) => void) => {
                const responseId = responseCallback ? Math.random().toString(36).substring(7) : undefined;

                // In a real extension, sendMessage triggers onMessage in OTHER contexts (Background <-> Popup)
                // We throw this over the wall to the Main Thread, which routes it.
                postMessageFn({
                    type: 'runtime.sendMessage',
                    message,
                    sender: { id: 'mock-id', origin: contextType },
                    responseId
                });
            },
            onMessage: {
                addListener: (callback: (...args: any[]) => any) => listeners.add(callback),
                removeListener: (callback: (...args: any[]) => any) => listeners.delete(callback),
                hasListener: (callback: (...args: any[]) => any) => listeners.has(callback),
                // Internal method to trigger listener
                _dispatch: dispatchOnMessage
            }
        },
        storage: {
            local: {
                get: (keys: string | string[] | null, callback?: (items: any) => void) => {
                    // For MVP, we use the passed in-memory state (synced with main thread)
                    // In a real implementation this would be async.
                    let result: Record<string, any> = {};
                    if (typeof keys === 'string') {
                        result[keys] = storageState[keys];
                    } else if (Array.isArray(keys)) {
                        keys.forEach(k => result[k] = storageState[k]);
                    } else {
                        result = { ...storageState };
                    }
                    if (callback) callback(result);
                    return Promise.resolve(result);
                },
                set: (items: Record<string, any>, callback?: () => void) => {
                    Object.assign(storageState, items);
                    // Notify main thread to persist
                    postMessageFn({ type: 'storage.set', items });
                    if (callback) callback();
                    return Promise.resolve();
                }
            },
            sync: {
                get: () => Promise.resolve({}),
                set: () => Promise.resolve()
            }
        },
        tabs: {
            query: (_queryInfo: any, callback?: (result: any[]) => void) => {
                // Always return one fake active tab
                const result = [{ id: 1, active: true, url: 'https://example.com' }];
                if (callback) callback(result);
                return Promise.resolve(result);
            },
            create: (props: any) => {
                console.log('[Emulator] chrome.tabs.create called with:', props);
                return Promise.resolve({ id: Math.random() });
            }
        },
        scripting: {
            executeScript: () => {
                console.warn('[Emulator] chrome.scripting.executeScript is NOT supported in simulator.');
                return Promise.resolve([]);
            }
        }
    };
}
