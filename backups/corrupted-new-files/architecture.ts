// Architecture-related types for the Universal AI Tools platform;

export interface ArchitecturePattern {
  id: string;,
  name: string;
  type: 'microservices' | 'monolith' | 'serverless' | 'event-driven' | 'layered' | 'hexagonal';,'
  description: string;
  benefits: string[];,
  drawbacks: string[];
  applicability: string[];,
  implementation: {
    complexity: 'low' | 'medium' | 'high';,'
    timeToImplement: string;
    requiredSkills: string[];
  };
  metadata: Record<string, any>;
  framework?: string;
  patternType?: string;
  successRate?: number;
  useCases?: string[];
}

export interface ArchitectureRecommendation {
  id: string;,
  type: 'pattern' | 'service' | 'optimization' | 'security';'
  priority: 'low' | 'medium' | 'high' | 'critical';,'
  title: string;
  description: string;,
  impact: string;
  implementation: {,
    steps: string[];
    estimatedTime: string;,
    complexity: 'low' | 'medium' | 'high';'
  };
  metadata: {,
    category: string;
    tags: string[];
    relatedServices?: string[];
  };
}

export interface ArchitectureAnalysis {
  timestamp: string;,
  scope: string;
  recommendations: ArchitectureRecommendation[];,
  metrics: {
    codeQuality: number;,
    maintainability: number;
    scalability: number;,
    security: number;
  };
  summary: string;
}

export interface ServiceMetadata {
  id: string;,
  name: string;
  version: string;,
  status: 'active' | 'inactive' | 'maintenance';'
  health: 'healthy' | 'degraded' | 'down';,'
  dependencies: string[];
  endpoints: string[];
  invoke?: (method: string, params: any) => Promise<any>;
}

export interface PerformanceMetrics {
  responseTime: number;,
  throughput: number;
  errorRate: number;,
  cpuUsage: number;
  memoryUsage: number;
  recommendedComplexity?: 'low' | 'medium' | 'high';'
}

export interface ClaudeIntegrationMetadata {
  serviceId: string;,
  endpoint: string;
  model: string;,
  maxTokens: number;
  temperature: number;
  defaultParameters?: {
    temperature: number;,
    maxTokens: number;
    topP?: number;
  };
}