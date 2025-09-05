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

interface ProfessionalMacOSAppProps {
  familyMembers: any[];
  currentUser: any;
  onSwitchUser: (userId: string) => void;
  timeBasedGreeting: string;
}

type ActiveView = 'home' | 'chat' | 'vision' | 'voice' | 'agents' | 'settings' | 'analytics';

const ProfessionalMacOSApp: React.FC<ProfessionalMacOSAppProps> = ({
  familyMembers,
  currentUser,
  onSwitchUser,
  timeBasedGreeting
}) => {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [appVersion, setAppVersion] = useState<string>('2.0.0');
  const [isElectron, setIsElectron] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!window.electronAPI);
    
    if (window.electronAPI) {
      window.electronAPI.getSystemInfo().then(setSystemInfo);
      window.electronAPI.getAppVersion().then(setAppVersion);
    }
  }, []);

  // Professional navigation with proper SF Symbols
  const navigationItems = [
    { 
      id: 'home' as ActiveView, 
      name: 'Home', 
      sfSymbol: '🏠',
      description: 'Overview and dashboard',
      color: '#007AFF'
    },
    { 
      id: 'chat' as ActiveView, 
      name: 'Conversations', 
      sfSymbol: '💬',
      description: 'AI chat interface',
      color: '#34C759',
      badge: '3'
    },
    { 
      id: 'vision' as ActiveView, 
      name: 'Vision', 
      sfSymbol: '👁',
      description: 'Image analysis',
      color: '#FF9500'
    },
    { 
      id: 'voice' as ActiveView, 
      name: 'Voice', 
      sfSymbol: '🎤',
      description: 'Voice assistant',
      color: '#AF52DE'
    },
    { 
      id: 'agents' as ActiveView, 
      name: 'Agents', 
      sfSymbol: '🤖',
      description: 'AI automation',
      color: '#FF3B30',
      badge: 'New'
    },
    { 
      id: 'analytics' as ActiveView, 
      name: 'Analytics', 
      sfSymbol: '📊',
      description: 'Usage insights',
      color: '#32D74B'
    }
  ];

  const renderToolbar = () => (
    <div className="apple-toolbar">
      <div className="apple-toolbar-left">
        <div className="apple-toolbar-title">Universal AI Tools</div>
        <div className="apple-toolbar-subtitle">Intelligent Assistant Platform</div>
      </div>
      
      <div className="apple-toolbar-center">
        <div className="apple-search-container">
          <div className="apple-search-icon">🔍</div>
          <input 
            type="text"
            placeholder="Search features, commands, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="apple-search-field"
          />
          <div className="apple-search-shortcut">⌘K</div>
        </div>
      </div>

      <div className="apple-toolbar-right">
        <button className="apple-toolbar-button" title="Share">📤</button>
        <button className="apple-toolbar-button" title="Notifications">🔔</button>
        <div className="apple-user-menu">
          <div className="apple-user-avatar">{currentUser.avatar}</div>
          <div className="apple-user-info">
            <div className="apple-user-name">{currentUser.name}</div>
            <div className="apple-user-status">Active</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSidebar = () => (
    <div className="apple-sidebar">
      <div className="apple-sidebar-section">
        <div className="apple-sidebar-title">Navigation</div>
        <nav className="apple-nav">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`apple-nav-item ${activeView === item.id ? 'apple-nav-active' : ''}`}
              style={{ '--accent-color': item.color } as React.CSSProperties}
            >
              <div className="apple-nav-icon">
                <span className="apple-sf-symbol">{item.sfSymbol}</span>
                {item.badge && (
                  <div className="apple-nav-badge" style={{ backgroundColor: item.color }}>
                    {item.badge}
                  </div>
                )}
              </div>
              <div className="apple-nav-content">
                <div className="apple-nav-label">{item.name}</div>
                <div className="apple-nav-description">{item.description}</div>
              </div>
            </button>
          ))}
        </nav>
      </div>

      <div className="apple-sidebar-section">
        <div className="apple-sidebar-title">Family</div>
        <div className="apple-family-list">
          {familyMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => onSwitchUser(member.id)}
              className={`apple-family-member ${currentUser.id === member.id ? 'apple-family-active' : ''}`}
            >
              <div className="apple-family-avatar">{member.avatar}</div>
              <div className="apple-family-info">
                <div className="apple-family-name">{member.name}</div>
                <div className="apple-family-role">{member.role}</div>
              </div>
              <div className="apple-family-status">
                {member.id === currentUser.id ? '●' : '○'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="apple-sidebar-footer">
        <button 
          onClick={() => setActiveView('settings')}
          className="apple-settings-button"
        >
          <span className="apple-sf-symbol">⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );

  const renderHomeView = () => (
    <div className="apple-content-home">
      {/* Hero Section */}
      <div className="apple-hero">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="apple-hero-content"
        >
          <h1 className="apple-hero-title">{timeBasedGreeting}</h1>
          <p className="apple-hero-subtitle">
            Your intelligent assistant is ready to help with conversations, image analysis, 
            voice commands, and automated workflows.
          </p>
          <div className="apple-hero-stats">
            <div className="apple-stat">
              <div className="apple-stat-number">247</div>
              <div className="apple-stat-label">Conversations</div>
            </div>
            <div className="apple-stat">
              <div className="apple-stat-number">89</div>
              <div className="apple-stat-label">Images Analyzed</div>
            </div>
            <div className="apple-stat">
              <div className="apple-stat-number">156</div>
              <div className="apple-stat-label">Voice Commands</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="apple-section">
        <h2 className="apple-section-title">Quick Actions</h2>
        <div className="apple-quick-actions">
          {navigationItems.filter(item => item.id !== 'home').map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setActiveView(item.id)}
              className="apple-action-card"
              style={{ '--accent-color': item.color } as React.CSSProperties}
            >
              <div className="apple-action-header">
                <div className="apple-action-icon" style={{ color: item.color }}>
                  {item.sfSymbol}
                </div>
                {item.badge && (
                  <div className="apple-action-badge" style={{ backgroundColor: item.color }}>
                    {item.badge}
                  </div>
                )}
              </div>
              <h3 className="apple-action-title">{item.name}</h3>
              <p className="apple-action-description">{item.description}</p>
              <div className="apple-action-chevron">›</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="apple-section">
        <h2 className="apple-section-title">Recent Activity</h2>
        <div className="apple-activity-list">
          <div className="apple-activity-item">
            <div className="apple-activity-icon" style={{ backgroundColor: '#007AFF' }}>💬</div>
            <div className="apple-activity-content">
              <div className="apple-activity-title">Conversation with AI Assistant</div>
              <div className="apple-activity-subtitle">Discussed project planning • 2 minutes ago</div>
            </div>
            <div className="apple-activity-time">2m</div>
          </div>
          <div className="apple-activity-item">
            <div className="apple-activity-icon" style={{ backgroundColor: '#FF9500' }}>👁</div>
            <div className="apple-activity-content">
              <div className="apple-activity-title">Image Analysis Completed</div>
              <div className="apple-activity-subtitle">Analyzed presentation slides • 15 minutes ago</div>
            </div>
            <div className="apple-activity-time">15m</div>
          </div>
          <div className="apple-activity-item">
            <div className="apple-activity-icon" style={{ backgroundColor: '#34C759' }}>🎤</div>
            <div className="apple-activity-content">
              <div className="apple-activity-title">Voice Command Executed</div>
              <div className="apple-activity-subtitle">Created meeting summary • 1 hour ago</div>
            </div>
            <div className="apple-activity-time">1h</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContentView = () => {
    switch (activeView) {
      case 'home':
        return renderHomeView();
      
      case 'chat':
        return (
          <div className="apple-content-page">
            <div className="apple-page-header">
              <h1 className="apple-page-title">Conversations</h1>
              <p className="apple-page-subtitle">Engage with your AI assistant</p>
              <button className="apple-primary-button">New Conversation</button>
            </div>
            <div className="apple-page-content">
              <ChatInterface className="apple-chat-interface" />
            </div>
          </div>
        );

      case 'vision':
        return (
          <div className="apple-content-page">
            <div className="apple-page-header">
              <h1 className="apple-page-title">Vision Analysis</h1>
              <p className="apple-page-subtitle">Analyze images with advanced AI</p>
              <button className="apple-primary-button">Upload Image</button>
            </div>
            <div className="apple-page-content">
              <VisionAI className="apple-vision-interface" />
            </div>
          </div>
        );

      case 'voice':
        return (
          <div className="apple-content-page">
            <div className="apple-page-header">
              <h1 className="apple-page-title">Voice Assistant</h1>
              <p className="apple-page-subtitle">Interact using natural speech</p>
              <button className="apple-primary-button">Start Recording</button>
            </div>
            <div className="apple-page-content">
              <VoiceAI className="apple-voice-interface" />
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="apple-content-page">
            <div className="apple-page-header">
              <h1 className="apple-page-title">Settings</h1>
              <p className="apple-page-subtitle">Configure your experience</p>
            </div>
            <div className="apple-settings-content">
              <div className="apple-settings-group">
                <h3 className="apple-settings-group-title">General</h3>
                <div className="apple-setting-item">
                  <div className="apple-setting-info">
                    <div className="apple-setting-label">App Version</div>
                    <div className="apple-setting-description">Current version of Universal AI Tools</div>
                  </div>
                  <div className="apple-setting-value">{appVersion}</div>
                </div>
                <div className="apple-setting-item">
                  <div className="apple-setting-info">
                    <div className="apple-setting-label">Current User</div>
                    <div className="apple-setting-description">Active family member profile</div>
                  </div>
                  <div className="apple-setting-value">{currentUser.name}</div>
                </div>
              </div>

              {isElectron && (
                <div className="apple-settings-group">
                  <h3 className="apple-settings-group-title">Window</h3>
                  <div className="apple-setting-item">
                    <button 
                      onClick={() => window.electronAPI?.minimizeWindow()}
                      className="apple-secondary-button"
                    >
                      Minimize Window
                    </button>
                    <button 
                      onClick={() => window.electronAPI?.maximizeWindow()}
                      className="apple-secondary-button"
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
        return (
          <div className="apple-content-page">
            <div className="apple-page-header">
              <h1 className="apple-page-title">Coming Soon</h1>
              <p className="apple-page-subtitle">This feature is under development</p>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <Helmet>
        <title>Universal AI Tools</title>
        <meta name="description" content="Professional AI Assistant Platform" />
      </Helmet>

      <div className="apple-app">
        {renderToolbar()}
        
        <div className="apple-main">
          {renderSidebar()}
          
          <main className="apple-content">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="apple-content-container"
              >
                {renderContentView()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
};

export default ProfessionalMacOSApp;