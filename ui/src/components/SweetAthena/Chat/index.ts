/**
 * Sweet Athena Chat Components - Export Index
 * 
 * Centralized export point for all chat-related components including
 * the main chat interface, message components, and chat utilities.
 * 
 * @fileoverview Chat components export index
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

// Main chat components
export { SimpleChatComponent as SweetAthenaChat } from './SimpleChatComponent';
export type { SimpleChatProps as SweetAthenaChatProps } from './SimpleChatComponent';
export type { SimpleChatProps as ChatProps } from './SimpleChatComponent';

export { SimpleChatComponent as MessageComponent } from './SimpleChatComponent';
export type { SimpleChatProps as MessageProps } from './SimpleChatComponent';

// Re-export chat-related types for convenience
export type {
  MessageRole,
  MessageType,
  MessageStatus,
  ChatMessage,
  MessageMetadata,
  MessageAttachment,
  MessageStyle,
  ConversationSession,
  ConversationConfig,
  SessionMetadata,
  TypingIndicator,
  ChatInputState,
  ChatEvents,
  ChatError,
  ChatComponentProps,
  MessageComponentProps,
  ChatInputProps,
} from '../types/chat';

export { MessageTemplates } from '../types/chat';