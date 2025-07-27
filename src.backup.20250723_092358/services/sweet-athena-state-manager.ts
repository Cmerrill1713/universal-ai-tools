/**
 * Sweet Athena State Manager
 *
 * Manages avatar personality modes, clothing customization, and state synchronization
 * between React frontend and UE5 backend
 */

import { EventEmitter } from 'events';
import { supabase } from './supabase_service';
import { logger } from '../utils/enhanced-logger';
import type { AvatarState, PixelStreamingBridge } from './pixel-streaming-bridge';

export type PersonalityMode = 'sweet' | 'shy' | 'confident' | 'caring' | 'playful';
export type ClothingLevel = 'conservative' | 'moderate' | 'revealing' | 'very_revealing';

export interface PersonalityConfig {
  mode: PersonalityMode;
  traits: {
    sweetness: number; // 0-1
    confidence: number; // 0-1
    playfulness: number; // 0-1
    caring: number; // 0-1
    shyness: number; // 0-1
  };
  voice: {
    pitch: number; // 0.5-2.0
    speed: number; // 0.5-2.0
    emotion: string;
  };
  animation: {
    idleStyle: string;
    gestureIntensity: number;
    expressionStrength: number;
  };
  conversationStyle: {
    responseLength: 'short' | 'medium' | 'long';
    formality: 'casual' | 'friendly' | 'professional';
    emotiveness: number; // 0-1
  };
}

export interface ClothingItem {
  id: string;
  category: 'top' | 'bottom' | 'dress' | 'accessory' | 'shoes';
  name: string;
  revealLevel: ClothingLevel;
  customizable: boolean;
  materials: string[];
  colors: string[];
  style: string;
  metadata: Record<string, unknown>;
}

export interface ClothingConfiguration {
  level: ClothingLevel;
  items: {
    top?: ClothingItem;
    bottom?: ClothingItem;
    dress?: ClothingItem;
    accessories: ClothingItem[];
    shoes?: ClothingItem;
  };
  customization: {
    colors: Record<string, string>;
    materials: Record<string, string>;
    fit: Record<string, number>;
    style: Record<string, unknown>;
  };
}

export interface UserPreferences {
  userId: string;
  favoritePersonality: PersonalityMode;
  preferredClothingLevel: ClothingLevel;
  customPersonalities: Record<string, Partial<PersonalityConfig>>;
  savedOutfits: Record<string, ClothingConfiguration>;
  interactionHistory: {
    personalityUsage: Record<PersonalityMode, number>;
    clothingPreferences: Record<ClothingLevel, number>;
    conversationPatterns: Record<string, unknown>;
  };
  settings: {
    autoPersonalityAdaptation: boolean;
    rememberClothingChoices: boolean;
    enableVoiceInteraction: boolean;
    adaptToContext: boolean;
  };
}

export interface SweetAthenaState {
  personality: PersonalityConfig;
  clothing: ClothingConfiguration;
  interaction: {
    mode: 'chat' | 'widget_assistance' | 'idle' | 'presentation';
    context: string;
    userEngagement: number;
    conversationTopic: string;
  };
  performance: {
    responseTime: number;
    qualityScore: number;
    userSatisfaction: number;
  };
  status: {
    connected: boolean;
    streaming: boolean;
    speaking: boolean;
    listening: boolean;
    processing: boolean;
  };
}

export class SweetAthenaStateManager extends EventEmitter {
  private currentState: SweetAthenaState;
  private userPreferences: UserPreferences | null = null;
  private pixelStreamingBridge: PixelStreamingBridge | null = null;
  private userId: string | null = null;
  private updateQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;

  // Predefined personality configurations
  private readonly personalityConfigs: Record<PersonalityMode, PersonalityConfig> = {
    sweet: {
      mode: 'sweet',
      traits: { sweetness: 0.9, confidence: 0.6, playfulness: 0.7, caring: 0.8, shyness: 0.3 },
      voice: { pitch: 1.1, speed: 1.0, emotion: 'caring' },
      animation: { idleStyle: 'gentle_sway', gestureIntensity: 0.6, expressionStrength: 0.8 },
      conversationStyle: { responseLength: 'medium', formality: 'friendly', emotiveness: 0.8 },
    },
    shy: {
      mode: 'shy',
      traits: { sweetness: 0.7, confidence: 0.3, playfulness: 0.4, caring: 0.8, shyness: 0.9 },
      voice: { pitch: 0.9, speed: 0.8, emotion: 'timid' },
      animation: { idleStyle: 'reserved_stance', gestureIntensity: 0.3, expressionStrength: 0.5 },
      conversationStyle: { responseLength: 'short', formality: 'friendly', emotiveness: 0.6 },
    },
    confident: {
      mode: 'confident',
      traits: { sweetness: 0.6, confidence: 0.9, playfulness: 0.7, caring: 0.6, shyness: 0.1 },
      voice: { pitch: 1.0, speed: 1.1, emotion: 'assertive' },
      animation: { idleStyle: 'upright_stance', gestureIntensity: 0.8, expressionStrength: 0.9 },
      conversationStyle: { responseLength: 'long', formality: 'professional', emotiveness: 0.7 },
    },
    caring: {
      mode: 'caring',
      traits: { sweetness: 0.8, confidence: 0.7, playfulness: 0.5, caring: 0.9, shyness: 0.2 },
      voice: { pitch: 1.05, speed: 0.95, emotion: 'empathetic' },
      animation: { idleStyle: 'attentive_lean', gestureIntensity: 0.7, expressionStrength: 0.8 },
      conversationStyle: { responseLength: 'medium', formality: 'friendly', emotiveness: 0.9 },
    },
    playful: {
      mode: 'playful',
      traits: { sweetness: 0.7, confidence: 0.8, playfulness: 0.9, caring: 0.6, shyness: 0.2 },
      voice: { pitch: 1.15, speed: 1.1, emotion: 'joyful' },
      animation: { idleStyle: 'bouncy_idle', gestureIntensity: 0.9, expressionStrength: 1.0 },
      conversationStyle: { responseLength: 'medium', formality: 'casual', emotiveness: 0.8 },
    },
  };

  // Default clothing configurations
  private readonly defaultClothingConfigs: Record<ClothingLevel, Partial<ClothingConfiguration>> = {
    conservative: {
      level: 'conservative',
      customization: { colors: {}, materials: {}, fit: {}, style: {} },
    },
    moderate: {
      level: 'moderate',
      customization: { colors: {}, materials: {}, fit: {}, style: {} },
    },
    revealing: {
      level: 'revealing',
      customization: { colors: {}, materials: {}, fit: {}, style: {} },
    },
    very_revealing: {
      level: 'very_revealing',
      customization: { colors: {}, materials: {}, fit: {}, style: {} },
    },
  };

  constructor() {
    super();

    this.currentState = {
      personality: this.personalityConfigs.sweet,
      clothing: {
        level: 'moderate',
        items: { accessories: [] },
        customization: { colors: {}, materials: {}, fit: {}, style: {} },
      },
      interaction: {
        mode: 'idle',
        context: '',
        userEngagement: 0.5,
        conversationTopic: '',
      },
      performance: {
        responseTime: 0,
        qualityScore: 0.8,
        userSatisfaction: 0.8,
      },
      status: {
        connected: false,
        streaming: false,
        speaking: false,
        listening: false,
        processing: false,
      },
    };

    this.setupEventHandlers();
  }

  /**
   * Initialize the state manager
   */
  async initialize(userId: string, pixelStreamingBridge?: PixelStreamingBridge): Promise<void> {
    try {
      this.userId = userId;
      this.pixelStreamingBridge = pixelStreamingBridge || null;

      // Load user preferences
      await this.loadUserPreferences();

      // Apply user's preferred settings
      if (this.userPreferences) {
        await this.setPersonality(this.userPreferences.favoritePersonality);
        await this.setClothingLevel(this.userPreferences.preferredClothingLevel);
      }

      // Setup bridge event handlers if available
      if (this.pixelStreamingBridge) {
        this.setupBridgeEventHandlers();
      }

      this.emit('initialized', this.currentState);
      logger.info('Sweet Athena State Manager initialized', undefined, { userId });
    } catch (error) {
      logger.error('Failed to initialize Sweet Athena State Manager:', undefined, error);
      throw error;
    }
  }

  /**
   * Set avatar personality mode
   */
  async setPersonality(mode: PersonalityMode): Promise<void> {
    try {
      const oldPersonality = this.currentState.personality.mode;
      this.currentState.personality = { ...this.personalityConfigs[mode] };

      // Apply custom modifications if user has them
      if (this.userPreferences?.customPersonalities[mode]) {
        this.currentState.personality = {
          ...this.currentState.personality,
          ...this.userPreferences.customPersonalities[mode],
        };
      }

      // Update bridge if connected
      if (this.pixelStreamingBridge) {
        await this.pixelStreamingBridge.setPersonality(mode);
      }

      // Update interaction context
      this.currentState.interaction.context = `personality_changed_from_${oldPersonality}_to_${mode}`;

      // Save preference
      await this.updateUserPreferences({ favoritePersonality: mode });

      // Track usage
      if (this.userPreferences) {
        this.userPreferences.interactionHistory.personalityUsage[mode] =
          (this.userPreferences.interactionHistory.personalityUsage[mode] || 0) + 1;
      }

      this.emit('personalityChanged', {
        from: oldPersonality,
        to: mode,
        config: this.currentState.personality,
      });
      this.emit('stateChanged', this.currentState);

      logger.info('Personality changed', undefined, {
        from: oldPersonality,
        to: mode,
        userId: this.userId,
      });
    } catch (error) {
      logger.error('Failed to set personality:', undefined, error);
      throw error;
    }
  }

  /**
   * Set clothing reveal level
   */
  async setClothingLevel(level: ClothingLevel): Promise<void> {
    try {
      const oldLevel = this.currentState.clothing.level;
      this.currentState.clothing.level = level;

      // Load appropriate clothing configuration
      await this.loadClothingConfiguration(level);

      // Update bridge if connected
      if (this.pixelStreamingBridge) {
        await this.pixelStreamingBridge.setClothing({ level });
      }

      // Save preference
      await this.updateUserPreferences({ preferredClothingLevel: level });

      // Track usage
      if (this.userPreferences) {
        this.userPreferences.interactionHistory.clothingPreferences[level] =
          (this.userPreferences.interactionHistory.clothingPreferences[level] || 0) + 1;
      }

      this.emit('clothingLevelChanged', { from: oldLevel, to: level });
      this.emit('stateChanged', this.currentState);

      logger.info('Clothing level changed', undefined, {
        from: oldLevel,
        to: level,
        userId: this.userId,
      });
    } catch (error) {
      logger.error('Failed to set clothing level:', undefined, error);
      throw error;
    }
  }

  /**
   * Customize specific clothing item
   */
  async customizeClothingItem(
    category: keyof ClothingConfiguration['items'],
    customization: Partial<ClothingItem>
  ): Promise<void> {
    try {
      if (category === 'accessories') {
        // Handle accessories array
        if (customization.id) {
          const accessoryIndex = this.currentState.clothing.items.accessories.findIndex(
            (item) => item.id === customization.id
          );
          if (accessoryIndex >= 0) {
            this.currentState.clothing.items.accessories[accessoryIndex] = {
              ...this.currentState.clothing.items.accessories[accessoryIndex],
              ...customization,
            } as ClothingItem;
          }
        }
      } else {
        // Handle single item categories
        const currentItem = this.currentState.clothing.items[category];
        if (currentItem) {
          this.currentState.clothing.items[category] = {
            ...currentItem,
            ...customization,
          } as ClothingItem;
        }
      }

      // Update bridge if connected
      if (this.pixelStreamingBridge) {
        await this.pixelStreamingBridge.setClothing({
          customization: this.currentState.clothing.customization,
        });
      }

      this.emit('clothingItemCustomized', { category, customization });
      this.emit('stateChanged', this.currentState);
    } catch (error) {
      logger.error('Failed to customize clothing item:', undefined, error);
      throw error;
    }
  }

  /**
   * Set interaction mode
   */
  async setInteractionMode(
    mode: SweetAthenaState['interaction']['mode'],
    context = ''
  ): Promise<void> {
    try {
      const oldMode = this.currentState.interaction.mode;
      this.currentState.interaction.mode = mode;
      this.currentState.interaction.context = context;

      // Adapt personality based on context if enabled
      if (this.userPreferences?.settings.adaptToContext) {
        await this.adaptPersonalityToContext(mode, context);
      }

      this.emit('interactionModeChanged', { from: oldMode, to: mode, context });
      this.emit('stateChanged', this.currentState);
    } catch (error) {
      logger.error('Failed to set interaction mode:', undefined, error);
      throw error;
    }
  }

  /**
   * Update user engagement level
   */
  updateUserEngagement(engagement: number): void {
    this.currentState.interaction.userEngagement = Math.max(0, Math.min(1, engagement));
    this.emit('engagementChanged', this.currentState.interaction.userEngagement);
  }

  /**
   * Get current state
   */
  getCurrentState(): SweetAthenaState {
    return { ...this.currentState };
  }

  /**
   * Get available personality modes
   */
  getAvailablePersonalities(): PersonalityMode[] {
    return Object.keys(this.personalityConfigs) as PersonalityMode[];
  }

  /**
   * Get available clothing levels
   */
  getAvailableClothingLevels(): ClothingLevel[] {
    return Object.keys(this.defaultClothingConfigs) as ClothingLevel[];
  }

  /**
   * Save current configuration as user preset
   */
  async savePreset(name: string): Promise<void> {
    if (!this.userPreferences) return;

    try {
      // Save personality preset
      this.userPreferences.customPersonalities[name] = {
        ...this.currentState.personality,
      };

      // Save clothing preset
      this.userPreferences.savedOutfits[name] = {
        ...this.currentState.clothing,
      };

      await this.saveUserPreferences();

      this.emit('presetSaved', {
        name,
        personality: this.currentState.personality,
        clothing: this.currentState.clothing,
      });
    } catch (error) {
      logger.error('Failed to save preset:', undefined, error);
      throw error;
    }
  }

  /**
   * Load user preset
   */
  async loadPreset(name: string): Promise<void> {
    if (!this.userPreferences) return;

    try {
      const personalityPreset = this.userPreferences.customPersonalities[name];
      const clothingPreset = this.userPreferences.savedOutfits[name];

      if (personalityPreset) {
        this.currentState.personality = { ...personalityPreset } as PersonalityConfig;
      }

      if (clothingPreset) {
        this.currentState.clothing = { ...clothingPreset };
      }

      // Update bridge
      if (this.pixelStreamingBridge) {
        await this.pixelStreamingBridge.setPersonality(this.currentState.personality.mode);
        await this.pixelStreamingBridge.setClothing(this.currentState.clothing);
      }

      this.emit('presetLoaded', { name });
      this.emit('stateChanged', this.currentState);
    } catch (error) {
      logger.error('Failed to load preset:', undefined, error);
      throw error;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle performance updates
    this.on('performanceUpdate', (metrics) => {
      this.currentState.performance = { ...this.currentState.performance, ...metrics };
    });

    // Handle status updates
    this.on('statusUpdate', (status) => {
      this.currentState.status = { ...this.currentState.status, ...status };
    });
  }

  /**
   * Setup bridge event handlers
   */
  private setupBridgeEventHandlers(): void {
    if (!this.pixelStreamingBridge) return;

    this.pixelStreamingBridge.on('connected', () => {
      this.currentState.status.connected = true;
      this.emit('statusUpdate', { connected: true });
    });

    this.pixelStreamingBridge.on('disconnected', () => {
      this.currentState.status.connected = false;
      this.currentState.status.streaming = false;
      this.emit('statusUpdate', { connected: false, streaming: false });
    });

    this.pixelStreamingBridge.on('streamingStarted', () => {
      this.currentState.status.streaming = true;
      this.emit('statusUpdate', { streaming: true });
    });

    this.pixelStreamingBridge.on('voiceResponse', (data) => {
      this.currentState.status.speaking = data.speaking;
      this.emit('statusUpdate', { speaking: data.speaking });
    });

    this.pixelStreamingBridge.on('qualityUpdate', (quality) => {
      this.currentState.performance.responseTime = quality.latency;
      this.emit('performanceUpdate', { responseTime: quality.latency });
    });
  }

  /**
   * Load user preferences from database
   */
  private async loadUserPreferences(): Promise<void> {
    if (!this.userId) return;

    try {
      const { data, error} = await supabase
        .from('sweet_athena_preferences')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (_error&& _errorcode !== 'PGRST116') {
        // Not found error
        throw error;
      }

      if (data) {
        this.userPreferences = data;
      } else {
        // Create default preferences
        this.userPreferences = {
          userId: this.userId,
          favoritePersonality: 'sweet',
          preferredClothingLevel: 'moderate',
          customPersonalities: {},
          savedOutfits: {},
          interactionHistory: {
            personalityUsage: {} as Record<PersonalityMode, number>,
            clothingPreferences: {} as Record<ClothingLevel, number>,
            conversationPatterns: {},
          },
          settings: {
            autoPersonalityAdaptation: true,
            rememberClothingChoices: true,
            enableVoiceInteraction: true,
            adaptToContext: true,
          },
        };

        await this.saveUserPreferences();
      }
    } catch (error) {
      logger.error('Failed to load user preferences:', undefined, error);
      // Continue with default preferences
      this.userPreferences = {
        userId: this.userId,
        favoritePersonality: 'sweet',
        preferredClothingLevel: 'moderate',
        customPersonalities: {},
        savedOutfits: {},
        interactionHistory: {
          personalityUsage: {} as Record<PersonalityMode, number>,
          clothingPreferences: {} as Record<ClothingLevel, number>,
          conversationPatterns: {},
        },
        settings: {
          autoPersonalityAdaptation: false,
          rememberClothingChoices: false,
          enableVoiceInteraction: true,
          adaptToContext: false,
        },
      };
    }
  }

  /**
   * Save user preferences to database
   */
  private async saveUserPreferences(): Promise<void> {
    if (!this.userPreferences || !this.userId) return;

    try {
      const { _error} = await supabase.from('sweet_athena_preferences').upsert({
        user_id: this.userId,
        ...this.userPreferences,
        updated_at: new Date().toISOString(),
      });

      if (_error {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to save user preferences:', undefined, error);
    }
  }

  /**
   * Update specific user preferences
   */
  private async updateUserPreferences(updates: Partial<UserPreferences>): Promise<void> {
    if (!this.userPreferences) return;

    this.userPreferences = { ...this.userPreferences, ...updates };
    await this.saveUserPreferences();
  }

  /**
   * Load clothing configuration for specific level
   */
  private async loadClothingConfiguration(level: ClothingLevel): Promise<void> {
    try {
      // Load from database or use defaults
      const defaultConfig = this.defaultClothingConfigs[level];
      this.currentState.clothing = {
        ...this.currentState.clothing,
        ...defaultConfig,
      } as ClothingConfiguration;

      // Apply saved outfit if available
      const savedOutfitKey = `default_${level}`;
      if (this.userPreferences?.savedOutfits[savedOutfitKey]) {
        this.currentState.clothing = {
          ...this.currentState.clothing,
          ...this.userPreferences.savedOutfits[savedOutfitKey],
        };
      }
    } catch (error) {
      logger.error('Failed to load clothing configuration:', undefined, error);
    }
  }

  /**
   * Adapt personality based on interaction context
   */
  private async adaptPersonalityToContext(
    mode: SweetAthenaState['interaction']['mode'],
    context: string
  ): Promise<void> {
    if (!this.userPreferences?.settings.adaptToContext) return;

    try {
      let suggestedPersonality: PersonalityMode | null = null;

      switch (mode) {
        case 'widget_assistance':
          suggestedPersonality = context.includes('complex') ? 'confident' : 'caring';
          break;
        case 'chat':
          suggestedPersonality = context.includes('casual') ? 'playful' : 'sweet';
          break;
        case 'presentation':
          suggestedPersonality = 'confident';
          break;
        default:
          return; // No adaptation for idle mode
      }

      if (suggestedPersonality && suggestedPersonality !== this.currentState.personality.mode) {
        await this.setPersonality(suggestedPersonality);
        this.emit('personalityAdapted', { context, suggestedPersonality });
      }
    } catch (error) {
      logger.error('Failed to adapt personality to context:', undefined, error);
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.removeAllListeners();
    this.pixelStreamingBridge = null;
    this.userPreferences = null;
    this.userId = null;
  }
}

export default SweetAthenaStateManager;
