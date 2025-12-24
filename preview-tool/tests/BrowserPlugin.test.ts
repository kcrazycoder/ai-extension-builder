import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
// Import child_process as namespace to access all exports
import * as childProcess from 'child_process';
import { execSync, spawn } from 'child_process';
import { normalizePathToWindows, stripTrailingSlash, findExtensionRoot, validateExtension } from '../src/plugins/BrowserPlugin';

// Mock fs-extra
vi.mock('fs-extra');

// Mock child_process auto-mock
vi.mock('child_process');


describe('BrowserPlugin Path Helpers', () => {
    describe('normalizePathToWindows', () => {
        it('should normalize standard forward slashes to backslashes', () => {
            expect(normalizePathToWindows('C:/Users/Test/Project')).toBe('C:\\Users\\Test\\Project');
        });

        it('should normalize Git Bash /c/ paths to straight Windows paths', () => {
            expect(normalizePathToWindows('/c/Users/Test/Project')).toBe('C:\\Users\\Test\\Project');
        });

        it('should normalize Git Bash /d/ paths to straight Windows paths', () => {
            expect(normalizePathToWindows('/d/Projects/Code')).toBe('D:\\Projects\\Code');
        });

        it('should handle paths with mixed separators if any (though regex assumes /)', () => {
            // The specific regex replaces / with \
            expect(normalizePathToWindows('C:/Temp/file.txt')).toBe('C:\\Temp\\file.txt');
        });
    });

    describe('stripTrailingSlash', () => {
        it('should remove trailing forward slash', () => {
            expect(stripTrailingSlash('path/to/dir/')).toBe('path/to/dir');
        });

        it('should remove trailing backslash', () => {
            expect(stripTrailingSlash('C:\\path\\to\\dir\\')).toBe('C:\\path\\to\\dir');
        });

        it('should remove multiple trailing slashes', () => {
            expect(stripTrailingSlash('path/to/dir//')).toBe('path/to/dir');
        });

        it('should leave paths without trailing slashes alone', () => {
            expect(stripTrailingSlash('path/to/dir')).toBe('path/to/dir');
        });
    });

    describe('findExtensionRoot', () => {
        const mockDir = '/test/staging';

        beforeEach(() => {
            vi.resetAllMocks();
        });

        it('should return the directory itself if manifest.json exists in root', () => {
            // Mock fs.existsSync
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                return p === path.join(mockDir, 'manifest.json');
            });

            const result = findExtensionRoot(mockDir);
            expect(result).toBe(mockDir);
        });

        it('should return a subdirectory if manifest.json is found there', () => {
            const nestedDir = path.join(mockDir, 'extension-v1');

            // Mock fs.existsSync: false for root manifest, true for nested manifest
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (typeof p !== 'string') return false;
                if (p === path.join(mockDir, 'manifest.json')) return false;
                if (p === path.join(nestedDir, 'manifest.json')) return true;
                return false;
            });

            // Mock fs.readdirSync to return the subdirectory
            vi.mocked(fs.readdirSync).mockReturnValue(['extension-v1'] as any);

            // Mock fs.statSync to say it is a directory
            vi.mocked(fs.statSync).mockReturnValue({
                isDirectory: () => true
            } as any);

            const result = findExtensionRoot(mockDir);
            expect(result).toBe(nestedDir);
        });

        it('should return null if manifest.json is not found anywhere', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(fs.readdirSync).mockReturnValue(['other-file.txt'] as any);
            vi.mocked(fs.statSync).mockReturnValue({
                isDirectory: () => false
            } as any);

            const result = findExtensionRoot(mockDir);
            expect(result).toBeNull();
        });

        it('should return null if subdirectory does not contain manifest.json', () => {
            const nestedDir = path.join(mockDir, 'empty-dir');

            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(fs.readdirSync).mockReturnValue(['empty-dir'] as any);
            vi.mocked(fs.statSync).mockReturnValue({
                isDirectory: () => true
            } as any);

            const result = findExtensionRoot(mockDir);
            expect(result).toBeNull();
        });
    });

    describe('validateExtension', () => {
        // Function imported at top level

        it('should fail if directory does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            const result = validateExtension('/some/path');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Directory does not exist');
        });

        it('should fail if path is not a directory', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
            const result = validateExtension('/some/file.txt');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Path is not a directory');
        });

        it('should fail if manifest.json is missing', () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => p === '/some/dir'); // dir exists, manifest does not
            vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
            const result = validateExtension('/some/dir');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('manifest.json missing');
        });

        it('should fail if manifest.json is invalid JSON', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(fs.readFileSync).mockReturnValue('invalid { json');

            const result = validateExtension('/some/dir');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('is invalid JSON');
        });

        it('should pass if directory and valid manifest.json exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(fs.readFileSync).mockReturnValue('{"name": "test"}');

            const result = validateExtension('/some/dir');
            expect(result.valid).toBe(true);
        });
    });

    describe('BrowserPlugin Launch Logic', () => {
        let mockCtx: any;
        let browserStartHandler: any;

        // Mock child_process properly with hoisting
        const { mockSpawn } = vi.hoisted(() => {
            return { mockSpawn: vi.fn() };
        });

        vi.mock('child_process', () => ({
            spawn: (...args: any[]) => {
                const subprocess = { unref: vi.fn() };
                mockSpawn(...args);
                return subprocess;
            },
            exec: vi.fn()
        }));

        beforeEach(() => {
            vi.resetAllMocks();
            mockSpawn.mockClear();

            mockCtx = {
                host: { config: { workDir: '/test/app/work' } },
                actions: {
                    runAction: vi.fn(),
                    registerAction: vi.fn((def) => {
                        if (def.id === 'browser:start') browserStartHandler = def.handler;
                    }),
                },
                events: {
                    emit: vi.fn(),
                    on: vi.fn(),
                }
            };
        });

        const setupPlugin = async () => {
            // Need to re-import or just call setup since it's a defined object
            await import('../src/plugins/BrowserPlugin').then(m => m.BrowserPlugin.setup(mockCtx));
        };

        it('should launch Chrome in Detached mode regarding as Native Windows if /mnt/c does not exist', async () => {
            // Mock Platform to win32
            Object.defineProperty(process, 'platform', { value: 'win32' });

            // Mock fs for setup
            vi.mocked(fs.existsSync).mockImplementation((p: any) => {
                if (p === '/mnt/c') return false; // Not WSL
                if (p === 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') return true; // Found Chrome
                if (p && p.includes('manifest.json')) return true; // Found Manifest
                return true; // Default exist for dirs
            });

            // Mock statSync for validation
            vi.mocked(fs.statSync).mockReturnValue({
                isDirectory: () => true
            } as any);

            // Mock readFileSync for JSON validation
            vi.mocked(fs.readFileSync).mockReturnValue('{}');

            vi.mocked(fs.readdirSync).mockReturnValue([]); // Empty staging for simplicity or mock files

            await setupPlugin();
            expect(browserStartHandler).toBeDefined();

            await browserStartHandler();

            expect(mockSpawn).toHaveBeenCalled();
            const callArgs = mockSpawn.mock.calls[0];
            // Executable should be normalized
            expect(callArgs[0]).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'); // normalized inside if win32
            // Args check
            const args = callArgs[1];
            expect(args[0]).toContain('--load-extension=');
            expect(args[1]).toContain('--user-data-dir=');
            expect(callArgs[2]).toMatchObject({ detached: true });
        });

        it.skip('should launch Chrome with PowerShell script in WSL if /mnt/c exists', async () => {
            // Mock Platform to linux (WSL is linux)
            Object.defineProperty(process, 'platform', { value: 'linux' });

            // Mock fs for setup
            vi.mocked(fs.existsSync).mockImplementation((p: any) => {
                if (p === '/mnt/c') return true; // Is WSL
                if (p === '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe') return true; // Found Chrome via WSL path
                if (p && p.includes('manifest.json')) return true;
                return true;
            });

            // Mock execSync directly
            vi.mocked(execSync).mockReturnValue(Buffer.from('C:\\Users\\TesUser\n'));

            // Mock statSync for validation
            vi.mocked(fs.statSync).mockReturnValue({
                isDirectory: () => true
            } as any);


            // Mock readFileSync for JSON validation
            vi.mocked(fs.readFileSync).mockReturnValue('{}');

            // Mock fs.writeFileSync to verify ps file content
            const mockWriteFile = vi.mocked(fs.writeFileSync);

            await setupPlugin();
            await browserStartHandler();

            // Should create a PowerShell file
            expect(mockWriteFile).toHaveBeenCalled();
            const psContent = mockWriteFile.mock.calls[0][1] as string;
            // Ensure content has windows paths and variables
            expect(psContent).toContain('$chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"');
            expect(psContent).toContain('$extPath = "C:\\Users\\TesUser\\.ai-extension-preview"');

            expect(spawn).toHaveBeenCalled();
            const spawnArgs = vi.mocked(spawn).mock.calls[0];
            expect(spawnArgs[0]).toBe('powershell.exe');
            expect(spawnArgs[1]).toEqual(expect.arrayContaining(['-File', 'C:\\Users\\TesUser\\.ai-extension-preview\\launch.ps1']));
        });
    });
});
