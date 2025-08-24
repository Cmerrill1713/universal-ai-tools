/**
 * Architecture Types
 * Type definitions for architectural patterns and recommendations
 */

export interface ArchitecturePattern {
  id: string;
  name: string;
  description: string;
  category: ArchitectureCategory;
  complexity: ComplexityLevel;
  successRate: number;
  usageCount: number;
  tags: string[];
  benefits: string[];
  drawbacks: string[];
  useCases: string[];
  implementation: ImplementationDetails;
  related: string[]; // IDs of related patterns
  createdAt: Date;
  updatedAt: Date;
}

export interface ArchitectureRecommendation {
  id: string;
  patternId: string;
  pattern: ArchitecturePattern;
  confidence: number;
  relevanceScore: number;
  reason: string;
  context: RecommendationContext;
  metrics: RecommendationMetrics;
  alternatives?: ArchitectureRecommendation[];
}

export interface RecommendationContext {
  userRequest: string;
  projectType: string;
  constraints: string[];
  requirements: string[];
  existingPatterns: string[];
  teamExperience: ExperienceLevel;
}

export interface RecommendationMetrics {
  confidenceScore: number;
  implementationComplexity: ComplexityLevel;
  estimatedEffort: number; // hours
  riskLevel: RiskLevel;
  maintenanceOverhead: MaintenanceLevel;
}

export interface ImplementationDetails {
  steps: ImplementationStep[];
  prerequisites: string[];
  technologies: Technology[];
  codeExamples: CodeExample[];
  configurationFiles: ConfigurationFile[];
  documentation: DocumentationLink[];
}

export interface ImplementationStep {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedTime: number; // minutes
  complexity: ComplexityLevel;
  dependencies: string[]; // step IDs
  validationCriteria: string[];
}

export interface Technology {
  name: string;
  version: string;
  type: TechnologyType;
  required: boolean;
  alternativesTo?: string[];
}

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  language: ProgrammingLanguage;
  code: string;
  fileType: string;
  purpose: string;
  comments: string[];
}

export interface ConfigurationFile {
  filename: string;
  type: ConfigurationType;
  content: string;
  description: string;
  required: boolean;
}

export interface DocumentationLink {
  title: string;
  url: string;
  type: DocumentationType;
  description: string;
}

export interface ArchitectureAnalysis {
  currentPatterns: ArchitecturePattern[];
  recommendations: ArchitectureRecommendation[];
  gaps: ArchitectureGap[];
  risks: ArchitectureRisk[];
  opportunities: ArchitectureOpportunity[];
  metrics: ArchitectureMetrics;
}

export interface ArchitectureGap {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  impact: string[];
  recommendations: string[];
}

export interface ArchitectureRisk {
  id: string;
  title: string;
  description: string;
  probability: RiskProbability;
  impact: RiskImpact;
  category: RiskCategory;
  mitigationStrategies: string[];
}

export interface ArchitectureOpportunity {
  id: string;
  title: string;
  description: string;
  potential: OpportunityPotential;
  effort: ComplexityLevel;
  benefits: string[];
  requirements: string[];
}

export interface ArchitectureMetrics {
  totalPatterns: number;
  averageComplexity: number;
  maintainabilityScore: number;
  scalabilityScore: number;
  performanceScore: number;
  securityScore: number;
  testabilityScore: number;
  documentationCoverage: number;
  technicalDebt: TechnicalDebtLevel;
}

// Enums and Union Types

export type ArchitectureCategory = 
  | 'architectural-pattern'
  | 'design-pattern'
  | 'integration-pattern'
  | 'deployment-pattern'
  | 'security-pattern'
  | 'performance-pattern'
  | 'scalability-pattern'
  | 'reliability-pattern'
  | 'organizational-pattern';

export type ComplexityLevel = 'low' | 'medium' | 'high' | 'very-high';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type MaintenanceLevel = 'low' | 'medium' | 'high';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskProbability = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';

export type RiskImpact = 'minimal' | 'minor' | 'moderate' | 'major' | 'severe';

export type RiskCategory = 
  | 'technical'
  | 'operational'
  | 'security'
  | 'performance'
  | 'scalability'
  | 'maintainability'
  | 'business';

export type OpportunityPotential = 'low' | 'medium' | 'high' | 'very-high';

export type TechnicalDebtLevel = 'low' | 'medium' | 'high' | 'critical';

export type TechnologyType = 
  | 'framework'
  | 'library'
  | 'tool'
  | 'service'
  | 'database'
  | 'infrastructure'
  | 'language'
  | 'platform';

export type ProgrammingLanguage = 
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'swift'
  | 'kotlin'
  | 'php'
  | 'ruby'
  | 'sql'
  | 'bash'
  | 'yaml'
  | 'json'
  | 'xml'
  | 'html'
  | 'css';

export type ConfigurationType = 
  | 'application'
  | 'database'
  | 'server'
  | 'deployment'
  | 'build'
  | 'test'
  | 'security'
  | 'monitoring'
  | 'logging';

export type DocumentationType = 
  | 'specification'
  | 'tutorial'
  | 'reference'
  | 'guide'
  | 'example'
  | 'api-doc'
  | 'architecture-doc'
  | 'decision-record';

// Utility Types

export interface ArchitectureQuery {
  categories?: ArchitectureCategory[];
  complexity?: ComplexityLevel[];
  minSuccessRate?: number;
  tags?: string[];
  technologies?: string[];
  limit?: number;
  offset?: number;
}

export interface PatternSearchResult {
  patterns: ArchitecturePattern[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ArchitectureAdvisorOptions {
  includeExperimental?: boolean;
  minConfidence?: number;
  maxComplexity?: ComplexityLevel;
  preferredTechnologies?: string[];
  teamExperience?: ExperienceLevel;
}

// API Response Types

export interface ArchitectureAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

export type ArchitecturePatternResponse = ArchitectureAPIResponse<ArchitecturePattern>;
export type ArchitectureRecommendationResponse = ArchitectureAPIResponse<ArchitectureRecommendation[]>;
export type ArchitectureAnalysisResponse = ArchitectureAPIResponse<ArchitectureAnalysis>;
export type PatternSearchResponse = ArchitectureAPIResponse<PatternSearchResult>;