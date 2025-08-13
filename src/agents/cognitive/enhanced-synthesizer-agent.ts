/**
 * Enhanced Synthesizer Agent - Real AI Information Synthesis
 * Uses advanced models to synthesize information from multiple sources and perspectives
 */

import type { AgentContext } from '@/types';

import { EnhancedBaseAgent } from '../enhanced-base-agent';

export class EnhancedSynthesizerAgent extends EnhancedBaseAgent {
  protected buildSystemPrompt(): string {
    return `You are an expert information synthesis and consensus-building agent with advanced analytical capabilities.

ROLE: Information Synthesis & Consensus Building Specialist

CAPABILITIES:
- Synthesize information from multiple sources and perspectives
- Identify patterns, connections, and relationships across different data points
- Build consensus from conflicting or diverse viewpoints
- Create comprehensive summaries and unified perspectives
- Resolve contradictions and highlight areas of agreement
- Generate actionable insights from complex information sets
- Provide balanced analysis considering multiple stakeholder perspectives

RESPONSE FORMAT:
Always respond with a structured JSON format:
{
  "synthesis": {
    "main_conclusion": "Primary synthesized insight or conclusion",
    "key_themes": [
      {
        "theme": "Major theme or pattern identified",
        "evidence": ["Supporting evidence from different sources"],
        "confidence": number_between_0_and_1,
        "implications": "What this theme means or suggests"
      }
    ],
    "consensus_areas": [
      {
        "area": "Topic where sources agree",
        "agreement_level": "high|medium|low",
        "supporting_sources": ["Which sources support this consensus"],
        "significance": "Why this consensus matters"
      }
    ],
    "divergent_views": [
      {
        "topic": "Area where sources disagree",
        "perspectives": [
          {
            "viewpoint": "Specific perspective or position",
            "rationale": "Reasoning behind this viewpoint",
            "strength": "Strong evidence vs weak support"
          }
        ],
        "potential_resolution": "How these views might be reconciled"
      }
    ]
  },
  "analysis": {
    "information_quality": "high|medium|low",
    "completeness": number_between_0_and_1,
    "reliability_assessment": "Overall reliability of synthesized information",
    "gaps_identified": ["Areas where more information is needed"],
    "contradictions_resolved": number
  },
  "actionable_insights": [
    {
      "insight": "Specific actionable insight",
      "priority": "high|medium|low",
      "implementation_complexity": "low|medium|high",
      "expected_impact": "Anticipated result or benefit",
      "next_steps": ["Specific actions to take"]
    }
  ],
  "stakeholder_perspectives": {
    "primary_beneficiaries": ["Who benefits most from these insights"],
    "potential_concerns": ["Who might have concerns or objections"],
    "implementation_challenges": ["Practical challenges to consider"]
  },
  "reasoning": "Detailed explanation of synthesis methodology and key decisions",
  "confidence": number_between_0_and_1,
  "recommendation": "Overall recommendation based on synthesis"
}

SYNTHESIS PRINCIPLES:
1. Always consider multiple perspectives and viewpoints
2. Look for underlying patterns and connections across information
3. Distinguish between correlation and causation
4. Identify both explicit and implicit information
5. Consider the credibility and bias of different sources
6. Highlight areas of uncertainty and knowledge gaps
7. Focus on actionable outcomes and practical implications
8. Maintain objectivity while acknowledging different stakeholder needs

Be thorough, objective, and balanced. Focus on creating unified understanding from complex or fragmented information.`;
  }

  protected getInternalModelName(): string {
    return 'synthesizer-deep';
  }

  protected getTemperature(): number {
    return 0.4; // Balanced temperature for creative synthesis while maintaining accuracy
  }

  protected getMaxTokens(): number {
    return 8000; // Allow for comprehensive synthesis responses
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    let additionalContext = '';

    // Detect synthesis scope and complexity
    const synthesisType = this.detectSynthesisType(context.userRequest);
    if (synthesisType) {
      additionalContext += `Synthesis type: ${synthesisType}\n`;
    }

    // Identify information sources mentioned
    const sources = this.extractInformationSources(context.userRequest);
    if (sources.length > 0) {
      additionalContext += `Information sources: ${sources.join(', ')}\n`;
    }

    // Look for stakeholder mentions
    const stakeholders = this.identifyStakeholders(context.userRequest);
    if (stakeholders.length > 0) {
      additionalContext += `Stakeholders: ${stakeholders.join(', ')}\n`;
    }

    // Check for decision-making context
    const decisionContext = this.extractDecisionContext(context.userRequest);
    if (decisionContext) {
      additionalContext += `Decision context: ${decisionContext}\n`;
    }

    // Identify synthesis goals
    const goals = this.extractSynthesisGoals(context.userRequest);
    if (goals.length > 0) {
      additionalContext += `Synthesis goals: ${goals.join(', ')}\n`;
    }

    return additionalContext || null;
  }

  private detectSynthesisType(request: string): string | null {
    const typePatterns = [
      { pattern: /summarize|summary/gi, type: 'summarization' },
      { pattern: /compare|contrast|comparison/gi, type: 'comparative_analysis' },
      { pattern: /synthesize|combine|merge/gi, type: 'information_synthesis' },
      { pattern: /consensus|agreement|common ground/gi, type: 'consensus_building' },
      { pattern: /analyze|analysis|examination/gi, type: 'analytical_synthesis' },
      { pattern: /recommend|recommendation|suggest/gi, type: 'recommendation_synthesis' },
      { pattern: /resolve|reconcile|conflict/gi, type: 'conflict_resolution' },
    ];

    for (const { pattern, type } of typePatterns) {
      if (pattern.test(request)) {
        return type;
      }
    }

    return null;
  }

  private extractInformationSources(request: string): string[] {
    const sources: string[] = [];
    const sourcePatterns = [
      /from ([^,.]+) (said|reported|indicated|showed|found)/gi,
      /according to ([^,.]+)/gi,
      /(study|research|report|analysis|survey) (by|from) ([^,.]+)/gi,
      /(data|information|findings) from ([^,.]+)/gi,
    ];

    for (const pattern of sourcePatterns) {
      const matches = Array.from(request.matchAll(pattern));
      matches.forEach((match) => {
        const source = match[1] || match[3];
        if (source && !sources.includes(source.trim())) {
          sources.push(source.trim());
        }
      });
    }

    return sources;
  }

  private identifyStakeholders(request: string): string[] {
    const stakeholders: string[] = [];
    const stakeholderPatterns = [
      /stakeholders?/gi,
      /(users?|customers?|clients?)/gi,
      /(team|teams|department|organization)/gi,
      /(management|executives?|leadership)/gi,
      /(investors?|shareholders?)/gi,
      /(partners?|vendors?|suppliers?)/gi,
    ];

    for (const pattern of stakeholderPatterns) {
      const matches = Array.from(request.matchAll(pattern));
      matches.forEach((match) => {
        const [stakeholder] = match;
        if (stakeholder && !stakeholders.includes(stakeholder.toLowerCase())) {
          stakeholders.push(stakeholder.toLowerCase());
        }
      });
    }

    return [...new Set(stakeholders)]; // Remove duplicates
  }

  private extractDecisionContext(request: string): string | null {
    const decisionPatterns = [
      /decision (about|on|regarding) ([^,.]+)/gi,
      /choose (between|from) ([^,.]+)/gi,
      /evaluate (options|alternatives|choices)/gi,
      /make a (decision|choice|recommendation)/gi,
    ];

    for (const pattern of decisionPatterns) {
      const match = request.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  private extractSynthesisGoals(request: string): string[] {
    const goals: string[] = [];
    const goalPatterns = [
      { pattern: /understand/gi, goal: 'understanding' },
      { pattern: /decide|decision/gi, goal: 'decision_making' },
      { pattern: /plan|planning/gi, goal: 'planning' },
      { pattern: /solve|solution/gi, goal: 'problem_solving' },
      { pattern: /improve|optimization/gi, goal: 'improvement' },
      { pattern: /strategy|strategic/gi, goal: 'strategic_planning' },
      { pattern: /implement|implementation/gi, goal: 'implementation' },
    ];

    for (const { pattern, goal } of goalPatterns) {
      if (pattern.test(request)) {
        goals.push(goal);
      }
    }

    return [...new Set(goals)]; // Remove duplicates
  }

  protected calculateConfidence(llmResponse: unknown, context: AgentContext): number {
    let confidence = super.calculateConfidence(llmResponse, context);

    try {
      const parsed = JSON.parse((llmResponse as any).content);

      // Check for comprehensive synthesis structure
      if (parsed.synthesis) {
        confidence += 0.1;

        // Check for key themes
        if (parsed.synthesis.key_themes && Array.isArray(parsed.synthesis.key_themes)) {
          confidence += 0.1;
        }

        // Check for consensus areas
        if (parsed.synthesis.consensus_areas && Array.isArray(parsed.synthesis.consensus_areas)) {
          confidence += 0.08;
        }

        // Check for divergent views handling
        if (parsed.synthesis.divergent_views && Array.isArray(parsed.synthesis.divergent_views)) {
          confidence += 0.07;
        }
      }

      // Check for quality analysis
      if (parsed.analysis) {
        confidence += 0.05;
      }

      // Check for actionable insights
      if (parsed.actionable_insights && Array.isArray(parsed.actionable_insights)) {
        confidence += 0.1;
      }

      // Check for stakeholder consideration
      if (parsed.stakeholder_perspectives) {
        confidence += 0.05;
      }

      // Bonus for having a clear recommendation
      if (parsed.recommendation) {
        confidence += 0.03;
      }
    } catch {
      // Not valid JSON, reduce confidence significantly
      confidence -= 0.25;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}

export default EnhancedSynthesizerAgent;
