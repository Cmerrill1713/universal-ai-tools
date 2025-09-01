/**
 * Voice Intent Classification Service
 * Analyzes voice commands and determines user intent with entity extraction
 */

import { LogContext, log } from '../utils/logger';

export interface IntentClassification {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  keywords: string[];
  needsClarification?: boolean;
  clarificationPrompt?: string;
  expectedResponses?: string[];
  context?: any;
}

export interface EntityMatch {
  value: string;
  type: string;
  start: number;
  end: number;
  confidence: number;
}

interface IntentPattern {
  intent: string;
  patterns: RegExp[];
  keywords: string[];
  entities: string[];
  weight: number;
}

class VoiceIntentService {
  private intentPatterns: IntentPattern[] = [];
  private entityPatterns: Map<string, RegExp[]> = new Map();
  
  constructor() {
    this.initializeIntentPatterns();
    this.initializeEntityPatterns();
  }

  /**
   * Initialize intent recognition patterns
   */
  private initializeIntentPatterns(): void {
    this.intentPatterns = [
      // Coding and Project Creation Intents
      {
        intent: 'project_creation',
        patterns: [
          /\b(create|build|make|generate).*(app|application|website|project|program)\b/i,
          /\b(build\s+me|create\s+a|make\s+me|generate\s+a).*(calculator|todo|weather|chat|game|dashboard)\b/i,
          /\b(new\s+project|start\s+project|scaffold|initialize)\b/i,
          /\b(code\s+a|write\s+a|develop\s+a).*(app|website|tool|utility)\b/i,
          // Enhanced patterns for complex project descriptions
          /\bcomplete.*?(node\.?js|express|react|angular|vue).*?(api|server|application)\b/i,
          /\b(create|build|make|setup|set\s+up).*?(complete|full|entire).*?(project|app|system)\b/i,
          /(express|node\.?js|typescript|javascript).*?(framework|server|api)/i,
          /\b(api|server|backend|frontend|full-?stack).*?(with|using|and).*?(features|functionality)\b/i,
          /\b\d+\.\s*(express|typescript|jwt|auth|crud|validation|endpoint)/i  // Numbered lists with tech terms
        ],
        keywords: ['create', 'build', 'make', 'generate', 'complete', 'app', 'website', 'project', 'calculator', 'todo', 'game', 'develop', 'server', 'api', 'express', 'nodejs', 'typescript', 'framework', 'authentication', 'crud', 'endpoint', 'features', 'setup'],
        entities: ['app_type', 'programming_language', 'framework'],
        weight: 1.2
      },
      {
        intent: 'code_generation',
        patterns: [
          /\b(write|create|generate).*(code|function|component|class|method)\b/i,
          /\b(implement|add|code).*(feature|functionality|logic)\b/i,
          /\b(react\s+component|vue\s+component|angular\s+component)\b/i,
          /\b(api\s+endpoint|database\s+model|utility\s+function)\b/i,
          // Enhanced patterns for complex code requests
          /\b(python|javascript|typescript|java|node\.?js).*?(script|function|class|module)\b/i,
          /\b(algorithm|sorting|data\s+structure|function).*(complex|advanced|efficient)\b/i,
          /\b(generate|create|write).*?(algorithm|function|method|script)\b/i
        ],
        keywords: ['write', 'create', 'generate', 'code', 'function', 'component', 'implement', 'feature', 'react', 'api', 'python', 'javascript', 'typescript', 'algorithm', 'script', 'method', 'class', 'module'],
        entities: ['code_type', 'framework', 'programming_language'],
        weight: 1.2
      },
      {
        intent: 'debugging',
        patterns: [
          /\b(fix|debug|solve|resolve).*(error|bug|issue|problem)\b/i,
          /\b(something.*(wrong|broken)|not\s+working|failing)\b/i,
          /\b(troubleshoot|diagnose|investigate).*(code|function|application)\b/i,
          /\b(syntax\s+error|runtime\s+error|compilation\s+error)\b/i
        ],
        keywords: ['fix', 'debug', 'solve', 'error', 'bug', 'issue', 'problem', 'broken', 'troubleshoot', 'syntax'],
        entities: ['error_type', 'programming_language', 'code_location'],
        weight: 1.1
      },

      // Home Automation Intents
      {
        intent: 'home_control',
        patterns: [
          /\b(turn\s+on|turn\s+off|switch\s+on|switch\s+off).*(light|lights|lamp|bulb|fan)\b/i,
          /\b(dim|brighten|adjust).*(light|lights|brightness)\b/i,
          /\b(set\s+temperature|adjust\s+thermostat|heat|cool|climate)\b/i,
          /\b(lock|unlock).*(door|doors|house)\b/i,
          /\b(start|stop|play|pause).*(music|tv|television|media)\b/i,
          /\b(temperature.*degrees|set.*degrees|degrees)\b/i
        ],
        keywords: ['turn', 'switch', 'light', 'lights', 'dim', 'brighten', 'temperature', 'thermostat', 'lock', 'unlock', 'music', 'tv', 'fan', 'degrees'],
        entities: ['device', 'action', 'location', 'value'],
        weight: 1.3
      },
      {
        intent: 'smart_home',
        patterns: [
          /\b(run|execute|trigger).*(scene|automation|routine)\b/i,
          /\b(good\s+morning|good\s+night|bedtime|wake\s+up).*(routine|scene)\b/i,
          /\b(security\s+system|alarm|cameras|sensors)\b/i,
          /\b(all\s+lights|house\s+lights|downstairs|upstairs)\b/i
        ],
        keywords: ['scene', 'automation', 'routine', 'security', 'alarm', 'cameras', 'all', 'house', 'downstairs', 'upstairs'],
        entities: ['scene_name', 'location', 'device_group'],
        weight: 1.2
      },

      // Email and Communication Intents
      {
        intent: 'email_check',
        patterns: [
          /\b(check|read|show).*(email|emails|mail|inbox|messages)\b/i,
          /\b(any\s+new\s+email|new\s+messages|unread\s+mail)\b/i,
          /\b(what.*(email|mail|messages)|inbox\s+status)\b/i
        ],
        keywords: ['check', 'read', 'email', 'emails', 'mail', 'inbox', 'messages', 'new', 'unread'],
        entities: ['email_folder', 'sender', 'time_frame'],
        weight: 1.1
      },
      {
        intent: 'email_compose',
        patterns: [
          /\b(send|write|compose|draft).*(email|mail|message)\b/i,
          /\b(email\s+to|send\s+to|message\s+to|write\s+to)\b/i,
          /\b(reply|respond|answer).*(email|message)\b/i
        ],
        keywords: ['send', 'write', 'compose', 'email', 'mail', 'message', 'reply', 'respond'],
        entities: ['recipient', 'subject', 'message_type'],
        weight: 1.1
      },

      // Task Management Intents
      {
        intent: 'task_creation',
        patterns: [
          /\b(create|add|new).*(task|todo|reminder|note)\b/i,
          /\b(remind\s+me|remember\s+to|don.t\s+forget)\b/i,
          /\b(schedule|plan|organize).*(meeting|appointment|event)\b/i,
          /\b(to\s+do|task\s+list|agenda)\b/i
        ],
        keywords: ['create', 'add', 'task', 'todo', 'reminder', 'remind', 'remember', 'schedule', 'meeting'],
        entities: ['task_type', 'due_date', 'priority', 'description'],
        weight: 1.1
      },
      {
        intent: 'project_management',
        patterns: [
          /\b(show|list|what).*(tasks|projects|agenda|schedule|calendar)\b/i,
          /\b(what.*(working\s+on|doing\s+today|next|planned))\b/i,
          /\b(progress|status|update).*(project|tasks)\b/i,
          /\b(deadline|due\s+date|timeline)\b/i
        ],
        keywords: ['show', 'list', 'tasks', 'projects', 'agenda', 'progress', 'status', 'deadline', 'timeline'],
        entities: ['time_frame', 'project_name', 'status_type'],
        weight: 1.0
      },

      // System and Technical Intents  
      {
        intent: 'system_status',
        patterns: [
          /\b(what|how|check).*(system|status|health|running|working|up|online)\b/i,
          /\b(is\s+everything|all\s+good|system\s+ok|health\s+check)\b/i,
          /\b(uptime|performance|metrics|monitoring|resources)\b/i,
          /\b(cpu|memory|disk|network).*(usage|status|performance)\b/i
        ],
        keywords: ['system', 'status', 'health', 'uptime', 'running', 'working', 'performance', 'metrics', 'cpu', 'memory'],
        entities: ['metric_type', 'resource_type'],
        weight: 1.0
      },
      {
        intent: 'system_control',
        patterns: [
          /\b(restart|reboot|shutdown|stop|start).*(system|server|service)\b/i,
          /\b(kill|terminate|end).*(process|application|service)\b/i,
          /\b(backup|restore|sync|update)\b/i,
          /\b(install|uninstall|configure).*(package|software|service)\b/i
        ],
        keywords: ['restart', 'reboot', 'shutdown', 'stop', 'start', 'kill', 'backup', 'restore', 'install', 'configure'],
        entities: ['action_type', 'target', 'service_name'],
        weight: 1.0
      },
      {
        intent: 'get_news',
        patterns: [
          /\b(show|get|what|latest|recent).*(news|headlines|updates|stories)\b/i,
          /\b(what.*(happening|going\s+on)|news\s+today)\b/i,
          /\b(headlines|breaking|current\s+events)\b/i
        ],
        keywords: ['news', 'headlines', 'updates', 'stories', 'happening', 'current', 'breaking'],
        entities: ['news_category', 'time_frame'],
        weight: 1.0
      },
      {
        intent: 'code_assistance',
        patterns: [
          /\b(help|assist|review|explain|debug).*(code|function|method|class|bug|error)\b/i,
          /\b(code\s+review|fix\s+this|what.*(wrong|error)|debug)\b/i,
          /\b(typescript|javascript|python|programming|develop)\b/i
        ],
        keywords: ['code', 'function', 'method', 'debug', 'error', 'review', 'programming', 'typescript'],
        entities: ['programming_language', 'error_type'],
        weight: 1.0
      },
      {
        intent: 'planning',
        patterns: [
          /\b(create|make|build|plan).*(plan|strategy|project|feature)\b/i,
          /\b(how\s+to|steps|approach|implement)\b/i,
          /\b(roadmap|timeline|schedule|organize)\b/i
        ],
        keywords: ['plan', 'create', 'build', 'implement', 'strategy', 'project', 'roadmap', 'timeline'],
        entities: ['project_type', 'time_frame'],
        weight: 1.0
      },
      {
        intent: 'search',
        patterns: [
          /\b(search|find|look\s+for|research).*(information|details|about)\b/i,
          /\b(what\s+is|tell\s+me\s+about|information\s+on)\b/i,
          /\b(research|investigate|explore)\b/i
        ],
        keywords: ['search', 'find', 'research', 'information', 'details', 'about', 'investigate'],
        entities: ['search_topic', 'search_scope'],
        weight: 1.0
      },
      {
        intent: 'memory',
        patterns: [
          /\b(remember|store|save|recall|forget).*(this|that|information)\b/i,
          /\b(what\s+do\s+you\s+know|previous|history|past)\b/i,
          /\b(memory|memories|knowledge|learned)\b/i
        ],
        keywords: ['remember', 'store', 'recall', 'memory', 'knowledge', 'history', 'previous'],
        entities: ['memory_type', 'storage_key'],
        weight: 1.0
      },
      {
        intent: 'help',
        patterns: [
          /\b(help|what\s+can\s+you|commands|capabilities|features)\b/i,
          /\b(how\s+to\s+use|instructions|guide|tutorial)\b/i,
          /\b(available\s+options|what\s+else)\b/i
        ],
        keywords: ['help', 'commands', 'capabilities', 'features', 'options', 'guide'],
        entities: ['help_topic'],
        weight: 1.0
      },
      {
        intent: 'greeting',
        patterns: [
          /\b(hello|hi|hey|good\s+(morning|afternoon|evening))\b/i,
          /\b(how\s+are\s+you|how.*(going|doing))\b/i
        ],
        keywords: ['hello', 'hi', 'hey', 'good', 'morning', 'afternoon', 'evening'],
        entities: [],
        weight: 0.8
      },
      {
        intent: 'goodbye',
        patterns: [
          /\b(goodbye|bye|see\s+you|farewell|later)\b/i,
          /\b(thank\s+you|thanks|stop|quit|exit)\b/i
        ],
        keywords: ['goodbye', 'bye', 'thanks', 'stop', 'quit', 'exit'],
        entities: [],
        weight: 0.8
      },
      {
        intent: 'play_music',
        patterns: [
          /\b(play|start).*(music|song|playlist|audio)\b/i,
          /\b(listen\s+to|put\s+on).*(music|songs)\b/i
        ],
        keywords: ['play', 'music', 'song', 'listen', 'audio', 'playlist'],
        entities: ['music_service', 'genre', 'artist'],
        weight: 1.0
      },
      {
        intent: 'open_application',
        patterns: [
          /\b(open|launch|start|run).*(app|application|program)\b/i,
          /\b(open|launch)\s+(\w+)(?:\s+app)?\b/i
        ],
        keywords: ['open', 'launch', 'start', 'run', 'app', 'application'],
        entities: ['application_name'],
        weight: 1.0
      },
      {
        intent: 'send_message',
        patterns: [
          /\b(send|write|compose).*(message|text|email)\b/i,
          /\b(message|text|email)\s+(\w+)\b/i
        ],
        keywords: ['send', 'message', 'text', 'email', 'write', 'compose'],
        entities: ['recipient', 'message_type'],
        weight: 1.0
      },
      {
        intent: 'set_reminder',
        patterns: [
          /\b(remind|set\s+reminder|schedule).*(me|reminder)\b/i,
          /\b(reminder|alarm|notification)\b/i
        ],
        keywords: ['remind', 'reminder', 'schedule', 'alarm', 'notification'],
        entities: ['reminder_time', 'reminder_content'],
        weight: 1.0
      },
      {
        intent: 'check_weather',
        patterns: [
          /\b(weather|forecast|temperature)\b/i,
          /\b(how.*(hot|cold|warm)|what.*weather)\b/i
        ],
        keywords: ['weather', 'forecast', 'temperature', 'hot', 'cold', 'warm'],
        entities: ['location', 'time_frame'],
        weight: 1.0
      },
      {
        intent: 'system_control',
        patterns: [
          /\b(volume\s+(up|down)|mute|unmute)\b/i,
          /\b(lock\s+screen|sleep|shut\s*down|restart)\b/i,
          /\b(brightness\s+(up|down))\b/i
        ],
        keywords: ['volume', 'mute', 'unmute', 'lock', 'screen', 'sleep', 'brightness'],
        entities: ['system_action', 'volume_level'],
        weight: 1.0
      }
    ];
  }

  /**
   * Initialize entity extraction patterns
   */
  private initializeEntityPatterns(): void {
    this.entityPatterns.set('time_frame', [
      /\b(today|yesterday|tomorrow|this\s+(week|month|year))\b/i,
      /\b(last\s+(hour|day|week|month|year))\b/i,
      /\b(next\s+(hour|day|week|month|year))\b/i,
      /\b(\d+)\s+(minute|hour|day|week|month)s?\s+(ago|from\s+now)\b/i
    ]);

    this.entityPatterns.set('programming_language', [
      /\b(typescript|javascript|python|java|rust|go|c\+\+|c#|swift|kotlin)\b/i
    ]);

    this.entityPatterns.set('news_category', [
      /\b(tech|technology|business|sports|politics|entertainment|health|science)\b/i,
      /\b(world|local|national|international|breaking)\b/i
    ]);

    this.entityPatterns.set('metric_type', [
      /\b(cpu|memory|disk|network|uptime|performance|response\s+time)\b/i
    ]);

    this.entityPatterns.set('project_type', [
      /\b(website|app|application|api|service|feature|component)\b/i,
      /\b(mobile|web|desktop|backend|frontend|full-stack)\b/i
    ]);

    this.entityPatterns.set('error_type', [
      /\b(syntax|runtime|logic|type|compilation|network|database)\b/i,
      /\b(undefined|null|reference|memory|permission)\b/i
    ]);

    this.entityPatterns.set('music_service', [
      /\b(spotify|pandora|apple\s+music|youtube|soundcloud|amazon\s+music)\b/i,
      /\b(itunes|deezer|tidal|radio)\b/i
    ]);

    this.entityPatterns.set('application_name', [
      /\b(chrome|firefox|safari|edge|brave)\b/i,
      /\b(vscode|code|sublime|atom|notepad)\b/i,
      /\b(slack|discord|teams|zoom|skype)\b/i,
      /\b(photoshop|illustrator|figma|sketch)\b/i,
      /\b(terminal|command\s+prompt|powershell)\b/i
    ]);

    this.entityPatterns.set('message_type', [
      /\b(text|sms|email|slack|teams|discord)\b/i,
      /\b(whatsapp|telegram|messenger)\b/i
    ]);

    this.entityPatterns.set('location', [
      /\b(here|local|current\s+location)\b/i,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/  // City names
    ]);

    this.entityPatterns.set('genre', [
      /\b(rock|pop|jazz|classical|electronic|hip\s+hop|country|blues)\b/i,
      /\b(metal|punk|reggae|folk|r&b|soul|funk)\b/i
    ]);
  }

  /**
   * Classify intent from voice command
   */
  async classifyIntent(command: string): Promise<IntentClassification> {
    try {
      const normalizedCommand = this.normalizeCommand(command);
      const scores: Array<{ intent: string; score: number; matchedKeywords: string[] }> = [];

      log.debug('🔍 Classifying voice intent', LogContext.API, {
        command: command.substring(0, 100),
        normalizedCommand: normalizedCommand.substring(0, 100)
      });

      // Score each intent pattern
      for (const pattern of this.intentPatterns) {
        const score = this.calculateIntentScore(normalizedCommand, pattern);
        if (score.score > 0) {
          scores.push({
            intent: pattern.intent,
            score: score.score,
            matchedKeywords: score.matchedKeywords
          });
        }
      }

      // Sort by score and get best match
      scores.sort((a, b) => b.score - a.score);
      
      const bestMatch = scores[0];
      const intent = bestMatch ? bestMatch.intent : 'general_query';
      const confidence = bestMatch ? Math.min(bestMatch.score, 1.0) : 0.3;

      // Extract entities
      const entities = await this.extractEntities(normalizedCommand, intent);

      // Check if clarification is needed
      const clarificationNeeded = this.checkForClarification(intent, entities, normalizedCommand);

      const classification: IntentClassification = {
        intent,
        confidence,
        entities,
        keywords: bestMatch ? bestMatch.matchedKeywords : [],
        needsClarification: clarificationNeeded.needed,
        clarificationPrompt: clarificationNeeded.prompt,
        expectedResponses: clarificationNeeded.expectedResponses,
        context: {
          allScores: scores.slice(0, 3), // Top 3 scores for debugging
          normalizedCommand
        }
      };

      log.info('🎯 Intent classified', LogContext.API, {
        intent,
        confidence: Math.round(confidence * 100) / 100,
        keywordCount: classification.keywords.length,
        entityCount: Object.keys(entities).length,
        needsClarification: clarificationNeeded.needed
      });

      return classification;

    } catch (error) {
      log.error('❌ Intent classification failed', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        command: command.substring(0, 100)
      });

      // Return fallback classification
      return {
        intent: 'general_query',
        confidence: 0.1,
        entities: {},
        keywords: [],
        context: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Normalize command text for better matching
   */
  private normalizeCommand(command: string): string {
    return command
      .toLowerCase()
      .replace(/^(hey|hi|hello)\s+(athena|assistant)[,\s]*/, '') // Remove wake word
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate intent match score
   */
  private calculateIntentScore(
    command: string, 
    pattern: IntentPattern
  ): { score: number; matchedKeywords: string[] } {
    let totalScore = 0;
    const matchedKeywords: string[] = [];

    // Check regex patterns
    let patternMatches = 0;
    for (const regex of pattern.patterns) {
      if (regex.test(command)) {
        patternMatches++;
      }
    }
    
    // Pattern match score (weighted heavily)
    if (patternMatches > 0) {
      totalScore += (patternMatches / pattern.patterns.length) * 0.7;
    }

    // Check keyword matches
    let keywordMatches = 0;
    for (const keyword of pattern.keywords) {
      const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (keywordRegex.test(command)) {
        keywordMatches++;
        matchedKeywords.push(keyword);
      }
    }

    // Keyword match score
    if (keywordMatches > 0) {
      totalScore += (keywordMatches / pattern.keywords.length) * 0.3;
    }

    // Apply pattern weight
    totalScore *= pattern.weight;

    return { score: totalScore, matchedKeywords };
  }

  /**
   * Extract entities from command
   */
  private async extractEntities(command: string, intent: string): Promise<Record<string, any>> {
    const entities: Record<string, any> = {};

    for (const [entityType, patterns] of this.entityPatterns.entries()) {
      const matches = this.findEntityMatches(command, patterns, entityType);
      if (matches.length > 0) {
        entities[entityType] = matches.length === 1 ? matches[0] : matches;
      }
    }

    // Add intent-specific entity extraction
    await this.extractIntentSpecificEntities(command, intent, entities);

    return entities;
  }

  /**
   * Find entity matches using patterns
   */
  private findEntityMatches(command: string, patterns: RegExp[], entityType: string): EntityMatch[] {
    const matches: EntityMatch[] = [];

    for (const pattern of patterns) {
      const regexMatches = [...command.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))];
      
      for (const match of regexMatches) {
        if (match.index !== undefined) {
          matches.push({
            value: match[0],
            type: entityType,
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.8
          });
        }
      }
    }

    return matches;
  }

  /**
   * Extract intent-specific entities
   */
  private async extractIntentSpecificEntities(
    command: string, 
    intent: string, 
    entities: Record<string, any>
  ): Promise<void> {
    switch (intent) {
      case 'search':
        // Extract search terms
        const searchMatch = command.match(/\b(?:search|find|about|for)\s+(.+?)(?:\s+(?:please|thanks?|in|on)|\s*$)/i);
        if (searchMatch) {
          entities.search_query = searchMatch[1]?.trim() || command;
        }
        break;

      case 'memory':
        // Extract memory operations
        if (/\bremember\b/i.test(command)) {
          const memoryMatch = command.match(/\bremember\s+(?:that\s+)?(.+?)(?:\s+(?:please|thanks?)|\s*$)/i);
          if (memoryMatch) {
            entities.memory_content = memoryMatch[1]?.trim() || command;
            entities.operation = 'store';
          }
        } else if (/\b(?:recall|what.*know)\b/i.test(command)) {
          entities.operation = 'retrieve';
        }
        break;

      case 'code_assistance':
        // Extract code-related entities
        const langMatch = command.match(/\b(typescript|javascript|python|java|rust|go|c\+\+|c#|swift|kotlin)\b/i);
        if (langMatch) {
          entities.programming_language = langMatch[1]?.toLowerCase() || 'general';
        }
        
        if (/\b(?:bug|error|issue|problem)\b/i.test(command)) {
          entities.assistance_type = 'debug';
        } else if (/\b(?:review|check|analyze)\b/i.test(command)) {
          entities.assistance_type = 'review';
        } else if (/\b(?:explain|understand|how)\b/i.test(command)) {
          entities.assistance_type = 'explain';
        }
        break;

      case 'open_application':
        // Extract application name from open commands with better natural language handling
        const appMatches = [
          // "can you launch safari for me", "please open chrome"
          command.match(/\b(?:can\s+you\s+)?(?:please\s+)?(?:open|launch|start|run)\s+([a-z\s]+?)(?:\s+(?:for\s+me|please|now|app|application)|\s*$)/i),
          // "open chrome", "launch vs code", "start slack"  
          command.match(/\b(?:open|launch|start|run)\s+([a-z\s]+?)(?:\s+(?:please|now|app|application)|\s*$)/i),
          // "chrome" (standalone)
          command.match(/^([a-z\s]+?)(?:\s+(?:please|now|app|application)|\s*$)/i)
        ].find(match => match !== null);
        
        if (appMatches) {
          let appName = appMatches[1]?.trim() || 'app';
          
          // Remove common filler words and possessive pronouns
          appName = appName.replace(/\b(?:for\s+me|please|now|app|application|my|the)\b/gi, '').trim();
          
          // Common app name mappings and aliases
          const appAliases: Record<string, string> = {
            'vs code': 'vscode',
            'visual studio code': 'vscode',
            'google chrome': 'chrome',
            'microsoft teams': 'teams',
            'apple music': 'music',
            'web browser': 'browser',
            'internet browser': 'browser',
            'code editor': 'editor',
            'text editor': 'editor'
          };
          
          // Normalize common variations
          appName = appAliases[appName.toLowerCase()] || appName.toLowerCase();
          entities.application_name = appName;
        }
        break;

      case 'play_music':
        // Extract music service and track information
        const musicServiceMatch = command.match(/\b(?:on|using|via|with|through)\s+([a-z\s]+?)(?:\s|$)/i);
        if (musicServiceMatch) {
          entities.music_service = musicServiceMatch[1]?.trim().toLowerCase() || 'spotify';
        }
        
        // Extract track or artist name
        const trackMatch = command.match(/\b(?:play|start)\s+(?:"([^"]+)"|([^"]+?))\s+(?:on|by|from|\s*$)/i);
        if (trackMatch) {
          entities.track_name = (trackMatch[1] || trackMatch[2] || '').trim();
        }
        break;

      case 'check_weather':
        // Extract location from weather queries
        const locationMatches = [
          command.match(/\b(?:weather|forecast)\s+(?:for|in|at)\s+([a-z\s,]+?)(?:\s+(?:please|today|tomorrow)|\s*$)/i),
          command.match(/\b(?:in|at|for)\s+([a-z\s,]+?)\s*$/i)
        ].find(match => match !== null);
        
        if (locationMatches) {
          entities.location = locationMatches[1]?.trim() || 'unknown';
        } else if (/\b(?:here|current|my)\s+location\b/i.test(command)) {
          entities.location = 'current_location';
        }
        break;

      case 'send_message':
        // Extract recipient and message details
        const recipientMatch = command.match(/\b(?:send|message|text)\s+(?:to\s+)?([a-z\s]+?)(?:\s+(?:that|saying|about)|\s*$)/i);
        if (recipientMatch) {
          entities.recipient = recipientMatch[1]?.trim() || 'unknown';
        }
        
        if (/\b(?:email|mail)\b/i.test(command)) {
          entities.message_type = 'email';
        } else if (/\b(?:text|sms)\b/i.test(command)) {
          entities.message_type = 'sms';
        }
        break;

      case 'system_control':
        // Extract system action
        const systemActions = [
          { pattern: /\bvolume\s+up\b/i, action: 'volume up' },
          { pattern: /\bvolume\s+down\b/i, action: 'volume down' },
          { pattern: /\bmute\b/i, action: 'mute' },
          { pattern: /\bunmute\b/i, action: 'unmute' },
          { pattern: /\block\s+screen\b/i, action: 'lock screen' },
          { pattern: /\bsleep\b/i, action: 'sleep' },
          { pattern: /\bbrightness\s+up\b/i, action: 'brightness up' },
          { pattern: /\bbrightness\s+down\b/i, action: 'brightness down' }
        ];
        
        for (const { pattern, action } of systemActions) {
          if (pattern.test(command)) {
            entities.action = action;
            break;
          }
        }
        break;

      case 'planning':
        // Extract planning scope and type
        const planMatch = command.match(/\b(?:plan|create|build)\s+(?:a\s+)?(.+?)(?:\s+(?:for|with|using)|\s*$)/i);
        if (planMatch) {
          entities.plan_subject = planMatch[1]?.trim() || 'unknown';
        }
        break;

      case 'get_news':
        // Extract news preferences
        if (entities.news_category && Array.isArray(entities.news_category)) {
          entities.news_category = entities.news_category[0].value;
        }
        if (entities.time_frame && Array.isArray(entities.time_frame)) {
          entities.time_frame = entities.time_frame[0].value;
        }
        break;
    }
  }

  /**
   * Check if clarification is needed for the intent
   */
  private checkForClarification(
    intent: string, 
    entities: Record<string, any>, 
    command: string
  ): { needed: boolean; prompt?: string; expectedResponses?: string[] } {
    
    const clarificationRules: Record<string, {
      requiredEntities: string[];
      prompt: string;
      expectedResponses: string[];
    }> = {
      'play_music': {
        requiredEntities: ['music_service'],
        prompt: 'Which music service would you like me to use? I can work with Spotify, Pandora, Apple Music, YouTube, or others.',
        expectedResponses: ['spotify', 'pandora', 'apple music', 'youtube', 'soundcloud', 'amazon music', 'radio']
      },
      'open_application': {
        requiredEntities: ['application_name'],
        prompt: 'Which application would you like me to open? For example, Chrome, VS Code, Slack, or another program.',
        expectedResponses: ['chrome', 'firefox', 'safari', 'vscode', 'code', 'slack', 'discord', 'teams', 'zoom', 'terminal']
      },
      'send_message': {
        requiredEntities: ['recipient', 'message_type'],
        prompt: 'Who would you like to send a message to, and should it be a text, email, or through another service like Slack?',
        expectedResponses: ['text', 'sms', 'email', 'slack', 'teams', 'discord', 'whatsapp', 'telegram']
      },
      'set_reminder': {
        requiredEntities: ['reminder_time', 'reminder_content'],
        prompt: 'When should I remind you, and what should I remind you about?',
        expectedResponses: ['in 5 minutes', 'tomorrow at 9am', 'next week', 'daily', 'meeting', 'call', 'appointment']
      },
      'check_weather': {
        requiredEntities: ['location'],
        prompt: 'Which location would you like the weather for? Your current location or somewhere specific?',
        expectedResponses: ['here', 'current location', 'new york', 'san francisco', 'london', 'tokyo', 'my location']
      }
    };

    const rule = clarificationRules[intent];
    if (!rule) {
      return { needed: false };
    }

    // Check if any required entities are missing
    const missingEntities = rule.requiredEntities.filter(entity => !entities[entity]);
    
    if (missingEntities.length > 0) {
      // Special case: if the command is very short and generic, definitely needs clarification
      const isGeneric = command.split(' ').length <= 3 && !rule.requiredEntities.some(entity => entities[entity]);
      
      if (isGeneric || missingEntities.length === rule.requiredEntities.length) {
        return {
          needed: true,
          prompt: rule.prompt,
          expectedResponses: rule.expectedResponses
        };
      }
    }

    return { needed: false };
  }

  /**
   * Process clarification response
   */
  async processClarificationResponse(
    originalIntent: string, 
    clarificationResponse: string, 
    originalEntities: Record<string, any> = {}
  ): Promise<IntentClassification> {
    
    const normalizedResponse = clarificationResponse.toLowerCase().trim();
    log.info('🔄 Processing clarification response', LogContext.API, {
      originalIntent,
      response: normalizedResponse.substring(0, 50)
    });

    // Extract entities from clarification response
    const clarificationEntities = await this.extractEntities(normalizedResponse, originalIntent);
    
    // Merge with original entities
    const combinedEntities = { ...originalEntities, ...clarificationEntities };

    // Apply intent-specific processing
    switch (originalIntent) {
      case 'play_music':
        if (!combinedEntities.music_service) {
          // Try to extract service from response
          const serviceMatch = normalizedResponse.match(/\b(spotify|pandora|apple\s+music|youtube|soundcloud|amazon\s+music|itunes|radio)\b/i);
          if (serviceMatch) {
            combinedEntities.music_service = serviceMatch[1]?.toLowerCase().replace(/\s+/g, '_') || 'spotify';
          }
        }
        break;

      case 'open_application':
        if (!combinedEntities.application_name) {
          // Try to extract app name from response
          const appMatch = normalizedResponse.match(/\b(chrome|firefox|safari|edge|brave|vscode|code|sublime|atom|slack|discord|teams|zoom|terminal|photoshop)\b/i);
          if (appMatch) {
            combinedEntities.application_name = appMatch[1]?.toLowerCase() || 'unknown';
          }
        }
        break;

      case 'send_message':
        if (!combinedEntities.message_type) {
          const typeMatch = normalizedResponse.match(/\b(text|sms|email|slack|teams|discord|whatsapp|telegram)\b/i);
          if (typeMatch) {
            combinedEntities.message_type = typeMatch[1]?.toLowerCase() || 'unknown';
          }
        }
        if (!combinedEntities.recipient) {
          // Try to extract recipient name (this would need more sophisticated NLP in practice)
          const recipientMatch = normalizedResponse.match(/\bto\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
          if (recipientMatch) {
            combinedEntities.recipient = recipientMatch[1];
          }
        }
        break;

      case 'check_weather':
        if (!combinedEntities.location) {
          if (/\b(here|current|my\s+location)\b/i.test(normalizedResponse)) {
            combinedEntities.location = 'current_location';
          } else {
            // Try to extract city name
            const locationMatch = normalizedResponse.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
            if (locationMatch && locationMatch[1] && locationMatch[1].length > 2) {
              combinedEntities.location = locationMatch[1] || 'unknown';
            }
          }
        }
        break;
    }

    // Check if we still need more clarification
    const stillNeedsClarification = this.checkForClarification(originalIntent, combinedEntities, normalizedResponse);

    return {
      intent: originalIntent,
      confidence: 0.9, // Higher confidence after clarification
      entities: combinedEntities,
      keywords: [normalizedResponse.split(' ')[0] || 'unknown'], // First word as keyword
      needsClarification: stillNeedsClarification.needed,
      clarificationPrompt: stillNeedsClarification.prompt,
      expectedResponses: stillNeedsClarification.expectedResponses,
      context: {
        isClarificationResponse: true,
        originalCommand: normalizedResponse
      }
    };
  }

  /**
   * Update intent patterns (for learning and improvement)
   */
  updateIntentPatterns(intent: string, newPatterns: string[], keywords: string[]): void {
    const existingPattern = this.intentPatterns.find(p => p.intent === intent);
    
    if (existingPattern) {
      // Add new patterns
      const newRegexPatterns = newPatterns.map(p => new RegExp(p, 'i'));
      existingPattern.patterns.push(...newRegexPatterns);
      
      // Add new keywords
      existingPattern.keywords.push(...keywords.filter(k => !existingPattern.keywords.includes(k)));
      
      log.info('📚 Intent patterns updated', LogContext.API, {
        intent,
        newPatterns: newPatterns.length,
        newKeywords: keywords.length,
        totalPatterns: existingPattern.patterns.length,
        totalKeywords: existingPattern.keywords.length
      });
    }
  }

  /**
   * Get intent statistics
   */
  getIntentStatistics(): any {
    const stats = {
      totalIntents: this.intentPatterns.length,
      totalEntityTypes: this.entityPatterns.size,
      intents: this.intentPatterns.map(p => ({
        intent: p.intent,
        patternCount: p.patterns.length,
        keywordCount: p.keywords.length,
        weight: p.weight
      })),
      entityTypes: Array.from(this.entityPatterns.keys()),
      lastUpdated: new Date().toISOString()
    };

    return stats;
  }

  /**
   * Validate and improve classification (for feedback loop)
   */
  async validateClassification(
    command: string, 
    expectedIntent: string, 
    actualClassification: IntentClassification
  ): Promise<void> {
    const isCorrect = actualClassification.intent === expectedIntent;
    
    log.info('✅ Classification validation', LogContext.API, {
      command: command.substring(0, 50),
      expected: expectedIntent,
      actual: actualClassification.intent,
      confidence: actualClassification.confidence,
      isCorrect
    });

    // TODO: Implement learning mechanism
    // This could store feedback for model improvement
  }
}

// Export singleton instance
export const voiceIntentService = new VoiceIntentService();
export default voiceIntentService;