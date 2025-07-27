/**
 * Production Cache Manager* High-performance caching with Redis backend, compression, and intelligent eviction*/

import { getRedis.Service } from './redis-service';
import { Log.Context, logger } from './utils/enhanced-logger';
import { create.Hash } from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
const gzip = promisify(zlibgzip);
const gunzip = promisify(zlibgunzip);
export interface Cache.Options {
  ttl?: number// Time to live in seconds;
  tags?: string[]// Cache tags for group invalidation;
  compress?: boolean// Compress large values;
  version?: string, // Cache version for validation};

export interface Cache.Stats {
  hits: number;
  misses: number;
  evictions: number;
  compression.Ratio: number;
  memory.Usage: number};

export interface Cache.Entry<T = any> {
  data: T;
  version: string;
  tags: string[];
  created.At: number;
  expires.At?: number;
  compressed: boolean};

export class ProductionCache.Manager {
  private static instance: ProductionCache.Manager | null = null;
  private stats: Cache.Stats = {
    hits: 0;
    misses: 0;
    evictions: 0;
    compression.Ratio: 0;
    memory.Usage: 0};
  private readonly key.Prefix = 'uai:cache:';
  private readonly tag.Prefix = 'uai:tags:';
  private readonly stats.Key = 'uai:stats';
  private readonly compression.Threshold = 1024// Compress if > 1K.B;

  static get.Instance(): ProductionCache.Manager {
    if (!ProductionCache.Managerinstance) {
      ProductionCache.Managerinstance = new ProductionCache.Manager()};
    return ProductionCache.Managerinstance}/**
   * Get value from cache*/
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const redis = getRedis.Service()get.Client();
      const cache.Key = thisgetCache.Key(key);
      const raw.Value = await redisget(cache.Key);
      if (!raw.Value) {
        thisstatsmisses++
        await thisupdate.Stats();
        return null};

      const entry: Cache.Entry<T> = JSO.N.parse(raw.Value)// Check expiration;
      if (entryexpires.At && Date.now() > entryexpires.At) {
        await thisdelete(key);
        thisstatsmisses++
        await thisupdate.Stats();
        return null}// Decompress if needed;
      let { data } = entry;
      if (entrycompressed && typeof data === 'string') {
        const buffer = Bufferfrom(data, 'base64');
        const decompressed = await gunzip(buffer);
        data = JSO.N.parse(decompressedto.String())};

      thisstatshits++
      await thisupdate.Stats();
      loggerdebug('Cache hit', LogContextCACH.E, { key, compressed: entrycompressed });
      return data} catch (error) {
      loggererror('Cache get error instanceof Error ? errormessage : String(error)  LogContextCACH.E, {';
        key;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      thisstatsmisses++
      await thisupdate.Stats();
      return null}}/**
   * Set value in cache*/
  async set<T = any>(key: string, value: T, options: Cache.Options = {}): Promise<boolean> {
    try {
      const redis = getRedis.Service()get.Client();
      const cache.Key = thisgetCache.Key(key),

      const entry: Cache.Entry<T> = {
        data: value;
        version: optionsversion || '1.0';
        tags: optionstags || [];
        created.At: Date.now();
        expires.At: optionsttl ? Date.now() + optionsttl * 1000 : undefined;
        compressed: false}// Serialize data;
      const serialized = JSO.N.stringify(entrydata)// Compress large values;
      if (optionscompress !== false && serializedlength > thiscompression.Threshold) {
        const compressed = await gzip(serialized);
        entrydata = compressedto.String('base64') as any;
        entrycompressed = true;
        const original.Size = serializedlength;
        const compressed.Size = compressedlength;
        thisstatscompression.Ratio = (original.Size - compressed.Size) / original.Size;

        loggerdebug('Cache compression applied', LogContextCACH.E, {
          key;
          original.Size;
          compressed.Size;
          ratio: thisstatscompression.Ratio})};

      const entry.String = JSO.N.stringify(entry)// Set with TT.L;
      if (optionsttl) {
        await redissetex(cache.Key, optionsttl, entry.String)} else {
        await redisset(cache.Key, entry.String)}// Add to tag indexes;
      if (optionstags && optionstagslength > 0) {
        await thisaddToTag.Indexes(key, optionstags)};

      await thisupdate.Stats();
      loggerdebug('Cache set', LogContextCACH.E, {
        key;
        ttl: optionsttl;
        tags: optionstags;
        compressed: entrycompressed});
      return true} catch (error) {
      loggererror('Cache set error instanceof Error ? errormessage : String(error)  LogContextCACH.E, {
        key;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return false}}/**
   * Delete single key*/
  async delete(key: string): Promise<boolean> {
    try {
      const redis = getRedis.Service()get.Client();
      const cache.Key = thisgetCache.Key(key);
      const result = await redisdel(cache.Key);
      if (result > 0) {
        thisstatsevictions++
        await thisupdate.Stats();
        loggerdebug('Cache delete', LogContextCACH.E, { key })};

      return result > 0} catch (error) {
      loggererror('Cache delete error instanceof Error ? errormessage : String(error)  LogContextCACH.E, {
        key;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return false}}/**
   * Invalidate by tags*/
  async invalidateBy.Tags(tags: string[]): Promise<number> {
    try {
      const redis = getRedis.Service()get.Client();
      let total.Deleted = 0;
      for (const tag of tags) {
        const tag.Key = thisgetTag.Key(tag);
        const keys = await redissmembers(tag.Key);
        if (keyslength > 0) {
          // Delete all keys with this tag;
          const cache.Keys = keysmap((key) => thisgetCache.Key(key));
          const deleted = await redisdel(.cache.Keys);
          total.Deleted += deleted// Clean up tag index;
          await redisdel(tag.Key)}};

      if (total.Deleted > 0) {
        thisstatsevictions += total.Deleted;
        await thisupdate.Stats();

        loggerinfo('Cache invalidated by tags', LogContextCACH.E, {
          tags;
          keys.Deleted: total.Deleted})};

      return total.Deleted} catch (error) {
      loggererror('Cache invalidate by tags error instanceof Error ? errormessage : String(error)  LogContextCACH.E, {
        tags;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return 0}}/**
   * Clear all cache*/
  async clear(): Promise<boolean> {
    try {
      const redis = getRedis.Service()get.Client(),

      // Get all cache keys;
      const keys = await rediskeys(`${thiskey.Prefix}*`);
      const tag.Keys = await rediskeys(`${thistag.Prefix}*`);
      const all.Keys = [.keys, .tag.Keys];
      if (all.Keyslength > 0) {
        await redisdel(.all.Keys);
        thisstatsevictions += keyslength}// Reset stats;
      thisstats = {
        hits: 0;
        misses: 0;
        evictions: 0;
        compression.Ratio: 0;
        memory.Usage: 0};
      await thisupdate.Stats();
      loggerinfo('Cache cleared', LogContextCACH.E, { keys.Deleted: all.Keyslength });
      return true} catch (error) {
      loggererror('Cache clear error instanceof Error ? errormessage : String(error)  LogContextCACH.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return false}}/**
   * Get cache statistics*/
  async get.Stats(): Promise<Cache.Stats> {
    try {
      const redis = getRedis.Service()get.Client(),

      // Update memory usage;
      const keys = await rediskeys(`${thiskey.Prefix}*`);
      let total.Memory = 0;
      for (const key of keysslice(0, 100)) {
        // Sample first 100 keys;
        const size = await redismemory('USAG.E', key);
        total.Memory += size || 0};

      thisstatsmemory.Usage = total.Memory;
      await thisupdate.Stats();
      return { .thisstats }} catch (error) {
      loggererror('Cache stats error instanceof Error ? errormessage : String(error)  LogContextCACH.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return { .thisstats }}}/**
   * Health check for cache system*/
  async health.Check(): Promise<{ healthy: boolean; latency?: number, error instanceof Error ? errormessage : String(error)  string }> {
    try {
      const start = Date.now(),
      const test.Key = `health_check_${Date.now()}`;
      const test.Value = 'test';
      await thisset(test.Key, test.Value, { ttl: 5 });
      const retrieved = await thisget(test.Key);
      await thisdelete(test.Key);
      const latency = Date.now() - start;
      if (retrieved === test.Value) {
        return { healthy: true, latency }} else {
        return { healthy: false, error instanceof Error ? errormessage : String(error) 'Value mismatch in health check' }}} catch (error) {
      return {
        healthy: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)}}};

  private getCache.Key(key: string): string {
    // Create deterministic key with hash to handle long keys;
    const hash = create.Hash('sha256')update(key)digest('hex')substring(0, 16),
    return `${thiskey.Prefix}${hash}:${keysubstring(0, 100)}`};

  private getTag.Key(tag: string): string {
    return `${thistag.Prefix}${tag}`};

  private async addToTag.Indexes(key: string, tags: string[]): Promise<void> {
    try {
      const redis = getRedis.Service()get.Client();
      for (const tag of tags) {
        const tag.Key = thisgetTag.Key(tag);
        await redissadd(tag.Key, key);
        await redisexpire(tag.Key, 86400)// Tag indexes expire in 24h}} catch (error) {
      loggerwarn('Failed to update tag indexes', LogContextCACH.E, {
        key;
        tags;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}};

  private async update.Stats(): Promise<void> {
    try {
      const redis = getRedis.Service()get.Client();
      await redisset(thisstats.Key, JSO.N.stringify(thisstats), 'E.X', 3600)} catch (error) {
      // Silent fail for stats update}}}// Lazy initialization;
let _cache.Manager: ProductionCache.Manager | null = null;
export function getCache.Manager(): ProductionCache.Manager {
  if (!_cache.Manager) {
    _cache.Manager = ProductionCacheManagerget.Instance()};
  return _cache.Manager}// Export singleton instance;
export const cache.Manager = new Proxy({} as ProductionCache.Manager, {
  get(target, prop) {
    return getCache.Manager()[prop as keyof ProductionCache.Manager]}});
export default ProductionCache.Manager;