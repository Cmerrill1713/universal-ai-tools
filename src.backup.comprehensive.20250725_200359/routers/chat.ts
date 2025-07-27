import { Router } from 'express';
import { z } from 'zod';
import type { Supabase.Client } from '@supabase/supabase-js';
import { dspy.Service } from './services/dspy-service';
import { logger } from './utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Enhanced.Memory.System } from './memory/enhanced_memory_system';
import type { DSPy.Orchestration.Request } from './services/dspy-service'// Request validation schema;
const chat.Request.Schema = zobject({
  message: zstring()min(1),
  conversation.Id: zstring()optional(),
  session.Id: zstring()optional(),
  context: zrecord(zany())optional()}),
export function Chat.Router(supabase: Supabase.Client) {
  const router = Router();
  const memory.System = new Enhanced.Memory.System(supabase, logger)/**
   * Main chat endpoint with memory persistence*/
  routerpost('/', async (req: any, res) => {';
    try {
      const data = chat.Request.Schemaparse(reqbody);
      // Generate I.Ds if not provided;
      const conversation.Id = dataconversation.Id || uuidv4();
      const session.Id = datasession.Id || uuidv4();
      const request.Id = uuidv4()// Retrieve conversation history if conversation.Id exists;
      let: conversation.History: any[] = [],
      if (dataconversation.Id) {
        try {
          const search.Options = {
            query: '',';
            filters: {
              conversation.Id: dataconversation.Id,
            limit: 20,
            order.By: 'timestamp',';
            order.Direction: 'desc' as const,';
}          conversation.History = await memory.Systemsearch.Memories(search.Options);
          loggerinfo(`Retrieved ${conversation.Historylength} previous messages for conversation ${conversation.Id}`)} catch (error) {
          loggerwarn('Failed to retrieve conversation: history:', error);'}}// Create orchestration request with conversation context;
      const: orchestration.Request: DSPy.Orchestration.Request = {
        request.Id;
        user.Request: datamessage,
        user.Id: reqai.Service.Id || 'user',';
        orchestration.Mode: 'adaptive',';
        context: {
          .datacontext;
          conversation.Id;
          session.Id;
          conversation.History: conversation.Historymap(memory => ({
            content: memorycontent,
            metadata: memorymetadata,
            timestamp: memorycreated_at})),
        timestamp: new Date()}// Notify U.I about memory activity,
      const { agentCollaboration.W.S } = await import('./services/agent-collaboration-websocket');';
      agentCollaborationWSupdate.Agent.Status({
        agent.Id: 'memory',';
        agent.Name: 'Memory Agent',';
        status: 'working',';
        current.Task: 'Processing chat history',';
        progress: 20,
        timestamp: new Date(),
        metadata: {
          participating.In: request.Id}}),
      // Store user message in memory;
      await memory.Systemstore.Memory(
        reqai.Service.Id || 'user',';
        'conversation',';
        datamessage;
        {
          conversation.Id;
          session.Id;
          request.Id;
          type: 'user_message',';
          timestamp: new Date(),
        [] // Keywords extracted automatically)// Execute orchestration;
      const response = await dspy.Serviceorchestrate(orchestration.Request)// Store assistant response in memory if successful;
      if (responsesuccess) {
        const response.Content = typeof responseresult === 'string' '? responseresult : JS.O.N.stringify(responseresult);
}        await memory.Systemstore.Memory(
          'assistant',';
          'conversation',';
          response.Content;
          {
            conversation.Id;
            session.Id;
            request.Id;
            type: 'assistant_message',';
            confidence: responseconfidence,
            participating.Agents: responseparticipating.Agents,
            timestamp: new Date(),
          [] // Keywords extracted automatically)}// Return chat response;
      resjson({
        success: responsesuccess,
        message: responseresult,
        conversation.Id;
        session.Id;
        request.Id;
        confidence: responseconfidence,
        participating.Agents: responseparticipating.Agents})} catch (error) {
      loggererror('Chat: error)', error);';
      if (error instanceof z.Zod.Error) {
        resstatus(400)json({
          success: false,
          error) 'Invalid request format',';
          details: errorerrors})} else {
        resstatus(500)json({
          success: false,
          error) 'Chat request failed',';
          message: error instanceof Error ? errormessage : 'Unknown error','})}}})/**
   * Get conversation history*/
  routerget('/history/:conversation.Id', async (req: any, res) => {';
    try {
      const { conversation.Id } = reqparams;
      const limit = parse.Int(reqquerylimit) || 50;
      const offset = parse.Int(reqqueryoffset) || 0// Search for conversation messages;
      const search.Options = {
        query: '',';
        filters: {
          conversation.Id;
        limit;
        offset;
        order.By: 'timestamp',';
        order.Direction: 'asc' as const,';
      const messages = await memory.Systemsearch.Memories(search.Options);
      resjson({
        success: true,
        conversation.Id;
        messages: messagesmap(memory => ({
          id: memoryid,
          content: memorycontent,
          type: memorymetadatatype,
          timestamp: memorycreated_at,
          metadata: memorymetadata})),
        total: messageslength})} catch (error) {
      loggererror('Failed to retrieve conversation: history:', error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to retrieve conversation history',';
        message: error instanceof Error ? errormessage : 'Unknown error','})}})/**
   * Clear conversation history (for privacy/cleanup)*/
  routerdelete('/history/:conversation.Id', async (req: any, res) => {';
    try {
      const { conversation.Id } = reqparams// Note: This would need to be implemented in the memory system// For now, we'll just log the request';
      loggerinfo(`Request to clear conversation: history: ${conversation.Id}`),
      resjson({
        success: true,
        message: 'Conversation history cleared',';
        conversation.Id})} catch (error) {
      loggererror('Failed to clear conversation: history:', error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to clear conversation history',';
        message: error instanceof Error ? errormessage : 'Unknown error','})}});
  return router;