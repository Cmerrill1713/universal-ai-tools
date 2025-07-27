const { SupabaseService } = require('../dist/services/supabase_service');
const { EnhancedMemorySystem } = require('../dist/memory/enhanced_memory_system');
const fs = require('fs').promises;
const path = require('path');

/**
 * TypeScript Error Analyzer
 * Analyzes TypeScript errors and suggests fixes using stored knowledge
 */

class TypeScriptErrorAnalyzer {
  constructor() {
    this.supabase = SupabaseService.getInstance();
    this.memorySystem = new EnhancedMemorySystem();
    this.errorCounts = new Map();
    this.fixes = [];
  }

  /**
   * Analyze TypeScript build output
   */
  async analyzeBuildErrors(buildOutput) {
    console.log('🔍 Analyzing TypeScript errors...\n');

    // Parse errors from build output
    const errors = this.parseErrors(buildOutput);

    console.log(`Found ${errors.length} errors to analyze\n`);

    // Group errors by type
    const groupedErrors = this.groupErrorsByType(errors);

    // Find fixes for each error type
    for (const [errorCode, errorGroup] of groupedErrors) {
      console.log(`\n📌 ${errorCode}: ${errorGroup.length} occurrences`);

      // Search for fixes in our knowledge base
      const fixes = await this.searchForFixes(errorCode, errorGroup[0]);

      if (fixes.length > 0) {
        console.log(`✅ Found ${fixes.length} potential fixes:`);
        fixes.forEach((fix, i) => {
          console.log(`\n  ${i + 1}. ${fix.title || 'Fix'}`);
          if (fix.content) {
            console.log(`     ${fix.content.substring(0, 200)}...`);
          }
        });
      } else {
        console.log('❌ No specific fixes found in knowledge base');
      }
    }

    // Generate fix recommendations
    await this.generateFixReport(groupedErrors);
  }

  /**
   * Parse errors from TypeScript output
   */
  parseErrors(output) {
    const errors = [];
    const lines = output.split('\n');

    let currentError = null;

    for (const line of lines) {
      // Match TypeScript error format: src/file.ts(10,5): error TS2339: ...
      const errorMatch = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/);

      if (errorMatch) {
        if (currentError) {
          errors.push(currentError);
        }

        currentError = {
          file: errorMatch[1],
          line: parseInt(errorMatch[2]),
          column: parseInt(errorMatch[3]),
          code: errorMatch[4],
          message: errorMatch[5],
          context: [],
        };
      } else if (currentError && line.trim()) {
        // Collect context lines
        currentError.context.push(line);
      }
    }

    if (currentError) {
      errors.push(currentError);
    }

    return errors;
  }

  /**
   * Group errors by type
   */
  groupErrorsByType(errors) {
    const grouped = new Map();

    for (const error of errors) {
      if (!grouped.has(error.code)) {
        grouped.set(error.code, []);
      }
      grouped.get(error.code).push(error);

      // Count occurrences
      this.errorCounts.set(error.code, (this.errorCounts.get(error.code) || 0) + 1);
    }

    return grouped;
  }

  /**
   * Search for fixes in our knowledge base
   */
  async searchForFixes(errorCode, exampleError) {
    try {
      // Search for specific error code fixes
      const query = `TypeScript ${errorCode} ${exampleError.message}`;

      const searchResults = await this.memorySystem.search(query, {
        limit: 5,
        filters: {
          memory_type: ['typescript_fix', 'technical_documentation'],
        },
      });

      const fixes = [];

      for (const result of searchResults.results) {
        try {
          const content = JSON.parse(result.memory.content);
          if (content.category === 'typescript_fix' || content.errorCode === errorCode) {
            fixes.push({
              title: content.title,
              content: content.content,
              example: content.codeExample,
              confidence: result.similarity,
            });
          }
        } catch (e) {
          // Skip if not JSON
        }
      }

      return fixes;
    } catch (error) {
      console.error('Error searching for fixes:', error);
      return [];
    }
  }

  /**
   * Generate a comprehensive fix report
   */
  async generateFixReport(groupedErrors) {
    console.log('\n\n📋 TYPESCRIPT ERROR FIX REPORT');
    console.log('================================\n');

    const report = [];

    // Sort by frequency
    const sortedErrors = Array.from(groupedErrors.entries()).sort(
      (a, b) => b[1].length - a[1].length
    );

    for (const [errorCode, errors] of sortedErrors) {
      const fixes = await this.searchForFixes(errorCode, errors[0]);

      report.push({
        errorCode,
        count: errors.length,
        description: errors[0].message,
        files: [...new Set(errors.map((e) => e.file))].slice(0, 5),
        fixes: fixes.map((f) => ({
          solution: f.content,
          example: f.example,
        })),
      });
    }

    // Save report
    const reportPath = path.join(process.cwd(), 'TYPESCRIPT_FIXES.md');
    await this.saveReport(reportPath, report);

    console.log(`\n✅ Fix report saved to: ${reportPath}`);

    // Store insights back in memory
    await this.storeInsights(report);
  }

  /**
   * Save fix report as markdown
   */
  async saveReport(filePath, report) {
    let markdown = '# TypeScript Error Fixes\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `## Summary\n`;
    markdown += `- Total error types: ${report.length}\n`;
    markdown += `- Total errors: ${report.reduce((sum, r) => sum + r.count, 0)}\n\n`;

    for (const errorReport of report) {
      markdown += `## ${errorReport.errorCode} (${errorReport.count} occurrences)\n\n`;
      markdown += `**Error**: ${errorReport.description}\n\n`;
      markdown += `**Affected files**:\n`;
      errorReport.files.forEach((file) => {
        markdown += `- ${file}\n`;
      });
      markdown += '\n';

      if (errorReport.fixes.length > 0) {
        markdown += `### Suggested Fixes:\n\n`;
        errorReport.fixes.forEach((fix, i) => {
          markdown += `#### Fix ${i + 1}:\n`;
          markdown += `${fix.solution}\n\n`;
          if (fix.example) {
            markdown += '```typescript\n';
            markdown += fix.example;
            markdown += '\n```\n\n';
          }
        });
      } else {
        markdown += `### Manual Fix Required\n`;
        markdown += `No automated fixes found. Review TypeScript documentation for ${errorReport.errorCode}.\n\n`;
      }
    }

    await fs.writeFile(filePath, markdown);
  }

  /**
   * Store insights back to memory for future use
   */
  async storeInsights(report) {
    const insights = {
      timestamp: new Date().toISOString(),
      totalErrors: report.reduce((sum, r) => sum + r.count, 0),
      errorTypes: report.length,
      topErrors: report.slice(0, 5).map((r) => ({
        code: r.errorCode,
        count: r.count,
        description: r.description,
      })),
    };

    await this.supabase.client.from('ai_memories').insert({
      service_id: 'typescript_analyzer',
      content: JSON.stringify(insights),
      memory_type: 'analysis_result',
      metadata: {
        type: 'error_analysis',
        project: 'universal-ai-tools',
        timestamp: insights.timestamp,
      },
    });
  }
}

// Main execution
async function main() {
  // Check if build output file exists
  const buildOutputPath = process.argv[2] || 'build_errors.log';

  try {
    // Try to run build and capture output
    console.log('Running TypeScript build to capture errors...');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      await execAsync('npm run build 2>&1 > build_errors.log');
    } catch (error) {
      // Build will fail, but we captured the output
      console.log('Build completed with errors (as expected)');
    }

    // Read the build output
    const buildOutput = await fs.readFile('build_errors.log', 'utf-8');

    // Analyze errors
    const analyzer = new TypeScriptErrorAnalyzer();
    await analyzer.analyzeBuildErrors(buildOutput);
  } catch (error) {
    console.error('Error:', error);
    console.log('\nUsage: node analyze_typescript_errors.js [build_output_file]');
  }
}

main().catch(console.error);
