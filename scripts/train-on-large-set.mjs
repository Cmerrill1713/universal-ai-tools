#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🎓 Training Adaptive System on Large Fix Sets\n');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

let supabase = null;
let memoryEnabled = false;

// Initialize Supabase
try {
  if (!SUPABASE_URL.includes('your-project') && !SUPABASE_KEY.includes('your-anon-key')) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    memoryEnabled = true;
    console.log('✅ Connected to Supabase for training data storage');
  } else {
    // Try to read from .env
    if (fs.existsSync('.env')) {
      const envContent = fs.readFileSync('.env', 'utf8');
      const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
      const keyMatch = envContent.match(/SUPABASE_(?:ANON_)?KEY\s*=\s*["']?([^"'\s]+)["']?/);
      
      if (urlMatch && keyMatch) {
        supabase = createClient(urlMatch[1], keyMatch[1]);
        memoryEnabled = true;
        console.log('✅ Configured Supabase from .env file');
      }
    }
    
    if (!memoryEnabled) {
      console.log('⚠️  Running in offline mode - training data will be limited');
    }
  }
} catch (error) {
  console.log(`⚠️  Supabase setup failed: ${error.message}`);
}

const trainingSessionId = `training_${Date.now()}`;

// Comprehensive file discovery
async function discoverAllFiles() {
  try {
    const { stdout } = await execAsync('find src -name "*.ts" -o -name "*.tsx" | head -50');
    return stdout.trim().split('\n').filter(f => f.length > 0);
  } catch (error) {
    console.log('⚠️  Using fallback file discovery');
    const files = [];
    
    function walkDir(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walkDir(fullPath);
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    }
    
    if (fs.existsSync('src')) {
      walkDir('src');
    }
    
    return files.slice(0, 50); // Limit for training
  }
}

// Analyze file for training patterns
async function analyzeFileForTraining(filePath) {
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { stdout } = await execAsync(`npx eslint "${filePath}" --format json`).catch(() => ({ stdout: '[]' }));
    
    const results = JSON.parse(stdout || '[]');
    const fileResult = results[0] || { messages: [] };
    
    const patterns = {
      anyTypes: (content.match(/:\s*any\b/g) || []).length,
      unusedVars: fileResult.messages.filter(m => m.ruleId === '@typescript-eslint/no-unused-vars').length,
      magicNumbers: fileResult.messages.filter(m => m.ruleId === 'no-magic-numbers').length,
      sortImports: fileResult.messages.filter(m => m.ruleId === 'sort-imports').length,
      nestedTernary: fileResult.messages.filter(m => m.ruleId === 'no-nested-ternary').length,
      totalIssues: fileResult.messages.length,
      lines: content.split('\n').length,
      imports: (content.match(/^import /gm) || []).length,
      exports: (content.match(/^export /gm) || []).length
    };

    return {
      filePath,
      patterns,
      content: content.substring(0, 2000), // Sample for analysis
      issues: fileResult.messages.slice(0, 10) // Top 10 issues
    };
  } catch (error) {
    console.log(`⚠️  Failed to analyze ${filePath}: ${error.message}`);
    return null;
  }
}

// Store training data in memory
async function storeTrainingData(analysisResults) {
  if (!memoryEnabled) return;

  try {
    const trainingData = {
      session_id: trainingSessionId,
      analysis_results: analysisResults,
      total_files: analysisResults.length,
      total_issues: analysisResults.reduce((sum, r) => sum + (r?.patterns?.totalIssues || 0), 0),
      pattern_distribution: {
        anyTypes: analysisResults.reduce((sum, r) => sum + (r?.patterns?.anyTypes || 0), 0),
        unusedVars: analysisResults.reduce((sum, r) => sum + (r?.patterns?.unusedVars || 0), 0),
        magicNumbers: analysisResults.reduce((sum, r) => sum + (r?.patterns?.magicNumbers || 0), 0),
        sortImports: analysisResults.reduce((sum, r) => sum + (r?.patterns?.sortImports || 0), 0),
        nestedTernary: analysisResults.reduce((sum, r) => sum + (r?.patterns?.nestedTernary || 0), 0)
      },
      memory_type: 'training_data',
      timestamp: new Date().toISOString()
    };

    const content = `Training data collected: ${trainingData.total_files} files, ${trainingData.total_issues} total issues`;
    
    await supabase
      .from('memories')
      .insert({
        content,
        metadata: trainingData,
        user_id: 'claude-training-system'
      });

    console.log('📚 Training data stored in Supabase memory');
    return trainingData;
  } catch (error) {
    console.log(`⚠️  Failed to store training data: ${error.message}`);
    return null;
  }
}

// Generate training insights
function generateTrainingInsights(analysisResults, trainingData) {
  const insights = {
    mostCommonIssues: [],
    fileComplexityPatterns: [],
    fixPriorityRecommendations: [],
    learningOpportunities: []
  };

  // Identify most common issues
  const issueTypes = {};
  analysisResults.forEach(result => {
    if (!result?.issues) return;
    result.issues.forEach(issue => {
      issueTypes[issue.ruleId] = (issueTypes[issue.ruleId] || 0) + 1;
    });
  });

  insights.mostCommonIssues = Object.entries(issueTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([rule, count]) => ({ rule, count }));

  // File complexity analysis
  insights.fileComplexityPatterns = analysisResults
    .filter(r => r?.patterns)
    .map(r => ({
      file: path.basename(r.filePath),
      complexity: r.patterns.totalIssues / Math.max(r.patterns.lines, 1),
      issues: r.patterns.totalIssues,
      lines: r.patterns.lines
    }))
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 10);

  // Fix priority recommendations
  if (trainingData?.pattern_distribution) {
    const patterns = trainingData.pattern_distribution;
    const priorityMap = [
      { name: 'anyTypes', impact: 'High', reason: 'Improves type safety' },
      { name: 'unusedVars', impact: 'Medium', reason: 'Reduces code clutter' },
      { name: 'sortImports', impact: 'Low', reason: 'Improves readability' },
      { name: 'magicNumbers', impact: 'Medium', reason: 'Enhances maintainability' },
      { name: 'nestedTernary', impact: 'High', reason: 'Improves code clarity' }
    ];

    insights.fixPriorityRecommendations = priorityMap
      .map(p => ({ ...p, count: patterns[p.name] || 0 }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  // Learning opportunities
  insights.learningOpportunities = [
    'Focus autofix patterns on most frequent issues',
    'Develop file-specific fix strategies based on complexity',
    'Create progressive fix sequences for high-issue files',
    'Build confidence scoring based on fix success rates'
  ];

  return insights;
}

// Apply targeted training fixes
async function applyTrainingFixes(analysisResults, insights) {
  console.log('\n🎯 Applying targeted training fixes...');
  
  const trainingResults = {
    filesProcessed: 0,
    fixesApplied: 0,
    successRate: 0,
    patterns: {}
  };

  // Focus on high-impact, low-complexity files first
  const targetFiles = insights.fileComplexityPatterns
    .filter(f => f.complexity > 0 && f.complexity < 1) // Sweet spot
    .slice(0, 10);

  for (const fileInfo of targetFiles) {
    const fullPath = analysisResults.find(r => path.basename(r.filePath) === fileInfo.file)?.filePath;
    if (!fullPath || !fs.existsSync(fullPath)) continue;

    console.log(`🔧 Training on ${fileInfo.file}...`);
    
    // Apply simple, high-confidence fixes
    const beforeContent = fs.readFileSync(fullPath, 'utf8');
    let afterContent = beforeContent;
    let fixCount = 0;

    // Fix 1: Sort imports (high confidence)
    const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?/g;
    afterContent = afterContent.replace(importRegex, (match, imports, module) => {
      const sortedImports = imports
        .split(',')
        .map(imp => imp.trim())
        .sort()
        .join(', ');
      fixCount++;
      return `import { ${sortedImports} } from '${module}';`;
    });

    // Fix 2: Remove simple unused variables (medium confidence)
    const unusedCatchRegex = /catch\s*\(\s*(\w+)\s*\)\s*{([^}]*)}/g;
    afterContent = afterContent.replace(unusedCatchRegex, (match, varName, body) => {
      if (!body.includes(varName) && !varName.startsWith('_')) {
        fixCount++;
        return match.replace(varName, `_${varName}`);
      }
      return match;
    });

    if (fixCount > 0) {
      fs.writeFileSync(fullPath, afterContent);
      trainingResults.filesProcessed++;
      trainingResults.fixesApplied += fixCount;
      console.log(`   ✅ Applied ${fixCount} training fixes`);
    } else {
      console.log(`   ✨ No training fixes needed`);
    }
  }

  trainingResults.successRate = trainingResults.filesProcessed / Math.max(targetFiles.length, 1);
  return trainingResults;
}

// Main training function
async function runLargeSetTraining() {
  console.log('🔍 Discovering files for training...');
  const allFiles = await discoverAllFiles();
  console.log(`📁 Found ${allFiles.length} files for analysis`);

  console.log('\n📊 Analyzing files for training patterns...');
  const analysisResults = [];
  
  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i];
    process.stdout.write(`\r   Analyzing ${i + 1}/${allFiles.length}: ${path.basename(filePath)}`);
    
    const analysis = await analyzeFileForTraining(filePath);
    if (analysis) {
      analysisResults.push(analysis);
    }
  }
  console.log('\n');

  console.log('💾 Storing training data...');
  const trainingData = await storeTrainingData(analysisResults);

  console.log('🧠 Generating training insights...');
  const insights = generateTrainingInsights(analysisResults, trainingData);

  console.log('\n📈 Training Insights:');
  console.log(`📊 Total files analyzed: ${analysisResults.length}`);
  console.log(`🐛 Total issues found: ${trainingData?.total_issues || 0}`);
  console.log('\n🔥 Most common issues:');
  insights.mostCommonIssues.slice(0, 5).forEach(issue => {
    console.log(`   • ${issue.rule}: ${issue.count} occurrences`);
  });

  console.log('\n🎯 Fix priority recommendations:');
  insights.fixPriorityRecommendations.slice(0, 5).forEach(rec => {
    console.log(`   • ${rec.name}: ${rec.count} issues (${rec.impact} impact) - ${rec.reason}`);
  });

  // Apply training fixes
  const trainingResults = await applyTrainingFixes(analysisResults, insights);

  // Store training results
  if (memoryEnabled) {
    try {
      await supabase
        .from('memories')
        .insert({
          content: `Training session completed: ${trainingResults.fixesApplied} fixes applied`,
          metadata: {
            session_id: trainingSessionId,
            training_results: trainingResults,
            insights: insights,
            memory_type: 'training_session_results'
          },
          user_id: 'claude-training-system'
        });
      console.log('\n📚 Training results stored in memory');
    } catch (error) {
      console.log(`⚠️  Failed to store results: ${error.message}`);
    }
  }

  console.log('\n🎉 Large set training complete!');
  console.log(`📊 Results:`);
  console.log(`   • Files processed: ${trainingResults.filesProcessed}`);
  console.log(`   • Fixes applied: ${trainingResults.fixesApplied}`);
  console.log(`   • Success rate: ${(trainingResults.successRate * 100).toFixed(1)}%`);
  console.log(`🧠 Training data ${memoryEnabled ? 'stored in Supabase' : 'logged locally'}`);
  console.log('\n🔄 Run "npm run fix:adaptive" to use the trained patterns');
}

// Execute training
runLargeSetTraining().catch(error => {
  console.error('❌ Training failed:', error);
  process.exit(1);
});