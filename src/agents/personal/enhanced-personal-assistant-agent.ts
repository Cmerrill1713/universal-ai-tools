/**
 * Enhanced Personal Assistant Agent - Real AI Assistant Capabilities
 * Uses conversational models to provide personalized assistance
 */

import { EnhancedBaseAgent } from '../enhanced-base-agent';
import type { AgentContext } from '@/types';

export class EnhancedPersonalAssistantAgent extends EnhancedBaseAgent {
  protected buildSystemPrompt(): string {
    return `You are an intelligent personal assistant AI with advanced conversational and task management capabilities.

ROLE: Personal AI Assistant & Task Coordinator

PERSONALITY:
- Helpful, friendly, and proactive
- Professional yet personable
- Adaptive to user preferences and communication style
- Empathetic and understanding
- Solution-oriented and resourceful

CAPABILITIES:
- Task planning and organization
- Schedule management and reminders
- Information lookup and research assistance  
- Problem-solving and decision support
- Communication assistance
- Personal productivity optimization
- Learning user preferences over time

RESPONSE FORMAT:
Always respond with a structured JSON format:
{
  "response": {
    "message": "Main conversational response to the user",
    "tone": "friendly|professional|casual|empathetic",
    "tasks_identified": [
      {
        "task": "Task description",
        "category": "work|personal|administrative|learning",
        "priority": "high|medium|low",
        "estimated_time": "Time estimate",
        "suggested_approach": "How to approach this task"
      }
    ],
    "actionable_items": [
      {
        "action": "Specific action item",
        "deadline": "When this should be done (if applicable)",
        "resources_needed": ["What's needed to complete this"]
      }
    ]
  },
  "assistance_type": "conversation|task_management|information|problem_solving|coordination",
  "follow_up_suggestions": [
    "Relevant follow-up questions or actions the user might want to consider"
  ],
  "context_memory": {
    "user_preferences": ["Noted preferences from conversation"],
    "ongoing_topics": ["Topics to remember for future conversations"],
    "relationship_notes": ["Personal details to remember about the user"]
  },
  "reasoning": "Brief explanation of approach and key considerations",
  "confidence": number_between_0_and_1,
  "next_interaction": "Suggestion for how to continue or follow up"
}

INTERACTION PRINCIPLES:
1. Always acknowledge the user's request clearly
2. Provide practical, actionable assistance
3. Break down complex requests into manageable steps
4. Remember context from previous interactions
5. Anticipate follow-up needs and questions
6. Offer multiple options when appropriate
7. Be proactive in suggesting improvements or alternatives
8. Maintain appropriate professional boundaries while being personable

Be genuinely helpful, efficient, and memorable. Focus on making the user's life easier and more organized.`;
  }

  protected getInternalModelName(): string {
    return 'assistant-personal';
  }

  protected getTemperature(): number {
    return 0.7; // Higher temperature for more natural, conversational responses
  }

  protected getMaxTokens(): number {
    return 3000; // Allow for detailed personal assistance
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    let // TODO: Refactor nested ternary
      additionalContext = '';

    // Analyze the user's communication style
    const communicationStyle = this.analyzeCommunicationStyle(context.userRequest);
    if (communicationStyle) {
      additionalContext += `User communication style: ${communicationStyle}\n`;
    }

    // Check for urgency indicators
    const urgency = this.detectUrgency(context.userRequest);
    if (urgency) {
      additionalContext += `Urgency level: ${urgency}\n`;
    }

    // Identify task categories
    const taskCategories = this.identifyTaskCategories(context.userRequest);
    if (taskCategories.length > 0) {
      additionalContext += `Task categories: ${taskCategories.join(', ')}\n`;
    }

    // Check for emotional context
    const emotionalContext = this.detectEmotionalContext(context.userRequest);
    if (emotionalContext) {
      additionalContext += `Emotional context: ${emotionalContext}\n`;
    }

    // Look for time-sensitive elements
    const timeContext = this.extractTimeContext(context.userRequest);
    if (timeContext) {
      additionalContext += `Time context: ${timeContext}\n`;
    }

    return additionalContext || null;
  }

  private analyzeCommunicationStyle(request: string): string | null {
    if (request.includes('please') || request.includes('thank you')) {
      return 'polite_formal';
    }
    if (
      request.includes('hey') ||
      request.includes('thanks') ||
      /\b(gonna|wanna|gotta)\b/.test(request)
    ) {
      return 'casual_friendly';
    }
    if (request.length < 50 && !request.includes('?')) {
      return 'direct_brief';
    }
    if (request.includes('could you') || request.includes('would you mind')) {
      return 'respectful_collaborative';
    }
    return null;
  }

  private detectUrgency(request: string): string | null {
    const urgentPatterns = [
      /urgent|asap|immediately|right away|now/gi,
      /emergency|critical|important/gi,
      /deadline|due/gi,
    ];

    for (const pattern of urgentPatterns) {
      if (pattern.test(request)) {
        return 'high';
      }
    }

    if (request.includes('when you get a chance') || request.includes('no rush')) {
      return 'low';
    }

    return 'medium';
  }

  private identifyTaskCategories(request: string): string[] {
    const categories: string[] = [];
    const categoryPatterns = [
      { pattern: /work|job|office|meeting|project|business/gi, category: 'work' },
      { pattern: /personal|family|home|life/gi, category: 'personal' },
      { pattern: /schedule|calendar|appointment|remind/gi, category: 'scheduling' },
      { pattern: /learn|study|research|understand/gi, category: 'learning' },
      { pattern: /organize|plan|manage|coordinate/gi, category: 'organization' },
      { pattern: /email|message|communicate|call/gi, category: 'communication' },
      { pattern: /buy|purchase|order|shopping/gi, category: 'shopping' },
      { pattern: /travel|trip|vacation|flight/gi, category: 'travel' },
    ];

    for (const { pattern, category } of categoryPatterns) {
      if (pattern.test(request)) {
        categories.push(category);
      }
    }

    return categories;
  }

  private detectEmotionalContext(request: string): string | null {
    const emotionalPatterns = [
      { pattern: /stressed|overwhelmed|anxious|worried/gi, emotion: 'stressed' },
      { pattern: /excited|happy|thrilled/gi, emotion: 'positive' },
      { pattern: /frustrated|annoyed|upset/gi, emotion: 'frustrated' },
      { pattern: /confused|lost|unclear/gi, emotion: 'confused' },
      { pattern: /tired|exhausted|burned out/gi, emotion: 'fatigued' },
    ];

    for (const { pattern, emotion } of emotionalPatterns) {
      if (pattern.test(request)) {
        return emotion;
      }
    }

    return null;
  }

  private extractTimeContext(request: string): string | null {
    const timePatterns = [
      /today|tonight|this morning|this afternoon|this evening/gi,
      /tomorrow|next week|next month/gi,
      /in (d+) (minutes?|hours?|days?|weeks?)/gi,
      /by (d+)(am|pm)?/gi,
      /before ([^,.]+)/gi,
    ];

    for (const pattern of timePatterns) {
      const match = request.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  protected calculateConfidence(llmResponse: unknown, context: AgentContext): number {
    let confidence = super.calculateConfidence(llmResponse, context);

    try {
      const parsed = JSON.parse(llmResponse.content);

      // Check for structured response
      if (parsed.response && parsed.response.message) {
        confidence += 0.1;

        // Check for helpful task identification
        if (parsed.response.tasks_identified && Array.isArray(parsed.response.tasks_identified)) {
          confidence += 0.1;
        }

        // Check for actionable items
        if (parsed.response.actionable_items && Array.isArray(parsed.response.actionable_items)) {
          confidence += 0.1;
        }
      }

      // Check for appropriate assistance type
      if (parsed.assistance_type) {
        confidence += 0.05;
      }

      // Check for memory and context tracking
      if (parsed.context_memory) {
        confidence += 0.05;
      }

      // Check for follow-up suggestions
      if (parsed.follow_up_suggestions && Array.isArray(parsed.follow_up_suggestions)) {
        confidence += 0.05;
      }

      // Bonus for appropriate tone matching
      if (parsed.response.tone) {
        confidence += 0.02;
      }
    } catch {
      // Not valid JSON, reduce confidence
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}

export default EnhancedPersonalAssistantAgent;
