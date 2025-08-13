import { randomUUID } from 'crypto';
import { log, LogContext } from '@/utils/logger';
let cachedBridge = null;
async function getDspyBridge() {
    if (process.env.NODE_ENV === 'test' || process.env.ENABLE_DSPY === 'false') {
        return null;
    }
    if (cachedBridge)
        return cachedBridge;
    try {
        const mod = await import('./dspy-orchestrator/bridge');
        cachedBridge = mod.dspyBridge ?? null;
        return cachedBridge;
    }
    catch (error) {
        log.warn('DSPy bridge load failed; continuing without DSPy', LogContext.DSPY, {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
export class DSPyService {
    isReady() {
        if (process.env.NODE_ENV === 'test' || process.env.ENABLE_DSPY === 'false') {
            return false;
        }
        try {
            return Boolean(cachedBridge?.isReady?.());
        }
        catch {
            return false;
        }
    }
    async orchestrate(params) {
        const requestId = this.generateId();
        try {
            const bridge = await getDspyBridge();
            if (!bridge?.isReady?.()) {
                if (process.env.NODE_ENV !== 'production') {
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
        }
        catch (error) {
            log.error('DSPy orchestrate failed', LogContext.DSPY, {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async optimizePrompts(examples) {
        const requestId = this.generateId();
        const bridge = await getDspyBridge();
        if (!bridge?.isReady?.() && process.env.NODE_ENV !== 'production') {
            return {
                requestId,
                success: true,
                data: { optimized_prompt: '[DEV] optimized', method: 'MIPROv2', iterations: 1 },
            };
        }
        if (!bridge)
            throw new Error('DSPy service not connected');
        return bridge.sendRequest({ requestId, method: 'optimize_prompts', params: { examples } });
    }
    async manageKnowledge(operation, payload) {
        const requestId = this.generateId();
        const bridge = await getDspyBridge();
        if (!bridge?.isReady?.() && process.env.NODE_ENV !== 'production') {
            return { requestId, success: true, data: { operation, result: 'dev-mock' } };
        }
        if (!bridge)
            throw new Error('DSPy service not connected');
        return bridge.sendRequest({
            requestId,
            method: 'manage_knowledge',
            params: { operation, payload },
        });
    }
    async status() {
        return { ready: this.isReady() };
    }
    generateId() {
        try {
            return randomUUID();
        }
        catch {
            return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }
    }
}
export const dspyService = new DSPyService();
export default dspyService;
//# sourceMappingURL=dspy-service.js.map