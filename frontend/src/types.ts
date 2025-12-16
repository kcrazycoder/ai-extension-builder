// Type Definitions for Frontend
export interface Extension {
    id: string;
    prompt: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    zip_key?: string;
    parentId?: string;
    version?: string;
    error?: string;
    created_at: string;
    createdAt?: string;
    jobId?: string; // Added for tracking
    summary?: string;
    name?: string;
    description?: string;
    queue_position?: number;
    estimated_wait_seconds?: number;
}

export interface Suggestion {
    label: string;
    prompt: string;
    isAi?: boolean;
}

export interface User {
    id: string;
    email: string;
}

export interface UserStats {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    totalTokens: number;
    activity?: { date: string; count: number }[];
    tier?: 'free' | 'pro';
    dailyUsage?: number;
    limit?: number;
    subscriptionStatus?: 'active' | 'canceled' | 'past_due' | null;
    nextBillingDate?: string | null;
}

export interface ApiError {
    error: string;
    message?: string;
    details?: unknown;
}

export interface GenerateResponse {
    success: boolean;
    jobId: string;
    message: string;
    status: string;
}

export interface HistoryResponse {
    success: boolean;
    extensions: Extension[];
}

export interface JobStatusResponse {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
    progress_message?: string; // Added for streaming status
    extensionId?: string; // Logic in App.tsx relies on this
    queue_position?: number;
    estimated_wait_seconds?: number;
}

// Validation constants
export const PROMPT_MIN_LENGTH = 10;
export const PROMPT_MAX_LENGTH = 2000;

// Validation helpers
export function validatePrompt(prompt: string): { valid: boolean; error?: string } {
    const trimmed = prompt.trim();

    if (trimmed.length < PROMPT_MIN_LENGTH) {
        return { valid: false, error: `Prompt must be at least ${PROMPT_MIN_LENGTH} characters` };
    }

    if (trimmed.length > PROMPT_MAX_LENGTH) {
        return { valid: false, error: `Prompt must not exceed ${PROMPT_MAX_LENGTH} characters` };
    }

    return { valid: true };
}

// LocalStorage helpers
export function saveUser(user: User): void {
    try {
        localStorage.setItem('user', JSON.stringify(user));
    } catch (error) {
        console.error('Failed to save user to localStorage:', error);
    }
}

export function loadUser(): User | null {
    try {
        const stored = localStorage.getItem('user');
        if (!stored) return null;

        const parsed = JSON.parse(stored);

        if (!parsed.id || !parsed.email) {
            return null;
        }

        return parsed as User;
    } catch (error) {
        console.error('Failed to load user from localStorage:', error);
        return null;
    }
}

export function clearUser(): void {
    try {
        localStorage.removeItem('user');
    } catch (error) {
        console.error('Failed to clear user from localStorage:', error);
    }
}
