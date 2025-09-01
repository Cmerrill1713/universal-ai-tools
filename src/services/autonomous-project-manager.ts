import { EventEmitter } from 'events';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import { getSupabaseServiceClient } from '@/services/database-service';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ProjectRequirements {
  name: string;
  description: string;
  type: 'web_app' | 'mobile_app' | 'api' | 'ml_model' | 'data_pipeline' | 'automation' | 'custom';
  technologies: string[];
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  timeline: string; // e.g., "2 weeks", "1 month"
  priority: 'low' | 'medium' | 'high' | 'urgent';
  resources: {
    budget?: number;
    teamSize?: number;
    requiredSkills: string[];
  };
  constraints?: {
    deadline?: string;
    platforms?: string[];
    performance?: string[];
    security?: string[];
  };
  deliverables: string[];
  stakeholders: string[];
}

interface ProjectPlan {
  id: string;
  name: string;
  phases: ProjectPhase[];
  estimatedDuration: number; // in days
  totalTasks: number;
  dependencies: string[];
  riskAssessment: RiskAssessment;
  resourceAllocation: ResourceAllocation;
  milestones: Milestone[];
  qualityGates: QualityGate[];
}

interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  estimatedDays: number;
  tasks: Task[];
  dependencies: string[];
  deliverables: string[];
  skillsRequired: string[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'development' | 'testing' | 'deployment' | 'documentation' | 'design' | 'research';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours: number;
  dependencies: string[];
  assignee?: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  tags: string[];
  acceptanceCriteria: string[];
  techSpecs?: {
    frameworks?: string[];
    apis?: string[];
    databases?: string[];
    tools?: string[];
  };
}

interface RiskAssessment {
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  identifiedRisks: Risk[];
  mitigationStrategies: string[];
}

interface Risk {
  id: string;
  description: string;
  probability: number; // 0-1
  impact: number; // 0-1
  category: 'technical' | 'resource' | 'schedule' | 'external' | 'quality';
  mitigationPlan: string;
}

interface ResourceAllocation {
  roles: {
    role: string;
    skillLevel: 'junior' | 'mid' | 'senior' | 'expert';
    allocation: number; // percentage of time
    duration: number; // in days
  }[];
  tools: string[];
  infrastructure: string[];
  budget: {
    development: number;
    testing: number;
    deployment: number;
    maintenance: number;
  };
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  deliverables: string[];
  acceptanceCriteria: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
}

interface QualityGate {
  id: string;
  name: string;
  criteria: string[];
  tools: string[];
  threshold: number;
  blocking: boolean;
}

interface ProjectExecution {
  projectId: string;
  currentPhase: string;
  completedTasks: number;
  totalTasks: number;
  progress: number; // percentage
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';
  startDate: Date;
  estimatedEndDate: Date;
  actualEndDate?: Date;
  budget: {
    allocated: number;
    spent: number;
    remaining: number;
  };
  metrics: {
    velocity: number; // tasks per day
    qualityScore: number;
    riskScore: number;
    stakeholderSatisfaction: number;
  };
  issues: ProjectIssue[];
  achievements: ProjectAchievement[];
}

interface ProjectIssue {
  id: string;
  type: 'blocker' | 'bug' | 'risk' | 'delay' | 'resource' | 'quality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  resolution?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignee?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

interface ProjectAchievement {
  id: string;
  title: string;
  description: string;
  category: 'milestone' | 'quality' | 'performance' | 'innovation' | 'delivery';
  impact: string;
  achievedAt: Date;
  metrics?: Record<string, number>;
}

export class AutonomousProjectManager extends EventEmitter {
  private supabase: SupabaseClient;
  private activeProjects: Map<string, ProjectExecution> = new Map();
  private projectTemplates: Map<string, ProjectPlan> = new Map();
  private isInitialized = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Autonomous Project Manager', { component: 'AutonomousProjectManager' });
      
      this.supabase = getSupabaseServiceClient();
      
      // Load project templates
      await this.loadProjectTemplates();
      
      // Load active projects
      await this.loadActiveProjects();
      
      // Start monitoring loop
      this.startMonitoring();
      
      this.isInitialized = true;
      logger.info('Autonomous Project Manager initialized successfully', { 
        component: 'AutonomousProjectManager',
        templatesLoaded: this.projectTemplates.size,
        activeProjects: this.activeProjects.size
      });
      
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Autonomous Project Manager', { 
        error: error.message,
        component: 'AutonomousProjectManager'
      });
      throw error;
    }
  }

  async createProject(requirements: ProjectRequirements): Promise<string> {
    try {
      logger.info('Creating new autonomous project', { 
        name: requirements.name,
        type: requirements.type,
        complexity: requirements.complexity,
        component: 'AutonomousProjectManager'
      });

      // Generate intelligent project plan
      const projectPlan = await this.generateProjectPlan(requirements);
      
      // Validate project feasibility
      const feasibilityReport = await this.validateProjectFeasibility(projectPlan, requirements);
      
      if (!feasibilityReport.feasible) {
        throw new Error(`Project not feasible: ${feasibilityReport.reasons.join(', ')}`);
      }

      // Create project record in database
      const { data: project, error } = await this.supabase
        .from('autonomous_projects')
        .insert({
          name: requirements.name,
          description: requirements.description,
          type: requirements.type,
          requirements: requirements,
          plan: projectPlan,
          status: 'planning',
          created_at: new Date().toISOString(),
          estimated_end_date: new Date(Date.now() + projectPlan.estimatedDuration * 24 * 60 * 60 * 1000).toISOString()
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create project: ${error.message}`);
      }

      const projectId = project.id;

      // Initialize project execution
      const execution: ProjectExecution = {
        projectId,
        currentPhase: projectPlan.phases[0]?.id || 'planning',
        completedTasks: 0,
        totalTasks: projectPlan.totalTasks,
        progress: 0,
        status: 'planning',
        startDate: new Date(),
        estimatedEndDate: new Date(Date.now() + projectPlan.estimatedDuration * 24 * 60 * 60 * 1000),
        budget: {
          allocated: requirements.resources.budget || 0,
          spent: 0,
          remaining: requirements.resources.budget || 0
        },
        metrics: {
          velocity: 0,
          qualityScore: 100,
          riskScore: this.calculateInitialRiskScore(projectPlan.riskAssessment),
          stakeholderSatisfaction: 100
        },
        issues: [],
        achievements: []
      };

      this.activeProjects.set(projectId, execution);

      // Create project directory structure
      await this.createProjectStructure(projectId, requirements, projectPlan);

      // Schedule initial tasks
      await this.scheduleProjectTasks(projectId, projectPlan);

      logger.info('Autonomous project created successfully', { 
        projectId,
        name: requirements.name,
        estimatedDuration: projectPlan.estimatedDuration,
        totalTasks: projectPlan.totalTasks,
        component: 'AutonomousProjectManager'
      });

      this.emit('project_created', { projectId, name: requirements.name, plan: projectPlan });

      return projectId;
    } catch (error) {
      logger.error('Failed to create autonomous project', { 
        error: error.message,
        requirements: requirements.name,
        component: 'AutonomousProjectManager'
      });
      throw error;
    }
  }

  private async generateProjectPlan(requirements: ProjectRequirements): Promise<ProjectPlan> {
    try {
      // Select appropriate template based on project type and complexity
      const templateKey = `${requirements.type}_${requirements.complexity}`;
      let baseTemplate = this.projectTemplates.get(templateKey) || 
                        this.projectTemplates.get(requirements.type) ||
                        this.projectTemplates.get('default');

      if (!baseTemplate) {
        baseTemplate = this.createDefaultTemplate(requirements);
      }

      // Customize template based on specific requirements
      const customizedPlan = await this.customizeProjectPlan(baseTemplate, requirements);

      // Add intelligent estimates and dependencies
      await this.enhanceProjectPlanWithAI(customizedPlan, requirements);

      return customizedPlan;
    } catch (error) {
      logger.error('Failed to generate project plan', { error: error.message, component: 'AutonomousProjectManager' });
      throw error;
    }
  }

  private createDefaultTemplate(requirements: ProjectRequirements): ProjectPlan {
    const phases: ProjectPhase[] = [
      {
        id: 'planning',
        name: 'Project Planning',
        description: 'Initial project setup and planning',
        order: 1,
        estimatedDays: 5,
        tasks: [
          {
            id: 'requirements_analysis',
            title: 'Requirements Analysis',
            description: 'Detailed analysis of project requirements',
            type: 'research',
            priority: 'high',
            estimatedHours: 16,
            dependencies: [],
            status: 'not_started',
            tags: ['analysis', 'requirements'],
            acceptanceCriteria: ['Requirements document completed', 'Stakeholder approval obtained']
          },
          {
            id: 'tech_stack_selection',
            title: 'Technology Stack Selection',
            description: 'Choose appropriate technologies for the project',
            type: 'research',
            priority: 'high',
            estimatedHours: 8,
            dependencies: ['requirements_analysis'],
            status: 'not_started',
            tags: ['technology', 'architecture'],
            acceptanceCriteria: ['Technology choices documented', 'Architecture diagram created']
          }
        ],
        dependencies: [],
        deliverables: ['Requirements Document', 'Technical Architecture'],
        skillsRequired: ['Project Management', 'System Analysis']
      },
      {
        id: 'development',
        name: 'Development',
        description: 'Core development phase',
        order: 2,
        estimatedDays: this.estimateDevelopmentDays(requirements),
        tasks: [],
        dependencies: ['planning'],
        deliverables: ['Working Application', 'Documentation'],
        skillsRequired: this.getRequiredSkills(requirements)
      },
      {
        id: 'testing',
        name: 'Testing & Quality Assurance',
        description: 'Comprehensive testing and quality validation',
        order: 3,
        estimatedDays: Math.ceil(this.estimateDevelopmentDays(requirements) * 0.3),
        tasks: [],
        dependencies: ['development'],
        deliverables: ['Test Report', 'Quality Metrics'],
        skillsRequired: ['QA Testing', 'Automation Testing']
      },
      {
        id: 'deployment',
        name: 'Deployment',
        description: 'Production deployment and launch',
        order: 4,
        estimatedDays: 3,
        tasks: [],
        dependencies: ['testing'],
        deliverables: ['Deployed Application', 'Deployment Guide'],
        skillsRequired: ['DevOps', 'System Administration']
      }
    ];

    // Generate detailed tasks for each phase
    this.generatePhaseTasks(phases, requirements);

    const totalTasks = phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const estimatedDuration = phases.reduce((sum, phase) => sum + phase.estimatedDays, 0);

    return {
      id: `plan_${Date.now()}`,
      name: requirements.name,
      phases,
      estimatedDuration,
      totalTasks,
      dependencies: [],
      riskAssessment: this.generateRiskAssessment(requirements),
      resourceAllocation: this.generateResourceAllocation(requirements),
      milestones: this.generateMilestones(phases),
      qualityGates: this.generateQualityGates(requirements)
    };
  }

  private generatePhaseTasks(phases: ProjectPhase[], requirements: ProjectRequirements): void {
    // Development tasks based on project type
    const developmentPhase = phases.find(p => p.id === 'development');
    if (developmentPhase) {
      switch (requirements.type) {
        case 'web_app':
          developmentPhase.tasks.push(
            {
              id: 'frontend_setup',
              title: 'Frontend Framework Setup',
              description: 'Initialize frontend framework and base configuration',
              type: 'development',
              priority: 'high',
              estimatedHours: 8,
              dependencies: [],
              status: 'not_started',
              tags: ['frontend', 'setup'],
              acceptanceCriteria: ['Framework initialized', 'Base components created'],
              techSpecs: { frameworks: requirements.technologies.filter(t => ['React', 'Vue', 'Angular'].includes(t)) }
            },
            {
              id: 'backend_api',
              title: 'Backend API Development',
              description: 'Develop REST/GraphQL API endpoints',
              type: 'development',
              priority: 'high',
              estimatedHours: 24,
              dependencies: ['frontend_setup'],
              status: 'not_started',
              tags: ['backend', 'api'],
              acceptanceCriteria: ['API endpoints functional', 'Documentation complete'],
              techSpecs: { apis: ['REST', 'GraphQL'], frameworks: requirements.technologies.filter(t => ['Node.js', 'Express', 'FastAPI'].includes(t)) }
            }
          );
          break;
        case 'mobile_app':
          developmentPhase.tasks.push(
            {
              id: 'mobile_setup',
              title: 'Mobile App Framework Setup',
              description: 'Initialize mobile development environment',
              type: 'development',
              priority: 'high',
              estimatedHours: 12,
              dependencies: [],
              status: 'not_started',
              tags: ['mobile', 'setup'],
              acceptanceCriteria: ['Development environment ready', 'Base app structure created'],
              techSpecs: { frameworks: requirements.technologies.filter(t => ['React Native', 'Flutter', 'Swift', 'Kotlin'].includes(t)) }
            }
          );
          break;
      }
    }

    // Testing tasks
    const testingPhase = phases.find(p => p.id === 'testing');
    if (testingPhase) {
      testingPhase.tasks.push(
        {
          id: 'unit_testing',
          title: 'Unit Testing',
          description: 'Implement comprehensive unit tests',
          type: 'testing',
          priority: 'high',
          estimatedHours: 16,
          dependencies: [],
          status: 'not_started',
          tags: ['testing', 'unit'],
          acceptanceCriteria: ['90% code coverage', 'All tests passing']
        },
        {
          id: 'integration_testing',
          title: 'Integration Testing',
          description: 'Test component and system integration',
          type: 'testing',
          priority: 'medium',
          estimatedHours: 12,
          dependencies: ['unit_testing'],
          status: 'not_started',
          tags: ['testing', 'integration'],
          acceptanceCriteria: ['Integration tests passing', 'API contracts validated']
        }
      );
    }
  }

  private estimateDevelopmentDays(requirements: ProjectRequirements): number {
    const baseComplexity = {
      simple: 10,
      medium: 20,
      complex: 40,
      enterprise: 60
    };

    let days = baseComplexity[requirements.complexity];

    // Adjust based on project type
    switch (requirements.type) {
      case 'mobile_app':
        days *= 1.3;
        break;
      case 'ml_model':
        days *= 1.5;
        break;
      case 'enterprise':
        days *= 1.8;
        break;
    }

    // Adjust based on technology stack complexity
    if (requirements.technologies.length > 5) {
      days *= 1.2;
    }

    return Math.ceil(days);
  }

  private getRequiredSkills(requirements: ProjectRequirements): string[] {
    const skills = new Set<string>();

    // Add skills based on technologies
    requirements.technologies.forEach(tech => {
      switch (tech.toLowerCase()) {
        case 'react':
        case 'vue':
        case 'angular':
          skills.add('Frontend Development');
          skills.add('JavaScript');
          break;
        case 'node.js':
        case 'express':
          skills.add('Backend Development');
          skills.add('JavaScript');
          break;
        case 'python':
          skills.add('Python Development');
          break;
        case 'postgresql':
        case 'mongodb':
          skills.add('Database Design');
          break;
        case 'aws':
        case 'azure':
        case 'gcp':
          skills.add('Cloud Infrastructure');
          break;
      }
    });

    // Add project-type specific skills
    switch (requirements.type) {
      case 'mobile_app':
        skills.add('Mobile Development');
        break;
      case 'ml_model':
        skills.add('Machine Learning');
        skills.add('Data Science');
        break;
      case 'data_pipeline':
        skills.add('Data Engineering');
        break;
    }

    return Array.from(skills);
  }

  private generateRiskAssessment(requirements: ProjectRequirements): RiskAssessment {
    const risks: Risk[] = [];

    // Technology complexity risk
    if (requirements.technologies.length > 5) {
      risks.push({
        id: 'tech_complexity',
        description: 'High technology stack complexity may lead to integration issues',
        probability: 0.6,
        impact: 0.7,
        category: 'technical',
        mitigationPlan: 'Conduct proof-of-concept for key integrations early'
      });
    }

    // Timeline risk
    if (requirements.complexity === 'enterprise') {
      risks.push({
        id: 'timeline_risk',
        description: 'Enterprise complexity may cause timeline delays',
        probability: 0.5,
        impact: 0.8,
        category: 'schedule',
        mitigationPlan: 'Build in buffer time and use agile methodology'
      });
    }

    // Resource risk
    if (requirements.resources.teamSize && requirements.resources.teamSize < 3) {
      risks.push({
        id: 'resource_constraint',
        description: 'Small team size may limit development velocity',
        probability: 0.4,
        impact: 0.6,
        category: 'resource',
        mitigationPlan: 'Consider outsourcing or hiring additional team members'
      });
    }

    const overallRiskScore = risks.reduce((sum, risk) => sum + (risk.probability * risk.impact), 0) / risks.length;
    let overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';

    if (overallRiskScore < 0.3) overallRiskLevel = 'low';
    else if (overallRiskScore < 0.6) overallRiskLevel = 'medium';
    else if (overallRiskScore < 0.8) overallRiskLevel = 'high';
    else overallRiskLevel = 'critical';

    return {
      overallRiskLevel,
      identifiedRisks: risks,
      mitigationStrategies: risks.map(r => r.mitigationPlan)
    };
  }

  private generateResourceAllocation(requirements: ProjectRequirements): ResourceAllocation {
    const roles: ResourceAllocation['roles'] = [
      {
        role: 'Project Manager',
        skillLevel: 'senior',
        allocation: 25,
        duration: this.estimateDevelopmentDays(requirements) + 10
      },
      {
        role: 'Full Stack Developer',
        skillLevel: 'senior',
        allocation: 100,
        duration: this.estimateDevelopmentDays(requirements)
      }
    ];

    // Add specialized roles based on project type
    switch (requirements.type) {
      case 'mobile_app':
        roles.push({
          role: 'Mobile Developer',
          skillLevel: 'senior',
          allocation: 100,
          duration: this.estimateDevelopmentDays(requirements)
        });
        break;
      case 'ml_model':
        roles.push({
          role: 'Data Scientist',
          skillLevel: 'expert',
          allocation: 80,
          duration: this.estimateDevelopmentDays(requirements) * 0.8
        });
        break;
    }

    const baseBudget = requirements.resources.budget || 50000;
    
    return {
      roles,
      tools: ['IDE', 'Version Control', 'CI/CD', 'Testing Framework'],
      infrastructure: ['Cloud Hosting', 'Database', 'CDN'],
      budget: {
        development: baseBudget * 0.6,
        testing: baseBudget * 0.2,
        deployment: baseBudget * 0.1,
        maintenance: baseBudget * 0.1
      }
    };
  }

  private generateMilestones(phases: ProjectPhase[]): Milestone[] {
    return phases.map((phase, index) => ({
      id: `milestone_${phase.id}`,
      name: `${phase.name} Complete`,
      description: `Completion of ${phase.name} phase`,
      targetDate: new Date(Date.now() + (index + 1) * phase.estimatedDays * 24 * 60 * 60 * 1000),
      deliverables: phase.deliverables,
      acceptanceCriteria: [`All ${phase.name} tasks completed`, 'Quality gates passed'],
      status: 'pending'
    }));
  }

  private generateQualityGates(requirements: ProjectRequirements): QualityGate[] {
    const gates: QualityGate[] = [
      {
        id: 'code_quality',
        name: 'Code Quality Gate',
        criteria: ['Code coverage > 80%', 'No critical security vulnerabilities', 'Code review approved'],
        tools: ['ESLint', 'SonarQube', 'Security Scanner'],
        threshold: 80,
        blocking: true
      },
      {
        id: 'performance',
        name: 'Performance Gate',
        criteria: ['Load time < 3 seconds', 'API response < 200ms'],
        tools: ['Lighthouse', 'Load Testing'],
        threshold: 85,
        blocking: true
      }
    ];

    // Add project-specific quality gates
    if (requirements.constraints?.security) {
      gates.push({
        id: 'security',
        name: 'Security Gate',
        criteria: requirements.constraints.security,
        tools: ['OWASP Scanner', 'Penetration Testing'],
        threshold: 95,
        blocking: true
      });
    }

    return gates;
  }

  private async customizeProjectPlan(baseTemplate: ProjectPlan, requirements: ProjectRequirements): Promise<ProjectPlan> {
    // Clone the base template
    const customizedPlan: ProjectPlan = JSON.parse(JSON.stringify(baseTemplate));
    
    // Update project name and specifics
    customizedPlan.name = requirements.name;
    
    // Adjust phases based on requirements
    if (requirements.deliverables.includes('Mobile App')) {
      // Add mobile-specific phases and tasks
      const mobilePhase: ProjectPhase = {
        id: 'mobile_development',
        name: 'Mobile Development',
        description: 'Native mobile app development',
        order: 2.5,
        estimatedDays: 15,
        tasks: [],
        dependencies: ['development'],
        deliverables: ['iOS App', 'Android App'],
        skillsRequired: ['iOS Development', 'Android Development']
      };
      
      customizedPlan.phases.push(mobilePhase);
    }
    
    // Adjust complexity and timeline
    customizedPlan.estimatedDuration = Math.ceil(customizedPlan.estimatedDuration * this.getComplexityMultiplier(requirements.complexity));
    
    return customizedPlan;
  }

  private getComplexityMultiplier(complexity: string): number {
    switch (complexity) {
      case 'simple': return 0.8;
      case 'medium': return 1.0;
      case 'complex': return 1.3;
      case 'enterprise': return 1.6;
      default: return 1.0;
    }
  }

  private async enhanceProjectPlanWithAI(plan: ProjectPlan, requirements: ProjectRequirements): Promise<void> {
    // Use AI to enhance task estimates and dependencies
    // This would integrate with an LLM to provide intelligent suggestions
    
    // For now, implement rule-based enhancements
    plan.phases.forEach(phase => {
      phase.tasks.forEach(task => {
        // Adjust estimates based on complexity
        task.estimatedHours = Math.ceil(task.estimatedHours * this.getComplexityMultiplier(requirements.complexity));
        
        // Add technology-specific considerations
        if (task.techSpecs?.frameworks) {
          task.estimatedHours *= 1.1; // Add complexity for framework learning curve
        }
      });
    });
  }

  private async validateProjectFeasibility(plan: ProjectPlan, requirements: ProjectRequirements): Promise<{feasible: boolean, reasons: string[]}> {
    const reasons: string[] = [];
    let feasible = true;

    // Check timeline feasibility
    if (requirements.constraints?.deadline) {
      const deadlineDate = new Date(requirements.constraints.deadline);
      const estimatedEndDate = new Date(Date.now() + plan.estimatedDuration * 24 * 60 * 60 * 1000);
      
      if (estimatedEndDate > deadlineDate) {
        feasible = false;
        reasons.push(`Estimated completion date (${estimatedEndDate.toDateString()}) exceeds deadline (${deadlineDate.toDateString()})`);
      }
    }

    // Check resource feasibility
    const estimatedCost = plan.resourceAllocation.budget.development + 
                         plan.resourceAllocation.budget.testing + 
                         plan.resourceAllocation.budget.deployment;
    
    if (requirements.resources.budget && estimatedCost > requirements.resources.budget) {
      feasible = false;
      reasons.push(`Estimated cost ($${estimatedCost}) exceeds budget ($${requirements.resources.budget})`);
    }

    // Check skill availability
    const requiredSkills = new Set<string>();
    plan.phases.forEach(phase => {
      phase.skillsRequired.forEach(skill => requiredSkills.add(skill));
    });

    const availableSkills = new Set(requirements.resources.requiredSkills);
    const missingSkills = Array.from(requiredSkills).filter(skill => !availableSkills.has(skill));
    
    if (missingSkills.length > 0) {
      reasons.push(`Missing required skills: ${missingSkills.join(', ')}`);
      // Don't mark as unfeasible, just note the gap
    }

    return { feasible, reasons };
  }

  private async createProjectStructure(projectId: string, requirements: ProjectRequirements, plan: ProjectPlan): Promise<void> {
    try {
      const projectPath = path.join(process.cwd(), 'autonomous-project');
      
      // Create project directory
      await fs.mkdir(projectPath, { recursive: true });
      
      // Create package.json
      const packageJson = {
        name: requirements.name.toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        description: requirements.description,
        main: 'dist/index.js',
        scripts: {
          start: 'node dist/index.js',
          dev: 'tsx watch src/index.ts',
          build: 'tsc',
          test: 'jest',
          lint: 'eslint src/**/*.ts'
        },
        dependencies: this.generateDependencies(requirements),
        devDependencies: this.generateDevDependencies(requirements)
      };
      
      await fs.writeFile(
        path.join(projectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      // Create README.md
      const readme = this.generateReadme(requirements, plan);
      await fs.writeFile(path.join(projectPath, 'README.md'), readme);
      
      // Create basic project structure
      await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
      await fs.mkdir(path.join(projectPath, 'tests'), { recursive: true });
      await fs.mkdir(path.join(projectPath, 'docs'), { recursive: true });
      await fs.mkdir(path.join(projectPath, 'dist'), { recursive: true });
      
      logger.info('Project structure created', { projectId, path: projectPath });
    } catch (error) {
      logger.error('Failed to create project structure', { error: error.message, projectId });
      throw error;
    }
  }

  private generateDependencies(requirements: ProjectRequirements): Record<string, string> {
    const deps: Record<string, string> = {};
    
    if (requirements.technologies.includes('Express')) {
      deps['express'] = '^4.18.2';
    }
    
    if (requirements.technologies.includes('React')) {
      deps['react'] = '^18.2.0';
      deps['react-dom'] = '^18.2.0';
    }
    
    if (requirements.technologies.includes('Node.js')) {
      deps['@types/node'] = '^20.0.0';
    }
    
    return deps;
  }

  private generateDevDependencies(requirements: ProjectRequirements): Record<string, string> {
    return {
      '@types/node': '^20.0.0',
      '@types/express': '^4.17.17',
      'typescript': '^5.0.0',
      'tsx': '^3.12.0',
      'jest': '^29.5.0',
      '@types/jest': '^29.5.0'
    };
  }

  private generateReadme(requirements: ProjectRequirements, plan: ProjectPlan): string {
    return `# ${requirements.name}

Auto-generated ${requirements.type} project created by Universal AI Tools Autonomous Assistant.

## Requirements Implemented
${requirements.description}

## Getting Started

### Installation
\`\`\`bash
npm install
\`\`\`

### Development
\`\`\`bash
npm run dev
\`\`\`

### Build
\`\`\`bash
npm run build
\`\`\`

### Testing
\`\`\`bash
npm test
\`\`\`

## Project Structure
- \`src/\` - Source code
- \`tests/\` - Test files
- \`dist/\` - Built output
- \`docs/\` - Documentation

---

*Generated autonomously by Universal AI Tools*
`;
  }

  private async scheduleProjectTasks(projectId: string, plan: ProjectPlan): Promise<void> {
    try {
      // Insert all tasks into the database with scheduling information
      const tasks = plan.phases.flatMap(phase => 
        phase.tasks.map(task => ({
          project_id: projectId,
          phase_id: phase.id,
          task_id: task.id,
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority,
          estimated_hours: task.estimatedHours,
          dependencies: task.dependencies,
          status: task.status,
          tags: task.tags,
          acceptance_criteria: task.acceptanceCriteria,
          tech_specs: task.techSpecs || {},
          scheduled_start: new Date().toISOString(),
          created_at: new Date().toISOString()
        }))
      );

      if (tasks.length > 0) {
        const { error } = await this.supabase
          .from('project_tasks')
          .insert(tasks);

        if (error) {
          throw new Error(`Failed to schedule tasks: ${error.message}`);
        }
      }

      logger.info('Project tasks scheduled', { projectId, taskCount: tasks.length });
    } catch (error) {
      logger.error('Failed to schedule project tasks', { error: error.message, projectId });
      throw error;
    }
  }

  private calculateInitialRiskScore(riskAssessment: RiskAssessment): number {
    if (riskAssessment.identifiedRisks.length === 0) return 10;
    
    const averageRisk = riskAssessment.identifiedRisks
      .reduce((sum, risk) => sum + (risk.probability * risk.impact), 0) / riskAssessment.identifiedRisks.length;
    
    return Math.round((1 - averageRisk) * 100);
  }

  private async loadProjectTemplates(): Promise<void> {
    // Load templates from database or create default ones
    // For now, we'll create some default templates
    
    this.projectTemplates.set('default', this.createDefaultTemplate({
      name: 'Default Project',
      description: 'Default project template',
      type: 'custom',
      technologies: [],
      complexity: 'medium',
      timeline: '4 weeks',
      priority: 'medium',
      resources: { requiredSkills: [] },
      deliverables: [],
      stakeholders: []
    }));
  }

  private async loadActiveProjects(): Promise<void> {
    try {
      const { data: projects, error } = await this.supabase
        .from('autonomous_projects')
        .select('*')
        .in('status', ['planning', 'active', 'paused']);

      if (error) {
        throw new Error(`Failed to load active projects: ${error.message}`);
      }

      if (projects) {
        for (const project of projects) {
          const execution: ProjectExecution = {
            projectId: project.id,
            currentPhase: project.current_phase || 'planning',
            completedTasks: project.completed_tasks || 0,
            totalTasks: project.total_tasks || 0,
            progress: project.progress || 0,
            status: project.status,
            startDate: new Date(project.created_at),
            estimatedEndDate: new Date(project.estimated_end_date),
            actualEndDate: project.actual_end_date ? new Date(project.actual_end_date) : undefined,
            budget: project.budget || { allocated: 0, spent: 0, remaining: 0 },
            metrics: project.metrics || { velocity: 0, qualityScore: 100, riskScore: 50, stakeholderSatisfaction: 100 },
            issues: project.issues || [],
            achievements: project.achievements || []
          };

          this.activeProjects.set(project.id, execution);
        }
      }
    } catch (error) {
      logger.error('Failed to load active projects', { error: error.message });
    }
  }

  private startMonitoring(): void {
    // Start periodic monitoring of active projects
    setInterval(() => {
      this.monitorActiveProjects();
    }, 60000); // Monitor every minute
  }

  private async monitorActiveProjects(): Promise<void> {
    for (const [projectId, execution] of this.activeProjects) {
      try {
        await this.updateProjectProgress(projectId);
        await this.checkProjectHealth(projectId);
        await this.detectProjectIssues(projectId);
      } catch (error) {
        logger.error('Error monitoring project', { error: error.message, projectId });
      }
    }
  }

  private async updateProjectProgress(projectId: string): Promise<void> {
    const execution = this.activeProjects.get(projectId);
    if (!execution) return;

    try {
      // Get completed tasks count
      const { data: tasks, error } = await this.supabase
        .from('project_tasks')
        .select('status')
        .eq('project_id', projectId);

      if (error) {
        throw new Error(`Failed to fetch tasks: ${error.message}`);
      }

      if (tasks) {
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const totalTasks = tasks.length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        execution.completedTasks = completedTasks;
        execution.totalTasks = totalTasks;
        execution.progress = progress;

        // Update velocity (tasks per day)
        const daysSinceStart = Math.max(1, Math.floor((Date.now() - execution.startDate.getTime()) / (24 * 60 * 60 * 1000)));
        execution.metrics.velocity = completedTasks / daysSinceStart;

        // Update database
        await this.supabase
          .from('autonomous_projects')
          .update({
            completed_tasks: completedTasks,
            total_tasks: totalTasks,
            progress: progress,
            metrics: execution.metrics,
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId);

        this.emit('progress_updated', { projectId, progress, completedTasks, totalTasks });
      }
    } catch (error) {
      logger.error('Failed to update project progress', { error: error.message, projectId });
    }
  }

  private async checkProjectHealth(projectId: string): Promise<void> {
    const execution = this.activeProjects.get(projectId);
    if (!execution) return;

    // Check if project is on track
    const expectedProgress = this.calculateExpectedProgress(execution);
    const actualProgress = execution.progress;
    const progressDelta = expectedProgress - actualProgress;

    if (progressDelta > 20) {
      // Project is significantly behind
      const issue: ProjectIssue = {
        id: `issue_${Date.now()}`,
        type: 'delay',
        severity: 'high',
        description: `Project is ${progressDelta.toFixed(1)}% behind schedule`,
        impact: 'May miss deadline if not addressed',
        status: 'open',
        createdAt: new Date()
      };

      execution.issues.push(issue);
      this.emit('project_issue', { projectId, issue });
    }
  }

  private calculateExpectedProgress(execution: ProjectExecution): number {
    const totalDuration = execution.estimatedEndDate.getTime() - execution.startDate.getTime();
    const elapsedTime = Date.now() - execution.startDate.getTime();
    return Math.min(100, (elapsedTime / totalDuration) * 100);
  }

  private async detectProjectIssues(projectId: string): Promise<void> {
    // Implement AI-based issue detection
    // For now, implement basic rule-based detection
    const execution = this.activeProjects.get(projectId);
    if (!execution) return;

    // Check for blocked tasks
    try {
      const { data: blockedTasks } = await this.supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'blocked');

      if (blockedTasks && blockedTasks.length > 0) {
        const issue: ProjectIssue = {
          id: `issue_${Date.now()}`,
          type: 'blocker',
          severity: 'high',
          description: `${blockedTasks.length} tasks are currently blocked`,
          impact: 'Development progress halted',
          status: 'open',
          createdAt: new Date()
        };

        execution.issues.push(issue);
        this.emit('project_issue', { projectId, issue });
      }
    } catch (error) {
      logger.error('Failed to check for blocked tasks', { error: error.message, projectId });
    }
  }

  async getProjects(): Promise<ProjectExecution[]> {
    return Array.from(this.activeProjects.values());
  }

  async getProject(projectId: string): Promise<ProjectExecution | null> {
    return this.activeProjects.get(projectId) || null;
  }

  async pauseProject(projectId: string): Promise<void> {
    const execution = this.activeProjects.get(projectId);
    if (!execution) {
      throw new Error('Project not found');
    }

    execution.status = 'paused';
    
    await this.supabase
      .from('autonomous_projects')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    this.emit('project_paused', { projectId });
    logger.info('Project paused', { projectId });
  }

  async resumeProject(projectId: string): Promise<void> {
    const execution = this.activeProjects.get(projectId);
    if (!execution) {
      throw new Error('Project not found');
    }

    execution.status = 'active';
    
    await this.supabase
      .from('autonomous_projects')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    this.emit('project_resumed', { projectId });
    logger.info('Project resumed', { projectId });
  }

  async cancelProject(projectId: string, reason: string): Promise<void> {
    const execution = this.activeProjects.get(projectId);
    if (!execution) {
      throw new Error('Project not found');
    }

    execution.status = 'cancelled';
    
    await this.supabase
      .from('autonomous_projects')
      .update({ 
        status: 'cancelled', 
        cancellation_reason: reason,
        actual_end_date: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', projectId);

    this.activeProjects.delete(projectId);
    this.emit('project_cancelled', { projectId, reason });
    logger.info('Project cancelled', { projectId, reason });
  }

  async completeProject(projectId: string): Promise<void> {
    const execution = this.activeProjects.get(projectId);
    if (!execution) {
      throw new Error('Project not found');
    }

    execution.status = 'completed';
    execution.actualEndDate = new Date();
    execution.progress = 100;
    
    await this.supabase
      .from('autonomous_projects')
      .update({ 
        status: 'completed',
        progress: 100,
        actual_end_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    // Create completion achievement
    const achievement: ProjectAchievement = {
      id: `achievement_${Date.now()}`,
      title: 'Project Completed',
      description: 'Project successfully completed by autonomous system',
      category: 'delivery',
      impact: 'Project delivered on time with autonomous management',
      achievedAt: new Date(),
      metrics: {
        finalProgress: execution.progress,
        velocity: execution.metrics.velocity,
        qualityScore: execution.metrics.qualityScore
      }
    };

    execution.achievements.push(achievement);
    this.activeProjects.delete(projectId);
    
    this.emit('project_completed', { projectId, execution, achievement });
    logger.info('Project completed', { projectId, duration: execution.actualEndDate.getTime() - execution.startDate.getTime() });
  }

  async getProjectMetrics(projectId: string): Promise<any> {
    const execution = this.activeProjects.get(projectId);
    if (!execution) {
      throw new Error('Project not found');
    }

    return {
      progress: execution.progress,
      velocity: execution.metrics.velocity,
      qualityScore: execution.metrics.qualityScore,
      riskScore: execution.metrics.riskScore,
      stakeholderSatisfaction: execution.metrics.stakeholderSatisfaction,
      budget: execution.budget,
      timeline: {
        startDate: execution.startDate,
        estimatedEndDate: execution.estimatedEndDate,
        actualEndDate: execution.actualEndDate,
        daysElapsed: Math.floor((Date.now() - execution.startDate.getTime()) / (24 * 60 * 60 * 1000)),
        daysRemaining: Math.ceil((execution.estimatedEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      },
      tasks: {
        completed: execution.completedTasks,
        total: execution.totalTasks,
        remaining: execution.totalTasks - execution.completedTasks
      },
      issues: {
        open: execution.issues.filter(i => i.status === 'open').length,
        resolved: execution.issues.filter(i => i.status === 'resolved').length,
        total: execution.issues.length
      },
      achievements: execution.achievements.length
    };
  }
}

export default AutonomousProjectManager;