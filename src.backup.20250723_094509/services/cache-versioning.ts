import { Redis } from 'ioredis';
import semver from 'semver';
import { logger } from '../utils/logger';

interface VersionedData<T = any> {
  data: T;
  schema: string;
  version: string;
  createdAt: number;
  migratedFrom?: string;
}

interface MigrationFunction<TFrom = any, TTo = any> {
  (data: TFrom): TTo | Promise<TTo>;
}

interface VersionMigration {
  from: string;
  to: string;
  migrate: MigrationFunction;
  rollback?: MigrationFunction;
}

interface ConflictResolution<T = any> {
  strategy: 'newest' | 'merge' | 'custom';
  resolver?: (current: T, incoming: T) => T | Promise<T>;
}

export class CacheVersioningService {
  private redis: Redis;
  private migrations: Map<string, VersionMigration[]>;
  private schemas: Map<string, any>;
  private conflictResolvers: Map<string, ConflictResolution>;
  private readonly VERSION_KEY_PREFIX = 'uai:version:';
  private readonly SCHEMA_KEY_PREFIX = 'uai:schema:';
  private readonly MIGRATION_LOG_KEY = 'uai:migrations:log';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.migrations = new Map();
    this.schemas = new Map();
    this.conflictResolvers = new Map();
  }

  registerSchema(name: string, version: string, schema: any): void {
    const key = `${name}:${version}`;
    this.schemas.set(key, schema);

    // Persist schema to Redis
    this.redis.hset(`${this.SCHEMA_KEY_PREFIX}${name}`, version, JSON.stringify(schema));
  }

  registerMigration(schemaName: string, migration: VersionMigration): void {
    if (!this.migrations.has(schemaName)) {
      this.migrations.set(schemaName, []);
    }

    const migrations = this.migrations.get(schemaName)!;

    // Validate version progression
    if (!semver.lt(migration.from, migration.to)) {
      throw new Error(`Invalid migration: ${migration.from} must be less than ${migration.to}`);
    }

    migrations.push(migration);

    // Sort migrations by version
    migrations.sort((a, b) => semver.compare(a.from, b.from));
  }

  registerConflictResolver(schemaName: string, resolution: ConflictResolution): void {
    this.conflictResolvers.set(schemaName, resolution);
  }

  async get<T>(key: string, schemaName: string, targetVersion: string): Promise<T | null> {
    const fullKey = `${this.VERSION_KEY_PREFIX}${key}`;

    try {
      const cached = await this.redis.get(fullKey);
      if (!cached) {
        return null;
      }

      const versioned: VersionedData<T> = JSON.parse(cached);

      // Check if migration is needed
      if (versioned.version !== targetVersion) {
        const migrated = await this.migrate(
          versioned.data,
          schemaName,
          versioned.version,
          targetVersion
        );

        if (migrated) {
          // Update cache with migrated version
          await this.set(key, migrated, schemaName, targetVersion);
          return migrated;
        }

        return null;
      }

      return versioned.data;
    } catch (error) {
      logger.error('Versioned cache get _error', error);
      return null;
    }
  }

  async set<T>(
    key: string,
    data: T,
    schemaName: string,
    version: string,
    ttl?: number
  ): Promise<void> {
    const fullKey = `${this.VERSION_KEY_PREFIX}${key}`;

    try {
      const versioned: VersionedData<T> = {
        data,
        schema: schemaName,
        version,
        createdAt: Date.now(),
      };

      const serialized = JSON.stringify(versioned);

      if (ttl && ttl > 0) {
        await this.redis.setex(fullKey, ttl, serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }

      // Track version usage
      await this.redis.hincrby(`${this.SCHEMA_KEY_PREFIX}${schemaName}:usage`, version, 1);
    } catch (error) {
      logger.error('Versioned cache set _error', error);
      throw error;
    }
  }

  async migrate<TFrom = any, TTo = any>(
    data: TFrom,
    schemaName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<TTo | null> {
    const migrations = this.migrations.get(schemaName);
    if (!migrations) {
      logger.warn(`No migrations found for schema: ${schemaName}`);
      return null;
    }

    try {
      // Find migration path
      const path = this.findMigrationPath(migrations, fromVersion, toVersion);
      if (!path.length) {
        logger.warn(`No migration path from ${fromVersion} to ${toVersion} for ${schemaName}`);
        return null;
      }

      let currentData: any = data;
      let currentVersion = fromVersion;

      // Apply migrations in sequence
      for (const migration of path) {
        logger.info(`Applying migration ${migration.from} -> ${migration.to} for ${schemaName}`);

        currentData = await migration.migrate(currentData);
        currentVersion = migration.to;

        // Log migration
        await this.logMigration(schemaName, migration.from, migration.to);
      }

      return currentData as TTo;
    } catch (error) {
      logger.error('Migration _error', error);
      throw error;
    }
  }

  private findMigrationPath(
    migrations: VersionMigration[],
    fromVersion: string,
    toVersion: string
  ): VersionMigration[] {
    const path: VersionMigration[] = [];
    let currentVersion = fromVersion;

    while (currentVersion !== toVersion) {
      const nextMigration = migrations.find((m) => m.from === currentVersion);

      if (!nextMigration) {
        return []; // No path found
      }

      path.push(nextMigration);
      currentVersion = nextMigration.to;

      // Check if we've reached or passed the target
      if (semver.gte(currentVersion, toVersion)) {
        break;
      }
    }

    return path;
  }

  async rollback<T>(key: string, schemaName: string, toVersion: string): Promise<T | null> {
    const fullKey = `${this.VERSION_KEY_PREFIX}${key}`;

    try {
      const cached = await this.redis.get(fullKey);
      if (!cached) {
        return null;
      }

      const versioned: VersionedData<T> = JSON.parse(cached);

      if (semver.gte(versioned.version, toVersion)) {
        logger.warn(`Cannot rollback from ${versioned.version} to ${toVersion}`);
        return null;
      }

      const migrations = this.migrations.get(schemaName);
      if (!migrations) {
        return null;
      }

      // Find rollback path
      const rollbackPath = this.findRollbackPath(migrations, versioned.version, toVersion);

      if (!rollbackPath.length) {
        logger.warn(`No rollback path from ${versioned.version} to ${toVersion}`);
        return null;
      }

      let currentData = versioned.data;

      for (const migration of rollbackPath) {
        if (!migration.rollback) {
          throw new Error(`No rollback function for ${migration.from} -> ${migration.to}`);
        }

        currentData = await migration.rollback(currentData);
      }

      // Save rolled back version
      await this.set(key, currentData, schemaName, toVersion);

      return currentData;
    } catch (error) {
      logger.error('Rollback _error', error);
      return null;
    }
  }

  private findRollbackPath(
    migrations: VersionMigration[],
    fromVersion: string,
    toVersion: string
  ): VersionMigration[] {
    // Find migrations that need to be reversed
    const forwardPath = this.findMigrationPath(migrations, toVersion, fromVersion);
    return forwardPath.reverse();
  }

  async resolveConflict<T>(
    key: string,
    schemaName: string,
    currentData: T,
    incomingData: T
  ): Promise<T> {
    const resolver = this.conflictResolvers.get(schemaName);

    if (!resolver) {
      // Default: newest wins
      return incomingData;
    }

    switch (resolver.strategy) {
      case 'newest':
        return incomingData;

      case 'merge':
        // Simple merge for objects
        if (typeof currentData === 'object' && typeof incomingData === 'object') {
          return { ...(currentData as: any), ...(incomingData as: any) };
        }
        return incomingData;

      case 'custom':
        if (resolver.resolver) {
          return await resolver.resolver(currentData, incomingData);
        }
        return incomingData;

      default:
        return incomingData;
    }
  }

  async updateIfNewer<T>(
    key: string,
    data: T,
    schemaName: string,
    version: string,
    timestamp: number
  ): Promise<boolean> {
    const fullKey = `${this.VERSION_KEY_PREFIX}${key}`;

    try {
      const cached = await this.redis.get(fullKey);

      if (cached) {
        const versioned: VersionedData<T> = JSON.parse(cached);

        // Check if incoming data is newer
        if (timestamp <= versioned.createdAt) {
          return false; // Existing data is newer
        }

        // Resolve conflict if versions differ
        if (versioned.version !== version) {
          const resolved = await this.resolveConflict(key, schemaName, versioned.data, data);

          await this.set(key, resolved, schemaName, version);
          return true;
        }
      }

      // Set new data
      await this.set(key, data, schemaName, version);
      return true;
    } catch (error) {
      logger.error('Update if newer _error', error);
      return false;
    }
  }

  private async logMigration(
    schemaName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<void> {
    const log = {
      schema: schemaName,
      from: fromVersion,
      to: toVersion,
      timestamp: Date.now(),
    };

    await this.redis.lpush(this.MIGRATION_LOG_KEY, JSON.stringify(log));

    // Keep only last 1000 migration logs
    await this.redis.ltrim(this.MIGRATION_LOG_KEY, 0, 999);
  }

  async getMigrationHistory(limit = 100): Promise<any[]> {
    const logs = await this.redis.lrange(this.MIGRATION_LOG_KEY, 0, limit - 1);
    return logs.map((log) => JSON.parse(log));
  }

  async getVersionUsage(schemaName: string): Promise<Record<string, number>> {
    const usage = await this.redis.hgetall(`${this.SCHEMA_KEY_PREFIX}${schemaName}:usage`);

    const result: Record<string, number> = {};
    for (const [version, count] of Object.entries(usage)) {
      result[version] = parseInt(count, 10);
    }

    return result;
  }

  async cleanupOldVersions(schemaName: string, keepVersions: string[]): Promise<number> {
    let cleaned = 0;

    try {
      // Find all keys for this schema
      const _pattern= `${this.VERSION_KEY_PREFIX}*`;
      const keys = await this.redis.keys(_pattern;

      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (!cached) continue;

        const versioned: VersionedData = JSON.parse(cached);

        if (versioned.schema === schemaName && !keepVersions.includes(versioned.version)) {
          await this.redis.del(key);
          cleaned++;
        }
      }

      logger.info(`Cleaned up ${cleaned} old cache entries for schema ${schemaName}`);

      return cleaned;
    } catch (error) {
      logger.error('Cleanup _error', error);
      return cleaned;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

export default CacheVersioningService;
