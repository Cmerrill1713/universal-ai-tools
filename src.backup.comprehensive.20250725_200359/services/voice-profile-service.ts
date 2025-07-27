import { Log.Context, logger } from './utils/enhanced-logger';
import { type Kokoro.Voice.Profile, kokoroT.T.S } from './kokoro-tts-service';
interface Voice.Profile {
  voice_id: string,
  pitch: number,
  speaking_rate: number,
  stability: number,
  similarity_boost: number,
  style: number,
  use_speaker_boost: boolean,
  description: string,
  emotional_range: {
    warmth: number,
    breathiness: number,
    clarity: number,
    expressiveness: number,
  };

interface Personality.Profile {
  name: string,
  description: string,
  base_profile: Partial<Voice.Profile>
  sweetness_modifiers: {
    pitch_multiplier: number,
    warmth_multiplier: number,
    breathiness_multiplier: number,
    speaking_rate_adjustment: number,
  }}/**
 * Voice.Profile.Service manages voice personalities and dynamic voice modulation.
 * Provides 5 distinct personality profiles with sweetness-based parameter adjustment.
 *
 * Personalities:
 * - Sweet: Warm, gentle, and inviting (default)* - Shy: Soft, reserved, endearing* - Confident: Clear, assured, professional* - Caring: Nurturing, empathetic, soothing* - Playful: Bubbly, energetic, expressive*
 * Features:
 * - Dynamic sweetness level adjustment (0.0-1.0)* - Voice parameter optimization per personality* - Eleven.Labs and Open.A.I voice mapping* - Emotional state modulation*/
export class Voice.Profile.Service {
  // Personality profiles with base settings and sweetness modifiers;
  private personalities: Record<string, Personality.Profile> = {
    sweet: {
      name: 'Sweet';,
      description: 'Warm, gentle, and inviting voice with a hint of sweetness';
      base_profile: {
        pitch: 1.1,
        speaking_rate: 0.95,
        stability: 0.75,
        similarity_boost: 0.8,
        style: 0.6,
        use_speaker_boost: true,
        description: 'A warm and inviting voice that sounds caring and approachable',
}      sweetness_modifiers: {
        pitch_multiplier: 1.05,
        warmth_multiplier: 1.2,
        breathiness_multiplier: 1.1,
        speaking_rate_adjustment: -0.05,
      };
    shy: {
      name: 'Shy';,
      description: 'Soft, gentle voice with a touch of reserved sweetness';
      base_profile: {
        pitch: 1.15,
        speaking_rate: 0.9,
        stability: 0.65,
        similarity_boost: 0.7,
        style: 0.4,
        use_speaker_boost: false,
        description: 'A soft, slightly hesitant voice that sounds endearing';
      sweetness_modifiers: {
        pitch_multiplier: 1.08,
        warmth_multiplier: 1.0,
        breathiness_multiplier: 1.3,
        speaking_rate_adjustment: -0.1,
      };
    confident: {
      name: 'Confident';,
      description: 'Clear, assured voice with professional warmth';
      base_profile: {
        pitch: 1.0,
        speaking_rate: 1.0,
        stability: 0.85,
        similarity_boost: 0.9,
        style: 0.7,
        use_speaker_boost: true,
        description:
          'A clear, confident voice that commands attention while remaining approachable';
      sweetness_modifiers: {
        pitch_multiplier: 1.02,
        warmth_multiplier: 1.1,
        breathiness_multiplier: 0.9,
        speaking_rate_adjustment: 0,
      };
    caring: {
      name: 'Caring';,
      description: 'Nurturing, soothing voice full of empathy';
      base_profile: {
        pitch: 1.05,
        speaking_rate: 0.92,
        stability: 0.8,
        similarity_boost: 0.85,
        style: 0.5,
        use_speaker_boost: true,
        description: 'A nurturing voice that conveys genuine care and understanding',
}      sweetness_modifiers: {
        pitch_multiplier: 1.03,
        warmth_multiplier: 1.3,
        breathiness_multiplier: 1.15,
        speaking_rate_adjustment: -0.03,
      };
    playful: {
      name: 'Playful';,
      description: 'Bubbly, expressive voice with dynamic energy';
      base_profile: {
        pitch: 1.08,
        speaking_rate: 1.05,
        stability: 0.6,
        similarity_boost: 0.75,
        style: 0.8,
        use_speaker_boost: true,
        description: 'An energetic, expressive voice that sounds fun and engaging';
      sweetness_modifiers: {
        pitch_multiplier: 1.1,
        warmth_multiplier: 1.15,
        breathiness_multiplier: 1.0,
        speaking_rate_adjustment: 0.05,
      }};
  private voice.Id.Mappings: Record<string, string> = {
    // Eleven.Labs voice I.Ds for attractive female voices;
    sweet: 'EXAVITQu4vr4xnSDx.Ma.L', // Sarah - warm and friendly;
    shy: 'MF3mGyEYCl7XYWbV9.V6.O', // Elli - soft and gentle;
    confident: '21m00Tcm4TlvDq8ikW.A.M', // Rachel - clear and professional;
    caring: 'AZnzlk1XvdvUe.Bn.Xmlld', // Domi - nurturing and kind;
    playful: 'XB0fDUnXU5powFX.Dh.Cwa', // Charlotte - bubbly and expressive}// Fallback Open.A.I voice mappings;
  private openAI.Voice.Mappings: Record<string, string> = {
    sweet: 'nova',
    shy: 'shimmer',
    confident: 'alloy',
    caring: 'echo',
    playful: 'fable',
}  get.Voice.Profile(personality: string, sweetness.Level = 0.7): Voice.Profile {
    const personality.Profile = thispersonalities[personality] || thispersonalitiessweet;
    const base.Profile = personality.Profilebase_profile;
    const modifiers = personality.Profilesweetness_modifiers// Apply sweetness level to modify the voice characteristics;
    const adjusted.Profile: Voice.Profile = {
      voice_id: thisvoice.Id.Mappings[personality] || thisvoice.Id.Mappingssweet,
      pitch: (base.Profilepitch || 1.0) * (1 + (modifierspitch_multiplier - 1) * sweetness.Level),
      speaking_rate:
        (base.Profilespeaking_rate || 1.0) + modifiersspeaking_rate_adjustment * sweetness.Level;
      stability: base.Profilestability || 0.75,
      similarity_boost: base.Profilesimilarity_boost || 0.8,
      style: base.Profilestyle || 0.6,
      use_speaker_boost:
        base.Profileuse_speaker_boost !== undefined ? base.Profileuse_speaker_boost : true;
      description: base.Profiledescription || '',
      emotional_range: {
        warmth: 0.7 * modifierswarmth_multiplier * sweetness.Level,
        breathiness: 0.3 * modifiersbreathiness_multiplier * sweetness.Level,
        clarity: 1.0 - 0.2 * sweetness.Level, // Slightly less clarity with more sweetness;
        expressiveness: 0.6 + 0.2 * sweetness.Level, // More expressive with sweetness}}// Ensure values are within valid ranges;
    adjusted.Profilepitch = Math.max(0.5, Math.min(2.0, adjusted.Profilepitch));
    adjusted.Profilespeaking_rate = Math.max(0.5, Math.min(1.5, adjusted.Profilespeaking_rate));
    adjusted.Profilestability = Math.max(0, Math.min(1, adjusted.Profilestability));
    adjusted.Profilesimilarity_boost = Math.max(0, Math.min(1, adjusted.Profilesimilarity_boost));
    adjusted.Profilestyle = Math.max(0, Math.min(1, adjusted.Profilestyle));
    loggerinfo(
      `Generated voice profile for ${personality} with sweetness ${sweetness.Level}`;
      LogContextAVAT.A.R;
      {
        pitch: adjusted.Profilepitch,
        speaking_rate: adjusted.Profilespeaking_rate,
        emotional_range: adjusted.Profileemotional_range,
      });
    return adjusted.Profile;

  get.All.Profiles(): Personality.Profile[] {
    return Objectvalues(thispersonalities);

  getOpenAI.Voice.Id(personality: string): string {
    return thisopenAI.Voice.Mappings[personality] || 'nova';

  async update.Voice.Configuration(
    personality: string,
    voice.Id: string,
    settings?: any): Promise<unknown> {
    // Update the voice I.D mapping;
    thisvoice.Id.Mappings[personality] = voice.Id// Update base profile settings if provided;
    if (settings && thispersonalities[personality]) {
      const profile = thispersonalities[personality];
      if (settingspitch_adjustment !== undefined) {
        profilebase_profilepitch =
          (profilebase_profilepitch || 1.0) + settingspitch_adjustment;

      if (settingsspeaking_rate !== undefined) {
        profilebase_profilespeaking_rate = settingsspeaking_rate;

      if (settingsvolume_gain_db !== undefined) {
        // Store volume gain for audio processing;
        profilebase_profilestyle = Math.max(
          0;
          Math.min(1, (profilebase_profilestyle || 0.5) + settingsvolume_gain_db / 40))};

    return {
      personality;
      voice_id: voice.Id,
      settings: thispersonalities[personality]?base_profile,
    };

  get.Emotional.Parameters(personality: string, sweetness.Level: number, emotion?: string): any {
    const profile = thisget.Voice.Profile(personality, sweetness.Level)// Adjust parameters based on emotion;
    const emotional.Adjustments: Record<string, unknown> = {
      happy: {
        pitch_multiplier: 1.1,
        speaking_rate_multiplier: 1.05,
        style_boost: 0.1,
}      sad: {
        pitch_multiplier: 0.95,
        speaking_rate_multiplier: 0.9,
        style_boost: -0.1,
}      excited: {
        pitch_multiplier: 1.15,
        speaking_rate_multiplier: 1.1,
        style_boost: 0.2,
}      calm: {
        pitch_multiplier: 0.98,
        speaking_rate_multiplier: 0.95,
        style_boost: -0.05,
}      flirty: {
        pitch_multiplier: 1.05,
        speaking_rate_multiplier: 0.98,
        style_boost: 0.15,
        breathiness_boost: 0.2,
      };
    const adjustment = emotional.Adjustments[emotion || 'neutral'] || {
      pitch_multiplier: 1.0,
      speaking_rate_multiplier: 1.0,
      style_boost: 0,
}    return {
      pitch: profilepitch * adjustmentpitch_multiplier,
      speaking_rate: profilespeaking_rate * adjustmentspeaking_rate_multiplier,
      style: Math.max(0, Math.min(1, profilestyle + adjustmentstyle_boost));
      stability: profilestability,
      similarity_boost: profilesimilarity_boost,
      emotionalcontext: emotion,
      breathiness: profileemotional_rangebreathiness + (adjustmentbreathiness_boost || 0),
    }}/**
   * Get Kokoro-compatible voice profile based on personality and settings*/
  getKokoro.Voice.Profile(personality: string, sweetness.Level = 0.7): Kokoro.Voice.Profile | null {
    try {
      const kokoro.Profiles = kokoroTTSget.Voice.Profiles()// Map personality to Kokoro profile;
      const profile.Map: Record<string, string> = {
        sweet: 'athena-sweet',
        shy: 'athena-sweet', // Use sweet for shy as they're similar;
        confident: 'athena-confident',
        caring: 'athena-warm',
        playful: 'athena-playful',
}      const kokoro.Profile.Id = profile.Map[personality] || 'athena-sweet';
      const base.Profile = kokoro.Profilesfind((p) => pid === kokoro.Profile.Id);
      if (!base.Profile) {
        loggerwarn(`Kokoro profile not found for personality: ${personality}`, LogContextAVAT.A.R);
        return null}// Apply sweetness level adjustments;
      const adjusted.Profile: Kokoro.Voice.Profile = {
        .base.Profile;
        pitch: base.Profilepitch + (sweetness.Level - 0.5) * 0.4, // Adjust pitch based on sweetness;
        speed: base.Profilespeed - (sweetness.Level - 0.5) * 0.2, // Slower = sweeter}// Ensure values are within valid ranges;
      adjusted.Profilepitch = Math.max(-2.0, Math.min(2.0, adjusted.Profilepitch));
      adjusted.Profilespeed = Math.max(0.5, Math.min(2.0, adjusted.Profilespeed));
      return adjusted.Profile} catch (error) {
      loggererror('Error getting Kokoro voice profile', LogContextAVAT.A.R, { error instanceof Error ? errormessage : String(error));
      return null}}/**
   * Get enhanced voice configuration with provider-specific optimizations*/
  getEnhanced.Voice.Config(
    personality: string,
    sweetness.Level: number,
    provider: 'kokoro' | 'openai' | 'elevenlabs' = 'kokoro'): any {
    const base.Profile = thisget.Voice.Profile(personality, sweetness.Level);
    switch (provider) {
      case 'kokoro':
        const kokoro.Profile = thisgetKokoro.Voice.Profile(personality, sweetness.Level);
        return {
          provider: 'kokoro',
          profile: kokoro.Profile,
          base.Profile;
          optimizations: {
            temperature: 0.7,
            top.P: 0.9,
            token.Length: 150,
          };
      case 'openai':
        return {
          provider: 'openai',
          voice: thisgetOpenAI.Voice.Id(personality),
          base.Profile;
          optimizations: {
            model: 'tts-1-hd',
            response_format: 'mp3',
            speed: base.Profilespeaking_rate,
          };
      case 'elevenlabs':
        return {
          provider: 'elevenlabs',
          voice_id: base.Profilevoice_id,
          base.Profile;
          optimizations: {
            model_id: 'eleven_turbo_v2',
            voice_settings: {
              stability: base.Profilestability,
              similarity_boost: base.Profilesimilarity_boost,
              style: base.Profilestyle,
              use_speaker_boost: base.Profileuse_speaker_boost,
            }};
      default:
        return base.Profile}}/**
   * Dynamically adjust voice parameters based on context*/
  adjustVoice.For.Context(
    base.Profile: Voice.Profile,
    context: {
      text.Length?: number;
      emotional.Tone?: string;
      urgency?: 'low' | 'medium' | 'high';
      audience?: 'child' | 'adult' | 'professional';
    }): Voice.Profile {
    const adjusted.Profile = { .base.Profile }// Adjust for text length;
    if (contexttext.Length) {
      if (contexttext.Length > 1000) {
        // Longer text - speak slightly faster and more clearly;
        adjusted.Profilespeaking_rate *= 1.1;
        adjusted.Profilestability = Math.min(1, adjusted.Profilestability + 0.1)} else if (contexttext.Length < 50) {
        // Short text - speak more expressively;
        adjusted.Profilestyle = Math.min(1, adjusted.Profilestyle + 0.2)}}// Adjust for urgency;
    if (contexturgency) {
      switch (contexturgency) {
        case 'high':
          adjusted.Profilespeaking_rate *= 1.2;
          adjusted.Profilepitch *= 1.05;
          break;
        case 'low':
          adjusted.Profilespeaking_rate *= 0.9;
          adjusted.Profilepitch *= 0.98;
          break}}// Adjust for audience;
    if (contextaudience) {
      switch (contextaudience) {
        case 'child':
          adjusted.Profilepitch *= 1.1;
          adjusted.Profilespeaking_rate *= 0.9;
          adjusted.Profilestyle = Math.min(1, adjusted.Profilestyle + 0.3);
          break;
        case 'professional':
          adjusted.Profilespeaking_rate *= 1.05;
          adjusted.Profilestability = Math.min(1, adjusted.Profilestability + 0.2);
          adjusted.Profilestyle = Math.max(0, adjusted.Profilestyle - 0.1);
          break}}// Ensure all values remain within valid ranges;
    adjusted.Profilepitch = Math.max(0.5, Math.min(2.0, adjusted.Profilepitch));
    adjusted.Profilespeaking_rate = Math.max(0.5, Math.min(1.5, adjusted.Profilespeaking_rate));
    adjusted.Profilestability = Math.max(0, Math.min(1, adjusted.Profilestability));
    adjusted.Profilesimilarity_boost = Math.max(0, Math.min(1, adjusted.Profilesimilarity_boost));
    adjusted.Profilestyle = Math.max(0, Math.min(1, adjusted.Profilestyle));
    loggerdebug('Voice profile adjusted for context', LogContextAVAT.A.R, {
      original.Profile: base.Profile,
      adjusted.Profile;
      context});
    return adjusted.Profile}/**
   * Get voice profile statistics and analytics*/
  getVoice.Profile.Stats(): {
    total.Profiles: number,
    available.Personalities: string[],
    default.Settings: any,
    kokoro.Integration: boolean} {
    return {
      total.Profiles: Object.keys(thispersonalities)length,
      available.Personalities: Object.keys(thispersonalities),
      default.Settings: {
        default.Sweetness.Level: 0.7,
        default.Personality: 'sweet',
        supported.Formats: ['mp3', 'wav'];
        supported.Providers: ['kokoro', 'openai', 'elevenlabs'];
      kokoro.Integration: kokoroTTSget.Voice.Profiles()length > 0,
    }}/**
   * Validate voice configuration*/
  validate.Voice.Config(config: any): {
    is.Valid: boolean,
    errors: string[],
    warnings: string[]} {
    const errors: string[] = [],
    const warnings: string[] = []// Check personality,
    if (configpersonality && !thispersonalities[configpersonality]) {
      errorspush(`Invalid personality: ${configpersonality}`)}// Check sweetness level,
    if (configsweetness_level !== undefined) {
      if (
        typeof configsweetness_level !== 'number' || configsweetness_level < 0 || configsweetness_level > 1) {
        errorspush('Sweetness level must be a number between 0 and 1')}}// Check voice settings;
    if (configvoice_settings) {
      const settings = configvoice_settings;
      if (
        settingsstability !== undefined && (typeof settingsstability !== 'number' || settingsstability < 0 || settingsstability > 1)) {
        errorspush('Stability must be a number between 0 and 1');

      if (
        settingssimilarity_boost !== undefined && (typeof settingssimilarity_boost !== 'number' || settingssimilarity_boost < 0 || settingssimilarity_boost > 1)) {
        errorspush('Similarity boost must be a number between 0 and 1')}}// Check provider compatibility;
    if (configprovider === 'kokoro' && kokoroTTSget.Voice.Profiles()length === 0) {
      warningspush('Kokoro provider requested but no Kokoro profiles available');

    return {
      is.Valid: errorslength === 0,
      errors;
      warnings;
    }};
