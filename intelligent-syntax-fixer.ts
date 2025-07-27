#!/usr/bin/env npx tsx

/**
 * Intelligent Syntax Fixer
 * Uses specialized agents to analyze and fix specific TypeScript files based on their domain expertise
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

interface ParseError {
  file: string;
  line: number;
  column: number;
  message: string;
  rule?: string;
}

interface FileAnalysis {
  file: string;
  fileType: 'agent' | 'service' | 'middleware' | 'router' | 'util' | 'config' | 'type';
  domain: string;
  errors: ParseError[];
  complexity: 'low' | 'medium' | 'high';
  agentSpecialty: string;
}

interface FixAgent {
  name: string;
  specialty: string[];
  patterns: string[];
  fixFunction: (content: string, errors: ParseError[]) => Promise<string>;
}

class IntelligentSyntaxFixer {
  private agents: FixAgent[] = [];
  private backupDir: string;

  constructor() {
    this.backupDir = `src.backup.intelligent.${new Date().toISOString().slice(0, 19).replace(/:/g, '')}`
    this.initializeAgents();
  }

  private initializeAgents() {
    // TypeScript Import/Export Agent
    this.agents.push({
      name: 'ImportExportAgent',
      specialty: ['imports', 'exports', 'type-declarations'],
      patterns: ['import', 'export', 'from', 'type'],
      fixFunction: this.fixImportsExports.bind(this)
    });

    // Property Access Agent
    this.agents.push({
      name: 'PropertyAccessAgent', 
      specialty: ['property-access', 'method-calls', 'object-notation'],
      patterns: ['this.', 'Agent.', 'interface', 'property'],
      fixFunction: this.fixPropertyAccess.bind(this)
    });

    // Method Structure Agent
    this.agents.push({
      name: 'MethodStructureAgent',
      specialty: ['methods', 'functions', 'braces', 'async'],
      patterns: ['async', 'protected', 'private', 'public', 'function'],
      fixFunction: this.fixMethodStructure.bind(this)
    });

    // Object Literal Agent
    this.agents.push({
      name: 'ObjectLiteralAgent',
      specialty: ['objects', 'interfaces', 'commas', 'semicolons'],  
      patterns: ['interface', 'object', 'literal', '{', '}'],
      fixFunction: this.fixObjectLiterals.bind(this)
    });

    // Agent-Specific Domain Agent
    this.agents.push({
      name: 'AgentDomainAgent',
      specialty: ['cognitive-agents', 'agent-capabilities', 'orchestration'],
      patterns: ['cognitiveCapabilities', 'Agent', 'execute', 'Context'],
      fixFunction: this.fixAgentDomainCode.bind(this)
    });
  }

  async analyzeFile(filePath: string): Promise<FileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    const errors = await this.getFileErrors(filePath);
    
    // Determine file type and domain
    const fileType = this.classifyFileType(filePath);
    const domain = this.extractDomain(filePath, content);
    const complexity = this.assessComplexity(content, errors);
    const agentSpecialty = this.selectBestAgent(content, errors, fileType);

    return {
      file: filePath,
      fileType,
      domain,
      errors,
      complexity,
      agentSpecialty
    };
  }

  private async getFileErrors(filePath: string): Promise<ParseError[]> {
    try {
      const { stdout, stderr } = await execAsync(`npx eslint "${filePath}" --format json`);
      const result = JSON.parse(stdout);
      
      if (result.length === 0) return [];
      
      return result[0].messages.map((msg: any) => ({
        file: filePath,
        line: msg.line,
        column: msg.column,
        message: msg.message,
        rule: msg.ruleId
      }));
    } catch (error) {
      // ESLint will exit with code 1 if there are errors, so we parse stderr
      try {
        const errorOutput = (error as any).stdout || '';
        if (errorOutput) {
          const result = JSON.parse(errorOutput);
          if (result.length > 0) {
            return result[0].messages.map((msg: any) => ({
              file: filePath,
              line: msg.line,
              column: msg.column,
              message: msg.message,
              rule: msg.ruleId
            }));
          }
        }
      } catch (parseError) {
        console.warn(`Could not parse errors for ${filePath}`);
      }
      return [];
    }
  }

  private classifyFileType(filePath: string): FileAnalysis['fileType'] {
    if (filePath.includes('/agents/')) return 'agent';
    if (filePath.includes('/services/')) return 'service';
    if (filePath.includes('/middleware/')) return 'middleware';
    if (filePath.includes('/routers/')) return 'router';
    if (filePath.includes('/utils/')) return 'util';
    if (filePath.includes('/config/')) return 'config';
    if (filePath.includes('/types/')) return 'type';
    return 'util';
  }

  private extractDomain(filePath: string, content: string): string {
    const fileName = path.basename(filePath, '.ts');
    
    // Domain extraction based on file patterns
    if (fileName.includes('cognitive')) return 'cognitive-agents';
    if (fileName.includes('personal')) return 'personal-agents';
    if (fileName.includes('memory')) return 'memory-system';
    if (fileName.includes('orchestrat')) return 'orchestration';
    if (fileName.includes('dspy')) return 'dspy-integration';
    if (fileName.includes('llm') || fileName.includes('ollama')) return 'llm-services';
    if (fileName.includes('auth')) return 'authentication';
    if (fileName.includes('security')) return 'security';
    if (fileName.includes('performance')) return 'performance';
    
    return 'general';
  }

  private assessComplexity(content: string, errors: ParseError[]): FileAnalysis['complexity'] {
    const lines = content.split('\n').length;
    const errorCount = errors.length;
    
    if (lines > 500 || errorCount > 10) return 'high';
    if (lines > 200 || errorCount > 5) return 'medium';
    return 'low';
  }

  private selectBestAgent(content: string, errors: ParseError[], fileType: FileAnalysis['fileType']): string {
    const errorMessages = errors.map(e => e.message.toLowerCase()).join(' ');
    const contentLower = content.toLowerCase();
    
    // Score each agent based on their specialty match
    const scores = this.agents.map(agent => {
      let score = 0;
      
      // Check if agent patterns match file content
      agent.patterns.forEach(pattern => {
        if (contentLower.includes(pattern.toLowerCase())) score += 2;
      });
      
      // Check if agent specialty matches error types
      agent.specialty.forEach(specialty => {
        if (errorMessages.includes(specialty) || contentLower.includes(specialty)) score += 3;
      });
      
      // Bonus for file type match
      if (fileType === 'agent' && agent.name === 'AgentDomainAgent') score += 5;
      
      return { agent: agent.name, score };
    });
    
    // Return the highest scoring agent
    scores.sort((a, b) => b.score - a.score);
    return scores[0].agent;
  }

  // Specialized fix functions for each agent

  private async fixImportsExports(content: string, errors: ParseError[]): Promise<string> {
    let fixed = content;
    
    // Fix missing closing braces in import statements
    fixed = fixed.replace(/import type \{ ([^}]*) from/g, 'import type { $1 } from');
    fixed = fixed.replace(/import \{ ([^}]*) from/g, 'import { $1 } from');
    
    // Fix dotted type imports
    fixed = fixed.replace(/Agent\.Config/g, 'AgentConfig');
    fixed = fixed.replace(/Agent\.Context/g, 'AgentContext');
    fixed = fixed.replace(/Agent\.Response/g, 'AgentResponse');
    fixed = fixed.replace(/PartialAgent\.Response/g, 'PartialAgentResponse');
    
    return fixed;
  }

  private async fixPropertyAccess(content: string, errors: ParseError[]): Promise<string> {
    let fixed = content;
    
    // Fix missing dots in property access
    fixed = fixed.replace(/thisconfig([A-Z])/g, 'this.config.$1');
    fixed = fixed.replace(/thisstrategy([A-Z])/g, 'this.strategy.$1');
    fixed = fixed.replace(/thisevolve([A-Z])/g, 'this.evolve.$1');
    fixed = fixed.replace(/thisencryption([A-Z])/g, 'this.encryption.$1');
    
    // Fix dotted property names
    fixed = fixed.replace(/estimated\.Time/g, 'estimatedTime');
    fixed = fixed.replace(/risk\.Level/g, 'riskLevel');
    fixed = fixed.replace(/accessKey\.Id/g, 'accessKeyId');
    fixed = fixed.replace(/secretAccess\.Key/g, 'secretAccessKey');
    
    return fixed;
  }

  private async fixMethodStructure(content: string, errors: ParseError[]): Promise<string> {
    const lines = content.split('\n');
    const fixedLines: string[] = [];
    let braceBalance = 0;
    let inMethod = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Track method boundaries
      if (trimmed.match(/^(protected|private|public)\s+async.*\{$/)) {
        inMethod = true;
        braceBalance = 1;
        fixedLines.push(line);
        continue;
      }
      
      if (inMethod) {
        // Count braces
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        braceBalance += openBraces - closeBraces;
        
        // If we hit another method declaration while in a method, close the previous one
        if (trimmed.match(/^(protected|private|public)\s+async/) && braceBalance > 0) {
          fixedLines.push('  '.repeat(braceBalance) + '}');
          braceBalance = 1;
        }
        
        if (braceBalance <= 0) {
          inMethod = false;
        }
      }
      
      fixedLines.push(line);
    }
    
    // Close any remaining open methods
    if (inMethod && braceBalance > 0) {
      fixedLines.push('  '.repeat(braceBalance) + '}');
    }
    
    return fixedLines.join('\n');
  }

  private async fixObjectLiterals(content: string, errors: ParseError[]): Promise<string> {
    let fixed = content;
    
    // Fix interface declarations with dots
    fixed = fixed.replace(/interface ([A-Za-z]+)\.([A-Za-z]+)/g, 'interface $1$2');
    
    // Fix semicolons that should be commas in object literals
    fixed = fixed.replace(/;\s*$/gm, ',');
    
    return fixed;
  }

  private async fixAgentDomainCode(content: string, errors: ParseError[]): Promise<string> {
    let fixed = content;
    
    // Fix cognitive capabilities method calls
    fixed = fixed.replace(/this\.cognitiveCapabilities\.set\(\s*$/gm, 'this.cognitiveCapabilities.set(');
    
    // Fix agent context patterns
    fixed = fixed.replace(/AgentContext\s*\)/g, 'AgentContext)');
    
    return fixed;
  }

  async processFilesInParallel(filePaths: string[]): Promise<void> {
    console.log(`🧠 Analyzing ${filePaths.length} files with intelligent agents...`);
    
    // Create backup
    await execAsync(`cp -r src "${this.backupDir}"`);
    console.log(`📁 Backup created at: ${this.backupDir}`);
    
    // Analyze all files
    const analyses = await Promise.all(
      filePaths.map(file => this.analyzeFile(file))
    );
    
    // Group files by recommended agent
    const agentWorkload = new Map<string, FileAnalysis[]>();
    analyses.forEach(analysis => {
      const agent = analysis.agentSpecialty;
      if (!agentWorkload.has(agent)) {
        agentWorkload.set(agent, []);
      }
      agentWorkload.get(agent)!.push(analysis);
    });
    
    console.log('\n📊 Agent Workload Distribution:');
    agentWorkload.forEach((files, agentName) => {
      console.log(`  ${agentName}: ${files.length} files`);
    });
    
    // Process each agent's workload in parallel
    const fixPromises = Array.from(agentWorkload.entries()).map(([agentName, fileAnalyses]) => 
      this.processAgentWorkload(agentName, fileAnalyses)
    );
    
    await Promise.all(fixPromises);
    
    console.log('\n✅ All agents completed their work!');
  }

  private async processAgentWorkload(agentName: string, fileAnalyses: FileAnalysis[]): Promise<void> {
    const agent = this.agents.find(a => a.name === agentName);
    if (!agent) {
      console.warn(`⚠️  Agent ${agentName} not found`);
      return;
    }
    
    console.log(`🤖 ${agentName} processing ${fileAnalyses.length} files...`);
    
    for (const analysis of fileAnalyses) {
      try {
        const content = await fs.readFile(analysis.file, 'utf-8');
        const fixedContent = await agent.fixFunction(content, analysis.errors);
        
        if (fixedContent !== content) {
          await fs.writeFile(analysis.file, fixedContent, 'utf-8');
          console.log(`  ✓ Fixed: ${path.basename(analysis.file)}`);
        } else {
          console.log(`  → No changes: ${path.basename(analysis.file)}`);
        }
      } catch (error) {
        console.error(`  ✗ Error fixing ${analysis.file}:`, error);
      }
    }
    
    console.log(`✅ ${agentName} completed processing`);
  }

  async run(): Promise<void> {
    try {
      // Find all TypeScript files
      const { stdout } = await execAsync('find src -name "*.ts" -type f');
      const files = stdout.trim().split('\n').filter(f => f.length > 0);
      
      console.log(`🔍 Found ${files.length} TypeScript files`);
      
      // Process files with intelligent agents
      await this.processFilesInParallel(files);
      
      // Run validation
      console.log('\n🔍 Running validation...');
      try {
        const { stdout: lintOutput } = await execAsync('npm run lint 2>&1');
        const errorCount = (lintOutput.match(/error/g) || []).length;
        console.log(`📊 Remaining errors: ${errorCount}`);
      } catch (error) {
        const errorCount = ((error as any).stdout?.match(/error/g) || []).length;
        console.log(`📊 Remaining errors: ${errorCount}`);
      }
      
      console.log('\n🎉 Intelligent syntax fixing completed!');
      console.log(`📁 Backup available at: ${this.backupDir}`);
      
    } catch (error) {
      console.error('❌ Error during intelligent fixing:', error);
      throw error;
    }
  }
}

// Run the intelligent fixer
if (require.main === module) {
  const fixer = new IntelligentSyntaxFixer();
  fixer.run().catch(console.error);
}

export { IntelligentSyntaxFixer };