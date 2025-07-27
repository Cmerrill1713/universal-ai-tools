#!/usr/bin/env node
/**
 * Universal AI Tools MCP Server
 * Provides Claude with direct access to your agent orchestration system
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type {
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import { UniversalAgentRegistry } from '../agents/universal_agent_registry';
import { dspyService } from '../services/dspy-service';
import { EnhancedMemorySystem } from '../memory/enhanced_memory_system';
import { logger } from '../utils/logger';

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const agentRegistry = new UniversalAgentRegistry(null, supabase);
const memorySystem = new EnhancedMemorySystem(supabase);

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'execute_agent',
    description: 'Execute a specific agent from the Universal AI Tools registry',
    inputSchema: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'Name of the agent to execute (e.g., planner_agent, evaluation_agent)',
        },
        task: {
          type: 'string',
          description: 'The task or request for the agent to process',
        },
        context: {
          type: 'object',
          description: 'Additional context for the agent',
          properties: {},
        },
      },
      required: ['agentName', 'task'],
    },
  },
  {
    name: 'orchestrate_agents',
    description: 'Orchestrate multiple agents using DSPy for complex tasks',
    inputSchema: {
      type: 'object',
      properties: {
        userRequest: {
          type: 'string',
          description: 'The user request to process',
        },
        mode: {
          type: 'string',
          enum: ['simple', 'standard', 'cognitive', 'adaptive'],
          description: 'Orchestration mode',
        },
        agents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific agents to include in orchestration',
        },
      },
      required: ['userRequest'],
    },
  },
  {
    name: 'search_memory',
    description: 'Search the Universal AI Tools memory system',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for semantic memory search',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10,
        },
        filters: {
          type: 'object',
          description: 'Additional filters for memory search',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'store_memory',
    description: 'Store information in the Universal AI Tools memory system',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Content to store in memory',
        },
        type: {
          type: 'string',
          enum: ['conversation', 'knowledge', 'task', 'feedback'],
          description: 'Type of memory to store',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the memory',
        },
      },
      required: ['content', 'type'],
    },
  },
  {
    name: 'evaluate_response',
    description: 'Use the evaluation agent to score and analyze a response',
    inputSchema: {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'The response to evaluate',
        },
        criteria: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['accuracy', 'relevance', 'completeness', 'clarity', 'efficiency', 'safety'],
          },
          description: 'Evaluation criteria to use',
        },
      },
      required: ['response'],
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get status and information about available agents',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'core', 'cognitive', 'personal', 'evolved'],
          description: 'Category of agents to list',
          default: 'all',
        },
      },
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'universal-ai-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'execute_agent': {
        const { agentName, task, context = {} } = args;
        const agent = await agentRegistry.getAgent(agentName);
        
        if (!agent) {
          throw new Error(`Agent ${agentName} not found`);
        }

        const result = await agent.execute({
          task,
          context: {
            ...context,
            source: 'mcp',
            timestamp: new Date().toISOString(),
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'orchestrate_agents': {
        const { userRequest, mode = 'standard', agents } = args;
        
        const result = await dspyService.orchestrate({
          requestId: `mcp-${Date.now()}`,
          userRequest,
          userId: 'mcp-claude',
          orchestrationMode: mode,
          participatingAgents: agents,
          context: {
            source: 'mcp',
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_memory': {
        const { query, limit = 10, filters = {} } = args;
        
        const results = await memorySystem.search(
          'mcp-claude',
          query,
          limit,
          filters
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'store_memory': {
        const { content, type, metadata = {} } = args;
        
        const memory = await memorySystem.storeMemory(
          'mcp-claude',
          type,
          content,
          {
            ...metadata,
            source: 'mcp',
            timestamp: new Date().toISOString(),
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Memory stored successfully with ID: ${memory.id}`,
            },
          ],
        };
      }

      case 'evaluate_response': {
        const { response, criteria = ['accuracy', 'relevance', 'completeness'] } = args;
        
        const evaluationAgent = await agentRegistry.getAgent('evaluation_agent');
        if (!evaluationAgent) {
          throw new Error('Evaluation agent not available');
        }

        const result = await evaluationAgent.execute({
          task: `Evaluate the following response: "${response}"`,
          context: {
            criteria,
            source: 'mcp',
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_agent_status': {
        const { category = 'all' } = args;
        
        const agents = [];
        if (category === 'all' || category === 'core') {
          agents.push(...agentRegistry.getCoreAgents());
        }
        if (category === 'all' || category === 'cognitive') {
          agents.push(...agentRegistry.getCognitiveAgents());
        }
        if (category === 'all' || category === 'personal') {
          agents.push(...agentRegistry.getPersonalAgents());
        }

        const status = agents.map(agent => ({
          name: agent.name,
          description: agent.description,
          category: agent.category,
          capabilities: agent.capabilities,
          status: agentRegistry.isAgentLoaded(agent.name) ? 'loaded' : 'available',
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Universal AI Tools MCP Server started');
}

main().catch((error) => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});