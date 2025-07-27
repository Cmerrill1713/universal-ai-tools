/**;
 * Human-in-the-Loop Feedback Service
 * Collects, stores, and processes human feedback for DSPy training
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface FeedbackRequest {
  id: string;
  agentId: string;
  requestId: string;
  userRequest: string;
  agentResponse: any;
  timestamp: Date;
  feedbackType: 'rating' | 'correction' | 'preference' | 'label';
  metadata?: Record<string, any>;
}

export interface UserFeedback {
  feedbackId: string;
  requestId: string;
  feedbackType: 'rating' | 'correction' | 'preference' | 'label';
  rating?: number; // 1-5 stars;
  correctedResponse?: string;
  preferredResponse?: string;
  labels?: string[];
  comments?: string;
  timestamp: Date;
  userId?: string;
}

export interface FeedbackMetrics {
  totalFeedback: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  commonLabels: string[];
  improvementTrend: number;
  agentPerformance: Record<string, number>;
}

export interface TrainingDataset {
  datasetId: string;
  name: string;
  description: string;
  examples: TrainingExample[];
  metadata: {
    created: Date;
    lastUpdated: Date;
    exampleCount: number;
    avgQuality: number;
  };
}

export interface TrainingExample {
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  feedback: UserFeedback;
  quality: number; // 0-1 quality score;
  isGoldStandard: boolean;
}

export class HumanFeedbackService extends EventEmitter {
  private supabase: SupabaseClient;
  private pendingFeedback: Map<string, FeedbackRequest> = new Map();
  private feedbackHistory: UserFeedback[] = [];
  private trainingDatasets: Map<string, TrainingDataset> = new Map();
  private wsConnections: Set<any> = new Set();

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadFeedbackHistory();
    await this.loadTrainingDatasets();
    logger.info('✅ Human Feedback Service initialized');
  }

  /**;
   * Request feedback for an agent response
   */
  async requestFeedback(;
    agentId: string,
    requestId: string,
    userRequest: string,
    agentResponse: any,
    feedbackType: FeedbackRequest['feedbackType'] = 'rating';
  ): Promise<FeedbackRequest> {
    const feedbackRequest: FeedbackRequest = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      requestId,
      userRequest,
      agentResponse,
      timestamp: new Date(),
      feedbackType;
    };

    this.pendingFeedback.set(feedbackRequest.id, feedbackRequest);

    // Store in database
    await this.storeFeedbackRequest(feedbackRequest);

    // Notify UI clients
    this.broadcastFeedbackRequest(feedbackRequest);

    this.emit('feedback_requested', feedbackRequest);

    return feedbackRequest;
  }

  /**;
   * Submit user feedback
   */
  async submitFeedback(feedback: UserFeedback): Promise<void> {
    // Validate feedback
    this.validateFeedback(feedback);

    // Store feedback
    await this.storeFeedback(feedback);
    this.feedbackHistory.push(feedback);

    // Update pending request
    const request = Array.from(this.pendingFeedback.values()).find(
      r => r.requestId === feedback.requestId;
    );
    if (request) {
      this.pendingFeedback.delete(request.id);
    }

    // Process feedback for training
    await this.processFeedbackForTraining(feedback, request);

    // Update metrics
    await this.updateFeedbackMetrics(feedback);

    // Notify listeners
    this.emit('feedback_received', feedback);
    this.broadcastFeedbackUpdate(feedback);
  }

  /**;
   * Get feedback metrics
   */
  async getFeedbackMetrics(agentId?: string, timeframe = '7d'): Promise<FeedbackMetrics> {
    const cutoffDate = this.getCutoffDate(timeframe);
    
    let relevantFeedback = this.feedbackHistory.filter(
      f => f.timestamp > cutoffDate;
    );

    if (agentId) {
      const agentRequests = Array.from(this.pendingFeedback.values())
        .filter(r => r.agentId === agentId);
        .map(r => r.requestId);
      relevantFeedback = relevantFeedback.filter(;
        f => agentRequests.includes(f.requestId);
      );
    }

    const ratings = relevantFeedback
      .filter(f => f.rating !== undefined);
      .map(f => f.rating!);

    const ratingDistribution: Record<number, number> = {};
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = ratings.filter(r => r === i).length;
    }

    const labels = relevantFeedback
      .flatMap(f => f.labels || []);
      .reduce((acc, label) => {
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const commonLabels = Object.entries(labels)
      .sort((a, b) => b[1] - a[1]);
      .slice(0, 10);
      .map(([label]) => label);

    return {
      totalFeedback: relevantFeedback.length,
      averageRating: ratings.length > 0 ;
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length ;
        : 0,
      ratingDistribution,
      commonLabels,
      improvementTrend: await this.calculateImprovementTrend(agentId, timeframe),
      agentPerformance: await this.calculateAgentPerformance();
    };
  }

  /**;
   * Create training dataset from feedback
   */
  async createTrainingDataset(;
    name: string,
    description: string,
    filters?: {
      agentId?: string;
      minRating?: number;
      labels?: string[];
      timeframe?: string;
    }
  ): Promise<TrainingDataset> {
    const examples = await this.collectTrainingExamples(filters);
    
    const dataset: TrainingDataset = {
      datasetId: `dataset_${Date.now()}`,
      name,
      description,
      examples,
      metadata: {
        created: new Date(),
        lastUpdated: new Date(),
        exampleCount: examples.length,
        avgQuality: examples.reduce((sum, ex) => sum + ex.quality, 0) / examples.length;
      }
    };

    this.trainingDatasets.set(dataset.datasetId, dataset);
    await this.storeTrainingDataset(dataset);

    this.emit('dataset_created', dataset);

    return dataset;
  }

  /**;
   * Export training data for DSPy
   */
  async exportForDSPy(datasetId: string): Promise<any> {
    const dataset = this.trainingDatasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    // Format for DSPy training
    const dspyExamples = dataset.examples.map(ex => ({
      question: ex.input,
      answer: ex.expectedOutput,
      metadata: {
        quality: ex.quality,
        feedback: ex.feedback,
        isGoldStandard: ex.isGoldStandard;
      }
    }));

    return {
      dataset_name: dataset.name,
      examples: dspyExamples,
      metadata: dataset.metadata;
    };
  }

  /**;
   * Get active feedback requests
   */
  getActiveFeedbackRequests(): FeedbackRequest[] {
    return Array.from(this.pendingFeedback.values());
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**;
   * Rate limit feedback requests
   */
  async shouldRequestFeedback(agentId: string, userId?: string): Promise<boolean> {
    // Check recent feedback count
    const recentCount = await this.getRecentFeedbackCount(agentId, userId);
    
    // Limit to 5 feedback requests per hour per agent
    if (recentCount >= 5) {
      return false;
    }

    // Check if user has pending feedback
    if (userId) {
      const hasPending = Array.from(this.pendingFeedback.values()).some(
        r => r.metadata?.userId === userId;
      );
      if (hasPending) {
        return false;
      }
    }

    return true;
  }

  /**;
   * WebSocket connection for real-time feedback UI
   */
  addWebSocketConnection(ws: any): void {
    this.wsConnections.add(ws);
    
    // Send current pending feedback
    ws.send(JSON.stringify({
      type: 'pending_feedback',
      data: this.getActiveFeedbackRequests();
    }));
  }

  removeWebSocketConnection(ws: any): void {
    this.wsConnections.delete(ws);
  }

  // Private methods

  private validateFeedback(feedback: UserFeedback): void {
    if (!feedback.feedbackId || !feedback.requestId) {
      throw new Error('Invalid feedback: missing required fields');
    }

    if (feedback.feedbackType === 'rating' && !feedback.rating) {
      throw new Error('Rating feedback must include a rating');
    }

    if (feedback.feedbackType === 'correction' && !feedback.correctedResponse) {
      throw new Error('Correction feedback must include corrected response');
    }
  }

  private async storeFeedbackRequest(request: FeedbackRequest): Promise<void> {
    try {
      await this.supabase.from('feedback_requests').insert({
        id: request.id,
        agent_id: request.agentId,
        request_id: request.requestId,
        user_request: request.userRequest,
        agent_response: request.agentResponse,
        feedback_type: request.feedbackType,
        metadata: request.metadata,
        created_at: request.timestamp;
      });
    } catch (error) {
      logger.error('Failed to store feedback request:', error);
    }
  }

  private async storeFeedback(feedback: UserFeedback): Promise<void> {
    try {
      await this.supabase.from('user_feedback').insert({
        feedback_id: feedback.feedbackId,
        request_id: feedback.requestId,
        feedback_type: feedback.feedbackType,
        rating: feedback.rating,
        corrected_response: feedback.correctedResponse,
        preferred_response: feedback.preferredResponse,
        labels: feedback.labels,
        comments: feedback.comments,
        user_id: feedback.userId,
        created_at: feedback.timestamp;
      });
    } catch (error) {
      logger.error('Failed to store feedback:', error);
    }
  }

  private async processFeedbackForTraining(;
    feedback: UserFeedback,
    request?: FeedbackRequest;
  ): Promise<void> {
    if (!request) return;

    // Create training example
    const example: TrainingExample = {
      input: request.userRequest,
      expectedOutput: this.determineExpectedOutput(feedback, request),
      actualOutput: JSON.stringify(request.agentResponse),
      feedback,
      quality: this.calculateQuality(feedback),
      isGoldStandard: feedback.rating === 5 || feedback.feedbackType === 'correction';
    };

    // Add to active training set
    const activeDataset = await this.getOrCreateActiveDataset(request.agentId);
    activeDataset.examples.push(example);
    activeDataset.metadata.lastUpdated = new Date();
    activeDataset.metadata.exampleCount++;

    // Update quality metrics
    activeDataset.metadata.avgQuality = ;
      (activeDataset.metadata.avgQuality * (activeDataset.metadata.exampleCount - 1) + example.quality) /;
      activeDataset.metadata.exampleCount;

    await this.storeTrainingDataset(activeDataset);
  }

  private determineExpectedOutput(feedback: UserFeedback, request: FeedbackRequest): string {
    if (feedback.correctedResponse) {
      return feedback.correctedResponse;
    }
    
    if (feedback.preferredResponse) {
      return feedback.preferredResponse;
    }

    // For high ratings, use the original response as expected
    if (feedback.rating && feedback.rating >= 4) {
      return JSON.stringify(request.agentResponse);
    }

    return '';
  }

  private calculateQuality(feedback: UserFeedback): number {
    if (feedback.feedbackType === 'correction') {
      return 1.0; // Corrections are highest quality;
    }

    if (feedback.rating) {
      return feedback.rating / 5.0;
    }

    if (feedback.labels && feedback.labels.includes('accurate')) {
      return 0.9;
    }

    return 0.5; // Default moderate quality;
  }

  private async getOrCreateActiveDataset(agentId: string): Promise<TrainingDataset> {
    const datasetName = `${agentId}_active_training`;
    
    let dataset = Array.from(this.trainingDatasets.values()).find(
      d => d.name === datasetName;
    );

    if (!dataset) {
      dataset = await this.createTrainingDataset(;
        datasetName,
        `Active training dataset for ${agentId}`,
        { agentId }
      );
    }

    return dataset;
  }

  private async collectTrainingExamples(filters?: any): Promise<TrainingExample[]> {
    const examples: TrainingExample[] = [];
    
    // Collect from feedback history
    for (const feedback of this.feedbackHistory) {
      // Apply filters
      if (filters?.minRating && feedback.rating && feedback.rating < filters.minRating) {
        continue;
      }

      if (filters?.labels && feedback.labels) {
        const hasLabel = filters.labels.some(l => feedback.labels?.includes(l));
        if (!hasLabel) continue;
      }

      // Find corresponding request
      const request = await this.getFeedbackRequest(feedback.requestId);
      if (!request) continue;

      if (filters?.agentId && request.agentId !== filters.agentId) {
        continue;
      }

      const example: TrainingExample = {
        input: request.userRequest,
        expectedOutput: this.determineExpectedOutput(feedback, request),
        actualOutput: JSON.stringify(request.agentResponse),
        feedback,
        quality: this.calculateQuality(feedback),
        isGoldStandard: feedback.rating === 5;
      };

      examples.push(example);
    }

    return examples;
  }

  private async getFeedbackRequest(requestId: string): Promise<FeedbackRequest | null> {
    // Check memory first
    const memoryRequest = Array.from(this.pendingFeedback.values()).find(
      r => r.requestId === requestId;
    );
    if (memoryRequest) return memoryRequest;

    // Check database
    try {
      const { data } = await this.supabase
        .from('feedback_requests');
        .select('*');
        .eq('request_id', requestId);
        .single();

      if (data) {
        return {
          id: data.id,
          agentId: data.agent_id,
          requestId: data.request_id,
          userRequest: data.user_request,
          agentResponse: data.agent_response,
          timestamp: new Date(data.created_at),
          feedbackType: data.feedback_type,
          metadata: data.metadata;
        };
      }
    } catch (error) {
      logger.error('Failed to fetch feedback request:', error);
    }

    return null;
  }

  private getCutoffDate(timeframe: string): Date {
    const date = new Date();
    const match = timeframe.match(/(\d+)([dhm])/);
    
    if (match) {
      const [, amount, unit] = match;
      const value = parseInt(amount);
      
      switch (unit) {
        case 'd':;
          date.setDate(date.getDate() - value);
          break;
        case 'h':;
          date.setHours(date.getHours() - value);
          break;
        case 'm':;
          date.setMinutes(date.getMinutes() - value);
          break;
      }
    }
    
    return date;
  }

  private async calculateImprovementTrend(agentId?: string, timeframe: string): Promise<number> {
    // Calculate trend in ratings over time
    const cutoff = this.getCutoffDate(timeframe);
    const midpoint = new Date((cutoff.getTime() + new Date().getTime()) / 2);
    
    const firstHalf = this.feedbackHistory.filter(
      f => f.timestamp > cutoff && f.timestamp <= midpoint && f.rating;
    );
    
    const secondHalf = this.feedbackHistory.filter(
      f => f.timestamp > midpoint && f.rating;
    );

    if (firstHalf.length === 0 || secondHalf.length === 0) return 0;

    const firstAvg = firstHalf.reduce((sum, f) => sum + f.rating!, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, f) => sum + f.rating!, 0) / secondHalf.length;

    return (secondAvg - firstAvg) / firstAvg;
  }

  private async calculateAgentPerformance(): Promise<Record<string, number>> {
    const performance: Record<string, number> = {};
    
    // Group feedback by agent
    const agentFeedback = new Map<string, UserFeedback[]>();
    
    for (const feedback of this.feedbackHistory) {
      const request = await this.getFeedbackRequest(feedback.requestId);
      if (!request) continue;
      
      if (!agentFeedback.has(request.agentId)) {
        agentFeedback.set(request.agentId, []);
      }
      agentFeedback.get(request.agentId)!.push(feedback);
    }

    // Calculate average rating per agent
    for (const [agentId, feedbacks] of agentFeedback) {
      const ratings = feedbacks.filter(f => f.rating).map(f => f.rating!);
      if (ratings.length > 0) {
        performance[agentId] = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      }
    }

    return performance;
  }

  private async getRecentFeedbackCount(agentId: string, userId?: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    return Array.from(this.pendingFeedback.values()).filter(r => ;
      r.agentId === agentId &&;
      r.timestamp > oneHourAgo &&;
      (!userId || r.metadata?.userId === userId);
    ).length;
  }

  private async loadFeedbackHistory(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('user_feedback');
        .select('*');
        .order('created_at', { ascending: false });
        .limit(1000);

      if (data) {
        this.feedbackHistory = data.map(f => ({
          feedbackId: f.feedback_id,
          requestId: f.request_id,
          feedbackType: f.feedback_type,
          rating: f.rating,
          correctedResponse: f.corrected_response,
          preferredResponse: f.preferred_response,
          labels: f.labels,
          comments: f.comments,
          userId: f.user_id,
          timestamp: new Date(f.created_at);
        }));
      }
    } catch (error) {
      logger.error('Failed to load feedback history:', error);
    }
  }

  private async loadTrainingDatasets(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('training_datasets');
        .select('*');

      if (data) {
        for (const dataset of data) {
          this.trainingDatasets.set(dataset.dataset_id, {
            datasetId: dataset.dataset_id,
            name: dataset.name,
            description: dataset.description,
            examples: dataset.examples || [],
            metadata: dataset.metadata;
          });
        }
      }
    } catch (error) {
      logger.error('Failed to load training datasets:', error);
    }
  }

  private async storeTrainingDataset(dataset: TrainingDataset): Promise<void> {
    try {
      await this.supabase.from('training_datasets').upsert({
        dataset_id: dataset.datasetId,
        name: dataset.name,
        description: dataset.description,
        examples: dataset.examples,
        metadata: dataset.metadata;
      });
    } catch (error) {
      logger.error('Failed to store training dataset:', error);
    }
  }

  private async updateFeedbackMetrics(feedback: UserFeedback): Promise<void> {
    // Update real-time metrics
    const metrics = await this.getFeedbackMetrics();
    this.emit('metrics_updated', metrics);
  }

  private broadcastFeedbackRequest(request: FeedbackRequest): void {
    const message = JSON.stringify({
      type: 'new_feedback_request',
      data: request;
    });

    this.wsConnections.forEach(ws => {
      try {
        ws.send(message);
      } catch (error) {
        logger.error('Failed to broadcast feedback request:', error);
      }
    });
  }

  private broadcastFeedbackUpdate(feedback: UserFeedback): void {
    const message = JSON.stringify({
      type: 'feedback_submitted',
      data: feedback;
    });

    this.wsConnections.forEach(ws => {
      try {
        ws.send(message);
      } catch (error) {
        logger.error('Failed to broadcast feedback update:', error);
      }
    });
  }
}

// Export singleton instance
export const humanFeedbackService = (supabase: SupabaseClient) => new HumanFeedbackService(supabase);