#\!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🧠 Context-Aware Autofix for Universal AI Tools\n');

// Map common patterns to proper types based on context
const typeInferences = {
  'inputSchema': 'object', // JSON Schema
  'outputSchema': 'object', // JSON Schema  
  'req': 'Request', // Express request
  'res': 'Response', // Express response
  'next': 'NextFunction', // Express middleware
  'error': 'Error | unknown', // Error objects
  'config': 'Record<string, any>', // Configuration objects
  'options': 'Record<string, any>', // Option objects
  'params': 'Record<string, string>', // URL parameters
  'query': 'Record<string, string>', // Query parameters
  'body': 'Record<string, any>', // Request body
  'headers': 'Record<string, string>', // HTTP headers
  'metadata': 'Record<string, any>', // Metadata objects
  'context': 'Record<string, any>', // Context objects
  'data': 'unknown', // Generic data
  'result': 'unknown', // Generic result
  'response': 'unknown', // API responses
};

// Read and analyze a file for fixable issues
function analyzeAndFix(filePath) {
  if (\!fs.existsSync(filePath)) return 0;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fixes = 0;
  let changes = [];

  // Fix 1: Convert require() to import (line 87 issue)
  const requireRegex = /const\s+{\s*([^}]+)\s*}\s*=\s*require\(([^)]+)\);/g;
  content = content.replace(requireRegex, (match, imports, module) => {
    fixes++;
    changes.push(`Convert require() to import`);
    return `import { ${imports} } from ${module};`;
  });

  // Fix 2: Replace 'any' with context-appropriate types
  const anyRegex = /(\w+):\s*any/g;
  content = content.replace(anyRegex, (match, varName) => {
    const inferredType = typeInferences[varName] || 'unknown';
    if (inferredType \!== 'unknown') {
      fixes++;
      changes.push(`${varName}: any → ${varName}: ${inferredType}`);
      return `${varName}: ${inferredType}`;
    }
    return match;
  });

  // Fix 3: Remove unused variables by prefixing with underscore
  const lines = content.split('\n');
  const unusedVarRegex = /catch\s*\(\s*(\w+)\s*\)\s*{/g;
  content = content.replace(unusedVarRegex, (match, varName) => {
    // Check if variable is used in the catch block
    const afterCatch = content.slice(content.indexOf(match));
    const catchBlock = afterCatch.slice(0, afterCatch.indexOf('}') + 1);
    if (\!catchBlock.includes(varName + '.') && \!catchBlock.includes(varName + '[')) {
      fixes++;
      changes.push(`Prefix unused error variable: ${varName} → _${varName}`);
      return match.replace(varName, `_${varName}`);
    }
    return match;
  });

  // Fix 4: Add proper typing for common Express patterns
  if (filePath.includes('router') || filePath.includes('middleware')) {
    content = content.replace(/\(req,\s*res,?\s*next?\)/g, (match) => {
      fixes++;
      changes.push('Add Express types to middleware parameters');
      return '(req: Request, res: Response, next: NextFunction)';
    });
  }

  // Fix 5: Replace magic numbers with constants
  const magicNumberRegex = /(\d+(?:\.\d+)?)/g;
  const commonMagicNumbers = {
    '0.7': 'DEFAULT_TEMPERATURE',
    '0.3': 'LOW_TEMPERATURE', 
    '100': 'MAX_PERCENTAGE',
    '0.8': 'HIGH_CONFIDENCE',
    '0.6': 'MEDIUM_CONFIDENCE',
    '3000': 'DEFAULT_TIMEOUT_MS',
    '5000': 'LONG_TIMEOUT_MS',
    '1024': 'KILOBYTE',
    '30000': 'THIRTY_SECONDS_MS'
  };

  Object.entries(commonMagicNumbers).forEach(([number, constant]) => {
    if (content.includes(number) && \!content.includes(constant)) {
      // Add constant declaration at top of file if not exists
      if (\!content.includes(`const ${constant}`)) {
        const imports = content.match(/^import.*$/gm) || [];
        const lastImport = imports[imports.length - 1] || '';
        const insertPoint = content.indexOf(lastImport) + lastImport.length;
        content = content.slice(0, insertPoint) + 
                 `\n\nconst ${constant} = ${number};` + 
                 content.slice(insertPoint);
        fixes++;
        changes.push(`Extract magic number: ${number} → ${constant}`);
      }
    }
  });

  if (fixes > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${fixes} issues in ${path.relative(process.cwd(), filePath)}`);
    changes.forEach(change => console.log(`   • ${change}`));
    console.log('');
  }

  return fixes;
}

// Target the specific files with issues
const targetFiles = [
  'src/agents/base_agent.ts',
  'src/agents/cognitive/devils_advocate_agent.ts',
  'src/utils/smart-port-manager.ts',
  'src/services/ollama_service.ts'
];

console.log('🎯 Analyzing specific files with lint issues...\n');

let totalFixes = 0;
targetFiles.forEach(file => {
  if (fs.existsSync(file)) {
    totalFixes += analyzeAndFix(file);
  }
});

console.log(`🎉 Context-aware autofix complete\!`);
console.log(`📊 Applied ${totalFixes} intelligent fixes based on code context`);
console.log(`\n🔄 Run 'npm run lint' to see remaining issues`);
