/**
 * Enhanced Sweet Athena with Professional Animation Libraries
 * 
 * Combines assistant-ui, Framer Motion, React Spring, and Lottie
 * for a goddess-like AI assistant experience
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useSpring, animated, config } from 'react-spring';
import Lottie from 'lottie-react';
import styled, { ThemeProvider } from 'styled-components';
import { Thread } from '@assistant-ui/react';
import { SweetAthenaAvatar } from './AIAssistantAvatar/SweetAthenaAvatar';
import { createAthenaTheme, type PersonalityMood, type AthenaTheme } from '../styles/athena-theme';
import '../styles/sweet-athena.css';

interface EnhancedSweetAthenaProps {
  isOpen?: boolean;
  onClose?: () => void;
  personalityMood?: PersonalityMood;
  sweetnessLevel?: number;
  className?: string;
}

// Styled components with Framer Motion integration
const AthenaContainer = styled(motion.div)<{ theme: AthenaTheme }>`
  background: linear-gradient(135deg, 
    ${props => props.theme.personality.colors.primary}15 0%,
    ${props => props.theme.personality.colors.secondary}15 50%,
    ${props => props.theme.personality.colors.accent}15 100%);
  border-radius: 24px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.theme.personality.colors.primary}30;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 0 40px ${props => props.theme.personality.colors.primary}20;
  position: relative;
`;

const FloatingParticles = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
`;

const AthenaHeader = styled(motion.div)<{ theme: AthenaTheme }>`
  padding: 20px 24px;
  background: linear-gradient(135deg, 
    ${props => props.theme.personality.colors.primary}20 0%,
    ${props => props.theme.personality.colors.secondary}20 100%);
  border-bottom: 1px solid ${props => props.theme.personality.colors.primary}30;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const AthenaTitle = styled(motion.h1)<{ theme: AthenaTheme }>`
  font-family: ${props => props.theme.fonts.elegant};
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0;
  background: linear-gradient(135deg, 
    ${props => props.theme.personality.colors.primary} 0%,
    ${props => props.theme.personality.colors.accent} 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 20px ${props => props.theme.personality.colors.primary}40;
`;

const ChatSection = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr;
  height: 500px;
  gap: 0;
`;

const AvatarSection = styled(motion.div)`
  border-right: 1px solid rgba(255, 182, 193, 0.2);
  position: relative;
  overflow: hidden;
`;

const ConversationSection = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

// Animation variants for different personality moods
const containerVariants = {
  sweet: {
    scale: [1, 1.02, 1],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
  },
  shy: {
    x: [-2, 2, -2],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" }
  },
  confident: {
    y: [-3, 0, -3],
    scale: [1, 1.05, 1],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
  },
  caring: {
    boxShadow: [
      "0 0 20px rgba(255, 182, 193, 0.3)",
      "0 0 40px rgba(255, 182, 193, 0.6)",
      "0 0 20px rgba(255, 182, 193, 0.3)"
    ],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
  },
  playful: {
    rotate: [-1, 1, -1],
    scale: [1, 1.03, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
  }
};

const titleVariants = {
  initial: { opacity: 0, y: -20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" }
  }
};

const messageVariants = {
  initial: { opacity: 0, x: -30, scale: 0.9 },
  animate: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    x: 30, 
    scale: 0.9,
    transition: { duration: 0.3 }
  }
};

// Floating particle component with React Spring
const FloatingParticle: React.FC<{ delay: number; mood: PersonalityMood }> = ({ delay, mood }) => {
  const particleSpring = useSpring({
    from: { 
      transform: 'translateY(100vh) rotate(0deg)',
      opacity: 0 
    },
    to: async (next) => {
      while (true) {
        await next({ 
          transform: 'translateY(-20vh) rotate(360deg)',
          opacity: 1
        });
        await next({ 
          transform: 'translateY(-120vh) rotate(720deg)',
          opacity: 0 
        });
        await next({ 
          transform: 'translateY(100vh) rotate(0deg)',
          opacity: 0 
        });
      }
    },
    config: config.slow,
    delay: delay * 1000,
  });

  const getParticleColor = () => {
    const colors = {
      sweet: '#FFB6C1',
      shy: '#E6E6FA',
      confident: '#4169E1',
      caring: '#FFA07A',
      playful: '#FF69B4'
    };
    return colors[mood];
  };

  return (
    <animated.div
      style={{
        ...particleSpring,
        position: 'absolute',
        left: `${Math.random() * 100}%`,
        width: '4px',
        height: '4px',
        background: `radial-gradient(circle, ${getParticleColor()}, transparent)`,
        borderRadius: '50%',
        pointerEvents: 'none'
      }}
    />
  );
};

// Enhanced message component with animations
const AnimatedMessage: React.FC<{
  message: any;
  theme: AthenaTheme;
}> = ({ message, theme }) => {
  const isAssistant = message.role === 'assistant';
  
  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        padding: '12px 16px',
        margin: '8px 16px',
        borderRadius: '16px',
        background: isAssistant 
          ? `linear-gradient(135deg, ${theme.personality.colors.primary} 0%, ${theme.personality.colors.secondary} 100%)`
          : 'rgba(255, 255, 255, 0.9)',
        color: isAssistant ? 'white' : '#333',
        marginLeft: isAssistant ? '40px' : '16px',
        marginRight: isAssistant ? '16px' : '40px',
        borderBottomLeftRadius: isAssistant ? '4px' : '16px',
        borderBottomRightRadius: isAssistant ? '16px' : '4px',
        boxShadow: isAssistant ? theme.personality.effects.glowSoft : 'none',
        fontFamily: theme.fonts.modern,
        lineHeight: 1.5,
        position: 'relative'
      }}
    >
      {isAssistant && (
        <motion.span
          style={{
            position: 'absolute',
            left: '-24px',
            top: '50%',
            fontSize: '1rem'
          }}
          animate={{ rotate: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ✨
        </motion.span>
      )}
      {message.content}
    </motion.div>
  );
};

// Main component
export const EnhancedSweetAthena: React.FC<EnhancedSweetAthenaProps> = ({
  isOpen = true,
  onClose,
  personalityMood = 'sweet',
  sweetnessLevel = 8,
  className
}) => {
  const [currentMood, setCurrentMood] = useState<PersonalityMood>(personalityMood);
  const [theme, setTheme] = useState<AthenaTheme>(createAthenaTheme(personalityMood, sweetnessLevel));
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const containerControls = useAnimation();

  // Update theme when mood changes
  useEffect(() => {
    setTheme(createAthenaTheme(currentMood, sweetnessLevel));
  }, [currentMood, sweetnessLevel]);

  // Animate container based on mood
  useEffect(() => {
    containerControls.start(containerVariants[currentMood]);
  }, [currentMood, containerControls]);

  // React Spring for smooth background transitions
  const backgroundSpring = useSpring({
    background: `linear-gradient(135deg, 
      ${theme.personality.colors.primary}15 0%,
      ${theme.personality.colors.secondary}15 50%,
      ${theme.personality.colors.accent}15 100%)`,
    config: config.gentle
  });

  // Handle message events
  const handleMessageSent = useCallback((message: string, response: string) => {
    setIsThinking(true);
    
    // Simulate thinking time
    setTimeout(() => {
      setIsThinking(false);
      setIsSpeaking(true);
      
      // Simulate speaking time
      setTimeout(() => {
        setIsSpeaking(false);
      }, response.length * 50); // Rough estimate based on response length
    }, 1000 + Math.random() * 2000);
  }, []);

  // Mood change with smooth transition
  const handleMoodChange = useCallback((newMood: PersonalityMood) => {
    setCurrentMood(newMood);
  }, []);

  if (!isOpen) return null;

  return (
    <ThemeProvider theme={theme}>
      <motion.div
        className={`fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 ${className}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <AthenaContainer
          animate={containerControls}
          style={{
            width: '900px',
            height: '600px',
            ...backgroundSpring
          }}
        >
          {/* Floating particles */}
          <FloatingParticles>
            {Array.from({ length: sweetnessLevel }, (_, i) => (
              <FloatingParticle 
                key={i} 
                delay={i * 0.5} 
                mood={currentMood}
              />
            ))}
          </FloatingParticles>

          {/* Header */}
          <AthenaHeader>
            <AthenaTitle
              variants={titleVariants}
              initial="initial"
              animate="animate"
            >
              Sweet Athena
            </AthenaTitle>
            
            {/* Mood indicator */}
            <motion.div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 16px',
                background: `${theme.personality.colors.soft}40`,
                borderRadius: '20px',
                border: `1px solid ${theme.personality.colors.primary}30`
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                style={{ fontSize: '1.2rem' }}
                animate={{ rotate: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {currentMood === 'sweet' ? '🌸' : 
                 currentMood === 'shy' ? '😊' :
                 currentMood === 'confident' ? '⭐' :
                 currentMood === 'caring' ? '💕' : '🎭'}
              </motion.span>
              <span style={{ 
                fontSize: '0.875rem', 
                fontWeight: 500,
                color: theme.personality.colors.primary,
                textTransform: 'capitalize'
              }}>
                {currentMood}
              </span>
            </motion.div>

            {/* Close button */}
            {onClose && (
              <motion.button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: `1px solid ${theme.personality.colors.primary}50`,
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.personality.colors.primary,
                  cursor: 'pointer'
                }}
                whileHover={{ scale: 1.1, backgroundColor: `${theme.personality.colors.primary}20` }}
                whileTap={{ scale: 0.9 }}
              >
                ✕
              </motion.button>
            )}
          </AthenaHeader>

          {/* Main chat area */}
          <ChatSection>
            {/* Avatar section */}
            <AvatarSection
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <SweetAthenaAvatar
                isThinking={isThinking}
                isSpeaking={isSpeaking}
                personalityMood={currentMood}
                sweetnessLevel={sweetnessLevel}
                className="w-full h-full"
              />
            </AvatarSection>

            {/* Conversation section */}
            <ConversationSection>
              <motion.div
                style={{ flex: 1, overflow: 'hidden' }}
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              >
                <Thread
                  components={{
                    Message: ({ message }) => (
                      <AnimatedMessage message={message} theme={theme} />
                    ),
                  }}
                  onMessageSent={handleMessageSent}
                />

                {/* Thinking indicator */}
                <AnimatePresence>
                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      style={{
                        padding: '12px 16px',
                        margin: '8px 16px',
                        marginLeft: '40px',
                        marginRight: '16px',
                        background: `${theme.personality.colors.primary}20`,
                        borderRadius: '16px',
                        borderBottomLeftRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                        Athena is thinking sweetly...
                      </span>
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <motion.div
                          key={i}
                          style={{
                            width: '6px',
                            height: '6px',
                            background: theme.personality.colors.primary,
                            borderRadius: '50%'
                          }}
                          animate={{ y: [0, -8, 0] }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </ConversationSection>
          </ChatSection>
        </AthenaContainer>
      </motion.div>
    </ThemeProvider>
  );
};

export default EnhancedSweetAthena;