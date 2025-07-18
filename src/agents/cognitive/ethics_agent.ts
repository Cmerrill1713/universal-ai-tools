/**
 * Ethics Agent - Validates safety and ethical implications of AI responses
 * Ensures responsible AI behavior through comprehensive ethics checking
 */

import type { AgentConfig, AgentContext, PartialAgentResponse } from '../base_agent';
import { AgentResponse } from '../base_agent';
import { EnhancedMemoryAgent } from '../enhanced_memory_agent';

interface EthicsCheck {
  category: 'harm_prevention' | 'bias_detection' | 'privacy' | 'transparency' | 'fairness' | 'compliance';
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  issue?: string;
  recommendation?: string;
  confidence: number;
}

interface EthicsAssessment {
  id: string;
  overallScore: number;
  safetyRating: 'safe' | 'caution' | 'unsafe';
  checks: EthicsCheck[];
  violations: {
    category: string;
    description: string;
    severity: string;
    mitigation: string;
  }[];
  recommendations: string[];
  compliance: {
    standard: string;
    compliant: boolean;
    notes: string;
  }[];
  metadata: {
    assessmentTime: number;
    checksPerformed: number;
    violationsFound: number;
    confidenceLevel: number;
  };
}

interface EthicalGuideline {
  id: string;
  category: string;
  rule: string;
  examples: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class EthicsAgent extends EnhancedMemoryAgent {
  private ethicalGuidelines: Map<string, EthicalGuideline> = new Map();
  private violationPatterns: Map<string, any> = new Map();
  private complianceStandards: Set<string> = new Set(['GDPR', 'CCPA', 'AI Ethics', 'Content Policy']);

  constructor(config?: Partial<AgentConfig>) {
    super({
      name: 'ethics',
      description: 'Validates ethical implications and ensures AI safety',
      priority: 10, // Highest priority for safety
      capabilities: [
        {
          name: 'safety_validation',
          description: 'Validate safety of AI responses and actions',
          inputSchema: {},
          outputSchema: {}
        },
        {
          name: 'bias_detection',
          description: 'Detect and mitigate biases in AI outputs',
          inputSchema: {},
          outputSchema: {}
        },
        {
          name: 'harm_prevention',
          description: 'Prevent potential harm from AI recommendations',
          inputSchema: {},
          outputSchema: {}
        },
        {
          name: 'compliance_checking',
          description: 'Ensure compliance with ethical standards and regulations',
          inputSchema: {},
          outputSchema: {}
        }
      ],
      maxLatencyMs: 10000,
      retryAttempts: 3,
      dependencies: [],
      memoryEnabled: true,
      ...config,
      memoryConfig: {
        workingMemorySize: 80,
        episodicMemoryLimit: 1500,
        enableLearning: true,
        enableKnowledgeSharing: true,
        ...config?.memoryConfig
      }
    });

    this.initializeEthicsFramework();
  }

  private initializeEthicsFramework(): void {
    // Load ethical guidelines
    this.loadEthicalGuidelines();
    
    // Load violation patterns from memory
    this.loadViolationPatterns();
    
    // Initialize compliance checks
    this.initializeComplianceFramework();
    
    this.logger.info('⚖️ Ethics Agent initialized with comprehensive safety framework');
  }

  protected async executeWithMemory(context: AgentContext): Promise<PartialAgentResponse> {
    const startTime = Date.now();
    
    try {
      // Extract content to evaluate
      const contentToEvaluate = this.extractContentForEvaluation(context);
      
      // Perform comprehensive ethics assessment
      const assessment = await this.performEthicsAssessment(contentToEvaluate, context);
      
      // Check against historical violations
      const historicalCheck = await this.checkHistoricalViolations(assessment, context);
      
      // Apply memory-based improvements
      const improvedAssessment = await this.applyMemoryBasedImprovements(historicalCheck);
      
      // Generate recommendations
      const finalAssessment = await this.generateEthicalRecommendations(improvedAssessment, context);
      
      // Store ethics experience
      await this.storeEthicsExperience(context, finalAssessment);
      
      const response: PartialAgentResponse = {
        success: true,
        data: finalAssessment,
        confidence: finalAssessment.metadata.confidenceLevel,
        message: this.generateEthicsMessage(finalAssessment),
        reasoning: this.generateEthicsReasoning(finalAssessment),
        metadata: {
          ethicsScore: finalAssessment.overallScore,
          safetyRating: finalAssessment.safetyRating,
          checksPerformed: finalAssessment.metadata.checksPerformed,
          violationsFound: finalAssessment.metadata.violationsFound,
          processingTime: Date.now() - startTime
        }
      };
      
      return response;

    } catch (error) {
      this.logger.error('Ethics assessment failed:', error);
      throw error;
    }
  }

  private extractContentForEvaluation(context: AgentContext): any {
    const content = {
      userRequest: context.userRequest,
      agentResponses: context.metadata?.agentOutputs || {},
      proposedActions: context.metadata?.proposedActions || [],
      dataAccess: context.metadata?.dataAccess || [],
      targetAudience: context.metadata?.targetAudience || 'general'
    };
    
    return content;
  }

  private async performEthicsAssessment(content: any, context: AgentContext): Promise<EthicsAssessment> {
    const assessmentId = `ethics_${Date.now()}`;
    const checks: EthicsCheck[] = [];
    
    // Harm prevention check
    checks.push(await this.checkHarmPrevention(content));
    
    // Bias detection
    checks.push(await this.checkBiasDetection(content));
    
    // Privacy protection
    checks.push(await this.checkPrivacyProtection(content));
    
    // Transparency requirements
    checks.push(await this.checkTransparency(content));
    
    // Fairness assessment
    checks.push(await this.checkFairness(content));
    
    // Compliance verification
    checks.push(await this.checkCompliance(content));
    
    // Calculate overall score
    const overallScore = this.calculateOverallEthicsScore(checks);
    const safetyRating = this.determineSafetyRating(checks);
    
    // Identify violations
    const violations = this.identifyViolations(checks);
    
    return {
      id: assessmentId,
      overallScore,
      safetyRating,
      checks,
      violations,
      recommendations: [], // Will be filled later
      compliance: this.assessCompliance(checks, content),
      metadata: {
        assessmentTime: Date.now(),
        checksPerformed: checks.length,
        violationsFound: violations.length,
        confidenceLevel: this.calculateConfidenceLevel(checks)
      }
    };
  }

  private async checkHarmPrevention(content: any): Promise<EthicsCheck> {
    const harmfulPatterns = [
      'violence', 'self-harm', 'illegal', 'dangerous', 'weapon',
      'exploit', 'abuse', 'harassment', 'discrimination'
    ];
    
    const contentStr = JSON.stringify(content).toLowerCase();
    const detectedHarms = harmfulPatterns.filter(pattern => contentStr.includes(pattern));
    
    if (detectedHarms.length > 0) {
      return {
        category: 'harm_prevention',
        passed: false,
        severity: detectedHarms.length > 2 ? 'critical' : 'high',
        issue: `Potential harmful content detected: ${detectedHarms.join(', ')}`,
        recommendation: 'Remove or rephrase content to eliminate harmful implications',
        confidence: 0.9
      };
    }
    
    // Check for indirect harm
    const indirectHarmRisk = this.assessIndirectHarm(content);
    if (indirectHarmRisk > 0.3) {
      return {
        category: 'harm_prevention',
        passed: false,
        severity: 'medium',
        issue: 'Potential for indirect harm identified',
        recommendation: 'Add safety disclaimers and clarify limitations',
        confidence: 0.7
      };
    }
    
    return {
      category: 'harm_prevention',
      passed: true,
      severity: 'low',
      confidence: 0.95
    };
  }

  private async checkBiasDetection(content: any): Promise<EthicsCheck> {
    const biasIndicators = [
      { pattern: /\b(all|every|always|never)\s+\w+s?\b/gi, type: 'generalization' },
      { pattern: /\b(male|female|man|woman)\s+\w+\b/gi, type: 'gender' },
      { pattern: /\b(young|old|elderly)\s+\w+\b/gi, type: 'age' },
      { pattern: /\b(race|ethnicity|nationality)\b/gi, type: 'demographic' }
    ];
    
    const contentStr = JSON.stringify(content);
    const detectedBiases = [];
    
    for (const indicator of biasIndicators) {
      const matches = contentStr.match(indicator.pattern);
      if (matches) {
        detectedBiases.push({
          type: indicator.type,
          instances: matches.length
        });
      }
    }
    
    if (detectedBiases.length > 0) {
      const severity = detectedBiases.reduce((sum, b) => sum + b.instances, 0) > 3 ? 'high' : 'medium';
      return {
        category: 'bias_detection',
        passed: false,
        severity,
        issue: `Potential biases detected: ${detectedBiases.map(b => b.type).join(', ')}`,
        recommendation: 'Review and neutralize language to avoid stereotypes and generalizations',
        confidence: 0.8
      };
    }
    
    return {
      category: 'bias_detection',
      passed: true,
      severity: 'low',
      confidence: 0.85
    };
  }

  private async checkPrivacyProtection(content: any): Promise<EthicsCheck> {
    const privacyPatterns = [
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/, type: 'SSN' },
      { pattern: /\b\d{16}\b/, type: 'credit_card' },
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'email' },
      { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: 'phone' },
      { pattern: /\b(?:password|api[_-]?key|secret)\s*[:=]\s*\S+/i, type: 'credentials' }
    ];
    
    const contentStr = JSON.stringify(content);
    const privacyViolations = [];
    
    for (const privacyPattern of privacyPatterns) {
      if (privacyPattern.pattern.test(contentStr)) {
        privacyViolations.push(privacyPattern.type);
      }
    }
    
    // Check data access permissions
    if (content.dataAccess && content.dataAccess.length > 0) {
      const sensitiveAccess = content.dataAccess.filter((d: string) => 
        d.includes('personal') || d.includes('private') || d.includes('sensitive')
      );
      if (sensitiveAccess.length > 0) {
        privacyViolations.push('sensitive_data_access');
      }
    }
    
    if (privacyViolations.length > 0) {
      return {
        category: 'privacy',
        passed: false,
        severity: privacyViolations.includes('credentials') ? 'critical' : 'high',
        issue: `Privacy concerns detected: ${privacyViolations.join(', ')}`,
        recommendation: 'Remove or mask sensitive information; implement proper data protection',
        confidence: 0.95
      };
    }
    
    return {
      category: 'privacy',
      passed: true,
      severity: 'low',
      confidence: 0.9
    };
  }

  private async checkTransparency(content: any): Promise<EthicsCheck> {
    const transparencyRequirements = [
      'AI-generated content should be disclosed',
      'Limitations should be clearly stated',
      'Data sources should be cited',
      'Uncertainty should be expressed'
    ];
    
    const contentStr = JSON.stringify(content).toLowerCase();
    const missingTransparency = [];
    
    // Check for AI disclosure
    if (!contentStr.includes('ai') && !contentStr.includes('automated') && !contentStr.includes('generated')) {
      missingTransparency.push('AI disclosure');
    }
    
    // Check for limitations
    if (!contentStr.includes('limitation') && !contentStr.includes('may not') && !contentStr.includes('might not')) {
      missingTransparency.push('Limitations statement');
    }
    
    // Check for citations
    if (content.agentResponses && Object.keys(content.agentResponses).length > 0) {
      const hasCitations = Object.values(content.agentResponses).some(r => 
        JSON.stringify(r).includes('source') || JSON.stringify(r).includes('reference')
      );
      if (!hasCitations) {
        missingTransparency.push('Source citations');
      }
    }
    
    if (missingTransparency.length > 0) {
      return {
        category: 'transparency',
        passed: false,
        severity: 'medium',
        issue: `Transparency requirements not met: ${missingTransparency.join(', ')}`,
        recommendation: 'Add appropriate disclosures and citations',
        confidence: 0.8
      };
    }
    
    return {
      category: 'transparency',
      passed: true,
      severity: 'low',
      confidence: 0.85
    };
  }

  private async checkFairness(content: any): Promise<EthicsCheck> {
    // Check for equal treatment and accessibility
    const fairnessIssues = [];
    
    // Check for exclusionary language
    const exclusionaryPatterns = [
      'only for', 'exclusive to', 'restricted to', 'not available for'
    ];
    
    const contentStr = JSON.stringify(content).toLowerCase();
    const hasExclusions = exclusionaryPatterns.some(pattern => contentStr.includes(pattern));
    
    if (hasExclusions) {
      fairnessIssues.push('Potentially exclusionary language');
    }
    
    // Check for accessibility considerations
    if (content.targetAudience && !contentStr.includes('accessible') && !contentStr.includes('accommodation')) {
      fairnessIssues.push('Missing accessibility considerations');
    }
    
    // Check for equal opportunity
    if (content.proposedActions && content.proposedActions.length > 0) {
      const hasEqualAccess = content.proposedActions.every((action: string) => 
        !action.includes('restrict') && !action.includes('limit')
      );
      if (!hasEqualAccess) {
        fairnessIssues.push('Unequal access to features or services');
      }
    }
    
    if (fairnessIssues.length > 0) {
      return {
        category: 'fairness',
        passed: false,
        severity: 'medium',
        issue: `Fairness concerns: ${fairnessIssues.join(', ')}`,
        recommendation: 'Ensure equal access and consider diverse user needs',
        confidence: 0.75
      };
    }
    
    return {
      category: 'fairness',
      passed: true,
      severity: 'low',
      confidence: 0.8
    };
  }

  private async checkCompliance(content: any): Promise<EthicsCheck> {
    const complianceIssues = [];
    
    // Check GDPR compliance (if applicable)
    if (content.dataAccess && content.dataAccess.length > 0) {
      const hasConsent = JSON.stringify(content).toLowerCase().includes('consent');
      const hasOptOut = JSON.stringify(content).toLowerCase().includes('opt-out');
      
      if (!hasConsent) {
        complianceIssues.push('Missing user consent for data processing');
      }
      if (!hasOptOut) {
        complianceIssues.push('Missing opt-out mechanism');
      }
    }
    
    // Check content policy compliance
    const prohibitedContent = ['adult content', 'gambling', 'medical advice', 'legal advice'];
    const contentStr = JSON.stringify(content).toLowerCase();
    
    for (const prohibited of prohibitedContent) {
      if (contentStr.includes(prohibited)) {
        complianceIssues.push(`Potential ${prohibited} detected`);
      }
    }
    
    if (complianceIssues.length > 0) {
      return {
        category: 'compliance',
        passed: false,
        severity: complianceIssues.length > 2 ? 'high' : 'medium',
        issue: `Compliance issues: ${complianceIssues.join(', ')}`,
        recommendation: 'Address compliance requirements before proceeding',
        confidence: 0.85
      };
    }
    
    return {
      category: 'compliance',
      passed: true,
      severity: 'low',
      confidence: 0.9
    };
  }

  private async checkHistoricalViolations(assessment: EthicsAssessment, context: AgentContext): Promise<EthicsAssessment> {
    // Check if similar content has had violations before
    const similarViolations = this.episodicMemory
      .filter(ep => 
        ep.context?.userRequest && 
        this.isSimilarContext(ep.context.userRequest, context.userRequest) &&
        ep.response?.data?.violations?.length > 0
      )
      .map(ep => ep.response?.data?.violations)
      .flat();
    
    if (similarViolations.length > 0) {
      // Add historical context to assessment
      assessment.violations.push(...similarViolations.map(v => ({
        category: 'historical',
        description: `Previously identified: ${v.description}`,
        severity: 'medium',
        mitigation: v.mitigation
      })));
      
      // Adjust confidence based on historical patterns
      assessment.metadata.confidenceLevel = Math.min(
        1.0, 
        assessment.metadata.confidenceLevel + 0.1
      );
    }
    
    return assessment;
  }

  private async applyMemoryBasedImprovements(assessment: EthicsAssessment): Promise<EthicsAssessment> {
    // Apply learned improvements from memory
    const improvements = this.learningInsights
      .filter(insight => insight.category === 'ethics_improvement')
      .map(insight => insight.insight);
    
    if (improvements.length > 0) {
      assessment.recommendations.push(...improvements.slice(0, 3));
    }
    
    // Check for successful mitigation patterns
    const mitigationPatterns = this.semanticMemory.get('successful_ethics_mitigations');
    if (mitigationPatterns) {
      for (const violation of assessment.violations) {
        const pattern = mitigationPatterns.knowledge[violation.category];
        if (pattern) {
          violation.mitigation = pattern.bestPractice || violation.mitigation;
        }
      }
    }
    
    return assessment;
  }

  private async generateEthicalRecommendations(assessment: EthicsAssessment, context: AgentContext): Promise<EthicsAssessment> {
    const recommendations = [...assessment.recommendations];
    
    // General recommendations based on score
    if (assessment.overallScore < 0.7) {
      recommendations.push('Consider comprehensive review by ethics committee');
    }
    
    if (assessment.overallScore < 0.9) {
      recommendations.push('Implement additional safeguards before deployment');
    }
    
    // Specific recommendations for each failed check
    for (const check of assessment.checks) {
      if (!check.passed && check.recommendation) {
        recommendations.push(check.recommendation);
      }
    }
    
    // Context-specific recommendations
    if (context.metadata?.deployment === 'production') {
      recommendations.push('Conduct thorough testing in staging environment first');
      recommendations.push('Implement gradual rollout with monitoring');
    }
    
    // Add proactive recommendations
    if (assessment.safetyRating === 'caution') {
      recommendations.push('Set up continuous monitoring for ethical compliance');
      recommendations.push('Establish clear escalation procedures');
    }
    
    return {
      ...assessment,
      recommendations: Array.from(new Set(recommendations)) // Remove duplicates
    };
  }

  private async storeEthicsExperience(context: AgentContext, assessment: EthicsAssessment): Promise<void> {
    // Store violation patterns for future detection
    for (const violation of assessment.violations) {
      const patternKey = `violation_${violation.category}`;
      const existingPattern = this.violationPatterns.get(patternKey) || {
        count: 0,
        examples: [],
        mitigations: []
      };
      
      existingPattern.count++;
      existingPattern.examples.push(violation.description);
      existingPattern.mitigations.push(violation.mitigation);
      
      this.violationPatterns.set(patternKey, existingPattern);
    }
    
    // Store successful assessments as positive examples
    if (assessment.overallScore > 0.9) {
      await this.storeSemanticMemory(
        `ethics_success_${assessment.id}`,
        {
          context: context.userRequest,
          checks: assessment.checks.filter(c => c.passed),
          score: assessment.overallScore
        }
      );
    }
    
    // Learn from critical violations
    if (assessment.violations.some(v => v.severity === 'critical')) {
      await this.addLearningInsight({
        category: 'ethics_improvement',
        insight: 'Critical violations require immediate remediation',
        confidence: 1.0,
        applicability: ['all']
      });
    }
  }

  private generateEthicsMessage(assessment: EthicsAssessment): string {
    if (assessment.safetyRating === 'safe') {
      return `Ethics assessment passed with score ${(assessment.overallScore * 100).toFixed(1)}%`;
    } else if (assessment.safetyRating === 'caution') {
      return `Ethics assessment requires caution: ${assessment.violations.length} concerns identified`;
    } else {
      return `Ethics assessment failed: ${assessment.violations.length} violations found`;
    }
  }

  private generateEthicsReasoning(assessment: EthicsAssessment): string {
    return `**⚖️ Comprehensive Ethics Assessment**

**Overall Ethics Score**: ${(assessment.overallScore * 100).toFixed(1)}%
**Safety Rating**: ${assessment.safetyRating.toUpperCase()}
**Confidence Level**: ${(assessment.metadata.confidenceLevel * 100).toFixed(1)}%

**Ethics Checks Performed** (${assessment.metadata.checksPerformed}):
${assessment.checks.map(check => 
  `- **${this.formatCategory(check.category)}**: ${check.passed ? '✅ Passed' : '❌ Failed'} ${
    check.issue ? `\n  Issue: ${check.issue}` : ''
  }`
).join('\n')}

**Violations Found** (${assessment.metadata.violationsFound}):
${assessment.violations.length > 0 ? 
  assessment.violations.map(v => 
    `- **${v.category}** (${v.severity}): ${v.description}\n  Mitigation: ${v.mitigation}`
  ).join('\n') : 
  '- No violations detected'}

**Compliance Status**:
${assessment.compliance.map(c => 
  `- **${c.standard}**: ${c.compliant ? '✅ Compliant' : '❌ Non-compliant'} - ${c.notes}`
).join('\n')}

**Recommendations** (${assessment.recommendations.length}):
${assessment.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

**Assessment Summary**:
This comprehensive ethics assessment evaluated the content across ${assessment.checks.length} critical dimensions including harm prevention, bias detection, privacy protection, transparency, fairness, and regulatory compliance. ${
  assessment.safetyRating === 'safe' ? 
  'The content meets ethical standards and is safe for deployment.' :
  assessment.safetyRating === 'caution' ?
  'The content requires modifications to address identified concerns before deployment.' :
  'The content has serious ethical violations that must be resolved.'
}

The assessment leveraged ${this.episodicMemory.length} historical cases and ${this.violationPatterns.size} known violation patterns to ensure comprehensive coverage.`;
  }

  // Helper methods
  private loadEthicalGuidelines(): void {
    // Core ethical guidelines
    const guidelines: EthicalGuideline[] = [
      {
        id: 'harm_001',
        category: 'harm_prevention',
        rule: 'Do not generate content that could cause physical or emotional harm',
        examples: ['violence', 'self-harm', 'dangerous instructions'],
        severity: 'critical'
      },
      {
        id: 'bias_001',
        category: 'bias_detection',
        rule: 'Avoid stereotypes and discriminatory language',
        examples: ['gender stereotypes', 'racial bias', 'age discrimination'],
        severity: 'high'
      },
      {
        id: 'privacy_001',
        category: 'privacy',
        rule: 'Protect personal and sensitive information',
        examples: ['PII exposure', 'credential leaks', 'unauthorized data access'],
        severity: 'critical'
      },
      {
        id: 'transparency_001',
        category: 'transparency',
        rule: 'Clearly disclose AI involvement and limitations',
        examples: ['AI disclosure', 'uncertainty expression', 'source attribution'],
        severity: 'medium'
      }
    ];
    
    guidelines.forEach(g => this.ethicalGuidelines.set(g.id, g));
  }

  private loadViolationPatterns(): void {
    // Load from semantic memory
    for (const [concept, knowledge] of Array.from(this.semanticMemory.entries())) {
      if (concept.startsWith('violation_')) {
        this.violationPatterns.set(concept, knowledge.knowledge);
      }
    }
  }

  private initializeComplianceFramework(): void {
    // Initialize with standard compliance requirements
    this.complianceStandards.add('GDPR');
    this.complianceStandards.add('CCPA');
    this.complianceStandards.add('AI Ethics Guidelines');
    this.complianceStandards.add('Content Policy');
  }

  private assessIndirectHarm(content: any): number {
    // Assess risk of indirect harm (0-1 scale)
    let risk = 0;
    
    const contentStr = JSON.stringify(content).toLowerCase();
    
    // Check for potentially misleading information
    if (contentStr.includes('guaranteed') || contentStr.includes('100%') || contentStr.includes('always works')) {
      risk += 0.2;
    }
    
    // Check for lack of warnings
    if (!contentStr.includes('caution') && !contentStr.includes('warning') && !contentStr.includes('risk')) {
      risk += 0.1;
    }
    
    // Check for complex technical instructions without safeguards
    if (contentStr.includes('sudo') || contentStr.includes('admin') || contentStr.includes('root')) {
      risk += 0.2;
    }
    
    return Math.min(1.0, risk);
  }

  private calculateOverallEthicsScore(checks: EthicsCheck[]): number {
    const passedChecks = checks.filter(c => c.passed).length;
    const totalChecks = checks.length;
    
    // Base score from passed checks
    let score = passedChecks / totalChecks;
    
    // Apply severity penalties
    for (const check of checks) {
      if (!check.passed) {
        switch (check.severity) {
          case 'critical':
            score -= 0.3;
            break;
          case 'high':
            score -= 0.2;
            break;
          case 'medium':
            score -= 0.1;
            break;
          case 'low':
            score -= 0.05;
            break;
        }
      }
    }
    
    return Math.max(0, Math.min(1.0, score));
  }

  private determineSafetyRating(checks: EthicsCheck[]): 'safe' | 'caution' | 'unsafe' {
    const criticalViolations = checks.filter(c => !c.passed && c.severity === 'critical');
    const highViolations = checks.filter(c => !c.passed && c.severity === 'high');
    
    if (criticalViolations.length > 0) {
      return 'unsafe';
    }
    
    if (highViolations.length > 0 || checks.filter(c => !c.passed).length > 2) {
      return 'caution';
    }
    
    return 'safe';
  }

  private identifyViolations(checks: EthicsCheck[]): any[] {
    return checks
      .filter(c => !c.passed)
      .map(c => ({
        category: c.category,
        description: c.issue || 'Violation detected',
        severity: c.severity,
        mitigation: c.recommendation || 'Review and address the issue'
      }));
  }

  private assessCompliance(checks: EthicsCheck[], content: any): any[] {
    const complianceResults = [];
    
    for (const standard of Array.from(this.complianceStandards)) {
      let compliant = true;
      let notes = '';
      
      switch (standard) {
        case 'GDPR':
          const privacyCheck = checks.find(c => c.category === 'privacy');
          compliant = privacyCheck?.passed || false;
          notes = compliant ? 'Privacy requirements met' : 'Privacy violations detected';
          break;
          
        case 'AI Ethics':
          const ethicsViolations = checks.filter(c => !c.passed).length;
          compliant = ethicsViolations === 0;
          notes = compliant ? 'All ethics checks passed' : `${ethicsViolations} ethics violations`;
          break;
          
        case 'Content Policy':
          const contentCheck = checks.find(c => c.category === 'harm_prevention');
          compliant = contentCheck?.passed || false;
          notes = compliant ? 'Content is appropriate' : 'Content policy violations';
          break;
          
        default:
          notes = 'Standard compliance check';
      }
      
      complianceResults.push({ standard, compliant, notes });
    }
    
    return complianceResults;
  }

  private calculateConfidenceLevel(checks: EthicsCheck[]): number {
    const confidences = checks.map(c => c.confidence);
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  private isSimilarContext(context1: string, context2: string): boolean {
    const words1 = context1.toLowerCase().split(' ');
    const words2 = context2.toLowerCase().split(' ');
    const commonWords = words1.filter(w => words2.includes(w) && w.length > 3);
    return commonWords.length >= Math.min(words1.length, words2.length) * 0.3;
  }

  private formatCategory(category: string): string {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Implement abstract method from BaseAgent
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info(`⚖️ Initializing Ethics Agent`);
  }

  /**
   * Implement abstract method from BaseAgent
   */
  protected async process(context: AgentContext): Promise<PartialAgentResponse> {
    return this.executeWithMemory(context);
  }

  /**
   * Implement abstract method from BaseAgent
   */
  protected async onShutdown(): Promise<void> {
    this.logger.info(`⚖️ Shutting down Ethics Agent`);
    // Save violation patterns
    for (const [pattern, data] of Array.from(this.violationPatterns.entries())) {
      await this.storeSemanticMemory(pattern, data);
    }
  }
}

export default EthicsAgent;