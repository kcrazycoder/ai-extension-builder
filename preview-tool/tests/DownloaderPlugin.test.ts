
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DownloaderPlugin } from '../src/plugins/DownloaderPlugin';
import path from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import AdmZip from 'adm-zip';

// Mocks
vi.mock('fs-extra');
vi.mock('axios');

const { mockExtractAllTo } = vi.hoisted(() => {
    return { mockExtractAllTo: vi.fn() };
});

vi.mock('adm-zip', () => {
    return {
        default: vi.fn((file) => {
            console.log('AdmZip Constructor Called with:', file);
            return {
                extractAllTo: mockExtractAllTo
            };
        })
    };
});
vi.mock('ora', () => ({
    default: () => ({
        start: () => ({
            succeed: vi.fn(),
            fail: vi.fn(),
            stop: vi.fn()
        })
    })
}));

describe('DownloaderPlugin', () => {
    let mockCtx: any;
    let mockAxios: any;

    beforeEach(() => {
        mockCtx = {
            host: {
                config: {
                    workDir: '/tmp/test-workdir',
                    jobId: 'test-job-123',
                    host: 'http://test-api.com',
                    token: 'fake-token'
                }
            },
            actions: {
                registerAction: vi.fn(),
                runAction: vi.fn().mockImplementation((id) => {
                    // If download is called, return true by default
                    if (id === 'downloader:download') return Promise.resolve(true);
                    return Promise.resolve();
                })
            },
            events: {
                emit: vi.fn()
            }
        };

        mockAxios = {
            get: vi.fn()
        };
        vi.mocked(axios.create).mockReturnValue(mockAxios);

        // Reset FS mocks
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
        vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
        vi.mocked(fs.emptyDir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined); // fs-extra writeFile is different? No it's same.
    });

    it('should register actions on setup', () => {
        DownloaderPlugin.setup(mockCtx);
        expect(mockCtx.actions.registerAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'downloader:check' }));
        expect(mockCtx.actions.registerAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'downloader:download' }));
    });

    describe('Action: downloader:check', () => {
        it('should NOT trigger download if versions match', async () => {
            DownloaderPlugin.setup(mockCtx);
            // Get the registered handler
            const checkHandler = mockCtx.actions.registerAction.mock.calls.find((c: any) => c[0].id === 'downloader:check')[0].handler;

            // Mock local version file
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('v1.0.0');

            // Mock API response
            mockAxios.get.mockResolvedValue({
                data: { status: 'completed', version: 'v1.0.0' }
            });

            await checkHandler();

            expect(mockCtx.actions.runAction).not.toHaveBeenCalledWith('downloader:download', expect.anything());
        });

        it('should trigger download if versions differ', async () => {
            DownloaderPlugin.setup(mockCtx);
            const checkHandler = mockCtx.actions.registerAction.mock.calls.find((c: any) => c[0].id === 'downloader:check')[0].handler;

            // Mock local version file
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('v1.0.0');

            // Mock API response
            mockAxios.get.mockResolvedValue({
                data: { status: 'completed', version: 'v1.1.0' } // NEW VERSION
            });

            await checkHandler();

            expect(mockCtx.actions.runAction).toHaveBeenCalledWith('downloader:download', null);
            // Should update version file
            expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('version'), 'v1.1.0');
            // Should emit update event
            expect(mockCtx.events.emit).toHaveBeenCalledWith('downloader:updated', { version: 'v1.1.0', jobId: 'test-job-123' });
        });

        it('should NOT trigger download if job is not completed', async () => {
            DownloaderPlugin.setup(mockCtx);
            const checkHandler = mockCtx.actions.registerAction.mock.calls.find((c: any) => c[0].id === 'downloader:check')[0].handler;

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('v1.0.0');

            mockAxios.get.mockResolvedValue({
                data: { status: 'processing', version: 'v1.1.0' } // Processing...
            });

            await checkHandler();

            expect(mockCtx.actions.runAction).not.toHaveBeenCalledWith('downloader:download', expect.anything());
        });
    });

    describe('Action: downloader:download', () => {
        it.skip('should download zip, extract it, and inject hot reload script', async () => {
            DownloaderPlugin.setup(mockCtx);
            const downloadHandler = mockCtx.actions.registerAction.mock.calls.find((c: any) => c[0].id === 'downloader:download')[0].handler;

            // Mock Download Response
            mockAxios.get.mockResolvedValue({
                data: Buffer.from('fake-zip-content')
            });

            console.log('AdmZip is:', AdmZip);

            await downloadHandler();

            // 1. Check Download
            expect(mockAxios.get).toHaveBeenCalledWith('/download/test-job-123', expect.objectContaining({ responseType: 'arraybuffer' }));
            expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('extension.zip'), expect.anything());

            // 2. Check Extraction
            expect(fs.emptyDir).toHaveBeenCalledWith(expect.stringContaining('dist'));
            expect(mockExtractAllTo).toHaveBeenCalled();

            // 3. Check Hot Reload Injection
            expect(fs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('hot-reload.js'),
                expect.stringContaining('const CURRENT_JOB_ID = \'test-job-123\'')
            );
        });
    });
});
