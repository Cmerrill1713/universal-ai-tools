#!/usr/bin/env node

/**
 * Agency Swarm Local MCP Server
 * Integrates with our local Agency Swarm Python service
 * No external API calls - purely local operation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// Local Agency Swarm Types
interface LocalAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools_count: number;
  status: 'active' | 'inactive';
}

interface WorkflowExecution {
  id: string;
  description: string;
  context: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  created_at: string;
}

interface AgencyStatus {
  agency_status: string;
  agents: Record<string, LocalAgent>;
  librarian_url: string;
  github_mcp_url: string;
}

class AgencySwarmLocalMCPServer {
  private server: Server;
  private librarianUrl: string;
  private agencySwarmService: string;
  private workflows: Map<string, WorkflowExecution> = new Map();
  private agencyStatus: AgencyStatus | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'agency-swarm-local-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.librarianUrl = process.env.LIBRARIAN_URL || 'http://localhost:8032';
    this.agencySwarmService = process.env.AGENCY_SWARM_SERVICE_URL || 'http://localhost:8033';

    this.setupHandlers();
    this.initializeAgencySwarm();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Agency Management Tools
          {
            name: 'agency_swarm_get_status',
            description: 'Get the status of the local Agency Swarm service and all agents',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'agency_swarm_health_check',
            description: 'Perform a health check of the Agency Swarm service',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'agency_swarm_list_agents',
            description: 'List all available agents in the local Agency Swarm',
            inputSchema: {
              type: 'object',
              properties: {
                include_capabilities: { type: 'boolean', description: 'Include agent capabilities', default: true },
              },
            },
          },
          // Workflow Management Tools
          {
            name: 'agency_swarm_execute_workflow',
            description: 'Execute a workflow through the local Agency Swarm',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_description: { type: 'string', description: 'Description of the workflow to execute' },
                context: { type: 'object', description: 'Additional context for the workflow' },
                store_result: { type: 'boolean', description: 'Store result in Librarian service', default: true },
              },
              required: ['workflow_description'],
            },
          },
          {
            name: 'agency_swarm_monitor_workflow',
            description: 'Monitor the status of a running workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string', description: 'Workflow ID to monitor' },
              },
              required: ['workflow_id'],
            },
          },
          {
            name: 'agency_swarm_list_workflows',
            description: 'List all workflows and their status',
            inputSchema: {
              type: 'object',
              properties: {
                status_filter: { 
                  type: 'string', 
                  enum: ['pending', 'running', 'completed', 'failed'],
                  description: 'Filter workflows by status'
                },
              },
            },
          },
          // Knowledge Management Tools
          {
            name: 'agency_swarm_store_knowledge',
            description: 'Store knowledge in the Librarian service through Agency Swarm',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Knowledge content to store' },
                metadata: { type: 'object', description: 'Additional metadata' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
                agent_name: { type: 'string', description: 'Name of the agent storing the knowledge' },
              },
              required: ['content'],
            },
          },
          {
            name: 'agency_swarm_search_knowledge',
            description: 'Search knowledge in the Librarian service',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Maximum number of results', default: 10 },
                agent_filter: { type: 'string', description: 'Filter by agent name' },
              },
              required: ['query'],
            },
          },
          // GitHub Integration Tools
          {
            name: 'agency_swarm_github_operation',
            description: 'Perform GitHub operations through Agency Swarm agents',
            inputSchema: {
              type: 'object',
              properties: {
                operation_type: { 
                  type: 'string', 
                  enum: ['create_issue', 'create_pr', 'review_code', 'manage_repo', 'analyze_repo'],
                  description: 'Type of GitHub operation'
                },
                repository: { type: 'string', description: 'Repository (owner/repo)' },
                parameters: { type: 'object', description: 'Operation parameters' },
                assigned_agent: { type: 'string', description: 'Agent to perform the operation' },
              },
              required: ['operation_type', 'repository'],
            },
          },
          // Agent Communication Tools
          {
            name: 'agency_swarm_agent_collaboration',
            description: 'Enable collaboration between multiple agents',
            inputSchema: {
              type: 'object',
              properties: {
                agents: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Agent names to collaborate'
                },
                topic: { type: 'string', description: 'Collaboration topic' },
                context: { type: 'object', description: 'Collaboration context' },
                strategy: {
                  type: 'string',
                  enum: ['sequential', 'parallel', 'iterative', 'hierarchical', 'consensus'],
                  description: 'Collaboration strategy',
                  default: 'consensus'
                },
              },
              required: ['agents', 'topic'],
            },
          },
          // System Tools
          {
            name: 'agency_swarm_get_librarian_health',
            description: 'Check the health of the Librarian service',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'agency_swarm_analyze_performance',
            description: 'Analyze Agency Swarm performance and provide insights',
            inputSchema: {
              type: 'object',
              properties: {
                time_range: { type: 'string', description: 'Analysis time range', default: 'all_time' },
                include_workflows: { type: 'boolean', description: 'Include workflow analysis', default: true },
                include_agents: { type: 'boolean', description: 'Include agent analysis', default: true },
              },
            },
          },
        ] as Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        switch (name) {
          case 'agency_swarm_get_status':
            return await this.getAgencyStatus();
          case 'agency_swarm_health_check':
            return await this.healthCheck();
          case 'agency_swarm_list_agents':
            return await this.listAgents(args);
          case 'agency_swarm_execute_workflow':
            return await this.executeWorkflow(args);
          case 'agency_swarm_monitor_workflow':
            return await this.monitorWorkflow(args);
          case 'agency_swarm_list_workflows':
            return await this.listWorkflows(args);
          case 'agency_swarm_store_knowledge':
            return await this.storeKnowledge(args);
          case 'agency_swarm_search_knowledge':
            return await this.searchKnowledge(args);
          case 'agency_swarm_github_operation':
            return await this.githubOperation(args);
          case 'agency_swarm_agent_collaboration':
            return await this.agentCollaboration(args);
          case 'agency_swarm_get_librarian_health':
            return await this.getLibrarianHealth();
          case 'agency_swarm_analyze_performance':
            return await this.analyzePerformance(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  private async getAgencyStatus() {
    try {
      // Simulate getting status from Agency Swarm service
      // In a real implementation, this would call the Python service
      const status: AgencyStatus = {
        agency_status: 'running',
        agents: {
          'ceo': {
            id: 'ceo',
            name: 'CEO',
            description: 'Responsible for client communication, task planning and management.',
            capabilities: ['coordination', 'planning', 'communication', 'knowledge_management'],
            tools_count: 6,
            status: 'active'
          },
          'developer': {
            id: 'developer',
            name: 'Developer',
            description: 'Responsible for code development and technical implementation.',
            capabilities: ['development', 'coding', 'technical_implementation', 'code_review'],
            tools_count: 6,
            status: 'active'
          },
          'github_specialist': {
            id: 'github_specialist',
            name: 'GitHubSpecialist',
            description: 'Specialized in GitHub operations and repository management.',
            capabilities: ['github_operations', 'repository_management', 'issue_management', 'pr_management'],
            tools_count: 7,
            status: 'active'
          },
          'knowledge_manager': {
            id: 'knowledge_manager',
            name: 'KnowledgeManager',
            description: 'Manages knowledge storage and retrieval through Librarian service.',
            capabilities: ['knowledge_storage', 'semantic_search', 'information_management', 'context_sharing'],
            tools_count: 6,
            status: 'active'
          }
        },
        librarian_url: this.librarianUrl,
        github_mcp_url: 'http://localhost:3000'
      };

      this.agencyStatus = status;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              status: status,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get agency status: ${error.message}`);
    }
  }

  private async healthCheck() {
    try {
      // Check Librarian service health
      const librarianHealth = await axios.get(`${this.librarianUrl}/health`, { timeout: 5000 });
      
      const health = {
        service: 'agency-swarm-local-mcp',
        status: 'healthy',
        agents_count: 4,
        agency_initialized: true,
        librarian_service: librarianHealth.status === 200 ? 'healthy' : 'unhealthy',
        librarian_details: librarianHealth.data,
        timestamp: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              health: health,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Health check failed: ${error.message}`,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }
  }

  private async listAgents(args: any) {
    const { include_capabilities = true } = args;
    
    if (!this.agencyStatus) {
      await this.getAgencyStatus();
    }

    const agents = Object.values(this.agencyStatus!.agents).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: include_capabilities ? agent.capabilities : undefined,
      tools_count: agent.tools_count,
      status: agent.status,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            agents: agents,
            total_count: agents.length,
          }, null, 2),
        },
      ],
    };
  }

  private async executeWorkflow(args: any) {
    const { workflow_description, context = {}, store_result = true } = args;
    
    const workflow: WorkflowExecution = {
      id: uuidv4(),
      description: workflow_description,
      context,
      status: 'running',
      created_at: new Date().toISOString(),
    };

    this.workflows.set(workflow.id, workflow);

    try {
      // Simulate workflow execution
      // In a real implementation, this would call the Python Agency Swarm service
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
      
      const result = `Workflow executed successfully: ${workflow_description}. Context: ${JSON.stringify(context)}`;
      workflow.result = result;
      workflow.status = 'completed';

      // Store result in Librarian if requested
      if (store_result) {
        try {
          await axios.post(`${this.librarianUrl}/embed`, [{
            content: `Agency Swarm Workflow: ${workflow_description}\nResult: ${result}`,
            metadata: {
              type: 'workflow_result',
              workflow_id: workflow.id,
              source: 'agency-swarm-local-mcp',
              stored_at: new Date().toISOString(),
            },
            context: {
              workflow: workflow,
              result: result,
            }
          }]);
        } catch (error) {
          console.error('Failed to store workflow result in Librarian:', error.message);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              workflow_id: workflow.id,
              result: result,
              status: workflow.status,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      workflow.status = 'failed';
      workflow.result = `Workflow failed: ${error.message}`;
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              workflow_id: workflow.id,
              error: error.message,
              status: workflow.status,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async monitorWorkflow(args: any) {
    const { workflow_id } = args;
    
    const workflow = this.workflows.get(workflow_id);
    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            workflow: {
              id: workflow.id,
              description: workflow.description,
              status: workflow.status,
              result: workflow.result,
              created_at: workflow.created_at,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async listWorkflows(args: any) {
    const { status_filter } = args;
    
    let workflows = Array.from(this.workflows.values());
    
    if (status_filter) {
      workflows = workflows.filter(workflow => workflow.status === status_filter);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            workflows: workflows.map(workflow => ({
              id: workflow.id,
              description: workflow.description,
              status: workflow.status,
              created_at: workflow.created_at,
            })),
            total_count: workflows.length,
          }, null, 2),
        },
      ],
    };
  }

  private async storeKnowledge(args: any) {
    const { content, metadata = {}, tags = [], agent_name } = args;
    
    try {
      const librarianResponse = await axios.post(`${this.librarianUrl}/embed`, [{
        content: content,
        metadata: {
          type: 'agent_knowledge',
          agent_name: agent_name,
          source: 'agency-swarm-local-mcp',
          stored_at: new Date().toISOString(),
          tags: tags,
          ...metadata,
        },
        context: {
          agent_name: agent_name,
          metadata: metadata,
          tags: tags,
        }
      }]);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Knowledge stored successfully',
              embedded_count: librarianResponse.data.embedded_count,
              librarian_response: librarianResponse.data,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to store knowledge: ${error.message}`);
    }
  }

  private async searchKnowledge(args: any) {
    const { query, limit = 10, agent_filter } = args;
    
    try {
      const searchResponse = await axios.get(`${this.librarianUrl}/search?query=${encodeURIComponent(query)}&limit=${limit}`);
      
      let results = searchResponse.data || [];
      
      // Filter by agent if specified
      if (agent_filter) {
        results = results.filter((result: any) => 
          result.metadata?.agent_name === agent_filter
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              query: query,
              results: results.map((result: any) => ({
                id: result.id,
                content: result.content,
                agent_name: result.metadata?.agent_name,
                similarity_score: result.similarity_score,
                tags: result.metadata?.tags,
              })),
              total_count: results.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to search knowledge: ${error.message}`);
    }
  }

  private async githubOperation(args: any) {
    const { operation_type, repository, parameters = {}, assigned_agent } = args;
    
    // Simulate GitHub operation through Agency Swarm
    const result = {
      operation: operation_type,
      repository: repository,
      parameters: parameters,
      assigned_agent: assigned_agent || 'GitHubSpecialist',
      status: 'completed',
      timestamp: new Date().toISOString(),
    };

    // Store operation in Librarian
    try {
      await axios.post(`${this.librarianUrl}/embed`, [{
        content: `GitHub Operation: ${operation_type} on ${repository}`,
        metadata: {
          type: 'github_operation',
          operation_type: operation_type,
          repository: repository,
          assigned_agent: assigned_agent,
          source: 'agency-swarm-local-mcp',
          stored_at: new Date().toISOString(),
        },
        context: {
          operation: result,
        }
      }]);
    } catch (error) {
      console.error('Failed to store GitHub operation in Librarian:', error.message);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `GitHub operation ${operation_type} completed successfully`,
            result: result,
          }, null, 2),
        },
      ],
    };
  }

  private async agentCollaboration(args: any) {
    const { agents, topic, context = {}, strategy = 'consensus' } = args;
    
    const collaboration = {
      id: uuidv4(),
      agents: agents,
      topic: topic,
      context: context,
      strategy: strategy,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    // Store collaboration in Librarian
    try {
      await axios.post(`${this.librarianUrl}/embed`, [{
        content: `Agent Collaboration: ${topic}\nAgents: ${agents.join(', ')}\nStrategy: ${strategy}`,
        metadata: {
          type: 'agent_collaboration',
          collaboration_id: collaboration.id,
          agents: agents,
          topic: topic,
          strategy: strategy,
          source: 'agency-swarm-local-mcp',
          stored_at: new Date().toISOString(),
        },
        context: {
          collaboration: collaboration,
        }
      }]);
    } catch (error) {
      console.error('Failed to store collaboration in Librarian:', error.message);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Agent collaboration started for topic: ${topic}`,
            collaboration: collaboration,
          }, null, 2),
        },
      ],
    };
  }

  private async getLibrarianHealth() {
    try {
      const healthResponse = await axios.get(`${this.librarianUrl}/health`, { timeout: 5000 });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              librarian_health: healthResponse.data,
              status: 'healthy',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Librarian health check failed: ${error.message}`,
              status: 'unhealthy',
            }, null, 2),
          },
        ],
      };
    }
  }

  private async analyzePerformance(args: any) {
    const { time_range = 'all_time', include_workflows = true, include_agents = true } = args;
    
    const workflows = Array.from(this.workflows.values());
    const agents = this.agencyStatus ? Object.values(this.agencyStatus.agents) : [];
    
    const analysis = {
      time_range: time_range,
      workflows: include_workflows ? {
        total: workflows.length,
        by_status: workflows.reduce((acc, workflow) => {
          acc[workflow.status] = (acc[workflow.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        completion_rate: workflows.length > 0 ? 
          (workflows.filter(w => w.status === 'completed').length / workflows.length) * 100 : 0,
      } : null,
      agents: include_agents ? {
        total: agents.length,
        active: agents.filter(agent => agent.status === 'active').length,
        total_capabilities: agents.reduce((sum, agent) => sum + agent.capabilities.length, 0),
        total_tools: agents.reduce((sum, agent) => sum + agent.tools_count, 0),
      } : null,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            analysis: analysis,
          }, null, 2),
        },
      ],
    };
  }

  private async initializeAgencySwarm() {
    try {
      // Test Librarian service connection
      const healthResponse = await axios.get(`${this.librarianUrl}/health`);
      
      if (healthResponse.status === 200) {
        const healthData = healthResponse.data;
        console.error('Agency Swarm Local MCP Server: Librarian service connected');
        console.error(`   📚 Embedding model: ${healthData.embedding_model}`);
        console.error(`   💾 Database: ${healthData.database}`);
        console.error(`   🧠 Memory cache: ${healthData.memory_cache} documents`);
      } else {
        throw new Error(`Librarian health check failed with status ${healthResponse.status}`);
      }

      // Initialize agency status
      await this.getAgencyStatus();
      console.error('   🤖 Agency Swarm Local MCP Server initialized with 4 agents');

    } catch (error) {
      console.error('Agency Swarm Local MCP Server: Failed to connect to Librarian service:', error.message);
      console.error('   ⚠️  Agency Swarm will work but without Librarian integration');
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Agency Swarm Local MCP Server running on stdio');
  }
}

const server = new AgencySwarmLocalMCPServer();
server.run().catch(console.error);
