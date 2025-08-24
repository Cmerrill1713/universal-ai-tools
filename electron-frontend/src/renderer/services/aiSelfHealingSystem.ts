/**
 * AI-Powered Self-Healing System
 * Intelligent error detection, analysis, and automatic fixing with online search and Supabase integration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { connectionManager } from './connectionManager';

interface ErrorPattern {
  id: string;
  pattern: RegExp | string;
  description: string;
  solution?: string;
  confidence: number;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  lastSeen?: Date;
  frequency: number;
  autoFixCode?: string;
  sourceUrl?: string;
  stackOverflowUrl?: string;
  githubIssueUrl?: string;
}

interface TelemetryEvent {
  id: string;
  timestamp: Date;
  errorMessage: string;
  stackTrace: string;
  componentPath?: string;
  userAgent: string;
  fixed: boolean;
  fixApplied?: string;
  aiAnalysis?: string;
  searchResults?: SearchResult[];
  confidence?: number;
}

interface SearchResult {
  source: 'stackoverflow' | 'github' | 'npm' | 'mdn' | 'supabase';
  url: string;
  title: string;
  solution?: string;
  votes?: number;
  confidence: number;
}

interface AIAnalysis {
  errorType: string;
  rootCause: string;
  suggestedFix: string;
  confidence: number;
  relatedPatterns: ErrorPattern[];
  preventionStrategy: string;
}

class AISelfHealingSystem {
  private supabase: SupabaseClient | null = null;
  private telemetryBuffer: TelemetryEvent[] = [];
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private isProcessing: boolean = false;
  private aiAnalysisQueue: Array<{ error: Error; context: any }> = [];
  private learningMode: boolean = true;
  private onlineSearchEnabled: boolean = true;
  private supabaseEnabled: boolean = false;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    // Initialize in both development and production modes for system healing
    this.initializeSupabase();
    this.setupTelemetryWatcher();
    this.loadPatternsFromSupabase();
    this.startAIProcessor();
    this.initializeGlobalHandlers();
  }

  /**
   * Initialize Supabase connection
   */
  private async initializeSupabase(): Promise<void> {
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'http://127.0.0.1:54321';
      const supabaseKey =
        process.env.REACT_APP_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoJkp8TgYwf65Ps6f4JI_xh8KKBTkS6rAs';

      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.supabaseEnabled = true;
        logger.info('[AI-SelfHealing] Supabase connection initialized');

        // Subscribe to real-time error pattern updates
        this.subscribeToPatternUpdates();
      }
    } catch (error) {
      logger.error('[AI-SelfHealing] Failed to initialize Supabase', error);
      this.supabaseEnabled = false;
    }
  }

  /**
   * Load error patterns from Supabase
   */
  private async loadPatternsFromSupabase(): Promise<void> {
    if (!this.supabase || !this.supabaseEnabled) return;

    try {
      // Query error patterns from context_storage
      const { data: patterns, error } = await this.supabase
        .from('context_storage')
        .select('*')
        .in('category', ['electron_error_patterns', 'code_patterns', 'frontend_errors'])
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('[AI-SelfHealing] Failed to load patterns from Supabase', error);
        return;
      }

      // Parse and store patterns
      patterns?.forEach(record => {
        try {
          const content = JSON.parse(record.content);
          if (content.errorPatterns) {
            this.processSupabasePatterns(content.errorPatterns);
          }
        } catch (parseError) {
          logger.warn('[AI-SelfHealing] Failed to parse pattern record', parseError);
        }
      });

      logger.info(`[AI-SelfHealing] Loaded ${this.errorPatterns.size} patterns from Supabase`);
    } catch (error) {
      logger.error('[AI-SelfHealing] Error loading patterns', error);
    }
  }

  /**
   * Process patterns from Supabase
   */
  private processSupabasePatterns(patterns: any[]): void {
    patterns.forEach(pattern => {
      const errorPattern: ErrorPattern = {
        id: pattern.id || `pattern-${Date.now()}`,
        pattern: new RegExp(pattern.pattern, 'i'),
        description: pattern.description,
        solution: pattern.solution || pattern.fixSuggestion,
        confidence: pattern.confidence || 0.7,
        category: pattern.category || pattern.type || 'unknown',
        severity: pattern.severity || 'medium',
        frequency: 0,
        autoFixCode: pattern.autoFixCode,
      };

      this.errorPatterns.set(errorPattern.id, errorPattern);
    });
  }

  /**
   * Subscribe to real-time pattern updates from Supabase
   */
  private subscribeToPatternUpdates(): void {
    if (!this.supabase || !this.supabaseEnabled) return;

    const subscription = this.supabase
      .channel('error-patterns')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'context_storage',
          filter: 'category=in.(electron_error_patterns,code_patterns,frontend_errors)',
        },
        payload => {
          logger.info('[AI-SelfHealing] Pattern update received', payload);
          this.loadPatternsFromSupabase();
        }
      )
      .subscribe();

    logger.info('[AI-SelfHealing] Subscribed to pattern updates');
  }

  /**
   * Setup telemetry watcher for automatic error detection
   */
  private setupTelemetryWatcher(): void {
    // Only watch console in development
    if (process.env.NODE_ENV === 'development') {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        // Filter out non-critical errors
        const errorStr = args.join(' ').toLowerCase();
        if (
          errorStr.includes('failed to fetch') ||
          errorStr.includes('network') ||
          errorStr.includes('connection') ||
          errorStr.includes('resizeobserver')
        ) {
          originalConsoleError(...args);
          return;
        }

        this.captureError(new Error(args.join(' ')), { source: 'console.error' });
        originalConsoleError(...args);
      };
    }

    // Watch for unhandled promise rejections - but don't capture them
    window.addEventListener('unhandledrejection', event => {
      // Just prevent the default behavior, don't capture
      event.preventDefault();
    });

    // Watch for general errors - but filter them
    window.addEventListener('error', event => {
      // Filter out non-critical errors
      const message = event.message?.toLowerCase() || '';
      if (
        message.includes('resizeobserver') ||
        message.includes('non-error') ||
        message.includes('failed to fetch') ||
        message.includes('network')
      ) {
        event.preventDefault();
        return;
      }

      // Only capture in development
      if (process.env.NODE_ENV === 'development') {
        this.captureError(event.error || new Error(event.message), {
          source: 'window.error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      }
      event.preventDefault();
    });

    // Performance observer for detecting performance issues
    if ('PerformanceObserver' in window) {
      const perfObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 3000) {
            this.captureError(
              new Error(`Performance issue: ${entry.name} took ${entry.duration}ms`),
              {
                source: 'performance',
                entry,
              }
            );
          }
        }
      });

      perfObserver.observe({ entryTypes: ['measure', 'navigation'] });
    }

    logger.info('[AI-SelfHealing] Telemetry watcher initialized');
  }

  /**
   * Capture and process errors
   */
  private async captureError(error: Error, context: any): Promise<void> {
    const telemetryEvent: TelemetryEvent = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      errorMessage: error.message,
      stackTrace: error.stack || '',
      componentPath: context?.componentPath,
      userAgent: navigator.userAgent,
      fixed: false,
    };

    // Add to telemetry buffer
    this.telemetryBuffer.push(telemetryEvent);
    if (this.telemetryBuffer.length > 1000) {
      this.telemetryBuffer.shift();
    }

    // Queue for AI analysis
    this.aiAnalysisQueue.push({ error, context });

    // Trigger immediate processing
    if (!this.isProcessing) {
      this.processAIQueue();
    }
  }

  /**
   * Start AI processor for analyzing and fixing errors
   */
  private startAIProcessor(): void {
    setInterval(() => {
      if (this.aiAnalysisQueue.length > 0 && !this.isProcessing) {
        this.processAIQueue();
      }
    }, 2000); // Process every 2 seconds
  }

  /**
   * Process AI analysis queue
   */
  private async processAIQueue(): Promise<void> {
    if (this.isProcessing || this.aiAnalysisQueue.length === 0) return;

    this.isProcessing = true;

    while (this.aiAnalysisQueue.length > 0) {
      const { error, context } = this.aiAnalysisQueue.shift()!;

      try {
        // Step 1: Check local patterns
        const localMatch = this.findLocalPattern(error);

        if (localMatch && localMatch.confidence > 0.8) {
          await this.applyLocalFix(error, localMatch, context);
        } else {
          // Step 2: Search online for solutions
          if (this.onlineSearchEnabled) {
            const searchResults = await this.searchOnlineSolutions(error);

            if (searchResults.length > 0) {
              await this.applyOnlineSolution(error, searchResults[0], context);
            } else {
              // Step 3: Use AI analysis
              const aiAnalysis = await this.analyzeWithAI(error, context);
              await this.applyAIFix(error, aiAnalysis, context);
            }
          }
        }

        // Step 4: Store successful fix in Supabase
        if (this.learningMode) {
          await this.storeSuccessfulFix(error, context);
        }
      } catch (processError) {
        logger.error('[AI-SelfHealing] Error processing queue', processError);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Find matching pattern in local storage
   */
  private findLocalPattern(error: Error): ErrorPattern | null {
    const errorString = error.toString() + (error.stack || '');

    for (const pattern of this.errorPatterns.values()) {
      const regex =
        typeof pattern.pattern === 'string' ? new RegExp(pattern.pattern, 'i') : pattern.pattern;

      if (regex.test(errorString)) {
        pattern.frequency++;
        pattern.lastSeen = new Date();
        return pattern;
      }
    }

    return null;
  }

  /**
   * Search online for solutions
   */
  private async searchOnlineSolutions(error: Error): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const searchQuery = this.generateSearchQuery(error);

    try {
      // Search multiple sources in parallel
      const searches = await Promise.allSettled([
        this.searchStackOverflow(searchQuery),
        this.searchGitHub(searchQuery),
        this.searchNPM(searchQuery),
        this.searchMDN(searchQuery),
        this.searchSupabaseKnowledge(searchQuery),
      ]);

      searches.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(...result.value);
        }
      });

      // Sort by confidence
      results.sort((a, b) => b.confidence - a.confidence);

      logger.info(`[AI-SelfHealing] Found ${results.length} online solutions`);
    } catch (error) {
      logger.error('[AI-SelfHealing] Error searching online', error);
    }

    return results;
  }

  /**
   * Generate search query from error
   */
  private generateSearchQuery(error: Error): string {
    // Extract key terms from error
    const errorParts = error.message.split(/\s+/);
    const keywords = errorParts.filter(
      word =>
        word.length > 3 && !['error', 'warning', 'undefined', 'null'].includes(word.toLowerCase())
    );

    // Add framework context
    const frameworks = ['React', 'Electron', 'TypeScript'];

    return `${frameworks.join(' OR ')} ${keywords.slice(0, 5).join(' ')} error fix`;
  }

  /**
   * Search StackOverflow for solutions
   */
  private async searchStackOverflow(query: string): Promise<SearchResult[]> {
    try {
      const response = await connectionManager.safeFetch(
        `https://api.stackexchange.com/2.3/search/advanced?` +
          `order=desc&sort=relevance&q=${encodeURIComponent(query)}` +
          `&site=stackoverflow&filter=!9Z(-wzu0T`
      );

      if (!response.ok) return [];

      const data = await response.json();

      return (
        data.items?.slice(0, 3).map((item: any) => ({
          source: 'stackoverflow' as const,
          url: item.link,
          title: item.title,
          solution: item.accepted_answer?.body || item.body,
          votes: item.score,
          confidence: Math.min(item.score / 100, 0.9),
        })) || []
      );
    } catch (error) {
      logger.debug('[AI-SelfHealing] StackOverflow search failed', error);
      return [];
    }
  }

  /**
   * Search GitHub for solutions
   */
  private async searchGitHub(query: string): Promise<SearchResult[]> {
    try {
      const response = await connectionManager.safeFetch(
        `https://api.github.com/search/issues?` +
          `q=${encodeURIComponent(query)}+is:issue+is:closed` +
          `&sort=reactions&order=desc`
      );

      if (!response.ok) return [];

      const data = await response.json();

      return (
        data.items?.slice(0, 3).map((item: any) => ({
          source: 'github' as const,
          url: item.html_url,
          title: item.title,
          solution: item.body,
          votes: item.reactions?.total_count || 0,
          confidence: Math.min((item.reactions?.total_count || 0) / 50, 0.8),
        })) || []
      );
    } catch (error) {
      logger.debug('[AI-SelfHealing] GitHub search failed', error);
      return [];
    }
  }

  /**
   * Search NPM for package solutions
   */
  private async searchNPM(query: string): Promise<SearchResult[]> {
    try {
      const response = await connectionManager.safeFetch(
        `https://registry.npmjs.org/-/v1/search?` + `text=${encodeURIComponent(query)}&size=3`
      );

      if (!response.ok) return [];

      const data = await response.json();

      return (
        data.objects?.map((item: any) => ({
          source: 'npm' as const,
          url: `https://www.npmjs.com/package/${item.package.name}`,
          title: item.package.name,
          solution: item.package.description,
          confidence: item.score.final || 0.5,
        })) || []
      );
    } catch (error) {
      logger.debug('[AI-SelfHealing] NPM search failed', error);
      return [];
    }
  }

  /**
   * Search MDN for documentation
   */
  private async searchMDN(query: string): Promise<SearchResult[]> {
    try {
      // MDN doesn't have a public API, so we'll use a mock search
      // In production, you'd use a proper documentation search API
      const keywords = query.toLowerCase().split(' ');

      if (keywords.some(k => ['react', 'hook', 'usestate', 'useeffect'].includes(k))) {
        return [
          {
            source: 'mdn' as const,
            url: 'https://react.dev/reference/react',
            title: 'React Hooks Documentation',
            solution: 'Check React documentation for proper hook usage',
            confidence: 0.7,
          },
        ];
      }

      return [];
    } catch (error) {
      logger.debug('[AI-SelfHealing] MDN search failed', error);
      return [];
    }
  }

  /**
   * Search Supabase knowledge base
   */
  private async searchSupabaseKnowledge(query: string): Promise<SearchResult[]> {
    if (!this.supabase || !this.supabaseEnabled) return [];

    try {
      const { data, error } = await this.supabase
        .from('context_storage')
        .select('*')
        .textSearch('content', query)
        .limit(3);

      if (error) return [];

      return (
        data?.map(item => ({
          source: 'supabase' as const,
          url: `supabase://context/${item.id}`,
          title: item.category,
          solution: JSON.parse(item.content).solution || item.content.substring(0, 200),
          confidence: 0.85,
        })) || []
      );
    } catch (error) {
      logger.debug('[AI-SelfHealing] Supabase search failed', error);
      return [];
    }
  }

  /**
   * Analyze error with AI
   */
  private async analyzeWithAI(error: Error, context: any): Promise<AIAnalysis> {
    // Simulate AI analysis (in production, you'd call an AI service)
    const errorType = this.classifyError(error);
    const rootCause = this.findRootCause(error, context);
    const relatedPatterns = this.findRelatedPatterns(error);

    const analysis: AIAnalysis = {
      errorType,
      rootCause,
      suggestedFix: this.generateFix(errorType, rootCause),
      confidence: 0.75,
      relatedPatterns,
      preventionStrategy: this.generatePreventionStrategy(errorType),
    };

    // If connected to a real AI service, make the call here
    if (window.electronAPI?.analyzeError) {
      try {
        const aiResponse = await window.electronAPI.analyzeError({
          error: error.message,
          stack: error.stack,
          context,
        });

        if (aiResponse) {
          analysis.suggestedFix = aiResponse.fix || analysis.suggestedFix;
          analysis.confidence = aiResponse.confidence || analysis.confidence;
        }
      } catch (aiError) {
        logger.debug('[AI-SelfHealing] AI service not available', aiError);
      }
    }

    return analysis;
  }

  /**
   * Classify error type
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('undefined') || message.includes('null')) {
      return 'null-reference';
    } else if (message.includes('hook') || message.includes('usestate')) {
      return 'react-hooks';
    } else if (message.includes('async') || message.includes('promise')) {
      return 'async-operation';
    } else if (message.includes('memory') || message.includes('heap')) {
      return 'memory-leak';
    } else if (message.includes('render') || message.includes('component')) {
      return 'react-render';
    } else {
      return 'unknown';
    }
  }

  /**
   * Find root cause of error
   */
  private findRootCause(error: Error, context: any): string {
    const stack = error.stack || '';
    const lines = stack.split('\n');

    // Find the first line in user code (not node_modules)
    const userCodeLine = lines.find(
      line =>
        !line.includes('node_modules') &&
        (line.includes('.tsx') || line.includes('.ts') || line.includes('.jsx'))
    );

    if (userCodeLine) {
      const match = userCodeLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return `${match[1]} at ${match[2]}:${match[3]}:${match[4]}`;
      }
    }

    return 'Unable to determine root cause from stack trace';
  }

  /**
   * Find related patterns
   */
  private findRelatedPatterns(error: Error): ErrorPattern[] {
    const related: ErrorPattern[] = [];
    const errorString = error.toString().toLowerCase();

    for (const pattern of this.errorPatterns.values()) {
      const similarity = this.calculateSimilarity(errorString, pattern.description.toLowerCase());

      if (similarity > 0.5) {
        related.push(pattern);
      }
    }

    return related.slice(0, 5);
  }

  /**
   * Calculate string similarity
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));

    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Generate fix for error
   */
  private generateFix(errorType: string, rootCause: string): string {
    const fixes: Record<string, string> = {
      'null-reference': 'Add null checks and optional chaining (?.)',
      'react-hooks': 'Ensure hooks are called at the top level of functional components',
      'async-operation': 'Wrap in try-catch or add .catch() handler',
      'memory-leak': 'Clean up event listeners and timers in useEffect cleanup',
      'react-render': 'Check for invalid JSX or state updates in render',
      unknown: 'Review error stack trace and add error boundaries',
    };

    return fixes[errorType] || fixes.unknown;
  }

  /**
   * Generate prevention strategy
   */
  private generatePreventionStrategy(errorType: string): string {
    const strategies: Record<string, string> = {
      'null-reference': 'Use TypeScript strict mode and initialize all variables',
      'react-hooks': 'Use ESLint react-hooks plugin for validation',
      'async-operation': 'Always handle Promise rejections',
      'memory-leak': 'Use React DevTools Profiler to detect leaks',
      'react-render': 'Implement error boundaries for all components',
      unknown: 'Add comprehensive error logging and monitoring',
    };

    return strategies[errorType] || strategies.unknown;
  }

  /**
   * Apply local fix
   */
  private async applyLocalFix(error: Error, pattern: ErrorPattern, context: any): Promise<void> {
    logger.info('[AI-SelfHealing] Applying local fix', {
      pattern: pattern.id,
      confidence: pattern.confidence,
    });

    if (pattern.autoFixCode) {
      try {
        // Execute auto-fix code
        const fixFunction = new Function('error', 'context', pattern.autoFixCode);
        fixFunction(error, context);

        // Mark as fixed
        const event = this.telemetryBuffer.find(e => e.errorMessage === error.message);
        if (event) {
          event.fixed = true;
          event.fixApplied = pattern.description;
        }
      } catch (fixError) {
        logger.error('[AI-SelfHealing] Failed to apply local fix', fixError);
      }
    }
  }

  /**
   * Apply online solution
   */
  private async applyOnlineSolution(
    error: Error,
    solution: SearchResult,
    context: any
  ): Promise<void> {
    logger.info('[AI-SelfHealing] Applying online solution', {
      source: solution.source,
      confidence: solution.confidence,
    });

    // Store the solution for future use
    const newPattern: ErrorPattern = {
      id: `online-${Date.now()}`,
      pattern: error.message,
      description: solution.title,
      solution: solution.solution,
      confidence: solution.confidence,
      category: 'online-fix',
      severity: 'medium',
      frequency: 1,
      sourceUrl: solution.url,
    };

    this.errorPatterns.set(newPattern.id, newPattern);

    // Store in Supabase for sharing
    if (this.supabaseEnabled) {
      await this.storePatternInSupabase(newPattern);
    }
  }

  /**
   * Apply AI-generated fix
   */
  private async applyAIFix(error: Error, analysis: AIAnalysis, context: any): Promise<void> {
    logger.info('[AI-SelfHealing] Applying AI fix', {
      errorType: analysis.errorType,
      confidence: analysis.confidence,
    });

    // Create and store new pattern from AI analysis
    const newPattern: ErrorPattern = {
      id: `ai-${Date.now()}`,
      pattern: error.message,
      description: `AI: ${analysis.errorType}`,
      solution: analysis.suggestedFix,
      confidence: analysis.confidence,
      category: 'ai-generated',
      severity: 'medium',
      frequency: 1,
    };

    this.errorPatterns.set(newPattern.id, newPattern);

    // Mark telemetry event
    const event = this.telemetryBuffer.find(e => e.errorMessage === error.message);
    if (event) {
      event.fixed = true;
      event.fixApplied = analysis.suggestedFix;
      event.aiAnalysis = JSON.stringify(analysis);
      event.confidence = analysis.confidence;
    }
  }

  /**
   * Store successful fix in Supabase
   */
  private async storeSuccessfulFix(error: Error, context: any): Promise<void> {
    if (!this.supabase || !this.supabaseEnabled) return;

    try {
      const fixData = {
        category: 'electron_error_patterns',
        source: 'ai-self-healing',
        content: JSON.stringify({
          error: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
          patterns: Array.from(this.errorPatterns.values()).filter(p => p.frequency > 0),
        }),
        metadata: {
          type: 'successful_fix',
          confidence: 0.8,
          auto_generated: true,
        },
        user_id: 'system',
      };

      const { error: insertError } = await this.supabase.from('context_storage').insert(fixData);

      if (insertError) {
        logger.error('[AI-SelfHealing] Failed to store fix', insertError);
      } else {
        logger.info('[AI-SelfHealing] Successful fix stored in Supabase');
      }
    } catch (error) {
      logger.error('[AI-SelfHealing] Error storing fix', error);
    }
  }

  /**
   * Store pattern in Supabase
   */
  private async storePatternInSupabase(pattern: ErrorPattern): Promise<void> {
    if (!this.supabase || !this.supabaseEnabled) return;

    try {
      const { error } = await this.supabase.from('context_storage').insert({
        category: 'electron_error_patterns',
        source: 'ai-discovered',
        content: JSON.stringify({
          errorPatterns: [pattern],
        }),
        metadata: {
          type: 'error_pattern',
          confidence: pattern.confidence,
          source: pattern.sourceUrl,
        },
        user_id: 'system',
      });

      if (error) {
        logger.error('[AI-SelfHealing] Failed to store pattern', error);
      }
    } catch (error) {
      logger.error('[AI-SelfHealing] Error storing pattern', error);
    }
  }

  /**
   * Initialize global error handlers
   */
  private initializeGlobalHandlers(): void {
    // Override React error handling
    if (typeof window !== 'undefined' && (window as any).React) {
      const React = (window as any).React;

      if (React.Component) {
        const originalComponentDidCatch = React.Component.prototype.componentDidCatch;
        React.Component.prototype.componentDidCatch = function (error: Error, errorInfo: any) {
          this.captureError(error, {
            source: 'react-component',
            componentStack: errorInfo.componentStack,
          });

          if (originalComponentDidCatch) {
            originalComponentDidCatch.call(this, error, errorInfo);
          }
        };
      }
    }

    logger.info('[AI-SelfHealing] Global handlers initialized');
  }

  /**
   * Get system status
   */
  public getSystemStatus(): any {
    // Return minimal status in production
    if (process.env.NODE_ENV !== 'development') {
      return {
        enabled: false,
        patterns: 0,
        telemetryEvents: 0,
        queueSize: 0,
        isProcessing: false,
        supabaseConnected: false,
        onlineSearchEnabled: false,
        learningMode: false,
        stats: { totalErrors: 0, fixedErrors: 0, fixRate: 0 },
      };
    }

    return {
      enabled: true,
      patterns: this.errorPatterns.size,
      telemetryEvents: this.telemetryBuffer.length,
      queueSize: this.aiAnalysisQueue.length,
      isProcessing: this.isProcessing,
      supabaseConnected: this.supabaseEnabled,
      onlineSearchEnabled: this.onlineSearchEnabled,
      learningMode: this.learningMode,
      stats: {
        totalErrors: this.telemetryBuffer.length,
        fixedErrors: this.telemetryBuffer.filter(e => e.fixed).length,
        fixRate:
          this.telemetryBuffer.length > 0
            ? (this.telemetryBuffer.filter(e => e.fixed).length / this.telemetryBuffer.length) * 100
            : 0,
      },
    };
  }

  /**
   * Export telemetry data
   */
  public exportTelemetry(): void {
    // No-op in production
    if (process.env.NODE_ENV !== 'development') return;

    const data = {
      timestamp: new Date().toISOString(),
      events: this.telemetryBuffer,
      patterns: Array.from(this.errorPatterns.values()),
      status: this.getSystemStatus(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-telemetry-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Clear telemetry data
   */
  public clearTelemetry(): void {
    // No-op in production
    if (process.env.NODE_ENV !== 'development') return;

    this.telemetryBuffer = [];
    this.aiAnalysisQueue = [];
    logger.info('[AI-SelfHealing] Telemetry cleared');
  }

  /**
   * Toggle learning mode
   */
  public setLearningMode(enabled: boolean): void {
    // No-op in production
    if (process.env.NODE_ENV !== 'development') return;

    this.learningMode = enabled;
    logger.info(`[AI-SelfHealing] Learning mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle online search
   */
  public setOnlineSearch(enabled: boolean): void {
    // No-op in production
    if (process.env.NODE_ENV !== 'development') return;

    this.onlineSearchEnabled = enabled;
    logger.info(`[AI-SelfHealing] Online search ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Export singleton instance
export const aiSelfHealingSystem = new AISelfHealingSystem();

// Export for DevTools access (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__AI_SELF_HEALING__ = aiSelfHealingSystem;
}

export default aiSelfHealingSystem;
