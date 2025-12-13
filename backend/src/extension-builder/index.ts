import { Env } from '../job-processor/raindrop.gen';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/db';
import { createQueueAdapter } from '../config/queue';
import { ExtensionRules } from '../config/rules';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Cast to any since generated types aren't picking up mcp_service yet
    const mcp = (env as any).EXTENSION_BUILDER;

    // Tool: Generate Extension
    const GenerateSchema = z.object({
      prompt: z.string().describe('The user requirements for the extension'),
      userId: z
        .string()
        .optional()
        .describe('ID of the user (or agent) requesting generation. Defaults to "agent".'),
      template: z
        .enum(['basic-extension'])
        .optional()
        .default('basic-extension')
        .describe('The template ID to use for generation. Defaults to "basic-extension".'),
    });

    mcp.registerTool(
      'generate_extension',
      {
        title: 'Generate Extension',
        description:
          'Generate a browser extension based on a prompt. Returns a job ID to track progress.',
        inputSchema: GenerateSchema,
      },
      async (args: z.infer<typeof GenerateSchema>) => {
        const jobId = uuidv4();
        const userId = args.userId || 'agent';
        const timestamp = new Date().toISOString();
        const templateId = args.template;

        // 1. Create DB Entry
        const dbService = new DatabaseService(env.EXTENSION_DB);
        await dbService.createExtension({
          id: jobId,
          userId,
          prompt: args.prompt,
          timestamp,
        });

        // 2. Send to Queue
        // Cast env to any to verify GENERATION_QUEUE access
        const queueAdapter = createQueueAdapter((env as any).GENERATION_QUEUE);
        await queueAdapter.sendJob({
          jobId,
          userId,
          prompt: args.prompt,
          templateId,
          timestamp,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  jobId,
                  status: 'pending',
                  message:
                    'Extension generation started. Use check_status with jobId to track progress.',
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // Tool: Check Status
    const CheckStatusSchema = z.object({
      jobId: z.string().describe('The Job ID returned by generate_extension'),
    });

    mcp.registerTool(
      'check_status',
      {
        title: 'Check Job Status',
        description: 'Check the status of an extension generation job and retrieve the result URL.',
        inputSchema: CheckStatusSchema,
      },
      async (args: z.infer<typeof CheckStatusSchema>) => {
        const dbService = new DatabaseService(env.EXTENSION_DB);
        // We need a userId to query, but for agent use we might need to be flexible.
        // For now, assuming "agent" or checking if we can query without userId in service.
        // Using generic 'agent' ID for now as placeholder unless we pass it.
        const userId = 'agent';

        // Try to find the extension.
        // NOTE: In a real agent scenario, we might want a way to lookup by JobID regardless of user if the agent is admin.
        // But getExtension enforces userId.
        const extension = await dbService.getExtension(args.jobId, userId);

        if (!extension) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Job not found' }],
          };
        }

        let progressMessage = `Status: ${extension.status}`;
        if (extension.status === 'processing') progressMessage = 'Generating files...';
        if (extension.status === 'completed') progressMessage = 'Generation complete!';
        if (extension.status === 'failed') progressMessage = `Failed: ${extension.error}`;

        const result = {
          status: extension.status,
          progress_message: progressMessage,
          zipUrl: extension.zipKey ? `${env.FRONTEND_URL}/api/download/${args.jobId}` : undefined,
          errorMessage: extension.error,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
    );

    // Tool: Get Extension Best Practices
    const BestPracticesSchema = z.object({});

    mcp.registerTool(
      'get_extension_best_practices',
      {
        title: 'Get Extension Best Practices',
        description:
          'Returns essential rules and templates for building reliable Chrome Extensions (Manifest V3).',
        inputSchema: BestPracticesSchema,
      },
      async () => {
        return {
          content: [{ type: 'text', text: JSON.stringify(ExtensionRules, null, 2) }],
        };
      }
    );

    return new Response('MCP Service Active');
  },
};
