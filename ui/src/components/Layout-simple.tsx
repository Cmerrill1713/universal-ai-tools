import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export function LayoutSimple({ children }: LayoutProps) {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: '✨ Sweet Athena', description: 'AI Creation Assistant' },
    { path: '/widget-studio', label: '🎨 Widget Studio', description: 'Widget Creator' },
    { path: '/classic-dashboard', label: '📊 Classic Dashboard', description: 'System Overview' },
    { path: '/chat', label: '💬 AI Chat', description: 'Chat Interface' },
    { path: '/performance', label: '⚡ Performance', description: 'System Monitoring' },
    { path: '/agents', label: '🤖 Agents', description: 'AI Agents' },
    { path: '/memory', label: '🧠 Memory', description: 'Knowledge Base' },
    { path: '/tools', label: '🔧 Tools', description: 'Available Tools' },
    { path: '/dspy', label: '🔮 DSPy', description: 'Orchestration' },
    { path: '/settings', label: '⚙️ Settings', description: 'Configuration' }
  ];

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#0f0f0f',
      color: 'white'
    }}>
      {/* Enhanced Sidebar */}
      <div style={{
        width: '280px',
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
        padding: '20px',
        overflowY: 'auto',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          marginBottom: '30px',
          textAlign: 'center'
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '5px'
          }}>
            🚀 Universal AI Tools
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#888' }}>Next-Gen AI Platform</p>
        </div>
        
        <nav>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  marginBottom: '8px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
                  textDecoration: 'none',
                  color: isActive ? '#667eea' : '#fff',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.transform = 'translateX(5px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                <div style={{ fontSize: '1rem', marginBottom: '2px' }}>{item.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>{item.description}</div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a'
      }}>
        {/* Header - Only show for non-Athena routes */}
        {location.pathname !== '/' && (
          <header style={{
            background: 'rgba(26, 26, 46, 0.8)',
            padding: '15px 30px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
                {navItems.find(item => item.path === location.pathname)?.label || 'Universal AI Tools'}
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px'
              }}>
                <span style={{ fontSize: '0.9rem', color: '#888' }}>
                  {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
          </header>
        )}

        {/* Page Content */}
        <main style={{
          flex: 1,
          padding: location.pathname === '/' ? '0' : '20px',
          overflow: 'auto',
          position: 'relative'
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}