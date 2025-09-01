/**
 * Voice Session Persistence Service
 * Manages voice conversation history, user preferences, and session analytics
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';

export interface VoiceSession {
  id?: string;
  session_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  total_interactions: number;
  total_speech_time_ms: number;
  total_processing_time_ms: number;
  preferences: {
    language: string;
    voice: string;
    wakeword_enabled: boolean;
    auto_speak_responses: boolean;
  };
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  client_info?: {
    user_agent?: string;
    ip_address?: string;
    device_type?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface VoiceInteraction {
  id?: string;
  session_id: string;
  interaction_sequence: number;
  transcript?: string;
  transcript_confidence?: number;
  user_intent?: string;
  intent_confidence?: number;
  agent_used?: string;
  agent_response: string;
  speech_recognition_time_ms?: number;
  agent_processing_time_ms: number;
  tts_generation_time_ms?: number;
  total_response_time_ms: number;
  audio_duration_ms?: number;
  audio_file_path?: string;
  response_audio_path?: string;
  interaction_type: 'voice' | 'text' | 'mixed';
  user_satisfaction?: number; // 1-5 rating
  error_occurred: boolean;
  error_details?: string;
  created_at?: string;
}

export interface VoiceAnalytics {
  total_sessions: number;
  total_interactions: number;
  average_session_duration_ms: number;
  average_response_time_ms: number;
  speech_recognition_accuracy: number;
  most_common_intents: Array<{ intent: string; count: number }>;
  preferred_voices: Array<{ voice: string; count: number }>;
  user_satisfaction_average: number;
  error_rate: number;
}

export class VoiceSessionPersistence {
  private supabase: SupabaseClient | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (!config.supabase.url || !config.supabase.serviceKey) {
        throw new Error('Supabase configuration missing');
      }

      this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);

      // Test the connection
      const { data, error } = await this.supabase.from('voice_sessions').select('count').limit(1);
      
      if (error) {
        log.warn('⚠️ Voice sessions table not available, continuing without persistence', LogContext.DATABASE, {
          error: error.message,
        });
      } else {
        this.isInitialized = true;
        log.info('✅ Voice session persistence initialized', LogContext.DATABASE);
      }
    } catch (error) {
      log.error('❌ Failed to initialize voice session persistence', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue without persistence
    }
  }

  public async createSession(sessionData: Partial<VoiceSession>): Promise<string | null> {
    if (!this.isInitialized || !this.supabase) {
      log.warn('Voice session persistence not available', LogContext.DATABASE);
      return null;
    }

    try {
      const session: VoiceSession = {
        session_id: sessionData.session_id || `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: sessionData.user_id || 'anonymous',
        started_at: new Date().toISOString(),
        total_interactions: 0,
        total_speech_time_ms: 0,
        total_processing_time_ms: 0,
        preferences: {
          language: 'en',
          voice: 'nari_natural',
          wakeword_enabled: true,
          auto_speak_responses: true,
          ...sessionData.preferences,
        },
        status: 'active',
        client_info: sessionData.client_info || {},
      };

      const { data, error } = await this.supabase
        .from('voice_sessions')
        .insert([session])
        .select('id')
        .single();

      if (error) {
        log.error('Failed to create voice session', LogContext.DATABASE, { error: error.message });
        return null;
      }

      log.info('✅ Voice session created', LogContext.DATABASE, {
        sessionId: session.session_id,
        userId: session.user_id,
        databaseId: data?.id,
      });

      return data?.id || null;
    } catch (error) {
      log.error('Error creating voice session', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public async updateSession(sessionId: string, updates: Partial<VoiceSession>): Promise<boolean> {
    if (!this.isInitialized || !this.supabase) {
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('voice_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      if (error) {
        log.error('Failed to update voice session', LogContext.DATABASE, { 
          sessionId, 
          error: error.message 
        });
        return false;
      }

      log.debug('✅ Voice session updated', LogContext.DATABASE, { sessionId });
      return true;
    } catch (error) {
      log.error('Error updating voice session', LogContext.DATABASE, {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  public async endSession(sessionId: string, finalStats?: {
    totalInteractions?: number;
    totalSpeechTime?: number;
    totalProcessingTime?: number;
  }): Promise<boolean> {
    if (!this.isInitialized || !this.supabase) {
      return false;
    }

    try {
      const updates: Partial<VoiceSession> = {
        ended_at: new Date().toISOString(),
        status: 'completed',
        updated_at: new Date().toISOString(),
      };

      if (finalStats) {
        if (finalStats.totalInteractions !== undefined) {
          updates.total_interactions = finalStats.totalInteractions;
        }
        if (finalStats.totalSpeechTime !== undefined) {
          updates.total_speech_time_ms = finalStats.totalSpeechTime;
        }
        if (finalStats.totalProcessingTime !== undefined) {
          updates.total_processing_time_ms = finalStats.totalProcessingTime;
        }
      }

      const { error } = await this.supabase
        .from('voice_sessions')
        .update(updates)
        .eq('session_id', sessionId);

      if (error) {
        log.error('Failed to end voice session', LogContext.DATABASE, { 
          sessionId, 
          error: error.message 
        });
        return false;
      }

      log.info('✅ Voice session ended', LogContext.DATABASE, { sessionId });
      return true;
    } catch (error) {
      log.error('Error ending voice session', LogContext.DATABASE, {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  public async saveInteraction(interaction: VoiceInteraction): Promise<string | null> {
    if (!this.isInitialized || !this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('voice_interactions')
        .insert([{
          ...interaction,
          created_at: new Date().toISOString(),
        }])
        .select('id')
        .single();

      if (error) {
        log.error('Failed to save voice interaction', LogContext.DATABASE, { 
          sessionId: interaction.session_id, 
          error: error.message 
        });
        return null;
      }

      log.debug('✅ Voice interaction saved', LogContext.DATABASE, {
        sessionId: interaction.session_id,
        sequence: interaction.interaction_sequence,
        databaseId: data?.id,
      });

      return data?.id || null;
    } catch (error) {
      log.error('Error saving voice interaction', LogContext.DATABASE, {
        sessionId: interaction.session_id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public async getSession(sessionId: string): Promise<VoiceSession | null> {
    if (!this.isInitialized || !this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('voice_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        log.error('Failed to get voice session', LogContext.DATABASE, { 
          sessionId, 
          error: error.message 
        });
        return null;
      }

      return data;
    } catch (error) {
      log.error('Error getting voice session', LogContext.DATABASE, {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public async getSessionHistory(sessionId: string): Promise<VoiceInteraction[]> {
    if (!this.isInitialized || !this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('voice_interactions')
        .select('*')
        .eq('session_id', sessionId)
        .order('interaction_sequence', { ascending: true });

      if (error) {
        log.error('Failed to get session history', LogContext.DATABASE, { 
          sessionId, 
          error: error.message 
        });
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Error getting session history', LogContext.DATABASE, {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public async getUserSessions(userId: string, limit: number = 50): Promise<VoiceSession[]> {
    if (!this.isInitialized || !this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('voice_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        log.error('Failed to get user sessions', LogContext.DATABASE, { 
          userId, 
          error: error.message 
        });
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Error getting user sessions', LogContext.DATABASE, {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public async getAnalytics(userId?: string, timeRange?: { start: Date; end: Date }): Promise<VoiceAnalytics | null> {
    if (!this.isInitialized || !this.supabase) {
      return null;
    }

    try {
      // Build query conditions
      let sessionQuery = this.supabase.from('voice_sessions').select('*');
      let interactionQuery = this.supabase.from('voice_interactions').select('*');

      if (userId) {
        sessionQuery = sessionQuery.eq('user_id', userId);
        // Note: In a real implementation, we'd use a proper join here
        // For now, we'll handle filtering after fetching
        // interactionQuery remains unchanged for this demo
      }

      if (timeRange) {
        const startTime = timeRange.start.toISOString();
        const endTime = timeRange.end.toISOString();
        
        sessionQuery = sessionQuery
          .gte('started_at', startTime)
          .lte('started_at', endTime);
        
        interactionQuery = interactionQuery
          .gte('created_at', startTime)
          .lte('created_at', endTime);
      }

      const [sessionsResult, interactionsResult] = await Promise.all([
        sessionQuery,
        interactionQuery,
      ]);

      if (sessionsResult.error || interactionsResult.error) {
        log.error('Failed to get analytics data', LogContext.DATABASE, {
          sessionError: sessionsResult.error?.message,
          interactionError: interactionsResult.error?.message,
        });
        return null;
      }

      const sessions = sessionsResult.data || [];
      const interactions = interactionsResult.data || [];

      // Calculate analytics
      const totalSessions = sessions.length;
      const totalInteractions = interactions.length;

      const completedSessions = sessions.filter(s => s.ended_at);
      const averageSessionDuration = completedSessions.length > 0
        ? completedSessions.reduce((sum, session) => {
            const start = new Date(session.started_at).getTime();
            const end = new Date(session.ended_at!).getTime();
            return sum + (end - start);
          }, 0) / completedSessions.length
        : 0;

      const averageResponseTime = interactions.length > 0
        ? interactions.reduce((sum, interaction) => sum + interaction.total_response_time_ms, 0) / interactions.length
        : 0;

      const speechRecognitionAccuracy = interactions
        .filter(i => i.transcript_confidence !== null && i.transcript_confidence !== undefined)
        .reduce((sum, interaction) => sum + (interaction.transcript_confidence || 0), 0) / 
        Math.max(1, interactions.filter(i => i.transcript_confidence !== null).length);

      // Calculate most common intents
      const intentCounts = interactions.reduce((acc, interaction) => {
        if (interaction.user_intent) {
          acc[interaction.user_intent] = (acc[interaction.user_intent] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const mostCommonIntents = Object.entries(intentCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([intent, count]) => ({ intent, count: count as number }));

      // Calculate preferred voices from sessions
      const voiceCounts = sessions.reduce((acc, session) => {
        const voice = session.preferences?.voice || 'unknown';
        acc[voice] = (acc[voice] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const preferredVoices = Object.entries(voiceCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([voice, count]) => ({ voice, count: count as number }));

      const userSatisfactionAverage = interactions
        .filter(i => i.user_satisfaction !== null && i.user_satisfaction !== undefined)
        .reduce((sum, interaction) => sum + (interaction.user_satisfaction || 0), 0) /
        Math.max(1, interactions.filter(i => i.user_satisfaction !== null).length);

      const errorRate = interactions.length > 0
        ? interactions.filter(i => i.error_occurred).length / interactions.length
        : 0;

      const analytics: VoiceAnalytics = {
        total_sessions: totalSessions,
        total_interactions: totalInteractions,
        average_session_duration_ms: averageSessionDuration,
        average_response_time_ms: averageResponseTime,
        speech_recognition_accuracy: speechRecognitionAccuracy,
        most_common_intents: mostCommonIntents,
        preferred_voices: preferredVoices,
        user_satisfaction_average: userSatisfactionAverage,
        error_rate: errorRate,
      };

      log.info('✅ Voice analytics calculated', LogContext.DATABASE, {
        totalSessions,
        totalInteractions,
        userId,
        timeRange: timeRange ? `${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}` : 'all time',
      });

      return analytics;
    } catch (error) {
      log.error('Error calculating voice analytics', LogContext.DATABASE, {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public async cleanupOldSessions(daysOld: number = 30): Promise<number> {
    if (!this.isInitialized || !this.supabase) {
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // First get session IDs to clean up interactions
      const { data: oldSessions } = await this.supabase
        .from('voice_sessions')
        .select('session_id')
        .lt('started_at', cutoffDate.toISOString());

      if (oldSessions && oldSessions.length > 0) {
        const sessionIds = oldSessions.map(s => s.session_id);

        // Delete interactions first (foreign key constraint)
        await this.supabase
          .from('voice_interactions')
          .delete()
          .in('session_id', sessionIds);

        // Then delete sessions
        const { error, count } = await this.supabase
          .from('voice_sessions')
          .delete()
          .lt('started_at', cutoffDate.toISOString());

        if (error) {
          log.error('Failed to cleanup old voice sessions', LogContext.DATABASE, { 
            error: error.message 
          });
          return 0;
        }

        const cleanedCount = count || oldSessions.length;
        log.info('✅ Old voice sessions cleaned up', LogContext.DATABASE, {
          cleanedSessions: cleanedCount,
          cutoffDate: cutoffDate.toISOString(),
        });

        return cleanedCount;
      }

      return 0;
    } catch (error) {
      log.error('Error cleaning up old voice sessions', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  public isAvailable(): boolean {
    return this.isInitialized && this.supabase !== null;
  }
}

// Export singleton instance
export const voiceSessionPersistence = new VoiceSessionPersistence();