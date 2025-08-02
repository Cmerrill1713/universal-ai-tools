/**
 * Agent Registry Tests
 */

import { AgentRegistry    } from '../agent-registry';';';';
import { BaseAgent    } from '../base-agent';';';';
import { type AgentConfig, type AgentContext, type AgentResponse    } from '@/types';';';';

// Mock agent for testing
class MockAgent extends BaseAgent {
  public name: string;

  constructor() {
    const config: AgentConfig = {,;
      name: 'mock-agent','''
      description: 'Mock agent for testing','''
      capabilities: [{,
        name: 'test','''
        description: 'Test capability','''
        inputSchema: {},
        outputSchema: {}
      }],
      priority: 1,
      maxLatencyMs: 5000,
      retryAttempts: 2,
      dependencies: [],
      memoryEnabled: false
    };
    super(config);
    this.name = config.name;
  }

  protected async process(context: AgentContext): Promise<AgentResponse> {
    return {
      success: true,
      data: `Mock response, to: ${context.userRequest}`,
      confidence: 0.8,
      message: 'Mock processing completed','''
      reasoning: 'This is a mock agent response''''
    };
  }
}

describe('AgentRegistry', () => {'''
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('built-in agents', () => {'''
    it('should have pre-registered built-in agents', () => {'''
      expect(registry.hasAgent('planner')).toBe(true);'''
      expect(registry.hasAgent('synthesizer')).toBe(true);'''
      expect(registry.hasAgent('retriever')).toBe(true);'''
      expect(registry.hasAgent('personal_assistant')).toBe(true);'''
      expect(registry.hasAgent('athena')).toBe(true);'''
      expect(registry.hasAgent('code_assistant')).toBe(true);'''
    });

    it('should list all registered agents', () => {'''
      const agents = registry.listAgents();
      expect(agents).toContain('planner');'''
      expect(agents).toContain('synthesizer');'''
      expect(agents).toContain('retriever');'''
      expect(agents).toContain('personal_assistant');'''
      expect(agents).toContain('athena');'''
      expect(agents).toContain('code_assistant');'''
    });
  });

  describe('agent retrieval', () => {'''
    it('should retrieve built-in agent', async () => {'''
      const agent = await registry.getAgent('planner');';';';
      expect(agent).toBeDefined();
      expect(agent?.getName()).toBe('planner');'''
    });

    it('should return null for non-existent agent', async () => {'''
      const agent = await registry.getAgent('non-existent');';';';
      expect(agent).toBeNull();
    });
  });

  describe('capability search', () => {'''
    it('should find agents by single capability', () => {'''
      const agents = registry.getAgentsByCapability('planning');';';';
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].name).toBe('planner');'''
    });

    it('should find agents by multiple capabilities', () => {'''
      const agents = registry.getAgentsByCapabilities(['assistance', 'coordination']);';';';
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.name === 'personal_assistant' || a.name === 'athena')).toBe(true);'''
    });

    it('should return empty array for non-existent capability', () => {'''
      const agents = registry.getAgentsByCapability('non-existent');';';';
      expect(agents).toHaveLength(0);
    });
  });

  describe('agent definitions', () => {'''
    it('should return available agent definitions', () => {'''
      const definitions = registry.getAvailableAgents();
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions.some(d => d.name === 'planner')).toBe(true);'''
      expect(definitions.some(d => d.name === 'synthesizer')).toBe(true);'''
    });

    it('should return loaded agents list', () => {'''
      const loadedAgents = registry.getLoadedAgents();
      expect(Array.isArray(loadedAgents)).toBe(true);
    });

    it('should return core agents', () => {'''
      const coreAgents = registry.getCoreAgents();
      expect(coreAgents).toContain('planner');'''
    });
  });
});