#!/usr/bin/env tsx

/**
 * Automated Gitleaks baseline updater
 * This script helps maintain a baseline of known secrets that should be ignored
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface BaselineEntry {
  file: string;
  line: number;
  hash: string;
  rule: string;
  match: string;
}

class GitleaksBaselineUpdater {
  private baselinePath = '.gitleaks-baseline.json';
  private configPath = '.gitleaks.toml';
  
  async run() {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔄 Updating Gitleaks baseline...\n');
    
    try {
      // Check if we're in a git repository
      this.checkGitRepo();
      
      // Create or update baseline
      const existingBaseline = this.loadExistingBaseline();
      const currentFindings = this.runGitleaksScan();
      
      // Merge baselines
      const updatedBaseline = this.mergeBaselines(existingBaseline, currentFindings);
      
      // Save updated baseline
      this.saveBaseline(updatedBaseline);
      
      // Generate summary
      this.generateSummary(existingBaseline, currentFindings, updatedBaseline);
      
      // Update GitHub workflow if needed
      await this.updateGitHubWorkflow();
      
    } catch (error) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Error updating baseline:', error);
      process.exit(1);
    }
  }
  
  private checkGitRepo() {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    } catch {
      throw new Error('Not in a git repository');
    }
  }
  
  private loadExistingBaseline(): BaselineEntry[] {
    if (!fs.existsSync(this.baselinePath)) {
      console.log('📝 No existing baseline found, creating new one...');
      return [];
    }
    
    try {
      const content = fs.readFileSync(this.baselinePath, 'utf8');
      return JSON.parse(content);
    } catch {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.warn('⚠️  Could not parse existing baseline, starting fresh...');
      return [];
    }
  }
  
  private runGitleaksScan(): BaselineEntry[] {
    console.log('🔍 Running Gitleaks scan...');
    
    try {
      // Run gitleaks and output to temp file
      execSync(
        `gitleaks detect --config ${this.configPath} --report-path gitleaks-temp.json --report-format json --exit-code 0`,
        { stdio: 'pipe' }
      );
      
      if (!fs.existsSync('gitleaks-temp.json')) {
        return [];
      }
      
      const report = JSON.parse(fs.readFileSync('gitleaks-temp.json', 'utf8'));
      fs.unlinkSync('gitleaks-temp.json');
      
      return report.map((finding: unknown) => ({
        file: finding.File,
        line: finding.StartLine,
        hash: finding.Fingerprint,
        rule: finding.RuleID,
        match: this.maskSecret(finding.Match)
      }));
    } catch (error) {
      console.error('Error running scan:', error);
      return [];
    }
  }
  
  private maskSecret(secret: string): string {
    if (secret.length <= 8) return '*'.repeat(secret.length);
    return secret.substring(0, 4) + '*'.repeat(secret.length - 8) + secret.substring(secret.length - 4);
  }
  
  private mergeBaselines(existing: BaselineEntry[], current: BaselineEntry[]): BaselineEntry[] {
    const merged = new Map<string, BaselineEntry>();
    
    // Add all existing entries
    existing.forEach(entry => {
      merged.set(entry.hash, entry);
    });
    
    // Add new entries
    current.forEach(entry => {
      if (!merged.has(entry.hash)) {
        merged.set(entry.hash, entry);
      }
    });
    
    return Array.from(merged.values());
  }
  
  private saveBaseline(baseline: BaselineEntry[]) {
    const sortedBaseline = baseline.sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });
    
    fs.writeFileSync(
      this.baselinePath,
      JSON.stringify(sortedBaseline, null, 2)
    );
    
    console.log(`\n💾 Saved baseline to ${this.baselinePath}`);
  }
  
  private generateSummary(
    existing: BaselineEntry[],
    current: BaselineEntry[],
    updated: BaselineEntry[]
  ) {
    const newFindings = current.filter(
      c => !existing.some(e => e.hash === c.hash)
    );
    
    console.log('\n📊 Baseline Update Summary:');
    console.log(`   Previous baseline entries: ${existing.length}`);
    console.log(`   Current findings: ${current.length}`);
    console.log(`   New findings added: ${newFindings.length}`);
    console.log(`   Total baseline entries: ${updated.length}`);
    
    if (newFindings.length > 0) {
      console.log('\n🆕 New findings added to baseline:');
      newFindings.forEach(finding => {
        console.log(`   - ${finding.file}:${finding.line} (${finding.rule})`);
      });
    }
  }
  
  private async updateGitHubWorkflow() {
    const workflowPath = '.github/workflows/gitleaks.yml';
    
    if (!fs.existsSync(workflowPath)) {
      return;
    }
    
    console.log('\n🔧 Checking GitHub workflow configuration...');
    
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    
    // Check if baseline is configured
    if (!workflow.includes('baseline-path')) {
      console.log('💡 Consider updating your GitHub workflow to use the baseline:');
      console.log('   Add: GITLEAKS_BASELINE_PATH: .gitleaks-baseline.json');
    } else {
      console.log('✅ GitHub workflow already configured for baseline');
    }
  }
}

// Add command line options
const args = process.argv.slice(2);
const options = {
  autoCommit: args.includes('--commit'),
  push: args.includes('--push')
};

// Run the updater
const updater = new GitleaksBaselineUpdater();
updater.run().then(() => {
  if (options.autoCommit) {
    console.log('\n📝 Committing baseline update...');
    try {
      execSync('git add .gitleaks-baseline.json');
      execSync('git commit -m "chore: update gitleaks baseline"');
      console.log('✅ Baseline committed');
      
      if (options.push) {
        execSync('git push');
        console.log('✅ Pushed to remote');
      }
    } catch (error) {
      console.log('⚠️  Could not commit/push automatically');
    }
  }
}).catch(console.error);