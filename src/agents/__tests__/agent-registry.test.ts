/**
 * Agent Registry Tests
 */

import { AgentRegistry } from '../agent-registry';
import { BaseAgent } from '../base-agent';

// Mock agent for testing
class MockAgent extends BaseAgent {
  constructor() {
    super({
      name: 'mock-agent',
      description: 'Mock agent for testing',
      capabilities: ['test'],
      systemPrompt: 'Test prompt'
    });
  }

  async execute(input: string, context?: any): Promise<any> {
    return {
      success: true,
      response: `Mock response to: ${input}`,
      context
    };
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('agent registration', () => {
    it('should register an agent', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock-agent', agent);

      expect(registry.hasAgent('mock-agent')).toBe(true);
    });

    it('should throw error when registering duplicate agent', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock-agent', agent);

      expect(() => {
        registry.registerAgent('mock-agent', agent);
      }).toThrow('Agent mock-agent is already registered');
    });
  });

  describe('agent retrieval', () => {
    beforeEach(() => {
      const agent = new MockAgent();
      registry.registerAgent('mock-agent', agent);
    });

    it('should retrieve registered agent', () => {
      const agent = registry.getAgent('mock-agent');
      expect(agent).toBeDefined();
      expect(agent?.getName()).toBe('mock-agent');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('agent listing', () => {
    it('should list all registered agents', () => {
      const agent1 = new MockAgent();
      const agent2 = new MockAgent();
      agent2.name = 'mock-agent-2';

      registry.registerAgent('mock-agent', agent1);
      registry.registerAgent('mock-agent-2', agent2);

      const agents = registry.listAgents();
      expect(agents).toHaveLength(2);
      expect(agents).toContain('mock-agent');
      expect(agents).toContain('mock-agent-2');
    });

    it('should return empty array when no agents registered', () => {
      const agents = registry.listAgents();
      expect(agents).toHaveLength(0);
    });
  });

  describe('capability search', () => {
    beforeEach(() => {
      class TestAgent extends BaseAgent {
        constructor(name: string, capabilities: string[]) {
          super({
            name,
            description: `${name} agent`,
            capabilities,
            systemPrompt: 'Test'
          });
        }
        async execute(input: string): Promise<any> {
          return { success: true };
        }
      }

      registry.registerAgent('agent1', new TestAgent('agent1', ['analyze', 'summarize']));
      registry.registerAgent('agent2', new TestAgent('agent2', ['code', 'debug']));
      registry.registerAgent('agent3', new TestAgent('agent3', ['analyze', 'code']));
    });

    it('should find agents by single capability', () => {
      const agents = registry.getAgentsByCapability('analyze');
      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.getName())).toContain('agent1');
      expect(agents.map(a => a.getName())).toContain('agent3');
    });

    it('should find agents by multiple capabilities', () => {
      const agents = registry.getAgentsByCapabilities(['analyze', 'code']);
      expect(agents).toHaveLength(1);
      expect(agents[0].getName()).toBe('agent3');
    });

    it('should return empty array for non-existent capability', () => {
      const agents = registry.getAgentsByCapability('non-existent');
      expect(agents).toHaveLength(0);
    });
  });

  describe('bulk operations', () => {
    it('should register multiple agents', () => {
      const agents = [
        { name: 'agent1', agent: new MockAgent() },
        { name: 'agent2', agent: new MockAgent() },
        { name: 'agent3', agent: new MockAgent() }
      ];

      agents.forEach(({ name, agent }) => {
        agent.name = name;
        registry.registerAgent(name, agent);
      });

      expect(registry.listAgents()).toHaveLength(3);
    });

    it('should unregister an agent', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock-agent', agent);
      expect(registry.hasAgent('mock-agent')).toBe(true);

      registry.unregisterAgent('mock-agent');
      expect(registry.hasAgent('mock-agent')).toBe(false);
    });

    it('should clear all agents', () => {
      registry.registerAgent('agent1', new MockAgent());
      registry.registerAgent('agent2', new MockAgent());
      expect(registry.listAgents()).toHaveLength(2);

      registry.clearAgents();
      expect(registry.listAgents()).toHaveLength(0);
    });
  });

  describe('agent metadata', () => {
    it('should get agent info', () => {
      const agent = new MockAgent();
      registry.registerAgent('mock-agent', agent);

      const info = registry.getAgentInfo('mock-agent');
      expect(info).toEqual({
        name: 'mock-agent',
        description: 'Mock agent for testing',
        capabilities: ['test'],
        registered: true
      });
    });

    it('should return undefined info for non-existent agent', () => {
      const info = registry.getAgentInfo('non-existent');
      expect(info).toBeUndefined();
    });

    it('should get all agents info', () => {
      registry.registerAgent('agent1', new MockAgent());
      registry.registerAgent('agent2', new MockAgent());

      const allInfo = registry.getAllAgentsInfo();
      expect(allInfo).toHaveLength(2);
      expect(allInfo.every(info => info.registered)).toBe(true);
    });
  });
});