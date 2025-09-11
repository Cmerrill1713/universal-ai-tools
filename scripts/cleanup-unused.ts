#!/usr/bin/env tsx

/**
 * Cleanup Unused Files and Folders
 * Safely identifies and removes unused files/directories without breaking functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, statSync } from 'fs';
import { execSync } from 'child_process';

interface UnusedItem {
  path: string;
  type: 'file' | 'directory';
  reason: string;
  size: number;
  lastModified: Date;
  safe: boolean; // Whether it's safe to delete
}

class CodebaseCleanup {
  private rootDir: string;
  private dryRun: boolean;
  private verbose: boolean;

  constructor(rootDir: string, dryRun = false, verbose = false) {
    this.rootDir = rootDir;
    this.dryRun = dryRun;
    this.verbose = verbose;
  }

  async analyze(): Promise<UnusedItem[]> {
    console.log(`🔍 Analyzing codebase for unused files and directories...`);
    console.log(`📁 Root directory: ${this.rootDir}`);
    console.log(`🔍 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    const unusedItems: UnusedItem[] = [];

    // Find unused directories
    const unusedDirs = await this.findUnusedDirectories();
    unusedItems.push(...unusedDirs);

    // Find unused files
    const unusedFiles = await this.findUnusedFiles();
    unusedItems.push(...unusedFiles);

    // Find duplicate files
    const duplicates = await this.findDuplicateFiles();
    unusedItems.push(...duplicates);

    return unusedItems.sort((a, b) => b.size - a.size); // Sort by size descending
  }

  private async findUnusedDirectories(): Promise<UnusedItem[]> {
    const unusedDirs: UnusedItem[] = [];
    const entries = await fs.readdir(this.rootDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const dirPath = path.join(this.rootDir, entry.name);
        const analysis = await this.analyzeDirectory(entry.name, dirPath);
        
        if (analysis) {
          unusedDirs.push(analysis);
        }
      }
    }

    return unusedDirs;
  }

  private async analyzeDirectory(dirName: string, dirPath: string): Promise<UnusedItem | null> {
    const stats = statSync(dirPath);
    const size = await this.getDirectorySize(dirPath);

    // Check if directory is empty
    const entries = await fs.readdir(dirPath);
    if (entries.length === 0) {
      return {
        path: dirPath,
        type: 'directory',
        reason: 'Empty directory',
        size,
        lastModified: stats.mtime,
        safe: true
      };
    }

    // Check for obsolete directories
    const obsoletePatterns = [
      { pattern: /^(temp|tmp)-/, reason: 'Temporary directory' },
      { pattern: /^old-/, reason: 'Old/archived directory' },
      { pattern: /^backup-\d+/, reason: 'Numbered backup directory' },
      { pattern: /^archive/, reason: 'Archive directory' },
      { pattern: /^deprecated/, reason: 'Deprecated directory' },
      { pattern: /^unused/, reason: 'Explicitly unused directory' },
      { pattern: /^legacy/, reason: 'Legacy directory' },
      { pattern: /^test-\d+/, reason: 'Temporary test directory' },
      { pattern: /-backup$/, reason: 'Backup directory' },
      { pattern: /-old$/, reason: 'Old version directory' }
    ];

    for (const { pattern, reason } of obsoletePatterns) {
      if (pattern.test(dirName)) {
        return {
          path: dirPath,
          type: 'directory',
          reason,
          size,
          lastModified: stats.mtime,
          safe: true
        };
      }
    }

    // Check for directories with only build artifacts
    const buildArtifacts = entries.filter(entry => 
      entry.endsWith('.log') || 
      entry.endsWith('.tmp') || 
      entry.endsWith('.cache') ||
      entry === 'node_modules' ||
      entry === '.build' ||
      entry === 'target' ||
      entry === 'dist'
    );

    if (buildArtifacts.length === entries.length && entries.length > 0) {
      return {
        path: dirPath,
        type: 'directory',
        reason: 'Contains only build artifacts',
        size,
        lastModified: stats.mtime,
        safe: false // Requires review
      };
    }

    // Check for very old directories (>6 months) with specific patterns
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    if (stats.mtime < sixMonthsAgo && /^(experiment|test|demo|prototype)-/.test(dirName)) {
      return {
        path: dirPath,
        type: 'directory',
        reason: 'Old experimental directory (>6 months)',
        size,
        lastModified: stats.mtime,
        safe: false // Requires review
      };
    }

    return null;
  }

  private async findUnusedFiles(): Promise<UnusedItem[]> {
    const unusedFiles: UnusedItem[] = [];
    const files = await this.getAllFiles();

    for (const filePath of files) {
      const analysis = await this.analyzeFile(filePath);
      if (analysis) {
        unusedFiles.push(analysis);
      }
    }

    return unusedFiles;
  }

  private async getAllFiles(): Promise<string[]> {
    const files: string[] = [];
    const visited = new Set<string>();
    const maxDepth = 10; // Prevent infinite recursion
    
    async function walkDir(dir: string, depth = 0): Promise<void> {
      if (depth > maxDepth) return;
      
      const realPath = path.resolve(dir);
      if (visited.has(realPath)) return; // Prevent circular references
      visited.add(realPath);
      
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Skip problematic directories
          if (entry.name.startsWith('.') || 
              entry.name === 'node_modules' ||
              entry.name === 'target' ||
              entry.name === '.build' ||
              entry.name === 'dist') {
            continue;
          }
          
          if (entry.isDirectory()) {
            await walkDir(fullPath, depth + 1);
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't access
        if (this.verbose) {
          console.log(`Skipping directory ${dir}: ${error}`);
        }
      }
    }

    await walkDir(this.rootDir);
    return files;
  }

  private async analyzeFile(filePath: string): Promise<UnusedItem | null> {
    const stats = statSync(filePath);
    const fileName = path.basename(filePath);
    const relativePath = path.relative(this.rootDir, filePath);

    // Skip protected files
    const protectedPatterns = [
      /package\.json$/,
      /package-lock\.json$/,
      /tsconfig.*\.json$/,
      /README\.md$/,
      /CHANGELOG\.md$/,
      /CLAUDE\.md$/,
      /SECURITY\.md$/,
      /Dockerfile$/,
      /docker-compose.*\.ya?ml$/,
      /Cargo\.(toml|lock)$/,
      /go\.(mod|sum)$/,
      /Makefile$/
    ];

    if (protectedPatterns.some(pattern => pattern.test(fileName))) {
      return null;
    }

    // Identify unused file patterns
    const unusedPatterns = [
      { pattern: /\.log$/, reason: 'Log file', safe: true },
      { pattern: /\.tmp$/, reason: 'Temporary file', safe: true },
      { pattern: /\.bak$/, reason: 'Backup file', safe: true },
      { pattern: /\.old$/, reason: 'Old version file', safe: true },
      { pattern: /\.orig$/, reason: 'Original backup file', safe: true },
      { pattern: /~$/, reason: 'Editor backup file', safe: true },
      { pattern: /\.swp$/, reason: 'Vim swap file', safe: true },
      { pattern: /\.DS_Store$/, reason: 'macOS system file', safe: true },
      { pattern: /Thumbs\.db$/i, reason: 'Windows thumbnail cache', safe: true },
      { pattern: /\.pid$/, reason: 'Process ID file', safe: true },
      { pattern: /\.lock$/, reason: 'Lock file (check if orphaned)', safe: false },
    ];

    for (const { pattern, reason, safe } of unusedPatterns) {
      if (pattern.test(fileName)) {
        return {
          path: filePath,
          type: 'file',
          reason,
          size: stats.size,
          lastModified: stats.mtime,
          safe
        };
      }
    }

    // Check for very large files that might be accidentally committed
    if (stats.size > 100 * 1024 * 1024) { // 100MB
      const isKnownLarge = /\.(zip|tar\.gz|dmg|pkg|exe|iso)$/.test(fileName);
      if (!isKnownLarge) {
        return {
          path: filePath,
          type: 'file',
          reason: 'Very large file (>100MB) - possibly accidental',
          size: stats.size,
          lastModified: stats.mtime,
          safe: false
        };
      }
    }

    return null;
  }

  private async findDuplicateFiles(): Promise<UnusedItem[]> {
    const duplicates: UnusedItem[] = [];
    const filesByName: Record<string, string[]> = {};
    
    const files = await this.getAllFiles();
    
    // Group files by basename
    for (const filePath of files) {
      const fileName = path.basename(filePath);
      if (!filesByName[fileName]) {
        filesByName[fileName] = [];
      }
      filesByName[fileName].push(filePath);
    }

    // Find duplicates
    for (const [fileName, paths] of Object.entries(filesByName)) {
      if (paths.length > 1) {
        // Sort by modification time, keep the newest
        const sorted = paths
          .map(p => ({ path: p, stats: statSync(p) }))
          .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

        // Mark older duplicates as unused
        for (let i = 1; i < sorted.length; i++) {
          const file = sorted[i];
          duplicates.push({
            path: file.path,
            type: 'file',
            reason: `Duplicate of ${path.relative(this.rootDir, sorted[0].path)}`,
            size: file.stats.size,
            lastModified: file.stats.mtime,
            safe: false // Requires review to ensure they're truly identical
          });
        }
      }
    }

    return duplicates;
  }

  async cleanup(items: UnusedItem[]): Promise<void> {
    if (items.length === 0) {
      console.log('✅ No unused items to clean up!');
      return;
    }

    console.log(`\n🧹 Cleaning up ${items.length} unused items...`);

    const safeItems = items.filter(item => item.safe);
    const unsafeItems = items.filter(item => !item.safe);

    if (safeItems.length > 0) {
      console.log(`\n🟢 Safe to remove (${safeItems.length} items):`);
      for (const item of safeItems) {
        console.log(`   ${item.type === 'directory' ? '📁' : '📄'} ${path.relative(this.rootDir, item.path)} - ${item.reason}`);
        
        if (!this.dryRun) {
          await this.removeItem(item);
        }
      }
    }

    if (unsafeItems.length > 0) {
      console.log(`\n🟡 Requires review (${unsafeItems.length} items):`);
      for (const item of unsafeItems) {
        console.log(`   ${item.type === 'directory' ? '📁' : '📄'} ${path.relative(this.rootDir, item.path)} - ${item.reason}`);
        console.log(`      Size: ${this.formatBytes(item.size)}, Last modified: ${item.lastModified.toLocaleDateString()}`);
      }
      console.log(`\n💡 Use --force to remove items that require review`);
    }
  }

  private async removeItem(item: UnusedItem): Promise<void> {
    try {
      if (item.type === 'directory') {
        await fs.rmdir(item.path, { recursive: true });
      } else {
        await fs.unlink(item.path);
      }
      
      if (this.verbose) {
        console.log(`✅ Removed: ${path.relative(this.rootDir, item.path)}`);
      }
    } catch (error) {
      console.error(`❌ Failed to remove ${item.path}: ${error}`);
    }
  }

  private async getDirectorySize(dirPath: string, depth = 0): Promise<number> {
    let size = 0;
    const maxDepth = 10; // Prevent infinite recursion
    
    if (depth > maxDepth) return 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip problematic directories
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' ||
            entry.name === 'target' ||
            entry.name === '.build') {
          continue;
        }
        
        if (entry.isDirectory()) {
          size += await this.getDirectorySize(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        }
      }
    } catch (error) {
      // Handle permission errors gracefully
      if (this.verbose) {
        console.log(`Cannot access directory ${dirPath}: ${error}`);
      }
    }
    
    return size;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  displayAnalysis(items: UnusedItem[]): void {
    if (items.length === 0) {
      console.log('✅ Codebase is clean! No unused files or directories found.');
      return;
    }

    console.log(`\n📊 Analysis Summary:`);
    console.log(`Total unused items: ${items.length}`);
    
    const totalSize = items.reduce((sum, item) => sum + item.size, 0);
    console.log(`Total reclaimable space: ${this.formatBytes(totalSize)}`);

    const safeCount = items.filter(item => item.safe).length;
    const unsafeCount = items.filter(item => !item.safe).length;
    
    console.log(`Safe to remove: ${safeCount}`);
    console.log(`Requires review: ${unsafeCount}`);

    // Group by reason
    const byReason = items.reduce((groups, item) => {
      if (!groups[item.reason]) {
        groups[item.reason] = [];
      }
      groups[item.reason].push(item);
      return groups;
    }, {} as Record<string, UnusedItem[]>);

    console.log(`\n📋 Breakdown by type:`);
    for (const [reason, reasonItems] of Object.entries(byReason)) {
      const reasonSize = reasonItems.reduce((sum, item) => sum + item.size, 0);
      console.log(`   ${reason}: ${reasonItems.length} items (${this.formatBytes(reasonSize)})`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || !args.includes('--execute');
  const verbose = args.includes('--verbose');
  const force = args.includes('--force');
  
  const rootDir = process.cwd();
  const cleanup = new CodebaseCleanup(rootDir, dryRun, verbose);

  try {
    const unusedItems = await cleanup.analyze();
    cleanup.displayAnalysis(unusedItems);

    if (unusedItems.length > 0) {
      if (force) {
        // Include unsafe items if --force is used
        await cleanup.cleanup(unusedItems);
      } else {
        // Only safe items by default
        const safeItems = unusedItems.filter(item => item.safe);
        await cleanup.cleanup(safeItems);
      }
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Export for use as module
export { CodebaseCleanup, UnusedItem };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}