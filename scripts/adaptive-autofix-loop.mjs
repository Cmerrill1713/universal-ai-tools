#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔄 Adaptive Autofix Loop - Learning Between Fixes\n');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const MAX_ITERATIONS = 5;
const LEARNING_THRESHOLD = 0.7; // Minimum success rate to continue

let supabase = null;
let memoryEnabled = false;

// Initialize Supabase
try {
  if (!SUPABASE_URL.includes('your-project') && !SUPABASE_KEY.includes('your-anon-key')) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    memoryEnabled = true;
    console.log('✅ Connected to Supabase for adaptive learning');
  } else {
    console.log('⚠️  Running in offline mode - limited learning capabilities');
  }
} catch (error) {
  console.log('⚠️  Supabase connection failed - using local learning only');
}

// Session tracking
const sessionId = `adaptive_${Date.now()}`;
const learningHistory = [];

// Enhanced fix patterns with success tracking
const adaptiveFixPatterns = {
  'type_improvement': {
    pattern: /([\w\s]*?):\s*any(?=\s*[,;)\]}])/g,
    replacement: (match, varName) => {
      const cleanVarName = varName.trim().replace(/.*\s/, '');
      const typeMap = {
        'req': 'Request', 'res': 'Response', 'next': 'NextFunction',
        'error': 'Error | unknown', 'config': 'Record<string, unknown>',
        'metadata': 'Record<string, unknown>', 'data': 'unknown'
      };
      return `${varName}: ${typeMap[cleanVarName] || 'unknown'}`;
    },
    priority: 1.0,
    successRate: 0.85,
    confidence: 0.8
  },
  
  'unused_variable_fix': {
    pattern: /catch\s*\(\s*(\w+)\s*\)\s*{([^}]*)}/g,
    replacement: (match, varName, body) => {
      if (!body.includes(varName)) {
        return match.replace(varName, `_${varName}`);
      }
      return match;
    },
    priority: 0.9,
    successRate: 0.95,
    confidence: 0.9
  },

  'import_consolidation': {
    pattern: /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];\s*\n\s*import\s+{([^}]+)}\s+from\s+['"]\2['"];?/g,
    replacement: (match, imports1, module, imports2) => {
      const allImports = [...new Set([...imports1.split(','), ...imports2.split(',')].map(i => i.trim()))];
      return `import { ${allImports.join(', ')} } from '${module}';`;
    },
    priority: 0.8,
    successRate: 0.90,
    confidence: 0.85
  },

  'magic_number_extraction': {
    pattern: /\b(0\.\d+)\b/g,
    replacement: (match, number) => {
      const constants = {
        '0.7': 'GOOD_CONFIDENCE',
        '0.8': 'HIGH_CONFIDENCE', 
        '0.6': 'MODERATE_CONFIDENCE',
        '0.5': 'MEDIUM_THRESHOLD'
      };
      return constants[number] || match;
    },
    priority: 0.6,
    successRate: 0.75,
    confidence: 0.7
  }
};

// Validate changes and learn from results
async function validateAndLearn(filePath, fixType, beforeContent, afterContent) {
  try {
    // Get lint errors before and after
    const beforeErrors = await getLintErrors(filePath, beforeContent);
    const afterErrors = await getLintErrors(filePath, afterContent);
    
    const improvement = beforeErrors.length - afterErrors.length;
    const newErrors = afterErrors.filter(error => 
      !beforeErrors.some(oldError => oldError.message === error.message)
    );

    const success = improvement > 0 && newErrors.length === 0;
    const improvementScore = improvement / Math.max(beforeErrors.length, 1);

    // Update pattern success rate
    if (adaptiveFixPatterns[fixType]) {
      const pattern = adaptiveFixPatterns[fixType];
      pattern.successRate = (pattern.successRate * 0.8) + (success ? 0.2 : 0);
      pattern.confidence = Math.max(0.1, pattern.confidence + (success ? 0.05 : -0.1));
    }

    const learning = {
      fixType,
      filePath: path.basename(filePath),
      success,
      improvement,
      newErrorsCount: newErrors.length,
      improvementScore,
      timestamp: new Date().toISOString()
    };

    learningHistory.push(learning);

    // Store in Supabase if available
    if (memoryEnabled) {
      await storeLearning(learning);
    }

    console.log(`${success ? '✅' : '❌'} ${fixType}: ${improvement > 0 ? '+' : ''}${improvement} errors, ${newErrors.length} new issues`);
    
    return { success, improvement, newErrors, improvementScore };

  } catch (error) {
    console.log(`⚠️  Validation failed for ${fixType}: ${error.message}`);
    return { success: false, improvement: 0, newErrors: [], improvementScore: 0 };
  }
}

// Get lint errors for validation
async function getLintErrors(filePath, content = null) {
  try {
    // Write content to temp file if provided
    if (content) {
      const tempFile = `${filePath}.temp`;
      fs.writeFileSync(tempFile, content);
      
      const { stdout } = await execAsync(`npx eslint "${tempFile}" --format json`).catch(() => ({ stdout: '[]' }));
      fs.unlinkSync(tempFile);
      
      const results = JSON.parse(stdout || '[]');
      return results[0]?.messages || [];
    } else {
      const { stdout } = await execAsync(`npx eslint "${filePath}" --format json`).catch(() => ({ stdout: '[]' }));
      const results = JSON.parse(stdout || '[]');
      return results[0]?.messages || [];
    }
  } catch (error) {
    return [];
  }
}

// Store learning in Supabase
async function storeLearning(learning) {
  try {
    const content = `Adaptive fix learning: ${learning.fixType} ${learning.success ? 'succeeded' : 'failed'}`;
    
    await supabase
      .from('memories')
      .insert({
        content,
        metadata: {
          ...learning,
          memory_type: 'adaptive_learning',
          session_id: sessionId,
          tags: ['autofix', 'adaptive', 'learning', learning.fixType]
        },
        user_id: 'claude-autofix'
      });
  } catch (error) {
    console.log(`⚠️  Failed to store learning: ${error.message}`);
  }
}

// Get adaptive recommendations from memory
async function getAdaptiveRecommendations(filePath) {
  if (!memoryEnabled) return { prioritizedFixes: Object.keys(adaptiveFixPatterns) };

  try {
    const { data } = await supabase
      .from('memories')
      .select('*')
      .eq('metadata->>memory_type', 'adaptive_learning')
      .like('metadata->>filePath', `%${path.extname(filePath)}`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!data) return { prioritizedFixes: Object.keys(adaptiveFixPatterns) };

    // Analyze recent performance by fix type
    const fixPerformance = {};
    data.forEach(memory => {
      const learning = memory.metadata;
      const fixType = learning.fixType;
      if (!fixPerformance[fixType]) {
        fixPerformance[fixType] = { successes: 0, total: 0 };
      }
      fixPerformance[fixType].total++;
      if (learning.success) fixPerformance[fixType].successes++;
    });

    // Sort by success rate
    const prioritizedFixes = Object.keys(adaptiveFixPatterns).sort((a, b) => {
      const aRate = fixPerformance[a] ? fixPerformance[a].successes / fixPerformance[a].total : 0.5;
      const bRate = fixPerformance[b] ? fixPerformance[b].successes / fixPerformance[b].total : 0.5;
      return bRate - aRate;
    });

    return { prioritizedFixes, fixPerformance };
  } catch (error) {
    console.log(`⚠️  Failed to get recommendations: ${error.message}`);
    return { prioritizedFixes: Object.keys(adaptiveFixPatterns) };
  }
}

// Apply fix with adaptive learning
async function applyAdaptiveFix(filePath, fixType, pattern) {
  if (!fs.existsSync(filePath)) return { applied: 0, success: false };

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fixesApplied = 0;

  console.log(`🧠 Applying adaptive fix: ${fixType}`);

  // Apply fix with current confidence level
  const fixPattern = adaptiveFixPatterns[fixType];
  if (fixPattern && fixPattern.confidence > 0.3) {
    content = content.replace(pattern.pattern, (...args) => {
      fixesApplied++;
      return pattern.replacement(...args);
    });
  } else {
    console.log(`⚠️  Skipping ${fixType} - confidence too low (${fixPattern?.confidence})`);
    return { applied: 0, success: false };
  }

  if (fixesApplied > 0) {
    // Validate before committing changes
    const validation = await validateAndLearn(filePath, fixType, originalContent, content);
    
    if (validation.success || validation.improvement > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Applied ${fixesApplied} ${fixType} fixes with ${validation.improvement} error reduction`);
      return { applied: fixesApplied, success: true, validation };
    } else {
      console.log(`❌ Reverting ${fixType} - would introduce ${validation.newErrors.length} new errors`);
      return { applied: 0, success: false, validation };
    }
  }

  return { applied: 0, success: false };
}

// Main adaptive learning loop
async function runAdaptiveLoop() {
  const targetFiles = [
    'src/agents/base_agent.ts',
    'src/agents/cognitive/devils_advocate_agent.ts', 
    'src/routers/memory.ts',
    'src/services/ollama_service.ts'
  ];

  console.log('🔄 Starting adaptive autofix learning loop...\n');

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n🚀 Iteration ${iteration}/${MAX_ITERATIONS}`);
    
    let totalFixes = 0;
    let successfulFixes = 0;

    for (const filePath of targetFiles) {
      if (!fs.existsSync(filePath)) continue;

      console.log(`\n📁 Processing ${path.basename(filePath)}...`);
      
      // Get adaptive recommendations
      const recommendations = await getAdaptiveRecommendations(filePath);
      console.log(`🎯 Priority order: ${recommendations.prioritizedFixes.slice(0, 3).join(', ')}`);

      // Apply fixes in priority order
      for (const fixType of recommendations.prioritizedFixes) {
        const pattern = adaptiveFixPatterns[fixType];
        if (!pattern) continue;

        const result = await applyAdaptiveFix(filePath, fixType, pattern);
        totalFixes += result.applied;
        if (result.success) successfulFixes += result.applied;
      }
    }

    // Calculate iteration success rate
    const successRate = totalFixes > 0 ? successfulFixes / totalFixes : 0;
    console.log(`\n📊 Iteration ${iteration} complete: ${successfulFixes}/${totalFixes} fixes successful (${(successRate * 100).toFixed(1)}%)`);

    // Stop if success rate is too low
    if (successRate < LEARNING_THRESHOLD && iteration > 2) {
      console.log(`⚠️  Success rate below threshold (${LEARNING_THRESHOLD * 100}%) - stopping adaptive loop`);
      break;
    }

    // Brief pause between iterations for file system
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Final learning summary
  console.log('\n🧠 Adaptive Learning Summary:');
  console.log(`📈 Total learning events: ${learningHistory.length}`);
  
  const overallSuccess = learningHistory.filter(l => l.success).length / Math.max(learningHistory.length, 1);
  console.log(`🎯 Overall success rate: ${(overallSuccess * 100).toFixed(1)}%`);

  // Show pattern performance
  console.log('\n📊 Pattern Performance:');
  Object.entries(adaptiveFixPatterns).forEach(([type, pattern]) => {
    console.log(`   ${type}: ${(pattern.successRate * 100).toFixed(1)}% success, confidence: ${pattern.confidence.toFixed(2)}`);
  });

  // Store session summary
  if (memoryEnabled) {
    await storeLearning({
      fixType: 'session_summary',
      success: overallSuccess > 0.5,
      improvement: learningHistory.reduce((sum, l) => sum + l.improvement, 0),
      sessionStats: {
        iterations: MAX_ITERATIONS,
        totalLearningEvents: learningHistory.length,
        overallSuccessRate: overallSuccess,
        patterns: adaptiveFixPatterns
      }
    });
  }

  console.log(`\n🎉 Adaptive autofix loop complete! Check 'npm run lint' for remaining issues.`);
}

// Run the adaptive learning loop
runAdaptiveLoop().catch(error => {
  console.error('❌ Adaptive loop failed:', error);
  process.exit(1);
});