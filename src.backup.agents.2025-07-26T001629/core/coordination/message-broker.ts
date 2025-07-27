import { Event.Emitter } from 'events';
import { logger } from '././utils/logger';
export interface Message {
  id: string;
  session.Id: string;
  from.Agent: string;
  to.Agent?: string// undefined for broadcasts;
  type: 'coordination' | 'task' | 'status' | 'error instanceof Error ? errormessage : String(error) | 'artifact' | 'heartbeat' | 'discovery';
  contentany;
  timestamp: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ttl?: number// Time to live in milliseconds;
  retry.Count?: number;
  correlation.Id?: string;
  metadata?: Record<string, unknown>};

export interface Message.Queue {
  id: string;
  agent.Id: string;
  messages: Message[];
  last.Processed: number;
  is.Processing: boolean;
  max.Size: number;
  processing.Rate: number// messages per second};

export interface Message.Route {
  from.Agent: string;
  to.Agent: string;
  message.Type: string;
  handler: (message: Message) => Promise<void>
};

export interface Broadcast.Group {
  id: string;
  name: string;
  description: string;
  members: Set<string>
  message.Types: string[];
  filters?: Message.Filter[];
};

export interface Message.Filter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'regex';
  value: any;
};

export interface Message.Stats {
  total.Sent: number;
  total.Received: number;
  total.Delivered: number;
  total.Failed: number;
  averageDelivery.Time: number;
  by.Type: Record<string, number>
  by.Priority: Record<string, number>};

export class Message.Broker extends Event.Emitter {
  private queues: Map<string, Message.Queue> = new Map();
  private routes: Map<string, Message.Route> = new Map();
  private broadcast.Groups: Map<string, Broadcast.Group> = new Map();
  private message.History: Message[] = [];
  private maxHistory.Size = 1000;
  private message.Stats: Message.Stats = {
    total.Sent: 0;
    total.Received: 0;
    total.Delivered: 0;
    total.Failed: 0;
    averageDelivery.Time: 0;
    by.Type: {
};
    by.Priority: {
}};
  private delivery.Timeouts: Map<string, NodeJS.Timeout> = new Map();
  private heartbeat.Interval: NodeJS.Timeout | null = null;
  private cleanup.Interval: NodeJS.Timeout | null = null;
  constructor() {
    super();
    thisstart.Heartbeat();
    thisstartCleanup.Process()};

  async register.Agent(
    agent.Id: string;
    options: {
      maxQueue.Size?: number;
      processing.Rate?: number} = {}): Promise<void> {
    const queue: Message.Queue = {
      id: `queue-${agent.Id}`;
      agent.Id;
      messages: [];
      last.Processed: Date.now();
      is.Processing: false;
      max.Size: optionsmaxQueue.Size || 100;
      processing.Rate: optionsprocessing.Rate || 10, // 10 messages per second};
    thisqueuesset(agent.Id, queue);
    loggerinfo(`📬 Message queue registered for agent: ${agent.Id}`);
    thisemit('agent_registered', { agent.Id, queue })};

  async unregister.Agent(agent.Id: string): Promise<void> {
    const queue = thisqueuesget(agent.Id);
    if (queue) {
      // Process remaining messages or move to dead letter queue;
      if (queuemessageslength > 0) {
        loggerwarn(
          `📬 Agent ${agent.Id} unregistered with ${queuemessageslength} pending messages`)// Move messages to dead letter queue or handle appropriately;
        for (const message of queuemessages) {
          await thishandleUndelivered.Message(message)}};

      thisqueuesdelete(agent.Id)// Remove from broadcast groups;
      thisbroadcastGroupsfor.Each((group) => {
        groupmembersdelete(agent.Id)});
      loggerinfo(`📬 Agent unregistered: ${agent.Id}`);
      thisemit('agent_unregistered', { agent.Id })}};

  async send.Message(message: Omit<Message, 'id' | 'timestamp'>): Promise<string> {
    const full.Message: Message = {
      .message;
      id: `msg-${Date.now()}-${Mathrandom()to.String(36)substr(2, 9)}`;
      timestamp: Date.now();
      priority: messagepriority || 'medium';
      retry.Count: messageretry.Count || 0;
    }// Validate message;
    if (!thisvalidate.Message(full.Message)) {
      throw new Error('Invalid message format')}// Add to history;
    thisaddTo.History(full.Message)// Update stats;
    thisupdate.Stats('sent', full.Message)// Route message;
    if (fullMessageto.Agent) {
      // Direct message;
      await thisrouteDirect.Message(full.Message)} else {
      // Broadcast message;
      await thisrouteBroadcast.Message(full.Message)}// Set up delivery timeout if specified;
    if (full.Messagettl) {
      thissetDelivery.Timeout(full.Message)};

    loggerinfo(`📤 Message sent: ${full.Messageid} (${full.Messagetype})`);
    thisemit('message_sent', full.Message);
    return full.Messageid};

  private async routeDirect.Message(message: Message): Promise<void> {
    const target.Queue = thisqueuesget(messageto.Agent!);
    if (!target.Queue) {
      await thishandleUndelivered.Message(message);
      return}// Check queue capacity;
    if (target.Queuemessageslength >= targetQueuemax.Size) {
      loggerwarn(`📬 Queue full for agent ${messageto.Agent}, dropping message ${messageid}`);
      await thishandleUndelivered.Message(message);
      return}// Add to queue in priority order;
    thisaddTo.Queue(target.Queue, message)// Process queue if not already processing;
    if (!targetQueueis.Processing) {
      set.Immediate(() => thisprocess.Queue(target.Queue))}};

  private async routeBroadcast.Message(message: Message): Promise<void> {
    const target.Agents = thisgetBroadcast.Targets(message);
    for (const agent.Id of target.Agents) {
      const target.Message = {
        .message;
        to.Agent: agent.Id;
        id: `${messageid}-${agent.Id}`};
      await thisrouteDirect.Message(target.Message)}};

  private getBroadcast.Targets(message: Message): string[] {
    // Find all agents that should receive this broadcast;
    const targets = new Set<string>()// Check session participants;
    if (messagesession.Id) {
      // Add all agents in the session (this would be managed by the coordinator)// For now, we'll broadcast to all registered agents;
      thisqueuesfor.Each((_, agent.Id) => {
        if (agent.Id !== messagefrom.Agent) {
          targetsadd(agent.Id)}})}// Check broadcast groups;
    thisbroadcastGroupsfor.Each((group) => {
      if (groupmessage.Typesincludes(messagetype) || groupmessage.Typesincludes('*')) {
        // Apply filters if any;
        if (!groupfilters || thispasses.Filters(message: groupfilters)) {
          groupmembersfor.Each((agent.Id) => {
            if (agent.Id !== messagefrom.Agent) {
              targetsadd(agent.Id);
            }})}}});
    return Arrayfrom(targets)};

  private passes.Filters(message: Message, filters: Message.Filter[]): boolean {
    return filtersevery((filter) => {
      const field.Value = thisgetField.Value(message: filterfield);
      switch (filteroperator) {
        case 'eq':
          return field.Value === filtervalue;
        case 'ne':
          return field.Value !== filtervalue;
        case 'gt':
          return field.Value > filtervalue;
        case 'lt':
          return field.Value < filtervalue;
        case 'contains':
          return String(field.Value)includes(String(filtervalue));
        case 'regex':
          return new Reg.Exp(filtervalue)test(String(field.Value));
        default:
          return true}})};

  private getField.Value(message: Message, field: string): any {
    const parts = fieldsplit('.');
    let value: any = message;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break};

    return value};

  private addTo.Queue(queue: Message.Queue, message: Message): void {
    const priority.Order = { critical: 4, high: 3, medium: 2, low: 1 };
    const message.Priority = priority.Order[messagepriority];
    let insert.Index = queuemessageslength;
    for (let i = 0; i < queuemessageslength; i++) {
      const queuedMessage.Priority = priority.Order[queuemessages[i]priority];
      if (message.Priority > queuedMessage.Priority) {
        insert.Index = i;
        break}};

    queuemessagessplice(insert.Index, 0, message);
    thisupdate.Stats('received', message)};

  private async process.Queue(queue: Message.Queue): Promise<void> {
    if (queueis.Processing || queuemessageslength === 0) {
      return};

    queueis.Processing = true;
    const processing.Interval = 1000 / queueprocessing.Rate// ms between messages;

    try {
      while (queuemessageslength > 0) {
        const message = queuemessagesshift()!
        try {
          await thisdeliver.Message(message);
          queuelast.Processed = Date.now()// Rate limiting;
          if (queuemessageslength > 0) {
            await new Promise((resolve) => set.Timeout(resolve, processing.Interval))}} catch (error) {
          loggererror(📬 Failed to deliver message ${messageid}:`, error instanceof Error ? errormessage : String(error) await thishandleDelivery.Failure(message: error instanceof Error ? errormessage : String(error);
        }}} finally {
      queueis.Processing = false}};

  private async deliver.Message(message: Message): Promise<void> {
    const start.Time = Date.now()// Clean up delivery timeout;
    const timeout.Id = thisdelivery.Timeoutsget(messageid);
    if (timeout.Id) {
      clear.Timeout(timeout.Id);
      thisdelivery.Timeoutsdelete(messageid)}// Emit message for handling;
    thisemit('message', message)// Update delivery stats;
    const delivery.Time = Date.now() - start.Time;
    thisupdateDelivery.Stats(delivery.Time);
    thisupdate.Stats('delivered', message);
    loggerinfo(`📥 Message delivered: ${messageid} to ${messageto.Agent} (${delivery.Time}ms)`)};

  private async handleDelivery.Failure(message: Message, error instanceof Error ? errormessage : String(error) any): Promise<void> {
    messageretry.Count = (messageretry.Count || 0) + 1;
    const max.Retries = 3;
    if (messageretry.Count < max.Retries) {
      // Retry with exponential backoff;
      const delay = Mathpow(2, messageretry.Count) * 1000;
      set.Timeout(() => {
        const queue = thisqueuesget(messageto.Agent!);
        if (queue) {
          thisaddTo.Queue(queue, message);
          if (!queueis.Processing) {
            set.Immediate(() => thisprocess.Queue(queue))}}}, delay);
      loggerwarn(
        `📬 Retrying message ${messageid} (attempt ${messageretry.Count}/${max.Retries})`)} else {
      await thishandleUndelivered.Message(message)}};

  private async handleUndelivered.Message(message: Message): Promise<void> {
    thisupdate.Stats('failed', message);
    loggererror(📬 Message failed permanently: ${messageid}`);
    thisemit('message_failed', { message: reason: 'Max retries exceeded' })// Could implement dead letter queue here// For now, we'll just log and emit an event};

  private setDelivery.Timeout(message: Message): void {
    const timeout.Id = set.Timeout(() => {
      loggerwarn(`📬 Message timeout: ${messageid}`);
      thishandleUndelivered.Message(message)}, messagettl!);
    thisdelivery.Timeoutsset(messageid, timeout.Id)};

  async createBroadcast.Group(group: Omit<Broadcast.Group, 'members'>): Promise<string> {
    const full.Group: Broadcast.Group = {
      .group;
      members: new Set();
    };
    thisbroadcast.Groupsset(groupid, full.Group);
    loggerinfo(`📢 Broadcast group created: ${groupid}`);
    thisemit('broadcast_group_created', full.Group);
    return groupid};

  async addToBroadcast.Group(group.Id: string, agent.Id: string): Promise<void> {
    const group = thisbroadcast.Groupsget(group.Id);
    if (!group) {
      throw new Error(`Broadcast group not found: ${group.Id}`)};

    groupmembersadd(agent.Id);
    thisemit('agent_added_to_group', { group.Id, agent.Id })};

  async removeFromBroadcast.Group(group.Id: string, agent.Id: string): Promise<void> {
    const group = thisbroadcast.Groupsget(group.Id);
    if (!group) {
      throw new Error(`Broadcast group not found: ${group.Id}`)};

    groupmembersdelete(agent.Id);
    thisemit('agent_removed_from_group', { group.Id, agent.Id })};

  private validate.Message(message: Message): boolean {
    return !!(
      messageid &&
      messagesession.Id &&
      messagefrom.Agent &&
      messagetype &&
      messagecontent&
      messagetimestamp)};

  private addTo.History(message: Message): void {
    thismessage.Historypush(message)// Maintain history size;
    if (thismessage.Historylength > thismaxHistory.Size) {
      thismessage.Historyshift();
    }};

  private update.Stats(
    operation: 'sent' | 'received' | 'delivered' | 'failed';
    message: Message): void {
    switch (operation) {
      case 'sent':
        thismessageStatstotal.Sent++
        break;
      case 'received':
        thismessageStatstotal.Received++
        break;
      case 'delivered':
        thismessageStatstotal.Delivered++
        break;
      case 'failed':
        thismessageStatstotal.Failed++
        break};

    if (!thismessageStatsby.Type[messagetype]) {
      thismessageStatsby.Type[messagetype] = 0};
    thismessageStatsby.Type[messagetype]++
    if (!thismessageStatsby.Priority[messagepriority]) {
      thismessageStatsby.Priority[messagepriority] = 0};
    thismessageStatsby.Priority[messagepriority]++};

  private updateDelivery.Stats(delivery.Time: number): void {
    const current.Avg = thismessageStatsaverageDelivery.Time;
    const { total.Delivered } = thismessage.Stats;
    thismessageStatsaverageDelivery.Time =
      total.Delivered === 1? delivery.Time: (current.Avg * (total.Delivered - 1) + delivery.Time) / total.Delivered;
  };

  private start.Heartbeat(): void {
    thisheartbeat.Interval = set.Interval(() => {
      thisqueuesfor.Each(async (queue, agent.Id) => {
        const heartbeat.Message: Message = {
          id: `heartbeat-${Date.now()}`;
          session.Id: 'system';
          from.Agent: 'broker';
          to.Agent: agent.Id;
          type: 'heartbeat';
          content{ timestamp: Date.now() };
          timestamp: Date.now();
          priority: 'low';
          ttl: 30000, // 30 seconds};
        await thissend.Message(heartbeat.Message)})}, 30000)// Every 30 seconds};

  private startCleanup.Process(): void {
    thiscleanup.Interval = set.Interval(() => {
      thiscleanup()}, 60000)// Every minute};

  private cleanup(): void {
    // Clean up old messages from history;
    const cutoff = Date.now() - 3600000// 1 hour;
    thismessage.History = thismessage.Historyfilter((msg) => msgtimestamp > cutoff)// Clean up expired delivery timeouts;
    thisdeliveryTimeoutsfor.Each((timeout, message.Id) => {
      // Timeouts are automatically cleaned up when they fire})// Clean up empty broadcast groups;
    thisbroadcastGroupsfor.Each((group, group.Id) => {
      if (groupmemberssize === 0) {
        thisbroadcast.Groupsdelete(group.Id)}})};

  async getMessage.History(session.Id?: string, agent.Id?: string): Promise<Message[]> {
    let history = [.thismessage.History];
    if (session.Id) {
      history = historyfilter((msg) => msgsession.Id === session.Id)};

    if (agent.Id) {
      history = historyfilter((msg) => msgfrom.Agent === agent.Id || msgto.Agent === agent.Id)};

    return historysort((a, b) => btimestamp - atimestamp)};

  async get.Stats(): Promise<Message.Stats> {
    return { .thismessage.Stats }};

  async getQueue.Stats(): Promise<
    Record<
      string;
      {
        agent.Id: string;
        queue.Size: number;
        last.Processed: number;
        is.Processing: boolean;
        processing.Rate: number;
      }>
  > {
    const stats: Record<string, unknown> = {};
    thisqueuesfor.Each((queue, agent.Id) => {
      stats[agent.Id] = {
        agent.Id: queueagent.Id;
        queue.Size: queuemessageslength;
        last.Processed: queuelast.Processed;
        is.Processing: queueis.Processing;
        processing.Rate: queueprocessing.Rate;
      }});
    return stats};

  async shutdown(): Promise<void> {
    // Stop heartbeat;
    if (thisheartbeat.Interval) {
      clear.Interval(thisheartbeat.Interval)}// Stop cleanup;
    if (thiscleanup.Interval) {
      clear.Interval(thiscleanup.Interval)}// Clear delivery timeouts;
    thisdeliveryTimeoutsfor.Each((timeout) => clear.Timeout(timeout));
    thisdelivery.Timeoutsclear()// Process remaining messages quickly;
    const processing.Promises = Arrayfrom(thisqueuesvalues())map((queue) =>
      thisprocess.Queue(queue));
    await Promiseall(processing.Promises);
    loggerinfo('📬 Message broker shut down')}};
