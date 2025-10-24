#!/bin/bash

# Comprehensive fix script for parsing errors caused by aggressive linting
# This script fixes widespread syntax errors across the codebase

echo "🔧 Starting comprehensive parsing error fixes..."

# Function to fix a single file
fix_file() {
    local file="$1"
    echo "  Fixing $file..."
    
    # Core pattern fixes that apply to all files
    sed -i '' \
        -e 's/} catch (_error {/} catch (_error) {/g' \
        -e 's/} catch (__error {/} catch (__error) {/g' \
        -e 's/} catch (error {/} catch (error) {/g' \
        -e 's/throw _error$/throw _error;/g' \
        -e 's/throw __error$/throw __error;/g' \
        -e 's/throw error$/throw error;/g' \
        -e 's/this\.logger\._error`/this.logger.error(`/g' \
        -e 's/this\.logger\._error$/this.logger.error(/g' \
        -e 's/this\.logger\._error(/this.logger.error(/g' \
        -e 's/logger\._error`/logger.error(`/g' \
        -e 's/logger\._error$/logger.error(/g' \
        -e 's/logger\._error(/logger.error(/g' \
        -e 's/: async (_input any,/: async (_input: any,/g' \
        -e 's/: async (input any,/: async (input: any,/g' \
        -e 's/async (_input any,/async (_input: any,/g' \
        -e 's/async (input any,/async (input: any,/g' \
        -e 's/(_input any, _context: AgentContext)/(_input: any, _context: AgentContext)/g' \
        -e 's/(input any, context: AgentContext)/(input: any, context: AgentContext)/g' \
        -e 's/return this\.coordinateAgents(_input context);/return this.coordinateAgents(_input, _context);/g' \
        -e 's/return this\.makeDecision(_input context);/return this.makeDecision(_input, _context);/g' \
        -e 's/return this\.buildConsensus(_input context);/return this.buildConsensus(_input, _context);/g' \
        -e "s/this\.cognitiveCapabilities\.set('critical__analysis, {/this.cognitiveCapabilities.set('critical_analysis', {/" \
        -e "s/name: 'critical__analysis,/name: 'critical_analysis',/" \
        -e "s/return this\.cognitiveCapabilities\.get('critical__analysis) || null;/return this.cognitiveCapabilities.get('critical_analysis') || null;/" \
        -e 's/this\.logger\.error('\''Enhanced planning failed:'\'',, _error;/this.logger.error('\''Enhanced planning failed:'\'', _error);/' \
        -e 's/this\.logger\.error('\''Ethics assessment failed:'\'',, _error;/this.logger.error('\''Ethics assessment failed:'\'', _error);/' \
        -e 's/const _content= {/const _content = {/g' \
        -e 's/userRequest: context\.userRequest,/userRequest: _context.userRequest,/g' \
        -e 's/agentResponses: context\.metadata/agentResponses: _context.metadata/g' \
        -e 's/proposedActions: context\.metadata/proposedActions: _context.metadata/g' \
        -e 's/dataAccess: context\.metadata/dataAccess: _context.metadata/g' \
        -e 's/targetAudience: context\.metadata/targetAudience: _context.metadata/g' \
        -e 's/const _request= /const _request = /g' \
        -e 's/_requestincludes/_request.includes/g' \
        -e 's/_analysiskey_weaknesses/_analysis.key_weaknesses/g' \
        -e 's/_analysisrisk_factors/_analysis.risk_factors/g' \
        -e 's/_analysisimprovement_suggestions/_analysis.improvement_suggestions/g' \
        -e 's/_analysissecurity_vulnerabilities/_analysis.security_vulnerabilities/g' \
        -e 's/_analysisoperational_challenges/_analysis.operational_challenges/g' \
        -e 's/_analysisperformance_limitations/_analysis.performance_limitations/g' \
        -e 's/_analysiscomplexity/_analysis.complexity/g' \
        -e 's/_analysisdomain/_analysis.domain/g' \
        -e 's/_analysismemoryInsights/_analysis.memoryInsights/g' \
        -e 's/_analysisdomainConfidence/_analysis.domainConfidence/g' \
        -e 's/_analysislearnedRiskFactors/_analysis.learnedRiskFactors/g' \
        -e 's/critiqueType: '\''comprehensive__analysis,/critiqueType: '\''comprehensive_analysis'\'',/g' \
        -e 's/this\.generateOllamaResponse(prompt, context);/this.generateOllamaResponse(prompt, _context);/g' \
        -e 's/} catch (_error {/} catch (_error) {/g' \
        -e 's/this\.logger\.warn('\''Enhanced orchestration failed, using fallback'\'', _error;/this.logger.warn('\''Enhanced orchestration failed, using fallback'\'', _error);/' \
        -e 's/return this\.performFallbackCoordination(_input _context);/return this.performFallbackCoordination(_input, _context);/g' \
        -e 's/const response = await this\.generateOllamaResponse(prompt, context);/const response = await this.generateOllamaResponse(prompt, _context);/g' \
        -e 's/return this\.buildConsensus(_input context);/return this.buildConsensus(_input, _context);/g' \
        -e 's/return this\.makeDecision(_input context);/return this.makeDecision(_input, _context);/g' \
        "$file"
}  

# Fix specific critical files first
echo "Fixing critical agent files..."
fix_file "src/agents/base_agent.ts"
fix_file "src/agents/cognitive/devils_advocate_agent.ts"
fix_file "src/agents/cognitive/enhanced_planner_agent.ts"
fix_file "src/agents/cognitive/ethics_agent.ts"
fix_file "src/agents/cognitive/orchestrator_agent.ts"

# Now fix additional issues specific to base_agent.ts
echo "Applying specific fixes to base_agent.ts..."
sed -i '' \
    -e 's/_error _errorinstanceof Error ? _errormessage : String(_error,/_error: _error instanceof Error ? _error.message : String(_error),/g' \
    -e 's/_errorinstanceof Error ? _errormessage : String(_error}/_error instanceof Error ? _error.message : String(_error)/g' \
    -e 's/this\.emit('\''request_failed'\'', { agentId: this\.config\.name, requestId, _error errorResponse });/this.emit('\''request_failed'\'', { agentId: this.config.name, requestId, error: errorResponse });/' \
    -e 's/this\.logger\.warn(`⚠️ Failed to load memory for agent \${this\.config\.name}:`, __error;/this.logger.warn(`⚠️ Failed to load memory for agent \${this.config.name}:`, __error);/' \
    -e 's/this\.logger\.warn(`⚠️ Failed to retrieve memory:`, _error;/this.logger.warn(`⚠️ Failed to retrieve memory:`, _error);/' \
    -e 's/this\.logger\.warn(`⚠️ Failed to store memory:`, _error;/this.logger.warn(`⚠️ Failed to store memory:`, _error);/' \
    -e 's/this\.logger\.debug(`🚀 Agent \${this\.config\.name} processing _request\${event\.requestId}`);/this.logger.debug(`🚀 Agent \${this.config.name} processing request \${event.requestId}`);/' \
    -e 's/this\.logger\.debug(`✅ Agent \${this\.config\.name} completed _request\${event\.requestId}`);/this.logger.debug(`✅ Agent \${this.config.name} completed request \${event.requestId}`);/' \
    -e 's/this\.logger\._error$/this.logger.error(/' \
    -e 's/`❌ Agent \${this\.config\.name} failed _request\${event\.requestId}:`,/`❌ Agent \${this.config.name} failed request \${event.requestId}:`,/' \
    -e 's/event\.error$/event.error/' \
    src/agents/base_agent.ts

# Fix devils_advocate_agent.ts specific issues
echo "Applying specific fixes to devils_advocate_agent.ts..."
sed -i '' \
    -e 's/const _analysis= /const _analysis = /g' \
    -e 's/return this\.performInternalAnalysis(_input context);/return this.performInternalAnalysis(_input, _context);/g' \
    -e 's/const critiqueReport = await this\.generateCritiqueReport(_input _analysis;/const critiqueReport = await this.generateCritiqueReport(_input, _analysis);/g' \
    -e 's/const risks = await this\.assessRisks(_input context);/const risks = await this.assessRisks(_input, _context);/g' \
    -e 's/const stressScenarios = await this\.generateStressScenarios(_input context);/const stressScenarios = await this.generateStressScenarios(_input, _context);/g' \
    -e 's/const stressResults = await this\.runStressTests(_input stressScenarios);/const stressResults = await this.runStressTests(_input, stressScenarios);/g' \
    -e 's/const stressReport = await this\.generateStressReport(_input stressResults);/const stressReport = await this.generateStressReport(_input, stressResults);/g' \
    -e "s/this\.logger\.warn('Ollama _analysisfailed, using fallback _analysis);/this.logger.warn('Ollama analysis failed, using fallback analysis');/" \
    -e "s/this\.logger\.warn('Failed to parse Ollama _analysisresponse');/this.logger.warn('Failed to parse Ollama analysis response');/" \
    -e 's/return _analysis$/return _analysis;/g' \
    -e 's/this\.createStructuredFindings(_analysis,/this.createStructuredFindings(_analysis),/g' \
    -e 's/severity: this\.calculateSeverity(_analysis,/severity: this.calculateSeverity(_analysis),/g' \
    src/agents/cognitive/devils_advocate_agent.ts

# Fix enhanced_planner_agent.ts specific issues  
echo "Applying specific fixes to enhanced_planner_agent.ts..."
sed -i '' \
    -e 's/const contentToEvaluate = this\.extractContentForEvaluation(context);/const contentToEvaluate = this.extractContentForEvaluation(_context);/g' \
    -e 's/const assessment = await this\.performEthicsAssessment(contentToEvaluate, context);/const assessment = await this.performEthicsAssessment(contentToEvaluate, _context);/g' \
    -e 's/const historicalCheck = await this\.checkHistoricalViolations(assessment, context);/const historicalCheck = await this.checkHistoricalViolations(assessment, _context);/g' \
    -e 's/const finalAssessment = await this\.generateEthicalRecommendations(improvedAssessment, context);/const finalAssessment = await this.generateEthicalRecommendations(improvedAssessment, _context);/g' \
    -e 's/await this\.storeEthicsExperience(context, finalAssessment);/await this.storeEthicsExperience(_context, finalAssessment);/g' \
    -e 's/const _request= /const _request = /g' \
    -e 's/const baseSteps = this\.getBaseStepsForDomain(_analysisdomain);/const baseSteps = this.getBaseStepsForDomain(_analysis.domain);/g' \
    -e 's/if (_analysismemoryInsights\.successPatterns\.length > 0)/if (_analysis.memoryInsights.successPatterns.length > 0)/g' \
    -e 's/baseSteps = this\.enhanceStepsWithPatterns(baseSteps, _analysismemoryInsights\.successPatterns);/baseSteps = this.enhanceStepsWithPatterns(baseSteps, _analysis.memoryInsights.successPatterns);/g' \
    -e 's/baseSteps = this\.adjustTimeEstimatesFromMemory(baseSteps, _analysismemoryInsights\.timeEstimates);/baseSteps = this.adjustTimeEstimatesFromMemory(baseSteps, _analysis.memoryInsights.timeEstimates);/g' \
    -e 's/baseSteps = this\.addRiskMitigations(baseSteps, _analysismemoryInsights\.riskFactors);/baseSteps = this.addRiskMitigations(baseSteps, _analysis.memoryInsights.riskFactors);/g' \
    -e 's/title: `Enhanced \${_analysisdomain} Setup Plan`,/title: `Enhanced \${_analysis.domain} Setup Plan`,/g' \
    -e 's/complexity: this\.assessComplexityWithMemory(_analysis,/complexity: this.assessComplexityWithMemory(_analysis),/g' \
    -e 's/prerequisites: this\.generatePrerequisites(_analysis,/prerequisites: this.generatePrerequisites(_analysis),/g' \
    -e 's/successCriteria: this\.generateSuccessCriteria(_analysis,/successCriteria: this.generateSuccessCriteria(_analysis),/g' \
    -e 's/riskAssessment: this\.generateRiskAssessment(_analysis,/riskAssessment: this.generateRiskAssessment(_analysis),/g' \
    -e 's/adaptationStrategy: this\.generateAdaptationStrategy(_analysis,/adaptationStrategy: this.generateAdaptationStrategy(_analysis),/g' \
    -e 's/learningPoints: this\.generateLearningPoints(_analysis,/learningPoints: this.generateLearningPoints(_analysis),/g' \
    src/agents/cognitive/enhanced_planner_agent.ts

# Fix ethics_agent.ts specific issues
echo "Applying specific fixes to ethics_agent.ts..."
sed -i '' \
    -e 's/return _content$/return _content;/g' \
    -e 's/checks\.push(await this\.checkHarmPrevention(_content);/checks.push(await this.checkHarmPrevention(_content));/g' \
    -e 's/checks\.push(await this\.checkBiasDetection(_content);/checks.push(await this.checkBiasDetection(_content));/g' \
    -e 's/checks\.push(await this\.checkPrivacyProtection(_content);/checks.push(await this.checkPrivacyProtection(_content));/g' \
    -e 's/checks\.push(await this\.checkTransparency(_content);/checks.push(await this.checkTransparency(_content));/g' \
    -e 's/checks\.push(await this\.checkFairness(_content);/checks.push(await this.checkFairness(_content));/g' \
    -e 's/checks\.push(await this\.checkCompliance(_content);/checks.push(await this.checkCompliance(_content));/g' \
    -e 's/compliance: this\.assessCompliance(checks, _content,/compliance: this.assessCompliance(checks, _content),/g' \
    -e 's/const contentStr = JSON\.stringify(_content\.toLowerCase();/const contentStr = JSON.stringify(_content).toLowerCase();/g' \
    -e 's/const detectedHarms = harmfulPatterns\.filter((_pattern => contentStr\.includes(_pattern);/const detectedHarms = harmfulPatterns.filter((pattern) => contentStr.includes(pattern));/g' \
    -e 's/const indirectHarmRisk = this\.assessIndirectHarm(_content;/const indirectHarmRisk = this.assessIndirectHarm(_content);/g' \
    -e 's/const contentStr = JSON\.stringify(_content;/const contentStr = JSON.stringify(_content);/g' \
    -e 's/const matches = contentStr\.match(indicator\._pattern;/const matches = contentStr.match(indicator.pattern);/g' \
    -e 's/_pattern /pattern /g' \
    -e 's/if (privacyPattern\._patterntest(contentStr))/if (privacyPattern.pattern.test(contentStr))/g' \
    -e 's/_contentdataAccess/_content.dataAccess/g' \
    -e 's/_contentagentResponses/_content.agentResponses/g' \
    -e 's/_contenttargetAudience/_content.targetAudience/g' \
    -e 's/_contentproposedActions/_content.proposedActions/g' \
    -e 's/const hasExclusions = exclusionaryPatterns\.some((_pattern => contentStr\.includes(_pattern);/const hasExclusions = exclusionaryPatterns.some((pattern) => contentStr.includes(pattern));/g' \
    -e "s/'adult _content/'adult content/g" \
    -e 's/this\.isSimilarContext(ep\.context\.userRequest, context\.userRequest)/this.isSimilarContext(ep.context.userRequest, _context.userRequest)/g' \
    -e 's/const _pattern= /const pattern = /g' \
    -e 's/if (_pattern {/if (pattern) {/g' \
    -e 's/violation\.mitigation = _patternbestPractice || violation\.mitigation;/violation.mitigation = pattern.bestPractice || violation.mitigation;/g' \
    -e 's/if (context\.metadata\?\.deployment === '\''production'\'')/if (_context.metadata?.deployment === '\''production'\'')/g' \
    -e 's/await this\.storeSemanticMemory(`ethics_success_\${assessment\.id}`, { context: context\.userRequest,/await this.storeSemanticMemory(`ethics_success_\${assessment.id}`, { context: _context.userRequest,/g' \
    -e 's/for (const \[_pattern data\] of Array\.from(this\.violationPatterns\.entries()))/for (const [pattern, data] of Array.from(this.violationPatterns.entries()))/g' \
    -e 's/await this\.storeSemanticMemory(_pattern data);/await this.storeSemanticMemory(pattern, data);/g' \
    -e 's/return this\.executeWithMemory(context);/return this.executeWithMemory(_context);/g' \
    src/agents/cognitive/ethics_agent.ts

# Find and fix other files with similar issues
echo "Finding and fixing other TypeScript files..."
find src -name "*.ts" -type f | while read -r file; do
    if [[ "$file" != "src/agents/base_agent.ts" && 
          "$file" != "src/agents/cognitive/devils_advocate_agent.ts" && 
          "$file" != "src/agents/cognitive/enhanced_planner_agent.ts" && 
          "$file" != "src/agents/cognitive/ethics_agent.ts" && 
          "$file" != "src/agents/cognitive/orchestrator_agent.ts" ]]; then
        
        # Apply basic fixes to all other files
        sed -i '' \
            -e 's/} catch (_error {/} catch (_error) {/g' \
            -e 's/} catch (__error {/} catch (__error) {/g' \
            -e 's/} catch (error {/} catch (error) {/g' \
            -e 's/throw _error$/throw _error;/g' \
            -e 's/throw __error$/throw __error;/g' \
            -e 's/throw error$/throw error;/g' \
            -e 's/this\.logger\._error/this.logger.error/g' \
            -e 's/logger\._error/logger.error/g' \
            -e 's/: async (_input any,/: async (_input: any,/g' \
            -e 's/: async (input any,/: async (input: any,/g' \
            -e 's/async (_input any,/async (_input: any,/g' \
            -e 's/async (input any,/async (input: any,/g' \
            "$file"
    fi
done

echo "✅ Comprehensive parsing error fixes completed!"
echo ""
echo "📋 Summary of fixes applied:"
echo "  - Fixed missing closing parentheses in try-catch blocks"
echo "  - Fixed logger method calls (._error -> .error)"
echo "  - Fixed unterminated string literals"
echo "  - Added missing semicolons"
echo "  - Fixed parameter type annotations"
echo "  - Fixed variable references (_context vs context)"
echo "  - Fixed missing commas in parameter lists"
echo "  - Fixed method call parameter separators"
echo "  - Fixed object property access syntax"
echo "  - Fixed template literal issues"
echo ""
echo "🧪 Next steps:"
echo "  1. Run 'npm run type-check' to verify TypeScript compilation"
echo "  2. Review any remaining errors manually"
echo "  3. Test the affected functionality"