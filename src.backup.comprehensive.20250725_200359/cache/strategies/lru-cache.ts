import { Event.Emitter } from 'events';
import { logger } from '././utils/logger';
interface Cache.Entry<T> {
  key: string,
  value: T,
  size: number,
  accessed: number,
  created: number,
}
interface LRU.Cache.Options {
  max.Size?: number;
  max.Items?: number;
  ttl?: number;
  on.Evict?: (key: string, value: any) => void,
}
export class LR.U.Cache<T = any> extends Event.Emitter {
  private cache: Map<string, Cache.Entry<T>>
  private max.Size: number,
  private max.Items: number,
  private current.Size: number,
  private ttl: number,
  private on.Evict?: (key: string, value: any) => void,
  constructor(options: LRU.Cache.Options = {}) {
    super();
    this.cache = new Map();
    thismax.Size = optionsmax.Size || 100 * 1024 * 1024// 100M.B default;
    thismax.Items = optionsmax.Items || 10000;
    thisttl = optionsttl || 0// 0 means no T.T.L;
    thiscurrent.Size = 0;
    thison.Evict = optionson.Evict;

  private calculate.Size(value: T): number {
    if (typeof value === 'string') {
      return valuelength * 2// Approximate U.T.F-16 size} else if (Bufferis.Buffer(value)) {
      return valuelength} else {
      // Rough estimate for objects;
      return JS.O.N.stringify(value)length * 2};

  private evictL.R.U(): void {
    let oldest.Key: string | null = null,
    let oldest.Accessed = Infinity// Find least recently used item;
    for (const [key, entry] of this.cacheentries()) {
      if (entryaccessed < oldest.Accessed) {
        oldest.Accessed = entryaccessed;
        oldest.Key = key};

    if (oldest.Key) {
      thisdelete(oldest.Key)};

  private make.Space(required.Size: number): void {
    // Evict items until we have enough space;
    while (
      (thiscurrent.Size + required.Size > thismax.Size || this.cachesize >= thismax.Items) &&
      this.cachesize > 0) {
      thisevictL.R.U();
    };

  private is.Expired(entry: Cache.Entry<T>): boolean {
    if (thisttl <= 0) return false;
    return Date.now() - entrycreated > thisttl * 1000;

  get(key: string): T | undefined {
    const entry = this.cacheget(key);
    if (!entry) {
      thisemit('miss', key);
      return undefined}// Check if expired;
    if (thisis.Expired(entry)) {
      thisdelete(key);
      thisemit('miss', key);
      return undefined}// Update access time and move to end (most recent);
    entryaccessed = Date.now();
    this.cachedelete(key);
    this.cacheset(key, entry);
    thisemit('hit', key);
    return entryvalue;

  set(key: string, value: T): void {
    const size = thiscalculate.Size(value)// Check if single item is too large;
    if (size > thismax.Size) {
      loggerwarn(`Item ${key} is too large (${size} bytes) for cache`);
      return}// Remove existing entry if present;
    if (this.cachehas(key)) {
      thisdelete(key)}// Make space for new item;
    thismake.Space(size);
    const entry: Cache.Entry<T> = {
      key;
      value;
      size;
      accessed: Date.now(),
      created: Date.now(),
}    this.cacheset(key, entry);
    thiscurrent.Size += size;
    thisemit('set', key, value);

  delete(key: string): boolean {
    const entry = this.cacheget(key);
    if (!entry) {
      return false;

    this.cachedelete(key);
    thiscurrent.Size -= entrysize;
    if (thison.Evict) {
      thison.Evict(key, entryvalue);

    thisemit('evict', key, entryvalue);
    return true;

  has(key: string): boolean {
    const entry = this.cacheget(key);
    if (!entry) return false// Check expiration;
    if (thisis.Expired(entry)) {
      thisdelete(key);
      return false;

    return true;

  clear(): void {
    for (const [key, entry] of this.cacheentries()) {
      if (thison.Evict) {
        thison.Evict(key, entryvalue)};

    this.cacheclear();
    thiscurrent.Size = 0;
    thisemit('clear');

  size(): number {
    return this.cachesize;

  size.Bytes(): number {
    return thiscurrent.Size;

  keys(): string[] {
    return Arrayfrom(this.cachekeys());

  values(): T[] {
    const values: T[] = [],
    for (const entry of this.cachevalues()) {
      if (!thisis.Expired(entry)) {
        valuespush(entryvalue)};

    return values;

  entries(): Array<[string, T]> {
    const entries: Array<[string, T]> = [];
    for (const [key, entry] of this.cacheentries()) {
      if (!thisis.Expired(entry)) {
        entriespush([key, entryvalue])};

    return entries;

  prune(): number {
    let pruned = 0;
    for (const [key, entry] of this.cacheentries()) {
      if (thisis.Expired(entry)) {
        thisdelete(key);
        pruned++};

    return pruned;

  resize(max.Size: number, max.Items: number): void {
    thismax.Size = max.Size;
    thismax.Items = max.Items// Evict items if necessary;
    while (
      (thiscurrent.Size > thismax.Size || this.cachesize > thismax.Items) &&
      this.cachesize > 0) {
      thisevictL.R.U();
    };

  get.Stats(): {
    items: number,
    size: number,
    max.Items: number,
    max.Size: number,
    hit.Rate: number} {
    const hits = thislistener.Count('hit');
    const misses = thislistener.Count('miss');
    const total = hits + misses;
    return {
      items: this.cachesize,
      size: thiscurrent.Size,
      max.Items: thismax.Items,
      max.Size: thismax.Size,
      hit.Rate: total > 0 ? hits / total : 0,
    }}// Iterate in L.R.U order (oldest first)*lru.Iterator(): Iterable.Iterator<[string, T]> {
    const entries = Arrayfrom(this.cacheentries())sort((a, b) => a[1]accessed - b[1]accessed);
    for (const [key, entry] of entries) {
      if (!thisis.Expired(entry)) {
        yield [key, entryvalue]}}}// Iterate in M.R.U order (newest first)*mru.Iterator(): Iterable.Iterator<[string, T]> {
    const entries = Arrayfrom(this.cacheentries())sort((a, b) => b[1]accessed - a[1]accessed);
    for (const [key, entry] of entries) {
      if (!thisis.Expired(entry)) {
        yield [key, entryvalue]}}};

export default LR.U.Cache;