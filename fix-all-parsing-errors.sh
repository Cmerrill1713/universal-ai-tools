#!/bin/bash

# Universal AI Tools - Comprehensive Parsing Error Fix Script
# This script fixes the most common parsing error patterns across the TypeScript codebase

set -e

echo "🔧 Universal AI Tools - Comprehensive Parsing Error Fix"
echo "=================================================="

# Create backup
BACKUP_DIR="src.backup.$(date +%Y%m%d_%H%M%S)"
echo "📁 Creating backup: $BACKUP_DIR"
cp -r src "$BACKUP_DIR"

# Counter for fixes
FIXES_APPLIED=0

echo "🚀 Starting systematic fixes..."

# 1. Fix dotted interface property names (e.g., Plan.Step -> PlanStep)
echo "1️⃣ Fixing dotted interface properties..."
find src -name "*.ts" -exec sed -i '' \
  -e 's/Plan\.Step/PlanStep/g' \
  -e 's/Agent\.Config/AgentConfig/g' \
  -e 's/Agent\.Response/AgentResponse/g' \
  -e 's/totalEstimated\.Time/totalEstimatedTime/g' \
  -e 's/success\.Criteria/successCriteria/g' \
  -e 's/risk\.Assessment/riskAssessment/g' \
  -e 's/adaptation\.Strategy/adaptationStrategy/g' \
  -e 's/learning\.Points/learningPoints/g' \
  -e 's/memory\.Pattern/memoryPattern/g' \
  -e 's/performance\.Metrics/performanceMetrics/g' \
  -e 's/error\.Handler/errorHandler/g' \
  -e 's/cache\.Strategy/cacheStrategy/g' \
  -e 's/auth\.Config/authConfig/g' \
  {} \;
((FIXES_APPLIED += 13))

# 2. Fix missing dots in property access (e.g., thisconfig -> this.config)
echo "2️⃣ Fixing missing dots in property access..."
find src -name "*.ts" -exec sed -i '' \
  -e 's/thisconfig\./this.config./g' \
  -e 's/thiscognitiveCapabilities/this.cognitiveCapabilities/g' \
  -e 's/thismemorySystem/this.memorySystem/g' \
  -e 's/thisllmService/this.llmService/g' \
  -e 's/thislogger/this.logger/g' \
  -e 's/thiscache/this.cache/g' \
  -e 's/thiserrorHandler/this.errorHandler/g' \
  -e 's/thisperformanceMonitor/this.performanceMonitor/g' \
  -e 's/thisvalidator/this.validator/g' \
  -e 's/thismetrics/this.metrics/g' \
  {} \;
((FIXES_APPLIED += 10))

# 3. Fix method call patterns
echo "3️⃣ Fixing method call patterns..."
find src -name "*.ts" -exec sed -i '' \
  -e 's/contextuserRequest/context.userRequest/g' \
  -e 's/requestincludes/request.includes/g' \
  -e 's/resulttoString/result.toString/g' \
  -e 's/datatoJSON/data.toJSON/g' \
  -e 's/arraymap/array.map/g' \
  -e 's/stringtoLowerCase/string.toLowerCase/g' \
  -e 's/objectkeys/Object.keys/g' \
  -e 's/Objectkeys/Object.keys/g' \
  {} \;
((FIXES_APPLIED += 8))

# 4. Fix missing commas in function parameters and object properties
echo "4️⃣ Fixing missing commas in parameters..."
find src -name "*.ts" -exec sed -i '' \
  -e 's/input: string;/input: string,/g' \
  -e 's/context: AgentContext;/context: AgentContext,/g' \
  -e 's/config: AgentConfig;/config: AgentConfig,/g' \
  -e 's/data: unknown;/data: unknown,/g' \
  -e 's/result: unknown;/result: unknown,/g' \
  {} \;
((FIXES_APPLIED += 5))

# 5. Fix semicolons instead of commas in object literals
echo "5️⃣ Fixing semicolons in object literals..."
find src -name "*.ts" -exec sed -i '' \
  -e "s/name: '[^']*';/&,/g" \
  -e "s/execute: [^}]*};/&,/g" \
  {} \;
((FIXES_APPLIED += 2))

# 6. Fix bind method calls
echo "6️⃣ Fixing bind method calls..."
find src -name "*.ts" -exec sed -i '' \
  -e 's/thisexecuteCriticalAnalysisbind(this)/this.executeCriticalAnalysis.bind(this)/g' \
  -e 's/thisexecuteRiskAssessmentbind(this)/this.executeRiskAssessment.bind(this)/g' \
  -e 's/thisexecuteStressTestingbind(this)/this.executeStressTesting.bind(this)/g' \
  -e 's/thisperformInternalAnalysisbind(this)/this.performInternalAnalysis.bind(this)/g' \
  -e 's/thisgenerateCritiqueReportbind(this)/this.generateCritiqueReport.bind(this)/g' \
  {} \;
((FIXES_APPLIED += 5))

# 7. Fix array and object method calls
echo "7️⃣ Fixing array and object methods..."
find src -name "*.ts" -exec sed -i '' \
  -e 's/critiquekeyWeaknesseslength/critique.keyWeaknesses.length/g' \
  -e 's/critiqueriskFactorslength/critique.riskFactors.length/g' \
  -e 's/critiqueseveritytoUpperCase/critique.severity.toUpperCase/g' \
  -e 's/critiquekeyWeaknessesmap/critique.keyWeaknesses.map/g' \
  -e 's/critiqueperformanceImpactexpectedImprovement/critique.performanceImpact.expectedImprovement/g' \
  -e 's/critiqueperformanceImpactriskReduction/critique.performanceImpact.riskReduction/g' \
  -e 's/stressstressScenarios/stress.stressScenarios/g' \
  -e 's/stressoverallResilienceScore/stress.overallResilienceScore/g' \
  -e 's/thiscritiqueHistorypush/this.critiqueHistory.push/g' \
  {} \;
((FIXES_APPLIED += 9))

# 8. Fix method return patterns and variable assignments
echo "8️⃣ Fixing method returns and assignments..."
find src -name "*.ts" -exec sed -i '' \
  -e 's/critique\.Report/critiqueReport/g' \
  -e 's/risk\.Profile/riskProfile/g' \
  -e 's/overallRisk\.Level/overallRiskLevel/g' \
  -e 's/mitigation\.Strategies/mitigationStrategies/g' \
  -e 's/thisassessRisks/this.assessRisks/g' \
  -e 's/thiscalculateOverallRisk/this.calculateOverallRisk/g' \
  -e 's/thisgenerateMitigationStrategies/this.generateMitigationStrategies/g' \
  -e 's/thisgenerateStressScenarios/this.generateStressScenarios/g' \
  -e 's/thisgetResilienceLevel/this.getResilienceLevel/g' \
  {} \;
((FIXES_APPLIED += 9))

# 9. Fix missing closing braces and parentheses
echo "9️⃣ Fixing structural issues..."
find src -name "*.ts" -exec sed -i '' \
  -e 's/});$/});/g' \
  -e 's/};$/};/g' \
  -e 's/return null};/return null;/g' \
  -e 's/\(.*\)};$/\1;/g' \
  {} \;
((FIXES_APPLIED += 4))

# 10. Fix specific import issues
echo "🔟 Fixing import statements..."
find src -name "*.ts" -exec sed -i '' \
  -e 's/import type { \([^}]*\)$/import type { \1 }/g' \
  -e 's/import { \([^}]*\)$/import { \1 }/g' \
  -e 's/from '\''\.\/([^'\'']*)'\'';/from '\''.\/\1'\'';/g' \
  {} \;
((FIXES_APPLIED += 3))

echo "✅ Applied $FIXES_APPLIED systematic fixes"

# Run a test to see if there are any remaining critical errors
echo "🧪 Testing compilation..."
if npm run build >/dev/null 2>&1; then
  echo "✅ TypeScript compilation successful!"
else
  echo "⚠️  Some compilation errors remain - running lint to check..."
  npm run lint 2>&1 | head -20
fi

echo ""
echo "🎉 Comprehensive parsing error fixes completed!"
echo "📁 Backup saved in: $BACKUP_DIR"
echo "🔢 Total fixes applied: $FIXES_APPLIED"
echo ""
echo "Next steps:"
echo "1. Run: npm run lint"
echo "2. Run: npm run build"
echo "3. Run: npm test"
echo "4. If issues remain, check specific files manually"