import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import { z } from 'zod';
import { PreviewConfig } from '../types.js';

export const ConfigPlugin: PluginDefinition = {
    name: 'config',
    version: '1.0.0',
    async setup(ctx: RuntimeContext) {
        // 1. Define Schema
        const configSchema = z.object({
            host: z.string().url(),
            jobId: z.string().min(1, "Job ID is required"),
            token: z.string().optional(),
            user: z.string().optional(),
            workDir: z.string()
        });

        // 2. Register Actions
        ctx.actions.registerAction({
            id: 'config:get',
            handler: async (key: keyof PreviewConfig) => {
                const config = (ctx as any).host.config as PreviewConfig;
                if (!config) {
                    throw new Error('Configuration not initialized');
                }
                return config[key];
            }
        });

        ctx.actions.registerAction({
            id: 'config:validate',
            handler: async () => {
                const config = (ctx as any).host.config;
                try {
                    configSchema.parse(config);
                    return true;
                } catch (error) {
                    if (error instanceof z.ZodError) {
                        const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                        await ctx.actions.runAction('core:log', { level: 'error', message: `Config Validation Failed: ${issues}` });
                    }
                    throw error;
                }
            }
        });
    }
};
