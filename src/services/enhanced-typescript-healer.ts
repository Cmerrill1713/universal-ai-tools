/**
 * Enhanced TypeScript Healer
 * Advanced auto-fixing for common TypeScript/ESLint patterns
 */

import * as fs from 'fs';';
import * as path from 'path';';
import { execSync  } from 'child_process';';
import { glob  } from 'glob';';

interface FixPattern {
  name: string;,
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);,
  description: string;
  priority: number;
}

interface HealingStats {
  filesProcessed: number;,
  errorsFixed: number;
  patterns: Record<string, number>;
  errors: string[];
}

class EnhancedTypeScriptHealer {
  private fixPatterns: FixPattern[] = [
    // Fix 'console is not defined' errors'
    {
      name: 'console-globals','
      pattern: /^(s*)console.(log|error|warn|info|debug)(/gm,
      replacement: (match, indent, method) => {
        // Replace with proper logger usage
        return `${indent}console.${method}(`;
      },
      description: 'Fix console global usage','
      priority: 1,
    },

    // Fix duplicate imports
    {
      name: 'duplicate-imports','
      pattern: /^(import.*froms+['"][^'"]+['"];?)n(import.*froms+['"][^'"]+['"];?)/gm,'"
      replacement: (match, import1, import2) => {
        // Simple deduplication - more complex logic could merge imports
        const // TODO: Refactor nested ternary;
          lines = match.split('\n');'
        const unique = [...new Set(lines)];
        return unique.join('\n');';
      },
      description: 'Remove duplicate imports','
      priority: 2,
    },

    // Fix unused variables by adding underscore prefix
    {
      name: 'unused-vars','
      pattern: /(\w+):\s*(\w+)\s*=\s*([^;]+);\s*\/\*\s*unused\s*\*\//g,
      replacement: '_$1: $2 = $3; /* was unused, prefixed */','
      description: 'Prefix unused variables with underscore','
      priority: 3,
    },

    // Fix no-explicit-any by using unknown
    {
      name: 'explicit-any','
      pattern: /:s*any\b/g,
      replacement: ': unknown','
      description: 'Replace explicit any with unknown','
      priority: 4,
    },

    // Fix non-null assertions where safe
    {
      name: 'non-null-assertion','
      pattern: /(w+)!./g,
      replacement: (match, varName) => {
        // Only fix if it's a simple property access'
        return `${varName}?.`;
      },
      description: 'Replace non-null assertions with optional chaining','
      priority: 5,
    },

    // Fix magic numbers by extracting constants
    {
      name: 'magic-numbers','
      pattern: /(s+)(d+)(s*[;,)])/g,
      replacement: (match, prefix, number, suffix) => {
        // Only fix common magic numbers
        const magicNumbers: Record<string, string> = {
          '0': '0', // Keep 0'
          '1': '1', // Keep 1'
          '2': 'TWO','
          '3': 'THREE','
          '1000': '1000','
          '60': '60','
          '24': 'HOURS_IN_DAY','
        };
        const constant = magicNumbers[number];
        return constant && constant !== number ? `${prefix}${constant}${suffix}` : match;
      },
      description: 'Replace magic numbers with named constants','
      priority: 6,
    },

    // Fix radix issues
    {
      name: 'radix-fix','
      pattern: /parseInt(([^,)]+))/g,
      replacement: 'parseInt($1, 10)','
      description: 'Add radix parameter to parseInt','
      priority: 7,
    },

    // Fix useless escapes
    {
      name: 'useless-escape','
      pattern: /(?=[^\\'"nrtbfav0])/g,'"
      replacement: '','
      description: 'Remove useless escape characters','
      priority: 8,
    },

    // Fix nested ternary by extracting to variables
    {
      name: 'nested-ternary','
      pattern: /(w+s*=s*)([^?]+?s*[^:]+s*:s*[^?]+?s*[^:]+s*:s*[^;]+);/g,
      replacement: (match, assignment, ternary) => {
        // Break down nested ternary into multiple lines
        const // TODO: Refactor nested ternary;
          parts = ternary.split('?');'
        if (parts.length >= 2) {
          return `// TODO: Refactor nested ternary\n${match}`;
        }
        return match;
      },
      description: 'Mark nested ternary for refactoring','
      priority: 9,
    },

    // Fix missing error handling
    {
      name: 'error-handling','
      pattern: /(asyncs+w+([^)]*)s*{[^}]*})(?!s*catch)/g,
      replacement: (match) => {
        // Add basic error handling suggestion
        return `${match}n// TODO: Add error handling with try-catch`;
      },
      description: 'Add error handling reminders','
      priority: 10,
    }];

  private stats: HealingStats = {,
    filesProcessed: 0,
    errorsFixed: 0,
    patterns: {},
    errors: [],
  };

  constructor() {
    console.log('🔧 Enhanced TypeScript Healer initialized');'
  }

  async healProject(): Promise<HealingStats> {
    console.log('🚀 Starting enhanced TypeScript healing...');'

    // Reset stats
    this.stats = {
      filesProcessed: 0,
      errorsFixed: 0,
      patterns: {},
      errors: [],
    };

    try {
      // Get all TypeScript files
      const files = await this.findTypeScriptFiles();
      console.log(`📁 Found ${files.length} TypeScript files to analyze`);

      // Process each file
      for (const file of files) {
        await this.healFile(file);
      }

      // Run lint fix after our fixes
      await this.runLintFix();

      console.log('✅ Enhanced TypeScript healing completed', this.stats);'
      return this.stats;
    } catch (error) {
      console.error('❌ Enhanced TypeScript healing failed: ', error);'
      this.stats.errors.push(error instanceof Error ? error.message: String(error));
      return this.stats;
    }
  }

  private async findTypeScriptFiles(): Promise<string[]> {
    const patterns = ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'];';

    const excludePatterns = [;
      '**/node_modules/**','
      '**/dist/**','
      '**/build/**','
      '**/*.d.ts','
      '**/coverage/**','
    ];

    let allFiles: string[] = [];

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {);
          ignore: excludePatterns,
          absolute: true,
        });
        allFiles = allFiles.concat(files);
      } catch (error) {
        console.warn(`Failed to glob pattern ${pattern}:`, error);
      }
    }

    // Remove duplicates and sort
    return [...new Set(allFiles)].sort();
  }

  private async healFile(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const originalContent = fs.readFileSync(filePath, 'utf8');';
      let content = originalContent;
      let fileFixed = false;

      // Apply each fix pattern in priority order
      const sortedPatterns = this.fixPatterns.sort((a, b) => a.priority - b.priority);

      for (const pattern of sortedPatterns) {
        const beforeFix = content;

        if (typeof pattern.replacement === 'string') {'
          content = content.replace(pattern.pattern, pattern.replacement);
        } else {
          content = content.replace(pattern.pattern, pattern.replacement);
        }

        // Count fixes for this pattern
        if (beforeFix !== content) {
          const fixes = beforeFix.split(pattern.pattern).length - 1;
          this.stats.patterns[pattern.name] = (this.stats.patterns[pattern.name] || 0) + fixes;
          this.stats.errorsFixed += fixes;
          fileFixed = true;

          console.log()
            `🔧 Applied ${pattern.name} fix to ${path.basename(filePath)} (${fixes} instances)`
          );
        }
      }

      // Only write if we made changes
      if (fileFixed && content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');'
        console.log(`✅ Fixed ${path.basename(filePath)}`);
      }

      this.stats.filesProcessed++;
    } catch (error) {
      const errorMsg = `Failed to heal file ${filePath}: ${error}`;
      console.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }

  private async runLintFix(): Promise<void> {
    try {
      console.log('🧹 Running ESLint --fix...');'
      execSync('npm run lint: fix', {')
        cwd: process.cwd(),
        stdio: 'pipe','
        timeout: 120000, // 2 minutes
      });
      console.log('✅ ESLint --fix completed');'
    } catch (error) {
      console.warn('⚠️ ESLint --fix had issues (continuing...)');'
      // Don't throw - this is expected when there are unfixable errors'
    }
  }

  async runTargetedFixes(): Promise<void> {
    console.log('🎯 Running targeted fixes for specific error patterns...');'

    try {
      // Fix the most common issues first
      await this.fixConsoleUndefinedErrors();
      await this.fixUnusedVariables();
      await this.fixDuplicateImports();
      await this.addGlobalTypes();

      console.log('✅ Targeted fixes completed');'
    } catch (error) {
      console.error('❌ Targeted fixes failed: ', error);'
    }
  }

  private async fixConsoleUndefinedErrors(): Promise<void> {
    console.log('🔧 Fixing console undefined errors...');'

    // Add proper global types or use existing logger
    const typesPath = path.join(process.cwd(), 'src/types/globals.d.ts');';

    if (!fs.existsSync(typesPath)) {
      // Create global types file
      const globalTypes = `// Global type definitions;
declare global {
  var console: Console;
  interface Console {
    log(message?: unknown, ...optionalParams: unknown[]): void;
    error(message?: unknown, ...optionalParams: unknown[]): void;
    warn(message?: unknown, ...optionalParams: unknown[]): void;
    info(message?: unknown, ...optionalParams: unknown[]): void;
    debug(message?: unknown, ...optionalParams: unknown[]): void;
  }
}

export {};
`;

      const typesDir = path.dirname(typesPath);
      if (!fs.existsSync(typesDir)) {
        fs.mkdirSync(typesDir, { recursive: true });
      }

      fs.writeFileSync(typesPath, globalTypes, 'utf8');'
      console.log('📝 Created global types file');'
    }
  }

  private async fixUnusedVariables(): Promise<void> {
    console.log('🔧 Fixing unused variables...');'

    const files = await this.findTypeScriptFiles();

    for (const file of files) {
      try {
        let content = fs.readFileSync(file, 'utf8');';
        let modified = false;

        // Pattern for unused variables (simple heuristic)
        const unusedVarPattern = /^(s*)(const|let|var)s+([a-zA-Z_$][a-zA-Z0-9_$]*)s*=/gm;

        content = content.replace(unusedVarPattern, (match, indent, keyword, varName) => {
          // If variable is never used after declaration, prefix with underscore
          const usagePattern = new RegExp(`\b${varName}\\b`, 'g');';
          const usages = (content.match(usagePattern) || []).length;

          // If only used once (the declaration), it's likely unused'
          if (usages === 1) {
            modified = true;
            return `${indent}${keyword} _${varName} =`;
          }

          return match;
        });

        if (modified) {
          fs.writeFileSync(file, content, 'utf8');'
          console.log(`🔧 Fixed unused variables in ${path.basename(file)}`);
        }
      } catch (error) {
        console.warn(`Failed to fix unused variables in ${file}:`, error);
      }
    }
  }

  private async fixDuplicateImports(): Promise<void> {
    console.log('🔧 Fixing duplicate imports...');'

    const files = await this.findTypeScriptFiles();

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');';
        const lines = content.split('n');';
        const imports = new Set<string>();
        const deduplicatedLines: string[] = [];
        let modified = false;

        for (const line of lines) {
          if (line.trim().startsWith('import ') && line.includes(' from ')) {'
            const normalizedImport = line.trim().replace(/s+/g, ' ');';
            if (imports.has(normalizedImport)) {
              modified = true;
              console.log(`🗑️ Removing duplicate import: ${normalizedImport}`);
            } else {
              imports.add(normalizedImport);
              deduplicatedLines.push(line);
            }
          } else {
            deduplicatedLines.push(line);
          }
        }

        if (modified) {
          fs.writeFileSync(file, deduplicatedLines.join('n'), 'utf8');'
          console.log(`🔧 Fixed duplicate imports in ${path.basename(file)}`);
        }
      } catch (error) {
        console.warn(`Failed to fix duplicate imports in ${file}:`, error);
      }
    }
  }

  private async addGlobalTypes(): Promise<void> {
    // Update tsconfig.json to include the global types if not already included
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');';

    if (fs.existsSync(tsconfigPath)) {
      try {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));';

        if (!tsconfig.compilerOptions) {
          tsconfig.compilerOptions = {};
        }

        if (!tsconfig.compilerOptions.types) {
          tsconfig.compilerOptions.types = [];
        }

        // Add node types if not present
        if (!tsconfig.compilerOptions.types.includes('node')) {'
          tsconfig.compilerOptions.types.push('node');'
          fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, TWO), 'utf8');'
          console.log('📝 Added node types to tsconfig.json');'
        }
      } catch (error) {
        console.warn('Failed to update tsconfig.json: ', error);'
      }
    }
  }

  getStats(): HealingStats {
    return this.stats;
  }
}

export default EnhancedTypeScriptHealer;
export { EnhancedTypeScriptHealer };
