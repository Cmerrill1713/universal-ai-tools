import { z } from 'zod';

// Example endpoint schemas; extend per route
export const ExecuteAgentRequest = z.object({
  agentName: z.string().min(1),
  userRequest: z.string().min(1),
  context: z.record(z.any()).optional(),
});

export const ExecuteAgentResponse = z.object({
  success: z.boolean(),
  data: z.any(),
  metadata: z.object({
    timestamp: z.string(),
    requestId: z.string(),
    agentName: z.string(),
  }),
});
