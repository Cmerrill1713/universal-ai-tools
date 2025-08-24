import React from 'react';
#!/usr/bin/env node
/**
 * Auto-fix code quality issues
 * This script runs various tools to automatically fix code issues
 */

import { execSync } from 'child_process';
import { logger } from '../src/utils/enhanced-logger';
import fs from 'fs';
import path from 'path';

const AUTO_FIX_CONFIG = {
  // ESLint auto-fix
  eslint: {
    command: 'npx eslint --config .eslintrc.autofix.json --fix',
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    paths: ['src', 'tests', 'scripts'],
  },

  // Prettier formatting
  prettier: {
    command: 'npx prettier --write',
    patterns: [
      'src/**/*.{ts,tsx,js,jsx,json}',
      'tests/**/*.{ts,tsx,js,jsx,json}',
      'scripts/**/*.{ts,tsx,js,jsx,json}',
      '*.{json,md,yml,yaml}',
      '.github/**/*.{yml,yaml}',
    ],
  },

  // TypeScript imports organization
  organizeImports: {
    command: 'npx organize-imports-cli',
    pattern: 'src/**/*.{ts,tsx}',
  },

  // Remove unused imports
  unusedImports: {
    command: 'npx ts-prune',
    configFile: 'tsconfig.json',
  },
};

async function runAutoFix() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔧 Running comprehensive code auto-fix...\n');

  try {
    // 1. Run ESLint auto-fix
    console.log('📝 Running ESLint auto-fix...');
    for (const pathDir of AUTO_FIX_CONFIG.eslint.paths) {
      if (fs.existsSync(pathDir)) {
        const extensions = AUTO_FIX_CONFIG.eslint.extensions.join(',');
        const command = `${AUTO_FIX_CONFIG.eslint.command} ${pathDir} --ext ${extensions}`;
        try {
          execSync(command, { stdio: 'inherit' });
          console.log(`✅ ESLint auto-fix completed for ${pathDir}`);
        } catch (error) {
          process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.warn(`⚠️  ESLint auto-fix had issues in ${pathDir}, continuing...`);
        }
      }
    }

    // 2. Run Prettier
    console.log('\n🎨 Running Prettier formatting...');
    for (const pattern of AUTO_FIX_CONFIG.prettier.patterns) {
      const command = `${AUTO_FIX_CONFIG.prettier.command} "${pattern}"`;
      try {
        execSync(command, { stdio: 'inherit' });
        console.log(`✅ Prettier formatted: ${pattern}`);
      } catch (error) {
        console.warn(`⚠️  Prettier had issues with ${pattern}, continuing...`);
      }
    }

    // 3. Organize imports (if package is installed)
    console.log('\n📦 Organizing imports...');
    try {
      execSync(
        `${AUTO_FIX_CONFIG.organizeImports.command} "${AUTO_FIX_CONFIG.organizeImports.pattern}"`,
        {
          stdio: 'inherit',
        }
      );
      console.log('✅ Import organization completed');
    } catch (error) {
      console.log('ℹ️  Import organization skipped (install organize-imports-cli if needed)');
    }

    // 4. Check for unused exports
    console.log('\n🔍 Checking for unused exports...');
    try {
      const unusedExports = execSync(AUTO_FIX_CONFIG.unusedImports.command, {
        encoding: 'utf-8',
      });
      if (unusedExports.trim()) {
        console.log('⚠️  Found unused exports:');
        console.log(unusedExports);
      } else {
        console.log('✅ No unused exports found');
      }
    } catch (error) {
      console.log('ℹ️  Unused export check skipped (install ts-prune if needed)');
    }

    // 5. Fix common patterns
    console.log('\n🔧 Fixing common code patterns...');
    fixCommonPatterns();

    console.log('\n✨ Auto-fix completed successfully!');
    console.log('\n💡 Recommendations:');
    console.log('   - Run "npm test" to ensure fixes didn\'t break anything');
    console.log('   - Review changes with "git diff" before committing');
    console.log('   - Consider adding these fixes to your IDE save actions');
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Auto-fix failed:', error);
    process.exit(1);
  }
}

function fixCommonPatterns() {
  const fixes = [
    // Fix console.log to logger
    {
      pattern: /console\.log\(/g,
      replacement: 'logger.info(',
      filePattern: /\.(ts|tsx|js|jsx)$/,
      excludeDirs: ['node_modules', '.git', 'dist', 'build'],
    },
    // Fix console.error to logger.error
    {
      pattern: /console\.error\(/g,
      replacement: 'logger.error(',
      filePattern: /\.(ts|tsx|js|jsx)$/,
      excludeDirs: ['node_modules', '.git', 'dist', 'build'],
    },
    // Add timeout to fetch calls (simple cases)
    {
      pattern: /fetch\(([^,)]+)\)(?!\.)/g,
      replacement: 'fetchWithTimeout($1, { timeout: 30000 })',
      filePattern: /\.(ts|tsx)$/,
      excludeDirs: ['node_modules', '.git', 'dist', 'build', 'tests'],
      requiresImport: 'fetchWithTimeout',
    },
  ];

  let totalFixes = 0;

  function processDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!fixes[0].excludeDirs.includes(entry.name)) {
          processDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        for (const fix of fixes) {
          if (fix.filePattern.test(entry.name)) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const newContent = content.replace(fix.pattern, fix.replacement);

            if (content !== newContent) {
              // Add import if needed
              if (fix.requiresImport && !content.includes(fix.requiresImport)) {
                const importStatement = `import { ${fix.requiresImport} } from '../utils/fetch-with-timeout';\n`;
                const firstImportIndex = content.search(/^import/m);
                if (firstImportIndex !== -1) {
                  const lines = newContent.split('\n');
                  let importLineIndex = 0;
                  for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('import')) {
                      importLineIndex = i;
                      break;
                    }
                  }
                  lines.splice(importLineIndex, 0, importStatement);
                  fs.writeFileSync(fullPath, lines.join('\n'));
                }
              } else {
                fs.writeFileSync(fullPath, newContent);
              }

              totalFixes++;
              console.log(`   Fixed: ${fullPath}`);
            }
          }
        }
      }
    }
  }

  processDirectory('src');
  console.log(`   Total fixes applied: ${totalFixes}`);
}

// Run the auto-fix
runAutoFix().catch((error) => {
  console.error('Failed to run auto-fix:', error);
  process.exit(1);
});
