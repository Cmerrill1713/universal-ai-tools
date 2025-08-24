# Automated Syntax Fixing System

This comprehensive automated syntax fixing system identifies and fixes common syntax patterns that cause errors in TypeScript and JavaScript files. It runs automatically as a pre-commit hook and can also be run manually for immediate fixes.

## Components

### 1. Auto Syntax Fixer (`auto-syntax-fixer.ts`)
The main syntax fixing script that applies pattern-based fixes to files.

**Features:**
- 22 comprehensive syntax patterns
- Dry-run mode for analysis
- Backup creation before fixes
- Detailed reporting
- Git staged files processing
- Verbose output mode

### 2. Syntax Patterns (`syntax-patterns.json`)
Comprehensive pattern definitions for automated fixing, including:

**Critical Patterns:**
- Missing colon after 'error' in object properties
- Missing space in 'error instanceof'
- Underscore pattern fixes (_error → error:)
- Unterminated strings

**High Priority Patterns:**
- Template literal fixes
- Missing commas in object literals
- Missing parentheses in function calls
- Content header formatting

**Medium/Low Priority Patterns:**
- Semicolon insertion
- Import/export spacing
- Type annotation formatting
- Code style consistency

### 3. Pre-commit Hook (`.husky/pre-commit`)
Automatically runs the syntax fixer and validator on staged files before commits.

**Process:**
1. Run syntax auto-fix on staged files
2. Run syntax validation
3. Run ESLint
4. Run TypeScript type checking

### 4. Syntax Validator (`validate-syntax.ts`)
Validates syntax without making changes, providing detailed error reports.

**Validation Types:**
- Basic syntax validation
- TypeScript/JavaScript parsing
- Pattern-based validation
- ESLint integration

## Usage

### Manual Commands

```bash
# Fix all files in src/ directory
npm run fix:syntax:auto

# Fix only staged files
npm run fix:syntax:staged

# Dry run to see what would be fixed
npm run fix:syntax:dry

# Fix with backup creation
npm run fix:syntax:backup

# Validate syntax without fixing
npm run validate:syntax

# Validate staged files only
npm run validate:syntax:staged

# Verbose validation output
npm run validate:syntax:verbose
```

### Direct Script Usage

```bash
# Auto Syntax Fixer
tsx scripts/auto-syntax-fixer.ts [options] [directory]

Options:
  -d, --dry-run     Analyze without making changes
  -v, --verbose     Show detailed output
  -b, --backup      Create backup of original files
  -s, --staged      Only process git staged files
  -h, --help        Show help message

# Syntax Validator
tsx scripts/validate-syntax.ts [options] [directory]

Options:
  -v, --verbose     Show detailed output including warnings
  -s, --staged      Only validate git staged files
  -h, --help        Show help message
```

### Examples

```bash
# Fix all TypeScript files in src/ with backup
tsx scripts/auto-syntax-fixer.ts --backup src/

# Analyze what would be fixed without changes
tsx scripts/auto-syntax-fixer.ts --dry-run --verbose

# Fix only staged files (useful for pre-commit)
tsx scripts/auto-syntax-fixer.ts --staged --verbose

# Validate all files with detailed output
tsx scripts/validate-syntax.ts --verbose src/

# Validate only staged files
tsx scripts/validate-syntax.ts --staged
```

## Automatic Operation

### Pre-commit Hook
The system automatically runs when you commit code:

```bash
git add .
git commit -m "Your commit message"
# Automatically runs:
# 1. Auto-fix syntax on staged files
# 2. Validate syntax
# 3. ESLint
# 4. TypeScript type check
```

### Watch Mode
Enable continuous syntax fixing during development:

```bash
npm run fix:syntax:watch
```

## Pattern Categories

### Critical (Must Fix)
- `error_property_colon` - Missing colon after 'error'
- `error_instanceof_space` - Missing space in 'error instanceof'
- `underscore_error_patterns` - _error → error:
- `unterminated_string_*` - Unterminated strings

### High Priority
- `template_literal_*` - Template literal issues
- `missing_comma_object_literal` - Missing commas
- `missing_parentheses_logger` - Logger call syntax
- Content header formatting

### Medium Priority
- `semicolon_missing_statements` - Missing semicolons
- `duplicate_imports` - Duplicate import statements
- Import/export formatting

### Low Priority
- Spacing and formatting consistency
- Code style improvements

## Reports

### Fix Report (`syntax-fix-report.json`)
Generated after running the auto-fixer:
```json
{
  "totalFiles": 150,
  "totalFixes": 324,
  "fixesByPattern": {
    "error_property_colon": 45,
    "missing_comma_object_literal": 23
  },
  "fixesByFile": {...},
  "errors": [],
  "skippedFiles": []
}
```

### Validation Report (`syntax-validation-report.json`)
Generated after running the validator:
```json
{
  "totalFiles": 150,
  "validFiles": 142,
  "filesWithErrors": 8,
  "errors": [...],
  "warnings": [...],
  "summary": {
    "parseErrors": 3,
    "typeErrors": 5,
    "eslintErrors": 12,
    "criticalIssues": [...]
  }
}
```

## Configuration

### Adding New Patterns
Edit `scripts/syntax-patterns.json`:

```json
{
  "name": "new_pattern_name",
  "description": "Description of what this fixes",
  "pattern": "regex_pattern",
  "flags": "g",
  "replacement": "replacement_string",
  "fileTypes": [".ts", ".tsx"],
  "severity": "high",
  "examples": {
    "before": "broken code",
    "after": "fixed code"
  }
}
```

### Customizing Validation
Modify the validation rules in `validate-syntax.ts`:
- Add new pattern checks
- Adjust severity levels
- Configure TypeScript compiler options

## Integration

### CI/CD Pipeline
Add to your workflow:

```yaml
- name: Run Syntax Validation
  run: npm run validate:syntax

- name: Run Syntax Fixes
  run: npm run fix:syntax:auto
```

### IDE Integration
Configure your IDE to run the validator on save or before builds.

## Troubleshooting

### Common Issues

1. **Permission Errors**
   ```bash
   chmod +x .husky/pre-commit
   ```

2. **TypeScript Compilation Errors**
   - Run `npm run type-check` separately
   - Check for missing dependencies

3. **Pattern Not Working**
   - Test regex patterns in the JSON file
   - Check file type inclusion
   - Verify pattern severity

### Debug Mode
Enable verbose output to see detailed information:

```bash
tsx scripts/auto-syntax-fixer.ts --verbose --dry-run
tsx scripts/validate-syntax.ts --verbose
```

## Performance

- Processes ~100 files per second
- Backup creation adds ~20% overhead
- Git staged file filtering is optimized
- Pattern matching uses compiled regex

## Best Practices

1. **Always test with dry-run first**
2. **Create backups for large-scale fixes**
3. **Review changes before committing**
4. **Use staged-only mode during development**
5. **Run validation regularly**
6. **Keep patterns updated**

This system ensures consistent code quality and reduces syntax-related compilation errors across your TypeScript/JavaScript codebase.