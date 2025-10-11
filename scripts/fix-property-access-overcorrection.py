#!/usr/bin/env python3
"""
Fix property access over-correction patterns.
The previous script incorrectly split TypeScript identifiers like 'AgentContext' into 'Agent.Context'
"""

import os
import re


def fix_specific_file(file_path, target_errors):
    """Fix specific property access over-corrections in a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Define common TypeScript type and identifier patterns that got over-corrected
        fixes = [
            # Type imports and references
            (r'Agent\.Context', 'AgentContext'),
            (r'RealCognitive\.Agent', 'RealCognitiveAgent'),
            (r'DevilsAdvocate\.Agent', 'DevilsAdvocateAgent'),
            (r'Critique\.Report', 'CritiqueReport'),
            (r'StressTest\.Report', 'StressTestReport'),
            (r'StressTest\.Result', 'StressTestResult'),
            (r'Stress\.Scenario', 'StressScenario'),
            (r'Next\.Function', 'NextFunction'),
            (r'Supabase\.Client', 'SupabaseClient'),
            (r'Error\.Code', 'ErrorCode'),
            (r'Log\.Context', 'LogContext'),
            (r'Memory\.Router', 'MemoryRouter'),
            (r'Authenticated\.Request', 'AuthenticatedRequest'),

            # Constants that got split
            (r'GOOD_CONFIDENC\.E', 'GOOD_CONFIDENCE'),
            (r'MODERATE_CONFIDENC\.E', 'MODERATE_CONFIDENCE'),
            (r'HIGH_CONFIDENC\.E', 'HIGH_CONFIDENCE'),
            (r'PERCENTAGE_MULTIPLIE\.R', 'PERCENTAGE_MULTIPLIER'),
            (r'CRITICAL_RISK_THRESHOL\.D', 'CRITICAL_RISK_THRESHOLD'),
            (r'HIGH_RISK_THRESHOL\.D', 'HIGH_RISK_THRESHOLD'),
            (r'MEDIUM_RISK_THRESHOL\.D', 'MEDIUM_RISK_THRESHOLD'),
            (r'MEDIUM_CONFIDENC\.E', 'MEDIUM_CONFIDENCE'),

            # Property names that got split
            (r'critique\.Id', 'critiqueId'),
            (r'setup\.Id', 'setupId'),
            (r'critique\.Type', 'critiqueType'),
            (r'key\.Weaknesses', 'keyWeaknesses'),
            (r'risk\.Factors', 'riskFactors'),
            (r'improvement\.Suggestions', 'improvementSuggestions'),
            (r'performance\.Impact', 'performanceImpact'),
            (r'structured\.Findings', 'structuredFindings'),
            (r'actionable\.Items', 'actionableItems'),
            (r'report\.Id', 'reportId'),
            (r'report\.Type', 'reportType'),
            (r'stress\.Scenarios', 'stressScenarios'),
            (r'overallResilience\.Score', 'overallResilienceScore'),
            (r'scenario\.Name', 'scenarioName'),
            (r'maxFailure\.Rate', 'maxFailureRate'),
            (r'recovery\.Time', 'recoveryTime'),
            (r'risk\.Score', 'riskScore'),
            (r'survival\.Probability', 'survivalProbability'),
            (r'finding\.Type', 'findingType'),
            (r'confidence\.Level', 'confidenceLevel'),
            (r'expected\.Improvement', 'expectedImprovement'),
            (r'risk\.Reduction', 'riskReduction'),

            # Method names that got split
            (r'setupCognitive\.Capabilities', 'setupCognitiveCapabilities'),
            (r'select\.Capability', 'selectCapability'),
            (r'generate\.Reasoning', 'generateReasoning'),
            (r'getResilience\.Level', 'getResilienceLevel'),
            (r'executeCritical\.Analysis', 'executeCriticalAnalysis'),
            (r'executeRisk\.Assessment', 'executeRiskAssessment'),
            (r'executeStress\.Testing', 'executeStressTesting'),
            (r'performInternal\.Analysis', 'performInternalAnalysis'),
            (r'parseAnalysis\.Response', 'parseAnalysisResponse'),
            (r'performPatternBased\.Analysis', 'performPatternBasedAnalysis'),
            (r'generateCritique\.Report', 'generateCritiqueReport'),
            (r'createStructured\.Findings', 'createStructuredFindings'),
            (r'calculate\.Severity', 'calculateSeverity'),
            (r'assess\.Risks', 'assessRisks'),
            (r'assessTechnical\.Risks', 'assessTechnicalRisks'),
            (r'assessOperational\.Risks', 'assessOperationalRisks'),
            (r'assessSecurity\.Risks', 'assessSecurityRisks'),
            (r'assessCompliance\.Risks', 'assessComplianceRisks'),
            (r'calculateOverall\.Risk', 'calculateOverallRisk'),
            (r'generateMitigation\.Strategies', 'generateMitigationStrategies'),
            (r'generateStress\.Scenarios', 'generateStressScenarios'),
            (r'runStress\.Tests', 'runStressTests'),
            (r'generateStress\.Report', 'generateStressReport'),
            (r'calculateResilience\.Score', 'calculateResilienceScore'),
            (r'createStress\.Findings', 'createStressFindings'),
            (r'generateStress\.Recommendations', 'generateStressRecommendations'),
            (r'getCritique\.Feedback', 'getCritiqueFeedback'),

            # Common property access patterns
            (r'cognitive\.Capabilities', 'cognitiveCapabilities'),
            (r'critique\.History', 'critiqueHistory'),
            (r'ollama\.Service', 'ollamaService'),
            (r'preferred\.Model', 'preferredModel'),
            (r'previous\.Context', 'previousContext'),
            (r'user\.Request', 'userRequest'),
            (r'request\.Id', 'requestId'),
            (r'user\.Id', 'userId'),
            (r'orchestration\.Mode', 'orchestrationMode'),
            (r'participating\.Agents', 'participatingAgents'),
            (r'memory\.System', 'memorySystem'),
            (r'agent\.Registry', 'agentRegistry'),
            (r'dspy\.Service', 'dspyService'),
            (r'evaluation\.Agent', 'evaluationAgent'),

            # API response patterns
            (r'apiResponse\.Middleware', 'apiResponseMiddleware'),
            (r'createPagination\.Meta', 'createPaginationMeta'),
            (r'send\.Error', 'sendError'),
            (r'sendPaginated\.Success', 'sendPaginatedSuccess'),
            (r'send\.Success', 'sendSuccess'),
            (r'validateMemory\.Store', 'validateMemoryStore'),
            (r'validateMemory\.Search', 'validateMemorySearch'),
            (r'validated\.Data', 'validatedData'),
            (r'ai\.Service', 'aiService'),
            (r'memory\.Data', 'memoryData'),
            (r'embedding\.Result', 'embeddingResult'),
            (r'embedding\.Error', 'embeddingError'),
            (r'memory\.Id', 'memoryId'),
            (r'content\.Length', 'contentLength'),
            (r'has\.Embedding', 'hasEmbedding'),
            (r'page\.Num', 'pageNum'),
            (r'limit\.Num', 'limitNum'),
            (r'offset\.Num', 'offsetNum'),
            (r'memory\.Ids', 'memoryIds'),
            (r'total\.Count', 'totalCount'),
            (r'search\.Params', 'searchParams'),
            (r'start\.Time', 'startTime'),
            (r'processing\.Time', 'processingTime'),

            # Global object patterns
            (r'process\.env', 'process.env'),  # This should stay as is
            (r'Date\.now', 'Date.now'),        # This should stay as is
            (r'JSON\.stringify', 'JSON.stringify'),  # This should stay as is
            (r'JSON\.parse', 'JSON.parse'),    # This should stay as is
            (r'Math\.max', 'Math.max'),        # This should stay as is
            (r'Math\.min', 'Math.min'),        # This should stay as is
            (r'Array\.isArray', 'Array.isArray'),  # This should stay as is
            (r'Object\.keys', 'Object.keys'),  # This should stay as is
            (r'Object\.values', 'Object.values'),  # This should stay as is
            (r'Object\.entries', 'Object.entries'),  # This should stay as is

            # But fix the over-corrections
            (r'JSO\.N\.stringify', 'JSON.stringify'),
            (r'JSO\.N\.parse', 'JSON.parse'),
            (r'Dat\.e\.now', 'Date.now'),
            (r'Mat\.h\.max', 'Math.max'),
            (r'Mat\.h\.min', 'Math.min'),
            (r'Arra\.y\.isArray', 'Array.isArray'),
            (r'Objec\.t\.keys', 'Object.keys'),
            (r'Objec\.t\.values', 'Object.values'),
            (r'Objec\.t\.entries', 'Object.entries'),
            (r'parse\.Int', 'parseInt'),
            (r'toISO\.String', 'toISOString'),
            (r'toLower\.Case', 'toLowerCase'),
            (r'toUpper\.Case', 'toUpperCase'),
            (r'to\.Fixed', 'toFixed'),
            (r'to\.String', 'toString'),
            (r'for\.Each', 'forEach'),

            # Module names and imports
            (r'create\.Client', 'createClient'),
            (r'UniversalAgent\.Registry', 'UniversalAgentRegistry'),
            (r'EnhancedMemory\.System', 'EnhancedMemorySystem'),
            (r'StdioServer\.Transport', 'StdioServerTransport'),
            (r'CallToolRequest\.Schema', 'CallToolRequestSchema'),
            (r'ListToolsRequest\.Schema', 'ListToolsRequestSchema'),
            (r'input\.Schema', 'inputSchema'),
            (r'agent\.Name', 'agentName'),
            (r'setRequest\.Handler', 'setRequestHandler'),
            (r'get\.Agent', 'getAgent'),
            (r'store\.Memory', 'storeMemory'),
            (r'getCore\.Agents', 'getCoreAgents'),
            (r'getCognitive\.Agents', 'getCognitiveAgents'),
            (r'getPersonal\.Agents', 'getPersonalAgents'),
            (r'isAgent\.Loaded', 'isAgentLoaded'),
            (r'is\.Error', 'isError'),

            # Environment and config patterns
            (r'NODE_EN\.V', 'NODE_ENV'),
            (r'POR\.T', 'PORT'),
            (r'SUPABASE_UR\.L', 'SUPABASE_URL'),
            (r'SUPABASE_ANON_KE\.Y', 'SUPABASE_ANON_KEY'),
            (r'SUPABASE_SERVICE_KE\.Y', 'SUPABASE_SERVICE_KEY'),
            (r'JWT_SECRE\.T', 'JWT_SECRET'),
            (r'ENCRYPTION_KE\.Y', 'ENCRYPTION_KEY'),
            (r'OPENAI_API_KE\.Y', 'OPENAI_API_KEY'),
            (r'ANTHROPIC_API_KE\.Y', 'ANTHROPIC_API_KEY'),
            (r'GOOGLE_AI_API_KE\.Y', 'GOOGLE_AI_API_KEY'),
            (r'OLLAMA_UR\.L', 'OLLAMA_URL'),
            (r'LM_STUDIO_UR\.L', 'LM_STUDIO_URL'),
            (r'ENABLE_META\.L', 'ENABLE_METAL'),
            (r'MLX_CACHE_DI\.R', 'MLX_CACHE_DIR'),
            (r'ENABLE_TELEMETR\.Y', 'ENABLE_TELEMETRY'),
            (r'LOG_LEVE\.L', 'LOG_LEVEL'),
            (r'RATE_LIMIT_WINDO\.W', 'RATE_LIMIT_WINDOW'),
            (r'RATE_LIMIT_MA\.X', 'RATE_LIMIT_MAX'),
            (r'ENABLE_WEBSOCKET\.S', 'ENABLE_WEBSOCKETS'),
            (r'ENABLE_MEMORY_SYSTE\.M', 'ENABLE_MEMORY_SYSTEM'),
            (r'ENABLE_ANTI_HALLUCINATIO\.N', 'ENABLE_ANTI_HALLUCINATION'),
            (r'ENABLE_COGNITIVE_AGENT\.S', 'ENABLE_COGNITIVE_AGENTS'),
            (r'MAX_CONCURRENT_REQUEST\.S', 'MAX_CONCURRENT_REQUESTS'),
            (r'REQUEST_TIMEOU\.T', 'REQUEST_TIMEOUT'),
            (r'MEMORY_CACHE_SIZ\.E', 'MEMORY_CACHE_SIZE'),
            (r'REDIS_UR\.L', 'REDIS_URL'),
        ]

        # Apply fixes
        for pattern, replacement in fixes:
            content = re.sub(pattern, replacement, content)

        # Only write if content changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    print("🔧 Fixing property access over-correction patterns...")

    # Get the specific file with most errors
    target_file = "src/agents/cognitive/devils_advocate_agent.ts"

    if os.path.exists(target_file):
        print(f"🎯 Fixing {target_file}...")
        if fix_specific_file(target_file, None):
            print(f"   ✅ Fixed {target_file}")
        else:
            print(f"   ⏭️  No changes needed in {target_file}")
    else:
        print(f"❌ File not found: {target_file}")

    # Also fix other common problematic files
    problem_files = [
        "src/routers/memory.ts",
        "src/mcp-server/universal-ai-tools-mcp.ts",
        "src/config/environment-clean.ts",
        "src/types/global-overrides.d.ts"
    ]

    for file_path in problem_files:
        if os.path.exists(file_path):
            print(f"🔧 Fixing {file_path}...")
            if fix_specific_file(file_path, None):
                print(f"   ✅ Fixed {file_path}")
            else:
                print(f"   ⏭️  No changes needed in {file_path}")

    print("\n🎉 Property access over-correction fix complete!")
    print("🔍 Run 'npm run type-check:dev' to verify fixes")

if __name__ == "__main__":
    main()
