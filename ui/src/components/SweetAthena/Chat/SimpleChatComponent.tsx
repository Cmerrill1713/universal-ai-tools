/**
 * Simple Sweet Athena Chat Component
 * A working chat interface for immediate integration and testing
 */

import React, { useState, useCallback } from 'react';
import type { PersonalityMood } from '../types';

export interface SimpleChatProps {
  mood?: PersonalityMood;
  isLoading?: boolean;
  onMessage?: (message: any) => void;
  onError?: (error: string) => void;
  enableVoice?: boolean;
}

export const SimpleChatComponent: React.FC<SimpleChatProps> = ({
  mood = 'sweet',
  isLoading = false,
  onMessage,
  onError,
  enableVoice = false
}) => {
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [input, setInput] = useState('');
  const _voiceEnabled = enableVoice; // Use the parameter to avoid unused warning

  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      // Simple response generation based on mood
      const responses = {
        sweet: "That's so lovely! ✨ How can I help you further?",
        shy: "Oh... um... I'll try my best to help you! 😊",
        confident: "Absolutely! I've got this covered! 💪",
        caring: "I understand, and I'm here for you. 💗",
        playful: "Ooh, that sounds fun! Let's explore this together! 🎉"
      };

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: responses[mood] || "I'm here to help! How can I assist you?",
        timestamp: new Date()
      };

      setTimeout(() => {
        setMessages(prev => [...prev, assistantMessage]);
        onMessage?.(assistantMessage);
      }, 1000);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMsg);
    }
  }, [input, mood, onMessage, onError]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`sweet-athena-chat sweet-athena-chat--${mood}`}>
      <div className="chat-messages">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message message--${message.role}`}
          >
            <div className="message-content">
              {message.content}
            </div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message message--assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="chat-input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Chat with Sweet Athena (${mood} mode)...`}
          rows={2}
          disabled={isLoading}
        />
        <button 
          onClick={handleSendMessage}
          disabled={!input.trim() || isLoading}
          className="send-button"
        >
          Send ✨
        </button>
      </div>

      <style>{`
        .sweet-athena-chat {
          display: flex;
          flex-direction: column;
          height: 400px;
          max-width: 600px;
          margin: 0 auto;
          border: 1px solid #ddd;
          border-radius: 12px;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }

        .chat-messages {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        }

        .message {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }

        .message--user {
          align-items: flex-end;
        }

        .message--assistant {
          align-items: flex-start;
        }

        .message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.4;
        }

        .message--user .message-content {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .message--assistant .message-content {
          background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
          color: #333;
        }

        .message-time {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
          padding: 0 8px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #999;
          animation: typing 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          30% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .chat-input-area {
          padding: 16px;
          border-top: 1px solid #e2e8f0;
          background: white;
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        textarea {
          flex: 1;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
        }

        textarea:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .send-button {
          padding: 12px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sweet-athena-chat--sweet {
          border-color: #fbb6ce;
        }

        .sweet-athena-chat--confident {
          border-color: #60a5fa;
        }

        .sweet-athena-chat--playful {
          border-color: #a78bfa;
        }

        .sweet-athena-chat--caring {
          border-color: #34d399;
        }

        .sweet-athena-chat--shy {
          border-color: #f9a8d4;
        }
      `}</style>
    </div>
  );
};

export default SimpleChatComponent;