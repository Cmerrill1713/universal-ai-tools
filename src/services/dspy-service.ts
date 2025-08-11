import { randomUUID } from 'crypto';

import { log, LogContext } from '@/utils/logger';

// Lazy-load the DSPy bridge to avoid import-time side effects in tests
let cachedBridge: any | null = null;
async function getDspyBridge(): Promise<any | null> {
  // Allow disabling in tests or when explicitly turned off
  if (process.env.NODE_ENV === 'test' || process.env.ENABLE_DSPY === 'false') {
    return null;
  }
  if (cachedBridge) return cachedBridge;
  try {
    const mod = await import('./dspy-orchestrator/bridge');
    cachedBridge = (mod as any).dspyBridge ?? null;
    return cachedBridge;
  } catch (error) {
    log.warn('DSPy bridge load failed; continuing without DSPy', LogContext.DSPY, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export interface OrchestrateParams {
  userRequest: string;
  userId?: string;
  context?: Record<string, unknown>;
}

export class DSPyService {
  public isReady(): boolean {
    // In tests or when disabled, treat as not ready
    if (process.env.NODE_ENV === 'test' || process.env.ENABLE_DSPY === 'false') {
      return false;
    }
    // Best-effort check without awaiting import during sync call
    // If not yet loaded, conservatively return false; callers will attempt and fall back
    try {
      return Boolean((cachedBridge as any)?.isReady?.());
    } catch {
      return false;
    }
  }

  public async orchestrate(params: OrchestrateParams): Promise<any> {
    const requestId = this.generateId();
    try {
      const bridge = await getDspyBridge();
      if (!bridge?.isReady?.()) {
        if (process.env.NODE_ENV !== 'production') {
          // Dev-safe fallback
          return {
            requestId,
            success: true,
            data: {
              intent: 'fallback-dev',
              response: `Orchestrated (dev mock): ${params.userRequest}`,
              model_used: { provider: 'mock', name: 'dev' },
            },
          };
        }
        throw new Error('DSPy service not connected');
      }

      const res = await bridge.sendRequest({
        requestId,
        method: 'orchestrate',
        params,
      });
      return res;
    } catch (error) {
      log.error('DSPy orchestrate failed', LogContext.DSPY, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async optimizePrompts(examples: Array<Record<string, unknown>>): Promise<any> {
    const requestId = this.generateId();
    const bridge = await getDspyBridge();
    if (!bridge?.isReady?.() && process.env.NODE_ENV !== 'production') {
      return {
        requestId,
        success: true,
        data: { optimized_prompt: '[DEV] optimized', method: 'MIPROv2', iterations: 1 },
      };
    }
    if (!bridge) throw new Error('DSPy service not connected');
    return bridge.sendRequest({ requestId, method: 'optimize_prompts', params: { examples } });
  }

  public async manageKnowledge(operation: string, payload: Record<string, unknown>): Promise<any> {
    const requestId = this.generateId();
    const bridge = await getDspyBridge();
    if (!bridge?.isReady?.() && process.env.NODE_ENV !== 'production') {
      return { requestId, success: true, data: { operation, result: 'dev-mock' } };
    }
    if (!bridge) throw new Error('DSPy service not connected');
    return bridge.sendRequest({
      requestId,
      method: 'manage_knowledge',
      params: { operation, payload },
    });
  }

  public async status(): Promise<{ ready: boolean }> {
    return { ready: this.isReady() };
  }

  private generateId(): string {
    try {
      return randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }
}

export const dspyService = new DSPyService();
export default dspyService;
