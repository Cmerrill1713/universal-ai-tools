#!/bin/bash

# Final Ethics Agent Syntax Fix Script
FILE="/Users/christianmerrill/Desktop/universal-ai-tools/src/agents/cognitive/ethics_agent.ts"

echo "🔧 Applying final ethics agent fixes..."

# Fix interface issues
sed -i '' 's/category: .*,$/category: '\''harm_prevention'\'' | '\''bias_detection'\'' | '\''privacy'\'' | '\''transparency'\'' | '\''fairness'\'' | '\''compliance'\'';/g' "$FILE"
sed -i '' 's/severity: .*,$/severity: '\''low'\'' | '\''medium'\'' | '\''high'\'' | '\''critical'\'';/g' "$FILE"
sed -i '' 's/severity: .*,$/severity: '\''low'\'' | '\''medium'\'' | '\''high'\'' | '\''critical'\'';/g' "$FILE"

# Fix return type references
sed -i '' 's/Promise<Ethics\.Check>/Promise<EthicsCheck>/g' "$FILE"

# Fix array syntax in method definitions
sed -i '' 's/\[pattern(/[(pattern/g' "$FILE"
sed -i '' 's/}]/}]/g' "$FILE"
sed -i '' 's/}],$/}]/g' "$FILE"

# Fix object literals with comma issues
sed -i '' 's/{ pattern: /{ pattern: /g' "$FILE"
sed -i '' 's/, type: .*,$/, type: \&\& },/g' "$FILE"

# Fix method call chains without dots
sed -i '' 's/contentStrmatch/contentStr.match/g' "$FILE"
sed -i '' 's/contentStrincludes/contentStr.includes/g' "$FILE"
sed -i '' 's/detectedBiasespush/detectedBiases.push/g' "$FILE"
sed -i '' 's/detectedBiaseslength/detectedBiases.length/g' "$FILE"
sed -i '' 's/detectedBiasesreduce/detectedBiases.reduce/g' "$FILE"
sed -i '' 's/detectedBiasesmap/detectedBiases.map/g' "$FILE"
sed -i '' 's/privacyViolationspush/privacyViolations.push/g' "$FILE"
sed -i '' 's/privacyViolationslength/privacyViolations.length/g' "$FILE"
sed -i '' 's/privacyViolationsincludes/privacyViolations.includes/g' "$FILE"
sed -i '' 's/privacyViolationsjoin/privacyViolations.join/g' "$FILE"
sed -i '' 's/missingTransparencypush/missingTransparency.push/g' "$FILE"
sed -i '' 's/missingTransparencylength/missingTransparency.length/g' "$FILE"
sed -i '' 's/missingTransparencyjoin/missingTransparency.join/g' "$FILE"
sed -i '' 's/fairnessIssuespush/fairnessIssues.push/g' "$FILE"
sed -i '' 's/fairnessIssueslength/fairnessIssues.length/g' "$FILE"
sed -i '' 's/fairnessIssuesjoin/fairnessIssues.join/g' "$FILE"
sed -i '' 's/complianceIssuespush/complianceIssues.push/g' "$FILE"
sed -i '' 's/complianceIssueslength/complianceIssues.length/g' "$FILE"
sed -i '' 's/complianceIssuesjoin/complianceIssues.join/g' "$FILE"
sed -i '' 's/similarViolationslength/similarViolations.length/g' "$FILE"
sed -i '' 's/improvementslength/improvements.length/g' "$FILE"
sed -i '' 's/recommendationspush/recommendations.push/g' "$FILE"
sed -i '' 's/criticalViolationslength/criticalViolations.length/g' "$FILE"
sed -i '' 's/highViolationslength/highViolations.length/g' "$FILE"
sed -i '' 's/complianceResultspush/complianceResults.push/g' "$FILE"
sed -i '' 's/checksmap/checks.map/g' "$FILE"
sed -i '' 's/checksfilter/checks.filter/g' "$FILE"
sed -i '' 's/checkslength/checks.length/g' "$FILE"
sed -i '' 's/confidencesreduce/confidences.reduce/g' "$FILE"
sed -i '' 's/confidenceslength/confidences.length/g' "$FILE"
sed -i '' 's/words1filter/words1.filter/g' "$FILE"
sed -i '' 's/words1length/words1.length/g' "$FILE"
sed -i '' 's/words2length/words2.length/g' "$FILE"
sed -i '' 's/words2includes/words2.includes/g' "$FILE"

# Fix property access patterns
sed -i '' 's/privacyPatternpatterntest/privacyPattern.pattern.test/g' "$FILE"
sed -i '' 's/privacyPatterntype/privacyPattern.type/g' "$FILE"
sed -i '' 's/content\.dataAccesslength/content.dataAccess.length/g' "$FILE"
sed -i '' 's/content\.dataAccessfilter/content.dataAccess.filter/g' "$FILE"
sed -i '' 's/content\.proposedActionslength/content.proposedActions.length/g' "$FILE"
sed -i '' 's/content\.proposedActionsevery/content.proposedActions.every/g' "$FILE"
sed -i '' 's/actionincludes/action.includes/g' "$FILE"

# Fix remaining variable patterns
sed -i '' 's/cpassed/c.passed/g' "$FILE"
sed -i '' 's/cseverity/c.severity/g' "$FILE"
sed -i '' 's/ccategory/c.category/g' "$FILE"
sed -i '' 's/cconfidence/c.confidence/g' "$FILE"
sed -i '' 's/cissue/c.issue/g' "$FILE"
sed -i '' 's/crecommendation/c.recommendation/g' "$FILE"
sed -i '' 's/checkpassed/check.passed/g' "$FILE"
sed -i '' 's/checkseverity/check.severity/g' "$FILE"
sed -i '' 's/checkcategory/check.category/g' "$FILE"
sed -i '' 's/checkissue/check.issue/g' "$FILE"
sed -i '' 's/checkrecommendation/check.recommendation/g' "$FILE"

# Fix variable access in violations and patterns
sed -i '' 's/vdescription/v.description/g' "$FILE"
sed -i '' 's/vmitigation/v.mitigation/g' "$FILE"
sed -i '' 's/vseverity/v.severity/g' "$FILE"
sed -i '' 's/vcategory/v.category/g' "$FILE"
sed -i '' 's/violationcategory/violation.category/g' "$FILE"
sed -i '' 's/violationdescription/violation.description/g' "$FILE"
sed -i '' 's/violationmitigation/violation.mitigation/g' "$FILE"
sed -i '' 's/cstandard/c.standard/g' "$FILE"
sed -i '' 's/ccompliant/c.compliant/g' "$FILE"
sed -i '' 's/cnotes/c.notes/g' "$FILE"
sed -i '' 's/gid/g.id/g' "$FILE"

# Fix specific pattern issues
sed -i '' 's/sensitive\.Access/sensitiveAccess/g' "$FILE"
sed -i '' 's/sensitive\.Accesslength/sensitiveAccess.length/g' "$FILE"
sed -i '' 's/has\.Citations/hasCitations/g' "$FILE"
sed -i '' 's/has\.Exclusions/hasExclusions/g' "$FILE"
sed -i '' 's/has\.Equal\.Access/hasEqualAccess/g' "$FILE"
sed -i '' 's/has\.Consent/hasConsent/g' "$FILE"
sed -i '' 's/has\.Opt\.Out/hasOptOut/g' "$FILE"
sed -i '' 's/exclusionary\.Patterns/exclusionaryPatterns/g' "$FILE"
sed -i '' 's/exclusionary\.Patternssome/exclusionaryPatterns.some/g' "$FILE"
sed -i '' 's/prohibited\.Content/prohibitedContent/g' "$FILE"
sed -i '' 's/privacy\.Check/privacyCheck/g' "$FILE"
sed -i '' 's/content\.Check/contentCheck/g' "$FILE"
sed -i '' 's/ethics\.Violations/ethicsViolations/g' "$FILE"

# Fix method chaining and array access
sed -i '' 's/Object\.keys.*length/Object.keys(&).length/g' "$FILE"
sed -i '' 's/Objectvalues/Object.values/g' "$FILE"
sed -i '' 's/Arrayfrom/Array.from/g' "$FILE"

# Fix remaining syntax issues
sed -i '' 's/;$/;/g' "$FILE"
sed -i '' 's/,$/,/g' "$FILE"

echo "✅ Final ethics agent fixes applied!"
echo "🔍 Running syntax validation..."