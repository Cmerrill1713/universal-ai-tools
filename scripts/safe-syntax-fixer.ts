#!/usr/bin/env tsx

/**
 * Safe TypeScript Syntax Fixer
 * 
 * This script takes a careful, incremental approach to fixing TypeScript syntax errors.
 * It validates each change before applying it and can rollback if issues occur.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, basename } from 'path';

interface FixAttempt {
  file: string;
  originalContent: string;
  fixedContent: string;
  errorsBefore: number;
  errorsAfter: number;
  success: boolean;
}

class SafeSyntaxFixer {
  private workingDir = '/Users/christianmerrill/Desktop/universal-ai-tools';
  private backupDir = '/Users/christianmerrill/Desktop/universal-ai-tools/syntax-backups';
  private logFile = '/Users/christianmerrill/Desktop/universal-ai-tools/syntax-fix-log.json';
  private fixAttempts: FixAttempt[] = [];

  async run(): Promise<void> {
    console.log('🛡️  Safe TypeScript Syntax Fixer Starting...\n');
    
    // Create backup directory
    this.ensureBackupDir();
    
    // Get initial error count
    const initialErrors = this.getErrorCount();
    console.log(`📊 Initial error count: ${initialErrors.toLocaleString()}\n`);

    if (initialErrors === 0) {
      console.log('🎉 No TypeScript errors found!');
      return;
    }

    // Test our fix functions with a single file first
    await this.testFixFunctions();
    
    // If tests pass, continue with systematic fixing
    console.log('\n🚀 Starting systematic fixing process...\n');
    await this.systematicFix();
    
    // Generate report
    this.generateReport(initialErrors);
  }

  private ensureBackupDir(): void {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
    console.log(`💾 Backup directory: ${this.backupDir}`);
  }

  private getErrorCount(): number {
    try {
      const output = execSync('npx tsc --noEmit 2>&1 || true', { 
        cwd: this.workingDir,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large error output
      });
      const errors = output.split('\n').filter(line => line.includes('error TS'));
      console.log(`Debug: Found ${errors.length} error lines in output`);
      return errors.length;
    } catch (error) {
      console.log('Debug: Error in getErrorCount:', error);
      return 0;
    }
  }

  private getFileErrors(filePath: string): number {
    try {
      const relativePath = filePath.replace(this.workingDir + '/', '');
      const output = execSync('npx tsc --noEmit 2>&1 || true', { 
        cwd: this.workingDir,
        encoding: 'utf8' 
      });
      const errors = output.split('\n').filter(line => 
        line.includes('error TS') && line.includes(relativePath)
      );
      return errors.length;
    } catch {
      return 0;
    }
  }

  private async testFixFunctions(): Promise<void> {
    console.log('🧪 Testing fix functions with a single file...');
    
    // Find a file with moderate errors to test on
    const testFile = '/Users/christianmerrill/Desktop/universal-ai-tools/src/agents/agent-registry.ts';
    
    if (!existsSync(testFile)) {
      console.log('❌ Test file not found, skipping test');
      return;
    }

    const originalContent = readFileSync(testFile, 'utf8');
    const originalErrors = this.getFileErrors(testFile);
    
    console.log(`   📄 Test file: ${basename(testFile)}`);
    console.log(`   📊 Original errors: ${originalErrors}`);
    
    // Apply fixes
    const fixedContent = this.applyBasicFixes(originalContent);
    
    // Test the fix
    const backupPath = `${this.backupDir}/${basename(testFile)}.backup`;
    writeFileSync(backupPath, originalContent);
    writeFileSync(testFile, fixedContent);
    
    const newErrors = this.getFileErrors(testFile);
    console.log(`   📊 Errors after fix: ${newErrors}`);
    
    if (newErrors <= originalErrors) {
      console.log('   ✅ Fix function test passed');
    } else {
      console.log('   ❌ Fix function test failed - reverting');
      writeFileSync(testFile, originalContent);
      throw new Error('Fix functions are making things worse - aborting');
    }
  }

  private applyBasicFixes(content: string): string {
    let fixed = content;

    // Fix 1: Remove duplicate semicolons
    fixed = fixed.replace(/;;+/g, ';');

    // Fix 2: Fix unterminated strings (simple cases)
    fixed = fixed.replace(/(['"`])([^'"`\n]*?)$/gm, '$1$2$1');

    // Fix 3: Add missing semicolons to simple statements
    fixed = fixed.replace(/^(\s*)(const|let|var|import|export|return|throw|break|continue)\s+([^;{}\n]*[^;{}\s])\s*$/gm, '$1$2 $3;');

    // Fix 4: Fix object property syntax
    fixed = fixed.replace(/{\s*(\w+)\s*(?![:])/g, '{ $1: $1 }');

    // Fix 5: Fix incomplete member access
    fixed = fixed.replace(/(\w+)\s*\.\s*;/g, '$1;');

    // Fix 6: Fix duplicate async/await
    fixed = fixed.replace(/(async|await)\s+(async|await)/g, '$1');

    // Fix 7: Basic brace balancing for simple cases
    const lines = fixed.split('\n');
    const fixedLines = lines.map(line => {
      // Fix missing opening braces for if/else/for/while
      if (/^\s*(if|else|for|while|try|catch|finally)\s*\([^)]*\)\s*[^{].*[^{]\s*$/.test(line)) {
        return line.replace(/^(\s*)(if|else|for|while|try|catch|finally)(\s*\([^)]*\)\s*)([^{].*)$/, '$1$2$3{ $4; }');
      }
      return line;
    });
    
    return fixedLines.join('\n');
  }

  private async systematicFix(): Promise<void> {
    // Get list of files with most errors first
    const files = this.getFilesWithErrors();
    
    console.log(`🎯 Found ${files.length} files with TypeScript errors`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`\n📝 Processing ${i + 1}/${files.length}: ${basename(file.path)}`);
      console.log(`   📊 Errors: ${file.errorCount}`);
      
      await this.fixFile(file.path);
      
      // Check progress every 10 files
      if ((i + 1) % 10 === 0) {
        const currentErrors = this.getErrorCount();
        console.log(`\n📈 Progress check: ${currentErrors.toLocaleString()} errors remaining`);
      }
    }
  }

  private getFilesWithErrors(): Array<{ path: string; errorCount: number }> {
    try {
      const output = execSync('npx tsc --noEmit 2>&1 || true', { 
        cwd: this.workingDir,
        encoding: 'utf8' 
      });
      
      const errorLines = output.split('\n').filter(line => line.includes('error TS'));
      const fileErrors: { [key: string]: number } = {};
      
      for (const line of errorLines) {
        const match = line.match(/^([^(]+)\(/);
        if (match) {
          const filePath = `${this.workingDir}/${match[1]}`;
          fileErrors[filePath] = (fileErrors[filePath] || 0) + 1;
        }
      }
      
      return Object.entries(fileErrors)
        .map(([path, errorCount]) => ({ path, errorCount }))
        .sort((a, b) => b.errorCount - a.errorCount);
    } catch {
      return [];
    }
  }

  private async fixFile(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      console.log(`   ⚠️  File not found: ${filePath}`);
      return;
    }

    const originalContent = readFileSync(filePath, 'utf8');
    const errorsBefore = this.getFileErrors(filePath);

    // Create backup
    const backupPath = `${this.backupDir}/${basename(filePath)}.${Date.now()}.backup`;
    writeFileSync(backupPath, originalContent);

    // Apply fixes
    const fixedContent = this.applyBasicFixes(originalContent);

    if (fixedContent === originalContent) {
      console.log('   ⚪ No changes needed');
      return;
    }

    // Write fixed content
    writeFileSync(filePath, fixedContent);

    // Check if fix improved things
    const errorsAfter = this.getFileErrors(filePath);

    const attempt: FixAttempt = {
      file: filePath,
      originalContent,
      fixedContent,
      errorsBefore,
      errorsAfter,
      success: errorsAfter <= errorsBefore
    };

    this.fixAttempts.push(attempt);

    if (attempt.success) {
      const improvement = errorsBefore - errorsAfter;
      console.log(`   ✅ Fixed ${improvement} errors (${errorsBefore} → ${errorsAfter})`);
    } else {
      console.log(`   ❌ Fix made things worse (${errorsBefore} → ${errorsAfter}) - reverting`);
      writeFileSync(filePath, originalContent);
    }
  }

  private generateReport(initialErrors: number): void {
    const finalErrors = this.getErrorCount();
    const totalFixed = initialErrors - finalErrors;
    const successfulAttempts = this.fixAttempts.filter(a => a.success).length;

    const report = {
      timestamp: new Date().toISOString(),
      initialErrors,
      finalErrors,
      totalFixed,
      successRate: ((totalFixed / initialErrors) * 100).toFixed(1),
      filesProcessed: this.fixAttempts.length,
      successfulFixes: successfulAttempts,
      failedFixes: this.fixAttempts.length - successfulAttempts,
      attempts: this.fixAttempts.map(a => ({
        file: basename(a.file),
        errorsBefore: a.errorsBefore,
        errorsAfter: a.errorsAfter,
        improvement: a.errorsBefore - a.errorsAfter,
        success: a.success
      }))
    };

    writeFileSync(this.logFile, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('📊 SAFE SYNTAX FIXER REPORT');
    console.log('='.repeat(60));
    console.log(`Initial errors:     ${initialErrors.toLocaleString()}`);
    console.log(`Final errors:       ${finalErrors.toLocaleString()}`);
    console.log(`Errors fixed:       ${totalFixed.toLocaleString()}`);
    console.log(`Success rate:       ${report.successRate}%`);
    console.log(`Files processed:    ${report.filesProcessed}`);
    console.log(`Successful fixes:   ${successfulAttempts}`);
    console.log(`Failed fixes:       ${report.failedFixes}`);
    console.log(`Report saved:       ${this.logFile}`);
    console.log('='.repeat(60));

    if (finalErrors > 0) {
      console.log('\n🔍 Top remaining error types:');
      this.showTopErrors();
    } else {
      console.log('\n🎉 ALL ERRORS FIXED! 🎉');
    }
  }

  private showTopErrors(): void {
    try {
      const output = execSync('npx tsc --noEmit 2>&1 | head -10 || true', { 
        cwd: this.workingDir,
        encoding: 'utf8' 
      });
      console.log(output);
    } catch (error) {
      console.error('Could not get remaining errors:', error);
    }
  }
}

// Run the fixer if called directly
const fixer = new SafeSyntaxFixer();
fixer.run().catch(console.error);

export { SafeSyntaxFixer };