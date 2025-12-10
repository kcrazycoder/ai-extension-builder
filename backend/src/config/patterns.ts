export interface CodePattern {
    name: string;
    keywords: string[];
    description: string;
    code: string;
}

export const ExtensionPatterns: CodePattern[] = [
    {
        name: "Messaging (Robust)",
        keywords: ["message", "send", "communicate", "background", "content"],
        description: "Secure, synchronous message passing pattern.",
        code: `
// background.js / content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // PATTERN: Message Handler
    // 1. Check action
    if (request.action === 'getData') {
        // 2. Perform logic (async wrapper if needed)
        (async () => {
            try {
                const data = await fetchData();
                sendResponse({ success: true, data });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true; // 3. KEEP CHANNEL OPEN
    }
});
`
    },
    {
        name: "Storage (Local)",
        keywords: ["save", "load", "storage", "remember", "settings", "preference"],
        description: "Correct usage of chrome.storage.local with async/await.",
        code: `
// PATTERN: Storage
const saveSettings = async (settings) => {
    await chrome.storage.local.set({ settings });
    console.log('Saved');
};

const getSettings = async () => {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {}; // Default fallback
};
`
    },
    {
        name: "Tabs Query",
        keywords: ["tab", "url", "page", "website", "current"],
        description: "Getting the active tab safely.",
        code: `
// PATTERN: Active Tab
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (!tab?.id) return;
// Use tab.id or tab.url
`
    },
    {
        name: "Side Panel",
        keywords: ["side panel", "sidebar", "panel"],
        description: "Opening the side panel (Manifest V3).",
        code: `
// manifest.json
"permissions": ["sidePanel"],
"side_panel": { "default_path": "sidepanel.html" }

// background.js
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
`
    }
];

export function getRelevantPatterns(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    const matches = ExtensionPatterns.filter(p =>
        p.keywords.some(k => lowerPrompt.includes(k))
    );

    if (matches.length === 0) return "";

    return "\n### OFFICIAL CODE SAMPLES (Use these patterns):\n" +
        matches.map(m => `#### ${m.name}\n${m.description}\n\`\`\`javascript${m.code}\`\`\``).join("\n\n");
}
