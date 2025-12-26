import path from 'path';
import fs from 'fs-extra';

const CHROME_PATHS = [
    // Standard Windows Paths
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // WSL Mappings
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    // Git Bash / Unix-y Windows Environment Mappings
    '/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
];

export function findChrome(): string | null {
    for (const p of CHROME_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

// --- Helper to find actual extension root (handle nested folder in zip) ---
export const findExtensionRoot = (dir: string): string | null => {
    if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;

    // Check immediate subdirectories (depth 1)
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                if (fs.existsSync(path.join(fullPath, 'manifest.json'))) {
                    return fullPath;
                }
            }
        }
    } catch (e) {
        // Dir might be empty or invalid
    }
    return null;
};

export const normalizePathToWindows = (p: string) => {
    // Handle Git Bash /c/ style
    const gitBashMatch = p.match(/^\/([a-z])\/(.*)/i);
    if (gitBashMatch) {
        return `${gitBashMatch[1].toUpperCase()}:\\${gitBashMatch[2].replace(/\//g, '\\')}`;
    }
    // Handle Forward slashes
    return p.replace(/\//g, '\\');
};

export const stripTrailingSlash = (p: string) => {
    return p.replace(/[\\\/]+$/, '');
};

// --- Helper to validate extension directory existence and structure ---
export const validateExtension = (dir: string): { valid: boolean; error?: string } => {
    if (!fs.existsSync(dir)) {
        return { valid: false, error: 'Directory does not exist' };
    }
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) {
        return { valid: false, error: 'Path is not a directory' };
    }
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        return { valid: false, error: 'manifest.json missing' };
    }
    // Basic JSON validity check
    try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        JSON.parse(content);
    } catch (e) {
        return { valid: false, error: 'manifest.json is invalid JSON' };
    }
    return { valid: true };
};
