#!/usr/bin/env tsx
/**
 * Dynamic Agent Factory
 * Creates and manages agents dynamically from One Folder Agent patterns and PydanticAI
 * Provides agentic capabilities for building and managing specialized AI agents
 */

import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { EventEmitter } from 'events';
import util from 'util';

const execAsync = util.promisify(exec);

// Agent Types and Interfaces
interface AgentCapability {
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}

interface AgentTemplate {
  id: string;
  name: string;
  type: 'one-folder' | 'pydantic-ai' | 'hybrid';
  language: 'typescript' | 'python' | 'javascript';
  capabilities: AgentCapability[];
  template: string;
  dependencies: string[];
  defaultConfig: Record<string, any>;
}

interface AgentInstance {
  id: string;
  name: string;
  template: AgentTemplate;
  config: Record<string, any>;
  status: 'created' | 'starting' | 'running' | 'stopped' | 'error';
  pid?: number;
  port?: number;
  endpoint?: string;
  lastActivity?: Date;
  performance: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

interface TaskWindow {
  id: string;
  title: string;
  description: string;
  agent: AgentInstance;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  steps: TaskStep[];
  startTime?: Date;
  endTime?: Date;
  result?: any;
}

interface TaskStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  error?: string;
}

/**
 * Dynamic Agent Factory - Creates and manages agents
 */
export class DynamicAgentFactory extends EventEmitter {
  private agents = new Map<string, AgentInstance>();
  private taskWindows = new Map<string, TaskWindow>();
  private templates = new Map<string, AgentTemplate>();
  private portManagerUrl?: string;

  constructor(private baseDir: string = process.cwd(), portManagerUrl?: string) {
    super();
    this.portManagerUrl = portManagerUrl;
    this.initializeTemplates();
  }

  /**
   * Initialize built-in agent templates
   */
  private async initializeTemplates() {
    // One Folder Agent Template
    const oneFolderTemplate: AgentTemplate = {
      id: 'one-folder',
      name: 'One Folder Agent',
      type: 'one-folder',
      language: 'typescript',
      capabilities: [
        {
          name: 'file_analysis',
          description: 'Analyze directory structures and file organization',
          inputs: ['directory_path'],
          outputs: ['analysis_report'],
          complexity: 'moderate'
        },
        {
          name: 'file_organization',
          description: 'Organize files into logical folder structures',
          inputs: ['directory_path', 'organization_rules'],
          outputs: ['organization_plan'],
          complexity: 'moderate'
        },
        {
          name: 'duplicate_detection',
          description: 'Find and manage duplicate files',
          inputs: ['directory_path'],
          outputs: ['duplicate_list'],
          complexity: 'simple'
        }
      ],
      template: await this.loadOneFolderTemplate(),
      dependencies: ['fs/promises', 'path', 'os'],
      defaultConfig: {
        safeMode: true,
        organizeByType: true,
        removeDuplicates: false
      }
    };

    // PydanticAI Vision Agent Template
    const pydanticVisionTemplate: AgentTemplate = {
      id: 'pydantic-vision',
      name: 'PydanticAI Vision Agent',
      type: 'pydantic-ai',
      language: 'python',
      capabilities: [
        {
          name: 'image_generation',
          description: 'Generate images from text prompts',
          inputs: ['prompt', 'style', 'dimensions'],
          outputs: ['image_base64'],
          complexity: 'complex'
        },
        {
          name: 'image_analysis',
          description: 'Analyze and describe images',
          inputs: ['image_base64', 'question'],
          outputs: ['analysis', 'confidence'],
          complexity: 'complex'
        },
        {
          name: 'image_refinement',
          description: 'Enhance and refine existing images',
          inputs: ['image_base64', 'enhancement_type'],
          outputs: ['refined_image'],
          complexity: 'moderate'
        }
      ],
      template: await this.loadPydanticTemplate(),
      dependencies: ['fastapi', 'pydantic', 'pillow', 'numpy'],
      defaultConfig: {
        host: '0.0.0.0',
        port: 8000,
        model: 'python-vision-generator'
      }
    };

    // Hybrid React Builder Template
    const reactBuilderTemplate: AgentTemplate = {
      id: 'react-builder',
      name: 'React Project Builder',
      type: 'hybrid',
      language: 'typescript',
      capabilities: [
        {
          name: 'project_scaffolding',
          description: 'Create new React projects with TypeScript',
          inputs: ['project_name', 'template_type', 'features'],
          outputs: ['project_structure'],
          complexity: 'complex'
        },
        {
          name: 'component_generation',
          description: 'Generate React components with props and state',
          inputs: ['component_name', 'props', 'styling'],
          outputs: ['component_code'],
          complexity: 'moderate'
        },
        {
          name: 'testing_setup',
          description: 'Set up testing infrastructure',
          inputs: ['test_framework', 'coverage_requirements'],
          outputs: ['test_configuration'],
          complexity: 'moderate'
        }
      ],
      template: await this.loadReactBuilderTemplate(),
      dependencies: ['create-react-app', 'typescript', '@types/react'],
      defaultConfig: {
        typescript: true,
        testing: true,
        eslint: true,
        prettier: true
      }
    };

    // React Component Testing Specialist
    const reactTestingTemplate: AgentTemplate = {
      id: 'react-testing',
      name: 'React Testing Specialist', 
      type: 'specialized',
      language: 'typescript',
      capabilities: [
        {
          name: 'component_testing',
          description: 'Write comprehensive Jest and React Testing Library tests',
          complexity: 'complex'
        },
        {
          name: 'e2e_testing',
          description: 'Create Playwright end-to-end tests for React apps',
          complexity: 'complex'
        },
        {
          name: 'test_optimization',
          description: 'Optimize test performance and coverage',
          complexity: 'moderate'
        }
      ],
      dependencies: ['@testing-library/react', '@testing-library/jest-dom', 'playwright'],
      defaultConfig: {
        testFramework: 'jest',
        e2eFramework: 'playwright',
        coverage: true,
        mocking: true
      }
    };

    // React Hooks Specialist
    const reactHooksTemplate: AgentTemplate = {
      id: 'react-hooks',
      name: 'React Hooks Expert',
      type: 'specialized', 
      language: 'typescript',
      capabilities: [
        {
          name: 'custom_hooks',
          description: 'Create sophisticated custom React hooks',
          complexity: 'complex'
        },
        {
          name: 'state_management',
          description: 'Implement advanced state management patterns',
          complexity: 'complex'
        },
        {
          name: 'performance_hooks',
          description: 'Optimize React performance with useMemo, useCallback',
          complexity: 'moderate'
        }
      ],
      dependencies: ['react', '@types/react'],
      defaultConfig: {
        typescript: true,
        stateLibrary: 'zustand',
        performanceOptimization: true
      }
    };

    // UI/UX Design System Agent
    const reactDesignSystemTemplate: AgentTemplate = {
      id: 'react-design-system',
      name: 'React Design System Architect',
      type: 'creative',
      language: 'typescript',
      capabilities: [
        {
          name: 'component_library',
          description: 'Build comprehensive React component libraries',
          complexity: 'complex'
        },
        {
          name: 'design_tokens',
          description: 'Implement design token systems with Tailwind/CSS',
          complexity: 'moderate'
        },
        {
          name: 'accessibility',
          description: 'Ensure WCAG compliance and accessibility best practices',
          complexity: 'moderate'
        }
      ],
      dependencies: ['tailwindcss', '@headlessui/react', 'framer-motion'],
      defaultConfig: {
        designSystem: 'tailwind',
        animations: 'framer-motion',
        accessibility: true,
        storybook: true
      }
    };

    // React Performance Optimizer
    const reactPerformanceTemplate: AgentTemplate = {
      id: 'react-performance',
      name: 'React Performance Optimizer',
      type: 'specialized',
      language: 'typescript',
      capabilities: [
        {
          name: 'bundle_optimization',
          description: 'Optimize Webpack/Vite bundles for React apps',
          complexity: 'complex'
        },
        {
          name: 'lazy_loading',
          description: 'Implement code splitting and lazy loading',
          complexity: 'moderate'
        },
        {
          name: 'memory_optimization',
          description: 'Identify and fix React memory leaks',
          complexity: 'complex'
        }
      ],
      dependencies: ['webpack-bundle-analyzer', 'react-window', '@loadable/component'],
      defaultConfig: {
        bundler: 'vite',
        codeSplitting: true,
        virtualization: true,
        monitoring: 'web-vitals'
      }
    };

    this.templates.set('one-folder', oneFolderTemplate);
    this.templates.set('pydantic-vision', pydanticVisionTemplate);
    this.templates.set('react-builder', reactBuilderTemplate);
    this.templates.set('react-testing', reactTestingTemplate);
    this.templates.set('react-hooks', reactHooksTemplate);
    this.templates.set('react-design-system', reactDesignSystemTemplate);
    this.templates.set('react-performance', reactPerformanceTemplate);

    // Initialized agent templates
  }

  /**
   * Create a new agent instance with HRM-optimized agent selection and routing
   */
  async createAgent(templateId: string, name: string, config: Record<string, any> = {}): Promise<AgentInstance> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Use HRM Agent Bridge for optimal agent creation decision
    const hrmDecision = await this.getHRMAgentCreationDecision(templateId, name, config);
    // HRM agent creation decision made

    // If HRM recommends using an existing specialized agent instead of creating new one
    if (hrmDecision.useExistingAgent && hrmDecision.existingAgentId) {
      // HRM recommends using existing agent
      return await this.getExistingAgent(hrmDecision.existingAgentId);
    }

    // Connect to Docker services for local AI models
    const dockerServices = await this.connectToDockerServices();
    if (dockerServices) {
      // Connected Docker services for agent
    }

    const agentId = `${templateId}-${Date.now()}`;
    const mergedConfig = { 
      ...template.defaultConfig, 
      ...config,
      hrmDecision,
      dockerServices,
      preferredService: hrmDecision.selectedLLM || 'ollama',
      targetSystem: hrmDecision.selectedSystem
    };

    // Create agent instance
    const agent: AgentInstance = {
      id: agentId,
      name,
      template,
      config: mergedConfig,
      status: 'created',
      performance: {
        requestCount: 0,
        averageResponseTime: 0,
        errorRate: 0
      }
    };

    // Create agent files
    await this.createAgentFiles(agent);
    
    this.agents.set(agentId, agent);
    this.emit('agentCreated', agent);

    // Created agent with HRM guidance
    return agent;
  }

  /**
   * Start an agent instance
   */
  async startAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.status = 'starting';
    this.emit('agentStarting', agent);

    try {
      if (agent.template.language === 'python') {
        await this.startPythonAgent(agent);
      } else {
        await this.startNodeAgent(agent);
      }

      agent.status = 'running';
      agent.lastActivity = new Date();
      this.emit('agentStarted', agent);

      // Started agent
    } catch (error) {
      agent.status = 'error';
      this.emit('agentError', agent, error);
      throw error;
    }
  }

  /**
   * Create a task window for complex operations
   */
  async createTaskWindow(title: string, description: string, agentId: string): Promise<TaskWindow> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const taskId = `task-${Date.now()}`;
    const taskWindow: TaskWindow = {
      id: taskId,
      title,
      description,
      agent,
      status: 'pending',
      progress: 0,
      steps: []
    };

    this.taskWindows.set(taskId, taskWindow);
    this.emit('taskWindowCreated', taskWindow);

    return taskWindow;
  }

  /**
   * Execute a task with real-time progress updates
   */
  async executeTask(taskId: string, operation: string, params: Record<string, any>): Promise<any> {
    const taskWindow = this.taskWindows.get(taskId);
    if (!taskWindow) {
      throw new Error(`Task window ${taskId} not found`);
    }

    taskWindow.status = 'running';
    taskWindow.startTime = new Date();
    taskWindow.progress = 0;

    this.emit('taskStarted', taskWindow);

    try {
      // Break down complex tasks into steps
      const steps = this.planTaskSteps(operation, params);
      taskWindow.steps = steps;

      let completedSteps = 0;
      for (const step of steps) {
        step.status = 'running';
        this.emit('stepStarted', taskWindow, step);

        try {
          // Execute step
          await this.executeStep(taskWindow.agent, step, params);
          
          step.status = 'completed';
          step.progress = 100;
          completedSteps++;
          
          taskWindow.progress = (completedSteps / steps.length) * 100;
          this.emit('stepCompleted', taskWindow, step);
          
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : String(error);
          this.emit('stepFailed', taskWindow, step);
          throw error;
        }
      }

      taskWindow.status = 'completed';
      taskWindow.progress = 100;
      taskWindow.endTime = new Date();
      this.emit('taskCompleted', taskWindow);

      return taskWindow.result;

    } catch (error) {
      taskWindow.status = 'failed';
      taskWindow.endTime = new Date();
      this.emit('taskFailed', taskWindow, error);
      throw error;
    }
  }

  /**
   * Get all running agents
   */
  getRunningAgents(): AgentInstance[] {
    return Array.from(this.agents.values()).filter(a => a.status === 'running');
  }

  /**
   * Get all task windows
   */
  getTaskWindows(): TaskWindow[] {
    return Array.from(this.taskWindows.values());
  }

  /**
   * Get active task windows
   */
  getActiveTaskWindows(): TaskWindow[] {
    return Array.from(this.taskWindows.values()).filter(t => 
      t.status === 'running' || t.status === 'pending'
    );
  }

  /**
   * Execute task using HRM-powered agent selection and orchestration
   */
  async executeTaskWithHRM(
    taskDescription: string,
    taskType?: string,
    constraints?: Record<string, any>
  ): Promise<{
    result: any;
    executionMetrics: {
      selectedAgent: string;
      sourceSystem: string;
      executionTime: number;
      confidence: number;
      success: boolean;
    };
    taskWindow?: TaskWindow;
  }> {
    try {
      // Import HRM Agent Bridge dynamically
      const { hrmAgentBridge } = await import('./hrm-agent-bridge');
      
      // Use HRM to execute task with optimal agent selection
      const hrmResult = await hrmAgentBridge.executeTaskWithHRM(
        taskDescription,
        taskType,
        constraints
      );

      // HRM task execution completed
      
      return {
        ...hrmResult,
        taskWindow: undefined // HRM manages its own execution context
      };
      
    } catch (error) {
      console.warn('HRM task execution failed, falling back to dynamic factory:', error);
      
      // Fallback to traditional dynamic factory execution
      return await this.executeTaskTraditional(taskDescription, taskType, constraints);
    }
  }

  /**
   * Traditional task execution fallback (existing behavior)
   */
  private async executeTaskTraditional(
    taskDescription: string,
    taskType?: string,
    constraints?: Record<string, any>
  ): Promise<{
    result: any;
    executionMetrics: {
      selectedAgent: string;
      sourceSystem: string;
      executionTime: number;
      confidence: number;
      success: boolean;
    };
    taskWindow?: TaskWindow;
  }> {
    const startTime = Date.now();
    
    // Select best available dynamic agent
    const runningAgents = this.getRunningAgents();
    if (runningAgents.length === 0) {
      throw new Error('No running agents available for task execution');
    }

    const selectedAgent = runningAgents[0]; // Simple selection for fallback
    
    try {
      // Create task window
      const taskWindow = await this.createTaskWindow(
        `Execute: ${taskDescription}`,
        `Fallback execution on: ${selectedAgent.name}`,
        selectedAgent.id
      );

      const result = await this.executeTask(taskWindow.id, 'general_execution', {
        task: taskDescription,
        taskType: taskType || 'general',
        constraints
      });

      const executionTime = Date.now() - startTime;

      return {
        result,
        executionMetrics: {
          selectedAgent: selectedAgent.name,
          sourceSystem: 'dynamic-factory',
          executionTime,
          confidence: 0.6, // Lower confidence for fallback
          success: true
        },
        taskWindow
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        result: { error: error.message },
        executionMetrics: {
          selectedAgent: selectedAgent.name,
          sourceSystem: 'dynamic-factory',
          executionTime,
          confidence: 0.3,
          success: false
        }
      };
    }
  }

  /**
   * Get comprehensive HRM decision for optimal agent creation
   */
  private async getHRMAgentCreationDecision(templateId: string, name: string, config: Record<string, any>): Promise<{
    selectedSystem: string;
    selectedLLM?: string;
    confidence: number;
    reasoning: string;
    useExistingAgent: boolean;
    existingAgentId?: string;
    estimatedTokens: number;
    resourceRequirements: {
      memory: string;
      cpu: string;
      complexity: 'simple' | 'moderate' | 'complex';
    };
  }> {
    try {
      // Import HRM Agent Bridge dynamically to avoid circular dependencies
      const { hrmAgentBridge } = await import('./hrm-agent-bridge');
      
      // Use HRM for comprehensive agent selection decision
      const agentRequirements = {
        templateId,
        name,
        domain: this.getAgentDomain(templateId),
        complexity: this.estimateAgentComplexity(templateId),
        capabilities: this.getTemplateCapabilities(templateId),
        config
      };

      // Check if there's already an optimal agent for this task
      const existingAgentResult = await hrmAgentBridge.selectBestAgent(
        `Find existing agent for: ${name} with template ${templateId}`,
        this.getAgentDomain(templateId),
        { ...config, searchExisting: true }
      );

      // If we found a perfect match, recommend using it
      if (existingAgentResult && existingAgentResult.agent && existingAgentResult.confidence > 0.8) {
        return {
          selectedSystem: existingAgentResult.sourceSystem,
          confidence: existingAgentResult.confidence,
          reasoning: `HRM found optimal existing agent: ${existingAgentResult.agent.name}`,
          useExistingAgent: true,
          existingAgentId: existingAgentResult.agent.id,
          estimatedTokens: 10, // Minimal tokens since reusing existing agent
          resourceRequirements: {
            memory: 'low',
            cpu: 'low',
            complexity: 'simple'
          }
        };
      }

      // If no suitable existing agent, get LLM recommendation for new agent
      const llmResult = await hrmAgentBridge.selectBestLLM(
        `Create new agent: ${templateId} named ${name}`,
        this.getAgentDomain(templateId),
        config
      );

      return {
        selectedSystem: 'dynamic-factory', // We're creating a new agent
        selectedLLM: llmResult.modelId,
        confidence: llmResult.decisionResult.confidence,
        reasoning: `HRM recommends creating new ${templateId} agent with ${llmResult.modelId}`,
        useExistingAgent: false,
        estimatedTokens: llmResult.decisionResult.estimatedImpact?.tokens || 100,
        resourceRequirements: {
          memory: this.getMemoryRequirement(templateId),
          cpu: this.getCPURequirement(templateId),
          complexity: this.estimateAgentComplexity(templateId)
        }
      };

    } catch (error) {
      console.warn('HRM agent creation decision failed, falling back to heuristic:', error);
      
      // Comprehensive fallback with intelligent defaults
      return {
        selectedSystem: 'dynamic-factory',
        selectedLLM: this.getDefaultLLMForTemplate(templateId),
        confidence: 0.5,
        reasoning: 'HRM unavailable, using intelligent heuristic for agent creation',
        useExistingAgent: false,
        estimatedTokens: 75,
        resourceRequirements: {
          memory: this.getMemoryRequirement(templateId),
          cpu: this.getCPURequirement(templateId),
          complexity: this.estimateAgentComplexity(templateId)
        }
      };
    }
  }

  /**
   * Get existing agent by ID (used when HRM recommends reusing an agent)
   */
  private async getExistingAgent(agentId: string): Promise<AgentInstance> {
    // Check local agents first
    const localAgent = this.agents.get(agentId);
    if (localAgent) {
      return localAgent;
    }

    try {
      // Check other agent systems via HRM Bridge
      const { hrmAgentBridge } = await import('./hrm-agent-bridge');
      const agentResult = await hrmAgentBridge.getAgentById(agentId);
      
      if (agentResult) {
        // Convert external agent to our AgentInstance format
        return this.convertToAgentInstance(agentResult);
      }
    } catch (error) {
      console.warn(`Failed to retrieve existing agent ${agentId}:`, error);
    }

    throw new Error(`Agent ${agentId} not found in any system`);
  }

  /**
   * Convert external agent representation to our AgentInstance format
   */
  private convertToAgentInstance(externalAgent: any): AgentInstance {
    return {
      id: externalAgent.id,
      name: externalAgent.name,
      template: {
        id: 'external',
        name: 'External Agent',
        type: 'hybrid',
        language: 'typescript',
        capabilities: externalAgent.capabilities || [],
        template: '',
        dependencies: [],
        defaultConfig: {}
      },
      config: externalAgent.config || {},
      status: externalAgent.status || 'running',
      port: externalAgent.port,
      endpoint: externalAgent.endpoint,
      performance: {
        requestCount: externalAgent.performance?.requestCount || 0,
        averageResponseTime: externalAgent.performance?.averageResponseTime || 0,
        errorRate: externalAgent.performance?.errorRate || 0
      }
    };
  }

  /**
   * Get domain for agent type to help HRM make better decisions
   */
  private getAgentDomain(templateId: string): string {
    const domainMap: Record<string, string> = {
      'one-folder': 'file_management',
      'pydantic-vision': 'computer_vision',
      'react-builder': 'web_development',
      'code-generator': 'software_engineering',
      'data-analyzer': 'data_science'
    };

    return domainMap[templateId] || 'general';
  }

  /**
   * Estimate agent complexity for routing decisions
   */
  private estimateAgentComplexity(templateId: string): 'simple' | 'moderate' | 'complex' {
    const complexAgents = ['pydantic-vision', 'react-builder', 'multi-step', 'code-generator'];
    const moderateAgents = ['one-folder', 'file-processor', 'data-analyzer'];
    
    if (complexAgents.includes(templateId)) return 'complex';
    if (moderateAgents.includes(templateId)) return 'moderate';
    return 'simple';
  }

  /**
   * Get template capabilities for HRM decision making
   */
  private getTemplateCapabilities(templateId: string): string[] {
    const template = this.templates.get(templateId);
    if (!template) return [];
    
    return template.capabilities.map(cap => cap.name);
  }

  /**
   * Get memory requirement for agent type
   */
  private getMemoryRequirement(templateId: string): string {
    const highMemoryAgents = ['pydantic-vision', 'ml-inference', 'large-language-model'];
    const mediumMemoryAgents = ['react-builder', 'code-generator', 'data-analyzer'];
    
    if (highMemoryAgents.includes(templateId)) return 'high';
    if (mediumMemoryAgents.includes(templateId)) return 'medium';
    return 'low';
  }

  /**
   * Get CPU requirement for agent type
   */
  private getCPURequirement(templateId: string): string {
    const highCPUAgents = ['pydantic-vision', 'ml-inference', 'video-processing'];
    const mediumCPUAgents = ['react-builder', 'code-generator', 'image-processing'];
    
    if (highCPUAgents.includes(templateId)) return 'high';
    if (mediumCPUAgents.includes(templateId)) return 'medium';
    return 'low';
  }

  /**
   * Get default LLM for template when HRM is unavailable
   */
  private getDefaultLLMForTemplate(templateId: string): string {
    const visionAgents = ['pydantic-vision', 'image-analyzer'];
    const codingAgents = ['react-builder', 'code-generator'];
    
    if (visionAgents.includes(templateId)) return 'claude-3-5-sonnet'; // Best for vision
    if (codingAgents.includes(templateId)) return 'claude-3-5-sonnet'; // Best for coding
    return 'ollama'; // Default local model
  }

  // Private methods for implementation details

  private async createAgentFiles(agent: AgentInstance): Promise<void> {
    const agentDir = join(this.baseDir, 'dynamic-agents', agent.id);
    await fs.mkdir(agentDir, { recursive: true });

    const filePath = join(agentDir, 
      agent.template.language === 'python' ? 'agent.py' : 'agent.ts'
    );
    
    await fs.writeFile(filePath, agent.template.template);
    
    // Create config file
    const configPath = join(agentDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(agent.config, null, 2));
  }

  private async startPythonAgent(agent: AgentInstance): Promise<void> {
    const agentDir = join(this.baseDir, 'dynamic-agents', agent.id);
    
    // Use automated port discovery instead of hardcoded port
    const port = await this.discoverPort(agent.name, 'ml');
    
    const child = spawn('python3', ['agent.py'], {
      cwd: agentDir,
      env: { ...process.env, PORT: port.toString() }
    });

    agent.pid = child.pid;
    agent.port = port;
    agent.endpoint = `http://localhost:${port}`;

    // Started Python agent
  }

  private async startNodeAgent(agent: AgentInstance): Promise<void> {
    const agentDir = join(this.baseDir, 'dynamic-agents', agent.id);
    
    // Use automated port discovery for Node agents too
    const port = await this.discoverPort(agent.name, 'microservice');
    
    const child = spawn('npx', ['tsx', 'agent.ts'], {
      cwd: agentDir,
      env: { ...process.env, PORT: port.toString() }
    });

    agent.pid = child.pid;
    agent.port = port;
    agent.endpoint = `http://localhost:${port}`;

    // Started Node.js agent
  }

  private planTaskSteps(operation: string, params: Record<string, any>): TaskStep[] {
    const steps: TaskStep[] = [];

    switch (operation) {
      case 'build_react_app':
        steps.push(
          { id: 'validate', name: 'Validate Parameters', status: 'pending', progress: 0, logs: [] },
          { id: 'scaffold', name: 'Create Project Structure', status: 'pending', progress: 0, logs: [] },
          { id: 'dependencies', name: 'Install Dependencies', status: 'pending', progress: 0, logs: [] },
          { id: 'components', name: 'Generate Components', status: 'pending', progress: 0, logs: [] },
          { id: 'testing', name: 'Setup Testing', status: 'pending', progress: 0, logs: [] },
          { id: 'finalize', name: 'Finalize Project', status: 'pending', progress: 0, logs: [] }
        );
        break;
      case 'organize_folder':
        steps.push(
          { id: 'analyze', name: 'Analyze Directory', status: 'pending', progress: 0, logs: [] },
          { id: 'plan', name: 'Create Organization Plan', status: 'pending', progress: 0, logs: [] },
          { id: 'execute', name: 'Execute Organization', status: 'pending', progress: 0, logs: [] }
        );
        break;
      case 'generate_image':
        steps.push(
          { id: 'prepare', name: 'Prepare Generation', status: 'pending', progress: 0, logs: [] },
          { id: 'generate', name: 'Generate Image', status: 'pending', progress: 0, logs: [] },
          { id: 'postprocess', name: 'Post-process Image', status: 'pending', progress: 0, logs: [] }
        );
        break;
      default:
        steps.push(
          { id: 'execute', name: 'Execute Operation', status: 'pending', progress: 0, logs: [] }
        );
    }

    return steps;
  }

  private async executeStep(agent: AgentInstance, step: TaskStep, params: Record<string, any>): Promise<void> {
    // Simulate step execution with progress updates
    const startTime = Date.now();
    
    switch (step.id) {
      case 'scaffold':
        step.logs.push('Creating project directory structure...');
        await this.delay(1000);
        step.logs.push('Generating package.json...');
        await this.delay(500);
        step.logs.push('Setting up TypeScript configuration...');
        await this.delay(500);
        break;
        
      case 'dependencies':
        step.logs.push('Installing React dependencies...');
        await this.delay(2000);
        step.logs.push('Installing development dependencies...');
        await this.delay(1500);
        break;
        
      case 'analyze':
        step.logs.push(`Scanning directory: ${params.directory || 'current directory'}`);
        await this.delay(1000);
        step.logs.push('Analyzing file types and sizes...');
        await this.delay(800);
        step.logs.push('Detecting duplicates...');
        await this.delay(600);
        break;
        
      default:
        step.logs.push(`Executing ${step.name}...`);
        await this.delay(1000);
        step.logs.push('Operation completed');
    }

    const duration = Date.now() - startTime;
    step.logs.push(`Completed in ${duration}ms`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Template loading methods
  private async loadOneFolderTemplate(): Promise<string> {
    try {
      return await fs.readFile(join(this.baseDir, 'single-file-agents/one-folder-agent.ts'), 'utf8');
    } catch {
      return this.getDefaultOneFolderTemplate();
    }
  }

  private async loadPydanticTemplate(): Promise<string> {
    try {
      return await fs.readFile(join(this.baseDir, 'python-services/vision-service.py'), 'utf8');
    } catch {
      return this.getDefaultPydanticTemplate();
    }
  }

  private async loadReactBuilderTemplate(): Promise<string> {
    return `#!/usr/bin/env tsx
/**
 * React Builder Agent - Generated from template
 * Specialized agent for building React applications
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

export class ReactBuilderAgent {
  async buildProject(name: string, options: any): Promise<void> {
    // Building React project
    
    // Create React app
    execSync(\`npx create-react-app \${name} --template typescript\`, {
      stdio: 'inherit'
    });
    
    // React project created successfully
  }
}

if (require.main === module) {
  const agent = new ReactBuilderAgent();
  // Agent implementation
}
`;
  }

  private getDefaultOneFolderTemplate(): string {
    return `// Default One Folder Agent Template
export class OneFolderAgent {
  async analyzeDirectory(path: string): Promise<any> {
    // Analyzing directory
    return { files: 0, size: 0 };
  }
}`;
  }

  private getDefaultPydanticTemplate(): string {
    return `# Default PydanticAI Agent Template
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Request(BaseModel):
    message: str

@app.post("/process")
async def process_request(request: Request):
    return {"result": f"Processed: {request.message}"}
`;
  }

  /**
   * Discover and allocate port for agent using the automated port management system
   */
  private async discoverPort(serviceName: string, serviceType: string = 'microservice'): Promise<number> {
    if (!this.portManagerUrl) {
      // Discover port manager URL from service discovery
      this.portManagerUrl = await this.discoverPortManager();
    }

    try {
      const response = await fetch(`${this.portManagerUrl}/api/v1/port-management/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName,
          serviceType,
          preferredPort: null // Let the system choose
        })
      });

      if (!response.ok) {
        throw new Error(`Port allocation failed: ${response.statusText}`);
      }

      const allocation = await response.json();
      // Allocated port for service
      return allocation.port;
    } catch (error) {
      console.warn(`⚠️ Failed to allocate port via port manager, using fallback:`, error);
      // Fallback to finding an available port manually
      return this.findAvailablePort();
    }
  }

  /**
   * Discover the port manager URL from service discovery
   */
  private async discoverPortManager(): Promise<string> {
    // Try common port manager locations
    const candidates = [
      'http://localhost:8081', // Go API Gateway
      'http://localhost:8080', // Alternative gateway
      'http://localhost:8082'  // Rust LLM Router
    ];

    for (const url of candidates) {
      try {
        const response = await fetch(`${url}/api/v1/port-management/allocations`, {
          method: 'GET',
          timeout: 2000
        });
        
        if (response.ok) {
          // Found port manager
          return url;
        }
      } catch {
        // Try next candidate
      }
    }

    throw new Error('Could not discover port manager service');
  }

  /**
   * Fallback method to find available port manually
   */
  private async findAvailablePort(startPort: number = 8100): Promise<number> {
    const net = await import('net');
    
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      
      server.listen(startPort, () => {
        const port = (server.address() as net.AddressInfo)?.port;
        server.close(() => resolve(port));
      });

      server.on('error', () => {
        this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
      });
    });
  }

  /**
   * Connect to Docker services using service discovery
   */
  async connectToDockerServices(): Promise<{
    grounding: string;
    embedding: string;
    voice: string;
    vision: string;
  }> {
    const services = {
      grounding: '',
      embedding: '',
      voice: '',
      vision: ''
    };

    try {
      // Discover services from the port manager
      if (!this.portManagerUrl) {
        this.portManagerUrl = await this.discoverPortManager();
      }

      const response = await fetch(`${this.portManagerUrl}/api/v1/discovery/services`);
      const discoveredServices = await response.json();

      // Map discovered services to our Docker service endpoints
      for (const service of discoveredServices.services) {
        if (service.name.includes('grounding') || service.name.includes('rag')) {
          services.grounding = `http://localhost:${service.port}`;
        } else if (service.name.includes('embedding') || service.name.includes('vector')) {
          services.embedding = `http://localhost:${service.port}`;
        } else if (service.name.includes('voice') || service.name.includes('tts')) {
          services.voice = `http://localhost:${service.port}`;
        } else if (service.name.includes('vision') || service.name.includes('image')) {
          services.vision = `http://localhost:${service.port}`;
        }
      }

      // Discovered Docker services
      return services;
    } catch (error) {
      console.warn('⚠️ Failed to discover Docker services, using defaults:', error);
      
      // Fallback to expected Docker service ports
      return {
        grounding: 'http://localhost:8300',
        embedding: 'http://localhost:8301', 
        voice: 'http://localhost:8302',
        vision: 'http://localhost:8303'
      };
    }
  }
}

// Export types for use by other modules
export type {
  AgentCapability,
  AgentTemplate,
  AgentInstance,
  TaskWindow,
  TaskStep
};