/**
 * Enhanced Planner Agent with Memory Integration
 * Combines the strategic planning capabilities with advanced memory patterns from the trading system
 */

import type { AgentConfig, AgentContext, PartialAgentResponse } from '../base_agent';
import { AgentResponse } from '../base_agent';
import { EnhancedMemoryAgent } from '../enhanced_memory_agent';

interface PlanStep {
  id: string;
  description: string;
  dependencies: string[];
  estimatedTime: string;
  tools: string[];
  riskLevel: 'low' | 'medium' | 'high';
  validation: string[];
  confidence: number;
  precedence?: number;
}

interface Plan {
  id: string;
  title: string;
  description: string;
  steps: PlanStep[];
  totalEstimatedTime: string;
  complexity: 'low' | 'medium' | 'high';
  prerequisites: string[];
  successCriteria: string[];
  riskAssessment: any;
  adaptationStrategy: string;
  learningPoints: string[];
}

interface PlanningPattern {
  domain: string;
  successRate: number;
  averageTime: number;
  commonSteps: string[];
  criticalFactors: string[];
  riskMitigations: string[];
}

export class EnhancedPlannerAgent extends EnhancedMemoryAgent {
  private planningPatterns: Map<string, PlanningPattern> = new Map();
  private domainExpertise: Map<string, number> = new Map(); // 0-1 confidence scores

  constructor(config?: Partial<AgentConfig>) {
    super({
      name: 'enhanced_planner',
      description: 'Advanced strategic planning with memory integration and learning capabilities',
      priority: 8,
      capabilities: [
        {
          name: 'strategic_planning',
          description: 'Create comprehensive strategic plans based on memory and patterns',
          inputSchema: {},
          outputSchema: {}
        },
        {
          name: 'memory_based_optimization',
          description: 'Optimize plans using historical data and learned patterns',
          inputSchema: {},
          outputSchema: {}
        }
      ],
      maxLatencyMs: 30000,
      retryAttempts: 3,
      dependencies: [],
      memoryEnabled: true,
      ...config,
      memoryConfig: {
        workingMemorySize: 150, // Larger for complex planning
        episodicMemoryLimit: 2000, // More episodes for pattern learning
        enableLearning: true,
        enableKnowledgeSharing: true,
        ...config?.memoryConfig
      }
    });

    this.initializePlanningCapabilities();
  }

  private initializePlanningCapabilities(): void {
    // Initialize domain expertise from memory
    this.loadDomainExpertise();
    
    // Load successful planning patterns
    this.loadPlanningPatterns();
    
    this.logger.info('🎯 Enhanced Planner Agent initialized with memory-based learning');
  }

  protected async executeWithMemory(context: AgentContext): Promise<PartialAgentResponse> {
    const startTime = Date.now();
    
    try {
      // Analyze the request using memory-enhanced context
      const requestAnalysis = await this.analyzeRequestWithMemory(context);
      
      // Generate plan using learned patterns
      const plan = await this.generateMemoryEnhancedPlan(requestAnalysis, context);
      
      // Validate plan against historical successes
      const validatedPlan = await this.validatePlanAgainstMemory(plan, context);
      
      // Optimize plan based on past performance
      const optimizedPlan = await this.optimizePlanWithLearning(validatedPlan, context);
      
      // Store planning experience for future learning
      await this.storePlanningExperience(context, optimizedPlan);
      
      const response: PartialAgentResponse = {
        success: true,
        data: optimizedPlan,
        confidence: this.calculatePlanConfidence(optimizedPlan, context),
        message: 'Enhanced memory-based strategic plan generated',
        reasoning: this.generateEnhancedReasoning(optimizedPlan, context),
        metadata: {
          planningTime: Date.now() - startTime,
          memoryUtilization: this.getMemoryStats(),
          domainExpertise: this.domainExpertise.get(requestAnalysis.domain) || 0.5,
          patternsUsed: this.getAppliedPatterns(requestAnalysis.domain)
        }
      };
      
      return response;

    } catch (error) {
      this.logger.error('Enhanced planning failed:', error);
      throw error;
    }
  }

  private async analyzeRequestWithMemory(context: AgentContext): Promise<any> {
    const basicAnalysis = await this.performBasicAnalysis(context.userRequest);
    
    // Enhance with memory insights
    const memoryInsights = await this.retrieveMemoryInsights(basicAnalysis.domain, context);
    const domainConfidence = this.domainExpertise.get(basicAnalysis.domain) || 0.5;
    
    return {
      ...basicAnalysis,
      memoryInsights,
      domainConfidence,
      similarPastRequests: memoryInsights.similarRequests || [],
      learnedRiskFactors: memoryInsights.riskFactors || [],
      successPatterns: memoryInsights.successPatterns || []
    };
  }

  private async retrieveMemoryInsights(domain: string, context: AgentContext): Promise<any> {
    const insights: {
      similarRequests: any[];
      riskFactors: any[];
      successPatterns: any[];
      timeEstimates: any[];
      toolRecommendations: any[];
    } = {
      similarRequests: [],
      riskFactors: [],
      successPatterns: [],
      timeEstimates: [],
      toolRecommendations: []
    };
    
    // Search episodic memory for similar planning experiences
    const relevantEpisodes = this.episodicMemory
      .filter(episode => episode.context?.domain === domain || 
              this.isContentSimilar(episode.context?.userRequest, context.userRequest))
      .slice(-10); // Recent experiences
    
    for (const episode of relevantEpisodes) {
      if (episode.outcome === 'success') {
        insights.similarRequests.push({
          request: episode.context?.userRequest,
          plan: episode.response?.data,
          confidence: episode.response?.confidence || 0.5
        });
        
        if (episode.response?.data?.steps) {
          insights.timeEstimates.push(episode.response.data.totalEstimatedTime);
        }
        
        if (episode.response?.data?.suggested_tools) {
          insights.toolRecommendations.push(...episode.response.data.suggested_tools);
        }
      } else {
        // Learn from failures
        insights.riskFactors.push({
          risk: episode.error || 'Unknown failure',
          context: episode.context?.userRequest
        });
      }
    }
    
    // Get semantic memory patterns
    const domainPattern = this.semanticMemory.get(`successful_${domain}_pattern`);
    if (domainPattern) {
      insights.successPatterns.push(domainPattern.knowledge);
    }
    
    return insights;
  }

  private async generateMemoryEnhancedPlan(analysis: any, context: AgentContext): Promise<Plan> {
    const planId = `plan_${Date.now()}_enhanced`;
    
    // Generate base steps using domain patterns
    let baseSteps = this.getBaseStepsForDomain(analysis.domain);
    
    // Enhance steps with memory insights
    if (analysis.memoryInsights.successPatterns.length > 0) {
      baseSteps = this.enhanceStepsWithPatterns(baseSteps, analysis.memoryInsights.successPatterns);
    }
    
    // Apply learned time estimates
    baseSteps = this.adjustTimeEstimatesFromMemory(baseSteps, analysis.memoryInsights.timeEstimates);
    
    // Add risk mitigations from past failures
    baseSteps = this.addRiskMitigations(baseSteps, analysis.memoryInsights.riskFactors);
    
    const plan: Plan = {
      id: planId,
      title: `Enhanced ${analysis.domain} Setup Plan`,
      description: `Memory-enhanced strategic plan for ${context.userRequest}`,
      steps: baseSteps,
      totalEstimatedTime: this.calculateTotalTime(baseSteps),
      complexity: this.assessComplexityWithMemory(analysis),
      prerequisites: this.generatePrerequisites(analysis),
      successCriteria: this.generateSuccessCriteria(analysis),
      riskAssessment: this.generateRiskAssessment(analysis),
      adaptationStrategy: this.generateAdaptationStrategy(analysis),
      learningPoints: this.generateLearningPoints(analysis)
    };
    
    return plan;
  }

  private getBaseStepsForDomain(domain: string): PlanStep[] {
    const pattern = this.planningPatterns.get(domain);
    
    if (domain === 'trading') {
      return this.getTradingStepsWithMemory(pattern);
    } else if (domain === 'web_development') {
      return this.getWebDevelopmentStepsWithMemory(pattern);
    } else if (domain === 'data_science') {
      return this.getDataScienceStepsWithMemory(pattern);
    } else if (domain === 'database') {
      return this.getDatabaseStepsWithMemory(pattern);
    }
    
    return this.getGenericStepsWithMemory(pattern);
  }

  private getTradingStepsWithMemory(pattern?: PlanningPattern): PlanStep[] {
    const steps: PlanStep[] = [
      {
        id: 'trading_env',
        description: 'Set up trading environment with enhanced safety measures',
        dependencies: [],
        estimatedTime: '15-20 minutes',
        tools: ['trading_data_provider', 'development_environment', 'safety_scanner'],
        riskLevel: 'medium',
        validation: ['Environment verified', 'Safety checks passed', 'Data connections stable'],
        confidence: 0.9,
        precedence: 1
      },
      {
        id: 'risk_framework',
        description: 'Implement comprehensive risk management framework',
        dependencies: ['trading_env'],
        estimatedTime: '20-25 minutes',
        tools: ['risk_manager', 'position_sizer', 'portfolio_monitor'],
        riskLevel: 'high',
        validation: ['Risk limits set', 'Position sizing active', 'Emergency stops configured'],
        confidence: 0.95,
        precedence: 2
      },
      {
        id: 'strategy_implementation',
        description: 'Deploy trading strategy with memory-based optimization',
        dependencies: ['risk_framework'],
        estimatedTime: '25-30 minutes',
        tools: ['strategy_engine', 'backtester', 'performance_monitor'],
        riskLevel: 'medium',
        validation: ['Strategy deployed', 'Backtesting complete', 'Performance tracking active'],
        confidence: 0.85,
        precedence: 3
      },
      {
        id: 'live_validation',
        description: 'Validate with paper trading and gradual deployment',
        dependencies: ['strategy_implementation'],
        estimatedTime: '15-20 minutes',
        tools: ['paper_trading_engine', 'live_validator', 'alert_system'],
        riskLevel: 'low',
        validation: ['Paper trading successful', 'Live validation passed', 'Alerts configured'],
        confidence: 0.9,
        precedence: 4
      }
    ];
    
    // Apply pattern-based adjustments if available
    if (pattern) {
      return this.adjustStepsWithPattern(steps, pattern);
    }
    
    return steps;
  }

  private getWebDevelopmentStepsWithMemory(pattern?: PlanningPattern): PlanStep[] {
    return [
      {
        id: 'web_analysis',
        description: 'Analyze target websites with memory-enhanced intelligence',
        dependencies: [],
        estimatedTime: '10-15 minutes',
        tools: ['web_analyzer', 'site_mapper', 'compliance_checker'],
        riskLevel: 'low',
        validation: ['Sites analyzed', 'Structure mapped', 'Legal compliance verified'],
        confidence: 0.8,
        precedence: 1
      },
      {
        id: 'scraper_config',
        description: 'Configure adaptive web scraper with learned patterns',
        dependencies: ['web_analysis'],
        estimatedTime: '20-25 minutes',
        tools: ['web_scraper', 'selector_engine', 'rate_limiter'],
        riskLevel: 'medium',
        validation: ['Scraper configured', 'Selectors tested', 'Rate limiting active'],
        confidence: 0.85,
        precedence: 2
      },
      {
        id: 'data_pipeline',
        description: 'Set up robust data processing and storage pipeline',
        dependencies: ['scraper_config'],
        estimatedTime: '15-20 minutes',
        tools: ['data_processor', 'database_connector', 'quality_validator'],
        riskLevel: 'medium',
        validation: ['Pipeline active', 'Data validated', 'Storage optimized'],
        confidence: 0.9,
        precedence: 3
      },
      {
        id: 'monitoring_system',
        description: 'Implement comprehensive monitoring and alerting',
        dependencies: ['data_pipeline'],
        estimatedTime: '10-15 minutes',
        tools: ['monitor', 'alerting_system', 'performance_tracker'],
        riskLevel: 'low',
        validation: ['Monitoring active', 'Alerts configured', 'Performance tracked'],
        confidence: 0.85,
        precedence: 4
      }
    ];
  }

  private getDataScienceStepsWithMemory(pattern?: PlanningPattern): PlanStep[] {
    return [
      {
        id: 'ai_setup',
        description: 'Configure AI model connections with memory optimization',
        dependencies: [],
        estimatedTime: '15-20 minutes',
        tools: ['ai_model_connector', 'context_manager', 'memory_optimizer'],
        riskLevel: 'medium',
        validation: ['Models connected', 'Context managed', 'Memory optimized'],
        confidence: 0.85,
        precedence: 1
      },
      {
        id: 'memory_integration',
        description: 'Integrate advanced memory and learning systems',
        dependencies: ['ai_setup'],
        estimatedTime: '20-25 minutes',
        tools: ['memory_store', 'learning_engine', 'knowledge_base'],
        riskLevel: 'low',
        validation: ['Memory active', 'Learning enabled', 'Knowledge accessible'],
        confidence: 0.9,
        precedence: 2
      },
      {
        id: 'safety_framework',
        description: 'Implement comprehensive AI safety and ethics framework',
        dependencies: ['memory_integration'],
        estimatedTime: '15-20 minutes',
        tools: ['safety_scanner', 'ethics_validator', 'content_moderator'],
        riskLevel: 'high',
        validation: ['Safety active', 'Ethics validated', 'Content filtered'],
        confidence: 0.95,
        precedence: 3
      },
      {
        id: 'performance_optimization',
        description: 'Optimize performance and validate integration',
        dependencies: ['safety_framework'],
        estimatedTime: '10-15 minutes',
        tools: ['performance_optimizer', 'integration_tester', 'benchmark_runner'],
        riskLevel: 'low',
        validation: ['Performance optimized', 'Integration tested', 'Benchmarks passed'],
        confidence: 0.85,
        precedence: 4
      }
    ];
  }

  private getDatabaseStepsWithMemory(pattern?: PlanningPattern): PlanStep[] {
    return [
      {
        id: 'schema_design',
        description: 'Design optimized database schema with learned patterns',
        dependencies: [],
        estimatedTime: '20-25 minutes',
        tools: ['schema_designer', 'pattern_analyzer', 'optimization_engine'],
        riskLevel: 'medium',
        validation: ['Schema designed', 'Patterns applied', 'Performance optimized'],
        confidence: 0.85,
        precedence: 1
      },
      {
        id: 'security_setup',
        description: 'Implement comprehensive database security',
        dependencies: ['schema_design'],
        estimatedTime: '15-20 minutes',
        tools: ['access_controller', 'encryption_manager', 'audit_logger'],
        riskLevel: 'high',
        validation: ['Access controlled', 'Encryption active', 'Auditing enabled'],
        confidence: 0.9,
        precedence: 2
      },
      {
        id: 'backup_strategy',
        description: 'Deploy advanced backup and recovery systems',
        dependencies: ['security_setup'],
        estimatedTime: '15-20 minutes',
        tools: ['backup_manager', 'recovery_tester', 'replication_engine'],
        riskLevel: 'high',
        validation: ['Backups active', 'Recovery tested', 'Replication working'],
        confidence: 0.9,
        precedence: 3
      },
      {
        id: 'monitoring_analytics',
        description: 'Set up performance monitoring and analytics',
        dependencies: ['backup_strategy'],
        estimatedTime: '10-15 minutes',
        tools: ['database_monitor', 'analytics_engine', 'alert_manager'],
        riskLevel: 'low',
        validation: ['Monitoring active', 'Analytics running', 'Alerts configured'],
        confidence: 0.8,
        precedence: 4
      }
    ];
  }

  private getGenericStepsWithMemory(pattern?: PlanningPattern): PlanStep[] {
    return [
      {
        id: 'requirements_analysis',
        description: 'Comprehensive requirements analysis with memory insights',
        dependencies: [],
        estimatedTime: '15-20 minutes',
        tools: ['requirements_analyzer', 'memory_searcher', 'pattern_matcher'],
        riskLevel: 'low',
        validation: ['Requirements clear', 'Patterns identified', 'Memory consulted'],
        confidence: 0.8,
        precedence: 1
      },
      {
        id: 'environment_setup',
        description: 'Environment setup with learned optimizations',
        dependencies: ['requirements_analysis'],
        estimatedTime: '20-25 minutes',
        tools: ['environment_manager', 'dependency_resolver', 'configuration_optimizer'],
        riskLevel: 'medium',
        validation: ['Environment ready', 'Dependencies resolved', 'Configuration optimized'],
        confidence: 0.85,
        precedence: 2
      },
      {
        id: 'implementation',
        description: 'Implementation with memory-guided best practices',
        dependencies: ['environment_setup'],
        estimatedTime: '25-35 minutes',
        tools: ['implementation_engine', 'best_practices_guide', 'quality_checker'],
        riskLevel: 'medium',
        validation: ['Implementation complete', 'Best practices applied', 'Quality verified'],
        confidence: 0.8,
        precedence: 3
      },
      {
        id: 'validation_deployment',
        description: 'Comprehensive validation and deployment',
        dependencies: ['implementation'],
        estimatedTime: '15-20 minutes',
        tools: ['validator', 'deployment_manager', 'health_checker'],
        riskLevel: 'low',
        validation: ['Validation passed', 'Deployment successful', 'Health confirmed'],
        confidence: 0.85,
        precedence: 4
      }
    ];
  }

  private async validatePlanAgainstMemory(plan: Plan, context: AgentContext): Promise<Plan> {
    // Check against historical failures
    const validatedSteps = [];
    
    for (const step of plan.steps) {
      const historicalFailures = this.findHistoricalFailures(step.description);
      
      if (historicalFailures.length > 0) {
        // Add additional validation based on past failures
        step.validation.push(...historicalFailures.map(f => `Avoid: ${f.reason}`));
        step.riskLevel = this.escalateRiskLevel(step.riskLevel);
        step.confidence = Math.max(0.1, step.confidence - 0.1);
      }
      
      validatedSteps.push(step);
    }
    
    return { ...plan, steps: validatedSteps };
  }

  private async optimizePlanWithLearning(plan: Plan, context: AgentContext): Promise<Plan> {
    // Apply learned optimizations
    const optimizedSteps = plan.steps.map(step => {
      const optimizations = this.getStepOptimizations(step.id);
      
      if (optimizations.length > 0) {
        return {
          ...step,
          estimatedTime: this.optimizeTimeEstimate(step.estimatedTime, optimizations),
          tools: [...new Set([...step.tools, ...optimizations.flatMap(o => o.additionalTools || [])])],
          confidence: Math.min(1.0, step.confidence + 0.1)
        };
      }
      
      return step;
    });
    
    return { ...plan, steps: optimizedSteps };
  }

  private async storePlanningExperience(context: AgentContext, plan: Plan): Promise<void> {
    // Store as procedural memory
    await this.storeProceduralMemory(`${plan.title}_procedure`, plan.steps);
    
    // Store domain pattern if successful
    const domainPattern: PlanningPattern = {
      domain: this.extractDomain(context.userRequest),
      successRate: 1.0, // Will be updated based on actual outcomes
      averageTime: this.parseTimeToMinutes(plan.totalEstimatedTime),
      commonSteps: plan.steps.map(s => s.description),
      criticalFactors: plan.steps.filter(s => s.riskLevel === 'high').map(s => s.description),
      riskMitigations: plan.steps.flatMap(s => s.validation)
    };
    
    this.planningPatterns.set(domainPattern.domain, domainPattern);
    
    // Store as semantic memory
    await this.storeSemanticMemory(`planning_pattern_${domainPattern.domain}`, domainPattern);
  }

  private calculatePlanConfidence(plan: Plan, context: AgentContext): number {
    const stepConfidences = plan.steps.map(s => s.confidence);
    const avgStepConfidence = stepConfidences.reduce((sum, c) => sum + c, 0) / stepConfidences.length;
    
    const domainConfidence = this.domainExpertise.get(this.extractDomain(context.userRequest)) || 0.5;
    const memoryBonus = context.memoryContext?.relevantMemories?.length > 0 ? 0.1 : 0;
    
    return Math.min(1.0, (avgStepConfidence * 0.7) + (domainConfidence * 0.2) + memoryBonus);
  }

  private generateEnhancedReasoning(plan: Plan, context: AgentContext): string {
    const memoryStats = this.getMemoryStats();
    const domain = this.extractDomain(context.userRequest);
    const domainExpertise = this.domainExpertise.get(domain) || 0.5;
    
    return `**🎯 Enhanced Memory-Based Strategic Planning**

**Domain Expertise**: ${(domainExpertise * 100).toFixed(1)}% confidence in ${domain} planning
**Memory Utilization**: ${memoryStats.episodicMemory.size} past experiences consulted
**Learning Integration**: Applied patterns from ${memoryStats.semanticMemory.size} successful setups

**Strategic Analysis**:
1. **Memory-Enhanced Requirements**: Leveraged past experiences and learned patterns
2. **Risk-Aware Planning**: Incorporated lessons from ${memoryStats.episodicMemory.size} historical outcomes
3. **Adaptive Step Generation**: Customized approach based on domain expertise
4. **Confidence Optimization**: ${(this.calculatePlanConfidence(plan, context) * 100).toFixed(1)}% confidence through memory validation

**Plan Characteristics**:
- **Complexity**: ${plan.complexity} (${plan.steps.length} steps)
- **Estimated Duration**: ${plan.totalEstimatedTime}
- **Risk Profile**: ${plan.steps.filter(s => s.riskLevel === 'high').length} high-risk steps identified
- **Learning Points**: ${plan.learningPoints.length} opportunities for future improvement

**Memory-Driven Optimizations**:
- Applied successful patterns from similar past setups
- Incorporated risk mitigations from historical failures
- Optimized time estimates based on actual performance data
- Enhanced validation criteria from lessons learned

This memory-integrated approach ensures each plan builds upon accumulated wisdom while adapting to specific requirements.`;
  }

  // Helper methods
  private performBasicAnalysis(userRequest: string): any {
    const domain = this.extractDomain(userRequest);
    const complexity = this.assessBasicComplexity(userRequest);
    
    return {
      domain,
      complexity,
      title: `${domain} setup`,
      description: `Setup plan for ${userRequest}`,
      prerequisites: [],
      successCriteria: []
    };
  }

  private extractDomain(userRequest: string): string {
    const request = userRequest.toLowerCase();
    if (request.includes('trading') || request.includes('bot')) return 'trading';
    if (request.includes('web') || request.includes('scraping')) return 'web_development';
    if (request.includes('ai') || request.includes('model')) return 'data_science';
    if (request.includes('database') || request.includes('data')) return 'database';
    return 'general';
  }

  private assessBasicComplexity(userRequest: string): 'low' | 'medium' | 'high' {
    const complexity = userRequest.split(' ').length;
    if (complexity > 15) return 'high';
    if (complexity > 8) return 'medium';
    return 'low';
  }

  private assessComplexityWithMemory(analysis: any): 'low' | 'medium' | 'high' {
    let baseComplexity = analysis.complexity;
    
    // Adjust based on domain expertise
    const {domainConfidence} = analysis;
    if (domainConfidence > 0.8) {
      // High expertise makes complex things feel simpler
      if (baseComplexity === 'high') baseComplexity = 'medium';
    } else if (domainConfidence < 0.4) {
      // Low expertise makes simple things feel complex
      if (baseComplexity === 'low') baseComplexity = 'medium';
    }
    
    return baseComplexity;
  }

  private isContentSimilar(text1 = '', text2 = ''): boolean {
    const words1 = text1.toLowerCase().split(' ');
    const words2 = text2.toLowerCase().split(' ');
    const overlap = words1.filter(w => words2.includes(w) && w.length > 3).length;
    return overlap >= 2;
  }

  private loadDomainExpertise(): void {
    // Initialize domain expertise from episodic memory
    const domains = ['trading', 'web_development', 'data_science', 'database', 'general'];
    
    for (const domain of domains) {
      const domainEpisodes = this.episodicMemory.filter(ep => 
        ep.context?.domain === domain || this.extractDomain(ep.context?.userRequest || '') === domain
      );
      
      const successRate = domainEpisodes.length > 0 
        ? domainEpisodes.filter(ep => ep.outcome === 'success').length / domainEpisodes.length
        : 0.5;
      
      this.domainExpertise.set(domain, successRate);
    }
  }

  private loadPlanningPatterns(): void {
    // Load patterns from semantic memory
    for (const [concept, knowledge] of this.semanticMemory.entries()) {
      if (concept.startsWith('planning_pattern_')) {
        const domain = concept.replace('planning_pattern_', '');
        this.planningPatterns.set(domain, knowledge.knowledge);
      }
    }
  }

  private enhanceStepsWithPatterns(steps: PlanStep[], patterns: any[]): PlanStep[] {
    return steps.map(step => {
      const relevantPatterns = patterns.filter(p => 
        p.commonElements?.commonKeywords?.some((keyword: string) => 
          step.description.toLowerCase().includes(keyword)
        )
      );
      
      if (relevantPatterns.length > 0) {
        step.confidence = Math.min(1.0, step.confidence + 0.1);
      }
      
      return step;
    });
  }

  private adjustTimeEstimatesFromMemory(steps: PlanStep[], timeEstimates: string[]): PlanStep[] {
    // Simple implementation - can be enhanced with more sophisticated time learning
    return steps.map(step => {
      if (timeEstimates.length > 0) {
        // Slightly optimize time estimates based on historical data
        const currentTime = this.parseTimeRange(step.estimatedTime);
        const adjustedTime = {
          min: Math.max(5, currentTime.min - 2),
          max: Math.max(10, currentTime.max - 2)
        };
        step.estimatedTime = `${adjustedTime.min}-${adjustedTime.max} minutes`;
      }
      return step;
    });
  }

  private addRiskMitigations(steps: PlanStep[], riskFactors: any[]): PlanStep[] {
    return steps.map(step => {
      const relevantRisks = riskFactors.filter(risk => 
        step.description.toLowerCase().includes(risk.context?.split(' ')[0] || '')
      );
      
      if (relevantRisks.length > 0) {
        step.riskLevel = this.escalateRiskLevel(step.riskLevel);
        step.validation.push(...relevantRisks.map(r => `Mitigate: ${r.risk}`));
      }
      
      return step;
    });
  }

  private calculateTotalTime(steps: PlanStep[]): string {
    const totalMinutes = steps.reduce((sum, step) => {
      const timeRange = this.parseTimeRange(step.estimatedTime);
      return sum + ((timeRange.min + timeRange.max) / 2);
    }, 0);
    
    return `${Math.round(totalMinutes)} minutes`;
  }

  private parseTimeRange(timeStr: string): { min: number; max: number } {
    const match = timeStr.match(/(\d+)-(\d+)/);
    if (match) {
      return { min: parseInt(match[1]), max: parseInt(match[2]) };
    }
    return { min: 15, max: 20 }; // Default
  }

  private parseTimeToMinutes(timeStr: string): number {
    const match = timeStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 30;
  }

  private escalateRiskLevel(current: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
    if (current === 'low') return 'medium';
    if (current === 'medium') return 'high';
    return 'high';
  }

  private findHistoricalFailures(stepDescription: string): any[] {
    return this.episodicMemory
      .filter(ep => ep.outcome === 'failure' && 
              ep.context?.userRequest?.toLowerCase().includes(stepDescription.split(' ')[0].toLowerCase()))
      .map(ep => ({ reason: ep.error || 'Unknown failure' }));
  }

  private getStepOptimizations(stepId: string): any[] {
    return this.learningInsights
      .filter(insight => insight.category === 'optimization' && 
              insight.applicability.includes(stepId))
      .map(insight => ({ 
        optimization: insight.insight,
        additionalTools: []
      }));
  }

  private optimizeTimeEstimate(currentTime: string, optimizations: any[]): string {
    if (optimizations.length > 0) {
      const timeRange = this.parseTimeRange(currentTime);
      return `${Math.max(5, timeRange.min - 2)}-${Math.max(10, timeRange.max - 3)} minutes`;
    }
    return currentTime;
  }

  private adjustStepsWithPattern(steps: PlanStep[], pattern: PlanningPattern): PlanStep[] {
    return steps.map(step => ({
      ...step,
      confidence: Math.min(1.0, step.confidence + (pattern.successRate * 0.2)),
      estimatedTime: this.adjustTimeWithPattern(step.estimatedTime, pattern.averageTime)
    }));
  }

  private adjustTimeWithPattern(currentTime: string, patternTime: number): string {
    const timeRange = this.parseTimeRange(currentTime);
    const avgCurrent = (timeRange.min + timeRange.max) / 2;
    const adjustment = (patternTime - avgCurrent) * 0.3; // 30% adjustment factor
    
    return `${Math.max(5, timeRange.min + adjustment)}-${Math.max(10, timeRange.max + adjustment)} minutes`;
  }

  private generatePrerequisites(analysis: any): string[] {
    const prerequisites = ['Basic understanding of the domain'];
    
    if (analysis.domain === 'trading') {
      prerequisites.push('Market data access', 'Risk management knowledge');
    } else if (analysis.domain === 'web_development') {
      prerequisites.push('Target website access', 'Legal compliance check');
    } else if (analysis.domain === 'data_science') {
      prerequisites.push('AI model access', 'Data processing capabilities');
    }
    
    return prerequisites;
  }

  private generateSuccessCriteria(analysis: any): string[] {
    const criteria = ['Setup completed without errors', 'All components functional'];
    
    if (analysis.domain === 'trading') {
      criteria.push('Real-time data flowing', 'Risk controls active');
    } else if (analysis.domain === 'web_development') {
      criteria.push('Data extraction successful', 'Rate limiting respected');
    } else if (analysis.domain === 'data_science') {
      criteria.push('AI models responding', 'Safety measures active');
    }
    
    return criteria;
  }

  private generateRiskAssessment(analysis: any): any {
    return {
      level: analysis.complexity,
      factors: analysis.learnedRiskFactors || [],
      mitigations: ['Regular monitoring', 'Gradual deployment', 'Rollback capability']
    };
  }

  private generateAdaptationStrategy(analysis: any): string {
    return `Adaptive strategy based on ${analysis.domainConfidence > 0.7 ? 'high' : 'medium'} domain expertise with continuous learning integration`;
  }

  private generateLearningPoints(analysis: any): string[] {
    return [
      'Monitor execution times for future optimization',
      'Track success rates for pattern refinement',
      'Identify new risk factors for mitigation database'
    ];
  }

  private getAppliedPatterns(domain: string): string[] {
    const pattern = this.planningPatterns.get(domain);
    return pattern ? pattern.commonSteps.slice(0, 3) : [];
  }

  /**
   * Implement abstract method from BaseAgent
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info(`🎯 Initializing Enhanced Planner Agent`);
    // Additional initialization if needed
  }

  /**
   * Implement abstract method from BaseAgent
   */
  protected async process(context: AgentContext & { memoryContext?: any }): Promise<PartialAgentResponse> {
    // This method is called by BaseAgent's execute method, but we override execute in EnhancedMemoryAgent
    // So this is just a fallback implementation
    return this.executeWithMemory(context);
  }

  /**
   * Implement abstract method from BaseAgent
   */
  protected async onShutdown(): Promise<void> {
    this.logger.info(`🎯 Shutting down Enhanced Planner Agent`);
    // Save planning patterns to persistent storage if needed
    await this.savePlanningPatterns();
  }

  /**
   * Save planning patterns for future sessions
   */
  private async savePlanningPatterns(): Promise<void> {
    // Save patterns to persistent storage
    for (const [domain, pattern] of this.planningPatterns.entries()) {
      await this.storeSemanticMemory(`planning_pattern_${domain}`, pattern);
    }
  }
}

export default EnhancedPlannerAgent;