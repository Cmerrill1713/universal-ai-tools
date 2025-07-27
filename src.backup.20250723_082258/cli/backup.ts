/* eslint-disable no-undef */
#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { createBackupRecoveryService } from '../services/backup-recovery-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

// Initialize Supabase client
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey || ''
);

// Initialize backup service
const backupService = createBackupRecoveryService(supabase, {
  enabled: true,
  schedule: '0 2 * * *', // 2 AM daily
  retention: {
    daily: 7,
    weekly: 4,
    monthly: 12,
  },
  storage: {
    local: {
      enabled: true,
      path: process.env.BACKUP_PATH || './backups',
    },
    supabase: {
      enabled: true,
      bucket: 'backups',
    },
    s3: {
      enabled: false,
    },
  },
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    keyDerivation: 'scrypt',
  },
  tables: ['backup_metadata'],
});

program
  .name('backup')
  .description('Backup and recovery management for Universal AI Tools')
  .version('1.0.0');

// Create backup command
program
  .command('create')
  .description('Create a new backup')
  .option('-t, --type <type>', 'Backup type (full, incremental, differential)', 'full')
  .option('--tables <tables>', 'Comma-separated list of tables to backup')
  .option('--no-compress', 'Disable compression')
  .option('--no-encrypt', 'Disable encryption')
  .action(async (options) => {
    const spinner = ora('Creating backup...').start();

    try {
      const tables = options.tables
        ? options.tables.split(',').map((t: string) => t.trim())
        : undefined;

      const result = await backupService.createBackup({
        type: options.type,
        tables,
        compress: options.compress,
      });

      spinner.succeed(chalk.green(`Backup created successfully!`));

      console.log(`\n${chalk.bold('Backup Details:')}`);
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.cyan('ID:')} ${result.id}`);
      console.log(`${chalk.cyan('Type:')} ${result.type}`);
      console.log(`${chalk.cyan('Size:')} ${formatBytes(result.size)}`);
      console.log(`${chalk.cyan('Duration:')} ${result.duration}ms`);
      console.log(`${chalk.cyan('Tables:')} ${result.tables.length}`);
      console.log(`${chalk.cyan('Rows:')} ${result.rowCount.toLocaleString()}`);
      console.log(`${chalk.cyan('Storage:')} ${result.storage.join(', ')}`);
      console.log(`${chalk.cyan('Encrypted:')} ${result.encrypted ? '✓' : '✗'}`);
      console.log(`${chalk.cyan('Compressed:')} ${result.compressed ? '✓' : '✗'}`);
    } catch (_error any) {
      spinner.fail(chalk.red('Backup failed'));
      logger.error`Backup operation failed: ${_errormessage}`, LogContext.SYSTEM, { _error});
      console._errorchalk.red(`Error: ${_errormessage}`));
      process.exit(1);
    }
  });

// List backups command
program
  .command('list')
  .description('List available backups')
  .option('-l, --limit <number>', 'Number of backups to show', '10')
  .option('-s, --status <status>', 'Filter by status (completed, failed, in_progress)')
  .action(async (options) => {
    try {
      const { backups, total } = await backupService.listBackups({
        limit: parseInt(options.limit, 10),
        status: options.status,
      });

      if (backups.length === 0) {
        console.log(chalk.yellow('No backups found'));
        return;
      }

      console.log(chalk.bold(`\nBackups (${backups.length} of ${total}):`));
      console.log(chalk.gray('─'.repeat(120)));
      console.log(
        chalk.bold(
          `${
            'ID'.padEnd(40) +
            'Type'.padEnd(12) +
            'Status'.padEnd(12) +
            'Size'.padEnd(12) +
            'Rows'.padEnd(12) +
            'Duration'.padEnd(10)
          }Created`
        )
      );
      console.log(chalk.gray('─'.repeat(120)));

      backups.forEach((backup) => {
        const statusColor =
          backup.status === 'completed'
            ? chalk.green
            : backup.status === 'failed'
              ? chalk.red
              : chalk.yellow;

        console.log(
          backup.id.substring(0, 37).padEnd(40) +
            backup.type.padEnd(12) +
            statusColor(backup.status.padEnd(12)) +
            formatBytes(backup.size).padEnd(12) +
            backup.rowCount.toLocaleString().padEnd(12) +
            `${backup.duration}ms`.padEnd(10) +
            new Date(backup.timestamp).toLocaleString()
        );
      });
    } catch (_error any) {
      logger.error`Backup operation failed: ${_errormessage}`, LogContext.SYSTEM, { _error});
      console._errorchalk.red(`Error: ${_errormessage}`));
      process.exit(1);
    }
  });

// Restore backup command
program
  .command('restore <backupId>')
  .description('Restore from a backup')
  .option('--tables <tables>', 'Comma-separated list of tables to restore')
  .option('--dry-run', 'Perform a dry run without making changes')
  .option('--skip-constraints', 'Skip foreign key constraints')
  .action(async (backupId, options) => {
    const spinner = ora('Restoring backup...').start();

    try {
      const tables = options.tables
        ? options.tables.split(',').map((t: string) => t.trim())
        : undefined;

      if (!options.dryRun) {
        // Confirm restore
        console.log(chalk.yellow('\n⚠️  Warning: This will overwrite existing data!'));
        console.log('Press Ctrl+C to cancel or any key to continue...');
        await new Promise((resolve) => process.stdin.once('data', resolve));
      }

      const result = await backupService.restoreBackup({
        backupId,
        tables,
        dryRun: options.dryRun,
        skipConstraints: options.skipConstraints,
      });

      spinner.succeed(
        chalk.green(`Restore ${options.dryRun ? 'dry run' : ''} completed successfully!`)
      );

      console.log(`\n${chalk.bold('Restore Details:')}`);
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.cyan('Tables Restored:')} ${result.tablesRestored.length}`);
      console.log(`${chalk.cyan('Rows Restored:')} ${result.rowsRestored.toLocaleString()}`);
      console.log(`${chalk.cyan('Duration:')} ${result.duration}ms`);

      if (result.tablesRestored.length > 0) {
        console.log(`\n${chalk.cyan('Tables:')}`);
        result.tablesRestored.forEach((table) => {
          console.log(`  - ${table}`);
        });
      }
    } catch (_error any) {
      spinner.fail(chalk.red('Restore failed'));
      logger.error`Backup operation failed: ${_errormessage}`, LogContext.SYSTEM, { _error});
      console._errorchalk.red(`Error: ${_errormessage}`));
      process.exit(1);
    }
  });

// Delete backup command
program
  .command('delete <backupId>')
  .description('Delete a backup')
  .action(async (backupId) => {
    try {
      // Confirm deletion
      console.log(chalk.yellow('\n⚠️  Warning: This action cannot be undone!'));
      console.log(`Delete backup ${backupId}?`);
      console.log('Press Ctrl+C to cancel or any key to continue...');
      await new Promise((resolve) => process.stdin.once('data', resolve));

      const spinner = ora('Deleting backup...').start();

      await backupService.deleteBackup(backupId);

      spinner.succeed(chalk.green('Backup deleted successfully!'));
    } catch (_error any) {
      logger.error`Backup operation failed: ${_errormessage}`, LogContext.SYSTEM, { _error});
      console._errorchalk.red(`Error: ${_errormessage}`));
      process.exit(1);
    }
  });

// Verify backup command
program
  .command('verify <backupId>')
  .description('Verify backup integrity')
  .action(async (backupId) => {
    const spinner = ora('Verifying backup...').start();

    try {
      const result = await backupService.verifyBackup(backupId);

      if (result.valid) {
        spinner.succeed(chalk.green('Backup is valid!'));
      } else {
        spinner.fail(chalk.red('Backup validation failed'));
        console.log(`\n${chalk.red('Validation Errors:')}`);
        result.errors.forEach((_error => {
          console.log(chalk.red(`  - ${_error`));
        });
      }
    } catch (_error any) {
      spinner.fail(chalk.red('Verification failed'));
      logger.error`Backup operation failed: ${_errormessage}`, LogContext.SYSTEM, { _error});
      console._errorchalk.red(`Error: ${_errormessage}`));
      process.exit(1);
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up old backups based on retention policy')
  .action(async () => {
    const spinner = ora('Cleaning up old backups...').start();

    try {
      const deletedCount = await backupService.cleanupOldBackups();

      spinner.succeed(chalk.green(`Cleanup completed! Deleted ${deletedCount} old backups.`));
    } catch (_error any) {
      spinner.fail(chalk.red('Cleanup failed'));
      logger.error`Backup operation failed: ${_errormessage}`, LogContext.SYSTEM, { _error});
      console._errorchalk.red(`Error: ${_errormessage}`));
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show backup system status')
  .action(async () => {
    try {
      const status = await backupService.getBackupStatus();

      console.log(`\n${chalk.bold('Backup System Status:')}`);
      console.log(chalk.gray('─'.repeat(50)));
      console.log(
        `${chalk.cyan('Last Backup:')} ${status.lastBackup ? status.lastBackup.toLocaleString() : 'Never'}`
      );
      console.log(
        `${chalk.cyan('Next Backup:')} ${status.nextBackup ? status.nextBackup.toLocaleString() : 'Not scheduled'}`
      );
      console.log(
        `${chalk.cyan('Running:')} ${status.isRunning ? chalk.yellow('Yes') : chalk.green('No')}`
      );
      console.log(`${chalk.cyan('Total Backups:')} ${status.totalBackups}`);
      console.log(`${chalk.cyan('Total Size:')} ${formatBytes(status.totalSize)}`);

      if (Object.keys(status.storageUsage).length > 0) {
        console.log(`\n${chalk.cyan('Storage Usage:')}`);
        Object.entries(status.storageUsage).forEach(([storage, size]) => {
          console.log(`  ${storage}: ${formatBytes(size)}`);
        });
      }

      // Check health
      const { data: health } = await supabase.rpc('check_backup_health');

      if (health) {
        console.log(
          `\n${chalk.cyan('Health Status:')} ${
            health.health_status === 'healthy'
              ? chalk.green('Healthy')
              : health.health_status === 'warning'
                ? chalk.yellow('Warning')
                : chalk.red('Critical')
          }`
        );

        if (health.recommendations?.length > 0) {
          console.log(`\n${chalk.yellow('Recommendations:')}`);
          health.recommendations.forEach((rec: string) => {
            console.log(`  - ${rec}`);
          });
        }
      }
    } catch (_error any) {
      logger.error`Backup operation failed: ${_errormessage}`, LogContext.SYSTEM, { _error});
      console._errorchalk.red(`Error: ${_errormessage}`));
      process.exit(1);
    }
  });

// Schedule command
program
  .command('schedule')
  .description('Manage backup schedules')
  .option('-l, --list', 'List schedules')
  .option('-c, --create <name>', 'Create a new schedule')
  .option('-s, --schedule <cron>', 'Cron expression (with --create)')
  .option('-t, --type <type>', 'Backup type (with --create)', 'full')
  .action(async (options) => {
    try {
      if (options.list) {
        const { data: schedules } = await supabase
          .from('backup_schedules')
          .select('*')
          .order('name');

        if (!schedules || schedules.length === 0) {
          console.log(chalk.yellow('No schedules found'));
          return;
        }

        console.log(`\n${chalk.bold('Backup Schedules:')}`);
        console.log(chalk.gray('─'.repeat(100)));
        console.log(
          chalk.bold(
            `${
              'Name'.padEnd(25) +
              'Schedule'.padEnd(20) +
              'Type'.padEnd(12) +
              'Enabled'.padEnd(10) +
              'Last Run'.padEnd(25)
            }Next Run`
          )
        );
        console.log(chalk.gray('─'.repeat(100)));

        schedules.forEach((schedule) => {
          console.log(
            schedule.name.padEnd(25) +
              schedule.schedule.padEnd(20) +
              schedule.backup_type.padEnd(12) +
              (schedule.enabled ? chalk.green('Yes') : chalk.red('No')).padEnd(10) +
              (schedule.last_run ? new Date(schedule.last_run).toLocaleString() : 'Never').padEnd(
                25
              ) +
              (schedule.next_run ? new Date(schedule.next_run).toLocaleString() : 'Not set')
          );
        });
      } else if (options.create) {
        if (!options.schedule) {
          console._errorchalk.red('Error: --schedule is required when creating a schedule'));
          process.exit(1);
        }

        const { data, _error} = await supabase.rpc('schedule_backup', {
          p_name: options.create,
          p_schedule: options.schedule,
          p_type: options.type,
        });

        if (_error throw _error;

        console.log(chalk.green(`✓ Schedule '${options.create}' created successfully!`));
        console.log(chalk.gray(`  Schedule: ${options.schedule}`));
        console.log(chalk.gray(`  Type: ${options.type}`));
      }
    } catch (_error any) {
      logger.error`Backup operation failed: ${_errormessage}`, LogContext.SYSTEM, { _error});
      console._errorchalk.red(`Error: ${_errormessage}`));
      process.exit(1);
    }
  });

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
