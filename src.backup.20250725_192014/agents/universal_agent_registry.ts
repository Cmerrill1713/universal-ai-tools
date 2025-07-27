/**
 * Universal Agent Registry - Lazy Loading System* Adapted from the trading platform's sophisticated agent management*/

import type { Base.Agent } from './base_agent';
import { Event.Emitter } from 'events';
import { agentCollaborationW.S } from './services/agent-collaboration-websocket';
export interface AgentDefinition {
  name: string;
  category: Agent.Category;
  description: string;
  priority: number;
  class.Name: string;
  module.Path: string;
  dependencies: string[];
  capabilities: string[];
  memory.Enabled: boolean;
  maxLatency.Ms: number;
  retry.Attempts: number;
};

export enum Agent.Category {
  COR.E = 'core';
  COGNITIV.E = 'cognitive';
  UTILIT.Y = 'utility';
  SPECIALIZE.D = 'specialized';
  PERSONA.L = 'personal'};

export interface AgentLoadingLock {
  [agent.Name: string]: Promise<Base.Agent | null>
};

export class UniversalAgent.Registry extends Event.Emitter {
  private agent.Definitions: Map<string, Agent.Definition> = new Map();
  private loaded.Agents: Map<string, Base.Agent> = new Map();
  private agent.Usage: Map<string, Date> = new Map();
  private loading.Locks: Map<string, Promise<Base.Agent | null>> = new Map();
  private memory.Coordinator: any;
  private supabase: any;
  private logger: any = console;
  constructor(memory.Coordinator?: any, supabase?: any) {
    super();
    thismemory.Coordinator = memory.Coordinator;
    thissupabase = supabase;
    thisregisterCognitive.Agents();
    thisregisterPersonal.Agents();
    thisloggerinfo(
      `✅ Universal Agent Registry initialized with ${thisagent.Definitionssize} agent definitions`)}/**
   * Register the 10 cognitive agents for Universal A.I Tools*/
  private registerCognitive.Agents(): void {
    const cognitive.Agents: Agent.Definition[] = [
      {
        name: 'planner';
        category: AgentCategoryCOR.E;
        description: 'Strategic task planning and decomposition with memory integration';
        priority: 1;
        class.Name: 'EnhancedPlanner.Agent';
        module.Path: './cognitive/enhanced_planner_agent';
        dependencies: [];
        capabilities: [
          'task_planning';
          'goal_decomposition';
          'strategy_design';
          'memory_based_optimization'];
        memory.Enabled: true;
        maxLatency.Ms: 100;
        retry.Attempts: 3;
      };
      {
        name: 'retriever';
        category: AgentCategoryCOR.E;
        description: 'Information gathering and context retrieval';
        priority: 1;
        class.Name: 'Retriever.Agent';
        module.Path: './cognitive/retriever_agent';
        dependencies: [];
        capabilities: ['information_search', 'context_retrieval', 'knowledge_lookup'];
        memory.Enabled: true;
        maxLatency.Ms: 200;
        retry.Attempts: 2;
      };
      {
        name: 'devils_advocate';
        category: AgentCategoryCOGNITIV.E;
        description: 'Critical analysis and risk assessment';
        priority: 2;
        class.Name: 'DevilsAdvocate.Agent';
        module.Path: './cognitive/devils_advocate_agent';
        dependencies: ['retriever'];
        capabilities: ['critical_analysis', 'risk_assessment', 'stress_testing'];
        memory.Enabled: true;
        maxLatency.Ms: 150;
        retry.Attempts: 2;
      };
      {
        name: 'evaluation_agent';
        category: AgentCategoryCOGNITIV.E;
        description: 'Comprehensive quality assessment and performance validation';
        priority: 9;
        class.Name: 'Evaluation.Agent';
        module.Path: './cognitive/evaluation_agent';
        dependencies: ['retriever'];
        capabilities: ['evaluate_response', 'benchmark_agent', 'validate_output', 'compare_agents'];
        memory.Enabled: true;
        maxLatency.Ms: 5000;
        retry.Attempts: 2;
      };
      {
        name: 'synthesizer';
        category: AgentCategoryCOGNITIV.E;
        description: 'Information integration and solution synthesis';
        priority: 2;
        class.Name: 'Synthesizer.Agent';
        module.Path: './cognitive/synthesizer_agent';
        dependencies: ['retriever', 'planner'];
        capabilities: ['information_synthesis', 'solution_integration', 'pattern_matching'];
        memory.Enabled: true;
        maxLatency.Ms: 120;
        retry.Attempts: 2;
      };
      {
        name: 'reflector';
        category: AgentCategoryCOGNITIV.E;
        description: 'Self-assessment and learning optimization';
        priority: 3;
        class.Name: 'Reflector.Agent';
        module.Path: './cognitive/reflector_agent';
        dependencies: ['synthesizer'];
        capabilities: ['self_assessment', 'learning_optimization', 'performance_analysis'];
        memory.Enabled: true;
        maxLatency.Ms: 100;
        retry.Attempts: 1;
      };
      {
        name: 'user_intent';
        category: AgentCategoryCOR.E;
        description: 'Understanding user goals and context';
        priority: 1;
        class.Name: 'UserIntent.Agent';
        module.Path: './cognitive/user_intent_agent';
        dependencies: [];
        capabilities: ['intent_recognition', 'goal_inference', 'context_understanding'];
        memory.Enabled: true;
        maxLatency.Ms: 80;
        retry.Attempts: 3;
      };
      {
        name: 'tool_maker';
        category: AgentCategorySPECIALIZE.D;
        description: 'Dynamic tool creation and customization';
        priority: 2;
        class.Name: 'ToolMaker.Agent';
        module.Path: './cognitive/tool_maker_agent';
        dependencies: ['planner', 'user_intent'];
        capabilities: ['tool_creation', 'code_generation', 'customization'];
        memory.Enabled: true;
        maxLatency.Ms: 300;
        retry.Attempts: 2;
      };
      {
        name: 'ethics';
        category: AgentCategoryCOR.E;
        description: 'Safety validation and compliance checking';
        priority: 2;
        class.Name: 'Ethics.Agent';
        module.Path: './cognitive/ethics_agent';
        dependencies: [];
        capabilities: ['safety_validation', 'compliance_checking', 'ethical_analysis'];
        memory.Enabled: true;
        maxLatency.Ms: 100;
        retry.Attempts: 3;
      };
      {
        name: 'resource_manager';
        category: AgentCategoryUTILIT.Y;
        description: 'System resource optimization and monitoring';
        priority: 3;
        class.Name: 'ResourceManager.Agent';
        module.Path: './cognitive/resource_manager_agent';
        dependencies: [];
        capabilities: ['resource_optimization', 'performance_monitoring', 'system_health'];
        memory.Enabled: false;
        maxLatency.Ms: 50;
        retry.Attempts: 1;
      };
      {
        name: 'orchestrator';
        category: AgentCategoryCOR.E;
        description: 'Central coordination and decision making';
        priority: 1;
        class.Name: 'Orchestrator.Agent';
        module.Path: './cognitive/orchestrator_agent';
        dependencies: ['planner', 'synthesizer', 'ethics'];
        capabilities: ['coordination', 'decision_making', 'consensus_building'];
        memory.Enabled: true;
        maxLatency.Ms: 150;
        retry.Attempts: 3;
      };
      {
        name: 'pydantic_ai';
        category: AgentCategoryCOGNITIV.E;
        description: 'Type-safe A.I interactions with structured validation';
        priority: 2;
        class.Name: 'PydanticAI.Agent';
        module.Path: './cognitive/pydantic_ai_agent';
        dependencies: ['user_intent'];
        capabilities: [
          'structured_response';
          'validate_data';
          'cognitive_analysis';
          'task_planning';
          'code_generation'];
        memory.Enabled: true;
        maxLatency.Ms: 200;
        retry.Attempts: 2;
      }];
    cognitiveAgentsfor.Each((agent) => {
      thisagent.Definitionsset(agentname, agent)})}/**
   * Register the personal productivity agents*/
  private registerPersonal.Agents(): void {
    const personal.Agents: Agent.Definition[] = [
      {
        name: 'personal_assistant';
        category: AgentCategoryPERSONA.L;
        description:
          'High-level personal A.I assistant with vector memory for intelligent coordination';
        priority: 1;
        class.Name: 'EnhancedPersonalAssistant.Agent';
        module.Path: './personal/enhanced_personal_assistant_agent';
        dependencies: [
          'calendar_agent';
          'photo_organizer';
          'file_manager';
          'code_assistant';
          'system_control';
          'web_scraper';
          'tool_maker'];
        capabilities: [
          'comprehensive_assistance';
          'smart_planning';
          'proactive_assistance';
          'memory_driven_intelligence'];
        memory.Enabled: true;
        maxLatency.Ms: 10000;
        retry.Attempts: 3;
      };
      {
        name: 'calendar_agent';
        category: AgentCategoryPERSONA.L;
        description: 'Intelligent calendar management and scheduling assistant';
        priority: 2;
        class.Name: 'Calendar.Agent';
        module.Path: './personal/calendar_agent';
        dependencies: ['ollama_assistant'];
        capabilities: ['create_event', 'find_free_time', 'analyze_schedule'];
        memory.Enabled: true;
        maxLatency.Ms: 3000;
        retry.Attempts: 2;
      };
      {
        name: 'photo_organizer';
        category: AgentCategoryPERSONA.L;
        description:
          'Intelligent photo organization with face recognition and M.L-powered categorization';
        priority: 3;
        class.Name: 'PhotoOrganizer.Agent';
        module.Path: './personal/photo_organizer_agent';
        dependencies: ['ollama_assistant'];
        capabilities: ['organize_photos', 'detect_faces', 'find_duplicates', 'create_smart_albums'];
        memory.Enabled: true;
        maxLatency.Ms: 10000;
        retry.Attempts: 2;
      };
      {
        name: 'file_manager';
        category: AgentCategoryPERSONA.L;
        description: 'Intelligent file and document management with automated organization';
        priority: 3;
        class.Name: 'FileManager.Agent';
        module.Path: './personal/file_manager_agent';
        dependencies: ['ollama_assistant'];
        capabilities: ['organize_files', 'find_duplicates', 'analyzecontent', 'smart_search'];
        memory.Enabled: true;
        maxLatency.Ms: 5000;
        retry.Attempts: 2;
      };
      {
        name: 'code_assistant';
        category: AgentCategoryPERSONA.L;
        description: 'Intelligent development workflow automation and code generation';
        priority: 2;
        class.Name: 'CodeAssistant.Agent';
        module.Path: './personal/code_assistant_agent';
        dependencies: ['ollama_assistant'];
        capabilities: ['generate_code', 'analyze_project', 'refactor_code', 'git_operations'];
        memory.Enabled: true;
        maxLatency.Ms: 15000;
        retry.Attempts: 2;
      };
      {
        name: 'system_control';
        category: AgentCategoryPERSONA.L;
        description: 'macO.S system integration and intelligent automation';
        priority: 3;
        class.Name: 'SystemControl.Agent';
        module.Path: './personal/system_control_agent';
        dependencies: ['ollama_assistant'];
        capabilities: ['system_status', 'app_control', 'system_preferences', 'automation'];
        memory.Enabled: true;
        maxLatency.Ms: 5000;
        retry.Attempts: 2;
      };
      {
        name: 'web_scraper';
        category: AgentCategoryPERSONA.L;
        description: 'Intelligent web scraping, monitoring, and data extraction';
        priority: 4;
        class.Name: 'WebScraper.Agent';
        module.Path: './personal/web_scraper_agent';
        dependencies: ['ollama_assistant'];
        capabilities: ['scrape_website', 'monitor_website', 'apirequest'];
        memory.Enabled: true;
        maxLatency.Ms: 10000;
        retry.Attempts: 3;
      };
      {
        name: 'tool_maker';
        category: AgentCategoryPERSONA.L;
        description: 'Dynamic tool creation and customization engine';
        priority: 4;
        class.Name: 'ToolMaker.Agent';
        module.Path: './personal/tool_maker_agent';
        dependencies: ['ollama_assistant'];
        capabilities: ['create_tool', 'generate_integration', 'create_workflow'];
        memory.Enabled: true;
        maxLatency.Ms: 20000;
        retry.Attempts: 2;
      }];
    personalAgentsfor.Each((agent) => {
      thisagent.Definitionsset(agentname, agent)})}/**
   * Get an agent, loading it lazily if needed*/
  async getAgent(agent.Name: string): Promise<Base.Agent | null> {
    // Return already loaded agent;
    if (thisloaded.Agentshas(agent.Name)) {
      thisagent.Usageset(agent.Name, new Date());
      return thisloaded.Agentsget(agent.Name)!}// Check if agent definition exists;
    if (!thisagent.Definitionshas(agent.Name)) {
      thisloggerwarn(`⚠️ Agent '${agent.Name}' not found in registry`);
      return null}// Handle concurrent loading attempts;
    if (thisloading.Lockshas(agent.Name)) {
      return await thisloading.Locksget(agent.Name)!}// Start loading process;
    const loading.Promise = thisload.Agent(agent.Name);
    thisloading.Locksset(agent.Name, loading.Promise);
    try {
      const agent = await loading.Promise;
      if (agent) {
        thisloaded.Agentsset(agent.Name, agent);
        thisagent.Usageset(agent.Name, new Date());
        thisloggerinfo(`✅ Lazy-loaded agent: ${agent.Name}`);
        thisemit('agent_loaded', { agent.Name, agent })};
      return agent} finally {
      thisloading.Locksdelete(agent.Name)}}/**
   * Load a specific agent and its dependencies*/
  private async load.Agent(agent.Name: string): Promise<Base.Agent | null> {
    try {
      const definition = thisagent.Definitionsget(agent.Name)!// Load dependencies first;
      for (const dep.Name of definitiondependencies) {
        if (!thisloaded.Agentshas(dep.Name)) {
          const dep.Agent = await thisgetAgent(dep.Name);
          if (!dep.Agent) {
            thisloggerwarn(`⚠️ Failed to load dependency '${dep.Name}' for '${agent.Name}'`)}}}// Import and instantiate the agent;
      const Agent.Class = await thisimportAgent.Class(definition);
      if (!Agent.Class) {
        throw new Error(`Failed to import agent class: ${definitionclass.Name}`)}// Create agent configuration with auto.Learn enabled;
      const config: any = {
        name: definitionname;
        description: definitiondescription;
        priority: definitionpriority;
        capabilities: definitioncapabilitiesmap((cap) => ({
          name: cap;
          description: `${cap} capability`;
          input.Schema: {
};
          output.Schema: {
}}));
        maxLatency.Ms: definitionmaxLatency.Ms;
        retry.Attempts: definitionretry.Attempts;
        dependencies: definitiondependencies;
        memory.Enabled: definitionmemory.Enabled// Enable auto.Learn for all agents to store conversations;
        auto.Learn: true;
        useVector.Memory: true;
        memorySearch.Threshold: 0.7;
        maxMemory.Results: 10;
      }// Instantiate and initialize agent;
      let agent;
      if (definitioncategory === AgentCategoryPERSONA.L) {
        // Personal agents need supabase client;
        agent = new Agent.Class(thissupabase)} else {
        // Other agents use config;
        agent = new Agent.Class(config)};
      await agentinitialize(thismemory.Coordinator);
      return agent} catch (error) {
      thisloggererror(`❌ Failed to load agent '${agent.Name}':`, error);
      return null}}/**
   * Dynamically import agent class*/
  private async importAgent.Class(definition: Agent.Definition): Promise<unknown> {
    try {
      // Import based on category and module path;
      if (definitioncategory === AgentCategoryPERSONA.L) {
        switch (definitionname) {
          case 'personal_assistant': {
            const { default: PersonalAssistant.Agent } = await import(
              './personal/personal_assistant_agent');
            return PersonalAssistant.Agent};
          case 'calendar_agent': {
            const { default: Calendar.Agent } = await import('./personal/calendar_agent');
            return Calendar.Agent};
          case 'photo_organizer': {
            const { default: PhotoOrganizer.Agent } = await import(
              './personal/photo_organizer_agent');
            return PhotoOrganizer.Agent};
          case 'file_manager': {
            const { default: FileManager.Agent } = await import('./personal/file_manager_agent');
            return FileManager.Agent};
          case 'code_assistant': {
            const { default: CodeAssistant.Agent } = await import('./personal/code_assistant_agent');
            return CodeAssistant.Agent};
          case 'system_control': {
            const { default: SystemControl.Agent } = await import('./personal/system_control_agent');
            return SystemControl.Agent};
          case 'web_scraper': {
            const { default: WebScraper.Agent } = await import('./personal/web_scraper_agent');
            return WebScraper.Agent};
          case 'tool_maker': {
            const { default: ToolMaker.Agent } = await import('./personal/tool_maker_agent');
            return ToolMaker.Agent}}} else {
        // Import cognitive agents;
        switch (definitionname) {
          case 'planner': {
            const { default: EnhancedPlanner.Agent } = await import(
              './cognitive/enhanced_planner_agent');
            return EnhancedPlanner.Agent};
          case 'retriever': {
            const { default: Retriever.Agent } = await import('./cognitive/retriever_agent');
            return Retriever.Agent};
          case 'devils_advocate': {
            const { default: DevilsAdvocate.Agent } = await import(
              './cognitive/devils_advocate_agent');
            return DevilsAdvocate.Agent};
          case 'synthesizer': {
            const { default: Synthesizer.Agent } = await import('./cognitive/synthesizer_agent');
            return Synthesizer.Agent};
          case 'reflector': {
            const { default: Reflector.Agent } = await import('./cognitive/reflector_agent');
            return Reflector.Agent};
          case 'user_intent': {
            const { default: UserIntent.Agent } = await import('./cognitive/user_intent_agent');
            return UserIntent.Agent};
          case 'tool_maker': {
            const { default: ToolMaker.Agent } = await import('./cognitive/tool_maker_agent');
            return ToolMaker.Agent};
          case 'ethics': {
            const { default: Ethics.Agent } = await import('./cognitive/ethics_agent');
            return Ethics.Agent};
          case 'resource_manager': {
            const { default: ResourceManager.Agent } = await import(
              './cognitive/resource_manager_agent');
            return ResourceManager.Agent};
          case 'orchestrator': {
            const { default: Orchestrator.Agent } = await import('./cognitive/orchestrator_agent');
            return Orchestrator.Agent};
          case 'pydantic_ai': {
            const { PydanticAI.Agent } = await import('./cognitive/pydantic_ai_agent');
            return PydanticAI.Agent};
          default:
            throw new Error(`Unknown cognitive agent: ${definitionname}`)}}} catch (error) {
      thisloggererror(`❌ Failed to import agent class ${definitionclass.Name}:`, error);
      return null}}/**
   * Initialize the registry*/
  async initialize(): Promise<void> {
    thisloggerinfo('Initializing Universal Agent Registry.')// Registry is already initialized in constructor;
    thisloggerinfo('✅ Universal Agent Registry initialized');
  }/**
   * Process a request through the appropriate agent*/
  async process.Request(agent.Name: string, context: any): Promise<unknown> {
    const agent = await thisload.Agent(agent.Name);
    if (!agent) {
      throw new Error(`Agent ${agent.Name} not found or failed to load`)}// Mark agent as used;
    thisagent.Usageset(agent.Name, new Date())// Notify U.I about agent activation;
    const definition = thisagent.Definitionsget(agent.Name);
    if (definition) {
      agentCollaborationWSupdateAgent.Status({
        agent.Id: agent.Name;
        agent.Name: definitionclass.Namereplace('Agent', ' Agent');
        status: 'thinking';
        current.Task: `Processing: ${contexttask || 'request'}`;
        timestamp: new Date();
        metadata: {
          participating.In: contextrequest.Id || 'direct';
        }})};

    try {
      // Process the request;
      const result = await agentexecute(context)// Notify completion;
      agentCollaborationWScompleteAgent.Task(agent.Name, result);
      return result} catch (error) {
      // Notify error;
      agentCollaborationWSupdateAgent.Status({
        agent.Id: agent.Name;
        agent.Name: definition?class.Namereplace('Agent', ' Agent') || agent.Name;
        status: 'error';
        current.Task: 'Task failed';
        timestamp: new Date()});
      throw error}}/**
   * Get core agents that should be preloaded*/
  getCore.Agents(): string[] {
    return Arrayfrom(thisagent.Definitionsvalues());
      filter((def) => defcategory === AgentCategoryCOR.E);
      sort((a, b) => apriority - bpriority);
      map((def) => defname)}/**
   * Get all cognitive agents*/
  getCognitive.Agents(): string[] {
    return Arrayfrom(thisagent.Definitionsvalues());
      filter((def) => defcategory === AgentCategoryCOGNITIV.E);
      sort((a, b) => apriority - bpriority);
      map((def) => defname)}/**
   * Get all personal agents*/
  getPersonal.Agents(): string[] {
    return Arrayfrom(thisagent.Definitionsvalues());
      filter((def) => defcategory === AgentCategoryPERSONA.L);
      sort((a, b) => apriority - bpriority);
      map((def) => defname)}/**
   * Preload core agents for better performance*/
  async preloadCore.Agents(): Promise<void> {
    const core.Agents = thisgetCore.Agents();
    thisloggerinfo(`🚀 Preloading ${core.Agentslength} core agents.`);
    const load.Promises = core.Agentsmap((agent.Name) => thisgetAgent(agent.Name));
    const results = await Promiseall.Settled(load.Promises);
    const loaded = resultsfilter((r) => rstatus === 'fulfilled')length;
    const failed = resultsfilter((r) => rstatus === 'rejected')length;
    thisloggerinfo(`✅ Preloaded ${loaded} core agents (${failed} failed)`)}/**
   * Get registry status and metrics*/
  get.Status(): any {
    const definitions = Arrayfrom(thisagent.Definitionsvalues());
    const loaded = Arrayfrom(thisloaded.Agentskeys());
    return {
      total.Definitions: definitionslength;
      loaded.Agents: loadedlength;
      agentsBy.Category: {
        core: definitionsfilter((d) => dcategory === AgentCategoryCOR.E)length;
        cognitive: definitionsfilter((d) => dcategory === AgentCategoryCOGNITIV.E)length;
        utility: definitionsfilter((d) => dcategory === AgentCategoryUTILIT.Y)length;
        specialized: definitionsfilter((d) => dcategory === AgentCategorySPECIALIZE.D)length;
        personal: definitionsfilter((d) => dcategory === AgentCategoryPERSONA.L)length;
      };
      loadedAgents.List: loaded;
      core.Agents: thisgetCore.Agents();
      cognitive.Agents: thisgetCognitive.Agents();
      personal.Agents: thisgetPersonal.Agents();
    }}/**
   * Unload agents that haven't been used recently*/
  async unloadUnused.Agents(maxIdle.Minutes = 30): Promise<void> {
    const current.Time = new Date();
    const to.Unload: string[] = [];
    for (const [agent.Name, last.Used] of thisagent.Usageentries()) {
      if (thisloaded.Agentshas(agent.Name)) {
        const idleTime.Ms = currentTimeget.Time() - lastUsedget.Time();
        const idle.Minutes = idleTime.Ms / (1000 * 60);
        const definition = thisagent.Definitionsget(agent.Name);
        if (
          definition &&
          definitioncategory !== AgentCategoryCOR.E &&
          idle.Minutes > maxIdle.Minutes) {
          to.Unloadpush(agent.Name)}}};

    for (const agent.Name of to.Unload) {
      const agent = thisloaded.Agentsget(agent.Name);
      if (agent) {
        await agentshutdown();
        thisloaded.Agentsdelete(agent.Name);
        thisagent.Usagedelete(agent.Name);
        thisloggerinfo(`♻️ Unloaded idle agent: ${agent.Name}`);
        thisemit('agent_unloaded', { agent.Name })}};

    if (to.Unloadlength > 0) {
      thisloggerinfo(`♻️ Unloaded ${to.Unloadlength} idle agents`)}}/**
   * Get agent information*/
  getAgent.Info(agent.Name: string): any {
    const definition = thisagent.Definitionsget(agent.Name);
    if (!definition) return null;
    const is.Loaded = thisloaded.Agentshas(agent.Name);
    const last.Used = thisagent.Usageget(agent.Name);
    const agent = thisloaded.Agentsget(agent.Name);
    return {
      .definition;
      is.Loaded;
      last.Used: last.Used?toISO.String();
      status: agent?get.Status();
    }}/**
   * Gracefully shutdown all agents*/
  async shutdown(): Promise<void> {
    thisloggerinfo('🔄 Shutting down Universal Agent Registry.');
    const shutdown.Promises = Arrayfrom(thisloaded.Agentsvalues())map((agent) =>
      agentshutdown()catch((error) => thisloggererror(`Error shutting down agent:`, error)));
    await Promiseall.Settled(shutdown.Promises);
    thisloaded.Agentsclear();
    thisagent.Usageclear();
    thisloading.Locksclear();
    thisremoveAll.Listeners();
    thisloggerinfo('✅ Universal Agent Registry shutdown complete')}};

export default UniversalAgent.Registry;