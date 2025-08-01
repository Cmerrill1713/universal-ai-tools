import * as fs from 'fs';
import * as path from 'path';

// Fix patterns for common syntax errors
const fixes = [
  // Fix authenticate function call in chat.ts
  {
    file: 'src/routers/chat.ts',
    pattern: /return authenticate\( next: NextFunction\);/g,
    replacement: 'return authenticate(req, res, next);'
  },
  // Fix misplaced return undefined patterns
  {
    file: 'src/routers/device-auth.ts',
    pattern: /\n\s*return undefined;\s*\n/g,
    replacement: '\n'
  },
  {
    file: 'src/scripts/test-swiftui-knowledge.ts',
    pattern: /\n\s*return undefined;\s*\n/g,
    replacement: '\n'
  },
  {
    file: 'src/services/photo-organization-template.ts',
    pattern: /\n\s*return undefined;\s*\n/g,
    replacement: '\n'
  },
  {
    file: 'src/services/pyvision-bridge.ts',
    pattern: /\n\s*return undefined;\s*\n/g,
    replacement: '\n'
  },
  // Fix server.ts syntax issues
  {
    file: 'src/server.ts',
    pattern: /}\s*catch\s*{\s*}/g,
    replacement: '} catch (error) {\n    console.error("Error:", error);\n  }'
  },
  // Fix mobile-dspy-orchestrator.ts
  {
    file: 'src/services/mobile-dspy-orchestrator.ts',
    pattern: /}\s*catch\s*{\s*}/g,
    replacement: '} catch (error) {\n    console.error("Error:", error);\n  }'
  }
];

console.log('🔧 Fixing remaining TypeScript syntax errors...\n');

for (const fix of fixes) {
  const filePath = path.join(process.cwd(), fix.file);
  
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      content = content.replace(fix.pattern, fix.replacement);
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed ${fix.file}`);
      } else {
        console.log(`ℹ️  No changes needed in ${fix.file}`);
      }
    } catch (error) {
      console.error(`❌ Error fixing ${fix.file}:`, error);
    }
  } else {
    console.log(`⚠️  File not found: ${fix.file}`);
  }
}

console.log('\n🏁 Syntax fix complete!');