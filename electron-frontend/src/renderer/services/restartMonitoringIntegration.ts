/**
 * Restart Monitoring System Integration
 *
 * Orchestrates all monitoring services and provides unified interface
 * for the proactive restart monitoring system with Supabase integration.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProactiveRestartMonitor } from './proactiveRestartMonitor';
import { ServiceStartupSequencer } from './serviceStartupSequencer';
import { IntelligentRestartAgent } from './intelligentRestartAgent';
import { AutomatedRecoveryOrchestrator } from './automatedRecoveryOrchestrator';
import { RealTimeAlertingSystem } from './realTimeAlertingSystem';

// Integration interfaces
export interface MonitoringSystemStatus {
  overall_health: 'healthy' | 'warning' | 'critical' | 'offline';
  services: {
    restart_monitor: ServiceStatus;
    startup_sequencer: ServiceStatus;
    intelligent_agent: ServiceStatus;
    recovery_orchestrator: ServiceStatus;
    alerting_system: ServiceStatus;
    database_connection: ServiceStatus;
  };
  metrics: {
    active_failures: number;
    recovery_actions_running: number;
    active_alerts: number;
    patterns_learned: number;
    system_uptime_hours: number;
  };
  last_updated: Date;
}

export interface ServiceStatus {
  status: 'running' | 'starting' | 'stopped' | 'error';
  uptime_seconds: number;
  last_health_check: Date;
  error_message?: string;
  performance_metrics?: Record<string, any>;
}

export interface MonitoringConfiguration {
  enabled: boolean;
  auto_start_services: boolean;
  health_check_interval_seconds: number;
  pattern_learning_enabled: boolean;
  automated_recovery_enabled: boolean;
  alerting_enabled: boolean;
  supabase_integration_enabled: boolean;
  debug_mode: boolean;
  log_level: 'debug' | 'info' | 'warn' | 'error';
}

export interface SystemRecoveryReport {
  report_id: string;
  generated_at: Date;
  time_period: {
    start: Date;
    end: Date;
  };

  // Failure analysis
  total_failures: number;
  failures_by_type: Record<string, number>;
  most_affected_services: Array<{ service: string; failure_count: number }>;

  // Recovery effectiveness
  total_recovery_actions: number;
  successful_recoveries: number;
  failed_recoveries: number;
  average_recovery_time_minutes: number;

  // Pattern learning
  new_patterns_discovered: number;
  pattern_accuracy_improvement: number;
  most_effective_patterns: Array<{ pattern: string; success_rate: number }>;

  // Alert performance
  total_alerts: number;
  alert_response_times: Record<string, number>;
  escalation_statistics: Record<string, number>;

  // Recommendations
  system_recommendations: string[];
  pattern_optimization_suggestions: string[];
  infrastructure_improvements: string[];
}

/**
 * Unified Restart Monitoring System Integration
 *
 * Manages all monitoring services, coordinates their interactions,
 * and provides a single interface for the complete system.
 */
export class RestartMonitoringIntegration {
  private static instance: RestartMonitoringIntegration;
  private supabase: SupabaseClient;
  private config: MonitoringConfiguration;

  // Service instances
  private restartMonitor: ProactiveRestartMonitor;
  private startupSequencer: ServiceStartupSequencer;
  private intelligentAgent: IntelligentRestartAgent;
  private recoveryOrchestrator: AutomatedRecoveryOrchestrator;
  private alertingSystem: RealTimeAlertingSystem;

  // State management
  private isInitialized = false;
  private serviceStatuses = new Map<string, ServiceStatus>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startupTime = new Date();

  private constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
    );

    // Default configuration
    this.config = {
      enabled: true,
      auto_start_services: true,
      health_check_interval_seconds: 30,
      pattern_learning_enabled: true,
      automated_recovery_enabled: true,
      alerting_enabled: true,
      supabase_integration_enabled: true,
      debug_mode: false,
      log_level: 'info',
    };

    // Get service instances
    this.restartMonitor = ProactiveRestartMonitor.getInstance();
    this.startupSequencer = ServiceStartupSequencer.getInstance();
    this.intelligentAgent = IntelligentRestartAgent.getInstance();
    this.recoveryOrchestrator = AutomatedRecoveryOrchestrator.getInstance();
    this.alertingSystem = RealTimeAlertingSystem.getInstance();
  }

  public static getInstance(): RestartMonitoringIntegration {
    if (!RestartMonitoringIntegration.instance) {
      RestartMonitoringIntegration.instance = new RestartMonitoringIntegration();
    }
    return RestartMonitoringIntegration.instance;
  }

  /**
   * Initialize the complete monitoring system
   */
  public async initialize(config?: Partial<MonitoringConfiguration>): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🚀 Initializing Unified Restart Monitoring System...');

      // Update configuration
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Load configuration from Supabase
      await this.loadConfiguration();

      // Initialize database schema if needed
      if (this.config.supabase_integration_enabled) {
        await this.ensureDatabaseSchema();
      }

      // Initialize all services in order
      if (this.config.auto_start_services) {
        await this.initializeServices();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      // Set up service interactions
      await this.configureServiceInteractions();

      this.isInitialized = true;
      console.log('✅ Unified Restart Monitoring System initialized successfully');

      // Store initialization event
      await this.recordSystemEvent('system_initialized', {
        configuration: this.config,
        services_started: this.config.auto_start_services,
      });
    } catch (error) {
      console.error('❌ Failed to initialize Restart Monitoring System:', error);
      throw error;
    }
  }

  /**
   * Load configuration from Supabase
   */
  private async loadConfiguration(): Promise<void> {
    if (!this.config.supabase_integration_enabled) return;

    try {
      const { data, error } = await this.supabase
        .from('context_storage')
        .select('content')
        .eq('category', 'monitoring_configuration')
        .eq('source', 'restart_monitoring_system')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.content) {
        const savedConfig = JSON.parse(data.content);
        this.config = { ...this.config, ...savedConfig };
      }
    } catch (error) {
      console.warn('Using default monitoring configuration:', error);
    }
  }

  /**
   * Ensure database schema exists
   */
  private async ensureDatabaseSchema(): Promise<void> {
    try {
      // Check if our tables exist
      const { data, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', [
          'restart_failures',
          'restart_patterns',
          'service_health_metrics',
          'alerts',
          'recovery_actions',
        ]);

      if (error) {
        console.warn('Could not verify database schema:', error);
        return;
      }

      const existingTables = data?.map(row => row.table_name) || [];
      const requiredTables = [
        'restart_failures',
        'restart_patterns',
        'service_health_metrics',
        'alerts',
        'recovery_actions',
      ];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        console.warn(`⚠️ Missing database tables: ${missingTables.join(', ')}`);
        console.log(
          'Please run the migration: supabase/migrations/20250124000000_restart_monitoring_schema.sql'
        );
      }
    } catch (error) {
      console.warn('Could not verify database schema:', error);
    }
  }

  /**
   * Initialize all monitoring services
   */
  private async initializeServices(): Promise<void> {
    const services = [
      { name: 'restart_monitor', service: this.restartMonitor },
      { name: 'startup_sequencer', service: this.startupSequencer },
      { name: 'intelligent_agent', service: this.intelligentAgent },
      { name: 'recovery_orchestrator', service: this.recoveryOrchestrator },
      { name: 'alerting_system', service: this.alertingSystem },
    ];

    for (const { name, service } of services) {
      try {
        console.log(`🔧 Initializing ${name}...`);

        const startTime = Date.now();
        await service.initialize();
        const endTime = Date.now();

        this.serviceStatuses.set(name, {
          status: 'running',
          uptime_seconds: 0,
          last_health_check: new Date(),
          performance_metrics: {
            startup_time_ms: endTime - startTime,
          },
        });

        console.log(`✅ ${name} initialized in ${endTime - startTime}ms`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${name}:`, error);

        this.serviceStatuses.set(name, {
          status: 'error',
          uptime_seconds: 0,
          last_health_check: new Date(),
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Configure interactions between services
   */
  private async configureServiceInteractions(): Promise<void> {
    try {
      // Configure restart monitor to trigger intelligent analysis
      this.restartMonitor.on?.('failure_detected', async failure => {
        try {
          await this.intelligentAgent.analyzeFailure(failure);
        } catch (error) {
          console.error('Error in intelligent failure analysis:', error);
        }
      });

      // Configure intelligent agent to trigger recovery
      this.intelligentAgent.on?.('diagnosis_complete', async diagnosis => {
        if (diagnosis.confidence > 0.7 && this.config.automated_recovery_enabled) {
          try {
            await this.recoveryOrchestrator.executeRecoveryPlan(diagnosis.recommended_actions);
          } catch (error) {
            console.error('Error executing recovery plan:', error);
          }
        }
      });

      // Configure recovery orchestrator to update patterns
      this.recoveryOrchestrator.on?.('recovery_complete', async result => {
        try {
          await this.intelligentAgent.updatePatternFromRecovery(result);
        } catch (error) {
          console.error('Error updating patterns from recovery:', error);
        }
      });

      console.log('✅ Service interactions configured');
    } catch (error) {
      console.error('Error configuring service interactions:', error);
    }
  }

  /**
   * Start health monitoring for all services
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.health_check_interval_seconds * 1000);

    console.log(
      `✅ Health monitoring started (interval: ${this.config.health_check_interval_seconds}s)`
    );
  }

  /**
   * Perform health checks on all services
   */
  private async performHealthChecks(): Promise<void> {
    const services = [
      'restart_monitor',
      'startup_sequencer',
      'intelligent_agent',
      'recovery_orchestrator',
      'alerting_system',
    ];

    for (const serviceName of services) {
      try {
        const service = this.getService(serviceName);
        if (!service) continue;

        // Check if service has health method
        const health =
          typeof service.getHealth === 'function'
            ? await service.getHealth()
            : { status: 'unknown' };

        const currentStatus = this.serviceStatuses.get(serviceName);
        const uptime = currentStatus
          ? Math.floor((Date.now() - this.startupTime.getTime()) / 1000)
          : 0;

        this.serviceStatuses.set(serviceName, {
          status:
            health.status === 'healthy'
              ? 'running'
              : health.status === 'warning'
                ? 'running'
                : 'error',
          uptime_seconds: uptime,
          last_health_check: new Date(),
          error_message: health.error,
          performance_metrics: health.metrics,
        });
      } catch (error) {
        this.serviceStatuses.set(serviceName, {
          status: 'error',
          uptime_seconds: 0,
          last_health_check: new Date(),
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Check database connection
    try {
      await this.supabase.from('restart_failures').select('id').limit(1);
      this.serviceStatuses.set('database_connection', {
        status: 'running',
        uptime_seconds: Math.floor((Date.now() - this.startupTime.getTime()) / 1000),
        last_health_check: new Date(),
      });
    } catch (error) {
      this.serviceStatuses.set('database_connection', {
        status: 'error',
        uptime_seconds: 0,
        last_health_check: new Date(),
        error_message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get service instance by name
   */
  private getService(serviceName: string): any {
    switch (serviceName) {
      case 'restart_monitor':
        return this.restartMonitor;
      case 'startup_sequencer':
        return this.startupSequencer;
      case 'intelligent_agent':
        return this.intelligentAgent;
      case 'recovery_orchestrator':
        return this.recoveryOrchestrator;
      case 'alerting_system':
        return this.alertingSystem;
      default:
        return null;
    }
  }

  /**
   * Get overall system status
   */
  public async getSystemStatus(): Promise<MonitoringSystemStatus> {
    try {
      // Collect metrics from all services
      const [restartMetrics, sequencerMetrics, agentMetrics, orchestratorMetrics, alertingMetrics] =
        await Promise.allSettled([
          this.restartMonitor.getMetrics(),
          this.startupSequencer.getMetrics(),
          this.intelligentAgent.getLearningStats(),
          this.recoveryOrchestrator.getMetrics(),
          this.alertingSystem.getMetrics(),
        ]);

      // Calculate overall health
      const serviceStatuses = Array.from(this.serviceStatuses.values());
      const healthyServices = serviceStatuses.filter(s => s.status === 'running').length;
      const totalServices = serviceStatuses.length;

      let overallHealth: 'healthy' | 'warning' | 'critical' | 'offline';
      if (healthyServices === totalServices) {
        overallHealth = 'healthy';
      } else if (healthyServices >= totalServices * 0.7) {
        overallHealth = 'warning';
      } else if (healthyServices > 0) {
        overallHealth = 'critical';
      } else {
        overallHealth = 'offline';
      }

      // Extract metrics safely
      const extractMetrics = (result: any, defaultValue: any) =>
        result.status === 'fulfilled' ? result.value : defaultValue;

      const restartData = extractMetrics(restartMetrics, {});
      const sequencerData = extractMetrics(sequencerMetrics, {});
      const agentData = extractMetrics(agentMetrics, {});
      const orchestratorData = extractMetrics(orchestratorMetrics, {});
      const alertingData = extractMetrics(alertingMetrics, {});

      return {
        overall_health: overallHealth,
        services: {
          restart_monitor: this.serviceStatuses.get('restart_monitor') || {
            status: 'stopped',
            uptime_seconds: 0,
            last_health_check: new Date(),
          },
          startup_sequencer: this.serviceStatuses.get('startup_sequencer') || {
            status: 'stopped',
            uptime_seconds: 0,
            last_health_check: new Date(),
          },
          intelligent_agent: this.serviceStatuses.get('intelligent_agent') || {
            status: 'stopped',
            uptime_seconds: 0,
            last_health_check: new Date(),
          },
          recovery_orchestrator: this.serviceStatuses.get('recovery_orchestrator') || {
            status: 'stopped',
            uptime_seconds: 0,
            last_health_check: new Date(),
          },
          alerting_system: this.serviceStatuses.get('alerting_system') || {
            status: 'stopped',
            uptime_seconds: 0,
            last_health_check: new Date(),
          },
          database_connection: this.serviceStatuses.get('database_connection') || {
            status: 'stopped',
            uptime_seconds: 0,
            last_health_check: new Date(),
          },
        },
        metrics: {
          active_failures: restartData.active_failures || 0,
          recovery_actions_running: orchestratorData.active_recovery_actions || 0,
          active_alerts: alertingData.alerts_triggered_24h || 0,
          patterns_learned: agentData.total_patterns || 0,
          system_uptime_hours: Math.floor(
            (Date.now() - this.startupTime.getTime()) / 1000 / 60 / 60
          ),
        },
        last_updated: new Date(),
      };
    } catch (error) {
      console.error('Error getting system status:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive system recovery report
   */
  public async generateRecoveryReport(
    startDate?: Date,
    endDate?: Date
  ): Promise<SystemRecoveryReport> {
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const end = endDate || new Date();
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Query failure data from Supabase
      const { data: failures, error: failuresError } = await this.supabase
        .from('restart_failures')
        .select('*')
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .order('timestamp', { ascending: false });

      if (failuresError) throw failuresError;

      // Query recovery actions
      const { data: recoveries, error: recoveriesError } = await this.supabase
        .from('recovery_actions')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (recoveriesError) throw recoveriesError;

      // Query alerts
      const { data: alerts, error: alertsError } = await this.supabase
        .from('alerts')
        .select('*')
        .gte('triggered_at', start.toISOString())
        .lte('triggered_at', end.toISOString())
        .order('triggered_at', { ascending: false });

      if (alertsError) throw alertsError;

      // Query patterns
      const { data: patterns, error: patternsError } = await this.supabase
        .from('restart_patterns')
        .select('*')
        .gte('first_observed', start.toISOString())
        .lte('first_observed', end.toISOString())
        .order('confidence_score', { ascending: false });

      if (patternsError) throw patternsError;

      // Analyze failure data
      const failuresByType = (failures || []).reduce(
        (acc, failure) => {
          acc[failure.failure_type] = (acc[failure.failure_type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const serviceFailureCounts = (failures || []).reduce(
        (acc, failure) => {
          acc[failure.service_name] = (acc[failure.service_name] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const mostAffectedServices = Object.entries(serviceFailureCounts)
        .map(([service, failure_count]) => ({ service, failure_count }))
        .sort((a, b) => b.failure_count - a.failure_count)
        .slice(0, 5);

      // Analyze recovery data
      const successfulRecoveries = (recoveries || []).filter(r => r.success).length;
      const failedRecoveries = (recoveries || []).filter(r => !r.success).length;
      const totalRecoveries = (recoveries || []).length;

      const avgRecoveryTime =
        totalRecoveries > 0
          ? (recoveries || []).reduce((sum, r) => sum + (r.duration_ms || 0), 0) /
            totalRecoveries /
            1000 /
            60
          : 0;

      // Analyze patterns
      const newPatternsCount = (patterns || []).length;
      const mostEffectivePatterns = (patterns || [])
        .filter(p => p.success_rate !== null)
        .map(p => ({ pattern: p.pattern_name, success_rate: p.success_rate }))
        .sort((a, b) => b.success_rate - a.success_rate)
        .slice(0, 5);

      // Analyze alerts
      const alertResponseTimes = (alerts || []).reduce(
        (acc, alert) => {
          if (alert.acknowledged_at) {
            const responseTime =
              new Date(alert.acknowledged_at).getTime() - new Date(alert.triggered_at).getTime();
            acc[alert.severity] = (acc[alert.severity] || 0) + responseTime / 1000 / 60; // minutes
          }
          return acc;
        },
        {} as Record<string, number>
      );

      const escalationStats = (alerts || []).reduce(
        (acc, alert) => {
          if (alert.escalated_at) {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      );

      // Generate recommendations
      const systemRecommendations = [];
      const patternOptimizations = [];
      const infrastructureImprovements = [];

      if (failedRecoveries > successfulRecoveries) {
        systemRecommendations.push('Review and improve automated recovery strategies');
      }

      if (newPatternsCount > 10) {
        patternOptimizations.push('Consider consolidating similar patterns for better performance');
      }

      if (Object.keys(failuresByType).length > 5) {
        infrastructureImprovements.push(
          'Investigate recurring failure types for infrastructure improvements'
        );
      }

      const report: SystemRecoveryReport = {
        report_id: reportId,
        generated_at: new Date(),
        time_period: { start, end },
        total_failures: (failures || []).length,
        failures_by_type: failuresByType,
        most_affected_services: mostAffectedServices,
        total_recovery_actions: totalRecoveries,
        successful_recoveries: successfulRecoveries,
        failed_recoveries: failedRecoveries,
        average_recovery_time_minutes: Math.round(avgRecoveryTime),
        new_patterns_discovered: newPatternsCount,
        pattern_accuracy_improvement: 0, // Would need historical comparison
        most_effective_patterns: mostEffectivePatterns,
        total_alerts: (alerts || []).length,
        alert_response_times: alertResponseTimes,
        escalation_statistics: escalationStats,
        system_recommendations: systemRecommendations,
        pattern_optimization_suggestions: patternOptimizations,
        infrastructure_improvements: infrastructureImprovements,
      };

      // Store report in Supabase
      await this.recordSystemEvent('recovery_report_generated', {
        report_id: reportId,
        time_period: { start, end },
        summary: {
          total_failures: report.total_failures,
          successful_recoveries: report.successful_recoveries,
          new_patterns: report.new_patterns_discovered,
          total_alerts: report.total_alerts,
        },
      });

      return report;
    } catch (error) {
      console.error('Error generating recovery report:', error);
      throw error;
    }
  }

  /**
   * Record a system event in Supabase
   */
  private async recordSystemEvent(eventType: string, eventData: any): Promise<void> {
    if (!this.config.supabase_integration_enabled) return;

    try {
      await this.supabase.from('context_storage').insert({
        category: 'monitoring_system_events',
        source: 'restart_monitoring_integration',
        content: JSON.stringify({
          event_type: eventType,
          timestamp: new Date().toISOString(),
          data: eventData,
        }),
        metadata: {
          system_version: '1.0.0',
          event_type: eventType,
        },
      });
    } catch (error) {
      console.warn('Could not record system event:', error);
    }
  }

  /**
   * Update monitoring configuration
   */
  public async updateConfiguration(newConfig: Partial<MonitoringConfiguration>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // Save to Supabase
    if (this.config.supabase_integration_enabled) {
      try {
        await this.supabase.from('context_storage').upsert({
          category: 'monitoring_configuration',
          source: 'restart_monitoring_system',
          content: JSON.stringify(this.config),
          metadata: {
            updated_at: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.warn('Could not save configuration to Supabase:', error);
      }
    }

    // Apply configuration changes
    if ('health_check_interval_seconds' in newConfig) {
      this.startHealthMonitoring(); // Restart with new interval
    }

    console.log('✅ Monitoring configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): MonitoringConfiguration {
    return { ...this.config };
  }

  /**
   * Shutdown the complete monitoring system
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Unified Restart Monitoring System...');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Shutdown all services
    const services = [
      { name: 'alerting_system', service: this.alertingSystem },
      { name: 'recovery_orchestrator', service: this.recoveryOrchestrator },
      { name: 'intelligent_agent', service: this.intelligentAgent },
      { name: 'startup_sequencer', service: this.startupSequencer },
      { name: 'restart_monitor', service: this.restartMonitor },
    ];

    for (const { name, service } of services) {
      try {
        if (typeof service.shutdown === 'function') {
          await service.shutdown();
        }
        console.log(`✅ ${name} shut down`);
      } catch (error) {
        console.error(`❌ Error shutting down ${name}:`, error);
      }
    }

    // Record shutdown event
    await this.recordSystemEvent('system_shutdown', {
      uptime_hours: Math.floor((Date.now() - this.startupTime.getTime()) / 1000 / 60 / 60),
      shutdown_reason: 'manual',
    });

    this.isInitialized = false;
    console.log('✅ Unified Restart Monitoring System shut down completely');
  }
}

// Export singleton instance as default
export default RestartMonitoringIntegration;
