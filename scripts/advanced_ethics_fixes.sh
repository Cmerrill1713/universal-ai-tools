#!/bin/bash

# Advanced Ethics Agent Syntax Fix Script
FILE="/Users/christianmerrill/Desktop/universal-ai-tools/src/agents/cognitive/ethics_agent.ts"

echo "🔧 Applying advanced ethics agent fixes..."

# Fix import statements - remove trailing commas
sed -i '' 's/} from .*,$/} from '\''&'\'';/g' "$FILE"
sed -i '' 's/import { AgentResponse } from .*,$/import { AgentResponse } from '\''&'\'';/g' "$FILE"
sed -i '' 's/import { EnhancedMemoryAgent } from .*,$/import { EnhancedMemoryAgent } from '\''&'\'';/g' "$FILE"

# Fix more property access patterns
sed -i '' 's/bias\.Indicators/biasIndicators/g' "$FILE"
sed -i '' 's/content\.Str/contentStr/g' "$FILE"
sed -i '' 's/detected\.Biases/detectedBiases/g' "$FILE"
sed -i '' 's/privacy\.Patterns/privacyPatterns/g' "$FILE"
sed -i '' 's/privacy\.Violations/privacyViolations/g' "$FILE"
sed -i '' 's/privacy\.Pattern/privacyPattern/g' "$FILE"
sed -i '' 's/transparency\.Requirements/transparencyRequirements/g' "$FILE"
sed -i '' 's/missing\.Transparency/missingTransparency/g' "$FILE"
sed -i '' 's/fairness\.Issues/fairnessIssues/g' "$FILE"
sed -i '' 's/compliance\.Issues/complianceIssues/g' "$FILE"
sed -i '' 's/compliance\.Results/complianceResults/g' "$FILE"
sed -i '' 's/similar\.Violations/similarViolations/g' "$FILE"
sed -i '' 's/critical\.Violations/criticalViolations/g' "$FILE"
sed -i '' 's/high\.Violations/highViolations/g' "$FILE"

# Fix method call patterns with missing dots
sed -i '' 's/indicatorpattern/indicator.pattern/g' "$FILE"
sed -i '' 's/indicatortype/indicator.type/g' "$FILE"
sed -i '' 's/matcheslength/matches.length/g' "$FILE"
sed -i '' 's/binstances/b.instances/g' "$FILE"
sed -i '' 's/btype/b.type/g' "$FILE"
sed -i '' 's/dincludes/d.includes/g' "$FILE"
sed -i '' 's/wlength/w.length/g' "$FILE"
sed -i '' 's/wordchar\.At/word.charAt/g' "$FILE"
sed -i '' 's/wordslice/word.slice/g' "$FILE"

# Fix array and object access patterns
sed -i '' 's/\.push((/\.push(/g' "$FILE"
sed -i '' 's/\.filter((/\.filter(/g' "$FILE"
sed -i '' 's/\.map((/\.map(/g' "$FILE"
sed -i '' 's/\.some((/\.some(/g' "$FILE"
sed -i '' 's/\.every((/\.every(/g' "$FILE"
sed -i '' 's/\.includes((/\.includes(/g' "$FILE"
sed -i '' 's/\.split((/\.split(/g' "$FILE"
sed -i '' 's/\.join((/\.join(/g' "$FILE"
sed -i '' 's/\.find((/\.find(/g' "$FILE"
sed -i '' 's/\.reduce((/\.reduce(/g' "$FILE"

# Fix assessment property access patterns
sed -i '' 's/assessmentoverall\.Score/assessment.overallScore/g' "$FILE"
sed -i '' 's/assessmentsafety\.Rating/assessment.safetyRating/g' "$FILE"
sed -i '' 's/assessmentviolations/assessment.violations/g' "$FILE"
sed -i '' 's/assessmentchecks/assessment.checks/g' "$FILE"
sed -i '' 's/assessmentrecommendations/assessment.recommendations/g' "$FILE"
sed -i '' 's/assessmentcompliance/assessment.compliance/g' "$FILE"
sed -i '' 's/assessmentmetadata/assessment.metadata/g' "$FILE"
sed -i '' 's/assessmentid/assessment.id/g' "$FILE"

# Fix more context access patterns
sed -i '' 's/contentdata\.Access/content.dataAccess/g' "$FILE"
sed -i '' 's/contenttarget\.Audience/content.targetAudience/g' "$FILE"
sed -i '' 's/contentproposed\.Actions/content.proposedActions/g' "$FILE"
sed -i '' 's/contentagent\.Responses/content.agentResponses/g' "$FILE"

# Fix method calls without proper this references
sed -i '' 's/thisexecute\.With\.Memory/this.executeWithMemory/g' "$FILE"
sed -i '' 's/thisepisodic\.Memory/this.episodicMemory/g' "$FILE"
sed -i '' 's/thissemantic\.Memory/this.semanticMemory/g' "$FILE"
sed -i '' 's/thisviolation\.Patterns/this.violationPatterns/g' "$FILE"
sed -i '' 's/thisethical\.Guidelines/this.ethicalGuidelines/g' "$FILE"
sed -i '' 's/thiscompliance\.Standards/this.complianceStandards/g' "$FILE"
sed -i '' 's/thislearning\.Insights/this.learningInsights/g' "$FILE"

# Fix specific method name patterns
sed -i '' 's/load\.EthicalGuidelines/loadEthicalGuidelines/g' "$FILE"
sed -i '' 's/load\.Violation\.Patterns/loadViolationPatterns/g' "$FILE"
sed -i '' 's/initialize\.Compliance\.Framework/initializeComplianceFramework/g' "$FILE"
sed -i '' 's/assess\.Indirect\.Harm/assessIndirectHarm/g' "$FILE"
sed -i '' 's/calculate\.Confidence\.Level/calculateConfidenceLevel/g' "$FILE"
sed -i '' 's/determine\.Safety\.Rating/determineSafetyRating/g' "$FILE"
sed -i '' 's/identify\.Violations/identifyViolations/g' "$FILE"
sed -i '' 's/assess\.Compliance/assessCompliance/g' "$FILE"
sed -i '' 's/is\.Similar\.Context/isSimilarContext/g' "$FILE"
sed -i '' 's/format\.Category/formatCategory/g' "$FILE"
sed -i '' 's/on\.Initialize/onInitialize/g' "$FILE"
sed -i '' 's/on\.Shutdown/onShutdown/g' "$FILE"

# Fix logger calls
sed -i '' 's/this\.loggerinfo/this.logger.info/g' "$FILE"
sed -i '' 's/this\.loggererror/this.logger.error/g' "$FILE"

echo "✅ Advanced ethics agent fixes applied!"