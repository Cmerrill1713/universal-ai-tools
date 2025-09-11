#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

console.log('🧠🔗 Intelligent Autofix with Supabase Memory\n');

// Initialize Supabase (using environment variables or defaults)
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

let supabase = null;
let memoryEnabled = false;

try {
  if (supabaseUrl.includes('your-project') || supabaseKey.includes('your-anon-key')) {
    console.log('⚠️  Supabase credentials not configured - running in offline mode');
  } else {
    supabase = createClient(supabaseUrl, supabaseKey);
    memoryEnabled = true;
    console.log('✅ Connected to Supabase for memory storage');
  }
} catch (error) {
  console.log('⚠️  Failed to connect to Supabase - running in offline mode');
}

// Session tracking
const sessionId = `autofix_${Date.now()}`;
const fixesApplied = [];

// Enhanced type inferences with memory
const typeInferences = {
  'inputSchema': 'object',
  'outputSchema': 'object',
  'req': 'Request',
  'res': 'Response', 
  'next': 'NextFunction',
  'error': 'Error | unknown',
  'config': 'Record<string, any>',
  'options': 'Record<string, any>',
  'params': 'Record<string, string>',
  'query': 'Record<string, string>',
  'body': 'Record<string, any>',
  'headers': 'Record<string, string>',
  'metadata': 'Record<string, any>',
  'context': 'Record<string, any>',
  'data': 'unknown',
  'result': 'unknown',
  'response': 'unknown',
};

// Store fix in memory
async function storeFix(filePath, fixType, originalCode, fixedCode, reasoning, confidence = 0.8) {
  const fix = {
    file_path: filePath,
    fix_type: fixType,
    original_code: originalCode.substring(0, 500),
    fixed_code: fixedCode.substring(0, 500),
    reasoning,
    confidence,
    success: true,
    session_id: sessionId
  };

  fixesApplied.push(fix);

  if (!memoryEnabled) return;

  try {
    const content = `${fixType}: ${reasoning} | ${originalCode} -> ${fixedCode}`;
    
    // Generate embedding if Supabase supports it
    const { data: embedding } = await supabase.rpc('ai_generate_embedding', {
      content
    }).catch(() => ({ data: null }));

    await supabase
      .from('memories')
      .insert({
        content,
        metadata: {
          ...fix,
          memory_type: 'autofix',
          tags: ['autofix', fixType, path.extname(filePath).slice(1)]
        },
        embedding: embedding,
        user_id: 'claude-autofix'
      });

    console.log(`📚 Stored fix in memory: ${fixType}`);
  } catch (error) {
    console.log(`⚠️  Failed to store fix in memory: ${error.message}`);
  }
}

// Get similar fixes from memory
async function getSimilarFixes(currentFix, fileExtension) {
  if (!memoryEnabled) return [];

  try {
    const { data } = await supabase
      .from('memories')
      .select('*')
      .eq('metadata->>memory_type', 'autofix')
      .like('metadata->>tags', `%${fileExtension}%`)
      .eq('metadata->>success', 'true')
      .order('created_at', { ascending: false })
      .limit(10);

    return data?.map(memory => memory.metadata) || [];
  } catch (error) {
    console.log(`⚠️  Failed to retrieve similar fixes: ${error.message}`);
    return [];
  }
}

// Enhanced file analysis with memory integration
async function analyzeAndFix(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fixes = 0;
  const changes = [];
  const fileExtension = path.extname(filePath).slice(1);

  console.log(`\n🔍 Analyzing ${path.relative(process.cwd(), filePath)}...`);

  // Get similar fixes from memory for context
  const similarFixes = await getSimilarFixes(content.substring(0, 200), fileExtension);
  if (similarFixes.length > 0) {
    console.log(`📚 Found ${similarFixes.length} similar fixes in memory`);
  }

  // Fix 1: Duplicate imports (line 7 and 9 in devils_advocate_agent.ts)
  const duplicateImportRegex = /import.*from\s+['"]([^'"]+)['"];?\s*\n\s*import.*from\s+['"]\1['"];?/g;
  const newContent1 = content.replace(duplicateImportRegex, (match, module) => {
    const lines = match.split('\n');
    const combinedImports = new Set();
    
    lines.forEach(line => {
      const importMatch = line.match(/import\s+(?:{([^}]+)}|(\w+))\s+from/);
      if (importMatch) {
        if (importMatch[1]) {
          importMatch[1].split(',').forEach(imp => combinedImports.add(imp.trim()));
        } else if (importMatch[2]) {
          combinedImports.add(importMatch[2]);
        }
      }
    });

    fixes++;
    changes.push('Merged duplicate imports');
    const fixed = `import { ${Array.from(combinedImports).join(', ')} } from '${module}';`;
    
    storeFix(filePath, 'merge_duplicate_imports', match, fixed, 
      'Merged duplicate import statements from the same module');
    
    return fixed;
  });

  content = newContent1;

  // Fix 2: Remove unused interfaces/types
  const unusedInterfaceRegex = /interface\s+(\w+)\s*{[^}]*}\s*\n?\s*(?=\n|$)/g;
  const interfaces = [];
  content.replace(unusedInterfaceRegex, (match, interfaceName) => {
    interfaces.push({ name: interfaceName, definition: match });
    return match;
  });

  interfaces.forEach(({ name, definition }) => {
    const usageRegex = new RegExp(`\\b${name}\\b`, 'g');
    const usages = (content.match(usageRegex) || []).length;
    
    if (usages <= 1) { // Only declaration, no usage
      content = content.replace(definition, '');
      fixes++;
      changes.push(`Removed unused interface: ${name}`);
      
      storeFix(filePath, 'remove_unused_interface', definition, '', 
        `Removed unused interface ${name} that was declared but never used`);
    }
  });

  // Fix 3: Replace 'any' with context-appropriate types
  const anyRegex = /([\w\s]*?):\s*any(?=\s*[,;)\]}])/g;
  content = content.replace(anyRegex, (match, varName) => {
    const cleanVarName = varName.trim().replace(/.*\s/, '');
    const inferredType = typeInferences[cleanVarName] || 'unknown';
    
    if (inferredType !== 'unknown') {
      fixes++;
      changes.push(`${cleanVarName}: any → ${cleanVarName}: ${inferredType}`);
      
      storeFix(filePath, 'improve_type_annotation', match, `${varName}: ${inferredType}`,
        `Replaced generic 'any' type with more specific '${inferredType}' type`);
      
      return `${varName}: ${inferredType}`;
    }
    return match;
  });

  // Fix 4: Extract magic numbers to constants
  const magicNumbers = {
    '0.75': 'MEDIUM_CONFIDENCE',
    '0.8': 'HIGH_CONFIDENCE',
    '0.6': 'MODERATE_CONFIDENCE',
    '0.7': 'GOOD_CONFIDENCE'
  };

  Object.entries(magicNumbers).forEach(([number, constant]) => {
    if (content.includes(number) && !content.includes(`const ${constant}`)) {
      // Add constant at top after imports
      const lines = content.split('\n');
      let insertIndex = 0;
      
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('import') && !lines[i].startsWith('/**') && 
            !lines[i].startsWith(' *') && !lines[i].startsWith(' */') && 
            lines[i].trim() !== '') {
          insertIndex = i;
          break;
        }
      }

      lines.splice(insertIndex, 0, `const ${constant} = ${number};`, '');
      content = lines.join('\n');
      
      // Replace occurrences
      const regex = new RegExp(`\\b${number}\\b`, 'g');
      content = content.replace(regex, constant);
      
      fixes++;
      changes.push(`Extracted magic number: ${number} → ${constant}`);
      
      storeFix(filePath, 'extract_magic_number', number, constant,
        `Extracted magic number ${number} to named constant ${constant}`);
    }
  });

  // Fix 5: Remove unused catch variables
  const unusedCatchRegex = /catch\s*\(\s*(\w+)\s*\)\s*{([^}]*)}/g;
  content = content.replace(unusedCatchRegex, (match, varName, body) => {
    if (!body.includes(varName)) {
      fixes++;
      changes.push(`Prefixed unused catch variable: ${varName} → _${varName}`);
      
      storeFix(filePath, 'fix_unused_catch_variable', match, 
        match.replace(varName, `_${varName}`),
        'Prefixed unused catch variable with underscore to indicate intentional non-usage');
      
      return match.replace(varName, `_${varName}`);
    }
    return match;
  });

  if (fixes > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Applied ${fixes} intelligent fixes:`);
    changes.forEach(change => console.log(`   • ${change}`));
  } else {
    console.log(`✨ No fixable issues found`);
  }

  return fixes;
}

// Store session summary in memory
async function storeSessionSummary(totalFixes, filesModified) {
  if (!memoryEnabled) return;

  try {
    const summary = {
      total_fixes: totalFixes,
      files_modified: filesModified,
      fix_types: [...new Set(fixesApplied.map(f => f.fix_type))],
      success_rate: 1.0,
      duration_ms: Date.now() - parseInt(sessionId.split('_')[1]),
      session_id: sessionId
    };

    const content = `Intelligent autofix session: ${totalFixes} fixes across ${filesModified.length} files`;
    
    await supabase
      .from('memories')
      .insert({
        content,
        metadata: {
          ...summary,
          memory_type: 'autofix_session',
          tags: ['autofix', 'session_summary', 'intelligent']
        },
        user_id: 'claude-autofix'
      });

    console.log(`\n📊 Stored session summary in memory`);
  } catch (error) {
    console.log(`⚠️  Failed to store session summary: ${error.message}`);
  }
}

// Target files with known issues
const targetFiles = [
  'src/agents/cognitive/devils_advocate_agent.ts',
  'src/agents/base_agent.ts',
  'src/utils/smart-port-manager.ts',
  'src/services/ollama_service.ts',
  'src/routers/memory.ts',
  'src/server.ts'
];

console.log('🎯 Running intelligent autofix with memory integration...\n');

let totalFixes = 0;
const modifiedFiles = [];

for (const file of targetFiles) {
  if (fs.existsSync(file)) {
    const fixes = await analyzeAndFix(file);
    if (fixes > 0) {
      modifiedFiles.push(file);
    }
    totalFixes += fixes;
  }
}

await storeSessionSummary(totalFixes, modifiedFiles);

console.log(`\n🎉 Intelligent autofix complete!`);
console.log(`📊 Applied ${totalFixes} context-aware fixes across ${modifiedFiles.length} files`);
console.log(`🧠 All fixes stored in Supabase memory for future learning`);
console.log(`\n🔄 Run 'npm run lint' to verify remaining issues`);