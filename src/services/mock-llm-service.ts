/**
 * Mock LLM Service for Testing AB-MCTS
 * Provides realistic responses without requiring API keys
 */

import { AgentContext } from '@/types';

export interface MockResponse {
  content: string;
  metadata?: Record<string, any>;
}

export class MockLLMService {
  private static instance: MockLLMService;
  private responses: Map<string, any> = new Map();

  private constructor() {
    this.initializeResponses();
  }

  static getInstance(): MockLLMService {
    if (!MockLLMService.instance) {
      MockLLMService.instance = new MockLLMService();
    }
    return MockLLMService.instance;
  }

  private initializeResponses() {
    // Planner responses
    this.responses.set('planner', {
      plan: {
        title: 'REST API Development Plan',
        overview: 'Systematic approach to building a secure user management API',
        phases: [
          {
            name: 'Design & Architecture',
            duration: '2-3 days',
            tasks: [
              {
                id: 'task_1',
                title: 'Define API endpoints',
                description: 'Design RESTful endpoints for user CRUD operations',
                dependencies: [],
                resources: ['OpenAPI spec', 'REST guidelines'],
                priority: 'high',
                estimatedHours: 4,
              },
              {
                id: 'task_2',
                title: 'Design authentication flow',
                description: 'Implement JWT-based authentication',
                dependencies: ['task_1'],
                resources: ['JWT library', 'Security docs'],
                priority: 'high',
                estimatedHours: 6,
              },
            ],
          },
          {
            name: 'Implementation',
            duration: '4-5 days',
            tasks: [
              {
                id: 'task_3',
                title: 'Set up project structure',
                description: 'Initialize Node.js project with TypeScript',
                dependencies: [],
                resources: ['Node.js', 'TypeScript'],
                priority: 'high',
                estimatedHours: 2,
              },
              {
                id: 'task_4',
                title: 'Implement user endpoints',
                description: 'Create CRUD endpoints for user management',
                dependencies: ['task_3'],
                resources: ['Express.js', 'Database ORM'],
                priority: 'high',
                estimatedHours: 8,
              },
            ],
          },
        ],
        risks: [
          {
            description: 'Security vulnerabilities in authentication',
            probability: 'medium',
            impact: 'high',
            mitigation: 'Use established JWT libraries and security best practices',
          },
          {
            description: 'Performance issues with large user base',
            probability: 'low',
            impact: 'medium',
            mitigation: 'Implement pagination and caching',
          },
        ],
        success_criteria: [
          'All CRUD endpoints functional',
          'Authentication working correctly',
          'API documentation complete',
          'Security tests passing',
        ],
      },
      reasoning: 'Structured plan focusing on security and scalability',
      confidence: 0.85,
      next_steps: ['Set up development environment', 'Create project repository'],
    });

    // Retriever responses
    this.responses.set('retriever', {
      findings: {
        best_practices: [
          'Use HTTPS for all API endpoints',
          'Implement rate limiting to prevent abuse',
          'Use proper HTTP status codes',
          'Version your API (e.g., /api/v1/)',
          'Implement comprehensive error handling',
        ],
        security_considerations: [
          'Hash passwords with bcrypt or argon2',
          'Use JWT tokens with short expiration',
          'Implement refresh token rotation',
          'Validate all input data',
          'Use parameterized queries to prevent SQL injection',
        ],
        recommended_tools: [
          'Express.js for the server framework',
          'Joi or Zod for input validation',
          'Passport.js for authentication strategies',
          'Swagger/OpenAPI for documentation',
        ],
      },
      sources: ['OWASP API Security Top 10', 'REST API Best Practices', 'JWT.io'],
      confidence: 0.92,
      reasoning: 'Gathered comprehensive information from security and API design resources',
    });

    // Synthesizer responses
    this.responses.set('synthesizer', {
      synthesis: {
        summary:
          'Build a secure REST API with JWT authentication, following industry best practices',
        key_recommendations: [
          'Start with a solid authentication foundation using JWT',
          'Implement comprehensive input validation on all endpoints',
          'Use environment variables for sensitive configuration',
          'Add automated tests for security scenarios',
          'Document the API using OpenAPI specification',
        ],
        implementation_order: [
          'Set up project with TypeScript and Express',
          'Implement basic user model and database',
          'Add authentication middleware',
          'Create user CRUD endpoints',
          'Add validation and error handling',
          'Write tests and documentation',
        ],
        critical_points: [
          'Never store plain text passwords',
          'Always validate and sanitize user input',
          'Use HTTPS in production',
          'Implement proper CORS configuration',
        ],
      },
      confidence: 0.88,
      reasoning: 'Synthesized planning and research into actionable recommendations',
    });

    // Code assistant responses
    this.responses.set('code_assistant', {
      code_suggestions: {
        user_model: `interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}`,
        auth_middleware: `const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};`,
        validation_example: `const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});`,
      },
      confidence: 0.82,
      reasoning: 'Provided secure code examples following best practices',
    });

    // Personal assistant responses
    this.responses.set('personal_assistant', {
      assistance: {
        task_summary: 'I can help coordinate the REST API development project',
        suggested_timeline: '2 weeks for complete implementation',
        resource_allocation: 'You might need 1-2 developers for this project',
        milestones: [
          'Day 3: Design complete',
          'Day 7: Core functionality implemented',
          'Day 10: Testing complete',
          'Day 14: Documentation and deployment ready',
        ],
      },
      confidence: 0.75,
      reasoning:
        'Provided project management assistance based on typical API development timelines',
    });
  }

  async execute(prompt: string, options: unknown = {}): Promise<MockResponse> {
    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 300 + 100));

    // Extract agent type from prompt or options
    const agentType = options.agent || this.detectAgentType(prompt);

    // Get appropriate response
    const response = this.responses.get(agentType) || this.generateGenericResponse(prompt);

    return {
      content: JSON.stringify(response),
      metadata: {
        model: 'mock-llm',
        agent: agentType,
        tokensUsed: Math.floor(Math.random() * 500 + 100),
        executionTime: Date.now(),
      },
    };
  }

  private detectAgentType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('plan') || lowerPrompt.includes('strategy')) {
      return 'planner';
    } else if (
      lowerPrompt.includes('search') ||
      lowerPrompt.includes('find') ||
      lowerPrompt.includes('research')
    ) {
      return 'retriever';
    } else if (
      lowerPrompt.includes('synthesize') ||
      lowerPrompt.includes('combine') ||
      lowerPrompt.includes('summary')
    ) {
      return 'synthesizer';
    } else if (lowerPrompt.includes('code') || lowerPrompt.includes('implement')) {
      return 'code_assistant';
    } else {
      return 'personal_assistant';
    }
  }

  private generateGenericResponse(prompt: string): unknown {
    return {
      response: `Processed request: ${prompt.substring(0, 50)}...`,
      confidence: 0.7,
      reasoning: 'Generated generic response for unmatched request type',
    };
  }

  // Method to check if mock mode is enabled
  static isEnabled(): boolean {
    return process.env.USE_MOCK_LLM === 'true' || process.env.NODE_ENV === 'test';
  }
}

export const mockLLMService = MockLLMService.getInstance();
