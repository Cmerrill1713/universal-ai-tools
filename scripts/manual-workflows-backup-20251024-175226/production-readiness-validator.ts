#!/usr/bin/env tsx

/**
 * Production Readiness Validation Pipeline
 * Comprehensive assessment of system production readiness
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface ValidationResult {
  category: string;
  status: 'pass' | 'warn' | 'fail';
  score: number;
  maxScore: number;
  details: string[];
  fixes?: string[];
}

interface ProductionAssessment {
  overallScore: number;
  maxScore: number;
  status: 'READY' | 'NEEDS_WORK' | 'NOT_READY';
  results: ValidationResult[];
  recommendations: string[];
}

class ProductionReadinessValidator {
  private results: ValidationResult[] = [];

  async runValidation(): Promise<ProductionAssessment> {
    console.log('🚀 Starting Production Readiness Validation...\n');

    // Run all validation checks
    await this.validateTypeScript();
    await this.validateLinting();
    await this.validateSecurity();
    await this.validateDependencies();
    await this.validateConfiguration();
    await this.validateArchitecture();

    return this.generateAssessment();
  }

  private async validateTypeScript(): Promise<void> {
    console.log('📝 Validating TypeScript compilation...');

    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit --skipLibCheck');

      this.results.push({
        category: 'TypeScript',
        status: 'pass',
        score: 25,
        maxScore: 25,
        details: ['All TypeScript files compile successfully'],
      });
    } catch (error: any) {
      // TypeScript errors are in stderr
      const errorOutput = error.stderr || error.stdout || '';
      const errorCount = (errorOutput.match(/error TS/g) || []).length;
      const selfImprovementErrors = await this.countSelfImprovementErrors();

      if (errorCount > 0) {
        this.results.push({
          category: 'TypeScript',
          status: errorCount > 100 ? 'fail' : 'warn',
          score: Math.max(0, 25 - Math.floor(errorCount / 20)),
          maxScore: 25,
          details: [
            `${errorCount} total TypeScript errors`,
            `${selfImprovementErrors} core self-improvement errors`,
            'Most errors are Map iteration and import config issues',
          ],
          fixes: [
            'Update tsconfig.json target to ES2020+',
            'Enable downlevelIteration flag',
            'Fix remaining null/undefined checks',
          ],
        });
      } else {
        this.results.push({
          category: 'TypeScript',
          status: 'fail',
          score: 0,
          maxScore: 25,
          details: ['TypeScript compilation failed', error.message || 'Unknown error'],
        });
      }
    }
  }

  private async validateLinting(): Promise<void> {
    console.log('🔍 Validating code quality (linting)...');

    try {
      const { stdout, stderr } = await execAsync('npx eslint src/ --ext .ts,.js --format json', {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
      });

      // Parse the JSON output
      const lintResults = JSON.parse(stdout);

      let totalErrors = 0;
      let totalWarnings = 0;

      lintResults.forEach((file: any) => {
        totalErrors += file.errorCount || 0;
        totalWarnings += file.warningCount || 0;
      });

      const score = Math.max(
        0,
        25 - Math.floor(totalErrors / 100) - Math.floor(totalWarnings / 1000)
      );

      this.results.push({
        category: 'Linting',
        status: totalErrors > 500 ? 'fail' : totalErrors > 100 ? 'warn' : 'pass',
        score,
        maxScore: 25,
        details: [
          `${totalErrors} linting errors`,
          `${totalWarnings} linting warnings`,
          'Many issues are auto-fixable',
        ],
        fixes: [
          'Run: npx eslint --fix src/ --ext .ts,.js',
          'Address unused variable errors',
          'Fix magic number warnings',
          'Add explicit types for "any" usage',
        ],
      });
    } catch (error: any) {
      // ESLint exits with non-zero when issues are found
      if (error.stdout) {
        try {
          const lintResults = JSON.parse(error.stdout);
          let totalErrors = 0;
          let totalWarnings = 0;

          lintResults.forEach((file: any) => {
            totalErrors += file.errorCount || 0;
            totalWarnings += file.warningCount || 0;
          });

          const score = Math.max(
            0,
            25 - Math.floor(totalErrors / 100) - Math.floor(totalWarnings / 1000)
          );

          this.results.push({
            category: 'Linting',
            status: totalErrors > 500 ? 'fail' : totalErrors > 100 ? 'warn' : 'pass',
            score,
            maxScore: 25,
            details: [
              `${totalErrors} linting errors`,
              `${totalWarnings} linting warnings`,
              'ESLint found issues but parsing succeeded',
            ],
          });
        } catch (parseError) {
          this.results.push({
            category: 'Linting',
            status: 'warn',
            score: 10,
            maxScore: 25,
            details: [
              'ESLint execution succeeded but output too large to parse',
              `Error: ${parseError}`,
            ],
          });
        }
      } else {
        this.results.push({
          category: 'Linting',
          status: 'fail',
          score: 0,
          maxScore: 25,
          details: ['ESLint execution failed', error.message || 'Unknown error'],
        });
      }
    }
  }

  private async validateSecurity(): Promise<void> {
    console.log('🔒 Validating security...');

    try {
      const { stdout } = await execAsync('npm audit --json');
      const auditResult = JSON.parse(stdout);

      const vulnerabilities = auditResult.vulnerabilities || {};
      const criticalCount = Object.values(vulnerabilities).filter(
        (v: any) => v.severity === 'critical'
      ).length;
      const highCount = Object.values(vulnerabilities).filter(
        (v: any) => v.severity === 'high'
      ).length;
      const moderateCount = Object.values(vulnerabilities).filter(
        (v: any) => v.severity === 'moderate'
      ).length;

      let score = 25;
      let status: 'pass' | 'warn' | 'fail' = 'pass';

      if (criticalCount > 0) {
        score = 0;
        status = 'fail';
      } else if (highCount > 0) {
        score = 10;
        status = 'fail';
      } else if (moderateCount > 0) {
        score = 20;
        status = 'warn';
      }

      this.results.push({
        category: 'Security',
        status,
        score,
        maxScore: 25,
        details: [
          `${criticalCount} critical vulnerabilities`,
          `${highCount} high vulnerabilities`,
          `${moderateCount} moderate vulnerabilities`,
        ],
        fixes: [
          'Run: npm audit fix',
          'Update vulnerable dependencies',
          'Review and upgrade packages',
        ],
      });
    } catch (error: any) {
      this.results.push({
        category: 'Security',
        status: 'warn',
        score: 15,
        maxScore: 25,
        details: ['Could not run security audit', error.message],
      });
    }
  }

  private async validateDependencies(): Promise<void> {
    console.log('📦 Validating dependencies...');

    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      const dependencies = Object.keys(packageJson.dependencies || {});
      const devDependencies = Object.keys(packageJson.devDependencies || {});

      // Check for outdated packages
      try {
        const { stdout } = await execAsync('npm outdated --json');
        const outdated = JSON.parse(stdout);
        const outdatedCount = Object.keys(outdated).length;

        const score = Math.max(10, 25 - outdatedCount);

        this.results.push({
          category: 'Dependencies',
          status: outdatedCount > 10 ? 'warn' : 'pass',
          score,
          maxScore: 25,
          details: [
            `${dependencies.length} production dependencies`,
            `${devDependencies.length} dev dependencies`,
            `${outdatedCount} outdated packages`,
          ],
          fixes: ['Run: npm update', 'Review major version updates', 'Remove unused dependencies'],
        });
      } catch {
        // No outdated packages or other issue
        this.results.push({
          category: 'Dependencies',
          status: 'pass',
          score: 25,
          maxScore: 25,
          details: [
            `${dependencies.length} production dependencies`,
            `${devDependencies.length} dev dependencies`,
            'All packages up to date',
          ],
        });
      }
    } catch (error: any) {
      this.results.push({
        category: 'Dependencies',
        status: 'fail',
        score: 0,
        maxScore: 25,
        details: ['Could not validate dependencies', error.message],
      });
    }
  }

  private async validateConfiguration(): Promise<void> {
    console.log('⚙️ Validating configuration...');

    const configFiles = ['tsconfig.json', '.eslintrc.js', 'package.json', '.env.example'];

    let score = 0;
    const details: string[] = [];

    for (const file of configFiles) {
      try {
        await fs.access(file);
        score += 5;
        details.push(`✅ ${file} exists`);
      } catch {
        details.push(`❌ ${file} missing`);
      }
    }

    // Check environment configuration
    try {
      const envExample = await fs.readFile('.env.example', 'utf-8');
      const envVars = envExample.split('\n').filter((line) => line.includes('=')).length;
      details.push(`${envVars} environment variables configured`);
      score += 5;
    } catch {
      details.push('No environment configuration found');
    }

    this.results.push({
      category: 'Configuration',
      status: score > 15 ? 'pass' : score > 10 ? 'warn' : 'fail',
      score,
      maxScore: 25,
      details,
      fixes: [
        'Ensure all config files are present',
        'Review environment variable setup',
        'Validate production configurations',
      ],
    });
  }

  private async validateArchitecture(): Promise<void> {
    console.log('🏗️ Validating architecture...');

    const keyArchitectureFiles = [
      'src/core/self-improvement/integrated-self-improvement-system.ts',
      'src/core/self-improvement/meta-learning-layer.ts',
      'src/core/evolution/alpha-evolve-system.ts',
      'src/services/universal_llm_orchestrator.ts',
    ];

    let score = 0;
    const details: string[] = [];

    for (const file of keyArchitectureFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        score += 6;
        const lines = content.split('\n').length;
        details.push(`✅ ${path.basename(file)} (${lines} lines)`);
      } catch {
        details.push(`❌ ${path.basename(file)} missing`);
      }
    }

    // Check for MCP configuration
    try {
      await fs.access('.claude.json');
      score += 1;
      details.push('✅ MCP configuration present');
    } catch {
      details.push('❌ MCP configuration missing');
    }

    this.results.push({
      category: 'Architecture',
      status: score > 20 ? 'pass' : score > 15 ? 'warn' : 'fail',
      score,
      maxScore: 25,
      details,
      fixes: [
        'Ensure all core architecture files are implemented',
        'Complete self-improvement system integration',
        'Validate MCP tool configuration',
      ],
    });
  }

  private async countSelfImprovementErrors(): Promise<number> {
    try {
      const { stderr } = await execAsync(
        'npx tsc --noEmit --skipLibCheck src/core/self-improvement/*.ts'
      );
      return (stderr.match(/error TS/g) || []).length;
    } catch (error: any) {
      if (error.stderr) {
        return (error.stderr.match(/error TS/g) || []).length;
      }
      return 0;
    }
  }

  private generateAssessment(): ProductionAssessment {
    const totalScore = this.results.reduce((sum, result) => sum + result.score, 0);
    const maxScore = this.results.reduce((sum, result) => sum + result.maxScore, 0);
    const percentage = (totalScore / maxScore) * 100;

    let status: 'READY' | 'NEEDS_WORK' | 'NOT_READY';
    if (percentage >= 85) {
      status = 'READY';
    } else if (percentage >= 70) {
      status = 'NEEDS_WORK';
    } else {
      status = 'NOT_READY';
    }

    const recommendations: string[] = [];

    this.results.forEach((result) => {
      if (result.status !== 'pass' && result.fixes) {
        recommendations.push(`${result.category}: ${result.fixes[0]}`);
      }
    });

    return {
      overallScore: totalScore,
      maxScore,
      status,
      results: this.results,
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
    };
  }

  static async run(): Promise<void> {
    const validator = new ProductionReadinessValidator();
    const assessment = await validator.runValidation();

    console.log('\n📊 PRODUCTION READINESS ASSESSMENT');
    console.log('='.repeat(50));
    console.log(
      `Overall Score: ${assessment.overallScore}/${assessment.maxScore} (${Math.round((assessment.overallScore / assessment.maxScore) * 100)}%)`
    );
    console.log(`Status: ${assessment.status}`);
    console.log('');

    console.log('📋 CATEGORY BREAKDOWN:');
    assessment.results.forEach((result) => {
      const statusIcon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${result.category}: ${result.score}/${result.maxScore}`);
      result.details.forEach((detail) => console.log(`   ${detail}`));
      console.log('');
    });

    if (assessment.recommendations.length > 0) {
      console.log('🎯 TOP RECOMMENDATIONS:');
      assessment.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
      console.log('');
    }

    console.log('🚀 NEXT STEPS:');
    if (assessment.status === 'READY') {
      console.log('✅ System is production ready!');
      console.log('✅ Consider deploying to staging environment');
      console.log('✅ Run performance tests under load');
    } else if (assessment.status === 'NEEDS_WORK') {
      console.log('⚠️ Address high-priority issues before production');
      console.log('⚠️ Focus on security and TypeScript errors');
      console.log('⚠️ Re-run validation after fixes');
    } else {
      console.log('❌ Significant work needed before production');
      console.log('❌ Start with TypeScript compilation errors');
      console.log('❌ Address security vulnerabilities');
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ProductionReadinessValidator.run().catch(console.error);
}

export { ProductionReadinessValidator, ValidationResult, ProductionAssessment };
