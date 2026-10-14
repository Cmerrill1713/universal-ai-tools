/**
 * Webhook Performance Optimizer
 * Optimizes webhook processing performance and handles high-volume scenarios
 */

export interface WebhookQueueItem {
  id: string;
  event: any;
  timestamp: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
}

export interface WebhookOptimizationConfig {
  maxConcurrentProcessors: number;
  queueSize: number;
  retryDelay: number;
  maxRetries: number;
  batchSize: number;
  enableBatching: boolean;
  enablePriorityQueue: boolean;
  enableRateLimiting: boolean;
  rateLimitPerMinute: number;
}

export class WebhookOptimizer {
  private config: WebhookOptimizationConfig;
  private queue: WebhookQueueItem[] = [];
  private processingQueue: Map<string, WebhookQueueItem> = new Map();
  private rateLimiter: Map<string, number[]> = new Map();
  private isProcessing: boolean = false;
  private processors: number = 0;

  constructor(config: WebhookOptimizationConfig) {
    this.config = config;
  }

  /**
   * Add webhook event to processing queue
   */
  async queueWebhookEvent(event: any, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<string> {
    const queueItem: WebhookQueueItem = {
      id: this.generateId(),
      event,
      timestamp: Date.now(),
      priority,
      retryCount: 0,
      maxRetries: this.config.maxRetries
    };

    // Check rate limiting
    if (this.config.enableRateLimiting) {
      const clientId = this.getClientId(event);
      if (!this.checkRateLimit(clientId)) {
        throw new Error('Rate limit exceeded');
      }
    }

    // Add to queue
    if (this.config.enablePriorityQueue) {
      this.addToPriorityQueue(queueItem);
    } else {
      this.queue.push(queueItem);
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return queueItem.id;
  }

  /**
   * Process webhook events from queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && this.processors < this.config.maxConcurrentProcessors) {
      const batch = this.getNextBatch();
      if (batch.length > 0) {
        this.processBatch(batch);
      }
    }
    
    this.isProcessing = false;
  }

  /**
   * Get next batch of events to process
   */
  private getNextBatch(): WebhookQueueItem[] {
    const batchSize = this.config.enableBatching ? this.config.batchSize : 1;
    const batch: WebhookQueueItem[] = [];
    
    for (let i = 0; i < batchSize && this.queue.length > 0; i++) {
      const item = this.queue.shift();
      if (item) {
        batch.push(item);
        this.processingQueue.set(item.id, item);
      }
    }
    
    return batch;
  }

  /**
   * Process a batch of webhook events
   */
  private async processBatch(batch: WebhookQueueItem[]): Promise<void> {
    this.processors++;
    
    try {
      if (this.config.enableBatching && batch.length > 1) {
        await this.processBatchEvents(batch);
      } else {
        for (const item of batch) {
          await this.processSingleEvent(item);
        }
      }
    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      // Retry individual events
      for (const item of batch) {
        await this.retryEvent(item);
      }
    } finally {
      this.processors--;
      
      // Remove from processing queue
      batch.forEach(item => this.processingQueue.delete(item.id));
      
      // Continue processing if there are more items
      if (this.queue.length > 0) {
        this.startProcessing();
      }
    }
  }

  /**
   * Process a single webhook event
   */
  private async processSingleEvent(item: WebhookQueueItem): Promise<void> {
    try {
      console.log(`🔄 Processing webhook event ${item.id} (${item.priority} priority)`);
      
      // Simulate webhook processing
      await this.simulateWebhookProcessing(item.event);
      
      console.log(`✅ Successfully processed webhook event ${item.id}`);
    } catch (error) {
      console.error(`❌ Failed to process webhook event ${item.id}:`, error);
      await this.retryEvent(item);
    }
  }

  /**
   * Process multiple webhook events in batch
   */
  private async processBatchEvents(batch: WebhookQueueItem[]): Promise<void> {
    try {
      console.log(`🔄 Processing batch of ${batch.length} webhook events`);
      
      // Group events by type for efficient processing
      const eventsByType = this.groupEventsByType(batch);
      
      // Process each type group
      for (const [eventType, events] of Object.entries(eventsByType)) {
        await this.processEventTypeGroup(eventType, events);
      }
      
      console.log(`✅ Successfully processed batch of ${batch.length} webhook events`);
    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Group events by type for efficient processing
   */
  private groupEventsByType(batch: WebhookQueueItem[]): { [key: string]: WebhookQueueItem[] } {
    const groups: { [key: string]: WebhookQueueItem[] } = {};
    
    batch.forEach(item => {
      const eventType = item.event.object_kind || 'unknown';
      if (!groups[eventType]) {
        groups[eventType] = [];
      }
      groups[eventType].push(item);
    });
    
    return groups;
  }

  /**
   * Process a group of events of the same type
   */
  private async processEventTypeGroup(eventType: string, events: WebhookQueueItem[]): Promise<void> {
    console.log(`🔄 Processing ${events.length} ${eventType} events`);
    
    // Simulate batch processing for the same event type
    await this.simulateBatchProcessing(eventType, events);
    
    console.log(`✅ Successfully processed ${events.length} ${eventType} events`);
  }

  /**
   * Retry a failed webhook event
   */
  private async retryEvent(item: WebhookQueueItem): Promise<void> {
    if (item.retryCount >= item.maxRetries) {
      console.error(`❌ Max retries exceeded for webhook event ${item.id}`);
      return;
    }
    
    item.retryCount++;
    console.log(`🔄 Retrying webhook event ${item.id} (attempt ${item.retryCount}/${item.maxRetries})`);
    
    // Add delay before retry
    await this.delay(this.config.retryDelay * item.retryCount);
    
    // Add back to queue with higher priority
    const retryItem = { ...item, priority: 'high' as const };
    this.queue.unshift(retryItem);
  }

  /**
   * Add item to priority queue
   */
  private addToPriorityQueue(item: WebhookQueueItem): void {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const itemPriority = priorityOrder[item.priority];
    
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[this.queue[i].priority] > itemPriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, item);
  }

  /**
   * Check rate limit for client
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const minuteAgo = now - 60000; // 1 minute ago
    
    if (!this.rateLimiter.has(clientId)) {
      this.rateLimiter.set(clientId, []);
    }
    
    const timestamps = this.rateLimiter.get(clientId)!;
    
    // Remove timestamps older than 1 minute
    const recentTimestamps = timestamps.filter(ts => ts > minuteAgo);
    this.rateLimiter.set(clientId, recentTimestamps);
    
    // Check if under rate limit
    if (recentTimestamps.length >= this.config.rateLimitPerMinute) {
      return false;
    }
    
    // Add current timestamp
    recentTimestamps.push(now);
    return true;
  }

  /**
   * Get client ID from webhook event
   */
  private getClientId(event: any): string {
    return event.project?.id?.toString() || 'unknown';
  }

  /**
   * Simulate webhook processing
   */
  private async simulateWebhookProcessing(event: any): Promise<void> {
    // Simulate processing time based on event type
    const processingTimes = {
      issue: 50,
      merge_request: 75,
      pipeline: 100,
      push: 25,
      note: 30,
      wiki_page: 40,
      build: 60
    };
    
    const eventType = event.object_kind || 'unknown';
    const processingTime = processingTimes[eventType] || 50;
    
    await this.delay(processingTime);
  }

  /**
   * Simulate batch processing
   */
  private async simulateBatchProcessing(eventType: string, events: WebhookQueueItem[]): Promise<void> {
    // Batch processing is more efficient
    const baseTime = 100; // Base time for batch processing
    const perEventTime = 10; // Additional time per event
    const totalTime = baseTime + (events.length * perEventTime);
    
    await this.delay(totalTime);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): any {
    return {
      queueLength: this.queue.length,
      processingCount: this.processingQueue.size,
      activeProcessors: this.processors,
      isProcessing: this.isProcessing,
      rateLimiterSize: this.rateLimiter.size
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    const now = Date.now();
    const recentEvents = this.queue.filter(item => now - item.timestamp < 60000); // Last minute
    
    return {
      eventsPerMinute: recentEvents.length,
      averageQueueTime: this.calculateAverageQueueTime(),
      processingEfficiency: this.calculateProcessingEfficiency(),
      retryRate: this.calculateRetryRate()
    };
  }

  /**
   * Calculate average queue time
   */
  private calculateAverageQueueTime(): number {
    if (this.queue.length === 0) return 0;
    
    const now = Date.now();
    const totalTime = this.queue.reduce((sum, item) => sum + (now - item.timestamp), 0);
    return totalTime / this.queue.length;
  }

  /**
   * Calculate processing efficiency
   */
  private calculateProcessingEfficiency(): number {
    const totalCapacity = this.config.maxConcurrentProcessors;
    const currentUtilization = this.processors / totalCapacity;
    return Math.round(currentUtilization * 100);
  }

  /**
   * Calculate retry rate
   */
  private calculateRetryRate(): number {
    const totalEvents = this.queue.length + this.processingQueue.size;
    if (totalEvents === 0) return 0;
    
    const retryEvents = this.queue.filter(item => item.retryCount > 0).length;
    return Math.round((retryEvents / totalEvents) * 100);
  }

  /**
   * Clear queue (for testing)
   */
  clearQueue(): void {
    this.queue = [];
    this.processingQueue.clear();
    this.rateLimiter.clear();
  }
}