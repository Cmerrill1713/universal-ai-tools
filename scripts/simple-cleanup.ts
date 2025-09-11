#!/usr/bin/env tsx

/**
 * Simple Cleanup Script - Safe directory and file cleanup
 * Identifies unused directories and common temporary files without deep recursion
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, statSync } from 'fs';

class SimpleCleanup {
  private rootDir: string;
  private dryRun: boolean;
  private verbose: boolean;

  constructor(rootDir: string, dryRun = false, verbose = false) {
    this.rootDir = rootDir;
    this.dryRun = dryRun;
    this.verbose = verbose;
  }

  async analyze(): Promise<void> {
    console.log(`🔍 Analyzing root directory for cleanup opportunities...`);
    console.log(`📁 Root directory: ${this.rootDir}`);
    console.log(`🔍 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    // Check root-level directories only
    const rootDirs = await this.findEmptyOrObsoleteDirectories();
    
    // Check root-level files only
    const tempFiles = await this.findTemporaryFiles();
    
    this.displayResults(rootDirs, tempFiles);

    if (!this.dryRun && (rootDirs.length > 0 || tempFiles.length > 0)) {
      await this.performCleanup(rootDirs, tempFiles);
    }
  }

  private async findEmptyOrObsoleteDirectories(): Promise<string[]> {
    const obsoleteDirs: string[] = [];
    
    try {
      const entries = await fs.readdir(this.rootDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const dirPath = path.join(this.rootDir, entry.name);
          
          if (await this.isObsoleteDirectory(entry.name, dirPath)) {
            obsoleteDirs.push(entry.name);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading root directory: ${error}`);
    }
    
    return obsoleteDirs;
  }

  private async isObsoleteDirectory(dirName: string, dirPath: string): Promise<boolean> {
    // Check for empty directories
    try {
      const entries = await fs.readdir(dirPath);
      if (entries.length === 0) {
        if (this.verbose) {
          console.log(`Found empty directory: ${dirName}`);
        }
        return true;
      }
    } catch (error) {
      return false;
    }

    // Check for known obsolete patterns
    const obsoletePatterns = [
      /^temp-/,
      /^old-/,
      /^backup-\d+/,
      /^archive/,
      /^deprecated/,
      /^unused/,
      /^legacy/,
      /^test-\d+/,
      /-backup$/,
      /-old$/
    ];

    for (const pattern of obsoletePatterns) {
      if (pattern.test(dirName)) {
        if (this.verbose) {
          console.log(`Found obsolete directory pattern: ${dirName}`);
        }
        return true;
      }
    }

    return false;
  }

  private async findTemporaryFiles(): Promise<string[]> {
    const tempFiles: string[] = [];
    
    try {
      const entries = await fs.readdir(this.rootDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && this.isTemporaryFile(entry.name)) {
          tempFiles.push(entry.name);
        }
      }
    } catch (error) {
      console.error(`Error reading root directory files: ${error}`);
    }
    
    return tempFiles;
  }

  private isTemporaryFile(fileName: string): boolean {
    const tempPatterns = [
      /\.log$/,
      /\.tmp$/,
      /\.bak$/,
      /\.old$/,
      /\.orig$/,
      /~$/,
      /\.swp$/,
      /\.DS_Store$/,
      /Thumbs\.db$/i,
      /\.pid$/
    ];

    return tempPatterns.some(pattern => pattern.test(fileName));
  }

  private displayResults(directories: string[], files: string[]): void {
    if (directories.length === 0 && files.length === 0) {
      console.log('✅ No cleanup needed. Root directory is already clean!');
      return;
    }

    console.log(`📊 Cleanup Analysis Results:`);
    
    if (directories.length > 0) {
      console.log(`\n📁 Directories to remove (${directories.length}):`);
      directories.forEach(dir => {
        console.log(`   🗂️  ${dir}/`);
      });
    }
    
    if (files.length > 0) {
      console.log(`\n📄 Temporary files to remove (${files.length}):`);
      files.forEach(file => {
        console.log(`   🗄️  ${file}`);
      });
    }

    const totalItems = directories.length + files.length;
    console.log(`\nTotal items to clean: ${totalItems}`);
  }

  private async performCleanup(directories: string[], files: string[]): Promise<void> {
    console.log('\n🧹 Performing cleanup...');

    // Remove directories
    for (const dir of directories) {
      const dirPath = path.join(this.rootDir, dir);
      try {
        await fs.rm(dirPath, { recursive: true });
        console.log(`✅ Removed directory: ${dir}/`);
      } catch (error) {
        console.error(`❌ Failed to remove directory ${dir}: ${error}`);
      }
    }

    // Remove files
    for (const file of files) {
      const filePath = path.join(this.rootDir, file);
      try {
        await fs.unlink(filePath);
        console.log(`✅ Removed file: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to remove file ${file}: ${error}`);
      }
    }

    console.log('\n✅ Cleanup completed!');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  const rootDir = process.cwd();
  const cleanup = new SimpleCleanup(rootDir, dryRun, verbose);

  try {
    await cleanup.analyze();
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Export for use as module
export { SimpleCleanup };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}