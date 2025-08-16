// Core Types for Universal AI Tools
import type { Request } from 'express';
export interface AgentConfig {
  name: string;
  description: string;
  priority: number;
  capabilities: AgentCapability[];
  maxLatencyMs: number;
  retryAttempts: number;
  dependencies: string[];
  memoryEnabled?: boolean;
  toolExecutionEnabled?: boolean;
  allowedTools?: string[];
}

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  requiresTools?: string[];
  priority?: number;
}

export interface AgentContext {
  userRequest: string;
  requestId: string;
  workingDirectory?: string;
  memoryContext?: unknown;
  userId?: string;
  previousContext?: unknown;
  metadata?: Record<string, any>;
  query?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

export interface AgentResponse {
  success: boolean;
  data: unknown;
  confidence: number;
  message: string;
  reasoning: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface Memory {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  tags: string[];
  importance: number;
  timestamp: string;
  embedding?: number[];
}

// Extended Request interfaces for middleware
export interface ExtendedRequest extends Request {
  taskContext?: TaskContext;
  optimizedParameters?: OptimizedParameters;
  userPreferences?: UserPreferences;
}

export interface OrchestrationRequest {
  requestId: string;
  userRequest: string;
  userId: string;
  orchestrationMode?: 'simple' | 'standard' | 'cognitive' | 'adaptive';
  context: Record<string, unknown>;
  timestamp: Date;
}

export interface OrchestrationResponse {
  requestId: string;
  success: boolean;
  mode: string;
  result: unknown;
  complexity?: string;
  confidence?: number;
  reasoning?: string;
  participatingAgents?: string[];
  executionTime?: number;
  error?: string;
}

export enum AgentCategory {
  CORE = 'core',
  COGNITIVE = 'cognitive',
  PERSONAL = 'personal',
  UTILITY = 'utility',
  SPECIALIZED = 'specialized',
}

export interface AgentDefinition {
  name: string;
  category: AgentCategory;
  description: string;
  priority: number;
  className: string;
  modulePath: string;
  dependencies: string[];
  capabilities: string[];
  memoryEnabled: boolean;
  maxLatencyMs: number;
  retryAttempts: number;
}

export interface ServiceConfig {
  port: number;
  environment: string;
  // Testing environment detection
  isTestMode?: boolean;
  // Offline-first controls
  offlineMode?: boolean;
  disableExternalCalls?: boolean;
  disableRemoteLLM?: boolean;
  database: {
    url: string;
    poolSize: number;
  };
  redis?: {
    url: string;
    retryAttempts: number;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  llm: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    ollamaUrl?: string;
  };
  searxng?: {
    url: string;
  };
  lfm2?: {
    maxConcurrency: number;
    maxTokens: number;
    maxPromptChars: number;
    timeoutMs: number;
    maxPending: number;
  };
  vision: {
    enableSdxlRefiner: boolean;
    sdxlRefinerPath: string;
    preferredBackend: 'mlx' | 'gguf' | 'auto';
    maxVram: number;
    enableCaching: boolean;
  };
}

export interface ErrorCode {
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD';
  INVALID_FORMAT: 'INVALID_FORMAT';
  INVALID_INPUT: 'INVALID_INPUT';
  REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE';
  MEMORY_STORAGE_ERROR: 'MEMORY_STORAGE_ERROR';
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR';
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR';
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR';
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND';
  ORCHESTRATION_ERROR: 'ORCHESTRATION_ERROR';
  VALIDATION_ERROR: 'VALIDATION_ERROR';
  NOT_FOUND: 'NOT_FOUND';
  UNAUTHORIZED: 'UNAUTHORIZED';
  INTERNAL_ERROR: 'INTERNAL_ERROR';
  ANALYSIS_ERROR: 'ANALYSIS_ERROR';
  GENERATION_ERROR: 'GENERATION_ERROR';
  EMBEDDING_ERROR: 'EMBEDDING_ERROR';
  SERVICE_ERROR: 'SERVICE_ERROR';
  REFINEMENT_ERROR: 'REFINEMENT_ERROR';
  TOKEN_GENERATION_ERROR: 'TOKEN_GENERATION_ERROR';
  AUTH_INFO_ERROR: 'AUTH_INFO_ERROR';
  DEMO_INFO_ERROR: 'DEMO_INFO_ERROR';
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE';
  OPTIMIZATION_ERROR: 'OPTIMIZATION_ERROR';
  PRESETS_ERROR: 'PRESETS_ERROR';
  ANALYTICS_ERROR: 'ANALYTICS_ERROR';
  MODELS_ERROR: 'MODELS_ERROR';
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED';
  FEATURE_DISCOVERY_ERROR: 'FEATURE_DISCOVERY_ERROR';
  FEATURE_SEARCH_ERROR: 'FEATURE_SEARCH_ERROR';
  RECOMMENDATIONS_ERROR: 'RECOMMENDATIONS_ERROR';
  CATEGORIES_ERROR: 'CATEGORIES_ERROR';
  CATEGORY_FEATURES_ERROR: 'CATEGORY_FEATURES_ERROR';
  USAGE_TRACKING_ERROR: 'USAGE_TRACKING_ERROR';
  HELP_ERROR: 'HELP_ERROR';
  GUIDED_DISCOVERY_ERROR: 'GUIDED_DISCOVERY_ERROR';
  MEMORY_STATUS_ERROR: 'MEMORY_STATUS_ERROR';
  MEMORY_OPTIMIZATION_ERROR: 'MEMORY_OPTIMIZATION_ERROR';
  MEMORY_ANALYTICS_ERROR: 'MEMORY_ANALYTICS_ERROR';
  GC_NOT_AVAILABLE: 'GC_NOT_AVAILABLE';
  GC_ERROR: 'GC_ERROR';
  MEMORY_CONFIG_ERROR: 'MEMORY_CONFIG_ERROR';
  FORBIDDEN_ERROR: 'FORBIDDEN_ERROR';
  REQUEST_TOO_COMPLEX: 'REQUEST_TOO_COMPLEX';
  CONTENT_BLOCKED: 'CONTENT_BLOCKED';
  IMAGE_BLOCKED: 'IMAGE_BLOCKED';
  SAFETY_CHECK_ERROR: 'SAFETY_CHECK_ERROR';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: keyof ErrorCode;
    message: string;
    details?: unknown;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    version: string;
    processingTime?: number;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// Planning Agent Types
export interface PlanTask {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  resources: string[];
  priority: 'high' | 'medium' | 'low';
  estimatedHours: number;
}

export interface PlanPhase {
  name: string;
  duration: string;
  tasks: PlanTask[];
}

export interface PlanRisk {
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface Plan {
  title: string;
  overview: string;
  phases: PlanPhase[];
  risks: PlanRisk[];
  success_criteria: string[];
}

export interface PlanResponse {
  plan: Plan;
  reasoning: string;
  confidence: number;
  next_steps: string[];
  alternatives?: Plan[];
}

// Code Assistant Types
export interface CodeBlock {
  language: string;
  code: string;
  explanation?: string;
  filename?: string;
}

export interface CodeResponse {
  code_blocks: CodeBlock[];
  analysis?: string;
  suggestions?: string[];
  best_practices?: string[];
}

export interface CodeAssistantResponse {
  code_response: CodeResponse;
  implementation_guide?: string;
  testing_recommendations?: string[];
  confidence: number;
  reasoning: string;
}

// AB-MCTS Types
export interface MCTSStats {
  total_simulations: number;
  win_rate: number;
  confidence_interval: [number, number];
  best_path: string[];
  exploration_rate: number;
}

export interface MCTSNode {
  id: string;
  state: unknown;
  visits: number;
  wins: number;
  children: MCTSNode[];
  parent?: MCTSNode;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface SystemStats {
  circuitBreakerState: 'OPEN' | 'CLOSED' | 'HALF_OPEN';
  successRate: number;
  activeSearches: number;
  totalRequests?: number;
  averageResponseTime?: number;
}

export interface EmbeddingResult {
  embedding?: number[];
  error?: string;
  success?: boolean;
  data?: unknown;
  message?: string;
}

// Parameter Optimization Types
export interface OptimizedParameters {
  temperature: number;
  maxTokens: number;
  contextLength?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemPrompt?: string;
  stopSequences?: string[];
}

export interface TaskContext {
  type: string;
  complexity: 'simple' | 'medium' | 'complex';
  domain?: string;
  userPreferences?: UserPreferences;
}

export interface UserPreferences {
  preferredStyle?: string;
  maxResponseLength?: number;
  includeExamples?: boolean;
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface ParameterOverrides {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

// Visual Memory Types
export interface VisualObject {
  class: string;
  confidence?: number;
  [key: string]: any;
}

export interface ExpectedOutcome {
  objects?: VisualObject[];
  confidence?: number;
  [key: string]: any;
}

export interface ObjectDifference {
  [key: string]: any;
}

export interface LearningDelta {
  added: ObjectDifference;
  removed: ObjectDifference;
  confidence_change: number;
}

// Vision Browser Debugger Types
export interface VisionDebugData {
  console_errors?: Array<{
    message: string;
    file?: string;
    line?: number;
    [key: string]: any;
  }>;
  ui_elements?: Array<{
    type?: string;
    coordinates?: { x: number; y: number; width: number; height: number };
    text?: string;
    severity?: string;
    description?: string;
    [key: string]: any;
  }>;
  network_issues?: Array<{
    url: string;
    status: number;
    method?: string;
    responseTime?: number;
    error?: string;
    [key: string]: any;
  }>;
  performance?: Array<{
    name: string;
    value: number;
    threshold?: number;
    [key: string]: any;
  }>;
  [key: string]: any;
}

// AB-MCTS Auto Pilot Types
export interface AutoPilotResult {
  totalTime?: number;
  resourcesUsed?: {
    tokensUsed?: number;
    agents?: number;
    [key: string]: any;
  };
  searchResult?: {
    searchId?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface PerformanceAnalysisData {
  responseTime?: number;
  accuracy?: number;
  efficiency?: number;
  [key: string]: any;
}

export interface UpdateData {
  type?: string;
  data?: any;
  timestamp?: number;
  [key: string]: any;
}

export interface AnalysisResult {
  averageScore: number;
  averageTime: number;
  totalFeedback: number;
  [key: string]: any;
}

export interface FeedbackItem {
  score?: number;
  reward?: {
    value?: number;
    [key: string]: any;
  };
  metadata?: {
    responseTime?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

// Task Type Enum (moved from intelligent-parameter-service)
export enum TaskType {
  // Code Tasks
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  CODE_DEBUGGING = 'code_debugging',
  CODE_EXPLANATION = 'code_explanation',
  CODE_REFACTORING = 'code_refactoring',
  CODE_TESTING = 'code_testing',
  
  // Data Tasks
  DATA_ANALYSIS = 'data_analysis',
  DATA_VISUALIZATION = 'data_visualization',
  DATA_EXTRACTION = 'data_extraction',
  DATA_TRANSFORMATION = 'data_transformation',
  
  // Research Tasks
  RESEARCH_SYNTHESIS = 'research_synthesis',
  RESEARCH_DISCOVERY = 'research_discovery',
  LITERATURE_REVIEW = 'literature_review',
  RESEARCH = 'research',
  
  // Creative Tasks
  CREATIVE_WRITING = 'creative_writing',
  CREATIVE_BRAINSTORMING = 'creative_brainstorming',
  CONTENT_GENERATION = 'content_generation',
  BRAINSTORMING = 'brainstorming',
  
  // Q&A Tasks
  QUESTION_ANSWERING = 'question_answering',
  FACT_CHECKING = 'fact_checking',
  EXPLANATION = 'explanation',
  FACTUAL_QA = 'factual_qa',
  
  // Document Tasks
  DOCUMENT_SUMMARIZATION = 'document_summarization',
  DOCUMENT_TRANSLATION = 'document_translation',
  DOCUMENT_EDITING = 'document_editing',
  SUMMARIZATION = 'summarization',
  TRANSLATION = 'translation',
  
  // Planning Tasks
  PROJECT_PLANNING = 'project_planning',
  TASK_DECOMPOSITION = 'task_decomposition',
  STRATEGY_FORMULATION = 'strategy_formulation',
  
  // Reasoning Tasks
  LOGICAL_REASONING = 'logical_reasoning',
  MATHEMATICAL_REASONING = 'mathematical_reasoning',
  CAUSAL_REASONING = 'causal_reasoning',
  REASONING = 'reasoning',
  
  // Agent Tasks
  AGENT_ORCHESTRATION = 'agent_orchestration',
  AGENT_COLLABORATION = 'agent_collaboration',
  
  // System Tasks
  SYSTEM_OPTIMIZATION = 'system_optimization',
  SYSTEM_MONITORING = 'system_monitoring',
  ERROR_DIAGNOSIS = 'error_diagnosis',
  
  // Communication Tasks
  CASUAL_CHAT = 'casual_chat',
  TECHNICAL_SUPPORT = 'technical_support',
  
  // Vision Tasks
  IMAGE_ANALYSIS = 'image_analysis',
  IMAGE_DESCRIPTION = 'image_description',
  VISUAL_REASONING = 'visual_reasoning',
  
  // Model Tasks
  MODEL_TRAINING = 'model_training',
  
  // Default/Unknown
  GENERAL = 'general',
  UNKNOWN = 'unknown'
}

// For backward compatibility
export const apiResponse = {
  success: (data: any, message?: string) => ({
    success: true,
    data,
    message: message || 'Operation successful'
  }),
  error: (message: string, code?: string, details?: any) => ({
    success: false,
    error: {
      message,
      code: code || 'ERROR',
      details
    }
  })
}
