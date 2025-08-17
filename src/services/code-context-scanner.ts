/**
 * Code Context Scanner Service
 * Simple service to scan workspace for code context
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';
import path from 'path';

import { log, LogContext } from '@/utils/logger';

interface CodeFile {
  path: string;
  content: string;
  tokens: number;
  language: string;
}

interface CodeContextResult {
  files: CodeFile[];
  summary: string;
  totalTokens: number;
  filesScanned: number;
  contextTruncated: boolean;
  workspacePath: string;
}

interface CodeContextOptions {
  workspacePath?: string;
  maxFiles?: number;
  maxTokensForCode?: number;
}

export class CodeContextScanner {
  async scanCodeContext(userMessage: string, options: CodeContextOptions = {}): Promise<CodeContextResult> {
    try {
      const workspacePath = options.workspacePath || process.cwd();
      const maxFiles = options.maxFiles || 10;
      const maxTokens = options.maxTokensForCode || 10000;

      log.info('Starting code context scan', LogContext.CONTEXT_INJECTION, {
        workspacePath,
        maxFiles,
        maxTokens
      });

      // Simple file patterns
      const patterns = ['**/*.ts', '**/*.js', '**/*.py'];
      const excludePatterns = ['**/node_modules/**', '**/dist/**', '**/.git/**'];

      const allFiles: string[] = [];
      for (const pattern of patterns) {
        const matches = await glob(path.join(workspacePath, pattern), {
          ignore: excludePatterns,
          absolute: true
        });
        allFiles.push(...matches);
      }

      const limitedFiles = allFiles.slice(0, maxFiles);
      const codeFiles: CodeFile[] = [];
      let totalTokens = 0;

      for (const filePath of limitedFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const tokens = Math.ceil(content.length / 4);
          
          if (totalTokens + tokens > maxTokens) break;

          const ext = path.extname(filePath);
          const language = ext === '.ts' ? 'typescript' : ext === '.js' ? 'javascript' : 'text';

          codeFiles.push({
            path: filePath,
            content: content.substring(0, 2000), // Limit content
            tokens,
            language
          });

          totalTokens += tokens;
        } catch (error) {
          // Skip files that can't be read
        }
      }

      return {
        files: codeFiles,
        summary: `Found ${codeFiles.length} code files with ${totalTokens} tokens`,
        totalTokens,
        filesScanned: allFiles.length,
        contextTruncated: codeFiles.length < allFiles.length,
        workspacePath
      };

    } catch (error) {
      log.error('Code context scan failed', LogContext.CONTEXT_INJECTION, { error });
      return {
        files: [],
        summary: 'Code scan failed',
        totalTokens: 0,
        filesScanned: 0,
        contextTruncated: false,
        workspacePath: options.workspacePath || process.cwd()
      };
    }
  }

  formatCodeContextForChat(result: CodeContextResult, userMessage: string): string {
    if (result.files.length === 0) return '';

    let context = `\n\n# Code Context\n\n${result.summary}\n\n`;
    
    for (const file of result.files) {
      const relativePath = path.relative(result.workspacePath, file.path);
      context += `## ${relativePath}\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
    }

    return context;
  }
}

export const codeContextScanner = new CodeContextScanner();
export default codeContextScanner;
