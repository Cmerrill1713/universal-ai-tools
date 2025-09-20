# Universal AI Tools - Quality Assurance Workflow
This document describes the comprehensive QA workflow that ensures code quality is maintained with every file change.
## 🛡️ Overview
Our QA workflow implements multiple layers of protection to catch errors early and prevent them from reaching production:
1. **Real-time validation** - Immediate feedback as you code

2. **Pre-commit checks** - Validation before code is committed

3. **Pre-push validation** - Build verification before pushing

4. **CI/CD pipeline** - Automated checks on GitHub

5. **Progressive validation** - Incremental checking for efficiency
## 🚀 Quick Start
### Initial Setup
```bash
# Run the setup script

./setup-prevention-measures.sh

# Activate Git hooks

git config core.hooksPath .githooks

```
### Daily Workflow
1. **Start real-time validation** (optional but recommended):

   ```bash

   npm run validate:watch

   ```
2. **Code normally** - VS Code will auto-format on save
3. **Commit your changes** - Pre-commit hooks will run automatically:

   ```bash

   git add .

   git commit -m "feat: add new feature"

   ```
4. **Push to remote** - Pre-push hooks ensure build passes:

   ```bash

   git push origin main

   ```
## 📋 Available Commands
### Validation Commands

- `npm run validate` - Run full TypeScript and ESLint validation

- `npm run validate:watch` - Real-time error checking as you code

- `npm run qa` - Run all quality checks (validate + lint fix + format)

- `./progressive-validation.sh` - Check only changed files
### Build Commands

- `npm run build` - Full TypeScript compilation

- `npm run build:prod` - Production build with optimizations
### Code Quality Commands

- `npm run lint` - Run ESLint checks

- `npm run lint:fix` - Auto-fix ESLint issues

- `npm run format` - Format code with Prettier

- `npm run format:check` - Check if formatting is needed
## 🔍 How It Works
### 1. Real-Time Validation
When you run `npm run validate:watch`, the system:

- Monitors all TypeScript files in the `src/` directory

- Runs TypeScript compiler checks on file changes

- Runs ESLint validation

- Shows errors immediately in your terminal
### 2. VS Code Integration
With our VS Code settings:

- **Format on Save**: Prettier formats your code automatically

- **ESLint Auto-fix**: Common issues are fixed on save

- **TypeScript Validation**: Errors appear in the Problems panel

- **Import Organization**: Imports are sorted and cleaned
### 3. Git Hooks

#### Pre-commit Hook

Before each commit:

1. Checks all staged TypeScript files

2. Runs TypeScript compiler on each file

3. Runs ESLint validation

4. Checks for TODO/FIXME comments

5. Auto-formats with Prettier if needed

6. Blocks commit if errors are found

#### Pre-push Hook

Before pushing to remote:

1. Runs full project build

2. Executes test suite (if available)

3. Blocks push if build fails
### 4. GitHub Actions
On every push and pull request:

1. Sets up Node.js environment

2. Installs dependencies

3. Runs TypeScript compilation

4. Executes ESLint checks

5. Verifies code formatting

6. Runs test suite

7. Reports TODO comments as warnings
## 🛠️ Troubleshooting
### "Pre-commit hook failed"

1. Read the error messages carefully

2. Run `npm run lint:fix` to auto-fix some issues

3. Run `npm run build` to see all TypeScript errors

4. Fix remaining issues manually
### "Build failed on push"

1. Run `npm run build` locally

2. Fix all TypeScript compilation errors

3. Commit the fixes

4. Try pushing again
### "Real-time validation not working"

1. Ensure you've run `npm install`

2. Check that `chokidar` is installed

3. Restart the validation watcher
### Skipping Hooks (Emergency Only)

```bash
# Skip pre-commit (not recommended)

git commit --no-verify -m "emergency fix"

# Skip pre-push (not recommended)

git push --no-verify

```
## 📊 Benefits
1. **Catch Errors Early**: Find issues before they're committed

2. **Consistent Code Style**: Automatic formatting ensures uniformity

3. **Prevent Build Failures**: Can't push broken code

4. **Faster Development**: Real-time feedback reduces debugging time

5. **Team Confidence**: Everyone follows the same quality standards
## 🔧 Customization
### Adding Custom Checks
Edit `.githooks/pre-commit` to add custom validation:
```bash
# Example: Check for console.log statements

if grep -r "console.log" src/ --include="*.ts" > /dev/null; then

  echo "⚠️  Found console.log statements"

fi

```
### Modifying VS Code Settings
Edit `.vscode/settings.json` to customize editor behavior.
### Updating GitHub Actions
Edit `.github/workflows/qa.yml` to modify CI/CD pipeline.
## 📝 Best Practices
1. **Run validation watch** during development for immediate feedback

2. **Don't skip hooks** unless absolutely necessary

3. **Fix errors immediately** rather than accumulating technical debt

4. **Keep TypeScript strict** for better type safety

5. **Use ESLint auto-fix** to save time on formatting
## 🚨 Important Notes
- Git hooks are **local** - each developer must run the setup

- VS Code settings only apply if using VS Code/Cursor

- GitHub Actions run on all branches specified in the workflow

- Real-time validation requires the terminal to stay open
By following this QA workflow, we ensure high code quality and catch errors before they impact the project.