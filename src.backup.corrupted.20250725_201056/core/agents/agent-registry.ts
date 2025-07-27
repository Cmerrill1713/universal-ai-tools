import { Event.Emitter } from 'events';
import { logger } from '././utils/logger';
export interface Agent.Capability {
  id: string,
  name: string,
  description: string,
  type: 'browser' | 'research' | 'testing' | 'monitoring' | 'coordination',
  skills: string[],
  input.Modes: string[],
  output.Modes: string[],
  requirements: string[],
  confidence?: number;
}
export interface Registered.Agent {
  id: string,
  name: string,
  type: string,
  status: 'idle' | 'busy' | 'error instanceof Error ? error.message : String(error) | 'offline',
  capabilities: Agent.Capability[],
  last.Seen: number,
  metadata: Record<string, unknown>
  stats: Agent.Stats,
}
export interface Agent.Stats {
  tasks.Completed: number,
  tasks.Successful: number,
  average.Response.Time: number,
  last.Task.Time: number,
  success.Rate: number,
}
export interface Capability.Query {
  required.Skills?: string[];
  preferred.Type?: string;
  exclude.Agents?: string[];
  min.Confidence?: number;
  max.Response.Time?: number;
}
export class Agent.Registry.extends Event.Emitter {
  private agents: Map<string, Registered.Agent> = new Map();
  private capability.Index: Map<string, Set<string>> = new Map()// skill -> agent I.Ds;
  private type.Index: Map<string, Set<string>> = new Map()// type -> agent I.Ds;
  private status.Index: Map<string, Set<string>> = new Map()// status -> agent I.Ds;
  constructor() {
    super();
    thissetup.Indexes();

  private setup.Indexes(): void {
    // Initialize status index;
    thisstatus.Indexset('idle', new Set());
    thisstatus.Indexset('busy', new Set());
    thisstatus.Indexset('error instanceof Error ? error.message : String(error)  new Set());
    thisstatus.Indexset('offline', new Set());

  async register.Agent(
    agent.Id: string,
    capabilities: Agent.Capability[],
    metadata: Record<string, unknown> = {}): Promise<void> {
    const agent: Registered.Agent = {
      id: agent.Id,
      name: metadataname || agent.Id,
      type: metadatatype || 'browser',
      status: 'idle',
      capabilities;
      last.Seen: Date.now(),
      metadata;
      stats: {
        tasks.Completed: 0,
        tasks.Successful: 0,
        average.Response.Time: 0,
        last.Task.Time: 0,
        success.Rate: 0,
      };
    thisagentsset(agent.Id, agent);
    thisupdate.Indexes(agent.Id, agent);
    loggerinfo(`🤖 Agent registered: ${agent.Id} with ${capabilitieslength} capabilities`),
    thisemit('agent_registered', { agent.Id, agent });

  async unregister.Agent(agent.Id: string): Promise<void> {
    const agent = thisagentsget(agent.Id);
    if (!agent) return;
    thisremove.From.Indexes(agent.Id, agent);
    thisagentsdelete(agent.Id);
    loggerinfo(`🤖 Agent unregistered: ${agent.Id}`),
    thisemit('agent_unregistered', { agent.Id });

  async update.Agent.Status(agent.Id: string, status: Registered.Agent['status']): Promise<void> {
    const agent = thisagentsget(agent.Id);
    if (!agent) return;
    const old.Status = agentstatus;
    agentstatus = status;
    agentlast.Seen = Date.now()// Update status index;
    thisstatus.Indexget(old.Status)?delete(agent.Id);
    thisstatus.Indexget(status)?add(agent.Id);
    thisemit('agent_status_changed', { agent.Id, old.Status, new.Status: status }),

  async update.Agent.Stats(agent.Id: string, stats: Partial<Agent.Stats>): Promise<void> {
    const agent = thisagentsget(agent.Id);
    if (!agent) return;
    Objectassign(agentstats, stats)// Recalculate success rate;
    if (agentstatstasks.Completed > 0) {
      agentstatssuccess.Rate = Mathround(
        (agentstatstasks.Successful / agentstatstasks.Completed) * 100);

    thisemit('agent_stats_updated', { agent.Id, stats: agentstats }),

  async findAgents.By.Capabilities(query: Capability.Query): Promise<Registered.Agent[]> {
    const candidates = new Set<string>()// Start with all agents if no specific skills required;
    if (!queryrequired.Skills || queryrequired.Skillslength === 0) {
      thisagentsfor.Each((_, agent.Id) => candidatesadd(agent.Id))} else {
      // Find agents that have all required skills;
      const skill.Sets = queryrequired.Skillsmap(
        (skill) => thiscapability.Indexget(skill) || new Set());
      if (skill.Setslength > 0) {
        // Start with agents that have the first skill;
        skill.Sets[0]for.Each((agent.Id) => candidatesadd(agent.Id.as string))// Filter to agents that have all required skills;
        for (let i = 1; i < skill.Setslength; i++) {
          const skill.Set = skill.Sets[i];
          candidatesfor.Each((agent.Id) => {
            if (!skill.Sethas(agent.Id)) {
              candidatesdelete(agent.Id)}})}}}// Apply additional filters;
    const filtered.Agents = Arrayfrom(candidates);
      map((agent.Id) => thisagentsget(agent.Id));
      filter((agent) => {
        if (!agent) return false// Exclude specific agents;
        if (queryexclude.Agents?includes(agentid)) return false// Filter by preferred type;
        if (querypreferred.Type && agenttype !== querypreferred.Type) return false// Filter by minimum confidence;
        if (querymin.Confidence) {
          const has.Min.Confidence = agentcapabilitiessome(
            (cap) => (capconfidence || 0) >= querymin.Confidence!);
          if (!has.Min.Confidence) return false}// Filter by maximum response time;
        if (querymax.Response.Time && agentstatsaverage.Response.Time > querymax.Response.Time) {
          return false}// Only include available agents;
        return agentstatus === 'idle'}) as Registered.Agent[]// Sort by suitability score;
    return filtered.Agentssort((a, b) => {
      const score.A = thiscalculate.Suitability.Score(a, query);
      const score.B = thiscalculate.Suitability.Score(b, query);
      return score.B - score.A});

  private calculate.Suitability.Score(agent: Registered.Agent, query: Capability.Query): number {
    let score = 0// Base score from success rate;
    score += agentstatssuccess.Rate * 0.4// Bonus for matching skills;
    if (queryrequired.Skills) {
      const matching.Skills = queryrequired.Skillsfilter((skill) =>
        agentcapabilitiessome((cap) => capskills.includes(skill)));
      score += (matching.Skillslength / queryrequired.Skillslength) * 30}// Bonus for matching type;
    if (querypreferred.Type && agenttype === querypreferred.Type) {
      score += 20}// Penalty for slow response time;
    if (agentstatsaverage.Response.Time > 0) {
      score -= Math.min(agentstatsaverage.Response.Time / 1000, 10)}// Bonus for recent activity;
    const timeSince.Last.Task = Date.now() - agentstatslast.Task.Time;
    if (timeSince.Last.Task < 300000) {
      // 5 minutes;
      score += 10}// Capability confidence bonus;
    const avg.Confidence =
      agentcapabilitiesreduce((sum, cap) => sum + (capconfidence || 0), 0) /
      agentcapabilitieslength;
    score += avg.Confidence * 0.2;
    return Math.max(0, Math.min(100, score));

  async get.Agent(agent.Id: string): Promise<Registered.Agent | null> {
    return thisagentsget(agent.Id) || null;

  async get.All.Agents(): Promise<Registered.Agent[]> {
    return Arrayfrom(thisagentsvalues());

  async getAgents.By.Status(status: Registered.Agent['status']): Promise<Registered.Agent[]> {
    const agent.Ids = thisstatus.Indexget(status) || new Set();
    return Arrayfrom(agent.Ids);
      map((id) => thisagentsget(id));
      filter(Boolean) as Registered.Agent[];

  async getAgents.By.Type(type: string): Promise<Registered.Agent[]> {
    const agent.Ids = thistype.Indexget(type) || new Set();
    return Arrayfrom(agent.Ids);
      map((id) => thisagentsget(id));
      filter(Boolean) as Registered.Agent[];

  async get.Capability.Distribution(): Promise<Record<string, number>> {
    const distribution: Record<string, number> = {;
    thiscapability.Indexfor.Each((agents, skill) => {
      distribution[skill] = agentssize});
    return distribution;

  async get.Registry.Stats(): Promise<{
    total.Agents: number,
    by.Status: Record<string, number>
    by.Type: Record<string, number>
    total.Capabilities: number,
    average.Success.Rate: number,
    most.Active.Agent: string | null}> {
    const agents = Arrayfrom(thisagentsvalues());
    const total.Agents = agentslength;
    const by.Status: Record<string, number> = {;
    const by.Type: Record<string, number> = {;
    agentsfor.Each((agent) => {
      by.Status[agentstatus] = (by.Status[agentstatus] || 0) + 1;
      by.Type[agenttype] = (by.Type[agenttype] || 0) + 1});
    const total.Capabilities = agentsreduce((sum, agent) => sum + agentcapabilitieslength, 0);
    const average.Success.Rate =
      agentslength > 0? agentsreduce((sum, agent) => sum + agentstatssuccess.Rate, 0) / agentslength: 0,
    const most.Active.Agent = agentsreduce(
      (most, agent) => {
        if (!most || agentstatstasks.Completed > moststatstasks.Completed) {
          return agent;
        return most;
      null as Registered.Agent | null);
    return {
      total.Agents;
      by.Status;
      by.Type;
      total.Capabilities;
      average.Success.Rate;
      most.Active.Agent: most.Active.Agent?id || null,
    };

  private update.Indexes(agent.Id: string, agent: Registered.Agent): void {
    // Update capability index;
    agentcapabilitiesfor.Each((cap) => {
      capskillsfor.Each((skill) => {
        if (!thiscapability.Indexhas(skill)) {
          thiscapability.Indexset(skill, new Set());
        thiscapability.Indexget(skill)!add(agent.Id)})})// Update type index;
    if (!thistype.Indexhas(agenttype)) {
      thistype.Indexset(agenttype, new Set());
    thistype.Indexget(agenttype)!add(agent.Id)// Update status index;
    thisstatus.Indexget(agentstatus)?add(agent.Id);

  private remove.From.Indexes(agent.Id: string, agent: Registered.Agent): void {
    // Remove from capability index;
    agentcapabilitiesfor.Each((cap) => {
      capskillsfor.Each((skill) => {
        thiscapability.Indexget(skill)?delete(agent.Id)})})// Remove from type index;
    thistype.Indexget(agenttype)?delete(agent.Id)// Remove from status index;
    thisstatus.Indexget(agentstatus)?delete(agent.Id);

  async cleanup(): Promise<void> {
    // Remove stale agents (offline for more than 5 minutes);
    const stale.Threshold = Date.now() - 300000// 5 minutes;
    const stale.Agents = Arrayfrom(thisagentsvalues())filter(
      (agent) => agentlast.Seen < stale.Threshold);
    for (const agent of stale.Agents) {
      await thisunregister.Agent(agentid);

    if (stale.Agentslength > 0) {
      loggerinfo(`🧹 Cleaned up ${stale.Agentslength} stale agents`)};

  async health.Check(): Promise<boolean> {
    const stats = await thisget.Registry.Stats();
    const healthy.Agents = statsby.Statusidle + statsby.Statusbusy;
    const { total.Agents } = stats;
    if (total.Agents === 0) return false;
    const health.Percentage = (healthy.Agents / total.Agents) * 100;
    return health.Percentage >= 75// At least 75% of agents should be healthy};
