/**
 * Browser Module - Exports for browser automation and UI validation
 */

// Core browser components
export { BrowserAgentMessageHandler } from './browser-agent-message-handler';
export { UIValidator } from './ui-validator';

// Re-export types from individual modules
export type {
  BrowserMessage,
  BrowserMessageType,
  BrowserMessageHandler,
  BrowserMessageContext,
  BrowserMessageResponse,
  MessageHandlerConfig
} from './browser-agent-message-handler';

export type {
  UIValidationResult,
  UIValidationRule,
  UIValidationOptions,
  UIElement,
  UIElementState,
  ValidationReport,
  AccessibilityCheck,
  PerformanceMetric
} from './ui-validator';