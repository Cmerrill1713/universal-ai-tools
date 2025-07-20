/**
 * Knowledge Update Automation Service
 * Manages automated knowledge updates, version tracking, and migration
 */

import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { supabase } from './supabase_service';
import { KnowledgeScraperService } from './knowledge-scraper-service';
import { KnowledgeValidationService } from './knowledge-validation-service';
import { KnowledgeFeedbackService } from './knowledge-feedback-service';
import { DSPyKnowledgeManager } from '../core/knowledge/dspy-knowledge-manager';
import { KNOWLEDGE_SOURCES } from '../config/knowledge-sources';
import { createHash } from 'crypto';

interface UpdateJob {
  id: string;
  sourceId: string;
  url: string;
  updateType: 'new' | 'update' | 'deprecate' | 'delete';
  priority: number;
  scheduledFor: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  errorDetails?: any;
}

interface VersionInfo {
  versionId: string;
  previousVersionId?: string;
  changeType: 'major' | 'minor' | 'patch';
  changes: string[];
  timestamp: Date;
}

interface MigrationPlan {
  oldKnowledgeId: string;
  newKnowledgeId: string;
  migrationSteps: string[];
  affectedDependencies: string[];
  estimatedImpact: 'low' | 'medium' | 'high';
}

export class KnowledgeUpdateAutomationService extends EventEmitter {
  private scraperService: KnowledgeScraperService;
  private validationService: KnowledgeValidationService;
  private feedbackService: KnowledgeFeedbackService;
  private knowledgeManager: DSPyKnowledgeManager;
  
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private activeJobs: Map<string, UpdateJob> = new Map();
  private updateQueue: UpdateJob[] = [];
  
  // Configuration
  private maxConcurrentJobs = 5;
  private maxRetries = 3;
  private batchSize = 10;

  constructor(
    scraperService: KnowledgeScraperService,
    validationService: KnowledgeValidationService,
    feedbackService: KnowledgeFeedbackService,
    knowledgeManager: DSPyKnowledgeManager
  ) {
    super();
    this.scraperService = scraperService;
    this.validationService = validationService;
    this.feedbackService = feedbackService;
    this.knowledgeManager = knowledgeManager;
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Schedule main update processor
    const processorJob = cron.schedule('*/5 * * * *', () => this.processUpdateQueue());
    this.scheduledJobs.set('processor', processorJob);
    processorJob.start();

    // Schedule knowledge refresh checker
    const refreshJob = cron.schedule('0 * * * *', () => this.checkForRefreshNeeds());
    this.scheduledJobs.set('refresh', refreshJob);
    refreshJob.start();

    // Schedule deprecation detector
    const deprecationJob = cron.schedule('0 2 * * *', () => this.detectDeprecatedKnowledge());
    this.scheduledJobs.set('deprecation', deprecationJob);
    deprecationJob.start();

    // Schedule version consolidation
    const consolidationJob = cron.schedule('0 3 * * 0', () => this.consolidateVersions());
    this.scheduledJobs.set('consolidation', consolidationJob);
    consolidationJob.start();

    // Load pending jobs from database
    await this.loadPendingJobs();

    logger.info('Knowledge update automation service initialized');
  }

  /**
   * Process the update queue
   */
  private async processUpdateQueue(): Promise<void> {
    try {
      // Check if we can process more jobs
      if (this.activeJobs.size >= this.maxConcurrentJobs) {
        return;
      }

      // Get jobs to process
      const availableSlots = this.maxConcurrentJobs - this.activeJobs.size;
      const jobsToProcess = await this.getNextJobs(availableSlots);

      // Process each job
      for (const job of jobsToProcess) {
        this.processUpdateJob(job);
      }

    } catch (error) {
      logger.error('Error processing update queue:', error);
    }
  }

  /**
   * Process a single update job
   */
  private async processUpdateJob(job: UpdateJob): Promise<void> {
    try {
      // Mark as processing
      this.activeJobs.set(job.id, job);
      await this.updateJobStatus(job.id, 'processing');

      logger.info(`Processing update job: ${job.id} (${job.updateType} for ${job.sourceId})`);

      let result: boolean = false;

      switch (job.updateType) {
        case 'new':
          result = await this.processNewKnowledge(job);
          break;
        case 'update':
          result = await this.processKnowledgeUpdate(job);
          break;
        case 'deprecate':
          result = await this.processKnowledgeDeprecation(job);
          break;
        case 'delete':
          result = await this.processKnowledgeDeletion(job);
          break;
      }

      if (result) {
        await this.updateJobStatus(job.id, 'completed');
        this.emit('job_completed', job);
      } else {
        throw new Error('Job processing failed');
      }

    } catch (error) {
      logger.error(`Error processing job ${job.id}:`, error);
      
      // Increment attempts
      job.attempts++;
      
      if (job.attempts < this.maxRetries) {
        // Reschedule
        const delayMinutes = Math.pow(2, job.attempts) * 5; // Exponential backoff
        job.scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
        await this.updateJobStatus(job.id, 'pending', error);
      } else {
        // Mark as failed
        await this.updateJobStatus(job.id, 'failed', error);
        this.emit('job_failed', job);
      }
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Process new knowledge
   */
  private async processNewKnowledge(job: UpdateJob): Promise<boolean> {
    try {
      const source = KNOWLEDGE_SOURCES.find(s => s.id === job.sourceId);
      if (!source) {
        throw new Error(`Unknown source: ${job.sourceId}`);
      }

      // Scrape content
      const scrapedContent = await this.scraperService.scrapeSource(source);
      if (scrapedContent.length === 0) {
        logger.warn(`No content scraped from ${job.url}`);
        return true; // Not an error, just no content
      }

      // Process each scraped item
      for (const content of scrapedContent) {
        // Validate content
        const validationResults = await this.validationService.validateScrapedKnowledge(
          content.sourceId,
          content.content,
          source,
          content.metadata
        );

        // Check if validation passed
        const overallValid = validationResults.every(v => v.isValid);
        if (!overallValid) {
          logger.warn(`Content validation failed for ${content.url}`);
          continue;
        }

        // Store in knowledge manager
        const knowledgeId = await this.knowledgeManager.storeKnowledge({
          type: 'solution',
          title: content.title,
          description: `Scraped from ${source.name}`,
          content: content.content,
          tags: content.categories,
          confidence: content.quality || 0.8,
          metadata: {
            source: source.id,
            url: content.url,
            scrapedAt: content.scrapedAt
          }
        });

        logger.info(`Stored new knowledge: ${knowledgeId}`);
      }

      return true;

    } catch (error) {
      logger.error('Error processing new knowledge:', error);
      throw error;
    }
  }

  /**
   * Process knowledge update
   */
  private async processKnowledgeUpdate(job: UpdateJob): Promise<boolean> {
    try {
      // Find existing knowledge
      const existing = await this.findExistingKnowledge(job.url);
      if (!existing) {
        // Convert to new knowledge job
        job.updateType = 'new';
        return this.processNewKnowledge(job);
      }

      const source = KNOWLEDGE_SOURCES.find(s => s.id === job.sourceId);
      if (!source) {
        throw new Error(`Unknown source: ${job.sourceId}`);
      }

      // Scrape updated content
      const scrapedContent = await this.scraperService.scrapeSource(source);
      const updatedContent = scrapedContent.find(c => c.url === job.url);
      
      if (!updatedContent) {
        logger.warn(`No updated content found for ${job.url}`);
        return true;
      }

      // Check if content actually changed
      const contentHash = createHash('sha256').update(updatedContent.content).digest('hex');
      if (contentHash === existing.content_hash) {
        logger.info(`Content unchanged for ${job.url}`);
        return true;
      }

      // Validate updated content
      const validationResults = await this.validationService.validateScrapedKnowledge(
        existing.id,
        updatedContent.content,
        source,
        updatedContent.metadata
      );

      const overallValid = validationResults.every(v => v.isValid);
      if (!overallValid) {
        logger.warn(`Updated content validation failed for ${job.url}`);
        
        // Create alert for validation failure
        await this.createAlert(
          'validation_failure',
          'medium',
          'Knowledge Update Validation Failed',
          `Update for ${updatedContent.title} failed validation`,
          [{ id: existing.id, url: job.url }]
        );
        
        return false;
      }

      // Create version before update
      const versionInfo = await this.createKnowledgeVersion(existing, updatedContent);

      // Update knowledge
      await this.knowledgeManager.updateKnowledge(existing.id, {
        content: updatedContent.content,
        metadata: {
          ...existing.metadata,
          lastUpdated: new Date().toISOString(),
          version: versionInfo.versionId,
          updateReason: 'scheduled_refresh'
        }
      });

      // Track the update
      await this.feedbackService.trackUsage({
        knowledgeId: existing.id,
        knowledgeType: 'scraped',
        agentId: 'update-automation',
        actionType: 'used',
        context: { updateType: 'content_refresh', versionId: versionInfo.versionId },
        performanceScore: 1.0
      });

      logger.info(`Updated knowledge: ${existing.id} (version: ${versionInfo.versionId})`);
      return true;

    } catch (error) {
      logger.error('Error processing knowledge update:', error);
      throw error;
    }
  }

  /**
   * Process knowledge deprecation
   */
  private async processKnowledgeDeprecation(job: UpdateJob): Promise<boolean> {
    try {
      const knowledge = await this.findExistingKnowledge(job.url);
      if (!knowledge) {
        logger.warn(`Knowledge not found for deprecation: ${job.url}`);
        return true;
      }

      // Check for dependencies
      const dependencies = await this.findKnowledgeDependencies(knowledge.id);
      
      if (dependencies.length > 0) {
        // Create migration plan
        const migrationPlan = await this.createMigrationPlan(knowledge, dependencies);
        
        // Store migration plan
        await supabase
          .from('knowledge_migrations')
          .insert({
            old_knowledge_id: knowledge.id,
            migration_plan: migrationPlan,
            status: 'pending',
            created_at: new Date().toISOString()
          });

        // Create alert for manual review
        await this.createAlert(
          'deprecation',
          'high',
          'Knowledge Deprecation Requires Migration',
          `${knowledge.title} has ${dependencies.length} dependencies`,
          [{ id: knowledge.id, dependencies: dependencies.length }]
        );
      }

      // Mark as deprecated
      await supabase
        .from('scraped_knowledge')
        .update({
          validation_status: 'deprecated',
          metadata: {
            ...knowledge.metadata,
            deprecatedAt: new Date().toISOString(),
            deprecationReason: job.errorDetails?.reason || 'scheduled'
          }
        })
        .eq('id', knowledge.id);

      logger.info(`Deprecated knowledge: ${knowledge.id}`);
      return true;

    } catch (error) {
      logger.error('Error processing knowledge deprecation:', error);
      throw error;
    }
  }

  /**
   * Process knowledge deletion
   */
  private async processKnowledgeDeletion(job: UpdateJob): Promise<boolean> {
    try {
      const knowledge = await this.findExistingKnowledge(job.url);
      if (!knowledge) {
        logger.warn(`Knowledge not found for deletion: ${job.url}`);
        return true;
      }

      // Archive before deletion
      await this.archiveKnowledge(knowledge);

      // Delete from knowledge manager
      await this.knowledgeManager.deleteKnowledge(knowledge.id);

      // Delete from scraped knowledge
      await supabase
        .from('scraped_knowledge')
        .delete()
        .eq('id', knowledge.id);

      logger.info(`Deleted knowledge: ${knowledge.id}`);
      return true;

    } catch (error) {
      logger.error('Error processing knowledge deletion:', error);
      throw error;
    }
  }

  /**
   * Check for knowledge that needs refresh
   */
  private async checkForRefreshNeeds(): Promise<void> {
    try {
      logger.info('Checking for knowledge refresh needs');

      // Get update recommendations
      const { data: recommendations, error } = await supabase.rpc(
        'generate_knowledge_update_recommendations',
        { p_limit: 50 }
      );

      if (error) {
        logger.error('Failed to get update recommendations:', error);
        return;
      }

      if (!recommendations || recommendations.length === 0) {
        logger.info('No knowledge refresh needed');
        return;
      }

      // Queue update jobs
      for (const rec of recommendations) {
        await this.queueUpdateJob({
          sourceId: rec.source_id,
          url: rec.url,
          updateType: rec.update_type as UpdateJob['updateType'],
          priority: rec.priority,
          scheduledFor: new Date(),
          errorDetails: { reason: rec.reason }
        });
      }

      logger.info(`Queued ${recommendations.length} knowledge refresh jobs`);

    } catch (error) {
      logger.error('Error checking refresh needs:', error);
    }
  }

  /**
   * Detect deprecated knowledge
   */
  private async detectDeprecatedKnowledge(): Promise<void> {
    try {
      logger.info('Detecting deprecated knowledge');

      const { data: deprecated, error } = await supabase.rpc('detect_deprecated_knowledge');

      if (error) {
        logger.error('Failed to detect deprecated knowledge:', error);
        return;
      }

      if (!deprecated || deprecated.length === 0) {
        logger.info('No deprecated knowledge detected');
        return;
      }

      // Queue deprecation jobs
      for (const item of deprecated) {
        // Find URL for the knowledge item
        const knowledge = await this.getKnowledgeById(item.knowledge_id, item.knowledge_type);
        if (!knowledge) continue;

        await this.queueUpdateJob({
          sourceId: knowledge.source_id || 'unknown',
          url: knowledge.url || item.knowledge_id,
          updateType: 'deprecate',
          priority: item.confidence > 0.8 ? 8 : 5,
          scheduledFor: new Date(),
          errorDetails: { 
            reason: item.deprecation_reason,
            confidence: item.confidence
          }
        });
      }

      // Create summary alert
      await this.createAlert(
        'deprecation',
        deprecated.length > 10 ? 'high' : 'medium',
        'Deprecated Knowledge Detected',
        `${deprecated.length} items identified as potentially deprecated`,
        deprecated.slice(0, 10)
      );

      logger.info(`Queued ${deprecated.length} deprecation jobs`);

    } catch (error) {
      logger.error('Error detecting deprecated knowledge:', error);
    }
  }

  /**
   * Consolidate knowledge versions
   */
  private async consolidateVersions(): Promise<void> {
    try {
      logger.info('Consolidating knowledge versions');

      // Find knowledge with many versions
      const { data: versionedKnowledge, error } = await supabase
        .from('knowledge_versions')
        .select('knowledge_id, count')
        .gt('version_count', 10)
        .order('version_count', { ascending: false })
        .limit(20);

      if (error || !versionedKnowledge) return;

      for (const item of versionedKnowledge) {
        // Get all versions
        const versions = await this.getKnowledgeVersions(item.knowledge_id);
        
        // Keep only significant versions
        const significantVersions = this.identifySignificantVersions(versions);
        const versionsToArchive = versions.filter(v => 
          !significantVersions.some(sv => sv.versionId === v.versionId)
        );

        // Archive old versions
        for (const version of versionsToArchive) {
          await this.archiveVersion(version);
        }

        logger.info(`Consolidated versions for ${item.knowledge_id}: kept ${significantVersions.length} of ${versions.length}`);
      }

    } catch (error) {
      logger.error('Error consolidating versions:', error);
    }
  }

  // Helper methods

  private async loadPendingJobs(): Promise<void> {
    const { data: jobs, error } = await supabase
      .from('knowledge_update_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('Failed to load pending jobs:', error);
      return;
    }

    this.updateQueue = jobs?.map(j => ({
      id: j.id,
      sourceId: j.source_id,
      url: j.url,
      updateType: j.update_type,
      priority: j.priority,
      scheduledFor: new Date(j.scheduled_for),
      status: j.status,
      attempts: j.attempts,
      errorDetails: j.error_details
    })) || [];
  }

  private async getNextJobs(count: number): Promise<UpdateJob[]> {
    // Get from memory queue first
    const jobs = this.updateQueue
      .filter(j => j.status === 'pending' && j.scheduledFor <= new Date())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, count);

    // Update queue
    this.updateQueue = this.updateQueue.filter(j => !jobs.includes(j));

    // If not enough, fetch from database
    if (jobs.length < count) {
      await this.loadPendingJobs();
      const additionalJobs = this.updateQueue
        .slice(0, count - jobs.length);
      jobs.push(...additionalJobs);
      this.updateQueue = this.updateQueue.filter(j => !additionalJobs.includes(j));
    }

    return jobs;
  }

  private async updateJobStatus(
    jobId: string,
    status: UpdateJob['status'],
    error?: any
  ): Promise<void> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'processing') {
      updates.last_attempt = new Date().toISOString();
    }

    if (error) {
      updates.error_details = {
        message: error.message || String(error),
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }

    await supabase
      .from('knowledge_update_queue')
      .update(updates)
      .eq('id', jobId);
  }

  private async findExistingKnowledge(url: string): Promise<any> {
    const { data, error } = await supabase
      .from('scraped_knowledge')
      .select('*')
      .eq('url', url)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error finding existing knowledge:', error);
    }

    return data;
  }

  private async findKnowledgeDependencies(knowledgeId: string): Promise<any[]> {
    const { data: relationships } = await supabase
      .from('learned_knowledge_relationships')
      .select('*')
      .or(`source_knowledge_id.eq.${knowledgeId},target_knowledge_id.eq.${knowledgeId}`)
      .gte('strength', 0.5);

    return relationships || [];
  }

  private async createKnowledgeVersion(
    existing: any,
    updated: any
  ): Promise<VersionInfo> {
    const changes = this.detectChanges(existing.content, updated.content);
    const changeType = this.classifyChangeType(changes);

    const versionInfo: VersionInfo = {
      versionId: `v${Date.now()}`,
      previousVersionId: existing.metadata?.version,
      changeType,
      changes: changes.slice(0, 10), // Limit to top 10 changes
      timestamp: new Date()
    };

    // Store version
    await supabase
      .from('knowledge_versions')
      .insert({
        knowledge_id: existing.id,
        version_id: versionInfo.versionId,
        previous_version_id: versionInfo.previousVersionId,
        change_type: versionInfo.changeType,
        changes: versionInfo.changes,
        content_snapshot: existing.content,
        metadata_snapshot: existing.metadata,
        created_at: versionInfo.timestamp
      });

    return versionInfo;
  }

  private detectChanges(oldContent: string, newContent: string): string[] {
    // Simple change detection - would use diff algorithm in production
    const changes: string[] = [];
    
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    if (oldLines.length !== newLines.length) {
      changes.push(`Line count changed: ${oldLines.length} -> ${newLines.length}`);
    }
    
    // More sophisticated change detection would go here
    
    return changes;
  }

  private classifyChangeType(changes: string[]): 'major' | 'minor' | 'patch' {
    if (changes.length > 20) return 'major';
    if (changes.length > 5) return 'minor';
    return 'patch';
  }

  private async createMigrationPlan(
    knowledge: any,
    dependencies: any[]
  ): Promise<MigrationPlan> {
    return {
      oldKnowledgeId: knowledge.id,
      newKnowledgeId: '', // To be determined
      migrationSteps: [
        'Identify replacement knowledge',
        'Update dependent relationships',
        'Notify affected agents',
        'Monitor usage during transition',
        'Complete migration after validation'
      ],
      affectedDependencies: dependencies.map(d => d.id),
      estimatedImpact: dependencies.length > 10 ? 'high' : 
                       dependencies.length > 5 ? 'medium' : 'low'
    };
  }

  private async archiveKnowledge(knowledge: any): Promise<void> {
    await supabase
      .from('knowledge_archive')
      .insert({
        original_id: knowledge.id,
        content: knowledge,
        archived_at: new Date().toISOString(),
        archive_reason: 'deletion'
      });
  }

  private async getKnowledgeById(id: string, type: string): Promise<any> {
    if (type === 'scraped') {
      const { data } = await supabase
        .from('scraped_knowledge')
        .select('*')
        .eq('id', id)
        .single();
      return data;
    }
    
    // Handle other types
    return null;
  }

  private async getKnowledgeVersions(knowledgeId: string): Promise<VersionInfo[]> {
    const { data } = await supabase
      .from('knowledge_versions')
      .select('*')
      .eq('knowledge_id', knowledgeId)
      .order('created_at', { ascending: false });

    return data?.map(v => ({
      versionId: v.version_id,
      previousVersionId: v.previous_version_id,
      changeType: v.change_type,
      changes: v.changes,
      timestamp: new Date(v.created_at)
    })) || [];
  }

  private identifySignificantVersions(versions: VersionInfo[]): VersionInfo[] {
    // Keep major versions and recent versions
    const significant: VersionInfo[] = [];
    
    // Keep all major versions
    significant.push(...versions.filter(v => v.changeType === 'major'));
    
    // Keep last 3 minor versions
    const minorVersions = versions.filter(v => v.changeType === 'minor');
    significant.push(...minorVersions.slice(0, 3));
    
    // Keep last version regardless
    if (versions.length > 0 && !significant.includes(versions[0])) {
      significant.push(versions[0]);
    }
    
    return significant;
  }

  private async archiveVersion(version: VersionInfo): Promise<void> {
    await supabase
      .from('knowledge_versions')
      .update({ archived: true })
      .eq('version_id', version.versionId);
  }

  private async createAlert(
    alertType: string,
    severity: string,
    title: string,
    description: string,
    affectedItems: any[]
  ): Promise<void> {
    await supabase
      .from('knowledge_monitoring_alerts')
      .insert({
        alert_type: alertType,
        severity,
        title,
        description,
        affected_items: affectedItems
      });
  }

  /**
   * Queue a new update job
   */
  async queueUpdateJob(job: Partial<UpdateJob>): Promise<string> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const fullJob: UpdateJob = {
      id: jobId,
      sourceId: job.sourceId!,
      url: job.url!,
      updateType: job.updateType || 'update',
      priority: job.priority || 5,
      scheduledFor: job.scheduledFor || new Date(),
      status: 'pending',
      attempts: 0,
      errorDetails: job.errorDetails
    };

    // Store in database
    await supabase
      .from('knowledge_update_queue')
      .insert({
        id: fullJob.id,
        source_id: fullJob.sourceId,
        url: fullJob.url,
        update_type: fullJob.updateType,
        priority: fullJob.priority,
        scheduled_for: fullJob.scheduledFor.toISOString(),
        status: fullJob.status,
        attempts: fullJob.attempts,
        error_details: fullJob.errorDetails
      });

    // Add to memory queue if scheduled soon
    if (fullJob.scheduledFor <= new Date(Date.now() + 5 * 60 * 1000)) {
      this.updateQueue.push(fullJob);
    }

    logger.info(`Queued update job: ${jobId}`);
    return jobId;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<UpdateJob | null> {
    // Check active jobs first
    if (this.activeJobs.has(jobId)) {
      return this.activeJobs.get(jobId)!;
    }

    // Check database
    const { data, error } = await supabase
      .from('knowledge_update_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      sourceId: data.source_id,
      url: data.url,
      updateType: data.update_type,
      priority: data.priority,
      scheduledFor: new Date(data.scheduled_for),
      status: data.status,
      attempts: data.attempts,
      errorDetails: data.error_details
    };
  }

  /**
   * Get automation statistics
   */
  async getStatistics(): Promise<any> {
    const stats = {
      activeJobs: this.activeJobs.size,
      queuedJobs: this.updateQueue.length,
      jobsByType: {} as Record<string, number>,
      recentCompletions: 0,
      recentFailures: 0,
      averageProcessingTime: 0
    };

    // Get recent job statistics
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { data: recentJobs } = await supabase
      .from('knowledge_update_queue')
      .select('update_type, status, created_at, updated_at')
      .gte('updated_at', oneDayAgo.toISOString());

    if (recentJobs) {
      for (const job of recentJobs) {
        // Count by type
        stats.jobsByType[job.update_type] = (stats.jobsByType[job.update_type] || 0) + 1;
        
        // Count completions and failures
        if (job.status === 'completed') stats.recentCompletions++;
        if (job.status === 'failed') stats.recentFailures++;
        
        // Calculate processing time
        if (job.status === 'completed' && job.created_at && job.updated_at) {
          const processingTime = new Date(job.updated_at).getTime() - new Date(job.created_at).getTime();
          stats.averageProcessingTime += processingTime;
        }
      }
      
      if (stats.recentCompletions > 0) {
        stats.averageProcessingTime /= stats.recentCompletions;
      }
    }

    return stats;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    // Stop all scheduled jobs
    for (const [name, job] of Array.from(this.scheduledJobs.entries())) {
      job.stop();
      logger.info(`Stopped scheduled job: ${name}`);
    }
    
    // Wait for active jobs to complete
    if (this.activeJobs.size > 0) {
      logger.info(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Clear queues
    this.updateQueue = [];
    this.activeJobs.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

// Export factory function
export function createKnowledgeUpdateAutomation(
  scraperService: KnowledgeScraperService,
  validationService: KnowledgeValidationService,
  feedbackService: KnowledgeFeedbackService,
  knowledgeManager: DSPyKnowledgeManager
): KnowledgeUpdateAutomationService {
  return new KnowledgeUpdateAutomationService(
    scraperService,
    validationService,
    feedbackService,
    knowledgeManager
  );
}