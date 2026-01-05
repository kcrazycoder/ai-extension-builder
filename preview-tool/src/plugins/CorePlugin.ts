import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import chalk from 'chalk';
import { PreviewConfig } from '../types.js';

export const CorePlugin: PluginDefinition<PreviewConfig> = {
    name: 'core',
    version: '1.0.0',
    setup(ctx: RuntimeContext<PreviewConfig>) {
        console.log('CorePlugin: setup called');
        const config = ctx.config;

        ctx.actions.registerAction({
            id: 'core:config',
            handler: async () => config
        });

        console.log('CorePlugin: Registering core:log');
        ctx.actions.registerAction({
            id: 'core:log',
            handler: async (payload: { level: 'info' | 'error' | 'success' | 'warn', message: string }) => {
                // Access default logger from Runtime
                const logger = ctx.logger;

                const { level, message } = payload;

                switch (level) {
                    case 'error':
                        logger.error(chalk.red(message));
                        break;
                    case 'warn':
                        logger.warn(chalk.yellow(message));
                        break;
                    case 'success':
                        // Default logger usually has info/warn/error/debug. Map success to info (green)
                        logger.info(chalk.green(message));
                        break;
                    default:
                        logger.info(message);
                        break;
                }

                // Emit event for UI
                ctx.events.emit('log', { level, message, timestamp: new Date().toISOString() });

                return true;
            }
        });
    }
};
