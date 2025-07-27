/**
 * Sweet Athena Web.Socket Service*
 * Real-time communication system for Sweet Athena avatar interactions* Handles live personality changes, clothing updates, and avatar state synchronization*/

import Web.Socket from 'ws';
import { Event.Emitter } from 'events';
import { logger } from './utils/enhanced-logger';
import { SweetAthena.Integration.Service } from './sweet-athena-integration';
import { supabase } from './supabase_service';
import jwt from 'jsonwebtoken';
import type { Personality.Mode } from './sweet-athena-state-manager';
export interface WS.Message {
  type: | 'ping'| 'pong'| 'auth'| 'personality_change'| 'clothing_update'| 'state_change'| 'voice_interaction'| 'avatar_response'| 'error| 'success',
  id?: string;
  data?: any;
  timestamp?: string;
  user.Id?: string;
}
export interface AuthenticatedWeb.Socket extends Web.Socket {
  user.Id?: string;
  is.Authenticated?: boolean;
  last.Ping?: number;
  sweet.Athena.Service?: SweetAthena.Integration.Service;
}
export interface SweetAthenaWS.Config {
  port?: number;
  ping.Interval?: number;
  max.Connections?: number;
  auth.Timeout?: number;
  message.Rate.Limit?: number;
}
export class SweetAthenaWeb.Socket.Service extends Event.Emitter {
  private wss: Web.Socket.Server | null = null,
  private clients: Map<string, Authenticated.Web.Socket> = new Map();
  private user.Connections: Map<string, Set<Authenticated.Web.Socket>> = new Map();
  private config: Required<SweetAthenaW.S.Config>
  private ping.Interval: NodeJ.S.Timeout | null = null,
  private is.Running = false// Rate limiting;
  private message.Counts: Map<string, { count: number, reset.Time: number }> = new Map(),
  constructor(config: SweetAthenaW.S.Config = {}) {
    super();
    thisconfig = {
      port: configport || 8080,
      ping.Interval: configping.Interval || 30000, // 30 seconds;
      max.Connections: configmax.Connections || 1000,
      auth.Timeout: configauth.Timeout || 10000, // 10 seconds;
      message.Rate.Limit: configmessage.Rate.Limit || 60, // messages per minute}}/**
   * Start the Web.Socket server*/
  async start(server?: any): Promise<void> {
    try {
      loggerinfo('Starting Sweet Athena Web.Socket service.', undefined, {
        port: thisconfigport,
        max.Connections: thisconfigmax.Connections})// Create Web.Socket server,
      thiswss = server? new Web.Socket.Server({ server, path: '/api/sweet-athena/ws' }): new Web.Socket.Server({ port: thisconfigport })// Setup connection handler,
      thiswsson('connection', thishandle.Connectionbind(this))// Setup ping interval;
      thisstart.Ping.Interval();
      thisis.Running = true;
      thisemit('started');
      loggerinfo('Sweet Athena Web.Socket service started successfully')} catch (error) {
      loggererror('Failed to start Sweet Athena Web.Socket service:', undefined, error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Stop the Web.Socket server*/
  async stop(): Promise<void> {
    try {
      loggerinfo('Stopping Sweet Athena Web.Socket service.');
      thisis.Running = false// Stop ping interval;
      if (thisping.Interval) {
        clear.Interval(thisping.Interval);
        thisping.Interval = null}// Close all client connections;
      for (const [client.Id, ws] of thisclients) {
        thisclose.Connection(ws, 1001, 'Server shutting down')}// Close server;
      if (thiswss) {
        await new Promise<void>((resolve) => {
          thiswss!close(() => {
            resolve()})});
        thiswss = null;

      thisemit('stopped');
      loggerinfo('Sweet Athena Web.Socket service stopped')} catch (error) {
      loggererror('Error stopping Sweet Athena Web.Socket service:', undefined, error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Handle new Web.Socket connection*/
  private async handle.Connection(ws: Authenticated.Web.Socket, req: any): Promise<void> {
    const client.Id = thisgenerate.Client.Id();
    const { remote.Address } = reqsocket;
    loggerinfo('New Web.Socket connection', undefined, { client.Id, remote.Address })// Check connection limit;
    if (thisclientssize >= thisconfigmax.Connections) {
      thisclose.Connection(ws, 1013, 'Server at capacity');
      return}// Setup client;
    wsuser.Id = undefined;
    wsis.Authenticated = false;
    wslast.Ping = Date.now();
    thisclientsset(client.Id, ws)// Setup message handler;
    wson('message', (data) => thishandle.Message(ws, client.Id, data))// Setup close handler;
    wson('close', (code, reason) => thishandle.Close(ws, client.Id, code, reason))// Setup errorhandler;
    wson('error instanceof Error ? errormessage : String(error)  (error instanceof Error ? errormessage : String(error)=> thishandle.Error(ws, client.Id, error instanceof Error ? errormessage : String(error)// Setup authentication timeout;
    const auth.Timeout = set.Timeout(() => {
      if (!wsis.Authenticated) {
        thisclose.Connection(ws, 1008, 'Authentication timeout')}}, thisconfigauth.Timeout)// Clear timeout when authenticated;
    wson('authenticated', () => {
      clear.Timeout(auth.Timeout)})// Send welcome message;
    thissend.Message(ws, {
      type: 'success',
      data: {
        message: 'Connected to Sweet Athena Web.Socket',
        client.Id;
        auth.Required: true,
        auth.Timeout: thisconfigauth.Timeout,
      }})}/**
   * Handle incoming Web.Socket message*/
  private async handle.Message(
    ws: Authenticated.Web.Socket,
    client.Id: string,
    data: WebSocket.Raw.Data): Promise<void> {
    try {
      // Check rate limiting;
      if (!thischeck.Rate.Limit(wsuser.Id || client.Id)) {
        thissend.Error(ws, 'Rate limit exceeded');
        return}// Parse message;
      const message: W.S.Message = JS.O.N.parse(datato.String()),
      loggerdebug('Web.Socket message received', undefined, {
        client.Id;
        user.Id: wsuser.Id,
        message.Type: messagetype})// Handle authentication first,
      if (!wsis.Authenticated && messagetype !== 'auth') {
        thissend.Error(ws, 'Authentication required');
        return}// Route message based on type;
      switch (messagetype) {
        case 'auth':
          await thishandle.Auth(ws, client.Id, message);
          break;
        case 'ping':
          await thishandle.Ping(ws, message);
          break;
        case 'personality_change':
          await thishandle.Personality.Change(ws, message);
          break;
        case 'clothing_update':
          await thishandle.Clothing.Update(ws, message);
          break;
        case 'state_change':
          await thishandle.State.Change(ws, message);
          break;
        case 'voice_interaction':
          await thishandle.Voice.Interaction(ws, message);
          break;
        default:
          thissend.Error(ws, `Unknown message type: ${messagetype}`)}} catch (error) {
      loggererror('Error handling Web.Socket message:', undefined, { error instanceof Error ? errormessage : String(error) client.Id });
      thissend.Error(ws, 'Invalid message format')}}/**
   * Handle authentication*/
  private async handle.Auth(
    ws: Authenticated.Web.Socket,
    client.Id: string,
    message: W.S.Message): Promise<void> {
    try {
      const { token } = messagedata || {;
      if (!token) {
        thissend.Error(ws, 'Authentication token required');
        return}// Verify J.W.T token;
      const decoded = jwtverify(token, process.envJWT_SECR.E.T!) as any;
      const user.Id = decodedsub || decodeduser_id;
      if (!user.Id) {
        thissend.Error(ws, 'Invalid token: missing user I.D'),
        return}// Verify user exists in database;
      const { data: user, error instanceof Error ? errormessage : String(error)  = await supabase;
        from('users');
        select('id');
        eq('id', user.Id);
        single();
      if (error instanceof Error ? errormessage : String(error) | !user) {
        thissend.Error(ws, 'Invalid user');
        return}// Setup user connection;
      wsuser.Id = user.Id;
      wsis.Authenticated = true// Initialize Sweet Athena service for user;
      try {
        wssweet.Athena.Service = new SweetAthena.Integration.Service(supabase);
        await wssweet.Athena.Serviceinitialize(user.Id)// Setup service event handlers;
        thissetupService.Event.Handlers(ws)} catch (service.Error) {
        loggererror('Failed to initialize Sweet Athena service:', undefined, service.Error);
        wssweet.Athena.Service = undefined}// Track user connections;
      if (!thisuser.Connectionshas(user.Id)) {
        thisuser.Connectionsset(user.Id, new Set());
      thisuser.Connectionsget(user.Id)!add(ws);
      wsemit('authenticated')// Send authentication success;
      thissend.Message(ws, {
        type: 'success',
        data: {
          message: 'Authentication successful',
          user.Id;
          sweet.Athena.Enabled: !!wssweet.Athena.Service,
          current.State: wssweet.Athena.Service?get.Current.State(),
        }});
      loggerinfo('Web.Socket client authenticated', undefined, { client.Id, user.Id })} catch (error) {
      loggererror('Authentication error instanceof Error ? errormessage : String(error) , undefined, error instanceof Error ? errormessage : String(error);
      thissend.Error(ws, 'Authentication failed')}}/**
   * Setup Sweet Athena service event handlers*/
  private setupService.Event.Handlers(ws: Authenticated.Web.Socket): void {
    if (!wssweet.Athena.Service) return;
    wssweet.Athena.Serviceon('personality.Changed', (data) => {
      thissend.Message(ws, {
        type: 'personality_change',
        data: {
          personality: datato,
          previous.Personality: datafrom,
          timestamp: new Date()toIS.O.String(),
        }})});
    wssweet.Athena.Serviceon('clothing.Changed', (data) => {
      thissend.Message(ws, {
        type: 'clothing_update',
        data: {
          level: datato,
          previous.Level: datafrom,
          timestamp: new Date()toIS.O.String(),
        }})});
    wssweet.Athena.Serviceon('avatar.State.Changed', (state) => {
      thissend.Message(ws, {
        type: 'state_change',
        data: {
          state;
          timestamp: new Date()toIS.O.String(),
        }})});
    wssweet.Athena.Serviceon('avatar.Connected', () => {
      thissend.Message(ws, {
        type: 'avatar_response',
        data: {
          event: 'connected',
          message: 'Sweet Athena avatar connected',
          timestamp: new Date()toIS.O.String(),
        }})});
    wssweet.Athena.Serviceon('avatar.Disconnected', () => {
      thissend.Message(ws, {
        type: 'avatar_response',
        data: {
          event: 'disconnected',
          message: 'Sweet Athena avatar disconnected',
          timestamp: new Date()toIS.O.String(),
        }})})}/**
   * Handle ping message*/
  private async handle.Ping(ws: Authenticated.Web.Socket, message: W.S.Message): Promise<void> {
    wslast.Ping = Date.now();
    thissend.Message(ws, {
      type: 'pong',
      id: messageid,
      data: { timestamp: new Date()toIS.O.String() }})}/**
   * Handle personality change request*/
  private async handle.Personality.Change(
    ws: Authenticated.Web.Socket,
    message: W.S.Message): Promise<void> {
    try {
      const { personality } = messagedata || {;
      if (
        !personality || !['sweet', 'shy', 'confident', 'caring', 'playful']includes(personality)) {
        thissend.Error(ws, 'Invalid personality mode');
        return;

      if (!wssweet.Athena.Service) {
        thissend.Error(ws, 'Sweet Athena service not available');
        return;

      await wssweetAthena.Serviceset.Personality(personality as Personality.Mode);
      thissend.Message(ws, {
        type: 'success',
        id: messageid,
        data: {
          message: `Personality changed to ${personality}`,
          personality;
          timestamp: new Date()toIS.O.String(),
        }})// Broadcast to other connections for this user;
      thisbroadcast.To.User(
        wsuser.Id!
        {
          type: 'personality_change',
          data: {
            personality;
            source: 'websocket',
            timestamp: new Date()toIS.O.String(),
          };
        ws)} catch (error) {
      loggererror('Personality change error instanceof Error ? errormessage : String(error) , undefined, error instanceof Error ? errormessage : String(error);
      thissend.Error(ws, 'Failed to change personality', messageid)}}/**
   * Handle clothing update request*/
  private async handle.Clothing.Update(
    ws: Authenticated.Web.Socket,
    message: W.S.Message): Promise<void> {
    try {
      const { level } = messagedata || {;
      if (!level || !['conservative', 'moderate', 'revealing', 'very_revealing']includes(level)) {
        thissend.Error(ws, 'Invalid clothing level');
        return;

      if (!wssweet.Athena.Service) {
        thissend.Error(ws, 'Sweet Athena service not available');
        return;

      await wssweetAthenaServiceset.Clothing.Level(level);
      thissend.Message(ws, {
        type: 'success',
        id: messageid,
        data: {
          message: `Clothing level changed to ${level}`,
          level;
          timestamp: new Date()toIS.O.String(),
        }})// Broadcast to other connections for this user;
      thisbroadcast.To.User(
        wsuser.Id!
        {
          type: 'clothing_update',
          data: {
            level;
            source: 'websocket',
            timestamp: new Date()toIS.O.String(),
          };
        ws)} catch (error) {
      loggererror('Clothing update error instanceof Error ? errormessage : String(error) , undefined, error instanceof Error ? errormessage : String(error);
      thissend.Error(ws, 'Failed to update clothing', messageid)}}/**
   * Handle state change request*/
  private async handle.State.Change(ws: Authenticated.Web.Socket, message: W.S.Message): Promise<void> {
    try {
      const { interaction, status } = messagedata || {;
      if (!wssweet.Athena.Service) {
        thissend.Error(ws, 'Sweet Athena service not available');
        return}// Update interaction mode;
      if (interaction?mode) {
        await wssweetAthenaServiceset.Interaction.Mode(interactionmode, interactioncontext || '')}// Update user engagement;
      if (interaction?user.Engagement !== undefined) {
        wssweetAthenaServiceupdate.User.Engagement(interactionuser.Engagement);

      const current.State = wssweetAthenaServiceget.Current.State();
      thissend.Message(ws, {
        type: 'success',
        id: messageid,
        data: {
          message: 'State updated successfully',
          state: current.State,
          timestamp: new Date()toIS.O.String(),
        }})} catch (error) {
      loggererror('State change error instanceof Error ? errormessage : String(error) , undefined, error instanceof Error ? errormessage : String(error);
      thissend.Error(ws, 'Failed to update state', messageid)}}/**
   * Handle voice interaction*/
  private async handle.Voice.Interaction(
    ws: Authenticated.Web.Socket,
    message: W.S.Message): Promise<void> {
    try {
      const { text, audio.Data, expect.Response } = messagedata || {;
      if (!text && !audio.Data) {
        thissend.Error(ws, 'Text or audio data required for voice interaction');
        return;

      if (!wssweet.Athena.Service) {
        thissend.Error(ws, 'Sweet Athena service not available');
        return}// For now, we'll handle text input// Audio processing would require additional infrastructure;
      if (text) {
        // This would integrate with the Sweet Athena voice system;
        const response = {
          type: 'avatar_response',
          id: messageid,
          data: {
            text;
            audio.Url: expect.Response ? `/api/sweet-athena/audio/response/${Date.now()}` : undefined,
            personality: wssweetAthenaServiceget.Current.State()personalitymode,
            timestamp: new Date()toIS.O.String(),
          };
        thissend.Message(ws, response)}} catch (error) {
      loggererror('Voice interaction error instanceof Error ? errormessage : String(error) , undefined, error instanceof Error ? errormessage : String(error);
      thissend.Error(ws, 'Failed to process voice interaction', messageid)}}/**
   * Handle connection close*/
  private handle.Close(
    ws: Authenticated.Web.Socket,
    client.Id: string,
    code: number,
    reason: Buffer): void {
    loggerinfo('Web.Socket connection closed', undefined, {
      client.Id;
      user.Id: wsuser.Id,
      code;
      reason: reasonto.String()}),
    thiscleanup(ws, client.Id)}/**
   * Handle connection error*/
  private handle.Error(ws: Authenticated.Web.Socket, client.Id: string, error instanceof Error ? errormessage : String(error) Error): void {
    loggererror('Web.Socket connection error instanceof Error ? errormessage : String(error) , undefined, { error instanceof Error ? errormessage : String(error)client.Id, user.Id: wsuser.Id }),
    thiscleanup(ws, client.Id)}/**
   * Cleanup connection resources*/
  private cleanup(ws: Authenticated.Web.Socket, client.Id: string): void {
    // Remove from clients map;
    thisclientsdelete(client.Id)// Remove from user connections;
    if (wsuser.Id && thisuser.Connectionshas(wsuser.Id)) {
      const user.Connections = thisuser.Connectionsget(wsuser.Id)!
      user.Connectionsdelete(ws);
      if (user.Connectionssize === 0) {
        thisuser.Connectionsdelete(wsuser.Id)}}// Cleanup Sweet Athena service;
    if (wssweet.Athena.Service) {
      wssweet.Athena.Servicedestroy()}}/**
   * Send message to Web.Socket*/
  private send.Message(ws: Authenticated.Web.Socket, message: W.S.Message): void {
    if (wsready.State === WebSocketOP.E.N) {
      messagetimestamp = messagetimestamp || new Date()toIS.O.String();
      wssend(JS.O.N.stringify(message));
    }}/**
   * Send errormessage*/
  private send.Error(ws: Authenticated.Web.Socket, error.Message: string, message.Id?: string): void {
    thissend.Message(ws, {
      type: 'error instanceof Error ? errormessage : String(error),
      id: message.Id,
      data: {
        error instanceof Error ? errormessage : String(error) error.Message;
        timestamp: new Date()toIS.O.String(),
      }})}/**
   * Broadcast message to all connections for a user*/
  private broadcast.To.User(
    user.Id: string,
    message: W.S.Message,
    exclude.Ws?: Authenticated.Web.Socket): void {
    const user.Connections = thisuser.Connectionsget(user.Id);
    if (!user.Connections) return;
    for (const ws of user.Connections) {
      if (ws !== exclude.Ws && wsready.State === WebSocketOP.E.N) {
        thissend.Message(ws, message)}}}/**
   * Broadcast message to all authenticated connections*/
  public broadcast(message: W.S.Message): void {
    for (const [client.Id, ws] of thisclients) {
      if (wsis.Authenticated && wsready.State === WebSocketOP.E.N) {
        thissend.Message(ws, message)}}}/**
   * Close connection with code and reason*/
  private close.Connection(ws: Authenticated.Web.Socket, code: number, reason: string): void {
    if (wsready.State === WebSocketOP.E.N || wsready.State === WebSocketCONNECTI.N.G) {
      wsclose(code, reason)}}/**
   * Generate unique client I.D*/
  private generate.Client.Id(): string {
    return `client_${Date.now()}_${Mathrandom()to.String(36)substr(2, 9)}`}/**
   * Check rate limiting*/
  private check.Rate.Limit(identifier: string): boolean {
    const now = Date.now();
    const window.Start = now - 60000// 1 minute window;

    const current = thismessage.Countsget(identifier);
    if (!current || currentreset.Time < window.Start) {
      thismessage.Countsset(identifier, { count: 1, reset.Time: now }),
      return true;

    if (currentcount >= thisconfigmessage.Rate.Limit) {
      return false;

    currentcount++
    return true}/**
   * Start ping interval to keep connections alive*/
  private start.Ping.Interval(): void {
    thisping.Interval = set.Interval(() => {
      const now = Date.now();
      const stale.Threshold = now - thisconfigping.Interval * 2;
      for (const [client.Id, ws] of thisclients) {
        if (wslast.Ping && wslast.Ping < stale.Threshold) {
          loggerwarn('Closing stale Web.Socket connection', undefined, {
            client.Id;
            user.Id: wsuser.Id}),
          thisclose.Connection(ws, 1001, 'Connection stale')} else if (wsready.State === WebSocketOP.E.N) {
          thissend.Message(ws, { type: 'ping' })}}}, thisconfigping.Interval)}/**
   * Get connection statistics*/
  public get.Stats(): any {
    return {
      total.Connections: thisclientssize,
      authenticated.Connections: Arrayfrom(thisclientsvalues())filter((ws) => wsis.Authenticated),
        length;
      unique.Users: thisuser.Connectionssize,
      is.Running: thisis.Running,
      uptime: thisis.Running ? Date.now() : 0,
    }};

export default SweetAthenaWeb.Socket.Service;