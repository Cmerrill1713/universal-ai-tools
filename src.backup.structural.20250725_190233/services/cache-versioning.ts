import { Redis } from 'ioredis';
import semver from 'semver';
import { logger } from '../utils/logger';
interface VersionedData<T = any> {;
  data: T;
  schema: string;
  version: string;
  createdAt: number;
  migratedFrom?: string;
};

interface MigrationFunction<TFrom = any, TTo = any> {;
  (data: TFrom): TTo | Promise<TTo>;
};

interface VersionMigration {;
  from: string;
  to: string;
  migrate: MigrationFunction;
  rollback?: MigrationFunction;
};

interface ConflictResolution<T = any> {;
  strategy: 'newest' | 'merge' | 'custom';
  resolver?: (current: T, incoming: T) => T | Promise<T>;
};

export class CacheVersioningService {;
  private redis: Redis;
  private migrations: Map<string, VersionMigration[]>;
  private schemas: Map<string, any>;
  private conflictResolvers: Map<string, ConflictResolution>;
  private readonly VERSION_KEY_PREFIX = 'uai: version:';
  private readonly SCHEMA_KEY_PREFIX = 'uai:schema:';
  private readonly MIGRATION_LOG_KEY = 'uai:migrations:log';
  constructor(redisUrl: string) {;
    thisredis = new Redis(redisUrl);
    thismigrations = new Map();
    thisschemas = new Map();
    thisconflictResolvers = new Map();
};

  registerSchema(name: string, version: string, schema: any): void {;
    const key = `${name}:${version}`;
    thisschemasset(key, schema);
    // Persist schema to Redis;
    thisredishset(`${thisSCHEMA_KEY_PREFIX}${name}`, version, JSONstringify(schema));
  };

  registerMigration(schemaName: string, migration: VersionMigration): void {;
    if (!thismigrationshas(schemaName)) {;
      thismigrationsset(schemaName, [])};

    const migrations = thismigrationsget(schemaName)!;
    // Validate version progression;
    if (!semverlt(migrationfrom, migrationto)) {;
      throw new Error(`Invalid migration: ${migrationfrom} must be less than ${migrationto}`);
    };

    migrationspush(migration);
    // Sort migrations by version;
    migrationssort((a, b) => semvercompare(afrom, bfrom));
  };

  registerConflictResolver(schemaName: string, resolution: ConflictResolution): void {;
    thisconflictResolversset(schemaName, resolution)};

  async get<T>(key: string, schemaName: string, targetVersion: string): Promise<T | null> {;
    const fullKey = `${thisVERSION_KEY_PREFIX}${key}`;
    try {;
      const cached = await thisredisget(fullKey);
      if (!cached) {;
        return null};

      const versioned: VersionedData<T> = JSONparse(cached);
      // Check if migration is needed;
      if (versionedversion !== targetVersion) {;
        const migrated = await thismigrate(;
          versioneddata;
          schemaName;
          versionedversion;
          targetVersion;
        );
        if (migrated) {;
          // Update cache with migrated version;
          await thisset(key, migrated, schemaName, targetVersion);
          return migrated};

        return null;
      };

      return versioneddata;
    } catch (error) {;
      loggererror('Versioned cache get error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
      return null};
  };

  async set<T>(;
    key: string;
    data: T;
    schemaName: string;
    version: string;
    ttl?: number;
  ): Promise<void> {;
    const fullKey = `${thisVERSION_KEY_PREFIX}${key}`;
    try {;
      const versioned: VersionedData<T> = {;
        data;
        schema: schemaName;
        version;
        createdAt: Datenow();
};
      const serialized = JSONstringify(versioned);
      if (ttl && ttl > 0) {;
        await thisredissetex(fullKey, ttl, serialized)} else {;
        await thisredisset(fullKey, serialized)};

      // Track version usage;
      await thisredishincrby(`${thisSCHEMA_KEY_PREFIX}${schemaName}:usage`, version, 1);
    } catch (error) {;
      loggererror('Versioned cache set error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)};
  };

  async migrate<TFrom = any, TTo = any>(;
    data: TFrom;
    schemaName: string;
    fromVersion: string;
    toVersion: string;
  ): Promise<TTo | null> {;
    const migrations = thismigrationsget(schemaName),;
    if (!migrations) {;
      loggerwarn(`No migrations found for schema: ${schemaName}`);
      return null;
    };

    try {;
      // Find migration path;
      const path = thisfindMigrationPath(migrations, fromVersion, toVersion),;
      if (!pathlength) {;
        loggerwarn(`No migration path from ${fromVersion} to ${toVersion} for ${schemaName}`);
        return null;
      };

      let currentData: any = data;
      let currentVersion = fromVersion;
      // Apply migrations in sequence;
      for (const migration of path) {;
        loggerinfo(`Applying migration ${migrationfrom} -> ${migrationto} for ${schemaName}`);
        currentData = await migrationmigrate(currentData);
        currentVersion = migrationto;
        // Log migration;
        await thislogMigration(schemaName, migrationfrom, migrationto);
      };

      return currentData as TTo;
    } catch (error) {;
      loggererror('Migration error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)};
  };

  private findMigrationPath(;
    migrations: VersionMigration[];
    fromVersion: string;
    toVersion: string;
  ): VersionMigration[] {;
    const path: VersionMigration[] = [];
    let currentVersion = fromVersion;
    while (currentVersion !== toVersion) {;
      const nextMigration = migrationsfind((m) => mfrom === currentVersion);
      if (!nextMigration) {;
        return []; // No path found};

      pathpush(nextMigration);
      currentVersion = nextMigrationto;
      // Check if we've reached or passed the target;
      if (semvergte(currentVersion, toVersion)) {;
        break};
    };

    return path;
  };

  async rollback<T>(key: string, schemaName: string, toVersion: string): Promise<T | null> {;
    const fullKey = `${thisVERSION_KEY_PREFIX}${key}`;
    try {;
      const cached = await thisredisget(fullKey);
      if (!cached) {;
        return null};

      const versioned: VersionedData<T> = JSONparse(cached);
      if (semvergte(versionedversion, toVersion)) {;
        loggerwarn(`Cannot rollback from ${versionedversion} to ${toVersion}`);
        return null;
      };

      const migrations = thismigrationsget(schemaName);
      if (!migrations) {;
        return null};

      // Find rollback path;
      const rollbackPath = thisfindRollbackPath(migrations, versionedversion, toVersion);
      if (!rollbackPathlength) {;
        loggerwarn(`No rollback path from ${versionedversion} to ${toVersion}`);
        return null;
      };

      let currentData = versioneddata;
      for (const migration of rollbackPath) {;
        if (!migrationrollback) {;
          throw new Error(`No rollback function for ${migrationfrom} -> ${migrationto}`);
        };

        currentData = await migrationrollback(currentData);
      };

      // Save rolled back version;
      await thisset(key, currentData, schemaName, toVersion);
      return currentData;
    } catch (error) {;
      loggererror('Rollback error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
      return null};
  };

  private findRollbackPath(;
    migrations: VersionMigration[];
    fromVersion: string;
    toVersion: string;
  ): VersionMigration[] {;
    // Find migrations that need to be reversed;
    const forwardPath = thisfindMigrationPath(migrations, toVersion, fromVersion);
    return forwardPathreverse()};

  async resolveConflict<T>(;
    key: string;
    schemaName: string;
    currentData: T;
    incomingData: T;
  ): Promise<T> {;
    const resolver = thisconflictResolversget(schemaName);
    if (!resolver) {;
      // Default: newest wins;
      return incomingData};

    switch (resolverstrategy) {;
      case 'newest':;
        return incomingData,;

      case 'merge':;
        // Simple merge for objects;
        if (typeof currentData === 'object' && typeof incomingData === 'object') {;
          return { ...(currentData as any), ...(incomingData as any) };
        };
        return incomingData;
      case 'custom':;
        if (resolverresolver) {;
          return await resolverresolver(currentData, incomingData)};
        return incomingData;
      default:;
        return incomingData;
    };
  };

  async updateIfNewer<T>(;
    key: string;
    data: T;
    schemaName: string;
    version: string;
    timestamp: number;
  ): Promise<boolean> {;
    const fullKey = `${thisVERSION_KEY_PREFIX}${key}`;
    try {;
      const cached = await thisredisget(fullKey);
      if (cached) {;
        const versioned: VersionedData<T> = JSONparse(cached);
        // Check if incoming data is newer;
        if (timestamp <= versionedcreatedAt) {;
          return false; // Existing data is newer};

        // Resolve conflict if versions differ;
        if (versionedversion !== version) {;
          const resolved = await thisresolveConflict(key, schemaName, versioneddata, data);
          await thisset(key, resolved, schemaName, version);
          return true};
      };

      // Set new data;
      await thisset(key, data, schemaName, version);
      return true;
    } catch (error) {;
      loggererror('Update if newer error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
      return false};
  };

  private async logMigration(;
    schemaName: string;
    fromVersion: string;
    toVersion: string;
  ): Promise<void> {;
    const log = {;
      schema: schemaName;
      from: fromVersion;
      to: toVersion;
      timestamp: Datenow()};
    await thisredislpush(thisMIGRATION_LOG_KEY, JSONstringify(log));
    // Keep only last 1000 migration logs;
    await thisredisltrim(thisMIGRATION_LOG_KEY, 0, 999);
  };

  async getMigrationHistory(limit = 100): Promise<any[]> {;
    const logs = await thisredislrange(thisMIGRATION_LOG_KEY, 0, limit - 1);
    return logsmap((log) => JSONparse(log))};

  async getVersionUsage(schemaName: string): Promise<Record<string, number>> {;
    const usage = await thisredishgetall(`${thisSCHEMA_KEY_PREFIX}${schemaName}:usage`);
    const result: Record<string, number> = {};
    for (const [version, count] of Objectentries(usage)) {;
      result[version] = parseInt(count, 10)};

    return result;
  };

  async cleanupOldVersions(schemaName: string, keepVersions: string[]): Promise<number> {;
    let cleaned = 0,;

    try {;
      // Find all keys for this schema;
      const _pattern= `${thisVERSION_KEY_PREFIX}*`;
      const keys = await thisrediskeys(_pattern;
      for (const key of keys) {;
        const cached = await thisredisget(key);
        if (!cached) continue;
        const versioned: VersionedData = JSONparse(cached);
        if (versionedschema === schemaName && !keepVersionsincludes(versionedversion)) {;
          await thisredisdel(key);
          cleaned++};
      };

      loggerinfo(`Cleaned up ${cleaned} old cache entries for schema ${schemaName}`);
      return cleaned;
    } catch (error) {;
      loggererror('Cleanup error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
      return cleaned};
  };

  async disconnect(): Promise<void> {;
    await thisredisdisconnect();
};
};

export default CacheVersioningService;