
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService, ExtensionFiles } from './ai';
import { Blueprint } from './types';

// Mock global fetch
global.fetch = vi.fn();

describe('AIService - Structured Blueprint Strategy', () => {
    let aiService: AIService;
    const mockApiKey = 'test-key';
    const mockApiUrl = 'https://api.test.com';

    beforeEach(() => {
        const mockAi = { run: vi.fn() } as any;
        aiService = new AIService(mockAi, mockApiKey, mockApiUrl);
        vi.clearAllMocks();
    });

    const mockBlueprint: Blueprint = {
        user_intent: 'Create a pomodoro timer',
        permissions_reasoning: 'Need alarms for timer',
        permissions: ['alarms', 'storage'],
        manifest_instructions: 'Use MV3',
        background_instructions: 'Listen for alarm',
        popup_instructions: 'Show timer',
    };

    it('should generate a blueprint using the correct model', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    tool_calls: [{
                        function: {
                            name: 'submit_blueprint',
                            arguments: JSON.stringify(mockBlueprint)
                        }
                    }]
                }
            }]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const blueprint = await aiService.generateBlueprint('test prompt');

        expect(blueprint).toEqual(mockBlueprint);

        // Verify proper model usage (qwen-3-32b for smarts)
        const fetchCall = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        expect(body.model).toBe('qwen-3-32b');
    });

    it('should inject blueprint instructions into system prompt during extension generation', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    tool_calls: [{
                        function: {
                            name: 'submit_extension',
                            arguments: JSON.stringify({
                                blueprint: { summary: 'done' },
                                files: { 'manifest_json': '{}' }
                            })
                        }
                    }]
                }
            }]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        await aiService.generateExtension({
            prompt: 'test',
            userId: 'user1',
            blueprint: mockBlueprint
        });

        const fetchCall = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        const systemPrompt = body.messages[0].content;

        expect(systemPrompt).toContain('--- ARCHITECTURAL BLUEPRINT (STRICT ADHERENCE REQUIRED) ---');
        expect(systemPrompt).toContain('PERMISSIONS ALLOWED: ["alarms","storage"]');
        expect(systemPrompt).toContain('1. MANIFEST: Use MV3');
    });

});
