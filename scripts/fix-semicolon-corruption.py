#!/usr/bin/env python3
"""
Fix the specific semicolon corruption pattern in TypeScript files.
This script fixes patterns like '{;' to '{' and similar corruptions.
"""

import glob
import re
import shutil
from datetime import datetime


def fix_file(file_path):
    """Fix semicolon corruption patterns in a single file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix the most critical structural patterns
        fixes = [
            # Fix interface and object declarations
            (r'{\s*;', '{'),
            (r';\s*}', '}'),

            # Fix array declarations
            (r'\[\s*;', '['),
            (r';\s*\]', ']'),

            # Fix function parameters and calls
            (r'\(\s*;', '('),
            (r';\s*\)', ')'),

            # Fix property declarations and assignments
            (r':\s*;', ':'),
            (r';\s*:', ':'),
            (r'=\s*;', '='),
            (r';\s*=', '='),

            # Fix operators
            (r'\.\s*;', '.'),
            (r';\s*\.', '.'),
            (r',\s*;', ','),
            (r';\s*,', ','),

            # Fix logical operators
            (r'\|\s*;', '|'),
            (r';\s*\|', '|'),
            (r'&\s*;', '&'),
            (r';\s*&', '&'),

            # Fix comparison operators
            (r'<\s*;', '<'),
            (r';\s*<', '<'),
            (r'>\s*;', '>'),
            (r';\s*>', '>'),

            # Fix arithmetic operators
            (r'\+\s*;', '+'),
            (r';\s*\+', '+'),
            (r'-\s*;', '-'),
            (r';\s*-', '-'),
            (r'\*\s*;', '*'),
            (r';\s*\*', '*'),
            (r'/\s*;', '/'),
            (r';\s*/', '/'),

            # Fix question mark and exclamation
            (r'\?\s*;', '?'),
            (r';\s*\?', '?'),
            (r'!\s*;', '!'),
            (r';\s*!', '!'),

            # Fix specific common corrupted words
            (r'consolewarn', 'console.warn'),
            (r'consolelog', 'console.log'),
            (r'consoleerror', 'console.error'),
            (r'consoleinfo', 'console.info'),
            (r'processenv', 'process.env'),
            (r'Datenow', 'Date.now'),
            (r'JSONstringify', 'JSON.stringify'),
            (r'JSONparse', 'JSON.parse'),
            (r'Mathmax', 'Math.max'),
            (r'Mathmin', 'Math.min'),
            (r'ArrayisArray', 'Array.isArray'),

            # Fix property access that got corrupted
            (r'([a-zA-Z_]\w*)([A-Z]\w*)', r'\1.\2'),

            # Fix double dots from over-correction
            (r'\.\.+', '.'),

            # Fix multiple semicolons
            (r';;+', ';'),
        ]

        # Apply fixes
        for pattern, replacement in fixes:
            content = re.sub(pattern, replacement, content)

        # Only write if content changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    print("🔧 Fixing semicolon corruption patterns...")

    # Create backup
    backup_dir = f"src.backup.semicolon.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print(f"📦 Creating backup at {backup_dir}...")
    shutil.copytree('src', backup_dir)

    # Find all TypeScript files
    ts_files = glob.glob('src/**/*.ts', recursive=True)
    ts_files = [f for f in ts_files if not any(exclude in f for exclude in ['node_modules', 'dist', 'coverage'])]

    print(f"🔍 Found {len(ts_files)} TypeScript files to fix")

    fixed_count = 0
    for i, file_path in enumerate(ts_files, 1):
        print(f"🔄 Processing ({i}/{len(ts_files)}): {file_path}")
        if fix_file(file_path):
            print(f"   ✅ Fixed {file_path}")
            fixed_count += 1
        else:
            print(f"   ⏭️  No changes needed in {file_path}")

    print("\n🎉 Semicolon corruption fix complete!")
    print(f"📦 Backup created at: {backup_dir}")
    print(f"✅ Fixed {fixed_count} files")
    print("🔍 Run 'npm run type-check:dev' to verify fixes")

if __name__ == "__main__":
    main()
