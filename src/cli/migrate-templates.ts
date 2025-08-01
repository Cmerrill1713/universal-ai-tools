#!/usr/bin/env node

/**
 * Template Migration CLI - Migrate templates and assets to Supabase
 * Usage: npm run migrate:templates [options]
 */

import { Command } from 'commander';
import { templateMigrationService } from '@/services/template-migration-service';
import { LogContext, log } from '@/utils/logger';

const program = new Command();

program
  .name('migrate-templates')
  .description('Migrate templates and assets to Supabase storage')
  .version('1.0.0');

program
  .command('stats')
  .description('Show migration statistics and recommendations')
  .action(async () => {
    try {
      console.log('📊 Analyzing project for migration opportunities...\n');
      
      const stats = await templateMigrationService.getMigrationStats();
      
      console.log('=== MIGRATION STATISTICS ===');
      console.log(`Total Potential Savings: ${(stats.totalPotentialSavings / 1024 / 1024).toFixed(2)} MB\n`);
      
      if (stats.largestDirectories.length > 0) {
        console.log('Largest Directories:');
        stats.largestDirectories.forEach(dir => {
          const sizeMB = (dir.size / 1024 / 1024).toFixed(2);
          console.log(`  📁 ${dir.path} - ${sizeMB} MB`);
        });
        console.log();
      }
      
      if (stats.recommendedActions.length > 0) {
        console.log('Recommended Actions:');
        stats.recommendedActions.forEach((action, index) => {
          console.log(`  ${index + 1}. ${action}`);
        });
        console.log();
      }
      
      console.log('Run specific migration commands to clean up space:');
      console.log('  npm run migrate:templates prp       # Migrate PRP templates');
      console.log('  npm run migrate:templates enterprise # Migrate enterprise templates');
      console.log('  npm run migrate:templates archive    # Archive large assets');
      console.log('  npm run migrate:templates cleanup    # Clean up backup directories');
      console.log('  npm run migrate:templates all        # Run all migrations');
      
    } catch (error) {
      console.error('❌ Failed to generate migration stats:', error);
      process.exit(1);
    }
  });

program
  .command('prp')
  .description('Migrate PRP templates to Supabase')
  .action(async () => {
    try {
      console.log('🚀 Migrating PRP templates to Supabase...\n');
      
      const result = await templateMigrationService.migratePRPTemplates();
      
      if (result.success) {
        console.log('✅ PRP template migration completed successfully!');
        console.log(`📁 Migrated ${result.migratedFiles} files`);
        console.log(`💾 Space saved: ${(result.spaceSaved / 1024).toFixed(2)} KB`);
        
        if (result.errors.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.errors.forEach(error => console.log(`  • ${error}`));
        }
      } else {
        console.log('❌ PRP template migration failed:');
        result.errors.forEach(error => console.log(`  • ${error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  });

program
  .command('enterprise')
  .description('Migrate enterprise templates to Supabase')
  .action(async () => {
    try {
      console.log('🏢 Migrating enterprise templates to Supabase...\n');
      
      const result = await templateMigrationService.migrateEnterpriseTemplates();
      
      if (result.success) {
        console.log('✅ Enterprise template migration completed successfully!');
        console.log(`📁 Migrated ${result.migratedFiles} files`);
        console.log(`💾 Space saved: ${(result.spaceSaved / 1024).toFixed(2)} KB`);
        
        if (result.errors.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.errors.forEach(error => console.log(`  • ${error}`));
        }
      } else {
        console.log('❌ Enterprise template migration failed:');
        result.errors.forEach(error => console.log(`  • ${error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  });

program
  .command('commands')
  .description('Migrate Claude commands to Supabase database')
  .action(async () => {
    try {
      console.log('⚡ Migrating Claude commands to Supabase...\n');
      
      const result = await templateMigrationService.migrateClaudeCommands();
      
      if (result.success) {
        console.log('✅ Claude command migration completed successfully!');
        console.log(`📁 Migrated ${result.migratedFiles} commands`);
        console.log(`💾 Space saved: ${(result.spaceSaved / 1024).toFixed(2)} KB`);
        
        if (result.errors.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.errors.forEach(error => console.log(`  • ${error}`));
        }
      } else {
        console.log('❌ Claude command migration failed:');
        result.errors.forEach(error => console.log(`  • ${error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  });

program
  .command('archive')
  .description('Archive large assets (screenshots, logs) to Supabase')
  .option('--preserve-local', 'Keep local files after archiving')
  .option('--age-days <days>', 'Archive files older than N days', '7')
  .action(async (options) => {
    try {
      console.log('📦 Archiving large assets to Supabase...\n');
      
      const migrationOptions = {
        preserveLocal: options.preserveLocal || false,
        ageLimitDays: parseInt(options.ageDays) || 7
      };
      
      const result = await templateMigrationService.archiveLargeAssets(migrationOptions);
      
      if (result.success) {
        console.log('✅ Large asset archival completed successfully!');
        console.log(`📁 Archived ${result.migratedFiles} files`);
        console.log(`💾 Space saved: ${(result.spaceSaved / 1024 / 1024).toFixed(2)} MB`);
        
        if (!options.preserveLocal) {
          console.log('🗑️  Local files were removed after archival');
        }
        
        return undefined;
        
        return undefined;
        
        if (result.errors.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.errors.forEach(error => console.log(`  • ${error}`));
        }
      } else {
        console.log('❌ Asset archival failed:');
        result.errors.forEach(error => console.log(`  • ${error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Archival failed:', error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Clean up backup directories and temporary files')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (options) => {
    try {
      if (options.dryRun) {
        console.log('🔍 Dry run: Analyzing backup directories...\n');
      } else {
        console.log('🧹 Cleaning up backup directories...\n');
        console.log('⚠️  WARNING: This will permanently delete backup files!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
        
        // Wait 5 seconds for user to cancel
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      const result = await templateMigrationService.cleanupBackupDirectories();
      
      if (result.success) {
        console.log('✅ Backup cleanup completed successfully!');
        console.log(`🗑️  Removed ${result.migratedFiles} items`);
        console.log(`💾 Space freed: ${(result.spaceSaved / 1024 / 1024).toFixed(2)} MB`);
        
        if (result.errors.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.errors.forEach(error => console.log(`  • ${error}`));
        }
      } else {
        console.log('❌ Backup cleanup failed:');
        result.errors.forEach(error => console.log(`  • ${error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  });

program
  .command('all')
  .description('Run all migrations (templates, commands, archive, cleanup)')
  .option('--preserve-local', 'Keep local files after archiving')
  .option('--age-days <days>', 'Archive files older than N days', '7')
  .action(async (options) => {
    try {
      console.log('🚀 Running complete migration suite...\n');
      
      const results = [];
      
      // 1. Migrate PRP templates
      console.log('1️⃣ Migrating PRP templates...');
      const prpResult = await templateMigrationService.migratePRPTemplates();
      results.push({ name: 'PRP Templates', result: prpResult });
      
      // 2. Migrate enterprise templates
      console.log('2️⃣ Migrating enterprise templates...');
      const enterpriseResult = await templateMigrationService.migrateEnterpriseTemplates();
      results.push({ name: 'Enterprise Templates', result: enterpriseResult });
      
      // 3. Migrate Claude commands
      console.log('3️⃣ Migrating Claude commands...');
      const commandsResult = await templateMigrationService.migrateClaudeCommands();
      results.push({ name: 'Claude Commands', result: commandsResult });
      
      // 4. Archive large assets
      console.log('4️⃣ Archiving large assets...');
      const migrationOptions = {
        preserveLocal: options.preserveLocal || false,
        ageLimitDays: parseInt(options.ageDays) || 7
      };
      const archiveResult = await templateMigrationService.archiveLargeAssets(migrationOptions);
      results.push({ name: 'Large Assets', result: archiveResult });
      
      // 5. Cleanup backups
      console.log('5️⃣ Cleaning up backups...');
      const cleanupResult = await templateMigrationService.cleanupBackupDirectories();
      results.push({ name: 'Backup Cleanup', result: cleanupResult });
      
      // Summary
      console.log('\n=== MIGRATION COMPLETE ===\n');
      
      let totalFiles = 0;
      let totalSpaceSaved = 0;
      let totalErrors = 0;
      
      results.forEach(({ name, result }) => {
        const status = result.success ? '✅' : '❌';
        const spaceMB = (result.spaceSaved / 1024 / 1024).toFixed(2);
        
        console.log(`${status} ${name}:`);
        console.log(`   Files: ${result.migratedFiles}`);
        console.log(`   Space: ${spaceMB} MB`);
        console.log(`   Errors: ${result.errors.length}`);
        
        totalFiles += result.migratedFiles;
        totalSpaceSaved += result.spaceSaved;
        totalErrors += result.errors.length;
        
        if (result.errors.length > 0) {
          result.errors.forEach(error => console.log(`     • ${error}`));
        }
        console.log();
      });
      
      console.log('=== TOTALS ===');
      console.log(`📁 Total files processed: ${totalFiles}`);
      console.log(`💾 Total space saved: ${(totalSpaceSaved / 1024 / 1024).toFixed(2)} MB`);
      console.log(`⚠️  Total errors: ${totalErrors}`);
      
      if (totalErrors > 0) {
        console.log('\n⚠️  Some migrations had errors. Review the details above.');
        process.exit(1);
      } else {
        console.log('\n🎉 All migrations completed successfully!');
      }
      
    } catch (error) {
      console.error('❌ Complete migration failed:', error);
      process.exit(1);
    }
  });

// Handle unrecognized commands
program.on('command:*', () => {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}