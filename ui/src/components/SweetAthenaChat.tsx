/**
 * Sweet Athena Chat Component
 * 
 * Integrates assistant-ui with Sweet Athena's personality and custom styling
 * Provides professional conversation management with unique goddess aesthetic
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { Thread } from '@assistant-ui/react';
import { createAthenaTheme, type PersonalityMood, type AthenaTheme, athenaCSS } from '../styles/athena-theme';
import '../styles/sweet-athena.css';

interface SweetAthenaChatProps {
  personalityMood?: PersonalityMood;
  sweetnessLevel?: number;
  onPersonalityChange?: (mood: PersonalityMood) => void;
  onMessage?: (message: string, response: string) => void;
  className?: string;
}

// Styled Components using our custom theme
const ChatContainer = styled.div<{ theme: AthenaTheme }>`
  ${props => athenaCSS.container(props.theme)}
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: ${props => props.theme.fonts.modern};
`;

const ChatHeader = styled.div<{ theme: AthenaTheme }>`
  padding: 16px 20px;
  background: linear-gradient(135deg, 
    ${props => props.theme.personality.colors.primary}40 0%,
    ${props => props.theme.personality.colors.secondary}40 100%);
  border-bottom: 1px solid ${props => props.theme.personality.colors.primary}30;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const AthenaTitle = styled.h2<{ theme: AthenaTheme }>`
  margin: 0;
  font-family: ${props => props.theme.fonts.elegant};
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.personality.colors.primary};
  text-shadow: 0 0 10px ${props => props.theme.personality.colors.primary}40;
  
  &::before {
    content: '✨ ';
    margin-right: 8px;
  }
  
  &::after {
    content: ' ✨';
    margin-left: 8px;
  }
`;

const PersonalityIndicator = styled.div<{ theme: AthenaTheme; mood: PersonalityMood }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: ${props => props.theme.personality.colors.soft}80;
  border-radius: 20px;
  border: 1px solid ${props => props.theme.personality.colors.primary}30;
  transition: ${props => props.theme.personality.animations.transitionFast};
  
  &:hover {
    transform: scale(1.05);
    box-shadow: ${props => props.theme.personality.effects.glowSoft};
  }
`;

const MoodIcon = styled.span<{ mood: PersonalityMood }>`
  font-size: 1.2rem;
  
  &::before {
    content: ${props => {
      const icons = {
        sweet: "'🌸'",
        shy: "'😊'", 
        confident: "'⭐'",
        caring: "'💕'",
        playful: "'🎭'"
      };
      return icons[props.mood];
    }};
  }
`;

const MoodText = styled.span<{ theme: AthenaTheme }>`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.theme.personality.colors.primary};
  text-transform: capitalize;
`;

const ThreadContainer = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;
`;

// Custom assistant-ui components with Athena styling
const CustomMessage = styled.div<{ theme: AthenaTheme; isAssistant: boolean }>`
  ${props => athenaCSS.message(props.theme, props.isAssistant)}
  font-family: ${props => props.theme.fonts.modern};
  line-height: 1.5;
  
  ${props => props.isAssistant && `
    position: relative;
    
    &::before {
      content: '🌟';
      position: absolute;
      left: -24px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.875rem;
      opacity: 0.7;
    }
  `}
`;

const TypingIndicator = styled.div<{ theme: AthenaTheme }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin: 8px 0;
  margin-right: 20%;
  background: ${props => props.theme.personality.colors.primary}20;
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  
  &::before {
    content: '💭 ';
    margin-right: 8px;
    font-size: 1rem;
  }
`;

const TypingDot = styled.div<{ theme: AthenaTheme; delay: number }>`
  width: 8px;
  height: 8px;
  background: ${props => props.theme.personality.colors.primary};
  border-radius: 50%;
  margin: 0 2px;
  animation: athena-typing-indicator 1.4s ease-in-out infinite;
  animation-delay: ${props => props.delay}s;
`;

// Sweet Athena Chat Component
export const SweetAthenaChat: React.FC<SweetAthenaChatProps> = ({
  personalityMood = 'sweet',
  sweetnessLevel = 8,
  onPersonalityChange,
  onMessage,
  className
}) => {
  const [currentMood, setCurrentMood] = useState<PersonalityMood>(personalityMood);
  const [isTyping, setIsTyping] = useState(false);
  const [theme, setTheme] = useState<AthenaTheme>(createAthenaTheme(personalityMood, sweetnessLevel));

  // Update theme when personality changes
  useEffect(() => {
    setTheme(createAthenaTheme(currentMood, sweetnessLevel));
  }, [currentMood, sweetnessLevel]);

  // Handle personality changes with smooth transitions
  const handleMoodChange = useCallback((newMood: PersonalityMood) => {
    setCurrentMood(newMood);
    onPersonalityChange?.(newMood);
  }, [onPersonalityChange]);

  // Custom message renderer for assistant-ui
  const renderMessage = useCallback((message: any) => {
    const isAssistant = message.role === 'assistant';
    
    return (
      <CustomMessage 
        theme={theme} 
        isAssistant={isAssistant}
        key={message.id}
      >
        {message.content}
      </CustomMessage>
    );
  }, [theme]);

  // Handle typing states
  const handleTypingStart = useCallback(() => {
    setIsTyping(true);
  }, []);

  const handleTypingEnd = useCallback(() => {
    setIsTyping(false);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <ChatContainer className={`sweet-athena-container athena-mood-${currentMood} ${className}`}>
        {/* Header with personality indicator */}
        <ChatHeader>
          <AthenaTitle>Sweet Athena</AthenaTitle>
          <PersonalityIndicator mood={currentMood}>
            <MoodIcon mood={currentMood} />
            <MoodText>{currentMood}</MoodText>
          </PersonalityIndicator>
        </ChatHeader>

        {/* Main chat thread using assistant-ui */}
        <ThreadContainer>
          <Thread
            // Custom styling integration
            components={{
              Message: renderMessage,
              // We can override other components as needed
            }}
            // Handle events
            onMessageSent={onMessage}
            onTypingStart={handleTypingStart}
            onTypingEnd={handleTypingEnd}
          />

          {/* Sweet typing indicator */}
          {isTyping && (
            <TypingIndicator>
              <span style={{ marginRight: '8px', fontSize: '0.875rem', opacity: 0.8 }}>
                Athena is thinking sweetly...
              </span>
              <TypingDot delay={0} />
              <TypingDot delay={0.2} />
              <TypingDot delay={0.4} />
            </TypingIndicator>
          )}
        </ThreadContainer>
      </ChatContainer>
    </ThemeProvider>
  );
};

// Higher-order component for easy mood switching
export const withPersonalityMood = (
  WrappedComponent: React.ComponentType<any>
) => {
  return React.forwardRef<any, any>((props, ref) => {
    const [mood, setMood] = useState<PersonalityMood>('sweet');
    
    return (
      <WrappedComponent
        {...props}
        ref={ref}
        personalityMood={mood}
        onPersonalityChange={setMood}
      />
    );
  });
};

// Mood selector component
const MoodSelector = styled.div<{ theme: AthenaTheme }>`
  display: flex;
  gap: 8px;
  padding: 8px;
  background: ${props => props.theme.personality.colors.soft}20;
  border-radius: 12px;
  margin: 8px 0;
`;

const MoodButton = styled.button<{ theme: AthenaTheme; active: boolean; mood: PersonalityMood }>`
  ${props => athenaCSS.button(props.theme, props.active ? 'primary' : 'ghost')}
  font-size: 0.875rem;
  padding: 6px 12px;
  border-radius: 16px;
  
  &::before {
    content: ${props => {
      const icons = {
        sweet: "'🌸 '",
        shy: "'😊 '", 
        confident: "'⭐ '",
        caring: "'💕 '",
        playful: "'🎭 '"
      };
      return icons[props.mood];
    }};
  }
`;

export const AthenaMoodSelector: React.FC<{
  currentMood: PersonalityMood;
  onMoodChange: (mood: PersonalityMood) => void;
  className?: string;
}> = ({ currentMood, onMoodChange, className }) => {
  const theme = createAthenaTheme(currentMood);
  const moods: PersonalityMood[] = ['sweet', 'shy', 'confident', 'caring', 'playful'];

  return (
    <ThemeProvider theme={theme}>
      <MoodSelector className={className}>
        {moods.map(mood => (
          <MoodButton
            key={mood}
            mood={mood}
            active={mood === currentMood}
            onClick={() => onMoodChange(mood)}
          >
            {mood}
          </MoodButton>
        ))}
      </MoodSelector>
    </ThemeProvider>
  );
};

export default SweetAthenaChat;