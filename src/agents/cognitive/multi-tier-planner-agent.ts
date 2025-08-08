/**
 * Multi-Tier Planner Agent - Agent Zero Competitor
 * Uses local LLM orchestra for superior planning capabilities
 * Tier 3-4 preferred for complex strategic planning
 */

import { MultiTierBaseAgent } from '../multi-tier-base-agent';
import type { AgentConfig, AgentContext, PlanPhase } from '@/types';

export class MultiTierPlannerAgent extends MultiTierBaseAgent {
  constructor(config: AgentConfig) {
    super(config);
    this.preferredTier = 3; // Use Tier 3 (Qwen 7B, DeepSeek 14B) for planning
    this.preferredVoice = 'am_adam'; // Professional male voice
  }

  protected buildSystemPrompt(): string {
    return `You are an expert strategic planning agent with advanced analytical capabilities.

ROLE: Strategic Planning & Task Decomposition Specialist

CAPABILITIES:
- Break down complex goals into actionable tasks
- Create timeline-based project plans with dependencies
- Identify critical paths and resource requirements
- Risk assessment and mitigation planning
- Adaptive planning based on changing requirements
- Resource allocation and optimization

RESPONSE FORMAT:
Always respond with a structured JSON format:
{
  "plan": {
    "title": "Brief plan title",
    "overview": "High-level summary of the approach",
    "phases": [
      {
        "name": "Phase name",
        "duration": "Estimated timeframe",
        "priority": "high|medium|low",
        "tasks": [
          {
            "id": "task_id", 
            "title": "Task title",
            "description": "Detailed task description",
            "dependencies": ["list of task IDs this depends on"],
            "resources": ["required resources"],
            "priority": "high|medium|low",
            "estimatedHours": number,
            "complexity": "simple|medium|complex"
          }
        ]
      }
    ],
    "risks": [
      {
        "description": "Risk description",
        "probability": "high|medium|low", 
        "impact": "high|medium|low",
        "mitigation": "Mitigation strategy"
      }
    ],
    "success_criteria": ["List of measurable success indicators"],
    "resource_requirements": {
      "human_resources": ["Required roles/skills"],
      "technical_resources": ["Tools, systems, infrastructure"],
      "budget_estimate": "Rough cost estimate if applicable"
    }
  },
  "reasoning": "Explanation of planning approach and key decisions",
  "confidence": number_between_0_and_1,
  "next_steps": ["Immediate actions to begin implementation"],
  "alternatives": ["Alternative approaches considered"]
}

PLANNING PRINCIPLES:
1. Always start with understanding the goal, constraints, and context
2. Break down large tasks into manageable chunks (2-8 hour tasks)
3. Identify critical dependencies and potential bottlenecks early
4. Plan for iterations, feedback loops, and continuous improvement
5. Include buffer time for unexpected challenges (20-30% buffer)
6. Consider resource constraints and team availability
7. Prioritize high-impact, low-effort tasks when possible
8. Account for testing, review, and deployment phases
9. Consider scalability and maintainability from the start
10. Plan for knowledge transfer and documentation

Be thorough but practical. Focus on actionable plans that can be implemented immediately with clear ownership and accountability.`;
  }

  protected getDomain(): string {
    return 'reasoning'; // Planning requires analytical reasoning
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    let additionalContext = '';

    // Extract project context
    if (context.workingDirectory) {
      additionalContext += `Project context: Working in ${context.workingDirectory}\n`;
    }

    // Check for time constraints or deadlines
    const timeConstraints = this.extractTimeConstraints(context.userRequest || '');
    if (timeConstraints) {
      additionalContext += `Time constraints: ${timeConstraints}\n`;
    }

    // Check for resource mentions
    const resources = this.extractResourceMentions(context.userRequest || '');
    if (resources.length > 0) {
      additionalContext += `Available resources: ${resources.join(', ')}\n`;
    }

    // Check for complexity indicators
    const complexityLevel = this.assessComplexity(context.userRequest || '');
    additionalContext += `Estimated complexity: ${complexityLevel}\n`;

    // Add planning context
    additionalContext += `Planning mode: Comprehensive strategic planning with risk assessment\n`;
    additionalContext += `Focus: Actionable tasks with clear dependencies and timelines\n`;

    return additionalContext || null;
  }

  private extractTimeConstraints(request: string): string | null {
    const timePatterns = [
      /by ([^,.]+)/gi,
      /within ([^,.]+)/gi,
      /deadline ([^,.]+)/gi,
      /due ([^,.]+)/gi,
      /in the next ([^,.]+)/gi,
      /(d+)s*(days?|weeks?|months?)/gi,
    ];

    for (const pattern of timePatterns) {
      const match = request.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private extractResourceMentions(request: string): string[] {
    const resources: string[] = [];

    const resourcePatterns = [
      /team of (d+)/gi,
      /budget of ([^,.]+)/gi,
      /using ([^,.]+)/gi,
      /with ([^,.]+) developers?/gi,
      /(\$[\d,]+)/gi,
      /(d+)s*(developers?|engineers?|designers?|people)/gi,
    ];

    for (const pattern of resourcePatterns) {
      const matches = Array.from(request.matchAll(pattern));
      matches.forEach((match) => {
        if (match[1]) {
          resources.push(match[1]);
        }
      });
    }

    return resources;
  }

  private assessComplexity(request: string): 'simple' | 'medium' | 'complex' | 'expert' {
    const complexKeywords = [
      'enterprise',
      'scalable',
      'distributed',
      'microservices',
      'architecture',
      'machine learning',
      'ai',
      'blockchain',
      'cloud',
      'infrastructure',
    ];

    const mediumKeywords = [
      'api',
      'database',
      'integration',
      'authentication',
      'dashboard',
      'mobile',
      'web application',
      'system',
    ];

    const expertKeywords = [
      'migration',
      'transformation',
      'compliance',
      'security audit',
      'performance optimization',
      'multi-tenant',
      'real-time',
    ];

    const lowerRequest = request.toLowerCase();

    if (expertKeywords.some((keyword) => lowerRequest.includes(keyword))) return 'expert';
    if (complexKeywords.some((keyword) => lowerRequest.includes(keyword))) return 'complex';
    if (mediumKeywords.some((keyword) => lowerRequest.includes(keyword))) return 'medium';

    return request.length > 200 ? 'medium' : 'simple';
  }

  protected parseAgentResponse(response: string): unknown {
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(response);

      // Validate the plan structure
      if (parsed.plan && parsed.plan.phases && Array.isArray(parsed.plan.phases)) {
        return {
          type: 'structured_plan',
          plan: parsed.plan,
          reasoning: parsed.reasoning || 'Strategic planning completed',
          confidence: parsed.confidence || 0.8,
          next_steps: parsed.next_steps || [],
          alternatives: parsed.alternatives || [],
          metadata: {
            total_phases: parsed.plan.phases.length,
            total_tasks: parsed.plan.phases.reduce(
              (sum: number, phase: PlanPhase) => sum + (phase.tasks ? phase.tasks.length : 0),
              0
            ),
            has_risk_assessment: !!(parsed.plan.risks && parsed.plan.risks.length > 0),
            has_success_criteria: !!(
              parsed.plan.success_criteria && parsed.plan.success_criteria.length > 0
            ),
          },
        };
      }

      return parsed;
    } catch {
      // If not JSON, try to extract structured information
      return this.extractPlanFromText(response);
    }
  }

  private extractPlanFromText(response: string): unknown {
    // Extract plan elements from unstructured text
    const lines = response.split('\n').filter((line) => line.trim());
    const plan = {
      title: this.extractTitle(lines),
      overview: this.extractOverview(lines),
      phases: this.extractPhases(lines),
      risks: this.extractRisks(lines),
      success_criteria: this.extractSuccessCriteria(lines),
    };

    return {
      type: 'extracted_plan',
      plan,
      reasoning: 'Plan extracted from text response',
      confidence: 0.7,
      next_steps: this.extractNextSteps(lines),
      summary: this.extractSummary(response),
    };
  }

  private extractTitle(lines: string[]): string {
    const titleLine = lines.find(
      (line) =>
        line.toLowerCase().includes('plan') ||
        line.toLowerCase().includes('project') ||
        line.match(/^#+s/)
    );
    return titleLine ? titleLine.replace(/^#+s*/, '').trim() : 'Generated Plan';
  }

  private extractOverview(lines: string[]): string {
    const overviewStart = lines.findIndex(
      (line) => line.toLowerCase().includes('overview') || line.toLowerCase().includes('summary')
    );

    if (overviewStart >= 0 && overviewStart < lines.length - 1) {
      return lines[overviewStart + 1]?.trim() || 'Strategic plan overview';
    }

    return lines.length > 0
      ? lines[0]?.trim() || 'Strategic plan overview'
      : 'Strategic plan overview';
  }

  private extractPhases(lines: string[]): unknown[] {
    const phases: unknown[] = [];
    let currentPhase: unknown = null;

    for (const line of lines) {
      // Check for phase indicators
      if (line.match(/phases+d+|steps+d+|d+./i)) {
        if (currentPhase) phases.push(currentPhase);
        currentPhase = {
          name: line.replace(/^d+.?s*/, '').trim(),
          duration: 'To be determined',
          priority: 'medium',
          tasks: [],
        };
      } else if (currentPhase && line.match(/^[s-]*[^s]/)) {
        // Add tasks to current phase
        (currentPhase as any).tasks.push({
          id: `task_${phases.length}_${(currentPhase as any).tasks.length}`,
          title: line.replace(/^[s-]*/, '').trim(),
          description: line.replace(/^[s-]*/, '').trim(),
          dependencies: [],
          resources: [],
          priority: 'medium' as const,
          estimatedHours: 4,
        });
      }
    }

    if (currentPhase) phases.push(currentPhase);

    return phases.length > 0
      ? phases
      : [
          {
            name: 'Main Phase',
            duration: 'To be determined',
            priority: 'high',
            tasks: [
              {
                id: 'task_1',
                title: 'Complete the requested task',
                description: 'Execute the planned activities',
                priority: 'high',
                estimatedHours: 8,
              },
            ],
          },
        ];
  }

  private extractRisks(lines: string[]): unknown[] {
    const riskLines = lines.filter(
      (line) =>
        line.toLowerCase().includes('risk') ||
        line.toLowerCase().includes('challenge') ||
        line.toLowerCase().includes('issue')
    );

    return riskLines.map((line) => ({
      description: line.trim(),
      probability: 'medium',
      impact: 'medium',
      mitigation: 'Monitor and adjust as needed',
    }));
  }

  private extractSuccessCriteria(lines: string[]): string[] {
    const criteriaLines = lines.filter(
      (line) =>
        line.toLowerCase().includes('success') ||
        line.toLowerCase().includes('criteria') ||
        line.toLowerCase().includes('goal') ||
        line.toLowerCase().includes('objective')
    );

    return criteriaLines.length > 0
      ? criteriaLines
      : ['Task completion', 'Quality delivery', 'Timeline adherence'];
  }

  private extractNextSteps(lines: string[]): string[] {
    const nextStepLines = lines.filter(
      (line) =>
        line.toLowerCase().includes('next') ||
        line.toLowerCase().includes('first') ||
        line.toLowerCase().includes('immediate')
    );

    return nextStepLines.length > 0
      ? nextStepLines
      : ['Begin implementation', 'Setup project structure', 'Start first phase'];
  }

  protected calculateTierConfidence(
    tier: number,
    executionTime: number,
    complexity: string
  ): number {
    let confidence = super.calculateTierConfidence(tier, executionTime, complexity);

    // Planning-specific confidence adjustments
    if (tier >= 3) confidence += 0.05; // Higher tier models better for planning
    if (executionTime > 5000) confidence += 0.03; // More time = more thorough planning

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}

export default MultiTierPlannerAgent;
