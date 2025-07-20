#!/usr/bin/env node

/**
 * Self-Healing Script for Build Issues
 * This script attempts to automatically fix common build and TypeScript errors
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🏥 Starting Self-Healing Process for Build Issues...\n');

class BuildHealer {
  constructor() {
    this.healingActions = [];
    this.errors = [];
    this.fixes = 0;
  }

  async heal() {
    console.log('📋 Analyzing build issues...\n');
    
    // Step 1: Clean previous builds
    this.cleanBuild();
    
    // Step 2: Install dependencies
    this.installDependencies();
    
    // Step 3: Fix common TypeScript issues
    this.fixTypeScriptIssues();
    
    // Step 4: Fix module resolution
    this.fixModuleResolution();
    
    // Step 5: Attempt build
    const buildSuccess = this.attemptBuild();
    
    // Step 6: Report results
    this.report(buildSuccess);
    
    return buildSuccess;
  }

  cleanBuild() {
    console.log('🧹 Cleaning previous build artifacts...');
    try {
      if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
      }
      if (fs.existsSync('node_modules/.cache')) {
        fs.rmSync('node_modules/.cache', { recursive: true, force: true });
      }
      console.log('✅ Build artifacts cleaned\n');
      this.healingActions.push('Cleaned build artifacts');
    } catch (error) {
      console.error('❌ Failed to clean build:', error.message);
      this.errors.push(`Clean failed: ${error.message}`);
    }
  }

  installDependencies() {
    console.log('📦 Ensuring all dependencies are installed...');
    try {
      execSync('npm install', { stdio: 'inherit' });
      console.log('✅ Dependencies installed\n');
      this.healingActions.push('Installed dependencies');
    } catch (error) {
      console.error('❌ Failed to install dependencies:', error.message);
      this.errors.push(`Install failed: ${error.message}`);
    }
  }

  fixTypeScriptIssues() {
    console.log('🔧 Fixing common TypeScript issues...');
    
    // Fix tsconfig.json module resolution
    try {
      const tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      
      // Ensure proper module resolution
      tsconfig.compilerOptions.moduleResolution = 'node';
      tsconfig.compilerOptions.allowSyntheticDefaultImports = true;
      tsconfig.compilerOptions.esModuleInterop = true;
      tsconfig.compilerOptions.skipLibCheck = true;
      
      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
      console.log('✅ Fixed tsconfig.json\n');
      this.healingActions.push('Fixed TypeScript configuration');
      this.fixes++;
    } catch (error) {
      console.error('❌ Failed to fix tsconfig:', error.message);
      this.errors.push(`tsconfig fix failed: ${error.message}`);
    }
  }

  fixModuleResolution() {
    console.log('🔗 Fixing module resolution issues...');
    
    // Add .js extensions to imports in specific files
    const problemFiles = [
      'src/agents/base_agent.ts',
      'src/core/agents/self-healing-agent.ts',
      'src/services/circuit-breaker.ts'
    ];
    
    problemFiles.forEach(file => {
      try {
        const filePath = path.join(__dirname, '..', file);
        if (fs.existsSync(filePath)) {
          let content = fs.readFileSync(filePath, 'utf8');
          
          // Fix imports without extensions
          content = content.replace(
            /from ['"](\.[\.\/]+[^'"]+)(?<!\.js)['"];/g,
            "from '$1.js';"
          );
          
          fs.writeFileSync(filePath, content);
          console.log(`✅ Fixed imports in ${file}`);
          this.fixes++;
        }
      } catch (error) {
        console.error(`❌ Failed to fix ${file}:`, error.message);
        this.errors.push(`Module fix failed for ${file}: ${error.message}`);
      }
    });
    
    if (this.fixes > 0) {
      this.healingActions.push(`Fixed module resolution in ${this.fixes} files`);
    }
    console.log();
  }

  attemptBuild() {
    console.log('🏗️  Attempting to build project...');
    try {
      execSync('npm run build', { stdio: 'pipe' });
      console.log('✅ Build successful!\n');
      this.healingActions.push('Successfully built project');
      return true;
    } catch (error) {
      console.error('❌ Build still failing\n');
      this.errors.push('Build failed after healing attempts');
      
      // Try to extract specific errors
      if (error.stdout) {
        const output = error.stdout.toString();
        const errorMatch = output.match(/ERROR in (.+)/g);
        if (errorMatch) {
          console.log('Build errors found:');
          errorMatch.slice(0, 5).forEach(err => console.log(`  - ${err}`));
          if (errorMatch.length > 5) {
            console.log(`  ... and ${errorMatch.length - 5} more errors`);
          }
        }
      }
      return false;
    }
  }

  report(success) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SELF-HEALING REPORT');
    console.log('='.repeat(60));
    
    console.log('\n✅ Healing Actions Performed:');
    this.healingActions.forEach(action => {
      console.log(`   - ${action}`);
    });
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors Encountered:');
      this.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    console.log('\n📈 Summary:');
    console.log(`   - Total fixes applied: ${this.fixes}`);
    console.log(`   - Build status: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (!success) {
      console.log('\n💡 Next Steps:');
      console.log('   1. Review the specific TypeScript errors above');
      console.log('   2. Consider running: npm run typecheck');
      console.log('   3. Check for missing type definitions');
      console.log('   4. Ensure all imports have correct paths');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run the healer
(async () => {
  const healer = new BuildHealer();
  const success = await healer.heal();
  
  if (success) {
    console.log('\n🎉 Self-healing successful! Your agent system should now work.');
    console.log('   Try running: npm run dev');
  } else {
    console.log('\n⚠️  Self-healing could not fix all issues.');
    console.log('   Manual intervention may be required.');
  }
  
  process.exit(success ? 0 : 1);
})();