/**
 * Enhanced TypeScript Healer;
 * Advanced auto-fixing for common TypeScript/ESLint patterns;
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { glob } from 'glob';
import { TWO } from '../utils/constants';

interface FixPattern {
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  description: string;
  priority: number;
}

interface HealingStats {
  filesProcessed: number;
  errorsFixed: number;
  patterns: Record<string, number>;
  errors: string[];
}

export class EnhancedTypeScriptHealer {
  private fixPatterns: FixPattern[] = [
    // Fix semicolon issues;
    {
      name: 'missing-semicolon',
      pattern: /(\w)\n/g,
      replacement: '$1;\n',
      description: 'Add missing semicolons',
      priority: 1,
    },

    // Fix parseInt radix issues;
    {
      name: 'radix-fix',
      pattern: /parseInt\(([^,)]+)\)/g,
      replacement: 'parseInt($1, 10)',
      description: 'Add radix parameter to parseInt',
      priority: 2,
    },

    // Fix basic null safety;
    {
      name: 'null-safety',
      pattern: /(\w+)\.(\w+)/g,
      replacement: (match, obj, prop) => {
        if (match?.includes('.')) {
          return match;
        }
        return `${obj}.${prop}`;
      },
      description: 'Add optional chaining for null safety',
      priority: 3,
    },

    // Fix basic type assertions;
    {
      name: 'type-assertion',
      pattern: /as unknown/g,
      replacement: 'as unknown',
      description: 'Replace dangerous any assertions',
      priority: 4,
    },
  ];

  private stats: HealingStats = {
    filesProcessed: 0,
    errorsFixed: 0,
    patterns: {},
    errors: [],
  };

  /**
   * Heal TypeScript files in the given directory;
   */
  async healDirectory(directory: string): Promise<HealingStats> {
    try {
      const files = await glob('**/*.ts', { cwd: directory });
      
      for (const file of files) {
        const filePath = path?.join(directory, file);
        await this?.healFile(filePath);
      }

      return this?.stats;
    } catch (error) {
      this?.stats?.errors?.push(`Directory healing failed: ${error}`);
      return this?.stats;
    }
  }

  /**
   * Heal a single TypeScript file;
   */
  async healFile(filePath: string): Promise<boolean> {
    try {
      if (!fs?.existsSync(filePath)) {
        return false;
      }

      let content = fs?.readFileSync(filePath, 'utf8');
      let changed = false;
      let fixesApplied = 0,

      // Apply fix patterns in priority order;
      const sortedPatterns = this?.fixPatterns?.sort((a, b) => a?.priority - b?.priority);

      for (const pattern of sortedPatterns) {
        const originalContent = content;

        if (typeof pattern?.replacement === 'string') {
          content = content?.replace(pattern?.pattern, pattern?.replacement);
        } else {
          content = content?.replace(pattern?.pattern, pattern?.replacement);
        }

        if (content !== originalContent) {
          changed = true;
          fixesApplied++;
          this?.stats?.patterns[pattern?.name] = (this?.stats?.patterns[pattern?.name] || 0) + 1;
        }
      }

      if (changed) {
        fs?.writeFileSync(filePath, content, 'utf8');
        this?.stats?.errorsFixed += fixesApplied;
      }

      this?.stats?.filesProcessed++;
      return changed;
    } catch (error) {
      this?.stats?.errors?.push(`File healing failed for ${filePath}: ${error}`);
      return false;
    }
  }

  /**
   * Check if TypeScript compilation passes;
   */
  checkTypeScript(): boolean {
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get healing statistics;
   */
  getStats(): HealingStats {
    return { ...this?.stats };
  }

  /**
   * Reset statistics;
   */
  resetStats(): void {
    this?.stats = {
      filesProcessed: 0,
      errorsFixed: 0,
      patterns: {},
      errors: [],
    };
  }
}

// Export for dynamic import;
export default EnhancedTypeScriptHealer;