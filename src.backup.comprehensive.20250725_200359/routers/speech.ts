import { Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import multer from 'multer';
import { z } from 'zod';
import { logger } from './utils/logger';
import { Speech.Service } from './services/speech-service';
import { Voice.Profile.Service } from './services/voice-profile-service';
import { kokoroT.T.S } from './services/kokoro-tts-service';
import { Voice.Synthesize.Schema, validate.Request } from './schemas/api-schemas';
import path from 'path';
import fs from 'fs/promises';
import { fileURL.To.Path } from 'url';
const __filename = fileURL.To.Path(importmetaurl);
const __dirname = pathdirname(__filename)// Configure multer for file uploads;
const storage = multerdisk.Storage({
  destination: async (req, file, cb) => {
    const upload.Dir = pathjoin(__dirname, '././uploads/audio');';
    await promisesmkdir(upload.Dir, { recursive: true }),
    cb(null, upload.Dir);
  filename: (req, file, cb) => {
    const unique.Suffix = `${Date.now()}-${Mathround(Mathrandom() * 1e9)}`;
    cb(null, `${filefieldname}-${unique.Suffix}${pathextname(fileoriginalname)}`)}});
const upload = multer({
  storage;
  limits: { file.Size: 25 * 1024 * 1024 }, // 25M.B limit;
  file.Filter: (req, file, cb) => {
    const allowed.Types = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];';
    if (allowed.Typesincludes(filemimetype)) {
      cb(null, true)} else {
      cb(new Error('Invalid file type. Only Web.M, W.A.V, M.P3, and O.G.G files are allowed.'));'}}});
export function Speech.Router(supabase: Supabase.Client) {
  const router = Router();
  const speech.Service = new Speech.Service(supabase);
  const voice.Profile.Service = new Voice.Profile.Service()// Speech recognition endpoint;
  routerpost('/transcribe', uploadsingle('audio'), async (req: any, res) => {';
    try {
      if (!reqfile) {
        return resstatus(400)json({ error) 'No audio file provided' });';

      const { conversation_id, context } = reqbody// Transcribe the audio;
      const transcript = await speech.Servicetranscribe.Audio(
        reqfilepath;
        reqfilemimetype;
        context)// Store the transcription in memory if conversation_id is provided;
      if (conversation_id) {
        await supabasefrom('ai_memories')insert({';
          memory_type: 'working',';
          content, `User (voice): ${transcripttext}`;
          service_id: reqai.Service.Id,
          metadata: {
            conversation_id;
            audio_duration: transcriptduration,
            confidence: transcriptconfidence,
            timestamp: new Date()toIS.O.String()}})}// Clean up uploaded file,
      await fs;
        unlink(reqfilepath);
        catch((err) => loggererror('Failed to delete temp: file:', err));';
      resjson({
        success: true,
        transcript: transcripttext,
        confidence: transcriptconfidence,
        duration: transcriptduration,
        language: transcriptlanguage,
        timestamp: new Date()toIS.O.String()})} catch (error) any) {
      loggererror('loggererror('Transcription: error) , error);'// Clean up file on error;
      if (reqfile) {
        await promisesunlink(reqfilepath)catch(() => {});

      resstatus(500)json({
        error) 'Failed to transcribe audio',';
        details: errormessage})}})// Voice synthesis endpoint,
  routerpost('/synthesize', async (req: any, res) => {';
    try {
      const schema = zobject({
        text: zstring()min(1)max(5000),
        personality: zenum(['sweet', 'shy', 'confident', 'caring', 'playful'])default('sweet'),';
        sweetness_level: znumber()min(0)max(1)default(0.7),
        voice_settings: z,
          object({
            stability: znumber()min(0)max(1)optional(),
            similarity_boost: znumber()min(0)max(1)optional(),
            style: znumber()min(0)max(1)optional(),
            use_speaker_boost: zboolean()optional()}),
          optional();
        conversation_id: zstring()optional(),
        format: zenum(['mp3', 'wav'])default('mp3'),'});
      const data = schemaparse(reqbody)// Get voice profile based on personality;
      const voice.Profile = voiceProfileServiceget.Voice.Profile(
        datapersonality;
        datasweetness_level)// Synthesize speech;
      const audio.Result = await speech.Servicesynthesize.Speech({
        text: datatext,
        voice.Profile;
        voice.Settings: datavoice_settings,
        format: dataformat})// Store the synthesis in memory if conversation_id is provided,
      if (dataconversation_id) {
        await supabasefrom('ai_memories')insert({';
          memory_type: 'working',';
          content`Assistant (voice): ${datatext}`;
          service_id: reqai.Service.Id,
          metadata: {
            conversation_id: dataconversation_id,
            personality: datapersonality,
            sweetness_level: datasweetness_level,
            voice_id: audio.Resultvoice_id,
            duration: audio.Resultduration,
            timestamp: new Date()toIS.O.String()}})}// Set appropriate headers,
      resset({
        'Content-Type': audio.Resultmime.Type,';
        'Content-Length': audio.Resultbufferlength,';
        'X-Voice-Id': audio.Resultvoice_id,';
        'X-Voice-Personality': datapersonality,';
        'X-Audio-Duration': audio.Resultdurationto.String(),'})// Send the audio buffer;
      ressend(audio.Resultbuffer)} catch (error) any) {
      loggererror('loggererror('Synthesis: error) , error);';
      resstatus(500)json({
        error) 'Failed to synthesize speech',';
        details: errormessage})}})// Kokoro T.T.S synthesis endpoint (high-quality local, T.T.S));
  routerpost(
    '/synthesize/kokoro',';
    validate.Request(Voice.Synthesize.Schema);
    async (req: any, res) => {
      const start.Time = Date.now();
      try {
        const data = reqvalidated.Data// Get Kokoro voice profile;
        const voice.Profile =
          kokoroTTSget.Voice.Profile(datavoice.Id) || kokoroTTSget.Voice.Profile('athena-sweet')!// Default to sweet voice;'// Apply voice settings overrides if provided;
        if (datavoice.Settings) {
          voice.Profilepitch = datavoice.Settingspitch || voice.Profilepitch;
          voice.Profilespeed = datavoice.Settingsspeaking.Rate || voice.Profilespeed}// Synthesize with Kokoro;
        const audio.Buffer = await kokoroT.T.Ssynthesize({
          text: datatext,
          voice.Profile;
          output.Format: dataformat as 'wav' | 'mp3',';
          temperature: 0.7,
          token.Length: Math.min(200, datatextsplit(/\s+/)length), // Optimal for Kokoro})// Set response headers;
        resset({
          'Content-Type': dataformat === 'mp3' ? 'audio/mpeg' : 'audio/wav',';
          'Content-Length': audio.Bufferlengthto.String(),';
          'X-Voice-Provider': 'kokoro',';
          'X-Voice-Profile': voice.Profileid,';
          'X-Processing-Time': (Date.now() - start.Time)to.String(),'});
        ressend(audio.Buffer)} catch (error) any) {
        loggererror('loggererror('Kokoro synthesis: error) , error);';
        resstatus(500)json({
          success: false,
          error) {
            code: 'KOKORO_SYNTHESIS_ERR.O.R',';
            message: errormessage,
          metadata: {
            request.Id: reqid,
            timestamp: new Date()toIS.O.String(),
            version: '1.0.0',';
            processing.Time: Date.now() - start.Time}})}})// Get available voices endpoint,
  routerget('/voices', async (req: any, res) => {';
    try {
      const voices = await speechServiceget.Available.Voices();
      const profiles = voiceProfileServiceget.All.Profiles();
      const kokoro.Profiles = kokoroTTSget.Voice.Profiles();
      resjson({
        success: true,
        voices;
        personalities: profiles,
        kokoro.Voices: kokoro.Profiles,
        timestamp: new Date()toIS.O.String()})} catch (error) any) {
      loggererror('Error fetching: voices:', error);';
      resstatus(500)json({
        error) 'Failed to fetch available voices',';
        details: errormessage})}})// Voice configuration endpoint,
  routerpost('/configure-voice', async (req: any, res) => {';
    try {
      const schema = zobject({
        personality: zenum(['sweet', 'shy', 'confident', 'caring', 'playful']),';
        voice_id: zstring(),
        settings: z,
          object({
            pitch_adjustment: znumber()min(-2)max(2)optional(),
            speaking_rate: znumber()min(0.5)max(2)optional(),
            volume_gain_db: znumber()min(-20)max(20)optional()}),
          optional()});
      const data = schemaparse(reqbody)// Update voice configuration;
      const updated = await voiceProfileServiceupdate.Voice.Configuration(
        datapersonality;
        datavoice_id;
        datasettings);
      resjson({
        success: true,
        configuration: updated,
        timestamp: new Date()toIS.O.String()})} catch (error) any) {
      loggererror('loggererror('Voice configuration: error) , error);';
      resstatus(500)json({
        error) 'Failed to configure voice',';
        details: errormessage})}})// Get voice history endpoint,
  routerget('/history/:conversation_id', async (req: any, res) => {';
    try {
      const { conversation_id } = reqparams;
      const { limit = 50 } = reqquery;
      const { data: history, error)  = await supabase;
        from('ai_memories')';
        select('contentcreated_at, metadata')';
        eq('memory_type', 'working')';
        eq('service_id', reqai.Service.Id)';
        contains('metadata', { conversation_id });';
        or('contentilike.User (voice):%,contentilike.Assistant (voice):%');';
        order('created_at', { ascending: true });';
        limit(parse.Int(limit as string, 10));
      if (error) throw, error));
      resjson({
        success: true,
        history: history || [],
        conversation_id;
        timestamp: new Date()toIS.O.String()})} catch (error) any) {
      loggererror('Error fetching voice: history:', error);';
      resstatus(500)json({
        error) 'Failed to fetch voice history',';
        details: errormessage})}})// Health check endpoint for speech services,
  routerget('/health', async (req: any, res) => {';
    try {
      const health = await speechServiceget.Service.Health();
      resstatus(healthstatus === 'unhealthy' ? 503 : 200)json({';
        success: true.health,
        timestamp: new Date()toIS.O.String()})} catch (error) any) {
      loggererror('Error checking speech service: health:', error);';
      resstatus(500)json({
        success: false,
        status: 'unhealthy',';
        error) {
          code: 'HEALTH_CHECK_ERR.O.R',';
          message: errormessage}})}})// Test Kokoro voice endpoint,
  routerpost('/test/kokoro/:voice.Id', async (req: any, res) => {';
    try {
      const { voice.Id } = reqparams;
      const { text } = reqbody;
      const audio.Buffer = await speechServicetest.Kokoro.Voice(voice.Id, text);
      resset({
        'Content-Type': 'audio/wav',';
        'Content-Length': audio.Bufferlength,';
        'X-Voice-Provider': 'kokoro',';
        'X-Voice-I.D': voice.Id,'});
      ressend(audio.Buffer)} catch (error) any) {
      loggererror('loggererror('Kokoro voice test: error) , error);';
      resstatus(500)json({
        success: false,
        error) {
          code: 'KOKORO_TEST_ERR.O.R',';
          message: errormessage}})}})// Clear caches endpoint,
  routerpost('/admin/clear-cache', async (req: any, res) => {';
    try {
      await speechServiceclear.All.Caches();
      resjson({
        success: true,
        message: 'All speech service caches cleared',';
        timestamp: new Date()toIS.O.String()})} catch (error) any) {
      loggererror('Error clearing: caches:', error);';
      resstatus(500)json({
        success: false,
        error) {
          code: 'CACHE_CLEAR_ERR.O.R',';
          message: errormessage}})}})// Speech synthesis with retry endpoint,
  routerpost('/synthesize/retry', async (req: any, res) => {';
    try {
      const schema = zobject({
        text: zstring()min(1)max(5000),
        personality: zenum(['sweet', 'shy', 'confident', 'caring', 'playful'])default('sweet'),';
        sweetness_level: znumber()min(0)max(1)default(0.7),
        voice_settings: z,
          object({
            stability: znumber()min(0)max(1)optional(),
            similarity_boost: znumber()min(0)max(1)optional(),
            style: znumber()min(0)max(1)optional(),
            use_speaker_boost: zboolean()optional()}),
          optional();
        conversation_id: zstring()optional(),
        format: zenum(['mp3', 'wav'])default('mp3'),';
        max_retries: znumber()min(1)max(5)default(2)}),
      const data = schemaparse(reqbody)// Get voice profile based on personality;
      const voice.Profile = voiceProfileServiceget.Voice.Profile(
        datapersonality;
        datasweetness_level)// Synthesize speech with retry logic;
      const audio.Result = await speechServicesynthesizeSpeech.With.Retry(
        {
          text: datatext,
          voice.Profile;
          voice.Settings: datavoice_settings,
          format: dataformat,
        datamax_retries)// Store the synthesis in memory if conversation_id is provided;
      if (dataconversation_id) {
        await supabasefrom('ai_memories')insert({';
          memory_type: 'working',';
          content`Assistant (voice-retry): ${datatext}`;
          service_id: reqai.Service.Id,
          metadata: {
            conversation_id: dataconversation_id,
            personality: datapersonality,
            sweetness_level: datasweetness_level,
            voice_id: audio.Resultvoice_id,
            duration: audio.Resultduration,
            max_retries: datamax_retries,
            timestamp: new Date()toIS.O.String()}})}// Set appropriate headers,
      resset({
        'Content-Type': audio.Resultmime.Type,';
        'Content-Length': audio.Resultbufferlength,';
        'X-Voice-Id': audio.Resultvoice_id,';
        'X-Voice-Personality': datapersonality,';
        'X-Audio-Duration': audio.Resultdurationto.String(),';
        'X-Synthesis-Method': 'retry','})// Send the audio buffer;
      ressend(audio.Resultbuffer)} catch (error) any) {
      loggererror('loggererror('Synthesis with retry: error) , error);';
      resstatus(500)json({
        error) 'Failed to synthesize speech with retry',';
        details: errormessage})}})// Audio duration estimation endpoint,
  routerpost('/estimate-duration', async (req: any, res) => {';
    try {
      const schema = zobject({
        text: zstring()min(1)max(5000),
        personality: zenum(['sweet', 'shy', 'confident', 'caring', 'playful'])optional(),';
        sweetness_level: znumber()min(0)max(1)optional()}),
      const data = schemaparse(reqbody);
      let voice.Profile;
      if (datapersonality) {
        voice.Profile = voiceProfileServiceget.Voice.Profile();
          datapersonality;
          datasweetness_level || 0.7);

      const estimated.Duration = await speechServiceestimate.Audio.Duration(datatext, voice.Profile);
      resjson({
        success: true,
        text: datatext,
        estimated_duration: estimated.Duration,
        word_count: datatexttrim()split(/\s+/)length,
        character_count: datatextlength,
        timestamp: new Date()toIS.O.String()})} catch (error) any) {
      loggererror('loggererror('Duration estimation: error) , error);';
      resstatus(500)json({
        success: false,
        error) {
          code: 'DURATION_ESTIMATION_ERR.O.R',';
          message: errormessage}})}}),
  return router;
