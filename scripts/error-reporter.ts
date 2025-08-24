#!/usr/bin/env tsx

/**
 * TypeScript Error Reporter
 * 
 * Generates a detailed report of TypeScript errors organized by file and type
 * for systematic manual fixing.
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

interface ErrorInfo {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  fullLine: string;
}

interface FileErrorSummary {
  file: string;
  errorCount: number;
  errors: ErrorInfo[];
  priority: number;
}

class ErrorReporter {
  private workingDir = '/Users/christianmerrill/Desktop/universal-ai-tools';
  private reportFile = '/Users/christianmerrill/Desktop/universal-ai-tools/typescript-error-report.json';

  async generateReport(): Promise<void> {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('📊 Generating TypeScript Error Report...\n');

    const errors = this.parseTypeScriptErrors();
    const fileSummaries = this.groupErrorsByFile(errors);
    const prioritizedFiles = this.prioritizeFiles(fileSummaries);

    const report = {
      timestamp: new Date().toISOString(),
      totalErrors: errors.length,
      totalFiles: fileSummaries.length,
      topErrorTypes: this.getTopErrorTypes(errors),
      filesByPriority: prioritizedFiles,
      detailedErrors: fileSummaries
    };

    writeFileSync(this.reportFile, JSON.stringify(report, null, 2));

    this.printSummary(report);
    console.log(`\n📁 Detailed report saved to: ${this.reportFile}`);
  }

  private parseTypeScriptErrors(): ErrorInfo[] {
    try {
      const output = execSync('npx tsc --noEmit 2>&1 || true', {
        cwd: this.workingDir,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 20 // 20MB buffer
      });

      const errors: ErrorInfo[] = [];
      const lines = output.split('\n');

      for (const line of lines) {
        if (line.includes('error TS')) {
          const match = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/);
          if (match) {
            errors.push({
              file: match[1],
              line: parseInt(match[2]),
              column: parseInt(match[3]),
              code: match[4],
              message: match[5],
              fullLine: line
            });
          }
        }
      }

      return errors;
    } catch (error) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('Error parsing TypeScript errors:', error);
      return [];
    }
  }

  private groupErrorsByFile(errors: ErrorInfo[]): FileErrorSummary[] {
    const fileMap = new Map<string, ErrorInfo[]>();

    for (const error of errors) {
      if (!fileMap.has(error.file)) {
        fileMap.set(error.file, []);
      }
      fileMap.get(error.file)!.push(error);
    }

    return Array.from(fileMap.entries()).map(([file, errors]) => ({
      file,
      errorCount: errors.length,
      errors: errors.sort((a, b) => a.line - b.line),
      priority: this.getFilePriority(file)
    }));
  }

  private getFilePriority(filePath: string): number {
    // Priority 1: Critical infrastructure
    if (filePath.includes('server.ts')) return 1;
    if (filePath.includes('config/environment.ts')) return 1;
    if (filePath.includes('utils/logger.ts')) return 1;
    if (filePath.includes('types/index.ts')) return 1;

    // Priority 2: Core services and middleware
    if (filePath.includes('middleware/')) return 2;
    if (filePath.includes('services/supabase-client.ts')) return 2;
    if (filePath.includes('services/secrets-manager.ts')) return 2;
    if (filePath.includes('middleware/auth.ts')) return 2;

    // Priority 3: API routes and basic services
    if (filePath.includes('routers/')) return 3;
    if (filePath.includes('services/')) return 3;

    // Priority 4: Agents
    if (filePath.includes('agents/base-agent.ts')) return 4;
    if (filePath.includes('agents/enhanced-base-agent.ts')) return 4;
    if (filePath.includes('agents/agent-registry.ts')) return 4;
    if (filePath.includes('agents/')) return 5;

    // Priority 6: Advanced features
    if (filePath.includes('scripts/')) return 6;
    if (filePath.includes('types/')) return 6;
    if (filePath.includes('utils/')) return 6;

    return 7; // Lowest priority
  }

  private prioritizeFiles(fileSummaries: FileErrorSummary[]): FileErrorSummary[] {
    return fileSummaries.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.errorCount - a.errorCount; // More errors first within same priority
    });
  }

  private getTopErrorTypes(errors: ErrorInfo[]): Array<{ code: string; count: number; description: string }> {
    const errorCounts = new Map<string, number>();
    
    for (const error of errors) {
      errorCounts.set(error.code, (errorCounts.get(error.code) || 0) + 1);
    }

    const descriptions: { [key: string]: string } = {
      'TS1005': "Missing punctuation (semicolons, commas, etc.)",
      'TS1128': "Declaration or statement expected",
      'TS1002': "Unterminated string literal",
      'TS1109': "Expression expected",
      'TS1136': "Property assignment expected",
      'TS1434': "Unexpected keyword or identifier",
      'TS1110': "Type expected",
      'TS1135': "Argument expression expected",
      'TS1011': "Element access expression should take an argument",
      'TS1003': "Identifier expected"
    };

    return Array.from(errorCounts.entries())
      .map(([code, count]) => ({
        code,
        count,
        description: descriptions[code] || "Unknown error type"
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private printSummary(report: unknown): void {
    console.log('='.repeat(60));
    console.log('📊 TYPESCRIPT ERROR REPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Errors:       ${report.totalErrors.toLocaleString()}`);
    console.log(`Total Files:        ${report.totalFiles}`);
    console.log(`Generated:          ${new Date(report.timestamp).toLocaleString()}`);

    console.log('\n🏆 Top Error Types:');
    for (const errorType of report.topErrorTypes.slice(0, 5)) {
      console.log(`  ${errorType.code}: ${errorType.count.toLocaleString()} - ${errorType.description}`);
    }

    console.log('\n🎯 High Priority Files (Top 10):');
    for (const file of report.filesByPriority.slice(0, 10)) {
      const shortPath = file.file.replace('/Users/christianmerrill/Desktop/universal-ai-tools/', '');
      console.log(`  Priority ${file.priority}: ${shortPath} (${file.errorCount} errors)`);
    }

    console.log('\n📈 Files by Priority Group:');
    const priorityGroups = [1, 2, 3, 4, 5, 6, 7].map(priority => {
      const files = report.filesByPriority.filter((f: unknown) => f.priority === priority);
      const totalErrors = files.reduce((sum: number, f: unknown) => sum + f.errorCount, 0);
      return { priority, fileCount: files.length, errorCount: totalErrors };
    }).filter(group => group.fileCount > 0);

    for (const group of priorityGroups) {
      console.log(`  Priority ${group.priority}: ${group.fileCount} files, ${group.errorCount.toLocaleString()} errors`);
    }
  }
}

// Run the reporter
const reporter = new ErrorReporter();
reporter.generateReport().catch(console.error);