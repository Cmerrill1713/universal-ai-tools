#!/bin/bash

echo "🔧 Fixing invalid optional chaining syntax across all TypeScript files..."

# Fix numeric literals with optional chaining (0?. -> 0.)
echo "Fixing numeric literals..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/0?\./0./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/1?\./1./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/2?\./2./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/3?\./3./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/4?\./4./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/5?\./5./g' {} \;

# Fix 'this' keyword with optional chaining
echo "Fixing 'this' keyword..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/this?\./this./g' {} \;

# Fix common built-in objects
echo "Fixing built-in objects..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/Math?\./Math./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/Date?\./Date./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/Object?\./Object./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/Array?\./Array./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/JSON?\./JSON./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/String?\./String./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/Number?\./Number./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/Boolean?\./Boolean./g' {} \;

# Fix common enums and types
echo "Fixing enums and types..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/TaskType?\./TaskType./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/LogContext?\./LogContext./g' {} \;

# Fix common method calls with optional chaining on known objects
echo "Fixing method calls..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/log?\./log./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/super?\./super./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/console?\./console./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/process?\./process./g' {} \;

# Fix import types with optional chaining
echo "Fixing import types..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/z?\./z./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/express?\./express./g' {} \;

# Fix common services and utilities
echo "Fixing services..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/llmRouter?\./llmRouter./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/bayesianModelRegistry?\./bayesianModelRegistry./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/BetaSampler?\./BetaSampler./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/mcpIntegrationService?\./mcpIntegrationService./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/validators?\./validators./g' {} \;

# Fix array and object method calls
echo "Fixing array/object methods..."
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.filter?\./\.filter./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.map?\./\.map./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.reduce?\./\.reduce./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.push?\./\.push./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.slice?\./\.slice./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.join?\./\.join./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.trim?\./\.trim./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.toLowerCase?\./\.toLowerCase./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.includes?\./\.includes./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.substring?\./\.substring./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.replace?\./\.replace./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.match?\./\.match./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.find?\./\.find./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.findIndex?\./\.findIndex./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.some?\./\.some./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.forEach?\./\.forEach./g' {} \;
find /Users/christianmerrill/Desktop/universal-ai-tools/src -name "*.ts" -type f -exec sed -i '' 's/\.length?\./\.length./g' {} \;

echo "✅ Optional chaining fixes complete!"
echo "Running TypeScript compilation check..."
cd /Users/christianmerrill/Desktop/universal-ai-tools
npx tsc --noEmit 2>&1 | head -50