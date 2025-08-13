#!/usr/bin/env tsx
/**
 * Smart Assistant Agent - Single File Agent (IndyDevDan style)
 * 
 * This agent does ONE thing really well: Understands user intent and coordinates other agents
 * Can trigger face detection, data organization, or use the existing system
 * Learns from interactions to improve over time
 * 
 * Usage:
 *   npx tsx single-file-agents/smart-assistant.ts "Can you help me organize my photos?"
 *   npx tsx single-file-agents/smart-assistant.ts --interactive
 *   npx tsx single-file-agents/smart-assistant.ts --server
 */

import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, appendFile, exists } from 'fs/promises';
import { join } from 'path';
import express from 'express';
import { detectFacesInImage, processBatch, openMacPhotos } from './face-detector';
import { createOrganizedProfiles } from './data-organizer';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  models: {
    openai: process.env.OPENAI_API_KEY ? 'gpt-4-turbo-preview' : null,
    anthropic: process.env.ANTHROPIC_API_KEY ? 'claude-3-opus-20240229' : null,
    ollama: 'llama3.2:3b'  // Fallback to local
  },
  learningFile: 'assistant-learning.json',
  port: 8888
};

// Intent types the assistant can recognize
type Intent = 
  | 'face_detection'
  | 'organize_data' 
  | 'open_photos'
  | 'general_chat'
  | 'code_help'
  | 'system_info'
  | 'unknown';

interface ConversationContext {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  detectedIntents: Intent[];
  executedActions: string[];
  learnings: Record<string, any>;
}

interface LearningData {
  intents: Record<string, string[]>;  // Intent -> example phrases
  successful_flows: Array<{
    input: string;
    intent: Intent;
    actions: string[];
    feedback: number;
  }>;
  improvements: string[];
}

/**
 * Detect user intent from their message
 */
async function detectIntent(message: string, context: ConversationContext): Promise<Intent> {
  const lowerMessage = message.toLowerCase();
  
  // Direct intent detection based on keywords
  const intentPatterns: Record<Intent, RegExp[]> = {
    face_detection: [
      /detect.*face/i,
      /face.*detect/i,
      /find.*people/i,
      /who.*photo/i,
      /recognize/i
    ],
    organize_data: [
      /organize/i,
      /group/i,
      /profile/i,
      /categorize/i,
      /structure.*data/i,
      /label.*together/i
    ],
    open_photos: [
      /open.*photo/i,
      /photo.*app/i,
      /mac.*photo/i,
      /show.*photo/i,
      /pull.*media/i
    ],
    code_help: [
      /code/i,
      /function/i,
      /implement/i,
      /debug/i,
      /program/i
    ],
    system_info: [
      /system/i,
      /status/i,
      /health/i,
      /performance/i
    ],
    general_chat: [
      /hello/i,
      /help/i,
      /how.*are/i,
      /thank/i
    ],
    unknown: []
  };
  
  // Check patterns
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerMessage)) {
        console.log(`🎯 Detected intent: ${intent}`);
        return intent as Intent;
      }
    }
  }
  
  // If we have an AI model available, use it for better intent detection
  const aiIntent = await detectIntentWithAI(message, context);
  if (aiIntent !== 'unknown') {
    return aiIntent;
  }
  
  // Check context for clues
  if (context.detectedIntents.length > 0) {
    const lastIntent = context.detectedIntents[context.detectedIntents.length - 1];
    if (lowerMessage.includes('yes') || lowerMessage.includes('sure') || lowerMessage.includes('ok')) {
      return lastIntent;
    }
  }
  
  return 'general_chat';
}

/**
 * Use AI model for intent detection if available
 */
async function detectIntentWithAI(message: string, context: ConversationContext): Promise<Intent> {
  try {
    // Try Ollama first (local)
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.models.ollama,
        prompt: `Classify this user message into one of these intents: face_detection, organize_data, open_photos, code_help, system_info, general_chat, unknown.
        
User message: "${message}"
        
Respond with just the intent name.`,
        stream: false
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const intent = data.response.trim().toLowerCase().replace(/_/g, '_') as Intent;
      if (['face_detection', 'organize_data', 'open_photos', 'code_help', 'system_info', 'general_chat'].includes(intent)) {
        return intent;
      }
    }
  } catch (error) {
    // Ollama not available, fallback to pattern matching
  }
  
  return 'unknown';
}

/**
 * Execute action based on intent
 */
async function executeAction(intent: Intent, message: string, context: ConversationContext): Promise<string> {
  console.log(`🚀 Executing action for intent: ${intent}`);
  context.detectedIntents.push(intent);
  
  switch (intent) {
    case 'face_detection': {
      context.executedActions.push('face_detection');
      
      // Check if user mentioned a specific path
      const pathMatch = message.match(/["']([^"']+)["']/);
      if (pathMatch) {
        const path = pathMatch[1];
        console.log(`📸 Detecting faces in: ${path}`);
        
        // Check if it's a directory or file
        try {
          const stats = await Bun.file(path).exists();
          if (stats) {
            const result = await detectFacesInImage(path);
            return `Found ${result.faces.length} face(s) in the image:\n${JSON.stringify(result.faces.map(f => ({
              age: f.age,
              gender: f.gender,
              expression: f.expression,
              confidence: `${(f.confidence * 100).toFixed(1)}%`
            })), null, 2)}`;
          }
        } catch (error) {
          return `I can help you detect faces! Please provide a valid image path or use --batch with a directory of images.`;
        }
      }
      
      return `I can help you detect faces in images! Here's how:
1. For a single image: Provide the path to the image
2. For multiple images: I can process a whole directory
3. Open Mac Photos: I can help you access your Photos library

Which would you like to do?`;
    }
    
    case 'organize_data': {
      context.executedActions.push('organize_data');
      
      // Check if we have face detection results to organize
      const resultsPath = join(process.cwd(), 'face-detection-results.json');
      try {
        if (await Bun.file(resultsPath).exists()) {
          console.log('📊 Organizing existing face detection data...');
          const organized = await createOrganizedProfiles(resultsPath);
          
          return `I've organized your data into ${organized.profiles.length} profiles!

📊 Summary:
- Total people: ${organized.statistics.totalPeople}
- Average age: ${organized.statistics.averageAge}
- Gender distribution: ${JSON.stringify(organized.statistics.genderDistribution)}
- ${organized.relationships.length} relationships detected

The organized profiles have been saved to 'organized-profiles.json'.`;
        }
      } catch (error) {
        // No existing results
      }
      
      return `I can help organize your data into structured profiles! 

To get started:
1. First, I need to detect faces in your images
2. Then I'll organize them into profiles by age, gender, and relationships
3. Finally, I'll create a structured dataset you can use

Shall we start by detecting faces in your photos?`;
    }
    
    case 'open_photos': {
      context.executedActions.push('open_photos');
      console.log('📱 Opening Mac Photos app...');
      await openMacPhotos();
      
      return `I've opened the Mac Photos app for you! 

To analyze your photos:
1. Export the photos you want to analyze from Photos app
2. Tell me the directory where you exported them
3. I'll detect faces and organize them into profiles

Ready when you are!`;
    }
    
    case 'code_help': {
      context.executedActions.push('code_help');
      return `I can help with coding! What would you like to:
1. Generate new code
2. Debug existing code
3. Refactor code for simplicity
4. Explain how something works

What coding task can I help you with?`;
    }
    
    case 'system_info': {
      context.executedActions.push('system_info');
      
      // Check if main server is running
      try {
        const response = await fetch('http://localhost:9999/api/v1/status');
        if (response.ok) {
          const status = await response.json();
          return `System Status: ✅ Online
- Version: ${status.version}
- Uptime: ${status.uptime}
- Available agents: ${status.agents?.length || 0}
- Health: ${status.health}%`;
        }
      } catch (error) {
        // Server not running
      }
      
      return `System Status: 
- Smart Assistant: ✅ Active
- Face Detector: ✅ Available
- Data Organizer: ✅ Available
- Main Server: ❌ Offline (start with 'npm run dev')

I'm running in standalone mode using single-file agents.`;
    }
    
    case 'general_chat':
    default:
      return `I'm your smart assistant! I can help you with:

🎯 **Face Detection**: Detect and analyze faces in your photos
📊 **Data Organization**: Create structured profiles from your data
📸 **Photos App**: Open and work with Mac Photos
💻 **Coding**: Generate, debug, or refactor code
📈 **System Info**: Check system status

What would you like to do today?`;
  }
}

/**
 * Generate response using AI if available
 */
async function generateAIResponse(message: string, context: ConversationContext): Promise<string> {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.models.ollama,
        prompt: `You are a helpful assistant that can detect faces, organize data, and help with various tasks.
        
Previous context: ${JSON.stringify(context.messages.slice(-3))}
User: ${message}

Provide a helpful, concise response.`,
        stream: false
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.response;
    }
  } catch (error) {
    // Ollama not available
  }
  
  return 'I understand you want help, but I need more specific information. Could you tell me what you\'d like to do?';
}

/**
 * Learn from interaction
 */
async function learnFromInteraction(
  message: string, 
  intent: Intent, 
  response: string,
  context: ConversationContext
): Promise<void> {
  const learningPath = join(process.cwd(), CONFIG.learningFile);
  
  let learningData: LearningData = {
    intents: {},
    successful_flows: [],
    improvements: []
  };
  
  try {
    if (await Bun.file(learningPath).exists()) {
      const data = await readFile(learningPath, 'utf-8');
      learningData = JSON.parse(data);
    }
  } catch (error) {
    // Start fresh
  }
  
  // Record intent example
  if (!learningData.intents[intent]) {
    learningData.intents[intent] = [];
  }
  if (!learningData.intents[intent].includes(message)) {
    learningData.intents[intent].push(message);
  }
  
  // Record successful flow
  learningData.successful_flows.push({
    input: message,
    intent,
    actions: context.executedActions,
    feedback: 1  // Assume positive unless told otherwise
  });
  
  // Keep only recent flows
  if (learningData.successful_flows.length > 100) {
    learningData.successful_flows = learningData.successful_flows.slice(-100);
  }
  
  await writeFile(learningPath, JSON.stringify(learningData, null, 2));
}

/**
 * Interactive chat mode
 */
async function interactiveMode() {
  console.log('🤖 Smart Assistant - Interactive Mode');
  console.log('Type "exit" to quit\n');
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const context: ConversationContext = {
    messages: [],
    detectedIntents: [],
    executedActions: [],
    learnings: {}
  };
  
  const question = (prompt: string): Promise<string> => {
    return new Promise(resolve => {
      rl.question(prompt, resolve);
    });
  };
  
  while (true) {
    const message = await question('You: ');
    
    if (message.toLowerCase() === 'exit') {
      console.log('Goodbye! 👋');
      rl.close();
      break;
    }
    
    // Detect intent
    const intent = await detectIntent(message, context);
    
    // Execute action
    const response = await executeAction(intent, message, context);
    
    // Learn from interaction
    await learnFromInteraction(message, intent, response, context);
    
    // Update context
    context.messages.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response }
    );
    
    console.log(`\nAssistant: ${response}\n`);
  }
}

/**
 * Server mode - REST API
 */
async function serverMode() {
  const app = express();
  app.use(express.json());
  
  const contexts = new Map<string, ConversationContext>();
  
  // Chat endpoint
  app.post('/chat', async (req, res) => {
    const { message, sessionId = 'default' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }
    
    // Get or create context
    let context = contexts.get(sessionId);
    if (!context) {
      context = {
        messages: [],
        detectedIntents: [],
        executedActions: [],
        learnings: {}
      };
      contexts.set(sessionId, context);
    }
    
    // Process message
    const intent = await detectIntent(message, context);
    const response = await executeAction(intent, message, context);
    
    // Learn
    await learnFromInteraction(message, intent, response, context);
    
    // Update context
    context.messages.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response }
    );
    
    res.json({
      response,
      intent,
      actions: context.executedActions
    });
  });
  
  // Status endpoint
  app.get('/status', (req, res) => {
    res.json({
      status: 'active',
      sessions: contexts.size,
      capabilities: [
        'face_detection',
        'data_organization',
        'photo_management',
        'code_assistance'
      ]
    });
  });
  
  app.listen(CONFIG.port, () => {
    console.log(`🚀 Smart Assistant Server running on http://localhost:${CONFIG.port}`);
    console.log('Endpoints:');
    console.log(`  POST /chat - Send messages`);
    console.log(`  GET /status - Check status`);
  });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Smart Assistant Agent - Single File Agent
Usage:
  <message>         Process a single message
  --interactive     Start interactive chat mode
  --server         Start REST API server
  --help           Show this help message

Examples:
  npx tsx single-file-agents/smart-assistant.ts "Help me organize my photos"
  npx tsx single-file-agents/smart-assistant.ts --interactive
  npx tsx single-file-agents/smart-assistant.ts --server
    `);
    return;
  }
  
  if (args[0] === '--interactive') {
    await interactiveMode();
  } else if (args[0] === '--server') {
    await serverMode();
  } else {
    // Single message mode
    const message = args.join(' ');
    const context: ConversationContext = {
      messages: [],
      detectedIntents: [],
      executedActions: [],
      learnings: {}
    };
    
    const intent = await detectIntent(message, context);
    const response = await executeAction(intent, message, context);
    
    console.log(`\n🎯 Intent: ${intent}`);
    console.log(`\n${response}`);
    
    await learnFromInteraction(message, intent, response, context);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use by other agents or the dispatcher
export { 
  detectIntent,
  executeAction,
  type Intent,
  type ConversationContext
};