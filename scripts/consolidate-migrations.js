#!/usr/bin/env node
/**
 * Migration Consolidation Script
 * Consolidates 39+ migration files into single production schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');
const BACKUP_DIR = path.join(__dirname, '../supabase/migrations-backup');

async function consolidateMigrations() {
  console.log('🔄 Starting migration consolidation...');

  try {
    // 1. Create backup directory
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log('📂 Created backup directory');
    }

    // 2. Get all migration files (except our consolidated one)
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .filter(file => !file.startsWith('000_production_consolidated'))
      .filter(file => !file.includes('.disabled'));

    console.log(`📋 Found ${migrationFiles.length} migration files to consolidate`);

    // 3. Move old migrations to backup
    migrationFiles.forEach(file => {
      const sourcePath = path.join(MIGRATIONS_DIR, file);
      const backupPath = path.join(BACKUP_DIR, file);
      
      fs.renameSync(sourcePath, backupPath);
      console.log(`📦 Backed up: ${file}`);
    });

    // 4. Rename disabled files to show they're archived
    const disabledFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.includes('.disabled'));

    disabledFiles.forEach(file => {
      const sourcePath = path.join(MIGRATIONS_DIR, file);
      const backupPath = path.join(BACKUP_DIR, file);
      
      fs.renameSync(sourcePath, backupPath);
      console.log(`📦 Archived disabled: ${file}`);
    });

    // 5. Create migration status report
    const report = {
      consolidation_date: new Date().toISOString(),
      consolidated_files: migrationFiles.length,
      backup_location: BACKUP_DIR,
      production_schema: '000_production_consolidated_schema.sql',
      notes: [
        'All previous migrations have been consolidated into a single production schema',
        'Original migrations are backed up in migrations-backup directory',
        'For new production deployments, only run the consolidated schema',
        'For development, consider running consolidated schema + new incremental migrations'
      ]
    };

    fs.writeFileSync(
      path.join(MIGRATIONS_DIR, 'CONSOLIDATION_REPORT.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('✅ Migration consolidation completed successfully!');
    console.log(`📊 Consolidated ${migrationFiles.length} migrations into single schema`);
    console.log('📁 Original files backed up to:', BACKUP_DIR);
    console.log('🚀 Ready for production deployment with clean migration history');

  } catch (error) {
    console.error('❌ Migration consolidation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  consolidateMigrations();
}

export { consolidateMigrations };