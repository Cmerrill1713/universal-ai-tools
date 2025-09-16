#!/usr/bin/env node

/**
 * Agent Swarm Protocol (ASP) MCP Server
 * Integrates with Librarian service for knowledge management and GitHub MCP for repository operations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Agent Swarm Types
interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  capabilities: string[];
  status: AgentStatus;
  performance_metrics: AgentMetrics;
  created_at: string;
  librarian_id?: string;
}

interface AgentRole {
  type: 'coordinator' | 'worker' | 'specialist' | 'monitor' | 'optimizer' | 'learner' | 'hybrid';
  specialization: string[];
  autonomy_level: 'supervised' | 'semi_autonomous' | 'fully_autonomous';
}

interface AgentStatus {
  state: 'available' | 'working' | 'collaborating' | 'waiting' | 'completed' | 'error';
  current_task?: string;
  collaboration_partners?: string[];
}

interface AgentMetrics {
  tasks_completed: number;
  success_rate: number;
  average_completion_time: number;
  collaboration_score: number;
  quality_score: number;
  knowledge_contributions: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  agents: string[];
  tasks: WorkflowTask[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  librarian_id?: string;
}

interface WorkflowTask {
  id: string;
  name: string;
  description: string;
  assigned_agent?: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  github_operations?: GitHubOperation[];
}

interface GitHubOperation {
  type: 'create_issue' | 'create_pr' | 'review_code' | 'manage_repo';
  parameters: any;
  status: 'pending' | 'completed' | 'failed';
}

interface CollaborationSession {
  id: string;
  agents: string[];
  topic: string;
  context: any;
  status: 'active' | 'completed' | 'failed';
  created_at: string;
}

class AgentSwarmMCPServer {
  private server: Server;
  private librarianUrl: string;
  private githubMCPServer: string;
  private agents: Map<string, Agent> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private collaborations: Map<string, CollaborationSession> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'agent-swarm-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.librarianUrl = process.env.LIBRARIAN_URL || 'http://localhost:8032';
    this.githubMCPServer = process.env.GITHUB_MCP_URL || 'http://localhost:3000';

    this.setupHandlers();
    this.initializeAgentSwarm();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Agent Management Tools
          {
            name: 'agent_swarm_create_agent',
            description: 'Create a new agent with specific capabilities and role',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Agent name' },
                role_type: { 
                  type: 'string', 
                  enum: ['coordinator', 'worker', 'specialist', 'monitor', 'optimizer', 'learner', 'hybrid'],
                  description: 'Agent role type'
                },
                specialization: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Agent specializations'
                },
                autonomy_level: {
                  type: 'string',
                  enum: ['supervised', 'semi_autonomous', 'fully_autonomous'],
                  description: 'Agent autonomy level'
                },
                capabilities: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Agent capabilities'
                }
              },
              required: ['name', 'role_type', 'specialization'],
            },
          },
          {
            name: 'agent_swarm_list_agents',
            description: 'List all available agents and their current status',
            inputSchema: {
              type: 'object',
              properties: {
                status_filter: {
                  type: 'string',
                  enum: ['available', 'working', 'collaborating', 'waiting', 'completed', 'error'],
                  description: 'Filter agents by status'
                },
                role_filter: {
                  type: 'string',
                  description: 'Filter agents by role type'
                }
              },
            },
          },
          {
            name: 'agent_swarm_get_agent',
            description: 'Get detailed information about a specific agent',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: { type: 'string', description: 'Agent ID' },
              },
              required: ['agent_id'],
            },
          },
          // Workflow Management Tools
          {
            name: 'agent_swarm_create_workflow',
            description: 'Create a multi-agent workflow with tasks and dependencies',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Workflow name' },
                description: { type: 'string', description: 'Workflow description' },
                agents: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Agent IDs to include in workflow'
                },
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      assigned_agent: { type: 'string' },
                      dependencies: { type: 'array', items: { type: 'string' } },
                      github_operations: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            parameters: { type: 'object' }
                          }
                        }
                      }
                    }
                  },
                  description: 'Workflow tasks'
                }
              },
              required: ['name', 'description', 'agents', 'tasks'],
            },
          },
          {
            name: 'agent_swarm_execute_workflow',
            description: 'Execute a multi-agent workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string', description: 'Workflow ID' },
                context: { type: 'object', description: 'Execution context' },
              },
              required: ['workflow_id'],
            },
          },
          {
            name: 'agent_swarm_monitor_workflow',
            description: 'Monitor the progress of a running workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string', description: 'Workflow ID' },
              },
              required: ['workflow_id'],
            },
          },
          // Collaboration Tools
          {
            name: 'agent_swarm_collaborate',
            description: 'Enable collaboration between multiple agents',
            inputSchema: {
              type: 'object',
              properties: {
                agents: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Agent IDs to collaborate'
                },
                topic: { type: 'string', description: 'Collaboration topic' },
                context: { type: 'object', description: 'Collaboration context' },
                strategy: {
                  type: 'string',
                  enum: ['sequential', 'parallel', 'iterative', 'hierarchical', 'consensus'],
                  description: 'Collaboration strategy'
                }
              },
              required: ['agents', 'topic'],
            },
          },
          // Knowledge Management Tools
          {
            name: 'agent_swarm_store_knowledge',
            description: 'Store agent knowledge and experience in Librarian service',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: { type: 'string', description: 'Agent ID' },
                knowledge_type: { type: 'string', description: 'Type of knowledge' },
                content: { type: 'string', description: 'Knowledge content' },
                context: { type: 'object', description: 'Knowledge context' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Knowledge tags' }
              },
              required: ['agent_id', 'knowledge_type', 'content'],
            },
          },
          {
            name: 'agent_swarm_search_knowledge',
            description: 'Search agent knowledge base using semantic similarity',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                agent_filter: { type: 'string', description: 'Filter by agent' },
                knowledge_type: { type: 'string', description: 'Filter by knowledge type' },
                limit: { type: 'number', description: 'Maximum results', default: 10 }
              },
              required: ['query'],
            },
          },
          // GitHub Integration Tools
          {
            name: 'agent_swarm_github_automation',
            description: 'Automate GitHub operations through agent swarm',
            inputSchema: {
              type: 'object',
              properties: {
                operation: {
                  type: 'string',
                  enum: ['create_issue', 'create_pr', 'review_code', 'manage_repo'],
                  description: 'GitHub operation type'
                },
                repository: { type: 'string', description: 'Repository (owner/repo)' },
                parameters: { type: 'object', description: 'Operation parameters' },
                assigned_agent: { type: 'string', description: 'Agent to perform operation' }
              },
              required: ['operation', 'repository'],
            },
          },
          {
            name: 'agent_swarm_analyze_performance',
            description: 'Analyze agent swarm performance and provide insights',
            inputSchema: {
              type: 'object',
              properties: {
                time_range: { type: 'string', description: 'Analysis time range' },
                metrics: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Metrics to analyze'
                }
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
          case 'agent_swarm_create_agent':
            return await this.createAgent(args);
          case 'agent_swarm_list_agents':
            return await this.listAgents(args);
          case 'agent_swarm_get_agent':
            return await this.getAgent(args);
          case 'agent_swarm_create_workflow':
            return await this.createWorkflow(args);
          case 'agent_swarm_execute_workflow':
            return await this.executeWorkflow(args);
          case 'agent_swarm_monitor_workflow':
            return await this.monitorWorkflow(args);
          case 'agent_swarm_collaborate':
            return await this.collaborate(args);
          case 'agent_swarm_store_knowledge':
            return await this.storeKnowledge(args);
          case 'agent_swarm_search_knowledge':
            return await this.searchKnowledge(args);
          case 'agent_swarm_github_automation':
            return await this.githubAutomation(args);
          case 'agent_swarm_analyze_performance':
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

  private async createAgent(args: any) {
    const { name, role_type, specialization, autonomy_level = 'semi_autonomous', capabilities = [] } = args;
    
    const agent: Agent = {
      id: uuidv4(),
      name,
      role: {
        type: role_type,
        specialization,
        autonomy_level,
      },
      capabilities,
      status: {
        state: 'available',
      },
      performance_metrics: {
        tasks_completed: 0,
        success_rate: 1.0,
        average_completion_time: 0,
        collaboration_score: 0,
        quality_score: 0,
        knowledge_contributions: 0,
      },
      created_at: new Date().toISOString(),
    };

    // Store agent in Librarian service
    try {
      const librarianResponse = await axios.post(`${this.librarianUrl}/embed`, [{
        content: `Agent: ${name}\nRole: ${role_type}\nSpecialization: ${specialization.join(', ')}\nCapabilities: ${capabilities.join(', ')}\nAutonomy: ${autonomy_level}`,
        metadata: {
          type: 'agent',
          agent_id: agent.id,
          name: name,
          role_type: role_type,
          specialization: specialization,
          capabilities: capabilities,
          autonomy_level: autonomy_level,
          source: 'agent-swarm-mcp',
          stored_at: new Date().toISOString(),
        },
        context: {
          agent_data: agent,
          capabilities: capabilities,
          specialization: specialization,
        }
      }]);

      agent.librarian_id = librarianResponse.data.documents?.[0]?.id;
    } catch (error) {
      console.error('Failed to store agent in Librarian:', error.message);
    }

    this.agents.set(agent.id, agent);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Agent ${name} created successfully`,
            agent: {
              id: agent.id,
              name: agent.name,
              role: agent.role,
              status: agent.status,
              librarian_id: agent.librarian_id,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async listAgents(args: any) {
    const { status_filter, role_filter } = args;
    
    let agents = Array.from(this.agents.values());
    
    if (status_filter) {
      agents = agents.filter(agent => agent.status.state === status_filter);
    }
    
    if (role_filter) {
      agents = agents.filter(agent => agent.role.type === role_filter);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            agents: agents.map(agent => ({
              id: agent.id,
              name: agent.name,
              role: agent.role.type,
              specialization: agent.role.specialization,
              status: agent.status.state,
              capabilities: agent.capabilities,
              performance: agent.performance_metrics,
            })),
            total_count: agents.length,
          }, null, 2),
        },
      ],
    };
  }

  private async getAgent(args: any) {
    const { agent_id } = args;
    
    const agent = this.agents.get(agent_id);
    if (!agent) {
      throw new Error(`Agent ${agent_id} not found`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            agent: agent,
          }, null, 2),
        },
      ],
    };
  }

  private async createWorkflow(args: any) {
    const { name, description, agents, tasks } = args;
    
    const workflow: Workflow = {
      id: uuidv4(),
      name,
      description,
      agents,
      tasks: tasks.map((task: any) => ({
        id: uuidv4(),
        name: task.name,
        description: task.description,
        assigned_agent: task.assigned_agent,
        dependencies: task.dependencies || [],
        status: 'pending' as const,
        github_operations: task.github_operations || [],
      })),
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Store workflow in Librarian service
    try {
      const librarianResponse = await axios.post(`${this.librarianUrl}/embed`, [{
        content: `Workflow: ${name}\nDescription: ${description}\nAgents: ${agents.join(', ')}\nTasks: ${tasks.length} tasks`,
        metadata: {
          type: 'workflow',
          workflow_id: workflow.id,
          name: name,
          description: description,
          agents: agents,
          task_count: tasks.length,
          source: 'agent-swarm-mcp',
          stored_at: new Date().toISOString(),
        },
        context: {
          workflow_data: workflow,
          agents: agents,
          tasks: tasks,
        }
      }]);

      workflow.librarian_id = librarianResponse.data.documents?.[0]?.id;
    } catch (error) {
      console.error('Failed to store workflow in Librarian:', error.message);
    }

    this.workflows.set(workflow.id, workflow);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Workflow ${name} created successfully`,
            workflow: {
              id: workflow.id,
              name: workflow.name,
              agents: workflow.agents,
              task_count: workflow.tasks.length,
              status: workflow.status,
              librarian_id: workflow.librarian_id,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async executeWorkflow(args: any) {
    const { workflow_id, context } = args;
    
    const workflow = this.workflows.get(workflow_id);
    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    workflow.status = 'running';
    
    // Simulate workflow execution
    for (const task of workflow.tasks) {
      task.status = 'running';
      
      // Execute GitHub operations if any
      if (task.github_operations) {
        for (const operation of task.github_operations) {
          operation.status = 'completed';
        }
      }
      
      task.status = 'completed';
    }
    
    workflow.status = 'completed';

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Workflow ${workflow.name} executed successfully`,
            workflow: {
              id: workflow.id,
              name: workflow.name,
              status: workflow.status,
              completed_tasks: workflow.tasks.filter(t => t.status === 'completed').length,
              total_tasks: workflow.tasks.length,
            },
          }, null, 2),
        },
      ],
    };
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
              name: workflow.name,
              status: workflow.status,
              progress: {
                completed_tasks: workflow.tasks.filter(t => t.status === 'completed').length,
                running_tasks: workflow.tasks.filter(t => t.status === 'running').length,
                pending_tasks: workflow.tasks.filter(t => t.status === 'pending').length,
                total_tasks: workflow.tasks.length,
              },
              tasks: workflow.tasks.map(task => ({
                id: task.id,
                name: task.name,
                status: task.status,
                assigned_agent: task.assigned_agent,
              })),
            },
          }, null, 2),
        },
      ],
    };
  }

  private async collaborate(args: any) {
    const { agents, topic, context, strategy = 'consensus' } = args;
    
    const collaboration: CollaborationSession = {
      id: uuidv4(),
      agents,
      topic,
      context: context || {},
      status: 'active',
      created_at: new Date().toISOString(),
    };

    this.collaborations.set(collaboration.id, collaboration);

    // Update agent statuses
    for (const agentId of agents) {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status.state = 'collaborating';
        agent.status.collaboration_partners = agents.filter(id => id !== agentId);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Collaboration session started for topic: ${topic}`,
            collaboration: {
              id: collaboration.id,
              agents: collaboration.agents,
              topic: collaboration.topic,
              strategy: strategy,
              status: collaboration.status,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async storeKnowledge(args: any) {
    const { agent_id, knowledge_type, content, context, tags = [] } = args;
    
    const agent = this.agents.get(agent_id);
    if (!agent) {
      throw new Error(`Agent ${agent_id} not found`);
    }

    try {
      const librarianResponse = await axios.post(`${this.librarianUrl}/embed`, [{
        content: `Agent Knowledge: ${knowledge_type}\nAgent: ${agent.name}\nContent: ${content}`,
        metadata: {
          type: 'agent_knowledge',
          agent_id: agent_id,
          agent_name: agent.name,
          knowledge_type: knowledge_type,
          tags: tags,
          source: 'agent-swarm-mcp',
          stored_at: new Date().toISOString(),
        },
        context: {
          agent_data: agent,
          knowledge_context: context,
          tags: tags,
        }
      }]);

      // Update agent metrics
      agent.performance_metrics.knowledge_contributions += 1;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Knowledge stored successfully for agent ${agent.name}`,
              knowledge_id: librarianResponse.data.documents?.[0]?.id,
              agent: {
                id: agent.id,
                name: agent.name,
                knowledge_contributions: agent.performance_metrics.knowledge_contributions,
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to store knowledge: ${error.message}`);
    }
  }

  private async searchKnowledge(args: any) {
    const { query, agent_filter, knowledge_type, limit = 10 } = args;
    
    try {
      const searchResponse = await axios.get(`${this.librarianUrl}/search?query=${encodeURIComponent(query)}&limit=${limit}`);
      
      let results = searchResponse.data || [];
      
      // Filter by agent if specified
      if (agent_filter) {
        results = results.filter((result: any) => 
          result.metadata?.agent_id === agent_filter || 
          result.metadata?.agent_name === agent_filter
        );
      }
      
      // Filter by knowledge type if specified
      if (knowledge_type) {
        results = results.filter((result: any) => 
          result.metadata?.knowledge_type === knowledge_type
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
                agent: result.metadata?.agent_name,
                knowledge_type: result.metadata?.knowledge_type,
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

  private async githubAutomation(args: any) {
    const { operation, repository, parameters, assigned_agent } = args;
    
    const agent = assigned_agent ? this.agents.get(assigned_agent) : null;
    
    // Simulate GitHub operation through agent
    const result = {
      operation,
      repository,
      parameters,
      agent: agent ? {
        id: agent.id,
        name: agent.name,
        role: agent.role.type,
      } : null,
      status: 'completed',
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `GitHub operation ${operation} completed successfully`,
            result: result,
          }, null, 2),
        },
      ],
    };
  }

  private async analyzePerformance(args: any) {
    const { time_range, metrics } = args;
    
    const agents = Array.from(this.agents.values());
    const workflows = Array.from(this.workflows.values());
    const collaborations = Array.from(this.collaborations.values());
    
    const analysis = {
      time_range: time_range || 'all_time',
      agents: {
        total: agents.length,
        by_status: agents.reduce((acc, agent) => {
          acc[agent.status.state] = (acc[agent.status.state] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        average_performance: {
          success_rate: agents.reduce((sum, agent) => sum + agent.performance_metrics.success_rate, 0) / agents.length,
          collaboration_score: agents.reduce((sum, agent) => sum + agent.performance_metrics.collaboration_score, 0) / agents.length,
          quality_score: agents.reduce((sum, agent) => sum + agent.performance_metrics.quality_score, 0) / agents.length,
        },
      },
      workflows: {
        total: workflows.length,
        by_status: workflows.reduce((acc, workflow) => {
          acc[workflow.status] = (acc[workflow.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      collaborations: {
        total: collaborations.length,
        active: collaborations.filter(c => c.status === 'active').length,
      },
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

  private async initializeAgentSwarm() {
    try {
      // Test Librarian service connection
      const healthResponse = await axios.get(`${this.librarianUrl}/health`);
      
      if (healthResponse.status === 200) {
        const healthData = healthResponse.data;
        console.error('Agent Swarm MCP Server: Librarian service connected');
        console.error(`   📚 Embedding model: ${healthData.embedding_model}`);
        console.error(`   💾 Database: ${healthData.database}`);
        console.error(`   🧠 Memory cache: ${healthData.memory_cache} documents`);
      } else {
        throw new Error(`Librarian health check failed with status ${healthResponse.status}`);
      }

      // Create default agents
      await this.createDefaultAgents();

    } catch (error) {
      console.error('Agent Swarm MCP Server: Failed to connect to Librarian service:', error.message);
      console.error('   ⚠️  Agent Swarm will work but without Librarian integration');
    }
  }

  private async createDefaultAgents() {
    const defaultAgents = [
      {
        name: 'Coordinator Agent',
        role_type: 'coordinator',
        specialization: ['orchestration', 'workflow_management'],
        capabilities: ['coordinate_agents', 'manage_workflows', 'resolve_conflicts'],
      },
      {
        name: 'GitHub Specialist',
        role_type: 'specialist',
        specialization: ['github_operations', 'repository_management'],
        capabilities: ['create_issues', 'manage_prs', 'code_review', 'repository_analysis'],
      },
      {
        name: 'Knowledge Manager',
        role_type: 'specialist',
        specialization: ['knowledge_management', 'semantic_search'],
        capabilities: ['store_knowledge', 'search_knowledge', 'context_sharing'],
      },
    ];

    for (const agentData of defaultAgents) {
      await this.createAgent(agentData);
    }

    console.error(`   🤖 Created ${defaultAgents.length} default agents`);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Agent Swarm MCP Server running on stdio');
  }
}

const server = new AgentSwarmMCPServer();
server.run().catch(console.error);
