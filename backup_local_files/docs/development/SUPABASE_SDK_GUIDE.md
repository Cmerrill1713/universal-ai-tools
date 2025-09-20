# Supabase TypeScript SDK Guide for AI Agents
This guide provides comprehensive documentation for AI agents working with the Supabase TypeScript SDK in the Universal AI Tools project.
## Table of Contents

- [Quick Reference](#quick-reference)

- [Common Patterns](#common-patterns)

- [Agent-Specific Use Cases](#agent-specific-use-cases)

- [Error Handling](#error-handling)

- [Best Practices](#best-practices)
## Quick Reference
### Import the SDK Reference

```typescript

import { SupabaseSDKReference } from '../services/supabase-typescript-sdk-reference';

```
### Initialize Supabase Client

```typescript

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(

  process.env.SUPABASE_URL!,

  process.env.SUPABASE_ANON_KEY!

);

```
## Common Patterns
### 1. Storing Agent Memory

```typescript

// Store a memory with embedding

const { data, error } = await supabase

  .from('agent_memories')

  .insert({

    agent_id: 'agent-123',

    content: 'Learned about TypeScript patterns',

    embedding: embedVector, // 1536-dimensional array

    metadata: {

      category: 'learning',

      importance: 0.9,

      timestamp: new Date().toISOString()

    }

  })

  .select();

```
### 2. Retrieving Relevant Memories

```typescript

// Search for similar memories using vector similarity

const { data, error } = await supabase.rpc('match_agent_memories', {

  query_embedding: queryVector,

  match_threshold: 0.7,

  match_count: 10,

  agent_id: 'agent-123'

});

```
### 3. Real-time Agent Coordination

```typescript

// Subscribe to agent status changes

const channel = supabase

  .channel('agent-coordination')

  .on(

    'postgres_changes',

    {

      event: '*',

      schema: 'public',

      table: 'agents',

      filter: 'status=eq.active'

    },

    (payload) => {

      console.log('Agent status changed:', payload);

      // Coordinate with other agents

    }

  )

  .subscribe();

```
### 4. Storing Agent Logs

```typescript

// Log agent activities

const { error } = await supabase

  .from('agent_logs')

  .insert({

    agent_id: 'agent-123',

    event_type: 'task_completed',

    details: {

      task: 'code_analysis',

      duration_ms: 1500,

      success: true

    },

    timestamp: new Date().toISOString()

  });

```
## Agent-Specific Use Cases
### Self-Healing Agent

```typescript

// Report and track issues

const reportIssue = async (issue: AgentIssue) => {

  const { data, error } = await supabase

    .from('agent_issues')

    .insert({

      agent_id: issue.agentId,

      type: issue.type,

      severity: issue.severity,

      description: issue.description,

      context: issue.context,

      resolved: false

    })

    .select();

    

  return data;

};
// Track healing actions

const trackHealingAction = async (issueId: string, action: string, success: boolean) => {

  const { error } = await supabase

    .from('healing_actions')

    .insert({

      issue_id: issueId,

      action_type: action,

      success,

      timestamp: new Date().toISOString()

    });

};

```
### Resource Manager Agent

```typescript

// Monitor resource usage

const updateResourceMetrics = async (agentId: string, metrics: ResourceMetrics) => {

  const { error } = await supabase

    .from('resource_metrics')

    .insert({

      agent_id: agentId,

      cpu_usage: metrics.cpu,

      memory_usage: metrics.memory,

      active_connections: metrics.connections,

      timestamp: new Date().toISOString()

    });

};
// Get resource allocation

const getResourceAllocation = async (agentId: string) => {

  const { data, error } = await supabase

    .from('resource_allocations')

    .select('*')

    .eq('agent_id', agentId)

    .single();

    

  return data;

};

```
### Memory Coordinator

```typescript

// Store contextual memory

const storeContextualMemory = async (context: MemoryContext) => {

  const { data, error } = await supabase

    .from('contextual_memories')

    .insert({

      user_id: context.userId,

      session_id: context.sessionId,

      content: context.content,

      embedding: context.embedding,

      metadata: {

        intent: context.intent,

        entities: context.entities,

        sentiment: context.sentiment

      }

    })

    .select();

};
// Retrieve conversation history

const getConversationHistory = async (sessionId: string, limit = 50) => {

  const { data, error } = await supabase

    .from('conversations')

    .select('*')

    .eq('session_id', sessionId)

    .order('created_at', { ascending: false })

    .limit(limit);

    

  return data;

};

```
## Error Handling
### Comprehensive Error Handling Pattern

```typescript

const safeSupabaseOperation = async <T>(

  operation: () => Promise<{ data: T | null; error: any }>

): Promise<T | null> => {

  try {

    const { data, error } = await operation();

    

    if (error) {

      // Log to Supabase error tracking

      await supabase.from('error_logs').insert({

        error_code: error.code,

        error_message: error.message,

        context: {

          hint: error.hint,

          details: error.details

        },

        timestamp: new Date().toISOString()

      });

      

      // Handle specific error codes

      switch (error.code) {

        case 'PGRST116':

          console.error('No rows returned');

          break;

        case '23505':

          console.error('Duplicate key violation');

          break;

        default:

          console.error('Database error:', error);

      }

      

      return null;

    }

    

    return data;

  } catch (err) {

    console.error('Unexpected error:', err);

    return null;

  }

};

```
### Retry with Exponential Backoff

```typescript

const retryWithBackoff = async <T>(

  operation: () => Promise<T>,

  maxRetries = 3,

  baseDelay = 1000

): Promise<T> => {

  for (let attempt = 0; attempt < maxRetries; attempt++) {

    try {

      return await operation();

    } catch (error) {

      if (attempt === maxRetries - 1) throw error;

      

      const delay = baseDelay * Math.pow(2, attempt);

      await new Promise(resolve => setTimeout(resolve, delay));

    }

  }

  throw new Error('Max retries exceeded');

};

```
## Best Practices
### 1. Connection Management

```typescript

// Create a singleton instance

class SupabaseManager {

  private static instance: SupabaseClient;

  

  static getInstance(): SupabaseClient {

    if (!this.instance) {

      this.instance = createClient(

        process.env.SUPABASE_URL!,

        process.env.SUPABASE_ANON_KEY!,

        {

          auth: {

            autoRefreshToken: true,

            persistSession: true

          }

        }

      );

    }

    return this.instance;

  }

}

```
### 2. Batch Operations

```typescript

// Batch insert for performance

const batchInsert = async (records: any[], tableName: string, batchSize = 100) => {

  const results = [];

  

  for (let i = 0; i < records.length; i += batchSize) {

    const batch = records.slice(i, i + batchSize);

    const { data, error } = await supabase

      .from(tableName)

      .insert(batch)

      .select();

      

    if (error) throw error;

    results.push(...(data || []));

  }

  

  return results;

};

```
### 3. Optimize Queries

```typescript

// Use select with specific columns

const optimizedQuery = async () => {

  const { data, error } = await supabase

    .from('agents')

    .select('id, name, status') // Only select needed columns

    .eq('status', 'active')

    .limit(10); // Always limit results

};
// Use RPC for complex queries

const complexQuery = async () => {

  const { data, error } = await supabase

    .rpc('get_agent_performance_stats', {

      time_range: '7d',

      min_score: 0.8

    });

};

```
### 4. Handle Realtime Subscriptions

```typescript

class RealtimeManager {

  private channels: Map<string, any> = new Map();

  

  subscribe(channelName: string, config: any, callback: (payload: any) => void) {

    if (this.channels.has(channelName)) {

      return this.channels.get(channelName);

    }

    

    const channel = supabase

      .channel(channelName)

      .on('postgres_changes', config, callback)

      .subscribe();

      

    this.channels.set(channelName, channel);

    return channel;

  }

  

  unsubscribe(channelName: string) {

    const channel = this.channels.get(channelName);

    if (channel) {

      supabase.removeChannel(channel);

      this.channels.delete(channelName);

    }

  }

  

  unsubscribeAll() {

    this.channels.forEach((channel, name) => {

      supabase.removeChannel(channel);

    });

    this.channels.clear();

  }

}

```
## Environment Variables
Required environment variables for Supabase:

```bash

SUPABASE_URL=your_supabase_url

SUPABASE_ANON_KEY=your_anon_key

SUPABASE_SERVICE_KEY=your_service_key # For server-side operations

```
## Additional Resources
- Full SDK Reference: `/src/services/supabase-typescript-sdk-reference.ts`

- Supabase Docs: https://supabase.com/docs

- TypeScript Types: `/src/types/supabase.ts`
## Notes for AI Agents
When working with Supabase in this project:
1. Always use the provided helper classes and patterns

2. Handle errors gracefully with proper logging

3. Use batch operations for bulk data processing

4. Implement retry logic for critical operations

5. Clean up realtime subscriptions when done

6. Store agent-specific data with proper metadata

7. Use vector embeddings for semantic search

8. Leverage RPC functions for complex operations

9. Monitor resource usage and performance

10. Document any new patterns or utilities created