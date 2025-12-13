export const ExtensionRules = {
  manifest_requirements: {
    version: 3,
    required_fields: ['manifest_version', 'name', 'version', 'action', 'icons'],
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    description:
      "The manifest.json file is the blueprint. It must strictly follow V3 spec. IMPORTANT: 'webRequestBlocking' is DEPRECATED and WILL CAUSE ERRORS. Use declarativeNetRequest instead.",
  },

  forbidden_patterns: {
    webRequestBlocking:
      "CRITICAL ERROR: 'webRequestBlocking' is NOT allowed in Manifest V3. Use 'declarativeNetRequest'.",
    '<all_urls>':
      "WARNING: '<all_urls>' is ONLY allowed in 'host_permissions', NOT in 'permissions'.",
    browser_action: "ERROR: 'browser_action' is replaced by 'action' in V3.",
    page_action: "ERROR: 'page_action' is replaced by 'action' in V3.",
  },

  content_script_policy: {
    rule: 'MUST be registered in manifest if content.js exists.',
    details:
      'IF you create a \'content.js\' file, YOU MUST register it in \'manifest.json\' under \'content_scripts\'. Example: "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content.js"] }]. Failure to do this means the script is never loaded.',
    critical: true,
  },

  async_message_policy: {
    rule: 'MUST return true synchronously if sending async response.',
    details:
      "In 'background.js', if you use 'chrome.runtime.onMessage.addListener' and wish to send a response asynchronously (e.g., after an await or inside a callback), you MUST return 'true' synchronously. Example: return true; // CRITICAL: keeps the channel open.",
    critical: true,
  },

  error_handling_policy: {
    rule: 'ALL message passing MUST check for errors/null. APIs must be checked for existence.',
    details:
      "1. In 'popup.js': Check (!chrome.runtime.lastError && response) before using data.\n2. In 'background.js': When using tabs.sendMessage, check (chrome.runtime.lastError) inside the callback.\n3. FEATURE DETECTION: Before using 'chrome.alarms' or 'chrome.action', check if they are defined (e.g. `if (chrome.alarms) ...`).",
    critical: true,
  },

  golden_reference: {
    code_example: `// See framework_config for the actual background.js implementation`,
    manifest_example: `
{
  "manifest_version": 3,
  "name": "My Ext",
  "version": "0.1.0",
    "host_permissions": ["<all_urls>"],
    "permissions": ["activeTab", "storage"],
    "background": { "service_worker": "background.js", "type": "module" },
    "action": {
        "default_popup": "popup.html",
        "default_icon": { "16": "icons/icon16.png" }
    }
}
        `,
  },

  framework_config: {
    background_router: `
import { handleMessage } from './features.js';

// ==========================================
// STATIC ROUTER (DO NOT MODIFY)
// This file handles all Chrome infrastructure.
// ==========================================

// Global Exception Handler
self.addEventListener('unhandledrejection', event => {
    console.warn("Unhandled Async Error:", event.reason);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Router] Received:", request);

    try {
        // Delegate to AI-generated Logic
        const result = handleMessage(request);

        // Handle Async Functions (Promise)
        if (result instanceof Promise) {
            result
                .then(data => {
                    console.log("[Router] Async Success:", data);
                    sendResponse({ success: true, data });
                })
                .catch(error => {
                    console.error("[Router] Async Error:", error);
                    let msg = error.message || String(error);
                    
                    // Specific Handling for Restricted Pages (e.g. Chrome Web Store)
                    if (msg.includes("extensions gallery cannot be scripted") || msg.includes("Cannot access a chrome://")) {
                        msg = "RESTRICTED_PAGE: This extension cannot run on Chrome Web Store or internal pages.";
                    }

                    sendResponse({ success: false, error: msg });
                });
            return true; // CRITICAL: Tells Chrome we are async
        } 
        
        // Handle Sync Functions
        else {
            console.log("[Router] Sync Success:", result);
            sendResponse({ success: true, data: result });
            return false; // Sync response sent
        }

    } catch (error) {
        console.error("[Router] Fatal Logic Error:", error);
        sendResponse({ success: false, error: error.message });
        return false;
    }
});

// Alarm Listener (Added by Framework)
if (chrome.alarms) {
    chrome.alarms.onAlarm.addListener((alarm) => {
        console.log("[Router] Alarm Fired:", alarm);
        handleMessage({ action: 'alarmTriggered', data: alarm });
    });
}

`,
  },

  file_structure: {
    'background.js': 'Service Worker (Must handle async messaging correctly)',
    'content.js': 'Page interaction logic (Only if page scraping/manipulation is required)',
    'popup.html': 'UI HTML',
    'popup.js': 'UI Logic',
    'styles.css': 'Styles',
    'README.md': 'Instructions',
    'manifest.json': 'Configuration (MUST BE LAST: Configures the scripts you just wrote)',
  },

  valid_permissions: [
    'activeTab',
    'alarms',
    'background',
    'bookmarks',
    'browsingData',
    'clipboardRead',
    'clipboardWrite',
    'contentSettings',
    'contextMenus',
    'cookies',
    'debugger',
    'declarativeContent',
    'declarativeNetRequest',
    'desktopCapture',
    'downloads',
    'fontSettings',
    'gcm',
    'geolocation',
    'history',
    'identity',
    'idle',
    'management',
    'nativeMessaging',
    'notifications',
    'pageCapture',
    'power',
    'printerProvider',
    'printing',
    'privacy',
    'proxy',
    'scripting',
    'search',
    'sessions',
    'sidePanel',
    'storage',
    'system.cpu',
    'system.memory',
    'system.storage',
    'tabCapture',
    'tabGroups',
    'tabs',
    'topSites',
    'tts',
    'ttsEngine',
    'unlimitedStorage',
    'webNavigation',
    'webRequest',
  ],
};
