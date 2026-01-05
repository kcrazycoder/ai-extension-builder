import { ExtensionFiles } from './ai';

export interface LintError {
    file: string;
    rule: string;
    message: string;
    severity: 'critical' | 'warning';
}

export class LinterService {
    static lint(files: ExtensionFiles): LintError[] {
        const errors: LintError[] = [];

        // 1. Manifest Checks
        if (files['manifest.json']) {
            try {
                const manifest = JSON.parse(files['manifest.json'] as string);
                this.checkManifest(manifest, errors);
                this.checkPermissions(manifest, files, errors);
            } catch (e) {
                errors.push({
                    file: 'manifest.json',
                    rule: 'json-syntax',
                    message: 'Manifest is not valid JSON.',
                    severity: 'critical',
                });
            }
        } else {
            errors.push({
                file: 'manifest.json',
                rule: 'missing-file',
                message: 'manifest.json is missing.',
                severity: 'critical',
            });
        }

        // 2. Background Script Checks
        if (files['background.js']) {
            const content = files['background.js'] as string;
            this.checkBackgroundScript(content, errors);
        }

        // 3. Popup Script Checks
        if (files['popup.js']) {
            const content = files['popup.js'] as string;
            this.checkPopupScript(content, errors);
        }

        return errors;
    }

    private static checkManifest(manifest: any, errors: LintError[]) {
        if (manifest.manifest_version !== 3) {
            errors.push({
                file: 'manifest.json',
                rule: 'manifest-version',
                message: 'Must use "manifest_version": 3.',
                severity: 'critical',
            });
        }

        // Check deprecated permissions in V3
        if (manifest.permissions) {
            if (manifest.permissions.includes('webRequestBlocking')) {
                errors.push({
                    file: 'manifest.json',
                    rule: 'deprecated-permission',
                    message: "'webRequestBlocking' is deprecated in V3. Use 'declarativeNetRequest'.",
                    severity: 'critical',
                });
            }
        }
    }

    private static checkPermissions(manifest: any, files: ExtensionFiles, errors: LintError[]) {
        const declaredPermissions = new Set([
            ...(manifest.permissions || []),
            ...(manifest.host_permissions || [])
        ]);

        // Helper to check usage
        const checkUsage = (regex: RegExp, permission: string, file: string, content: string) => {
            if (regex.test(content) && !declaredPermissions.has(permission)) {
                errors.push({
                    file,
                    rule: 'missing-permission',
                    message: `Code uses '${permission}' API but validation failed: Permission '${permission}' not found in manifest.`,
                    severity: 'critical'
                });
            }
        };

        // Scan implementation files
        for (const [filename, content] of Object.entries(files)) {
            if (typeof content !== 'string') continue;
            if (!filename.endsWith('.js')) continue;

            checkUsage(/chrome\.storage\./, 'storage', filename, content);
            checkUsage(/chrome\.tabs\./, 'tabs', filename, content);
            checkUsage(/chrome\.bookmarks\./, 'bookmarks', filename, content);
            checkUsage(/chrome\.alarms\./, 'alarms', filename, content);
            checkUsage(/chrome\.notifications\./, 'notifications', filename, content);
        }
    }

    private static checkBackgroundScript(content: string, errors: LintError[]) {
        // Rule: No DOM access
        if (/\bwindow\./.test(content) || /\bdocument\./.test(content) || /\balert\(/.test(content)) {
            errors.push({
                file: 'background.js',
                rule: 'no-dom-in-worker',
                message: 'Service Workers cannot access window, document, or alert.',
                severity: 'critical',
            });
        }

        // Rule: Async Response pattern
        // If it has onMessage validation
        if (/chrome\.runtime\.onMessage\.addListener/.test(content)) {
            // Simple heuristic: if it mentions 'return true' it's likely trying to be async. 
            // We can't easily parse AST here without heavier deps, but we can warn if missing.
            if (/\basync\b/.test(content) && !/return\s+true/.test(content)) {
                errors.push({
                    file: 'background.js',
                    rule: 'async-message-return',
                    message: 'Async message listeners likely need "return true;" to keep the channel open.',
                    severity: 'warning'
                });
            }
        }
    }

    private static checkPopupScript(content: string, errors: LintError[]) {
        // Rule: No inline events (security policy)
        // Hard to check without HTML parsing, but in JS we can check for common issues

        // Check for "chrome.extension.getBackgroundPage()" which is often null for service workers
        if (/chrome\.extension\.getBackgroundPage/.test(content)) {
            errors.push({
                file: 'popup.js',
                rule: 'no-get-bg-page',
                message: 'Avoid getBackgroundPage(). Use messaging to communicate with Service Workers.',
                severity: 'warning'
            });
        }
    }
}
