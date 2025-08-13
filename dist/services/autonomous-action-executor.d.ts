import { EventEmitter } from 'events';
export interface ActionDefinition {
    id: string;
    name: string;
    description: string;
    category: 'system' | 'application' | 'file' | 'network' | 'communication' | 'automation';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    executor: 'shell' | 'applescript' | 'api' | 'file_system' | 'application' | 'custom';
    parameters: {
        name: string;
        type: 'string' | 'number' | 'boolean' | 'array' | 'object';
        required: boolean;
        description: string;
        validation?: any;
        default?: any;
    }[];
    execution: {
        command?: string;
        script?: string;
        apiCall?: any;
        customHandler?: string;
        timeout?: number;
        retries?: number;
    };
    preconditions?: string[];
    postconditions?: string[];
    rollback?: any;
    requiresApproval: boolean;
    permissions: string[];
    metadata?: any;
}
export interface ActionExecution {
    id: string;
    actionId: string;
    userId?: string;
    initiatedBy: 'user' | 'autonomous' | 'scheduled' | 'trigger' | 'workflow';
    parameters: Record<string, any>;
    status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
    context: {
        environmentalContext?: any;
        userContext?: any;
        systemContext?: any;
        triggerSource?: string;
    };
    execution: {
        startTime?: Date;
        endTime?: Date;
        duration?: number;
        output?: any;
        error?: string;
        exitCode?: number;
        resourceUsage?: any;
    };
    approval?: {
        required: boolean;
        status: 'pending' | 'approved' | 'denied';
        approver?: string;
        requestTime: Date;
        responseTime?: Date;
        reason?: string;
    };
    monitoring: {
        checkpoints: {
            timestamp: Date;
            status: string;
            data?: any;
        }[];
        resourceMonitoring?: any;
        safetyChecks: {
            check: string;
            passed: boolean;
            timestamp: Date;
        }[];
    };
    rollback?: {
        available: boolean;
        executed: boolean;
        rollbackTime?: Date;
        rollbackResult?: any;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface ActionWorkflow {
    id: string;
    name: string;
    description: string;
    steps: {
        id: string;
        actionId: string;
        parameters: Record<string, any>;
        condition?: any;
        onSuccess?: 'continue' | 'skip' | 'stop';
        onFailure?: 'continue' | 'retry' | 'rollback' | 'stop';
        timeout?: number;
    }[];
    status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
    executions: string[];
    createdAt: Date;
}
export interface SafetyMechanism {
    id: string;
    name: string;
    description: string;
    type: 'rate_limit' | 'resource_check' | 'permission_check' | 'context_validation' | 'user_confirmation';
    rules: any;
    enabled: boolean;
    priority: number;
}
export declare class AutonomousActionExecutor extends EventEmitter {
    private actionDefinitions;
    private executions;
    private workflows;
    private safetyMechanisms;
    private supabase;
    private isInitialized;
    private executionQueue;
    private isProcessingQueue;
    private emergencyStop;
    private maxConcurrentExecutions;
    private activeExecutions;
    private executionMonitor;
    private safetyCheckInterval;
    private resourceMonitorInterval;
    private customHandlers;
    constructor();
    private initializeService;
    executeAction(actionId: string, parameters: Record<string, any>, options?: {
        initiatedBy?: ActionExecution['initiatedBy'];
        userId?: string;
        context?: any;
        skipApproval?: boolean;
        urgent?: boolean;
    }): Promise<string>;
    executeWorkflow(workflowId: string, parameters?: Record<string, any>, options?: {
        userId?: string;
        context?: any;
    }): Promise<string>;
    private startQueueProcessor;
    private processExecution;
    private executeShellAction;
    private executeAppleScriptAction;
    private executeAPIAction;
    private executeFileSystemAction;
    private executeApplicationAction;
    private executeCustomAction;
    private validateActionParameters;
    private performSafetyChecks;
    private applySafetyMechanism;
    private checkRateLimit;
    private checkResourceConstraints;
    private checkPermissions;
    private validateParameter;
    private startExecutionMonitoring;
    private monitorActiveExecutions;
    private rollbackExecution;
    private generateId;
    private interpolateCommand;
    private addExecutionCheckpoint;
    private getSystemContext;
    private requestApproval;
    private registerCustomHandlers;
    private loadActionDefinitions;
    private loadSafetyMechanisms;
    private loadWorkflows;
    private startSafetyChecking;
    private startResourceMonitoring;
    private performPeriodicSafetyChecks;
    private monitorSystemResources;
    getActionDefinitions(): ActionDefinition[];
    getExecution(executionId: string): ActionExecution | undefined;
    getExecutions(status?: ActionExecution['status']): ActionExecution[];
    cancelExecution(executionId: string): Promise<boolean>;
    approveExecution(executionId: string, approver: string, reason?: string): Promise<boolean>;
    denyExecution(executionId: string, approver: string, reason?: string): Promise<boolean>;
    setEmergencyStop(stop: boolean): void;
    getExecutionStats(): any;
    private executeRollback;
    private evaluateCondition;
    private waitForExecution;
    private rollbackWorkflow;
    private validateContext;
    private checkUserConfirmation;
    private hasPermission;
    private verifyPostconditions;
    private saveExecutionResult;
}
export declare const autonomousActionExecutor: AutonomousActionExecutor;
export default autonomousActionExecutor;
//# sourceMappingURL=autonomous-action-executor.d.ts.map