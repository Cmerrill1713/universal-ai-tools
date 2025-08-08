/**
 * Server Services Initialization Module;
 * Handles initialization of all core services (Supabase, MCP, Agent Registry, etc.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';
import AgentRegistry from '@/agents/agent-registry';
import { mcpIntegrationService } from '@/services/mcp-integration-service';
import { contextStorageService } from '@/services/context-storage-service';

export interface ServerServices {
  supabase: SupabaseClient | null;
  agentRegistry: AgentRegistry | null;
}

export class ServerServiceManager {
  private services: ServerServices = {
    supabase: null,
    agentRegistry: null,
  };

  async initializeAll(): Promise<ServerServices> {
    log?.info('🔄 Initializing server services...', LogContext?.SERVER);

    await this?.initializeSupabase();
    this?.initializeAgentRegistry();
    await this?.initializeContextServices();
    await this?.initializeMCPService();

    log?.info('✅ All services initialized successfully', LogContext?.SERVER);
    return this?.services;
  }

  private initializeSupabase(): void {
    try {
      if (!config?.supabase?.url || !config?.supabase?.anonKey) {
        log?.warn('⚠️ Supabase configuration missing, skipping initialization', LogContext?.DATABASE);
        return;
      }

      this?.services?.supabase = createClient(
        config?.supabase?.url,
        config?.supabase?.anonKey;
      );

      log?.info('✅ Supabase client initialized', LogContext?.DATABASE);
    } catch (error) {
      log?.error('❌ Failed to initialize Supabase client', LogContext?.DATABASE, {
        error: error instanceof Error ? error?.message : String(error),
      });
    }
  }

  private initializeAgentRegistry(): void {
    try {
      this?.services?.agentRegistry = new AgentRegistry();
      (global as unknown).agentRegistry = this?.services?.agentRegistry;
      log?.info('✅ Agent Registry initialized', LogContext?.AGENT);
    } catch (error) {
      log?.error('❌ Failed to initialize Agent Registry', LogContext?.AGENT, {
        error: error instanceof Error ? error?.message : String(error),
      });
    }
  }

  private async initializeContextServices(): Promise<void> {
    try {
      // Context storage service is already initialized in its constructor;
      // No separate initialize method needed - just verify it's available;
      if (contextStorageService) {
        log?.info('✅ Context storage service ready', LogContext?.DATABASE);
      } else {
        log?.warn('⚠️ Context storage service not available', LogContext?.DATABASE);
      }
    } catch (error) {
      log?.warn('⚠️ Context services initialization failed, continuing without context features', LogContext?.DATABASE, {
        error: error instanceof Error ? error?.message : String(error),
      });
    }
  }

  private async initializeMCPService(): Promise<void> {
    try {
      // MCP service initialization happens via start() method, not initialize()
      const isStarted = await mcpIntegrationService?.start();
      if (isStarted) {
        log?.info('✅ MCP service initialized for context management', LogContext?.MCP);
      } else {
        log?.warn('⚠️ MCP service failed to start, continuing without MCP features', LogContext?.MCP);
      }
    } catch (error) {
      log?.warn('⚠️ MCP service initialization failed, continuing without MCP features', LogContext?.MCP, {
        error: error instanceof Error ? error?.message : String(error),
      });
    }
  }

  getServices(): ServerServices {
    return this?.services;
  }

  async shutdown(): Promise<void> {
    log?.info('🛑 Shutting down services...', LogContext?.SERVER);

    if (this?.services?.agentRegistry) {
      try {
        log?.info('Shutting down Agent Registry...', LogContext?.AGENT);
        await this?.services?.agentRegistry?.shutdown();
        log?.info('Agent Registry shutdown completed', LogContext?.AGENT);
      } catch (error) {
        log?.error('Error shutting down Agent Registry', LogContext?.AGENT, {
          error: error instanceof Error ? error?.message : String(error),
        });
      }
    }

    try {
      await mcpIntegrationService?.shutdown();
      log?.info('✅ MCP service shut down', LogContext?.MCP);
    } catch (error) {
      log?.warn('Error shutting down MCP service', LogContext?.MCP, {
        error: error instanceof Error ? error?.message : String(error),
      });
    }

    log?.info('✅ Service shutdown completed', LogContext?.SERVER);
  }
}