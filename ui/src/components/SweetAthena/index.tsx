/**
 * Sweet Athena - Main Module Export (Simple)
 * 
 * Simplified export for Sweet Athena demo
 */

// Core Types and Interfaces
export * from './types';

// Avatar Components
export { SweetAthenaAvatar } from './Avatar/SweetAthenaAvatar';
export { ReadyPlayerMeAthena as ReadyPlayerMeAvatar } from './Avatar/ReadyPlayerMeAvatar';

// Chat Components
export { SweetAthenaChat } from './Chat/SweetAthenaChat';
export { SimpleChatComponent as MessageComponent } from './Chat/SimpleChatComponent';

// Personality System
export { EmotionalEngine } from './Personality/EmotionalEngine';
export { MoodSystem } from './Personality/MoodSystem';

// Styling and Themes
export { AthenaTheme, athenaTheme } from './Styling/AthenaTheme';

// Main Sweet Athena Component
import React, { useState, useCallback } from 'react';
import { SweetAthenaChat } from './Chat/SweetAthenaChat';
import { SweetAthenaAvatar } from './Avatar/SweetAthenaAvatar';
import { MoodSystem } from './Personality/MoodSystem';
import { athenaTheme } from './Styling/AthenaTheme';
import type { PersonalityMood, SweetAthenaProps } from './types';

/**
 * Main Sweet Athena Component (Simple)
 */
export const SweetAthena: React.FC<SweetAthenaProps> = ({
  initialMood = 'sweet',
  enableAvatar = true,
  enableVoice = false,
  enableAnimation = true,
  theme = athenaTheme,
  onMoodChange,
  onMessage,
  onError,
  className,
  ...props
}) => {
  const [currentMood, setCurrentMood] = useState<PersonalityMood>(initialMood);
  const [error, setError] = useState<string | null>(null);

  // Handle mood changes
  const handleMoodChange = useCallback((newMood: PersonalityMood) => {
    setCurrentMood(newMood);
    onMoodChange?.(newMood);
  }, [onMoodChange]);

  // Handle message events
  const handleMessage = useCallback((message: any) => {
    try {
      onMessage?.(message);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onMessage, onError]);

  return (
    <div 
      className={`sweet-athena-container ${className || ''}`}
      data-mood={currentMood}
      {...props}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        minHeight: '500px'
      }}
    >
      {/* Mood System */}
      <MoodSystem
        currentMood={currentMood}
        onMoodChange={handleMoodChange}
        enableAnimation={enableAnimation}
      />

      {/* Avatar */}
      {enableAvatar && (
        <SweetAthenaAvatar
          mood={currentMood}
          enableAnimation={enableAnimation}
          enableVoice={enableVoice}
          onError={setError}
        />
      )}

      {/* Chat Interface */}
      <SweetAthenaChat
        mood={currentMood}
        isLoading={false}
        onMessage={handleMessage}
        onError={setError}
        enableVoice={enableVoice}
      />

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          color: '#fca5a5'
        }}>
          <p style={{ margin: 0 }}>✨ Oops! Something went wrong: {error}</p>
          <button 
            onClick={() => setError(null)}
            style={{
              background: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(220, 38, 38, 0.4)',
              borderRadius: '4px',
              color: '#fca5a5',
              padding: '4px 8px',
              marginTop: '8px',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

// Default export
export default SweetAthena;