import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // UI State
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  
  // Connection State
  apiUrl: string;
  setApiUrl: (url: string) => void;
  
  // User Preferences
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  
  // Active Model
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // UI State
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      
      // Connection State
      apiUrl: 'http://localhost:3000',
      setApiUrl: (url) => set({ apiUrl: url }),
      
      // User Preferences
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      
      // Active Model
      selectedModel: 'llama3.2:3b',
      setSelectedModel: (model) => set({ selectedModel: model }),
    }),
    {
      name: 'ai-tools-storage',
    }
  )
);