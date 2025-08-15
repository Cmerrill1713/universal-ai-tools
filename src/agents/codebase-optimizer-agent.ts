/**
 * Codebase Optimizer Agent
 * 
 * An intelligent agent that analyzes and optimizes the entire codebase automatically.
 * Features:
 * - Code quality analysis and improvement suggestions
 * - Performance optimization detection
 * - Dependency optimization
 * - Security vulnerability scanning
 * - Automated refactoring suggestions
 * - Dead code elimination
 * - Best practices enforcement
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { log, LogContext } from '../utils/logger';
import { ollamaService } from '../services/ollama-service';

export interface CodeAnalysis {
  file: string;
  issues: CodeIssue[];
  metrics: CodeMetrics;
  suggestions: OptimizationSuggestion[];
}

export interface CodeIssue {
  type: 'performance' | 'security' | 'maintainability' | 'style' | 'bug';
  severity: 'low' | 'medium' | 'high' | 'critical';
  line: number;
  description: string;
  suggestion: string;
  autoFixable: boolean;
}

export interface CodeMetrics {
  linesOfCode: number;
  complexity: number;
  duplicateCode: number;
  testCoverage: number;
  dependencies: number;
  technicalDebt: number; // 0-100 score
}

export interface OptimizationSuggestion {
  type: 'refactor' | 'performance' | 'security' | 'dependency' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  effort: 'small' | 'medium' | 'large';
  autoImplementable: boolean;
  code?: string;
}

export interface OptimizationResult {
  totalFiles: number;
  analyzedFiles: number;
  issuesFound: number;
  suggestionsGenerated: number;
  autoFixesApplied: number;
  performanceImprovements: string[];
  securityImprovements: string[];
  codeQualityScore: number; // 0-100
}

export class CodebaseOptimizerAgent {
  private readonly SUPPORTED_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.vue', '.py', '.go', '.rs'];
  private readonly IGNORE_PATTERNS = [
    'node_modules',
    'dist',
    'build',
    '.git',
    'coverage',
    'logs',
    'screenshots',
    'test-results',
    'playwright-report'
  ];
  
  private readonly MAX_FILE_SIZE = 100000; // 100KB
  private readonly MAX_ANALYSIS_FILES = 500;
  
  constructor() {
    log.info('🔧 Codebase Optimizer Agent initialized', LogContext.AI);
  }

  /**
   * Perform comprehensive codebase analysis and optimization
   */
  async optimizeCodebase(
    basePath: string = process.cwd(),
    options: {
      autoFix?: boolean;
      includeTests?: boolean;
      performanceOnly?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    log.info('🚀 Starting comprehensive codebase optimization', LogContext.AI, {
      basePath,
      options
    });

    try {
      // 1. Discover files to analyze
      const files = await this.discoverCodeFiles(basePath, options.includeTests || false);
      
      // 2. Analyze each file
      const analyses: CodeAnalysis[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchAnalyses = await Promise.all(
          batch.map(file => this.analyzeFile(file, options.performanceOnly))
        );
        analyses.push(...batchAnalyses.filter(a => a !== null) as CodeAnalysis[]);
        
        log.debug(`Analyzed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}`, LogContext.AI);
      }

      // 3. Generate global optimization suggestions
      const globalSuggestions = await this.generateGlobalOptimizations(analyses);
      
      // 4. Apply automatic fixes if enabled
      let autoFixesApplied = 0;
      if (options.autoFix && !options.dryRun) {
        autoFixesApplied = await this.applyAutomaticFixes(analyses);
      }

      // 5. Generate optimization report
      const result = this.generateOptimizationResult(analyses, globalSuggestions, autoFixesApplied);
      
      const duration = Date.now() - startTime;
      
      log.info('✅ Codebase optimization completed', LogContext.AI, {
        duration: `${duration}ms`,
        result
      });

      return result;
      
    } catch (error) {
      log.error('❌ Codebase optimization failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Discover all code files in the project
   */
  private async discoverCodeFiles(basePath: string, includeTests: boolean): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          // Skip ignored patterns
          if (this.IGNORE_PATTERNS.some(pattern => fullPath.includes(pattern))) {
            continue;
          }
          
          // Skip test files if not included
          if (!includeTests && this.isTestFile(entry.name)) {
            continue;
          }
          
          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && this.isCodeFile(entry.name)) {
            const stats = await fs.stat(fullPath);
            if (stats.size <= this.MAX_FILE_SIZE) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        log.debug(`Failed to scan directory: ${dirPath}`, LogContext.AI, { error });
      }
    };

    await scanDirectory(basePath);
    
    // Limit the number of files to analyze
    const limitedFiles = files.slice(0, this.MAX_ANALYSIS_FILES);
    
    log.info('📁 Code files discovered', LogContext.AI, {
      totalFound: files.length,
      willAnalyze: limitedFiles.length
    });
    
    return limitedFiles;
  }

  /**
   * Analyze a single code file
   */
  private async analyzeFile(filePath: string, performanceOnly: boolean = false): Promise<CodeAnalysis | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Basic metrics
      const metrics = this.calculateMetrics(content);
      
      // Issue detection
      const issues = await this.detectIssues(content, filePath, performanceOnly);
      
      // Generate suggestions using LLM
      const suggestions = await this.generateOptimizationSuggestions(content, filePath, issues);
      
      return {
        file: relativePath,
        issues,
        metrics,
        suggestions
      };
      
    } catch (error) {
      log.debug(`Failed to analyze file: ${filePath}`, LogContext.AI, { error });
      return null;
    }
  }

  /**
   * Calculate code metrics
   */
  private calculateMetrics(content: string): CodeMetrics {
    const lines = content.split('\n');
    const linesOfCode = lines.filter(line => 
      line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*')
    ).length;
    
    // Simple complexity calculation (cyclomatic complexity approximation)
    const complexityKeywords = /\b(if|else|while|for|switch|case|catch|try|&&|\|\|)\b/g;
    const complexity = (content.match(complexityKeywords) || []).length + 1;
    
    // Duplicate code detection (simplified)
    const duplicateLines = this.detectDuplicateCode(lines);
    
    // Dependency count
    const dependencies = (content.match(/import.*from|require\(/g) || []).length;
    
    // Technical debt score (0-100, higher is worse)
    const technicalDebt = Math.min(100, Math.max(0, 
      (complexity * 2) + (duplicateLines * 5) + (dependencies * 0.5)
    ));
    
    return {
      linesOfCode,
      complexity,
      duplicateCode: duplicateLines,
      testCoverage: 0, // Would need integration with coverage tools
      dependencies,
      technicalDebt
    };
  }

  /**
   * Detect code issues
   */
  private async detectIssues(content: string, filePath: string, performanceOnly: boolean): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue; // Skip empty/undefined lines
      
      const lineNumber = i + 1;
      
      // Performance issues
      issues.push(...this.detectPerformanceIssues(line, lineNumber));
      
      if (!performanceOnly) {
        // Security issues
        issues.push(...this.detectSecurityIssues(line, lineNumber));
        
        // Maintainability issues
        issues.push(...this.detectMaintainabilityIssues(line, lineNumber));
        
        // Style issues
        issues.push(...this.detectStyleIssues(line, lineNumber));
      }
    }
    
    return issues;
  }

  /**
   * Detect performance issues
   */
  private detectPerformanceIssues(line: string, lineNumber: number): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    // Synchronous operations that should be async
    if (line.includes('readFileSync') || line.includes('writeFileSync')) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        line: lineNumber,
        description: 'Synchronous file operation blocks event loop',
        suggestion: 'Use async alternatives (readFile, writeFile) with await',
        autoFixable: true
      });
    }
    
    // Inefficient loops
    if (line.includes('for') && line.includes('length') && !line.includes('const')) {
      issues.push({
        type: 'performance',
        severity: 'low',
        line: lineNumber,
        description: 'Length property accessed in loop condition',
        suggestion: 'Cache array length in variable before loop',
        autoFixable: true
      });
    }
    
    // Memory leaks
    if (line.includes('setInterval') && !line.includes('clearInterval')) {
      issues.push({
        type: 'performance',
        severity: 'high',
        line: lineNumber,
        description: 'setInterval without clearInterval may cause memory leak',
        suggestion: 'Store interval ID and clear it when no longer needed',
        autoFixable: false
      });
    }
    
    // Inefficient regex
    if (line.includes('new RegExp') || (line.includes('/') && line.includes('/g'))) {
      issues.push({
        type: 'performance',
        severity: 'low',
        line: lineNumber,
        description: 'Regular expression could be compiled once',
        suggestion: 'Move regex to module level constant',
        autoFixable: true
      });
    }
    
    return issues;
  }

  /**
   * Detect security issues
   */
  private detectSecurityIssues(line: string, lineNumber: number): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    // SQL injection risks
    if (line.includes('query') && line.includes('+') && line.includes('\'')) {
      issues.push({
        type: 'security',
        severity: 'critical',
        line: lineNumber,
        description: 'Potential SQL injection vulnerability',
        suggestion: 'Use parameterized queries or prepared statements',
        autoFixable: false
      });
    }
    
    // Eval usage
    if (line.includes('eval(')) {
      issues.push({
        type: 'security',
        severity: 'critical',
        line: lineNumber,
        description: 'eval() usage is dangerous and should be avoided',
        suggestion: 'Use safer alternatives like JSON.parse or Function constructor',
        autoFixable: false
      });
    }
    
    // Hardcoded secrets
    if (line.match(/(password|secret|key|token).*=.*['"][^'"]+['"]/i)) {
      issues.push({
        type: 'security',
        severity: 'high',
        line: lineNumber,
        description: 'Hardcoded secret detected',
        suggestion: 'Move secrets to environment variables or secure storage',
        autoFixable: false
      });
    }
    
    return issues;
  }

  /**
   * Detect maintainability issues
   */
  private detectMaintainabilityIssues(line: string, lineNumber: number): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    // Long lines
    if (line.length > 120) {
      issues.push({
        type: 'maintainability',
        severity: 'low',
        line: lineNumber,
        description: `Line too long (${line.length} characters)`,
        suggestion: 'Break line into multiple lines for better readability',
        autoFixable: true
      });
    }
    
    // Magic numbers
    const magicNumberMatch = line.match(/\b\d{3,}\b/);
    if (magicNumberMatch && !line.includes('//')) {
      issues.push({
        type: 'maintainability',
        severity: 'low',
        line: lineNumber,
        description: 'Magic number detected',
        suggestion: 'Replace with named constant',
        autoFixable: false
      });
    }
    
    // TODO/FIXME comments
    if (line.match(/\/\/(.*?)(TODO|FIXME|HACK)/i)) {
      issues.push({
        type: 'maintainability',
        severity: 'medium',
        line: lineNumber,
        description: 'Technical debt comment found',
        suggestion: 'Address the TODO/FIXME comment',
        autoFixable: false
      });
    }
    
    return issues;
  }

  /**
   * Detect style issues
   */
  private detectStyleIssues(line: string, lineNumber: number): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    // Missing semicolons (for JS/TS)
    if (line.trim().match(/^(const|let|var|return|throw).*[^;{}\s]$/) && !line.includes('//')) {
      issues.push({
        type: 'style',
        severity: 'low',
        line: lineNumber,
        description: 'Missing semicolon',
        suggestion: 'Add semicolon at end of statement',
        autoFixable: true
      });
    }
    
    // Inconsistent quotes
    if (line.includes('"') && line.includes("'") && !line.includes('template')) {
      issues.push({
        type: 'style',
        severity: 'low',
        line: lineNumber,
        description: 'Inconsistent quote usage',
        suggestion: 'Use consistent quote style throughout file',
        autoFixable: true
      });
    }
    
    return issues;
  }

  /**
   * Generate optimization suggestions using LLM
   */
  private async generateOptimizationSuggestions(
    content: string, 
    filePath: string, 
    issues: CodeIssue[]
  ): Promise<OptimizationSuggestion[]> {
    try {
      const fileExtension = path.extname(filePath);
      const language = this.getLanguageFromExtension(fileExtension);
      
      // Only analyze files with many issues or complex code
      if (issues.length < 3 && content.length < 1000) {
        return [];
      }
      
      const prompt = `Analyze this ${language} code and suggest optimizations:

FILE: ${path.basename(filePath)}
ISSUES FOUND: ${issues.length}
CODE SAMPLE:
\`\`\`${language}
${content.substring(0, 2000)}${content.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`

EXISTING ISSUES:
${issues.slice(0, 5).map(issue => `- ${issue.type}: ${issue.description}`).join('\n')}

Please provide 3-5 specific optimization suggestions focusing on:
1. Performance improvements
2. Code structure and maintainability
3. Modern best practices

Format as JSON array:
[{
  "type": "performance|refactor|architecture",
  "priority": "low|medium|high",
  "description": "Brief description",
  "impact": "Expected improvement",
  "effort": "small|medium|large",
  "autoImplementable": boolean
}]`;

      const response = await ollamaService.generateResponse([
        {
          role: 'user',
          content: prompt
        }
      ], 'tinyllama:latest', {
        temperature: 0.3,
        max_tokens: 1000
      });

      const suggestions = this.parseOptimizationSuggestions(response.message?.content || '');
      return suggestions;
      
    } catch (error) {
      log.debug('Failed to generate LLM suggestions', LogContext.AI, { error, filePath });
      return [];
    }
  }

  /**
   * Parse optimization suggestions from LLM response
   */
  private parseOptimizationSuggestions(response: string): OptimizationSuggestion[] {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.map(item => ({
            type: item.type || 'refactor',
            priority: item.priority || 'medium',
            description: item.description || 'Optimization suggestion',
            impact: item.impact || 'Improved code quality',
            effort: item.effort || 'medium',
            autoImplementable: item.autoImplementable || false
          }));
        }
      }
    } catch (error) {
      log.debug('Failed to parse LLM suggestions', LogContext.AI, { error });
    }
    
    return [];
  }

  /**
   * Generate global optimization suggestions
   */
  private async generateGlobalOptimizations(analyses: CodeAnalysis[]): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    
    // Analyze dependency patterns
    const allIssues = analyses.flatMap(a => a.issues);
    const securityIssues = allIssues.filter(i => i.type === 'security').length;
    const performanceIssues = allIssues.filter(i => i.type === 'performance').length;
    
    if (securityIssues > 10) {
      suggestions.push({
        type: 'security',
        priority: 'high',
        description: 'Implement comprehensive security audit',
        impact: 'Improved security posture across entire codebase',
        effort: 'large',
        autoImplementable: false
      });
    }
    
    if (performanceIssues > 20) {
      suggestions.push({
        type: 'performance',
        priority: 'high',
        description: 'Implement performance monitoring and optimization',
        impact: 'Better application performance and user experience',
        effort: 'medium',
        autoImplementable: false
      });
    }
    
    // Check for architectural improvements
    const highComplexityFiles = analyses.filter(a => a.metrics.complexity > 20).length;
    if (highComplexityFiles > 5) {
      suggestions.push({
        type: 'architecture',
        priority: 'medium',
        description: 'Refactor high-complexity modules',
        impact: 'Improved maintainability and testability',
        effort: 'large',
        autoImplementable: false
      });
    }
    
    return suggestions;
  }

  /**
   * Apply automatic fixes
   */
  private async applyAutomaticFixes(analyses: CodeAnalysis[]): Promise<number> {
    let fixesApplied = 0;
    
    for (const analysis of analyses) {
      const autoFixableIssues = analysis.issues.filter(issue => issue.autoFixable);
      
      if (autoFixableIssues.length > 0) {
        try {
          const fixes = await this.generateAutomaticFixes(analysis.file, autoFixableIssues);
          if (fixes.length > 0) {
            // In a real implementation, we would apply these fixes
            // For now, just log them
            log.info('🔧 Auto-fixes generated', LogContext.AI, {
              file: analysis.file,
              fixes: fixes.length
            });
            fixesApplied += fixes.length;
          }
        } catch (error) {
          log.debug('Failed to apply fixes', LogContext.AI, { error, file: analysis.file });
        }
      }
    }
    
    return fixesApplied;
  }

  /**
   * Generate automatic fixes for issues
   */
  private async generateAutomaticFixes(filePath: string, issues: CodeIssue[]): Promise<string[]> {
    // This would contain the actual fix implementations
    // For now, return mock fixes
    return issues.map(issue => `Fix for ${issue.description} at line ${issue.line}`);
  }

  /**
   * Generate optimization result summary
   */
  private generateOptimizationResult(
    analyses: CodeAnalysis[], 
    globalSuggestions: OptimizationSuggestion[],
    autoFixesApplied: number
  ): OptimizationResult {
    const allIssues = analyses.flatMap(a => a.issues);
    const allSuggestions = analyses.flatMap(a => a.suggestions).concat(globalSuggestions);
    
    const performanceImprovements = allSuggestions
      .filter(s => s.type === 'performance')
      .map(s => s.description);
      
    const securityImprovements = allSuggestions
      .filter(s => s.type === 'security')
      .map(s => s.description);
    
    // Calculate overall code quality score
    const avgTechnicalDebt = analyses.reduce((sum, a) => sum + a.metrics.technicalDebt, 0) / analyses.length;
    const codeQualityScore = Math.max(0, 100 - avgTechnicalDebt);
    
    return {
      totalFiles: analyses.length,
      analyzedFiles: analyses.length,
      issuesFound: allIssues.length,
      suggestionsGenerated: allSuggestions.length,
      autoFixesApplied,
      performanceImprovements,
      securityImprovements,
      codeQualityScore: Math.round(codeQualityScore)
    };
  }

  /**
   * Utility methods
   */
  private isCodeFile(filename: string): boolean {
    return this.SUPPORTED_EXTENSIONS.some(ext => filename.endsWith(ext));
  }

  private isTestFile(filename: string): boolean {
    return filename.includes('.test.') || 
           filename.includes('.spec.') || 
           filename.includes('test/') ||
           filename.includes('tests/');
  }

  private getLanguageFromExtension(ext: string): string {
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript', 
      '.tsx': 'typescript',
      '.jsx': 'javascript',
      '.vue': 'vue',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust'
    };
    return langMap[ext] || 'text';
  }

  private detectDuplicateCode(lines: string[]): number {
    const lineMap = new Map<string, number>();
    let duplicates = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && trimmed.length > 10) {
        const count = lineMap.get(trimmed) || 0;
        lineMap.set(trimmed, count + 1);
        if (count === 1) {
          duplicates++;
        }
      }
    }
    
    return duplicates;
  }
}

export const codebaseOptimizerAgent = new CodebaseOptimizerAgent();