/**
 * Simple Code Assistant Agent - Code-focused assistance without complex dependencies
 */

import { SimpleBaseAgent } from './simple-base-agent.js';
import type SimpleMemoryService from '../services/simple-memory-service.js';

export class SimpleCodeAssistant extends SimpleBaseAgent {
  constructor(memoryService: SimpleMemoryService) {
    super('code-assistant', 'coding', memoryService);
  }

  protected async generateResponse(message: string, userId: string, context?: string | null): Promise<string> {
    const lowerMessage = message.toLowerCase();
    
    // Detect programming language mentions
    const languages = {
      'javascript': 'JavaScript', 'js': 'JavaScript', 'node': 'Node.js',
      'typescript': 'TypeScript', 'ts': 'TypeScript',
      'python': 'Python', 'py': 'Python',
      'java': 'Java',
      'swift': 'Swift',
      'go': 'Go', 'golang': 'Go',
      'rust': 'Rust',
      'c++': 'C++', 'cpp': 'C++',
      'c#': 'C#', 'csharp': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby'
    };
    
    let detectedLanguage = '';
    for (const [key, value] of Object.entries(languages)) {
      if (lowerMessage.includes(key)) {
        detectedLanguage = value;
        break;
      }
    }
    
    // Code generation requests
    if (lowerMessage.includes('create') || lowerMessage.includes('generate') || lowerMessage.includes('write')) {
      return `I can help you create ${detectedLanguage ? `${detectedLanguage  } ` : ''}code! 

🔧 **What I can help you build:**
- Functions and methods
- Classes and data structures
- API endpoints and routes
- Database queries and models
- User interfaces and components
- Scripts and utilities

**To give you the best code, please tell me:**
- What specific functionality do you need?
- What should the inputs and outputs be?
- Are there any specific requirements or constraints?
- What's the context or use case?

${detectedLanguage ? `I'll make sure to follow ${detectedLanguage} best practices and conventions.` : 'Let me know what programming language you prefer!'}

What would you like me to help you build?`;
    }
    
    // Code review and debugging
    if (lowerMessage.includes('review') || lowerMessage.includes('debug') || lowerMessage.includes('fix') || lowerMessage.includes('error')) {
      return `I'm here to help with code review and debugging! 🐛

**I can help you:**
- **Find and fix bugs** - Identify issues in your code
- **Improve code quality** - Suggest better practices and patterns
- **Optimize performance** - Make your code faster and more efficient
- **Enhance readability** - Make code cleaner and more maintainable
- **Security review** - Identify potential security issues

**To help you effectively:**
1. Share the code you'd like me to review
2. Describe the problem or unexpected behavior
3. Let me know what you expected to happen
4. Include any error messages you're seeing

${detectedLanguage ? `I'll review it following ${detectedLanguage} standards and best practices.` : ''}

Feel free to paste your code and I'll take a look!`;
    }
    
    // Architecture and design questions
    if (lowerMessage.includes('architecture') || lowerMessage.includes('design') || lowerMessage.includes('pattern') || lowerMessage.includes('structure')) {
      return `Great question about software architecture and design! 🏗️

**I can help you with:**
- **System Architecture** - How to structure your application
- **Design Patterns** - Which patterns fit your use case
- **Database Design** - Schema design and relationships
- **API Design** - RESTful APIs, GraphQL, and best practices
- **Component Architecture** - Frontend and backend structure
- **Scalability Planning** - How to build for growth

**Common architecture topics I help with:**
- MVC, MVP, and MVVM patterns
- Microservices vs monolithic architecture
- Database normalization and optimization
- Caching strategies and implementation
- Security architecture and authentication
- Testing strategies and test pyramid

What specific architectural challenge are you working on? Are you:
- Starting a new project and need architecture guidance?
- Refactoring existing code for better structure?
- Deciding between different technical approaches?
- Planning for scale and performance requirements?`;
    }
    
    // Learning and concepts
    if (lowerMessage.includes('learn') || lowerMessage.includes('explain') || lowerMessage.includes('understand') || lowerMessage.includes('how does')) {
      return `I'd love to help you learn and understand programming concepts! 📚

**I can explain:**
- **Programming Fundamentals** - Variables, loops, functions, OOP
- **Advanced Concepts** - Async programming, design patterns, algorithms
- **Language Features** - Language-specific syntax and capabilities  
- **Framework Usage** - How to use popular frameworks and libraries
- **Best Practices** - Writing clean, maintainable, secure code
- **Development Tools** - IDEs, debuggers, version control, testing

**My teaching approach:**
- Start with simple explanations
- Provide practical examples
- Show real-world use cases
- Break complex topics into digestible parts
- Give you hands-on exercises to practice

${detectedLanguage ? `I can focus on ${detectedLanguage}-specific examples and concepts.` : 'What programming language would you like to focus on?'}

What concept would you like me to explain? The more specific you are, the better I can tailor the explanation to your level and needs!`;
    }
    
    // Technology choices and recommendations
    if (lowerMessage.includes('should i use') || lowerMessage.includes('recommend') || lowerMessage.includes('which') || lowerMessage.includes('better')) {
      return `I can help you make informed technology decisions! 🤔

**I can recommend:**
- **Programming Languages** - Which language fits your project
- **Frameworks & Libraries** - Best tools for your use case
- **Databases** - SQL vs NoSQL, specific database choices
- **Cloud Services** - AWS, Azure, GCP options
- **Development Tools** - IDEs, build tools, testing frameworks
- **Architecture Patterns** - Which approach suits your needs

**To give you the best recommendation, tell me:**
- What are you trying to build?
- What's your experience level?
- What are your performance requirements?
- Do you have any constraints (budget, timeline, team size)?
- What's your target deployment environment?

I'll provide you with:
✅ Pros and cons of different options
✅ Real-world considerations
✅ Learning curve assessments
✅ Long-term maintenance implications

What technology decision are you trying to make?`;
    }
    
    // Greeting for code assistant
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return `Hello! I'm your Universal AI Tools code assistant. 👨‍💻

I'm here to help you with all things programming:
- **Code Generation** - Write functions, classes, and components
- **Code Review** - Improve existing code quality and performance  
- **Debugging** - Find and fix bugs in your code
- **Architecture** - Design systems and choose technologies
- **Learning** - Understand concepts and best practices

What coding challenge can I help you with today?`;
    }
    
    // Default code-focused response
    return `I'm your code assistant and I'm here to help with your programming needs! 💻

**Based on your message:** "${message}"

I can help you with:
- **Writing Code** - Functions, classes, APIs, and more
- **Code Review** - Finding issues and improvements
- **Debugging** - Solving errors and unexpected behavior
- **Architecture** - Designing systems and choosing technologies
- **Learning** - Understanding concepts and best practices

${detectedLanguage ? `I noticed you mentioned ${detectedLanguage} - I can provide specific help with that language.` : ''}

Could you be more specific about what you need help with? For example:
- Are you trying to build something specific?
- Do you have code that needs reviewing or debugging?
- Are you stuck on a particular concept or problem?
- Do you need help choosing technologies or approaches?

The more details you provide, the better I can assist you!`;
  }
}

export default SimpleCodeAssistant;