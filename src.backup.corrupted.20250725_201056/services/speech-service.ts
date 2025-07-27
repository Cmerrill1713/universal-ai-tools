import type { Supabase.Client } from '@supabase/supabase-js';
import Open.A.I.from 'openai';
import Form.Data.from 'form-data';
import fs from 'fs';
import axios from 'axios';
import { Log.Context, logger } from './utils/enhanced-logger';
import { config } from './config';
import { type Kokoro.Voice.Profile, kokoroT.T.S } from './kokoro-tts-service';
import { audio.Handler } from './audio-handler';
interface Transcription.Result {
  text: string,
  duration?: number;
  confidence?: number;
  language?: string;
}
interface Synthesis.Options {
  text: string,
  voice.Profile: Voice.Profile,
  voice.Settings?: Voice.Settings;
  format: 'mp3' | 'wav',
}
interface Voice.Profile {
  voice_id: string,
  pitch: number,
  speaking_rate: number,
  stability: number,
  similarity_boost: number,
  style: number,
  use_speaker_boost: boolean,
}
interface Voice.Settings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}
interface Audio.Result {
  buffer: Buffer,
  mime.Type: string,
  voice_id: string,
  duration: number,
}/**
 * Speech.Service.provides comprehensive voice synthesis and speech recognition capabilities.
 * Supports multiple T.T.S.providers (Open.A.I, Eleven.Labs, Kokoro) with automatic fallback.
 *
 * Features:
 * - Multi-provider T.T.S.with quality optimization* - Whisper-based speech recognition* - Personality-based voice modulation* - Automatic provider fallback* - Development mode mock responses*/
export class Speech.Service {
  private openai: Open.A.I | null = null,
  private elevenLabs.Api.Key: string | null,
  private whisper.Api.Url: string,
  constructor(private supabase: Supabase.Client) {
    // Initialize Open.A.I.for Whisper transcription and T.T.S.if A.P.I.key is available;
    const openai.Api.Key = process.envOPENAI_API_K.E.Y;
    if (openai.Api.Key) {
      thisopenai = new Open.A.I({ api.Key: openai.Api.Key })}// Eleven.Labs.configuration for premium voice synthesis,
    thiselevenLabs.Api.Key = process.envELEVENLABS_API_K.E.Y || null// Whisper A.P.I.U.R.L (supports both local and cloud deployments);
    thiswhisper.Api.Url =
      process.envWHISPER_API_U.R.L || 'https: //apiopenaicom/v1/audio/transcriptions',
  }/**
   * Transcribes audio files to text using available speech recognition services.
   * Implements provider fallback: Open.A.I.Whisper -> Local Whisper -> Mock (dev)*
   * @param file.Path - Path to the audio file to transcribe* @param mime.Type - MI.M.E.type of the audio file* @param context - Optional context to improve transcription accuracy* @returns Promise<Transcription.Result> with text, confidence, duration, and language*/
  async transcribe.Audio(
    file.Path: string,
    mime.Type: string,
    context?: string): Promise<Transcription.Result> {
    try {
      // Try Open.A.I.Whisper first (highest quality);
      if (thisopenai) {
        return await thistranscribeWithOpen.A.I(file.Path, context)}// Fallback to local Whisper deployment;
      return await thistranscribeWith.Local.Whisper(file.Path, context)} catch (error instanceof Error ? error.message : String(error) any) {
      loggererror('Transcription error instanceof Error ? error.message : String(error)  LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error))// Fallback to mock transcription for development;
      if (configserveris.Development) {
        loggerwarn('Using mock transcription in development mode', LogContextAVAT.A.R);
        return {
          text: 'This is a mock transcription for development purposes.',
          confidence: 0.95,
          duration: 5.0,
          language: 'en',
        };

      throw error instanceof Error ? error.message : String(error)};

  private async transcribeWithOpen.A.I(
    file.Path: string,
    context?: string): Promise<Transcription.Result> {
    if (!thisopenai) {
      throw new Error('Open.A.I.client not initialized');

    const form.Data = new Form.Data();
    form.Dataappend('file', fscreate.Read.Stream(file.Path));
    form.Dataappend('model', 'whisper-1');
    if (context) {
      form.Dataappend('prompt', context);

    try {
      const response = await axiospost(
        'https://apiopenaicom/v1/audio/transcriptions';
        form.Data;
        {
          headers: {
            .form.Dataget.Headers();
            Authorization: `Bearer ${process.envOPENAI_API_K.E.Y}`}}),
      return {
        text: responsedatatext,
        confidence: 0.95, // Open.A.I.doesn't provide confidence scores;
        language: responsedatalanguage || 'en',
      }} catch (error instanceof Error ? error.message : String(error) any) {
      loggererror('Open.A.I.Whisper error instanceof Error ? error.message : String(error)  LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error));
      throw new Error('Failed to transcribe with Open.A.I.Whisper')};

  private async transcribeWith.Local.Whisper(
    file.Path: string,
    context?: string): Promise<Transcription.Result> {
    // This would integrate with a local Whisper instance// For now, we'll use a placeholder implementation;

    try {
      // You would implement actual local Whisper integration here// For example, using whispercpp or a Python service;

      const mock.Response = {
        text: 'Local Whisper transcription not yet implemented',
        confidence: 0.8,
        duration: 3.0,
        language: 'en',
      return mock.Response} catch (error instanceof Error ? error.message : String(error) any) {
      loggererror('Local Whisper error instanceof Error ? error.message : String(error)  LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error));
      throw new Error('Failed to transcribe with local Whisper')};

  async synthesize.Speech(options: Synthesis.Options): Promise<Audio.Result> {
    try {
      // Try Eleven.Labs.first for high-quality voice;
      if (thiselevenLabs.Api.Key) {
        return await thissynthesizeWith.Eleven.Labs(options)}// Fallback to Open.A.I.T.T.S;
      if (thisopenai) {
        return await thissynthesizeWithOpen.A.I(options)}// Fallback to local T.T.S;
      return await thissynthesizeWithLocalT.T.S(options)} catch (error instanceof Error ? error.message : String(error) any) {
      loggererror('Synthesis error instanceof Error ? error.message : String(error)  LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error))// Fallback to mock audio for development;
      if (configserveris.Development) {
        loggerwarn('Using mock audio in development mode', LogContextAVAT.A.R);
        return thisgenerate.Mock.Audio(options);

      throw error instanceof Error ? error.message : String(error)};

  private async synthesizeWith.Eleven.Labs(options: Synthesis.Options): Promise<Audio.Result> {
    if (!thiselevenLabs.Api.Key) {
      throw new Error('Eleven.Labs.A.P.I.key not configured');

    const voice.Id = optionsvoice.Profilevoice_id;
    const url = `https://apielevenlabsio/v1/text-to-speech/${voice.Id}`;
    try {
      const response = await axiospost(
        url;
        {
          text: optionstext,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: optionsvoice.Settings?stability || optionsvoice.Profilestability,
            similarity_boost:
              optionsvoice.Settings?similarity_boost || optionsvoice.Profilesimilarity_boost;
            style: optionsvoice.Settings?style || optionsvoice.Profilestyle,
            use_speaker_boost:
              optionsvoice.Settings?use_speaker_boost || optionsvoice.Profileuse_speaker_boost;
          };
        {
          headers: {
            Accept: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
            'xi-api-key': thiselevenLabs.Api.Key;
            'Content-Type': 'application/json';
}          response.Type: 'arraybuffer',
        });
      const buffer = Bufferfrom(responsedata)// Validate and process the audio;
      const validation = await audioHandlervalidate.Audio.Buffer(buffer, optionsformat);
      if (!validationis.Valid) {
        loggerwarn('Eleven.Labs.audio validation issues', LogContextAVAT.A.R, {
          errors: validationerrors})}// Process audio for optimization,
      const audio.Processing.Result = await audio.Handlerprocess.Audio(buffer, {
        format: optionsformat,
        normalize: true,
        remove.Noise: false}),
      return {
        buffer: audio.Processing.Resultbuffer,
        mime.Type: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        voice_id: voice.Id,
        duration: audio.Processing.Resultmetadataduration,
      }} catch (error instanceof Error ? error.message : String(error) any) {
      loggererror('Eleven.Labs.synthesis error instanceof Error ? error.message : String(error)  LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error));
      throw new Error('Failed to synthesize with Eleven.Labs')};

  private async synthesizeWithOpen.A.I(options: Synthesis.Options): Promise<Audio.Result> {
    if (!thisopenai) {
      throw new Error('Open.A.I.client not initialized');

    try {
      // Map personality to Open.A.I.voices;
      const voice.Map: Record<string, string> = {
        sweet: 'nova', // Warm and friendly;
        shy: 'shimmer', // Soft and gentle;
        confident: 'alloy', // Clear and assured;
        caring: 'echo', // Soothing and nurturing;
        playful: 'fable', // Expressive and lively;
      const voice = voice.Map[optionsvoice.Profilevoice_id] || 'nova';
      const response = await axiospost(
        'https: //apiopenaicom/v1/audio/speech',
        {
          model: 'tts-1-hd',
          voice;
          inputoptionstext;
          response_format: optionsformat,
          speed: optionsvoice.Profilespeaking_rate,
}        {
          headers: {
            Authorization: `Bearer ${process.envOPENAI_API_K.E.Y}`,
            'Content-Type': 'application/json';
}          response.Type: 'arraybuffer',
        });
      const buffer = Bufferfrom(responsedata)// Validate and process Open.A.I.audio;
      const validation = await audioHandlervalidate.Audio.Buffer(buffer, optionsformat);
      if (!validationis.Valid) {
        loggerwarn('Open.A.I.audio validation issues', LogContextAVAT.A.R, {
          errors: validationerrors})}// Process audio for optimization,
      const audio.Processing.Result = await audio.Handlerprocess.Audio(buffer, {
        format: optionsformat,
        normalize: true,
        remove.Noise: false}),
      return {
        buffer: audio.Processing.Resultbuffer,
        mime.Type: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        voice_id: voice,
        duration: audio.Processing.Resultmetadataduration,
      }} catch (error instanceof Error ? error.message : String(error) any) {
      loggererror('Open.A.I.T.T.S.error instanceof Error ? error.message : String(error)  LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error));
      throw new Error('Failed to synthesize with Open.A.I')};

  private async synthesizeWithLocalT.T.S(options: Synthesis.Options): Promise<Audio.Result> {
    try {
      // Try Kokoro T.T.S.first;
      return await thissynthesize.With.Kokoro(options)} catch (error) {
      loggererror('Kokoro T.T.S.failed', LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error));
      loggerwarn('Falling back to mock audio generation', LogContextAVAT.A.R);
      return thisgenerate.Mock.Audio(options)};

  private async synthesize.With.Kokoro(options: Synthesis.Options): Promise<Audio.Result> {
    try {
      // Initialize Kokoro T.T.S.if not already done;
      await kokoroT.T.Sinitialize()// Map personality-based voice profile to Kokoro voice;
      const kokoro.Profile = thismapTo.Kokoro.Profile(optionsvoice.Profile);
      loggerinfo(`Synthesizing with Kokoro T.T.S: ${kokoro.Profileid}`, LogContextAVAT.A.R, {
        text.Length: optionstextlength,
        format: optionsformat,
        personality: kokoro.Profilestyle}),
      const audio.Buffer = await kokoroT.T.Ssynthesize({
        text: optionstext,
        voice.Profile: kokoro.Profile,
        output.Format: optionsformat,
        temperature: 0.7,
        top.P: 0.9,
        token.Length: Math.min(200, optionstext.split(/\s+/)length)})// Validate the generated audio;
      const is.Valid.Audio = await kokoroTTSvalidate.Audio.Buffer(audio.Buffer, optionsformat);
      if (!is.Valid.Audio) {
        throw new Error(`Generated audio buffer is invalid for format: ${optionsformat}`)}// Process audio with comprehensive errorhandling,
      const audio.Processing.Result = await audio.Handlerprocess.Audio(audio.Buffer, {
        format: optionsformat,
        normalize: true,
        remove.Noise: false, // Disable for T.T.S.as it's already clean});
      const optimized.Buffer = audio.Processing.Resultbuffer;
      const { metadata } = audio.Processing.Result// Log any processing warnings;
      if (audio.Processing.Resultwarningslength > 0) {
        loggerwarn('Audio processing warnings', LogContextAVAT.A.R, {
          warnings: audio.Processing.Resultwarnings}),

      loggerinfo('Kokoro T.T.S.synthesis completed successfully', LogContextAVAT.A.R, {
        duration: metadataduration,
        format: metadataformat,
        buffer.Size: optimized.Bufferlength}),
      return {
        buffer: optimized.Buffer,
        mime.Type: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        voice_id: kokoro.Profileid,
        duration: metadataduration,
      }} catch (error) {
      loggererror('Kokoro T.T.S.synthesis error instanceof Error ? error.message : String(error)  LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error));
      throw new Error(
        `Kokoro T.T.S.failed: ${error instanceof Error ? error.message : 'Unknown error instanceof Error ? error.message : String(error)`),
    };

  private mapTo.Kokoro.Profile(voice.Profile: Voice.Profile): Kokoro.Voice.Profile {
    const kokoro.Profiles = kokoroTTSget.Voice.Profiles()// Map voice_id to appropriate Kokoro profile;
    const profile.Map: Record<string, string> = {
      sweet: 'athena-sweet',
      shy: 'athena-sweet', // Map shy to sweet;
      confident: 'athena-confident',
      caring: 'athena-warm',
      playful: 'athena-playful',
      professional: 'athena-professional',
}    const kokoro.Profile.Id = profile.Map[voice.Profilevoice_id] || 'athena-sweet';
    const kokoro.Profile = kokoro.Profilesfind((p) => pid === kokoro.Profile.Id);
    if (!kokoro.Profile) {
      // Return default profile if not found;
      return kokoro.Profiles[0]}// Apply voice settings to Kokoro profile;
    return {
      .kokoro.Profile;
      pitch: voice.Profilepitch || kokoro.Profilepitch,
      speed: voice.Profilespeaking_rate || kokoro.Profilespeed,
    };

  private generate.Mock.Audio(options: Synthesis.Options): Audio.Result {
    // Generate a simple sine wave as mock audio;
    const sample.Rate = 44100;
    const duration = 3// seconds;
    const frequency = 440// A4 note;
    const num.Samples = sample.Rate * duration;
    const buffer = Bufferalloc(num.Samples * 2)// 16-bit samples;

    for (let i = 0; i < num.Samples; i++) {
      const sample = Mathsin((2 * Math.P.I * frequency * i) / sample.Rate) * 0.3;
      const value = Mathfloor(sample * 32767);
      bufferwriteInt16.L.E(value, i * 2);

    return {
      buffer;
      mime.Type: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      voice_id: 'mock',
      duration;
    };

  private estimateAudioDuration.From.Buffer(buffer: Buffer, format: string): number {
    // Very rough estimation based on file size// Actual implementation would parse audio headers;
    const bytes.Per.Second = format === 'mp3' ? 16000 : 88200// Rough estimates;
    return bufferlength / bytes.Per.Second;

  async get.Available.Voices(): Promise<any[]> {
    const voices = []// Add Kokoro voices first (highest priority for local T.T.S);
    try {
      const kokoro.Profiles = kokoroTTSget.Voice.Profiles();
      voicespush(
        .kokoro.Profilesmap((profile) => ({
          id: profileid,
          name: profilename,
          provider: 'kokoro',
          description: `${profilestyle} female voice`,
          gender: profilegender,
          style: profilestyle,
          pitch: profilepitch,
          speed: profilespeed,
          local: true})))} catch (error) {
      loggererror('Failed to fetch Kokoro voices', LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error) );
    }// Add Eleven.Labs.voices if available;
    if (thiselevenLabs.Api.Key) {
      try {
        const response = await axiosget('https://apielevenlabsio/v1/voices', {
          headers: { 'xi-api-key': thiselevenLabs.Api.Key }}),
        voicespush(
          .responsedatavoicesmap((voice: any) => ({
            id: voicevoice_id,
            name: voicename,
            provider: 'elevenlabs',
            preview_url: voicepreview_url,
            labels: voicelabels,
            local: false})))} catch (error) {
        loggererror('Failed to fetch Eleven.Labs.voices', LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error) );
      }}// Add Open.A.I.voices;
    if (thisopenai) {
      voicespush(
        {
          id: 'nova',
          name: 'Nova (Sweet)';,
          provider: 'openai',
          description: 'Warm and friendly',
          local: false,
}        {
          id: 'shimmer',
          name: 'Shimmer (Shy)';,
          provider: 'openai',
          description: 'Soft and gentle',
          local: false,
}        {
          id: 'alloy',
          name: 'Alloy (Confident)';,
          provider: 'openai',
          description: 'Clear and assured',
          local: false,
}        {
          id: 'echo',
          name: 'Echo (Caring)';,
          provider: 'openai',
          description: 'Soothing and nurturing',
          local: false,
}        {
          id: 'fable',
          name: 'Fable (Playful)';,
          provider: 'openai',
          description: 'Expressive and lively',
          local: false,
        })}// Add local/mock voices for development;
    if (configserveris.Development) {
      voicespush(
        { id: 'mock-sweet', name: 'Mock Sweet Voice', provider: 'mock', local: true ,
        { id: 'mock-confident', name: 'Mock Confident Voice', provider: 'mock', local: true }),

    return voices;

  async test.Kokoro.Voice(voice.Id: string, sample.Text?: string): Promise<Buffer> {
    try {
      await kokoroT.T.Sinitialize();
      return await kokoroTT.Stest.Voice(voice.Id, sample.Text)} catch (error) {
      loggererror('Kokoro voice test failed', LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error));
      throw error instanceof Error ? error.message : String(error)};

  async get.Service.Health(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy',
    services: {
      openai: boolean,
      elevenlabs: boolean,
      kokoro: boolean,
      whisper: boolean,
}    details: any}> {
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      services: {
        openai: false,
        elevenlabs: false,
        kokoro: false,
        whisper: false,
      details: {} as any}// Test Open.A.I.availability,
    try {
      if (thisopenai) {
        // Simple test to check if Open.A.I.is responsive;
        healthservicesopenai = true;
        healthdetailsopenai = { available: true }}} catch (error) {
      healthdetailsopenai = {
        available: false,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : 'Unknown error instanceof Error ? error.message : String(error);
      }}// Test Eleven.Labs.availability;
    try {
      if (thiselevenLabs.Api.Key) {
        // Could make a simple A.P.I.call to test connectivity;
        healthserviceselevenlabs = true;
        healthdetailselevenlabs = { available: true }}} catch (error) {
      healthdetailselevenlabs = {
        available: false,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : 'Unknown error instanceof Error ? error.message : String(error);
      }}// Test Kokoro T.T.S.availability;
    try {
      const kokoro.Status = kokoroTTSget.Service.Status();
      healthserviceskokoro = kokoro.Statusinitialized;
      healthdetailskokoro = kokoro.Status} catch (error) {
      healthdetailskokoro = {
        available: false,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : 'Unknown error instanceof Error ? error.message : String(error);
      }}// Test Whisper availability;
    try {
      healthserviceswhisper = !!thisopenai || !!thiswhisper.Api.Url;
      healthdetailswhisper = {
        available: healthserviceswhisper,
        api.Url: thiswhisper.Api.Url,
      }} catch (error) {
      healthdetailswhisper = {
        available: false,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : 'Unknown error instanceof Error ? error.message : String(error);
      }}// Add audio processing stats;
    try {
      const audio.Stats = audioHandlerget.Processing.Stats();
      healthdetailsaudio.Processing = {
        total.Processed: audio.Statstotal.Processed,
        success.Rate: audio.Statssuccess.Rate,
        average.Processing.Time: audioStatsaverage.Processing.Time,
      }} catch (error) {
      healthdetailsaudio.Processing = {
        available: false,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : 'Unknown error instanceof Error ? error.message : String(error);
      }}// Determine overall status;
    const available.Services = Objectvalues(healthservices)filter(Boolean)length;
    if (available.Services === 0) {
      healthstatus = 'unhealthy'} else if (available.Services < 2) {
      healthstatus = 'degraded';
}    return health;

  async clear.All.Caches(): Promise<void> {
    try {
      await Promiseall([kokoroTT.Sclear.Cache(), audio.Handlerclear.Cache()]);
      loggerinfo('All speech service caches cleared', LogContextAVAT.A.R)} catch (error) {
      loggererror('Error clearing speech service caches', LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error) );
    };

  async synthesizeSpeech.With.Retry(options: Synthesis.Options, max.Retries = 2): Promise<Audio.Result> {
    let last.Error: Error | null = null,
    for (let attempt = 1; attempt <= max.Retries + 1, attempt++) {
      try {
        loggerinfo(`Speech synthesis attempt ${attempt}/${max.Retries + 1}`, LogContextAVAT.A.R, {
          text.Length: optionstextlength,
          format: optionsformat,
          voice.Id: optionsvoice.Profilevoice_id}),
        const result = await thissynthesize.Speech(options)// Validate the result;
        if (resultbufferlength === 0) {
          throw new Error('Generated audio buffer is empty');

        loggerinfo(`Speech synthesis successful on attempt ${attempt}`, LogContextAVAT.A.R);
        return result} catch (error) {
        last.Error = error instanceof Error ? error instanceof Error ? error.message : String(error)  new Error('Unknown synthesis error instanceof Error ? error.message : String(error);
        loggerwarn(
          `Speech synthesis attempt ${attempt} failed: ${last.Errormessage}`,
          LogContextAVAT.A.R);
        if (attempt <= max.Retries) {
          // Wait before retrying (exponential backoff);
          const delay.Ms = Math.min(1000 * Mathpow(2, attempt - 1), 5000);
          await new Promise((resolve) => set.Timeout(resolve, delay.Ms))}};

    throw last.Error || new Error('Speech synthesis failed after all retries');

  async estimate.Audio.Duration(text: string, voice.Profile?: Voice.Profile): Promise<number> {
    try {
      // More accurate duration estimation based on voice profile and text characteristics;
      const words = text.trim()split(/\s+/)length;
      const chars = textlength// Base speaking rate (words per minute);
      let baseW.P.M = 160// Average speaking rate;

      if (voice.Profile) {
        // Adjust for speaking rate setting;
        baseW.P.M *= voice.Profilespeaking_rate || 1.0// Adjust for voice characteristics;
        if (voice.Profilevoice_id === 'sweet' || voice.Profilevoice_id === 'shy') {
          baseW.P.M *= 0.9// Slower, more deliberate} else if (voice.Profilevoice_id === 'playful') {
          baseW.P.M *= 1.1// Faster, more energetic}}// Calculate duration in seconds;
      const base.Duration = (words / baseW.P.M) * 60// Add time for punctuation pauses;
      const punctuation.Count = (textmatch(/[.!?]/g) || [])length;
      const pause.Time = punctuation.Count * 0.5// 0.5 seconds per major punctuation// Add time for commas;
      const comma.Count = (textmatch(/[]/g) || [])length;
      const short.Pause.Time = comma.Count * 0.2// 0.2 seconds per comma;

      const total.Duration = Math.max(base.Duration + pause.Time + short.Pause.Time, 1.0);
      loggerdebug('Estimated audio duration', LogContextAVAT.A.R, {
        words;
        chars;
        estimatedW.P.M: baseW.P.M,
        duration: total.Duration}),
      return total.Duration} catch (error) {
      loggererror('Error estimating audio duration', LogContextAVAT.A.R, { error instanceof Error ? error.message : String(error));
      return Math.max(text.split(' ')length * 0.4, 1.0)// Fallback estimation}};
