import { ReactNode, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  MessageSquare,
  Brain,
  Users,
  Wrench,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Mic,
  Bot,
  Workflow,
  Sparkles,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { ThemeSwitcher } from './ThemeSwitcher';
import { VoiceEnabledAssistant } from './AIAssistantAvatar/VoiceEnabledAssistant';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'AI Chat', href: '/chat', icon: MessageSquare },
  { name: 'Memory', href: '/memory', icon: Brain },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Tools', href: '/tools', icon: Wrench },
  { name: 'DSPy Orchestration', href: '/dspy', icon: Workflow },
  { name: 'Sweet Athena Demo', href: '/sweet-athena', icon: Sparkles },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const { sidebarCollapsed, toggleSidebar } = useStore();
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isAssistantMinimized, setIsAssistantMinimized] = useState(false);

  // Keyboard shortcut to open assistant (Ctrl+Space)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === 'Space') {
        event.preventDefault();
        setIsAssistantOpen(true);
        setIsAssistantMinimized(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div
        className={cn(
          'relative flex flex-col bg-gray-800 transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-700">
          <div className={cn('flex items-center', sidebarCollapsed && 'justify-center')}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg" />
            {!sidebarCollapsed && (
              <span className="ml-3 text-xl font-semibold">AI Tools</span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                  sidebarCollapsed && 'justify-center'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {!sidebarCollapsed && <span className="ml-3">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 bg-gray-700 rounded-full p-1 hover:bg-gray-600 transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Universal AI Tools</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                UI: http://localhost:5173 → API: http://localhost:9999
              </span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm">Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-900 p-6">{children}</main>
      </div>
      
      {/* Floating Assistant Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsAssistantOpen(true)}
          className={cn(
            "w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-lg",
            "flex items-center justify-center transition-all duration-300 hover:scale-110",
            "border-2 border-cyan-400 hover:border-cyan-300",
            "group relative overflow-hidden"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
          <Bot className="h-6 w-6 text-white z-10" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse" />
          
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            AI Assistant (Ctrl+Space)
          </div>
          
          {/* Pulsing Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-75" />
        </button>
      </div>
      
      {/* Voice-Enabled Assistant */}
      <VoiceEnabledAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        isMinimized={isAssistantMinimized}
        onMinimize={() => setIsAssistantMinimized(!isAssistantMinimized)}
      />
      
      {/* Theme Switcher */}
      <ThemeSwitcher />
    </div>
  );
}