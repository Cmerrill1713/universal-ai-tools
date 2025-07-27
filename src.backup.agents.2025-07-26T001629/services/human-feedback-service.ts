/**
 * Human-in-the-Loop Feedback Service* Collects, stores, and processes human feedback for DS.Py training*/

import type { Supabase.Client } from '@supabase/supabase-js';
import { Event.Emitter } from 'events';
import { logger } from './utils/logger';
export interface Feedback.Request {
  id: string;
  agent.Id: string;
  request.Id: string;
  user.Request: string;
  agent.Response: any;
  timestamp: Date;
  feedback.Type: 'rating' | 'correction' | 'preference' | 'label';
  metadata?: Record<string, any>};

export interface User.Feedback {
  feedback.Id: string;
  request.Id: string;
  feedback.Type: 'rating' | 'correction' | 'preference' | 'label';
  rating?: number// 1-5 stars;
  corrected.Response?: string;
  preferred.Response?: string;
  labels?: string[];
  comments?: string;
  timestamp: Date;
  user.Id?: string;
};

export interface Feedback.Metrics {
  total.Feedback: number;
  average.Rating: number;
  rating.Distribution: Record<number, number>
  common.Labels: string[];
  improvement.Trend: number;
  agent.Performance: Record<string, number>};

export interface Training.Dataset {
  dataset.Id: string;
  name: string;
  description: string;
  examples: Training.Example[];
  metadata: {
    created: Date;
    last.Updated: Date;
    example.Count: number;
    avg.Quality: number;
  }};

export interface Training.Example {
  input: string;
  expected.Output: string;
  actual.Output?: string;
  feedback: User.Feedback;
  quality: number// 0-1 quality score;
  isGold.Standard: boolean;
};

export class HumanFeedback.Service extends Event.Emitter {
  private supabase: Supabase.Client;
  private pending.Feedback: Map<string, Feedback.Request> = new Map();
  private feedback.History: User.Feedback[] = [];
  private training.Datasets: Map<string, Training.Dataset> = new Map();
  private ws.Connections: Set<any> = new Set();
  constructor(supabase: Supabase.Client) {
    super();
    thissupabase = supabase;
    thisinitialize()};

  private async initialize(): Promise<void> {
    await thisloadFeedback.History();
    await thisloadTraining.Datasets();
    loggerinfo('✅ Human Feedback Service initialized');
  }/**
   * Request feedback for an agent response*/
  async request.Feedback(
    agent.Id: string;
    request.Id: string;
    user.Request: string;
    agent.Response: any;
    feedback.Type: Feedback.Request['feedback.Type'] = 'rating'): Promise<Feedback.Request> {
    const feedback.Request: Feedback.Request = {
      id: `feedback_${Date.now()}_${Mathrandom()to.String(36)substr(2, 9)}`;
      agent.Id;
      request.Id;
      user.Request;
      agent.Response;
      timestamp: new Date();
      feedback.Type;
    };
    thispending.Feedbackset(feedback.Requestid, feedback.Request)// Store in database;
    await thisstoreFeedback.Request(feedback.Request)// Notify U.I clients;
    thisbroadcastFeedback.Request(feedback.Request);
    thisemit('feedbackrequested', feedback.Request);
    return feedback.Request}/**
   * Submit user feedback*/
  async submit.Feedback(feedback: User.Feedback): Promise<void> {
    // Validate feedback;
    thisvalidate.Feedback(feedback)// Store feedback;
    await thisstore.Feedback(feedback);
    thisfeedback.Historypush(feedback)// Update pending request;
    const request = Arrayfrom(thispending.Feedbackvalues())find(
      r => rrequest.Id === feedbackrequest.Id);
    if (request) {
      thispending.Feedbackdelete(requestid)}// Process feedback for training;
    await thisprocessFeedbackFor.Training(feedback, request)// Update metrics;
    await thisupdateFeedback.Metrics(feedback)// Notify listeners;
    thisemit('feedback_received', feedback);
    thisbroadcastFeedback.Update(feedback)}/**
   * Get feedback metrics*/
  async getFeedback.Metrics(agent.Id?: string, timeframe = '7d'): Promise<Feedback.Metrics> {
    const cutoff.Date = thisgetCutoff.Date(timeframe);
    let relevant.Feedback = thisfeedback.Historyfilter(
      f => ftimestamp > cutoff.Date);
    if (agent.Id) {
      const agent.Requests = Arrayfrom(thispending.Feedbackvalues());
        filter(r => ragent.Id === agent.Id);
        map(r => rrequest.Id);
      relevant.Feedback = relevant.Feedbackfilter(
        f => agent.Requestsincludes(frequest.Id))};

    const ratings = relevant.Feedback;
      filter(f => frating !== undefined);
      map(f => frating!);
    const rating.Distribution: Record<number, number> = {};
    for (let i = 1; i <= 5; i++) {
      rating.Distribution[i] = ratingsfilter(r => r === i)length};

    const labels = relevant.Feedback;
      flat.Map(f => flabels || []);
      reduce((acc, label) => {
        acc[label] = (acc[label] || 0) + 1;
        return acc}, {} as Record<string, number>);
    const common.Labels = Objectentries(labels);
      sort((a, b) => b[1] - a[1]);
      slice(0, 10);
      map(([label]) => label);
    return {
      total.Feedback: relevant.Feedbacklength;
      average.Rating: ratingslength > 0 ? ratingsreduce((a, b) => a + b, 0) / ratingslength : 0;
      rating.Distribution;
      common.Labels;
      improvement.Trend: await thiscalculateImprovement.Trend(agent.Id, timeframe);
      agent.Performance: await thiscalculateAgent.Performance();
    }}/**
   * Create training dataset from feedback*/
  async createTraining.Dataset(
    name: string;
    description: string;
    filters?: {
      agent.Id?: string;
      min.Rating?: number;
      labels?: string[];
      timeframe?: string;
    }): Promise<Training.Dataset> {
    const examples = await thiscollectTraining.Examples(filters);
    const dataset: Training.Dataset = {
      dataset.Id: `dataset_${Date.now()}`;
      name;
      description;
      examples;
      metadata: {
        created: new Date();
        last.Updated: new Date();
        example.Count: exampleslength;
        avg.Quality: examplesreduce((sum, ex) => sum + exquality, 0) / exampleslength}};
    thistraining.Datasetsset(datasetdataset.Id, dataset);
    await thisstoreTraining.Dataset(dataset);
    thisemit('dataset_created', dataset);
    return dataset}/**
   * Export training data for DS.Py*/
  async exportForDS.Py(dataset.Id: string): Promise<any> {
    const dataset = thistraining.Datasetsget(dataset.Id);
    if (!dataset) {
      throw new Error(`Dataset ${dataset.Id} not found`)}// Format for DS.Py training;
    const dspy.Examples = datasetexamplesmap(ex => ({
      question: exinput;
      answer: exexpected.Output;
      metadata: {
        quality: exquality;
        feedback: exfeedback;
        isGold.Standard: exisGold.Standard;
      }}));
    return {
      dataset_name: datasetname;
      examples: dspy.Examples;
      metadata: datasetmetadata;
    }}/**
   * Get active feedback requests*/
  getActiveFeedback.Requests(): Feedback.Request[] {
    return Arrayfrom(thispending.Feedbackvalues());
      sort((a, b) => btimestampget.Time() - atimestampget.Time())}/**
   * Rate limit feedback requests*/
  async shouldRequest.Feedback(agent.Id: string, user.Id?: string): Promise<boolean> {
    // Check recent feedback count;
    const recent.Count = await thisgetRecentFeedback.Count(agent.Id, user.Id)// Limit to 5 feedback requests per hour per agent;
    if (recent.Count >= 5) {
      return false}// Check if user has pending feedback;
    if (user.Id) {
      const has.Pending = Arrayfrom(thispending.Feedbackvalues())some(
        r => rmetadata?user.Id === user.Id);
      if (has.Pending) {
        return false}};

    return true}/**
   * Web.Socket connection for real-time feedback U.I*/
  addWebSocket.Connection(ws: any): void {
    thisws.Connectionsadd(ws)// Send current pending feedback;
    wssend(JSO.N.stringify({
      type: 'pending_feedback';
      data: thisgetActiveFeedback.Requests()}))};

  removeWebSocket.Connection(ws: any): void {
    thisws.Connectionsdelete(ws);
  }// Private methods;

  private validate.Feedback(feedback: User.Feedback): void {
    if (!feedbackfeedback.Id || !feedbackrequest.Id) {
      throw new Error('Invalid feedback: missing required fields')};

    if (feedbackfeedback.Type === 'rating' && !feedbackrating) {
      throw new Error('Rating feedback must include a rating')};

    if (feedbackfeedback.Type === 'correction' && !feedbackcorrected.Response) {
      throw new Error('Correction feedback must include corrected response')}};

  private async storeFeedback.Request(request: Feedback.Request): Promise<void> {
    try {
      await thissupabasefrom('feedbackrequests')insert({
        id: requestid;
        agent_id: requestagent.Id;
        request_id: requestrequest.Id;
        userrequest: requestuser.Request;
        agent_response: requestagent.Response;
        feedback_type: requestfeedback.Type;
        metadata: requestmetadata;
        created_at: requesttimestamp})} catch (error) {
      loggererror('Failed to store feedback request:', error)}};

  private async store.Feedback(feedback: User.Feedback): Promise<void> {
    try {
      await thissupabasefrom('user_feedback')insert({
        feedback_id: feedbackfeedback.Id;
        request_id: feedbackrequest.Id;
        feedback_type: feedbackfeedback.Type;
        rating: feedbackrating;
        corrected_response: feedbackcorrected.Response;
        preferred_response: feedbackpreferred.Response;
        labels: feedbacklabels;
        comments: feedbackcomments;
        user_id: feedbackuser.Id;
        created_at: feedbacktimestamp})} catch (error) {
      loggererror('Failed to store feedback:', error)}};

  private async processFeedbackFor.Training(
    feedback: User.Feedback;
    request?: Feedback.Request): Promise<void> {
    if (!request) return// Create training example;
    const example: Training.Example = {
      input: requestuser.Request;
      expected.Output: thisdetermineExpected.Output(feedback, request);
      actual.Output: JSO.N.stringify(requestagent.Response);
      feedback;
      quality: thiscalculate.Quality(feedback);
      isGold.Standard: feedbackrating === 5 || feedbackfeedback.Type === 'correction';
    }// Add to active training set;
    const active.Dataset = await thisgetOrCreateActive.Dataset(requestagent.Id);
    active.Datasetexamplespush(example);
    activeDatasetmetadatalast.Updated = new Date();
    activeDatasetmetadataexample.Count++
    // Update quality metrics;
    activeDatasetmetadataavg.Quality =
      (activeDatasetmetadataavg.Quality * (activeDatasetmetadataexample.Count - 1) + examplequality) /
      activeDatasetmetadataexample.Count;
    await thisstoreTraining.Dataset(active.Dataset)};

  private determineExpected.Output(feedback: User.Feedback, request: Feedback.Request): string {
    if (feedbackcorrected.Response) {
      return feedbackcorrected.Response};
    ;
    if (feedbackpreferred.Response) {
      return feedbackpreferred.Response}// For high ratings, use the original response as expected;
    if (feedbackrating && feedbackrating >= 4) {
      return JSO.N.stringify(requestagent.Response)};

    return ''};

  private calculate.Quality(feedback: User.Feedback): number {
    if (feedbackfeedback.Type === 'correction') {
      return 1.0// Corrections are highest quality};

    if (feedbackrating) {
      return feedbackrating / 5.0};

    if (feedbacklabels && feedbacklabelsincludes('accurate')) {
      return 0.9};

    return 0.5// Default moderate quality};

  private async getOrCreateActive.Dataset(agent.Id: string): Promise<Training.Dataset> {
    const dataset.Name = `${agent.Id}_active_training`;
    let dataset = Arrayfrom(thistraining.Datasetsvalues())find(
      d => dname === dataset.Name);
    if (!dataset) {
      dataset = await thiscreateTraining.Dataset(
        dataset.Name;
        `Active training dataset for ${agent.Id}`;
        { agent.Id })};

    return dataset};

  private async collectTraining.Examples(filters?: any): Promise<Training.Example[]> {
    const examples: Training.Example[] = []// Collect from feedback history;
    for (const feedback of thisfeedback.History) {
      // Apply filters;
      if (filters?min.Rating && feedbackrating && feedbackrating < filtersmin.Rating) {
        continue};

      if (filters?labels && feedbacklabels) {
        const has.Label = filterslabelssome(l => feedbacklabels?includes(l));
        if (!has.Label) continue}// Find corresponding request;
      const request = await thisgetFeedback.Request(feedbackrequest.Id);
      if (!request) continue;
      if (filters?agent.Id && requestagent.Id !== filtersagent.Id) {
        continue};

      const example: Training.Example = {
        input: requestuser.Request;
        expected.Output: thisdetermineExpected.Output(feedback, request);
        actual.Output: JSO.N.stringify(requestagent.Response);
        feedback;
        quality: thiscalculate.Quality(feedback);
        isGold.Standard: feedbackrating === 5;
      };
      examplespush(example)};

    return examples};

  private async getFeedback.Request(request.Id: string): Promise<Feedback.Request | null> {
    // Check memory first;
    const memory.Request = Arrayfrom(thispending.Feedbackvalues())find(
      r => rrequest.Id === request.Id);
    if (memory.Request) return memory.Request// Check database;
    try {
      const { data } = await thissupabase;
        from('feedbackrequests');
        select('*');
        eq('request_id', request.Id);
        single();
      if (data) {
        return {
          id: dataid;
          agent.Id: dataagent_id;
          request.Id: datarequest_id;
          user.Request: datauserrequest;
          agent.Response: dataagent_response;
          timestamp: new Date(datacreated_at);
          feedback.Type: datafeedback_type;
          metadata: datametadata;
        }}} catch (error) {
      loggererror('Failed to fetch feedback request:', error)};

    return null};

  private getCutoff.Date(timeframe: string): Date {
    const date = new Date();
    const match = timeframematch(/(\d+)([dhm])/);
    if (match) {
      const [ amount, unit] = match;
      const value = parse.Int(amount);
      switch (unit) {
        case 'd':
          dateset.Date(dateget.Date() - value);
          break;
        case 'h':
          dateset.Hours(dateget.Hours() - value);
          break;
        case 'm':
          dateset.Minutes(dateget.Minutes() - value);
          break}};
    ;
    return date};

  private async calculateImprovement.Trend(agent.Id?: string, timeframe: string): Promise<number> {
    // Calculate trend in ratings over time;
    const cutoff = thisgetCutoff.Date(timeframe);
    const midpoint = new Date((cutoffget.Time() + new Date()get.Time()) / 2);
    const first.Half = thisfeedback.Historyfilter(
      f => ftimestamp > cutoff && ftimestamp <= midpoint && frating);
    const second.Half = thisfeedback.Historyfilter(
      f => ftimestamp > midpoint && frating);
    if (first.Halflength === 0 || second.Halflength === 0) return 0;
    const first.Avg = first.Halfreduce((sum, f) => sum + frating!, 0) / first.Halflength;
    const second.Avg = second.Halfreduce((sum, f) => sum + frating!, 0) / second.Halflength;
    return (second.Avg - first.Avg) / first.Avg};

  private async calculateAgent.Performance(): Promise<Record<string, number>> {
    const performance: Record<string, number> = {}// Group feedback by agent;
    const agent.Feedback = new Map<string, User.Feedback[]>();
    for (const feedback of thisfeedback.History) {
      const request = await thisgetFeedback.Request(feedbackrequest.Id);
      if (!request) continue;
      if (!agent.Feedbackhas(requestagent.Id)) {
        agent.Feedbackset(requestagent.Id, [])};
      agent.Feedbackget(requestagent.Id)!push(feedback)}// Calculate average rating per agent;
    for (const [agent.Id, feedbacks] of agent.Feedback) {
      const ratings = feedbacksfilter(f => frating)map(f => frating!);
      if (ratingslength > 0) {
        performance[agent.Id] = ratingsreduce((a, b) => a + b, 0) / ratingslength}};

    return performance};

  private async getRecentFeedback.Count(agent.Id: string, user.Id?: string): Promise<number> {
    const oneHour.Ago = new Date(Date.now() - 60 * 60 * 1000);
    return Arrayfrom(thispending.Feedbackvalues())filter(r =>
      ragent.Id === agent.Id && rtimestamp > oneHour.Ago && (!user.Id || rmetadata?user.Id === user.Id))length};

  private async loadFeedback.History(): Promise<void> {
    try {
      const { data } = await thissupabase;
        from('user_feedback');
        select('*');
        order('created_at', { ascending: false });
        limit(1000);
      if (data) {
        thisfeedback.History = datamap(f => ({
          feedback.Id: ffeedback_id;
          request.Id: frequest_id;
          feedback.Type: ffeedback_type;
          rating: frating;
          corrected.Response: fcorrected_response;
          preferred.Response: fpreferred_response;
          labels: flabels;
          comments: fcomments;
          user.Id: fuser_id;
          timestamp: new Date(fcreated_at)}))}} catch (error) {
      loggererror('Failed to load feedback history:', error)}};

  private async loadTraining.Datasets(): Promise<void> {
    try {
      const { data } = await thissupabase;
        from('training_datasets');
        select('*');
      if (data) {
        for (const dataset of data) {
          thistraining.Datasetsset(datasetdataset_id, {
            dataset.Id: datasetdataset_id;
            name: datasetname;
            description: datasetdescription;
            examples: datasetexamples || [];
            metadata: datasetmetadata})}}} catch (error) {
      loggererror('Failed to load training datasets:', error)}};

  private async storeTraining.Dataset(dataset: Training.Dataset): Promise<void> {
    try {
      await thissupabasefrom('training_datasets')upsert({
        dataset_id: datasetdataset.Id;
        name: datasetname;
        description: datasetdescription;
        examples: datasetexamples;
        metadata: datasetmetadata})} catch (error) {
      loggererror('Failed to store training dataset:', error)}};

  private async updateFeedback.Metrics(feedback: User.Feedback): Promise<void> {
    // Update real-time metrics;
    const metrics = await thisgetFeedback.Metrics();
    thisemit('metrics_updated', metrics)};

  private broadcastFeedback.Request(request: Feedback.Request): void {
    const message = JSO.N.stringify({
      type: 'new_feedbackrequest';
      data: request});
    thiswsConnectionsfor.Each(ws => {
      try {
        wssend(message)} catch (error) {
        loggererror('Failed to broadcast feedback request:', error)}})};

  private broadcastFeedback.Update(feedback: User.Feedback): void {
    const message = JSO.N.stringify({
      type: 'feedback_submitted';
      data: feedback});
    thiswsConnectionsfor.Each(ws => {
      try {
        wssend(message)} catch (error) {
        loggererror('Failed to broadcast feedback update:', error)}})}}// Export singleton instance;
export const humanFeedback.Service = (supabase: Supabase.Client) => new HumanFeedback.Service(supabase);