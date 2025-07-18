/**
 * Sweet Athena Demo Page
 * 
 * Comprehensive demo showcasing Sweet Athena AI Assistant functionality.
 * 
 * @fileoverview Sweet Athena demo page
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { SweetAthena, PersonalityMood } from '../components/SweetAthena';

export const SweetAthenaDemo: React.FC = () => {
  const [currentMood, setCurrentMood] = useState<PersonalityMood>('sweet');
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    mood: PersonalityMood;
  }>>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm Sweet Athena, your AI assistant. I can adapt my personality to better help you. Try changing my mood and see how my responses change! ✨",
      timestamp: new Date(),
      mood: 'sweet'
    }
  ]);
  const [error, setError] = useState<string | null>(null);

  const handleMoodChange = useCallback((newMood: PersonalityMood) => {
    setCurrentMood(newMood);
    
    // Add a system message about the mood change
    const moodMessages = {
      sweet: "I'm feeling sweet and gentle now! 🌸 How can I help you with kindness?",
      shy: "Oh... I'm feeling a bit shy now... 😊 But I'll still try my best to help you!",
      confident: "I'm feeling confident and ready! ⭐ Let's tackle any challenge together!",
      caring: "I'm in a caring mood now 💕 I'm here to support you with warmth and understanding.",
      playful: "I'm feeling playful! 🎭 Let's have some fun while we work together!"
    };

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: moodMessages[newMood],
      timestamp: new Date(),
      mood: newMood
    }]);
  }, []);

  const handleMessage = useCallback((message: any) => {
    // Store messages in state for demo purposes
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: message.content,
      timestamp: new Date(),
      mood: currentMood
    }]);
  }, [currentMood]);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  }, []);

  const clearMessages = () => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: "Hello! I'm Sweet Athena, your AI assistant. I can adapt my personality to better help you. Try changing my mood and see how my responses change! ✨",
      timestamp: new Date(),
      mood: currentMood
    }]);
  };

  return (
    <div className="sweet-athena-demo">
      {/* Demo Header */}
      <div className="demo-header" style={{
        background: 'linear-gradient(135deg, #fbb6ce 0%, #f8a2c2 100%)',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '24px',
        textAlign: 'center',
        color: 'white'
      }}>
        <h1 style={{ 
          margin: '0 0 12px 0',
          fontSize: '2.5rem',
          fontWeight: 'bold',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          ✨ Sweet Athena Demo ✨
        </h1>
        <p style={{ 
          margin: '0',
          fontSize: '1.125rem',
          opacity: 0.9
        }}>
          Experience the AI assistant with personality and emotion
        </p>
      </div>

      {/* Demo Content */}
      <div className="demo-content" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '24px',
        minHeight: '600px'
      }}>
        {/* Left Panel - Info & Controls */}
        <div className="demo-panel" style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0',
            color: '#fbb6ce',
            fontSize: '1.25rem'
          }}>
            Demo Features
          </h3>
          
          <div className="feature-list" style={{
            marginBottom: '24px'
          }}>
            <div className="feature-item" style={{
              padding: '8px 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <strong>🎭 Personality Moods:</strong>
              <br />
              <small>Switch between Sweet, Shy, Confident, Caring, and Playful</small>
            </div>
            <div className="feature-item" style={{
              padding: '8px 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <strong>💬 Interactive Chat:</strong>
              <br />
              <small>Chat interface with personality-driven responses</small>
            </div>
            <div className="feature-item" style={{
              padding: '8px 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <strong>👸 Avatar Display:</strong>
              <br />
              <small>Visual avatar that changes with mood</small>
            </div>
            <div className="feature-item" style={{
              padding: '8px 0'
            }}>
              <strong>🧠 Memory Storage:</strong>
              <br />
              <small>Conversation context is preserved</small>
            </div>
          </div>

          <div className="demo-controls">
            <h4 style={{ 
              margin: '0 0 12px 0',
              color: '#f9a8d4'
            }}>
              Demo Controls
            </h4>
            <button
              onClick={clearMessages}
              style={{
                background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'transform 0.2s ease',
                width: '100%',
                marginBottom: '12px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              🔄 Clear Chat History
            </button>
            
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#888'
            }}>
              <strong>Current Status:</strong>
              <br />
              Mood: <span style={{ color: '#fbb6ce', textTransform: 'capitalize' }}>{currentMood}</span>
              <br />
              Messages: {messages.length}
              <br />
              Backend: {error ? '❌ Error' : '✅ Connected'}
            </div>
          </div>
        </div>

        {/* Right Panel - Sweet Athena Component */}
        <div className="demo-athena" style={{
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden'
        }}>
          <SweetAthena
            initialMood={currentMood}
            enableAvatar={true}
            enableVoice={false}
            enableAnimation={true}
            onMoodChange={handleMoodChange}
            onMessage={handleMessage}
            onError={handleError}
            className="demo-sweet-athena"
          />
        </div>
      </div>

      {/* Message History */}
      <div className="message-history" style={{
        marginTop: '24px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{ 
          margin: '0 0 16px 0',
          color: '#fbb6ce',
          fontSize: '1.25rem'
        }}>
          Conversation History
        </h3>
        
        <div className="messages" style={{
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message message--${message.role}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginBottom: '12px',
                padding: '12px',
                background: message.role === 'user' 
                  ? 'rgba(102, 126, 234, 0.1)' 
                  : 'rgba(251, 182, 206, 0.1)',
                borderRadius: '8px',
                border: `1px solid ${message.role === 'user' 
                  ? 'rgba(102, 126, 234, 0.2)' 
                  : 'rgba(251, 182, 206, 0.2)'}`
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px'
              }}>
                <span style={{
                  fontSize: '12px',
                  color: '#888',
                  textTransform: 'capitalize'
                }}>
                  {message.role === 'assistant' ? '👸 Sweet Athena' : '🧑‍💼 You'}
                  {message.role === 'assistant' && (
                    <span style={{ marginLeft: '8px', color: '#fbb6ce' }}>
                      ({message.mood} mood)
                    </span>
                  )}
                </span>
                <span style={{
                  fontSize: '11px',
                  color: '#666'
                }}>
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div style={{
                color: '#ddd',
                lineHeight: '1.4'
              }}>
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(220, 38, 38, 0.9)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <style>{`
        .sweet-athena-demo {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          color: #fff;
        }
        
        .demo-content {
          min-height: 600px;
        }
        
        .demo-athena {
          position: relative;
        }
        
        .messages::-webkit-scrollbar {
          width: 6px;
        }
        
        .messages::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        
        .messages::-webkit-scrollbar-thumb {
          background: rgba(251, 182, 206, 0.5);
          border-radius: 3px;
        }
        
        .messages::-webkit-scrollbar-thumb:hover {
          background: rgba(251, 182, 206, 0.7);
        }
        
        @media (max-width: 768px) {
          .demo-content {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default SweetAthenaDemo;