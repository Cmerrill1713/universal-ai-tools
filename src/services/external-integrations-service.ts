/**
 * External Integrations Service
 * Handles integration with external systems like email, file systems, and other services
 * Enables autonomous agents to interact with the real world
 * 
 * Features:
 * - Email integration (Gmail, Outlook, IMAP/SMTP)
 * - File system operations (local and cloud storage)
 * - Web scraping and data extraction
 * - API integrations for external services
 * - Document processing and analysis
 * - Notification systems (Slack, Discord, webhooks)
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';

import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';

export interface EmailAccount {
  id: string;
  name: string;
  type: 'gmail' | 'outlook' | 'imap' | 'exchange';
  credentials: {
    email: string;
    accessToken?: string;
    refreshToken?: string;
    username?: string;
    password?: string;
    imapHost?: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
  };
  isConnected: boolean;
  lastSync?: Date;
  syncEnabled: boolean;
}

export interface EmailMessage {
  id: string;
  messageId: string;
  subject: string;
  from: { name?: string; address: string }[];
  to: { name?: string; address: string }[];
  cc?: { name?: string; address: string }[];
  bcc?: { name?: string; address: string }[];
  date: Date;
  bodyText?: string;
  bodyHtml?: string;
  attachments: EmailAttachment[];
  labels: string[];
  flags: string[];
  accountId: string;
  threadId?: string;
  isRead: boolean;
  isImportant: boolean;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  data?: Buffer;
  url?: string;
}

export interface FileOperation {
  id: string;
  type: 'read' | 'write' | 'move' | 'copy' | 'delete' | 'create_directory' | 'list_directory' | 'watch';
  path: string;
  targetPath?: string;
  content?: Buffer | string;
  options?: {
    recursive?: boolean;
    encoding?: string;
    mode?: number;
    overwrite?: boolean;
    createParentDirs?: boolean;
  };
  metadata?: {
    size?: number;
    mtime?: Date;
    ctime?: Date;
    permissions?: string;
    owner?: string;
  };
  result?: any;
  error?: string;
  timestamp: Date;
  userId?: string;
}

export interface CloudStorage {
  id: string;
  provider: 'google_drive' | 'dropbox' | 'onedrive' | 'aws_s3' | 'azure_blob';
  credentials: any;
  isConnected: boolean;
  rootPath?: string;
  syncEnabled: boolean;
}

export interface WebScrapingTask {
  id: string;
  url: string;
  selector?: string;
  extractionRules: {
    field: string;
    selector: string;
    attribute?: string;
    transform?: 'text' | 'html' | 'attr' | 'href' | 'src';
  }[];
  schedule?: {
    frequency: 'once' | 'hourly' | 'daily' | 'weekly';
    cron?: string;
  };
  lastRun?: Date;
  status: 'active' | 'paused' | 'completed' | 'error';
  results: any[];
}

export interface NotificationChannel {
  id: string;
  type: 'slack' | 'discord' | 'teams' | 'webhook' | 'email' | 'sms';
  name: string;
  credentials: any;
  isActive: boolean;
  filters?: {
    priority?: string[];
    categories?: string[];
    keywords?: string[];
  };
}

export interface ExternalAPIIntegration {
  id: string;
  name: string;
  baseUrl: string;
  authentication: {
    type: 'api_key' | 'bearer' | 'oauth2' | 'basic';
    credentials: any;
  };
  endpoints: {
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    parameters?: any;
    headers?: Record<string, string>;
  }[];
  rateLimiting?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  isActive: boolean;
}

export class ExternalIntegrationsService extends EventEmitter {
  private emailAccounts: Map<string, EmailAccount> = new Map();
  private cloudStorages: Map<string, CloudStorage> = new Map();
  private webScrapingTasks: Map<string, WebScrapingTask> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private apiIntegrations: Map<string, ExternalAPIIntegration> = new Map();
  private fileWatchers: Map<string, any> = new Map();
  private supabase: any;
  private isInitialized = false;

  // Rate limiting and request tracking
  private apiRequestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private operationQueue: any[] = [];
  private isProcessingQueue = false;

  constructor() {
    super();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Initialize Supabase for storing integration configurations
      if (config.supabase.url && config.supabase.serviceKey) {
        this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
      }

      // Load saved integrations
      await this.loadIntegrations();
      
      // Start background processes
      this.startQueueProcessor();
      this.startPeriodicTasks();
      
      this.isInitialized = true;
      
      log.info('✅ External Integrations Service initialized', LogContext.AI, {
        emailAccounts: this.emailAccounts.size,
        cloudStorages: this.cloudStorages.size,
        notificationChannels: this.notificationChannels.size,
        apiIntegrations: this.apiIntegrations.size
      });
      
    } catch (error) {
      log.error('❌ Failed to initialize External Integrations Service', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Email Integration Methods
  
  /**
   * Add an email account for integration
   */
  async addEmailAccount(accountData: Omit<EmailAccount, 'id' | 'isConnected' | 'lastSync'>): Promise<boolean> {
    try {
      const account: EmailAccount = {
        id: this.generateId('email'),
        ...accountData,
        isConnected: false,
        lastSync: undefined
      };

      // Test connection
      const isConnected = await this.testEmailConnection(account);
      account.isConnected = isConnected;

      this.emailAccounts.set(account.id, account);
      
      if (isConnected && account.syncEnabled) {
        // Initial email sync
        await this.syncEmails(account.id);
        
        log.info('✅ Email account added and connected', LogContext.AI, {
          accountId: account.id,
          email: account.credentials.email,
          type: account.type
        });
      }

      this.emit('emailAccountAdded', account);
      return isConnected;
      
    } catch (error) {
      log.error('❌ Failed to add email account', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Send an email through an integrated account
   */
  async sendEmail(
    accountId: string,
    to: string[],
    subject: string,
    body: string,
    options?: {
      cc?: string[];
      bcc?: string[];
      attachments?: EmailAttachment[];
      isHtml?: boolean;
      priority?: 'high' | 'normal' | 'low';
    }
  ): Promise<boolean> {
    const account = this.emailAccounts.get(accountId);
    if (!account || !account.isConnected) {
      log.error('❌ Email account not available for sending', LogContext.AI, { accountId });
      return false;
    }

    try {
      log.info('📧 Sending email', LogContext.AI, {
        accountId,
        to,
        subject,
        hasAttachments: (options?.attachments?.length || 0) > 0
      });

      // Implementation would integrate with actual email providers
      // For now, simulate sending
      await this.simulateEmailSend(account, to, subject, body, options);

      this.emit('emailSent', {
        accountId,
        to,
        subject,
        timestamp: new Date()
      });

      return true;
      
    } catch (error) {
      log.error('❌ Failed to send email', LogContext.AI, {
        accountId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Search emails across all connected accounts
   */
  async searchEmails(query: {
    text?: string;
    from?: string;
    to?: string;
    subject?: string;
    since?: Date;
    until?: Date;
    hasAttachment?: boolean;
    isUnread?: boolean;
    accountIds?: string[];
  }): Promise<EmailMessage[]> {
    const results: EmailMessage[] = [];
    
    try {
      // Implementation would search across email providers
      // For now, return mock results
      log.info('🔍 Searching emails', LogContext.AI, { query });
      
      this.emit('emailSearchCompleted', { query, resultsCount: results.length });
      
    } catch (error) {
      log.error('❌ Email search failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return results;
  }

  // File System Operations

  /**
   * Perform file system operations safely
   */
  async performFileOperation(operation: Omit<FileOperation, 'id' | 'timestamp' | 'result' | 'error'>): Promise<FileOperation> {
    const fileOp: FileOperation = {
      ...operation,
      id: this.generateId('file_op'),
      timestamp: new Date()
    };

    try {
      // Security check - ensure path is within allowed directories
      if (!this.isPathAllowed(fileOp.path)) {
        throw new Error(`Access denied to path: ${fileOp.path}`);
      }

      log.info('📁 Performing file operation', LogContext.AI, {
        operationId: fileOp.id,
        type: fileOp.type,
        path: fileOp.path
      });

      switch (fileOp.type) {
        case 'read':
          fileOp.result = await this.readFile(fileOp.path, fileOp.options?.encoding);
          break;
          
        case 'write':
          fileOp.result = await this.writeFile(fileOp.path, fileOp.content!, fileOp.options);
          break;
          
        case 'move':
          if (!fileOp.targetPath) throw new Error('Target path required for move operation');
          fileOp.result = await this.moveFile(fileOp.path, fileOp.targetPath);
          break;
          
        case 'copy':
          if (!fileOp.targetPath) throw new Error('Target path required for copy operation');
          fileOp.result = await this.copyFile(fileOp.path, fileOp.targetPath);
          break;
          
        case 'delete':
          fileOp.result = await this.deleteFile(fileOp.path, fileOp.options?.recursive);
          break;
          
        case 'create_directory':
          fileOp.result = await this.createDirectory(fileOp.path, fileOp.options?.recursive);
          break;
          
        case 'list_directory':
          fileOp.result = await this.listDirectory(fileOp.path);
          break;
          
        case 'watch':
          fileOp.result = await this.watchPath(fileOp.path);
          break;
          
        default:
          throw new Error(`Unknown file operation type: ${fileOp.type}`);
      }

      log.info('✅ File operation completed', LogContext.AI, {
        operationId: fileOp.id,
        type: fileOp.type
      });

      this.emit('fileOperationCompleted', fileOp);
      
    } catch (error) {
      fileOp.error = error instanceof Error ? error.message : String(error);
      
      log.error('❌ File operation failed', LogContext.AI, {
        operationId: fileOp.id,
        type: fileOp.type,
        error: fileOp.error
      });

      this.emit('fileOperationFailed', fileOp);
    }

    return fileOp;
  }

  // Cloud Storage Integration

  /**
   * Add cloud storage provider
   */
  async addCloudStorage(storageData: Omit<CloudStorage, 'id' | 'isConnected'>): Promise<boolean> {
    try {
      const storage: CloudStorage = {
        id: this.generateId('cloud'),
        ...storageData,
        isConnected: false
      };

      // Test connection
      const isConnected = await this.testCloudConnection(storage);
      storage.isConnected = isConnected;

      this.cloudStorages.set(storage.id, storage);
      
      log.info('✅ Cloud storage added', LogContext.AI, {
        storageId: storage.id,
        provider: storage.provider,
        connected: isConnected
      });

      this.emit('cloudStorageAdded', storage);
      return isConnected;
      
    } catch (error) {
      log.error('❌ Failed to add cloud storage', LogContext.AI, { error });
      return false;
    }
  }

  /**
   * Sync files with cloud storage
   */
  async syncWithCloud(storageId: string, localPath: string, cloudPath: string): Promise<boolean> {
    const storage = this.cloudStorages.get(storageId);
    if (!storage || !storage.isConnected) {
      return false;
    }

    try {
      log.info('☁️ Syncing with cloud storage', LogContext.AI, {
        storageId,
        provider: storage.provider,
        localPath,
        cloudPath
      });

      // Implementation would integrate with cloud providers
      // For now, simulate sync
      await this.simulateCloudSync(storage, localPath, cloudPath);

      this.emit('cloudSyncCompleted', { storageId, localPath, cloudPath });
      return true;
      
    } catch (error) {
      log.error('❌ Cloud sync failed', LogContext.AI, { storageId, error });
      return false;
    }
  }

  // Web Scraping

  /**
   * Create a web scraping task
   */
  async createWebScrapingTask(taskData: Omit<WebScrapingTask, 'id' | 'results'>): Promise<string> {
    const task: WebScrapingTask = {
      ...taskData,
      id: this.generateId('scrape'),
      results: []
    };

    this.webScrapingTasks.set(task.id, task);
    
    // Execute immediately if it's a one-time task
    if (task.schedule?.frequency === 'once') {
      await this.executeWebScrapingTask(task.id);
    }

    log.info('🕷️ Web scraping task created', LogContext.AI, {
      taskId: task.id,
      url: task.url,
      frequency: task.schedule?.frequency
    });

    this.emit('webScrapingTaskCreated', task);
    return task.id;
  }

  /**
   * Execute web scraping task
   */
  async executeWebScrapingTask(taskId: string): Promise<any[]> {
    const task = this.webScrapingTasks.get(taskId);
    if (!task) return [];

    try {
      log.info('🕷️ Executing web scraping task', LogContext.AI, {
        taskId,
        url: task.url
      });

      // Implementation would use puppeteer or similar
      // For now, simulate scraping
      const results = await this.simulateWebScraping(task);
      
      task.results = results;
      task.lastRun = new Date();
      task.status = 'completed';

      this.emit('webScrapingCompleted', { taskId, resultsCount: results.length });
      return results;
      
    } catch (error) {
      task.status = 'error';
      log.error('❌ Web scraping failed', LogContext.AI, { taskId, error });
      return [];
    }
  }

  // Notification System

  /**
   * Add notification channel
   */
  async addNotificationChannel(channelData: Omit<NotificationChannel, 'id'>): Promise<string> {
    const channel: NotificationChannel = {
      ...channelData,
      id: this.generateId('notif')
    };

    this.notificationChannels.set(channel.id, channel);
    
    log.info('📢 Notification channel added', LogContext.AI, {
      channelId: channel.id,
      type: channel.type,
      name: channel.name
    });

    this.emit('notificationChannelAdded', channel);
    return channel.id;
  }

  /**
   * Send notification through channels
   */
  async sendNotification(
    message: string,
    options?: {
      title?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      category?: string;
      data?: any;
      channelIds?: string[];
    }
  ): Promise<boolean> {
    try {
      const channelsToUse = options?.channelIds 
        ? Array.from(this.notificationChannels.values()).filter(c => options.channelIds!.includes(c.id))
        : Array.from(this.notificationChannels.values()).filter(c => c.isActive);

      for (const channel of channelsToUse) {
        // Check filters
        if (this.shouldSendToChannel(channel, options)) {
          await this.sendToNotificationChannel(channel, message, options);
        }
      }

      log.info('📢 Notifications sent', LogContext.AI, {
        channelCount: channelsToUse.length,
        priority: options?.priority || 'medium'
      });

      this.emit('notificationSent', { message, options, channelCount: channelsToUse.length });
      return true;
      
    } catch (error) {
      log.error('❌ Failed to send notifications', LogContext.AI, { error });
      return false;
    }
  }

  // API Integration

  /**
   * Add external API integration
   */
  async addAPIIntegration(integrationData: Omit<ExternalAPIIntegration, 'id'>): Promise<string> {
    const integration: ExternalAPIIntegration = {
      ...integrationData,
      id: this.generateId('api')
    };

    this.apiIntegrations.set(integration.id, integration);
    
    log.info('🔌 API integration added', LogContext.AI, {
      integrationId: integration.id,
      name: integration.name,
      baseUrl: integration.baseUrl
    });

    this.emit('apiIntegrationAdded', integration);
    return integration.id;
  }

  /**
   * Call external API
   */
  async callExternalAPI(
    integrationId: string,
    endpointName: string,
    parameters?: any,
    options?: {
      timeout?: number;
      retries?: number;
      headers?: Record<string, string>;
    }
  ): Promise<any> {
    const integration = this.apiIntegrations.get(integrationId);
    if (!integration || !integration.isActive) {
      throw new Error(`API integration not found or inactive: ${integrationId}`);
    }

    const endpoint = integration.endpoints.find(e => e.name === endpointName);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointName}`);
    }

    try {
      // Check rate limiting
      if (!this.canMakeAPIRequest(integrationId)) {
        throw new Error('Rate limit exceeded for API integration');
      }

      log.info('🔌 Calling external API', LogContext.AI, {
        integrationId,
        endpointName,
        method: endpoint.method,
        hasParameters: !!parameters
      });

      // Implementation would make actual HTTP request
      // For now, simulate API call
      const result = await this.simulateAPICall(integration, endpoint, parameters);
      
      this.trackAPIRequest(integrationId);
      
      this.emit('apiCallCompleted', {
        integrationId,
        endpointName,
        success: true,
        timestamp: new Date()
      });

      return result;
      
    } catch (error) {
      log.error('❌ External API call failed', LogContext.AI, {
        integrationId,
        endpointName,
        error: error instanceof Error ? error.message : String(error)
      });

      this.emit('apiCallCompleted', {
        integrationId,
        endpointName,
        success: false,
        error,
        timestamp: new Date()
      });

      throw error;
    }
  }

  // Private helper methods

  private async loadIntegrations(): Promise<void> {
    try {
      // Load integrations from database or config files
      // For now, set up some default configurations
      log.info('📋 Loading external integrations', LogContext.AI);
      
      // Add default notification channels
      await this.addNotificationChannel({
        type: 'webhook',
        name: 'Default Webhook',
        credentials: { url: 'http://localhost:9999/api/v1/notifications' },
        isActive: true
      });
      
    } catch (error) {
      log.error('❌ Failed to load integrations', LogContext.AI, { error });
    }
  }

  private startQueueProcessor(): void {
    // Process queued operations to handle rate limiting and batch operations
    setInterval(async () => {
      if (this.isProcessingQueue || this.operationQueue.length === 0) return;
      
      this.isProcessingQueue = true;
      
      try {
        const operation = this.operationQueue.shift();
        if (operation) {
          await this.processQueuedOperation(operation);
        }
      } catch (error) {
        log.error('❌ Error processing queued operation', LogContext.AI, { error });
      } finally {
        this.isProcessingQueue = false;
      }
    }, 1000);
  }

  private startPeriodicTasks(): void {
    // Run periodic tasks like email sync, web scraping, etc.
    setInterval(async () => {
      await this.runPeriodicTasks();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async runPeriodicTasks(): Promise<void> {
    try {
      // Sync emails for accounts with sync enabled
      for (const [id, account] of this.emailAccounts.entries()) {
        if (account.isConnected && account.syncEnabled) {
          await this.syncEmails(id);
        }
      }
      
      // Execute scheduled web scraping tasks
      for (const [id, task] of this.webScrapingTasks.entries()) {
        if (this.shouldRunScrapingTask(task)) {
          await this.executeWebScrapingTask(id);
        }
      }
      
    } catch (error) {
      log.error('❌ Error in periodic tasks', LogContext.AI, { error });
    }
  }

  // File system helper methods

  private isPathAllowed(filePath: string): boolean {
    const allowedPaths = [
      '/Users/christianmerrill/Desktop/universal-ai-tools',
      '/tmp',
      '/var/tmp'
    ];
    
    const absolutePath = path.resolve(filePath);
    return allowedPaths.some(allowedPath => absolutePath.startsWith(allowedPath));
  }

  private async readFile(filePath: string, encoding?: string): Promise<Buffer | string> {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory: ${filePath}`);
    }
    
    return encoding ? await fs.readFile(filePath, encoding as any) : await fs.readFile(filePath);
  }

  private async writeFile(filePath: string, content: Buffer | string, options?: any): Promise<boolean> {
    if (options?.createParentDirs) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }
    
    await fs.writeFile(filePath, content, options);
    return true;
  }

  private async moveFile(sourcePath: string, targetPath: string): Promise<boolean> {
    await fs.rename(sourcePath, targetPath);
    return true;
  }

  private async copyFile(sourcePath: string, targetPath: string): Promise<boolean> {
    await fs.copyFile(sourcePath, targetPath);
    return true;
  }

  private async deleteFile(filePath: string, recursive?: boolean): Promise<boolean> {
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory()) {
      await fs.rmdir(filePath, { recursive });
    } else {
      await fs.unlink(filePath);
    }
    
    return true;
  }

  private async createDirectory(dirPath: string, recursive?: boolean): Promise<boolean> {
    await fs.mkdir(dirPath, { recursive });
    return true;
  }

  private async listDirectory(dirPath: string): Promise<any[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
      path: path.join(dirPath, entry.name)
    }));
  }

  private async watchPath(watchPath: string): Promise<string> {
    const watchId = this.generateId('watch');
    
    // Implementation would set up file watching
    // For now, simulate
    log.info('👀 Setting up file watcher', LogContext.AI, { watchPath, watchId });
    
    this.fileWatchers.set(watchId, { path: watchPath, active: true });
    return watchId;
  }

  // Simulation methods (would be replaced with real implementations)

  private async testEmailConnection(account: EmailAccount): Promise<boolean> {
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  }

  private async syncEmails(accountId: string): Promise<void> {
    // Simulate email sync
    log.info('📧 Syncing emails', LogContext.AI, { accountId });
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async simulateEmailSend(account: EmailAccount, to: string[], subject: string, body: string, options?: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  private async testCloudConnection(storage: CloudStorage): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  }

  private async simulateCloudSync(storage: CloudStorage, localPath: string, cloudPath: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async simulateWebScraping(task: WebScrapingTask): Promise<any[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [
      { title: 'Sample Data 1', content: 'Sample content 1' },
      { title: 'Sample Data 2', content: 'Sample content 2' }
    ];
  }

  private async simulateAPICall(integration: ExternalAPIIntegration, endpoint: any, parameters?: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { success: true, data: { message: 'API call simulated' } };
  }

  // Utility methods

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private canMakeAPIRequest(integrationId: string): boolean {
    const integration = this.apiIntegrations.get(integrationId);
    if (!integration?.rateLimiting) return true;
    
    const now = Date.now();
    const requestData = this.apiRequestCounts.get(integrationId);
    
    if (!requestData || now > requestData.resetTime) {
      return true;
    }
    
    return requestData.count < (integration.rateLimiting.requestsPerMinute || Infinity);
  }

  private trackAPIRequest(integrationId: string): void {
    const now = Date.now();
    const resetTime = now + (60 * 1000); // 1 minute from now
    
    const requestData = this.apiRequestCounts.get(integrationId);
    if (!requestData || now > requestData.resetTime) {
      this.apiRequestCounts.set(integrationId, { count: 1, resetTime });
    } else {
      requestData.count++;
    }
  }

  private shouldSendToChannel(channel: NotificationChannel, options?: any): boolean {
    if (!channel.isActive || !channel.filters) return true;
    
    if (channel.filters.priority && options?.priority) {
      if (!channel.filters.priority.includes(options.priority)) return false;
    }
    
    if (channel.filters.categories && options?.category) {
      if (!channel.filters.categories.includes(options.category)) return false;
    }
    
    return true;
  }

  private async sendToNotificationChannel(channel: NotificationChannel, message: string, options?: any): Promise<void> {
    // Implementation would send to actual channels
    log.info('📢 Sending to notification channel', LogContext.AI, {
      channelId: channel.id,
      type: channel.type,
      message: message.substring(0, 50) + '...'
    });
  }

  private shouldRunScrapingTask(task: WebScrapingTask): boolean {
    if (task.status !== 'active' || !task.schedule) return false;
    if (task.schedule.frequency === 'once') return false;
    
    const now = Date.now();
    const lastRun = task.lastRun?.getTime() || 0;
    
    switch (task.schedule.frequency) {
      case 'hourly':
        return now - lastRun > 60 * 60 * 1000;
      case 'daily':
        return now - lastRun > 24 * 60 * 60 * 1000;
      case 'weekly':
        return now - lastRun > 7 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }

  private async processQueuedOperation(operation: any): Promise<void> {
    // Process queued operations
    log.info('⚙️ Processing queued operation', LogContext.AI, { operation });
  }

  // Public API methods

  public getEmailAccounts(): EmailAccount[] {
    return Array.from(this.emailAccounts.values());
  }

  public getCloudStorages(): CloudStorage[] {
    return Array.from(this.cloudStorages.values());
  }

  public getWebScrapingTasks(): WebScrapingTask[] {
    return Array.from(this.webScrapingTasks.values());
  }

  public getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values());
  }

  public getAPIIntegrations(): ExternalAPIIntegration[] {
    return Array.from(this.apiIntegrations.values());
  }

  public async removeEmailAccount(accountId: string): Promise<boolean> {
    const removed = this.emailAccounts.delete(accountId);
    if (removed) {
      this.emit('emailAccountRemoved', accountId);
    }
    return removed;
  }

  public async removeCloudStorage(storageId: string): Promise<boolean> {
    const removed = this.cloudStorages.delete(storageId);
    if (removed) {
      this.emit('cloudStorageRemoved', storageId);
    }
    return removed;
  }

  public async pauseWebScrapingTask(taskId: string): Promise<boolean> {
    const task = this.webScrapingTasks.get(taskId);
    if (task) {
      task.status = 'paused';
      this.emit('webScrapingTaskPaused', task);
      return true;
    }
    return false;
  }

  public async resumeWebScrapingTask(taskId: string): Promise<boolean> {
    const task = this.webScrapingTasks.get(taskId);
    if (task) {
      task.status = 'active';
      this.emit('webScrapingTaskResumed', task);
      return true;
    }
    return false;
  }

  public stopFileWatcher(watchId: string): boolean {
    const watcher = this.fileWatchers.get(watchId);
    if (watcher) {
      watcher.active = false;
      this.fileWatchers.delete(watchId);
      this.emit('fileWatcherStopped', watchId);
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const externalIntegrationsService = new ExternalIntegrationsService();
export default externalIntegrationsService;