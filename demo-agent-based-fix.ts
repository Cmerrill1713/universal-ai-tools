#!/usr/bin/env npx tsx

/**
 * Demo: Agent-Based Syntax Fixing
 * Shows how different specialized agents would fix specific types of errors
 */

import { promises as fs } from 'fs';

interface SpecializedAgent {
  name: string;
  expertise: string[];
  analyze: (content: string) => Promise<string[]>;
  fix: (content: string, issues: string[]) => Promise<string>;
}

class ImportExportAgent implements SpecializedAgent {
  name = 'ImportExportAgent';
  expertise = ['import statements', 'export statements', 'type imports', 'module resolution'];

  async analyze(content: string): Promise<string[]> {
    const issues: string[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for missing closing braces in imports
      if (line.includes('import type {') && !line.includes('}') && line.includes('from')) {
        issues.push(`Line ${index + 1}: Missing closing brace in type import`);
      }
      
      // Check for Agent.Config patterns
      if (line.includes('Agent.Config') || line.includes('Agent.Context') || line.includes('Agent.Response')) {
        issues.push(`Line ${index + 1}: Dotted type annotation should be consolidated`);
      }
    });
    
    return issues;
  }

  async fix(content: string, issues: string[]): Promise<string> {
    let fixed = content;
    
    // Fix missing closing braces in import statements
    fixed = fixed.replace(/import type \{ ([^}]*) from/g, 'import type { $1 } from');
    fixed = fixed.replace(/import \{ ([^}]*) from/g, 'import { $1 } from');
    
    // Fix dotted type imports
    fixed = fixed.replace(/Agent\.Config/g, 'AgentConfig');
    fixed = fixed.replace(/Agent\.Context/g, 'AgentContext');
    fixed = fixed.replace(/Agent\.Response/g, 'AgentResponse');
    fixed = fixed.replace(/PartialAgent\.Response/g, 'PartialAgentResponse');
    
    console.log(`✅ ${this.name}: Fixed ${issues.length} import/export issues`);
    return fixed;
  }
}

class PropertyAccessAgent implements SpecializedAgent {
  name = 'PropertyAccessAgent';
  expertise = ['property access', 'method calls', 'object navigation', 'this binding'];

  async analyze(content: string): Promise<string[]> {
    const issues: string[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for missing dots in this.property access
      if (line.match(/this[a-z]+[A-Z]/)) {
        issues.push(`Line ${index + 1}: Missing dot in property access: ${line.trim()}`);
      }
      
      // Check for dotted property names that should be camelCase
      if (line.includes('.Time') || line.includes('.Level') || line.includes('.Key')) {
        issues.push(`Line ${index + 1}: Dotted property name should be camelCase`);
      }
    });
    
    return issues;
  }

  async fix(content: string, issues: string[]): Promise<string> {
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
    
    console.log(`✅ ${this.name}: Fixed ${issues.length} property access issues`);
    return fixed;
  }
}

class MethodStructureAgent implements SpecializedAgent {
  name = 'MethodStructureAgent';
  expertise = ['method signatures', 'brace matching', 'async/await', 'function structure'];

  async analyze(content: string): Promise<string[]> {
    const issues: string[] = [];
    const lines = content.split('\n');
    let braceBalance = 0;
    let inMethod = false;
    let methodStart = -1;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Track method boundaries
      if (trimmed.match(/^(protected|private|public)\s+async.*\{$/)) {
        if (inMethod && braceBalance > 0) {
          issues.push(`Line ${methodStart + 1}-${index + 1}: Previous method not properly closed`);
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
      issues.push(`Line ${methodStart + 1}-EOF: Method not properly closed`);
    }
    
    return issues;
  }

  async fix(content: string, issues: string[]): Promise<string> {
    const lines = content.split('\n');
    const fixedLines: string[] = [];
    let braceBalance = 0;
    let inMethod = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Track method boundaries
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
      fixedLines.push('  '.repeat(braceBalance) + '}');
    }
    
    console.log(`✅ ${this.name}: Fixed ${issues.length} method structure issues`);
    return fixedLines.join('\n');
  }
}

async function demonstrateAgentBasedFix(): Promise<void> {
  console.log('🧠 Agent-Based Syntax Fixing Demo\n');
  
  // Initialize specialized agents
  const agents: SpecializedAgent[] = [
    new ImportExportAgent(),
    new PropertyAccessAgent(), 
    new MethodStructureAgent()
  ];
  
  // Example problematic file content
  const exampleContent = `
import type { Agent.Config, Agent.Context, PartialAgent.Response } from './base_agent';
import type { Agent.Response } from './base_agent';

interface Plan.Step {
  id: string;
  estimated.Time: string;
  risk.Level: 'low' | 'medium' | 'high';
}

export class ExampleAgent {
  protected async selectCapability(context: AgentContext): Promise<unknown> {
    const request = context.userRequest.toLowerCase();
    if (request.includes('test')) {
      return thisconfig.get('testing');
    }
    return null;
    
  protected async generateReasoning(context: AgentContext): Promise<string> {
    return 'example reasoning';
  }
}`;

  console.log('📄 Original problematic content:');
  console.log('─'.repeat(50));
  console.log(exampleContent);
  console.log('─'.repeat(50));
  console.log();

  // Each agent analyzes and fixes their domain
  let currentContent = exampleContent;
  
  for (const agent of agents) {
    console.log(`🤖 ${agent.name} analyzing...`);
    console.log(`   Expertise: ${agent.expertise.join(', ')}`);
    
    const issues = await agent.analyze(currentContent);
    if (issues.length > 0) {
      console.log(`   Found ${issues.length} issues:`);
      issues.forEach(issue => console.log(`     • ${issue}`));
      
      currentContent = await agent.fix(currentContent, issues);
    } else {
      console.log(`   ✓ No issues found in this domain`);
    }
    console.log();
  }
  
  console.log('📄 Final fixed content:');
  console.log('─'.repeat(50));
  console.log(currentContent);
  console.log('─'.repeat(50));
  console.log();
  
  console.log('🎉 Demo completed! This shows how specialized agents can intelligently');
  console.log('   fix different types of syntax errors based on their domain expertise.');
}

// Run the demo
if (require.main === module) {
  demonstrateAgentBasedFix().catch(console.error);
}