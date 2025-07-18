/**
 * Sweet Athena Message Component
 * 
 * Individual chat message component with personality-aware styling,
 * animations, and rich content support for the Sweet Athena chat interface.
 */

import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

import {
  ChatMessage,
  MessageComponentProps,
  PersonalityMood,
  AthenaTheme,
  MessageType,
  MessageStatus
} from '../types';

/**
 * Message appearance animation.
 */
const messageAppear = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

/**
 * Sparkle animation for assistant messages.
 */
const sparkleAnimation = keyframes`
  0%, 100% { 
    opacity: 0.6; 
    transform: translateY(-50%) rotate(0deg) scale(1);
  }
  50% { 
    opacity: 1; 
    transform: translateY(-50%) rotate(180deg) scale(1.2);
  }
`;

/**
 * Pulse animation for status indicators.
 */
const pulseAnimation = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
`;

/**
 * Main message container with personality-aware styling.
 */
const MessageContainer = styled(motion.div)<{ 
  $theme: AthenaTheme;
  $isAssistant: boolean;
  $mood: PersonalityMood;
  $status: MessageStatus;
  $animated: boolean;
}>`
  padding: 12px 16px;
  margin: 8px 16px;
  border-radius: 16px;
  font-family: ${props => props.$theme.fonts?.modern || 'Inter, sans-serif'};
  line-height: 1.6;
  position: relative;
  max-width: 80%;
  word-wrap: break-word;
  transition: all 0.3s ease;
  
  ${props => props.$animated && css`
    animation: ${messageAppear} 0.4s ease-out;
  `}
  
  ${props => props.$isAssistant ? css`
    background: linear-gradient(135deg, #fbb6ce 0%, #f093fb 100%);
    color: white;
    margin-left: 48px;
    margin-right: auto;
    border-bottom-left-radius: 6px;
    box-shadow: 0 4px 20px rgba(251, 182, 206, 0.3);
    
    &::before {
      content: '✨';
      position: absolute;
      left: -32px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1rem;
      opacity: 0.9;
      animation: ${sparkleAnimation} 3s ease-in-out infinite;
    }
  ` : css`
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%);
    color: #333;
    margin-right: 48px;
    margin-left: auto;
    border-bottom-right-radius: 6px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.05);
  `}
  
  ${props => props.$status === 'sending' && css`
    opacity: 0.7;
    animation: ${pulseAnimation} 1s ease-in-out infinite;
  `}
  
  ${props => props.$status === 'failed' && css`
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%) !important;
    color: white !important;
    border: 1px solid #ff5252;
  `}
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.$isAssistant ? 
      '0 6px 25px rgba(251, 182, 206, 0.4)' : 
      '0 6px 20px rgba(0, 0, 0, 0.15)'
    };
  }
`;

/**
 * Message content wrapper.
 */
const MessageContent = styled.div<{ $type: MessageType }>`
  ${props => props.$type === 'code' && css`
    font-family: 'Monaco', 'Consolas', monospace;
    background: rgba(0, 0, 0, 0.1);
    padding: 8px;
    border-radius: 8px;
    margin: 4px 0;
    overflow-x: auto;
  `}
  
  ${props => props.$type === 'markdown' && css`
    p { margin: 0.5em 0; }
    h1, h2, h3, h4, h5, h6 { margin: 0.8em 0 0.4em 0; }
    code {
      background: rgba(0, 0, 0, 0.1);
      padding: 2px 4px;
      border-radius: 4px;
      font-family: monospace;
    }
    pre {
      background: rgba(0, 0, 0, 0.1);
      padding: 8px;
      border-radius: 8px;
      overflow-x: auto;
    }
  `}
  
  ${props => props.$type === 'emoji' && css`
    font-size: 1.5em;
    text-align: center;
  `}
`;

/**
 * Message metadata footer.
 */
const MessageMeta = styled.div<{ $theme: AthenaTheme; $isAssistant: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid ${props => props.$isAssistant ? 
    'rgba(255, 255, 255, 0.2)' : 
    'rgba(0, 0, 0, 0.1)'
  };
  font-size: 0.75rem;
  opacity: 0.8;
`;

/**
 * Enhanced Message Component with personality theming.
 */
export const MessageComponent: React.FC<MessageComponentProps> = ({
  message,
  session,
  config,
  events,
  isLatest = false,
  showAvatar = true,
  showTimestamp = true,
  customRenderer,
  className,
  style,
  debug = false,
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const messageRef = useRef<HTMLDivElement>(null);
  
  // Extract theme from session or use default
  const theme = session?.config?.ui || config?.ui || {
    fonts: { modern: 'Inter, sans-serif' },
    personality: {
      colors: { primary: '#fbb6ce', secondary: '#f093fb', accent: '#e879f9' },
      animations: { transitionFast: '0.3s' },
      effects: { glowMedium: '0 6px 25px rgba(251, 182, 206, 0.4)' }
    }
  };
  
  const personalityMood = message.mood || session?.currentMood || 'sweet';
  const enableAnimations = config?.ui?.enableAnimations ?? true;
  
  // Intersection observer for animations
  useEffect(() => {
    if (!enableAnimations) {
      setIsVisible(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (messageRef.current) {
      observer.observe(messageRef.current);
    }
    
    return () => observer.disconnect();
  }, [enableAnimations]);
  
  /**
   * Format timestamp for display.
   */
  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return timestamp.toLocaleDateString();
  };
  
  // Use custom renderer if provided
  if (customRenderer) {
    return <>{customRenderer(message)}</>;
  }
  
  const isAssistant = message.role === 'assistant';
  
  return (
    <AnimatePresence>
      <MessageContainer
        ref={messageRef}
        className={`message-component ${isAssistant ? 'assistant' : 'user'} ${className || ''}`}
        $theme={theme}
        $isAssistant={isAssistant}
        $mood={personalityMood}
        $status={message.status}
        $animated={enableAnimations && isVisible}
        initial={enableAnimations ? { opacity: 0, y: 20, scale: 0.95 } : false}
        animate={enableAnimations ? { opacity: 1, y: 0, scale: 1 } : false}
        exit={enableAnimations ? { opacity: 0, y: -10, scale: 0.95 } : false}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={style}
        {...props}
      >
        <MessageContent $type={message.type}>
          {message.content}
        </MessageContent>
        
        {showTimestamp && (
          <MessageMeta $theme={theme} $isAssistant={isAssistant}>
            <div>
              <span style={{ color: 'currentColor', opacity: 0.7 }}>
                {formatTimestamp(message.timestamp)}
              </span>
              {debug && (
                <span style={{ marginLeft: '8px', opacity: 0.6 }}>
                  ID: {message.id.slice(-6)}
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '0.75rem' }}>
                {message.status === 'sending' && '⏳'}
                {message.status === 'sent' && '✓'}
                {message.status === 'delivered' && '✓✓'}
                {message.status === 'read' && '👀'}
                {message.status === 'failed' && '❌'}
                {message.status === 'processing' && '🔄'}
                {message.status === 'generating' && '✨'}
                {message.status}
              </div>
            </div>
          </MessageMeta>
        )}
      </MessageContainer>
    </AnimatePresence>
  );
};

export default MessageComponent;