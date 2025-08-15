/**
 * Local LLM Router
 * Provides direct access to local LLM services (Ollama, LM Studio) without authentication
 * Runs on a separate port for security isolation from external API services
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { OllamaService } from '../services/ollama-service';
import { HuggingFaceToLMStudioAdapter } from '../services/huggingface-to-lmstudio';
import { log, LogContext } from '../utils/logger';
import { zodValidate } from '../middleware/zod-validate';
import { semanticContextRetrievalService } from '../services/semantic-context-retrieval';
import { knowledgeGraphService } from '../services/graph-rag/knowledge-graph-service';
import { contextStorageService } from '../services/context-storage-service';

const router = Router();

// Initialize services
let ollamaService: OllamaService | null = null;
let lmStudioAdapter: HuggingFaceToLMStudioAdapter | null = null;

// Initialize services on first use
const getOllamaService = () => {
  if (!ollamaService) {
    ollamaService = new OllamaService();
  }
  return ollamaService;
};

const getLMStudioAdapter = () => {
  if (!lmStudioAdapter) {
    lmStudioAdapter = new HuggingFaceToLMStudioAdapter();
  }
  return lmStudioAdapter;
};

/**
 * GET /local/health
 * Health check for local LLM services
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const ollamaHealthy = await checkOllamaHealth();
    const lmStudioHealthy = await checkLMStudioHealth();

    res.json({
      success: true,
      services: {
        ollama: ollamaHealthy,
        lmstudio: lmStudioHealthy,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
    });
  }
});

/**
 * GET /local/models
 * List available models from all local services
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models: any[] = [];

    // Get Ollama models
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        const ollamaModels = data.models?.map((m: any) => ({
          id: m.name,
          provider: 'ollama',
          size: m.size,
          modified: m.modified_at,
        })) || [];
        models.push(...ollamaModels);
      }
    } catch (e) {
      log.debug('Ollama not available', LogContext.AI);
    }

    // Get LM Studio models
    try {
      const response = await fetch('http://localhost:1234/v1/models');
      if (response.ok) {
        const data = await response.json();
        const lmStudioModels = data.data?.map((m: any) => ({
          id: m.id,
          provider: 'lmstudio',
          created: m.created,
        })) || [];
        models.push(...lmStudioModels);
      }
    } catch (e) {
      log.debug('LM Studio not available', LogContext.AI);
    }

    res.json({
      success: true,
      models,
      count: models.length,
    });
  } catch (error) {
    log.error('Failed to list models', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list models',
    });
  }
});

/**
 * POST /local/chat
 * Enhanced chat endpoint for local LLMs with RAG support - no authentication required
 */
router.post(
  '/chat',
  zodValidate(
    z.object({
      message: z.string().min(1),
      model: z.string().optional(),
      provider: z.enum(['ollama', 'lmstudio', 'auto']).optional().default('auto'),
      temperature: z.number().min(0).max(2).optional().default(0.7),
      max_tokens: z.number().min(1).max(4096).optional().default(500),
      system: z.string().optional(),
      // RAG parameters
      useRAG: z.boolean().optional().default(false),
      contextIds: z.array(z.string()).optional(),
      maxContext: z.number().min(1).max(25).optional().default(8),
      graphQuery: z.string().optional(),
      includeGraphPaths: z.boolean().optional().default(false),
      sessionId: z.string().optional(),
      projectPath: z.string().optional(),
    })
  ),
  async (req: Request, res: Response) => {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      const { 
        message, 
        model, 
        provider, 
        temperature, 
        max_tokens, 
        system,
        useRAG,
        contextIds,
        maxContext,
        graphQuery,
        includeGraphPaths,
        sessionId,
        projectPath
      } = req.body;

      log.info('Local LLM chat request', LogContext.API, {
        requestId,
        provider,
        model,
        messageLength: message.length,
        useRAG,
        maxContext: useRAG ? maxContext : undefined,
      });

      let response: string = '';
      let actualProvider = provider;
      let actualModel = model;
      let ragContext: any = null;
      let graphPaths: any[] = [];

      // Auto-select provider if not specified
      if (provider === 'auto' || !provider) {
        const ollamaHealthy = await checkOllamaHealth();
        const lmStudioHealthy = await checkLMStudioHealth();

        if (ollamaHealthy) {
          actualProvider = 'ollama';
          actualModel = model || 'tinyllama:latest';
        } else if (lmStudioHealthy) {
          actualProvider = 'lmstudio';
          actualModel = model || 'local-model';
        } else {
          throw new Error('No local LLM services available');
        }
      }

      // RAG Context Retrieval
      let enrichedPrompt = message;
      if (useRAG) {
        try {
          // 1. Semantic context retrieval
          const userId = 'local-user'; // Anonymous user for local LLM
          ragContext = await semanticContextRetrievalService.semanticSearch({
            query: message,
            userId,
            sessionId,
            projectPath,
            maxResults: maxContext,
            fuseSimilarResults: true,
          });

          // 2. Graph-based retrieval if requested
          if (includeGraphPaths && graphQuery) {
            const graphResults = await knowledgeGraphService.retrieveWithGraph({
              query: graphQuery || message,
              maxHops: 3,
              includeNeighbors: true,
              useRL: true, // Use reinforcement learning optimization
            });
            graphPaths = graphResults;
          }

          // 3. Build enriched prompt with context
          const contextTexts = ragContext.results
            .slice(0, maxContext)
            .map((r: any) => `[${r.contentType}]: ${r.content}`)
            .join('\n');

          const graphContext = graphPaths.length > 0
            ? '\n\nGraph Knowledge:\n' + graphPaths
                .map((p: any) => p.reasoning.join(' → '))
                .join('\n')
            : '';

          enrichedPrompt = `Context from knowledge base:\n${contextTexts}${graphContext}\n\nUser Query: ${message}`;

          log.info('RAG context enriched', LogContext.API, {
            requestId,
            contextItems: ragContext.results.length,
            graphPaths: graphPaths.length,
          });
        } catch (ragError) {
          log.warn('RAG retrieval failed, continuing without context', LogContext.API, {
            error: ragError instanceof Error ? ragError.message : String(ragError),
          });
          // Continue without RAG if it fails
        }
      }

      // Route to appropriate service
      if (actualProvider === 'ollama') {
        const ollama = getOllamaService();
        const messages = [];
        
        if (system) {
          messages.push({ role: 'system' as const, content: system });
        }
        messages.push({ role: 'user' as const, content: enrichedPrompt });

        const result = await ollama.generateResponse(
          messages,
          actualModel || 'tinyllama:latest',
          {
            temperature,
            max_tokens,
            stream: false,
          }
        );
        response = result.message.content;
      } else if (actualProvider === 'lmstudio') {
        const lmStudio = getLMStudioAdapter();
        const result = await lmStudio.generateText({
          inputs: enrichedPrompt,
          parameters: {
            max_new_tokens: max_tokens,
            temperature,
            do_sample: true,
          },
          model: actualModel,
        });
        response = result[0]?.generated_text || '';
      }

      // Store conversation if using RAG and sessionId provided
      if (useRAG && sessionId) {
        try {
          const userId = 'local-user';
          await contextStorageService.storeConversation(
            userId,
            `Q: ${message}\nA: ${response}`,
            'local_llm_chat',
            projectPath
          );
        } catch (storeError) {
          log.warn('Failed to store conversation', LogContext.API, { error: storeError });
        }
      }

      const duration = Date.now() - startTime;

      res.json({
        success: true,
        response,
        model: actualModel,
        provider: actualProvider,
        requestId,
        duration,
        timestamp: new Date().toISOString(),
        // Include RAG metadata if used
        ...(useRAG && {
          rag: {
            contextUsed: ragContext?.results?.length || 0,
            sources: ragContext?.results?.slice(0, 5).map((r: any) => ({
              type: r.contentType,
              preview: r.content.substring(0, 100) + '...',
              score: r.score,
            })) || [],
            graphPaths: graphPaths.length,
            clusters: ragContext?.clusters?.clusters?.length || 0,
          }
        }),
      });

      log.info('Local LLM chat completed', LogContext.API, {
        requestId,
        provider: actualProvider,
        model: actualModel,
        duration,
      });
    } catch (error) {
      log.error('Local LLM chat failed', LogContext.API, {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Chat request failed',
        requestId,
      });
    }
  }
);

/**
 * POST /local/completion
 * Text completion endpoint for local LLMs
 */
router.post(
  '/completion',
  zodValidate(
    z.object({
      prompt: z.string().min(1),
      model: z.string().optional(),
      provider: z.enum(['ollama', 'lmstudio', 'auto']).optional().default('auto'),
      temperature: z.number().min(0).max(2).optional().default(0.7),
      max_tokens: z.number().min(1).max(4096).optional().default(500),
    })
  ),
  async (req: Request, res: Response) => {
    const requestId = uuidv4();

    try {
      const { prompt, model, provider, temperature, max_tokens } = req.body;

      let completion = '';
      let actualProvider = provider;

      // Auto-select provider
      if (provider === 'auto') {
        const ollamaHealthy = await checkOllamaHealth();
        actualProvider = ollamaHealthy ? 'ollama' : 'lmstudio';
      }

      if (actualProvider === 'ollama') {
        const ollama = getOllamaService();
        const result = await ollama.generateSimpleResponse({
          model: model || 'tinyllama:latest',
          prompt: prompt,
          options: {
            temperature,
            num_predict: max_tokens,
          }
        });
        completion = result.response;
      } else {
        const lmStudio = getLMStudioAdapter();
        const result = await lmStudio.generateText({
          inputs: prompt,
          parameters: {
            max_new_tokens: max_tokens,
            temperature,
          },
          model,
        });
        completion = result[0]?.generated_text || '';
      }

      res.json({
        success: true,
        completion,
        model,
        provider: actualProvider,
        requestId,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Completion failed',
        requestId,
      });
    }
  }
);

/**
 * POST /local/rag/search
 * Direct RAG search endpoint for testing and debugging
 */
router.post(
  '/rag/search',
  zodValidate(
    z.object({
      query: z.string().min(1),
      maxResults: z.number().min(1).max(50).optional().default(10),
      sessionId: z.string().optional(),
      projectPath: z.string().optional(),
      includeGraph: z.boolean().optional().default(false),
    })
  ),
  async (req: Request, res: Response) => {
    const requestId = uuidv4();
    
    try {
      const { query, maxResults, sessionId, projectPath, includeGraph } = req.body;
      
      // Semantic search
      const semanticResults = await semanticContextRetrievalService.semanticSearch({
        query,
        userId: 'local-user',
        sessionId,
        projectPath,
        maxResults,
        fuseSimilarResults: true,
      });
      
      // Graph search if requested
      let graphResults: any[] = [];
      if (includeGraph) {
        graphResults = await knowledgeGraphService.retrieveWithGraph({
          query,
          maxHops: 2,
          includeNeighbors: true,
          useRL: false,
        });
      }
      
      res.json({
        success: true,
        semantic: {
          results: semanticResults.results,
          clusters: semanticResults.clusters,
        },
        graph: graphResults,
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('RAG search failed', LogContext.API, { error, requestId });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'RAG search failed',
        requestId,
      });
    }
  }
);

/**
 * POST /local/rag/index
 * Index new content into the RAG system
 */
router.post(
  '/rag/index',
  zodValidate(
    z.object({
      content: z.string().min(1),
      contentType: z.enum(['code', 'documentation', 'conversation', 'general']).optional().default('general'),
      projectPath: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    })
  ),
  async (req: Request, res: Response) => {
    const requestId = uuidv4();
    
    try {
      const { content, contentType, projectPath, metadata } = req.body;
      const userId = 'local-user';
      
      // Store in context storage
      await contextStorageService.storeContext({
        content,
        category: contentType || 'project_info',
        source: projectPath || 'local-llm',
        userId,
        metadata
      });
      
      // Extract entities and relationships for knowledge graph
      const entities = await knowledgeGraphService.extractEntities(content, projectPath);
      const relationships = await knowledgeGraphService.extractRelationships(content, entities);
      const hyperedges = await knowledgeGraphService.buildHyperedges(entities, content);
      
      // Store in graph
      await knowledgeGraphService.storeGraph(entities, relationships, hyperedges);
      
      res.json({
        success: true,
        indexed: {
          entities: entities.length,
          relationships: relationships.length,
          hyperedges: hyperedges.length,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('RAG indexing failed', LogContext.API, { error, requestId });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Indexing failed',
        requestId,
      });
    }
  }
);

// Helper functions
async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkLMStudioHealth(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:1234/v1/models', {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default router;