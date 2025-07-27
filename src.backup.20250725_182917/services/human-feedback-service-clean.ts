/**
 * Human-in-the-Loop Feedback Service
 * 
 * Collects and processes human feedback to improve DSPy and agent performance
 */

import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/logger';

// Core feedback interfaces
export interface UserFeedback {
  feedbackId: string;
  requestId: string;
  feedbackType: 'rating' | 'correction' | 'preference' | 'label';
  rating?: number; // 1-5 stars
  correctedResponse?: string;
  preferredResponse?: string;
  labels?: string[];
  comments?: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface FeedbackRequest {
  requestId: string;
  agentId: string;
  originalRequest: string;
  agentResponse: any;
  feedbackType: string[];
  priority: 'low' | 'medium' | 'high';
  timeout?: number; // ms to wait for feedback
  callback?: (feedback: UserFeedback) => void;
}

export interface FeedbackAnalytics {
  totalFeedback: number;
  averageRating: number;
  feedbackByType: Record<string, number>;
  improvementTrends: any[];
  commonIssues: string[];
  agentPerformance: Record<string, number>;
}

export interface DSPyTrainingData {
  trainingId: string;
  examples: {
    input: string;
    output: string;
    feedback: UserFeedback;
    quality_score: number;
  }[];
  labels: string[];
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Human Feedback Service for collecting and processing user feedback
 */
export class HumanFeedbackService extends EventEmitter {
  private supabase: SupabaseClient;
  private wsServer?: WebSocketServer;
  private activeFeedbackRequests = new Map<string, FeedbackRequest>();
  private connectedClients = new Set<WebSocket>();
  private feedbackHistory: UserFeedback[] = [];
  private trainingDatasets: DSPyTrainingData[] = [];

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
    this.setupEventListeners();
  }

  /**
   * Initialize the feedback service
   */
  async initialize(wsPort?: number): Promise<void> {
    try {
      logger.info('🤝 Initializing Human Feedback Service...');

      // Setup database tables
      await this.setupFeedbackTables();

      // Setup WebSocket server for real-time feedback
      if (wsPort) {
        await this.setupWebSocketServer(wsPort);
      }

      // Load existing feedback for analytics
      await this.loadFeedbackHistory();

      logger.info('✅ Human Feedback Service ready');
    } catch (error) {
      logger.error('❌ Failed to initialize Human Feedback Service:', error);
      throw error;
    }
  }

  /**
   * Request feedback from users
   */
  async requestFeedback(request: FeedbackRequest): Promise<string> {
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info(`📝 Requesting feedback for ${request.agentId}`, {
      feedbackId,
      requestId: request.requestId,
      priority: request.priority,
      types: request.feedbackType
    });

    // Store the request
    this.activeFeedbackRequests.set(feedbackId, {
      ...request,
      requestId: feedbackId
    });

    // Send to connected clients via WebSocket
    this.broadcastFeedbackRequest({
      feedbackId,
      ...request
    });

    // Set timeout if specified
    if (request.timeout) {
      setTimeout(() => {
        if (this.activeFeedbackRequests.has(feedbackId)) {
          logger.warn(`⏰ Feedback request ${feedbackId} timed out`);
          this.activeFeedbackRequests.delete(feedbackId);
        }
      }, request.timeout);
    }

    return feedbackId;
  }

  /**
   * Submit user feedback
   */
  async submitFeedback(feedback: Partial<UserFeedback>): Promise<UserFeedback> {
    const completeFeedback: UserFeedback = {
      feedbackId: feedback.feedbackId || `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestId: feedback.requestId!,
      feedbackType: feedback.feedbackType!,
      rating: feedback.rating,
      correctedResponse: feedback.correctedResponse,
      preferredResponse: feedback.preferredResponse,
      labels: feedback.labels || [],
      comments: feedback.comments,
      timestamp: new Date(),
      userId: feedback.userId,
      sessionId: feedback.sessionId,
      metadata: feedback.metadata || {}
    };

    logger.info(`💬 Received feedback: ${completeFeedback.feedbackType}`, {
      feedbackId: completeFeedback.feedbackId,
      requestId: completeFeedback.requestId,
      rating: completeFeedback.rating,
      hasCorrection: !!completeFeedback.correctedResponse
    });

    // Store in database
    await this.storeFeedback(completeFeedback);

    // Add to local history
    this.feedbackHistory.push(completeFeedback);

    // Process for DSPy training if applicable
    await this.processFeedbackForTraining(completeFeedback);

    // Notify connected clients
    this.broadcastFeedbackUpdate(completeFeedback);

    // Handle callback if request exists
    const request = this.activeFeedbackRequests.get(completeFeedback.requestId);
    if (request && request.callback) {
      request.callback(completeFeedback);
      this.activeFeedbackRequests.delete(completeFeedback.requestId);
    }

    // Emit event for other systems
    this.emit('feedback_received', completeFeedback);

    return completeFeedback;
  }

  /**
   * Get feedback analytics and insights
   */
  async getFeedbackAnalytics(agentId?: string, timeRange?: { start: Date; end: Date }): Promise<FeedbackAnalytics> {
    try {
      let query = this.supabase
        .from('user_feedback')
        .select('*');

      if (agentId) {
        // Join with feedback_requests to filter by agent
        query = query.eq('metadata->>agentId', agentId);
      }

      if (timeRange) {
        query = query
          .gte('timestamp', timeRange.start.toISOString())
          .lte('timestamp', timeRange.end.toISOString());
      }

      const { data, error } = await query.order('timestamp', { ascending: false });

      if (error) throw error;

      const feedback = data || [];
      const totalFeedback = feedback.length;

      // Calculate average rating
      const ratingsData = feedback.filter(f => f.rating).map(f => f.rating);
      const averageRating = ratingsData.length > 0 
        ? ratingsData.reduce((a, b) => a + b, 0) / ratingsData.length 
        : 0;

      // Group by feedback type
      const feedbackByType: Record<string, number> = {};
      feedback.forEach(f => {
        feedbackByType[f.feedback_type] = (feedbackByType[f.feedback_type] || 0) + 1;
      });

      // Calculate agent performance if not filtered by specific agent
      const agentPerformance: Record<string, number> = {};
      if (!agentId) {
        const agentFeedback = new Map<string, UserFeedback[]>();
        
        feedback.forEach(f => {
          const agent = f.metadata?.agentId || 'unknown';
          if (!agentFeedback.has(agent)) {
            agentFeedback.set(agent, []);
          }
          agentFeedback.get(agent)!.push(f);
        });

        // Calculate average rating per agent
        for (const [agentId, feedbacks] of agentFeedback) {
          const ratings = feedbacks.filter(f => f.rating).map(f => f.rating!);
          if (ratings.length > 0) {
            performance[agentId] = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          }
        }
      }

      // Extract common issues from comments
      const commonIssues = this.extractCommonIssues(feedback);

      // Calculate improvement trends (simplified)
      const improvementTrends = this.calculateImprovementTrends(feedback);

      return {
        totalFeedback,
        averageRating,
        feedbackByType,
        improvementTrends,
        commonIssues,
        agentPerformance
      };

    } catch (error) {
      logger.error('Failed to get feedback analytics:', error);
      throw error;
    }
  }

  /**
   * Generate DSPy training dataset from collected feedback
   */
  async generateDSPyTrainingData(
    criteria: {
      minRating?: number;
      includeCorrections?: boolean;
      agentIds?: string[];
      maxExamples?: number;
    } = {}
  ): Promise<DSPyTrainingData> {
    const trainingId = `training_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('🧠 Generating DSPy training dataset', {
      trainingId,
      criteria
    });

    try {
      let query = this.supabase
        .from('user_feedback')
        .select('*, feedback_requests(*)')
        .order('timestamp', { ascending: false });

      // Apply filters
      if (criteria.minRating) {
        query = query.gte('rating', criteria.minRating);
      }

      if (criteria.maxExamples) {
        query = query.limit(criteria.maxExamples);
      }

      const { data, error } = await query;
      if (error) throw error;

      const feedbackData = data || [];
      const examples: any[] = [];
      const labels = new Set<string>();

      for (const feedback of feedbackData) {
        // Skip if agent not in allowed list
        if (criteria.agentIds && !criteria.agentIds.includes(feedback.metadata?.agentId)) {
          continue;
        }

        // Create training example
        const example = {
          input: feedback.feedback_requests?.original_request || '',
          output: criteria.includeCorrections && feedback.corrected_response 
            ? feedback.corrected_response 
            : feedback.feedback_requests?.agent_response || '',
          feedback,
          quality_score: this.calculateQualityScore(feedback)
        };

        examples.push(example);

        // Collect labels
        if (feedback.labels) {
          feedback.labels.forEach((label: string) => labels.add(label));
        }
      }

      const trainingData: DSPyTrainingData = {
        trainingId,
        examples,
        labels: Array.from(labels),
        metadata: {
          criteria,
          generatedAt: new Date().toISOString(),
          totalExamples: examples.length,
          averageQuality: examples.reduce((sum, ex) => sum + ex.quality_score, 0) / examples.length
        },
        createdAt: new Date()
      };

      // Store training dataset
      await this.storeTrainingDataset(trainingData);
      this.trainingDatasets.push(trainingData);

      logger.info('✅ DSPy training dataset generated', {
        trainingId,
        exampleCount: examples.length,
        labelCount: labels.size
      });

      return trainingData;

    } catch (error) {
      logger.error('Failed to generate DSPy training data:', error);
      throw error;
    }
  }

  /**
   * Export feedback data for external analysis
   */
  async exportFeedbackData(
    format: 'json' | 'csv' | 'dspy',
    filters: {
      agentIds?: string[];
      dateRange?: { start: Date; end: Date };
      feedbackTypes?: string[];
      minRating?: number;
    } = {}
  ): Promise<any> {
    try {
      let query = this.supabase
        .from('user_feedback')
        .select('*, feedback_requests(*)');

      // Apply filters
      if (filters.dateRange) {
        query = query
          .gte('timestamp', filters.dateRange.start.toISOString())
          .lte('timestamp', filters.dateRange.end.toISOString());
      }

      if (filters.feedbackTypes) {
        query = query.in('feedback_type', filters.feedbackTypes);
      }

      if (filters.minRating) {
        query = query.gte('rating', filters.minRating);
      }

      const { data, error } = await query.order('timestamp', { ascending: false });
      if (error) throw error;

      const feedbackData = data || [];

      // Filter by agent IDs if specified
      let filteredData = feedbackData;
      if (filters.agentIds) {
        filteredData = feedbackData.filter(f => 
          filters.agentIds!.includes(f.metadata?.agentId)
        );
      }

      switch (format) {
        case 'json':
          return {
            metadata: {
              exportedAt: new Date().toISOString(),
              totalRecords: filteredData.length,
              filters
            },
            data: filteredData
          };

        case 'csv':
          return this.formatAsCSV(filteredData);

        case 'dspy':
          return this.formatForDSPy(filteredData);

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

    } catch (error) {
      logger.error('Failed to export feedback data:', error);
      throw error;
    }
  }

  /**
   * Setup WebSocket server for real-time feedback
   */
  private async setupWebSocketServer(port: number): Promise<void> {
    this.wsServer = new WebSocketServer({ port });

    this.wsServer.on('connection', (ws: WebSocket) => {
      logger.info('👥 New feedback client connected');
      this.connectedClients.add(ws);

      ws.on('message', async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'submit_feedback') {
            await this.submitFeedback(data.feedback);
          }

        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid message format' 
          }));
        }
      });

      ws.on('close', () => {
        logger.info('👋 Feedback client disconnected');
        this.connectedClients.delete(ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Human Feedback Service'
      }));
    });

    logger.info(`🌐 Feedback WebSocket server listening on port ${port}`);
  }

  /**
   * Broadcast feedback request to connected clients
   */
  private broadcastFeedbackRequest(request: any): void {
    const message = JSON.stringify({
      type: 'feedback_request',
      data: request
    });

    this.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast feedback update to connected clients
   */
  private broadcastFeedbackUpdate(feedback: UserFeedback): void {
    const message = JSON.stringify({
      type: 'feedback_update',
      data: feedback
    });

    this.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Setup database tables for feedback storage
   */
  private async setupFeedbackTables(): Promise<void> {
    try {
      // This would create the necessary tables
      // For now, assume they exist or handle creation in migration files
      logger.info('📊 Setting up feedback database tables');
    } catch (error) {
      logger.warn('Database setup failed:', error);
    }
  }

  /**
   * Store feedback in database
   */
  private async storeFeedback(feedback: UserFeedback): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_feedback')
        .insert({
          feedback_id: feedback.feedbackId,
          request_id: feedback.requestId,
          feedback_type: feedback.feedbackType,
          rating: feedback.rating,
          corrected_response: feedback.correctedResponse,
          preferred_response: feedback.preferredResponse,
          labels: feedback.labels,
          comments: feedback.comments,
          timestamp: feedback.timestamp.toISOString(),
          user_id: feedback.userId,
          session_id: feedback.sessionId,
          metadata: feedback.metadata
        });

      if (error) {
        logger.warn('Could not store feedback:', error);
      }
    } catch (error) {
      logger.warn('Feedback storage failed:', error);
    }
  }

  /**
   * Process feedback for DSPy training
   */
  private async processFeedbackForTraining(feedback: UserFeedback): Promise<void> {
    try {
      // Only process high-quality feedback
      if (feedback.rating && feedback.rating >= 4) {
        // This would trigger DSPy retraining
        this.emit('training_data_available', {
          feedback,
          quality: 'high'
        });
      }

      // Process corrections for immediate learning
      if (feedback.correctedResponse) {
        this.emit('correction_received', {
          original: feedback.requestId,
          correction: feedback.correctedResponse,
          feedback
        });
      }

    } catch (error) {
      logger.warn('Failed to process feedback for training:', error);
    }
  }

  /**
   * Load existing feedback history
   */
  private async loadFeedbackHistory(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('user_feedback')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (data) {
        this.feedbackHistory = data.map(this.mapDatabaseToFeedback);
        logger.info(`📚 Loaded ${this.feedbackHistory.length} feedback records`);
      }
    } catch (error) {
      logger.warn('Could not load feedback history:', error);
    }
  }

  /**
   * Store training dataset
   */
  private async storeTrainingDataset(dataset: DSPyTrainingData): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('dspy_training_datasets')
        .insert({
          training_id: dataset.trainingId,
          examples: dataset.examples,
          labels: dataset.labels,
          metadata: dataset.metadata,
          created_at: dataset.createdAt.toISOString()
        });

      if (error) {
        logger.warn('Could not store training dataset:', error);
      }
    } catch (error) {
      logger.warn('Training dataset storage failed:', error);
    }
  }

  /**
   * Calculate quality score from feedback
   */
  private calculateQualityScore(feedback: any): number {
    let score = 0.5; // Base score

    // Rating contribution
    if (feedback.rating) {
      score = feedback.rating / 5.0; // Normalize to 0-1
    }

    // Boost for corrections (indicates engagement)
    if (feedback.corrected_response) {
      score = Math.min(1.0, score + 0.1);
    }

    // Boost for detailed comments
    if (feedback.comments && feedback.comments.length > 20) {
      score = Math.min(1.0, score + 0.05);
    }

    // Boost for labels (indicates structured feedback)
    if (feedback.labels && feedback.labels.length > 0) {
      score = Math.min(1.0, score + 0.05);
    }

    return score;
  }

  /**
   * Extract common issues from feedback comments
   */
  private extractCommonIssues(feedback: any[]): string[] {
    const issueKeywords = [
      'slow', 'error', 'wrong', 'confusing', 'unclear', 'incomplete',
      'inaccurate', 'unhelpful', 'irrelevant', 'broken'
    ];

    const issueCounts: Record<string, number> = {};

    feedback.forEach(f => {
      if (f.comments) {
        const commentLower = f.comments.toLowerCase();
        issueKeywords.forEach(keyword => {
          if (commentLower.includes(keyword)) {
            issueCounts[keyword] = (issueCounts[keyword] || 0) + 1;
          }
        });
      }
    });

    // Return top 5 issues
    return Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);
  }

  /**
   * Calculate improvement trends
   */
  private calculateImprovementTrends(feedback: any[]): any[] {
    // Group feedback by month and calculate average ratings
    const monthlyData: Record<string, { ratings: number[]; count: number }> = {};

    feedback.forEach(f => {
      if (f.rating && f.timestamp) {
        const month = new Date(f.timestamp).toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = { ratings: [], count: 0 };
        }
        monthlyData[month].ratings.push(f.rating);
        monthlyData[month].count++;
      }
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        averageRating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
        feedbackCount: data.count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Format data as CSV
   */
  private formatAsCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = [
      'feedback_id', 'request_id', 'feedback_type', 'rating', 
      'comments', 'timestamp', 'user_id', 'agent_id'
    ];

    const csvRows = [headers.join(',')];

    data.forEach(item => {
      const row = [
        item.feedback_id,
        item.request_id,
        item.feedback_type,
        item.rating || '',
        `"${(item.comments || '').replace(/"/g, '""')}"`,
        item.timestamp,
        item.user_id || '',
        item.metadata?.agentId || ''
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Format data for DSPy consumption
   */
  private formatForDSPy(data: any[]): any {
    return {
      examples: data
        .filter(item => item.feedback_requests)
        .map(item => ({
          input: item.feedback_requests.original_request,
          output: item.corrected_response || item.feedback_requests.agent_response,
          rating: item.rating,
          feedback_type: item.feedback_type,
          metadata: {
            feedback_id: item.feedback_id,
            timestamp: item.timestamp,
            agent_id: item.metadata?.agentId
          }
        })),
      metadata: {
        format: 'dspy_training',
        version: '1.0',
        generated_at: new Date().toISOString()
      }
    };
  }

  /**
   * Map database record to UserFeedback interface
   */
  private mapDatabaseToFeedback(dbRecord: any): UserFeedback {
    return {
      feedbackId: dbRecord.feedback_id,
      requestId: dbRecord.request_id,
      feedbackType: dbRecord.feedback_type,
      rating: dbRecord.rating,
      correctedResponse: dbRecord.corrected_response,
      preferredResponse: dbRecord.preferred_response,
      labels: dbRecord.labels || [],
      comments: dbRecord.comments,
      timestamp: new Date(dbRecord.timestamp),
      userId: dbRecord.user_id,
      sessionId: dbRecord.session_id,
      metadata: dbRecord.metadata || {}
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.on('feedback_received', (feedback) => {
      logger.debug('📝 Feedback event processed', { 
        feedbackId: feedback.feedbackId,
        type: feedback.feedbackType 
      });
    });

    this.on('training_data_available', (data) => {
      logger.debug('🧠 Training data event processed', { 
        quality: data.quality 
      });
    });
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('🤝 Shutting down Human Feedback Service');

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }

    // Close client connections
    this.connectedClients.forEach(client => {
      client.close();
    });

    // Clear data
    this.activeFeedbackRequests.clear();
    this.connectedClients.clear();

    logger.info('✅ Human Feedback Service shutdown complete');
  }
}

export default HumanFeedbackService;