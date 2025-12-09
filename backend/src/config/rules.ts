export const ExtensionRules = {
    manifest_requirements: {
        version: 3,
        required_fields: [
            'manifest_version',
            'name',
            'version',
            'action',
            'icons'
        ],
        background: {
            service_worker: 'background.js',
            type: 'module'
        },
        description: "The manifest.json file is the blueprint. It must strictly follow V3 spec."
    },

    content_script_policy: {
        rule: "MUST be registered in manifest if content.js exists.",
        details: "IF you create a 'content.js' file, YOU MUST register it in 'manifest.json' under 'content_scripts'. Example: \"content_scripts\": [{ \"matches\": [\"<all_urls>\"], \"js\": [\"content.js\"] }]. Failure to do this means the script is never loaded.",
        critical: true
    },

    async_message_policy: {
        rule: "MUST return true synchronously if sending async response.",
        details: "In 'background.js', if you use 'chrome.runtime.onMessage.addListener' and wish to send a response asynchronously (e.g., after an await or inside a callback), you MUST return 'true' synchronously. Example: return true; // CRITICAL: keeps the channel open.",
        critical: true
    },

    file_structure: {
        'manifest.json': 'Configuration (Must include content_scripts if needed)',
        'background.js': 'Service Worker (Must handle async messaging correctly)',
        'content.js': 'Page interaction logic (Only if page scraping/manipulation is required)',
        'popup.html': 'UI HTML',
        'popup.js': 'UI Logic',
        'styles.css': 'Styles',
        'README.md': 'Instructions'
    }
};
