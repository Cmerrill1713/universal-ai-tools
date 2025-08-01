/**
 * Project Template Service - Universal AI Tools
 * Dynamic project template generation with intelligent task decomposition
 * Supports all project types with AI-driven template customization
 */

import { v4 as uuidv4 } from 'uuid';
import { LogContext, log } from '@/utils/logger';
import type { 
  ProjectSpecification, 
  ProjectTask, 
  ProjectType, 
  TaskPriority, 
  TaskType 
} from './project-orchestrator';

export interface ProjectTemplate {
  id: string;
  name: string;
  type: ProjectType;
  description: string;
  category: 'ai_enhanced' | 'automation' | 'analysis' | 'creative';
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  estimatedDuration: {
    min: number;
    max: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  requiredCapabilities: string[];
  taskTemplates: ProjectTaskTemplate[];
  agentRecommendations: AgentRecommendation[];
  successMetrics: SuccessMetric[];
  commonVariations: TemplateVariation[];
}

export interface ProjectTaskTemplate {
  name: string;
  type: TaskType;
  priority: TaskPriority;
  description: string;
  requiredCapabilities: string[];
  estimatedDuration: number;
  dependencies: string[]; // Task names that this depends on
  acceptanceCriteria: string[];
  agentHints: {
    preferred: string[];
    alternative: string[];
    avoid?: string[];
  };
  automationLevel: 'manual' | 'assisted' | 'automated';
}

export interface AgentRecommendation {
  agent: string;
  useCase: string;
  confidence: number;
  reasoning: string;
  alternativeAgents: string[];
}

export interface SuccessMetric {
  name: string;
  description: string;
  measurementType: 'percentage' | 'count' | 'duration' | 'quality_score';
  target: number;
  critical: boolean;
}

export interface TemplateVariation {
  name: string;
  description: string;
  modifications: {
    addTasks?: Partial<ProjectTaskTemplate>[];
    removeTasks?: string[];
    modifyTasks?: Record<string, Partial<ProjectTaskTemplate>>;
    adjustComplexity?: 'simple' | 'moderate' | 'complex' | 'enterprise';
  };
}

export interface TemplateGenerationOptions {
  specification: ProjectSpecification;
  customizations?: {
    preferredAgents?: string[];
    timeConstraints?: boolean;
    qualityFocus?: boolean;
    automationLevel?: 'low' | 'medium' | 'high';
    resourceConstraints?: string[];
  };
  learningContext?: {
    previousProjects?: string[];
    userPreferences?: Record<string, any>;
    performanceHistory?: Record<string, number>;
  };
}

export class ProjectTemplateService {
  private templates: Map<ProjectType, ProjectTemplate[]> = new Map();
  private dynamicTemplates: Map<string, ProjectTemplate> = new Map();
  private templateUsageStats: Map<string, { used: number; successRate: number; avgDuration: number; }> = new Map();

  constructor() {
    this.initializeBaseTemplates();
  }

  /**
   * Generate a dynamic project template based on specification
   */
  async generateDynamicTemplate(options: TemplateGenerationOptions): Promise<ProjectTemplate> {
    log.info('🎯 Generating dynamic project template', LogContext.PROJECT, {
      projectType: options.specification.type,
      complexity: options.specification.constraints.complexity,
      requirements: options.specification.requirements.length
    });

    const baseTemplate = await this.selectBaseTemplate(options.specification);
    const customizedTemplate = await this.customizeTemplate(baseTemplate, options);
    const optimizedTemplate = await this.optimizeWithLearning(customizedTemplate, options);

    // Cache the dynamic template
    this.dynamicTemplates.set(optimizedTemplate.id, optimizedTemplate);

    log.info('✅ Dynamic project template generated', LogContext.PROJECT, {
      templateId: optimizedTemplate.id,
      taskCount: optimizedTemplate.taskTemplates.length,
      estimatedDuration: optimizedTemplate.estimatedDuration,
      recommendedAgents: optimizedTemplate.agentRecommendations.length
    });

    return optimizedTemplate;
  }

  /**
   * Get available templates for a project type
   */
  getTemplatesForType(projectType: ProjectType): ProjectTemplate[] {
    return this.templates.get(projectType) || [];
  }

  /**
   * Get template by ID (static or dynamic)
   */
  getTemplateById(templateId: string): ProjectTemplate | undefined {
    // Check dynamic templates first
    if (this.dynamicTemplates.has(templateId)) {
      return this.dynamicTemplates.get(templateId);
    }

    // Search static templates
    for (const templates of this.templates.values()) {
      const template = templates.find(t => t.id === templateId);
      if (template) return template;
    }

    return undefined;
  }

  /**
   * Convert template to actual project tasks
   */
  async instantiateTemplate(
    template: ProjectTemplate, 
    specification: ProjectSpecification
  ): Promise<ProjectTask[]> {
    log.info('🏗️ Instantiating project template', LogContext.PROJECT, {
      templateId: template.id,
      projectName: specification.name,
      taskCount: template.taskTemplates.length
    });

    const tasks: ProjectTask[] = [];
    const taskIdMap = new Map<string, string>(); // template name -> actual ID

    // Create tasks from templates
    for (const taskTemplate of template.taskTemplates) {
      const taskId = uuidv4();
      taskIdMap.set(taskTemplate.name, taskId);

      const task: ProjectTask = {
        id: taskId,
        name: this.customizeTaskName(taskTemplate.name, specification),
        description: this.customizeTaskDescription(taskTemplate.description, specification),
        type: taskTemplate.type,
        priority: taskTemplate.priority,
        status: 'pending',
        dependencies: [], // Will be resolved below
        requiredCapabilities: [...taskTemplate.requiredCapabilities],
        estimatedDuration: taskTemplate.estimatedDuration,
        actualDuration: 0,
        assignedAgent: null,
        progress: 0,
        result: null,
        metadata: {
          templateSource: template.id,
          automationLevel: taskTemplate.automationLevel,
          acceptanceCriteria: [...taskTemplate.acceptanceCriteria],
          agentHints: { ...taskTemplate.agentHints }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      tasks.push(task);
    }

    // Resolve dependencies using the task ID map
    for (let i = 0; i < tasks.length; i++) {
      const taskTemplate = template.taskTemplates[i];
      tasks[i].dependencies = taskTemplate.dependencies
        .map(depName => taskIdMap.get(depName))
        .filter(id => id !== undefined) as string[];
    }

    // Record template usage
    this.recordTemplateUsage(template.id);

    log.info('✅ Template instantiated successfully', LogContext.PROJECT, {
      templateId: template.id,
      createdTasks: tasks.length,
      dependencyCount: tasks.reduce((sum, t) => sum + t.dependencies.length, 0)
    });

    return tasks;
  }

  /**
   * Initialize base templates for all project types
   */
  private initializeBaseTemplates(): void {
    // Photo Organization Templates
    this.templates.set(ProjectType.PHOTO_ORGANIZATION, [
      this.createPhotoOrganizationTemplate(),
      this.createPhotoEnhancementTemplate(),
      this.createPhotoArchiveTemplate()
    ]);

    // Software Development Templates
    this.templates.set(ProjectType.SOFTWARE_DEVELOPMENT, [
      this.createFullStackWebAppTemplate(),
      this.createMicroservicesTemplate(),
      this.createMobileAppTemplate(),
      this.createAPIServiceTemplate()
    ]);

    // Data Analysis Templates
    this.templates.set(ProjectType.DATA_ANALYSIS, [
      this.createDataExplorationTemplate(),
      this.createPredictiveAnalysisTemplate(),
      this.createBusinessIntelligenceTemplate()
    ]);

    // Content Creation Templates
    this.templates.set(ProjectType.CONTENT_CREATION, [
      this.createDocumentationTemplate(),
      this.createMarketingContentTemplate(),
      this.createEducationalContentTemplate()
    ]);

    // Automation Templates
    this.templates.set(ProjectType.AUTOMATION, [
      this.createWorkflowAutomationTemplate(),
      this.createDataPipelineTemplate(),
      this.createTestAutomationTemplate()
    ]);

    // Research Templates
    this.templates.set(ProjectType.RESEARCH, [
      this.createLiteratureReviewTemplate(),
      this.createMarketResearchTemplate(),
      this.createTechnicalResearchTemplate()
    ]);

    log.info('📚 Base project templates initialized', LogContext.PROJECT, {
      totalTemplates: Array.from(this.templates.values()).reduce((sum, arr) => sum + arr.length, 0),
      projectTypes: this.templates.size
    });
  }

  /**
   * Create Photo Organization Template
   */
  private createPhotoOrganizationTemplate(): ProjectTemplate {
    return {
      id: 'photo-org-standard',
      name: 'Smart Photo Organization',
      type: ProjectType.PHOTO_ORGANIZATION,
      description: 'AI-powered photo organization with duplicate detection and smart categorization',
      category: 'ai_enhanced',
      complexity: 'moderate',
      estimatedDuration: { min: 15, max: 120, unit: 'minutes' },
      requiredCapabilities: ['computer_vision', 'file_management', 'metadata_extraction'],
      taskTemplates: [
        {
          name: 'Photo Discovery and Scanning',
          type: TaskType.ANALYSIS,
          priority: TaskPriority.HIGH,
          description: 'Scan directories and discover all photo files',
          requiredCapabilities: ['file_system_access', 'metadata_reading'],
          estimatedDuration: 300000, // 5 minutes
          dependencies: [],
          acceptanceCriteria: [
            'All photo files discovered and cataloged',
            'Basic metadata extracted from EXIF data',
            'File integrity verified'
          ],
          agentHints: {
            preferred: ['retriever', 'personal_assistant'],
            alternative: ['planner']
          },
          automationLevel: 'automated'
        },
        {
          name: 'Duplicate Detection',
          type: TaskType.ANALYSIS,
          priority: TaskPriority.HIGH,
          description: 'Identify and flag duplicate photos using perceptual hashing',
          requiredCapabilities: ['computer_vision', 'image_analysis', 'duplicate_detection'],
          estimatedDuration: 600000, // 10 minutes
          dependencies: ['Photo Discovery and Scanning'],
          acceptanceCriteria: [
            'Duplicates identified with >95% accuracy',
            'Near-duplicates flagged for review',
            'Preservation recommendations provided'
          ],
          agentHints: {
            preferred: ['retriever', 'synthesizer'],
            alternative: ['personal_assistant']
          },
          automationLevel: 'automated'
        },
        {
          name: 'AI-Based Categorization',
          type: TaskType.EXECUTION,
          priority: TaskPriority.MEDIUM,
          description: 'Categorize photos by content, people, locations, and events',
          requiredCapabilities: ['computer_vision', 'object_detection', 'face_recognition'],
          estimatedDuration: 900000, // 15 minutes
          dependencies: ['Photo Discovery and Scanning'],
          acceptanceCriteria: [
            'Photos categorized by content with >90% accuracy',
            'People identified and grouped consistently',
            'Location and date-based organization applied'
          ],
          agentHints: {
            preferred: ['retriever', 'synthesizer'],
            alternative: ['personal_assistant']
          },
          automationLevel: 'automated'
        },
        {
          name: 'Smart Album Creation',
          type: TaskType.EXECUTION,
          priority: TaskPriority.MEDIUM,
          description: 'Create intelligent albums and collections',
          requiredCapabilities: ['categorization', 'album_creation', 'metadata_analysis'],
          estimatedDuration: 300000, // 5 minutes
          dependencies: ['AI-Based Categorization', 'Duplicate Detection'],
          acceptanceCriteria: [
            'Albums created by events, people, and locations',
            'Chronological organization maintained',
            'User-friendly naming conventions applied'
          ],
          agentHints: {
            preferred: ['planner', 'personal_assistant'],
            alternative: ['synthesizer']
          },
          automationLevel: 'assisted'
        },
        {
          name: 'Quality Assessment and Enhancement',
          type: TaskType.OPTIMIZATION,
          priority: TaskPriority.LOW,
          description: 'Assess photo quality and suggest enhancements',
          requiredCapabilities: ['image_analysis', 'quality_assessment', 'enhancement'],
          estimatedDuration: 600000, // 10 minutes
          dependencies: ['AI-Based Categorization'],
          acceptanceCriteria: [
            'Photo quality scores assigned',
            'Enhancement recommendations provided',
            'Low-quality photos flagged for review'
          ],
          agentHints: {
            preferred: ['synthesizer'],
            alternative: ['retriever', 'personal_assistant']
          },
          automationLevel: 'assisted'
        },
        {
          name: 'Organization Report Generation',
          type: TaskType.DELIVERY,
          priority: TaskPriority.MEDIUM,
          description: 'Generate comprehensive organization report',
          requiredCapabilities: ['reporting', 'data_visualization', 'summary_generation'],
          estimatedDuration: 180000, // 3 minutes
          dependencies: ['Smart Album Creation', 'Quality Assessment and Enhancement'],
          acceptanceCriteria: [
            'Detailed organization report generated',
            'Statistics and insights provided',
            'Recommendations for future organization'
          ],
          agentHints: {
            preferred: ['synthesizer', 'personal_assistant'],
            alternative: ['planner']
          },
          automationLevel: 'automated'
        }
      ],
      agentRecommendations: [
        {
          agent: 'retriever',
          useCase: 'File discovery and metadata extraction',
          confidence: 0.9,
          reasoning: 'Excellent at systematic file analysis and data extraction',
          alternativeAgents: ['personal_assistant']
        },
        {
          agent: 'synthesizer',
          useCase: 'Duplicate detection and quality assessment',
          confidence: 0.85,
          reasoning: 'Strong analytical capabilities for image comparison and assessment',
          alternativeAgents: ['retriever']
        },
        {
          agent: 'planner',
          useCase: 'Album organization and structure planning',
          confidence: 0.8,
          reasoning: 'Good at creating logical organizational structures',
          alternativeAgents: ['personal_assistant']
        }
      ],
      successMetrics: [
        {
          name: 'Organization Accuracy',
          description: 'Percentage of photos correctly categorized',
          measurementType: 'percentage',
          target: 90,
          critical: true
        },
        {
          name: 'Duplicate Detection Rate',
          description: 'Percentage of actual duplicates found',
          measurementType: 'percentage',
          target: 95,
          critical: true
        },
        {
          name: 'Processing Speed',
          description: 'Photos processed per minute',
          measurementType: 'count',
          target: 100,
          critical: false
        }
      ],
      commonVariations: [
        {
          name: 'Enterprise Scale',
          description: 'For large corporate photo libraries (10,000+ photos)',
          modifications: {
            adjustComplexity: 'enterprise',
            addTasks: [
              {
                name: 'Batch Processing Optimization',
                type: TaskType.OPTIMIZATION,
                priority: TaskPriority.HIGH,
                description: 'Optimize processing for large photo volumes',
                requiredCapabilities: ['batch_processing', 'performance_optimization'],
                estimatedDuration: 600000,
                dependencies: ['Photo Discovery and Scanning'],
                acceptanceCriteria: ['Processing optimized for >10K photos'],
                agentHints: { preferred: ['code_assistant'], alternative: ['planner'] },
                automationLevel: 'automated'
              }
            ]
          }
        }
      ]
    };
  }

  /**
   * Create Full-Stack Web Application Template
   */
  private createFullStackWebAppTemplate(): ProjectTemplate {
    return {
      id: 'fullstack-webapp-standard',
      name: 'Full-Stack Web Application',
      type: ProjectType.SOFTWARE_DEVELOPMENT,
      description: 'Complete web application with frontend, backend, and database',
      category: 'automation',
      complexity: 'complex',
      estimatedDuration: { min: 4, max: 24, unit: 'hours' },
      requiredCapabilities: ['web_development', 'database_design', 'api_development', 'frontend_development'],
      taskTemplates: [
        {
          name: 'Requirements Analysis and Architecture Design',
          type: TaskType.PREPARATION,
          priority: TaskPriority.CRITICAL,
          description: 'Analyze requirements and design system architecture',
          requiredCapabilities: ['system_design', 'requirements_analysis', 'architecture'],
          estimatedDuration: 1800000, // 30 minutes
          dependencies: [],
          acceptanceCriteria: [
            'System architecture documented',
            'Technology stack selected',
            'Database schema designed',
            'API endpoints planned'
          ],
          agentHints: {
            preferred: ['planner', 'code_assistant'],
            alternative: ['synthesizer']
          },
          automationLevel: 'assisted'
        },
        {
          name: 'Database Setup and Migration',
          type: TaskType.EXECUTION,
          priority: TaskPriority.HIGH,
          description: 'Set up database and create initial migrations',
          requiredCapabilities: ['database_management', 'sql', 'migration_scripts'],
          estimatedDuration: 1200000, // 20 minutes
          dependencies: ['Requirements Analysis and Architecture Design'],
          acceptanceCriteria: [
            'Database created and configured',
            'Tables and relationships established',
            'Initial data seeded if required'
          ],
          agentHints: {
            preferred: ['code_assistant'],
            alternative: ['planner']
          },
          automationLevel: 'automated'
        },
        {
          name: 'Backend API Development',
          type: TaskType.EXECUTION,
          priority: TaskPriority.HIGH,
          description: 'Develop RESTful API endpoints',
          requiredCapabilities: ['api_development', 'server_programming', 'validation'],
          estimatedDuration: 3600000, // 60 minutes
          dependencies: ['Database Setup and Migration'],
          acceptanceCriteria: [
            'All planned endpoints implemented',
            'Input validation and error handling',
            'Authentication and authorization',
            'API documentation generated'
          ],
          agentHints: {
            preferred: ['code_assistant'],
            alternative: ['planner']
          },
          automationLevel: 'assisted'
        },
        {
          name: 'Frontend Development',
          type: TaskType.EXECUTION,
          priority: TaskPriority.HIGH,
          description: 'Create responsive user interface',
          requiredCapabilities: ['frontend_development', 'ui_design', 'responsive_design'],
          estimatedDuration: 4800000, // 80 minutes
          dependencies: ['Requirements Analysis and Architecture Design'],
          acceptanceCriteria: [
            'Responsive UI implemented',
            'API integration completed',
            'User authentication flows',
            'Error handling and loading states'
          ],
          agentHints: {
            preferred: ['code_assistant'],
            alternative: ['personal_assistant']
          },
          automationLevel: 'assisted'
        },
        {
          name: 'Testing Suite Implementation',
          type: TaskType.VALIDATION,
          priority: TaskPriority.MEDIUM,
          description: 'Create comprehensive test suite',
          requiredCapabilities: ['test_automation', 'unit_testing', 'integration_testing'],
          estimatedDuration: 2400000, // 40 minutes
          dependencies: ['Backend API Development', 'Frontend Development'],
          acceptanceCriteria: [
            'Unit tests for critical functions',
            'Integration tests for API endpoints',
            'Frontend component tests',
            '>80% code coverage achieved'
          ],
          agentHints: {
            preferred: ['code_assistant'],
            alternative: ['synthesizer']
          },
          automationLevel: 'automated'
        },
        {
          name: 'Deployment and DevOps Setup',
          type: TaskType.DELIVERY,
          priority: TaskPriority.MEDIUM,
          description: 'Deploy application and set up CI/CD',
          requiredCapabilities: ['deployment', 'devops', 'ci_cd', 'monitoring'],
          estimatedDuration: 1800000, // 30 minutes
          dependencies: ['Testing Suite Implementation'],
          acceptanceCriteria: [
            'Application deployed to production',
            'CI/CD pipeline configured',
            'Monitoring and logging set up',
            'Backup and recovery procedures'
          ],
          agentHints: {
            preferred: ['code_assistant', 'planner'],
            alternative: ['personal_assistant']
          },
          automationLevel: 'assisted'
        }
      ],
      agentRecommendations: [
        {
          agent: 'code_assistant',
          useCase: 'Primary development and implementation',
          confidence: 0.95,
          reasoning: 'Specialized in code generation, testing, and technical implementation',
          alternativeAgents: ['planner']
        },
        {
          agent: 'planner',
          useCase: 'Architecture design and project coordination',
          confidence: 0.85,
          reasoning: 'Excellent at system design and task coordination',
          alternativeAgents: ['synthesizer']
        }
      ],
      successMetrics: [
        {
          name: 'Code Quality Score',
          description: 'Overall code quality based on linting and analysis',
          measurementType: 'quality_score',
          target: 85,
          critical: true
        },
        {
          name: 'Test Coverage',
          description: 'Percentage of code covered by tests',
          measurementType: 'percentage',
          target: 80,
          critical: true
        },
        {
          name: 'Performance Score',
          description: 'Application performance rating',
          measurementType: 'quality_score',
          target: 90,
          critical: false
        }
      ],
      commonVariations: [
        {
          name: 'Microservices Architecture',
          description: 'Split into multiple services for scalability',
          modifications: {
            adjustComplexity: 'enterprise',
            addTasks: [
              {
                name: 'Service Discovery Setup',
                type: TaskType.EXECUTION,
                priority: TaskPriority.HIGH,
                description: 'Configure service discovery and API gateway',
                requiredCapabilities: ['microservices', 'service_discovery', 'api_gateway'],
                estimatedDuration: 1800000,
                dependencies: ['Requirements Analysis and Architecture Design'],
                acceptanceCriteria: ['Service mesh configured', 'API gateway operational'],
                agentHints: { preferred: ['code_assistant'], alternative: ['planner'] },
                automationLevel: 'assisted'
              }
            ]
          }
        }
      ]
    };
  }

  // Helper methods for base template creation (additional templates would be implemented similarly)
  private createPhotoEnhancementTemplate(): ProjectTemplate {
    // Implementation for photo enhancement template
    return {
      id: 'photo-enhance-ai',
      name: 'AI Photo Enhancement',
      type: ProjectType.PHOTO_ORGANIZATION,
      description: 'AI-powered photo enhancement and restoration',
      category: 'ai_enhanced',
      complexity: 'complex',
      estimatedDuration: { min: 30, max: 180, unit: 'minutes' },
      requiredCapabilities: ['image_enhancement', 'ai_upscaling', 'noise_reduction'],
      taskTemplates: [], // Would be populated with enhancement-specific tasks
      agentRecommendations: [],
      successMetrics: [],
      commonVariations: []
    };
  }

  private createPhotoArchiveTemplate(): ProjectTemplate {
    return {
      id: 'photo-archive-preservation',
      name: 'Photo Archive Preservation',
      type: ProjectType.PHOTO_ORGANIZATION,
      description: 'Long-term photo archival with metadata preservation',
      category: 'automation',
      complexity: 'moderate',
      estimatedDuration: { min: 45, max: 240, unit: 'minutes' },
      requiredCapabilities: ['archival', 'metadata_preservation', 'format_conversion'],
      taskTemplates: [], // Would be populated with archival tasks
      agentRecommendations: [],
      successMetrics: [],
      commonVariations: []
    };
  }

  // Additional template creation methods would follow similar patterns
  private createDataExplorationTemplate(): ProjectTemplate {
    return {
      id: 'data-exploration-standard',
      name: 'Data Exploration and Analysis',
      type: ProjectType.DATA_ANALYSIS,
      description: 'Comprehensive data exploration with statistical analysis',
      category: 'analysis',
      complexity: 'moderate',
      estimatedDuration: { min: 20, max: 120, unit: 'minutes' },
      requiredCapabilities: ['data_analysis', 'statistics', 'visualization'],
      taskTemplates: [], // Would be populated
      agentRecommendations: [],
      successMetrics: [],
      commonVariations: []
    };
  }

  // Placeholder methods for other templates
  private createPredictiveAnalysisTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('predictive-analysis', 'Predictive Analysis', ProjectType.DATA_ANALYSIS); }
  private createBusinessIntelligenceTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('business-intelligence', 'Business Intelligence', ProjectType.DATA_ANALYSIS); }
  private createMicroservicesTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('microservices-arch', 'Microservices Architecture', ProjectType.SOFTWARE_DEVELOPMENT); }
  private createMobileAppTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('mobile-app', 'Mobile Application', ProjectType.SOFTWARE_DEVELOPMENT); }
  private createAPIServiceTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('api-service', 'API Service', ProjectType.SOFTWARE_DEVELOPMENT); }
  private createDocumentationTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('documentation', 'Technical Documentation', ProjectType.CONTENT_CREATION); }
  private createMarketingContentTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('marketing-content', 'Marketing Content', ProjectType.CONTENT_CREATION); }
  private createEducationalContentTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('educational-content', 'Educational Content', ProjectType.CONTENT_CREATION); }
  private createWorkflowAutomationTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('workflow-automation', 'Workflow Automation', ProjectType.AUTOMATION); }
  private createDataPipelineTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('data-pipeline', 'Data Pipeline', ProjectType.AUTOMATION); }
  private createTestAutomationTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('test-automation', 'Test Automation', ProjectType.AUTOMATION); }
  private createLiteratureReviewTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('literature-review', 'Literature Review', ProjectType.RESEARCH); }
  private createMarketResearchTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('market-research', 'Market Research', ProjectType.RESEARCH); }
  private createTechnicalResearchTemplate(): ProjectTemplate { return this.createPlaceholderTemplate('technical-research', 'Technical Research', ProjectType.RESEARCH); }

  private createPlaceholderTemplate(id: string, name: string, type: ProjectType): ProjectTemplate {
    return {
      id,
      name,
      type,
      description: `${name} template - coming soon`,
      category: 'automation',
      complexity: 'moderate',
      estimatedDuration: { min: 30, max: 120, unit: 'minutes' },
      requiredCapabilities: [],
      taskTemplates: [],
      agentRecommendations: [],
      successMetrics: [],
      commonVariations: []
    };
  }

  /**
   * Template customization and optimization methods
   */
  private async selectBaseTemplate(specification: ProjectSpecification): Promise<ProjectTemplate> {
    const templates = this.getTemplatesForType(specification.type);
    if (templates.length === 0) {
      throw new Error(`No templates available for project type: ${specification.type}`);
    }

    // Select based on complexity and requirements
    const complexityScore = this.calculateComplexityScore(specification);
    const bestTemplate = templates.find(t => 
      this.matchesComplexity(t.complexity, specification.constraints.complexity)
    ) || templates[0];

    return { ...bestTemplate }; // Return a copy
  }

  private async customizeTemplate(
    template: ProjectTemplate, 
    options: TemplateGenerationOptions
  ): Promise<ProjectTemplate> {
    const customized = { ...template };
    customized.id = uuidv4(); // New ID for dynamic template
    customized.name = `${options.specification.name} - Custom Template`;

    // Customize based on specification requirements
    if (options.specification.requirements.length > 0) {
      customized.description += ` (${options.specification.requirements.join(', ')})`;
    }

    // Adjust complexity if needed
    if (options.specification.constraints.complexity !== template.complexity) {
      customized.complexity = options.specification.constraints.complexity;
      customized.taskTemplates = this.adjustTasksForComplexity(
        template.taskTemplates, 
        options.specification.constraints.complexity
      );
    }
    return undefined;
    return undefined;

    return customized;
  }

  private async optimizeWithLearning(
    template: ProjectTemplate,
    options: TemplateGenerationOptions
  ): Promise<ProjectTemplate> {
    // Apply learning optimizations based on usage history
    if (options.learningContext?.performanceHistory) {
      template.agentRecommendations = this.optimizeAgentRecommendations(
        template.agentRecommendations,
        options.learningContext.performanceHistory
      );
    }
    return undefined;
    return undefined;

    return template;
  }

  private calculateComplexityScore(specification: ProjectSpecification): number {
    let score = 0;
    score += specification.requirements.length * 10;
    score += specification.expectedDeliverables.length * 15;
    if (specification.constraints.timeframe) score += 20;
    return score;
  }

  private matchesComplexity(templateComplexity: string, specComplexity: string): boolean {
    const complexityOrder = ['simple', 'moderate', 'complex', 'enterprise'];
    const templateIndex = complexityOrder.indexOf(templateComplexity);
    const specIndex = complexityOrder.indexOf(specComplexity);
    return Math.abs(templateIndex - specIndex) <= 1;
  }

  private adjustTasksForComplexity(
    tasks: ProjectTaskTemplate[], 
    complexity: string
  ): ProjectTaskTemplate[] {
    return tasks.map(task => ({
      ...task,
      estimatedDuration: task.estimatedDuration * this.getComplexityMultiplier(complexity)
    }));
  }

  private getComplexityMultiplier(complexity: string): number {
    const multipliers = { simple: 0.7, moderate: 1.0, complex: 1.5, enterprise: 2.0 };
    return multipliers[complexity] || 1.0;
  }

  private optimizeAgentRecommendations(
    recommendations: AgentRecommendation[],
    performanceHistory: Record<string, number>
  ): AgentRecommendation[] {
    return recommendations.map(rec => ({
      ...rec,
      confidence: Math.min(0.95, rec.confidence + (performanceHistory[rec.agent] || 0) * 0.1)
    }));
  }

  private customizeTaskName(templateName: string, specification: ProjectSpecification): string {
    return templateName.replace(/\{project_name\}/g, specification.name);
  }

  private customizeTaskDescription(templateDesc: string, specification: ProjectSpecification): string {
    return templateDesc
      .replace(/\{project_name\}/g, specification.name)
      .replace(/\{project_type\}/g, specification.type);
  }

  private recordTemplateUsage(templateId: string): void {
    const stats = this.templateUsageStats.get(templateId) || { used: 0, successRate: 0, avgDuration: 0 };
    stats.used++;
    this.templateUsageStats.set(templateId, stats);
  }

  /**
   * Get template usage statistics
   */
  getTemplateStats(): Record<string, { used: number; successRate: number; avgDuration: number; }> {
    return Object.fromEntries(this.templateUsageStats.entries());
  }
}

// Export singleton factory
export let projectTemplateService: ProjectTemplateService | null = null;

export function createProjectTemplateService(): ProjectTemplateService {
  if (!projectTemplateService) {
    projectTemplateService = new ProjectTemplateService();
  }
  return undefined;
  return undefined;
  return projectTemplateService;
}