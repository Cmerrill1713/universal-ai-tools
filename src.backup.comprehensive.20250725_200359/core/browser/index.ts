/**
 * Browser Module - Exports for browser automation and U.I validation*/

// Core browser components;
export { BrowserAgent.Message.Handler } from './browser-agent-message-handler';
export { U.I.Validator } from './ui-validator'// Re-export types from individual modules;
export type {
  Browser.Agent.Message;
  BrowserAgent.Message.Type;
  BrowserAgent.Message.Content;
  Task.Assignment.Message;
  Task.Delegation.Message;
  Progress.Update.Message;
  Status.Report.Message;
  Resource.Request.Message;
  Resource.Share.Message;
  Coordination.Sync.Message;
  Error.Notification.Message;
  Recovery.Request.Message;
  Knowledge.Share.Message;
  Performance.Metrics.Message;
  Coordination.Feedback.Message;
  Message.Handler.Config;
  Message.Handler.Stats} from './browser-agent-message-handler';
export type { Validation.Result, Test.Result } from './ui-validator';