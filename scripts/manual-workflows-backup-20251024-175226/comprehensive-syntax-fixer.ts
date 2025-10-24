#!/usr/bin/env tsx

/**
 * Comprehensive TypeScript Syntax Fixer
 * 
 * This script systematically fixes the 12,002+ TypeScript syntax errors
 * by analyzing patterns and applying targeted fixes.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

interface ErrorPattern {
  code: string;
  pattern: RegExp;
  fix: (content: string, match: RegExpMatchArray) => string;
  description: string;
}

interface FileStats {
  file: string;
  errorsBefore: number;
  errorsAfter: number;
  linesFixed: number;
}

class ComprehensiveSyntaxFixer {
  private srcDir = '/Users/christianmerrill/Desktop/universal-ai-tools/src';
  private backupDir = '/Users/christianmerrill/Desktop/universal-ai-tools/backups';
  private stats: FileStats[] = [];

  private errorPatterns: ErrorPattern[] = [
    // TS1002: Unterminated string literals
    {
      code: 'TS1002',
      pattern: /(['"`])([^'"`\n]*?)$/gm,
      fix: (content: string, match: RegExpMatchArray) => {
        const quote = match[1];
        return content.replace(match[0], `${quote}${match[2]}${quote}`);
      },
      description: 'Fix unterminated string literals'
    },

    // TS1005: Missing semicolons
    {
      code: 'TS1005',
      pattern: /^(\s*)(.*[^;{}\s])\s*$/gm,
      fix: (content: string) => {
        return content.replace(/^(\s*)((?:const|let|var|import|export|return|throw|break|continue|type|interface|class|function)\s+[^;{}\n]*[^;{}\s])\s*$/gm, '$1$2;');
      },
      description: 'Add missing semicolons'
    },

    // TS1128: Missing braces for blocks
    {
      code: 'TS1128',
      pattern: /(if|else|for|while|try|catch|finally)\s*\([^)]*\)\s*([^{].*?)(?=\n)/g,
      fix: (content: string, match: RegExpMatchArray) => {
        return content.replace(match[0], `${match[1]}(${match[0].match(/\(([^)]*)\)/)?.[1] || ''}) { ${match[2].trim()}; }`);
      },
      description: 'Add missing braces for control structures'
    },

    // TS1109: Fix malformed expressions
    {
      code: 'TS1109',
      pattern: /(\w+)\s*\.\s*$/gm,
      fix: (content: string, match: RegExpMatchArray) => {
        return content.replace(match[0], `${match[1]}`);
      },
      description: 'Fix incomplete member access expressions'
    },

    // TS1136: Fix object property assignments
    {
      code: 'TS1136',
      pattern: /{\s*(\w+)\s*(?![:])/g,
      fix: (content: string, match: RegExpMatchArray) => {
        return content.replace(match[0], `{ ${match[1]}: ${match[1]} }`);
      },
      description: 'Fix object property shorthand syntax'
    },

    // TS1434: Fix unexpected keywords
    {
      code: 'TS1434',
      pattern: /(async|await)\s+(async|await)/g,
      fix: (content: string, match: RegExpMatchArray) => {
        return content.replace(match[0], match[1]);
      },
      description: 'Remove duplicate async/await keywords'
    }
  ];

  async run(): Promise<void> {
    console.log('🔧 Starting Comprehensive TypeScript Syntax Fixer...\n');
    
    // Create backup
    this.createBackup();
    
    // Get initial error count
    const initialErrors = this.getErrorCount();
    console.log(`📊 Initial error count: ${initialErrors.toLocaleString()}\n`);

    // Process all TypeScript files
    const tsFiles = this.findTypeScriptFiles();
    console.log(`📁 Found ${tsFiles.length} TypeScript files to process\n`);

    // Process files by priority
    const criticalFiles = this.prioritizeFiles(tsFiles);
    
    for (const file of criticalFiles) {
      await this.processFile(file);
    }

    // Final validation
    const finalErrors = this.getErrorCount();
    
    this.printReport(initialErrors, finalErrors);
  }

  private createBackup(): void {
    console.log('💾 Creating backup...');
    try {
      execSync(`mkdir -p ${this.backupDir}`);
      execSync(`cp -r ${this.srcDir} ${this.backupDir}/src-backup-${Date.now()}`);
      console.log('✅ Backup created successfully\n');
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      process.exit(1);
    }
  }

  private getErrorCount(): number {
    try {
      const output = execSync('npx tsc --noEmit 2>&1 || true', { 
        cwd: '/Users/christianmerrill/Desktop/universal-ai-tools',
        encoding: 'utf8' 
      });
      const errors = output.split('\n').filter(line => line.includes('error TS'));
      return errors.length;
    } catch {
      return 0;
    }
  }

  private findTypeScriptFiles(): string[] {
    const files: string[] = [];
    
    const walk = (dir: string) => {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walk(fullPath);
        } else if (stat.isFile() && (extname(item) === '.ts' || extname(item) === '.tsx')) {
          files.push(fullPath);
        }
      }
    };
    
    walk(this.srcDir);
    return files;
  }

  private prioritizeFiles(files: string[]): string[] {
    // Priority order: server files, core services, agents, then everything else
    const priority = [
      'server.ts',
      'config/',
      'services/',
      'agents/',
      'routers/',
      'middleware/',
      'utils/',
      'types/',
      'scripts/'
    ];

    return files.sort((a, b) => {
      const aScore = this.getFilePriority(a, priority);
      const bScore = this.getFilePriority(b, priority);
      return aScore - bScore;
    });
  }

  private getFilePriority(file: string, priority: string[]): number {
    for (let i = 0; i < priority.length; i++) {
      if (file.includes(priority[i])) {
        return i;
      }
    }
    return priority.length;
  }

  private async processFile(filePath: string): Promise<void> {
    const relativePath = filePath.replace('/Users/christianmerrill/Desktop/universal-ai-tools/', '');
    console.log(`🔨 Processing: ${relativePath}`);

    try {
      let content = readFileSync(filePath, 'utf8');
      const originalContent = content;
      let linesFixed = 0;

      // Apply each error pattern fix
      for (const pattern of this.errorPatterns) {
        const beforeLength = content.length;
        content = this.applyPattern(content, pattern);
        if (content.length !== beforeLength) {
          linesFixed++;
        }
      }

      // Additional specific fixes for common patterns
      content = this.applySpecificFixes(content);

      // Only write if content changed
      if (content !== originalContent) {
        writeFileSync(filePath, content, 'utf8');
        console.log(`   ✅ Fixed ${linesFixed} patterns`);
      } else {
        console.log(`   ⚪ No changes needed`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${relativePath}:`, error);
    }
  }

  private applyPattern(content: string, pattern: ErrorPattern): string {
    try {
      if (typeof pattern.fix === 'function') {
        const matches = content.match(pattern.pattern);
        if (matches) {
          for (const match of matches) {
            const matchArray = pattern.pattern.exec(content);
            if (matchArray) {
              content = pattern.fix(content, matchArray);
            }
          }
        }
      }
      return content;
    } catch (error) {
      console.error(`   ⚠️  Pattern ${pattern.code} failed:`, error);
      return content;
    }
  }

  private applySpecificFixes(content: string): string {
    // Fix common TypeScript syntax issues specific to this codebase
    
    // Fix export statements
    content = content.replace(/^(\s*)export\s*$/, '$1export default');
    
    // Fix import statements
    content = content.replace(/^(\s*)import\s+(.+?)\s*$/, '$1import $2;');
    
    // Fix function declarations
    content = content.replace(/^(\s*)function\s+(\w+)\s*\([^)]*\)\s*([^{].*?)$/gm, '$1function $2() { $3; }');
    
    // Fix interface declarations
    content = content.replace(/^(\s*)interface\s+(\w+)\s*$/gm, '$1interface $2 {}');
    
    // Fix type declarations
    content = content.replace(/^(\s*)type\s+(\w+)\s*$/gm, '$1type $2 = any;');
    
    // Fix class declarations
    content = content.replace(/^(\s*)class\s+(\w+)\s*$/gm, '$1class $2 {}');
    
    // Fix async function calls
    content = content.replace(/\bawait\s+async\s+/g, 'await ');
    
    // Fix object destructuring
    content = content.replace(/{\s*(\w+)\s*}\s*=/g, '{ $1 } =');
    
    // Fix array destructuring
    content = content.replace(/\[\s*(\w+)\s*\]\s*=/g, '[ $1 ] =');
    
    return content;
  }

  private printReport(initialErrors: number, finalErrors: number): void {
    const fixed = initialErrors - finalErrors;
    const percentage = initialErrors > 0 ? ((fixed / initialErrors) * 100).toFixed(1) : '0';
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE SYNTAX FIXER REPORT');
    console.log('='.repeat(60));
    console.log(`Initial errors:    ${initialErrors.toLocaleString()}`);
    console.log(`Final errors:      ${finalErrors.toLocaleString()}`);
    console.log(`Errors fixed:      ${fixed.toLocaleString()}`);
    console.log(`Success rate:      ${percentage}%`);
    console.log('='.repeat(60));
    
    if (finalErrors > 0) {
      console.log('\n🔍 Remaining errors need manual review:');
      try {
        const output = execSync('npx tsc --noEmit 2>&1 | head -20 || true', { 
          cwd: '/Users/christianmerrill/Desktop/universal-ai-tools',
          encoding: 'utf8' 
        });
        console.log(output);
      } catch (error) {
        console.error('Could not get remaining errors:', error);
      }
    } else {
      console.log('\n🎉 ALL TYPESCRIPT ERRORS FIXED! 🎉');
    }
  }
}

// Run the fixer if called directly
if (require.main === module) {
  const fixer = new ComprehensiveSyntaxFixer();
  fixer.run().catch(console.error);
}

export { ComprehensiveSyntaxFixer };