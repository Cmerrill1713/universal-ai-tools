#!/usr/bin/env node/**
 * Universal A.I Tools M.C.P Server* Provides Claude with direct access to your agent orchestration system*/

import { Server } from '@modelcontextprotocol/sdk/server/indexjs';
import { StdioServer.Transport } from '@modelcontextprotocol/sdk/server/stdiojs';
import type { Tool } from '@modelcontextprotocol/sdk/typesjs';
import { CallToolRequest.Schema, ListToolsRequest.Schema } from '@modelcontextprotocol/sdk/typesjs';
import { create.Client } from '@supabase/supabase-js';
import { UniversalAgent.Registry } from './agents/universal_agent_registryjs';
import { dspy.Service } from './services/dspy-servicejs';
import { EnhancedMemory.System } from './memory/enhanced_memory_systemjs';
import { logger } from './utils/loggerjs'// Initialize services;
const supabase = create.Client(
  process.envSUPABASE_UR.L || '';
  process.envSUPABASE_SERVICE_KE.Y || '');
const agent.Registry = new UniversalAgent.Registry(null, supabase);
const memory.System = new EnhancedMemory.System(supabase)// Define available tools;
const TOO.L.S: Tool[] = [
  {
    name: 'execute_agent';,
    description: 'Execute a specific agent from the Universal A.I Tools registry',
    input.Schema: {
      type: 'object',
      properties: {
        agent.Name: {
          type: 'string',
          description: 'Name of the agent to execute (eg., planner_agent, evaluation_agent)';
        task: {
          type: 'string',
          description: 'The task or request for the agent to process',
}        context: {
          type: 'object',
          description: 'Additional context for the agent',
          properties: {
}};
      required: ['agent.Name', 'task']};
  {
    name: 'orchestrate_agents';,
    description: 'Orchestrate multiple agents using D.S.Py for complex tasks',
    input.Schema: {
      type: 'object',
      properties: {
        user.Request: {
          type: 'string',
          description: 'The user request to process',
}        mode: {
          type: 'string',
          enum: ['simple', 'standard', 'cognitive', 'adaptive'];
          description: 'Orchestration mode',
}        agents: {
          type: 'array',
          items: { type: 'string' ,
          description: 'Specific agents to include in orchestration',
        };
      required: ['user.Request'],
    };
  {
    name: 'search_memory';,
    description: 'Search the Universal A.I Tools memory system',
    input.Schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for semantic memory search',
}        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10,
}        filters: {
          type: 'object',
          description: 'Additional filters for memory search',
        };
      required: ['query'],
    };
  {
    name: 'store_memory';,
    description: 'Store information in the Universal A.I Tools memory system',
    input.Schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Content to store in memory',
}        type: {
          type: 'string',
          enum: ['conversation', 'knowledge', 'task', 'feedback'];
          description: 'Type of memory to store',
}        metadata: {
          type: 'object',
          description: 'Additional metadata for the memory',
        };
      required: ['content', 'type']};
  {
    name: 'evaluate_response';,
    description: 'Use the evaluation agent to score and analyze a response',
    input.Schema: {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'The response to evaluate',
}        criteria: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['accuracy', 'relevance', 'completeness', 'clarity', 'efficiency', 'safety'];
          description: 'Evaluation criteria to use',
        };
      required: ['response'],
    };
  {
    name: 'get_agent_status';,
    description: 'Get status and information about available agents',
    input.Schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'core', 'cognitive', 'personal', 'evolved'];
          description: 'Category of agents to list',
          default: 'all',
        }}}}]// Create M.C.P server;
const server = new Server(
  {
    name: 'universal-ai-tools';,
    version: '1.0.0',
}  {
    capabilities: {
      tools: {
}}})// Handle tool listing;
serversetRequest.Handler(ListToolsRequest.Schema, async () => {
  return {
    tools: TOO.L.S,
  }})// Handle tool execution;
serversetRequest.Handler(CallToolRequest.Schema, async (request) => {
  const { name, arguments: args } = requestparams,
  try {
    switch (name) {
      case 'execute_agent': {
        const {
          agent.Name;
          task;
          context = {}} = args as {
          agent.Name: string,
          task: string,
          context?: Record<string, unknown>;
        const agent = await agentRegistryget.Agent(agent.Name);
        if (!agent) {
          throw new Error(`Agent ${agent.Name} not found`);

        const result = await agentexecute({
          task;
          context: {
            .context;
            source: 'mcp',
            timestamp: new Date()toISO.String(),
          }});
        return {
          content: [
            {
              type: 'text',
              text: JSO.N.stringify(result, null, 2)}]};

      case 'orchestrate_agents': {
        const {
          user.Request;
          mode = 'standard';
          agents} = args as {
          user.Request: string,
          mode?: string;
          agents?: string[];
}        const result = await dspy.Serviceorchestrate({
          request.Id: `mcp-${Date.now()}`,
          user.Request;
          user.Id: 'mcp-claude',
          orchestration.Mode: mode,
          participating.Agents: agents,
          context: {
            source: 'mcp',
          }});
        return {
          content: [
            {
              type: 'text',
              text: JSO.N.stringify(result, null, 2)}]};

      case 'search_memory': {
        const {
          query;
          limit = 10;
          filters = {}} = args as {
          query: string,
          limit?: number;
          filters?: Record<string, unknown>;
        const results = await memory.Systemsearch('mcp-claude', query, limit, filters);
        return {
          content: [
            {
              type: 'text',
              text: JSO.N.stringify(results, null, 2)}]};

      case 'store_memory': {
        const {
          content;
          type;
          metadata = {}} = args as {
          content: string,
          type: string,
          metadata?: Record<string, unknown>;
        const memory = await memorySystemstore.Memory('mcp-claude', type, content, {
          .metadata;
          source: 'mcp',
          timestamp: new Date()toISO.String()}),
        return {
          content: [
            {
              type: 'text',
              text: `Memory stored successfully with I.D: ${memoryid}`}]},

      case 'evaluate_response': {
        const { response, criteria = ['accuracy', 'relevance', 'completeness'] } = args as {
          response: string,
          criteria?: string[];
}        const evaluation.Agent = await agentRegistryget.Agent('evaluation_agent');
        if (!evaluation.Agent) {
          throw new Error('Evaluation agent not available');

        const result = await evaluation.Agentexecute({
          task: `Evaluate the following response: "${response}"`,
          context: {
            criteria;
            source: 'mcp',
          }});
        return {
          content: [
            {
              type: 'text',
              text: JSO.N.stringify(result, null, 2)}]};

      case 'get_agent_status': {
        const { category = 'all' } = args as {
          category?: string;
}        const agents = [];
        if (category === 'all' || category === 'core') {
          agentspush(.agentRegistrygetCore.Agents());
        if (category === 'all' || category === 'cognitive') {
          agentspush(.agentRegistrygetCognitive.Agents());
        if (category === 'all' || category === 'personal') {
          agentspush(.agentRegistrygetPersonal.Agents());

        const status = agentsmap((agent) => ({
          name: agentname,
          description: agentdescription,
          category: agentcategory,
          capabilities: agentcapabilities,
          status: agentRegistryisAgent.Loaded(agentname) ? 'loaded' : 'available'})),
        return {
          content: [
            {
              type: 'text',
              text: JSO.N.stringify(status, null, 2)}]};
}      default:
        throw new Error(`Unknown tool: ${name}`)}} catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? errormessage : 'Unknown error'}`}],
      is.Error: true,
    }}})// Start the server;
async function main() {
  const transport = new StdioServer.Transport();
  await serverconnect(transport);
  loggerinfo('Universal A.I Tools M.C.P Server started');

main()catch((error) => {
  loggererror('Failed to start M.C.P server:', error);
  processexit(1)});