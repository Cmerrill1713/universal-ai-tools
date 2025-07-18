/**
 * Sweet Athena Avatar Component
 * 
 * Simple avatar display for Sweet Athena demo.
 * 
 * @fileoverview Simple avatar component
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

import React from 'react';
import { PersonalityMood } from '../types';

export interface SweetAthenaAvatarProps {
  mood: PersonalityMood;
  enableAnimation?: boolean;
  enableVoice?: boolean;
  onError?: (error: string) => void;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Simple SweetAthenaAvatar component for the demo
 */
export const SweetAthenaAvatar: React.FC<SweetAthenaAvatarProps> = ({
  mood,
  enableAnimation = true,
  enableVoice = false,
  onError,
  size = 'medium'
}) => {
  const getAvatarEmoji = (mood: PersonalityMood) => {
    const avatars = {
      sweet: '👸',
      shy: '🥺',
      confident: '💪',
      caring: '🤗',
      playful: '🎭'
    };
    return avatars[mood];
  };

  const getAvatarSize = () => {
    const sizes = {
      small: '40px',
      medium: '80px',
      large: '120px'
    };
    return sizes[size];
  };

  const getMoodGradient = (mood: PersonalityMood) => {
    const gradients = {
      sweet: 'linear-gradient(135deg, #fbb6ce 0%, #f8a2c2 100%)',
      shy: 'linear-gradient(135deg, #f9a8d4 0%, #ec7cc3 100%)',
      confident: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
      caring: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
      playful: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)'
    };
    return gradients[mood];
  };

  return (
    <div className="sweet-athena-avatar">
      <div 
        className={`avatar-container ${enableAnimation ? 'animated' : ''}`}
        style={{
          width: getAvatarSize(),
          height: getAvatarSize(),
          borderRadius: '50%',
          background: getMoodGradient(mood),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `calc(${getAvatarSize()} * 0.6)`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease',
          margin: '0 auto 16px auto'
        }}
      >
        {getAvatarEmoji(mood)}
      </div>
      
      <div className="avatar-status" style={{
        textAlign: 'center',
        fontSize: '12px',
        color: '#666',
        textTransform: 'capitalize'
      }}>
        Sweet Athena • {mood} mode
        {enableVoice && ' • 🎤'}
      </div>
      
      <style>{`
        .sweet-athena-avatar {
          text-align: center;
          padding: 16px;
        }
        
        .avatar-container.animated {
          animation: gentle-pulse 3s ease-in-out infinite;
        }
        
        .avatar-container:hover {
          transform: scale(1.05);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
        }
        
        @keyframes gentle-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }
      `}</style>
    </div>
  );
};

export default SweetAthenaAvatar;