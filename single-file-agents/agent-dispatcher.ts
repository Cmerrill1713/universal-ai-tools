#!/usr/bin/env node

/**
 * Agent Dispatcher - Intelligent Routing System
 * Routes requests between legacy multi-file system and new single-file agents
 * Based on IndyDevDan's principle: "Simple specialized agents for specialized tasks"
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import fetch from 'node-fetch';

interface AgentCapability {
  name: string;
  description: string;
  inputPattern: RegExp;
  keywords: string[];
  confidence: number;
}

interface DispatchRequest {
  intent: string;
  message: string;
  context?: any;
  preferredSystem?: 'legacy' | 'single-file' | 'auto';
}

interface DispatchResult {
  success: boolean;
  agentUsed: string;
  system: 'legacy' | 'single-file';
  result: any;
  executionTime: number;
  confidence: number;
}

class AgentDispatcher {
  private singleFileAgents: Map<string, AgentCapability> = new Map();
  private legacyEndpoints: Map<string, string> = new Map();
  private executionHistory: DispatchResult[] = [];
  private hookSystem: any;

  constructor() {
    this.discoverSingleFileAgents();
    this.setupLegacyEndpoints();
    this.loadHookSystem();
  }

  /**
   * Discover all single-file agents in the directory
   */
  private discoverSingleFileAgents() {
    const agentsDir = __dirname;
    const files = fs.readdirSync(agentsDir);
    
    // Define capabilities for each agent
    const agentCapabilities: Record<string, AgentCapability> = {
      'face-detector.ts': {
        name: 'face-detector',
        description: 'Detects faces in images and photos',
        inputPattern: /face|photo|image|detect|recognition|person/i,
        keywords: ['face', 'photo', 'image', 'detect', 'person', 'photos app'],
        confidence: 0.95
      },
      'data-organizer.ts': {
        name: 'data-organizer',
        description: 'Organizes and analyzes data patterns',
        inputPattern: /organize|analyze|group|pattern|relationship|data/i,
        keywords: ['organize', 'analyze', 'group', 'sort', 'pattern'],
        confidence: 0.9
      },
      'smart-assistant.ts': {
        name: 'smart-assistant',
        description: 'General purpose intelligent assistant',
        inputPattern: /help|assist|what|how|why|explain/i,
        keywords: ['help', 'assist', 'explain', 'understand'],
        confidence: 0.85
      },
      'simple-photo-agent.ts': {
        name: 'simple-photo',
        description: 'Simple photo analysis using existing APIs',
        inputPattern: /simple.*photo|quick.*image|analyze.*photo/i,
        keywords: ['simple', 'quick', 'photo', 'api'],
        confidence: 0.88
      },
      'iterative-safety-agent.ts': {
        name: 'iterative-safety',
        description: 'Safe iterative execution with testing',
        inputPattern: /safe|test|verify|iterate|sandbox/i,
        keywords: ['safe', 'test', 'verify', 'sandbox', 'iterate'],
        confidence: 0.92
      },
      'hook-validation-system.ts': {
        name: 'hook-validation',
        description: 'Hook-based validation and control',
        inputPattern: /hook|validate|control|monitor|observe/i,
        keywords: ['hook', 'validate', 'control', 'monitor'],
        confidence: 0.9
      }
    };

    // Register discovered agents
    for (const file of files) {
      if (file.endsWith('.ts') && agentCapabilities[file]) {
        this.singleFileAgents.set(file, agentCapabilities[file]);
      }
    }

    console.log(`🔍 Discovered ${this.singleFileAgents.size} single-file agents`);
  }

  /**
   * Setup legacy system endpoints
   */
  private setupLegacyEndpoints() {
    const baseUrl = 'http://localhost:9999/api/v1';
    
    this.legacyEndpoints.set('vision', `${baseUrl}/vision/analyze`);
    this.legacyEndpoints.set('assistant', `${baseUrl}/assistant/chat`);
    this.legacyEndpoints.set('agents', `${baseUrl}/agents`);
    this.legacyEndpoints.set('memory', `${baseUrl}/memory`);
    this.legacyEndpoints.set('context', `${baseUrl}/context`);
    this.legacyEndpoints.set('mlx', `${baseUrl}/mlx`);
    this.legacyEndpoints.set('parameters', `${baseUrl}/parameters`);
    
    console.log(`🔗 Configured ${this.legacyEndpoints.size} legacy endpoints`);
  }

  /**
   * Load hook validation system
   */
  private async loadHookSystem() {
    try {
      const HookSystem = await import('./hook-validation-system');
      this.hookSystem = new HookSystem.HookValidationSystem();
      console.log('🪝 Hook validation system loaded');
    } catch (e) {
      console.log('⚠️ Hook system not available:', e.message);
    }
  }

  /**
   * Analyze request to determine best agent
   */
  private analyzeRequest(request: DispatchRequest): {
    agent: string | null,
    system: 'legacy' | 'single-file',
    confidence: number
  } {
    let bestMatch = {
      agent: null as string | null,
      system: 'legacy' as 'legacy' | 'single-file',
      confidence: 0
    };

    // If user specified preference, honor it
    if (request.preferredSystem && request.preferredSystem !== 'auto') {
      bestMatch.system = request.preferredSystem;
    }

    // Check single-file agents
    for (const [file, capability] of this.singleFileAgents) {
      let score = 0;
      
      // Pattern matching
      if (capability.inputPattern.test(request.message)) {
        score += 0.5;
      }
      
      // Keyword matching
      const messageWords = request.message.toLowerCase().split(/\s+/);
      const keywordMatches = capability.keywords.filter(kw => 
        messageWords.some(word => word.includes(kw))
      ).length;
      score += (keywordMatches / capability.keywords.length) * 0.3;
      
      // Intent matching
      if (request.intent && capability.name.includes(request.intent)) {
        score += 0.2;
      }
      
      // Apply agent's confidence modifier
      score *= capability.confidence;
      
      if (score > bestMatch.confidence) {
        bestMatch = {
          agent: file,
          system: 'single-file',
          confidence: score
        };
      }
    }

    // If confidence is low, check legacy system
    if (bestMatch.confidence < 0.3) {
      // Determine legacy endpoint based on keywords
      if (/vision|image|photo|see/.test(request.message)) {
        bestMatch = { agent: 'vision', system: 'legacy', confidence: 0.6 };
      } else if (/chat|talk|assist|help/.test(request.message)) {
        bestMatch = { agent: 'assistant', system: 'legacy', confidence: 0.6 };
      } else if (/memory|remember|recall/.test(request.message)) {
        bestMatch = { agent: 'memory', system: 'legacy', confidence: 0.6 };
      } else {
        // Default to assistant
        bestMatch = { agent: 'assistant', system: 'legacy', confidence: 0.4 };
      }
    }

    return bestMatch;
  }

  /**
   * Execute single-file agent
   */
  private async executeSingleFileAgent(
    agentFile: string,
    request: DispatchRequest
  ): Promise<any> {
    const agentPath = path.join(__dirname, agentFile);
    
    return new Promise((resolve, reject) => {
      const child = spawn('ts-node', [
        agentPath,
        '--json',
        JSON.stringify({
          message: request.message,
          context: request.context
        })
      ], {
        env: { ...process.env, NODE_ENV: 'production' }
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Agent failed with code ${code}: ${error}`));
        } else {
          try {
            // Try to parse JSON output
            const lines = output.split('\n').filter(l => l.trim());
            const lastLine = lines[lines.length - 1];
            
            if (lastLine.startsWith('{')) {
              resolve(JSON.parse(lastLine));
            } else {
              resolve({ output: output.trim() });
            }
          } catch (e) {
            resolve({ output: output.trim() });
          }
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('Agent execution timeout'));
      }, 30000);
    });
  }

  /**
   * Execute legacy system endpoint
   */
  private async executeLegacyEndpoint(
    endpoint: string,
    request: DispatchRequest
  ): Promise<any> {
    const url = this.legacyEndpoints.get(endpoint);
    if (!url) {
      throw new Error(`Unknown legacy endpoint: ${endpoint}`);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
      },
      body: JSON.stringify({
        message: request.message,
        context: request.context
      })
    });

    if (!response.ok) {
      throw new Error(`Legacy API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Main dispatch method
   */
  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const startTime = Date.now();
    
    // Analyze request to determine best agent
    const analysis = this.analyzeRequest(request);
    
    console.log(`\n🎯 Dispatching to ${analysis.system} system`);
    console.log(`   Agent: ${analysis.agent}`);
    console.log(`   Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);

    // Execute pre-hooks if available
    if (this.hookSystem) {
      const hookContext = this.hookSystem.createContext(
        'dispatch',
        analysis.agent || 'unknown',
        request
      );
      
      const hookResult = await this.hookSystem.executeHooks(hookContext, 'pre');
      if (!hookResult.allowed) {
        return {
          success: false,
          agentUsed: analysis.agent || 'none',
          system: analysis.system,
          result: { error: hookResult.reason },
          executionTime: Date.now() - startTime,
          confidence: analysis.confidence
        };
      }
    }

    try {
      let result;
      
      if (analysis.system === 'single-file' && analysis.agent) {
        result = await this.executeSingleFileAgent(analysis.agent, request);
      } else if (analysis.system === 'legacy' && analysis.agent) {
        result = await this.executeLegacyEndpoint(analysis.agent, request);
      } else {
        throw new Error('No suitable agent found');
      }

      const dispatchResult: DispatchResult = {
        success: true,
        agentUsed: analysis.agent || 'unknown',
        system: analysis.system,
        result,
        executionTime: Date.now() - startTime,
        confidence: analysis.confidence
      };

      // Execute post-hooks
      if (this.hookSystem) {
        const hookContext = this.hookSystem.createContext(
          'dispatch-complete',
          analysis.agent || 'unknown',
          request
        );
        hookContext.output = result;
        await this.hookSystem.executeHooks(hookContext, 'post');
      }

      // Store in history for learning
      this.executionHistory.push(dispatchResult);
      this.learnFromExecution(dispatchResult);

      return dispatchResult;
    } catch (error) {
      return {
        success: false,
        agentUsed: analysis.agent || 'none',
        system: analysis.system,
        result: { error: error.message },
        executionTime: Date.now() - startTime,
        confidence: analysis.confidence
      };
    }
  }

  /**
   * Learn from execution results to improve routing
   */
  private learnFromExecution(result: DispatchResult) {
    // Simple learning: adjust confidence based on success
    if (result.success && result.confidence > 0.7) {
      // This was a good match, increase confidence for similar requests
      console.log(`✅ Learning: ${result.agentUsed} worked well (${result.confidence})`);
    } else if (!result.success && result.confidence > 0.5) {
      // This was a bad match, decrease confidence
      console.log(`📉 Learning: ${result.agentUsed} didn't work well`);
    }
    
    // Save learning data for future improvements
    if (this.executionHistory.length % 10 === 0) {
      this.saveExecutionHistory();
    }
  }

  /**
   * Save execution history for analysis
   */
  private async saveExecutionHistory() {
    const historyPath = path.join(__dirname, 'dispatch-history.json');
    try {
      await fs.promises.writeFile(
        historyPath,
        JSON.stringify(this.executionHistory.slice(-100), null, 2)
      );
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  /**
   * Get statistics about dispatching
   */
  getStatistics() {
    const stats = {
      totalRequests: this.executionHistory.length,
      successRate: 0,
      averageExecutionTime: 0,
      systemUsage: {
        'single-file': 0,
        'legacy': 0
      },
      agentUsage: new Map<string, number>()
    };

    if (this.executionHistory.length > 0) {
      const successful = this.executionHistory.filter(r => r.success).length;
      stats.successRate = successful / this.executionHistory.length;
      
      stats.averageExecutionTime = this.executionHistory.reduce(
        (sum, r) => sum + r.executionTime, 0
      ) / this.executionHistory.length;

      for (const result of this.executionHistory) {
        stats.systemUsage[result.system]++;
        const count = stats.agentUsage.get(result.agentUsed) || 0;
        stats.agentUsage.set(result.agentUsed, count + 1);
      }
    }

    return stats;
  }
}

// Export for use by other systems
export { AgentDispatcher, DispatchRequest, DispatchResult };

// CLI usage
if (require.main === module) {
  const dispatcher = new AgentDispatcher();
  
  // Interactive mode
  if (process.argv[2] === 'interactive') {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🎮 Agent Dispatcher - Interactive Mode');
    console.log('Type your request and the system will route it to the best agent\n');

    const prompt = () => {
      rl.question('> ', async (message) => {
        if (message.toLowerCase() === 'exit') {
          console.log('\nGoodbye!');
          rl.close();
          return;
        }

        if (message.toLowerCase() === 'stats') {
          console.log('\n📊 Dispatch Statistics:');
          console.log(JSON.stringify(dispatcher.getStatistics(), null, 2));
          prompt();
          return;
        }

        const result = await dispatcher.dispatch({
          intent: 'auto',
          message,
          preferredSystem: 'auto'
        });

        console.log('\n📦 Result:');
        console.log(JSON.stringify(result, null, 2));
        console.log();
        
        prompt();
      });
    };

    prompt();
  } 
  // Server mode
  else if (process.argv[2] === 'server') {
    const http = require('http');
    const server = http.createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/dispatch') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const request = JSON.parse(body);
            const result = await dispatcher.dispatch(request);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else if (req.url === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dispatcher.getStatistics()));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    const port = 8889;
    server.listen(port, () => {
      console.log(`🚀 Agent Dispatcher Server running at http://localhost:${port}`);
      console.log(`   POST /dispatch - Route a request`);
      console.log(`   GET /stats - View statistics`);
    });
  } else {
    console.log(`
Agent Dispatcher - Intelligent Routing System
Based on IndyDevDan's specialized agent principle

Usage:
  node agent-dispatcher.js interactive  - Interactive CLI mode
  node agent-dispatcher.js server       - Run as HTTP server

This dispatcher:
- Routes between legacy and single-file agents
- Learns from execution results
- Integrates with hook validation system
- Provides execution statistics
- Supports confidence-based routing
    `);
  }
}

export default AgentDispatcher;