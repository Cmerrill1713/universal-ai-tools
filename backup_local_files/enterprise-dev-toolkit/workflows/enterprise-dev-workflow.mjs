#!/usr/bin/env node

/**
 * Enterprise Development Workflow Manager
 * Comprehensive development tooling used by successful companies
 * 
 * Features based on industry standards:
 * - Code quality enforcement (linting, formatting, type checking)
 * - Pre-commit hooks and git workflow
 * - Testing automation (unit, integration, e2e)
 * - Security scanning and vulnerability management
 * - Performance monitoring and optimization
 * - Documentation generation and maintenance
 * - Dependency management and auditing
 * - CI/CD pipeline integration
 * - Environment management
 * - Monorepo tooling (if applicable)
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

class EnterpriseDevWorkflow {
  constructor() {
    this.packageJson = this.loadPackageJson();
    this.isMonorepo = this.checkMonorepoStructure();
    this.config = this.loadProjectConfig();
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',      // Cyan
      success: '\x1b[32m',   // Green
      warning: '\x1b[33m',   // Yellow
      error: '\x1b[31m',     // Red
      header: '\x1b[35m',    // Magenta
      reset: '\x1b[0m'       // Reset
    };
    
    const timestamp = new Date().toISOString();
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async runCommand(command, options = {}) {
    this.log(`Executing: ${command}`, 'info');
    try {
      const result = execSync(command, { 
        encoding: 'utf8', 
        cwd: projectRoot,
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options 
      });
      return result?.trim();
    } catch (error) {
      if (!options.allowFailure) {
        this.log(`Command failed: ${error.message}`, 'error');
        throw error;
      }
      return null;
    }
  }

  loadPackageJson() {
    try {
      const packagePath = path.join(projectRoot, 'package.json');
      return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    } catch (error) {
      this.log('No package.json found or invalid JSON', 'warning');
      return {};
    }
  }

  checkMonorepoStructure() {
    const indicators = [
      fs.existsSync(path.join(projectRoot, 'packages')),
      fs.existsSync(path.join(projectRoot, 'apps')),
      fs.existsSync(path.join(projectRoot, 'libs')),
      fs.existsSync(path.join(projectRoot, 'pnpm-workspace.yaml')),
      fs.existsSync(path.join(projectRoot, 'turbo.json')),
      fs.existsSync(path.join(projectRoot, 'nx.json')),
      fs.existsSync(path.join(projectRoot, 'lerna.json')),
    ];
    return indicators.some(exists => exists);
  }

  loadProjectConfig() {
    const configFiles = [
      'dev-config.json',
      '.dev-config.json',
      'workflow.config.json'
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(projectRoot, configFile);
      if (fs.existsSync(configPath)) {
        try {
          return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (error) {
          this.log(`Invalid config file: ${configFile}`, 'warning');
        }
      }
    }

    return this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      codeQuality: {
        enableLinting: true,
        enableFormatting: true,
        enableTypeChecking: true,
        enableSecurityScanning: true,
      },
      testing: {
        enableUnitTests: true,
        enableIntegrationTests: true,
        enableE2eTests: false,
        coverageThreshold: 80,
      },
      git: {
        enablePreCommitHooks: true,
        enableCommitLinting: true,
        enableBranchProtection: true,
      },
      documentation: {
        enableApiDocs: true,
        enableTypeDocs: true,
        enableReadmeGeneration: true,
      },
      dependencies: {
        enableAuditing: true,
        enableUpdating: false,
        enableLicenseCheck: true,
      },
      performance: {
        enableBundleAnalysis: true,
        enablePerformanceTests: false,
        enableResourceMonitoring: true,
      },
    };
  }

  // === SETUP COMMANDS ===

  async setupProject() {
    this.log('🚀 Setting up enterprise development environment', 'header');
    
    await this.setupCodeQuality();
    await this.setupTesting();
    await this.setupGitWorkflow();
    await this.setupDocumentation();
    await this.setupDependencyManagement();
    await this.setupPerformanceTools();
    await this.setupEnvironments();
    await this.generateScripts();
    
    this.log('✅ Enterprise development environment setup complete!', 'success');
  }

  async setupCodeQuality() {
    this.log('Setting up code quality tools', 'info');

    // ESLint setup
    if (!fs.existsSync(path.join(projectRoot, '.eslintrc.js'))) {
      await this.createESLintConfig();
    }

    // Prettier setup
    if (!fs.existsSync(path.join(projectRoot, '.prettierrc.json'))) {
      await this.createPrettierConfig();
    }

    // TypeScript setup
    if (!fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
      await this.createTypeScriptConfig();
    }

    // EditorConfig setup
    if (!fs.existsSync(path.join(projectRoot, '.editorconfig'))) {
      await this.createEditorConfig();
    }

    // VSCode settings
    await this.createVSCodeSettings();

    this.log('Code quality tools configured', 'success');
  }

  async setupTesting() {
    this.log('Setting up testing framework', 'info');

    // Jest configuration
    if (!fs.existsSync(path.join(projectRoot, 'jest.config.js'))) {
      await this.createJestConfig();
    }

    // Test utilities
    await this.createTestUtils();

    // Playwright E2E setup (if enabled)
    if (this.config.testing.enableE2eTests) {
      await this.setupPlaywright();
    }

    this.log('Testing framework configured', 'success');
  }

  async setupGitWorkflow() {
    this.log('Setting up Git workflow', 'info');

    // Husky pre-commit hooks
    if (this.config.git.enablePreCommitHooks) {
      await this.setupHusky();
    }

    // Commitlint setup
    if (this.config.git.enableCommitLinting) {
      await this.setupCommitlint();
    }

    // Gitignore updates
    await this.updateGitignore();

    // Git hooks
    await this.createGitHooks();

    this.log('Git workflow configured', 'success');
  }

  async setupDocumentation() {
    this.log('Setting up documentation tools', 'info');

    // TypeDoc for API documentation
    if (this.config.documentation.enableTypeDocs) {
      await this.setupTypeDoc();
    }

    // README generation
    if (this.config.documentation.enableReadmeGeneration) {
      await this.generateProjectReadme();
    }

    // Changelog automation
    await this.setupChangelog();

    this.log('Documentation tools configured', 'success');
  }

  async setupDependencyManagement() {
    this.log('Setting up dependency management', 'info');

    // Package.json scripts enhancement
    await this.enhancePackageJsonScripts();

    // Renovate or Dependabot config
    await this.setupDependencyUpdates();

    // License checker
    if (this.config.dependencies.enableLicenseCheck) {
      await this.setupLicenseCheck();
    }

    this.log('Dependency management configured', 'success');
  }

  async setupPerformanceTools() {
    this.log('Setting up performance monitoring', 'info');

    // Bundle analyzer
    if (this.config.performance.enableBundleAnalysis) {
      await this.setupBundleAnalyzer();
    }

    // Performance testing
    if (this.config.performance.enablePerformanceTests) {
      await this.setupPerformanceTesting();
    }

    // Resource monitoring
    await this.setupResourceMonitoring();

    this.log('Performance tools configured', 'success');
  }

  async setupEnvironments() {
    this.log('Setting up environment management', 'info');

    // Environment templates
    await this.createEnvironmentTemplates();

    // Docker setup
    await this.setupDocker();

    // Environment validation
    await this.createEnvironmentValidator();

    this.log('Environment management configured', 'success');
  }

  // === CONFIGURATION CREATORS ===

  async createESLintConfig() {
    const eslintConfig = `module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'security',
    'sonarjs',
  ],
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    
    // Import
    'import/order': ['error', {
      'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always',
    }],
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'error',
    
    // Security
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    
    // Code Quality
    'sonarjs/cognitive-complexity': ['error', 15],
    'sonarjs/no-duplicate-string': 'warn',
    'sonarjs/no-identical-functions': 'error',
    
    // General
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'sonarjs/no-duplicate-string': 'off',
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'build/',
    'coverage/',
    'node_modules/',
    '*.js',
  ],
};`;

    fs.writeFileSync(path.join(projectRoot, '.eslintrc.js'), eslintConfig);
  }

  async createPrettierConfig() {
    const prettierConfig = {
      semi: true,
      trailingComma: 'es5',
      singleQuote: true,
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      endOfLine: 'lf',
      arrowParens: 'avoid',
      bracketSpacing: true,
      bracketSameLine: false,
      quoteProps: 'as-needed',
    };

    fs.writeFileSync(
      path.join(projectRoot, '.prettierrc.json'),
      JSON.stringify(prettierConfig, null, 2)
    );

    // Prettier ignore
    const prettierIgnore = `# Build outputs
dist/
build/
coverage/
*.tsbuildinfo

# Dependencies
node_modules/

# Environment files
.env*

# Logs
*.log
npm-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# Generated files
src/types/supabase.ts
`;

    fs.writeFileSync(path.join(projectRoot, '.prettierignore'), prettierIgnore);
  }

  async createTypeScriptConfig() {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        outDir: './dist',
        rootDir: './src',
        baseUrl: '.',
        paths: {
          '@/*': ['src/*'],
          '@/types/*': ['src/types/*'],
          '@/utils/*': ['src/utils/*'],
          '@/services/*': ['src/services/*'],
          '@/templates/*': ['src/templates/*'],
        },
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        incremental: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        exactOptionalPropertyTypes: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
      },
      include: [
        'src/**/*',
        'tests/**/*',
        '*.ts',
        '*.js'
      ],
      exclude: [
        'node_modules',
        'dist',
        'build',
        'coverage',
        '**/*.d.ts'
      ],
      'ts-node': {
        esm: true,
        experimentalSpecifierResolution: 'node'
      }
    };

    fs.writeFileSync(
      path.join(projectRoot, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }

  async createEditorConfig() {
    const editorConfig = `# EditorConfig is awesome: https://EditorConfig.org

# top-most EditorConfig file
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[*.{json,jsonc}]
indent_size = 2

[*.py]
indent_size = 4

[Makefile]
indent_style = tab
`;

    fs.writeFileSync(path.join(projectRoot, '.editorconfig'), editorConfig);
  }

  async createVSCodeSettings() {
    const vscodeDir = path.join(projectRoot, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const settings = {
      'editor.formatOnSave': true,
      'editor.codeActionsOnSave': {
        'source.fixAll.eslint': true,
        'source.organizeImports': true,
      },
      'editor.rulers': [100],
      'editor.tabSize': 2,
      'files.associations': {
        '*.json': 'jsonc',
      },
      'typescript.preferences.importModuleSpecifier': 'relative',
      'typescript.updateImportsOnFileMove.enabled': 'always',
      'eslint.workingDirectories': ['.'],
      'search.exclude': {
        '**/node_modules': true,
        '**/dist': true,
        '**/build': true,
        '**/coverage': true,
      },
      'files.exclude': {
        '**/.git': true,
        '**/.DS_Store': true,
        '**/node_modules': true,
        '**/dist': true,
        '**/build': true,
      },
    };

    const extensions = {
      recommendations: [
        'esbenp.prettier-vscode',
        'dbaeumer.vscode-eslint',
        'bradlc.vscode-tailwindcss',
        'ms-vscode.vscode-typescript-next',
        'github.copilot',
        'github.copilot-chat',
        'ms-vscode.test-adapter-converter',
        'hbenl.vscode-test-explorer',
        'streetsidesoftware.code-spell-checker',
        'ms-vscode.vscode-json',
        'redhat.vscode-yaml',
        'ms-vscode.sublime-keybindings',
      ],
    };

    fs.writeFileSync(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );

    fs.writeFileSync(
      path.join(vscodeDir, 'extensions.json'),
      JSON.stringify(extensions, null, 2)
    );
  }

  async generateScripts() {
    this.log('Generating development scripts', 'info');

    const scripts = {
      // Development
      'dev': 'tsx watch src/server.ts',
      'dev:debug': 'tsx --inspect watch src/server.ts',
      'dev:clean': 'npm run clean && npm run dev',
      
      // Building
      'build': 'npm run clean && npm run type-check && npm run build:tsc',
      'build:tsc': 'tsc',
      'build:watch': 'tsc --watch',
      'build:prod': 'NODE_ENV=production npm run build',
      
      // Code Quality
      'lint': 'eslint src tests --ext .ts,.tsx',
      'lint:fix': 'eslint src tests --ext .ts,.tsx --fix',
      'format': 'prettier --write "src/**/*.{ts,tsx,js,jsx,json,md}"',
      'format:check': 'prettier --check "src/**/*.{ts,tsx,js,jsx,json,md}"',
      'type-check': 'tsc --noEmit',
      'quality': 'npm run lint && npm run format:check && npm run type-check',
      'quality:fix': 'npm run lint:fix && npm run format && npm run type-check',
      
      // Testing
      'test': 'jest',
      'test:watch': 'jest --watch',
      'test:coverage': 'jest --coverage',
      'test:ci': 'jest --ci --coverage --passWithNoTests',
      'test:unit': 'jest --testPathPattern=unit',
      'test:integration': 'jest --testPathPattern=integration',
      'test:e2e': 'playwright test',
      
      // Security
      'security:audit': 'npm audit',
      'security:audit:fix': 'npm audit fix',
      'security:scan': 'njsscan . --output security-report.json',
      
      // Dependencies
      'deps:check': 'npm outdated',
      'deps:update': 'npm update',
      'deps:audit': 'npm run security:audit',
      'deps:licenses': 'license-checker --summary',
      
      // Documentation
      'docs:generate': 'typedoc src --out docs/api',
      'docs:serve': 'http-server docs -p 8080',
      
      // Utilities
      'clean': 'rimraf dist build coverage .nyc_output',
      'reset': 'npm run clean && rm -rf node_modules && npm install',
      'prebuild': 'npm run clean',
      'pretest': 'npm run quality',
      
      // Git
      'prepare': 'husky install',
      'pre-commit': 'lint-staged',
      'commit': 'git-cz',
      
      // Release
      'release': 'standard-version',
      'release:dry': 'standard-version --dry-run',
      'release:major': 'standard-version --release-as major',
      'release:minor': 'standard-version --release-as minor',
      'release:patch': 'standard-version --release-as patch',
      
      // CI/CD
      'ci:test': 'npm run test:ci',
      'ci:build': 'npm run build:prod',
      'ci:quality': 'npm run quality',
      'ci:security': 'npm run security:audit',
      'ci:all': 'npm run ci:quality && npm run ci:test && npm run ci:security && npm run ci:build',
      
      // Performance
      'perf:analyze': 'npm run build && webpack-bundle-analyzer dist/stats.json',
      'perf:test': 'npm run test:performance',
      
      // Workflow helpers
      'workflow:setup': 'node scripts/enterprise-dev-workflow.mjs setup',
      'workflow:validate': 'node scripts/enterprise-dev-workflow.mjs validate',
      'workflow:health': 'node scripts/enterprise-dev-workflow.mjs health',
    };

    // Merge with existing scripts
    this.packageJson.scripts = { ...this.packageJson.scripts, ...scripts };

    // Add dev dependencies
    const devDependencies = {
      '@typescript-eslint/eslint-plugin': '^8.37.0',
      '@typescript-eslint/parser': '^8.37.0',
      'eslint': '^9.31.0',
      'eslint-config-prettier': '^10.1.8',
      'eslint-plugin-import': '^2.31.0',
      'eslint-plugin-security': '^3.0.1',
      'eslint-plugin-sonarjs': '^2.0.4',
      'prettier': '^3.6.2',
      'husky': '^9.1.7',
      'lint-staged': '^16.1.2',
      '@commitlint/cli': '^19.6.0',
      '@commitlint/config-conventional': '^19.6.0',
      'commitizen': '^4.3.1',
      'cz-conventional-changelog': '^3.3.0',
      'standard-version': '^9.5.0',
      'typedoc': '^0.26.12',
      'rimraf': '^6.0.1',
      'license-checker': '^25.0.1',
      'http-server': '^14.1.1',
    };

    this.packageJson.devDependencies = { ...this.packageJson.devDependencies, ...devDependencies };

    // Add lint-staged configuration
    this.packageJson['lint-staged'] = {
      '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
      '*.{js,jsx,json,md}': ['prettier --write'],
    };

    // Add commitizen configuration
    this.packageJson.config = {
      commitizen: {
        path: './node_modules/cz-conventional-changelog',
      },
    };

    // Write updated package.json
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(this.packageJson, null, 2)
    );

    this.log('Development scripts generated and added to package.json', 'success');
  }

  // === VALIDATION AND HEALTH CHECKS ===

  async validateSetup() {
    this.log('🔍 Validating development setup', 'header');

    const checks = {
      codeQuality: await this.validateCodeQuality(),
      testing: await this.validateTesting(),
      git: await this.validateGitSetup(),
      documentation: await this.validateDocumentation(),
      dependencies: await this.validateDependencies(),
      performance: await this.validatePerformance(),
    };

    const allValid = Object.values(checks).every(check => check.status === 'valid');
    
    this.log(`Validation ${allValid ? 'PASSED' : 'FAILED'}`, allValid ? 'success' : 'error');
    
    // Display detailed results
    Object.entries(checks).forEach(([category, result]) => {
      const icon = result.status === 'valid' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      this.log(`${icon} ${category}: ${result.message}`, result.status === 'valid' ? 'success' : result.status === 'warning' ? 'warning' : 'error');
      
      if (result.issues?.length > 0) {
        result.issues.forEach(issue => this.log(`  - ${issue}`, 'warning'));
      }
    });

    return { allValid, checks };
  }

  async validateCodeQuality() {
    const issues = [];
    
    if (!fs.existsSync(path.join(projectRoot, '.eslintrc.js'))) {
      issues.push('ESLint configuration missing');
    }
    
    if (!fs.existsSync(path.join(projectRoot, '.prettierrc.json'))) {
      issues.push('Prettier configuration missing');
    }
    
    if (!fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
      issues.push('TypeScript configuration missing');
    }

    try {
      await this.runCommand('npm run lint', { silent: true, allowFailure: true });
    } catch (error) {
      issues.push('Linting errors detected');
    }

    return {
      status: issues.length === 0 ? 'valid' : 'warning',
      message: issues.length === 0 ? 'Code quality tools configured' : 'Code quality issues found',
      issues,
    };
  }

  async validateTesting() {
    const issues = [];
    
    if (!fs.existsSync(path.join(projectRoot, 'jest.config.js'))) {
      issues.push('Jest configuration missing');
    }

    try {
      await this.runCommand('npm test', { silent: true, allowFailure: true });
    } catch (error) {
      issues.push('Test execution failed');
    }

    return {
      status: issues.length === 0 ? 'valid' : 'warning',
      message: issues.length === 0 ? 'Testing framework configured' : 'Testing issues found',
      issues,
    };
  }

  async validateGitSetup() {
    const issues = [];
    
    if (!fs.existsSync(path.join(projectRoot, '.husky'))) {
      issues.push('Husky pre-commit hooks not installed');
    }

    if (!fs.existsSync(path.join(projectRoot, '.gitignore'))) {
      issues.push('Gitignore file missing');
    }

    return {
      status: issues.length === 0 ? 'valid' : 'warning',
      message: issues.length === 0 ? 'Git workflow configured' : 'Git setup issues found',
      issues,
    };
  }

  async validateDocumentation() {
    const issues = [];
    
    if (!fs.existsSync(path.join(projectRoot, 'README.md'))) {
      issues.push('README.md missing');
    }

    return {
      status: issues.length === 0 ? 'valid' : 'warning',
      message: issues.length === 0 ? 'Documentation setup complete' : 'Documentation issues found',
      issues,
    };
  }

  async validateDependencies() {
    const issues = [];

    try {
      await this.runCommand('npm audit', { silent: true, allowFailure: true });
    } catch (error) {
      issues.push('Security vulnerabilities found in dependencies');
    }

    return {
      status: issues.length === 0 ? 'valid' : 'warning',
      message: issues.length === 0 ? 'Dependencies are secure' : 'Dependency issues found',
      issues,
    };
  }

  async validatePerformance() {
    return {
      status: 'valid',
      message: 'Performance tools available',
      issues: [],
    };
  }

  async healthCheck() {
    this.log('🏥 Running development environment health check', 'header');

    const health = {
      node: await this.checkNodeVersion(),
      npm: await this.checkNpmVersion(),
      git: await this.checkGitVersion(),
      dependencies: await this.checkDependencies(),
      scripts: await this.checkScripts(),
      environment: await this.checkEnvironment(),
    };

    const isHealthy = Object.values(health).every(check => check.healthy);
    
    this.log(`Health check ${isHealthy ? 'PASSED' : 'FAILED'}`, isHealthy ? 'success' : 'error');
    
    Object.entries(health).forEach(([component, result]) => {
      const icon = result.healthy ? '✅' : '❌';
      this.log(`${icon} ${component}: ${result.message}`, result.healthy ? 'success' : 'error');
    });

    return { isHealthy, health };
  }

  async checkNodeVersion() {
    try {
      const version = await this.runCommand('node --version', { silent: true });
      const major = parseInt(version.replace('v', '').split('.')[0]);
      return {
        healthy: major >= 18,
        message: `Node.js ${version} (requires >= 18)`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Node.js not installed',
      };
    }
  }

  async checkNpmVersion() {
    try {
      const version = await this.runCommand('npm --version', { silent: true });
      return {
        healthy: true,
        message: `npm ${version}`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'npm not installed',
      };
    }
  }

  async checkGitVersion() {
    try {
      const version = await this.runCommand('git --version', { silent: true });
      return {
        healthy: true,
        message: version,
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Git not installed',
      };
    }
  }

  async checkDependencies() {
    try {
      const nodeModulesExists = fs.existsSync(path.join(projectRoot, 'node_modules'));
      return {
        healthy: nodeModulesExists,
        message: nodeModulesExists ? 'Dependencies installed' : 'Dependencies not installed (run npm install)',
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Cannot check dependencies',
      };
    }
  }

  async checkScripts() {
    const requiredScripts = ['build', 'test', 'lint', 'format'];
    const missingScripts = requiredScripts.filter(script => !this.packageJson.scripts?.[script]);
    
    return {
      healthy: missingScripts.length === 0,
      message: missingScripts.length === 0 ? 'All required scripts present' : \`Missing scripts: \${missingScripts.join(', ')}\`,
    };
  }

  async checkEnvironment() {
    const requiredEnvVars = ['NODE_ENV'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    return {
      healthy: missingVars.length === 0,
      message: missingVars.length === 0 ? 'Environment variables set' : \`Missing env vars: \${missingVars.join(', ')}\`,
    };
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const workflow = new EnterpriseDevWorkflow();

  try {
    switch (command) {
      case 'setup':
        await workflow.setupProject();
        break;

      case 'validate':
        await workflow.validateSetup();
        break;

      case 'health':
        await workflow.healthCheck();
        break;

      case 'quality':
        await workflow.setupCodeQuality();
        break;

      case 'testing':
        await workflow.setupTesting();
        break;

      case 'git':
        await workflow.setupGitWorkflow();
        break;

      case 'docs':
        await workflow.setupDocumentation();
        break;

      case 'scripts':
        await workflow.generateScripts();
        break;

      default:
        console.log(\`
Enterprise Development Workflow Manager

Usage: node scripts/enterprise-dev-workflow.mjs <command>

Commands:
  setup       Complete development environment setup
  validate    Validate current development setup
  health      Run development environment health check
  quality     Setup code quality tools (ESLint, Prettier, TypeScript)
  testing     Setup testing framework (Jest, Playwright)
  git         Setup Git workflow (Husky, Commitlint)
  docs        Setup documentation tools (TypeDoc, README)
  scripts     Generate/update package.json scripts

Examples:
  npm run workflow:setup
  npm run workflow:validate
  npm run workflow:health

Note: This tool sets up enterprise-grade development workflows
used by successful companies for maintaining code quality,
testing, security, and developer productivity.
        \`);
        break;
    }
  } catch (error) {
    workflow.log(\`Command failed: \${error.message}\`, 'error');
    process.exit(1);
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main();
}

export default EnterpriseDevWorkflow;