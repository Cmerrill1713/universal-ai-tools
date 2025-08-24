/**
 * Single File Agent Bridge
 * Integrates the single-file agents into the main Universal AI Tools system
 * Provides fallback routing when main agents don't exist or can't handle requests
 */

import { exec } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import type { AgentContext } from '@/types';
import { log, LogContext } from '@/utils/logger';

const execAsync = promisify(exec);

interface SingleFileAgentCapability {
  name: string;
  description: string;
  keywords: string[];
  scriptPath: string;
  confidence: number;
}

interface SingleFileAgentResult {
  success: boolean;
  response: string;
  confidence: number;
  agentUsed: string;
  executionTime: number;
  data?: any;
}

export class SingleFileAgentBridge {
  private capabilities: Map<string, SingleFileAgentCapability> = new Map();
  private baseDir: string;

  constructor() {
    this.baseDir = join(process.cwd(), 'single-file-agents');
    this.initializeCapabilities();
  }

  private initializeCapabilities(): void {
    // Define capabilities of each single-file agent
    const agentCapabilities: SingleFileAgentCapability[] = [
      {
        name: 'smart-assistant',
        description: 'General purpose assistant with intent detection and coordination',
        keywords: ['help', 'assistant', 'general', 'question', 'coordinate'],
        scriptPath: 'smart-assistant.ts',
        confidence: 0.7
      },
      {
        name: 'face-detector',
        description: 'Face detection and recognition in photos and images',
        keywords: ['face', 'detect', 'photo', 'image', 'recognize', 'people', 'person'],
        scriptPath: 'face-detector.ts',
        confidence: 0.9
      },
      {
        name: 'simple-photo-agent',
        description: 'Photo management, organization, and Mac Photos integration',
        keywords: ['photo', 'pictures', 'organize', 'mac photos', 'image management'],
        scriptPath: 'simple-photo-agent.ts',
        confidence: 0.9
      },
      {
        name: 'data-organizer',
        description: 'Data organization, structuring, and profile creation',
        keywords: ['organize', 'data', 'structure', 'profile', 'categorize', 'group'],
        scriptPath: 'data-organizer.ts',
        confidence: 0.8
      },
      {
        name: 'iterative-safety-agent',
        description: 'Safety validation and security checks',
        keywords: ['safety', 'security', 'validate', 'check', 'safe', 'dangerous'],
        scriptPath: 'iterative-safety-agent.ts',
        confidence: 0.8
      }
    ];

    agentCapabilities.forEach(capability => {
      this.capabilities.set(capability.name, capability);
    });

    log.info(`Initialized ${this.capabilities.size} single-file agent capabilities`, LogContext.AGENT);
  }

  /**
   * Detect which single-file agent is best suited for a request
   */
  public detectBestAgent(userRequest: string): SingleFileAgentCapability | null {
    const lowerRequest = userRequest.toLowerCase();
    let bestAgent: SingleFileAgentCapability | null = null;
    let highestScore = 0;

    for (const [name, capability] of this.capabilities) {
      let score = 0;

      // Check keyword matches
      for (const keyword of capability.keywords) {
        if (lowerRequest.includes(keyword.toLowerCase())) {
          score += capability.confidence;
        }
      }

      // Boost score based on specificity
      if (score > 0) {
        // Face detection gets priority for photo-related requests
        if (name === 'face-detector' && (lowerRequest.includes('face') || lowerRequest.includes('detect'))) {
          score *= 1.5;
        }
        
        // Photo agent gets priority for general photo requests
        if (name === 'simple-photo-agent' && lowerRequest.includes('photo')) {
          score *= 1.3;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestAgent = capability;
      }
    }

    return highestScore > 0.5 ? bestAgent : null;
  }

  /**
   * Execute a single-file agent
   */
  public async executeAgent(
    agentName: string,
    userRequest: string,
    context: AgentContext
  ): Promise<SingleFileAgentResult> {
    const startTime = Date.now();
    
    try {
      const capability = this.capabilities.get(agentName);
      if (!capability) {
        throw new Error(`Single-file agent '${agentName}' not found`);
      }

      const scriptPath = join(this.baseDir, capability.scriptPath);
      if (!existsSync(scriptPath)) {
        throw new Error(`Single-file agent script not found: ${scriptPath}`);
      }

      log.info(`Executing single-file agent: ${agentName}`, LogContext.AGENT, {
        userRequest: userRequest.substring(0, 100),
        scriptPath
      });

      // Execute the single-file agent with aggressive timeout for performance
      const command = `npx tsx "${scriptPath}" "${userRequest.replace(/"/g, '\\"')}"`;
      const { stdout, stderr } = await execAsync(command, {
        timeout: 3000, // Further reduced to 3s for chat performance
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 // 1MB buffer limit
      });

      if (stderr && !stdout) {
        throw new Error(`Agent execution error: ${stderr}`);
      }

      // Try to parse JSON response, fallback to raw text
      let response = stdout.trim();
      let data = null;

      try {
        const parsed = JSON.parse(response);
        response = parsed.response || parsed.message || response;
        data = parsed.data || null;
      } catch {
        // Not JSON, use raw response
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        response: response || `${agentName} completed successfully`,
        confidence: capability.confidence,
        agentUsed: agentName,
        executionTime,
        data
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      log.error(`Single-file agent execution failed: ${agentName}`, LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      return {
        success: false,
        response: `I tried to help with ${agentName}, but encountered an issue. Please try rephrasing your request.`,
        confidence: 0.2,
        agentUsed: agentName,
        executionTime
      };
    }
  }

  /**
   * Process a request through the most appropriate single-file agent
   */
  public async processRequest(
    userRequest: string,
    context: AgentContext
  ): Promise<SingleFileAgentResult | null> {
    
    // Detect the best agent for this request
    const bestAgent = this.detectBestAgent(userRequest);
    if (!bestAgent) {
      return null;
    }

    // Execute the agent
    return await this.executeAgent(bestAgent.name, userRequest, context);
  }

  /**
   * Get list of available single-file agents
   */
  public getAvailableAgents(): SingleFileAgentCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Check if single-file agents directory exists and is accessible
   */
  public isAvailable(): boolean {
    return existsSync(this.baseDir);
  }
}

// Singleton instance
export const singleFileAgentBridge = new SingleFileAgentBridge();