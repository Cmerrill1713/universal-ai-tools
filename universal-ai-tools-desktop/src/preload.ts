import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Chat events
  onNewChat: (callback: () => void) => {
    ipcRenderer.on('new-chat', callback);
  },
  
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
      onNewChat: (callback: () => void) => void;
      onOpenSettings: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}