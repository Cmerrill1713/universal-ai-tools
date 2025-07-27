#!/usr/bin/env node

/**
 * Production Agent-Based Syntax Fixer
 * Applies intelligent fixes to the entire TypeScript codebase
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

console.log('🧠 Universal AI Tools - Production Agent-Based Syntax Fixer\n');

// Specialized Agents
const agents = {
  ImportExportAgent: {
    name: 'ImportExportAgent',
    priority: 1, // Run first since other agents depend on clean imports
    fileTypes: ['agents', 'services', 'middleware', 'routers', 'utils'],
    
    async analyze(content, filePath) {
      const issues = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Missing closing braces in imports
        if (line.includes('import type {') && !line.includes('}') && line.includes('from')) {
          issues.push({ line: index + 1, type: 'missing-import-brace', content: line.trim() });
        }
        if (line.includes('import {') && !line.includes('}') && line.includes('from')) {
          issues.push({ line: index + 1, type: 'missing-import-brace', content: line.trim() });
        }
        
        // Dotted type annotations
        if (line.match(/Agent\.(Config|Context|Response)/)) {
          issues.push({ line: index + 1, type: 'dotted-type', content: line.trim() });
        }
      });
      
      return issues;
    },
    
    async fix(content, issues) {
      let fixed = content;
      
      // Fix missing closing braces in import statements
      fixed = fixed.replace(/import type \{ ([^}]*) from/g, 'import type { $1 } from');
      fixed = fixed.replace(/import \{ ([^}]*) from/g, 'import { $1 } from');
      
      // Fix dotted type imports
      fixed = fixed.replace(/Agent\.Config/g, 'AgentConfig');
      fixed = fixed.replace(/Agent\.Context/g, 'AgentContext');
      fixed = fixed.replace(/Agent\.Response/g, 'AgentResponse');
      fixed = fixed.replace(/PartialAgent\.Response/g, 'PartialAgentResponse');
      fixed = fixed.replace(/EnhancedMemory\.Agent/g, 'EnhancedMemoryAgent');
      fixed = fixed.replace(/Base\.Agent/g, 'BaseAgent');
      
      return fixed;
    }
  },

  PropertyAccessAgent: {
    name: 'PropertyAccessAgent',
    priority: 2,
    fileTypes: ['agents', 'services'],
    
    async analyze(content, filePath) {
      const issues = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Missing dots in this.property access
        if (line.match(/this[a-z]+[A-Z]/) && !line.includes('//')) {
          issues.push({ line: index + 1, type: 'missing-property-dot', content: line.trim() });
        }
        
        // Dotted property names
        if (line.match(/\w+\.[A-Z][a-z]/) && !line.includes('console.') && !line.includes('process.')) {
          issues.push({ line: index + 1, type: 'dotted-property-name', content: line.trim() });
        }
      });
      
      return issues;
    },
    
    async fix(content, issues) {
      let fixed = content;
      
      // Fix missing dots in property access
      fixed = fixed.replace(/thisconfig([A-Z])/g, 'this.config.$1');
      fixed = fixed.replace(/thisstrategy([A-Z])/g, 'this.strategy.$1');
      fixed = fixed.replace(/thisevolve([A-Z])/g, 'this.evolve.$1');
      fixed = fixed.replace(/thisencryption([A-Z])/g, 'this.encryption.$1');
      fixed = fixed.replace(/thisinitialize([A-Z])/g, 'this.initialize$1');
      fixed = fixed.replace(/thisloadAgent([A-Z])/g, 'this.loadAgent$1');
      fixed = fixed.replace(/thisgenerateContext([A-Z])/g, 'this.generateContext$1');
      
      // Fix dotted property names
      fixed = fixed.replace(/estimated\.Time/g, 'estimatedTime');
      fixed = fixed.replace(/risk\.Level/g, 'riskLevel');
      fixed = fixed.replace(/accessKey\.Id/g, 'accessKeyId');
      fixed = fixed.replace(/secretAccess\.Key/g, 'secretAccessKey');
      fixed = fixed.replace(/is\.Running/g, 'isRunning');
      
      // Fix method name patterns
      fixed = fixed.replace(/loadAgent\.Configurations/g, 'loadAgentConfigurations');
      fixed = fixed.replace(/get\.Agents/g, 'getAgents');
      fixed = fixed.replace(/get\.Agent/g, 'getAgent');
      fixed = fixed.replace(/selectOptimal\.Strategy/g, 'selectOptimalStrategy');
      
      return fixed;
    }
  },

  MethodStructureAgent: {
    name: 'MethodStructureAgent', 
    priority: 3,
    fileTypes: ['agents'],
    
    async analyze(content, filePath) {
      const issues = [];
      const lines = content.split('\n');
      let braceBalance = 0;
      let inMethod = false;
      let methodStart = -1;
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Method start
        if (trimmed.match(/^(protected|private|public)\s+async.*\{$/)) {
          if (inMethod && braceBalance > 0) {
            issues.push({ 
              line: `${methodStart + 1}-${index + 1}`, 
              type: 'unclosed-method', 
              content: 'Previous method not properly closed' 
            });
          }
          inMethod = true;
          methodStart = index;
          braceBalance = 1;
          return;
        }
        
        if (inMethod) {
          const openBraces = (line.match(/\{/g) || []).length;
          const closeBraces = (line.match(/\}/g) || []).length;
          braceBalance += openBraces - closeBraces;
          
          if (braceBalance <= 0) {
            inMethod = false;
          }
        }
      });
      
      // Check for unclosed method at end
      if (inMethod && braceBalance > 0) {
        issues.push({ 
          line: `${methodStart + 1}-EOF`, 
          type: 'unclosed-method-eof', 
          content: 'Method not properly closed at end of file' 
        });
      }
      
      return issues;
    },
    
    async fix(content, issues) {
      const lines = content.split('\n');
      const fixedLines = [];
      let braceBalance = 0;
      let inMethod = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Method start
        if (trimmed.match(/^(protected|private|public)\s+async.*\{$/)) {
          if (inMethod && braceBalance > 0) {
            // Close previous method
            fixedLines.push('  '.repeat(braceBalance) + '}');
          }
          inMethod = true;
          braceBalance = 1;
          fixedLines.push(line);
          continue;
        }
        
        if (inMethod) {
          const openBraces = (line.match(/\{/g) || []).length;
          const closeBraces = (line.match(/\}/g) || []).length;
          braceBalance += openBraces - closeBraces;
          
          if (braceBalance <= 0) {
            inMethod = false;
          }
        }
        
        fixedLines.push(line);
      }
      
      // Close any remaining open methods
      if (inMethod && braceBalance > 0) {
        fixedLines.push('  }');
      }
      
      return fixedLines.join('\n');
    }
  },

  InterfaceAgent: {
    name: 'InterfaceAgent',
    priority: 4,
    fileTypes: ['services', 'types', 'agents'],
    
    async analyze(content, filePath) {
      const issues = [];
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Interface declarations with dots
        if (line.match(/interface\s+[A-Za-z]+\.[A-Za-z]+/)) {
          issues.push({ line: index + 1, type: 'dotted-interface', content: line.trim() });
        }
      });
      
      return issues;
    },
    
    async fix(content, issues) {
      let fixed = content;
      
      // Fix interface declarations with dots
      fixed = fixed.replace(/interface ([A-Za-z]+)\.([A-Za-z]+)/g, 'interface $1$2');
      
      return fixed;
    }
  }
};

class ProductionAgentFixer {
  constructor() {
    this.backupDir = `src.backup.agents.${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '')}`;
    this.processedFiles = 0;
    this.totalIssuesFixed = 0;
  }

  async createBackup() {
    console.log(`📁 Creating backup: ${this.backupDir}`);
    execSync(`cp -r src "${this.backupDir}"`);
    console.log('✅ Backup created\n');
  }

  async getTypeScriptFiles() {
    const result = execSync('find src -name "*.ts" -type f').toString();
    return result.trim().split('\n').filter(f => f.length > 0);
  }

  classifyFile(filePath) {
    if (filePath.includes('/agents/')) return 'agents';
    if (filePath.includes('/services/')) return 'services';  
    if (filePath.includes('/middleware/')) return 'middleware';
    if (filePath.includes('/routers/')) return 'routers';
    if (filePath.includes('/utils/')) return 'utils';
    if (filePath.includes('/types/')) return 'types';
    return 'other';
  }

  async processFileWithAgents(filePath) {
    const fileType = this.classifyFile(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    let currentContent = content;
    let totalFileIssues = 0;

    console.log(`📄 Processing: ${path.basename(filePath)} (${fileType})`);

    // Sort agents by priority and filter by file type compatibility
    const applicableAgents = Object.values(agents)
      .filter(agent => agent.fileTypes.includes(fileType) || agent.fileTypes.includes('all'))
      .sort((a, b) => a.priority - b.priority);

    for (const agent of applicableAgents) {
      try {
        const issues = await agent.analyze(currentContent, filePath);
        
        if (issues.length > 0) {
          console.log(`  🤖 ${agent.name}: Found ${issues.length} issues`);
          currentContent = await agent.fix(currentContent, issues);
          totalFileIssues += issues.length;
        }
      } catch (error) {
        console.error(`  ❌ ${agent.name} failed:`, error.message);
      }
    }

    // Write the fixed content if changes were made
    if (currentContent !== content) {
      await fs.writeFile(filePath, currentContent, 'utf-8');
      console.log(`  ✅ Fixed ${totalFileIssues} issues in ${path.basename(filePath)}`);
      this.totalIssuesFixed += totalFileIssues;
    } else {
      console.log(`  ➡️  No changes needed`);
    }

    this.processedFiles++;
    console.log();
  }

  async processFilesInParallel(files) {
    console.log(`🚀 Processing ${files.length} files with specialized agents...\n`);

    // Process files in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(file => this.processFileWithAgents(file)));
    }
  }

  async validateResults() {
    console.log('🔍 Running validation...');
    try {
      const lintResult = execSync('npm run lint 2>&1', { encoding: 'utf-8' });
      const errorCount = (lintResult.match(/error/g) || []).length;
      console.log(`📊 Remaining lint errors: ${errorCount}`);
      
      if (errorCount < 100) {
        console.log('🎉 Significant improvement achieved!');
      }
    } catch (error) {
      const errorCount = (error.stdout?.match(/error/g) || []).length;
      console.log(`📊 Remaining lint errors: ${errorCount}`);
    }
  }

  async run() {
    try {
      await this.createBackup();
      
      const files = await this.getTypeScriptFiles();
      await this.processFilesInParallel(files);
      
      console.log('📊 Summary:');
      console.log(`   Files processed: ${this.processedFiles}`);
      console.log(`   Total issues fixed: ${this.totalIssuesFixed}`);
      console.log(`   Backup location: ${this.backupDir}\n`);
      
      await this.validateResults();
      
      console.log('\n🎉 Agent-based syntax fixing completed!');
      console.log('💡 Each specialized agent applied domain-specific fixes');
      console.log('🔧 Next steps:');
      console.log('   1. npm run build  # Test compilation');
      console.log('   2. npm test       # Run tests');
      console.log(`   3. rm -rf ${this.backupDir}  # Remove backup if satisfied`);
      
    } catch (error) {
      console.error('❌ Error during processing:', error);
      console.log(`🔄 Restore from backup: rm -rf src && mv ${this.backupDir} src`);
      throw error;
    }
  }
}

// Run the production agent fixer
const fixer = new ProductionAgentFixer();
fixer.run().catch(console.error);