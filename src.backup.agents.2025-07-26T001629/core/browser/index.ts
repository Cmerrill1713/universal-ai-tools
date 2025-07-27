/**
 * Browser Module - Exports for browser automation and U.I validation*/

// Core browser components;
export { BrowserAgentMessage.Handler } from './browser-agent-message-handler';
export { UI.Validator } from './ui-validator'// Re-export types from individual modules;
export type {
  BrowserAgent.Message;
  BrowserAgentMessage.Type;
  BrowserAgentMessage.Content;
  TaskAssignment.Message;
  TaskDelegation.Message;
  ProgressUpdate.Message;
  StatusReport.Message;
  ResourceRequest.Message;
  ResourceShare.Message;
  CoordinationSync.Message;
  ErrorNotification.Message;
  RecoveryRequest.Message;
  KnowledgeShare.Message;
  PerformanceMetrics.Message;
  CoordinationFeedback.Message;
  MessageHandler.Config;
  MessageHandler.Stats} from './browser-agent-message-handler';
export type { Validation.Result, Test.Result } from './ui-validator';