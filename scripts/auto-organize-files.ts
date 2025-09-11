#!/usr/bin/env tsx

/**
 * Automated File Organization System
 * Prevents root directory clutter by automatically organizing files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

interface OrganizationRule {
  pattern: RegExp;
  destination: string;
  description: string;
  critical?: boolean; // If true, won't move without confirmation
}

// File organization rules
const ORGANIZATION_RULES: OrganizationRule[] = [
  // Benchmark and performance files
  {
    pattern: /.*benchmark.*\.(json|js|ts|cjs)$/i,
    destination: 'benchmarks',
    description: 'Benchmark and performance test files'
  },
  {
    pattern: /.*-report.*\.(json|md)$/i,
    destination: 'reports',
    description: 'Report files'
  },
  {
    pattern: /.*performance.*\.(json|js|ts)$/i,
    destination: 'benchmarks',
    description: 'Performance test files'
  },

  // Asset files
  {
    pattern: /\.(png|jpg|jpeg|gif|svg|ico|icns)$/i,
    destination: 'assets',
    description: 'Image and icon files'
  },
  {
    pattern: /\.(html|htm)$/i,
    destination: 'assets',
    description: 'HTML files'
  },

  // Documentation
  {
    pattern: /^[A-Z_]+\.md$/,
    destination: 'documentation',
    description: 'Documentation files (except core ones)',
    critical: true
  },
  {
    pattern: /.*-(guide|setup|complete|plan|roadmap).*\.md$/i,
    destination: 'documentation',
    description: 'Guide and setup documentation'
  },

  // Configuration backups and templates
  {
    pattern: /\.(env\.|eslintrc|backup|template|example).*$/i,
    destination: 'backup-files',
    description: 'Configuration backups and templates'
  },
  {
    pattern: /.*\.(bak|old|orig)$/i,
    destination: 'backup-files',
    description: 'Backup files'
  },

  // Docker configurations
  {
    pattern: /^docker-compose.*\.ya?ml$/,
    destination: 'docker-configs',
    description: 'Docker Compose files'
  },
  {
    pattern: /^Dockerfile\..*/,
    destination: 'docker-configs',
    description: 'Dockerfile variants'
  },

  // Scripts and tools
  {
    pattern: /^(setup|validate|install|build|deploy|run).*\.(py|sh|js|ts|go)$/,
    destination: 'tools',
    description: 'Setup and utility scripts'
  },
  {
    pattern: /.*\.(sh|py|go)$/,
    destination: 'tools',
    description: 'Standalone scripts'
  },

  // Test files and results
  {
    pattern: /.*test.*\.(json|js|ts|md)$/i,
    destination: 'tests',
    description: 'Test files and results'
  },
  {
    pattern: /.*-results?.*\.(json|txt|log)$/i,
    destination: 'tests/results',
    description: 'Test result files'
  }
];

// Files that should NEVER be moved from root
const PROTECTED_FILES = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'README.md',
  'CHANGELOG.md',
  'CLAUDE.md',
  'SECURITY.md',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.rust-services.yml',
  'Cargo.toml',
  'Cargo.lock',
  'go.mod',
  'go.sum',
  'Makefile'
]);

class FileOrganizer {
  private rootDir: string;
  private dryRun: boolean;
  private verbose: boolean;

  constructor(rootDir: string, dryRun = false, verbose = false) {
    this.rootDir = rootDir;
    this.dryRun = dryRun;
    this.verbose = verbose;
  }

  async organize(): Promise<void> {
    console.log(`🗂️  Starting automated file organization...`);
    console.log(`📁 Root directory: ${this.rootDir}`);
    console.log(`🔍 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    const files = await this.getFilesToOrganize();
    const moveActions = await this.planMoves(files);

    if (moveActions.length === 0) {
      console.log('✅ No files need to be organized. Root directory is clean!');
      return;
    }

    console.log(`📋 Found ${moveActions.length} files to organize:`);
    this.displayMoveActions(moveActions);

    if (!this.dryRun) {
      await this.executeMoves(moveActions);
      console.log('\n✅ File organization completed successfully!');
    } else {
      console.log('\n💡 Run without --dry-run to execute these moves');
    }
  }

  private async getFilesToOrganize(): Promise<string[]> {
    const entries = await fs.readdir(this.rootDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .filter(filename => !PROTECTED_FILES.has(filename))
      .filter(filename => !filename.startsWith('.'));
  }

  private async planMoves(files: string[]): Promise<Array<{file: string, destination: string, rule: OrganizationRule}>> {
    const moves: Array<{file: string, destination: string, rule: OrganizationRule}> = [];

    for (const file of files) {
      for (const rule of ORGANIZATION_RULES) {
        if (rule.pattern.test(file)) {
          moves.push({
            file,
            destination: rule.destination,
            rule
          });
          break; // First matching rule wins
        }
      }
    }

    return moves;
  }

  private displayMoveActions(actions: Array<{file: string, destination: string, rule: OrganizationRule}>): void {
    const groupedActions = this.groupActionsByDestination(actions);

    for (const [destination, files] of Object.entries(groupedActions)) {
      console.log(`\n📁 ${destination}/`);
      files.forEach(action => {
        const critical = action.rule.critical ? '⚠️ ' : '';
        console.log(`   ${critical}${action.file} (${action.rule.description})`);
      });
    }
  }

  private groupActionsByDestination(actions: Array<{file: string, destination: string, rule: OrganizationRule}>): Record<string, typeof actions> {
    return actions.reduce((groups, action) => {
      if (!groups[action.destination]) {
        groups[action.destination] = [];
      }
      groups[action.destination].push(action);
      return groups;
    }, {} as Record<string, typeof actions>);
  }

  private async executeMoves(actions: Array<{file: string, destination: string, rule: OrganizationRule}>): Promise<void> {
    console.log('\n🚀 Executing file moves...');

    for (const action of actions) {
      await this.executeMove(action);
    }
  }

  private async executeMove(action: {file: string, destination: string, rule: OrganizationRule}): Promise<void> {
    const sourcePath = path.join(this.rootDir, action.file);
    const destDir = path.join(this.rootDir, action.destination);
    const destPath = path.join(destDir, action.file);

    try {
      // Create destination directory if it doesn't exist
      await fs.mkdir(destDir, { recursive: true });

      // Move the file
      await fs.rename(sourcePath, destPath);

      if (this.verbose) {
        console.log(`✅ Moved ${action.file} -> ${action.destination}/`);
      }
    } catch (error) {
      console.error(`❌ Failed to move ${action.file}: ${error}`);
    }
  }

  async identifyUnusedDirectories(): Promise<string[]> {
    const unusedDirs: string[] = [];
    const entries = await fs.readdir(this.rootDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const dirPath = path.join(this.rootDir, entry.name);
        const isEmpty = await this.isDirectoryEmpty(dirPath);
        const isObsolete = await this.isDirectoryObsolete(entry.name, dirPath);
        
        if (isEmpty || isObsolete) {
          unusedDirs.push(entry.name);
        }
      }
    }
    
    return unusedDirs;
  }

  private async isDirectoryEmpty(dirPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dirPath);
      return entries.length === 0;
    } catch {
      return false;
    }
  }

  private async isDirectoryObsolete(dirName: string, dirPath: string): Promise<boolean> {
    // Check for known obsolete directories
    const obsoletePatterns = [
      /^temp-/,
      /^old-/,
      /^backup-\d+/,
      /^archive/,
      /^deprecated/,
      /^unused/,
      /^legacy/
    ];

    return obsoletePatterns.some(pattern => pattern.test(dirName));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  const cleanUnused = args.includes('--clean-unused');
  
  const rootDir = process.cwd();
  const organizer = new FileOrganizer(rootDir, dryRun, verbose);

  try {
    await organizer.organize();

    if (cleanUnused) {
      console.log('\n🧹 Checking for unused directories...');
      const unusedDirs = await organizer.identifyUnusedDirectories();
      
      if (unusedDirs.length > 0) {
        console.log(`\n📋 Found ${unusedDirs.length} unused/empty directories:`);
        unusedDirs.forEach(dir => console.log(`   🗂️  ${dir}/`));
        
        if (!dryRun) {
          console.log('\n💡 Add --remove-unused to delete these directories');
        }
      } else {
        console.log('✅ No unused directories found');
      }
    }

  } catch (error) {
    console.error('❌ Error during file organization:', error);
    process.exit(1);
  }
}

// Export for use as module
export { FileOrganizer, ORGANIZATION_RULES, PROTECTED_FILES };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}