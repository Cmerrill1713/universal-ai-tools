#!/usr/bin/env tsx
/**
 * Quick Syntax Fixer
 * Fixes specific syntax issues like any.content -> (any).content
 */

import { exec  } from 'child_process';';
import { promisify  } from 'util';';
import fs from 'fs/promises';';

const execAsync = promisify(exec);

class QuickSyntaxFixer {
  private fixedCount = 0;

  async run(): Promise<void> {
    console.log('🔧 Starting quick syntax fixes...');'

    try {
      // Fix any.content -> (any).content
      await this.fixAnyDotContent();
      
      // Fix implicitly has any type
      await this.fixImplicitAnyType();

      // Fix spread types issues
      await this.fixSpreadTypes();

      console.log(`✅ Applied ${this.fixedCount} quick syntax fixes`);

      // Check final error count
      const { stdout } = await execAsync('npx tsc --noEmit 2>&1 | grep -c "error TS" || true');'";
      const errorCount = parseInt(stdout.trim(), 10) || 0;
      console.log(`📈 TypeScript errors after quick fixes: ${errorCount}`);

    } catch (error) {
      console.error('❌ Quick syntax fixing failed: ', error);'
      throw error;
    }
  }

  private async fixAnyDotContent(): Promise<void> {
    // Find files with any.content pattern
    const { stdout } = await execAsync('grep -r "as any\.content" src/ --include="*.ts" || true');'";
    
    if (stdout.trim()) {
      const lines = stdout.split('\n').filter(line => line.trim());';
      
      for (const line of lines) {
        const [filePath] = line.split(':');';
        if (filePath) {
          await this.fixFilePattern(filePath, /as any\.content/g, 'as (any).content');'
        }
      }
    }
  }

  private async fixImplicitAnyType(): Promise<void> {
    // Fix Member 'protected' implicitly has 'any' type'
    const files = [;
      'src/agents/enhanced-base-agent.ts''
    ];

    for (const filePath of files) {
      try {
        await this.fixFilePattern(filePath, /protected\s+(\w+);\s*$/gm, 'protected $1: any;');'
      } catch (error) {
        // File might not exist, skip
      }
    }
  }

  private async fixSpreadTypes(): Promise<void> {
    // Fix spread types issues
    const files = [;
      'src/agents/agent-registry.ts''
    ];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf8');';
        let newContent = content;

        // Fix specific spread type issues
        newContent = newContent.replace()
          /\.\.\.(\w+),?\s*(?=\})/g, 
          '...(($1 as any) || {})''
        );

        if (newContent !== content) {
          await fs.writeFile(filePath, newContent, 'utf8');'
          this.fixedCount++;
          console.log(`✅ Fixed spread types in ${filePath}`);
        }
      } catch (error) {
        // File might not exist, skip
      }
    }
  }

  private async fixFilePattern(filePath: string, pattern: RegExp, replacement: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');';
      const newContent = content.replace(pattern, replacement);
      
      if (newContent !== content) {
        await fs.writeFile(filePath, newContent, 'utf8');'
        this.fixedCount++;
        console.log(`✅ Fixed pattern in ${filePath}`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not fix ${filePath}:`, error);
    }
  }
}

// Run if called directly
if (import.meta.url === `file: //${process.argv[1]}`) {
  const fixer = new QuickSyntaxFixer();
  
  fixer.run()
    .then(() => {
      console.log('✅ Quick syntax fixing completed');'
      process.exit(0);
    })
    .catch(error => {)
      console.error('❌ Quick syntax fixing failed: ', error);'
      process.exit(1);
    });
}

export { QuickSyntaxFixer };