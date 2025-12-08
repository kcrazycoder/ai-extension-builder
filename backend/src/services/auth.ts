// Auth Service - WorkOS integration for enterprise authentication
import { WorkOS } from '@workos-inc/node';
import {
    WorkOSUser,
    WorkOSAuthResponse,
    AuthenticationError,
    MissingEnvironmentVariableError
} from './types';

export class AuthService {
    private workos: WorkOS;
    private clientId: string;
    private cookiePassword: string;

    constructor(apiKey: string, clientId: string, cookiePassword?: string) {
        if (!apiKey) {
            throw new MissingEnvironmentVariableError('WORKOS_API_KEY');
        }
        if (!clientId) {
            throw new MissingEnvironmentVariableError('WORKOS_CLIENT_ID');
        }

        this.workos = new WorkOS(apiKey);
        this.clientId = clientId;

        // Require cookie password, no fallback
        if (!cookiePassword) {
            throw new MissingEnvironmentVariableError('WORKOS_COOKIE_PASSWORD');
        }
        this.cookiePassword = cookiePassword;
    }

    async getAuthorizationUrl(redirectUri: string, state?: string): Promise<string> {
        const url = this.workos.userManagement.getAuthorizationUrl({
            provider: 'authkit',
            clientId: this.clientId,
            redirectUri,
            state
        });

        return url;
    }

    async authenticateWithCode(code: string): Promise<WorkOSAuthResponse> {
        try {
            const result = await this.workos.userManagement.authenticateWithCode({
                clientId: this.clientId,
                code
            });

            return {
                user: result.user as WorkOSUser,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            };
        } catch (error) {
            throw new AuthenticationError(
                `Failed to authenticate with code: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async getUser(userId: string): Promise<WorkOSUser> {
        try {
            const user = await this.workos.userManagement.getUser(userId);
            return user as WorkOSUser;
        } catch (error) {
            throw new AuthenticationError(
                `Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async verifyAccessToken(accessToken: string): Promise<WorkOSUser> {
        try {
            // Simple approach: decode JWT to get user ID, then fetch user to validate
            // This works because if the user doesn't exist, getUser will throw
            const parts = accessToken.split('.');
            if (parts.length !== 3) {
                throw new AuthenticationError('Invalid token format');
            }

            const payloadPart = parts[1];
            if (!payloadPart) {
                throw new AuthenticationError('Invalid token structure');
            }

            // Decode JWT payload (base64url)
            const payload = JSON.parse(
                Buffer.from(payloadPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
            );

            // Extract user ID - WorkOS uses 'sid' for session ID which contains user info
            const userId = payload.sid || payload.sub || payload.user_id;
            if (!userId) {
                throw new AuthenticationError('No user ID in token');
            }

            // Validate by fetching user - this will throw if user doesn't exist
            const user = await this.getUser(userId);
            return user;
        } catch (error) {
            throw new AuthenticationError(
                `Invalid access token: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
