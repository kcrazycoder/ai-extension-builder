// Request Validation Schemas using Zod
import { z } from 'zod';

// Blueprint Schema (Structure of the architectural plan)
export const BlueprintSchema = z.object({
  user_intent: z.string(),
  permissions_reasoning: z.string(),
  permissions: z.array(z.string()),
  manifest_instructions: z.string(),
  background_instructions: z.string(),
  content_instructions: z.string().nullable().optional(),
  popup_instructions: z.string(),
  implementation_strategy: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  // Check fields
  async_logic_check: z.string().nullable().optional(),
  data_contract_check: z.string().nullable().optional(),
  ui_event_handling_check: z.string().nullable().optional(),
  storage_async_check: z.string().nullable().optional(),
  ux_interactivity_check: z.string().nullable().optional(),
});

// Generate Extension Request Schema
export const GenerateRequestSchema = z.object({
  prompt: z
    .string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(2000, 'Prompt must not exceed 2000 characters')
    .trim(),
  userId: z.string().optional(), // Optional for backward compatibility
  parentId: z.string().uuid('Parent ID must be a valid UUID').optional(),
  retryFromId: z.string().uuid('Retry ID must be a valid UUID').optional(),
  contextFiles: z.record(z.string()).optional(),
  components: z.array(z.string()).optional(),
  blueprint: BlueprintSchema.optional(),
});

// Blueprint Generation Request (Simpler)
export const BlueprintRequestSchema = z.object({
  prompt: z.string().min(10).max(2000),
  contextFiles: z.record(z.string()).optional(),
});

export type GenerateRequestInput = z.infer<typeof GenerateRequestSchema>;

// Job ID Parameter Schema
export const JobIdSchema = z.string().uuid('Invalid job ID format');

// User ID Parameter Schema
export const UserIdSchema = z.string().min(1, 'User ID is required');

// Pagination Schema
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

/**
 * Validate request body against schema
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe validation that returns result with error
 */
export function safeValidateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
