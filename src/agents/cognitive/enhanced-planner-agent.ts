/**
 * Enhanced Planner Agent - Real AI Planning Capabilities
 * Uses strategic planning models to create comprehensive task plans
 */

import { EnhancedBaseAgent } from '../enhanced-base-agent';
import type { AgentContext, PlanPhase } from '@/types';

export class EnhancedPlannerAgent extends EnhancedBaseAgent {
  protected buildSystemPrompt(): string {
    return `You are an expert strategic planning agent with advanced analytical capabilities.

ROLE: Strategic Planning & Task Decomposition Specialist

CAPABILITIES:
- Break down complex goals into actionable tasks
- Create timeline-based project plans
- Identify dependencies and critical paths
- Risk assessment and mitigation planning
- Resource allocation and optimization
- Adaptive planning based on changing requirements

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
        "tasks": [
          {
            "id": "task_id",
            "title": "Task title",
            "description": "Detailed task description",
            "dependencies": ["list of task IDs this depends on"],
            "resources": ["required resources"],
            "priority": "high|medium|low",
            "estimatedHours": number
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
    "success_criteria": ["List of measurable success indicators"]
  },
  "reasoning": "Explanation of planning approach and key decisions",
  "confidence": number_between_0_and_1,
  "next_steps": ["Immediate actions to begin implementation"]
}

PLANNING PRINCIPLES:
1. Always start with understanding the goal and constraints
2. Break down large tasks into manageable chunks (2-8 hour tasks)
3. Identify critical dependencies early
4. Plan for iterations and feedback loops
5. Include buffer time for unexpected challenges
6. Consider resource constraints and availability
7. Prioritize high-impact, low-effort tasks when possible

Be thorough but practical. Focus on actionable plans that can be implemented immediately.`;
  }

  protected getInternalModelName(): string {
    return 'planner-pro';
  }

  protected getTemperature(): number {
    return 0.3; // Lower temperature for more structured, reliable planning
  }

  protected getMaxTokens(): number {
    return 4000; // Allow for detailed planning responses
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    // Add planning-specific context
    let additionalContext = '';

    // Check for planning-related context
    if (context.workingDirectory) {
      additionalContext += `Project context: Working in ${context.workingDirectory}\n`;
    }

    // Check for any time constraints or deadlines
    const timeConstraints = this.extractTimeConstraints(context.userRequest);
    if (timeConstraints) {
      additionalContext += `Time constraints: ${timeConstraints}\n`;
    }

    // Check for resource mentions
    const resources = this.extractResourceMentions(context.userRequest);
    if (resources.length > 0) {
      additionalContext += `Available resources: ${resources.join(', ')}\n`;
    }

    return additionalContext || null;
  }

  private extractTimeConstraints(request: string): string | null {
    const timePatterns = [
      /by ([^,.]+)/gi,
      /within ([^,.]+)/gi,
      /deadline ([^,.]+)/gi,
      /due ([^,.]+)/gi,
      /in the next ([^,.]+)/gi,
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

    // Common resource patterns
    const resourcePatterns = [
      /team of (d+)/gi,
      /budget of ([^,.]+)/gi,
      /using ([^,.]+)/gi,
      /with ([^,.]+) developers?/gi,
      /($[d,]+)/gi,
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

  protected calculateConfidence(llmResponse: unknown, context: AgentContext): number {
    let confidence = super.calculateConfidence(llmResponse, context);

    try {
      // Check if response is valid JSON with required planning structure
      const parsed = JSON.parse((llmResponse as any).content);

      if (parsed.plan && parsed.plan.phases && Array.isArray(parsed.plan.phases)) {
        confidence += 0.1;

        // Check for task structure
        const hasWellStructuredTasks = parsed.plan.phases.some(
          (phase: PlanPhase) => phase.tasks && Array.isArray(phase.tasks) && phase.tasks.length > 0
        );

        if (hasWellStructuredTasks) {
          confidence += 0.1;
        }

        // Check for risk assessment
        if (parsed.plan.risks && Array.isArray(parsed.plan.risks)) {
          confidence += 0.05;
        }

        // Check for success criteria
        if (parsed.plan.success_criteria && Array.isArray(parsed.plan.success_criteria)) {
          confidence += 0.05;
        }
      }
    } catch {
      // Not valid JSON, reduce confidence
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}

export default EnhancedPlannerAgent;
