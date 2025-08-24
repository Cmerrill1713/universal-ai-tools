export interface ElectronAPI {
  getSystemInfo: () => Promise<any>;
  openExternal: (url: string) => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  toggleDevTools: () => void;
  reloadWindow: () => void;
  checkForUpdates: () => Promise<{ available: boolean; version?: string }>;
  getAppVersion: () => Promise<string>;
  onNavigateTo: (callback: (path: string) => void) => void;
  onNewChat: (callback: () => void) => void;
  onImportFile: (callback: (_filePath: string) => void) => void;
  onExportData: (callback: () => void) => void;
  removeAllListeners: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
