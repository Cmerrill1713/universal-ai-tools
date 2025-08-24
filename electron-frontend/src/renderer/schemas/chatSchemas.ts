/**
 * Zod validation schemas for chat and messaging features
 * Provides comprehensive input validation and sanitization
 */

import { z } from 'zod';

// Constants for validation
const MAX_MESSAGE_LENGTH = 10000;
const MAX_AGENT_NAME_LENGTH = 100;
const MAX_TASK_TITLE_LENGTH = 200;
const MAX_TASK_DESCRIPTION_LENGTH = 1000;

/**
 * Chat message input validation schema
 * Ensures messages are properly formatted and within limits
 */
export const chatMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(MAX_MESSAGE_LENGTH, `Message must be less than ${MAX_MESSAGE_LENGTH} characters`)
    .transform(val => {
      // Remove excessive whitespace while preserving intentional formatting
      return val.replace(/\s+/g, ' ').trim();
    }),
  agentId: z.string().optional(),
  metadata: z
    .object({
      timestamp: z.date().optional(),
      edited: z.boolean().optional(),
      attachments: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Agent selection validation schema
 */
export const agentSelectionSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  agentName: z
    .string()
    .max(MAX_AGENT_NAME_LENGTH, `Agent name must be less than ${MAX_AGENT_NAME_LENGTH} characters`),
  capabilities: z.array(z.string()).optional(),
});

/**
 * Task creation validation schema
 */
export const taskCreationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required')
    .max(MAX_TASK_TITLE_LENGTH, `Title must be less than ${MAX_TASK_TITLE_LENGTH} characters`),
  description: z
    .string()
    .trim()
    .max(
      MAX_TASK_DESCRIPTION_LENGTH,
      `Description must be less than ${MAX_TASK_DESCRIPTION_LENGTH} characters`
    )
    .optional(),
  agentId: z.string().min(1, 'Agent selection is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  estimatedDuration: z.number().positive().optional(),
});

/**
 * Search query validation schema
 */
export const searchQuerySchema = z
  .string()
  .trim()
  .max(200, 'Search query is too long')
  .transform(val => {
    // Remove potential XSS attempts
    return val.replace(/<[^>]*>/g, '');
  });

/**
 * Settings update validation schema
 */
export const settingsUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  apiEndpoint: z.string().url('Must be a valid URL').optional(),
  maxTokens: z.number().int().positive().max(100000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  autoSave: z.boolean().optional(),
  notifications: z.boolean().optional(),
});

/**
 * File upload validation schema
 */
export const fileUploadSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  size: z
    .number()
    .positive()
    .max(50 * 1024 * 1024, 'File size must be less than 50MB'),
  type: z.string().regex(/^[a-zA-Z0-9]+\/[a-zA-Z0-9\-+.]+$/, 'Invalid MIME type'),
  content: z.instanceof(ArrayBuffer).optional(),
});

/**
 * Batch message validation for multiple messages
 */
export const batchMessageSchema = z.array(chatMessageSchema).max(100, 'Too many messages in batch');

/**
 * Voice input transcription schema
 */
export const voiceTranscriptionSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(1, 'Transcript cannot be empty')
    .max(MAX_MESSAGE_LENGTH, 'Transcript is too long'),
  confidence: z.number().min(0).max(1).optional(),
  language: z.string().optional(),
  duration: z.number().positive().optional(),
});

/**
 * Helper function to validate chat input
 */
export function validateChatInput(input: unknown): {
  success: boolean;
  data?: z.infer<typeof chatMessageSchema>;
  error?: string;
} {
  try {
    const validated = chatMessageSchema.parse(input);
    return { success: true, data: validated };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return {
        success: false,
        _error: _error.errors.map(_e => _e.message).join(', '),
      };
    }
    return { success: false, _error: 'Invalid input' };
  }
}

/**
 * Helper function to validate search queries
 */
export function validateSearchQuery(query: unknown): string {
  try {
    return searchQuerySchema.parse(query);
  } catch {
    return '';
  }
}

/**
 * Helper function to sanitize user input for display
 */
export function sanitizeForDisplay(text: string): string {
  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');

  // Remove script tags more aggressively
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Escape remaining HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return sanitized;
}

// Export all schemas
export default {
  chatMessageSchema,
  agentSelectionSchema,
  taskCreationSchema,
  searchQuerySchema,
  settingsUpdateSchema,
  fileUploadSchema,
  batchMessageSchema,
  voiceTranscriptionSchema,
  validateChatInput,
  validateSearchQuery,
  sanitizeForDisplay,
};
