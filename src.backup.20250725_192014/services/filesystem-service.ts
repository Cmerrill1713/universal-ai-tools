import { promises as fs } from 'fs';
import path from 'path';
import { Event.Emitter } from 'events';
import type { FS.Watcher } from 'chokidar';
import { watch } from 'chokidar';
import crypto from 'crypto';
import type { Supabase.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger';
import { FileManager.Agent } from './agents/personal/file_manager_agent';
import { z } from 'zod'// Pydantic-style models using Zod;
const FileMetadata.Schema = zobject({
  path: zstring();
  name: zstring();
  size: znumber();
  type: zenum(['file', 'directory', 'symlink']);
  mime.Type: zstring()optional();
  extension: zstring()optional();
  created.At: zdate();
  modified.At: zdate();
  accessed.At: zdate();
  permissions: zobject({
    readable: zboolean();
    writable: zboolean();
    executable: zboolean()});
  hash: zstring()optional();
  is.Hidden: zboolean()});
const FileOperation.Schema = zobject({
  id: zstring();
  type: zenum(['read', 'write', 'delete', 'move', 'copy', 'mkdir', 'chmod']);
  source.Path: zstring();
  target.Path: zstring()optional();
  contentzstring()optional();
  metadata: FileMetadata.Schemaoptional();
  agent.Id: zstring();
  user.Id: zstring();
  status: zenum(['pending', 'in_progress', 'completed', 'failed']);
  error instanceof Error ? errormessage : String(error) zstring()optional();
  started.At: zdate();
  completed.At: zdate()optional()});
const DirectoryTree.Schema = zobject({
  path: zstring();
  name: zstring();
  type: zliteral('directory');
  children: zarray(zlazy(() => FileTreeNode.Schema));
  expanded: zboolean()default(false)});
const FileTreeNode.Schema = zunion([FileMetadata.Schema, DirectoryTree.Schema]);
type File.Metadata = zinfer<typeof FileMetadata.Schema>
type File.Operation = zinfer<typeof FileOperation.Schema>
type Directory.Tree = zinfer<typeof DirectoryTree.Schema>
type FileTree.Node = zinfer<typeof FileTreeNode.Schema>
// a2a (Agent-to-Agent) Protocol;
interface A2A.Message {
  from: string;
  to: string;
  type: 'request| 'response' | 'event';
  action: string;
  payload: any;
  correlation.Id: string;
  timestamp: Date;
};

interface A2A.Protocol {
  send.Message(message: A2A.Message): Promise<void>
  on.Message(handler: (message: A2A.Message) => Promise<void>): void;
  subscribe(agent.Id: string, event.Type: string): void;
  unsubscribe(agent.Id: string, event.Type: string): void;
};

export class FileSystem.Service extends Event.Emitter implements A2A.Protocol {
  private supabase: Supabase.Client;
  private fileManager.Agent: FileManager.Agent;
  private watchers: Map<string, FS.Watcher> = new Map();
  private operation.Queue: File.Operation[] = [];
  private a2a.Handlers: Map<string, (message: A2A.Message) => Promise<void>> = new Map();
  private a2a.Subscriptions: Map<string, Set<string>> = new Map();
  private allowed.Paths: string[] = [];
  private blocked.Paths: string[] = [
    '/etc';
    '/System';
    '/private';
    '/dev';
    '/proc';
    '/git';
    'node_modules'];
  constructor(supabase: Supabase.Client, allowed.Paths?: string[]) {
    super();
    thissupabase = supabase;
    thisfileManager.Agent = new FileManager.Agent()// Set allowed paths (default to user's home directory and project directory);
    thisallowed.Paths = allowed.Paths || [process.envHOM.E || '~', processcwd()];
    loggerinfo('FileSystem.Service initialized', LogContextSYSTE.M, {
      allowed.Paths: thisallowed.Paths;
      blocked.Paths: thisblocked.Paths})}// A2.A Protocol Implementation;
  async send.Message(message: A2A.Message): Promise<void> {
    // Emit to local subscribers;
    const subscribers = thisa2a.Subscriptionsget(messageaction) || new Set();
    for (const agent.Id of subscribers) {
      const handler = thisa2a.Handlersget(agent.Id);
      if (handler) {
        await handler(message)}}// Log to Supabase for persistence and remote agents;
    await thissupabasefrom('a2a_messages')insert({
      from_agent: messagefrom;
      to_agent: messageto;
      message_type: messagetype;
      action: messageaction;
      payload: messagepayload;
      correlation_id: messagecorrelation.Id;
      created_at: messagetimestamp})// Emit for real-time subscribers;
    thisemit('a2a:message', message)};

  on.Message(handler: (message: A2A.Message) => Promise<void>): void {
    const handler.Id = cryptorandomUUI.D();
    thisa2a.Handlersset(handler.Id, handler)};

  subscribe(agent.Id: string, event.Type: string): void {
    if (!thisa2a.Subscriptionshas(event.Type)) {
      thisa2a.Subscriptionsset(event.Type, new Set())};
    thisa2a.Subscriptionsget(event.Type)!add(agent.Id)};

  unsubscribe(agent.Id: string, event.Type: string): void {
    const subscribers = thisa2a.Subscriptionsget(event.Type);
    if (subscribers) {
      subscribersdelete(agent.Id)}}// Path Security;
  private isPath.Allowed(file.Path: string): boolean {
    const normalized.Path = pathresolve(file.Path)// Check if path is in blocked list;
    for (const blocked of thisblocked.Paths) {
      if (normalizedPathstarts.With(blocked)) {
        return false}}// Check if path is within allowed paths;
    for (const allowed of thisallowed.Paths) {
      const resolved.Allowed = pathresolve(allowed);
      if (normalizedPathstarts.With(resolved.Allowed)) {
        return true}};

    return false};

  private sanitize.Path(file.Path: string): string {
    // Remove any directory traversal attempts;
    const sanitized = file.Pathreplace(/\.\./g, '')replace(/\/\//g, '/');
    return pathresolve(sanitized)}// File Operations;
  async read.File(file.Path: string, options?: { encoding?: Buffer.Encoding }): Promise<string> {
    const sanitized.Path = thissanitize.Path(file.Path);
    if (!thisisPath.Allowed(sanitized.Path)) {
      throw new Error(`Access denied: ${file.Path}`)};

    const operation = await thistrack.Operation({
      type: 'read';
      source.Path: sanitized.Path;
      agent.Id: 'filesystem-service';
      user.Id: 'system'});
    try {
      const content await fsread.File(sanitized.Path, options?encoding || 'utf-8');
      await thiscomplete.Operation(operationid, { success: true })// Send a2a notification;
      await thissend.Message({
        from: 'filesystem-service';
        to: 'all';
        type: 'event';
        action: 'file:read';
        payload: { path: sanitized.Path, size: content-length };
        correlation.Id: operationid;
        timestamp: new Date()});
      return content} catch (error) {
      await thiscomplete.Operation(operationid, {
        success: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}};

  async write.File(
    file.Path: string;
    contentstring;
    options?: { encoding?: Buffer.Encoding }): Promise<void> {
    const sanitized.Path = thissanitize.Path(file.Path);
    if (!thisisPath.Allowed(sanitized.Path)) {
      throw new Error(`Access denied: ${file.Path}`)};

    const operation = await thistrack.Operation({
      type: 'write';
      source.Path: sanitized.Path;
      content;
      agent.Id: 'filesystem-service';
      user.Id: 'system'});
    try {
      await fswrite.File(sanitized.Path, contentoptions?encoding || 'utf-8');
      await thiscomplete.Operation(operationid, { success: true })// Send a2a notification;
      await thissend.Message({
        from: 'filesystem-service';
        to: 'all';
        type: 'event';
        action: 'file:write';
        payload: { path: sanitized.Path, size: content-length };
        correlation.Id: operationid;
        timestamp: new Date()})} catch (error) {
      await thiscomplete.Operation(operationid, {
        success: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}};

  async delete.File(file.Path: string): Promise<void> {
    const sanitized.Path = thissanitize.Path(file.Path);
    if (!thisisPath.Allowed(sanitized.Path)) {
      throw new Error(`Access denied: ${file.Path}`)};

    const operation = await thistrack.Operation({
      type: 'delete';
      source.Path: sanitized.Path;
      agent.Id: 'filesystem-service';
      user.Id: 'system'});
    try {
      const stats = await fsstat(sanitized.Path);
      if (statsis.Directory()) {
        await fsrmdir(sanitized.Path, { recursive: true })} else {
        await fsunlink(sanitized.Path)};

      await thiscomplete.Operation(operationid, { success: true })// Send a2a notification;
      await thissend.Message({
        from: 'filesystem-service';
        to: 'all';
        type: 'event';
        action: 'file:delete';
        payload: { path: sanitized.Path, type: statsis.Directory() ? 'directory' : 'file' };
        correlation.Id: operationid;
        timestamp: new Date()})} catch (error) {
      await thiscomplete.Operation(operationid, {
        success: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}};

  async move.File(source.Path: string, target.Path: string): Promise<void> {
    const sanitized.Source = thissanitize.Path(source.Path);
    const sanitized.Target = thissanitize.Path(target.Path);
    if (!thisisPath.Allowed(sanitized.Source) || !thisisPath.Allowed(sanitized.Target)) {
      throw new Error(`Access denied`)};

    const operation = await thistrack.Operation({
      type: 'move';
      source.Path: sanitized.Source;
      target.Path: sanitized.Target;
      agent.Id: 'filesystem-service';
      user.Id: 'system'});
    try {
      await fsrename(sanitized.Source, sanitized.Target);
      await thiscomplete.Operation(operationid, { success: true })// Send a2a notification;
      await thissend.Message({
        from: 'filesystem-service';
        to: 'all';
        type: 'event';
        action: 'file:move';
        payload: { from: sanitized.Source, to: sanitized.Target };
        correlation.Id: operationid;
        timestamp: new Date()})} catch (error) {
      await thiscomplete.Operation(operationid, {
        success: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}};

  async copy.File(source.Path: string, target.Path: string): Promise<void> {
    const sanitized.Source = thissanitize.Path(source.Path);
    const sanitized.Target = thissanitize.Path(target.Path);
    if (!thisisPath.Allowed(sanitized.Source) || !thisisPath.Allowed(sanitized.Target)) {
      throw new Error(`Access denied`)};

    const operation = await thistrack.Operation({
      type: 'copy';
      source.Path: sanitized.Source;
      target.Path: sanitized.Target;
      agent.Id: 'filesystem-service';
      user.Id: 'system'});
    try {
      await fscopy.File(sanitized.Source, sanitized.Target);
      await thiscomplete.Operation(operationid, { success: true })// Send a2a notification;
      await thissend.Message({
        from: 'filesystem-service';
        to: 'all';
        type: 'event';
        action: 'file:copy';
        payload: { from: sanitized.Source, to: sanitized.Target };
        correlation.Id: operationid;
        timestamp: new Date()})} catch (error) {
      await thiscomplete.Operation(operationid, {
        success: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}};

  async create.Directory(dir.Path: string, options?: { recursive?: boolean }): Promise<void> {
    const sanitized.Path = thissanitize.Path(dir.Path);
    if (!thisisPath.Allowed(sanitized.Path)) {
      throw new Error(`Access denied: ${dir.Path}`)};

    const operation = await thistrack.Operation({
      type: 'mkdir';
      source.Path: sanitized.Path;
      agent.Id: 'filesystem-service';
      user.Id: 'system'});
    try {
      await fsmkdir(sanitized.Path, { recursive: options?recursive || false });
      await thiscomplete.Operation(operationid, { success: true })// Send a2a notification;
      await thissend.Message({
        from: 'filesystem-service';
        to: 'all';
        type: 'event';
        action: 'directory:create';
        payload: { path: sanitized.Path };
        correlation.Id: operationid;
        timestamp: new Date()})} catch (error) {
      await thiscomplete.Operation(operationid, {
        success: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}};

  async list.Directory(
    dir.Path: string;
    options?: {
      recursive?: boolean;
      include.Hidden?: boolean;
      max.Depth?: number;
    }): Promise<FileTree.Node[]> {
    const sanitized.Path = thissanitize.Path(dir.Path);
    if (!thisisPath.Allowed(sanitized.Path)) {
      throw new Error(`Access denied: ${dir.Path}`)};

    const entries = await fsreaddir(sanitized.Path, { withFile.Types: true });
    const result: FileTree.Node[] = [];
    for (const entry of entries) {
      if (!options?include.Hidden && entrynamestarts.With('.')) {
        continue};

      const full.Path = pathjoin(sanitized.Path, entryname);
      const stats = await fsstat(full.Path);
      if (entryis.Directory()) {
        const node: Directory.Tree = {
          path: full.Path;
          name: entryname;
          type: 'directory';
          children: [];
          expanded: false;
        };
        if (options?recursive && (!optionsmax.Depth || optionsmax.Depth > 0)) {
          nodechildren = await thislist.Directory(full.Path, {
            .options;
            max.Depth: optionsmax.Depth ? optionsmax.Depth - 1 : undefined})};

        resultpush(node)} else {
        const metadata = await thisgetFile.Metadata(full.Path);
        resultpush(metadata)}};

    return result};

  async getFile.Metadata(file.Path: string): Promise<File.Metadata> {
    const sanitized.Path = thissanitize.Path(file.Path);
    if (!thisisPath.Allowed(sanitized.Path)) {
      throw new Error(`Access denied: ${file.Path}`)};

    const stats = await fsstat(sanitized.Path);
    const name = pathbasename(sanitized.Path);
    const extension = pathextname(sanitized.Path)toLower.Case();
    const metadata: File.Metadata = {
      path: sanitized.Path;
      name;
      size: statssize;
      type: statsis.Directory() ? 'directory' : statsisSymbolic.Link() ? 'symlink' : 'file';
      extension: extension || undefined;
      created.At: statsbirthtime;
      modified.At: statsmtime;
      accessed.At: statsatime;
      permissions: {
        readable: !!(statsmode & 0o400);
        writable: !!(statsmode & 0o200);
        executable: !!(statsmode & 0o100);
      };
      is.Hidden: namestarts.With('.');
    }// Calculate hash for files;
    if (metadatatype === 'file' && statssize < 100 * 1024 * 1024) {
      // Only hash files < 100M.B;
      try {
        const content await fsread.File(sanitized.Path);
        metadatahash = cryptocreate.Hash('sha256')update(contentdigest('hex')} catch (error) {
        loggerwarn('Failed to calculate file hash', LogContextSYSTE.M, {
          path: sanitized.Path;
          error})}};
;
    return FileMetadata.Schemaparse(metadata)}// File Watching;
  async watch.Path(
    watch.Path: string;
    options?: {
      recursive?: boolean;
      ignore.Patterns?: string[];
    }): Promise<string> {
    const sanitized.Path = thissanitize.Path(watch.Path);
    if (!thisisPath.Allowed(sanitized.Path)) {
      throw new Error(`Access denied: ${watch.Path}`)};

    const watcher.Id = cryptorandomUUI.D();
    const watcher = watch(sanitized.Path, {
      persistent: true;
      recursive: options?recursive;
      ignored: options?ignore.Patterns;
      ignore.Initial: true;
      awaitWrite.Finish: {
        stability.Threshold: 300;
        poll.Interval: 100;
      }});
    watcheron('add', (file.Path) => thishandleFile.Event('add', file.Path, watcher.Id));
    watcheron('change', (file.Path) => thishandleFile.Event('change', file.Path, watcher.Id));
    watcheron('unlink', (file.Path) => thishandleFile.Event('unlink', file.Path, watcher.Id));
    watcheron('add.Dir', (dir.Path) => thishandleFile.Event('add.Dir', dir.Path, watcher.Id));
    watcheron('unlink.Dir', (dir.Path) => thishandleFile.Event('unlink.Dir', dir.Path, watcher.Id));
    thiswatchersset(watcher.Id, watcher);
    loggerinfo('Started watching path', LogContextSYSTE.M, {
      watcher.Id;
      path: sanitized.Path;
      recursive: options?recursive});
    return watcher.Id};

  async unwatch.Path(watcher.Id: string): Promise<void> {
    const watcher = thiswatchersget(watcher.Id);
    if (watcher) {
      await watcherclose();
      thiswatchersdelete(watcher.Id);
      loggerinfo('Stopped watching path', LogContextSYSTE.M, { watcher.Id })}};

  private async handleFile.Event(event: string, file.Path: string, watcher.Id: string): Promise<void> {
    // Send a2a notification;
    await thissend.Message({
      from: 'filesystem-service';
      to: 'all';
      type: 'event';
      action: `file:${event}`;
      payload: {
        path: file.Path;
        watcher.Id;
        event;
      };
      correlation.Id: cryptorandomUUI.D();
      timestamp: new Date()})// Emit local event;
    thisemit('file:change', {
      event;
      path: file.Path;
      watcher.Id})}// Operation Tracking;
  private async track.Operation(operation: Partial<File.Operation>): Promise<File.Operation> {
    const op: File.Operation = {
      id: cryptorandomUUI.D();
      status: 'pending';
      started.At: new Date().operation} as File.Operation;
    thisoperation.Queuepush(op)// Store in Supabase;
    await thissupabasefrom('file_operations')insert({
      id: opid;
      type: optype;
      source_path: opsource.Path;
      target_path: optarget.Path;
      agent_id: opagent.Id;
      user_id: opuser.Id;
      status: opstatus;
      started_at: opstarted.At});
    return op};

  private async complete.Operation(
    operation.Id: string;
    result: { success: boolean, error instanceof Error ? errormessage : String(error) string }): Promise<void> {
    const op = thisoperation.Queuefind((o) => oid === operation.Id);
    if (!op) return;
    opstatus = resultsuccess ? 'completed' : 'failed';
    operror instanceof Error ? errormessage : String(error)  resulterror;
    opcompleted.At = new Date()// Update in Supabase;
    await thissupabase;
      from('file_operations');
      update({
        status: opstatus;
        error instanceof Error ? errormessage : String(error) operror;
        completed_at: opcompleted.At});
      eq('id', operation.Id)// Remove from queue;
    thisoperation.Queue = thisoperation.Queuefilter((o) => oid !== operation.Id)}// Integration with FileManager.Agent;
  async organize.Files(dir.Path: string, rules?: any): Promise<void> {
    const sanitized.Path = thissanitize.Path(dir.Path);
    if (!thisisPath.Allowed(sanitized.Path)) {
      throw new Error(`Access denied: ${dir.Path}`)}// Delegate to FileManager.Agent;
    await thisfileManagerAgentorganize.Files({
      directory: sanitized.Path;
      rules: rules || 'smart';
      preview: false})};

  async find.Duplicates(dir.Path: string): Promise<any[]> {
    const sanitized.Path = thissanitize.Path(dir.Path);
    if (!thisisPath.Allowed(sanitized.Path)) {
      throw new Error(`Access denied: ${dir.Path}`)}// Delegate to FileManager.Agent;
    return thisfileManagerAgentfind.Duplicates({
      directory: sanitized.Path;
      include.Subdirs: true})};

  async search.Files(query: string, dir.Path?: string): Promise<any[]> {
    const search.Path = dir.Path ? thissanitize.Path(dir.Path) : thisallowed.Paths[0];
    if (!thisisPath.Allowed(search.Path)) {
      throw new Error(`Access denied: ${dir.Path}`)}// Delegate to FileManager.Agent;
    return thisfileManagerAgentsmart.Search({
      query;
      directory: search.Path;
      search.Content: true})}// Cleanup;
  async shutdown(): Promise<void> {
    // Close all file watchers;
    for (const [watcher.Id, watcher] of thiswatchers) {
      await watcherclose()};
    thiswatchersclear()// Clear handlers;
    thisa2a.Handlersclear();
    thisa2a.Subscriptionsclear();
    loggerinfo('FileSystem.Service shut down', LogContextSYSTE.M)}}// Factory function;
export function createFileSystem.Service(
  supabase: Supabase.Client;
  options?: { allowed.Paths?: string[] }): FileSystem.Service {
  return new FileSystem.Service(supabase, options?allowed.Paths)};
