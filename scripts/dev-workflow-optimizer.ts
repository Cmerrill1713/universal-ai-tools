#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class DevWorkflowOptimizer {
  private optimizations: Array<{ name: string; status: 'completed' | 'skipped' | 'failed'; description: string; impact: string }> = [];

  private log(message: string) {
    console.log(`🔧 ${message}`);
  }

  private addOptimization(name: string, status: 'completed' | 'skipped' | 'failed', description: string, impact: string) {
    this.optimizations.push({ name, status, description, impact });
  }

  private checkTsConfigOptimizations() {
    this.log('Checking TypeScript configuration optimizations...');
    
    const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
    const tsConfigDevPath = path.join(process.cwd(), 'tsconfig.dev.json');
    
    if (fs.existsSync(tsConfigPath)) {
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
      
      const hasIncremental = tsConfig.compilerOptions?.incremental === true;
      const hasBuildInfo = tsConfig.compilerOptions?.tsBuildInfoFile;
      const hasComposite = tsConfig.compilerOptions?.composite === true;
      
      if (hasIncremental && hasBuildInfo) {
        this.addOptimization('TypeScript Incremental', 'completed', 
          'Incremental compilation enabled with build info file', 
          'Faster subsequent builds by reusing previous compilation results');
      } else {
        this.addOptimization('TypeScript Incremental', 'failed',
          'Incremental compilation not properly configured',
          'Could reduce build times by 50-80%');
      }

      if (fs.existsSync(tsConfigDevPath)) {
        this.addOptimization('Development TypeScript Config', 'completed',
          'Separate development configuration exists',
          'Faster development builds with relaxed type checking');
      }
    }
  }

  private checkPackageJsonOptimizations() {
    this.log('Checking package.json script optimizations...');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const scripts = packageJson.scripts || {};
    
    // Check for parallel build scripts
    const hasParallelBuild = scripts['build:parallel'] || scripts['build'] && scripts['build'].includes('npm-run-all');
    if (hasParallelBuild) {
      this.addOptimization('Parallel Build Scripts', 'completed',
        'Parallel execution of build tasks configured',
        'Reduces total build time by running Go, Rust, and TypeScript builds in parallel');
    }

    // Check for development scripts
    const hasDevScripts = scripts['dev'] && scripts['build:dev'] && scripts['type-check:fast'];
    if (hasDevScripts) {
      this.addOptimization('Development Scripts', 'completed',
        'Development-specific scripts available',
        'Faster development iteration with optimized scripts');
    }

    // Check for performance testing
    const hasPerformanceTests = scripts['performance:build'] || scripts['performance:test'];
    if (hasPerformanceTests) {
      this.addOptimization('Performance Testing', 'completed',
        'Performance testing scripts available',
        'Regular performance monitoring and optimization tracking');
    }

    // Check for dependency management
    const hasDependencyAnalysis = scripts['deps:analyze'] || scripts['deps:check'];
    if (hasDependencyAnalysis) {
      this.addOptimization('Dependency Analysis', 'completed',
        'Dependency analysis tools available',
        'Regular cleanup of unused dependencies for faster installs');
    }
  }

  private checkCacheOptimizations() {
    this.log('Checking cache configurations...');
    
    // Check for cache cleaning scripts
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};
    
    if (scripts['clean:cache'] || scripts['clean:all']) {
      this.addOptimization('Cache Management', 'completed',
        'Cache cleaning scripts available',
        'Regular cache cleanup prevents build issues and saves disk space');
    }

    // Check for tsbuildinfo file
    if (fs.existsSync(path.join(process.cwd(), 'dist', '.tsbuildinfo'))) {
      this.addOptimization('TypeScript Build Cache', 'completed',
        'TypeScript build cache file present',
        'Incremental compilation working, faster subsequent builds');
    }

    // Check for node_modules cache
    const nodeModulesCachePath = path.join(process.cwd(), 'node_modules', '.cache');
    if (fs.existsSync(nodeModulesCachePath)) {
      this.addOptimization('Node Modules Cache', 'completed',
        'Node modules cache directory exists',
        'Tool caches preserved for faster execution');
    }
  }

  private checkRustOptimizations() {
    this.log('Checking Rust build optimizations...');
    
    const cargoTomlPath = path.join(process.cwd(), 'Cargo.toml');
    if (fs.existsSync(cargoTomlPath)) {
      const cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
      
      const hasDevProfile = cargoContent.includes('[profile.dev]');
      const hasIncrementalBuild = cargoContent.includes('incremental = true');
      const hasCodegenUnits = cargoContent.includes('codegen-units');
      
      if (hasDevProfile && hasIncrementalBuild) {
        this.addOptimization('Rust Development Profile', 'completed',
          'Optimized development profile with incremental builds',
          'Faster Rust compilation during development');
      }

      if (hasCodegenUnits) {
        this.addOptimization('Rust Parallel Compilation', 'completed',
          'Parallel compilation units configured',
          'Better CPU utilization during Rust builds');
      }
    }
  }

  private checkDevelopmentServerOptimizations() {
    this.log('Checking development server optimizations...');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};
    
    const devScript = scripts['dev'];
    if (devScript && devScript.includes('--ignore')) {
      this.addOptimization('Hot Reload Optimization', 'completed',
        'Development server ignores unnecessary directories',
        'Faster file watching and hot reload by ignoring build artifacts');
    }

    if (scripts['dev:webpack'] || scripts['dev:watch']) {
      this.addOptimization('Development Build Variants', 'completed',
        'Multiple development build options available',
        'Flexibility to choose fastest development build method');
    }
  }

  private generateRecommendations() {
    const failed = this.optimizations.filter(o => o.status === 'failed');
    const completed = this.optimizations.filter(o => o.status === 'completed');
    
    console.log('\n📊 Development Workflow Optimization Summary');
    console.log('============================================');
    
    console.log(`✅ Completed Optimizations: ${completed.length}`);
    console.log(`❌ Missing Optimizations: ${failed.length}`);
    console.log(`📈 Optimization Rate: ${Math.round((completed.length / this.optimizations.length) * 100)}%`);

    if (completed.length > 0) {
      console.log('\n🚀 Active Optimizations:');
      for (const opt of completed) {
        console.log(`   ✅ ${opt.name}: ${opt.description}`);
        console.log(`      💡 ${opt.impact}`);
      }
    }

    if (failed.length > 0) {
      console.log('\n⚠️  Potential Improvements:');
      for (const opt of failed) {
        console.log(`   ❌ ${opt.name}: ${opt.description}`);
        console.log(`      💡 ${opt.impact}`);
      }
    }

    // Additional recommendations
    console.log('\n🎯 Next Steps for Better Performance:');
    console.log('   • Run `npm run performance:build` regularly to monitor build times');
    console.log('   • Run `npm run deps:analyze` monthly to clean up unused dependencies');
    console.log('   • Use `npm run dev` for fastest development iteration');
    console.log('   • Use `npm run build:dev` for quick development builds');
    console.log('   • Consider using `npm run type-check:watch` in a separate terminal');
    
    return {
      completed: completed.length,
      failed: failed.length,
      rate: Math.round((completed.length / this.optimizations.length) * 100)
    };
  }

  private measureCurrentPerformance() {
    console.log('\n⏱️  Quick Performance Check');
    console.log('==========================');

    try {
      // Test clean operation speed
      const cleanStart = Date.now();
      execSync('npm run clean:cache', { stdio: 'pipe' });
      const cleanTime = Date.now() - cleanStart;
      console.log(`🧹 Cache cleaning: ${cleanTime}ms`);

      // Test type checking speed
      const typeCheckStart = Date.now();
      try {
        execSync('npm run type-check:fast', { stdio: 'pipe', timeout: 30000 });
        const typeCheckTime = Date.now() - typeCheckStart;
        console.log(`🔍 Fast type check: ${typeCheckTime}ms`);
      } catch (error) {
        console.log(`🔍 Fast type check: Failed (likely due to TypeScript errors)`);
      }

      // Check if development server starts quickly
      console.log(`🌟 Development server: Available via 'npm run dev'`);
      console.log(`📦 Build performance: Available via 'npm run performance:build'`);
      
    } catch (error) {
      console.log('⚠️  Performance check completed with some errors');
    }
  }

  async optimize() {
    console.log('🚀 Development Workflow Optimization Check');
    console.log('==========================================\n');

    this.checkTsConfigOptimizations();
    this.checkPackageJsonOptimizations();
    this.checkCacheOptimizations();
    this.checkRustOptimizations();
    this.checkDevelopmentServerOptimizations();

    const summary = this.generateRecommendations();
    this.measureCurrentPerformance();

    // Save report
    const reportPath = path.join('reports', `dev-workflow-optimization-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      optimizations: this.optimizations
    };
    
    try {
      if (!fs.existsSync('reports')) {
        fs.mkdirSync('reports', { recursive: true });
      }
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📋 Detailed report saved: ${reportPath}`);
    } catch (error) {
      console.log('⚠️  Could not save detailed report');
    }

    return summary;
  }
}

// Run the optimizer
const optimizer = new DevWorkflowOptimizer();
optimizer.optimize();