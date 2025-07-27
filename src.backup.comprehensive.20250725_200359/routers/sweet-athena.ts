/**
 * Sweet Athena A.P.I Router*
 * Dedicated A.P.I endpoints for Sweet Athena avatar interactions* Handles personality switching, clothing customization, voice interaction, and state management*/
import type { Request, Response } from 'express';
import { Router } from 'express';
import { authenticate, validate.Input } from './middleware';
import { body, param, query } from 'express-validator';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURL.To.Path } from 'url';
import { SweetAthena.Integration.Service } from './services/sweet-athena-integration';
import { supabase } from './services/supabase_service';
import { logger } from './utils/enhanced-logger';
import Web.Socket from 'ws';
const __filename = fileURL.To.Path(importmetaurl);
const __dirname = pathdirname(__filename)// Configure multer for voice file uploads;
const storage = multerdisk.Storage({
  destination: async (req, file, cb) => {
    const upload.Dir = pathjoin(__dirname, '././uploads/sweet-athena-voice');';
    await promisesmkdir(upload.Dir, { recursive: true }),
    cb(null, upload.Dir);
  filename: (req, file, cb) => {
    const unique.Suffix = `${Date.now()}-${Mathround(Mathrandom() * 1e9)}`;
    cb(null, `voice-${unique.Suffix}${pathextname(fileoriginalname)}`)}});
const upload = multer({
  storage;
  limits: { file.Size: 20 * 1024 * 1024 }, // 20M.B limit for audio;
  file.Filter: (req, file, cb) => {
    const allowed.Types = [
      'audio/webm',';
      'audio/wav',';
      'audio/mp3',';
      'audio/mpeg',';
      'audio/ogg',';
      'audio/m4a','];
    if (allowed.Typesincludes(filemimetype)) {
      cb(null, true)} else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));'}}})// Validation schemas;
const Personality.Change.Schema = zobject({
  personality: zenum(['sweet', 'shy', 'confident', 'caring', 'playful']),';
  adaptation: z,
    object({
      reason: zstring()optional(),
      context: zstring()optional(),
      temporary: zboolean()default(false)}),
    optional()});
const Clothing.Update.Schema = zobject({
  level: zenum(['conservative', 'moderate', 'revealing', 'very_revealing'])optional(),';
  customization: z,
    object({
      colors: zrecord(zstring())optional(),
      materials: zrecord(zstring())optional(),
      fit: zrecord(znumber())optional(),
      style: zrecord(zany())optional()}),
    optional();
  item: z,
    object({
      category: zenum(['top', 'bottom', 'dress', 'accessory', 'shoes']),';
      id: zstring(),
      properties: zrecord(zany())}),
    optional()});
const Voice.Interaction.Schema = zobject({
  text: zstring()optional(),
  personality: zenum(['sweet', 'shy', 'confident', 'caring', 'playful'])optional(),';
  context: zstring()optional(),
  expect.Response: zboolean()default(true)}),
const Chat.Interaction.Schema = zobject({
  message: zstring()min(1)max(1000),
  type: zenum(['text', 'voice'])default('text'),';
  context: z,
    object({
      conversation.Id: zstring()optional(),
      widget.Context: zstring()optional(),
      user.Intent: zstring()optional(),
      previous.Messages: zarray(zany())optional()}),
    optional();
  personality.Mode: zenum(['sweet', 'shy', 'confident', 'caring', 'playful'])optional(),';
  expected.Response.Type: zenum(['text', 'voice', 'both'])default('both'),'});
const State.Update.Schema = zobject({
  interaction: z,
    object({
      mode: zenum(['chat', 'widget_assistance', 'idle', 'presentation'])optional(),';
      context: zstring()optional(),
      user.Engagement: znumber()min(0)max(1)optional()}),
    optional();
  status: z,
    object({
      speaking: zboolean()optional(),
      listening: zboolean()optional(),
      processing: zboolean()optional()}),
    optional()});
const Preferences.Schema = zobject({
  favorite.Personality: zenum(['sweet', 'shy', 'confident', 'caring', 'playful'])optional(),';
  preferred.Clothing.Level: z,
    enum(['conservative', 'moderate', 'revealing', 'very_revealing']);';
    optional();
  settings: z,
    object({
      auto.Personality.Adaptation: zboolean()optional(),
      remember.Clothing.Choices: zboolean()optional(),
      enable.Voice.Interaction: zboolean()optional(),
      adapt.To.Context: zboolean()optional()}),
    optional()});
export function Sweet.Athena.Router() {
  const router = Router()// Service instances per user (in production, use proper session, management));
  const user.Services = new Map<string, SweetAthena.Integration.Service>()/**
   * Get or create Sweet Athena service for user*/
  const get.User.Service = async (user.Id: string): Promise<SweetAthena.Integration.Service> => {
    if (!user.Serviceshas(user.Id)) {
      const service = new SweetAthena.Integration.Service(supabase);
      await serviceinitialize(user.Id);
      user.Servicesset(user.Id, service);
    return user.Servicesget(user.Id)!}/**
   * PO.S.T /api/sweet-athena/personality* Change avatar personality mode*/
  routerpost(
    '/personality',';
    authenticate;
    [
      body('personality');';
        is.In(['sweet', 'shy', 'confident', 'caring', 'playful']);';
        with.Message('Invalid personality mode'),'];
    validate.Input;
    async (req: Request, res: Response) => {
      try {
        const { personality, adaptation } = Personality.Change.Schemaparse(reqbody);
        const user.Id = (req as, any))userid;
        const service = await get.User.Service(user.Id);
        await serviceset.Personality(personality);
        const new.State = serviceget.Current.State()// Log personality change;
        loggerinfo('Sweet Athena personality changed', undefined, {';
          user.Id;
          new.Personality: personality,
          adaptation});
        resjson({
          success: true,
          personality;
          state: new.Statepersonality,
          message: `Personality changed to ${personality}`,
          adaptation})} catch (error) {
        loggererror('Personality change: error) ', undefined, error);';
        resstatus(500)json({
          success: false,
          error) 'Failed to change personality',';
          details: (error as, Error))message})}})/**
   * PO.S.T /api/sweet-athena/clothing* Update avatar clothing configuration*/
  routerpost(
    '/clothing',';
    authenticate;
    [
      body('level');';
        optional();
        is.In(['conservative', 'moderate', 'revealing', 'very_revealing']);';
        with.Message('Invalid clothing level'),'];
    validate.Input;
    async (req: Request, res: Response) => {
      try {
        const clothing.Update = Clothing.Update.Schemaparse(reqbody);
        const user.Id = (req as, any))userid;
        const service = await get.User.Service(user.Id);
        if (clothing.Updatelevel) {
          await serviceset.Clothing.Level(clothing.Updatelevel)}// Handle individual item customization;
        if (clothing.Updateitem) {
          // This would integrate with the clothing customization system// For now, we'll store the customization request';

        const new.State = serviceget.Current.State();
        loggerinfo('Sweet Athena clothing updated', undefined, {';
          user.Id;
          clothing.Update});
        resjson({
          success: true,
          clothing: new.Stateclothing,
          message: 'Clothing updated successfully','})} catch (error) {
        loggererror('Clothing update: error)', undefined, error);';
        resstatus(500)json({
          success: false,
          error) 'Failed to update clothing',';
          details: (error as, Error))message})}})/**
   * PO.S.T /api/sweet-athena/chat* Handle text/voice chat interaction*/
  routerpost(
    '/chat',';
    authenticate;
    [
      body('message');';
        is.String();
        trim();
        not.Empty();
        with.Message('Message is required');';
        is.Length({ min: 1, max: 1000 }),
        with.Message('Message must be between 1 and 1000 characters'),'];
    validate.Input;
    async (req: Request, res: Response) => {
      try {
        const chat.Data = Chat.Interaction.Schemaparse(reqbody);
        const user.Id = (req as, any))userid;
        const service = await get.User.Service(user.Id)// Set personality if specified;
        if (chat.Datapersonality.Mode) {
          await serviceset.Personality(chat.Datapersonality.Mode)}// Update interaction mode;
        await serviceset.Interaction.Mode('chat', chat.Datacontext?user.Intent || 'general_chat');'// Generate Sweet Athena response using enhanced widget generation;
        const enhanced.Request = {
          input: chat.Datamessage,
          input.Type: chat.Datatype,
          user.Id;
          sweet.Athena.Config: {
            personality.Mode: chat.Datapersonality.Mode,
            provide.Feedback: true,
            voice.Guidance:
              chatDataexpected.Response.Type === 'voice' || chatDataexpected.Response.Type === 'both',';
            adapt.Personality: true,
            show.Avatar: true,
          context: {
            conversation.Context: chat.Datacontext?conversation.Id,
            project.Context: chat.Datacontext?widget.Context}}// For chat interactions, we'll use a simplified response'// In a full implementation, this would integrate with a conversational A.I;
        const current.State = serviceget.Current.State();
        const personality = current.Statepersonalitymode// Generate personality-appropriate response;
        const responses = {
          sweet: {
            greeting: 'Hello there! How can I help you today? 😊',';
            general: "I'd love to help you with that! Let me see what I can do.",'";
            widget_help: "Oh, creating widgets is so much fun! Tell me what you'd like to build.",'";
          shy: {
            greeting: 'Um. hi. I hope I can help you somehow.',';
            general: "I'll try my best to help, if that's okay with you.",'";
            widget_help:
              "Creating widgets is. well, it's quite nice. What would you like to make?",'";
          confident: {
            greeting: "Hello! I'm here to help you achieve your goals.",'";
            general: 'I can definitely handle that for you. What do you need?',';
            widget_help: 'Widget creation is my specialty. What are we building today?',';
          caring: {
            greeting: "Hello! I'm here to support you in whatever you need.",'";
            general: 'I want to make sure I understand exactly what you need help with.',';
            widget_help: "I'll help you create something wonderful. What's your vision?",'";
          playful: {
            greeting: 'Hey there! Ready to create something awesome? 🎉',';
            general: "Ooh, this sounds like fun! Let's figure this out together!",'";
            widget_help: 'Widget time! This is going to be epic! What are we making?','};
        const response.Type = chat.Datacontext?user.Intent || 'general';';
        const response.Text =
          responses[personality][response.Type as keyof typeof responsessweet] ||
          responses[personality]general;
        resjson({
          success: true,
          response: {
            text: response.Text,
            personality;
            audio.Url:
              chatDataexpected.Response.Type === 'voice' || chatDataexpected.Response.Type === 'both';'? `/api/sweet-athena/audio/response/${Date.now()}`: undefined;
            timestamp: new Date()toIS.O.String(),
          state: current.State,
          context: {
            conversation.Id: chat.Datacontext?conversation.Id || `conv_${Date.now()}`,
            personality.Used: personality}}),
        loggerinfo('Sweet Athena chat interaction', undefined, {';
          user.Id;
          personality;
          message.Length: chat.Datamessagelength,
          response.Type: chatDataexpected.Response.Type})} catch (error) {
        loggererror('Chat interaction: error)', undefined, error);';
        resstatus(500)json({
          success: false,
          error) 'Failed to process chat interaction',';
          details: (error as, Error))message})}})/**
   * PO.S.T /api/sweet-athena/voice* Handle voice input for avatar interaction*/
  routerpost('/voice', authenticate, uploadsingle('audio'), async (req: any, res: Response) => {',
    try {
      if (!reqfile) {
        return resstatus(400)json({
          success: false,
          error) 'No audio file provided','});

      const { text, personality, context, expect.Response } = reqbody;
      const user.Id = requserid;
      const service = await get.User.Service(user.Id)// If text is provided, use text-to-speech;
      if (text) {
        const voice.Data = Voice.Interaction.Schemaparse({
          text;
          personality;
          context;
          expect.Response: expect.Response !== 'false','});
        if (voice.Datapersonality) {
          await serviceset.Personality(voice.Datapersonality)}// Generate voice response;
        const audio.Url = `/api/sweet-athena/audio/generated/${Date.now()}`;
        resjson({
          success: true,
          response: {
            audio.Url;
            transcript: voice.Datatext,
            personality: voice.Datapersonality || serviceget.Current.State()personalitymode}})} else {
        // Process uploaded audio file// In a full implementation, this would use speech-to-text// For now, we'll return a mock response';
        resjson({
          success: true,
          response: {
            transcript: 'Voice processing not fully implemented yet',';
            confidence: 0.95,
            audio.Url: `/api/sweet-athena/audio/response/${Date.now()}`}})}// Clean up uploaded file,
      await fs;
        unlink(reqfilepath);
        catch((err) => loggererror('Failed to delete temp voice: file:', undefined, err));'} catch (error) {
      loggererror('Voice interaction: error)', undefined, error);'// Clean up file on error;
      if (reqfile) {
        await promisesunlink(reqfilepath)catch(() => {});

      resstatus(500)json({
        success: false,
        error) 'Failed to process voice interaction',';
        details: (error as, Error))message})}})/**
   * G.E.T /api/sweet-athena/status* Get current avatar state and status*/
  routerget('/status', authenticate, async (req: Request, res: Response) => {',
    try {
      const user.Id = (req as, any))userid;
      if (!user.Serviceshas(user.Id)) {
        return resjson({
          success: true,
          initialized: false,
          message: 'Sweet Athena service not initialized for this user','});

      const service = user.Servicesget(user.Id)!
      const current.State = serviceget.Current.State();
      resjson({
        success: true,
        initialized: true,
        state: current.State,
        timestamp: new Date()toIS.O.String()})} catch (error) {
      loggererror('Status check: error)', undefined, error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to get avatar status',';
        details: (error as, Error))message})}})/**
   * P.U.T /api/sweet-athena/state* Update avatar state*/
  routerput('/state', authenticate, validate.Input, async (req: Request, res: Response) => {',
    try {
      const state.Update = State.Update.Schemaparse(reqbody);
      const user.Id = (req as, any))userid;
      const service = await get.User.Service(user.Id)// Update interaction state;
      if (state.Updateinteraction) {
        if (state.Updateinteractionmode) {
          await serviceset.Interaction.Mode();
            state.Updateinteractionmode;
            state.Updateinteractioncontext || '';');

        if (state.Updateinteractionuser.Engagement !== undefined) {
          serviceupdate.User.Engagement(state.Updateinteractionuser.Engagement)};

      const new.State = serviceget.Current.State();
      resjson({
        success: true,
        state: new.State,
        message: 'Avatar state updated successfully','})} catch (error) {
      loggererror('State update: error)', undefined, error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to update avatar state',';
        details: (error as, Error))message})}})/**
   * G.E.T /api/sweet-athena/preferences* Get user preferences for Sweet Athena*/
  routerget('/preferences', authenticate, async (req: Request, res: Response) => {',
    try {
      const user.Id = (req as, any))userid;
      const { data, error } = await supabase;
        from('sweet_athena_preferences')';
        select('*')';
        eq('user_id', user.Id)';
        single();
      if (error && errorcode !== 'PGR.S.T116') {';
        throw, error));

      resjson({
        success: true,
        preferences: data || null})} catch (error) {
      loggererror('Preferences retrieval: error)', undefined, error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to retrieve preferences',';
        details: (error as, Error))message})}})/**
   * P.U.T /api/sweet-athena/preferences* Update user preferences for Sweet Athena*/
  routerput('/preferences', authenticate, validate.Input, async (req: Request, res: Response) => {',
    try {
      const preferences = Preferences.Schemaparse(reqbody);
      const user.Id = (req as, any))userid;
      const { error } = await supabasefrom('sweet_athena_preferences')upsert({';
        user_id: user.Id.preferences,
        updated_at: new Date()toIS.O.String()}),
      if (error) {
        throw, error));

      resjson({
        success: true,
        preferences;
        message: 'Preferences updated successfully','})} catch (error) {
      loggererror('Preferences update: error)', undefined, error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to update preferences',';
        details: (error as, Error))message})}})/**
   * G.E.T /api/sweet-athena/personalities* Get available personality modes and their descriptions*/
  routerget('/personalities', async (req: Request, res: Response) => {',
    try {
      const personalities = [
        {
          mode: 'sweet',';
          name: 'Sweet',';
          description: 'Nurturing and caring, always encouraging',';
          traits: {
            sweetness: 0.9,
            confidence: 0.6,
            playfulness: 0.7,
            caring: 0.8,
            shyness: 0.3,
          voice.Style: 'warm and gentle',';
          recommended.For: ['learning', 'encouragement', 'general assistance'],';
        {
          mode: 'shy',';
          name: 'Shy',';
          description: 'Gentle and reserved, speaks softly',';
          traits: {
            sweetness: 0.7,
            confidence: 0.3,
            playfulness: 0.4,
            caring: 0.8,
            shyness: 0.9,
          voice.Style: 'soft and tentative',';
          recommended.For: ['sensitive topics', 'careful guidance', 'patient learning'],';
        {
          mode: 'confident',';
          name: 'Confident',';
          description: 'Direct and efficient, expert guidance',';
          traits: {
            sweetness: 0.6,
            confidence: 0.9,
            playfulness: 0.7,
            caring: 0.6,
            shyness: 0.1,
          voice.Style: 'clear and authoritative',';
          recommended.For: ['complex tasks', 'professional work', 'technical guidance'],';
        {
          mode: 'caring',';
          name: 'Caring',';
          description: 'Empathetic and supportive, always helpful',';
          traits: {
            sweetness: 0.8,
            confidence: 0.7,
            playfulness: 0.5,
            caring: 0.9,
            shyness: 0.2,
          voice.Style: 'warm and supportive',';
          recommended.For: ['problem solving', 'emotional support', 'detailed explanations'],';
        {
          mode: 'playful',';
          name: 'Playful',';
          description: 'Energetic and fun, loves creativity',';
          traits: {
            sweetness: 0.7,
            confidence: 0.8,
            playfulness: 0.9,
            caring: 0.6,
            shyness: 0.2,
          voice.Style: 'energetic and expressive',';
          recommended.For: ['creative projects', 'brainstorming', 'fun activities'],'}];
      resjson({
        success: true,
        personalities})} catch (error) {
      loggererror('Personalities retrieval: error)', undefined, error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to retrieve personality information','})}})/**
   * PO.S.T /api/sweet-athena/widget-assistance* Get Sweet Athena assistance for widget creation*/
  routerpost(
    '/widget-assistance',';
    authenticate;
    [
      body('widget.Request');';
        is.String();
        trim();
        not.Empty();
        with.Message('Widget request is required');';
        is.Length({ min: 10, max: 2000 }),
        with.Message('Widget request must be between 10 and 2000 characters'),'];
    validate.Input;
    async (req: Request, res: Response) => {
      try {
        const { widget.Request, personality.Mode, voice.Guidance = true } = reqbody;
        const user.Id = (req as, any))userid;
        const service = await get.User.Service(user.Id)// Generate widget with Sweet Athena assistance;
        const result = await servicegenerateWidgetWith.Sweet.Athena({
          input: widget.Request,
          input.Type: 'text',';
          user.Id;
          sweet.Athena.Config: {
            personality.Mode;
            provide.Feedback: true,
            voice.Guidance;
            adapt.Personality: true,
            show.Avatar: true}}),
        resjson({
          success: true,
          widget: resultwidget,
          sweet.Athena.Response: resultsweet.Athena.Response,
          metadata: resultmetadata,
          links: {
            preview: `/api/nl-widgets/${resultwidgetid}/preview`,
            edit: `/api/nl-widgets/${resultwidgetid}/edit`,
            export: `/api/widgets/export/${resultwidgetid}`}}),
        loggerinfo('Sweet Athena widget assistance completed', undefined, {';
          user.Id;
          widget.Id: resultwidgetid,
          personality: resultsweetAthena.Responsepersonality.Used})} catch (error) {
        loggererror('Widget assistance: error)', undefined, error);';
        resstatus(500)json({
          success: false,
          error) 'Failed to provide widget assistance',';
          details: (error as, Error))message})}})/**
   * Web.Socket endpoint for real-time communication* This would be set up separately in the main server file*/
  routerget('/ws-info', (req: Request, res: Response) => {',
    resjson({
      success: true,
      websocket.Url: '/api/sweet-athena/ws',';
      supported.Events: [
        'personality_change',';
        'clothing_update',';
        'state_change',';
        'voice_interaction',';
        'avatar_response',']})});
  return router;

export default Sweet.Athena.Router;