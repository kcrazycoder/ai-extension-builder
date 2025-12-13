import { describe, it, expect, vi, beforeEach } from 'vitest';
import mcpHandler from './index';

// Define mocks using vi.hoisted to allow usage in vi.mock
const mocks = vi.hoisted(() => ({
  createExtension: vi.fn(),
  getExtension: vi.fn(),
  sendJob: vi.fn(),
}));

// Mock DB Service
vi.mock('../services/db', () => ({
  DatabaseService: vi.fn().mockImplementation(() => ({
    createExtension: mocks.createExtension,
    getExtension: mocks.getExtension,
  })),
}));

// Mock Queue Adapter
vi.mock('../config/queue', () => ({
  createQueueAdapter: vi.fn().mockReturnValue({
    sendJob: mocks.sendJob,
  }),
}));

describe('MCP Service', () => {
  let mockEnv: any;
  let mockRegisterTool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisterTool = vi.fn((name, config, callback) => ({ callback }));
    mockEnv = {
      EXTENSION_BUILDER: {
        registerTool: mockRegisterTool,
      },
      EXTENSION_DB: {},
      GENERATION_QUEUE: {},
      FRONTEND_URL: 'https://test.com',
    };
  });

  it('should register tools', async () => {
    await mcpHandler.fetch(new Request('http://localhost'), mockEnv);

    expect(mockRegisterTool).toHaveBeenCalledWith(
      'generate_extension',
      expect.objectContaining({ title: 'Generate Extension' }),
      expect.any(Function)
    );
    expect(mockRegisterTool).toHaveBeenCalledWith(
      'check_status',
      expect.objectContaining({ title: 'Check Job Status' }),
      expect.any(Function)
    );
  });

  it('should handle generate_extension tool call', async () => {
    await mcpHandler.fetch(new Request('http://localhost'), mockEnv);

    const generateCallback = mockRegisterTool.mock.calls.find(
      (call: any) => call[0] === 'generate_extension'
    )![2];
    const result = await generateCallback({
      prompt: 'Create a dark mode extension',
      userId: 'user1',
    });

    // Verify DB entry created
    expect(mocks.createExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user1',
        prompt: 'Create a dark mode extension',
      })
    );

    // Verify Job sent to Queue
    expect(mocks.sendJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user1',
        prompt: 'Create a dark mode extension',
      })
    );

    const content = JSON.parse(result.content[0].text);
    expect(content.status).toBe('pending');
    expect(content.jobId).toBeDefined();
  });

  it('should handle check_status tool call', async () => {
    await mcpHandler.fetch(new Request('http://localhost'), mockEnv);

    mocks.getExtension.mockResolvedValue({
      id: 'job-123',
      status: 'completed',
      zipKey: 'extensions/job-123.zip',
    });

    const statusCallback = mockRegisterTool.mock.calls.find(
      (call: any) => call[0] === 'check_status'
    )![2];
    const result = await statusCallback({ jobId: 'job-123' });

    const content = JSON.parse(result.content[0].text);
    expect(content.status).toBe('completed');
    expect(content.zipUrl).toBe('https://test.com/api/download/job-123');
    expect(content.progress_message).toBe('Generation complete!');
  });
});
