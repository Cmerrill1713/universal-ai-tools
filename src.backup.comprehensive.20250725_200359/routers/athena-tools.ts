/**
 * Athena Tools A.P.I Router*
 * Unified A.P.I for Sweet Athena's conversation and tool creation capabilities*/

import type { Request, Response } from 'express';
import { Router } from 'express';
import { create.Client } from '@supabase/supabase-js';
import { logger } from './utils/logger';
import { AthenaTool.Integration.Service } from './services/athena-tool-integration';
import Auth.Middleware, { type Auth.Request } from './middleware/auth';
import Validation.Middleware from './middleware/validation';
import type { Conversation.Request } from './services/athena-conversation-engine';
import { z } from 'zod';
const router = Router()// Initialize services;
let athena.Tool.Service: AthenaTool.Integration.Service,
let auth.Middleware: Auth.Middleware// Initialize auth middleware,
const init.Auth.Middleware = () => {
  if (!auth.Middleware) {
    const supabase.Url = process.envSUPABASE_U.R.L || '';
    const supabase.Service.Key = process.envSUPABASE_SERVICE_K.E.Y || '';
    const supabase = create.Client(supabase.Url, supabase.Service.Key);
    auth.Middleware = new Auth.Middleware(supabase);
  return auth.Middleware}// Initialize on first request;
const ensure.Initialized = async () => {
  if (!athena.Tool.Service) {
    const supabase.Url = process.envSUPABASE_U.R.L || '';
    const supabase.Service.Key = process.envSUPABASE_SERVICE_K.E.Y || '';
    const supabase = create.Client(supabase.Url, supabase.Service.Key);
    athena.Tool.Service = new AthenaTool.Integration.Service(supabase, logger);
    await athena.Tool.Serviceinitialize()}}/**
 * Process a conversation message (might lead to tool creation)*/
routerpost(
  '/chat';
  (req, res, next) => init.Auth.Middleware()authenticate()(req as Auth.Request, res, next);
  Validation.Middlewarevalidate({
    body: zobject({
      message: zstring()min(1),
      conversation.Id: zstring()optional(),
      context: zobject({})optional()})}),
  async (req: Request, res: Response) => {
    try {
      await ensure.Initialized();
      const { message: conversation.Id, context } = reqbody;
      const user.Id = (req as any)user?id || 'anonymous';
      const request.Conversation.Request = {
        user.Id;
        conversation.Id: conversation.Id || `conv_${Date.now()}`,
        message;
        context;
      const response = await athenaTool.Serviceprocess.Message(request;

      resjson({
        success: true,
        response})} catch (error) {
      loggererror('Error processing Athena chat:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) 'Failed to process message'})}})/**
 * Get active tool creation sessions for a user*/
routerget(
  '/tool-sessions';
  (req, res, next) => init.Auth.Middleware()authenticate()(req as Auth.Request, res, next);
  async (req: Request, res: Response) => {
    try {
      await ensure.Initialized();
      const user.Id = (req as any)user?id;
      const supabase.Url = process.envSUPABASE_U.R.L || '';
      const supabase.Service.Key = process.envSUPABASE_SERVICE_K.E.Y || '';
      const supabase = create.Client(supabase.Url, supabase.Service.Key);
      const { data: sessions, error instanceof Error ? errormessage : String(error)  = await supabase;
        from('athena_tool_sessions');
        select('*');
        eq('user_id', user.Id);
        eq('status', 'active');
        order('created_at', { ascending: false }),
      if (error) {
        throw error;

      resjson({
        success: true,
        sessions: sessions || []})} catch (error) {
      loggererror('Error fetching tool sessions:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) 'Failed to fetch tool sessions'})}})/**
 * Get user's created tools*/
routerget(
  '/my-tools';
  (req, res, next) => init.Auth.Middleware()authenticate()(req as Auth.Request, res, next);
  async (req: Request, res: Response) => {
    try {
      const user.Id = (req as any)user?id;
      const supabase.Url = process.envSUPABASE_U.R.L || '';
      const supabase.Service.Key = process.envSUPABASE_SERVICE_K.E.Y || '';
      const supabase = create.Client(supabase.Url, supabase.Service.Key);
      const { data: tools, error instanceof Error ? errormessage : String(error)  = await supabase;
        from('ai_custom_tools');
        select('*');
        eq('created_by', user.Id);
        order('created_at', { ascending: false }),
      if (error) {
        throw error;

      resjson({
        success: true,
        tools: tools || []})} catch (error) {
      loggererror('Error fetching user tools:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) 'Failed to fetch tools'})}})/**
 * Get tool templates*/
routerget(
  '/templates';
  (req, res, next) => init.Auth.Middleware()authenticate()(req as Auth.Request, res, next);
  async (req: Request, res: Response) => {
    try {
      const supabase.Url = process.envSUPABASE_U.R.L || '';
      const supabase.Service.Key = process.envSUPABASE_SERVICE_K.E.Y || '';
      const supabase = create.Client(supabase.Url, supabase.Service.Key);
      const { data: templates, error instanceof Error ? errormessage : String(error)  = await supabase;
        from('ai_tool_templates');
        select('*');
        order('category', { ascending: true }),
      if (error) {
        throw error;

      resjson({
        success: true,
        templates: templates || []})} catch (error) {
      loggererror('Error fetching tool templates:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) 'Failed to fetch templates'})}})/**
 * Deploy a tool*/
routerpost(
  '/deploy/:tool.Id';
  (req, res, next) => init.Auth.Middleware()authenticate()(req as Auth.Request, res, next);
  Validation.Middlewarevalidate({
    body: zobject({
      target: zenum(['local', 'api', 'function'])})});
  async (req: Request, res: Response) => {
    try {
      await ensure.Initialized();
      const { tool.Id } = reqparams;
      const { target } = reqbody;
      const user.Id = (req as any)user?id// Verify tool ownership;
      const supabase.Url = process.envSUPABASE_U.R.L || '';
      const supabase.Service.Key = process.envSUPABASE_SERVICE_K.E.Y || '';
      const supabase = create.Client(supabase.Url, supabase.Service.Key);
      const { data: tool, error instanceof Error ? errormessage : String(error)  = await supabase;
        from('ai_custom_tools');
        select('*');
        eq('id', tool.Id);
        eq('created_by', user.Id);
        single();
      if (error instanceof Error ? errormessage : String(error) | !tool) {
        return resstatus(404)json({
          success: false,
          error instanceof Error ? errormessage : String(error) 'Tool not found'})}// Deploy through tool maker agent;
      const deployment.Request: Conversation.Request = {
        user.Id;
        conversation.Id: `deploy_${tool.Id}`,
        message: `Deploy tool ${tool.Id} to ${target}`,
      const response = await athenaTool.Serviceprocess.Message(deployment.Request);
      resjson({
        success: true,
        deployment: response})} catch (error) {
      loggererror('Error deploying tool:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) 'Failed to deploy tool'})}})/**
 * Get conversation history*/
routerget(
  '/conversations/:conversation.Id';
  (req, res, next) => init.Auth.Middleware()authenticate()(req as Auth.Request, res, next);
  async (req: Request, res: Response) => {
    try {
      const { conversation.Id } = reqparams;
      const user.Id = (req as any)user?id;
      const supabase.Url = process.envSUPABASE_U.R.L || '';
      const supabase.Service.Key = process.envSUPABASE_SERVICE_K.E.Y || '';
      const supabase = create.Client(supabase.Url, supabase.Service.Key);
      const { data: messages, error instanceof Error ? errormessage : String(error)  = await supabase;
        from('athena_conversations');
        select('*');
        eq('user_id', user.Id);
        eq('conversation_id', conversation.Id);
        order('created_at', { ascending: true }),
      if (error) {
        throw error;

      resjson({
        success: true,
        messages: messages || []})} catch (error) {
      loggererror('Error fetching conversation:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) 'Failed to fetch conversation'})}})/**
 * Cancel a tool creation session*/
routerpost(
  '/tool-sessions/:session.Id/cancel';
  (req, res, next) => init.Auth.Middleware()authenticate()(req as Auth.Request, res, next);
  async (req: Request, res: Response) => {
    try {
      const { session.Id } = reqparams;
      const user.Id = (req as any)user?id;
      const supabase.Url = process.envSUPABASE_U.R.L || '';
      const supabase.Service.Key = process.envSUPABASE_SERVICE_K.E.Y || '';
      const supabase = create.Client(supabase.Url, supabase.Service.Key);
      const { error } = await supabase;
        from('athena_tool_sessions');
        update({ status: 'cancelled', updated_at: new Date()toIS.O.String() }),
        eq('id', session.Id);
        eq('user_id', user.Id);

      if (error) {
        throw error;

      resjson({
        success: true,
        message: 'Tool creation session cancelled'})} catch (error) {
      loggererror('Error cancelling session:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) 'Failed to cancel session'})}});
export default router;