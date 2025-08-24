/**
 * Restart Monitoring System Initialization Utility
 *
 * Provides easy initialization and setup for the complete
 * proactive restart monitoring system.
 */

import {
  RestartMonitoringIntegration,
  MonitoringConfiguration,
} from '../services/restartMonitoringIntegration';

// Global monitoring instance
let monitoringSystem: RestartMonitoringIntegration | null = null;

/**
 * Initialize the complete restart monitoring system
 */
export async function initializeRestartMonitoring(
  config?: Partial<MonitoringConfiguration>
): Promise<RestartMonitoringIntegration> {
  if (monitoringSystem) {
    console.log('📊 Restart monitoring system already initialized');
    return monitoringSystem;
  }

  try {
    console.log('🚀 Starting Restart Monitoring System initialization...');

    // Get monitoring system instance
    monitoringSystem = RestartMonitoringIntegration.getInstance();

    // Default configuration for development
    const defaultConfig: Partial<MonitoringConfiguration> = {
      enabled: true,
      auto_start_services: true,
      health_check_interval_seconds: 30,
      pattern_learning_enabled: true,
      automated_recovery_enabled: true,
      alerting_enabled: true,
      supabase_integration_enabled: true,
      debug_mode: process.env.NODE_ENV === 'development',
      log_level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      ...config,
    };

    // Initialize with configuration
    await monitoringSystem.initialize(defaultConfig);

    // Wait a moment for services to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get initial system status
    const status = await monitoringSystem.getSystemStatus();

    console.log('📊 System Status Summary:');
    console.log(`   Overall Health: ${status.overall_health.toUpperCase()}`);
    console.log(
      `   Active Services: ${Object.values(status.services).filter(s => s.status === 'running').length}/6`
    );
    console.log(`   Active Failures: ${status.metrics.active_failures}`);
    console.log(`   Patterns Learned: ${status.metrics.patterns_learned}`);
    console.log(`   System Uptime: ${status.metrics.system_uptime_hours}h`);

    // Log service statuses
    console.log('📋 Service Status Details:');
    Object.entries(status.services).forEach(([name, service]) => {
      const statusIcon =
        service.status === 'running' ? '✅' : service.status === 'error' ? '❌' : '⚠️';
      console.log(`   ${statusIcon} ${name}: ${service.status} (${service.uptime_seconds}s)`);
      if (service.error_message) {
        console.log(`      Error: ${service.error_message}`);
      }
    });

    // Set up graceful shutdown
    setupGracefulShutdown();

    console.log('✅ Restart Monitoring System fully initialized and operational');
    return monitoringSystem;
  } catch (error) {
    console.error('❌ Failed to initialize Restart Monitoring System:', error);
    throw error;
  }
}

/**
 * Get the current monitoring system instance
 */
export function getMonitoringSystem(): RestartMonitoringIntegration | null {
  return monitoringSystem;
}

/**
 * Check if monitoring system is initialized and healthy
 */
export async function isMonitoringHealthy(): Promise<boolean> {
  if (!monitoringSystem) return false;

  try {
    const status = await monitoringSystem.getSystemStatus();
    return status.overall_health === 'healthy';
  } catch (error) {
    return false;
  }
}

/**
 * Get system status summary for display
 */
export async function getMonitoringStatusSummary(): Promise<{
  status: 'healthy' | 'warning' | 'critical' | 'offline' | 'not_initialized';
  summary: string;
  details?: any;
}> {
  if (!monitoringSystem) {
    return {
      status: 'not_initialized',
      summary: 'Monitoring system not initialized',
    };
  }

  try {
    const status = await monitoringSystem.getSystemStatus();
    const runningServices = Object.values(status.services).filter(
      s => s.status === 'running'
    ).length;

    let summary = '';
    switch (status.overall_health) {
      case 'healthy':
        summary = `All systems operational (${runningServices}/6 services running)`;
        break;
      case 'warning':
        summary = `Some issues detected (${runningServices}/6 services running)`;
        break;
      case 'critical':
        summary = `Critical issues detected (${runningServices}/6 services running)`;
        break;
      case 'offline':
        summary = 'System offline - no services running';
        break;
    }

    return {
      status: status.overall_health,
      summary,
      details: status,
    };
  } catch (error) {
    return {
      status: 'critical',
      summary: `Error checking status: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Generate and return a recovery report
 */
export async function generateRecoveryReport(daysBack: number = 7): Promise<any> {
  if (!monitoringSystem) {
    throw new Error('Monitoring system not initialized');
  }

  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  return await monitoringSystem.generateRecoveryReport(startDate, endDate);
}

/**
 * Update monitoring configuration
 */
export async function updateMonitoringConfig(
  newConfig: Partial<MonitoringConfiguration>
): Promise<void> {
  if (!monitoringSystem) {
    throw new Error('Monitoring system not initialized');
  }

  await monitoringSystem.updateConfiguration(newConfig);
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(): void {
  const shutdownHandler = async (signal: string) => {
    console.log(`📡 Received ${signal}, shutting down monitoring system gracefully...`);

    if (monitoringSystem) {
      try {
        await monitoringSystem.shutdown();
      } catch (error) {
        console.error('Error during shutdown:', error);
      }
    }

    process.exit(0);
  };

  // Handle different shutdown signals
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', async error => {
    console.error('❌ Uncaught Exception:', error);
    if (monitoringSystem) {
      try {
        await monitoringSystem.shutdown();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
    }
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    if (monitoringSystem) {
      try {
        await monitoringSystem.shutdown();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
    }
    process.exit(1);
  });
}

/**
 * Auto-initialize monitoring system if in production
 */
if (process.env.NODE_ENV === 'production' && process.env.AUTO_START_MONITORING === 'true') {
  // Auto-initialize in production with a delay
  setTimeout(() => {
    initializeRestartMonitoring({
      debug_mode: false,
      log_level: 'info',
      health_check_interval_seconds: 60,
    }).catch(error => {
      console.error('Failed to auto-initialize monitoring system:', error);
    });
  }, 5000); // 5 second delay to allow other systems to start
}

/**
 * Development helper - initialize with development settings
 */
export async function initializeForDevelopment(): Promise<RestartMonitoringIntegration> {
  return initializeRestartMonitoring({
    debug_mode: true,
    log_level: 'debug',
    health_check_interval_seconds: 15,
    automated_recovery_enabled: false, // Safer for development
    supabase_integration_enabled: process.env.SUPABASE_URL ? true : false,
  });
}

/**
 * Production helper - initialize with production settings
 */
export async function initializeForProduction(): Promise<RestartMonitoringIntegration> {
  return initializeRestartMonitoring({
    debug_mode: false,
    log_level: 'warn',
    health_check_interval_seconds: 60,
    automated_recovery_enabled: true,
    supabase_integration_enabled: true,
  });
}

// Export the main initialization function as default
export default initializeRestartMonitoring;
