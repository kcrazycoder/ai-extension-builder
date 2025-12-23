// API Client with proper authentication
import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { Extension, GenerateResponse, HistoryResponse, ApiError, JobStatusResponse, Suggestion, UserStats, User, AdminStats } from './types';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3000/auth';

class ApiClient {
    private client: AxiosInstance;
    private token: string | null = null;
    private userId: string | null = null;

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            timeout: 30000, // 30 second timeout
        });

        // Add request interceptor to include auth headers
        this.client.interceptors.request.use((config) => {
            if (this.token) {
                config.headers.Authorization = `Bearer ${this.token}`;
            }
            if (this.userId) {
                config.headers['X-User-Id'] = this.userId;
            }
            return config;
        });

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError<ApiError>) => {
                if (error.response?.status === 401) {
                    // Token expired or invalid - clear user
                    this.setAuth(null, null);
                    window.dispatchEvent(new CustomEvent('auth:logout'));
                }
                return Promise.reject(error);
            }
        );
    }

    setAuth(token: string | null, userId: string | null) {
        this.token = token;
        this.userId = userId;
    }

    setToken(token: string | null) {
        this.token = token;
    }

    async generateExtension(prompt: string, parentId?: string, retryFromId?: string): Promise<GenerateResponse> {
        const response = await this.client.post<GenerateResponse>('/generate', { prompt, parentId, retryFromId });
        return response.data;
    }

    async getJobStatus(jobId: string): Promise<JobStatusResponse> {
        const response = await this.client.get<JobStatusResponse>(`/jobs/${jobId}`);
        return response.data;
    }

    getHistory(): Promise<Extension[]> {
        return this.client.get<HistoryResponse>('/history').then(response =>
            response.data.extensions.map((ext) => ({
                ...ext,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                createdAt: ext.createdAt || (ext as any).created_at || (ext as any).completedAt || new Date().toISOString()
            }))
        );
    }

    async getSuggestions(): Promise<Suggestion[]> {
        const response = await this.client.get<{ success: boolean, suggestions: Suggestion[] }>('/suggestions');
        return response.data.suggestions;
    }

    async getUserStats(): Promise<UserStats> {
        const response = await this.client.get<{
            success: boolean,
            stats: UserStats,
            tier: 'free' | 'pro',
            dailyUsage: number,
            limit: number,
            subscriptionStatus?: 'active' | 'canceled' | 'past_due',
            nextBillingDate?: string
        }>('/user/stats');

        return {
            ...response.data.stats,
            tier: response.data.tier,
            dailyUsage: response.data.dailyUsage,
            limit: response.data.limit,
            subscriptionStatus: response.data.subscriptionStatus,
            nextBillingDate: response.data.nextBillingDate
        };
    }

    async deleteConversation(id: string): Promise<void> {
        await this.client.delete(`/conversations/${id}`);
    }

    getDownloadUrl(jobId: string): string {
        return `${API_URL}/download/${jobId}`;
    }

    // For authenticated downloads, we need to handle it differently
    async downloadExtension(jobId: string): Promise<{ blob: Blob, filename: string | null }> {
        // Add timestamp to bypass browser CORS preflight cache
        const response = await this.client.get(`/download/${jobId}?t=${Date.now()}`, {
            responseType: 'blob',
        });

        console.log('Download Headers:', response.headers);

        let filename: string | null = null;
        const disposition = response.headers['content-disposition'];
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        return { blob: response.data, filename };
    }
    async createCheckoutSession(): Promise<{ url: string }> {
        const response = await this.client.post<{ url: string }>('/create-checkout-session');
        return response.data;
    }

    async verifyPaymentSession(sessionId: string): Promise<{ status: string, paymentStatus: string, verified: boolean }> {
        const response = await this.client.get<{ status: string, paymentStatus: string, verified: boolean }>(`/payment/verify/${sessionId}`);
        return response.data;
    }

    async linkPreview(code: string, jobId: string): Promise<{ success: boolean, error?: string }> {
        try {
            const response = await this.client.post<{ success: boolean, error?: string }>('/preview/link', { code, jobId });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.data) {
                const data = error.response.data as { error?: string };
                throw new Error(data.error || 'Failed to link preview');
            }
            throw error;
        }
    }

    // Admin Methods
    async getSystemStats(): Promise<AdminStats> {
        const response = await this.client.get<{ success: boolean, stats: AdminStats }>('/admin/stats');
        return response.data.stats;
    }

    async getAllUsers(limit: number = 50, offset: number = 0): Promise<User[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await this.client.get<{ success: boolean, users: any[] }>('/admin/users', {
            params: { limit, offset }
        });
        // Map created_at to createdAt
        return response.data.users.map(user => ({
            ...user,
            createdAt: user.created_at || user.createdAt
        }));
    }

    async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
        await this.client.put(`/admin/users/${userId}/role`, { role });
    }
}

export const apiClient = new ApiClient();

// Auth URLs
export const getLoginUrl = () => `${AUTH_URL}/login`;

// Error message extractor
export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError | undefined;
        return apiError?.message || apiError?.error || error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
}
