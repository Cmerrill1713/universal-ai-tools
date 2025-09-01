/**
 * Emotion Detection Service
 * Analyzes voice patterns and text sentiment to detect emotional states
 */

import { logger } from '../utils/logger';

export type EmotionalState = 'neutral' | 'excited' | 'focused' | 'relaxed' | 'frustrated' | 'happy' | 'sad';

interface EmotionIndicators {
  // Voice indicators
  pitch: number;          // 0-1, higher = more excited/stressed
  pace: number;           // 0-1, faster = more excited/urgent
  volume: number;         // 0-1, louder = more intense
  variability: number;    // 0-1, more variation = more emotional
  
  // Text indicators
  sentiment: number;      // -1 to 1, negative to positive
  intensity: number;      // 0-1, strength of language
  keywords: string[];     // Emotion-indicating words
}

interface EmotionProfile {
  state: EmotionalState;
  confidence: number;
  indicators: EmotionIndicators;
  timestamp: number;
}

class EmotionDetectionService {
  private emotionHistory: EmotionProfile[] = [];
  private readonly historySize = 10;
  
  // Emotion keyword mappings
  private readonly emotionKeywords = {
    excited: ['excited', 'amazing', 'awesome', 'fantastic', 'great', 'wonderful', 'love', 'perfect'],
    frustrated: ['frustrated', 'annoying', 'broken', 'doesn\'t work', 'failed', 'error', 'problem', 'issue'],
    happy: ['happy', 'good', 'nice', 'pleased', 'glad', 'joy', 'delighted', 'satisfied'],
    sad: ['sad', 'disappointed', 'unfortunate', 'sorry', 'bad', 'terrible', 'awful'],
    focused: ['focus', 'concentrate', 'working', 'busy', 'task', 'project', 'deadline'],
    relaxed: ['relax', 'calm', 'easy', 'simple', 'no rush', 'whenever', 'chill']
  };

  /**
   * Analyze voice patterns to detect emotion
   */
  analyzeVoicePatterns(audioData: {
    pitch?: number;
    pace?: number;
    volume?: number;
    variability?: number;
  }): Partial<EmotionIndicators> {
    return {
      pitch: audioData.pitch || 0.5,
      pace: audioData.pace || 0.5,
      volume: audioData.volume || 0.5,
      variability: audioData.variability || 0.3
    };
  }

  /**
   * Analyze text sentiment and keywords
   */
  analyzeTextSentiment(text: string): Partial<EmotionIndicators> {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    // Find emotion keywords
    const detectedKeywords: string[] = [];
    let sentimentScore = 0;
    
    for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          detectedKeywords.push(keyword);
          
          // Adjust sentiment based on emotion type
          if (emotion === 'excited' || emotion === 'happy') {
            sentimentScore += 0.3;
          } else if (emotion === 'frustrated' || emotion === 'sad') {
            sentimentScore -= 0.3;
          }
        }
      }
    }
    
    // Calculate intensity based on punctuation and capitalization
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    
    const intensity = Math.min(1, 
      (exclamationCount * 0.2) + 
      (questionCount * 0.1) + 
      (capsRatio * 2)
    );
    
    return {
      sentiment: Math.max(-1, Math.min(1, sentimentScore)),
      intensity,
      keywords: detectedKeywords
    };
  }

  /**
   * Detect emotion from combined indicators
   */
  detectEmotion(
    text: string,
    voiceData?: {
      pitch?: number;
      pace?: number;
      volume?: number;
      variability?: number;
    }
  ): EmotionProfile {
    // Analyze both text and voice
    const textIndicators = this.analyzeTextSentiment(text);
    const voiceIndicators = voiceData ? this.analyzeVoicePatterns(voiceData) : {};
    
    // Combine indicators
    const indicators: EmotionIndicators = {
      pitch: voiceIndicators.pitch || 0.5,
      pace: voiceIndicators.pace || 0.5,
      volume: voiceIndicators.volume || 0.5,
      variability: voiceIndicators.variability || 0.3,
      sentiment: textIndicators.sentiment || 0,
      intensity: textIndicators.intensity || 0.5,
      keywords: textIndicators.keywords || []
    };
    
    // Determine emotional state based on indicators
    let state: EmotionalState = 'neutral';
    let confidence = 0.5;
    
    // High energy indicators
    if (indicators.pitch > 0.7 && indicators.pace > 0.7) {
      if (indicators.sentiment > 0.3) {
        state = 'excited';
        confidence = 0.8;
      } else if (indicators.sentiment < -0.3) {
        state = 'frustrated';
        confidence = 0.7;
      }
    }
    
    // Low energy indicators
    else if (indicators.pitch < 0.3 && indicators.pace < 0.3) {
      if (indicators.sentiment > 0.2) {
        state = 'relaxed';
        confidence = 0.7;
      } else if (indicators.sentiment < -0.2) {
        state = 'sad';
        confidence = 0.6;
      }
    }
    
    // Focused state (moderate energy, neutral sentiment)
    else if (Math.abs(indicators.sentiment) < 0.2 && 
             indicators.variability < 0.4) {
      state = 'focused';
      confidence = 0.6;
    }
    
    // Happy state (positive sentiment, moderate energy)
    else if (indicators.sentiment > 0.4) {
      state = 'happy';
      confidence = 0.7;
    }
    
    // Adjust confidence based on keyword matches
    if (indicators.keywords.length > 0) {
      confidence = Math.min(0.95, confidence + (indicators.keywords.length * 0.1));
    }
    
    const profile: EmotionProfile = {
      state,
      confidence,
      indicators,
      timestamp: Date.now()
    };
    
    // Update history
    this.emotionHistory.push(profile);
    if (this.emotionHistory.length > this.historySize) {
      this.emotionHistory.shift();
    }
    
    logger.info('📊 Emotion detected', {
      state,
      confidence,
      sentiment: indicators.sentiment,
      keywords: indicators.keywords,
      context: 'emotion'
    });
    
    return profile;
  }

  /**
   * Get emotion trend over time
   */
  getEmotionTrend(): {
    current: EmotionalState;
    trend: 'improving' | 'declining' | 'stable';
    history: EmotionProfile[];
  } {
    if (this.emotionHistory.length === 0) {
      return {
        current: 'neutral',
        trend: 'stable',
        history: []
      };
    }
    
    const current = this.emotionHistory[this.emotionHistory.length - 1];
    
    // Analyze trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (this.emotionHistory.length >= 3) {
      const recentSentiments = this.emotionHistory
        .slice(-3)
        .map(p => p.indicators.sentiment);
      
      const avgChange = (recentSentiments[2] || 0) - (recentSentiments[0] || 0);
      if (avgChange > 0.3) {
        trend = 'improving';
      } else if (avgChange < -0.3) {
        trend = 'declining';
      }
    }
    
    return {
      current: (current?.state as EmotionalState) || 'neutral',
      trend,
      history: this.emotionHistory
    };
  }

  /**
   * Get mood adaptation suggestions
   */
  getMoodAdaptation(state: EmotionalState): {
    visualTheme: string;
    responseStyle: string;
    suggestions: string[];
  } {
    const adaptations = {
      excited: {
        visualTheme: 'energetic',
        responseStyle: 'enthusiastic',
        suggestions: [
          'Match their energy level',
          'Provide quick, action-oriented responses',
          'Use dynamic visual feedback'
        ]
      },
      frustrated: {
        visualTheme: 'calm',
        responseStyle: 'patient',
        suggestions: [
          'Acknowledge the frustration',
          'Provide clear, step-by-step help',
          'Use soothing visual elements'
        ]
      },
      happy: {
        visualTheme: 'creative',
        responseStyle: 'cheerful',
        suggestions: [
          'Maintain positive tone',
          'Add friendly interactions',
          'Use bright, playful visuals'
        ]
      },
      sad: {
        visualTheme: 'minimal',
        responseStyle: 'empathetic',
        suggestions: [
          'Show understanding',
          'Provide gentle support',
          'Use soft, muted visuals'
        ]
      },
      focused: {
        visualTheme: 'professional',
        responseStyle: 'efficient',
        suggestions: [
          'Be concise and direct',
          'Minimize distractions',
          'Use clean, organized visuals'
        ]
      },
      relaxed: {
        visualTheme: 'calm',
        responseStyle: 'casual',
        suggestions: [
          'Take a conversational tone',
          'Allow for exploration',
          'Use smooth, flowing visuals'
        ]
      },
      neutral: {
        visualTheme: 'professional',
        responseStyle: 'balanced',
        suggestions: [
          'Maintain professional tone',
          'Be responsive to changes',
          'Use standard visual feedback'
        ]
      }
    };
    
    return adaptations[state];
  }

  /**
   * Clear emotion history
   */
  clearHistory(): void {
    this.emotionHistory = [];
    logger.info('📊 Emotion history cleared', { context: 'emotion' });
  }
}

// Export singleton instance
export const emotionDetectionService = new EmotionDetectionService();