import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from './ai';
import { defaultIcons } from '../config/defaultIcons';

// Mock global fetch
global.fetch = vi.fn();

describe('AIService', () => {
    let aiService: AIService;
    const mockApiKey = 'test-key';
    const mockApiUrl = 'https://api.test.com';

    beforeEach(() => {
        aiService = new AIService(mockApiKey, mockApiUrl);
        vi.clearAllMocks();
    });

    it('should inject default icons into generated files', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        'manifest.json': '{}',
                        'background.js': '// bg'
                    })
                }
            }]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const result = await aiService.generateExtension({ prompt: 'test', userId: 'user1' });

        expect(result['icons/icon16.png']).toBeDefined();
        expect(result['icons/icon48.png']).toBeDefined();
        expect(result['icons/icon128.png']).toBeDefined();

        // Check if content matches default icons (decoded)
        expect(result['icons/icon16.png']).toEqual(Buffer.from(defaultIcons.icon16, 'base64'));
    });

    it('should handle direct JSON response from AI (JSON mode)', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        'manifest.json': { name: 'Test' }
                    })
                }
            }]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const result = await aiService.generateExtension({ prompt: 'test', userId: 'user1' });

        const fetchCall = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);

        // Verify JSON mode param
        expect(body.response_format).toEqual({ type: 'json_object' });
        // Verify parsing worked and sanitization happened
        expect(typeof result['manifest.json']).toBe('string');
        expect(result['manifest.json']).toContain('"name": "Test"');
    });

    it('should fallback to regex parsing if direct parse fails', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '```json\n' + JSON.stringify({ 'manifest.json': '{}' }) + '\n```'
                }
            }]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const result = await aiService.generateExtension({ prompt: 'test', userId: 'user1' });
        expect(result['manifest.json']).toBe('{}');
    });

    it('should update system prompt with strict JSON instructions', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({ 'manifest.json': '{}' })
                }
            }]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        await aiService.generateExtension({ prompt: 'test', userId: 'user1' });

        const fetchCall = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        const systemPrompt = body.messages[0].content;

        expect(systemPrompt).toContain('Return ONLY a raw JSON object');
        expect(systemPrompt).toContain('Ensure strict JSON compliance');
    });
});
