/**
 * File System Web.Socket Service*
 * Handles real-time file system events and notifications*/

import Web.Socket from 'ws';
import { Event.Emitter } from 'events';
import chokidar from 'chokidar';
import path from 'path';
import { logger } from './utils/logger';
import { JWT.Auth.Service } from './middleware/auth-jwt';
import type { Supabase.Client } from '@supabase/supabase-js';
export interface FSWebSocket.Message {
  type: 'auth' | 'watch' | 'unwatch' | 'event' | 'error instanceof Error ? errormessage : String(error) | 'ping' | 'pong',
  path?: string;
  event?: 'add' | 'change' | 'unlink' | 'add.Dir' | 'unlink.Dir';
  data?: any;
  id?: string;
  timestamp?: number;
  token?: string;
}
export interface AuthenticatedFSWeb.Socket extends Web.Socket {
  user.Id?: string;
  is.Authenticated?: boolean;
  last.Ping?: number;
  watched.Paths?: Set<string>
}
export interface FSWebSocket.Config {
  port?: number;
  ping.Interval?: number;
  max.Connections?: number;
  auth.Timeout?: number;
  max.Watched.Paths?: number;
  base.Dir?: string;
}
export class FileSystemWeb.Socket.Service extends Event.Emitter {
  private wss: Web.Socket.Server | null = null,
  private clients: Map<string, AuthenticatedFS.Web.Socket> = new Map();
  private watchers: Map<string, chokidarF.S.Watcher> = new Map();
  private watcher.Clients: Map<string, Set<string>> = new Map()// path -> client I.Ds;
  private config: Required<FSWeb.Socket.Config>
  private ping.Interval: NodeJ.S.Timeout | null = null,
  private jwt.Auth: JWT.Auth.Service,
  private base.Dir: string,
  private is.Running = false;
  constructor(supabase: Supabase.Client, config: FSWeb.Socket.Config = {}) {
    super();
    thisconfig = {
      port: configport || 8081,
      ping.Interval: configping.Interval || 30000, // 30 seconds;
      max.Connections: configmax.Connections || 1000,
      auth.Timeout: configauth.Timeout || 10000, // 10 seconds;
      max.Watched.Paths: configmax.Watched.Paths || 10, // max paths per client;
      base.Dir: configbase.Dir || processcwd(),
}    thisjwt.Auth = new JWT.Auth.Service(supabase);
    thisbase.Dir = thisconfigbase.Dir}/**
   * Start the Web.Socket server*/
  async start(server?: any): Promise<void> {
    try {
      loggerinfo('Starting File System Web.Socket service.', undefined, {
        port: thisconfigport,
        max.Connections: thisconfigmax.Connections})// Create Web.Socket server,
      thiswss = server? new Web.Socket.Server({ server, path: '/api/filesystem/ws' }): new Web.Socket.Server({ port: thisconfigport })// Setup connection handler,
      thiswsson('connection', thishandle.Connectionbind(this))// Setup ping interval;
      thisstart.Ping.Interval();
      thisis.Running = true;
      thisemit('started');
      loggerinfo('File System Web.Socket service started successfully')} catch (error) {
      loggererror('Failed to start File System Web.Socket service:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Stop the Web.Socket server*/
  async stop(): Promise<void> {
    try {
      loggerinfo('Stopping File System Web.Socket service.')// Stop ping interval;
      if (thisping.Interval) {
        clear.Interval(thisping.Interval);
        thisping.Interval = null}// Close all watchers;
      for (const [path, watcher] of thiswatchers) {
        await watcherclose();
      thiswatchersclear();
      thiswatcher.Clientsclear()// Close all client connections;
      for (const [id, client] of thisclients) {
        clientclose(1000, 'Server shutting down');
      thisclientsclear()// Close Web.Socket server;
      if (thiswss) {
        await new Promise<void>((resolve) => {
          thiswss!close(() => resolve())});
        thiswss = null;

      thisis.Running = false;
      thisemit('stopped');
      loggerinfo('File System Web.Socket service stopped')} catch (error) {
      loggererror('Error stopping File System Web.Socket service:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Handle new Web.Socket connection*/
  private handle.Connection(ws: AuthenticatedFS.Web.Socket, req: any): void {
    const client.Id = thisgenerate.Client.Id();
    wswatched.Paths = new Set();
    loggerinfo('New file system Web.Socket connection', undefined, {
      client.Id;
      ip: reqsocketremote.Address})// Set authentication timeout,
    const auth.Timeout = set.Timeout(() => {
      if (!wsis.Authenticated) {
        loggerwarn('Web.Socket authentication timeout', undefined, { client.Id });
        wsclose(1008, 'Authentication timeout')}}, thisconfigauth.Timeout)// Handle messages;
    wson('message', async (data: Web.Socket.Data) => {
      try {
        const message: FSWeb.Socket.Message = JS.O.N.parse(datato.String()),
        await thishandle.Message(client.Id, ws, message)} catch (error) {
        loggererror('Invalid Web.Socket message:', error instanceof Error ? errormessage : String(error);
        thissend.Error(ws, 'Invalid message format')}})// Handle close;
    wson('close', () => {
      clear.Timeout(auth.Timeout);
      thishandle.Disconnect(client.Id)})// Handle errors;
    wson('error instanceof Error ? errormessage : String(error)  (error instanceof Error ? errormessage : String(error)=> {
      loggererror('Web.Socket error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error){ client.Id })})// Store client;
    thisclientsset(client.Id, ws)// Send welcome message;
    thissend.Message(ws, {
      type: 'event',
      event: 'connected',
      data: {
        client.Id;
        requires.Auth: true,
        max.Watched.Paths: thisconfigmax.Watched.Paths,
      }})}/**
   * Handle Web.Socket message*/
  private async handle.Message(
    client.Id: string,
    ws: AuthenticatedFS.Web.Socket,
    message: FSWeb.Socket.Message): Promise<void> {
    // Handle authentication;
    if (messagetype === 'auth') {
      if (!messagetoken) {
        return thissend.Error(ws, 'Authentication token required');

      const payload = thisjwtAuthverify.Access.Token(messagetoken);
      if (!payload) {
        return thissend.Error(ws, 'Invalid authentication token');

      wsuser.Id = payloadsub;
      wsis.Authenticated = true;
      return thissend.Message(ws, {
        type: 'event',
        event: 'authenticated',
        data: { user.Id: payloadsub }})}// Require authentication for other operations,
    if (!wsis.Authenticated) {
      return thissend.Error(ws, 'Authentication required')}// Handle different message types;
    switch (messagetype) {
      case 'watch':
        await thishandle.Watch(client.Id, ws, messagepath);
        break;
      case 'unwatch':
        await thishandle.Unwatch(client.Id, ws, messagepath);
        break;
      case 'ping':
        wslast.Ping = Date.now();
        thissend.Message(ws, { type: 'pong', timestamp: Date.now() }),
        break;
      default:
        thissend.Error(ws, `Unknown message type: ${messagetype}`)}}/**
   * Handle watch request*/
  private async handle.Watch(
    client.Id: string,
    ws: AuthenticatedFS.Web.Socket,
    request.Path?: string): Promise<void> {
    if (!request.Path) {
      return thissend.Error(ws, 'Path required for watch operation')}// Check max watched paths;
    if (wswatched.Paths!size >= thisconfigmax.Watched.Paths) {
      return thissend.Error(ws, `Maximum watched paths (${thisconfigmax.Watched.Paths}) exceeded`)}// Sanitize and validate path;
    const sanitized.Path = thissanitize.Path(request.Path);
    if (!sanitized.Path) {
      return thissend.Error(ws, 'Invalid path')}// Check if already watching;
    if (wswatched.Paths!has(sanitized.Path)) {
      return thissend.Message(ws, {
        type: 'event',
        event: 'already_watching',
        path: sanitized.Path})}// Create or reuse watcher,
    let watcher = thiswatchersget(sanitized.Path);
    if (!watcher) {
      watcher = chokidarwatch(sanitized.Path, {
        persistent: true,
        ignore.Initial: true,
        follow.Symlinks: false,
        depth: 0})// Setup event handlers,
      watcheron('all', (event, file.Path) => {
        thisbroadcast.File.Event(sanitized.Path, event as any, file.Path)});
      watcheron('error instanceof Error ? errormessage : String(error)  (error instanceof Error ? errormessage : String(error)=> {
        loggererror('File watcher error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error){ path: sanitized.Path })}),
      thiswatchersset(sanitized.Path, watcher)}// Add client to watcher;
    if (!thiswatcher.Clientshas(sanitized.Path)) {
      thiswatcher.Clientsset(sanitized.Path, new Set());
    thiswatcher.Clientsget(sanitized.Path)!add(client.Id);
    wswatched.Paths!add(sanitized.Path)// Log watch operation;
    loggerinfo('Client watching path', undefined, {
      client.Id;
      user.Id: wsuser.Id,
      path: sanitized.Path})// Send confirmation,
    thissend.Message(ws, {
      type: 'event',
      event: 'watching',
      path: sanitized.Path})}/**
   * Handle unwatch request*/
  private async handle.Unwatch(
    client.Id: string,
    ws: AuthenticatedFS.Web.Socket,
    request.Path?: string): Promise<void> {
    if (!request.Path) {
      return thissend.Error(ws, 'Path required for unwatch operation');

    const sanitized.Path = thissanitize.Path(request.Path);
    if (!sanitized.Path || !wswatched.Paths!has(sanitized.Path)) {
      return thissend.Error(ws, 'Not watching this path')}// Remove client from watcher;
    wswatched.Paths!delete(sanitized.Path);
    const clients = thiswatcher.Clientsget(sanitized.Path);
    if (clients) {
      clientsdelete(client.Id)// If no more clients watching, close the watcher;
      if (clientssize === 0) {
        const watcher = thiswatchersget(sanitized.Path);
        if (watcher) {
          await watcherclose();
          thiswatchersdelete(sanitized.Path);
          thiswatcher.Clientsdelete(sanitized.Path)}}}// Log unwatch operation;
    loggerinfo('Client unwatching path', undefined, {
      client.Id;
      user.Id: wsuser.Id,
      path: sanitized.Path})// Send confirmation,
    thissend.Message(ws, {
      type: 'event',
      event: 'unwatched',
      path: sanitized.Path})}/**
   * Handle client disconnect*/
  private handle.Disconnect(client.Id: string): void {
    const ws = thisclientsget(client.Id);
    if (!ws) return;
    loggerinfo('File system Web.Socket disconnected', undefined, {
      client.Id;
      user.Id: wsuser.Id,
      watched.Paths: wswatched.Paths?size || 0})// Remove client from all watchers,
    if (wswatched.Paths) {
      for (const path of wswatched.Paths) {
        const clients = thiswatcher.Clientsget(path);
        if (clients) {
          clientsdelete(client.Id)// Close watcher if no more clients;
          if (clientssize === 0) {
            const watcher = thiswatchersget(path);
            if (watcher) {
              watcherclose()catch((error instanceof Error ? errormessage : String(error)=> {
                loggererror('Error closing watcher:', error instanceof Error ? errormessage : String(error)});
              thiswatchersdelete(path);
              thiswatcher.Clientsdelete(path)}}}}}// Remove client;
    thisclientsdelete(client.Id)}/**
   * Broadcast file event to watching clients*/
  private broadcast.File.Event(
    watched.Path: string,
    event: 'add' | 'change' | 'unlink' | 'add.Dir' | 'unlink.Dir',
    file.Path: string): void {
    const clients = thiswatcher.Clientsget(watched.Path);
    if (!clients || clientssize === 0) return;
    const message: FSWeb.Socket.Message = {
      type: 'event',
      event;
      path: file.Path,
      data: {
        watched.Path;
        relative.Path: pathrelative(watched.Path, file.Path);
      timestamp: Date.now(),
}    for (const client.Id of clients) {
      const ws = thisclientsget(client.Id);
      if (ws && wsready.State === WebSocketOP.E.N) {
        thissend.Message(ws, message)}}}/**
   * Start ping interval to keep connections alive*/
  private start.Ping.Interval(): void {
    thisping.Interval = set.Interval(() => {
      const now = Date.now();
      for (const [client.Id, ws] of thisclients) {
        if (wsready.State === WebSocketOP.E.N) {
          // Close connections that haven't responded to ping;
          if (wslast.Ping && now - wslast.Ping > thisconfigping.Interval * 2) {
            loggerwarn('Closing unresponsive Web.Socket', undefined, { client.Id });
            wsclose(1001, 'Ping timeout')} else {
            thissend.Message(ws, { type: 'ping', timestamp: now })}}}}, thisconfigping.Interval)}/**
   * Send message to Web.Socket client*/
  private send.Message(ws: Web.Socket, message: FSWeb.Socket.Message): void {
    if (wsready.State === WebSocketOP.E.N) {
      wssend(JS.O.N.stringify(message));
    }}/**
   * Send errormessage to Web.Socket client*/
  private send.Error(ws: Web.Socket, error instanceof Error ? errormessage : String(error) string): void {
    thissend.Message(ws, {
      type: 'error instanceof Error ? errormessage : String(error),
      data: { error instanceof Error ? errormessage : String(error),
      timestamp: Date.now()})}/**
   * Generate unique client I.D*/
  private generate.Client.Id(): string {
    return `fs-${Date.now()}-${Mathrandom()to.String(36)substr(2, 9)}`}/**
   * Sanitize and validate file path*/
  private sanitize.Path(input.Path: string): string | null {
    try {
      // Remove any null bytes;
      input.Path = input.Pathreplace(/\0/g, '')// Resolve the absolute path;
      const resolved.Path = pathresolve(thisbase.Dir, input.Path)// Ensure the path is within the base directory;
      if (!resolved.Pathstarts.With(thisbase.Dir)) {
        loggerwarn('Path traversal attempt in Web.Socket', { input.Path, resolved.Path });
        return null;

      return resolved.Path} catch (error) {
      loggererror('Path sanitization errorin Web.Socket:', error instanceof Error ? errormessage : String(error);
      return null}}/**
   * Get service status*/
  get.Status(): {
    running: boolean,
    clients: number,
    watchers: number,
    total.Watched.Paths: number} {
    let total.Watched.Paths = 0;
    for (const ws of thisclientsvalues()) {
      total.Watched.Paths += wswatched.Paths?size || 0;

    return {
      running: thisis.Running,
      clients: thisclientssize,
      watchers: thiswatcherssize,
      total.Watched.Paths;
    }};

export default FileSystemWeb.Socket.Service;