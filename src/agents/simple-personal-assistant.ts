/**
 * Simple Personal Assistant Agent - Intelligent responses without complex dependencies
 */

import { SimpleBaseAgent } from './simple-base-agent.js';
import type SimpleMemoryService from '../services/simple-memory-service.js';

export class SimplePersonalAssistant extends SimpleBaseAgent {
  constructor(memoryService: SimpleMemoryService) {
    super('personal-assistant', 'personal', memoryService);
  }

  protected async generateResponse(message: string, userId: string, context?: string | null): Promise<string> {
    const lowerMessage = message.toLowerCase();
    
    // Check if we have previous conversation context
    const contextualGreeting = context ? this.getContextualResponse(message, context) : null;
    if (contextualGreeting) {
      return contextualGreeting;
    }
    
    // Greeting responses
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      // Get user preferences to personalize greeting
      const preferences = await this.memoryService.getUserPreferences(userId);
      const returningUser = preferences && preferences.topics.length > 0;
      
      if (returningUser) {
        const topics = preferences.topics.slice(-3).join(', ');
        return `Hello again! Good to see you back. I remember we've been discussing ${topics}. How can I help you today?`;
      } else {
        const greetings = [
          `Hello! I'm your Universal AI Tools personal assistant. How can I help you today?`,
          `Hi there! I'm here to assist you with whatever you need. What can I do for you?`,
          `Hey! Great to hear from you. I'm ready to help with questions, tasks, or anything else you need.`
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
      }
    }
    
    // Help and capabilities
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you do') || lowerMessage.includes('capabilities')) {
      return `I'm your AI assistant and I can help you with:

📋 **Task Management & Planning**
- Break down complex projects into steps
- Create to-do lists and schedules
- Prioritize tasks and deadlines

💬 **General Assistance**
- Answer questions on various topics
- Provide explanations and clarifications
- Help with decision-making

💻 **Technical Support**
- Code explanations and best practices
- Architecture and design guidance
- Troubleshooting help

📚 **Research & Information**
- Gather and organize information
- Explain complex topics simply
- Provide multiple perspectives

What specific area would you like help with?`;
    }
    
    // Task planning
    if (lowerMessage.includes('plan') || lowerMessage.includes('organize') || lowerMessage.includes('schedule')) {
      return `I'd be happy to help you plan and organize! To give you the best assistance, could you tell me more about:

- What project or task you're working on?
- What's your timeline or deadline?
- What resources do you have available?
- Are there any specific challenges you're facing?

Once I understand your situation better, I can help you create a structured plan with clear steps and priorities.`;
    }
    
    // Code and technical help
    if (lowerMessage.includes('code') || lowerMessage.includes('programming') || lowerMessage.includes('technical')) {
      return `I can definitely help with technical and coding questions! I can assist with:

🔧 **Code Review & Guidance**
- Explain how code works
- Suggest improvements and best practices
- Help debug issues

🏗️ **Architecture & Design**
- Recommend design patterns
- Suggest project structure
- Discuss technology choices

📖 **Learning & Concepts**
- Explain programming concepts
- Provide examples and tutorials
- Guide you through complex topics

What specific technical challenge are you working on? Feel free to share code snippets or describe the problem you're facing.`;
    }
    
    // Problem solving
    if (lowerMessage.includes('problem') || lowerMessage.includes('issue') || lowerMessage.includes('stuck') || lowerMessage.includes('challenge')) {
      return `I'm here to help you work through problems! Let's break this down systematically:

🔍 **Let's analyze the situation:**
- What exactly is the problem you're facing?
- What have you already tried?
- What outcome are you hoping for?

💡 **I can help you:**
- Identify the root cause
- Brainstorm potential solutions
- Evaluate pros and cons of different approaches
- Create an action plan

Please describe your problem in more detail, and I'll help you find a solution!`;
    }
    
    // Status and how are you
    if (lowerMessage.includes('how are you') || lowerMessage.includes('status') || lowerMessage.includes('working')) {
      return `I'm running great! 🚀 The Universal AI Tools system is operational and I'm ready to assist you. 

**Current Status:**
✅ Personal assistant features - Fully operational
✅ Task planning and organization - Ready
✅ Technical guidance - Available
✅ General question answering - Working well

I'm continuously learning and improving to provide you with better assistance. Is there anything specific you'd like help with today?`;
    }
    
    // Thank you responses
    if (lowerMessage.includes('thank') || lowerMessage.includes('appreciate')) {
      const thanks = [
        `You're very welcome! I'm always happy to help. Is there anything else you need assistance with?`,
        `My pleasure! Feel free to ask if you have any other questions or need help with anything else.`,
        `Glad I could help! I'm here whenever you need assistance with tasks, questions, or planning.`
      ];
      return thanks[Math.floor(Math.random() * thanks.length)];
    }
    
    // Goodbye responses
    if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('see you')) {
      const goodbyes = [
        `Goodbye! Feel free to come back anytime you need assistance.`,
        `See you later! I'll be here whenever you need help with anything.`,
        `Take care! Don't hesitate to reach out if you need help with any tasks or questions.`
      ];
      return goodbyes[Math.floor(Math.random() * goodbyes.length)];
    }
    
    // Default intelligent response for any other message
    return `I understand you're asking about: "${message}"

While I work on better understanding your specific request, I'm here to help you with:
- **Task planning and organization** - Breaking down projects, creating schedules
- **Technical guidance** - Code help, architecture advice, troubleshooting  
- **Problem solving** - Working through challenges step by step
- **General assistance** - Questions, research, decision support

Could you tell me more about what you'd like help with? The more specific you are, the better I can assist you!`;
  }

  /**
   * Generate contextual responses based on conversation history
   */
  private getContextualResponse(message: string, context: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    // If user is asking for follow-up on previous topics
    if (lowerMessage.includes('continue') || lowerMessage.includes('more') || lowerMessage.includes('tell me more')) {
      return `Based on our previous conversation, let me continue helping you. ${context.split('\n').slice(-1)[0]}

What specific aspect would you like me to elaborate on?`;
    }
    
    // If user is asking about something we discussed recently
    if (context.includes('code') && lowerMessage.includes('that')) {
      return `I can see we were discussing coding topics recently. Are you referring to something from our previous conversation about programming?`;
    }
    
    return null;
  }
}

export default SimplePersonalAssistant;