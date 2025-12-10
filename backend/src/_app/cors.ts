import { createCorsHandler } from '@liquidmetal-ai/raindrop-framework/core/cors';

/**
 * cors is the application-wide CORS (Cross-Origin Resource Sharing) handler.
 *
 * This handler is automatically applied to all HTTP services in your application.
 * You can override this per-handler by exporting a `cors` function from your handler.
 *
 * **Default Behavior (Secure):**
 * We use dynamic origin validation to allow requests from the frontend and local dev ports.
 */
export const cors = createCorsHandler({
    origin: (request: Request, env: any) => {
        const origin = request.headers.get('origin');
        // Allow no origin (e.g. server-to-server or non-browser requests)
        if (!origin) return null;

        // Common local development ports
        const localOrigins = [
            'http://localhost:5173',
            'http://localhost:4173',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:4173',
            'http://127.0.0.1:3000'
        ];

        if (localOrigins.includes(origin)) return origin;

        // Check against environment variables
        const frontendUrl = env.FRONTEND_URL;
        if (frontendUrl && origin === frontendUrl) return origin;

        const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || [];
        if (allowedOrigins.includes(origin)) return origin;

        return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
    exposeHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
    credentials: true,
    maxAge: 86400 // Cache preflight for 24 hours
});
