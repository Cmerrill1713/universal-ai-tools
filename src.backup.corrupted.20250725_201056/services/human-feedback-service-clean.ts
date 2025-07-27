/**
 * Human-in-the-Loop Feedback Service*
 * Collects and processes human feedback to improve D.S.Py.and agent performance*/

import { Event.Emitter } from 'events';
import type { Supabase.Client } from '@supabase/supabase-js';
import { Web.Socket, Web.Socket.Server } from 'ws';
import { logger } from './utils/logger'// Core feedback interfaces;
export interface User.Feedback {
  feedback.Id: string,
  request.Id: string,
  feedback.Type: 'rating' | 'correction' | 'preference' | 'label',
  rating?: number// 1-5 stars;
  corrected.Response?: string;
  preferred.Response?: string;
  labels?: string[];
  comments?: string;
  timestamp: Date,
  user.Id?: string;
  session.Id?: string;
  metadata?: Record<string, any>;

export interface Feedback.Request {
  request.Id: string,
  agent.Id: string,
  original.Request: string,
  agent.Response: any,
  feedback.Type: string[],
  priority: 'low' | 'medium' | 'high',
  timeout?: number// ms to wait for feedback;
  callback?: (feedback: User.Feedback) => void,

export interface Feedback.Analytics {
  total.Feedback: number,
  average.Rating: number,
  feedback.By.Type: Record<string, number>
  improvement.Trends: any[],
  common.Issues: string[],
  agent.Performance: Record<string, number>;

export interface DSPyTraining.Data {
  training.Id: string,
  examples: {
    input: string,
    output: string,
    feedback: User.Feedback,
    quality_score: number}[],
  labels: string[],
  metadata: Record<string, any>
  created.At: Date,
}/**
 * Human Feedback Service for collecting and processing user feedback*/
export class Human.Feedback.Service.extends Event.Emitter {
  private supabase: Supabase.Client,
  private ws.Server?: Web.Socket.Server;
  private active.Feedback.Requests = new Map<string, Feedback.Request>();
  private connected.Clients = new Set<Web.Socket>();
  private feedback.History: User.Feedback[] = [],
  private training.Datasets: DSPy.Training.Data[] = [],
  constructor(supabase: Supabase.Client) {
    super();
    thissupabase = supabase;
    thissetup.Event.Listeners()}/**
   * Initialize the feedback service*/
  async initialize(ws.Port?: number): Promise<void> {
    try {
      loggerinfo('🤝 Initializing Human Feedback Service.')// Setup database tables;
      await thissetup.Feedback.Tables()// Setup Web.Socket.server for real-time feedback;
      if (ws.Port) {
        await thissetupWeb.Socket.Server(ws.Port)}// Load existing feedback for analytics;
      await thisload.Feedback.History();
      loggerinfo('✅ Human Feedback Service ready')} catch (error) {
      loggererror('❌ Failed to initialize Human Feedback Service:', error);
      throw error}}/**
   * Request feedback from users*/
  async request.Feedback(request: Feedback.Request): Promise<string> {
    const feedback.Id = `feedback_${Date.now()}_${Mathrandom()to.String(36)substr(2, 9)}`;
    loggerinfo(`📝 Requesting feedback for ${requestagent.Id}`, {
      feedback.Id;
      request.Id: requestrequest.Id,
      priority: requestpriority,
      types: requestfeedback.Type})// Store the request,
    thisactive.Feedback.Requestsset(feedback.Id, {
      .request;
      request.Id: feedback.Id})// Send to connected clients via Web.Socket,
    thisbroadcast.Feedback.Request({
      feedback.Id.request})// Set timeout if specified;
    if (requesttimeout) {
      set.Timeout(() => {
        if (thisactive.Feedback.Requestshas(feedback.Id)) {
          loggerwarn(`⏰ Feedback request ${feedback.Id} timed out`);
          thisactive.Feedback.Requestsdelete(feedback.Id)}}, requesttimeout);

    return feedback.Id}/**
   * Submit user feedback*/
  async submit.Feedback(feedback: Partial<User.Feedback>): Promise<User.Feedback> {
    const complete.Feedback: User.Feedback = {
      feedback.Id:
        feedbackfeedback.Id || `fb_${Date.now()}_${Mathrandom()to.String(36)substr(2, 9)}`;
      request.Id: feedbackrequest.Id!
      feedback.Type: feedbackfeedback.Type!
      rating: feedbackrating,
      corrected.Response: feedbackcorrected.Response,
      preferred.Response: feedbackpreferred.Response,
      labels: feedbacklabels || [],
      comments: feedbackcomments,
      timestamp: new Date(),
      user.Id: feedbackuser.Id,
      session.Id: feedbacksession.Id,
      metadata: feedbackmetadata || {},
    loggerinfo(`💬 Received feedback: ${complete.Feedbackfeedback.Type}`, {
      feedback.Id: complete.Feedbackfeedback.Id,
      request.Id: complete.Feedbackrequest.Id,
      rating: complete.Feedbackrating,
      has.Correction: !!complete.Feedbackcorrected.Response})// Store in database,
    await thisstore.Feedback(complete.Feedback)// Add to local history;
    thisfeedback.Historypush(complete.Feedback)// Process for D.S.Py.training if applicable;
    await thisprocessFeedback.For.Training(complete.Feedback)// Notify connected clients;
    thisbroadcast.Feedback.Update(complete.Feedback)// Handle callback if request exists;
    const request = thisactive.Feedback.Requestsget(complete.Feedbackrequest.Id);
    if (request && requestcallback) {
      requestcallback(complete.Feedback);
      thisactive.Feedback.Requestsdelete(complete.Feedbackrequest.Id)}// Emit event for other systems;
    thisemit('feedback_received', complete.Feedback);
    return complete.Feedback}/**
   * Get feedback analytics and insights*/
  async get.Feedback.Analytics(
    agent.Id?: string;
    time.Range?: { start: Date, end: Date }): Promise<Feedback.Analytics> {
    try {
      let query = thissupabasefrom('user_feedback')select('*');
      if (agent.Id) {
        // Join with feedbackrequests to filter by agent;
        query = queryeq('metadata->>agent.Id', agent.Id);

      if (time.Range) {
        query = query;
          gte('timestamp', timeRangestarttoIS.O.String());
          lte('timestamp', timeRangeendtoIS.O.String());

      const { data, error } = await queryorder('timestamp', { ascending: false }),
      if (error) throw error;
      const feedback = data || [];
      const total.Feedback = feedbacklength// Calculate average rating;
      const ratings.Data = feedbackfilter((f) => frating)map((f) => frating);
      const average.Rating =
        ratings.Datalength > 0 ? ratings.Datareduce((a, b) => a + b, 0) / ratings.Datalength : 0// Group by feedback type;
      const feedback.By.Type: Record<string, number> = {;
      feedbackfor.Each((f) => {
        feedback.By.Type[ffeedback_type] = (feedback.By.Type[ffeedback_type] || 0) + 1})// Calculate agent performance if not filtered by specific agent;
      const agent.Performance: Record<string, number> = {;
      if (!agent.Id) {
        const agent.Feedback = new Map<string, User.Feedback[]>();
        feedbackfor.Each((f) => {
          const agent = fmetadata?agent.Id || 'unknown';
          if (!agent.Feedbackhas(agent)) {
            agent.Feedbackset(agent, []);
          agent.Feedbackget(agent)!push(f)})// Calculate average rating per agent;
        for (const [agent.Id, feedbacks] of agent.Feedback) {
          const ratings = feedbacksfilter((f) => frating)map((f) => frating!);
          if (ratingslength > 0) {
            performance[agent.Id] = ratingsreduce((a, b) => a + b, 0) / ratingslength}}}// Extract common issues from comments;
      const common.Issues = thisextract.Common.Issues(feedback)// Calculate improvement trends (simplified);
      const improvement.Trends = thiscalculate.Improvement.Trends(feedback);
      return {
        total.Feedback;
        average.Rating;
        feedback.By.Type;
        improvement.Trends;
        common.Issues;
        agent.Performance}} catch (error) {
      loggererror('Failed to get feedback analytics:', error);
      throw error}}/**
   * Generate D.S.Py.training dataset from collected feedback*/
  async generateDSPy.Training.Data(
    criteria: {
      min.Rating?: number;
      include.Corrections?: boolean;
      agent.Ids?: string[];
      max.Examples?: number} = {}): Promise<DSPy.Training.Data> {
    const training.Id = `training_${Date.now()}_${Mathrandom()to.String(36)substr(2, 9)}`;
    loggerinfo('🧠 Generating D.S.Py.training dataset', {
      training.Id;
      criteria});
    try {
      let query = thissupabase;
        from('user_feedback');
        select('*, feedbackrequests(*)');
        order('timestamp', { ascending: false })// Apply filters,
      if (criteriamin.Rating) {
        query = querygte('rating', criteriamin.Rating);

      if (criteriamax.Examples) {
        query = querylimit(criteriamax.Examples);

      const { data, error } = await query;
      if (error) throw error;
      const feedback.Data = data || [];
      const examples: any[] = [],
      const labels = new Set<string>();
      for (const feedback of feedback.Data) {
        // Skip if agent not in allowed list;
        if (criteriaagent.Ids && !criteriaagent.Ids.includes(feedbackmetadata?agent.Id)) {
          continue}// Create training example;
        const example = {
          input: feedbackfeedbackrequests?originalrequest || '',
          output: criteriainclude.Corrections && feedbackcorrected_response? feedbackcorrected_response: feedbackfeedbackrequests?agent_response || '',
          feedback;
          quality_score: thiscalculate.Quality.Score(feedback),
        examplespush(example)// Collect labels;
        if (feedbacklabels) {
          feedbacklabelsfor.Each((label: string) => labelsadd(label))},

      const training.Data: DSPy.Training.Data = {
        training.Id;
        examples;
        labels: Arrayfrom(labels),
        metadata: {
          criteria;
          generated.At: new Date()toIS.O.String(),
          total.Examples: exampleslength,
          average.Quality: examplesreduce((sum, ex) => sum + exquality_score, 0) / exampleslength;
        created.At: new Date()}// Store training dataset,
      await thisstore.Training.Dataset(training.Data);
      thistraining.Datasetspush(training.Data);
      loggerinfo('✅ D.S.Py.training dataset generated', {
        training.Id;
        example.Count: exampleslength,
        label.Count: labelssize}),
      return training.Data} catch (error) {
      loggererror('Failed to generate D.S.Py.training data:', error);
      throw error}}/**
   * Export feedback data for external analysis*/
  async export.Feedback.Data(
    format: 'json' | 'csv' | 'dspy',
    filters: {
      agent.Ids?: string[];
      date.Range?: { start: Date, end: Date ,
      feedback.Types?: string[];
      min.Rating?: number} = {}): Promise<any> {
    try {
      let query = thissupabasefrom('user_feedback')select('*, feedbackrequests(*)')// Apply filters;
      if (filtersdate.Range) {
        query = query;
          gte('timestamp', filtersdateRangestarttoIS.O.String());
          lte('timestamp', filtersdateRangeendtoIS.O.String());

      if (filtersfeedback.Types) {
        query = queryin('feedback_type', filtersfeedback.Types);

      if (filtersmin.Rating) {
        query = querygte('rating', filtersmin.Rating);

      const { data, error } = await queryorder('timestamp', { ascending: false }),
      if (error) throw error;
      const feedback.Data = data || []// Filter by agent I.Ds.if specified;
      let filtered.Data = feedback.Data;
      if (filtersagent.Ids) {
        filtered.Data = feedback.Datafilter((f) => filtersagent.Ids!includes(fmetadata?agent.Id));

      switch (format) {
        case 'json':
          return {
            metadata: {
              exported.At: new Date()toIS.O.String(),
              total.Records: filtered.Datalength,
              filters;
            data: filtered.Data,
        case 'csv':
          return thisformatAsC.S.V(filtered.Data);
        case 'dspy':
          return thisformatForD.S.Py(filtered.Data);
        default:
          throw new Error(`Unsupported export format: ${format}`)}} catch (error) {
      loggererror('Failed to export feedback data:', error);
      throw error}}/**
   * Setup Web.Socket.server for real-time feedback*/
  private async setupWeb.Socket.Server(port: number): Promise<void> {
    thisws.Server = new Web.Socket.Server({ port });
    thisws.Serveron('connection', (ws: Web.Socket) => {
      loggerinfo('👥 New feedback client connected');
      thisconnected.Clientsadd(ws);
      wson('message', async (message: Buffer) => {
        try {
          const data = JS.O.N.parse(messageto.String());
          if (datatype === 'submit_feedback') {
            await thissubmit.Feedback(datafeedback)}} catch (error) {
          loggererror('Web.Socket.message error instanceof Error ? error.message : String(error)', error);
          wssend(
            JS.O.N.stringify({
              type: 'error',
              message: 'Invalid message format'}))}}),
      wson('close', () => {
        loggerinfo('👋 Feedback client disconnected');
        thisconnected.Clientsdelete(ws)})// Send welcome message;
      wssend(
        JS.O.N.stringify({
          type: 'welcome',
          message: 'Connected to Human Feedback Service'}))}),
    loggerinfo(`🌐 Feedback Web.Socket.server listening on port ${port}`)}/**
   * Broadcast feedback request to connected clients*/
  private broadcast.Feedback.Request(request: any): void {
    const message = JS.O.N.stringify({
      type: 'feedbackrequest',
      data: request}),
    thisconnected.Clientsfor.Each((client) => {
      if (clientready.State === WebSocketOP.E.N) {
        clientsend(message)}})}/**
   * Broadcast feedback update to connected clients*/
  private broadcast.Feedback.Update(feedback: User.Feedback): void {
    const message = JS.O.N.stringify({
      type: 'feedback_update',
      data: feedback}),
    thisconnected.Clientsfor.Each((client) => {
      if (clientready.State === WebSocketOP.E.N) {
        clientsend(message)}})}/**
   * Setup database tables for feedback storage*/
  private async setup.Feedback.Tables(): Promise<void> {
    try {
      // This would create the necessary tables// For now, assume they exist or handle creation in migration files;
      loggerinfo('📊 Setting up feedback database tables')} catch (error) {
      loggerwarn('Database setup failed:', error)}}/**
   * Store feedback in database*/
  private async store.Feedback(feedback: User.Feedback): Promise<void> {
    try {
      const { error } = await thissupabasefrom('user_feedback')insert({
        feedback_id: feedbackfeedback.Id,
        request_id: feedbackrequest.Id,
        feedback_type: feedbackfeedback.Type,
        rating: feedbackrating,
        corrected_response: feedbackcorrected.Response,
        preferred_response: feedbackpreferred.Response,
        labels: feedbacklabels,
        comments: feedbackcomments,
        timestamp: feedbacktimestamptoIS.O.String(),
        user_id: feedbackuser.Id,
        session_id: feedbacksession.Id,
        metadata: feedbackmetadata}),
      if (error) {
        loggerwarn('Could not store feedback:', error)}} catch (error) {
      loggerwarn('Feedback storage failed:', error)}}/**
   * Process feedback for D.S.Py.training*/
  private async processFeedback.For.Training(feedback: User.Feedback): Promise<void> {
    try {
      // Only process high-quality feedback;
      if (feedbackrating && feedbackrating >= 4) {
        // This would trigger D.S.Py.retraining;
        thisemit('training_data_available', {
          feedback;
          quality: 'high'})}// Process corrections for immediate learning,
      if (feedbackcorrected.Response) {
        thisemit('correction_received', {
          original: feedbackrequest.Id,
          correction: feedbackcorrected.Response,
          feedback})}} catch (error) {
      loggerwarn('Failed to process feedback for training:', error)}}/**
   * Load existing feedback history*/
  private async load.Feedback.History(): Promise<void> {
    try {
      const { data, error } = await thissupabase;
        from('user_feedback');
        select('*');
        order('timestamp', { ascending: false }),
        limit(1000);
      if (data) {
        thisfeedback.History = datamap(thismapDatabase.To.Feedback);
        loggerinfo(`📚 Loaded ${thisfeedback.Historylength} feedback records`)}} catch (error) {
      loggerwarn('Could not load feedback history:', error)}}/**
   * Store training dataset*/
  private async store.Training.Dataset(dataset: DSPy.Training.Data): Promise<void> {
    try {
      const { error } = await thissupabasefrom('dspy_training_datasets')insert({
        training_id: datasettraining.Id,
        examples: datasetexamples,
        labels: datasetlabels,
        metadata: datasetmetadata,
        created_at: datasetcreatedAttoIS.O.String()}),
      if (error) {
        loggerwarn('Could not store training dataset:', error)}} catch (error) {
      loggerwarn('Training dataset storage failed:', error)}}/**
   * Calculate quality score from feedback*/
  private calculate.Quality.Score(feedback: any): number {
    let score = 0.5// Base score// Rating contribution;
    if (feedbackrating) {
      score = feedbackrating / 5.0, // Normalize to 0-1}// Boost for corrections (indicates engagement);
    if (feedbackcorrected_response) {
      score = Math.min(1.0, score + 0.1)}// Boost for detailed comments;
    if (feedbackcomments && feedbackcommentslength > 20) {
      score = Math.min(1.0, score + 0.05)}// Boost for labels (indicates structured feedback);
    if (feedbacklabels && feedbacklabelslength > 0) {
      score = Math.min(1.0, score + 0.05);

    return score}/**
   * Extract common issues from feedback comments*/
  private extract.Common.Issues(feedback: any[]): string[] {
    const issue.Keywords = [
      'slow';
      'error';
      'wrong';
      'confusing';
      'unclear';
      'incomplete';
      'inaccurate';
      'unhelpful';
      'irrelevant';
      'broken'];

    const issue.Counts: Record<string, number> = {;
    feedbackfor.Each((f) => {
      if (fcomments) {
        const comment.Lower = fcommentsto.Lower.Case();
        issue.Keywordsfor.Each((keyword) => {
          if (comment.Lower.includes(keyword)) {
            issue.Counts[keyword] = (issue.Counts[keyword] || 0) + 1}})}})// Return top 5 issues;
    return Objectentries(issue.Counts);
      sort((a, b) => b[1] - a[1]);
      slice(0, 5);
      map(([issue]) => issue)}/**
   * Calculate improvement trends*/
  private calculate.Improvement.Trends(feedback: any[]): any[] {
    // Group feedback by month and calculate average ratings;
    const monthly.Data: Record<string, { ratings: number[], count: number }> = {,
    feedbackfor.Each((f) => {
      if (frating && ftimestamp) {
        const month = new Date(ftimestamp)toIS.O.String()slice(0, 7), // YY.Y.Y-M.M;
        if (!monthly.Data[month]) {
          monthly.Data[month] = { ratings: [], count: 0 },
        monthly.Data[month]ratingspush(frating);
        monthly.Data[month]count++}});
    return Objectentries(monthly.Data);
      map(([month, data]) => ({
        month;
        average.Rating: dataratingsreduce((a, b) => a + b, 0) / dataratingslength;
        feedback.Count: datacount})),
      sort((a, b) => amonthlocale.Compare(bmonth))}/**
   * Format data as C.S.V*/
  private formatAsC.S.V(data: any[]): string {
    if (datalength === 0) return '';
    const headers = [
      'feedback_id';
      'request_id';
      'feedback_type';
      'rating';
      'comments';
      'timestamp';
      'user_id';
      'agent_id'];
    const csv.Rows = [headersjoin(',')],

    datafor.Each((item) => {
      const row = [
        itemfeedback_id;
        itemrequest_id;
        itemfeedback_type;
        itemrating || '';
        `"${(itemcomments || '')replace(/"/g, '""')}"`;
        itemtimestamp;
        itemuser_id || '';
        itemmetadata?agent.Id || ''];
      csv.Rowspush(rowjoin(','))});
    return csv.Rowsjoin('\n')}/**
   * Format data for D.S.Py.consumption*/
  private formatForD.S.Py(data: any[]): any {
    return {
      examples: data,
        filter((item) => itemfeedbackrequests);
        map((item) => ({
          input: itemfeedbackrequestsoriginalrequest,
          output: itemcorrected_response || itemfeedbackrequestsagent_response,
          rating: itemrating,
          feedback_type: itemfeedback_type,
          metadata: {
            feedback_id: itemfeedback_id,
            timestamp: itemtimestamp,
            agent_id: itemmetadata?agent.Id}})),
      metadata: {
        format: 'dspy_training',
        version: '1.0',
        generated_at: new Date()toIS.O.String()}}}/**
   * Map database record to User.Feedback.interface*/
  private mapDatabase.To.Feedback(db.Record: any): User.Feedback {
    return {
      feedback.Id: db.Recordfeedback_id,
      request.Id: db.Recordrequest_id,
      feedback.Type: db.Recordfeedback_type,
      rating: db.Recordrating,
      corrected.Response: db.Recordcorrected_response,
      preferred.Response: db.Recordpreferred_response,
      labels: db.Recordlabels || [],
      comments: db.Recordcomments,
      timestamp: new Date(db.Recordtimestamp),
      user.Id: db.Recorduser_id,
      session.Id: db.Recordsession_id,
      metadata: db.Recordmetadata || {}}}/**
   * Setup event listeners*/
  private setup.Event.Listeners(): void {
    thison('feedback_received', (feedback) => {
      loggerdebug('📝 Feedback event processed', {
        feedback.Id: feedbackfeedback.Id,
        type: feedbackfeedback.Type})}),
    thison('training_data_available', (data) => {
      loggerdebug('🧠 Training data event processed', {
        quality: dataquality})})}/**
   * Shutdown the service*/
  async shutdown(): Promise<void> {
    loggerinfo('🤝 Shutting down Human Feedback Service')// Close Web.Socket.server;
    if (thisws.Server) {
      thisws.Serverclose()}// Close client connections;
    thisconnected.Clientsfor.Each((client) => {
      clientclose()})// Clear data;
    thisactive.Feedback.Requestsclear();
    thisconnected.Clientsclear();
    loggerinfo('✅ Human Feedback Service shutdown complete')};

export default Human.Feedback.Service;