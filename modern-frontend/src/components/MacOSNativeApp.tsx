import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';

// Import existing components
import { ChatInterface } from './ChatInterface';
import { VisionAI } from './VisionAI';
import { VoiceAI } from './VoiceAI';

// Declare Electron API interface
declare global {
  interface Window {
    electronAPI?: {
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      getSystemInfo: () => Promise<any>;
      getAppVersion: () => Promise<string>;
    };
  }
}

interface MacOSNativeAppProps {
  familyMembers: any[];
  currentUser: any;
  onSwitchUser: (userId: string) => void;
  timeBasedGreeting: string;
}

type ActiveView = 'dashboard' | 'chat' | 'vision' | 'voice' | 'agents' | 'settings';

const MacOSNativeApp: React.FC<MacOSNativeAppProps> = ({
  familyMembers,
  currentUser,
  onSwitchUser,
  timeBasedGreeting
}) => {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  const [isElectron, setIsElectron] = useState<boolean>(false);

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!window.electronAPI);
    
    if (window.electronAPI) {
      // Get system information
      window.electronAPI.getSystemInfo().then(setSystemInfo);
      window.electronAPI.getAppVersion().then(setAppVersion);
    }
  }, []);

  // Navigation items with proper macOS styling
  const navigationItems = [
    { 
      id: 'dashboard' as ActiveView, 
      name: 'Dashboard', 
      icon: '■', // Using SF Symbols-like characters
      color: '#007AFF',
      description: 'Overview and quick actions'
    },
    { 
      id: 'chat' as ActiveView, 
      name: 'Chat', 
      icon: '💬', 
      color: '#34C759',
      description: 'AI conversation interface'
    },
    { 
      id: 'vision' as ActiveView, 
      name: 'Vision', 
      icon: '👁', 
      color: '#FF9500',
      description: 'Image analysis and processing'
    },
    { 
      id: 'voice' as ActiveView, 
      name: 'Voice', 
      icon: '🎤', 
      color: '#AF52DE',
      description: 'Voice interaction and commands'
    },
    { 
      id: 'agents' as ActiveView, 
      name: 'Agents', 
      icon: '🤖', 
      color: '#FF3B30',
      description: 'AI agent management'
    },
    { 
      id: 'settings' as ActiveView, 
      name: 'Settings', 
      icon: '⚙️', 
      color: '#8E8E93',
      description: 'Application preferences'
    }
  ];

  const handleWindowControl = (action: 'minimize' | 'maximize' | 'close') => {
    if (!window.electronAPI) return;
    
    switch (action) {
      case 'minimize':
        window.electronAPI.minimizeWindow();
        break;
      case 'maximize':
        window.electronAPI.maximizeWindow();
        break;
      case 'close':
        window.electronAPI.closeWindow();
        break;
    }
  };

  const renderMainContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <div className="macos-content-area">
            <div className="macos-welcome-section">
              <h1 className="macos-welcome-title">{timeBasedGreeting}</h1>
              <p className="macos-welcome-subtitle">
                Welcome to Universal AI Tools - Your intelligent assistant for productivity and creativity.
              </p>
            </div>

            {/* Quick Actions Grid */}
            <div className="macos-quick-actions">
              <h2 className="macos-section-title">Quick Actions</h2>
              <div className="macos-action-grid">
                {navigationItems.filter(item => item.id !== 'dashboard' && item.id !== 'settings').map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className="macos-quick-action-card"
                    style={{ '--accent-color': item.color } as React.CSSProperties}
                  >
                    <div className="macos-action-icon" style={{ color: item.color }}>
                      {item.icon}
                    </div>
                    <h3 className="macos-action-title">{item.name}</h3>
                    <p className="macos-action-description">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* User Management */}
            <div className="macos-user-section">
              <h2 className="macos-section-title">Family Members</h2>
              <div className="macos-user-grid">
                {familyMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => onSwitchUser(member.id)}
                    className={`macos-user-card ${currentUser.id === member.id ? 'macos-user-active' : ''}`}
                  >
                    <div className="macos-user-avatar">{member.avatar}</div>
                    <div className="macos-user-info">
                      <h3 className="macos-user-name">{member.name}</h3>
                      <p className="macos-user-role">{member.role}</p>
                      <div className="macos-user-status">
                        {member.id === currentUser.id ? 'Active' : 'Switch'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* System Status */}
            {systemInfo && (
              <div className="macos-system-section">
                <h2 className="macos-section-title">System Information</h2>
                <div className="macos-system-info">
                  <div className="macos-info-item">
                    <span className="macos-info-label">Platform:</span>
                    <span className="macos-info-value">{systemInfo.platform}</span>
                  </div>
                  <div className="macos-info-item">
                    <span className="macos-info-label">App Version:</span>
                    <span className="macos-info-value">{appVersion}</span>
                  </div>
                  <div className="macos-info-item">
                    <span className="macos-info-label">Electron:</span>
                    <span className="macos-info-value">{systemInfo.electronVersion}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'chat':
        return (
          <div className="macos-content-area">
            <div className="macos-page-header">
              <h1 className="macos-page-title">AI Chat</h1>
              <p className="macos-page-subtitle">Have a conversation with your AI assistant</p>
            </div>
            <div className="macos-content-wrapper">
              <ChatInterface className="macos-chat-interface" />
            </div>
          </div>
        );

      case 'vision':
        return (
          <div className="macos-content-area">
            <div className="macos-page-header">
              <h1 className="macos-page-title">Vision AI</h1>
              <p className="macos-page-subtitle">Analyze and process images with AI</p>
            </div>
            <div className="macos-content-wrapper">
              <VisionAI className="macos-vision-interface" />
            </div>
          </div>
        );

      case 'voice':
        return (
          <div className="macos-content-area">
            <div className="macos-page-header">
              <h1 className="macos-page-title">Voice AI</h1>
              <p className="macos-page-subtitle">Interact using voice commands</p>
            </div>
            <div className="macos-content-wrapper">
              <VoiceAI className="macos-voice-interface" />
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="macos-content-area">
            <div className="macos-page-header">
              <h1 className="macos-page-title">Settings</h1>
              <p className="macos-page-subtitle">Configure your Universal AI Tools</p>
            </div>
            <div className="macos-settings-content">
              <div className="macos-settings-section">
                <h2 className="macos-settings-title">User Preferences</h2>
                <div className="macos-settings-item">
                  <span>Current User:</span>
                  <span>{currentUser.name}</span>
                </div>
                <div className="macos-settings-item">
                  <span>Skill Level:</span>
                  <span>{currentUser.skillLevel}</span>
                </div>
                <div className="macos-settings-item">
                  <span>Theme:</span>
                  <span>{currentUser.preferences.theme}</span>
                </div>
              </div>

              {isElectron && (
                <div className="macos-settings-section">
                  <h2 className="macos-settings-title">Window Controls</h2>
                  <div className="macos-window-controls">
                    <button 
                      onClick={() => handleWindowControl('minimize')}
                      className="macos-control-button macos-minimize"
                    >
                      Minimize Window
                    </button>
                    <button 
                      onClick={() => handleWindowControl('maximize')}
                      className="macos-control-button macos-maximize"
                    >
                      Toggle Fullscreen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return <div>Loading...</div>;
    }
  };

  return (
    <>
      <Helmet>
        <title>Universal AI Tools</title>
        <meta name="description" content="Universal AI Tools - Native macOS Application" />
      </Helmet>

      <div className="macos-app-container">
        {/* Native macOS Sidebar */}
        <nav className="macos-sidebar">
          <div className="macos-sidebar-header">
            <div className="macos-app-icon">🤖</div>
            <div className="macos-app-title">AI Tools</div>
          </div>

          <div className="macos-nav-section">
            <div className="macos-nav-title">Navigation</div>
            <ul className="macos-nav-list">
              {navigationItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveView(item.id)}
                    className={`macos-nav-item ${activeView === item.id ? 'macos-nav-active' : ''}`}
                    style={{ '--accent-color': item.color } as React.CSSProperties}
                  >
                    <span className="macos-nav-icon">{item.icon}</span>
                    <span className="macos-nav-label">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="macos-sidebar-footer">
            <div className="macos-current-user">
              <div className="macos-user-avatar-small">{currentUser.avatar}</div>
              <div className="macos-user-name-small">{currentUser.name}</div>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="macos-main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="macos-view-container"
            >
              {renderMainContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
};

export default MacOSNativeApp;