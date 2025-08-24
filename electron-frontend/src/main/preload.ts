// import React from 'react'; // Not needed in preload script
import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for Electron APIs
interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  icon?: string;
  cancelId?: number;
  noLink?: boolean;
  normalizeAccessKeys?: boolean;
}

interface MessageBoxReturnValue {
  response: number;
  checkboxChecked: boolean;
}

interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),

  // Dialog
  showMessageBox: (options: MessageBoxOptions) => ipcRenderer.invoke('show-message-box', options),

  // Navigation
  onNavigateTo: (callback: (route: string) => void) => {
    ipcRenderer.on('navigate-to', (_, route) => callback(route));
  },

  // Chat actions
  onNewChat: (callback: () => void) => {
    ipcRenderer.on('new-chat', () => callback());
  },

  // File operations
  onImportFile: (callback: (_filePath: string) => void) => {
    ipcRenderer.on('import-file', (_, _filePath) => callback(_filePath));
  },

  onExportData: (callback: () => void) => {
    ipcRenderer.on('export-data', () => callback());
  },

  // System integration
  openExternal: (url: string) => {
    // This will be handled by the main process automatically
    window.open(url, '_blank');
  },

  // Remove all listeners (cleanup)
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('navigate-to');
    ipcRenderer.removeAllListeners('new-chat');
    ipcRenderer.removeAllListeners('import-file');
    ipcRenderer.removeAllListeners('export-data');
  },
});

// Expose a type definition for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getSystemInfo: () => Promise<SystemInfo>;
      getConfig: () => Promise<Record<string, string>>;
      showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxReturnValue>;
      onNavigateTo: (callback: (route: string) => void) => void;
      onNewChat: (callback: () => void) => void;
      onImportFile: (callback: (_filePath: string) => void) => void;
      onExportData: (callback: () => void) => void;
      openExternal: (url: string) => void;
      removeAllListeners: () => void;
    };
  }
}
