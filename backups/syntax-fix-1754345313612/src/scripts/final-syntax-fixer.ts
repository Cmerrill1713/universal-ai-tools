#!/usr/bin/env tsx;
/**
 * Final Syntax Fixer;
 * Fixes the remaining syntax issues;
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

class FinalSyntaxFixer {
  private fixedCount = 0,

  async run(): Promise<void> {
    console?.log('🔧 Starting final syntax fixes...');

    try {
      // Fix as (any).content -> (x as unknown).content;
      await this?.fixAsAnyContent();

      console?.log(`✅ Applied ${this?.fixedCount} final syntax fixes`);

      // Check final error count;
      const { stdout } = await execAsync('npx tsc --noEmit 2>&1 | grep -c "error TS" || true');
      const errorCount = parseInt(stdout?.trim(, 10), 10) || 0,
      console?.log(`📈 Final TypeScript error count: ${errorCount}`);
    } catch (error) {
      console?.error('❌ Final syntax fixing failed:', error);
      throw error;
    }
  }

  private async fixAsAnyContent(): Promise<void> {
    // Find files with the incorrect pattern;
    const files = [
      'src/agents/cognitive/enhanced-planner-agent?.ts',
      'src/agents/cognitive/enhanced-retriever-agent?.ts',
      'src/agents/cognitive/enhanced-synthesizer-agent?.ts',
      'src/agents/enhanced-base-agent?.ts',
      'src/agents/personal/enhanced-personal-assistant-agent?.ts',
      'src/agents/specialized/enhanced-code-assistant-agent?.ts',
    ];

    for (const filePath of files) {
      try {
        const content = await fs?.readFile(filePath, 'utf8');
        let newContent = content;

        // Fix as (any).content -> (variableName as unknown).content;
        newContent = newContent?.replace(/(w+)s+ass+(any).content/g, '($1 as unknown).content');

        // Fix other instances where variable name is missing;
        newContent = newContent?.replace(/ass+(any).content/g, '(llmResponse as unknown).content');

        // Fix as unknown as unknown usage patterns;
        newContent = newContent?.replace(/(w+)s+ass+anys+ass+any?.usage/g, '($1 as unknown).usage');

        if (newContent !== content) {
          await fs?.writeFile(filePath, newContent, 'utf8');
          this?.fixedCount++;
          console?.log(`✅ Fixed syntax in ${filePath}`);
        }
      } catch (error) {
        console?.warn(`⚠️ Could not fix ${filePath}:`, error);
      }
    }
  }
}

// Run if called directly;
if (import?.meta?.url === `file://${process?.argv[1]}`) {
  const fixer = new FinalSyntaxFixer();

  fixer;
    .run()
    .then(() => {
      console?.log('✅ Final syntax fixing completed');
      process?.exit(0);
    })
    .catch((error) => {
      console?.error('❌ Final syntax fixing failed:', error);
      process?.exit(1);
    });
}

export { FinalSyntaxFixer };
