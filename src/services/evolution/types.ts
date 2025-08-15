/**
 * Evolution System Types
 * Core interfaces and types for Sakana AI-inspired evolutionary algorithms
 */

export interface Individual {
  id: string;
  genes: Genome;
  fitness: number;
  behaviorDescriptor: number[];
  age: number;
  parentIds: string[];
  generation: number;
  createdAt: Date;
  evaluations: EvaluationResult[];
}

export interface Genome {
  promptTemplate: string;
  parameters: {
    temperature: number;
    topP: number;
    maxTokens: number;
    frequencyPenalty: number;
    presencePenalty: number;
  };
  systemPrompt: string;
  reasoningStrategy: ReasoningStrategy;
  modelPreferences: string[];
  contextSize: number;
}

export interface ReasoningStrategy {
  type: 'cot' | 'tree_of_thoughts' | 'react' | 'self_consistency' | 'debate';
  parameters: Record<string, any>;
  chains: ReasoningChain[];
}

export interface ReasoningChain {
  step: number;
  description: string;
  template: string;
  condition?: string;
}

export interface EvaluationResult {
  taskId: string;
  taskType: TaskType;
  score: number;
  metrics: TaskMetrics;
  executionTime: number;
  resourceUsage: ResourceUsage;
  errorRate: number;
  timestamp: Date;
}

export interface TaskMetrics {
  accuracy: number;
  coherence: number;
  creativity: number;
  efficiency: number;
  factualness: number;
  relevance: number;
  diversity: number;
}

export interface ResourceUsage {
  tokensUsed: number;
  apiCalls: number;
  computeTime: number;
  memoryUsed: number;
}

export enum TaskType {
  REASONING = 'reasoning',
  CREATIVE_WRITING = 'creative_writing',
  CODE_GENERATION = 'code_generation',
  MATHEMATICS = 'mathematics',
  FACTUAL_QA = 'factual_qa',
  SUMMARIZATION = 'summarization',
  TRANSLATION = 'translation',
  ANALYSIS = 'analysis',
  PROBLEM_SOLVING = 'problem_solving',
  DIALOGUE = 'dialogue'
}

export interface Population {
  id: string;
  individuals: Individual[];
  generation: number;
  archive: Map<string, Individual>; // MAP-Elites archive
  bestIndividuals: Individual[];
  diversityMetrics: DiversityMetrics;
  convergenceMetrics: ConvergenceMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiversityMetrics {
  behaviorCoverage: number;
  phenotypicDiversity: number;
  genotypicDiversity: number;
  noveltyScore: number;
}

export interface ConvergenceMetrics {
  fitnessStagnation: number;
  populationVariance: number;
  eliteStability: number;
  improvementRate: number;
}

export interface EvolutionConfig {
  populationSize: number;
  maxGenerations: number;
  eliteSize: number;
  mutationRate: number;
  crossoverRate: number;
  noveltyThreshold: number;
  archiveSize: number;
  evaluationBudget: number;
  fitnessFunction: FitnessFunction;
  selectionStrategy: SelectionStrategy;
  diversityStrategy: DiversityStrategy;
}

export interface FitnessFunction {
  type: 'weighted_sum' | 'pareto' | 'lexicographic' | 'novelty_fitness';
  weights: Record<string, number>;
  objectives: string[];
  constraints: Constraint[];
}

export interface Constraint {
  metric: string;
  operator: 'lt' | 'gt' | 'eq' | 'lte' | 'gte';
  value: number;
  penalty: number;
}

export enum SelectionStrategy {
  TOURNAMENT = 'tournament',
  ROULETTE = 'roulette',
  RANK = 'rank',
  NSGA2 = 'nsga2',
  MAP_ELITES = 'map_elites'
}

export enum DiversityStrategy {
  BEHAVIORAL = 'behavioral',
  PHENOTYPIC = 'phenotypic',
  GENOTYPIC = 'genotypic',
  NOVELTY_SEARCH = 'novelty_search',
  QUALITY_DIVERSITY = 'quality_diversity'
}

export interface MutationOperator {
  type: 'gaussian' | 'uniform' | 'polynomial' | 'bit_flip' | 'prompt_mutation';
  probability: number;
  strength: number;
  parameters: Record<string, any>;
}

export interface CrossoverOperator {
  type: 'uniform' | 'single_point' | 'multi_point' | 'blend' | 'simulated_binary';
  probability: number;
  parameters: Record<string, any>;
}

export interface EvolutionResult {
  bestIndividual: Individual;
  population: Population;
  generationsRun: number;
  totalEvaluations: number;
  convergenceReached: boolean;
  timeElapsed: number;
  finalMetrics: {
    averageFitness: number;
    bestFitness: number;
    diversityScore: number;
    convergenceScore: number;
  };
}

export interface Task {
  id: string;
  type: TaskType;
  description: string;
  input: string;
  expectedOutput?: string;
  evaluationCriteria: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  domain: string;
  timeLimit?: number;
}

export interface Benchmark {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  evaluationMetrics: string[];
  baselineScores: Record<string, number>;
}

// Quality-Diversity specific types
export interface BehaviorDescriptor {
  dimensions: number;
  bounds: Array<[number, number]>;
  resolution: number[];
  calculator: (individual: Individual, result: EvaluationResult) => number[];
}

export interface Archive {
  cells: Map<string, Individual>;
  behaviorDescriptor: BehaviorDescriptor;
  occupancy: number;
  coverage: number;
  qd_score: number;
}

export interface NoveltyRecord {
  individualId: string;
  behaviorVector: number[];
  noveltyScore: number;
  nearestNeighbors: string[];
  timestamp: Date;
}

// Neuroevolution types for evolving reasoning strategies
export interface NeuralArchitecture {
  layers: LayerConfig[];
  connections: ConnectionConfig[];
  activationFunctions: string[];
  learningRate: number;
}

export interface LayerConfig {
  type: 'dense' | 'attention' | 'embedding' | 'normalization';
  size: number;
  parameters: Record<string, any>;
}

export interface ConnectionConfig {
  from: number;
  to: number;
  weight: number;
  enabled: boolean;
}

// Coevolution types for multi-agent evolution
export interface CoevolutionConfig {
  species: Species[];
  interactionMatrix: number[][];
  evaluationStrategy: 'round_robin' | 'random_pairing' | 'hall_of_fame';
  cooperativeObjective: boolean;
}

export interface Species {
  id: string;
  name: string;
  population: Individual[];
  fitnessFunction: FitnessFunction;
  role: 'generator' | 'evaluator' | 'critic' | 'collaborator';
}

// Prompt evolution specific types
export interface PromptGene {
  template: string;
  variables: Record<string, string>;
  instructions: string[];
  examples: string[];
  constraints: string[];
}

export interface PromptMutation {
  type: 'instruction_swap' | 'variable_change' | 'example_add' | 'template_modify';
  target: string;
  operation: string;
  parameters: Record<string, any>;
}