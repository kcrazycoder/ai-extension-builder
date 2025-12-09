// Request Validation Schemas using Zod
import { z } from 'zod';

// Generate Extension Request Schema
export const GenerateRequestSchema = z.object({
    prompt: z.string()
        .min(10, 'Prompt must be at least 10 characters')
        .max(2000, 'Prompt must not exceed 2000 characters')
        .trim(),
    userId: z.string().optional(), // Optional for backward compatibility
    parentId: z.string().uuid('Parent ID must be a valid UUID').optional()
});

export type GenerateRequestInput = z.infer<typeof GenerateRequestSchema>;

// Job ID Parameter Schema
export const JobIdSchema = z.string().uuid('Invalid job ID format');

// User ID Parameter Schema
export const UserIdSchema = z.string().min(1, 'User ID is required');

// Pagination Schema
export const PaginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
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
