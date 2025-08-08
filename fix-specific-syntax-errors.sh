#!/bin/bash

echo "🔧 Fixing specific syntax errors from compilation output..."

# Fix semicolon errors (replacing ; with ,)
echo "Fixing semicolon/comma errors in function parameters..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/modelName: string;/modelName: string,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/userPreferences?: UserPreferences;/userPreferences?: UserPreferences,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/reasoning?: string;/reasoning?: string,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/feedback: ABMCTSFeedback;/feedback: ABMCTSFeedback,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/complexity: string;/complexity: string,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/confidence;/confidence,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/this\.performanceDistribution\.beta;/this.performanceDistribution.beta,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/context: AgentContext;/context: AgentContext,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/llmResponse: any;/llmResponse: any,/g' {} \;

# Fix ternary operator errors (add missing ?)
echo "Fixing ternary operator issues..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/const averageReward =       executionCount > 0;/const averageReward = executionCount > 0/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/return lines\.length > 0;/return lines.length > 0/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/return phases\.length > 0;/return phases.length > 0/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/return criteriaLines\.length > 0;/return criteriaLines.length > 0/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/return nextStepLines\.length > 0;/return nextStepLines.length > 0/g' {} \;

# Fix missing commas in object literals
echo "Fixing missing commas in object literals..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/optimizationsApplied;/optimizationsApplied,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/TaskType\.CREATIVE_WRITING;/TaskType.CREATIVE_WRITING,/g' {} \;

# Fix "as unknown" syntax
echo "Fixing type casting issues..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/z\.null() as unknown;/z.null() as z.ZodSchema<null>,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/dataSchema;/dataSchema,/g' {} \;

# Fix missing semicolons at end of lines that should have them
echo "Fixing missing semicolons where needed..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/0;$/0,/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/: 0;$/: 0,/g' {} \;

# Fix the invalid __scores access pattern
echo "Fixing __scores access pattern..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/(existing as unknown).__scores.\[key\]/(existing as any).__scores?.[key]/g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/(existing as unknown).__scores/(existing as any).__scores/g' {} \;

echo "✅ Specific syntax error fixes complete!"
echo "Running TypeScript compilation check..."
cd /Users/christianmerrill/Desktop/universal-ai-tools
npx tsc --noEmit 2>&1 | head -50