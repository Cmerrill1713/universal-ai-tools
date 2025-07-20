import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Enhanced application state
interface AppState {
  // UI State
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';
  
  // User Preferences
  preferences: {
    defaultModel: string;
    voiceEnabled: boolean;
    autoScroll: boolean;
    messageFormat: 'markdown' | 'plain';
  };
  
  // Connection State
  connectionStatus: {
    backend: 'connected' | 'disconnected' | 'reconnecting';
    ollama: 'connected' | 'disconnected' | 'checking';
    websocket: 'connected' | 'disconnected' | 'reconnecting';
  };
  
  // Active Conversation
  activeConversationId: string | null;
  
  // Error State
  globalError: {
    message: string;
    type: 'error' | 'warning' | 'info' | 'success';
    timestamp: Date;
  } | null;
  
  // Backward compatibility
  apiUrl: string;
  selectedModel: string;
  
  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setPreferences: (preferences: Partial<AppState['preferences']>) => void;
  setConnectionStatus: (service: keyof AppState['connectionStatus'], status: string) => void;
  setActiveConversationId: (id: string | null) => void;
  setGlobalError: (error: AppState['globalError']) => void;
  clearGlobalError: () => void;
  setApiUrl: (url: string) => void;
  setSelectedModel: (model: string) => void;
}

export const useStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        sidebarCollapsed: false,
        theme: 'dark',
        preferences: {
          defaultModel: 'llama3.2:3b',
          voiceEnabled: false,
          autoScroll: true,
          messageFormat: 'markdown',
        },
        connectionStatus: {
          backend: 'disconnected',
          ollama: 'disconnected', 
          websocket: 'disconnected',
        },
        activeConversationId: null,
        globalError: null,
        
        // Backward compatibility
        apiUrl: 'http://localhost:3000',
        selectedModel: 'llama3.2:3b',
        
        // Actions
        toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
        setTheme: (theme) => set({ theme }),
        setPreferences: (newPreferences) => set((state) => ({
          preferences: { ...state.preferences, ...newPreferences }
        })),
        setConnectionStatus: (service, status) => set((state) => ({
          connectionStatus: { ...state.connectionStatus, [service]: status }
        })),
        setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
        setGlobalError: (globalError) => set({ globalError }),
        clearGlobalError: () => set({ globalError: null }),
        setApiUrl: (apiUrl) => set({ apiUrl }),
        setSelectedModel: (selectedModel) => set({ 
          selectedModel,
          preferences: { ...get().preferences, defaultModel: selectedModel }
        }),
      }),
      {
        name: 'ai-tools-storage',
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
          theme: state.theme,
          preferences: state.preferences,
          activeConversationId: state.activeConversationId,
          apiUrl: state.apiUrl,
          selectedModel: state.selectedModel,
        }),
      }
    ),
    {
      name: 'universal-ai-tools-store',
    }
  )
);

// Conversation management store (separate for performance)
interface ConversationState {
  conversations: Map<string, {
    id: string;
    title: string;
    model: string;
    lastActivity: Date;
    messageCount: number;
  }>;
  
  // Actions
  addConversation: (conversation: {
    id: string;
    title: string;
    model: string;
  }) => void;
  updateConversation: (id: string, updates: Partial<{
    title: string;
    model: string;
    lastActivity: Date;
    messageCount: number;
  }>) => void;
  removeConversation: (id: string) => void;
  getConversation: (id: string) => ConversationState['conversations'] extends Map<string, infer T> ? T | undefined : never;
}

export const useConversationStore = create<ConversationState>()(
  devtools(
    persist(
      (set, get) => ({
        conversations: new Map(),
        
        addConversation: (conversation) => set((state) => {
          const newConversations = new Map(state.conversations);
          newConversations.set(conversation.id, {
            ...conversation,
            lastActivity: new Date(),
            messageCount: 0,
          });
          return { conversations: newConversations };
        }),
        
        updateConversation: (id, updates) => set((state) => {
          const newConversations = new Map(state.conversations);
          const existing = newConversations.get(id);
          if (existing) {
            newConversations.set(id, { ...existing, ...updates });
          }
          return { conversations: newConversations };
        }),
        
        removeConversation: (id) => set((state) => {
          const newConversations = new Map(state.conversations);
          newConversations.delete(id);
          return { conversations: newConversations };
        }),
        
        getConversation: (id) => get().conversations.get(id),
      }),
      {
        name: 'universal-ai-tools-conversations',
        serialize: (state) => JSON.stringify({
          conversations: Array.from((state as unknown as ConversationState).conversations.entries()),
        }),
        deserialize: (str) => {
          const data = JSON.parse(str);
          return {
            ...data,
            conversations: new Map(data.conversations || []),
          };
        },
      }
    ),
    {
      name: 'conversation-store',
    }
  )
);