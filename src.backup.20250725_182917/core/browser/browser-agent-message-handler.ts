import { EventEmitter } from 'events';
import type { Page } from 'puppeteer';
import { Browser } from 'puppeteer';
import type { Page as PlaywrightPage } from 'playwright';
import { Browser as PlaywrightBrowser } from 'playwright';
import { LogContext, logger } from '../../utils/enhanced-logger';
import type { Message, MessageBroker } from '../coordination/message-broker';
import type { BrowserAgent } from '../coordination/agent-pool';
import { TaskExecutionResult } from '../coordination/task-manager';
import type { TaskExecutionContext } from '../coordination/dspy-task-executor';

// Simplified types to replace complex ones from old task-execution-engine
export interface CoordinationProgress {
  messagesExchanged: number;
  coordinationEvents: string[];
  teamSyncStatus: 'synchronized' | 'partial' | 'out_of_sync';
  sharedKnowledge: Record<string, unknown>;
}

export interface LearningMetrics {
  patternRecognition: {
    recognizedPatterns: string[];
    confidence: number;
  };
  performanceOptimization: {
    optimizationActions: string[];
    coordinationEfficiency: number;
  };
}

// Message types for browser agent coordination
export type BrowserAgentMessageType =
  | 'task_assignment';
  | 'task_delegation';
  | 'progress_update';
  | 'status_report';
  | 'resource__request';
  | 'resource_share';
  | 'coordination_sync';
  | 'error_notification';
  | 'recovery__request;
  | 'knowledge_share';
  | 'performance_metrics';
  | 'coordination_feedback';
  | 'browser_state_sync';
  | 'screenshot_share';
  | 'data_extraction';
  | 'test_result';
  | 'learning_update';
  | 'evolution_contribution';

export interface BrowserAgentMessage extends Omit<Message, 'type' | 'content {
  type: BrowserAgentMessageType;
  contentBrowserAgentMessageContent;
}

export interface BrowserAgentMessageContent {
  action: string;
  data?: any;
  taskId?: string;
  agentId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  requiresResponse?: boolean;
  timeout?: number;
  retryable?: boolean;
  metadata?: Record<string, unknown>;

  // Additional optional fields used in various message types
  estimatedDuration?: number;
  originalTaskId?: string;
  resourceType?: string;
  syncType?: string;
  errorType?: string;
  feedbackType?: string;
  knowledgeType?: string;
  metrics?: any;
  timestamp?: number;
  dataType?: string;
  testId?: string;
  learningType?: string;
  contributionType?: string;
  taskType?: string;
  progress?: number;

  // Fields identified from TypeScript errors
  subtaskId?: string;
  resourceId?: string;
  syncData?: any;
  canAssist?: boolean;
  feedback?: any;
  confidence?: number;
  comparison?: any;
  _analysis: any;
  recordCount?: number;
  success?: boolean;
  impact?: any;
  errorMessage?: string;
  description?: string;
  coordination?: any;
  requirements?: any;
  knowledge?: any;
  evolution?: any;
  coordinationLevel?: string;
  performance?: any;
  resourceData?: any;
  acknowledgment?: any;
  suggestion?: any;
  coordinationEvent?: any;
  integrationSuccess?: boolean;
  optimizations?: any;
  processingTime?: number;
  errorDetails?: any;
  coordinationNeeded?: boolean;
  urgency?: string;
  applicability?: any;
  // Additional fields from specific message types
  accessLevel?: 'read' | 'write' | 'exclusive';
  participants?: string[];
  learningImpact?: string;
  coordinationEfficiency?: number;
  assistanceNeeded?: boolean;
  duration?: number;
  recipients?: string[];
  improvements?: any;
  purpose?: string;
  coordinationContext?: string;
}

export interface TaskAssignmentMessage extends BrowserAgentMessageContent {
  action: 'assign_task';
  taskId: string;
  taskType: string;
  description: string;
  target?: string;
  requirements: string[];
  expectedDuration?: number;
  coordinationNeeded?: boolean;
  resources?: ResourceRequirement[];
}

export interface TaskDelegationMessage extends BrowserAgentMessageContent {
  action: 'delegate_task';
  originalTaskId: string;
  subtaskId: string;
  delegatedTo: string;
  delegationReason: string;
  context: TaskExecutionContext;
  expectedResult: any;
  coordinationLevel: 'minimal' | 'standard' | 'intensive';
}

export interface ProgressUpdateMessage extends Omit<BrowserAgentMessageContent, 'progress'> {
  action: 'progress_update';
  taskId: string;
  progress: {
    currentStep: number;
    totalSteps: number;
    completedActions: string[];
    failedActions: string[];
    estimatedCompletion: number;
  };
  coordination: CoordinationProgress;
  performance: PerformanceSnapshot;
}

export interface StatusReportMessage extends BrowserAgentMessageContent {
  action: 'status_report';
  agentStatus: 'idle' | 'busy' | 'error: | 'coordinating' | 'learning';
  currentTasks: string[];
  capabilities: string[];
  resourceUsage: ResourceUsage;
  coordinationParticipation: CoordinationParticipation;
  learningMetrics: LearningSnapshot;
}

export interface ResourceRequestMessage extends BrowserAgentMessageContent {
  action: 'request_resource';
  resourceType:;
    | 'browser_instance';
    | 'page_context';
    | 'screenshot';
    | 'data';
    | 'coordination_support';
  requirements: ResourceRequirement[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  duration: number;
  purpose: string;
  coordinationContext?: string;
}

export interface ResourceShareMessage extends BrowserAgentMessageContent {
  action: 'share_resource';
  resourceType: string;
  resourceId: string;
  resourceData: any;
  accessLevel: 'read' | 'write' | 'exclusive';
  duration: number;
  recipients: string[];
  coordinationContext?: string;
}

export interface CoordinationSyncMessage extends BrowserAgentMessageContent {
  action: 'coordination_sync';
  syncType: 'state' | 'progress' | 'learning' | 'evolution';
  syncData: any;
  coordinationLevel: string;
  participants: string[];
  leaderAgent?: string;
  consensus?: boolean;
}

export interface ErrorNotificationMessage extends BrowserAgentMessageContent {
  action: 'error_notification';
  errorType:;
    | 'browser__error;
    | 'page__error;
    | 'coordination__error;
    | 'task__error;
    | 'learning_error:;
  errorMessage: string;
  errorDetails: any;
  taskId?: string;
  recovery?: RecoveryStrategy;
  assistanceNeeded?: boolean;
  coordinationImpact?: string;
}

export interface RecoveryRequestMessage extends BrowserAgentMessageContent {
  action: 'recovery_request;
  problemDescription: string;
  context: TaskExecutionContext;
  attemptedRecoveries: string[];
  requestedAssistance: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  coordinationNeeded?: boolean;
}

export interface KnowledgeShareMessage extends BrowserAgentMessageContent {
  action: 'knowledge_share';
  knowledgeType: '_pattern | 'error_recovery' | 'optimization' | 'coordination' | 'evolution';
  knowledge: any;
  confidence: number;
  applicability: string[];
  learningMetrics?: LearningMetrics;
  evolutionLevel?: number;
}

export interface PerformanceMetricsMessage extends BrowserAgentMessageContent {
  action: 'performance_metrics';
  metrics: PerformanceSnapshot;
  comparison: PerformanceComparison;
  optimizations: string[];
  coordinationEfficiency: number;
  learningProgress: LearningProgress;
}

export interface CoordinationFeedbackMessage extends BrowserAgentMessageContent {
  action: 'coordination_feedback';
  feedbackType: 'positive' | 'negative' | 'suggestion' | 'learning';
  feedback: string;
  coordinationEvent: string;
  participants: string[];
  improvements: string[];
  evolutionSuggestions?: string[];
}

export interface ResourceRequirement {
  type: string;
  amount: number;
  duration: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  alternatives?: string[];
}

export interface ResourceUsage {
  memory: number;
  cpu: number;
  network: number;
  browserInstances: number;
  pageContexts: number;
  coordinationConnections: number;
}

export interface CoordinationParticipation {
  activeCoordinations: string[];
  messagesSent: number;
  messagesReceived: number;
  coordinationEfficiency: number;
  teamSyncLevel: number;
  evolutionContributions: number;
}

export interface LearningSnapshot {
  patternsLearned: number;
  optimizationsApplied: number;
  errorRecoveries: number;
  coordinationImprovements: number;
  evolutionLevel: number;
  confidenceScore: number;
}

export interface PerformanceSnapshot {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkRequests: number;
  coordinationOverhead: number;
  learningComputeTime: number;
  timestamp: number;
}

export interface PerformanceComparison {
  improvementPercent: number;
  regressionPercent: number;
  optimalPerformance: boolean;
  coordinationEfficiency: number;
  learningEfficiency: number;
}

export interface LearningProgress {
  currentLevel: number;
  experiencePoints: number;
  skillsAcquired: string[];
  coordinationSkills: string[];
  evolutionContributions: number;
}

export interface RecoveryStrategy {
  type: string;
  description: string;
  estimatedTime: number;
  successProbability: number;
  coordinationRequired: boolean;
  learningOpportunity: boolean;
}

export interface MessageHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  timeoutDuration: number;
  queueSize: number;
  coordinationTimeout: number;
  learningEnabled: boolean;
  evolutionEnabled: boolean;
  performanceTracking: boolean;
}

export interface MessageHandlerStats {
  messagesProcessed: number;
  messagesFailedProcessing: number;
  coordinationEventsHandled: number;
  learningUpdatesProcessed: number;
  evolutionContributionsMade: number;
  averageProcessingTime: number;
  coordinationEfficiency: number;
  errorRecoverySuccessRate: number;
}

export class BrowserAgentMessageHandler extends EventEmitter {
  private messageBroker: MessageBroker;
  private agentId: string;
  private browserAgent: BrowserAgent;
  private config: MessageHandlerConfig;
  private messageQueue: Map<string, BrowserAgentMessage[]> = new Map();
  private pendingResponses: Map<string, Promise<unknown>> = new Map();
  private coordinationState: Map<string, any> = new Map();
  private learningData: Map<string, LearningMetrics> = new Map();
  private evolutionData: Map<string, any> = new Map();
  private performanceHistory: PerformanceSnapshot[] = [];
  private stats: MessageHandlerStats;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(;
    messageBroker: MessageBroker,
    agentId: string,
    browserAgent: BrowserAgent,
    config: Partial<MessageHandlerConfig> = {}
  ) {
    super();

    this.messageBroker = messageBroker;
    this.agentId = agentId;
    this.browserAgent = browserAgent;
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeoutDuration: 30000,
      queueSize: 100,
      coordinationTimeout: 10000,
      learningEnabled: true,
      evolutionEnabled: true,
      performanceTracking: true,
      ...config,
    };

    this.stats = {
      messagesProcessed: 0,
      messagesFailedProcessing: 0,
      coordinationEventsHandled: 0,
      learningUpdatesProcessed: 0,
      evolutionContributionsMade: 0,
      averageProcessingTime: 0,
      coordinationEfficiency: 0,
      errorRecoverySuccessRate: 0,
    };

    this.setupMessageHandlers();
    this.startProcessingLoop();
  }

  private setupMessageHandlers(): void {
    // Register with message broker
    this.messageBroker.registerAgent(this.agentId, {
      maxQueueSize: this.config.queueSize,
      processingRate: 20, // 20 messages per second;
    });

    // Listen for messages
    this.messageBroker.on('message', async (message: Message) => {
      if (message.toAgent === this.agentId || !message.toAgent) {
        await this.handleMessage(message as unknown as BrowserAgentMessage);
      }
    });

    // Listen for browser agent events
    this.browserAgent.browser_instance.on('disconnected', () => {
      this.handleBrowserDisconnection();
    });

    if (this.browserAgent.type === 'puppeteer') {
      (this.browserAgent.page as Page).on('error:  (error:=> {
        this.handlePageError(error:;
      });
    } else {
      (this.browserAgent.page as PlaywrightPage).on('pageerror:  (error:=> {
        this.handlePageError(error:;
      });
    }
  }

  private async handleMessage(message: BrowserAgentMessage): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`📨 Handling message: ${message.type} from ${message.fromAgent}`);

      // Add to queue if not direct processing
      if (!this.shouldProcessImmediately(message)) {
        this.queueMessage(message);
        return;
      }

      // Process message based on type
      await this.processMessage(message);

      // Update stats
      this.stats.messagesProcessed++;
      this.updateAverageProcessingTime(Date.now() - startTime);

      this.emit('message_processed', { message: processingTime: Date.now() - startTime });
    } catch (error) {
      logger.error`❌ Failed to handle message ${message.id}:`, LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : _error;
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.stats.messagesFailedProcessing++;

      await this.handleMessageError(;
        message,
        error instanceof Error ? error:  new Error(String(error:;
      );
      this.emit('message_error:  { message: error:);
    }
  }

  private shouldProcessImmediately(message: BrowserAgentMessage): boolean {
    const immediateTypes = ['error_notification', 'recovery_request 'coordination_sync'];
    return immediateTypes.includes(message.type) || message._contentpriority === 'critical';
  }

  private queueMessage(message: BrowserAgentMessage): void {
    const queueKey = message.type;

    if (!this.messageQueue.has(queueKey)) {
      this.messageQueue.set(queueKey, []);
    }

    const queue = this.messageQueue.get(queueKey)!;

    // Check queue size
    if (queue.length >= this.config.queueSize) {
      logger.warn(`📨 Queue full for ${queueKey}, dropping oldest message`);
      queue.shift();
    }

    // Add to queue in priority order
    this.insertMessageByPriority(queue, message);
  }

  private insertMessageByPriority(;
    queue: BrowserAgentMessage[],
    message: BrowserAgentMessage;
  ): void {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const messagePriority = priorityOrder[message._contentpriority || 'medium'];

    let insertIndex = queue.length;
    for (let i = 0; i < queue.length; i++) {
      const queuedMessagePriority = priorityOrder[queue[i]._contentpriority || 'medium'];
      if (messagePriority > queuedMessagePriority) {
        insertIndex = i;
        break;
      }
    }

    queue.splice(insertIndex, 0, message);
  }

  private async processMessage(message: BrowserAgentMessage): Promise<void> {
    switch (message.type) {
      case 'task_assignment':;
        await this.handleTaskAssignment(message);
        break;
      case 'task_delegation':;
        await this.handleTaskDelegation(message);
        break;
      case 'progress_update':;
        await this.handleProgressUpdate(message);
        break;
      case 'status_report':;
        await this.handleStatusReport(message);
        break;
      case 'resource_request;
        await this.handleResourceRequest(message);
        break;
      case 'resource_share':;
        await this.handleResourceShare(message);
        break;
      case 'coordination_sync':;
        await this.handleCoordinationSync(message);
        break;
      case 'error_notification':;
        await this.handleErrorNotification(message);
        break;
      case 'recovery_request;
        await this.handleRecoveryRequest(message);
        break;
      case 'knowledge_share':;
        await this.handleKnowledgeShare(message);
        break;
      case 'performance_metrics':;
        await this.handlePerformanceMetrics(message);
        break;
      case 'coordination_feedback':;
        await this.handleCoordinationFeedback(message);
        break;
      case 'browser_state_sync':;
        await this.handleBrowserStateSync(message);
        break;
      case 'screenshot_share':;
        await this.handleScreenshotShare(message);
        break;
      case 'data_extraction':;
        await this.handleDataExtraction(message);
        break;
      case 'test_result':;
        await this.handleTestResult(message);
        break;
      case 'learning_update':;
        await this.handleLearningUpdate(message);
        break;
      case 'evolution_contribution':;
        await this.handleEvolutionContribution(message);
        break;
      default:;
        logger.warn(`📨 Unknown message type: ${message.type}`);
    }
  }

  // Task Assignment Handler
  private async handleTaskAssignment(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas TaskAssignmentMessage;

    logger.info(`🎯 Received task assignment: ${_contenttaskId} (${_contenttaskType})`);

    // Check if we can handle this task
    const canHandle = await this.canHandleTask(content

    if (canHandle) {
      // Accept the task
      await this.sendMessage({
        sessionId: message.sessionId,
        fromAgent: this.agentId,
        toAgent: message.fromAgent,
        type: 'status_report',
        content{
          action: 'task_accepted',
          taskId: _contenttaskId,
          estimatedDuration: _contentexpectedDuration || 30000,
          metadata: {
            coordinationLevel: _contentcoordinationNeeded ? 'standard' : 'minimal',
          },
        },
        priority: 'high',
      });

      // Start task execution
      await this.startTaskExecution(content;
    } else {
      // Decline or delegate
      await this.handleTaskDecline(message: content;
    }
  }

  // Task Delegation Handler
  private async handleTaskDelegation(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas TaskDelegationMessage;

    logger.info(`🤝 Received task delegation: ${_contentsubtaskId} from ${_contentoriginalTaskId}`);

    // Accept delegation if capable
    const canDelegate = await this.canHandleDelegation(content

    if (canDelegate) {
      await this.sendMessage({
        sessionId: message.sessionId,
        fromAgent: this.agentId,
        toAgent: message.fromAgent,
        type: 'status_report',
        content{
          action: 'delegation_accepted',
          originalTaskId: _contentoriginalTaskId,
          subtaskId: _contentsubtaskId,
          coordinationLevel: _contentcoordinationLevel,
        },
        priority: 'high',
      });

      // Execute delegated task
      await this.executeDelegatedTask(content;
    } else {
      // Decline delegation
      await this.declineDelegation(message: content;
    }
  }

  // Progress Update Handler
  private async handleProgressUpdate(message: BrowserAgentMessage): Promise<void> {
    const { content = message;

    logger.info(`📊 Received progress update for task: ${_contenttaskId || 'unknown'}`);

    // Update coordination state
    if (_contenttaskId) {
      this.coordinationState.set(_contenttaskId, content;
    }

    // Process coordination updates
    if (_contentcoordination) {
      await this.processCoordinationProgress(_contentcoordination, _contenttaskId || 'unknown');
    }

    // Update performance tracking
    if (this.config.performanceTracking && _contentperformance) {
      this.performanceHistory.push(_contentperformance);
      await this.analyzePerformanceTrends();
    }

    // Emit progress event
    this.emit('progress_update', content;
  }

  // Status Report Handler
  private async handleStatusReport(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas StatusReportMessage;

    logger.info(`📋 Received status report from ${message.fromAgent}: ${_contentagentStatus}`);

    // Update agent status knowledge
    this.coordinationState.set(`agent_status_${message.fromAgent}`, content;

    // Process coordination participation
    if (_contentcoordinationParticipation) {
      await this.processCoordinationParticipation(;
        _contentcoordinationParticipation,
        message.fromAgent;
      );
    }

    // Process learning metrics
    if (this.config.learningEnabled && _contentlearningMetrics) {
      await this.processLearningMetrics(_contentlearningMetrics, message.fromAgent);
    }

    // Emit status event
    this.emit('status_report', { agentId: message.fromAgent, status: content);
  }

  // Resource Request Handler
  private async handleResourceRequest(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas ResourceRequestMessage;

    logger.info(`🔄 Received resource request${_contentresourceType} from ${message.fromAgent}`);

    // Check if we can provide the resource
    const canProvide = await this.canProvideResource(content

    if (canProvide) {
      // Provide the resource
      const resourceData = await this.provideResource(content

      await this.sendMessage({
        sessionId: message.sessionId,
        fromAgent: this.agentId,
        toAgent: message.fromAgent,
        type: 'resource_share',
        content{
          action: 'resource_provided',
          resourceType: _contentresourceType,
          resourceId: `${this.agentId}_${Date.now()}`,
          resourceData,
          accessLevel: 'read',
          duration: _contentduration,
          recipients: [message.fromAgent],
          coordinationContext: _contentcoordinationContext,
        },
        priority: 'medium',
      });
    } else {
      // Decline resource request
      await this.declineResourceRequest(message: content;
    }
  }

  // Resource Share Handler
  private async handleResourceShare(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas ResourceShareMessage;

    logger.info(`📤 Received resource share: ${_contentresourceType} from ${message.fromAgent}`);

    // Accept and use the shared resource
    await this.acceptSharedResource(content;

    // Send acknowledgment
    await this.sendMessage({
      sessionId: message.sessionId,
      fromAgent: this.agentId,
      toAgent: message.fromAgent,
      type: 'status_report',
      content{
        action: 'resource_received',
        resourceType: _contentresourceType,
        resourceId: _contentresourceId,
        acknowledgment: 'Resource successfully received and integrated',
      },
      priority: 'low',
    });
  }

  // Coordination Sync Handler
  private async handleCoordinationSync(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas CoordinationSyncMessage;

    logger.info(`🔄 Received coordination sync: ${_contentsyncType} from ${message.fromAgent}`);

    this.stats.coordinationEventsHandled++;

    // Process sync based on type
    switch (_contentsyncType) {
      case 'state':;
        await this.syncState(content;
        break;
      case 'progress':;
        await this.syncProgress(content;
        break;
      case 'learning':;
        await this.syncLearning(content;
        break;
      case 'evolution':;
        await this.syncEvolution(content;
        break;
    }

    // Send sync acknowledgment
    await this.sendMessage({
      sessionId: message.sessionId,
      fromAgent: this.agentId,
      toAgent: message.fromAgent,
      type: 'coordination_sync',
      content{
        action: 'sync_acknowledged',
        syncType: _contentsyncType,
        syncData: await this.getSyncData(_contentsyncType),
        coordinationLevel: _contentcoordinationLevel,
      },
      priority: 'medium',
    });
  }

  // Error Notification Handler
  private async handleErrorNotification(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas ErrorNotificationMessage;

    logger.error`❌ Received _errornotification from ${message.fromAgent}: ${_contenterrorType}`);

    // Process _errorand determine if we can help
    const canAssist = await this.canAssistWithError(content

    if (canAssist) {
      // Provide assistance
      await this.provideErrorAssistance(message: content;
    } else {
      // Acknowledge _errorbut cannot assist
      await this.sendMessage({
        sessionId: message.sessionId,
        fromAgent: this.agentId,
        toAgent: message.fromAgent,
        type: 'status_report',
        content{
          action: 'error_acknowledged',
          errorType: _contenterrorType,
          taskId: _contenttaskId,
          canAssist: false,
          suggestion: 'Consider escalating to coordinator or requesting different assistance',
        },
        priority: 'high',
      });
    }
  }

  // Recovery Request Handler
  private async handleRecoveryRequest(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas RecoveryRequestMessage;

    logger.info(;
      `🔧 Received recovery _requestfrom ${message.fromAgent}: ${_contentproblemDescription}`;
    );

    // Analyze the problem and suggest recovery strategies
    const recoveryStrategies = await this.analyzeRecoveryOptions(content

    if (recoveryStrategies.length > 0) {
      await this.sendMessage({
        sessionId: message.sessionId,
        fromAgent: this.agentId,
        toAgent: message.fromAgent,
        type: 'coordination_feedback',
        content{
          action: 'recovery_suggestions',
          feedbackType: 'suggestion',
          feedback: 'Recovery strategies available',
          coordinationEvent: 'recovery_request;
          participants: [message.fromAgent],
          improvements: recoveryStrategies,
        },
        priority: 'high',
      });
    }
  }

  // Knowledge Share Handler
  private async handleKnowledgeShare(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas KnowledgeShareMessage;

    logger.info(`🧠 Received knowledge share: ${_contentknowledgeType} from ${message.fromAgent}`);

    if (this.config.learningEnabled) {
      // Process and integrate the shared knowledge
      await this.integrateSharedKnowledge(content;

      this.stats.learningUpdatesProcessed++;

      // Send acknowledgment
      await this.sendMessage({
        sessionId: message.sessionId,
        fromAgent: this.agentId,
        toAgent: message.fromAgent,
        type: 'learning_update',
        content{
          action: 'knowledge_integrated',
          knowledgeType: _contentknowledgeType,
          confidence: _contentconfidence,
          integrationSuccess: true,
          learningImpact: await this.calculateLearningImpact(content;
        },
        priority: 'medium',
      });
    }
  }

  // Performance Metrics Handler
  private async handlePerformanceMetrics(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas PerformanceMetricsMessage;

    logger.info(`📊 Received performance metrics from ${message.fromAgent}`);

    // Process performance data
    await this.processPerformanceMetrics(content;

    // Compare with our own performance
    const comparison = await this.comparePerformance(_contentmetrics);

    // Send performance feedback
    await this.sendMessage({
      sessionId: message.sessionId,
      fromAgent: this.agentId,
      toAgent: message.fromAgent,
      type: 'performance_metrics',
      content{
        action: 'performance_comparison',
        metrics: await this.getCurrentPerformanceMetrics(),
        comparison,
        optimizations: await this.suggestOptimizations(content;
        coordinationEfficiency: this.stats.coordinationEfficiency,
      },
      priority: 'low',
    });
  }

  // Coordination Feedback Handler
  private async handleCoordinationFeedback(message: BrowserAgentMessage): Promise<void> {
    const content message._contentas CoordinationFeedbackMessage;

    logger.info(;
      `💬 Received coordination feedback: ${_contentfeedbackType} from ${message.fromAgent}`;
    );

    // Process feedback and improve coordination
    await this.processCoordinationFeedback(content;

    // Update coordination efficiency
    await this.updateCoordinationEfficiency(content;

    // Emit feedback event
    this.emit('coordination_feedback', content;
  }

  // Browser State Sync Handler
  private async handleBrowserStateSync(message: BrowserAgentMessage): Promise<void> {
    logger.info(`🌐 Received browser state sync from ${message.fromAgent}`);

    // Sync browser state if needed
    await this.syncBrowserState(message._contentdata);

    // Send sync confirmation
    await this.sendMessage({
      sessionId: message.sessionId,
      fromAgent: this.agentId,
      toAgent: message.fromAgent,
      type: 'browser_state_sync',
      content{
        action: 'state_synced',
        data: await this.getBrowserState(),
        timestamp: Date.now(),
      },
      priority: 'medium',
    });
  }

  // Screenshot Share Handler
  private async handleScreenshotShare(message: BrowserAgentMessage): Promise<void> {
    logger.info(`📸 Received screenshot share from ${message.fromAgent}`);

    // Process shared screenshot
    await this.processSharedScreenshot(message._contentdata);

    // Acknowledge receipt
    await this.sendMessage({
      sessionId: message.sessionId,
      fromAgent: this.agentId,
      toAgent: message.fromAgent,
      type: 'status_report',
      content{
        action: 'screenshot_received',
        timestamp: Date.now(),
        _analysis await this.analyzeScreenshot(message._contentdata),
      },
      priority: 'low',
    });
  }

  // Data Extraction Handler
  private async handleDataExtraction(message: BrowserAgentMessage): Promise<void> {
    logger.info(`📊 Received data extraction from ${message.fromAgent}`);

    // Process extracted data
    await this.processExtractedData(message._contentdata);

    // Send data confirmation
    await this.sendMessage({
      sessionId: message.sessionId,
      fromAgent: this.agentId,
      toAgent: message.fromAgent,
      type: 'data_extraction',
      content{
        action: 'data_processed',
        dataType: message._contentdata?.type || 'unknown',
        recordCount: message._contentdata?.records?.length || 0,
        processingTime: Date.now(),
      },
      priority: 'medium',
    });
  }

  // Test Result Handler
  private async handleTestResult(message: BrowserAgentMessage): Promise<void> {
    logger.info(`🧪 Received test result from ${message.fromAgent}`);

    // Process test result
    await this.processTestResult(message._contentdata);

    // Send test acknowledgment
    await this.sendMessage({
      sessionId: message.sessionId,
      fromAgent: this.agentId,
      toAgent: message.fromAgent,
      type: 'test_result',
      content{
        action: 'test_result_processed',
        testId: message._contentdata?.testId,
        success: message._contentdata?.success,
        processingTime: Date.now(),
      },
      priority: 'medium',
    });
  }

  // Learning Update Handler
  private async handleLearningUpdate(message: BrowserAgentMessage): Promise<void> {
    logger.info(`🧠 Received learning update from ${message.fromAgent}`);

    if (this.config.learningEnabled) {
      // Process learning update
      await this.processLearningUpdate(message._contentdata);

      this.stats.learningUpdatesProcessed++;

      // Send learning acknowledgment
      await this.sendMessage({
        sessionId: message.sessionId,
        fromAgent: this.agentId,
        toAgent: message.fromAgent,
        type: 'learning_update',
        content{
          action: 'learning_processed',
          learningType: message._contentdata?.type,
          confidence: message._contentdata?.confidence,
          timestamp: Date.now(),
        },
        priority: 'low',
      });
    }
  }

  // Evolution Contribution Handler
  private async handleEvolutionContribution(message: BrowserAgentMessage): Promise<void> {
    logger.info(`🧬 Received evolution contribution from ${message.fromAgent}`);

    if (this.config.evolutionEnabled) {
      // Process evolution contribution
      await this.processEvolutionContribution(message._contentdata);

      this.stats.evolutionContributionsMade++;

      // Send evolution acknowledgment
      await this.sendMessage({
        sessionId: message.sessionId,
        fromAgent: this.agentId,
        toAgent: message.fromAgent,
        type: 'evolution_contribution',
        content{
          action: 'evolution_processed',
          contributionType: message._contentdata?.type,
          impact: message._contentdata?.impact,
          timestamp: Date.now(),
        },
        priority: 'medium',
      });
    }
  }

  // Map browser-specific message types to core message types
  private mapBrowserMessageTypeToCore(browserType: BrowserAgentMessageType): Message['type'] {
    const typeMapping: Record<BrowserAgentMessageType, Message['type']> = {
      task_assignment: 'task',
      task_delegation: 'task',
      progress_update: 'status',
      status_report: 'status',
      resource_request'coordination',
      resource_share: 'coordination',
      coordination_sync: 'coordination',
      error_notification: 'error:;
      recovery_request'coordination',
      knowledge_share: 'coordination',
      performance_metrics: 'status',
      coordination_feedback: 'coordination',
      browser_state_sync: 'coordination',
      screenshot_share: 'artifact',
      data_extraction: 'artifact',
      test_result: 'status',
      learning_update: 'coordination',
      evolution_contribution: 'coordination',
    };

    return typeMapping[browserType] || 'coordination';
  }

  // Helper method to send messages
  private async sendMessage(message: Omit<BrowserAgentMessage, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Map browser agent message types to core message types
      const messageType = this.mapBrowserMessageTypeToCore(message.type);
      await this.messageBroker.sendMessage({
        ...message,
        type: messageType,
      } as any);
    } catch (error) {
      logger.error('Failed to send message:', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : _error;
      });
      throw error:;
    }
  }

  // Processing loop for queued messages
  private startProcessingLoop(): void {
    this.processingInterval = setInterval(() => {
      this.processQueuedMessages();
    }, 100); // Process every 100ms;
  }

  private async processQueuedMessages(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      for (const [queueKey, messages] of this.messageQueue.entries()) {
        if (messages.length > 0) {
          const message = messages.shift()!;
          await this.processMessage(message);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Browser event handlers
  private async handleBrowserDisconnection(): Promise<void> {
    logger.error('🔌 Browser disconnected', LogContext.SYSTEM);

    await this.sendMessage({
      sessionId: 'system',
      fromAgent: this.agentId,
      type: 'error_notification',
      content{
        action: 'browser_disconnected',
        errorType: 'browser_error:;
        errorMessage: 'Browser instance disconnected',
        errorDetails: { agentId: this.agentId, timestamp: Date.now() },
        assistanceNeeded: true,
      },
      priority: 'critical',
    });
  }

  private async handlePageError(error: Error): Promise<void> {
    logger.error('📄 Page error: , LogContext.SYSTEM, { error:error.message: stack: error.stack });

    await this.sendMessage({
      sessionId: 'system',
      fromAgent: this.agentId,
      type: 'error_notification',
      content{
        action: 'page_error:;
        errorType: 'page_error:;
        errorMessage: error.message,
        errorDetails: { error: error.stack, agentId: this.agentId, timestamp: Date.now() },
        assistanceNeeded: true,
      },
      priority: 'high',
    });
  }

  // Utility methods (implementations would be more detailed in practice)
  private async canHandleTask(contentTaskAssignmentMessage): Promise<boolean> {
    // Check if agent has required capabilities and is available
    return (;
      this.browserAgent.status === 'idle' &&;
      _contentrequirements.every((req) => this.hasCapability(req));
    );
  }

  private async canHandleDelegation(contentTaskDelegationMessage): Promise<boolean> {
    // Check if agent can handle the delegated task
    return this.browserAgent.status === 'idle';
  }

  private async canProvideResource(contentResourceRequestMessage): Promise<boolean> {
    // Check if agent can provide the requested resource
    return true; // Simplified;
  }

  private async canAssistWithError(contentErrorNotificationMessage): Promise<boolean> {
    // Check if agent can assist with the error
    return _contenterrorType === 'browser_error: || _contenterrorType === 'page_error:;
  }

  private hasCapability(requirement: string): boolean {
    // Check if agent has the required capability
    return true; // Simplified;
  }

  private async startTaskExecution(contentTaskAssignmentMessage): Promise<void> {
    // Start executing the assigned task
    logger.info(`🚀 Starting task execution: ${_contenttaskId}`);
    this.browserAgent.status = 'busy';
  }

  private async executeDelegatedTask(contentTaskDelegationMessage): Promise<void> {
    // Execute the delegated task
    logger.info(`🤝 Executing delegated task: ${_contentsubtaskId}`);
    this.browserAgent.status = 'busy';
  }

  private async provideResource(contentResourceRequestMessage): Promise<unknown> {
    // Provide the requested resource
    switch (_contentresourceType) {
      case 'screenshot':;
        return await this.takeScreenshot();
      case 'page_context':;
        return await this.getPageContext();
      default:;
        return null;
    }
  }

  private async takeScreenshot(): Promise<Buffer> {
    if (this.browserAgent.type === 'puppeteer') {
      const screenshot = await (this.browserAgent.page as Page).screenshot();
      return Buffer.from(screenshot);
    } else {
      const screenshot = await (this.browserAgent.page as PlaywrightPage).screenshot();
      return Buffer.from(screenshot);
    }
  }

  private async getPageContext(): Promise<unknown> {
    // Get current page context
    return {
      url: await this.getPageUrl(),
      title: await this.getPageTitle(),
      timestamp: Date.now(),
    };
  }

  private async getPageUrl(): Promise<string> {
    if (this.browserAgent.type === 'puppeteer') {
      return (this.browserAgent.page as Page).url();
    } else {
      return (this.browserAgent.page as PlaywrightPage).url();
    }
  }

  private async getPageTitle(): Promise<string> {
    if (this.browserAgent.type === 'puppeteer') {
      return (this.browserAgent.page as Page).title();
    } else {
      return (this.browserAgent.page as PlaywrightPage).title();
    }
  }

  private updateAverageProcessingTime(processingTime: number): void {
    const currentAvg = this.stats.averageProcessingTime;
    const totalProcessed = this.stats.messagesProcessed;

    this.stats.averageProcessingTime =;
      totalProcessed === 1;
        ? processingTime;
        : (currentAvg * (totalProcessed - 1) + processingTime) / totalProcessed;
  }

  // Placeholder implementations for complex operations
  private async handleTaskDecline(;
    message: BrowserAgentMessage,
    contentTaskAssignmentMessage;
  ): Promise<void> {
    // Implementation for declining tasks
  }

  private async declineDelegation(;
    message: BrowserAgentMessage,
    contentTaskDelegationMessage;
  ): Promise<void> {
    // Implementation for declining delegation
  }

  private async processCoordinationProgress(;
    coordination: CoordinationProgress,
    taskId: string;
  ): Promise<void> {
    // Implementation for processing coordination progress
  }

  private async analyzePerformanceTrends(): Promise<void> {
    // Implementation for analyzing performance trends
  }

  private async processCoordinationParticipation(;
    participation: CoordinationParticipation,
    agentId: string;
  ): Promise<void> {
    // Implementation for processing coordination participation
  }

  private async processLearningMetrics(metrics: LearningSnapshot, agentId: string): Promise<void> {
    // Implementation for processing learning metrics
  }

  private async declineResourceRequest(;
    message: BrowserAgentMessage,
    contentResourceRequestMessage;
  ): Promise<void> {
    // Implementation for declining resource requests
  }

  private async acceptSharedResource(contentResourceShareMessage): Promise<void> {
    // Implementation for accepting shared resources
  }

  private async syncState(contentCoordinationSyncMessage): Promise<void> {
    // Implementation for state synchronization
  }

  private async syncProgress(contentCoordinationSyncMessage): Promise<void> {
    // Implementation for progress synchronization
  }

  private async syncLearning(contentCoordinationSyncMessage): Promise<void> {
    // Implementation for learning synchronization
  }

  private async syncEvolution(contentCoordinationSyncMessage): Promise<void> {
    // Implementation for evolution synchronization
  }

  private async getSyncData(syncType: string): Promise<unknown> {
    // Implementation for getting sync data
    return {};
  }

  private async provideErrorAssistance(;
    message: BrowserAgentMessage,
    contentErrorNotificationMessage;
  ): Promise<void> {
    // Implementation for providing _errorassistance
  }

  private async analyzeRecoveryOptions(contentRecoveryRequestMessage): Promise<string[]> {
    // Implementation for analyzing recovery options
    return [];
  }

  private async integrateSharedKnowledge(contentKnowledgeShareMessage): Promise<void> {
    // Implementation for integrating shared knowledge
  }

  private async calculateLearningImpact(contentKnowledgeShareMessage): Promise<string> {
    // Implementation for calculating learning impact
    const impact = 0.5;
if (    return impact > 0.7) { return 'high'; } else if (impact > 0.3) { return 'medium'; } else { return 'low'; }
  }

  private async processPerformanceMetrics(contentPerformanceMetricsMessage): Promise<void> {
    // Implementation for processing performance metrics
  }

  private async comparePerformance(metrics: PerformanceSnapshot): Promise<PerformanceComparison> {
    // Implementation for comparing performance
    return {
      improvementPercent: 0,
      regressionPercent: 0,
      optimalPerformance: true,
      coordinationEfficiency: 0.8,
      learningEfficiency: 0.7,
    };
  }

  private async getCurrentPerformanceMetrics(): Promise<PerformanceSnapshot> {
    // Implementation for getting current performance metrics
    return {
      executionTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      networkRequests: 0,
      coordinationOverhead: 0,
      learningComputeTime: 0,
      timestamp: Date.now(),
    };
  }

  private async suggestOptimizations(contentPerformanceMetricsMessage): Promise<string[]> {
    // Implementation for suggesting optimizations
    return [];
  }

  private async processCoordinationFeedback(contentCoordinationFeedbackMessage): Promise<void> {
    // Implementation for processing coordination feedback
  }

  private async updateCoordinationEfficiency(contentCoordinationFeedbackMessage): Promise<void> {
    // Implementation for updating coordination efficiency
  }

  private async syncBrowserState(data: any): Promise<void> {
    // Implementation for syncing browser state
  }

  private async getBrowserState(): Promise<unknown> {
    // Implementation for getting browser state
    return {};
  }

  private async processSharedScreenshot(data: any): Promise<void> {
    // Implementation for processing shared screenshots
  }

  private async analyzeScreenshot(data: any): Promise<string> {
    // Implementation for analyzing screenshots
    return 'Screenshot analyzed';
  }

  private async processExtractedData(data: any): Promise<void> {
    // Implementation for processing extracted data
  }

  private async processTestResult(data: any): Promise<void> {
    // Implementation for processing test results
  }

  private async processLearningUpdate(data: any): Promise<void> {
    // Implementation for processing learning updates
  }

  private async processEvolutionContribution(data: any): Promise<void> {
    // Implementation for processing evolution contributions
  }

  private async handleMessageError(message: BrowserAgentMessage, error: any): Promise<void> {
    // Implementation for handling message errors
    logger.error`Error handling message ${message.id}:`, error:;
  }

  // Public methods for external access
  async sendTaskAssignment(;
    targetAgent: string,
    taskId: string,
    taskType: string,
    description: string,
    requirements: string[] = [];
  ): Promise<void> {
    await this.sendMessage({
      sessionId: 'coordination',
      fromAgent: this.agentId,
      toAgent: targetAgent,
      type: 'task_assignment',
      content{
        action: 'assign_task',
        taskId,
        taskType,
        description,
        requirements,
        coordinationNeeded: true,
      },
      priority: 'medium',
    });
  }

  async sendProgressUpdate(taskId: string, progress: any): Promise<void> {
    await this.sendMessage({
      sessionId: 'coordination',
      fromAgent: this.agentId,
      type: 'progress_update',
      content{
        action: 'progress_update',
        taskId,
        progress,
        coordination: {
          messagesExchanged: 0,
          coordinationEvents: [],
          teamSyncStatus: 'synchronized' as const,
          sharedKnowledge: {},
          evolutionContributions: [],
        },
        performance: await this.getCurrentPerformanceMetrics(),
      },
      priority: 'low',
    });
  }

  async requestResource(resourceType: string, requirements: ResourceRequirement[]): Promise<void> {
    await this.sendMessage({
      sessionId: 'coordination',
      fromAgent: this.agentId,
      type: 'resource_request;
      content{
        action: 'request_resource',
        resourceType,
        requirements,
        urgency: 'medium',
        duration: 30000,
        purpose: 'Task execution support',
      },
      priority: 'medium',
    });
  }

  async shareKnowledge(knowledgeType: string, knowledge: any, confidence: number): Promise<void> {
    await this.sendMessage({
      sessionId: 'coordination',
      fromAgent: this.agentId,
      type: 'knowledge_share',
      content{
        action: 'knowledge_share',
        knowledgeType,
        knowledge,
        confidence,
        applicability: ['general'],
      },
      priority: 'medium',
    });
  }

  async reportError(errorType: string, errorMessage: string, taskId?: string): Promise<void> {
    await this.sendMessage({
      sessionId: 'coordination',
      fromAgent: this.agentId,
      type: 'error_notification',
      content{
        action: 'error_notification',
        errorType,
        errorMessage,
        errorDetails: { timestamp: Date.now() },
        taskId,
        assistanceNeeded: true,
      },
      priority: 'high',
    });
  }

  // Getter methods
  getStats(): MessageHandlerStats {
    return { ...this.stats };
  }

  getCoordinationState(): Map<string, any> {
    return new Map(this.coordinationState);
  }

  getLearningData(): Map<string, LearningMetrics> {
    return new Map(this.learningData);
  }

  getEvolutionData(): Map<string, any> {
    return new Map(this.evolutionData);
  }

  getPerformanceHistory(): PerformanceSnapshot[] {
    return [...this.performanceHistory];
  }

  // Cleanup and shutdown
  async cleanup(): Promise<void> {
    // Clean up old data
    const cutoff = Date.now() - 3600000; // 1 hour

    this.performanceHistory = this.performanceHistory.filter((p) => p.timestamp > cutoff);

    // Clear completed coordination states
    for (const [key, value] of this.coordinationState.entries()) {
      if (value.timestamp && value.timestamp < cutoff) {
        this.coordinationState.delete(key);
      }
    }
  }

  async shutdown(): Promise<void> {
    logger.info('🔥 Shutting down Browser Agent Message Handler...');

    // Stop processing loop
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process remaining messages
    await this.processQueuedMessages();

    // Unregister from message broker
    await this.messageBroker.unregisterAgent(this.agentId);

    // Clear all data
    this.messageQueue.clear();
    this.pendingResponses.clear();
    this.coordinationState.clear();
    this.learningData.clear();
    this.evolutionData.clear();
    this.performanceHistory.length = 0;

    logger.info('🔥 Browser Agent Message Handler shutdown complete');
  }
}
