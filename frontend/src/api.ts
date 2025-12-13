// API Client with proper authentication
import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { Extension, GenerateResponse, HistoryResponse, ApiError, JobStatusResponse, Suggestion, UserStats } from './types';

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

    async getHistory(): Promise<Extension[]> {
        const response = await this.client.get<HistoryResponse>('/history');
        return response.data.extensions;
    }

    async getSuggestions(): Promise<Suggestion[]> {
        const response = await this.client.get<{ success: boolean, suggestions: Suggestion[] }>('/suggestions');
        return response.data.suggestions;
    }

    async getUserStats(): Promise<UserStats> {
        const response = await this.client.get<{ success: boolean, stats: UserStats }>('/user/stats');
        return response.data.stats;
    }

    async deleteConversation(id: string): Promise<void> {
        await this.client.delete(`/conversations/${id}`);
    }

    getDownloadUrl(jobId: string): string {
        return `${API_URL}/download/${jobId}`;
    }

    // For authenticated downloads, we need to handle it differently
    async downloadExtension(jobId: string): Promise<Blob> {
        const response = await this.client.get(`/download/${jobId}`, {
            responseType: 'blob',
        });
        return response.data;
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
