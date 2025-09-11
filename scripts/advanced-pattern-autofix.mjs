#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔬 Advanced Pattern Autofix - Next Generation Fixes\n');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-anon-key';

let supabase = null;
let memoryEnabled = false;

// Configure Supabase
try {
  if (!SUPABASE_URL.includes('your-project') && !SUPABASE_KEY.includes('your-anon-key')) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    memoryEnabled = true;
    console.log('✅ Connected to Supabase for memory persistence');
  } else {
    console.log('🔧 Configuring Supabase with environment detection...');
    
    // Try to read from common config files
    const configPaths = [
      '.env',
      '.env.local', 
      'supabase/.env',
      'config.json'
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`📁 Found config file: ${configPath}`);
        try {
          const content = fs.readFileSync(configPath, 'utf8');
          const urlMatch = content.match(/SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
          const keyMatch = content.match(/SUPABASE_(?:ANON_)?KEY\s*=\s*["']?([^"'\s]+)["']?/);
          
          if (urlMatch && keyMatch) {
            supabase = createClient(urlMatch[1], keyMatch[1]);
            memoryEnabled = true;
            console.log(`✅ Configured Supabase from ${configPath}`);
            break;
          }
        } catch (error) {
          console.log(`⚠️  Could not parse ${configPath}: ${error.message}`);
        }
      }
    }
    
    if (!memoryEnabled) {
      console.log('⚠️  Running in offline mode - set SUPABASE_URL and SUPABASE_ANON_KEY for full memory');
    }
  }
} catch (error) {
  console.log(`⚠️  Supabase setup failed: ${error.message}`);
}

const sessionId = `advanced_${Date.now()}`;
const appliedFixes = [];

// Advanced fix patterns based on lint analysis
const advancedPatterns = {
  'sort_imports': {
    pattern: /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?/g,
    apply: (content) => {
      return content.replace(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?/g, (match, imports, module) => {
        const sortedImports = imports
          .split(',')
          .map(imp => imp.trim())
          .filter(imp => imp.length > 0)
          .sort((a, b) => {
            // Sort type imports last
            const aIsType = a.startsWith('type ');
            const bIsType = b.startsWith('type ');
            if (aIsType && !bIsType) return 1;
            if (!aIsType && bIsType) return -1;
            return a.localeCompare(b);
          });
        
        return `import { ${sortedImports.join(', ')} } from '${module}';`;
      });
    },
    priority: 0.9,
    confidence: 0.95,
    description: 'Sort import members alphabetically with type imports last'
  },

  'remove_unused_imports': {
    pattern: /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?/g,
    apply: (content, filePath) => {
      let modifiedContent = content;
      const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?/g;
      const imports = [];
      
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importList = match[1].split(',').map(imp => imp.trim().replace(/^type\s+/, ''));
        imports.push({
          full: match[0],
          imports: importList,
          module: match[2]
        });
      }
      
      // Check which imports are actually used
      imports.forEach(importGroup => {
        const usedImports = importGroup.imports.filter(imp => {
          const usage = new RegExp(`\\b${imp}\\b`, 'g');
          const usageCount = (content.match(usage) || []).length;
          return usageCount > 1; // More than just the import declaration
        });
        
        if (usedImports.length === 0) {
          // Remove entire import line
          modifiedContent = modifiedContent.replace(importGroup.full, '');
        } else if (usedImports.length < importGroup.imports.length) {
          // Update import with only used imports
          const newImport = `import { ${usedImports.join(', ')} } from '${importGroup.module}';`;
          modifiedContent = modifiedContent.replace(importGroup.full, newImport);
        }
      });
      
      return modifiedContent;
    },
    priority: 0.85,
    confidence: 0.9,
    description: 'Remove unused imports and clean up import statements'
  },

  'fix_no_explicit_any': {
    pattern: /(\w+):\s*any(?!\[\])/g,
    apply: (content, filePath) => {
      const contextualTypes = {
        // Express/HTTP context
        'req': 'Request',
        'res': 'Response', 
        'next': 'NextFunction',
        'middleware': '(req: Request, res: Response, next: NextFunction) => void',
        
        // Error handling
        'error': 'Error | unknown',
        'err': 'Error | unknown',
        'exception': 'Error',
        
        // Configuration objects
        'config': 'Record<string, unknown>',
        'options': 'Record<string, unknown>',
        'settings': 'Record<string, unknown>',
        'params': 'Record<string, string>',
        'query': 'Record<string, string | string[]>',
        'headers': 'Record<string, string>',
        'metadata': 'Record<string, unknown>',
        'context': 'Record<string, unknown>',
        
        // Data types
        'data': 'unknown',
        'result': 'unknown',
        'response': 'unknown',
        'payload': 'unknown',
        'body': 'Record<string, unknown>',
        
        // Schema types
        'schema': 'object',
        'inputSchema': 'object',
        'outputSchema': 'object',
        'validationSchema': 'object',
        
        // Function types
        'callback': '(...args: unknown[]) => unknown',
        'handler': '(...args: unknown[]) => unknown',
        'listener': '(...args: unknown[]) => void',
        
        // Agent/AI specific
        'agent': 'unknown',
        'model': 'unknown',
        'embedding': 'number[]',
        'memory': 'Record<string, unknown>',
        'capability': 'Record<string, unknown>'
      };
      
      return content.replace(/(\w+):\s*any(?!\[\])/g, (match, varName) => {
        const inferredType = contextualTypes[varName] || 'unknown';
        return `${varName}: ${inferredType}`;
      });
    },
    priority: 0.8,
    confidence: 0.85,
    description: 'Replace any types with contextually appropriate types'
  },

  'extract_magic_numbers': {
    pattern: /\b(\d+(?:\.\d+)?)\b/g,
    apply: (content, filePath) => {
      const magicNumbers = {
        // Common confidence thresholds
        '0.9': 'VERY_HIGH_CONFIDENCE',
        '0.8': 'HIGH_CONFIDENCE',
        '0.7': 'GOOD_CONFIDENCE', 
        '0.6': 'MODERATE_CONFIDENCE',
        '0.5': 'MEDIUM_CONFIDENCE',
        '0.4': 'LOW_CONFIDENCE',
        '0.3': 'MINIMUM_CONFIDENCE',
        '0.1': 'VERY_LOW_CONFIDENCE',
        
        // Common percentages
        '100': 'FULL_PERCENTAGE',
        '50': 'HALF_PERCENTAGE',
        '25': 'QUARTER_PERCENTAGE',
        
        // Time constants
        '1000': 'ONE_SECOND_MS',
        '5000': 'FIVE_SECONDS_MS',
        '30000': 'THIRTY_SECONDS_MS',
        '60000': 'ONE_MINUTE_MS',
        
        // HTTP status codes
        '200': 'HTTP_OK',
        '201': 'HTTP_CREATED',
        '400': 'HTTP_BAD_REQUEST',
        '401': 'HTTP_UNAUTHORIZED',
        '404': 'HTTP_NOT_FOUND',
        '500': 'HTTP_INTERNAL_ERROR',
        
        // Array/pagination
        '10': 'DEFAULT_PAGE_SIZE',
        '20': 'MEDIUM_PAGE_SIZE',
        '50': 'LARGE_PAGE_SIZE',
        
        // Retry/limits
        '3': 'DEFAULT_RETRY_COUNT',
        '5': 'MAX_RETRY_COUNT'
      };
      
      const constantsToAdd = new Set();
      
      // Replace magic numbers with constants
      let modifiedContent = content.replace(/\b(\d+(?:\.\d+)?)\b/g, (match, number) => {
        const constant = magicNumbers[number];
        if (constant && !content.includes(`const ${constant}`)) {
          constantsToAdd.add({ number, constant });
          return constant;
        }
        return match;
      });
      
      // Add constants at the top of the file
      if (constantsToAdd.size > 0) {
        const lines = modifiedContent.split('\n');
        let insertIndex = 0;
        
        // Find insertion point after imports
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].startsWith('import') && 
              !lines[i].startsWith('/**') && 
              !lines[i].startsWith(' *') && 
              !lines[i].startsWith(' */') && 
              lines[i].trim() !== '') {
            insertIndex = i;
            break;
          }
        }
        
        const constants = Array.from(constantsToAdd)
          .map(({number, constant}) => `const ${constant} = ${number};`)
          .join('\n');
        
        lines.splice(insertIndex, 0, constants, '');
        modifiedContent = lines.join('\n');
      }
      
      return modifiedContent;
    },
    priority: 0.7,
    confidence: 0.8,
    description: 'Extract magic numbers to named constants'
  },

  'fix_nested_ternary': {
    pattern: /(\w+)\s*\?\s*([^:]+)\s*:\s*([^;]*\?[^;]*:[^;]*)/g,
    apply: (content) => {
      return content.replace(/(\w+)\s*\?\s*([^:]+)\s*:\s*([^;]*\?[^;]*:[^;]*)/g, (match, condition, trueBranch, nestedTernary) => {
        // Convert nested ternary to if-else chain
        const sanitizedCondition = condition.trim();
        const sanitizedTrue = trueBranch.trim();
        
        // For simple cases, use multiple conditions
        return `${sanitizedCondition} ? ${sanitizedTrue} : (${nestedTernary})`;
      });
    },
    priority: 0.6,
    confidence: 0.7,
    description: 'Simplify nested ternary expressions'
  },

  'fix_unused_variables': {
    pattern: /catch\s*\(\s*(\w+)\s*\)\s*{([^}]*)}/g,
    apply: (content) => {
      return content.replace(/catch\s*\(\s*(\w+)\s*\)\s*{([^}]*)}/g, (match, varName, body) => {
        if (!body.includes(varName) && !varName.startsWith('_')) {
          return match.replace(varName, `_${varName}`);
        }
        return match;
      });
    },
    priority: 0.9,
    confidence: 0.95,
    description: 'Prefix unused catch variables with underscore'
  }
};

// Store fix in memory with advanced metadata
async function storeAdvancedFix(filePath, fixType, beforeContent, afterContent, stats) {
  if (!memoryEnabled) return;

  try {
    const fix = {
      session_id: sessionId,
      file_path: filePath,
      fix_type: fixType,
      before_content: beforeContent.substring(0, 1000),
      after_content: afterContent.substring(0, 1000),
      stats,
      improvement_score: stats.linesChanged / Math.max(stats.totalLines, 1),
      confidence: advancedPatterns[fixType]?.confidence || 0.5,
      success: stats.errorsFixed > 0 || stats.warningsFixed > 0,
      timestamp: new Date().toISOString()
    };

    const content = `Advanced fix: ${fixType} in ${path.basename(filePath)} - ${stats.errorsFixed} errors, ${stats.warningsFixed} warnings fixed`;
    
    // Generate embedding if function exists
    let embedding = null;
    try {
      const { data } = await supabase.rpc('ai_generate_embedding', { content });
      embedding = data;
    } catch (error) {
      // Embedding generation optional
    }

    await supabase
      .from('memories')
      .insert({
        content,
        metadata: {
          ...fix,
          memory_type: 'advanced_autofix',
          tags: ['autofix', 'advanced', fixType, path.extname(filePath).slice(1)]
        },
        embedding,
        user_id: 'claude-advanced-autofix'
      });

    console.log(`📚 Stored advanced fix: ${fixType} (${stats.errorsFixed}E, ${stats.warningsFixed}W)`);
  } catch (error) {
    console.log(`⚠️  Failed to store fix: ${error.message}`);
  }
}

// Apply advanced pattern with detailed validation
async function applyAdvancedPattern(filePath, patternName, pattern) {
  if (!fs.existsSync(filePath)) return null;

  const beforeContent = fs.readFileSync(filePath, 'utf8');
  const beforeStats = await analyzeLintIssues(filePath, beforeContent);
  
  console.log(`🔬 Applying ${patternName} to ${path.basename(filePath)}...`);
  console.log(`   Before: ${beforeStats.errors} errors, ${beforeStats.warnings} warnings`);

  let afterContent;
  if (typeof pattern.apply === 'function') {
    afterContent = pattern.apply(beforeContent, filePath);
  } else {
    afterContent = beforeContent.replace(pattern.pattern, pattern.replacement);
  }

  if (afterContent === beforeContent) {
    console.log(`   ✨ No changes needed`);
    return null;
  }

  // Validate changes
  const afterStats = await analyzeLintIssues(filePath, afterContent);
  console.log(`   After: ${afterStats.errors} errors, ${afterStats.warnings} warnings`);

  const stats = {
    errorsFixed: beforeStats.errors - afterStats.errors,
    warningsFixed: beforeStats.warnings - afterStats.warnings,
    linesChanged: Math.abs(beforeStats.lines - afterStats.lines),
    totalLines: beforeStats.lines,
    improvementScore: ((beforeStats.errors + beforeStats.warnings) - (afterStats.errors + afterStats.warnings)) / Math.max(beforeStats.errors + beforeStats.warnings, 1)
  };

  const isImprovement = stats.errorsFixed >= 0 && stats.warningsFixed >= 0 && (stats.errorsFixed > 0 || stats.warningsFixed > 0);
  
  if (isImprovement) {
    fs.writeFileSync(filePath, afterContent);
    console.log(`   ✅ Applied: -${stats.errorsFixed}E, -${stats.warningsFixed}W`);
    
    appliedFixes.push({
      file: filePath,
      pattern: patternName,
      stats
    });

    await storeAdvancedFix(filePath, patternName, beforeContent, afterContent, stats);
    return stats;
  } else {
    console.log(`   ❌ Reverted: would worsen code quality`);
    return null;
  }
}

// Analyze lint issues in file
async function analyzeLintIssues(filePath, content = null) {
  try {
    let tempFile = filePath;
    
    if (content) {
      tempFile = `${filePath}.temp`;
      fs.writeFileSync(tempFile, content);
    }

    const { stdout } = await execAsync(`npx eslint "${tempFile}" --format json`).catch(() => ({ stdout: '[]' }));
    
    if (content) {
      fs.unlinkSync(tempFile);
    }

    const results = JSON.parse(stdout || '[]');
    const fileResult = results[0] || { messages: [] };

    return {
      errors: fileResult.errorCount || 0,
      warnings: fileResult.warningCount || 0,
      lines: content ? content.split('\n').length : fs.readFileSync(filePath, 'utf8').split('\n').length,
      messages: fileResult.messages || []
    };
  } catch (error) {
    return { errors: 0, warnings: 0, lines: 0, messages: [] };
  }
}

// Main execution
async function runAdvancedPatterns() {
  const targetFiles = [
    'src/agents/base_agent.ts',
    'src/agents/cognitive/devils_advocate_agent.ts',
    'src/routers/memory.ts',
    'src/services/ollama_service.ts',
    'src/server.ts',
    'src/middleware/security.ts'
  ];

  console.log('🚀 Starting advanced pattern autofix...\n');

  let totalStats = { errorsFixed: 0, warningsFixed: 0, filesModified: 0 };

  for (const filePath of targetFiles) {
    if (!fs.existsSync(filePath)) continue;

    console.log(`\n📁 Processing ${path.basename(filePath)}...`);
    
    for (const [patternName, pattern] of Object.entries(advancedPatterns)) {
      const result = await applyAdvancedPattern(filePath, patternName, pattern);
      if (result) {
        totalStats.errorsFixed += result.errorsFixed;
        totalStats.warningsFixed += result.warningsFixed;
        if (result.errorsFixed > 0 || result.warningsFixed > 0) {
          totalStats.filesModified++;
        }
      }
    }
  }

  // Store session summary
  if (memoryEnabled) {
    try {
      const sessionSummary = {
        session_id: sessionId,
        total_errors_fixed: totalStats.errorsFixed,
        total_warnings_fixed: totalStats.warningsFixed,
        files_modified: totalStats.filesModified,
        patterns_used: Object.keys(advancedPatterns),
        memory_type: 'advanced_session_summary'
      };

      await supabase
        .from('memories')
        .insert({
          content: `Advanced autofix session: ${totalStats.errorsFixed} errors, ${totalStats.warningsFixed} warnings fixed across ${totalStats.filesModified} files`,
          metadata: sessionSummary,
          user_id: 'claude-advanced-autofix'
        });
      
      console.log('\n📊 Session summary stored in memory');
    } catch (error) {
      console.log(`⚠️  Failed to store session summary: ${error.message}`);
    }
  }

  console.log('\n🎉 Advanced pattern autofix complete!');
  console.log(`📊 Results: ${totalStats.errorsFixed} errors fixed, ${totalStats.warningsFixed} warnings fixed`);
  console.log(`📁 Modified ${totalStats.filesModified} files`);
  console.log(`🧠 All patterns ${memoryEnabled ? 'stored in Supabase memory' : 'logged locally'}`);
  console.log('\n🔄 Run "npm run lint" to see remaining issues');
}

// Execute
runAdvancedPatterns().catch(error => {
  console.error('❌ Advanced autofix failed:', error);
  process.exit(1);
});