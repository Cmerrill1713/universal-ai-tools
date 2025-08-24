#!/usr/bin/env npx tsx
/**
 * Remove TODO: Refactor nested ternary comments
 * This script removes the automated TODO comments that were added
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

async function removeTodoComments(): Promise<void> {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🧹 Removing TODO: Refactor nested ternary comments...');

  try {
    // Find all TypeScript files
    const files = await glob('src/**/*.ts', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });

    console.log(`📁 Found ${files.length} TypeScript files to process`);

    let totalRemoved = 0;
    let filesModified = 0;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Pattern to match the TODO comments with various formats
      const patterns = [
        // Match: // TODO: Refactor nested ternary
        /\/\/\s*TODO:\s*Refactor\s+nested\s+ternary\s*\n/g,
        // Match: const // TODO: Refactor nested ternary
        /const\s+\/\/\s*TODO:\s*Refactor\s+nested\s+ternary\s*\n/g,
        // Match: let // TODO: Refactor nested ternary
        /let\s+\/\/\s*TODO:\s*Refactor\s+nested\s+ternary\s*\n/g,
        // Match: private; // TODO: Refactor nested ternary
        /;\s*\/\/\s*TODO:\s*Refactor\s+nested\s+ternary\s*\n/g,
      ];

      let newContent = content;
      let removedInFile = 0;

      // Apply each pattern
      for (const pattern of patterns) {
        const matches = newContent.match(pattern);
        if (matches) {
          removedInFile += matches.length;
          newContent = newContent.replace(pattern, '');
        }
      }

      // Fix broken variable declarations
      // Fix: "const // TODO..." becomes "const"
      newContent = newContent.replace(/\bconst\s+\n\s*/g, 'const ');
      newContent = newContent.replace(/\blet\s+\n\s*/g, 'let ');
      newContent = newContent.replace(/\bprivate\s+\n\s*/g, 'private ');

      // Fix empty const/let declarations
      newContent = newContent.replace(/\bconst\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\n/g, 'const $1 = ');
      newContent = newContent.replace(/\blet\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\n/g, 'let $1 = ');

      if (removedInFile > 0) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`  ✅ ${path.relative(process.cwd(), file)} - Removed ${removedInFile} comments`);
        totalRemoved += removedInFile;
        filesModified++;
      }
    }

    console.log('');
    console.log('📊 Summary:');
    console.log(`  📝 Files processed: ${files.length}`);
    console.log(`  ✏️  Files modified: ${filesModified}`);
    console.log(`  🗑️  Comments removed: ${totalRemoved}`);
    console.log('');
    console.log('✅ TODO comment removal complete!');

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Error removing TODO comments:', error);
    process.exit(1);
  }
}

// Run the script
removeTodoComments().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});