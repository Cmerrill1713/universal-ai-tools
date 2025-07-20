/**
 * Natural Language Widget Creator Component
 * 
 * A beautiful interface for creating widgets using voice or text with Sweet Athena
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
  Paper,
  Fade,
  Slide
} from '@mui/material';
import {
  Mic,
  MicOff,
  Send,
  VolumeUp,
  Code,
  Preview,
  Download,
  Help,
  AutoAwesome,
  Psychology,
  RecordVoiceOver,
  SmartToy,
  Celebration
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { api } from '../lib/api';

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
`;

const Recording = styled(Box)(({ theme }) => ({
  animation: `${pulseAnimation} 1.5s ease-in-out infinite`,
  color: theme.palette.error.main
}));

const AthenaAvatar = styled(Avatar)(({ theme }) => ({
  background: 'linear-gradient(45deg, #FF6B9D, #C44CAA, #8E44AD)',
  width: 48,
  height: 48,
  boxShadow: '0 4px 20px rgba(142, 68, 173, 0.3)',
  border: '2px solid rgba(255, 255, 255, 0.2)'
}));

const StyledCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)'
}));

const ResponseCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(2),
  borderRadius: 12,
  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  border: '1px solid rgba(255, 107, 157, 0.2)',
  boxShadow: '0 4px 16px rgba(255, 107, 157, 0.1)'
}));

interface WidgetCreationResponse {
  success: boolean;
  widget?: {
    id: string;
    name: string;
    description: string;
    previewUrl: string;
    exportUrl: string;
    codePreview?: string;
  };
  analysis?: {
    intent: string;
    confidence: number;
    widgetType: string;
    extractedRequirements?: any;
  };
  athenaResponse?: {
    content: string;
    personalityMood: string;
    emotionalTone: string;
    sweetnessLevel: number;
    suggestedNextActions?: string[];
  };
  error?: string;
  needsMoreInfo?: boolean;
  clarificationQuestions?: string[];
  suggestions?: string[];
  hasVoiceResponse?: boolean;
  conversationId?: string;
}

interface VoiceAnalysis {
  success: boolean;
  analysis?: {
    intent: string;
    confidence: number;
    widgetType: string;
    extractedRequirements?: any;
    clarificationNeeded?: string[];
  };
  canCreate: boolean;
  suggestions: string[];
}

export const NaturalLanguageWidgetCreator: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [response, setResponse] = useState<WidgetCreationResponse | null>(null);
  const [voiceAnalysis, setVoiceAnalysis] = useState<VoiceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Auto-analyze text as user types (debounced)
  useEffect(() => {
    if (textInput.length > 10) {
      const timeoutId = setTimeout(() => {
        analyzeText(textInput);
      }, 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setVoiceAnalysis(null);
    }
  }, [textInput]);

  const analyzeText = async (text: string) => {
    try {
      setIsAnalyzing(true);
      const result = await api.get('/natural-language-widgets/analyze', {
        params: { text }
      });
      setVoiceAnalysis(result.data);
    } catch (err) {
      console.warn('Text analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError('Unable to access microphone. Please check permissions.');
      console.error('Recording error:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const generateFromText = async () => {
    if (!textInput.trim()) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      
      const result = await api.post('/natural-language-widgets/generate', {
        description: textInput,
        conversationId: conversationId || undefined,
        context: {
          userPreferences: {},
          previousWidgets: []
        }
      });
      
      setResponse(result.data);
      if (result.data.conversationId) {
        setConversationId(result.data.conversationId);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate widget');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateFromVoice = async () => {
    if (!audioBlob) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-input.webm');
      formData.append('conversationId', conversationId || '');
      formData.append('context', JSON.stringify({
        userPreferences: {},
        previousWidgets: []
      }));
      if (textInput.trim()) {
        formData.append('fallbackText', textInput);
      }
      
      const result = await api.post('/natural-language-widgets/voice-generate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setResponse(result.data);
      if (result.data.conversationId) {
        setConversationId(result.data.conversationId);
      }
      setAudioBlob(null); // Clear the audio blob after processing
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate widget from voice');
    } finally {
      setIsProcessing(false);
    }
  };

  const playVoiceResponse = async () => {
    if (!response?.hasVoiceResponse || !conversationId) return;
    
    try {
      setIsPlayingVoice(true);
      const audioResponse = await api.get(`/natural-language-widgets/voice-response/${conversationId}`, {
        responseType: 'blob'
      });
      
      const audioUrl = URL.createObjectURL(audioResponse.data);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        audioRef.current.onended = () => {
          setIsPlayingVoice(false);
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (err) {
      console.error('Failed to play voice response:', err);
      setIsPlayingVoice(false);
    }
  };

  const getPersonalityIcon = (mood: string) => {
    switch (mood) {
      case 'sweet': return '🌸';
      case 'shy': return '😊';
      case 'confident': return '💪';
      case 'caring': return '💕';
      case 'playful': return '🎉';
      default: return '✨';
    }
  };

  const getPersonalityColor = (mood: string) => {
    switch (mood) {
      case 'sweet': return '#FF6B9D';
      case 'shy': return '#FFB6C1';
      case 'confident': return '#9C27B0';
      case 'caring': return '#E91E63';
      case 'playful': return '#FF4081';
      default: return '#8E44AD';
    }
  };

  const renderResponse = () => {
    if (!response) return null;

    return (
      <Fade in={true}>
        <ResponseCard>
          {response.athenaResponse && (
            <Box mb={3}>
              <Box display="flex" alignItems="center" mb={2}>
                <AthenaAvatar>
                  <SmartToy />
                </AthenaAvatar>
                <Box ml={2} flex={1}>
                  <Typography variant="h6" color="primary">
                    Sweet Athena {getPersonalityIcon(response.athenaResponse.personalityMood)}
                  </Typography>
                  <Chip 
                    label={response.athenaResponse.personalityMood}
                    size="small"
                    style={{ 
                      backgroundColor: getPersonalityColor(response.athenaResponse.personalityMood),
                      color: 'white'
                    }}
                  />
                </Box>
                {response.hasVoiceResponse && (
                  <Tooltip title="Play voice response">
                    <IconButton onClick={playVoiceResponse} disabled={isPlayingVoice}>
                      <VolumeUp color={isPlayingVoice ? 'primary' : 'action'} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              
              <Typography variant="body1" paragraph style={{ lineHeight: 1.6 }}>
                {response.athenaResponse.content}
              </Typography>
              
              {response.athenaResponse.suggestedNextActions && (
                <Box mt={2}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Suggested next steps:
                  </Typography>
                  <List dense>
                    {response.athenaResponse.suggestedNextActions.map((action, index) => (
                      <ListItem key={index}>
                        <ListItemIcon><AutoAwesome color="primary" /></ListItemIcon>
                        <ListItemText primary={action} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}

          {response.analysis && (
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>Analysis Results</Typography>
              <Box display="flex" gap={1} mb={2}>
                <Chip label={`Intent: ${response.analysis.intent}`} color="primary" />
                <Chip label={`Type: ${response.analysis.widgetType}`} color="secondary" />
                <Chip 
                  label={`Confidence: ${Math.round(response.analysis.confidence * 100)}%`}
                  color={response.analysis.confidence > 0.7 ? 'success' : 'warning'}
                />
              </Box>
            </Box>
          )}

          {response.widget && (
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                <Celebration color="primary" style={{ marginRight: 8 }} />
                Widget Created Successfully!
              </Typography>
              <Card variant="outlined" style={{ marginBottom: 16 }}>
                <CardContent>
                  <Typography variant="h6" color="primary">{response.widget.name}</Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    {response.widget.description}
                  </Typography>
                  
                  {response.widget.codePreview && (
                    <Box mt={2}>
                      <Typography variant="subtitle2" gutterBottom>Code Preview:</Typography>
                      <Paper 
                        variant="outlined" 
                        style={{ 
                          padding: 12, 
                          backgroundColor: '#f5f5f5',
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          overflow: 'auto'
                        }}
                      >
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {response.widget.codePreview}
                        </pre>
                      </Paper>
                    </Box>
                  )}
                  
                  <Box mt={2} display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      startIcon={<Preview />}
                      onClick={() => window.open(response.widget!.previewUrl, '_blank')}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Code />}
                      href={`/widgets/${response.widget.id}/edit`}
                    >
                      Edit Code
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                      onClick={() => window.open(response.widget!.exportUrl, '_blank')}
                    >
                      Export
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {response.clarificationQuestions && response.clarificationQuestions.length > 0 && (
            <Box mb={3}>
              <Typography variant="h6" gutterBottom color="warning.main">
                I need a bit more information:
              </Typography>
              <List>
                {response.clarificationQuestions.map((question, index) => (
                  <ListItem key={index}>
                    <ListItemIcon><Help color="warning" /></ListItemIcon>
                    <ListItemText primary={question} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {response.suggestions && response.suggestions.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Suggestions:</Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {response.suggestions.map((suggestion, index) => (
                  <Chip
                    key={index}
                    label={suggestion}
                    variant="outlined"
                    size="small"
                    onClick={() => setTextInput(suggestion)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </ResponseCard>
      </Fade>
    );
  };

  const renderVoiceAnalysis = () => {
    if (!voiceAnalysis || isAnalyzing) return null;

    return (
      <Slide direction="up" in={true}>
        <Paper
          variant="outlined"
          style={{
            padding: 16,
            marginTop: 16,
            backgroundColor: voiceAnalysis.canCreate ? '#e8f5e8' : '#fff3e0',
            borderColor: voiceAnalysis.canCreate ? '#4caf50' : '#ff9800'
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Psychology color={voiceAnalysis.canCreate ? 'success' : 'warning'} />
            <Typography variant="subtitle1" ml={1}>
              {voiceAnalysis.canCreate ? 'Ready to create!' : 'Needs more details'}
            </Typography>
          </Box>
          
          {voiceAnalysis.analysis && (
            <Box mb={2}>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip 
                  label={`Intent: ${voiceAnalysis.analysis.intent}`} 
                  size="small" 
                  color="primary" 
                />
                <Chip 
                  label={`Type: ${voiceAnalysis.analysis.widgetType}`} 
                  size="small" 
                  color="secondary" 
                />
                <Chip 
                  label={`${Math.round(voiceAnalysis.analysis.confidence * 100)}% confident`}
                  size="small"
                  color={voiceAnalysis.analysis.confidence > 0.7 ? 'success' : 'warning'}
                />
              </Box>
            </Box>
          )}
          
          <Typography variant="body2" color="textSecondary">
            {voiceAnalysis.suggestions[0]}
          </Typography>
        </Paper>
      </Slide>
    );
  };

  return (
    <Box maxWidth="lg" mx="auto" p={3}>
      <StyledCard>
        <CardContent>
          <Box display="flex" alignItems="center" mb={3}>
            <AthenaAvatar>
              <RecordVoiceOver />
            </AthenaAvatar>
            <Box ml={2} flex={1}>
              <Typography variant="h4" gutterBottom style={{ color: 'white' }}>
                Natural Language Widget Creator
              </Typography>
              <Typography variant="subtitle1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Describe what you want in natural language, and Sweet Athena will create it for you! 🌸
              </Typography>
            </Box>
            <Tooltip title="Help & Examples">
              <IconButton onClick={() => setShowHelp(true)} style={{ color: 'white' }}>
                <Help />
              </IconButton>
            </Tooltip>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            style={{ marginBottom: 24 }}
            TabIndicatorProps={{ style: { backgroundColor: 'white' } }}
          >
            <Tab 
              label="Text Input" 
              icon={<Send />} 
              style={{ color: 'rgba(255,255,255,0.7)' }}
            />
            <Tab 
              label="Voice Input" 
              icon={<Mic />} 
              style={{ color: 'rgba(255,255,255,0.7)' }}
            />
          </Tabs>

          {activeTab === 0 && (
            <Box>
              <TextField
                ref={textareaRef}
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                placeholder="Describe the widget you want to create... e.g., 'Create a contact form with name, email, and message fields' or 'Build a data table with sorting for user management'"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                style={{ marginBottom: 16 }}
                InputProps={{
                  style: { 
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    borderRadius: 8
                  }
                }}
              />
              
              {isAnalyzing && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">
                    Analyzing your request...
                  </Typography>
                  <LinearProgress />
                </Box>
              )}
              
              {renderVoiceAnalysis()}
              
              <Button
                variant="contained"
                size="large"
                onClick={generateFromText}
                disabled={!textInput.trim() || isProcessing}
                startIcon={isProcessing ? null : <AutoAwesome />}
                style={{
                  marginTop: 16,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  backdropFilter: 'blur(10px)'
                }}
              >
                {isProcessing ? 'Creating Widget...' : 'Create Widget'}
              </Button>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                {isRecording ? (
                  <Recording>
                    <Box textAlign="center">
                      <IconButton
                        size="large"
                        onClick={stopRecording}
                        style={{
                          backgroundColor: 'rgba(244, 67, 54, 0.1)',
                          color: '#f44336',
                          width: 80,
                          height: 80
                        }}
                      >
                        <MicOff style={{ fontSize: 40 }} />
                      </IconButton>
                      <Typography variant="h6" style={{ color: 'white', marginTop: 8 }}>
                        Recording... Click to stop
                      </Typography>
                    </Box>
                  </Recording>
                ) : (
                  <Box textAlign="center">
                    <IconButton
                      size="large"
                      onClick={startRecording}
                      disabled={isProcessing}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        width: 80,
                        height: 80
                      }}
                    >
                      <Mic style={{ fontSize: 40 }} />
                    </IconButton>
                    <Typography variant="h6" style={{ color: 'white', marginTop: 8 }}>
                      Click to start recording
                    </Typography>
                    <Typography variant="body2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Speak naturally about what you want to create
                    </Typography>
                  </Box>
                )}

                {audioBlob && !isRecording && (
                  <Box textAlign="center" mt={2}>
                    <Typography variant="body1" style={{ color: 'white', marginBottom: 16 }}>
                      Audio recorded! Ready to generate widget.
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={generateFromVoice}
                      disabled={isProcessing}
                      startIcon={isProcessing ? null : <AutoAwesome />}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: 'white'
                      }}
                    >
                      {isProcessing ? 'Processing Voice...' : 'Generate from Voice'}
                    </Button>
                  </Box>
                )}

                <TextField
                  fullWidth
                  placeholder="Optional: Add text description as fallback"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  style={{ marginTop: 16 }}
                  InputProps={{
                    style: { 
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      borderRadius: 8
                    }
                  }}
                />
              </Box>
            </Box>
          )}

          {isProcessing && (
            <Box mt={2}>
              <Typography variant="body2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Sweet Athena is working her magic... ✨
              </Typography>
              <LinearProgress style={{ marginTop: 8 }} />
            </Box>
          )}
        </CardContent>
      </StyledCard>

      {error && (
        <Alert severity="error" style={{ marginTop: 16 }}>
          {error}
        </Alert>
      )}

      {renderResponse()}

      {/* Help Dialog */}
      <Dialog
        open={showHelp}
        onClose={() => setShowHelp(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Help color="primary" style={{ marginRight: 8 }} />
            How to Use Natural Language Widget Creator
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>Examples:</Typography>
          <List>
            <ListItem>
              <ListItemText 
                primary="Create a contact form with name, email, and message fields"
                secondary="→ Generates a responsive contact form with validation"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Build a data table with sorting and filtering for user management"
                secondary="→ Creates a sortable, filterable table component"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Make a bar chart showing monthly sales data"
                secondary="→ Generates an interactive chart component"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Design a profile card with avatar, name, and bio"
                secondary="→ Creates a styled user profile card"
              />
            </ListItem>
          </List>
          
          <Divider style={{ margin: '16px 0' }} />
          
          <Typography variant="h6" gutterBottom>Voice Tips:</Typography>
          <List>
            <ListItem>
              <ListItemText primary="Speak clearly and at a normal pace" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Use natural language - no need for technical jargon" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Be specific about functionality and styling preferences" />
            </ListItem>
            <ListItem>
              <ListItemText primary="You can always ask for modifications afterward" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelp(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Hidden audio element for voice responses */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </Box>
  );
};

export default NaturalLanguageWidgetCreator;