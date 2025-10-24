#!/bin/bash

# Comprehensive Ethics Agent Syntax Fix Script
FILE="/Users/christianmerrill/Desktop/universal-ai-tools/src/agents/cognitive/ethics_agent.ts"

echo "🔧 Applying comprehensive ethics agent fixes..."

# Fix method names with dots
sed -i '' 's/check\.Bias\.Detection/checkBiasDetection/g' "$FILE"
sed -i '' 's/check\.Privacy\.Protection/checkPrivacyProtection/g' "$FILE"
sed -i '' 's/check\.Transparency/checkTransparency/g' "$FILE"
sed -i '' 's/check\.Fairness/checkFairness/g' "$FILE"
sed -i '' 's/check\.Compliance/checkCompliance/g' "$FILE"
sed -i '' 's/check\.Historical\.Violations/checkHistoricalViolations/g' "$FILE"
sed -i '' 's/applyMemory\.Based\.Improvements/applyMemoryBasedImprovements/g' "$FILE"
sed -i '' 's/generate\.Ethical\.Recommendations/generateEthicalRecommendations/g' "$FILE"
sed -i '' 's/store\.Ethics\.Experience/storeEthicsExperience/g' "$FILE"
sed -i '' 's/generate\.Ethics\.Message/generateEthicsMessage/g' "$FILE"
sed -i '' 's/generate\.Ethics\.Reasoning/generateEthicsReasoning/g' "$FILE"

# Fix property access patterns
sed -i '' 's/\.overall\.Score/.overallScore/g' "$FILE"
sed -i '' 's/\.safety\.Rating/.safetyRating/g' "$FILE"
sed -i '' 's/\.checks\.Performed/.checksPerformed/g' "$FILE"
sed -i '' 's/\.violations\.Found/.violationsFound/g' "$FILE"
sed -i '' 's/\.confidence\.Level/.confidenceLevel/g' "$FILE"
sed -i '' 's/\.assessment\.Time/.assessmentTime/g' "$FILE"

# Fix JSON and string method calls
sed -i '' 's/JS\.O\.N\.stringify/JSON.stringify/g' "$FILE"
sed -i '' 's/to\.Lower\.Case()/\.toLowerCase()/g' "$FILE"
sed -i '' 's/to\.Upper\.Case()/\.toUpperCase()/g' "$FILE"
sed -i '' 's/to\.Fixed(/\.toFixed(/g' "$FILE"

# Fix method call patterns
sed -i '' 's/thisassess\./this.assess/g' "$FILE"
sed -i '' 's/thisload\./this.load/g' "$FILE"
sed -i '' 's/thisstore\./this.store/g' "$FILE"
sed -i '' 's/thisgenerate\./this.generate/g' "$FILE"
sed -i '' 's/thiscalculate\./this.calculate/g' "$FILE"
sed -i '' 's/thisdetermine\./this.determine/g' "$FILE"
sed -i '' 's/thisidentify\./this.identify/g' "$FILE"
sed -i '' 's/thisformat\./this.format/g' "$FILE"

# Fix property access in context
sed -i '' 's/contextuser\.Request/context.userRequest/g' "$FILE"
sed -i '' 's/contextmetadata/context.metadata/g' "$FILE"

# Fix array syntax (semicolons to commas in arrays)
sed -i '' "s/';$/',/g" "$FILE"
sed -i '' "s/';}$/'},/g" "$FILE"

echo "✅ Comprehensive ethics agent fixes applied!"
echo "⚠️  Manual review still needed for complex syntax issues"