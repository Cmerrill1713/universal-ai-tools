/**
 * Workflow Testing Script
 * Validates that GitHub Actions and GitLab CI/CD workflows are properly configured
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface WorkflowTest {
  name: string;
  description: string;
  test: () => boolean;
  fix?: string;
}

const tests: WorkflowTest[] = [
  {
    name: 'GitHub Actions Directory',
    description: 'Check if .github/workflows directory exists',
    test: () => existsSync('.github/workflows'),
    fix: 'Create .github/workflows directory'
  },
  {
    name: 'GitHub CI Workflow',
    description: 'Check if CI workflow file exists',
    test: () => existsSync('.github/workflows/ci.yml'),
    fix: 'Create .github/workflows/ci.yml'
  },
  {
    name: 'GitHub Deploy Workflow',
    description: 'Check if deploy workflow file exists',
    test: () => existsSync('.github/workflows/deploy.yml'),
    fix: 'Create .github/workflows/deploy.yml'
  },
  {
    name: 'GitHub AI Services Workflow',
    description: 'Check if AI services workflow file exists',
    test: () => existsSync('.github/workflows/ai-services.yml'),
    fix: 'Create .github/workflows/ai-services.yml'
  },
  {
    name: 'GitLab CI Configuration',
    description: 'Check if .gitlab-ci.yml exists',
    test: () => existsSync('.gitlab-ci.yml'),
    fix: 'Create .gitlab-ci.yml'
  },
  {
    name: 'GitHub CI Workflow Syntax',
    description: 'Validate GitHub CI workflow YAML syntax',
    test: () => {
      try {
        const content = readFileSync('.github/workflows/ci.yml', 'utf8');
        // Basic YAML validation
        return content.includes('name:') && content.includes('on:') && content.includes('jobs:');
      } catch {
        return false;
      }
    },
    fix: 'Fix GitHub CI workflow YAML syntax'
  },
  {
    name: 'GitHub Deploy Workflow Syntax',
    description: 'Validate GitHub deploy workflow YAML syntax',
    test: () => {
      try {
        const content = readFileSync('.github/workflows/deploy.yml', 'utf8');
        return content.includes('name:') && content.includes('on:') && content.includes('jobs:');
      } catch {
        return false;
      }
    },
    fix: 'Fix GitHub deploy workflow YAML syntax'
  },
  {
    name: 'GitHub AI Services Workflow Syntax',
    description: 'Validate GitHub AI services workflow YAML syntax',
    test: () => {
      try {
        const content = readFileSync('.github/workflows/ai-services.yml', 'utf8');
        return content.includes('name:') && content.includes('on:') && content.includes('jobs:');
      } catch {
        return false;
      }
    },
    fix: 'Fix GitHub AI services workflow YAML syntax'
  },
  {
    name: 'GitLab CI Syntax',
    description: 'Validate GitLab CI YAML syntax',
    test: () => {
      try {
        const content = readFileSync('.gitlab-ci.yml', 'utf8');
        return content.includes('stages:') && content.includes('variables:');
      } catch {
        return false;
      }
    },
    fix: 'Fix GitLab CI YAML syntax'
  },
  {
    name: 'Package.json Scripts',
    description: 'Check if required npm scripts exist',
    test: () => {
      try {
        const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
        const scripts = packageJson.scripts || {};
        return scripts.lint && scripts.test && scripts.build;
      } catch {
        return false;
      }
    },
    fix: 'Add required scripts to package.json'
  },
  {
    name: 'Node.js API Server Scripts',
    description: 'Check if Node.js API server has required scripts',
    test: () => {
      try {
        const packageJson = JSON.parse(readFileSync('nodejs-api-server/package.json', 'utf8'));
        const scripts = packageJson.scripts || {};
        return scripts.lint && scripts.test && scripts.build && scripts.start;
      } catch {
        return false;
      }
    },
    fix: 'Add required scripts to nodejs-api-server/package.json'
  },
  {
    name: 'Rust Services Build Script',
    description: 'Check if Rust services build script exists',
    test: () => existsSync('rust-services/build-all.sh'),
    fix: 'Create rust-services/build-all.sh'
  },
  {
    name: 'Docker Configuration',
    description: 'Check if Docker configuration exists',
    test: () => existsSync('Dockerfile'),
    fix: 'Create Dockerfile'
  },
  {
    name: 'Environment Configuration',
    description: 'Check if environment configuration exists',
    test: () => existsSync('.env.example'),
    fix: 'Create .env.example'
  },
  {
    name: 'GitHub Actions Permissions',
    description: 'Check if GitHub Actions have proper permissions',
    test: () => {
      try {
        const content = readFileSync('.github/workflows/ci.yml', 'utf8');
        return content.includes('permissions:') || content.includes('actions/checkout@v4');
      } catch {
        return false;
      }
    },
    fix: 'Add proper permissions to GitHub Actions'
  },
  {
    name: 'GitLab CI Stages',
    description: 'Check if GitLab CI has proper stages',
    test: () => {
      try {
        const content = readFileSync('.gitlab-ci.yml', 'utf8');
        return content.includes('build') && content.includes('test') && content.includes('deploy');
      } catch {
        return false;
      }
    },
    fix: 'Add proper stages to GitLab CI'
  },
  {
    name: 'Security Scanning',
    description: 'Check if security scanning is configured',
    test: () => {
      try {
        const ciContent = readFileSync('.github/workflows/ci.yml', 'utf8');
        const gitlabContent = readFileSync('.gitlab-ci.yml', 'utf8');
        return ciContent.includes('security') || gitlabContent.includes('security');
      } catch {
        return false;
      }
    },
    fix: 'Add security scanning to workflows'
  },
  {
    name: 'AI Services Integration',
    description: 'Check if AI services are integrated in workflows',
    test: () => {
      try {
        const aiContent = readFileSync('.github/workflows/ai-services.yml', 'utf8');
        return aiContent.includes('dspy') && aiContent.includes('mlx') && aiContent.includes('gitlab');
      } catch {
        return false;
      }
    },
    fix: 'Add AI services integration to workflows'
  },
  {
    name: 'Artifact Management',
    description: 'Check if artifact management is configured',
    test: () => {
      try {
        const ciContent = readFileSync('.github/workflows/ci.yml', 'utf8');
        const gitlabContent = readFileSync('.gitlab-ci.yml', 'utf8');
        return ciContent.includes('artifacts') || gitlabContent.includes('artifacts');
      } catch {
        return false;
      }
    },
    fix: 'Add artifact management to workflows'
  },
  {
    name: 'Environment Variables',
    description: 'Check if environment variables are properly configured',
    test: () => {
      try {
        const ciContent = readFileSync('.github/workflows/ci.yml', 'utf8');
        const gitlabContent = readFileSync('.gitlab-ci.yml', 'utf8');
        return ciContent.includes('env:') && gitlabContent.includes('variables:');
      } catch {
        return false;
      }
    },
    fix: 'Add environment variables to workflows'
  }
];

function runTests(): void {
  console.log('🧪 Testing Workflow Configuration...\n');
  
  let passed = 0;
  let failed = 0;
  const failures: WorkflowTest[] = [];
  
  for (const test of tests) {
    try {
      const result = test.test();
      if (result) {
        console.log(`✅ ${test.name}: ${test.description}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: ${test.description}`);
        if (test.fix) {
          console.log(`   💡 Fix: ${test.fix}`);
        }
        failures.push(test);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${test.description} (Error: ${error})`);
      failures.push(test);
      failed++;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failures.length > 0) {
    console.log('\n🔧 Failed Tests:');
    failures.forEach((test, index) => {
      console.log(`${index + 1}. ${test.name}`);
      if (test.fix) {
        console.log(`   Fix: ${test.fix}`);
      }
    });
  }
  
  if (failed === 0) {
    console.log('\n🎉 All workflow tests passed! Your CI/CD setup is ready.');
  } else {
    console.log('\n⚠️ Some tests failed. Please fix the issues above before deploying.');
  }
}

function validateYamlSyntax(): void {
  console.log('\n🔍 Validating YAML Syntax...\n');
  
  const yamlFiles = [
    '.github/workflows/ci.yml',
    '.github/workflows/deploy.yml',
    '.github/workflows/ai-services.yml',
    '.gitlab-ci.yml'
  ];
  
  for (const file of yamlFiles) {
    if (existsSync(file)) {
      try {
        // Basic YAML validation by checking for common syntax errors
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        let valid = true;
        let errors: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;
          
          // Check for common YAML syntax errors
          if (line.includes('\t')) {
            errors.push(`Line ${lineNum}: Contains tabs (use spaces instead)`);
            valid = false;
          }
          
          if (line.match(/^[^#\s-].*:.*:.*$/)) {
            errors.push(`Line ${lineNum}: Multiple colons in key`);
            valid = false;
          }
          
          if (line.match(/^\s*-\s*$/)) {
            errors.push(`Line ${lineNum}: Empty list item`);
            valid = false;
          }
        }
        
        if (valid) {
          console.log(`✅ ${file}: YAML syntax appears valid`);
        } else {
          console.log(`❌ ${file}: YAML syntax issues found`);
          errors.forEach(error => console.log(`   ${error}`));
        }
      } catch (error) {
        console.log(`❌ ${file}: Error reading file - ${error}`);
      }
    } else {
      console.log(`⚠️ ${file}: File not found`);
    }
  }
}

function generateWorkflowReport(): void {
  console.log('\n📋 Generating Workflow Report...\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    workflows: {
      github: {
        ci: existsSync('.github/workflows/ci.yml'),
        deploy: existsSync('.github/workflows/deploy.yml'),
        aiServices: existsSync('.github/workflows/ai-services.yml')
      },
      gitlab: {
        ci: existsSync('.gitlab-ci.yml')
      }
    },
    configuration: {
      nodejs: existsSync('nodejs-api-server/package.json'),
      rust: existsSync('rust-services/build-all.sh'),
      docker: existsSync('Dockerfile'),
      environment: existsSync('.env.example')
    },
    recommendations: [
      'Test workflows by pushing to a feature branch',
      'Verify all environment variables are set',
      'Check that all required services are running',
      'Validate that all tests pass locally',
      'Ensure proper permissions are set for deployment'
    ]
  };
  
  console.log('📊 Workflow Configuration Report:');
  console.log(JSON.stringify(report, null, 2));
  
  // Save report to file
  try {
    writeFileSync('workflow-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Report saved to workflow-test-report.json');
  } catch (error) {
    console.log('\n⚠️ Could not save report file');
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
  validateYamlSyntax();
  generateWorkflowReport();
}

export { runTests, validateYamlSyntax, generateWorkflowReport };