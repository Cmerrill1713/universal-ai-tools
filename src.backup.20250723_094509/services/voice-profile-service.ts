import { LogContext, logger } from '../utils/enhanced-logger';
import { type KokoroVoiceProfile, kokoroTTS } from './kokoro-tts-service';

interface VoiceProfile {
  voice_id: string;
  pitch: number;
  speaking_rate: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  description: string;
  emotional_range: {
    warmth: number;
    breathiness: number;
    clarity: number;
    expressiveness: number;
  };
}

interface PersonalityProfile {
  name: string;
  description: string;
  base_profile: Partial<VoiceProfile>;
  sweetness_modifiers: {
    pitch_multiplier: number;
    warmth_multiplier: number;
    breathiness_multiplier: number;
    speaking_rate_adjustment: number;
  };
}

/**
 * VoiceProfileService manages voice personalities and dynamic voice modulation.
 * Provides 5 distinct personality profiles with sweetness-based parameter adjustment.
 *
 * Personalities:
 * - Sweet: Warm, gentle, and inviting (default)
 * - Shy: Soft, reserved, endearing
 * - Confident: Clear, assured, professional
 * - Caring: Nurturing, empathetic, soothing
 * - Playful: Bubbly, energetic, expressive
 *
 * Features:
 * - Dynamic sweetness level adjustment (0.0-1.0)
 * - Voice parameter optimization per personality
 * - ElevenLabs and OpenAI voice mapping
 * - Emotional state modulation
 */
export class VoiceProfileService {
  // Personality profiles with base settings and sweetness modifiers
  private personalities: Record<string, PersonalityProfile> = {
    sweet: {
      name: 'Sweet',
      description: 'Warm, gentle, and inviting voice with a hint of sweetness',
      base_profile: {
        pitch: 1.1,
        speaking_rate: 0.95,
        stability: 0.75,
        similarity_boost: 0.8,
        style: 0.6,
        use_speaker_boost: true,
        description: 'A warm and inviting voice that sounds caring and approachable',
      },
      sweetness_modifiers: {
        pitch_multiplier: 1.05,
        warmth_multiplier: 1.2,
        breathiness_multiplier: 1.1,
        speaking_rate_adjustment: -0.05,
      },
    },
    shy: {
      name: 'Shy',
      description: 'Soft, gentle voice with a touch of reserved sweetness',
      base_profile: {
        pitch: 1.15,
        speaking_rate: 0.9,
        stability: 0.65,
        similarity_boost: 0.7,
        style: 0.4,
        use_speaker_boost: false,
        description: 'A soft, slightly hesitant voice that sounds endearing',
      },
      sweetness_modifiers: {
        pitch_multiplier: 1.08,
        warmth_multiplier: 1.0,
        breathiness_multiplier: 1.3,
        speaking_rate_adjustment: -0.1,
      },
    },
    confident: {
      name: 'Confident',
      description: 'Clear, assured voice with professional warmth',
      base_profile: {
        pitch: 1.0,
        speaking_rate: 1.0,
        stability: 0.85,
        similarity_boost: 0.9,
        style: 0.7,
        use_speaker_boost: true,
        description:
          'A clear, confident voice that commands attention while remaining approachable',
      },
      sweetness_modifiers: {
        pitch_multiplier: 1.02,
        warmth_multiplier: 1.1,
        breathiness_multiplier: 0.9,
        speaking_rate_adjustment: 0,
      },
    },
    caring: {
      name: 'Caring',
      description: 'Nurturing, soothing voice full of empathy',
      base_profile: {
        pitch: 1.05,
        speaking_rate: 0.92,
        stability: 0.8,
        similarity_boost: 0.85,
        style: 0.5,
        use_speaker_boost: true,
        description: 'A nurturing voice that conveys genuine care and understanding',
      },
      sweetness_modifiers: {
        pitch_multiplier: 1.03,
        warmth_multiplier: 1.3,
        breathiness_multiplier: 1.15,
        speaking_rate_adjustment: -0.03,
      },
    },
    playful: {
      name: 'Playful',
      description: 'Bubbly, expressive voice with dynamic energy',
      base_profile: {
        pitch: 1.08,
        speaking_rate: 1.05,
        stability: 0.6,
        similarity_boost: 0.75,
        style: 0.8,
        use_speaker_boost: true,
        description: 'An energetic, expressive voice that sounds fun and engaging',
      },
      sweetness_modifiers: {
        pitch_multiplier: 1.1,
        warmth_multiplier: 1.15,
        breathiness_multiplier: 1.0,
        speaking_rate_adjustment: 0.05,
      },
    },
  };

  private voiceIdMappings: Record<string, string> = {
    // ElevenLabs voice IDs for attractive female voices
    sweet: 'EXAVITQu4vr4xnSDxMaL', // Sarah - warm and friendly
    shy: 'MF3mGyEYCl7XYWbV9V6O', // Elli - soft and gentle
    confident: '21m00Tcm4TlvDq8ikWAM', // Rachel - clear and professional
    caring: 'AZnzlk1XvdvUeBnXmlld', // Domi - nurturing and kind
    playful: 'XB0fDUnXU5powFXDhCwa', // Charlotte - bubbly and expressive
  };

  // Fallback OpenAI voice mappings
  private openAIVoiceMappings: Record<string, string> = {
    sweet: 'nova',
    shy: 'shimmer',
    confident: 'alloy',
    caring: 'echo',
    playful: 'fable',
  };

  getVoiceProfile(personality: string, sweetnessLevel = 0.7): VoiceProfile {
    const personalityProfile = this.personalities[personality] || this.personalities.sweet;
    const baseProfile = personalityProfile.base_profile;
    const modifiers = personalityProfile.sweetness_modifiers;

    // Apply sweetness level to modify the voice characteristics
    const adjustedProfile: VoiceProfile = {
      voice_id: this.voiceIdMappings[personality] || this.voiceIdMappings.sweet,
      pitch: (baseProfile.pitch || 1.0) * (1 + (modifiers.pitch_multiplier - 1) * sweetnessLevel),
      speaking_rate:
        (baseProfile.speaking_rate || 1.0) + modifiers.speaking_rate_adjustment * sweetnessLevel,
      stability: baseProfile.stability || 0.75,
      similarity_boost: baseProfile.similarity_boost || 0.8,
      style: baseProfile.style || 0.6,
      use_speaker_boost:
        baseProfile.use_speaker_boost !== undefined ? baseProfile.use_speaker_boost : true,
      description: baseProfile.description || '',
      emotional_range: {
        warmth: 0.7 * modifiers.warmth_multiplier * sweetnessLevel,
        breathiness: 0.3 * modifiers.breathiness_multiplier * sweetnessLevel,
        clarity: 1.0 - 0.2 * sweetnessLevel, // Slightly less clarity with more sweetness
        expressiveness: 0.6 + 0.2 * sweetnessLevel, // More expressive with sweetness
      },
    };

    // Ensure values are within valid ranges
    adjustedProfile.pitch = Math.max(0.5, Math.min(2.0, adjustedProfile.pitch));
    adjustedProfile.speaking_rate = Math.max(0.5, Math.min(1.5, adjustedProfile.speaking_rate));
    adjustedProfile.stability = Math.max(0, Math.min(1, adjustedProfile.stability));
    adjustedProfile.similarity_boost = Math.max(0, Math.min(1, adjustedProfile.similarity_boost));
    adjustedProfile.style = Math.max(0, Math.min(1, adjustedProfile.style));

    logger.info(
      `Generated voice profile for ${personality} with sweetness ${sweetnessLevel}`,
      LogContext.AVATAR,
      {
        pitch: adjustedProfile.pitch,
        speaking_rate: adjustedProfile.speaking_rate,
        emotional_range: adjustedProfile.emotional_range,
      }
    );

    return adjustedProfile;
  }

  getAllProfiles(): PersonalityProfile[] {
    return Object.values(this.personalities);
  }

  getOpenAIVoiceId(personality: string): string {
    return this.openAIVoiceMappings[personality] || 'nova';
  }

  async updateVoiceConfiguration(
    personality: string,
    voiceId: string,
    settings?: any
  ): Promise<unknown> {
    // Update the voice ID mapping
    this.voiceIdMappings[personality] = voiceId;

    // Update base profile settings if provided
    if (settings && this.personalities[personality]) {
      const profile = this.personalities[personality];

      if (settings.pitch_adjustment !== undefined) {
        profile.base_profile.pitch =
          (profile.base_profile.pitch || 1.0) + settings.pitch_adjustment;
      }

      if (settings.speaking_rate !== undefined) {
        profile.base_profile.speaking_rate = settings.speaking_rate;
      }

      if (settings.volume_gain_db !== undefined) {
        // Store volume gain for audio processing
        profile.base_profile.style = Math.max(
          0,
          Math.min(1, (profile.base_profile.style || 0.5) + settings.volume_gain_db / 40)
        );
      }
    }

    return {
      personality,
      voice_id: voiceId,
      settings: this.personalities[personality]?.base_profile,
    };
  }

  getEmotionalParameters(personality: string, sweetnessLevel: number, emotion?: string): any {
    const profile = this.getVoiceProfile(personality, sweetnessLevel);

    // Adjust parameters based on emotion
    const emotionalAdjustments: Record<string, unknown> = {
      happy: {
        pitch_multiplier: 1.1,
        speaking_rate_multiplier: 1.05,
        style_boost: 0.1,
      },
      sad: {
        pitch_multiplier: 0.95,
        speaking_rate_multiplier: 0.9,
        style_boost: -0.1,
      },
      excited: {
        pitch_multiplier: 1.15,
        speaking_rate_multiplier: 1.1,
        style_boost: 0.2,
      },
      calm: {
        pitch_multiplier: 0.98,
        speaking_rate_multiplier: 0.95,
        style_boost: -0.05,
      },
      flirty: {
        pitch_multiplier: 1.05,
        speaking_rate_multiplier: 0.98,
        style_boost: 0.15,
        breathiness_boost: 0.2,
      },
    };

    const adjustment = emotionalAdjustments[emotion || 'neutral'] || {
      pitch_multiplier: 1.0,
      speaking_rate_multiplier: 1.0,
      style_boost: 0,
    };

    return {
      pitch: profile.pitch * adjustment.pitch_multiplier,
      speaking_rate: profile.speaking_rate * adjustment.speaking_rate_multiplier,
      style: Math.max(0, Math.min(1, profile.style + adjustment.style_boost)),
      stability: profile.stability,
      similarity_boost: profile.similarity_boost,
      emotional_context: emotion,
      breathiness: profile.emotional_range.breathiness + (adjustment.breathiness_boost || 0),
    };
  }

  /**
   * Get Kokoro-compatible voice profile based on personality and settings
   */
  getKokoroVoiceProfile(personality: string, sweetnessLevel = 0.7): KokoroVoiceProfile | null {
    try {
      const kokoroProfiles = kokoroTTS.getVoiceProfiles();

      // Map personality to Kokoro profile
      const profileMap: Record<string, string> = {
        sweet: 'athena-sweet',
        shy: 'athena-sweet', // Use sweet for shy as they're similar
        confident: 'athena-confident',
        caring: 'athena-warm',
        playful: 'athena-playful',
      };

      const kokoroProfileId = profileMap[personality] || 'athena-sweet';
      const baseProfile = kokoroProfiles.find((p) => p.id === kokoroProfileId);

      if (!baseProfile) {
        logger.warn(`Kokoro profile not found for personality: ${personality}`, LogContext.AVATAR);
        return null;
      }

      // Apply sweetness level adjustments
      const adjustedProfile: KokoroVoiceProfile = {
        ...baseProfile,
        pitch: baseProfile.pitch + (sweetnessLevel - 0.5) * 0.4, // Adjust pitch based on sweetness
        speed: baseProfile.speed - (sweetnessLevel - 0.5) * 0.2, // Slower = sweeter
      };

      // Ensure values are within valid ranges
      adjustedProfile.pitch = Math.max(-2.0, Math.min(2.0, adjustedProfile.pitch));
      adjustedProfile.speed = Math.max(0.5, Math.min(2.0, adjustedProfile.speed));

      return adjustedProfile;
    } catch (error) {
      logger.error('Error getting Kokoro voice profile', LogContext.AVATAR, { error});
      return null;
    }
  }

  /**
   * Get enhanced voice configuration with provider-specific optimizations
   */
  getEnhancedVoiceConfig(
    personality: string,
    sweetnessLevel: number,
    provider: 'kokoro' | 'openai' | 'elevenlabs' = 'kokoro'
  ): any {
    const baseProfile = this.getVoiceProfile(personality, sweetnessLevel);

    switch (provider) {
      case 'kokoro':
        const kokoroProfile = this.getKokoroVoiceProfile(personality, sweetnessLevel);
        return {
          provider: 'kokoro',
          profile: kokoroProfile,
          baseProfile,
          optimizations: {
            temperature: 0.7,
            topP: 0.9,
            tokenLength: 150,
          },
        };

      case 'openai':
        return {
          provider: 'openai',
          voice: this.getOpenAIVoiceId(personality),
          baseProfile,
          optimizations: {
            model: 'tts-1-hd',
            response_format: 'mp3',
            speed: baseProfile.speaking_rate,
          },
        };

      case 'elevenlabs':
        return {
          provider: 'elevenlabs',
          voice_id: baseProfile.voice_id,
          baseProfile,
          optimizations: {
            model_id: 'eleven_turbo_v2',
            voice_settings: {
              stability: baseProfile.stability,
              similarity_boost: baseProfile.similarity_boost,
              style: baseProfile.style,
              use_speaker_boost: baseProfile.use_speaker_boost,
            },
          },
        };

      default:
        return baseProfile;
    }
  }

  /**
   * Dynamically adjust voice parameters based on context
   */
  adjustVoiceForContext(
    baseProfile: VoiceProfile,
    context: {
      textLength?: number;
      emotionalTone?: string;
      urgency?: 'low' | 'medium' | 'high';
      audience?: 'child' | 'adult' | 'professional';
    }
  ): VoiceProfile {
    const adjustedProfile = { ...baseProfile };

    // Adjust for text length
    if (context.textLength) {
      if (context.textLength > 1000) {
        // Longer text - speak slightly faster and more clearly
        adjustedProfile.speaking_rate *= 1.1;
        adjustedProfile.stability = Math.min(1, adjustedProfile.stability + 0.1);
      } else if (context.textLength < 50) {
        // Short text - speak more expressively
        adjustedProfile.style = Math.min(1, adjustedProfile.style + 0.2);
      }
    }

    // Adjust for urgency
    if (context.urgency) {
      switch (context.urgency) {
        case 'high':
          adjustedProfile.speaking_rate *= 1.2;
          adjustedProfile.pitch *= 1.05;
          break;
        case 'low':
          adjustedProfile.speaking_rate *= 0.9;
          adjustedProfile.pitch *= 0.98;
          break;
      }
    }

    // Adjust for audience
    if (context.audience) {
      switch (context.audience) {
        case 'child':
          adjustedProfile.pitch *= 1.1;
          adjustedProfile.speaking_rate *= 0.9;
          adjustedProfile.style = Math.min(1, adjustedProfile.style + 0.3);
          break;
        case 'professional':
          adjustedProfile.speaking_rate *= 1.05;
          adjustedProfile.stability = Math.min(1, adjustedProfile.stability + 0.2);
          adjustedProfile.style = Math.max(0, adjustedProfile.style - 0.1);
          break;
      }
    }

    // Ensure all values remain within valid ranges
    adjustedProfile.pitch = Math.max(0.5, Math.min(2.0, adjustedProfile.pitch));
    adjustedProfile.speaking_rate = Math.max(0.5, Math.min(1.5, adjustedProfile.speaking_rate));
    adjustedProfile.stability = Math.max(0, Math.min(1, adjustedProfile.stability));
    adjustedProfile.similarity_boost = Math.max(0, Math.min(1, adjustedProfile.similarity_boost));
    adjustedProfile.style = Math.max(0, Math.min(1, adjustedProfile.style));

    logger.debug('Voice profile adjusted for context', LogContext.AVATAR, {
      originalProfile: baseProfile,
      adjustedProfile,
      context,
    });

    return adjustedProfile;
  }

  /**
   * Get voice profile statistics and analytics
   */
  getVoiceProfileStats(): {
    totalProfiles: number;
    availablePersonalities: string[];
    defaultSettings: any;
    kokoroIntegration: boolean;
  } {
    return {
      totalProfiles: Object.keys(this.personalities).length,
      availablePersonalities: Object.keys(this.personalities),
      defaultSettings: {
        defaultSweetnessLevel: 0.7,
        defaultPersonality: 'sweet',
        supportedFormats: ['mp3', 'wav'],
        supportedProviders: ['kokoro', 'openai', 'elevenlabs'],
      },
      kokoroIntegration: kokoroTTS.getVoiceProfiles().length > 0,
    };
  }

  /**
   * Validate voice configuration
   */
  validateVoiceConfig(config: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check personality
    if (config.personality && !this.personalities[config.personality]) {
      errors.push(`Invalid personality: ${config.personality}`);
    }

    // Check sweetness level
    if (config.sweetness_level !== undefined) {
      if (
        typeof config.sweetness_level !== 'number' ||
        config.sweetness_level < 0 ||
        config.sweetness_level > 1
      ) {
        errors.push('Sweetness level must be a number between 0 and 1');
      }
    }

    // Check voice settings
    if (config.voice_settings) {
      const settings = config.voice_settings;

      if (
        settings.stability !== undefined &&
        (typeof settings.stability !== 'number' || settings.stability < 0 || settings.stability > 1)
      ) {
        errors.push('Stability must be a number between 0 and 1');
      }

      if (
        settings.similarity_boost !== undefined &&
        (typeof settings.similarity_boost !== 'number' ||
          settings.similarity_boost < 0 ||
          settings.similarity_boost > 1)
      ) {
        errors.push('Similarity boost must be a number between 0 and 1');
      }
    }

    // Check provider compatibility
    if (config.provider === 'kokoro' && kokoroTTS.getVoiceProfiles().length === 0) {
      warnings.push('Kokoro provider requested but no Kokoro profiles available');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
