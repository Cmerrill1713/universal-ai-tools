import type { Supabase.Client } from '@supabase/supabase-js';
import OpenA.I from 'openai';
import Form.Data from 'form-data';
import fs from 'fs';
import axios from 'axios';
import { Log.Context, logger } from './utils/enhanced-logger';
import { config } from './config';
import { type KokoroVoice.Profile, kokoroTT.S } from './kokoro-tts-service';
import { audio.Handler } from './audio-handler';
interface TranscriptionResult {
  text: string;
  duration?: number;
  confidence?: number;
  language?: string;
};

interface SynthesisOptions {
  text: string;
  voice.Profile: Voice.Profile;
  voice.Settings?: Voice.Settings;
  format: 'mp3' | 'wav';
};

interface VoiceProfile {
  voice_id: string;
  pitch: number;
  speaking_rate: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
};

interface AudioResult {
  buffer: Buffer;
  mime.Type: string;
  voice_id: string;
  duration: number;
}/**
 * Speech.Service provides comprehensive voice synthesis and speech recognition capabilities.
 * Supports multiple TT.S providers (OpenA.I, Eleven.Labs, Kokoro) with automatic fallback.
 *
 * Features:
 * - Multi-provider TT.S with quality optimization* - Whisper-based speech recognition* - Personality-based voice modulation* - Automatic provider fallback* - Development mode mock responses*/
export class Speech.Service {
  private openai: OpenA.I | null = null;
  private elevenLabsApi.Key: string | null;
  private whisperApi.Url: string;
  constructor(private supabase: Supabase.Client) {
    // Initialize OpenA.I for Whisper transcription and TT.S if AP.I key is available;
    const openaiApi.Key = process.envOPENAI_API_KE.Y;
    if (openaiApi.Key) {
      thisopenai = new OpenA.I({ api.Key: openaiApi.Key })}// Eleven.Labs configuration for premium voice synthesis;
    thiselevenLabsApi.Key = process.envELEVENLABS_API_KE.Y || null// Whisper AP.I UR.L (supports both local and cloud deployments);
    thiswhisperApi.Url =
      process.envWHISPER_API_UR.L || 'https: //apiopenaicom/v1/audio/transcriptions';
  }/**
   * Transcribes audio files to text using available speech recognition services.
   * Implements provider fallback: OpenA.I Whisper -> Local Whisper -> Mock (dev)*
   * @param file.Path - Path to the audio file to transcribe* @param mime.Type - MIM.E type of the audio file* @param context - Optional context to improve transcription accuracy* @returns Promise<Transcription.Result> with text, confidence, duration, and language*/
  async transcribe.Audio(
    file.Path: string;
    mime.Type: string;
    context?: string): Promise<Transcription.Result> {
    try {
      // Try OpenA.I Whisper first (highest quality);
      if (thisopenai) {
        return await thistranscribeWithOpenA.I(file.Path, context)}// Fallback to local Whisper deployment;
      return await thistranscribeWithLocal.Whisper(file.Path, context)} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Transcription error instanceof Error ? errormessage : String(error)  LogContextAVATA.R, { error instanceof Error ? errormessage : String(error))// Fallback to mock transcription for development;
      if (configserveris.Development) {
        loggerwarn('Using mock transcription in development mode', LogContextAVATA.R);
        return {
          text: 'This is a mock transcription for development purposes.';
          confidence: 0.95;
          duration: 5.0;
          language: 'en';
        }};

      throw error instanceof Error ? errormessage : String(error)}};

  private async transcribeWithOpenA.I(
    file.Path: string;
    context?: string): Promise<Transcription.Result> {
    if (!thisopenai) {
      throw new Error('OpenA.I client not initialized')};

    const form.Data = new Form.Data();
    form.Dataappend('file', fscreateRead.Stream(file.Path));
    form.Dataappend('model', 'whisper-1');
    if (context) {
      form.Dataappend('prompt', context)};

    try {
      const response = await axiospost(
        'https://apiopenaicom/v1/audio/transcriptions';
        form.Data;
        {
          headers: {
            .formDataget.Headers();
            Authorization: `Bearer ${process.envOPENAI_API_KE.Y}`}});
      return {
        text: responsedatatext;
        confidence: 0.95, // OpenA.I doesn't provide confidence scores;
        language: responsedatalanguage || 'en';
      }} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('OpenA.I Whisper error instanceof Error ? errormessage : String(error)  LogContextAVATA.R, { error instanceof Error ? errormessage : String(error));
      throw new Error('Failed to transcribe with OpenA.I Whisper')}};

  private async transcribeWithLocal.Whisper(
    file.Path: string;
    context?: string): Promise<Transcription.Result> {
    // This would integrate with a local Whisper instance// For now, we'll use a placeholder implementation;

    try {
      // You would implement actual local Whisper integration here// For example, using whispercpp or a Python service;

      const mock.Response = {
        text: 'Local Whisper transcription not yet implemented';
        confidence: 0.8;
        duration: 3.0;
        language: 'en'};
      return mock.Response} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Local Whisper error instanceof Error ? errormessage : String(error)  LogContextAVATA.R, { error instanceof Error ? errormessage : String(error));
      throw new Error('Failed to transcribe with local Whisper')}};

  async synthesize.Speech(options: Synthesis.Options): Promise<Audio.Result> {
    try {
      // Try Eleven.Labs first for high-quality voice;
      if (thiselevenLabsApi.Key) {
        return await thissynthesizeWithEleven.Labs(options)}// Fallback to OpenA.I TT.S;
      if (thisopenai) {
        return await thissynthesizeWithOpenA.I(options)}// Fallback to local TT.S;
      return await thissynthesizeWithLocalTT.S(options)} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Synthesis error instanceof Error ? errormessage : String(error)  LogContextAVATA.R, { error instanceof Error ? errormessage : String(error))// Fallback to mock audio for development;
      if (configserveris.Development) {
        loggerwarn('Using mock audio in development mode', LogContextAVATA.R);
        return thisgenerateMock.Audio(options)};

      throw error instanceof Error ? errormessage : String(error)}};

  private async synthesizeWithEleven.Labs(options: Synthesis.Options): Promise<Audio.Result> {
    if (!thiselevenLabsApi.Key) {
      throw new Error('Eleven.Labs AP.I key not configured')};

    const voice.Id = optionsvoice.Profilevoice_id;
    const url = `https://apielevenlabsio/v1/text-to-speech/${voice.Id}`;
    try {
      const response = await axiospost(
        url;
        {
          text: optionstext;
          model_id: 'eleven_turbo_v2';
          voice_settings: {
            stability: optionsvoice.Settings?stability || optionsvoice.Profilestability;
            similarity_boost:
              optionsvoice.Settings?similarity_boost || optionsvoice.Profilesimilarity_boost;
            style: optionsvoice.Settings?style || optionsvoice.Profilestyle;
            use_speaker_boost:
              optionsvoice.Settings?use_speaker_boost || optionsvoice.Profileuse_speaker_boost;
          }};
        {
          headers: {
            Accept: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
            'xi-api-key': thiselevenLabsApi.Key;
            'Content-Type': 'application/json';
          };
          response.Type: 'arraybuffer';
        });
      const buffer = Bufferfrom(responsedata)// Validate and process the audio;
      const validation = await audioHandlervalidateAudio.Buffer(buffer, optionsformat);
      if (!validationis.Valid) {
        loggerwarn('Eleven.Labs audio validation issues', LogContextAVATA.R, {
          errors: validationerrors})}// Process audio for optimization;
      const audioProcessing.Result = await audioHandlerprocess.Audio(buffer, {
        format: optionsformat;
        normalize: true;
        remove.Noise: false});
      return {
        buffer: audioProcessing.Resultbuffer;
        mime.Type: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
        voice_id: voice.Id;
        duration: audioProcessing.Resultmetadataduration;
      }} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Eleven.Labs synthesis error instanceof Error ? errormessage : String(error)  LogContextAVATA.R, { error instanceof Error ? errormessage : String(error));
      throw new Error('Failed to synthesize with Eleven.Labs')}};

  private async synthesizeWithOpenA.I(options: Synthesis.Options): Promise<Audio.Result> {
    if (!thisopenai) {
      throw new Error('OpenA.I client not initialized')};

    try {
      // Map personality to OpenA.I voices;
      const voice.Map: Record<string, string> = {
        sweet: 'nova', // Warm and friendly;
        shy: 'shimmer', // Soft and gentle;
        confident: 'alloy', // Clear and assured;
        caring: 'echo', // Soothing and nurturing;
        playful: 'fable', // Expressive and lively};
      const voice = voice.Map[optionsvoice.Profilevoice_id] || 'nova';
      const response = await axiospost(
        'https: //apiopenaicom/v1/audio/speech';
        {
          model: 'tts-1-hd';
          voice;
          inputoptionstext;
          response_format: optionsformat;
          speed: optionsvoice.Profilespeaking_rate;
        };
        {
          headers: {
            Authorization: `Bearer ${process.envOPENAI_API_KE.Y}`;
            'Content-Type': 'application/json';
          };
          response.Type: 'arraybuffer';
        });
      const buffer = Bufferfrom(responsedata)// Validate and process OpenA.I audio;
      const validation = await audioHandlervalidateAudio.Buffer(buffer, optionsformat);
      if (!validationis.Valid) {
        loggerwarn('OpenA.I audio validation issues', LogContextAVATA.R, {
          errors: validationerrors})}// Process audio for optimization;
      const audioProcessing.Result = await audioHandlerprocess.Audio(buffer, {
        format: optionsformat;
        normalize: true;
        remove.Noise: false});
      return {
        buffer: audioProcessing.Resultbuffer;
        mime.Type: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
        voice_id: voice;
        duration: audioProcessing.Resultmetadataduration;
      }} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('OpenA.I TT.S error instanceof Error ? errormessage : String(error)  LogContextAVATA.R, { error instanceof Error ? errormessage : String(error));
      throw new Error('Failed to synthesize with OpenA.I')}};

  private async synthesizeWithLocalTT.S(options: Synthesis.Options): Promise<Audio.Result> {
    try {
      // Try Kokoro TT.S first;
      return await thissynthesizeWith.Kokoro(options)} catch (error) {
      loggererror('Kokoro TT.S failed', LogContextAVATA.R, { error instanceof Error ? errormessage : String(error));
      loggerwarn('Falling back to mock audio generation', LogContextAVATA.R);
      return thisgenerateMock.Audio(options)}};

  private async synthesizeWith.Kokoro(options: Synthesis.Options): Promise<Audio.Result> {
    try {
      // Initialize Kokoro TT.S if not already done;
      await kokoroTT.Sinitialize()// Map personality-based voice profile to Kokoro voice;
      const kokoro.Profile = thismapToKokoro.Profile(optionsvoice.Profile);
      loggerinfo(`Synthesizing with Kokoro TT.S: ${kokoro.Profileid}`, LogContextAVATA.R, {
        text.Length: optionstextlength;
        format: optionsformat;
        personality: kokoro.Profilestyle});
      const audio.Buffer = await kokoroTT.Ssynthesize({
        text: optionstext;
        voice.Profile: kokoro.Profile;
        output.Format: optionsformat;
        temperature: 0.7;
        top.P: 0.9;
        token.Length: Math.min(200, optionstextsplit(/\s+/)length)})// Validate the generated audio;
      const isValid.Audio = await kokoroTTSvalidateAudio.Buffer(audio.Buffer, optionsformat);
      if (!isValid.Audio) {
        throw new Error(`Generated audio buffer is invalid for format: ${optionsformat}`)}// Process audio with comprehensive errorhandling;
      const audioProcessing.Result = await audioHandlerprocess.Audio(audio.Buffer, {
        format: optionsformat;
        normalize: true;
        remove.Noise: false, // Disable for TT.S as it's already clean});
      const optimized.Buffer = audioProcessing.Resultbuffer;
      const { metadata } = audioProcessing.Result// Log any processing warnings;
      if (audioProcessing.Resultwarningslength > 0) {
        loggerwarn('Audio processing warnings', LogContextAVATA.R, {
          warnings: audioProcessing.Resultwarnings})};

      loggerinfo('Kokoro TT.S synthesis completed successfully', LogContextAVATA.R, {
        duration: metadataduration;
        format: metadataformat;
        buffer.Size: optimized.Bufferlength});
      return {
        buffer: optimized.Buffer;
        mime.Type: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
        voice_id: kokoro.Profileid;
        duration: metadataduration;
      }} catch (error) {
      loggererror('Kokoro TT.S synthesis error instanceof Error ? errormessage : String(error)  LogContextAVATA.R, { error instanceof Error ? errormessage : String(error));
      throw new Error(
        `Kokoro TT.S failed: ${error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)`);
    }};

  private mapToKokoro.Profile(voice.Profile: Voice.Profile): KokoroVoice.Profile {
    const kokoro.Profiles = kokoroTTSgetVoice.Profiles()// Map voice_id to appropriate Kokoro profile;
    const profile.Map: Record<string, string> = {
      sweet: 'athena-sweet';
      shy: 'athena-sweet', // Map shy to sweet;
      confident: 'athena-confident';
      caring: 'athena-warm';
      playful: 'athena-playful';
      professional: 'athena-professional';
    };
    const kokoroProfile.Id = profile.Map[voice.Profilevoice_id] || 'athena-sweet';
    const kokoro.Profile = kokoro.Profilesfind((p) => pid === kokoroProfile.Id);
    if (!kokoro.Profile) {
      // Return default profile if not found;
      return kokoro.Profiles[0]}// Apply voice settings to Kokoro profile;
    return {
      .kokoro.Profile;
      pitch: voice.Profilepitch || kokoro.Profilepitch;
      speed: voice.Profilespeaking_rate || kokoro.Profilespeed;
    }};

  private generateMock.Audio(options: Synthesis.Options): Audio.Result {
    // Generate a simple sine wave as mock audio;
    const sample.Rate = 44100;
    const duration = 3// seconds;
    const frequency = 440// A4 note;
    const num.Samples = sample.Rate * duration;
    const buffer = Bufferalloc(num.Samples * 2)// 16-bit samples;

    for (let i = 0; i < num.Samples; i++) {
      const sample = Mathsin((2 * MathP.I * frequency * i) / sample.Rate) * 0.3;
      const value = Mathfloor(sample * 32767);
      bufferwriteInt16L.E(value, i * 2)};

    return {
      buffer;
      mime.Type: optionsformat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      voice_id: 'mock';
      duration;
    }};

  private estimateAudioDurationFrom.Buffer(buffer: Buffer, format: string): number {
    // Very rough estimation based on file size// Actual implementation would parse audio headers;
    const bytesPer.Second = format === 'mp3' ? 16000 : 88200// Rough estimates;
    return bufferlength / bytesPer.Second};

  async getAvailable.Voices(): Promise<any[]> {
    const voices = []// Add Kokoro voices first (highest priority for local TT.S);
    try {
      const kokoro.Profiles = kokoroTTSgetVoice.Profiles();
      voicespush(
        .kokoro.Profilesmap((profile) => ({
          id: profileid;
          name: profilename;
          provider: 'kokoro';
          description: `${profilestyle} female voice`;
          gender: profilegender;
          style: profilestyle;
          pitch: profilepitch;
          speed: profilespeed;
          local: true})))} catch (error) {
      loggererror('Failed to fetch Kokoro voices', LogContextAVATA.R, { error instanceof Error ? errormessage : String(error) );
    }// Add Eleven.Labs voices if available;
    if (thiselevenLabsApi.Key) {
      try {
        const response = await axiosget('https://apielevenlabsio/v1/voices', {
          headers: { 'xi-api-key': thiselevenLabsApi.Key }});
        voicespush(
          .responsedatavoicesmap((voice: any) => ({
            id: voicevoice_id;
            name: voicename;
            provider: 'elevenlabs';
            preview_url: voicepreview_url;
            labels: voicelabels;
            local: false})))} catch (error) {
        loggererror('Failed to fetch Eleven.Labs voices', LogContextAVATA.R, { error instanceof Error ? errormessage : String(error) );
      }}// Add OpenA.I voices;
    if (thisopenai) {
      voicespush(
        {
          id: 'nova';
          name: 'Nova (Sweet)';
          provider: 'openai';
          description: 'Warm and friendly';
          local: false;
        };
        {
          id: 'shimmer';
          name: 'Shimmer (Shy)';
          provider: 'openai';
          description: 'Soft and gentle';
          local: false;
        };
        {
          id: 'alloy';
          name: 'Alloy (Confident)';
          provider: 'openai';
          description: 'Clear and assured';
          local: false;
        };
        {
          id: 'echo';
          name: 'Echo (Caring)';
          provider: 'openai';
          description: 'Soothing and nurturing';
          local: false;
        };
        {
          id: 'fable';
          name: 'Fable (Playful)';
          provider: 'openai';
          description: 'Expressive and lively';
          local: false;
        })}// Add local/mock voices for development;
    if (configserveris.Development) {
      voicespush(
        { id: 'mock-sweet', name: 'Mock Sweet Voice', provider: 'mock', local: true };
        { id: 'mock-confident', name: 'Mock Confident Voice', provider: 'mock', local: true })};

    return voices};

  async testKokoro.Voice(voice.Id: string, sample.Text?: string): Promise<Buffer> {
    try {
      await kokoroTT.Sinitialize();
      return await kokoroTTStest.Voice(voice.Id, sample.Text)} catch (error) {
      loggererror('Kokoro voice test failed', LogContextAVATA.R, { error instanceof Error ? errormessage : String(error));
      throw error instanceof Error ? errormessage : String(error)}};

  async getService.Health(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      openai: boolean;
      elevenlabs: boolean;
      kokoro: boolean;
      whisper: boolean;
    };
    details: any}> {
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy';
      services: {
        openai: false;
        elevenlabs: false;
        kokoro: false;
        whisper: false};
      details: {} as any}// Test OpenA.I availability;
    try {
      if (thisopenai) {
        // Simple test to check if OpenA.I is responsive;
        healthservicesopenai = true;
        healthdetailsopenai = { available: true }}} catch (error) {
      healthdetailsopenai = {
        available: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
      }}// Test Eleven.Labs availability;
    try {
      if (thiselevenLabsApi.Key) {
        // Could make a simple AP.I call to test connectivity;
        healthserviceselevenlabs = true;
        healthdetailselevenlabs = { available: true }}} catch (error) {
      healthdetailselevenlabs = {
        available: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
      }}// Test Kokoro TT.S availability;
    try {
      const kokoro.Status = kokoroTTSgetService.Status();
      healthserviceskokoro = kokoro.Statusinitialized;
      healthdetailskokoro = kokoro.Status} catch (error) {
      healthdetailskokoro = {
        available: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
      }}// Test Whisper availability;
    try {
      healthserviceswhisper = !!thisopenai || !!thiswhisperApi.Url;
      healthdetailswhisper = {
        available: healthserviceswhisper;
        api.Url: thiswhisperApi.Url;
      }} catch (error) {
      healthdetailswhisper = {
        available: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
      }}// Add audio processing stats;
    try {
      const audio.Stats = audioHandlergetProcessing.Stats();
      healthdetailsaudio.Processing = {
        total.Processed: audioStatstotal.Processed;
        success.Rate: audioStatssuccess.Rate;
        averageProcessing.Time: audioStatsaverageProcessing.Time;
      }} catch (error) {
      healthdetailsaudio.Processing = {
        available: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
      }}// Determine overall status;
    const available.Services = Objectvalues(healthservices)filter(Boolean)length;
    if (available.Services === 0) {
      healthstatus = 'unhealthy'} else if (available.Services < 2) {
      healthstatus = 'degraded'};
;
    return health};

  async clearAll.Caches(): Promise<void> {
    try {
      await Promiseall([kokoroTTSclear.Cache(), audioHandlerclear.Cache()]);
      loggerinfo('All speech service caches cleared', LogContextAVATA.R)} catch (error) {
      loggererror('Error clearing speech service caches', LogContextAVATA.R, { error instanceof Error ? errormessage : String(error) );
    }};

  async synthesizeSpeechWith.Retry(options: Synthesis.Options, max.Retries = 2): Promise<Audio.Result> {
    let last.Error: Error | null = null;
    for (let attempt = 1; attempt <= max.Retries + 1, attempt++) {
      try {
        loggerinfo(`Speech synthesis attempt ${attempt}/${max.Retries + 1}`, LogContextAVATA.R, {
          text.Length: optionstextlength;
          format: optionsformat;
          voice.Id: optionsvoice.Profilevoice_id});
        const result = await thissynthesize.Speech(options)// Validate the result;
        if (resultbufferlength === 0) {
          throw new Error('Generated audio buffer is empty')};

        loggerinfo(`Speech synthesis successful on attempt ${attempt}`, LogContextAVATA.R);
        return result} catch (error) {
        last.Error = error instanceof Error ? error instanceof Error ? errormessage : String(error)  new Error('Unknown synthesis error instanceof Error ? errormessage : String(error);
        loggerwarn(
          `Speech synthesis attempt ${attempt} failed: ${last.Errormessage}`;
          LogContextAVATA.R);
        if (attempt <= max.Retries) {
          // Wait before retrying (exponential backoff);
          const delay.Ms = Math.min(1000 * Mathpow(2, attempt - 1), 5000);
          await new Promise((resolve) => set.Timeout(resolve, delay.Ms))}}};

    throw last.Error || new Error('Speech synthesis failed after all retries')};

  async estimateAudio.Duration(text: string, voice.Profile?: Voice.Profile): Promise<number> {
    try {
      // More accurate duration estimation based on voice profile and text characteristics;
      const words = texttrim()split(/\s+/)length;
      const chars = textlength// Base speaking rate (words per minute);
      let baseWP.M = 160// Average speaking rate;

      if (voice.Profile) {
        // Adjust for speaking rate setting;
        baseWP.M *= voice.Profilespeaking_rate || 1.0// Adjust for voice characteristics;
        if (voice.Profilevoice_id === 'sweet' || voice.Profilevoice_id === 'shy') {
          baseWP.M *= 0.9// Slower, more deliberate} else if (voice.Profilevoice_id === 'playful') {
          baseWP.M *= 1.1// Faster, more energetic}}// Calculate duration in seconds;
      const base.Duration = (words / baseWP.M) * 60// Add time for punctuation pauses;
      const punctuation.Count = (textmatch(/[.!?]/g) || [])length;
      const pause.Time = punctuation.Count * 0.5// 0.5 seconds per major punctuation// Add time for commas;
      const comma.Count = (textmatch(/[]/g) || [])length;
      const shortPause.Time = comma.Count * 0.2// 0.2 seconds per comma;

      const total.Duration = Math.max(base.Duration + pause.Time + shortPause.Time, 1.0);
      loggerdebug('Estimated audio duration', LogContextAVATA.R, {
        words;
        chars;
        estimatedWP.M: baseWP.M;
        duration: total.Duration});
      return total.Duration} catch (error) {
      loggererror('Error estimating audio duration', LogContextAVATA.R, { error instanceof Error ? errormessage : String(error));
      return Math.max(textsplit(' ')length * 0.4, 1.0)// Fallback estimation}}};
