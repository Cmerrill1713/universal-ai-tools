import { EventEmitter } from 'events';
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
    from: {
        name?: string;
        address: string;
    }[];
    to: {
        name?: string;
        address: string;
    }[];
    cc?: {
        name?: string;
        address: string;
    }[];
    bcc?: {
        name?: string;
        address: string;
    }[];
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
export declare class ExternalIntegrationsService extends EventEmitter {
    private emailAccounts;
    private cloudStorages;
    private webScrapingTasks;
    private notificationChannels;
    private apiIntegrations;
    private fileWatchers;
    private supabase;
    private isInitialized;
    private apiRequestCounts;
    private operationQueue;
    private isProcessingQueue;
    constructor();
    private initializeService;
    addEmailAccount(accountData: Omit<EmailAccount, 'id' | 'isConnected' | 'lastSync'>): Promise<boolean>;
    sendEmail(accountId: string, to: string[], subject: string, body: string, options?: {
        cc?: string[];
        bcc?: string[];
        attachments?: EmailAttachment[];
        isHtml?: boolean;
        priority?: 'high' | 'normal' | 'low';
    }): Promise<boolean>;
    searchEmails(query: {
        text?: string;
        from?: string;
        to?: string;
        subject?: string;
        since?: Date;
        until?: Date;
        hasAttachment?: boolean;
        isUnread?: boolean;
        accountIds?: string[];
    }): Promise<EmailMessage[]>;
    performFileOperation(operation: Omit<FileOperation, 'id' | 'timestamp' | 'result' | 'error'>): Promise<FileOperation>;
    addCloudStorage(storageData: Omit<CloudStorage, 'id' | 'isConnected'>): Promise<boolean>;
    syncWithCloud(storageId: string, localPath: string, cloudPath: string): Promise<boolean>;
    createWebScrapingTask(taskData: Omit<WebScrapingTask, 'id' | 'results'>): Promise<string>;
    executeWebScrapingTask(taskId: string): Promise<any[]>;
    addNotificationChannel(channelData: Omit<NotificationChannel, 'id'>): Promise<string>;
    sendNotification(message: string, options?: {
        title?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        category?: string;
        data?: any;
        channelIds?: string[];
    }): Promise<boolean>;
    addAPIIntegration(integrationData: Omit<ExternalAPIIntegration, 'id'>): Promise<string>;
    callExternalAPI(integrationId: string, endpointName: string, parameters?: any, options?: {
        timeout?: number;
        retries?: number;
        headers?: Record<string, string>;
    }): Promise<any>;
    private loadIntegrations;
    private startQueueProcessor;
    private startPeriodicTasks;
    private runPeriodicTasks;
    private isPathAllowed;
    private readFile;
    private writeFile;
    private moveFile;
    private copyFile;
    private deleteFile;
    private createDirectory;
    private listDirectory;
    private watchPath;
    private testEmailConnection;
    private syncEmails;
    private simulateEmailSend;
    private testCloudConnection;
    private simulateCloudSync;
    private simulateWebScraping;
    private simulateAPICall;
    private generateId;
    private canMakeAPIRequest;
    private trackAPIRequest;
    private shouldSendToChannel;
    private sendToNotificationChannel;
    private shouldRunScrapingTask;
    private processQueuedOperation;
    getEmailAccounts(): EmailAccount[];
    getCloudStorages(): CloudStorage[];
    getWebScrapingTasks(): WebScrapingTask[];
    getNotificationChannels(): NotificationChannel[];
    getAPIIntegrations(): ExternalAPIIntegration[];
    removeEmailAccount(accountId: string): Promise<boolean>;
    removeCloudStorage(storageId: string): Promise<boolean>;
    pauseWebScrapingTask(taskId: string): Promise<boolean>;
    resumeWebScrapingTask(taskId: string): Promise<boolean>;
    stopFileWatcher(watchId: string): boolean;
}
export declare const externalIntegrationsService: ExternalIntegrationsService;
export default externalIntegrationsService;
//# sourceMappingURL=external-integrations-service.d.ts.map