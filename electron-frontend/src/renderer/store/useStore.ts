import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Types
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'error';
  model?: string;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'busy';
  description?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  animationsEnabled: boolean;
  soundEnabled: boolean;
  defaultModel: string;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  autoSave: boolean;
  language: string;
  // Accessibility preferences
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    screenReaderOptimized: boolean;
    keyboardNavigation: boolean;
    focusIndicators: boolean;
    skipAnimations: boolean;
    announcements: boolean;
    largeText: boolean;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isAuthenticated: boolean;
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
  services: {
    goAPIGateway: boolean;
    rustLLMRouter: boolean;
    vectorDB: boolean;
    websocket: boolean;
  };
}

export interface AppState {
  // User
  user: User | null;

  // User preferences
  preferences: UserPreferences;

  // Chat state
  messages: Message[];
  currentChatId: string | null;
  isTyping: boolean;
  streamingContent: string;

  // Agents
  agents: Agent[];
  selectedAgent: string;

  // Connection
  connectionStatus: ConnectionStatus;
  apiEndpoint: string;

  // UI state
  sidebarOpen: boolean;
  searchQuery: string;
  activeView: 'dashboard' | 'chat' | 'services' | 'settings';
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }>;

  // Performance metrics
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    responseTime: number;
    requestCount: number;
  };
}

export interface AppActions {
  // User actions
  setCurrentUser: (user: User | null) => void;
  logout: () => void;

  // User-specific storage management
  loadUserPreferences: (userId: string) => void;
  saveUserPreferences: (userId: string) => void;
  switchUserStorageKey: (userId: string) => void;

  // Preferences
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  toggleTheme: () => void;

  // Chat actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  setTyping: (isTyping: boolean) => void;
  setStreamingContent: (content: string) => void;

  // Agent actions
  setAgents: (agents: Agent[]) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  selectAgent: (agentId: string) => void;

  // Connection actions
  setConnectionStatus: (status: Partial<ConnectionStatus>) => void;
  updateServiceStatus: (service: keyof ConnectionStatus['services'], status: boolean) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;

  // UI actions
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
  setActiveView: (view: AppState['activeView']) => void;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Metrics actions
  updateMetrics: (metrics: Partial<AppState['metrics']>) => void;

  // Reset
  reset: () => void;
}

// Default state
const defaultState: AppState = {
  user: process.env.NODE_ENV === 'development' 
    ? {
        id: 'dev-user',
        name: 'Developer',
        email: 'dev@universalaitools.com',
        isAuthenticated: true,
      }
    : null,
  preferences: {
    theme: 'system',
    animationsEnabled: true,
    soundEnabled: true,
    defaultModel: 'lm-studio',
    fontSize: 'medium',
    compactMode: false,
    autoSave: true,
    language: 'en',
    accessibility: {
      reducedMotion: false,
      highContrast: false,
      screenReaderOptimized: false,
      keyboardNavigation: true,
      focusIndicators: true,
      skipAnimations: false,
      announcements: true,
      largeText: false,
    },
  },
  messages: [],
  currentChatId: null,
  isTyping: false,
  streamingContent: '',
  agents: [],
  selectedAgent: 'lm-studio',
  connectionStatus: {
    isConnected: false,
    lastConnectedAt: null,
    reconnectAttempts: 0,
    services: {
      goAPIGateway: false,
      rustLLMRouter: false,
      vectorDB: false,
      websocket: false,
    },
  },
  apiEndpoint: 'http://localhost:8082',
  sidebarOpen: true,
  searchQuery: '',
  activeView: 'dashboard',
  notifications: [],
  metrics: {
    memoryUsage: 0,
    cpuUsage: 0,
    responseTime: 0,
    requestCount: 0,
  },
};

// Create store with fallback for localStorage issues
let rawStore: any;
try {
  // Try to create store with persistence
  rawStore = create<AppState & AppActions>()(
    devtools(
      persist(
        immer((set, get) => ({
          ...defaultState,
          // User actions
          setCurrentUser: (user: User | null) =>
            set(state => {
              state.user = user;
              // Switch to user-specific storage when user logs in
              if (user?.id) {
                // This will be handled by the ProfileLogin component calling switchUserStorageKey
              }
            }),
          logout: () =>
            set(state => {
              // Save current user's data before logout
              if (state.user?.id) {
                get().saveUserPreferences(state.user.id);
              }

              state.user = null;
              state.preferences = defaultState.preferences;
              state.messages = [];
              state.selectedAgent = defaultState.selectedAgent;
              state.sidebarOpen = defaultState.sidebarOpen;
            }),

          // User-specific storage management
          loadUserPreferences: (userId: string) => {
            try {
              const userStorageKey = `universal-ai-tools-${userId}`;
              const userPrefsData = localStorage.getItem(userStorageKey);
              if (userPrefsData) {
                const parsed = JSON.parse(userPrefsData);
                set(state => {
                  if (parsed.preferences) {
                    state.preferences = { ...defaultState.preferences, ...parsed.preferences };
                  }
                  if (parsed.selectedAgent) {
                    state.selectedAgent = parsed.selectedAgent;
                  }
                  if (parsed.sidebarOpen !== undefined) {
                    state.sidebarOpen = parsed.sidebarOpen;
                  }
                  // Keep recent messages if available
                  if (parsed.messages && Array.isArray(parsed.messages)) {
                    state.messages = parsed.messages.slice(-100);
                  }
                });
              }
            } catch (error) {
              console.warn(`Failed to load user preferences for ${userId}:`, error);
            }
          },

          saveUserPreferences: (userId: string) => {
            try {
              const userStorageKey = `universal-ai-tools-${userId}`;
              const currentState = get();
              const dataToSave = {
                preferences: currentState.preferences,
                messages: currentState.messages.slice(-100), // Keep last 100 messages
                selectedAgent: currentState.selectedAgent,
                sidebarOpen: currentState.sidebarOpen,
              };
              localStorage.setItem(userStorageKey, JSON.stringify(dataToSave));
            } catch (error) {
              console.warn(`Failed to save user preferences for ${userId}:`, error);
            }
          },

          switchUserStorageKey: (userId: string) => {
            // Load preferences for the specific user
            get().loadUserPreferences(userId);
          },
          // Preferences
          updatePreferences: preferences =>
            set(state => {
              Object.assign(state.preferences, preferences);
              // Auto-save preferences when they change and user is logged in
              if (state.user?.id) {
                // Use setTimeout to avoid calling get() during set()
                setTimeout(() => {
                  get().saveUserPreferences(state.user!.id);
                }, 0);
              }
            }),
          toggleTheme: () =>
            set(state => {
              const themes: Array<UserPreferences['theme']> = ['light', 'dark', 'system'];
              const currentIndex = themes.indexOf(state.preferences.theme);
              state.preferences.theme = themes[(currentIndex + 1) % themes.length];
              // Auto-save theme change
              if (state.user?.id) {
                setTimeout(() => {
                  get().saveUserPreferences(state.user!.id);
                }, 0);
              }
            }),
          // Chat actions
          addMessage: message =>
            set(state => {
              state.messages.push({
                ...message,
                id: Date.now().toString(),
                timestamp: new Date(),
              });
            }),
          updateMessage: (id, updates) =>
            set(state => {
              const message = state.messages.find(m => m.id === id);
              if (message) {
                Object.assign(message, updates);
              }
            }),
          deleteMessage: id =>
            set(state => {
              state.messages = state.messages.filter(m => m.id !== id);
            }),
          clearMessages: () =>
            set(state => {
              state.messages = [];
              state.currentChatId = null;
            }),
          setTyping: isTyping =>
            set(state => {
              state.isTyping = isTyping;
            }),
          setStreamingContent: content =>
            set(state => {
              state.streamingContent = content;
            }),
          // Agent actions
          setAgents: agents =>
            set(state => {
              state.agents = agents;
            }),
          updateAgent: (id, updates) =>
            set(state => {
              const agent = state.agents.find(a => a.id === id);
              if (agent) {
                Object.assign(agent, updates);
              }
            }),
          selectAgent: agentId =>
            set(state => {
              state.selectedAgent = agentId;
            }),
          // Connection actions
          setConnectionStatus: status =>
            set(state => {
              Object.assign(state.connectionStatus, status);
            }),
          updateServiceStatus: (service, status) =>
            set(state => {
              state.connectionStatus.services[service] = status;
              state.connectionStatus.isConnected = Object.values(
                state.connectionStatus.services
              ).some(s => s);
              if (status) {
                state.connectionStatus.lastConnectedAt = new Date();
              }
            }),
          incrementReconnectAttempts: () =>
            set(state => {
              state.connectionStatus.reconnectAttempts++;
            }),
          resetReconnectAttempts: () =>
            set(state => {
              state.connectionStatus.reconnectAttempts = 0;
            }),
          // UI actions
          toggleSidebar: () =>
            set(state => {
              state.sidebarOpen = !state.sidebarOpen;
            }),
          setSearchQuery: query =>
            set(state => {
              state.searchQuery = query;
            }),
          setActiveView: view =>
            set(state => {
              state.activeView = view;
            }),
          addNotification: notification =>
            set(state => {
              state.notifications.push({
                ...notification,
                id: Date.now().toString(),
                timestamp: new Date(),
              });
              if (notification.type !== 'error') {
                setTimeout(() => {
                  get().removeNotification(Date.now().toString());
                }, 5000);
              }
            }),
          removeNotification: id =>
            set(state => {
              state.notifications = state.notifications.filter(n => n.id !== id);
            }),
          clearNotifications: () =>
            set(state => {
              state.notifications = [];
            }),
          // Metrics actions
          updateMetrics: metrics =>
            set(state => {
              Object.assign(state.metrics, metrics);
            }),
          // Reset
          reset: () => set(() => defaultState),
        })),
        {
          name: 'universal-ai-tools-storage',
          storage: createJSONStorage(() => localStorage),
          partialize: state => ({
            preferences: state.preferences,
            messages: state.messages.slice(-100),
            selectedAgent: state.selectedAgent,
            sidebarOpen: state.sidebarOpen,
          }),
          // Create user-specific storage key to prevent preference mixing
          version: 1,
          migrate: (persistedState: any, version: number) => {
            // Migration logic for future versions if needed
            return persistedState;
          },
          onRehydrateStorage: () => state => {
            // When user logs in, we'll update the storage key dynamically
            if (state?.user?.id) {
              // This will be handled by a separate user-specific storage update
            }
          },
        }
      )
    )
  );
} catch (error) {
  console.warn('Failed to create store with persistence, using basic store:', error);
  // Fallback store without persistence
  rawStore = create<AppState & AppActions>()(
    devtools(
      immer((set, get) => ({
        ...defaultState,
        setCurrentUser: (user: User | null) =>
          set(state => {
            state.user = user;
          }),
        logout: () =>
          set(state => {
            // Save current user's data before logout
            if (state.user?.id) {
              get().saveUserPreferences(state.user.id);
            }

            state.user = null;
            state.preferences = defaultState.preferences;
            state.messages = [];
            state.selectedAgent = defaultState.selectedAgent;
            state.sidebarOpen = defaultState.sidebarOpen;
          }),

        // User-specific storage management (fallback)
        loadUserPreferences: (userId: string) => {
          try {
            const userStorageKey = `universal-ai-tools-${userId}`;
            const userPrefsData = localStorage.getItem(userStorageKey);
            if (userPrefsData) {
              const parsed = JSON.parse(userPrefsData);
              set(state => {
                if (parsed.preferences) {
                  state.preferences = { ...defaultState.preferences, ...parsed.preferences };
                }
                if (parsed.selectedAgent) {
                  state.selectedAgent = parsed.selectedAgent;
                }
                if (parsed.sidebarOpen !== undefined) {
                  state.sidebarOpen = parsed.sidebarOpen;
                }
                if (parsed.messages && Array.isArray(parsed.messages)) {
                  state.messages = parsed.messages.slice(-100);
                }
              });
            }
          } catch (error) {
            console.warn(`Failed to load user preferences for ${userId}:`, error);
          }
        },

        saveUserPreferences: (userId: string) => {
          try {
            const userStorageKey = `universal-ai-tools-${userId}`;
            const currentState = get();
            const dataToSave = {
              preferences: currentState.preferences,
              messages: currentState.messages.slice(-100),
              selectedAgent: currentState.selectedAgent,
              sidebarOpen: currentState.sidebarOpen,
            };
            localStorage.setItem(userStorageKey, JSON.stringify(dataToSave));
          } catch (error) {
            console.warn(`Failed to save user preferences for ${userId}:`, error);
          }
        },

        switchUserStorageKey: (userId: string) => {
          get().loadUserPreferences(userId);
        },
        updatePreferences: preferences =>
          set(state => {
            Object.assign(state.preferences, preferences);
            // Auto-save preferences when they change and user is logged in
            if (state.user?.id) {
              setTimeout(() => {
                get().saveUserPreferences(state.user!.id);
              }, 0);
            }
          }),
        toggleTheme: () =>
          set(state => {
            const themes: Array<UserPreferences['theme']> = ['light', 'dark', 'system'];
            const currentIndex = themes.indexOf(state.preferences.theme);
            state.preferences.theme = themes[(currentIndex + 1) % themes.length];
            // Auto-save theme change
            if (state.user?.id) {
              setTimeout(() => {
                get().saveUserPreferences(state.user!.id);
              }, 0);
            }
          }),
        addMessage: message =>
          set(state => {
            state.messages.push({ ...message, id: Date.now().toString(), timestamp: new Date() });
          }),
        updateMessage: (id, updates) =>
          set(state => {
            const message = state.messages.find(m => m.id === id);
            if (message) Object.assign(message, updates);
          }),
        deleteMessage: id =>
          set(state => {
            state.messages = state.messages.filter(m => m.id !== id);
          }),
        clearMessages: () =>
          set(state => {
            state.messages = [];
            state.currentChatId = null;
          }),
        setTyping: isTyping =>
          set(state => {
            state.isTyping = isTyping;
          }),
        setStreamingContent: content =>
          set(state => {
            state.streamingContent = content;
          }),
        setAgents: agents =>
          set(state => {
            state.agents = agents;
          }),
        updateAgent: (id, updates) =>
          set(state => {
            const agent = state.agents.find(a => a.id === id);
            if (agent) Object.assign(agent, updates);
          }),
        selectAgent: agentId =>
          set(state => {
            state.selectedAgent = agentId;
          }),
        setConnectionStatus: status =>
          set(state => {
            Object.assign(state.connectionStatus, status);
          }),
        updateServiceStatus: (service, status) =>
          set(state => {
            state.connectionStatus.services[service] = status;
            state.connectionStatus.isConnected = Object.values(
              state.connectionStatus.services
            ).some(s => s);
            if (status) state.connectionStatus.lastConnectedAt = new Date();
          }),
        incrementReconnectAttempts: () =>
          set(state => {
            state.connectionStatus.reconnectAttempts++;
          }),
        resetReconnectAttempts: () =>
          set(state => {
            state.connectionStatus.reconnectAttempts = 0;
          }),
        toggleSidebar: () =>
          set(state => {
            state.sidebarOpen = !state.sidebarOpen;
          }),
        setSearchQuery: query =>
          set(state => {
            state.searchQuery = query;
          }),
        setActiveView: view =>
          set(state => {
            state.activeView = view;
          }),
        addNotification: notification =>
          set(state => {
            state.notifications.push({
              ...notification,
              id: Date.now().toString(),
              timestamp: new Date(),
            });
          }),
        removeNotification: id =>
          set(state => {
            state.notifications = state.notifications.filter(n => n.id !== id);
          }),
        clearNotifications: () =>
          set(state => {
            state.notifications = [];
          }),
        updateMetrics: metrics =>
          set(state => {
            Object.assign(state.metrics, metrics);
          }),
        reset: () => set(() => defaultState),
      }))
    )
  );
}

// Create a safe wrapper that provides defaults if store is null
export const useStore = () => {
  try {
    const store = rawStore();
    return store || defaultState;
  } catch (error) {
    console.warn('Store access failed, using defaults:', error);
    return {
      ...defaultState,
      setCurrentUser: () => {},
      logout: () => {},
      loadUserPreferences: () => {},
      saveUserPreferences: () => {},
      switchUserStorageKey: () => {},
      updatePreferences: () => {},
      toggleTheme: () => {},
      addMessage: () => {},
      updateMessage: () => {},
      deleteMessage: () => {},
      clearMessages: () => {},
      setTyping: () => {},
      setStreamingContent: () => {},
      setAgents: () => {},
      updateAgent: () => {},
      selectAgent: () => {},
      setConnectionStatus: () => {},
      updateServiceStatus: () => {},
      incrementReconnectAttempts: () => {},
      resetReconnectAttempts: () => {},
      toggleSidebar: () => {},
      setSearchQuery: () => {},
      setActiveView: () => {},
      addNotification: () => {},
      removeNotification: () => {},
      clearNotifications: () => {},
      updateMetrics: () => {},
      reset: () => {},
    } as AppState & AppActions;
  }
};

// Optimized selectors to prevent unnecessary re-renders
export const useMessages = () => rawStore(state => state?.messages || []);
export const useMessagesCount = () => rawStore(state => state?.messages?.length || 0);
export const useLatestMessage = () =>
  rawStore(state => state?.messages?.[state.messages.length - 1]);
export const usePreferences = () =>
  rawStore(state => state?.preferences || defaultState.preferences);
export const useTheme = () => rawStore(state => state?.preferences?.theme || 'system');
export const useConnectionStatus = () =>
  rawStore(state => state?.connectionStatus || defaultState.connectionStatus);
export const useIsConnected = () =>
  rawStore(state => state?.connectionStatus?.isConnected || false);
export const useActiveView = () => rawStore(state => state?.activeView || 'dashboard');
export const useNotifications = () => rawStore(state => state?.notifications || []);
export const useNotificationsCount = () => rawStore(state => state?.notifications?.length || 0);
export const useSelectedAgent = () => rawStore(state => state?.selectedAgent || 'lm-studio');
export const useAgents = () => rawStore(state => state?.agents || []);
export const useIsTyping = () => rawStore(state => state?.isTyping || false);
export const useStreamingContent = () => rawStore(state => state?.streamingContent || '');
export const useMetrics = () => rawStore(state => state?.metrics || defaultState.metrics);

// Computed selectors for derived state
export const useConnectionServices = () =>
  rawStore(state => state?.connectionStatus?.services || defaultState.connectionStatus.services);

export const useHealthyServicesCount = () =>
  rawStore(state => {
    const services = state?.connectionStatus?.services || defaultState.connectionStatus.services;
    return Object.values(services).filter(Boolean).length;
  });

export const useRecentNotifications = () =>
  rawStore(state => state?.notifications?.slice(-5) || []);

export const useActiveAgents = () =>
  rawStore(state => state?.agents?.filter(agent => agent.status === 'online') || []);

export const usePerformanceHealth = () =>
  rawStore(state => {
    const metrics = state?.metrics || defaultState.metrics;
    const { memoryUsage, cpuUsage, responseTime } = metrics;
    const isHealthy = memoryUsage < 80 && cpuUsage < 70 && responseTime < 1000;
    return { isHealthy, memoryUsage, cpuUsage, responseTime };
  });
