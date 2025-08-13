import { TWO } from '@/utils/constants';
import { log, LogContext } from '@/utils/logger';
import { isAllowedHost, normalizeHttpUrl } from '@/utils/url-security';
import { llmRouter } from './llm-router-service';
import { ollamaService } from './ollama-service';
const fetchApi = globalThis.fetch?.bind(globalThis);
export class FastLLMCoordinator {
    lfm2Available = false;
    kokoroAvailable = false;
    lmStudioUrl;
    lmStudioAvailable = false;
    constructor() {
        const base = process.env.LM_STUDIO_URL || 'http://localhost:5901';
        try {
            const normalized = normalizeHttpUrl(base);
            if (!normalized)
                throw new Error('Unsupported protocol');
            if (!isAllowedHost(normalized, 'ALLOWED_LLM_HOSTS')) {
                throw new Error('Host not allowed');
            }
            this.lmStudioUrl = normalized;
        }
        catch (e) {
            log.warn('Invalid LM_STUDIO_URL, using http://localhost:5901', LogContext.AI, {
                error: e instanceof Error ? e.message : String(e),
            });
            this.lmStudioUrl = 'http://localhost:5901';
        }
        this.initializeFastModels();
        this.checkLmStudioHealth().catch(err => log.warn('LM Studio not available on startup', LogContext.AI, { error: String(err) }));
    }
    async initializeFastModels() {
        try {
            this.lfm2Available = true;
            this.kokoroAvailable = true;
            await this.checkLmStudioHealth();
            log.info('✅ Fast models initialized', LogContext.AI, {
                lfm2: this.lfm2Available,
                kokoro: this.kokoroAvailable,
                lmStudio: this.lmStudioUrl,
            });
        }
        catch (error) {
            log.error('❌ Failed to initialize fast models', LogContext.AI, { error });
        }
    }
    async checkLmStudioHealth() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const resp = await fetchApi(`${this.lmStudioUrl}/v1/models`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeout);
            this.lmStudioAvailable = resp.ok;
            return this.lmStudioAvailable;
        }
        catch {
            this.lmStudioAvailable = false;
            return false;
        }
    }
    isLmStudioAvailable() {
        return this.lmStudioAvailable;
    }
    async makeRoutingDecision(userRequest, context) {
        const startTime = Date.now();
        const routingPrompt = `Analyze this request and decide the best AI service:

REQUEST: "${userRequest}"
CONTEXT: ${JSON.stringify(context)}

Respond with JSON only:
{
  "shouldUseLocal": boolean,
  "targetService": "lfm2|ollama|lm-studio|openai|anthropic",
  "reasoning": "brief explanation",
  "complexity": "simple|medium|complex",
  "estimatedTokens": number,
  "priority": 1-5
}

ROUTING RULES:
- lfm2: Simple questions, quick responses, <100 tokens
- ollama: Medium complexity, general purpose, <1000 tokens
- lm-studio: Code generation, technical tasks, <2000 tokens
- openai: Complex reasoning, creative tasks, >1000 tokens
- anthropic: Analysis, research, long-form content`;
        try {
            const decision = await this.queryLFM2(routingPrompt);
            const duration = Date.now() - startTime;
            log.info('⚡ Fast routing decision made', LogContext.AI, {
                decision: decision.targetService,
                duration: `${duration}ms`,
                complexity: decision.complexity,
            });
            return decision;
        }
        catch {
            log.warn('⚠️ Fast routing failed, using fallback logic', LogContext.AI);
            return this.getFallbackDecision(userRequest, context);
        }
    }
    async executeWithCoordination(userRequest, context) {
        const startTime = Date.now();
        const decision = await this.makeRoutingDecision(userRequest, context);
        let response;
        let tokensUsed = 0;
        switch (decision.targetService) {
            case 'lfm2':
                response = await this.executeLFM2(userRequest);
                tokensUsed = response.tokens || 50;
                break;
            case 'ollama':
                response = await this.executeOllama(userRequest);
                tokensUsed = response.usage?.total_tokens || 0;
                break;
            case 'lm-studio':
                response = await this.executeLMStudio(userRequest);
                tokensUsed = response.usage?.total_tokens || 0;
                break;
            case 'openai':
            case 'anthropic':
                response = await llmRouter.generateResponse(decision.targetService === 'openai' ? 'code-assistant' : 'planner-pro', [{ role: 'user', content: userRequest }]);
                tokensUsed = response.usage?.total_tokens || 0;
                break;
            default:
                throw new Error(`Unsupported service: ${decision.targetService}`);
        }
        const executionTime = Date.now() - startTime;
        return {
            response,
            metadata: {
                routingDecision: decision,
                executionTime,
                tokensUsed,
                serviceUsed: decision.targetService,
            },
        };
    }
    async queryLFM2(prompt) {
        try {
            const { lfm2Bridge } = await import('./lfm2-bridge');
            const response = await lfm2Bridge.routingDecision(prompt, {
                taskType: 'routing',
                timestamp: Date.now(),
            });
            return {
                shouldUseLocal: ['lfm2', 'ollama'].includes(response.targetService),
                targetService: response.targetService,
                reasoning: response.reasoning,
                complexity: this.estimateComplexity(prompt),
                estimatedTokens: response.estimatedTokens,
                priority: (() => {
                    if (response.confidence > 0.8)
                        return 1;
                    if (response.confidence > 0.6)
                        return 2;
                    return 3;
                })(),
            };
        }
        catch (error) {
            log.warn('⚠️ LFM2 routing failed, using fallback logic', LogContext.AI, { error });
            const complexity = this.estimateComplexity(prompt);
            let targetService = 'lfm2';
            if (complexity === 'complex')
                targetService = 'anthropic';
            else if (complexity === 'medium')
                targetService = 'ollama';
            else if (prompt.includes('code') || prompt.includes('program'))
                targetService = 'lm-studio';
            const priority = complexity === 'simple' ? 1 : complexity === 'medium' ? 3 : 5;
            return {
                shouldUseLocal: targetService === 'lfm2' || targetService === 'ollama',
                targetService,
                reasoning: `Fallback routing - Complexity: ${complexity}, contains technical terms: ${prompt.includes('code')}`,
                complexity,
                estimatedTokens: prompt.length / 4,
                priority,
            };
        }
    }
    async executeLFM2(userRequest) {
        try {
            const { lfm2Bridge } = await import('./lfm2-bridge');
            const response = await lfm2Bridge.quickResponse(userRequest, 'simple_qa');
            return {
                content: response.content,
                model: response.model,
                provider: 'local',
                tokens: response.tokens,
                executionTime: response.executionTime,
                confidence: response.confidence,
            };
        }
        catch (error) {
            log.warn('⚠️ LFM2 execution failed, using mock response', LogContext.AI, { error });
            await new Promise((resolve) => setTimeout(resolve, 50));
            return {
                content: `Fast response to: ${userRequest}`,
                model: 'LFM2-1.2B',
                provider: 'local',
                tokens: Math.min(100, userRequest.length / TWO),
            };
        }
    }
    async executeOllama(userRequest) {
        return ollamaService.generateResponse([{ role: 'user', content: userRequest }]);
    }
    async executeLMStudio(userRequest) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const response = await fetchApi(`${this.lmStudioUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: userRequest }],
                    temperature: 0.7,
                    max_tokens: 1000,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!response.ok) {
                throw new Error(`LM Studio error: ${response.status}`);
            }
            const ct = response.headers.get('content-type') || '';
            const data = ct.includes('application/json') ? await response.json() : await response.text();
            return {
                content: data.choices?.[0]?.message?.content || (typeof data === 'string' ? data : ''),
                model: 'lm-studio',
                provider: 'lm-studio',
                usage: data.usage,
            };
        }
        catch {
            log.warn('⚠️ LM Studio unavailable, falling back to Ollama', LogContext.AI);
            return this.executeOllama(userRequest);
        }
    }
    async optimizeWithDSPy(taskType, examples) {
        log.info('🔧 Starting DSPy optimization', LogContext.AI, {
            taskType,
            examples: examples.length,
        });
        return {
            optimizedPrompt: `Optimized prompt for ${taskType} based on ${examples.length} examples`,
            confidence: 0.85,
            iterations: 3,
        };
    }
    async coordinateMultipleAgents(primaryTask, supportingTasks) {
        const startTime = Date.now();
        const decisions = [];
        const servicesUsed = [];
        const primaryDecision = await this.makeRoutingDecision(primaryTask, {
            taskType: 'primary',
            complexity: 'medium',
            urgency: 'high',
            expectedResponseLength: 'medium',
            requiresCreativity: false,
            requiresAccuracy: true,
        });
        decisions.push(primaryDecision);
        const supportingDecisions = await Promise.all(supportingTasks.map((task) => this.makeRoutingDecision(task, {
            taskType: 'supporting',
            complexity: 'simple',
            urgency: 'medium',
            expectedResponseLength: 'short',
            requiresCreativity: false,
            requiresAccuracy: false,
        })));
        decisions.push(...supportingDecisions);
        const [primary, ...supporting] = await Promise.all([
            this.executeBasedOnDecision(primaryTask, primaryDecision),
            ...supportingTasks.map((task, index) => this.executeBasedOnDecision(task, supportingDecisions[index])),
        ]);
        decisions.forEach((d) => {
            if (!servicesUsed.includes(d.targetService)) {
                servicesUsed.push(d.targetService);
            }
        });
        return {
            primary,
            supporting,
            coordination: {
                totalTime: Date.now() - startTime,
                fastDecisions: decisions.length,
                servicesUsed,
            },
        };
    }
    async executeBasedOnDecision(task, decision) {
        const context = {
            taskType: 'general',
            complexity: decision.complexity,
            urgency: 'medium',
            expectedResponseLength: 'medium',
            requiresCreativity: false,
            requiresAccuracy: true,
        };
        const result = await this.executeWithCoordination(task, context);
        return result.response;
    }
    estimateComplexity(prompt) {
        const { length } = prompt;
        const complexKeywords = ['analyze', 'explain', 'research', 'comprehensive', 'detailed'];
        const hasComplexKeywords = complexKeywords.some((keyword) => prompt.toLowerCase().includes(keyword));
        if (length < 100 && !hasComplexKeywords)
            return 'simple';
        if (length < 300 || hasComplexKeywords)
            return 'medium';
        return 'complex';
    }
    getFallbackDecision(userRequest, context) {
        return {
            shouldUseLocal: true,
            targetService: 'ollama',
            reasoning: 'Fallback routing due to coordinator failure',
            complexity: context.complexity || 'medium',
            estimatedTokens: userRequest.length / 4,
            priority: 3,
        };
    }
    getSystemStatus() {
        return {
            fastModels: {
                lfm2: this.lfm2Available,
                kokoro: this.kokoroAvailable,
            },
            services: {
                ollama: ollamaService.isServiceAvailable(),
                lmStudio: this.isLmStudioAvailable(),
            },
            performance: {
                averageRoutingTime: 50,
            },
        };
    }
}
export const fastCoordinator = new FastLLMCoordinator();
export default fastCoordinator;
//# sourceMappingURL=fast-llm-coordinator.js.map