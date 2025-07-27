#!/bin/bash
# Fix the final 3 interface name syntax errors
set -e

echo "🔧 Fixing final interface name syntax errors"

# Fix enhanced_planner_agent.ts - interface Plan.Step should be PlanStep
echo "Fixing enhanced_planner_agent.ts interface names..."
sed -i '' 's/interface Plan\.Step/interface PlanStep/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/Plan\.Step\[\]/PlanStep[]/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/Plan\.Step\[\]/PlanStep[]/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/: Plan\.Step\[\]/: PlanStep[]/g' src/agents/cognitive/enhanced_planner_agent.ts

# Fix interface Planning.Pattern should be PlanningPattern  
sed -i '' 's/interface Planning\.Pattern/interface PlanningPattern/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/Planning\.Pattern/PlanningPattern/g' src/agents/cognitive/enhanced_planner_agent.ts

# Fix class Enhanced.Planner.Agent should be EnhancedPlannerAgent
sed -i '' 's/export class Enhanced\.Planner\.Agent/export class EnhancedPlannerAgent/g' src/agents/cognitive/enhanced_planner_agent.ts

# Fix ethics_agent.ts - interface Ethics.Check should be EthicsCheck
echo "Fixing ethics_agent.ts interface names..."
sed -i '' 's/interface Ethics\.Check/interface EthicsCheck/g' src/agents/cognitive/ethics_agent.ts
sed -i '' 's/Ethics\.Check\[\]/EthicsCheck[]/g' src/agents/cognitive/ethics_agent.ts
sed -i '' 's/: Ethics\.Check\[\]/: EthicsCheck[]/g' src/agents/cognitive/ethics_agent.ts

# Fix interface Ethics.Assessment should be EthicsAssessment
sed -i '' 's/interface Ethics\.Assessment/interface EthicsAssessment/g' src/agents/cognitive/ethics_agent.ts
sed -i '' 's/Ethics\.Assessment/EthicsAssessment/g' src/agents/cognitive/ethics_agent.ts

# Fix interface Ethical.Guideline should be EthicalGuideline
sed -i '' 's/interface Ethical\.Guideline/interface EthicalGuideline/g' src/agents/cognitive/ethics_agent.ts
sed -i '' 's/Ethical\.Guideline/EthicalGuideline/g' src/agents/cognitive/ethics_agent.ts

# Fix class Ethics.Agent should be EthicsAgent
sed -i '' 's/export class Ethics\.Agent/export class EthicsAgent/g' src/agents/cognitive/ethics_agent.ts

# Fix evaluation_agent.ts - interface Evaluation.Criteria should be EvaluationCriteria
echo "Fixing evaluation_agent.ts interface names..."
sed -i '' 's/interface Evaluation\.Criteria/interface EvaluationCriteria/g' src/agents/cognitive/evaluation_agent.ts
sed -i '' 's/Evaluation\.Criteria/EvaluationCriteria/g' src/agents/cognitive/evaluation_agent.ts

# Fix interface Quality.Metrics should be QualityMetrics
sed -i '' 's/interface Quality\.Metrics/interface QualityMetrics/g' src/agents/cognitive/evaluation_agent.ts
sed -i '' 's/Quality\.Metrics/QualityMetrics/g' src/agents/cognitive/evaluation_agent.ts

# Fix interface Performance.Metrics should be PerformanceMetrics
sed -i '' 's/interface Performance\.Metrics/interface PerformanceMetrics/g' src/agents/cognitive/evaluation_agent.ts
sed -i '' 's/Performance\.Metrics/PerformanceMetrics/g' src/agents/cognitive/evaluation_agent.ts

# Fix interface Evaluation.Report should be EvaluationReport
sed -i '' 's/interface Evaluation\.Report/interface EvaluationReport/g' src/agents/cognitive/evaluation_agent.ts
sed -i '' 's/Evaluation\.Report/EvaluationReport/g' src/agents/cognitive/evaluation_agent.ts

# Fix interface Agent.Benchmark should be AgentBenchmark
sed -i '' 's/interface Agent\.Benchmark/interface AgentBenchmark/g' src/agents/cognitive/evaluation_agent.ts
sed -i '' 's/Agent\.Benchmark/AgentBenchmark/g' src/agents/cognitive/evaluation_agent.ts

# Fix class Evaluation.Agent should be EvaluationAgent
sed -i '' 's/export class Evaluation\.Agent/export class EvaluationAgent/g' src/agents/cognitive/evaluation_agent.ts

# Fix evaluation_agent_clean.ts - same fixes
echo "Fixing evaluation_agent_clean.ts interface names..."
sed -i '' 's/interface Evaluation\.Criteria/interface EvaluationCriteria/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/interface Quality\.Metrics/interface QualityMetrics/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/interface Evaluation\.Report/interface EvaluationReport/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/interface Benchmark\.Result/interface BenchmarkResult/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/export class Evaluation\.Agent/export class EvaluationAgent/g' src/agents/cognitive/evaluation_agent_clean.ts

# Fix all remaining references
sed -i '' 's/Evaluation\.Criteria/EvaluationCriteria/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/Quality\.Metrics/QualityMetrics/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/Evaluation\.Report/EvaluationReport/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/Benchmark\.Result/BenchmarkResult/g' src/agents/cognitive/evaluation_agent_clean.ts

echo "✅ Final interface name fixes completed"

# Check current status
echo "🔍 Checking remaining parsing errors..."
npm run lint --silent | head -5 || echo "Lint check completed"