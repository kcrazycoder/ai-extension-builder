import { describe, it, expect, vi } from 'vitest';
import { LinterService } from './linter';
import { AIService, ExtensionFiles } from './ai';
import { Ai } from '@liquidmetal-ai/raindrop-framework';

describe('Robustness Feature Verification', () => {

    describe('LinterService', () => {
        it('should detect invalid manifest version', () => {
            const files: ExtensionFiles = {
                'manifest.json': JSON.stringify({ manifest_version: 2, name: 'Test', version: '1.0' })
            };
            const errors = LinterService.lint(files);
            expect(errors.some(e => e.rule === 'manifest-version')).toBe(true);
        });

        it('should detect missing permissions', () => {
            const files: ExtensionFiles = {
                'manifest.json': JSON.stringify({ manifest_version: 3, name: 'Test', version: '1.0', permissions: [] }),
                'background.js': 'chrome.storage.local.set({ key: "value" });'
            };
            const errors = LinterService.lint(files);
            expect(errors.some(e => e.rule === 'missing-permission' && e.message.includes('storage'))).toBe(true);
        });

        it('should warn about async handlers without return true', () => {
            const files: ExtensionFiles = {
                'manifest.json': JSON.stringify({ manifest_version: 3, name: 'Test', version: '1.0' }),
                'background.js': `
                    chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
                        await doSomething();
                        sendResponse({ success: true });
                    });
                `
            };
            const errors = LinterService.lint(files);
            expect(errors.some(e => e.rule === 'async-message-return')).toBe(true);
        });

        it('should NOT warn if return true is present', () => {
            const files: ExtensionFiles = {
                'manifest.json': JSON.stringify({ manifest_version: 3, name: 'Test', version: '1.0' }),
                'background.js': `
                    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
                        doAsync().then(res => sendResponse(res));
                        return true;
                    });
                `
            };
            const errors = LinterService.lint(files);
            expect(errors.some(e => e.rule === 'async-message-return')).toBe(false);
        });
    });

    describe('AIService Repair Loop', () => {
        it('should trigger repair when linter errors are found', async () => {
            // Mock Ai dependencies
            const mockAi = {} as Ai;
            const service = new AIService(mockAi, 'fake-key', 'fake-url');

            // Mock repairExtension to simulate a fix
            service.repairExtension = vi.fn().mockResolvedValue({
                'manifest.json': JSON.stringify({ manifest_version: 3, name: 'Test', version: '1.0', permissions: ['storage'] }),
                'background.js': 'chrome.storage.local.set({ key: "value" });'
            });

            const badFiles: ExtensionFiles = {
                'manifest.json': JSON.stringify({ manifest_version: 3, name: 'Test', version: '1.0', permissions: [] }),
                'background.js': 'chrome.storage.local.set({ key: "value" });'
            };

            const result = await service.validateAndRepair('test prompt', badFiles);

            expect(result.repaired).toBe(true);
            expect(service.repairExtension).toHaveBeenCalled();
        });
    });
});
