#!/usr/bin/env node
import { program } from 'commander';
import { createClient } from '@supabase/supabase-js';
import { DatabaseMigrationService } from '../services/database-migration';
import { config } from '../config';
import chalk from 'chalk';
import ora from 'ora';

// Initialize Supabase client with service role key for migrations
const supabase = createClient(
  config.supabase.url,
  process.env.SUPABASE_SERVICE_KEY || '',
  {
    auth: {
      persistSession: false
    }
  }
);

const migrationService = new DatabaseMigrationService(supabase);

program
  .name('migrate')
  .description('Database migration tool for Universal AI Tools')
  .version('1.0.0');

program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    const spinner = ora('Checking migration status...').start();
    
    try {
      const status = await migrationService.getStatus();
      spinner.succeed('Migration status retrieved');
      
      console.log(chalk.bold('\n📊 Migration Status'));
      console.log(chalk.gray('='.repeat(50)));
      
      console.log(chalk.green(`\n✅ Applied Migrations (${status.applied.length}):`));
      if (status.applied.length > 0) {
        status.applied.forEach(m => {
          console.log(`  - ${m.name} (${new Date(m.applied_at!).toLocaleString()})`);
        });
      } else {
        console.log(chalk.gray('  No migrations applied yet'));
      }
      
      console.log(chalk.yellow(`\n⏳ Pending Migrations (${status.pending.length}):`));
      if (status.pending.length > 0) {
        status.pending.forEach(m => {
          console.log(`  - ${m.name}`);
        });
      } else {
        console.log(chalk.gray('  All migrations are up to date'));
      }
      
      if (status.conflicts.length > 0) {
        console.log(chalk.red(`\n❌ Conflicts (${status.conflicts.length}):`));
        status.conflicts.forEach(m => {
          console.log(`  - ${m.name} (checksum mismatch)`);
        });
      }
    } catch (error) {
      spinner.fail('Failed to get migration status');
      console.error(error);
      process.exit(1);
    }
  });

program
  .command('up')
  .description('Run all pending migrations')
  .option('-d, --dry-run', 'Show what would be migrated without applying')
  .action(async (options) => {
    const spinner = ora('Preparing migrations...').start();
    
    try {
      if (options.dryRun) {
        spinner.text = 'Checking pending migrations...';
        const status = await migrationService.getStatus();
        spinner.succeed('Dry run complete');
        
        if (status.pending.length === 0) {
          console.log(chalk.green('\n✅ No pending migrations'));
        } else {
          console.log(chalk.yellow(`\n📋 Would apply ${status.pending.length} migrations:`));
          status.pending.forEach(m => {
            console.log(`  - ${m.name}`);
          });
        }
      } else {
        spinner.text = 'Running migrations...';
        const count = await migrationService.runPendingMigrations();
        
        if (count > 0) {
          spinner.succeed(`Applied ${count} migrations successfully`);
        } else {
          spinner.succeed('No pending migrations');
        }
      }
    } catch (error) {
      spinner.fail('Migration failed');
      console.error(error);
      process.exit(1);
    }
  });

program
  .command('down')
  .description('Rollback the last migration')
  .action(async () => {
    const spinner = ora('Rolling back last migration...').start();
    
    try {
      await migrationService.rollbackLast();
      spinner.succeed('Rollback completed');
    } catch (error) {
      spinner.fail('Rollback failed');
      console.error(error);
      process.exit(1);
    }
  });

program
  .command('create <name>')
  .description('Create a new migration file')
  .action(async (name) => {
    const spinner = ora('Creating migration...').start();
    
    try {
      const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name TEXT NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Remember to add indexes if needed:
-- CREATE INDEX idx_example_name ON example(name);

-- Add any necessary permissions:
-- GRANT SELECT ON example TO authenticated;
`;
      
      const filename = await migrationService.createMigration(name, template);
      spinner.succeed(`Created migration: ${filename}`);
      console.log(chalk.gray(`\nEdit the migration file at: supabase/migrations/${filename}`));
    } catch (error) {
      spinner.fail('Failed to create migration');
      console.error(error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate migration files and checksums')
  .action(async () => {
    const spinner = ora('Validating migrations...').start();
    
    try {
      const isValid = await migrationService.validate();
      
      if (isValid) {
        spinner.succeed('All migrations are valid');
      } else {
        spinner.fail('Migration validation failed');
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Validation error');
      console.error(error);
      process.exit(1);
    }
  });

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse(process.argv);