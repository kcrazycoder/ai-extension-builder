import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import { z } from 'zod';
import { PreviewConfig } from '../types.js';

export const ConfigPlugin: PluginDefinition<PreviewConfig> = {
    name: 'config',
    version: '1.0.0',
    dependencies: [],
    async setup(ctx: RuntimeContext<PreviewConfig>) {
        // 1. Define Schema
        const configSchema = z.object({
            host: z.string().url(),
            jobId: z.string().min(1, "Job ID is required"),
            token: z.string().optional(),
            user: z.string().optional(),
            workDir: z.string()
        });


        ctx.actions.registerAction({
            id: 'config:validate',
            handler: async () => {
                const config = ctx.config;
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

        // [NEW] Allow runtime config updates
        ctx.actions.registerAction({
            id: 'config:set',
            handler: async (payload: Partial<PreviewConfig>) => {
                ctx.getRuntime().updateConfig(payload);
                const config = ctx.config;
                // Validate after set? Optional, but good practice.
                try {
                    configSchema.parse(config);
                } catch (e) {
                    // Log but don't revert for now, trust the caller or add rollback logic if needed.
                    // Just warn for now
                    await ctx.actions.runAction('core:log', { level: 'warn', message: 'Config updated but validation failed. Some features may not work.' });
                }
                return config;
            }
        });
    }
};
