// Types for the application
export interface Extension {
  id: string;
  userId: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  zipKey?: string;
  parentId?: string;
  version?: string;
  name?: string;
  description?: string;
  summary?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface Blueprint {
  user_intent: string;
  permissions_reasoning: string;
  manifest_instructions: string;
  background_instructions: string;
  content_instructions?: string;
  popup_instructions: string;
  permissions: string[];
  implementation_strategy?: string;
  summary?: string;
  // Check fields
  async_logic_check?: string;
  data_contract_check?: string;
  ui_event_handling_check?: string;
  storage_async_check?: string;
  ux_interactivity_check?: string;
}

export interface Suggestion {
  label: string;
  description: string;
  prompt: string;
  complexity: 'simple' | 'moderate' | 'advanced';
  isAi?: boolean;
}

export interface GenerateRequest {
  prompt: string;
  userId?: string;
  parentId?: string;
  retryFromId?: string;
  contextFiles?: Record<string, string>;
  components?: string[];
  blueprint?: Blueprint;
}

export interface GenerateResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface HistoryResponse {
  extensions: Extension[];
  total: number;
}

// WorkOS Type Definitions
export interface Env {
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;
  WORKOS_COOKIE_PASSWORD: string;
  WORKOS_REDIRECT_URI: string;
  FRONTEND_URL: string;
  CEREBRAS_API_KEY: string;
  CEREBRAS_API_URL: string;
  EXTENSION_DB: any;
  EXTENSION_STORAGE: any;
  GENERATION_QUEUE: any;
  USER_CONTEXT: any;
}

export interface WorkOSUser {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOSAuthResponse {
  user: WorkOSUser;
  accessToken: string;
  refreshToken?: string;
}

export interface WorkOSSession {
  user: WorkOSUser;
  sessionId: string;
  organizationId?: string;
}

// Custom Error Classes
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class MissingEnvironmentVariableError extends Error {
  constructor(variableName: string) {
    super(`Required environment variable ${variableName} is not set`);
    this.name = 'MissingEnvironmentVariableError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AIGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AIGenerationError';
  }
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
