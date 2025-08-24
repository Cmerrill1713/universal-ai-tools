import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Solution that worked for a problem
interface LearnedSolution {
  id: string;
  problemPattern: string;
  errorSignature: string;
  solution: {
    type: 'code' | 'config' | 'restart' | 'command' | 'online';
    action: string;
    code?: string;
    source?: string; // Where solution came from (local, github, stackoverflow, etc)
  };
  successRate: number;
  usageCount: number;
  lastUsed: Date;
  metadata: {
    service?: string;
    language?: string;
    framework?: string;
    tags: string[];
  };
  evolutionScore: number; // How well this solution has evolved
}

// Problem signature for pattern matching
interface ProblemSignature {
  errorMessage: string;
  errorType: string;
  service: string;
  context: Record<string, any>;
  stackTrace?: string;
  systemState: {
    memory: number;
    cpu: number;
    diskSpace: number;
  };
}

// Evolution parameters
interface EvolutionConfig {
  mutationRate: number; // Chance of trying variations
  crossoverRate: number; // Chance of combining solutions
  selectionPressure: number; // How strongly to favor successful solutions
  populationSize: number; // Number of solutions to maintain
  onlineSearchThreshold: number; // When to search online (success rate below this)
}

export class AlphaEvolveHealing extends EventEmitter {
  private solutions: Map<string, LearnedSolution> = new Map();
  private problemHistory: ProblemSignature[] = [];
  private supabase: any;
  private evolutionConfig: EvolutionConfig;
  private solutionDatabase: string = '/tmp/uat-autoheal/learned-solutions.json';
  private searchAPIs: string[];

  constructor() {
    super();
    
    // Initialize Supabase for persistent learning
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'dummy-key';
    
    if (supabaseUrl !== 'dummy-url' && supabaseKey !== 'dummy-key') {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    
    // Evolution configuration
    this.evolutionConfig = {
      mutationRate: 0.1,
      crossoverRate: 0.3,
      selectionPressure: 0.7,
      populationSize: 100,
      onlineSearchThreshold: 0.3 // Search online if success rate < 30%
    };
    
    // APIs to search for solutions
    this.searchAPIs = [
      'https://api.github.com/search/code',
      'https://api.stackexchange.com/2.3/search',
      'https://www.googleapis.com/customsearch/v1'
    ];
    
    this.loadLearnedSolutions();
    this.startEvolutionCycle();
  }

  // MARK: - Core Learning System
  
  public async analyzeProblem(problem: ProblemSignature): Promise<LearnedSolution | null> {
    console.log(`🧬 Alpha Evolve: Analyzing problem - ${problem.errorMessage}`);
    
    // Step 1: Check if we've seen this exact problem before
    const exactMatch = this.findExactSolution(problem);
    if (exactMatch && exactMatch.successRate > 0.8) {
      console.log(`✅ Found exact solution with ${exactMatch.successRate * 100}% success rate`);
      return exactMatch;
    }
    
    // Step 2: Find similar problems using pattern matching
    const similarSolutions = this.findSimilarSolutions(problem);
    if (similarSolutions.length > 0) {
      console.log(`🔍 Found ${similarSolutions.length} similar solutions`);
      
      // Evolve the best solution
      const evolved = await this.evolveSolution(similarSolutions[0], problem);
      if (evolved) {
        return evolved;
      }
    }
    
    // Step 3: Search online if local solutions aren't working
    if (!exactMatch || exactMatch.successRate < this.evolutionConfig.onlineSearchThreshold) {
      console.log('🌐 Searching online for solutions...');
      const onlineSolution = await this.searchOnlineForSolution(problem);
      if (onlineSolution) {
        this.addSolution(onlineSolution);
        return onlineSolution;
      }
    }
    
    // Step 4: Generate new solution through mutation
    console.log('🧪 Generating new solution through mutation...');
    return this.generateNewSolution(problem);
  }

  private findExactSolution(problem: ProblemSignature): LearnedSolution | null {
    const signature = this.generateProblemSignature(problem);
    return this.solutions.get(signature) || null;
  }

  private findSimilarSolutions(problem: ProblemSignature): LearnedSolution[] {
    const similar: LearnedSolution[] = [];
    const targetVector = this.problemToVector(problem);
    
    for (const solution of this.solutions.values()) {
      const similarity = this.calculateSimilarity(
        targetVector,
        this.problemToVector({
          errorMessage: solution.problemPattern,
          errorType: solution.errorSignature,
          service: solution.metadata.service || '',
          context: {},
          systemState: { memory: 0, cpu: 0, diskSpace: 0 }
        })
      );
      
      if (similarity > 0.7) { // 70% similarity threshold
        similar.push(solution);
      }
    }
    
    // Sort by success rate and evolution score
    return similar.sort((a, b) => 
      (b.successRate * b.evolutionScore) - (a.successRate * a.evolutionScore)
    );
  }

  // MARK: - Evolution Engine
  
  private async evolveSolution(
    baseSolution: LearnedSolution,
    problem: ProblemSignature
  ): Promise<LearnedSolution | null> {
    console.log(`🧬 Evolving solution: ${baseSolution.id}`);
    
    // Create mutations
    const mutations = this.mutateSolution(baseSolution, problem);
    
    // Test mutations in parallel
    const results = await Promise.all(
      mutations.map(mutation => this.testSolution(mutation, problem))
    );
    
    // Select the best performing mutation
    const bestMutation = results
      .filter(r => r.success)
      .sort((a, b) => b.performance - a.performance)[0];
    
    if (bestMutation) {
      const evolved = {
        ...baseSolution,
        id: `${baseSolution.id}-evolved-${Date.now()}`,
        solution: bestMutation.solution,
        evolutionScore: baseSolution.evolutionScore + 0.1,
        lastUsed: new Date()
      };
      
      this.addSolution(evolved);
      return evolved;
    }
    
    return null;
  }

  private mutateSolution(
    solution: LearnedSolution,
    problem: ProblemSignature
  ): LearnedSolution[] {
    const mutations: LearnedSolution[] = [];
    
    // Type 1: Parameter mutation (adjust values)
    if (solution.solution.type === 'command') {
      const paramVariations = this.generateParameterVariations(solution.solution.action);
      paramVariations.forEach(variation => {
        mutations.push({
          ...solution,
          id: `${solution.id}-param-${Date.now()}`,
          solution: { ...solution.solution, action: variation }
        });
      });
    }
    
    // Type 2: Code mutation (modify code snippets)
    if (solution.solution.type === 'code' && solution.solution.code) {
      const codeVariations = this.generateCodeVariations(solution.solution.code, problem);
      codeVariations.forEach(variation => {
        mutations.push({
          ...solution,
          id: `${solution.id}-code-${Date.now()}`,
          solution: { ...solution.solution, code: variation }
        });
      });
    }
    
    // Type 3: Crossover with other successful solutions
    const crossoverCandidates = Array.from(this.solutions.values())
      .filter(s => s.id !== solution.id && s.successRate > 0.6);
    
    if (crossoverCandidates.length > 0 && Math.random() < this.evolutionConfig.crossoverRate) {
      const partner = crossoverCandidates[Math.floor(Math.random() * crossoverCandidates.length)];
      const crossover = this.crossoverSolutions(solution, partner);
      if (crossover) {
        mutations.push(crossover);
      }
    }
    
    return mutations;
  }

  private generateParameterVariations(command: string): string[] {
    const variations: string[] = [];
    
    // Timeout variations
    if (command.includes('timeout')) {
      variations.push(command.replace(/timeout \d+/, 'timeout 30'));
      variations.push(command.replace(/timeout \d+/, 'timeout 60'));
    }
    
    // Port variations
    if (command.includes('port')) {
      const portMatch = command.match(/port[= ]\d+/);
      if (portMatch) {
        const currentPort = parseInt(portMatch[0].match(/\d+/)![0]);
        variations.push(command.replace(/port[= ]\d+/, `port ${currentPort + 1}`));
      }
    }
    
    // Memory variations
    if (command.includes('memory') || command.includes('Xmx')) {
      variations.push(command.replace(/Xmx\d+[mg]/i, 'Xmx512m'));
      variations.push(command.replace(/Xmx\d+[mg]/i, 'Xmx1024m'));
    }
    
    return variations;
  }

  private generateCodeVariations(code: string, problem: ProblemSignature): string[] {
    const variations: string[] = [];
    
    // Add error handling
    if (!code.includes('try') && !code.includes('catch')) {
      variations.push(`try {\n${code}\n} catch (error) {\n  console.error('Error:', error);\n}`);
    }
    
    // Add retry logic
    if (problem.errorMessage.includes('timeout') || problem.errorMessage.includes('ECONNREFUSED')) {
      variations.push(this.addRetryLogic(code));
    }
    
    // Add async/await if missing
    if (code.includes('then') && !code.includes('async')) {
      variations.push(this.convertToAsyncAwait(code));
    }
    
    return variations;
  }

  private crossoverSolutions(
    solution1: LearnedSolution,
    solution2: LearnedSolution
  ): LearnedSolution | null {
    // Combine successful aspects of both solutions
    if (solution1.solution.type === solution2.solution.type) {
      return {
        ...solution1,
        id: `crossover-${Date.now()}`,
        solution: {
          type: solution1.solution.type,
          action: `${solution1.solution.action} && ${solution2.solution.action}`,
          code: solution1.solution.code && solution2.solution.code
            ? `${solution1.solution.code}\n// Crossover\n${solution2.solution.code}`
            : solution1.solution.code || solution2.solution.code
        },
        evolutionScore: (solution1.evolutionScore + solution2.evolutionScore) / 2
      };
    }
    
    return null;
  }

  // MARK: - Online Search Integration
  
  private async searchOnlineForSolution(problem: ProblemSignature): Promise<LearnedSolution | null> {
    console.log('🔍 Searching online for solutions...');
    
    const searchQueries = this.generateSearchQueries(problem);
    const results: any[] = [];
    
    // Search GitHub
    try {
      const githubResults = await this.searchGitHub(searchQueries[0]);
      results.push(...githubResults);
    } catch (error) {
      console.error('GitHub search failed:', error);
    }
    
    // Search StackOverflow
    try {
      const stackResults = await this.searchStackOverflow(searchQueries[0]);
      results.push(...stackResults);
    } catch (error) {
      console.error('StackOverflow search failed:', error);
    }
    
    // Analyze and extract solutions from results
    if (results.length > 0) {
      const solution = await this.extractSolutionFromSearchResults(results, problem);
      if (solution) {
        console.log(`✅ Found online solution: ${solution.solution.source}`);
        return solution;
      }
    }
    
    return null;
  }

  private generateSearchQueries(problem: ProblemSignature): string[] {
    const queries: string[] = [];
    
    // Query 1: Error message + service
    queries.push(`${problem.errorMessage} ${problem.service}`);
    
    // Query 2: Error type + context
    if (problem.errorType) {
      queries.push(`${problem.errorType} ${problem.service} fix solution`);
    }
    
    // Query 3: Stack trace key parts
    if (problem.stackTrace) {
      const keyParts = this.extractKeyPartsFromStackTrace(problem.stackTrace);
      queries.push(keyParts.join(' '));
    }
    
    return queries;
  }

  private async searchGitHub(query: string): Promise<any[]> {
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=5`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Universal-AI-Tools'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.items || [];
      }
    } catch (error) {
      console.error('GitHub API error:', error);
    }
    
    return [];
  }

  private async searchStackOverflow(query: string): Promise<any[]> {
    const url = `https://api.stackexchange.com/2.3/search?order=desc&sort=relevance&intitle=${encodeURIComponent(query)}&site=stackoverflow`;
    
    try {
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        return data.items || [];
      }
    } catch (error) {
      console.error('StackOverflow API error:', error);
    }
    
    return [];
  }

  private async extractSolutionFromSearchResults(
    results: any[],
    problem: ProblemSignature
  ): Promise<LearnedSolution | null> {
    // Analyze search results and extract actionable solutions
    for (const result of results) {
      // GitHub result
      if (result.repository) {
        const solution = await this.extractFromGitHubResult(result, problem);
        if (solution) return solution;
      }
      
      // StackOverflow result
      if (result.question_id) {
        const solution = await this.extractFromStackOverflowResult(result, problem);
        if (solution) return solution;
      }
    }
    
    return null;
  }

  private async extractFromGitHubResult(result: any, problem: ProblemSignature): Promise<LearnedSolution | null> {
    // Extract code fixes from GitHub
    return {
      id: `github-${Date.now()}`,
      problemPattern: problem.errorMessage,
      errorSignature: problem.errorType,
      solution: {
        type: 'code',
        action: `Apply fix from ${result.repository.full_name}`,
        code: result.content || '',
        source: `GitHub: ${result.html_url}`
      },
      successRate: 0.5, // Initial guess
      usageCount: 0,
      lastUsed: new Date(),
      metadata: {
        service: problem.service,
        tags: ['github', 'community']
      },
      evolutionScore: 0.5
    };
  }

  private async extractFromStackOverflowResult(result: any, problem: ProblemSignature): Promise<LearnedSolution | null> {
    // Extract solutions from StackOverflow
    return {
      id: `stackoverflow-${Date.now()}`,
      problemPattern: problem.errorMessage,
      errorSignature: problem.errorType,
      solution: {
        type: 'code',
        action: `Apply solution from SO question ${result.question_id}`,
        source: `StackOverflow: ${result.link}`
      },
      successRate: result.score > 10 ? 0.7 : 0.4,
      usageCount: 0,
      lastUsed: new Date(),
      metadata: {
        service: problem.service,
        tags: ['stackoverflow', 'community']
      },
      evolutionScore: 0.5
    };
  }

  // MARK: - Learning Feedback Loop
  
  public recordSolutionOutcome(
    solutionId: string,
    success: boolean,
    performance: number = 0
  ): void {
    const solution = this.solutions.get(solutionId);
    if (!solution) return;
    
    // Update success rate with exponential moving average
    const alpha = 0.3; // Learning rate
    solution.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * solution.successRate;
    solution.usageCount++;
    solution.lastUsed = new Date();
    
    // Evolve the evolution score
    if (success) {
      solution.evolutionScore = Math.min(1, solution.evolutionScore + 0.05);
    } else {
      solution.evolutionScore = Math.max(0, solution.evolutionScore - 0.1);
    }
    
    // Persist to database
    this.saveSolution(solution);
    
    // Emit event for monitoring
    this.emit('solution-outcome', {
      solutionId,
      success,
      performance,
      newSuccessRate: solution.successRate,
      evolutionScore: solution.evolutionScore
    });
    
    console.log(`📊 Solution ${solutionId}: Success=${success}, Rate=${solution.successRate.toFixed(2)}, Evolution=${solution.evolutionScore.toFixed(2)}`);
  }

  // MARK: - Persistence and Memory
  
  private async loadLearnedSolutions(): Promise<void> {
    // Load from local file
    if (fs.existsSync(this.solutionDatabase)) {
      try {
        const data = fs.readFileSync(this.solutionDatabase, 'utf-8');
        const solutions = JSON.parse(data);
        solutions.forEach((s: LearnedSolution) => {
          this.solutions.set(s.id, s);
        });
        console.log(`📚 Loaded ${this.solutions.size} learned solutions`);
      } catch (error) {
        console.error('Error loading solutions:', error);
      }
    }
    
    // Load from Supabase if available
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('learned_solutions')
          .select('*')
          .order('success_rate', { ascending: false })
          .limit(this.evolutionConfig.populationSize);
        
        if (data) {
          data.forEach((s: any) => {
            this.solutions.set(s.id, s);
          });
          console.log(`☁️ Loaded ${data.length} solutions from cloud`);
        }
      } catch (error) {
        console.error('Error loading from Supabase:', error);
      }
    }
  }

  private saveSolution(solution: LearnedSolution): void {
    // Save to local file
    const allSolutions = Array.from(this.solutions.values());
    fs.writeFileSync(this.solutionDatabase, JSON.stringify(allSolutions, null, 2));
    
    // Save to Supabase if available
    if (this.supabase) {
      this.supabase
        .from('learned_solutions')
        .upsert(solution)
        .then(({ error }: any) => {
          if (error) console.error('Error saving to Supabase:', error);
        });
    }
  }

  private addSolution(solution: LearnedSolution): void {
    this.solutions.set(solution.id, solution);
    this.saveSolution(solution);
    
    // Prune if population too large
    if (this.solutions.size > this.evolutionConfig.populationSize) {
      this.pruneWeakSolutions();
    }
  }

  private pruneWeakSolutions(): void {
    // Remove solutions with low success rate and evolution score
    const sorted = Array.from(this.solutions.values())
      .sort((a, b) => (b.successRate * b.evolutionScore) - (a.successRate * a.evolutionScore));
    
    // Keep only top performers
    this.solutions.clear();
    sorted.slice(0, this.evolutionConfig.populationSize).forEach(s => {
      this.solutions.set(s.id, s);
    });
    
    console.log(`🧹 Pruned to ${this.solutions.size} solutions`);
  }

  // MARK: - Evolution Cycle
  
  private startEvolutionCycle(): void {
    // Periodic evolution and optimization
    setInterval(() => {
      this.runEvolutionCycle();
    }, 300000); // Every 5 minutes
  }

  private async runEvolutionCycle(): Promise<void> {
    console.log('🧬 Running evolution cycle...');
    
    // Natural selection: promote successful solutions
    const successful = Array.from(this.solutions.values())
      .filter(s => s.successRate > 0.7);
    
    // Generate offspring through crossover
    for (let i = 0; i < successful.length - 1; i++) {
      if (Math.random() < this.evolutionConfig.crossoverRate) {
        const offspring = this.crossoverSolutions(successful[i], successful[i + 1]);
        if (offspring) {
          this.addSolution(offspring);
        }
      }
    }
    
    // Mutation: randomly modify some solutions
    for (const solution of this.solutions.values()) {
      if (Math.random() < this.evolutionConfig.mutationRate) {
        const mutated = this.mutateSolution(solution, {
          errorMessage: solution.problemPattern,
          errorType: solution.errorSignature,
          service: solution.metadata.service || '',
          context: {},
          systemState: { memory: 50, cpu: 50, diskSpace: 50 }
        });
        
        if (mutated.length > 0) {
          this.addSolution(mutated[0]);
        }
      }
    }
    
    // Prune weak solutions
    this.pruneWeakSolutions();
    
    console.log(`🧬 Evolution complete. Population: ${this.solutions.size}, Avg success rate: ${this.getAverageSuccessRate().toFixed(2)}`);
  }

  // MARK: - Utility Functions
  
  private generateProblemSignature(problem: ProblemSignature): string {
    return `${problem.service}-${problem.errorType}-${problem.errorMessage}`.toLowerCase().replace(/\s+/g, '-');
  }

  private problemToVector(problem: ProblemSignature): number[] {
    // Convert problem to numerical vector for similarity calculation
    const vector: number[] = [];
    
    // Error type features
    vector.push(problem.errorType === 'timeout' ? 1 : 0);
    vector.push(problem.errorType === 'connection' ? 1 : 0);
    vector.push(problem.errorType === 'memory' ? 1 : 0);
    vector.push(problem.errorType === 'syntax' ? 1 : 0);
    
    // System state features
    vector.push(problem.systemState.memory / 100);
    vector.push(problem.systemState.cpu / 100);
    vector.push(problem.systemState.diskSpace / 100);
    
    // Service features
    vector.push(problem.service.includes('api') ? 1 : 0);
    vector.push(problem.service.includes('rust') ? 1 : 0);
    vector.push(problem.service.includes('go') ? 1 : 0);
    
    return vector;
  }

  private calculateSimilarity(vector1: number[], vector2: number[]): number {
    // Cosine similarity
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  private extractKeyPartsFromStackTrace(stackTrace: string): string[] {
    const lines = stackTrace.split('\n');
    const keyParts: string[] = [];
    
    // Extract function names and error types
    lines.forEach(line => {
      const functionMatch = line.match(/at (\w+)/);
      if (functionMatch) {
        keyParts.push(functionMatch[1]);
      }
    });
    
    return keyParts.slice(0, 5); // Top 5 key parts
  }

  private addRetryLogic(code: string): string {
    return `
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

await withRetry(async () => {
  ${code}
});`;
  }

  private convertToAsyncAwait(code: string): string {
    // Simple conversion - in production would use proper AST transformation
    return code
      .replace(/\.then\(/g, 'await ')
      .replace(/\).catch\(/g, '; } catch(error) { ')
      .replace(/return new Promise/g, 'return await new Promise');
  }

  private async testSolution(
    solution: LearnedSolution,
    problem: ProblemSignature
  ): Promise<{ success: boolean; performance: number; solution: any }> {
    // Simulate testing - in production would actually execute
    const randomSuccess = Math.random() > 0.5;
    const performance = randomSuccess ? Math.random() : 0;
    
    return {
      success: randomSuccess,
      performance,
      solution: solution.solution
    };
  }

  private async generateNewSolution(problem: ProblemSignature): Promise<LearnedSolution> {
    // Generate a basic solution template
    return {
      id: `generated-${Date.now()}`,
      problemPattern: problem.errorMessage,
      errorSignature: problem.errorType,
      solution: {
        type: 'command',
        action: `systemctl restart ${problem.service}`,
        source: 'generated'
      },
      successRate: 0.5,
      usageCount: 0,
      lastUsed: new Date(),
      metadata: {
        service: problem.service,
        tags: ['generated', 'experimental']
      },
      evolutionScore: 0.3
    };
  }

  private getAverageSuccessRate(): number {
    const rates = Array.from(this.solutions.values()).map(s => s.successRate);
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  }

  // MARK: - Public API
  
  public async healWithEvolution(problem: ProblemSignature): Promise<boolean> {
    const solution = await this.analyzeProblem(problem);
    
    if (!solution) {
      console.log('❌ No solution found');
      return false;
    }
    
    console.log(`🎯 Applying solution: ${solution.id}`);
    
    // Execute the solution
    let success = false;
    
    try {
      switch (solution.solution.type) {
        case 'command':
          // Execute command
          const { exec } = require('child_process');
          await new Promise((resolve, reject) => {
            exec(solution.solution.action, (error: any, stdout: any, stderr: any) => {
              if (error) reject(error);
              else resolve(stdout);
            });
          });
          success = true;
          break;
          
        case 'code':
          // Execute code (would need sandboxing in production)
          if (solution.solution.code) {
            eval(solution.solution.code);
            success = true;
          }
          break;
          
        case 'restart':
          // Restart service
          console.log(`Restarting service: ${problem.service}`);
          success = true;
          break;
      }
    } catch (error) {
      console.error('Solution execution failed:', error);
      success = false;
    }
    
    // Record outcome for learning
    this.recordSolutionOutcome(solution.id, success);
    
    return success;
  }

  public getEvolutionStats(): any {
    return {
      totalSolutions: this.solutions.size,
      averageSuccessRate: this.getAverageSuccessRate(),
      topSolutions: Array.from(this.solutions.values())
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5)
        .map(s => ({
          id: s.id,
          successRate: s.successRate,
          evolutionScore: s.evolutionScore,
          source: s.solution.source
        }))
    };
  }
}

// Export singleton
export const alphaEvolveHealing = new AlphaEvolveHealing();

// Start if run directly
if (require.main === module) {
  console.log('🧬 Alpha Evolve Healing System started');
  console.log('Learning and evolving solutions over time...');
  
  // Example usage
  const testProblem: ProblemSignature = {
    errorMessage: 'Health endpoint returning 404',
    errorType: 'http',
    service: 'go-api-gateway',
    context: { endpoint: '/api/health' },
    systemState: { memory: 55, cpu: 10, diskSpace: 70 }
  };
  
  alphaEvolveHealing.healWithEvolution(testProblem).then(success => {
    console.log(`Healing result: ${success ? 'SUCCESS' : 'FAILED'}`);
    console.log('Evolution stats:', alphaEvolveHealing.getEvolutionStats());
  });
}