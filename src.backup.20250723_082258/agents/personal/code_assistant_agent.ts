/**
 * CodeAssistantAgent - Intelligent development workflow automation
 * Provides code generation, refactoring, testing, git operations, and project analysis
 */

import type { AgentConfig, AgentContext, AgentResponse } from '../base_agent';
import { BaseAgent } from '../base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';
import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';

interface CodeProject {
  path: string;
  name: string;
  language: string;
  framework?: string;
  packageManager: string;
  dependencies: string[];
  scripts: { [key: string]: string };
  gitRepository?: string;
  lastAnalyzed: Date;
}

interface CodeAnalysis {
  project: string;
  files: number;
  linesOfCode: number;
  languages: { [language: string]: number };
  complexity: 'low' | 'medium' | 'high';
  issues: Array<{
    type: '_error | 'warning' | 'suggestion';
    file: string;
    line: number;
    message: string;
    severity: number;
  }>;
  dependencies: {
    total: number;
    outdated: string[];
    vulnerable: string[];
  };
  testCoverage?: number;
  codeQuality?: number;
}

interface CodeGeneration {
  _request string;
  language: string;
  framework?: string;
  context?: string;
  generated: {
    code: string;
    explanation: string;
    suggestions: string[];
    tests?: string;
    documentation?: string;
  };
  confidence: number;
}

interface GitOperation {
  type: 'commit' | 'branch' | 'merge' | 'push' | 'pull' | 'status' | 'log';
  repository: string;
  success: boolean;
  output: string;
  _error: string;
}

export class CodeAssistantAgent extends BaseAgent {
  private supabase: SupabaseClient;
  private projectCache: Map<string, CodeProject> = new Map();
  private supportedLanguages: string[] = [
    'typescript',
    'javascript',
    'python',
    'go',
    'rust',
    'java',
    'swift',
    'kotlin',
    'c',
    'cpp',
    'csharp',
    'php',
    'ruby',
    'scala',
    'dart',
  ];

  constructor(supabase: SupabaseClient) {
    const config: AgentConfig = {
      name: 'code_assistant',
      description: 'Intelligent development workflow automation and code generation',
      priority: 8,
      capabilities: [
        {
          name: 'generate_code',
          description: 'Generate code from natural language descriptions',
          inputSchema: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              language: { type: 'string' },
              framework: { type: 'string' },
              context: { type: 'string' },
              includeTests: { type: 'boolean' },
              includeDocumentation: { type: 'boolean' },
            },
            required: ['description', 'language'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              explanation: { type: 'string' },
              tests: { type: 'string' },
              documentation: { type: 'string' },
            },
          },
        },
        {
          name: 'analyze_project',
          description: 'Comprehensive project _analysisand health check',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: { type: 'string' },
              analyzeCode: { type: 'boolean' },
              checkDependencies: { type: 'boolean' },
              runTests: { type: 'boolean' },
            },
            required: ['projectPath'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              _analysis { type: 'object' },
              recommendations: { type: 'array' },
              issues: { type: 'array' },
            },
          },
        },
        {
          name: 'refactor_code',
          description: 'Intelligent code refactoring and optimization',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              refactorType: { type: 'string', enum: ['optimize', 'modernize', 'clean', 'extract'] },
              preserveTests: { type: 'boolean' },
            },
            required: ['filePath', 'refactorType'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              refactoredCode: { type: 'string' },
              changes: { type: 'array' },
              impact: { type: 'string' },
            },
          },
        },
        {
          name: 'git_operations',
          description: 'Automated git workflow management',
          inputSchema: {
            type: 'object',
            properties: {
              operation: { type: 'string' },
              repository: { type: 'string' },
              message: { type: 'string' },
              branch: { type: 'string' },
            },
            required: ['operation', 'repository'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              output: { type: 'string' },
              nextSteps: { type: 'array' },
            },
          },
        },
      ],
      maxLatencyMs: 15000, // Code generation can take longer
      retryAttempts: 2,
      dependencies: ['ollama_assistant'],
      memoryEnabled: true,
    };

    super(config);
    this.supabase = supabase;
  }

  protected async onInitialize(): Promise<void> {
    // Check development tools availability
    await this.checkDevelopmentTools();

    // Load project cache
    await this.loadProjectCache();

    // Initialize code _analysistools
    await this.initializeCodeAnalysis();

    this.logger.info('✅ CodeAssistantAgent initialized with development tools');
  }

  protected async process(_context: AgentContext & { memoryContext?: any }): Promise<AgentResponse> {
    const { userRequest } = context;
    const startTime = Date.now();

    try {
      // Parse the user _requestto determine coding intent
      const intent = await this.parseCodeIntent(userRequest);

      let result: any;

      switch (intent.action) {
        case 'generate':
          result = await this.generateCode(intent);
          break;

        case 'analyze':
          result = await this.analyzeProject(intent);
          break;

        case 'refactor':
          result = await this.refactorCode(intent);
          break;

        case 'test':
          result = await this.runTests(intent);
          break;

        case 'git':
          result = await this.performGitOperation(intent);
          break;

        case 'debug':
          result = await this.debugCode(intent);
          break;

        case 'optimize':
          result = await this.optimizePerformance(intent);
          break;

        case 'document':
          result = await this.generateDocumentation(intent);
          break;

        default:
          result = await this.handleGeneralCodeQuery(userRequest);
      }

      const confidence = this.calculateCodeConfidence(intent, result);

      return {
        success: true,
        data: result,
        reasoning: this.buildCodeReasoning(intent, result),
        confidence,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        nextActions: this.suggestCodeActions(intent, result),
      };
    } catch (_error) {
      this.logger.error'CodeAssistantAgent processing _error', _error;
      return {
        success: false,
        data: null,
        reasoning: `Code operation failed: ${(_erroras Error).message}`,
        confidence: 0.1,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        _error (_erroras Error).message,
      };
    }
  }

  protected async onShutdown(): Promise<void> {
    // Save project cache and cleanup
    await this.saveProjectCache();
    this.logger.info('CodeAssistantAgent shutting down');
  }

  /**
   * Parse coding intent from natural language
   */
  private async parseCodeIntent(_request string): Promise<unknown> {
    const prompt = `Parse this code-related _request

Request: "${_request"

Determine:
1. Action (generate, analyze, refactor, test, git, debug, optimize, document)
2. Language/Framework (if specified)
3. Target (specific files, project, function)
4. Requirements (specific features, constraints, preferences)
5. Context (existing codebase, related files)

Respond with JSON: {
  "action": "...",
  "language": "...",
  "framework": "...", 
  "target": "...",
  "requirements": {...},
  "context": "..."
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        format: 'json',
      });

      return JSON.parse(response.data.response);
    } catch (_error) {
      return this.fallbackCodeIntentParsing(_request;
    }
  }

  /**
   * Generate code from natural language description
   */
  private async generateCode(intent: any): Promise<CodeGeneration> {
    const description = intent.target || intent.requirements?.description;
    const language = intent.language || 'typescript';
    const { framework } = intent;
    const { context } = intent;

    // Get relevant code context if working within a project
    const projectContext = await this.getProjectContext(context);

    const prompt = `Generate ${language} code based on this description:

Description: "${description}"
Language: ${language}
Framework: ${framework || 'None specified'}
Context: ${projectContext || 'Standalone code'}

Requirements:
1. Write clean, well-structured code
2. Follow best practices for ${language}
3. Include proper _errorhandling
4. Add inline comments for complex logic
5. Make code production-ready

${intent.requirements?.includeTests ? 'Also generate comprehensive unit tests.' : ''}
${intent.requirements?.includeDocumentation ? 'Also generate API documentation.' : ''}

Respond with a JSON object containing:
{
  "code": "Generated code here",
  "explanation": "Detailed explanation of the code",
  "suggestions": ["Improvement suggestion 1", "Improvement suggestion 2"],
  "tests": "Unit tests (if requested)",
  "documentation": "API documentation (if requested)"
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'deepseek-r1:14b', // Use more powerful model for code generation
        prompt,
        stream: false,
        format: 'json',
      });

      const generated = JSON.parse(response.data.response);

      // Validate and enhance the generated code
      const validated = await this.validateGeneratedCode(generated.code, language);

      // Store generation in memory for learning
      await this.storeCodeGeneration(description, language, framework, generated);

      return {
        _request description,
        language,
        framework,
        context,
        generated: {
          ...generated,
          code: validated.code || generated.code,
        },
        confidence: validated.confidence || 0.8,
      };
    } catch (_error) {
      this.logger.error'Code generation failed:', _error;
      throw new Error('Failed to generate code');
    }
  }

  /**
   * Analyze project structure and health
   */
  private async analyzeProject(intent: any): Promise<CodeAnalysis> {
    const projectPath = intent.target;

    // Check if project is already cached
    let project = this.projectCache.get(projectPath);
    if (!project) {
      project = await this.detectProject(projectPath);
      this.projectCache.set(projectPath, project);
    }

    const _analysis CodeAnalysis = {
      project: project.name,
      files: 0,
      linesOfCode: 0,
      languages: {},
      complexity: 'medium',
      issues: [],
      dependencies: {
        total: 0,
        outdated: [],
        vulnerable: [],
      },
    };

    // Analyze code structure
    if (intent.options?.analyzeCode !== false) {
      const codeMetrics = await this.analyzeCodeStructure(projectPath);
      Object.assign(_analysis codeMetrics);
    }

    // Check dependencies
    if (intent.options?.checkDependencies !== false) {
      const depAnalysis = await this.analyzeDependencies(project);
      _analysisdependencies = depAnalysis;
    }

    // Run tests if requested
    if (intent.options?.runTests) {
      const testResults = await this.runProjectTests(project);
      _analysistestCoverage = testResults.coverage;
    }

    // Calculate code quality score
    _analysiscodeQuality = this.calculateCodeQuality(_analysis;

    // Generate recommendations
    const recommendations = await this.generateProjectRecommendations(_analysis;

    return _analysis
  }

  /**
   * Refactor existing code
   */
  private async refactorCode(intent: any): Promise<unknown> {
    const filePath = intent.target;
    const refactorType = intent.requirements?.refactorType || 'clean';

    // Read current code
    const currentCode = await fs.readFile(filePath, 'utf8');
    const language = this.detectLanguageFromFile(filePath);

    const prompt = `Refactor this ${language} code using "${refactorType}" strategy:

Current Code:
\`\`\`${language}
${currentCode}
\`\`\`

Refactoring Type: ${refactorType}

Instructions:
- ${refactorType === 'optimize' ? 'Focus on performance optimization' : ''}
- ${refactorType === 'modernize' ? 'Update to modern language features' : ''}
- ${refactorType === 'clean' ? 'Improve readability and maintainability' : ''}
- ${refactorType === 'extract' ? 'Extract reusable components/functions' : ''}
- Preserve original functionality
- Add comments explaining changes
- Follow ${language} best practices

Respond with JSON:
{
  "refactoredCode": "Improved code here",
  "changes": ["Change 1", "Change 2", "Change 3"],
  "impact": "Description of the impact",
  "testSuggestions": ["Test suggestion 1", "Test suggestion 2"]
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'deepseek-r1:14b',
        prompt,
        stream: false,
        format: 'json',
      });

      const refactored = JSON.parse(response.data.response);

      // Validate refactored code
      const validation = await this.validateGeneratedCode(refactored.refactoredCode, language);

      // Create backup before applying changes
      if (intent.options?.preserveTests !== false) {
        await this.backupFile(filePath);
      }

      return {
        original: currentCode,
        refactored: refactored.refactoredCode,
        changes: refactored.changes,
        impact: refactored.impact,
        validation,
        filePath,
      };
    } catch (_error) {
      this.logger.error'Code refactoring failed:', _error;
      throw new Error('Failed to refactor code');
    }
  }

  /**
   * Perform git operations
   */
  private async performGitOperation(intent: any): Promise<GitOperation> {
    const operation = intent.requirements?.operation || intent.action;
    const repository = intent.target || process.cwd();
    const message = intent.requirements?.message;
    const branch = intent.requirements?.branch;

    let command: string;
    let success = false;
    let output = '';
    let _error string | undefined;

    try {
      switch (operation) {
        case 'status':
          command = 'git status --porcelain';
          break;

        case 'commit':
          // Smart commit with AI-generated message if not provided
          const commitMessage = message || (await this.generateCommitMessage(repository));
          command = `git add -A && git commit -m "${commitMessage}"`;
          break;

        case 'push':
          command = `git push${branch ? ` origin ${branch}` : ''}`;
          break;

        case 'pull':
          command = `git pull${branch ? ` origin ${branch}` : ''}`;
          break;

        case 'branch':
          command = branch ? `git checkout -b ${branch}` : 'git branch';
          break;

        case 'merge':
          command = `git merge ${branch}`;
          break;

        case 'log':
          command = 'git log --oneline -10';
          break;

        default:
          throw new Error(`Unknown git operation: ${operation}`);
      }

      // Execute git command
      output = execSync(command, {
        cwd: repository,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      success = true;
    } catch (err: any) {
      _error= err.message;
      output = err.stdout || err.stderr || '';
    }

    // Store git operation in memory
    await this.storeGitOperation(operation, repository, success, output, _error;

    return {
      type: operation as any,
      repository,
      success,
      output,
      _error
    };
  }

  /**
   * Check development tools availability
   */
  private async checkDevelopmentTools(): Promise<void> {
    const tools = ['git', 'node', 'npm', 'python3', 'go'];
    const available: string[] = [];
    const missing: string[] = [];

    for (const tool of tools) {
      try {
        execSync(`which ${tool}`, { stdio: 'pipe' });
        available.push(tool);
      } catch (_error) {
        missing.push(tool);
      }
    }

    this.logger.info(`Available dev tools: ${available.join(', ')}`);
    if (missing.length > 0) {
      this.logger.warn(`Missing dev tools: ${missing.join(', ')}`);
    }
  }

  /**
   * Detect project type and structure
   */
  private async detectProject(projectPath: string): Promise<CodeProject> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const goModPath = path.join(projectPath, 'go.mod');
    const cargoTomlPath = path.join(projectPath, 'Cargo.toml');
    const pyprojectPath = path.join(projectPath, 'pyproject.toml');

    let language = 'unknown';
    let framework: string | undefined;
    let packageManager = 'none';
    let dependencies: string[] = [];
    let scripts: { [key: string]: string } = {};

    try {
      // Node.js project
      if (
        await fs
          .access(packageJsonPath)
          .then(() => true)
          .catch(() => false)
      ) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        language = 'javascript';
        packageManager = 'npm';
        dependencies = Object.keys(packageJson.dependencies || {});
        scripts = packageJson.scripts || {};

        // Detect TypeScript
        if (dependencies.includes('typescript') || dependencies.includes('@types/node')) {
          language = 'typescript';
        }

        // Detect framework
        if (dependencies.includes('react')) framework = 'react';
        else if (dependencies.includes('vue')) framework = 'vue';
        else if (dependencies.includes('angular')) framework = 'angular';
        else if (dependencies.includes('express')) framework = 'express';
        else if (dependencies.includes('next')) framework = 'nextjs';
      }

      // Go project
      else if (
        await fs
          .access(goModPath)
          .then(() => true)
          .catch(() => false)
      ) {
        language = 'go';
        packageManager = 'go';
        // Parse go.mod for dependencies
      }

      // Rust project
      else if (
        await fs
          .access(cargoTomlPath)
          .then(() => true)
          .catch(() => false)
      ) {
        language = 'rust';
        packageManager = 'cargo';
        // Parse Cargo.toml for dependencies
      }

      // Python project
      else if (
        await fs
          .access(pyprojectPath)
          .then(() => true)
          .catch(() => false)
      ) {
        language = 'python';
        packageManager = 'pip';
        // Parse pyproject.toml for dependencies
      }
    } catch (_error) {
      this.logger.error'Project detection failed:', _error;
    }

    return {
      path: projectPath,
      name: path.basename(projectPath),
      language,
      framework,
      packageManager,
      dependencies,
      scripts,
      lastAnalyzed: new Date(),
    };
  }

  /**
   * Generate intelligent commit message
   */
  private async generateCommitMessage(repository: string): Promise<string> {
    try {
      // Get git diff
      const diff = execSync('git diff --cached', { cwd: repository, encoding: 'utf8' });

      if (!diff.trim()) {
        return 'Update files';
      }

      const prompt = `Generate a concise git commit message for these changes:

Git Diff:
${diff.substring(0, 2000)} ${diff.length > 2000 ? '...(truncated)' : ''}

Rules:
- Use conventional commit format (feat:, fix:, docs:, etc.)
- Be specific but concise (max 72 characters)
- Focus on what changed, not how
- Use present tense

Examples:
- feat: add user authentication system
- fix: resolve memory leak in data processing
- docs: update API documentation
- refactor: improve _errorhandling logic

Generate only the commit message:`;

      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
      });

      return response.data.response.trim().replace(/"/g, '');
    } catch (_error) {
      this.logger.error'Commit message generation failed:', _error;
      return 'Update code';
    }
  }

  // Placeholder implementations for complex methods
  private async loadProjectCache(): Promise<void> {
    // Load project cache from database
  }

  private async saveProjectCache(): Promise<void> {
    // Save project cache to database
  }

  private async initializeCodeAnalysis(): Promise<void> {
    // Initialize code _analysistools
  }

  private fallbackCodeIntentParsing(_request string): any {
    const requestLower = _requesttoLowerCase();

    if (
      requestLower.includes('generate') ||
      requestLower.includes('create') ||
      requestLower.includes('write')
    ) {
      return { action: 'generate', language: 'typescript' };
    }

    if (requestLower.includes('analyze') || requestLower.includes('check')) {
      return { action: 'analyze', target: process.cwd() };
    }

    if (requestLower.includes('refactor') || requestLower.includes('improve')) {
      return { action: 'refactor' };
    }

    if (requestLower.includes('git') || requestLower.includes('commit')) {
      return { action: 'git', requirements: { operation: 'status' } };
    }

    return { action: 'generate', language: 'typescript' };
  }

  private async getProjectContext(contextPath?: string): Promise<string | null> {
    if (!contextPath) return null;

    try {
      // Get basic project information
      const project = await this.detectProject(contextPath);
      return `Project: ${project.name} (${project.language}${project.framework ? `, ${project.framework}` : ''})`;
    } catch (_error) {
      return null;
    }
  }

  private async validateGeneratedCode(code: string, language: string): Promise<unknown> {
    // Basic syntax validation
    return { code, confidence: 0.8, valid: true };
  }

  private async storeCodeGeneration(
    description: string,
    language: string,
    framework: string | undefined,
    generated: any
  ): Promise<void> {
    try {
      await this.supabase.from('ai_memories').insert({
        service_id: 'code_assistant',
        memory_type: 'code_generation',
        _content `Generated ${language} code: ${description}`,
        metadata: { language, framework, generated },
        timestamp: new Date().toISOString(),
      });
    } catch (_error) {
      this.logger.error'Failed to store code generation:', _error;
    }
  }

  private async analyzeCodeStructure(projectPath: string): Promise<Partial<CodeAnalysis>> {
    // Analyze code structure and metrics
    return {
      files: 0,
      linesOfCode: 0,
      languages: {},
      issues: [],
    };
  }

  private async analyzeDependencies(project: CodeProject): Promise<unknown> {
    // Analyze project dependencies
    return {
      total: project.dependencies.length,
      outdated: [],
      vulnerable: [],
    };
  }

  private async runProjectTests(project: CodeProject): Promise<unknown> {
    // Run project tests
    return { coverage: 0 };
  }

  private calculateCodeQuality(_analysis CodeAnalysis): number {
    // Calculate overall code quality score
    return 0.8;
  }

  private async generateProjectRecommendations(_analysis CodeAnalysis): Promise<string[]> {
    // Generate improvement recommendations
    return [];
  }

  private detectLanguageFromFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.swift': 'swift',
      '.kt': 'kotlin',
    };
    return languageMap[ext] || 'text';
  }

  private async backupFile(filePath: string): Promise<void> {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.copyFile(filePath, backupPath);
  }

  private async storeGitOperation(
    operation: string,
    repository: string,
    success: boolean,
    output: string,
    _error: string
  ): Promise<void> {
    try {
      await this.supabase.from('ai_memories').insert({
        service_id: 'code_assistant',
        memory_type: 'git_operation',
        _content `Git ${operation} in ${repository}: ${success ? 'success' : 'failed'}`,
        metadata: { operation, repository, success, output, _error},
        timestamp: new Date().toISOString(),
      });
    } catch (_error) {
      this.logger.error'Failed to store git operation:', _error;
    }
  }

  private calculateCodeConfidence(intent: any, result: any): number {
    return 0.8;
  }

  private buildCodeReasoning(intent: any, result: any): string {
    return `Processed code ${intent.action} operation`;
  }

  private suggestCodeActions(intent: any, result: any): string[] {
    return ['Review generated code', 'Run tests', 'Update documentation'];
  }

  private async runTests(intent: any): Promise<unknown> {
    return { passed: 0, failed: 0 };
  }

  private async debugCode(intent: any): Promise<unknown> {
    return { issues: [] };
  }

  private async optimizePerformance(intent: any): Promise<unknown> {
    return { optimizations: [] };
  }

  private async generateDocumentation(intent: any): Promise<unknown> {
    return { documentation: '' };
  }

  private async handleGeneralCodeQuery(_request string): Promise<unknown> {
    return { response: 'General code query processed' };
  }
}

export default CodeAssistantAgent;
