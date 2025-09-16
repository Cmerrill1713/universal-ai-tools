#!/usr/bin/env node
/**
 * Universal AI Tools BMAD MCP Server
 * Provides BMAD (Breakthrough Method for Agile AI-Driven Development) workflow orchestration
 * through Model Context Protocol integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// BMAD Workflow Types
interface BMADConfig {
  project_name: string;
  project_type: 'WebApplication' | 'MobileApp' | 'DesktopApp' | 'ApiService' | 'Microservice' | 'DataPipeline' | 'MLModel' | 'DevOpsTool' | 'Game' | 'Other';
  complexity_level: 'Simple' | 'Moderate' | 'Complex' | 'Enterprise';
  target_platforms: string[];
  required_artifacts: string[];
  collaboration_mode: 'Sequential' | 'Parallel' | 'Collaborative' | 'Hierarchical';
  context_preservation: boolean;
}

interface UserInput {
  project_name: string;
  project_description: string;
  target_users: string[];
  key_features: string[];
  constraints: string[];
  success_metrics: string[];
  timeline?: string;
  budget?: string;
  technical_preferences: string[];
}

interface ProjectArtifact {
  id: string;
  artifact_type: string;
  title: string;
  content: string;
  metadata: {
    complexity_score: number;
    completeness_score: number;
    quality_score: number;
    tags: string[];
    review_status: 'Draft' | 'UnderReview' | 'Approved' | 'NeedsRevision' | 'Rejected';
    approval_status: 'Pending' | 'Approved' | 'Rejected' | 'RequiresChanges';
  };
  created_by: string;
  created_at: string;
  version: number;
  dependencies: string[];
}

interface WorkflowStep {
  phase: 'Planning' | 'Development' | 'Completed';
  step_name: string;
  artifacts_generated: number;
  next_actions: string[];
}

interface BMADWorkflow {
  workflow_id: string;
  current_phase: 'Planning' | 'Development' | 'Completed';
  config: BMADConfig;
  user_input: UserInput;
  artifacts: ProjectArtifact[];
  created_at: string;
  status: 'Active' | 'Paused' | 'Completed' | 'Failed';
  priming_questions: PrimingQuestion[];
  context_gathering_complete: boolean;
}

interface PrimingQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  description: string;
  answer_type: AnswerType;
  required: boolean;
  priority: QuestionPriority;
  follow_up_questions: string[];
  answered: boolean;
  answer?: string;
  additional_context?: string;
}

interface QuestionCategory {
  name: string;
  description: string;
  questions: PrimingQuestion[];
}

interface AnswerType {
  type: 'text' | 'multiple_choice' | 'yes_no' | 'number' | 'list' | 'file';
  options?: string[];
  validation?: string;
}

interface QuestionPriority {
  level: 'Critical' | 'High' | 'Medium' | 'Low';
  order: number;
}

class BMADMCPServer {
  private server: Server;
  private workflows: Map<string, BMADWorkflow> = new Map();
  private activeWorkflows: Set<string> = new Set();

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'bmad-universal-ai',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  private setupToolHandlers(): void {
    // List available BMAD tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'start_bmad_workflow',
            description: 'Start a new BMAD workflow with project configuration',
            inputSchema: {
              type: 'object',
              properties: {
                config: {
                  type: 'object',
                  properties: {
                    project_name: { type: 'string' },
                    project_type: { type: 'string', enum: ['WebApplication', 'MobileApp', 'DesktopApp', 'ApiService', 'Microservice', 'DataPipeline', 'MLModel', 'DevOpsTool', 'Game', 'Other'] },
                    complexity_level: { type: 'string', enum: ['Simple', 'Moderate', 'Complex', 'Enterprise'] },
                    target_platforms: { type: 'array', items: { type: 'string' } },
                    required_artifacts: { type: 'array', items: { type: 'string' } },
                    collaboration_mode: { type: 'string', enum: ['Sequential', 'Parallel', 'Collaborative', 'Hierarchical'] },
                    context_preservation: { type: 'boolean' }
                  },
                  required: ['project_name', 'project_type', 'complexity_level', 'target_platforms', 'required_artifacts', 'collaboration_mode', 'context_preservation']
                },
                user_input: {
                  type: 'object',
                  properties: {
                    project_name: { type: 'string' },
                    project_description: { type: 'string' },
                    target_users: { type: 'array', items: { type: 'string' } },
                    key_features: { type: 'array', items: { type: 'string' } },
                    constraints: { type: 'array', items: { type: 'string' } },
                    success_metrics: { type: 'array', items: { type: 'string' } },
                    timeline: { type: 'string' },
                    budget: { type: 'string' },
                    technical_preferences: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['project_name', 'project_description', 'target_users', 'key_features', 'constraints', 'success_metrics', 'technical_preferences']
                }
              },
              required: ['config', 'user_input']
            }
          },
          {
            name: 'gather_project_context',
            description: 'Gather comprehensive project context through intelligent priming questions',
            inputSchema: {
              type: 'object',
              properties: {
                project_type: { type: 'string', enum: ['WebApplication', 'MobileApp', 'DesktopApp', 'ApiService', 'Microservice', 'DataPipeline', 'MLModel', 'DevOpsTool', 'Game', 'Other'] },
                initial_description: { type: 'string' },
                user_experience_level: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
                skip_questions: { type: 'array', items: { type: 'string' } }
              },
              required: ['project_type', 'initial_description']
            }
          },
          {
            name: 'answer_priming_question',
            description: 'Answer a specific priming question to provide more context',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string' },
                question_id: { type: 'string' },
                answer: { type: 'string' },
                additional_context: { type: 'string' }
              },
              required: ['workflow_id', 'question_id', 'answer']
            }
          },
          {
            name: 'get_workflow_status',
            description: 'Get the current status of a BMAD workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string' }
              },
              required: ['workflow_id']
            }
          },
          {
            name: 'get_workflow_artifacts',
            description: 'Get all artifacts generated by a BMAD workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string' },
                artifact_type: { type: 'string' }
              },
              required: ['workflow_id']
            }
          },
          {
            name: 'advance_workflow_phase',
            description: 'Advance a BMAD workflow to the next phase',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string' }
              },
              required: ['workflow_id']
            }
          },
          {
            name: 'generate_project_artifact',
            description: 'Generate a specific project artifact using BMAD agents',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string' },
                artifact_type: { type: 'string', enum: ['PRD', 'TechnicalArchitecture', 'UXBrief', 'APISpecification', 'DatabaseSchema', 'DeploymentPlan', 'TestingStrategy', 'SecurityPlan', 'PerformancePlan', 'DocumentationPlan'] },
                agent_role: { type: 'string', enum: ['ProductManager', 'Architect', 'Designer', 'FrontendDeveloper', 'BackendDeveloper', 'MLEngineer', 'DevOpsEngineer', 'QAEngineer', 'CodeReviewer'] }
              },
              required: ['workflow_id', 'artifact_type', 'agent_role']
            }
          },
          {
            name: 'collaborate_agents',
            description: 'Initiate agent collaboration for artifact generation',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string' },
                collaboration_strategy: { type: 'string', enum: ['Sequential', 'Parallel', 'Iterative', 'Hierarchical'] },
                artifact_types: { type: 'array', items: { type: 'string' } }
              },
              required: ['workflow_id', 'collaboration_strategy', 'artifact_types']
            }
          },
          {
            name: 'review_artifact',
            description: 'Review and provide feedback on a project artifact',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string' },
                artifact_id: { type: 'string' },
                feedback: { type: 'string' },
                approval_status: { type: 'string', enum: ['Approved', 'Rejected', 'RequiresChanges'] }
              },
              required: ['workflow_id', 'artifact_id', 'feedback', 'approval_status']
            }
          },
          {
            name: 'export_workflow_results',
            description: 'Export all workflow results and artifacts',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string' },
                format: { type: 'string', enum: ['JSON', 'Markdown', 'PDF'] }
              },
              required: ['workflow_id', 'format']
            }
          }
        ]
      };
    });

    // Tool call handlers
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'start_bmad_workflow':
            return await this.startBMADWorkflow(args as unknown as { config: BMADConfig; user_input: UserInput });
          case 'gather_project_context':
            return await this.gatherProjectContext(args as unknown as { project_type: string; initial_description: string; user_experience_level?: string; skip_questions?: string[] });
          case 'answer_priming_question':
            return await this.answerPrimingQuestion(args as unknown as { workflow_id: string; question_id: string; answer: string; additional_context?: string });
          case 'get_workflow_status':
            return await this.getWorkflowStatus(args as unknown as { workflow_id: string });
          case 'get_workflow_artifacts':
            return await this.getWorkflowArtifacts(args as unknown as { workflow_id: string; artifact_type?: string });
          case 'advance_workflow_phase':
            return await this.advanceWorkflowPhase(args as unknown as { workflow_id: string });
          case 'generate_project_artifact':
            return await this.generateProjectArtifact(args as unknown as { workflow_id: string; artifact_type: string; agent_role: string });
          case 'collaborate_agents':
            return await this.collaborateAgents(args as unknown as { workflow_id: string; collaboration_strategy: string; artifact_types: string[] });
          case 'review_artifact':
            return await this.reviewArtifact(args as unknown as { workflow_id: string; artifact_id: string; feedback: string; approval_status: string });
          case 'export_workflow_results':
            return await this.exportWorkflowResults(args as unknown as { workflow_id: string; format: string });
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'bmad://workflows',
            name: 'BMAD Workflows',
            description: 'List of all BMAD workflows',
            mimeType: 'application/json',
          },
          {
            uri: 'bmad://agents',
            name: 'BMAD Agents',
            description: 'Available BMAD agents and their capabilities',
            mimeType: 'application/json',
          },
          {
            uri: 'bmad://templates',
            name: 'BMAD Templates',
            description: 'BMAD workflow templates and examples',
            mimeType: 'application/json',
          },
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'bmad://workflows':
          return await this.getWorkflowsResource();
        case 'bmad://agents':
          return await this.getAgentsResource();
        case 'bmad://templates':
          return await this.getTemplatesResource();
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  // Tool implementations
  private async gatherProjectContext(args: { project_type: string; initial_description: string; user_experience_level?: string; skip_questions?: string[] }): Promise<CallToolResult> {
    const { project_type, initial_description, user_experience_level = 'Intermediate', skip_questions = [] } = args;
    
    // Generate intelligent priming questions based on project type
    const primingQuestions = this.generatePrimingQuestions(project_type, initial_description, user_experience_level, skip_questions);
    
    // Create a temporary workflow for context gathering
    const tempWorkflowId = `context_gathering_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const tempWorkflow: BMADWorkflow = {
      workflow_id: tempWorkflowId,
      current_phase: 'Planning',
      config: {
        project_name: 'Context Gathering',
        project_type: project_type as any,
        complexity_level: 'Moderate',
        target_platforms: [],
        required_artifacts: [],
        collaboration_mode: 'Collaborative',
        context_preservation: true
      },
      user_input: {
        project_name: 'Context Gathering',
        project_description: initial_description,
        target_users: [],
        key_features: [],
        constraints: [],
        success_metrics: [],
        technical_preferences: []
      },
      artifacts: [],
      created_at: new Date().toISOString(),
      status: 'Active',
      priming_questions: primingQuestions,
      context_gathering_complete: false
    };
    
    this.workflows.set(tempWorkflowId, tempWorkflow);
    
    // Get the first critical question to ask
    const firstQuestion = primingQuestions.find(q => q.priority.level === 'Critical' && !q.answered);
    
    return {
      content: [
        {
          type: 'text',
          text: `🎯 **BMAD Context Gathering Started!**

**Project Type:** ${project_type}
**Initial Description:** ${initial_description}
**User Experience Level:** ${user_experience_level}

**Context Gathering Workflow ID:** ${tempWorkflowId}

I'll ask you a series of intelligent priming questions to gather comprehensive context for your project. This ensures we have enough information to build exactly what you need.

**First Critical Question:**

**${firstQuestion?.question}**

*${firstQuestion?.description}*

**Answer Type:** ${firstQuestion?.answer_type.type}
${firstQuestion?.answer_type.options ? `**Options:** ${firstQuestion.answer_type.options.join(', ')}` : ''}

Please provide your answer using the \`answer_priming_question\` tool with:
- workflow_id: "${tempWorkflowId}"
- question_id: "${firstQuestion?.id}"
- answer: "your answer here"

**Total Questions:** ${primingQuestions.length}
**Critical Questions:** ${primingQuestions.filter(q => q.priority.level === 'Critical').length}
**High Priority:** ${primingQuestions.filter(q => q.priority.level === 'High').length}
**Medium Priority:** ${primingQuestions.filter(q => q.priority.level === 'Medium').length}

This systematic approach ensures we capture all the context needed for successful project development! 🚀`,
        },
      ],
    };
  }

  private async answerPrimingQuestion(args: { workflow_id: string; question_id: string; answer: string; additional_context?: string }): Promise<CallToolResult> {
    const { workflow_id, question_id, answer, additional_context } = args;
    const workflow = this.workflows.get(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    // Find and update the question
    const question = workflow.priming_questions.find(q => q.id === question_id);
    if (!question) {
      throw new Error(`Question ${question_id} not found`);
    }

    question.answered = true;
    question.answer = answer;
    question.additional_context = additional_context;

    // Check if context gathering is complete
    const criticalQuestionsAnswered = workflow.priming_questions
      .filter(q => q.priority.level === 'Critical')
      .every(q => q.answered);

    if (criticalQuestionsAnswered) {
      workflow.context_gathering_complete = true;
      
      // Generate comprehensive user input from answers
      const comprehensiveUserInput = this.generateComprehensiveUserInput(workflow);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **Context Gathering Complete!**

**Question Answered:** ${question.question}
**Your Answer:** ${answer}
${additional_context ? `**Additional Context:** ${additional_context}` : ''}

**🎉 All Critical Questions Answered!**

**Comprehensive Project Context Generated:**

**Project Name:** ${comprehensiveUserInput.project_name}
**Description:** ${comprehensiveUserInput.project_description}
**Target Users:** ${comprehensiveUserInput.target_users.join(', ')}
**Key Features:** ${comprehensiveUserInput.key_features.join(', ')}
**Constraints:** ${comprehensiveUserInput.constraints.join(', ')}
**Success Metrics:** ${comprehensiveUserInput.success_metrics.join(', ')}
**Technical Preferences:** ${comprehensiveUserInput.technical_preferences.join(', ')}

**Next Steps:**
1. Review the generated context above
2. Use \`start_bmad_workflow\` with this comprehensive context
3. Begin the BMAD workflow with full project understanding

**Ready to start your BMAD workflow with complete context!** 🚀

**Workflow ID:** ${workflow_id}
**Context Complete:** ✅`,
          },
        ],
      };
    } else {
      // Get next question to ask
      const nextQuestion = workflow.priming_questions
        .filter(q => !q.answered)
        .sort((a, b) => a.priority.order - b.priority.order)[0];

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Question Answered Successfully!**

**Question:** ${question.question}
**Your Answer:** ${answer}
${additional_context ? `**Additional Context:** ${additional_context}` : ''}

**Progress:** ${workflow.priming_questions.filter(q => q.answered).length}/${workflow.priming_questions.length} questions answered

**Next Question:**

**${nextQuestion?.question}**

*${nextQuestion?.description}*

**Priority:** ${nextQuestion?.priority.level}
**Answer Type:** ${nextQuestion?.answer_type.type}
${nextQuestion?.answer_type.options ? `**Options:** ${nextQuestion.answer_type.options.join(', ')}` : ''}

Please answer this question using:
- workflow_id: "${workflow_id}"
- question_id: "${nextQuestion?.id}"
- answer: "your answer here"

**Remaining Questions:** ${workflow.priming_questions.filter(q => !q.answered).length}
**Critical Questions Remaining:** ${workflow.priming_questions.filter(q => q.priority.level === 'Critical' && !q.answered).length}`,
          },
        ],
      };
    }
  }

  private async startBMADWorkflow(args: { config: BMADConfig; user_input: UserInput }): Promise<CallToolResult> {
    const { config, user_input } = args;
    const workflow_id = `bmad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const workflow: BMADWorkflow = {
      workflow_id,
      current_phase: 'Planning',
      config,
      user_input,
      artifacts: [],
      created_at: new Date().toISOString(),
      status: 'Active',
      priming_questions: [],
      context_gathering_complete: true // Assume context is complete if using start_bmad_workflow directly
    };

    this.workflows.set(workflow_id, workflow);
    this.activeWorkflows.add(workflow_id);

    // Initialize planning phase
    const planningArtifacts = await this.generatePlanningArtifacts(workflow);

    return {
      content: [
        {
          type: 'text',
          text: `🚀 BMAD Workflow Started!\n\nWorkflow ID: ${workflow_id}\nPhase: ${workflow.current_phase}\nProject: ${config.project_name}\nComplexity: ${config.complexity_level}\n\nGenerated ${planningArtifacts.length} initial artifacts:\n${planningArtifacts.map(a => `- ${a.title}`).join('\n')}\n\nNext Actions:\n- Review generated artifacts\n- Provide feedback on artifacts\n- Advance to Development phase when ready`,
        },
      ],
    };
  }

  private async getWorkflowStatus(args: { workflow_id: string }): Promise<CallToolResult> {
    const { workflow_id } = args;
    const workflow = this.workflows.get(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    const status = {
      workflow_id: workflow.workflow_id,
      current_phase: workflow.current_phase,
      status: workflow.status,
      artifacts_count: workflow.artifacts.length,
      artifacts_by_type: this.groupArtifactsByType(workflow.artifacts),
      created_at: workflow.created_at,
      progress_percentage: this.calculateProgress(workflow)
    };

    return {
      content: [
        {
          type: 'text',
          text: `📊 BMAD Workflow Status\n\n${JSON.stringify(status, null, 2)}`,
        },
      ],
    };
  }

  private async getWorkflowArtifacts(args: { workflow_id: string; artifact_type?: string }): Promise<CallToolResult> {
    const { workflow_id, artifact_type } = args;
    const workflow = this.workflows.get(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    let artifacts = workflow.artifacts;
    if (artifact_type) {
      artifacts = artifacts.filter(a => a.artifact_type === artifact_type);
    }

    return {
      content: [
        {
          type: 'text',
          text: `📋 BMAD Workflow Artifacts\n\n${JSON.stringify(artifacts, null, 2)}`,
        },
      ],
    };
  }

  private async advanceWorkflowPhase(args: { workflow_id: string }): Promise<CallToolResult> {
    const { workflow_id } = args;
    const workflow = this.workflows.get(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    if (workflow.current_phase === 'Planning') {
      workflow.current_phase = 'Development';
      workflow.status = 'Active';
      
      // Generate development context
      const devContext = await this.generateDevelopmentContext(workflow);
      
      return {
        content: [
          {
            type: 'text',
            text: `🔄 Workflow Advanced to Development Phase!\n\nWorkflow ID: ${workflow_id}\nNew Phase: ${workflow.current_phase}\n\nDevelopment Context Generated:\n${devContext}\n\nNext Actions:\n- Begin implementation\n- Set up project structure\n- Configure development tools\n- Start coding with AI assistance`,
          },
        ],
      };
    } else if (workflow.current_phase === 'Development') {
      workflow.current_phase = 'Completed';
      workflow.status = 'Completed';
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ BMAD Workflow Completed!\n\nWorkflow ID: ${workflow_id}\nFinal Phase: ${workflow.current_phase}\nTotal Artifacts: ${workflow.artifacts.length}\n\nAll project artifacts have been generated and the development phase is complete.`,
          },
        ],
      };
    } else {
      throw new Error(`Workflow ${workflow_id} is already completed`);
    }
  }

  private async generateProjectArtifact(args: { workflow_id: string; artifact_type: string; agent_role: string }): Promise<CallToolResult> {
    const { workflow_id, artifact_type, agent_role } = args;
    const workflow = this.workflows.get(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    const artifact = await this.createArtifact(artifact_type, agent_role, workflow);
    workflow.artifacts.push(artifact);

    return {
      content: [
        {
          type: 'text',
          text: `📄 Project Artifact Generated!\n\nArtifact ID: ${artifact.id}\nType: ${artifact.artifact_type}\nTitle: ${artifact.title}\nCreated by: ${artifact.created_by}\nVersion: ${artifact.version}\n\nContent Preview:\n${artifact.content.substring(0, 500)}...`,
        },
      ],
    };
  }

  private async collaborateAgents(args: { workflow_id: string; collaboration_strategy: string; artifact_types: string[] }): Promise<CallToolResult> {
    const { workflow_id, collaboration_strategy, artifact_types } = args;
    const workflow = this.workflows.get(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    const collaborationResults = await this.executeAgentCollaboration(workflow, collaboration_strategy, artifact_types);

    return {
      content: [
        {
          type: 'text',
          text: `🤝 Agent Collaboration Complete!\n\nStrategy: ${collaboration_strategy}\nArtifacts Generated: ${collaborationResults.length}\n\nResults:\n${collaborationResults.map(r => `- ${r.title} (${r.artifact_type})`).join('\n')}`,
        },
      ],
    };
  }

  private async reviewArtifact(args: { workflow_id: string; artifact_id: string; feedback: string; approval_status: string }): Promise<CallToolResult> {
    const { workflow_id, artifact_id, feedback, approval_status } = args;
    const workflow = this.workflows.get(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    const artifact = workflow.artifacts.find(a => a.id === artifact_id);
    if (!artifact) {
      throw new Error(`Artifact ${artifact_id} not found`);
    }

    artifact.metadata.approval_status = approval_status as any;
    artifact.metadata.review_status = 'UnderReview';
    artifact.content += `\n\n--- Review Feedback ---\n${feedback}\n\nApproval Status: ${approval_status}`;

    return {
      content: [
        {
          type: 'text',
          text: `📝 Artifact Review Complete!\n\nArtifact ID: ${artifact_id}\nTitle: ${artifact.title}\nApproval Status: ${approval_status}\n\nFeedback:\n${feedback}`,
        },
      ],
    };
  }

  private async exportWorkflowResults(args: { workflow_id: string; format: string }): Promise<CallToolResult> {
    const { workflow_id, format } = args;
    const workflow = this.workflows.get(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found`);
    }

    let exportData: string;
    
    switch (format) {
      case 'JSON':
        exportData = JSON.stringify(workflow, null, 2);
        break;
      case 'Markdown':
        exportData = this.generateMarkdownExport(workflow);
        break;
      case 'PDF':
        exportData = 'PDF export not yet implemented';
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `📤 Workflow Export Complete!\n\nFormat: ${format}\nWorkflow ID: ${workflow_id}\n\nExport Data:\n${exportData}`,
        },
      ],
    };
  }

  // Helper methods
  private generatePrimingQuestions(projectType: string, initialDescription: string, userExperienceLevel: string, skipQuestions: string[]): PrimingQuestion[] {
    const questions: PrimingQuestion[] = [];
    let questionOrder = 1;

    // Core Project Questions (Critical)
    questions.push({
      id: 'project_name',
      category: { name: 'Project Basics', description: 'Fundamental project information', questions: [] },
      question: 'What is the name of your project?',
      description: 'Provide a clear, descriptive name for your project that reflects its purpose.',
      answer_type: { type: 'text', validation: 'min_length:3' },
      required: true,
      priority: { level: 'Critical', order: questionOrder++ },
      follow_up_questions: [],
      answered: false
    });

    questions.push({
      id: 'project_purpose',
      category: { name: 'Project Basics', description: 'Fundamental project information', questions: [] },
      question: 'What is the main purpose of your project?',
      description: 'Describe what problem your project solves or what value it provides.',
      answer_type: { type: 'text', validation: 'min_length:20' },
      required: true,
      priority: { level: 'Critical', order: questionOrder++ },
      follow_up_questions: ['target_users', 'key_features'],
      answered: false
    });

    questions.push({
      id: 'target_users',
      category: { name: 'User Analysis', description: 'Understanding your target audience', questions: [] },
      question: 'Who are your target users?',
      description: 'Describe the people who will use your project. Include demographics, technical skill level, and use cases.',
      answer_type: { type: 'text', validation: 'min_length:10' },
      required: true,
      priority: { level: 'Critical', order: questionOrder++ },
      follow_up_questions: ['user_needs', 'accessibility_requirements'],
      answered: false
    });

    questions.push({
      id: 'key_features',
      category: { name: 'Feature Requirements', description: 'Core functionality and features', questions: [] },
      question: 'What are the key features your project must have?',
      description: 'List the essential features that define your project. Focus on core functionality first.',
      answer_type: { type: 'list', validation: 'min_items:3' },
      required: true,
      priority: { level: 'Critical', order: questionOrder++ },
      follow_up_questions: ['feature_priorities', 'technical_requirements'],
      answered: false
    });

    // Project Type Specific Questions
    switch (projectType) {
      case 'WebApplication':
        questions.push({
          id: 'web_platforms',
          category: { name: 'Platform Requirements', description: 'Target platforms and devices', questions: [] },
          question: 'Which platforms should your web application support?',
          description: 'Consider desktop browsers, mobile devices, tablets, and specific browser requirements.',
          answer_type: { 
            type: 'multiple_choice', 
            options: ['Desktop Browsers', 'Mobile Devices', 'Tablets', 'Progressive Web App', 'All Platforms'] 
          },
          required: true,
          priority: { level: 'High', order: questionOrder++ },
          follow_up_questions: ['responsive_design', 'performance_requirements'],
          answered: false
        });
        break;

      case 'MobileApp':
        questions.push({
          id: 'mobile_platforms',
          category: { name: 'Platform Requirements', description: 'Target platforms and devices', questions: [] },
          question: 'Which mobile platforms do you want to target?',
          description: 'Choose the mobile platforms for your application.',
          answer_type: { 
            type: 'multiple_choice', 
            options: ['iOS', 'Android', 'Both iOS and Android', 'Cross-platform (React Native/Flutter)'] 
          },
          required: true,
          priority: { level: 'High', order: questionOrder++ },
          follow_up_questions: ['native_vs_cross_platform', 'app_store_requirements'],
          answered: false
        });
        break;

      case 'ApiService':
        questions.push({
          id: 'api_consumers',
          category: { name: 'API Design', description: 'API architecture and consumption', questions: [] },
          question: 'Who will consume your API?',
          description: 'Describe the clients that will use your API (web apps, mobile apps, other services, etc.).',
          answer_type: { type: 'text', validation: 'min_length:10' },
          required: true,
          priority: { level: 'High', order: questionOrder++ },
          follow_up_questions: ['api_authentication', 'rate_limiting'],
          answered: false
        });
        break;

      case 'MLModel':
        questions.push({
          id: 'ml_objective',
          category: { name: 'ML Requirements', description: 'Machine learning objectives and data', questions: [] },
          question: 'What is your machine learning objective?',
          description: 'Describe what you want your ML model to predict, classify, or analyze.',
          answer_type: { type: 'text', validation: 'min_length:15' },
          required: true,
          priority: { level: 'High', order: questionOrder++ },
          follow_up_questions: ['data_sources', 'model_performance'],
          answered: false
        });
        break;
    }

    // Technical Questions (High Priority)
    questions.push({
      id: 'technical_preferences',
      category: { name: 'Technical Stack', description: 'Technology preferences and constraints', questions: [] },
      question: 'Do you have any specific technology preferences or constraints?',
      description: 'Mention programming languages, frameworks, databases, or any technical requirements you have.',
      answer_type: { type: 'text' },
      required: false,
      priority: { level: 'High', order: questionOrder++ },
      follow_up_questions: ['deployment_preferences', 'scalability_requirements'],
      answered: false
    });

    questions.push({
      id: 'timeline',
      category: { name: 'Project Planning', description: 'Timeline and resource planning', questions: [] },
      question: 'What is your project timeline?',
      description: 'When do you need this project completed? Include any important milestones or deadlines.',
      answer_type: { type: 'text' },
      required: false,
      priority: { level: 'High', order: questionOrder++ },
      follow_up_questions: ['resource_availability', 'priority_features'],
      answered: false
    });

    questions.push({
      id: 'budget',
      category: { name: 'Project Planning', description: 'Timeline and resource planning', questions: [] },
      question: 'What is your budget for this project?',
      description: 'Include development costs, hosting, third-party services, and any other expenses.',
      answer_type: { type: 'text' },
      required: false,
      priority: { level: 'Medium', order: questionOrder++ },
      follow_up_questions: ['cost_optimization', 'free_alternatives'],
      answered: false
    });

    // Success Metrics (High Priority)
    questions.push({
      id: 'success_metrics',
      category: { name: 'Success Criteria', description: 'How to measure project success', questions: [] },
      question: 'How will you measure the success of your project?',
      description: 'Define key performance indicators, user engagement metrics, or business goals.',
      answer_type: { type: 'text' },
      required: false,
      priority: { level: 'High', order: questionOrder++ },
      follow_up_questions: ['analytics_requirements', 'monitoring_setup'],
      answered: false
    });

    // Constraints and Requirements (Medium Priority)
    questions.push({
      id: 'constraints',
      category: { name: 'Constraints', description: 'Limitations and requirements', questions: [] },
      question: 'Are there any constraints or limitations for your project?',
      description: 'Include technical limitations, compliance requirements, security needs, or other constraints.',
      answer_type: { type: 'text' },
      required: false,
      priority: { level: 'Medium', order: questionOrder++ },
      follow_up_questions: ['security_requirements', 'compliance_needs'],
      answered: false
    });

    // User Experience Level Specific Questions
    if (userExperienceLevel === 'Beginner') {
      questions.push({
        id: 'technical_support',
        category: { name: 'Support Requirements', description: 'Technical support and guidance', questions: [] },
        question: 'What level of technical support do you need?',
        description: 'Consider documentation, tutorials, code examples, and ongoing support requirements.',
        answer_type: { 
          type: 'multiple_choice', 
          options: ['Comprehensive Documentation', 'Video Tutorials', 'Code Examples', 'Live Support', 'All of the Above'] 
        },
        required: false,
        priority: { level: 'Medium', order: questionOrder++ },
        follow_up_questions: [],
        answered: false
      });
    }

    // Filter out skipped questions
    return questions.filter(q => !skipQuestions.includes(q.id));
  }

  private generateComprehensiveUserInput(workflow: BMADWorkflow): UserInput {
    const answers = workflow.priming_questions.reduce((acc, q) => {
      if (q.answered && q.answer) {
        acc[q.id] = q.answer;
      }
      return acc;
    }, {} as Record<string, string>);

    return {
      project_name: answers.project_name || 'Unnamed Project',
      project_description: answers.project_purpose || workflow.user_input.project_description,
      target_users: this.extractListFromAnswer(answers.target_users) || [],
      key_features: this.extractListFromAnswer(answers.key_features) || [],
      constraints: this.extractListFromAnswer(answers.constraints) || [],
      success_metrics: this.extractListFromAnswer(answers.success_metrics) || [],
      timeline: answers.timeline || undefined,
      budget: answers.budget || undefined,
      technical_preferences: this.extractListFromAnswer(answers.technical_preferences) || []
    };
  }

  private extractListFromAnswer(answer?: string): string[] {
    if (!answer) return [];
    
    // Try to parse as JSON array first
    try {
      const parsed = JSON.parse(answer);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item));
      }
    } catch {
      // Not JSON, continue with text parsing
    }
    
    // Parse comma-separated or newline-separated values
    return answer
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  private async generatePlanningArtifacts(workflow: BMADWorkflow): Promise<ProjectArtifact[]> {
    const artifacts: ProjectArtifact[] = [];
    
    // Generate core artifacts based on required_artifacts
    for (const artifactType of workflow.config.required_artifacts) {
      const artifact = await this.createArtifact(artifactType, 'ProductManager', workflow);
      artifacts.push(artifact);
    }
    
    workflow.artifacts.push(...artifacts);
    return artifacts;
  }

  private async createArtifact(artifactType: string, agentRole: string, workflow: BMADWorkflow): Promise<ProjectArtifact> {
    const artifactId = `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const content = await this.generateArtifactContent(artifactType, workflow.user_input, agentRole);
    
    return {
      id: artifactId,
      artifact_type: artifactType,
      title: this.getArtifactTitle(artifactType),
      content,
      metadata: {
        complexity_score: this.calculateComplexityScore(workflow.user_input),
        completeness_score: 0.8,
        quality_score: 0.7,
        tags: [artifactType, ...workflow.user_input.technical_preferences],
        review_status: 'Draft',
        approval_status: 'Pending'
      },
      created_by: agentRole,
      created_at: new Date().toISOString(),
      version: 1,
      dependencies: []
    };
  }

  private async generateArtifactContent(artifactType: string, userInput: UserInput, agentRole: string): Promise<string> {
    // This would integrate with your existing LLM services
    // For now, generating template content
    
    switch (artifactType) {
      case 'PRD':
        return `# Product Requirements Document: ${userInput.project_name}

## Project Overview
${userInput.project_description}

## Target Users
${userInput.target_users.join(', ')}

## Key Features
${userInput.key_features.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## Success Metrics
${userInput.success_metrics.join(', ')}

## Constraints
${userInput.constraints.join(', ')}

## Timeline
${userInput.timeline || 'TBD'}

## Budget
${userInput.budget || 'TBD'}`;

      case 'TechnicalArchitecture':
        return `# Technical Architecture: ${userInput.project_name}

## System Overview
${userInput.project_description}

## Architecture Components
- Frontend Layer
- Backend Services
- Database Layer
- External Integrations

## Technology Stack
${userInput.technical_preferences.join(', ')}

## Scalability Considerations
- Horizontal scaling
- Load balancing
- Caching strategies

## Security Architecture
- Authentication
- Authorization
- Data encryption
- API security`;

      case 'UXBrief':
        return `# UX Brief: ${userInput.project_name}

## User Personas
${userInput.target_users.join(', ')}

## User Journey
1. Discovery
2. Onboarding
3. Core Usage
4. Retention

## Design Principles
- User-centered design
- Accessibility
- Responsive design
- Performance

## Key Features UX
${userInput.key_features.join(', ')}

## Success Metrics
- User engagement
- Task completion rate
- User satisfaction`;

      default:
        return `# ${artifactType}: ${userInput.project_name}

## Overview
${userInput.project_description}

## Generated by ${agentRole}
This artifact was generated using BMAD methodology with AI agent collaboration.

## Content
[Detailed content would be generated based on artifact type and user input]`;
    }
  }

  private getArtifactTitle(artifactType: string): string {
    const titles: Record<string, string> = {
      'PRD': 'Product Requirements Document',
      'TechnicalArchitecture': 'Technical Architecture',
      'UXBrief': 'UX Design Brief',
      'APISpecification': 'API Specification',
      'DatabaseSchema': 'Database Schema',
      'DeploymentPlan': 'Deployment Plan',
      'TestingStrategy': 'Testing Strategy',
      'SecurityPlan': 'Security Plan',
      'PerformancePlan': 'Performance Plan',
      'DocumentationPlan': 'Documentation Plan'
    };
    
    return titles[artifactType] || artifactType;
  }

  private calculateComplexityScore(userInput: UserInput): number {
    let score = 0.5; // Base score
    
    // Adjust based on number of features
    score += Math.min(userInput.key_features.length * 0.1, 0.3);
    
    // Adjust based on constraints
    score += Math.min(userInput.constraints.length * 0.05, 0.2);
    
    return Math.min(score, 1.0);
  }

  private groupArtifactsByType(artifacts: ProjectArtifact[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    for (const artifact of artifacts) {
      groups[artifact.artifact_type] = (groups[artifact.artifact_type] || 0) + 1;
    }
    
    return groups;
  }

  private calculateProgress(workflow: BMADWorkflow): number {
    const totalRequired = workflow.config.required_artifacts.length;
    const completed = workflow.artifacts.filter(a => 
      a.metadata.approval_status === 'Approved'
    ).length;
    
    return Math.round((completed / totalRequired) * 100);
  }

  private async generateDevelopmentContext(workflow: BMADWorkflow): Promise<string> {
    return `Development context generated for ${workflow.config.project_name}:
- Project type: ${workflow.config.project_type}
- Complexity: ${workflow.config.complexity_level}
- Target platforms: ${workflow.config.target_platforms.join(', ')}
- Artifacts available: ${workflow.artifacts.length}
- Ready for implementation phase`;
  }

  private async executeAgentCollaboration(workflow: BMADWorkflow, strategy: string, artifactTypes: string[]): Promise<ProjectArtifact[]> {
    const results: ProjectArtifact[] = [];
    
    for (const artifactType of artifactTypes) {
      const artifact = await this.createArtifact(artifactType, 'CollaborativeAgent', workflow);
      results.push(artifact);
      workflow.artifacts.push(artifact);
    }
    
    return results;
  }

  private generateMarkdownExport(workflow: BMADWorkflow): string {
    return `# BMAD Workflow Export: ${workflow.config.project_name}

## Workflow Information
- **Workflow ID**: ${workflow.workflow_id}
- **Current Phase**: ${workflow.current_phase}
- **Status**: ${workflow.status}
- **Created**: ${workflow.created_at}

## Project Configuration
- **Type**: ${workflow.config.project_type}
- **Complexity**: ${workflow.config.complexity_level}
- **Platforms**: ${workflow.config.target_platforms.join(', ')}
- **Collaboration Mode**: ${workflow.config.collaboration_mode}

## Generated Artifacts (${workflow.artifacts.length})

${workflow.artifacts.map(artifact => `
### ${artifact.title}
- **Type**: ${artifact.artifact_type}
- **Created by**: ${artifact.created_by}
- **Version**: ${artifact.version}
- **Status**: ${artifact.metadata.review_status}

\`\`\`
${artifact.content}
\`\`\`
`).join('\n')}

---
*Generated by Universal AI Tools BMAD MCP Server*`;
  }

  // Resource implementations
  private async getWorkflowsResource() {
    const workflows = Array.from(this.workflows.values());
    return {
      contents: [
        {
          uri: 'bmad://workflows',
          mimeType: 'application/json',
          text: JSON.stringify(workflows, null, 2),
        },
      ],
    };
  }

  private async getAgentsResource() {
    const agents = [
      { name: 'ProductManager', role: 'Product Manager', expertise: ['PRD', 'UXBrief'] },
      { name: 'Architect', role: 'System Architect', expertise: ['TechnicalArchitecture', 'APISpecification', 'DatabaseSchema'] },
      { name: 'Designer', role: 'UX Designer', expertise: ['UXBrief'] },
      { name: 'FrontendDeveloper', role: 'Frontend Developer', expertise: ['UXBrief', 'APISpecification'] },
      { name: 'BackendDeveloper', role: 'Backend Developer', expertise: ['APISpecification', 'DatabaseSchema'] },
      { name: 'MLEngineer', role: 'ML Engineer', expertise: ['PerformancePlan'] },
      { name: 'DevOpsEngineer', role: 'DevOps Engineer', expertise: ['DeploymentPlan', 'SecurityPlan'] },
      { name: 'QAEngineer', role: 'QA Engineer', expertise: ['TestingStrategy'] },
      { name: 'CodeReviewer', role: 'Code Reviewer', expertise: ['CodeReview'] }
    ];

    return {
      contents: [
        {
          uri: 'bmad://agents',
          mimeType: 'application/json',
          text: JSON.stringify(agents, null, 2),
        },
      ],
    };
  }

  private async getTemplatesResource() {
    const templates = [
      {
        name: 'Web Application Template',
        description: 'Template for web application development',
        config: {
          project_type: 'WebApplication',
          complexity_level: 'Moderate',
          required_artifacts: ['PRD', 'TechnicalArchitecture', 'UXBrief', 'APISpecification'],
          collaboration_mode: 'Collaborative'
        }
      },
      {
        name: 'API Service Template',
        description: 'Template for API service development',
        config: {
          project_type: 'ApiService',
          complexity_level: 'Simple',
          required_artifacts: ['PRD', 'APISpecification', 'DatabaseSchema', 'DeploymentPlan'],
          collaboration_mode: 'Sequential'
        }
      },
      {
        name: 'Enterprise Application Template',
        description: 'Template for enterprise application development',
        config: {
          project_type: 'WebApplication',
          complexity_level: 'Enterprise',
          required_artifacts: ['PRD', 'TechnicalArchitecture', 'UXBrief', 'APISpecification', 'DatabaseSchema', 'DeploymentPlan', 'TestingStrategy', 'SecurityPlan', 'PerformancePlan'],
          collaboration_mode: 'Hierarchical'
        }
      }
    ];

    return {
      contents: [
        {
          uri: 'bmad://templates',
          mimeType: 'application/json',
          text: JSON.stringify(templates, null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('BMAD MCP Server running on stdio');
  }
}

// Run the server if this file is executed directly
if (require.main === module) {
  const server = new BMADMCPServer();
  server.run().catch(console.error);
}

export { BMADMCPServer };
