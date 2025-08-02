/**
 * Project Orchestrator Service Tests
 */

import { ProjectOrchestrator, ProjectStatus, ProjectType } from '../project-orchestrator';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('../ab-mcts-service');
jest.mock('../context-storage-service');
jest.mock('../alpha-evolve-service');
jest.mock('../llm-router-service');
jest.mock('../parallel-agent-orchestrator');
jest.mock('../project-aware-ab-mcts');
jest.mock('@/agents/agent-registry');

describe('ProjectOrchestrator', () => {
  let orchestrator: ProjectOrchestrator;
  let mockDependencies: any;

  beforeEach(() => {
    mockDependencies = {
      abMctsService: {
        orchestrate: jest.fn().mockResolvedValue({
          success: true,
          selectedAgent: 'planner',
          confidence: 0.8
        })
      },
      contextStorage: {
        saveContext: jest.fn().mockResolvedValue(true),
        getContext: jest.fn().mockResolvedValue({}),
        searchContext: jest.fn().mockResolvedValue([])
      },
      alphaEvolve: {
        evolve: jest.fn().mockResolvedValue({ improved: true })
      },
      llmRouter: {
        route: jest.fn().mockResolvedValue({ response: 'test response' })
      },
      agentRegistry: {
        getAgent: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue({ success: true })
        })
      }
    };

    orchestrator = new ProjectOrchestrator(
      mockDependencies.abMctsService,
      mockDependencies.contextStorage,
      mockDependencies.alphaEvolve,
      mockDependencies.llmRouter,
      mockDependencies.agentRegistry
    );
  });

  describe('createProject', () => {
    it('should create a new project with valid specification', async () => {
      const specification = {
        name: 'Test Project',
        type: ProjectType.SOFTWARE_DEVELOPMENT,
        description: 'Test project description',
        requirements: ['Build API', 'Add authentication'],
        constraints: {
          complexity: 'moderate' as const,
          quality: 'production' as const
        },
        userContext: { language: 'TypeScript' },
        expectedDeliverables: ['API endpoints', 'Documentation'],
        successCriteria: ['All tests pass', 'Code coverage > 80%']
      };

      const project = await orchestrator.createProject(specification);

      expect(project).toHaveProperty('id');
      expect(project.specification).toEqual(specification);
      expect(project.status).toBe(ProjectStatus.PLANNING);
      expect(project.tasks).toHaveLength(0);
    });

    it('should emit project:created event', async () => {
      const specification = {
        name: 'Event Test Project',
        type: ProjectType.DATA_ANALYSIS,
        description: 'Test events',
        requirements: ['Analyze data'],
        constraints: {
          complexity: 'simple' as const,
          quality: 'draft' as const
        },
        userContext: {},
        expectedDeliverables: ['Report'],
        successCriteria: ['Insights generated']
      };

      const eventPromise = new Promise(resolve => {
        orchestrator.on('project:created', resolve);
      });

      await orchestrator.createProject(specification);
      const event = await eventPromise;

      expect(event).toHaveProperty('projectId');
      expect(event).toHaveProperty('specification');
    });
  });

  describe('listProjects', () => {
    beforeEach(async () => {
      // Create some test projects
      await orchestrator.createProject({
        name: 'Active Project',
        type: ProjectType.AUTOMATION,
        description: 'Active test',
        requirements: ['Automate process'],
        constraints: { complexity: 'simple' as const, quality: 'draft' as const },
        userContext: {},
        expectedDeliverables: ['Script'],
        successCriteria: ['Works']
      });

      await orchestrator.createProject({
        name: 'Another Project',
        type: ProjectType.CONTENT_CREATION,
        description: 'Content test',
        requirements: ['Write content'],
        constraints: { complexity: 'moderate' as const, quality: 'production' as const },
        userContext: {},
        expectedDeliverables: ['Article'],
        successCriteria: ['Published']
      });
    });

    it('should list all projects', () => {
      const projects = orchestrator.listProjects({});
      expect(projects).toHaveLength(2);
    });

    it('should filter projects by type', () => {
      const projects = orchestrator.listProjects({
        type: ProjectType.AUTOMATION
      });
      expect(projects).toHaveLength(1);
      expect(projects[0].specification.type).toBe(ProjectType.AUTOMATION);
    });

    it('should filter projects by status', () => {
      const projects = orchestrator.listProjects({
        status: ProjectStatus.PLANNING
      });
      expect(projects).toHaveLength(2);
    });

    it('should filter active projects', () => {
      const projects = orchestrator.listProjects({
        activeOnly: true
      });
      expect(projects.every(p => 
        [ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS].includes(p.status)
      )).toBe(true);
    });
  });

  describe('getProject', () => {
    it('should retrieve project by id', async () => {
      const specification = {
        name: 'Get Test Project',
        type: ProjectType.RESEARCH,
        description: 'Test retrieval',
        requirements: ['Research topic'],
        constraints: { complexity: 'complex' as const, quality: 'enterprise' as const },
        userContext: {},
        expectedDeliverables: ['Research paper'],
        successCriteria: ['Comprehensive']
      };

      const created = await orchestrator.createProject(specification);
      const retrieved = orchestrator.getProject(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.specification.name).toBe('Get Test Project');
    });

    it('should return undefined for non-existent project', () => {
      const project = orchestrator.getProject('non-existent-id');
      expect(project).toBeUndefined();
    });
  });

  describe('project lifecycle', () => {
    let project: any;

    beforeEach(async () => {
      const specification = {
        name: 'Lifecycle Test Project',
        type: ProjectType.SOFTWARE_DEVELOPMENT,
        description: 'Test lifecycle',
        requirements: ['Build feature'],
        constraints: { complexity: 'moderate' as const, quality: 'production' as const },
        userContext: {},
        expectedDeliverables: ['Feature'],
        successCriteria: ['Working']
      };
      project = await orchestrator.createProject(specification);
    });

    it('should start project from planning state', async () => {
      await orchestrator.startProject(project.id);
      const updatedProject = orchestrator.getProject(project.id);
      
      expect(updatedProject?.status).toBe(ProjectStatus.IN_PROGRESS);
    });

    it('should cancel project', async () => {
      await orchestrator.startProject(project.id);
      await orchestrator.cancelProject(project.id, 'Test cancellation');
      
      const cancelledProject = orchestrator.getProject(project.id);
      expect(cancelledProject?.status).toBe(ProjectStatus.CANCELLED);
    });

    it('should not start already completed project', async () => {
      // Manually set project status to completed
      (orchestrator as any).projects.get(project.id).status = ProjectStatus.COMPLETED;
      
      await expect(orchestrator.startProject(project.id))
        .rejects.toThrow('Cannot start project in completed state');
    });
  });

  describe('error handling', () => {
    it('should handle missing project gracefully', async () => {
      await expect(orchestrator.startProject('non-existent'))
        .rejects.toThrow('Project not found');
    });

    it('should handle orchestration failures', async () => {
      mockDependencies.abMctsService.orchestrate.mockRejectedValue(
        new Error('Orchestration failed')
      );

      const specification = {
        name: 'Error Test Project',
        type: ProjectType.CUSTOM,
        description: 'Test errors',
        requirements: ['Handle errors'],
        constraints: { complexity: 'simple' as const, quality: 'draft' as const },
        userContext: {},
        expectedDeliverables: ['Error handling'],
        successCriteria: ['Graceful failures']
      };

      const project = await orchestrator.createProject(specification);
      
      // Start should not throw but handle error gracefully
      await expect(orchestrator.startProject(project.id))
        .resolves.not.toThrow();
    });
  });
});