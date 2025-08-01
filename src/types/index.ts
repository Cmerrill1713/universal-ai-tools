// Core Types for Universal AI Tools
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
}

export interface AgentContext {
  userRequest: string;
  requestId: string;
  workingDirectory?: string;
  memoryContext?: unknown;
  userId?: string;
  previousContext?: unknown;
  metadata?: Record<string, any>;
  conversationHistory?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  sessionId?: string;
  timestamp?: Date;
  messageHistory?: any[];
  contextData?: Record<string, any>;
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
  taskContext: TaskContext;
  optimizedParameters: OptimizedParameters;
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
  REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE';
  MEMORY_STORAGE_ERROR: 'MEMORY_STORAGE_ERROR';
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR';
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR';
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
  SELECTION_ERROR: 'SELECTION_ERROR';
  EXECUTION_ERROR: 'EXECUTION_ERROR';
  SMART_CHAT_ERROR: 'SMART_CHAT_ERROR';
  REVIEW_FAILED: 'REVIEW_FAILED';
  ANALYSIS_FAILED: 'ANALYSIS_FAILED';
  SCAN_FAILED: 'SCAN_FAILED';
  INDEXING_FAILED: 'INDEXING_FAILED';
  REPOSITORY_ERROR: 'REPOSITORY_ERROR';
  USER_ID_REQUIRED: 'USER_ID_REQUIRED';
  ACCESS_DENIED: 'ACCESS_DENIED';
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND';
  HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED';
  MISSING_PARAMETER: 'MISSING_PARAMETER';
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

// Module declarations for tree-sitter libraries
declare module 'tree-sitter' {
  export default class Parser {
    setLanguage(language: any): void;
    parse(input: string | Buffer | ((index: number, position?: Point) => string)): Tree;
  }
  
  export interface Point {
    row: number;
    column: number;
  }
  
  export interface Language {
    // Language implementation details
  }
  
  export interface Tree {
    rootNode: Node;
    getLanguage(): any;
  }
  
  export interface Node {
    type: string;
    text: string;
    startPosition: Point;
    endPosition: Point;
    children: Node[];
    childCount: number;
    namedChildCount: number;
    namedChildren: Node[];
    parent: Node | null;
    nextSibling: Node | null;
    previousSibling: Node | null;
    child(index: number): Node | null;
    namedChild(index: number): Node | null;
    firstChild: Node | null;
    lastChild: Node | null;
    walk(): TreeCursor;
    descendantsOfType(type: string): Node[];
    descendantsOfType(types: string[]): Node[];
  }
  
  export interface TreeCursor {
    nodeType: string;
    nodeText: string;
    startPosition: Point;
    endPosition: Point;
    gotoFirstChild(): boolean;
    gotoNextSibling(): boolean;
    gotoParent(): boolean;
    currentNode(): Node;
  }
  
  export class Language {
    static load(path: string): Language;
  }
}

// Tree-sitter language declarations moved to src/types/tree-sitter.d.ts
