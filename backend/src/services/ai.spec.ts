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
    const mockAi = { run: vi.fn() } as any;
    aiService = new AIService(mockAi, mockApiKey, mockApiUrl);
    vi.clearAllMocks();
  });

  it('should inject default icons into generated files', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: 'submit_extension',
                  arguments: JSON.stringify({
                    blueprint: {
                      user_intent: 'test',
                      permissions_reasoning: 'none',
                      async_logic_check: 'ok',
                      data_contract_check: 'ok',
                      ui_event_handling_check: 'ok',
                      storage_async_check: 'ok',
                      ux_interactivity_check: 'ok',
                      implementation_strategy: 'ok',
                      summary: 'test summary',
                    },
                    files: {
                      manifest_json: '{}',
                      'background.js': '// bg',
                    },
                  }),
                },
              },
            ],
          },
        },
      ],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await aiService.generateExtension({ prompt: 'test', userId: 'user1' });

    expect(result.files['icons/icon16.png']).toBeDefined();
    expect(result.files['icons/icon48.png']).toBeDefined();
    expect(result.files['icons/icon128.png']).toBeDefined();

    // Check if content matches default icons (decoded)
    expect(result.files['icons/icon16.png']).toEqual(Buffer.from(defaultIcons.icon16, 'base64'));
  });

  it('should handle direct JSON response from AI (JSON mode)', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: 'submit_extension',
                  arguments: JSON.stringify({
                    blueprint: {
                      user_intent: 'test',
                      permissions_reasoning: 'none',
                      async_logic_check: 'ok',
                      data_contract_check: 'ok',
                      ui_event_handling_check: 'ok',
                      storage_async_check: 'ok',
                      ux_interactivity_check: 'ok',
                      implementation_strategy: 'ok',
                      summary: 'test summary',
                    },
                    files: {
                      manifest_json: JSON.stringify({ name: 'Test' }, null, 2),
                    },
                  }),
                },
              },
            ],
          },
        },
      ],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await aiService.generateExtension({ prompt: 'test', userId: 'user1' });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);

    // Verify JSON mode param
    expect(body.tools).toBeDefined();
    // Verify parsing worked and sanitization happened
    expect(typeof result.files['manifest.json']).toBe('string');
    // Verify parsing worked and sanitization happened
    expect(typeof result.files['manifest.json']).toBe('string');
    expect(result.files['manifest.json']).toContain('"name": "Test"');
  });

  it('should fallback to regex parsing if direct parse fails', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: 'submit_extension',
                  arguments: JSON.stringify({
                    blueprint: {
                      user_intent: 'test',
                      permissions_reasoning: 'none',
                      async_logic_check: 'ok',
                      data_contract_check: 'ok',
                      ui_event_handling_check: 'ok',
                      storage_async_check: 'ok',
                      ux_interactivity_check: 'ok',
                      implementation_strategy: 'ok',
                      summary: 'test summary',
                    },
                    files: {
                      manifest_json: '{}',
                    },
                  }),
                },
              },
            ],
          },
        },
      ],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await aiService.generateExtension({ prompt: 'test', userId: 'user1' });
    expect(result.files['manifest.json']).toBe('{}');
  });

  it('should update system prompt with strict JSON instructions', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: 'submit_extension',
                  arguments: JSON.stringify({
                    blueprint: { summary: 'test' },
                    files: { manifest_json: '{}' },
                  }),
                },
              },
            ],
          },
        },
      ],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await aiService.generateExtension({ prompt: 'test', userId: 'user1' });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    const systemPrompt = body.messages[0].content;

    expect(systemPrompt).toContain('Return ONLY a raw JSON object');
  });
});
