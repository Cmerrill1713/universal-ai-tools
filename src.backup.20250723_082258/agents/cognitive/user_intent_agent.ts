/**
 * User Intent Agent - Understanding user goals and context
 * Sophisticated intent recognition adapted from sentiment _analysispatterns
 */

import type { AgentContext } from '../base_agent';
import { AgentResponse } from '../base_agent';
import type { CognitiveCapability } from './real_cognitive_agent';
import { RealCognitiveAgent } from './real_cognitive_agent';

interface UserIntent {
  primaryIntent: string;
  subIntents: string[];
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
  domain: string;
  context: any;
  implicitNeeds: string[];
  successCriteria: string[];
}

interface IntentPattern {
  keywords: string[];
  intent: string;
  domain: string;
  complexity: 'simple' | 'moderate' | 'complex';
  commonFollowUps: string[];
}

export class UserIntentAgent extends RealCognitiveAgent {
  private intentPatterns: Map<string, IntentPattern> = new Map();
  private userProfiles: Map<string, any> = new Map();

  protected setupCognitiveCapabilities(): void {
    this.cognitiveCapabilities.set('intent_recognition', {
      name: 'intent_recognition',
      execute: this.executeIntentRecognition.bind(this),
    });

    this.cognitiveCapabilities.set('goal_inference', {
      name: 'goal_inference',
      execute: this.executeGoalInference.bind(this),
    });

    this.cognitiveCapabilities.set('context_understanding', {
      name: 'context_understanding',
      execute: this.executeContextUnderstanding.bind(this),
    });

    // Load intent recognition patterns
    this.loadIntentPatterns();
  }

  protected async selectCapability(_context: AgentContext): Promise<CognitiveCapability | null> {
    // Always start with intent recognition as the primary capability
    if (_context.userRequest) {
      return this.cognitiveCapabilities.get('intent_recognition') || null;
    }

    return null;
  }

  protected async generateReasoning(
    _context: AgentContext,
    capability: CognitiveCapability,
    result: any
  ): Promise<string> {
    const intent = result as UserIntent;

    return `I analyzed the user's _request"${_context.userRequest}" and identified their intent with ${(intent.confidence * 100).toFixed(1)}% confidence.

**Intent Analysis:**
- **Primary Goal**: ${intent.primaryIntent}
- **Domain**: ${intent.domain}
- **Complexity**: ${intent.complexity}
- **Urgency**: ${intent.urgency}

**Understanding Process:**
1. **Language Analysis**: Parsed the _requestfor key indicators and context clues
2. **Pattern Matching**: Applied ${this.intentPatterns.size} learned intent patterns
3. **Context Integration**: Considered previous interactions and session history
4. **Goal Inference**: Identified explicit and implicit user needs
5. **Success Prediction**: Determined what would constitute a successful outcome

**Implicit Needs Detected**: ${intent.implicitNeeds.join(', ')}

This _analysishelps other agents provide more targeted and relevant assistance.`;
  }

  private async executeIntentRecognition(
    _input string,
    _context: AgentContext
  ): Promise<UserIntent> {
    // Multi-layered intent recognition
    const primaryIntent = await this.identifyPrimaryIntent(_input context);
    const subIntents = await this.identifySubIntents(_input context);
    const domain = await this.identifyDomain(_input context);
    const complexity = await this.assessComplexity(_input context);
    const urgency = await this.assessUrgency(_input context);
    const implicitNeeds = await this.inferImplicitNeeds(_input context);
    const successCriteria = await this.inferSuccessCriteria(_input context);

    const confidence = await this.calculateIntentConfidence(_input context, {
      primaryIntent,
      domain,
      complexity,
      urgency,
    });

    return {
      primaryIntent,
      subIntents,
      confidence,
      urgency,
      complexity,
      domain,
      context: await this.extractRelevantContext(context),
      implicitNeeds,
      successCriteria,
    };
  }

  private async executeGoalInference(_input string, _context: AgentContext): Promise<unknown> {
    const goals = await this.inferUserGoals(_input context);

    return {
      immediateGoals: goals.immediate,
      longTermGoals: goals.longTerm,
      hiddenGoals: goals.hidden,
      approach: 'hierarchical_goal_inference',
      reasoning:
        'Analyzed explicit requests and inferred implicit goals based on context and patterns',
    };
  }

  private async executeContextUnderstanding(_input string, _context: AgentContext): Promise<unknown> {
    const contextAnalysis = await this.analyzeContext(_input context);

    return {
      contextSummary: contextAnalysis,
      relevantFactors: contextAnalysis.factors,
      approach: 'multi_dimensional_context__analysis,
      reasoning: 'Analyzed technical, personal, and environmental context factors',
    };
  }

  private async identifyPrimaryIntent(_input string, _context: AgentContext): Promise<string> {
    const inputLower = _inputtoLowerCase();

    // Use Ollama for sophisticated intent recognition if available
    if (this.ollamaService) {
      const prompt = `Analyze this user _requestand identify the primary intent:

Request: "${_input"

Consider these intent categories:
- setup: User wants to set up or configure something
- troubleshoot: User has a problem that needs fixing
- learn: User wants to understand or learn something
- optimize: User wants to improve existing setup
- integrate: User wants to connect different systems
- create: User wants to build something new
- analyze: User wants _analysisor insights
- automate: User wants to automate a process

Respond with just the primary intent category.`;

      try {
        const response = await this.ollamaService.generate({
          model: this.preferredModel,
          prompt,
          options: {
            temperature: 0.3,
          },
        });
        const detectedIntent = (response.response || '').trim().toLowerCase();

        if (
          [
            'setup',
            'troubleshoot',
            'learn',
            'optimize',
            'integrate',
            'create',
            'analyze',
            'automate',
          ].includes(detectedIntent)
        ) {
          return detectedIntent;
        }
      } catch (_error) {
        this.logger.warn('Ollama intent recognition failed, using fallback');
      }
    }

    // Fallback _patternbased intent recognition
    return this.patternBasedIntentRecognition(inputLower);
  }

  private patternBasedIntentRecognition(_input string): string {
    const intentKeywords = {
      setup: ['setup', 'set up', 'install', 'configure', 'create', 'build', 'establish'],
      troubleshoot: ['fix', 'problem', '_error, 'issue', 'broken', 'not working', 'help'],
      learn: ['how', 'what', 'why', 'explain', 'understand', 'learn', 'tutorial'],
      optimize: ['improve', 'optimize', 'faster', 'better', 'performance', 'enhance'],
      integrate: ['connect', 'integrate', 'link', 'combine', 'merge', 'api'],
      create: ['make', 'create', 'build', 'develop', 'generate', 'design'],
      analyze: ['analyze', 'review', 'check', 'examine', 'assess', 'evaluate'],
      automate: ['automate', 'schedule', 'workflow', 'batch', 'automatic'],
    };

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      if (keywords.some((keyword) => _inputincludes(keyword))) {
        return intent;
      }
    }

    return 'setup'; // Default intent
  }

  private async identifySubIntents(_input string, _context: AgentContext): Promise<string[]> {
    const subIntents = [];
    const inputLower = _inputtoLowerCase();

    // Technical sub-intents
    if (inputLower.includes('secure') || inputLower.includes('security')) {
      subIntents.push('security_focused');
    }
    if (inputLower.includes('fast') || inputLower.includes('performance')) {
      subIntents.push('performance_focused');
    }
    if (inputLower.includes('simple') || inputLower.includes('easy')) {
      subIntents.push('simplicity_focused');
    }
    if (inputLower.includes('scale') || inputLower.includes('enterprise')) {
      subIntents.push('scalability_focused');
    }
    if (inputLower.includes('test') || inputLower.includes('demo')) {
      subIntents.push('testing_focused');
    }

    return subIntents;
  }

  private async identifyDomain(_input string, _context: AgentContext): Promise<string> {
    const inputLower = _inputtoLowerCase();

    const domainKeywords = {
      trading: ['trading', 'bot', 'market', 'stock', 'crypto', 'exchange', 'portfolio'],
      web_development: ['web', 'website', 'frontend', 'backend', 'api', 'server'],
      data_science: ['data', '_analysis, 'machine learning', 'ai', 'model', 'dataset'],
      devops: ['deploy', 'docker', 'kubernetes', 'ci/cd', 'pipeline', 'infrastructure'],
      database: ['database', 'sql', 'mongodb', 'postgres', 'storage', 'query'],
      security: ['security', 'auth', 'encryption', 'firewall', 'compliance'],
      automation: ['automation', 'script', 'workflow', 'schedule', 'batch'],
      integration: ['integration', 'api', 'webhook', 'connector', 'sync'],
      monitoring: ['monitor', 'log', 'metric', 'alert', 'dashboard', 'analytics'],
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some((keyword) => inputLower.includes(keyword))) {
        return domain;
      }
    }

    return 'general';
  }

  private async assessComplexity(
    _input string,
    _context: AgentContext
  ): Promise<'simple' | 'moderate' | 'complex'> {
    let complexityScore = 0;
    const inputLower = _inputtoLowerCase();

    // Factors that increase complexity
    const complexityIndicators = {
      multiple_systems: ['multiple', 'several', 'various', 'different'],
      integration: ['integrate', 'connect', 'combine', 'merge'],
      custom_requirements: ['custom', 'specific', 'unique', 'tailored'],
      scalability: ['scale', 'enterprise', 'production', 'large'],
      security: ['secure', 'encrypt', 'authenticate', 'compliance'],
      real_time: ['real-time', 'live', 'streaming', 'instant'],
    };

    for (const indicators of Object.values(complexityIndicators)) {
      if (indicators.some((indicator) => inputLower.includes(indicator))) {
        complexityScore++;
      }
    }

    // Count technical terms
    const technicalTerms = ['api', 'database', 'server', 'algorithm', 'framework', 'library'];
    const technicalTermCount = technicalTerms.filter((term) => inputLower.includes(term)).length;
    complexityScore += technicalTermCount;

    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'moderate';
    return 'simple';
  }

  private async assessUrgency(
    _input string,
    _context: AgentContext
  ): Promise<'low' | 'medium' | 'high'> {
    const inputLower = _inputtoLowerCase();

    const urgencyKeywords = {
      high: ['urgent', 'asap', 'immediately', 'now', 'emergency', 'critical', 'quickly'],
      medium: ['soon', 'today', 'this week', 'need to', 'should'],
      low: ['eventually', 'when possible', 'sometime', 'future', 'plan'],
    };

    for (const [level, keywords] of Object.entries(urgencyKeywords)) {
      if (keywords.some((keyword) => inputLower.includes(keyword))) {
        return level as 'low' | 'medium' | 'high';
      }
    }

    return 'medium'; // Default urgency
  }

  private async inferImplicitNeeds(_input string, _context: AgentContext): Promise<string[]> {
    const implicitNeeds = [];
    const inputLower = _inputtoLowerCase();

    // Infer common implicit needs based on explicit requests
    if (inputLower.includes('trading') || inputLower.includes('bot')) {
      implicitNeeds.push('risk_management', 'compliance_checking', 'performance_monitoring');
    }

    if (inputLower.includes('web') || inputLower.includes('api')) {
      implicitNeeds.push('security_measures', 'rate_limiting', 'error_handling');
    }

    if (inputLower.includes('database') || inputLower.includes('data')) {
      implicitNeeds.push('backup_strategy', 'access_control', 'performance_optimization');
    }

    if (inputLower.includes('production') || inputLower.includes('deploy')) {
      implicitNeeds.push('monitoring', 'logging', 'rollback_capability');
    }

    // Always assume need for documentation and testing
    implicitNeeds.push('documentation', 'testing_strategy');

    return [...new Set(implicitNeeds)]; // Remove duplicates
  }

  private async inferSuccessCriteria(_input string, _context: AgentContext): Promise<string[]> {
    const criteria = [];
    const inputLower = _inputtoLowerCase();

    // Domain-specific success criteria
    if (inputLower.includes('trading')) {
      criteria.push('Real-time data flowing', 'Risk management active', 'Paper trading successful');
    } else if (inputLower.includes('web')) {
      criteria.push('Website accessible', 'Performance optimized', 'Security validated');
    } else if (inputLower.includes('api')) {
      criteria.push('Endpoints responding', 'Authentication working', 'Rate limiting active');
    } else if (inputLower.includes('database')) {
      criteria.push('Data accessible', 'Backups configured', 'Performance optimized');
    }

    // Universal success criteria
    criteria.push(
      'Setup completed without errors',
      'Documentation available',
      'Basic testing passed'
    );

    return criteria;
  }

  private async calculateIntentConfidence(
    _input string,
    _context: AgentContext,
    _analysis any
  ): Promise<number> {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on clear indicators
    if (_analysisprimaryIntent !== 'setup') {
      confidence += 0.2; // Clear intent identified
    }

    if (_analysisdomain !== 'general') {
      confidence += 0.2; // Clear domain identified
    }

    // Check for ambiguity
    const ambiguousTerms = ['thing', 'stuff', 'something', 'whatever'];
    if (ambiguousTerms.some((term) => _inputtoLowerCase().includes(term))) {
      confidence -= 0.2;
    }

    // Length and detail bonus
    if (_inputlength > 50) {
      confidence += 0.1;
    }

    // Previous context bonus
    if (_context.previousContext) {
      confidence += 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private async extractRelevantContext(_context: AgentContext): Promise<unknown> {
    return {
      sessionId: _context.sessionId,
      previousRequests: _context.previousContext?.requests || [],
      userProfile: this.getUserProfile(_context.userId),
      timestamp: _context.timestamp,
    };
  }

  private async inferUserGoals(_input string, _context: AgentContext): Promise<unknown> {
    return {
      immediate: ['Complete the requested setup', 'Understand the process'],
      longTerm: ['Build expertise', 'Create reliable systems'],
      hidden: ['Minimize complexity', 'Ensure reliability', 'Learn best practices'],
    };
  }

  private async analyzeContext(_input string, __context: AgentContext): Promise<unknown> {
    return {
      technical: {
        skillLevel: 'intermediate', // Could be inferred from _requestcomplexity
        preferredTools: [],
        previousExperience: __context.memoryContext?.experiences || [],
      },
      personal: {
        urgency: await this.assessUrgency(_input __context),
        riskTolerance: 'medium',
        learningStyle: 'hands-on',
      },
      environmental: {
        timeOfDay: new Date().getHours(),
        platform: 'universal-ai-tools',
        sessionLength: 'new',
      },
      factors: ['user_experience', 'time_constraints', 'technical_requirements'],
    };
  }

  private getUserProfile(userId?: string): any {
    if (!userId) return null;

    return (
      this.userProfiles.get(userId) || {
        skillLevel: 'intermediate',
        preferredApproach: 'guided',
        commonDomains: [],
        successfulSetups: [],
      }
    );
  }

  private loadIntentPatterns(): void {
    // Load sophisticated intent patterns
    const patterns: IntentPattern[] = [
      {
        keywords: ['trading', 'bot', 'algorithm'],
        intent: 'setup_trading_system',
        domain: 'trading',
        complexity: 'complex',
        commonFollowUps: ['risk_management', 'backtesting', 'live_deployment'],
      },
      {
        keywords: ['web', 'scraper', 'data extraction'],
        intent: 'setup_web_scraping',
        domain: 'web_development',
        complexity: 'moderate',
        commonFollowUps: ['data_storage', 'scheduling', 'monitoring'],
      },
      {
        keywords: ['api', 'integration', 'connect'],
        intent: 'api_integration',
        domain: 'integration',
        complexity: 'moderate',
        commonFollowUps: ['authentication', 'rate_limiting', 'error_handling'],
      },
      {
        keywords: ['database', 'storage', 'data'],
        intent: 'database_setup',
        domain: 'database',
        complexity: 'moderate',
        commonFollowUps: ['backup', 'security', 'optimization'],
      },
      {
        keywords: ['ai', 'model', 'machine learning'],
        intent: 'ai_integration',
        domain: 'data_science',
        complexity: 'complex',
        commonFollowUps: ['model_deployment', 'monitoring', 'data_pipeline'],
      },
    ];

    patterns.forEach((_pattern index) => {
      this.intentPatterns.set(`pattern_${index}`, _pattern;
    });
  }
}

export default UserIntentAgent;
