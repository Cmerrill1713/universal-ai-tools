#!/usr/bin/env tsx
/**
 * Organize root directory files into proper structure
 * Creates a "tree of truth" for the project
 */

import fs from 'fs';
import path from 'path';

interface FileMove {
  source: string;
  destination: string;
  category: string;
}

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

class ProjectOrganizer {
  private rootDir = process.cwd();
  private moves: FileMove[] = [];
  private deletes: string[] = [];
  private keeps: string[] = [];

  async organize() {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🧹 Universal AI Tools - Root Directory Cleanup\n');
    console.log(
      DRY_RUN
        ? '🔍 DRY RUN MODE - No files will be moved\n'
        : '⚠️  LIVE MODE - Files will be moved!\n'
    );

    // Create directory structure
    this.createDirectoryStructure();

    // Analyze and categorize files
    this.categorizeFiles();

    // Show summary
    this.showSummary();

    // Execute moves if not dry run
    if (!DRY_RUN && this.confirmAction()) {
      await this.executeMoves();
      await this.executeDeletes();
      this.createTreeOfTruth();
    }
  }

  private createDirectoryStructure() {
    const directories = [
      'scripts/testing',
      'scripts/startup',
      'scripts/ue5',
      'scripts/sweet-athena',
      'scripts/pixel-streaming',
      'scripts/db',
      'scripts/debug',
      'scripts/checks',
      'scripts/validation',
      'scripts/security',
      'examples/demos',
      'examples/integrations',
      'examples/models',
      'docs/html',
      'docs/guides',
      'docs/test-reports',
      'docs/sweet-athena',
      'docs/ue5',
      'assets/icons',
      'config/environments',
      'tests/html',
      'tests/integration',
      'tests/e2e',
      'tests/performance',
      'archive/old-tests',
    ];

    if (!DRY_RUN) {
      directories.forEach((dir) => {
        const fullPath = path.join(this.rootDir, dir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
          console.log(`📁 Created directory: ${dir}`);
        }
      });
    } else {
      console.log('📁 Would create directories:', directories.join(', '));
    }
  }

  private categorizeFiles() {
    const files = fs.readdirSync(this.rootDir);

    files.forEach((file) => {
      const filePath = path.join(this.rootDir, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        this.categorizeFile(file);
      }
    });
  }

  private categorizeFile(file: string) {
    // Essential config files to keep in root
    const keepInRoot = [
      '.eslintrc.js',
      '.eslintrc.json',
      '.eslintrc.autofix.json',
      '.prettierrc',
      '.prettierignore',
      '.gitignore',
      '.gitattributes',
      '.env.example',
      '.env.test',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'tsconfig.node.json',
      'jest.config.js',
      'jest.config.simple.js',
      'jest.browser.config.js',
      'playwright.config.ts',
      'puppeteer.config.js',
      'webpack.config.js',
      'webpack.config.prod.js',
      'Dockerfile',
      'Dockerfile.prod',
      'Dockerfile.dashboard',
      'Dockerfile.sweet-athena',
      'docker-compose.yml',
      'docker-compose.dev.yml',
      'docker-compose.prod.yml',
      'docker-compose.sweet-athena.yml',
      'README.md',
      'LICENSE',
      'CHANGELOG.md',
      'pyproject.toml',
      'requirements.txt',
      'typedoc.json',
      'renovate.json',
      'commitlint.config.js',
      'install.sh',
      'release.sh',
      'build-production.sh',
      'deploy-production.sh',
    ];

    // Files to delete
    const deletePatterns = [
      /\.log$/,
      /\.pid$/,
      /^server-debug[0-9]+\.log$/,
      /^test-.*\.log$/,
      /^demo.*\.log$/,
      /^dev-server.*\.log$/,
      /^frontend.*\.log$/,
      /^backend.*\.log$/,
      /^ui-dev-server\.log$/,
      /^minimal-server\.log$/,
      /^dspy-.*\.log$/,
      /^sweet-athena.*\.log$/,
      /^signaling-server\.log$/,
      /load-test-report\.json$/, // Old test report
    ];

    // Move patterns
    const movePatterns: Array<{
      pattern: RegExp | ((file: string) => boolean);
      destination: string;
    }> = [
      // Test report markdown files
      { pattern: /.*TEST.*\.md$/i, destination: 'docs/test-reports' },
      { pattern: /.*TESTING.*\.md$/i, destination: 'docs/test-reports' },
      { pattern: /^ACTUAL_TEST_RESULTS\.md$/, destination: 'docs/test-reports' },
      { pattern: /^MODEL_TESTING_RESULTS\.md$/, destination: 'docs/test-reports' },
      { pattern: /^REAL_WORLD_TEST_RESULTS\.md$/, destination: 'docs/test-reports' },
      { pattern: /^USER_ACCEPTANCE_TESTING\.md$/, destination: 'docs/test-reports' },

      // Test HTML files
      { pattern: /^test-.*\.html$/, destination: 'tests/html' },
      { pattern: /^minimal-test\.html$/, destination: 'tests/html' },

      // Test scripts
      { pattern: /^test-.*\.(js|ts|mjs|cjs)$/, destination: 'scripts/testing' },
      { pattern: /^test-.*\.sh$/, destination: 'scripts/testing' },
      { pattern: /^run-.*test.*\.(js|ts|sh)$/, destination: 'scripts/testing' },
      { pattern: /^check-.*\.(js|ts|sh)$/, destination: 'scripts/checks' },
      { pattern: /^validate-.*\.(js|ts|cjs)$/, destination: 'scripts/validation' },
      { pattern: /^verify-.*\.(sh|js)$/, destination: 'scripts/validation' },

      // Security test files
      { pattern: /security-test.*\.(js|ts|mjs)$/, destination: 'scripts/security' },
      { pattern: /test-security.*\.(js|mjs)$/, destination: 'scripts/security' },
      { pattern: /test-auth.*\.js$/, destination: 'scripts/security' },

      // Startup scripts
      { pattern: /^start-.*\.(sh|js|mjs|ts)$/, destination: 'scripts/startup' },
      { pattern: /^run-.*\.(js|ts|sh)$/, destination: 'scripts/startup' },
      { pattern: /^launch-.*\.sh$/, destination: 'scripts/startup' },

      // Debug scripts
      { pattern: /^debug-.*\.(js|ts|sh)$/, destination: 'scripts/debug' },
      { pattern: /^diagnose-.*\.(sh|js)$/, destination: 'scripts/debug' },

      // Sweet Athena
      { pattern: /^sweet-athena-.*\.(js|mjs|sh)$/, destination: 'scripts/sweet-athena' },
      { pattern: /^sweet-athena-.*\.html$/, destination: 'docs/sweet-athena' },
      { pattern: /^sweet-athena-.*\.txt$/, destination: 'docs/sweet-athena' },

      // UE5 / Pixel Streaming
      { pattern: /^ue5-.*\.(py|sh|mjs|txt)$/, destination: 'scripts/ue5' },
      { pattern: /^ue5-.*\.html$/, destination: 'docs/ue5' },
      { pattern: /pixel-streaming.*\.(sh|js|mjs)$/, destination: 'scripts/pixel-streaming' },
      { pattern: /^signaling-server.*\.(js|mjs|cjs)$/, destination: 'scripts/pixel-streaming' },

      // HTML files
      { pattern: /^test-.*\.html$/, destination: 'docs/html' },
      { pattern: /^connect-.*\.html$/, destination: 'docs/html' },
      { pattern: /^diagnose-.*\.html$/, destination: 'docs/html' },
      { pattern: /viewer\.html$/, destination: 'docs/html' },

      // Database scripts
      { pattern: /\.sql$/, destination: 'scripts/db' },

      // Python test files
      { pattern: /^test-.*\.py$/, destination: 'scripts/testing' },
      { pattern: /^demo-.*\.py$/, destination: 'examples/demos' },
      { pattern: /^test-model.*\.py$/, destination: 'examples/models' },
      { pattern: /^test-all-models\.py$/, destination: 'examples/models' },
      { pattern: /^test-selected-models\.py$/, destination: 'examples/models' },
      { pattern: /^manage-models\.py$/, destination: 'examples/models' },
      { pattern: /^integrate-.*\.py$/, destination: 'examples/integrations' },

      // Test configuration files
      { pattern: /test-coverage\.config\.js$/, destination: 'config' },
      { pattern: /\.env\.test$/, destination: 'config/environments' },

      // Old server variations to archive
      { pattern: /^server-debug[0-9]*\.(ts|js|log)$/, destination: 'archive/old-tests' },
      { pattern: /^server-test.*\.(js|ts)$/, destination: 'archive/old-tests' },
      { pattern: /^server-.*-test\.(js|ts|log)$/, destination: 'archive/old-tests' },
      { pattern: /^test-server.*\.(js|ts)$/, destination: 'archive/old-tests' },

      // Server variations (keep most recent)
      {
        pattern: (f) => f.startsWith('server-minimal') && f !== 'server-minimal-fixed.ts',
        destination: 'scripts/archive',
      },

      // Documentation
      { pattern: /^.*_GUIDE\.md$/, destination: 'docs/guides' },
      { pattern: /^.*_REPORT\.md$/, destination: 'docs/guides' },
      { pattern: /Universal-AI-Tools-README\.txt$/, destination: 'docs' },
    ];

    // Check if should keep
    if (keepInRoot.includes(file)) {
      this.keeps.push(file);
      return;
    }

    // Check if should delete
    for (const pattern of deletePatterns) {
      if (pattern.test(file)) {
        this.deletes.push(file);
        return;
      }
    }

    // Check if should move
    for (const { pattern, destination } of movePatterns) {
      const matches = typeof pattern === 'function' ? pattern(file) : pattern.test(file);
      if (matches) {
        this.moves.push({
          source: file,
          destination: path.join(destination, file),
          category: destination,
        });
        return;
      }
    }

    // If not categorized, log for investigation
    if (VERBOSE) {
      console.log(`❓ Uncategorized: ${file}`);
    }
  }

  private showSummary() {
    console.log('\n📊 Cleanup Summary:');
    console.log('='.repeat(50));
    console.log(`📁 Files to keep in root: ${this.keeps.length}`);
    console.log(`📦 Files to move: ${this.moves.length}`);
    console.log(`🗑️  Files to delete: ${this.deletes.length}`);

    if (VERBOSE) {
      console.log('\n📦 Files to Move:');
      const categories = [...new Set(this.moves.map((m) => m.category))];
      categories.forEach((cat) => {
        const files = this.moves.filter((m) => m.category === cat);
        console.log(`\n  ${cat}/ (${files.length} files)`);
        files.forEach((f) => console.log(`    - ${f.source}`));
      });

      console.log('\n🗑️  Files to Delete:');
      this.deletes.forEach((f) => console.log(`  - ${f}`));
    }
  }

  private async confirmAction(): Promise<boolean> {
    if (process.env.CI) return true; // Auto-confirm in CI
    if (process.argv.includes('--yes')) return true; // Auto-confirm with flag

    console.log('\n⚠️  This will move/delete files. Continue? (y/N)');

    // For now, we'll use the --yes flag approach
    console.log('Run with --yes flag to confirm');
    return false;
  }

  private async executeMoves() {
    console.log('\n📦 Moving files...');
    let moved = 0;
    let failed = 0;

    for (const move of this.moves) {
      try {
        const sourcePath = path.join(this.rootDir, move.source);
        const destPath = path.join(this.rootDir, move.destination);

        // Create destination directory if needed
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Move file
        fs.renameSync(sourcePath, destPath);
        moved++;
        if (VERBOSE) {
          console.log(`  ✅ ${move.source} → ${move.destination}`);
        }
      } catch (error) {
        failed++;
        process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(`  ❌ Failed to move ${move.source}:`, error.message);
      }
    }

    console.log(`\n✅ Moved ${moved} files, ${failed} failures`);
  }

  private async executeDeletes() {
    console.log('\n🗑️  Deleting files...');
    let deleted = 0;
    let failed = 0;

    for (const file of this.deletes) {
      try {
        const filePath = path.join(this.rootDir, file);
        fs.unlinkSync(filePath);
        deleted++;
        if (VERBOSE) {
          console.log(`  ✅ Deleted ${file}`);
        }
      } catch (error) {
        failed++;
        console.error(`  ❌ Failed to delete ${file}:`, error.message);
      }
    }

    console.log(`\n✅ Deleted ${deleted} files, ${failed} failures`);
  }

  private createTreeOfTruth() {
    console.log('\n🌳 Creating tree of truth...');

    const tree = {
      ROOT_FILES: {
        Configuration: [
          '.eslintrc.js - ESLint configuration',
          '.prettierrc - Prettier formatting',
          'tsconfig.json - TypeScript configuration',
          'jest.config.js - Jest testing',
          'webpack.config.js - Webpack bundling',
        ],
        Package_Management: [
          'package.json - Node.js dependencies',
          'requirements.txt - Python dependencies',
          'pyproject.toml - Python project config',
        ],
        Docker: ['Dockerfile - Main container', 'docker-compose.yml - Service orchestration'],
        Documentation: [
          'README.md - Project overview',
          'LICENSE - MIT license',
          'CHANGELOG.md - Version history',
        ],
        Scripts: ['install.sh - Installation', 'release.sh - Release automation'],
      },
      DIRECTORY_STRUCTURE: {
        'src/': 'Source code (TypeScript)',
        'scripts/': {
          'testing/': 'Test scripts',
          'startup/': 'Startup and run scripts',
          'ue5/': 'Unreal Engine 5 integration',
          'sweet-athena/': 'Sweet Athena specific',
          'pixel-streaming/': 'Pixel streaming servers',
          'db/': 'Database scripts',
          'debug/': 'Debug utilities',
          'checks/': 'Validation scripts',
        },
        'tests/': 'Test files',
        'docs/': {
          'html/': 'HTML documentation',
          'guides/': 'Markdown guides',
          'sweet-athena/': 'Sweet Athena docs',
          'ue5/': 'UE5 documentation',
        },
        'examples/': {
          'demos/': 'Demo scripts',
          'integrations/': 'Integration examples',
          'models/': 'Model management',
        },
        'supabase/': 'Database migrations',
        'ui/': 'Frontend React app',
        'logs/': 'Log files (gitignored)',
        'dist/': 'Build output (gitignored)',
        'node_modules/': 'Dependencies (gitignored)',
      },
    };

    const treePath = path.join(this.rootDir, 'TREE_OF_TRUTH.json');
    fs.writeFileSync(treePath, JSON.stringify(tree, null, 2));
    console.log(`✅ Created ${treePath}`);

    // Also create a markdown version
    const mdPath = path.join(this.rootDir, 'PROJECT_STRUCTURE.md');
    const mdContent = this.generateMarkdownTree(tree);
    fs.writeFileSync(mdPath, mdContent);
    console.log(`✅ Created ${mdPath}`);
  }

  private generateMarkdownTree(tree: unknown, indent = ''): string {
    let md = '';
    for (const [key, value] of Object.entries(tree)) {
      if (typeof value === 'string') {
        md += `${indent}- **${key}**: ${value}\n`;
      } else if (Array.isArray(value)) {
        md += `${indent}- **${key}**:\n`;
        value.forEach((item) => {
          md += `${indent}  - ${item}\n`;
        });
      } else {
        md += `${indent}- **${key}**:\n`;
        md += this.generateMarkdownTree(value, indent + '  ');
      }
    }
    return md;
  }
}

// Run the organizer
const organizer = new ProjectOrganizer();
organizer.organize().catch(console.error);

// Usage instructions
if (process.argv.includes('--help')) {
  console.log(`
Usage: tsx scripts/organize-root-files.ts [options]

Options:
  --dry-run    Show what would be done without making changes
  --verbose    Show detailed file listings
  --help       Show this help message

Example:
  npm run organize:dry-run
  npm run organize
`);
  process.exit(0);
}
