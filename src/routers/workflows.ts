/**
 * Workflow Management API Router
 * 
 * Comprehensive workflow management system with CRUD operations,
 * execution tracking, real-time updates, and template management.
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

// Services and utilities
import type { AgentRegistry } from '@/agents/agent-registry';
// Middleware imports
import { authenticate } from '@/middleware/auth';
import { 
  validateContentType,
  validateParams,
  validateQueryParams, 
  validateRequest,
  validateRequestBody, 
  validateRequestSize 
} from '@/middleware/enhanced-validation';
import {
  ApiNotFoundError,
  ApiServiceUnavailableError,
  ApiValidationError,
  asyncErrorHandler
} from '@/middleware/standardized-error-handler';
import { contextStorageService } from '@/services/context-storage-service';
import type { RealtimeBroadcastService } from '@/services/realtime-broadcast-service';
// Type imports
import type { AgentConfig, AgentContext, AgentResponse, ApiResponse, PaginationMeta } from '@/types';
import { sendError, sendPaginatedSuccess, sendSuccess } from '@/utils/api-response';
import { log, LogContext } from '@/utils/logger';

// ============================================================================
// Workflow Type Definitions
// ============================================================================

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum WorkflowStepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled'
}

export enum WorkflowStepType {
  AGENT_TASK = 'agent_task',
  HTTP_REQUEST = 'http_request',
  CONDITION = 'condition',
  DELAY = 'delay',
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential',
  LOOP = 'loop',
  WEBHOOK = 'webhook'
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  status: WorkflowStepStatus;
  agentId?: string;
  config: {
    instruction?: string;
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    condition?: string;
    delayMs?: number;
    retryAttempts?: number;
    timeout?: number;
    onSuccess?: string[]; // Next step IDs
    onFailure?: string[]; // Error handling step IDs
    [key: string]: any;
  };
  dependencies: string[]; // Step IDs this step depends on
  result?: any;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  executionTime?: number;
  retryCount: number;
  metadata?: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  currentStepId?: string;
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  totalExecutionTime?: number;
  parameters: Record<string, any>;
  context: Record<string, any>;
  stepExecutions: Record<string, {
    stepId: string;
    status: WorkflowStepStatus;
    result?: any;
    error?: string;
    startTime?: Date;
    endTime?: Date;
    executionTime?: number;
    retryCount: number;
  }>;
  errorDetails?: {
    stepId: string;
    message: string;
    stack?: string;
    retryable: boolean;
  };
  metadata?: Record<string, any>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  parameters: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required: boolean;
    defaultValue?: any;
    description?: string;
  }[];
  triggers: {
    type: 'manual' | 'scheduled' | 'webhook' | 'event';
    config: Record<string, any>;
  }[];
  timeout: number; // Max execution time in ms
  retryPolicy: {
    maxAttempts: number;
    backoffStrategy: 'fixed' | 'exponential' | 'linear';
    delayMs: number;
  };
  concurrencyLimit: number;
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: Omit<Workflow, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;
  usageCount: number;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const workflowStepConfigSchema = z.object({
  instruction: z.string().optional(),
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  condition: z.string().optional(),
  delayMs: z.number().int().min(0).max(3600000).optional(), // Max 1 hour
  retryAttempts: z.number().int().min(0).max(10).optional(),
  timeout: z.number().int().min(1000).max(300000).optional(), // 1s to 5min
  onSuccess: z.array(z.string()).optional(),
  onFailure: z.array(z.string()).optional()
}).passthrough();

const workflowStepSchema = z.object({
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  type: z.nativeEnum(WorkflowStepType),
  agentId: z.string().optional(),
  config: workflowStepConfigSchema,
  dependencies: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional()
});

const workflowParameterSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean().default(false),
  defaultValue: z.any().optional(),
  description: z.string().max(1000).optional()
});

const workflowTriggerSchema = z.object({
  type: z.enum(['manual', 'scheduled', 'webhook', 'event']),
  config: z.record(z.any()).default({})
});

const retryPolicySchema = z.object({
  maxAttempts: z.number().int().min(0).max(10).default(3),
  backoffStrategy: z.enum(['fixed', 'exponential', 'linear']).default('exponential'),
  delayMs: z.number().int().min(100).max(60000).default(1000)
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(''),
  version: z.string().min(1).max(50).default('1.0.0'),
  steps: z.array(workflowStepSchema).min(1).max(100),
  parameters: z.array(workflowParameterSchema).default([]),
  triggers: z.array(workflowTriggerSchema).default([{ type: 'manual', config: {} }]),
  timeout: z.number().int().min(1000).max(86400000).default(3600000), // Default 1 hour
  retryPolicy: retryPolicySchema.default({
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    delayMs: 1000
  }),
  concurrencyLimit: z.number().int().min(1).max(100).default(10),
  tags: z.array(z.string().max(50)).default([]),
  metadata: z.record(z.any()).optional()
});

const updateWorkflowSchema = createWorkflowSchema.partial();

const executeWorkflowSchema = z.object({
  parameters: z.record(z.any()).default({}),
  context: z.record(z.any()).default({}),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  metadata: z.record(z.any()).optional()
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(''),
  category: z.string().min(1).max(100),
  workflowId: z.string().uuid(),
  isPublic: z.boolean().default(false),
  metadata: z.record(z.any()).optional()
});

// Query schemas
const workflowQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(WorkflowStatus).optional(),
  tags: z.string().optional(), // Comma-separated tags
  search: z.string().max(255).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'status']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const executionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(WorkflowStatus).optional(),
  workflowId: z.string().uuid().optional(),
  sortBy: z.enum(['startTime', 'endTime', 'progress', 'status']).default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const idParamSchema = z.object({
  id: z.string().uuid()
});

// ============================================================================
// Workflow Engine Class
// ============================================================================

class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private templates: Map<string, WorkflowTemplate> = new Map();
  private agentRegistry: AgentRegistry | null = null;
  private broadcastService: RealtimeBroadcastService | null = null;
  
  constructor(agentRegistry?: AgentRegistry, broadcastService?: RealtimeBroadcastService) {
    this.agentRegistry = agentRegistry || null;
    this.broadcastService = broadcastService || null;
  }

  // Workflow CRUD operations
  async createWorkflow(workflowData: z.infer<typeof createWorkflowSchema>, userId: string): Promise<Workflow> {
    const id = this.generateId();
    
    // Transform input steps to include required runtime properties
    const workflowSteps: WorkflowStep[] = workflowData.steps.map(step => ({
      ...step,
      status: WorkflowStepStatus.PENDING,
      retryCount: 0
    }));
    
    const workflow: Workflow = {
      id,
      ...workflowData,
      steps: workflowSteps,
      status: WorkflowStatus.DRAFT,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate workflow steps and dependencies
    this.validateWorkflowSteps(workflow.steps);
    
    this.workflows.set(id, workflow);
    
    log.info('Workflow created', LogContext.API, { 
      workflowId: id, 
      name: workflow.name,
      stepCount: workflow.steps.length,
      userId 
    });
    
    return workflow;
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    return this.workflows.get(id) || null;
  }

  async updateWorkflow(id: string, updates: z.infer<typeof updateWorkflowSchema>, userId: string): Promise<Workflow> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new ApiNotFoundError('Workflow');
    }

    // Prevent updates to running workflows
    const runningExecution = this.getRunningExecution(id);
    if (runningExecution) {
      throw new ApiValidationError('Cannot update workflow while execution is running');
    }

    // Transform input steps to include required runtime properties if steps are being updated
    const transformedUpdates: any = { ...updates };
    if (updates.steps) {
      transformedUpdates.steps = updates.steps.map(step => ({
        ...step,
        status: WorkflowStepStatus.PENDING,
        retryCount: 0
      })) as WorkflowStep[];
      this.validateWorkflowSteps(transformedUpdates.steps);
    }

    const updatedWorkflow: Workflow = {
      ...workflow,
      ...transformedUpdates,
      updatedAt: new Date()
    };

    this.workflows.set(id, updatedWorkflow);
    
    log.info('Workflow updated', LogContext.API, { 
      workflowId: id, 
      userId,
      updates: Object.keys(updates)
    });
    
    return updatedWorkflow;
  }

  async deleteWorkflow(id: string): Promise<void> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new ApiNotFoundError('Workflow');
    }

    // Cancel any running executions
    const runningExecution = this.getRunningExecution(id);
    if (runningExecution) {
      await this.cancelExecution(runningExecution.id);
    }

    this.workflows.delete(id);
    
    log.info('Workflow deleted', LogContext.API, { workflowId: id });
  }

  // Workflow execution
  async executeWorkflow(
    workflowId: string, 
    executionData: z.infer<typeof executeWorkflowSchema>,
    userId: string
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new ApiNotFoundError('Workflow');
    }

    if (workflow.status !== WorkflowStatus.ACTIVE) {
      throw new ApiValidationError('Workflow must be active to execute');
    }

    // Check concurrency limit
    const runningExecutions = this.getRunningExecutions(workflowId);
    if (runningExecutions.length >= workflow.concurrencyLimit) {
      throw new ApiValidationError(`Workflow concurrency limit (${workflow.concurrencyLimit}) exceeded`);
    }

    const executionId = this.generateId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: WorkflowStatus.ACTIVE,
      progress: 0,
      startTime: new Date(),
      parameters: executionData.parameters,
      context: {
        ...executionData.context,
        userId,
        priority: executionData.priority
      },
      stepExecutions: {},
      metadata: executionData.metadata
    };

    this.executions.set(executionId, execution);

    // Broadcast execution start
    this.broadcastWorkflowUpdate(execution, 'started');

    // Start execution asynchronously
    this.startWorkflowExecution(execution, workflow).catch(error => {
      log.error('Workflow execution failed', LogContext.API, { 
        executionId, 
        workflowId, 
        error: error.message 
      });
    });

    log.info('Workflow execution started', LogContext.API, { 
      executionId, 
      workflowId, 
      userId 
    });

    return execution;
  }

  async pauseExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ApiNotFoundError('Workflow execution');
    }

    if (execution.status !== WorkflowStatus.ACTIVE) {
      throw new ApiValidationError('Only active executions can be paused');
    }

    execution.status = WorkflowStatus.PAUSED;
    this.executions.set(executionId, execution);

    this.broadcastWorkflowUpdate(execution, 'paused');
    
    log.info('Workflow execution paused', LogContext.API, { executionId });
    
    return execution;
  }

  async resumeExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ApiNotFoundError('Workflow execution');
    }

    if (execution.status !== WorkflowStatus.PAUSED) {
      throw new ApiValidationError('Only paused executions can be resumed');
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new ApiNotFoundError('Workflow');
    }

    execution.status = WorkflowStatus.ACTIVE;
    this.executions.set(executionId, execution);

    this.broadcastWorkflowUpdate(execution, 'resumed');

    // Resume execution
    this.continueWorkflowExecution(execution, workflow).catch(error => {
      log.error('Workflow execution resume failed', LogContext.API, { 
        executionId, 
        error: error.message 
      });
    });

    log.info('Workflow execution resumed', LogContext.API, { executionId });
    
    return execution;
  }

  async cancelExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ApiNotFoundError('Workflow execution');
    }

    if ([WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED].includes(execution.status)) {
      throw new ApiValidationError('Execution is already completed');
    }

    execution.status = WorkflowStatus.CANCELLED;
    execution.endTime = new Date();
    execution.totalExecutionTime = execution.endTime.getTime() - execution.startTime.getTime();
    
    this.executions.set(executionId, execution);

    this.broadcastWorkflowUpdate(execution, 'cancelled');
    
    log.info('Workflow execution cancelled', LogContext.API, { executionId });
    
    return execution;
  }

  // Template management
  async createTemplate(templateData: z.infer<typeof createTemplateSchema>, userId: string): Promise<WorkflowTemplate> {
    const workflow = this.workflows.get(templateData.workflowId);
    if (!workflow) {
      throw new ApiNotFoundError('Workflow');
    }

    const id = this.generateId();
    const { id: workflowId, createdBy, createdAt, updatedAt, ...workflowData } = workflow;
    const template: WorkflowTemplate = {
      id,
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      workflow: workflowData,
      usageCount: 0,
      isPublic: templateData.isPublic,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: templateData.metadata
    };

    this.templates.set(id, template);
    
    log.info('Workflow template created', LogContext.API, { 
      templateId: id, 
      workflowId: templateData.workflowId,
      userId 
    });
    
    return template;
  }

  // Query methods
  getWorkflows(query: z.infer<typeof workflowQuerySchema>, userId: string): {
    workflows: Workflow[];
    pagination: PaginationMeta;
  } {
    let workflows = Array.from(this.workflows.values());

    // Apply filters
    if (query.status) {
      workflows = workflows.filter(w => w.status === query.status);
    }
    
    if (query.tags) {
      const tags = query.tags.split(',').map(t => t.trim());
      workflows = workflows.filter(w => 
        tags.some(tag => w.tags.includes(tag))
      );
    }

    if (query.search) {
      const search = query.search.toLowerCase();
      workflows = workflows.filter(w => 
        w.name.toLowerCase().includes(search) || 
        w.description.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    workflows.sort((a, b) => {
      const aVal = a[query.sortBy as keyof Workflow];
      const bVal = b[query.sortBy as keyof Workflow];
      
      // Handle undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;
      
      return query.sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const total = workflows.length;
    const offset = (query.page - 1) * query.limit;
    const paginatedWorkflows = workflows.slice(offset, offset + query.limit);

    return {
      workflows: paginatedWorkflows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNext: offset + query.limit < total,
        hasPrev: query.page > 1
      }
    };
  }

  getExecutions(query: z.infer<typeof executionQuerySchema>): {
    executions: WorkflowExecution[];
    pagination: PaginationMeta;
  } {
    let executions = Array.from(this.executions.values());

    // Apply filters
    if (query.status) {
      executions = executions.filter(e => e.status === query.status);
    }
    
    if (query.workflowId) {
      executions = executions.filter(e => e.workflowId === query.workflowId);
    }

    // Apply sorting
    executions.sort((a, b) => {
      const aVal = a[query.sortBy as keyof WorkflowExecution];
      const bVal = b[query.sortBy as keyof WorkflowExecution];
      
      // Handle undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;
      
      return query.sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const total = executions.length;
    const offset = (query.page - 1) * query.limit;
    const paginatedExecutions = executions.slice(offset, offset + query.limit);

    return {
      executions: paginatedExecutions,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNext: offset + query.limit < total,
        hasPrev: query.page > 1
      }
    };
  }

  // Public getters for accessing private properties
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }

  getAllTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  updateTemplate(id: string, template: WorkflowTemplate): void {
    this.templates.set(id, template);
  }

  getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  getWorkflowsCount(): number {
    return this.workflows.size;
  }

  getExecutionsCount(): number {
    return this.executions.size;
  }

  getTemplatesCount(): number {
    return this.templates.size;
  }

  // Private methods
  private validateWorkflowSteps(steps: WorkflowStep[]): void {
    const stepIds = new Set(steps.map(s => s.id));
    
    // Check for duplicate step IDs
    if (stepIds.size !== steps.length) {
      throw new ApiValidationError('Duplicate step IDs found');
    }

    // Validate dependencies
    for (const step of steps) {
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          throw new ApiValidationError(`Step '${step.id}' has invalid dependency '${depId}'`);
        }
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies(steps);
  }

  private detectCircularDependencies(steps: WorkflowStep[]): void {
    const graph = new Map<string, string[]>();
    
    for (const step of steps) {
      graph.set(step.id, step.dependencies);
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (visiting.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visiting.add(nodeId);
      
      const dependencies = graph.get(nodeId) || [];
      for (const depId of dependencies) {
        if (hasCycle(depId)) return true;
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      return false;
    };

    for (const stepId of graph.keys()) {
      if (hasCycle(stepId)) {
        throw new ApiValidationError('Circular dependency detected in workflow steps');
      }
    }
  }

  private async startWorkflowExecution(execution: WorkflowExecution, workflow: Workflow): Promise<void> {
    try {
      await this.continueWorkflowExecution(execution, workflow);
    } catch (error) {
      execution.status = WorkflowStatus.FAILED;
      execution.endTime = new Date();
      execution.totalExecutionTime = execution.endTime.getTime() - execution.startTime.getTime();
      execution.errorDetails = {
        stepId: execution.currentStepId || 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        retryable: false
      };

      this.executions.set(execution.id, execution);
      this.broadcastWorkflowUpdate(execution, 'failed');
    }
  }

  private async continueWorkflowExecution(execution: WorkflowExecution, workflow: Workflow): Promise<void> {
    if (execution.status !== WorkflowStatus.ACTIVE) {
      return;
    }

    // Find next steps to execute
    const nextSteps = this.getNextSteps(workflow.steps, execution.stepExecutions);
    
    if (nextSteps.length === 0) {
      // Workflow completed
      execution.status = WorkflowStatus.COMPLETED;
      execution.endTime = new Date();
      execution.totalExecutionTime = execution.endTime.getTime() - execution.startTime.getTime();
      execution.progress = 100;
      
      this.executions.set(execution.id, execution);
      this.broadcastWorkflowUpdate(execution, 'completed');
      return;
    }

    // Execute next steps
    for (const step of nextSteps) {
      if (execution.status !== WorkflowStatus.ACTIVE) {
        break;
      }

      execution.currentStepId = step.id;
      await this.executeStep(step, execution, workflow);
    }

    // Update progress
    const completedSteps = Object.values(execution.stepExecutions).filter(
      se => se.status === WorkflowStepStatus.COMPLETED
    ).length;
    execution.progress = Math.round((completedSteps / workflow.steps.length) * 100);

    this.executions.set(execution.id, execution);
    this.broadcastWorkflowUpdate(execution, 'progress');

    // Continue if there are more steps
    if (execution.status === WorkflowStatus.ACTIVE) {
      await this.continueWorkflowExecution(execution, workflow);
    }
  }

  private getNextSteps(steps: WorkflowStep[], stepExecutions: Record<string, any>): WorkflowStep[] {
    return steps.filter(step => {
      // Skip if already executed or running
      const stepExecution = stepExecutions[step.id];
      if (stepExecution && [WorkflowStepStatus.COMPLETED, WorkflowStepStatus.RUNNING, WorkflowStepStatus.FAILED].includes(stepExecution.status)) {
        return false;
      }

      // Check if all dependencies are completed
      return step.dependencies.every(depId => {
        const depExecution = stepExecutions[depId];
        return depExecution && depExecution.status === WorkflowStepStatus.COMPLETED;
      });
    });
  }

  private async executeStep(step: WorkflowStep, execution: WorkflowExecution, workflow: Workflow): Promise<void> {
    const stepExecution: any = {
      stepId: step.id,
      status: WorkflowStepStatus.RUNNING,
      startTime: new Date(),
      retryCount: 0
    };

    execution.stepExecutions[step.id] = stepExecution;
    this.broadcastWorkflowUpdate(execution, 'step_started', { stepId: step.id });

    try {
      let result: any = null;

      switch (step.type) {
        case WorkflowStepType.AGENT_TASK:
          result = await this.executeAgentTask(step, execution);
          break;
        case WorkflowStepType.HTTP_REQUEST:
          result = await this.executeHttpRequest(step, execution);
          break;
        case WorkflowStepType.DELAY:
          result = await this.executeDelay(step);
          break;
        case WorkflowStepType.CONDITION:
          result = await this.executeCondition(step, execution);
          break;
        default:
          throw new Error(`Unsupported step type: ${step.type}`);
      }

      stepExecution.status = WorkflowStepStatus.COMPLETED;
      stepExecution.result = result;
      stepExecution.endTime = new Date();
      stepExecution.executionTime = stepExecution.endTime.getTime() - stepExecution.startTime!.getTime();

      this.broadcastWorkflowUpdate(execution, 'step_completed', { stepId: step.id, result });

    } catch (error) {
      stepExecution.status = WorkflowStepStatus.FAILED;
      stepExecution.error = error instanceof Error ? error.message : 'Unknown error';
      stepExecution.endTime = new Date();
      stepExecution.executionTime = stepExecution.endTime.getTime() - stepExecution.startTime!.getTime();

      this.broadcastWorkflowUpdate(execution, 'step_failed', { stepId: step.id, error: stepExecution.error });

      // Handle retry logic
      if (stepExecution.retryCount < (step.config.retryAttempts || workflow.retryPolicy.maxAttempts)) {
        stepExecution.retryCount++;
        stepExecution.status = WorkflowStepStatus.PENDING;
        
        // Apply backoff delay
        const delay = this.calculateBackoffDelay(stepExecution.retryCount, workflow.retryPolicy);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the step
        await this.executeStep(step, execution, workflow);
      } else {
        // Max retries exceeded, fail the workflow
        execution.status = WorkflowStatus.FAILED;
        execution.errorDetails = {
          stepId: step.id,
          message: stepExecution.error,
          retryable: false
        };
      }
    }

    execution.stepExecutions[step.id] = stepExecution;
  }

  private async executeAgentTask(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    if (!this.agentRegistry || !step.agentId || !step.config.instruction) {
      throw new Error('Agent registry not available, agent ID, or instruction missing');
    }

    const agent = await this.agentRegistry.getAgent(step.agentId);
    if (!agent) {
      throw new Error(`Agent '${step.agentId}' not found`);
    }

    const context: AgentContext = {
      userRequest: step.config.instruction,
      requestId: execution.id,
      userId: execution.context.userId,
      workingDirectory: execution.context.workingDirectory,
      metadata: {
        workflowId: execution.workflowId,
        stepId: step.id,
        executionId: execution.id,
        ...step.metadata
      }
    };

    // Type guard to check if agent has processRequest method
    const response = await ('processRequest' in agent 
      ? (agent as any).processRequest(context)
      : { success: false, message: 'Agent does not support processRequest method', data: null });
    
    if (!response.success) {
      throw new Error(response.message || 'Agent task failed');
    }

    return response.data;
  }

  private async executeHttpRequest(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    const { url, method = 'GET', headers = {}, body } = step.config;
    
    if (!url) {
      throw new Error('URL is required for HTTP request step');
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(step.config.timeout || 30000)
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async executeDelay(step: WorkflowStep): Promise<void> {
    const delayMs = step.config.delayMs || 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  private async executeCondition(step: WorkflowStep, execution: WorkflowExecution): Promise<boolean> {
    const {condition} = step.config;
    if (!condition) {
      throw new Error('Condition is required for condition step');
    }

    // Simple condition evaluation (in production, use a safer evaluator)
    try {
      // Create a safe evaluation context
      const context = {
        parameters: execution.parameters,
        stepResults: Object.fromEntries(
          Object.entries(execution.stepExecutions).map(([stepId, stepExec]) => [
            stepId,
            stepExec.result
          ])
        )
      };

      // Basic condition evaluation (extend as needed)
      const result = this.evaluateCondition(condition, context);
      return Boolean(result);
    } catch (error) {
      throw new Error(`Condition evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private evaluateCondition(condition: string, context: any): boolean {
    // Simple condition evaluator - in production, use a proper expression parser
    // For now, support basic comparisons
    const parts = condition.trim().split(/\s+(==|!=|>|<|>=|<=)\s+/);
    if (parts.length !== 3) {
      throw new Error('Invalid condition format');
    }

    const [left, operator, right] = parts;
    const leftValue = this.resolveValue(left || '', context);
    const rightValue = this.resolveValue(right || '', context);

    switch (operator) {
      case '==': return leftValue == rightValue;
      case '!=': return leftValue != rightValue;
      case '>': return leftValue > rightValue;
      case '<': return leftValue < rightValue;
      case '>=': return leftValue >= rightValue;
      case '<=': return leftValue <= rightValue;
      default: throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  private resolveValue(expression: string, context: any): any {
    // Remove quotes for string literals
    if ((expression.startsWith('"') && expression.endsWith('"')) ||
        (expression.startsWith("'") && expression.endsWith("'"))) {
      return expression.slice(1, -1);
    }

    // Check if it's a number
    if (/^\d+(\.\d+)?$/.test(expression)) {
      return parseFloat(expression);
    }

    // Check if it's a boolean
    if (expression === 'true') return true;
    if (expression === 'false') return false;

    // Try to resolve from context
    if (expression.startsWith('parameters.')) {
      const key = expression.substring(11);
      return context.parameters[key];
    }

    if (expression.startsWith('stepResults.')) {
      const key = expression.substring(12);
      return context.stepResults[key];
    }

    throw new Error(`Cannot resolve value: ${expression}`);
  }

  private calculateBackoffDelay(attempt: number, retryPolicy: Workflow['retryPolicy']): number {
    const { backoffStrategy, delayMs } = retryPolicy;
    
    switch (backoffStrategy) {
      case 'fixed':
        return delayMs;
      case 'linear':
        return delayMs * attempt;
      case 'exponential':
        return delayMs * Math.pow(2, attempt - 1);
      default:
        return delayMs;
    }
  }

  private getRunningExecution(workflowId: string): WorkflowExecution | null {
    return Array.from(this.executions.values()).find(
      e => e.workflowId === workflowId && e.status === WorkflowStatus.ACTIVE
    ) || null;
  }

  private getRunningExecutions(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(
      e => e.workflowId === workflowId && e.status === WorkflowStatus.ACTIVE
    );
  }

  private broadcastWorkflowUpdate(execution: WorkflowExecution, event: string, data?: any): void {
    if (!this.broadcastService) return;

    this.broadcastService.broadcastWorkflowUpdate({
      workflowId: execution.workflowId,
      executionId: execution.id,
      stage: event,
      status: execution.status as any,
      progress: execution.progress,
      agentId: execution.currentStepId,
      result: data,
      error: execution.errorDetails?.message
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

// Global workflow engine instance (in production, use dependency injection)
let workflowEngine: WorkflowEngine | null = null;

// Initialize workflow engine with dependencies
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!workflowEngine) {
    // In production, inject these dependencies properly
    const agentRegistry = (req as any).agentRegistry as AgentRegistry;
    const broadcastService = (req as any).broadcastService as RealtimeBroadcastService;
    workflowEngine = new WorkflowEngine(agentRegistry, broadcastService);
  }
  next();
});

// ============================================================================
// Workflow CRUD Endpoints
// ============================================================================

// Create workflow
router.post('/',
  validateContentType('application/json'),
  validateRequestSize(1024 * 1024), // 1MB limit
  authenticate,
  validateRequestBody(createWorkflowSchema, {
    sanitize: true,
    stripUnknown: true
  }),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const workflowData = req.body;

    const workflow = await workflowEngine!.createWorkflow(workflowData, userId);

    sendSuccess(res, workflow, 201, {
      workflowId: workflow.id
    });
  })
);

// Get workflows
router.get('/',
  authenticate,
  validateQueryParams(workflowQuerySchema, {
    coerceTypes: true,
    sanitize: true
  }),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const query = req.query as unknown as z.infer<typeof workflowQuerySchema>;

    const result = workflowEngine!.getWorkflows(query, userId);

    sendPaginatedSuccess(res, result.workflows, result.pagination);
  })
);

// Get workflow by ID
router.get('/:id',
  validateParams(idParamSchema),
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const workflow = await workflowEngine!.getWorkflow(id!);
    if (!workflow) {
      throw new ApiNotFoundError('Workflow');
    }

    sendSuccess(res, workflow);
  })
);

// Update workflow
router.put('/:id',
  validateParams(idParamSchema),
  validateContentType('application/json'),
  validateRequestSize(1024 * 1024),
  authenticate,
  validateRequestBody(updateWorkflowSchema, {
    sanitize: true,
    stripUnknown: true
  }),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id || 'anonymous';
    const updates = req.body;

    if (!id) {
      throw new ApiValidationError('Workflow ID is required');
    }
    const workflow = await workflowEngine!.updateWorkflow(id, updates, userId);

    sendSuccess(res, workflow);
  })
);

// Delete workflow
router.delete('/:id',
  validateParams(idParamSchema),
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ApiValidationError('Workflow ID is required');
    }
    await workflowEngine!.deleteWorkflow(id);

    sendSuccess(res, { deleted: true });
  })
);

// ============================================================================
// Workflow Execution Endpoints
// ============================================================================

// Execute workflow
router.post('/:id/execute',
  validateParams(idParamSchema),
  validateContentType('application/json'),
  validateRequestSize(1024 * 1024),
  authenticate,
  validateRequestBody(executeWorkflowSchema, {
    sanitize: true,
    stripUnknown: true
  }),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id || 'anonymous';
    const executionData = req.body;

    if (!id) {
      throw new ApiValidationError('Workflow ID is required');
    }
    const execution = await workflowEngine!.executeWorkflow(id, executionData, userId);

    sendSuccess(res, execution, 201, {
      executionId: execution.id
    });
  })
);

// Get workflow executions
router.get('/:id/executions',
  validateParams(idParamSchema),
  authenticate,
  validateQueryParams(executionQuerySchema, {
    coerceTypes: true,
    sanitize: true
  }),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const query = {
      ...req.query as unknown as z.infer<typeof executionQuerySchema>,
      workflowId: id
    };

    const result = workflowEngine!.getExecutions(query);

    sendPaginatedSuccess(res, result.executions, result.pagination);
  })
);

// ============================================================================
// Execution Control Endpoints
// ============================================================================

// Get execution by ID
router.get('/executions/:id',
  validateParams(idParamSchema),
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ApiValidationError('Execution ID is required');
    }
    const execution = workflowEngine!.getExecution(id);
    if (!execution) {
      throw new ApiNotFoundError('Workflow execution');
    }

    sendSuccess(res, execution);
  })
);

// Pause execution
router.post('/executions/:id/pause',
  validateParams(idParamSchema),
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ApiValidationError('Execution ID is required');
    }
    const execution = await workflowEngine!.pauseExecution(id);

    sendSuccess(res, execution);
  })
);

// Resume execution
router.post('/executions/:id/resume',
  validateParams(idParamSchema),
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ApiValidationError('Execution ID is required');
    }
    const execution = await workflowEngine!.resumeExecution(id);

    sendSuccess(res, execution);
  })
);

// Cancel execution
router.post('/executions/:id/cancel',
  validateParams(idParamSchema),
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ApiValidationError('Execution ID is required');
    }
    const execution = await workflowEngine!.cancelExecution(id);

    sendSuccess(res, execution);
  })
);

// ============================================================================
// Template Endpoints
// ============================================================================

// Create template
router.post('/templates',
  validateContentType('application/json'),
  validateRequestSize(1024 * 1024),
  authenticate,
  validateRequestBody(createTemplateSchema, {
    sanitize: true,
    stripUnknown: true
  }),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const templateData = req.body;

    const template = await workflowEngine!.createTemplate(templateData, userId);

    sendSuccess(res, template, 201, {
      templateId: template.id
    });
  })
);

// Get templates
router.get('/templates',
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const templates = workflowEngine!.getAllTemplates();

    sendSuccess(res, templates);
  })
);

// Get template by ID
router.get('/templates/:id',
  validateParams(idParamSchema),
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ApiValidationError('Template ID is required');
    }
    const template = workflowEngine!.getTemplate(id);
    if (!template) {
      throw new ApiNotFoundError('Workflow template');
    }

    sendSuccess(res, template);
  })
);

// Create workflow from template
router.post('/templates/:id/instantiate',
  validateParams(idParamSchema),
  validateContentType('application/json'),
  authenticate,
  validateRequestBody(z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    parameters: z.record(z.any()).optional()
  }), {
    sanitize: true,
    stripUnknown: true
  }),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id || 'anonymous';
    const { name, description, parameters } = req.body;

    if (!id) {
      throw new ApiValidationError('Template ID is required');
    }
    const template = workflowEngine!.getTemplate(id);
    if (!template) {
      throw new ApiNotFoundError('Workflow template');
    }

    // Create workflow from template
    const workflowData = {
      ...template.workflow,
      name,
      description: description || template.description,
      parameters: parameters || template.workflow.parameters
    };

    const workflow = await workflowEngine!.createWorkflow(workflowData, userId);

    // Increment usage count
    template.usageCount++;
    workflowEngine!.updateTemplate(id!, template);

    sendSuccess(res, workflow, 201, {
      workflowId: workflow.id,
      templateId: id
    });
  })
);

// ============================================================================
// Monitoring and Analytics Endpoints
// ============================================================================

// Get workflow analytics
router.get('/:id/analytics',
  validateParams(idParamSchema),
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const workflow = await workflowEngine!.getWorkflow(id!);
    if (!workflow) {
      throw new ApiNotFoundError('Workflow');
    }

    const executions = workflowEngine!.getAllExecutions()
      .filter(e => e.workflowId === id);

    const analytics = {
      totalExecutions: executions.length,
      successfulExecutions: executions.filter(e => e.status === WorkflowStatus.COMPLETED).length,
      failedExecutions: executions.filter(e => e.status === WorkflowStatus.FAILED).length,
      cancelledExecutions: executions.filter(e => e.status === WorkflowStatus.CANCELLED).length,
      averageExecutionTime: executions
        .filter(e => e.totalExecutionTime)
        .reduce((sum, e) => sum + (e.totalExecutionTime || 0), 0) / 
        executions.filter(e => e.totalExecutionTime).length || 0,
      successRate: executions.length > 0 ? 
        (executions.filter(e => e.status === WorkflowStatus.COMPLETED).length / executions.length) * 100 : 0,
      recentExecutions: executions
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
        .slice(0, 10)
    };

    sendSuccess(res, analytics);
  })
);

// Get system-wide workflow statistics
router.get('/system/stats',
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const totalWorkflows = workflowEngine!.getWorkflowsCount();
    const totalExecutions = workflowEngine!.getExecutionsCount();
    const totalTemplates = workflowEngine!.getTemplatesCount();
    
    const executions = workflowEngine!.getAllExecutions();
    const activeExecutions = executions.filter(e => e.status === WorkflowStatus.ACTIVE);
    const recentExecutions = executions
      .filter(e => e.startTime > new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      .length;

    const stats = {
      totalWorkflows,
      totalExecutions,
      totalTemplates,
      activeExecutions: activeExecutions.length,
      recentExecutions,
      systemHealth: {
        status: activeExecutions.length < 100 ? 'healthy' : 'busy',
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    sendSuccess(res, stats);
  })
);

// Export workflow configuration
router.get('/:id/export',
  validateParams(idParamSchema),
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const workflow = await workflowEngine!.getWorkflow(id!);
    if (!workflow) {
      throw new ApiNotFoundError('Workflow');
    }

    // Remove sensitive data for export
    const exportData = {
      ...workflow,
      createdBy: undefined,
      id: undefined
    };

    res.setHeader('Content-Disposition', `attachment; filename="workflow-${workflow.name}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(exportData, null, 2));
  })
);

export default router;

// Types are already exported above with their declarations