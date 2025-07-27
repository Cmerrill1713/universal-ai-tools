#!/bin/bash

echo "Comprehensive syntax fix for all files..."

# Fix common syntax patterns
echo "Fixing function call patterns..."
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)(;/\1(/g' {} \;

# Fix template literal issues
echo "Fixing template literal patterns..."
find src -name "*.ts" -type f -exec sed -i '' 's/\`;\`/\`;/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\`,\`/\`,/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\`);\`/\`);/g' {} \;

# Fix specific parameter patterns
echo "Fixing parameter patterns..."
find src -name "*.ts" -type f -exec sed -i '' 's/: string: string/: string/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/: boolean {/): boolean {/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/: Promise<void> {/): Promise<void> {/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/: Promise<unknown> {/): Promise<unknown> {/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/: void {/): void {/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/: any {/): any {/g' {} \;

# Fix array literal patterns  
echo "Fixing array patterns..."
find src -name "*.ts" -type f -exec sed -i '' 's/= \[;/= \[/g' {} \;

# Fix Map.set patterns
echo "Fixing Map.set patterns..."
find src -name "*.ts" -type f -exec sed -i '' 's/\.set(\([^,)]*\));/\.set(\1.id, \1);/g' {} \;

# Run TypeScript check
echo -e "\nChecking TypeScript compilation..."
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "error TS" | head -20

echo -e "\nAttempting to start server..."
npm run dev