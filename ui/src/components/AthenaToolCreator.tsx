/**
 * Athena Tool Creator Component
 * 
 * Natural language interface for creating tools through Sweet Athena
 */

import React, { useState, useRef, useEffect } from 'react';
import { Box, TextField, Button, Paper, Typography, List, ListItem, ListItemText, Chip, CircularProgress, Alert } from '@mui/material';
import { Send as SendIcon, Build as BuildIcon, Widgets as WidgetsIcon } from '@mui/icons-material';
import api from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'athena';
  content: string;
  timestamp: Date;
  mood?: string;
  sweetnessLevel?: number;
  suggestedActions?: string[];
}

interface ToolSession {
  id: string;
  status: 'active' | 'completed' | 'cancelled';
  toolName?: string;
  stage?: string;
  progress?: number;
}

export const AthenaToolCreator: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId] = useState(`conv_${Date.now()}`);
  const [activeSession, setActiveSession] = useState<ToolSession | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    // Add welcome message
    setMessages([{
      id: 'welcome',
      role: 'athena',
      content: "Hi there! I'm Athena, and I absolutely love creating tools! 🛠️✨ Just tell me what kind of tool, widget, or component you need, and I'll help you build something amazing! What would you like to create today?",
      timestamp: new Date(),
      mood: 'excited',
      sweetnessLevel: 9
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/api/v1/athena-tools/chat', {
        message: input,
        conversationId
      });

      const athenaResponse = response.data.response;
      const athenaMessage: Message = {
        id: `msg_${Date.now()}_athena`,
        role: 'athena',
        content: athenaResponse.content,
        timestamp: new Date(),
        mood: athenaResponse.personalityMood,
        sweetnessLevel: athenaResponse.sweetnessLevel,
        suggestedActions: athenaResponse.suggestedNextActions
      };

      setMessages(prev => [...prev, athenaMessage]);

      // Check if this is part of a tool creation session
      if (athenaResponse.content.includes('create') || athenaResponse.content.includes('build')) {
        checkForActiveSession();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'athena',
        content: "Oh no! I'm having a little trouble right now. 😔 But don't worry, I'm still here to help! Could you try again?",
        timestamp: new Date(),
        mood: 'apologetic',
        sweetnessLevel: 8
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const checkForActiveSession = async () => {
    try {
      const response = await api.get('/api/v1/athena-tools/tool-sessions');
      const sessions = response.data.sessions;
      if (sessions.length > 0) {
        setActiveSession(sessions[0]);
      }
    } catch (error) {
      console.error('Error checking sessions:', error);
    }
  };

  const handleSuggestedAction = (action: string) => {
    setInput(action);
  };

  const getMoodEmoji = (mood?: string) => {
    const moodEmojis: Record<string, string> = {
      excited: '🤩',
      sweet: '🥰',
      caring: '🤗',
      proud: '🌟',
      helpful: '💫',
      shy: '🌸',
      determined: '💪',
      loving: '💕'
    };
    return moodEmojis[mood || 'sweet'] || '✨';
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Paper elevation={3} sx={{ mb: 2, p: 2, background: 'linear-gradient(45deg, #FF69B4 30%, #FFB6C1 90%)' }}>
        <Typography variant="h5" sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WidgetsIcon />
          Athena's Tool Creator
        </Typography>
        <Typography variant="body2" sx={{ color: 'white', mt: 1 }}>
          Create amazing tools with natural language! Just describe what you need.
        </Typography>
      </Paper>

      {activeSession && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Creating: <strong>{activeSession.toolName || 'Your Tool'}</strong> - 
            Stage: {activeSession.stage} 
            {activeSession.progress && ` (${activeSession.progress}%)`}
          </Typography>
        </Alert>
      )}

      <Paper elevation={1} sx={{ flex: 1, overflow: 'auto', p: 2, mb: 2 }}>
        <List>
          {messages.map((message) => (
            <ListItem 
              key={message.id} 
              sx={{ 
                flexDirection: 'column', 
                alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                mb: 2
              }}
            >
              <Paper 
                elevation={2}
                sx={{
                  p: 2,
                  maxWidth: '70%',
                  backgroundColor: message.role === 'user' ? '#e3f2fd' : '#fce4ec',
                  borderRadius: 2
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {message.role === 'user' ? 'You' : 'Athena'}
                  </Typography>
                  {message.role === 'athena' && message.mood && (
                    <Typography variant="body2">{getMoodEmoji(message.mood)}</Typography>
                  )}
                  {message.sweetnessLevel && (
                    <Chip 
                      size="small" 
                      label={`Sweetness: ${message.sweetnessLevel}/10`}
                      sx={{ backgroundColor: '#FFB6C1' }}
                    />
                  )}
                </Box>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
                {message.suggestedActions && message.suggestedActions.length > 0 && (
                  <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {message.suggestedActions.map((action, index) => (
                      <Chip
                        key={index}
                        label={action}
                        onClick={() => handleSuggestedAction(action)}
                        clickable
                        size="small"
                        sx={{ backgroundColor: '#FFE4E1' }}
                      />
                    ))}
                  </Box>
                )}
              </Paper>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </Typography>
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Paper>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Describe the tool you want to create..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={loading}
          sx={{ backgroundColor: 'white' }}
        />
        <Button
          variant="contained"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          endIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          sx={{ 
            minWidth: 120,
            background: 'linear-gradient(45deg, #FF69B4 30%, #FFB6C1 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #FF1493 30%, #FF69B4 90%)',
            }
          }}
        >
          {loading ? 'Creating...' : 'Send'}
        </Button>
      </Box>

      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Try saying:
        </Typography>
        {[
          "Create a widget that shows user profiles",
          "Build me a todo list manager",
          "I need a chart component",
          "Make a tool for managing tasks"
        ].map((example, index) => (
          <Chip
            key={index}
            label={example}
            size="small"
            onClick={() => setInput(example)}
            clickable
            variant="outlined"
          />
        ))}
      </Box>
    </Box>
  );
};