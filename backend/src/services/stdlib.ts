
export const StorageTemplate = `import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Type-safe wrapper for chrome.storage.local
 */
export const storage = {
  get: async <T>(key: string, defaultValue?: T): Promise<T> => {
    try {
      const result = await chrome.storage.local.get(key);
      return (result[key] !== undefined ? result[key] : defaultValue) as T;
    } catch (e) {
      console.warn('Storage get failed', e);
      return defaultValue as T;
    }
  },
  set: async <T>(key: string, value: T): Promise<void> => {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (e) {
      console.warn('Storage set failed', e);
    }
  },
  remove: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  }
};

/**
 * React Hook to sync state with chrome.storage.local
 * @param key Storage key
 * @param defaultValue Default value if key doesn't exist
 */
export function useStorage<T>(key: string, defaultValue: T): [T, (value: T) => Promise<void>] {
  const [value, setValue] = useState<T>(defaultValue);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Initial fetch
    storage.get<T>(key, defaultValue).then((val) => {
      if (mounted.current) setValue(val);
    });

    // Listener for changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes[key]) {
        if (changes[key].newValue !== undefined && mounted.current) {
          setValue(changes[key].newValue as T);
        }
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      mounted.current = false;
      chrome.storage.onChanged.removeListener(listener);
    }
  }, [key, defaultValue]);

  const updateValue = useCallback(async (newValue: T) => {
    // Optimistic update
    setValue(newValue);
    await storage.set(key, newValue);
  }, [key]);

  return [value, updateValue];
}
`;

export const MessagingTemplate = `import { useEffect, useRef } from 'react';

export type MessagePayload = any;
export type MessageResponse = any;

/**
 * Send a message to the background script or other parts of the extension.
 */
export async function sendMessage<T = MessageResponse>(type: string, payload?: MessagePayload): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          // Ignore "Could not establish connection" errors if logical
          console.debug('Runtime message error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response as T);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * React Hook to listen for messages.
 * @param handler Function to handle incoming messages. Return a promise to send a response.
 */
export function useMessageListener(
  handler: (type: string, payload: any, sender: chrome.runtime.MessageSender) => Promise<any> | any
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (
      message: { type: string; payload: any },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      // Async handler support
      const result = savedHandler.current(message.type, message.payload, sender);
      
      if (result instanceof Promise) {
        result.then(sendResponse).catch((err) => sendResponse({ error: err.message }));
        return true; // Indicates async response to Chrome
      } else if (result !== undefined) {
         sendResponse(result);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
}
`;

export class StdLibService {
    /**
     * Returns the Standard Library files to be injected into the project
     */
    static getFiles(): Record<string, string> {
        return {
            'src/utils/std/storage.ts': StorageTemplate,
            'src/utils/std/messaging.ts': MessagingTemplate,
            'src/utils/std/index.ts': `export * from './storage';\nexport * from './messaging';`
        };
    }
}
