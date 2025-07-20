/**
 * Sweet Athena Mood System
 * 
 * Simple mood management system for Sweet Athena demo.
 * 
 * @fileoverview Simple mood management system
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

import React from 'react';
import { PersonalityMood } from '../types';

export interface MoodSystemProps {
  currentMood: PersonalityMood;
  onMoodChange: (mood: PersonalityMood) => void;
  enableAnimation?: boolean;
}

/**
 * Simple MoodSystem component for the demo
 */
export const MoodSystem: React.FC<MoodSystemProps> = ({
  currentMood,
  onMoodChange,
  // enableAnimation = true
}) => {
  const moods: PersonalityMood[] = ['sweet', 'shy', 'confident', 'caring', 'playful'];
  
  const getMoodIcon = (mood: PersonalityMood) => {
    const icons = {
      sweet: '🌸',
      shy: '😊',
      confident: '⭐',
      caring: '💕',
      playful: '🎭'
    };
    return icons[mood];
  };

  const getMoodColor = (mood: PersonalityMood) => {
    const colors = {
      sweet: '#fbb6ce',
      shy: '#f9a8d4',
      confident: '#60a5fa',
      caring: '#34d399',
      playful: '#a78bfa'
    };
    return colors[mood];
  };

  return (
    <div className="mood-system">
      <div className="mood-selector">
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666' }}>
          Personality Mood
        </h3>
        <div className="mood-buttons">
          {moods.map((mood) => (
            <button
              key={mood}
              onClick={() => onMoodChange(mood)}
              className={`mood-button ${currentMood === mood ? 'active' : ''}`}
              style={{
                padding: '8px 12px',
                margin: '4px',
                border: `2px solid ${getMoodColor(mood)}`,
                borderRadius: '20px',
                background: currentMood === mood ? getMoodColor(mood) : 'transparent',
                color: currentMood === mood ? 'white' : getMoodColor(mood),
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                textTransform: 'capitalize',
                transition: 'all 0.3s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                if (currentMood !== mood) {
                  e.currentTarget.style.background = `${getMoodColor(mood)}20`;
                }
              }}
              onMouseLeave={(e) => {
                if (currentMood !== mood) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span>{getMoodIcon(mood)}</span>
              {mood}
            </button>
          ))}
        </div>
      </div>
      
      <style>{`
        .mood-system {
          background: rgba(255, 255, 255, 0.05);
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 16px;
        }
        
        .mood-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        
        .mood-button:hover {
          transform: scale(1.05);
        }
        
        .mood-button.active {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

// Simple exports for compatibility
export const EmotionalEngine = MoodSystem;
export default MoodSystem;