/**
 * Chat and conversation type definitions for Sweet Athena
 * 
 * Defines types for chat messages, conversations, AI responses, and chat UI components
 * with support for different personality-driven conversation styles.
 * 
 * @fileoverview Chat system type definitions
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

import { PersonalityMood, EmotionalState } from './core';

/**
 * Represents the role of a message sender in a conversation.
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Different types of message content that can be sent.
 */
export type MessageType = 
  | 'text'           // Plain text message
  | 'markdown'       // Markdown formatted text
  | 'code'           // Code snippet with syntax highlighting
  | 'image'          // Image content
  | 'audio'          // Audio message or voice note
  | 'file'           // File attachment
  | 'emoji'          // Emoji-only message
  | 'thinking'       // Special thinking indicator
  | 'error'          // Error message
  | 'system';        // System notification

/**
 * Status of a message in the conversation flow.
 */
export type MessageStatus = 
  | 'sending'        // Message is being sent
  | 'sent'           // Message has been sent successfully
  | 'delivered'      // Message has been delivered to recipient
  | 'read'           // Message has been read
  | 'failed'         // Message failed to send
  | 'typing'         // Currently typing this message
  | 'processing'     // AI is processing this message
  | 'generating';    // AI is generating a response

/**
 * Core message interface representing a single chat message.
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Role of the message sender */
  role: MessageRole;
  /** Type of message content */
  type: MessageType;
  /** Main message content */
  content: string;
  /** Message timestamp */
  timestamp: Date;
  /** Current status of the message */
  status: MessageStatus;
  /** Personality mood when message was sent (for assistant messages) */
  mood?: PersonalityMood;
  /** Emotional state when message was sent */
  emotion?: EmotionalState;
  /** Message metadata */
  metadata?: MessageMetadata;
  /** Attachments or media */
  attachments?: MessageAttachment[];
  /** Whether message should be animated */
  animated?: boolean;
  /** Custom styling for the message */
  style?: MessageStyle;
}

/**
 * Metadata associated with a chat message.
 */
export interface MessageMetadata {
  /** Model used to generate the message (for AI messages) */
  model?: string;
  /** Confidence score for AI responses */
  confidence?: number;
  /** Processing time in milliseconds */
  processingTime?: number;
  /** Custom tags for categorization */
  tags?: string[];
  /** Response context or reasoning */
  context?: string;
  /** Whether message was generated using memory */
  fromMemory?: boolean;
  /** Original user query (for assistant responses) */
  originalQuery?: string;
  /** IP address (if needed for moderation) */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
}

/**
 * File or media attachment for messages.
 */
export interface MessageAttachment {
  /** Unique identifier for the attachment */
  id: string;
  /** Attachment type */
  type: 'image' | 'audio' | 'video' | 'document' | 'code';
  /** File name */
  name: string;
  /** File URL or data URI */
  url: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Optional preview URL for images/videos */
  previewUrl?: string;
  /** Alt text for accessibility */
  altText?: string;
  /** Whether attachment is still uploading */
  uploading?: boolean;
}

/**
 * Custom styling options for messages.
 */
export interface MessageStyle {
  /** Custom background color */
  backgroundColor?: string;
  /** Custom text color */
  textColor?: string;
  /** Custom border style */
  border?: string;
  /** Custom border radius */
  borderRadius?: string;
  /** Custom padding */
  padding?: string;
  /** Custom margin */
  margin?: string;
  /** Custom font family */
  fontFamily?: string;
  /** Custom font size */
  fontSize?: string;
  /** Whether to show message with special effects */
  animated?: boolean;
  /** Special highlight effect */
  highlighted?: boolean;
}

/**
 * Conversation session information.
 */
export interface ConversationSession {
  /** Unique session identifier */
  id: string;
  /** Session title/name */
  title?: string;
  /** Session start time */
  startTime: Date;
  /** Last activity time */
  lastActivity: Date;
  /** Current personality mood for the session */
  currentMood: PersonalityMood;
  /** Messages in this conversation */
  messages: ChatMessage[];
  /** Session configuration */
  config: ConversationConfig;
  /** Session metadata */
  metadata: SessionMetadata;
  /** Whether session is currently active */
  isActive: boolean;
}

/**
 * Configuration for a conversation session.
 */
export interface ConversationConfig {
  /** AI model to use for responses */
  model: string;
  /** Maximum number of messages to keep in context */
  maxContextMessages: number;
  /** Whether to use conversation memory */
  useMemory: boolean;
  /** Personality traits for the session */
  personality: {
    mood: PersonalityMood;
    sweetnessLevel: number;
    consistency: number; // How consistent to be with personality
  };
  /** Response generation settings */
  generation: {
    maxTokens: number;
    temperature: number;
    topP: number;
    presencePenalty: number;
    frequencyPenalty: number;
  };
  /** UI preferences */
  ui: {
    showTypingIndicator: boolean;
    showTimestamps: boolean;
    showReadReceipts: boolean;
    enableAnimations: boolean;
    autoScroll: boolean;
  };
}

/**
 * Metadata for conversation sessions.
 */
export interface SessionMetadata {
  /** User identifier */
  userId?: string;
  /** Device type */
  deviceType?: 'desktop' | 'tablet' | 'mobile';
  /** Browser information */
  browser?: string;
  /** Location information (if available) */
  location?: {
    country?: string;
    region?: string;
    timezone?: string;
  };
  /** Session tags for categorization */
  tags?: string[];
  /** Custom session data */
  customData?: Record<string, any>;
}

/**
 * Typing indicator state for real-time feedback.
 */
export interface TypingIndicator {
  /** Whether someone is currently typing */
  isTyping: boolean;
  /** Who is typing (for multi-user scenarios) */
  typingUser?: string;
  /** Estimated completion time */
  estimatedCompletion?: number;
  /** Current mood while typing */
  typingMood?: PersonalityMood;
}

/**
 * Chat input configuration and state.
 */
export interface ChatInputState {
  /** Current input text */
  text: string;
  /** Whether input is focused */
  focused: boolean;
  /** Whether currently sending a message */
  sending: boolean;
  /** Input placeholder text */
  placeholder: string;
  /** Maximum character count */
  maxLength?: number;
  /** Whether input is disabled */
  disabled: boolean;
  /** Input validation errors */
  errors?: string[];
  /** Suggested responses */
  suggestions?: string[];
}

/**
 * Events that can occur in the chat system.
 */
export interface ChatEvents {
  /** Fired when a new message is sent */
  onMessageSent?: (message: ChatMessage) => void;
  /** Fired when a message is received */
  onMessageReceived?: (message: ChatMessage) => void;
  /** Fired when typing starts */
  onTypingStart?: () => void;
  /** Fired when typing stops */
  onTypingEnd?: () => void;
  /** Fired when personality mood changes */
  onMoodChange?: (newMood: PersonalityMood) => void;
  /** Fired when conversation session starts */
  onSessionStart?: (session: ConversationSession) => void;
  /** Fired when conversation session ends */
  onSessionEnd?: (session: ConversationSession) => void;
  /** Fired on any error */
  onError?: (error: ChatError) => void;
}

/**
 * Error types that can occur in the chat system.
 */
export interface ChatError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Detailed error information */
  details?: any;
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Suggested action to resolve error */
  suggestedAction?: string;
}

/**
 * Props for chat-related components.
 */
export interface ChatComponentProps {
  /** Current conversation session */
  session?: ConversationSession;
  /** Chat configuration */
  config?: Partial<ConversationConfig>;
  /** Event handlers */
  events?: ChatEvents;
  /** CSS class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Whether to show debug information */
  debug?: boolean;
}

/**
 * Props specifically for message components.
 */
export interface MessageComponentProps extends ChatComponentProps {
  /** The message to display */
  message: ChatMessage;
  /** Whether this is the latest message */
  isLatest?: boolean;
  /** Whether to show avatar for this message */
  showAvatar?: boolean;
  /** Whether to show timestamp */
  showTimestamp?: boolean;
  /** Custom message renderer */
  customRenderer?: (message: ChatMessage) => React.ReactNode;
}

/**
 * Props for chat input components.
 */
export interface ChatInputProps extends ChatComponentProps {
  /** Current input state */
  inputState: ChatInputState;
  /** Callback when input changes */
  onInputChange: (text: string) => void;
  /** Callback when message is submitted */
  onSubmit: (text: string) => void;
  /** Whether to show send button */
  showSendButton?: boolean;
  /** Whether to support multiline input */
  multiline?: boolean;
  /** Auto-focus the input */
  autoFocus?: boolean;
}

/**
 * Predefined message templates for common scenarios.
 */
export const MessageTemplates = {
  GREETING: {
    type: 'text' as MessageType,
    content: '✨ Hello there! I\'m Sweet Athena, your AI assistant. How can I help you today?',
    mood: 'sweet' as PersonalityMood,
    emotion: 'excited' as EmotionalState,
  },
  THINKING: {
    type: 'thinking' as MessageType,
    content: '💭 Let me think about that...',
    mood: 'sweet' as PersonalityMood,
    emotion: 'thinking' as EmotionalState,
  },
  ERROR: {
    type: 'error' as MessageType,
    content: '😔 I\'m sorry, but something went wrong. Could you please try again?',
    mood: 'caring' as PersonalityMood,
    emotion: 'empathetic' as EmotionalState,
  },
  FAREWELL: {
    type: 'text' as MessageType,
    content: '🌸 It was lovely chatting with you! Feel free to come back anytime.',
    mood: 'sweet' as PersonalityMood,
    emotion: 'neutral' as EmotionalState,
  },
} as const;