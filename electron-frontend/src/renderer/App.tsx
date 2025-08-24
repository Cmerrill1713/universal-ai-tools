import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  ServerIcon,
  Cog6ToothIcon,
  NewspaperIcon,
  BookOpenIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
// Lazy load all pages for better performance
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Chat = React.lazy(() => import('./pages/Chat'));
const Services = React.lazy(() => import('./pages/Services'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ImageGeneration = React.lazy(() =>
  import('./pages/ImageGeneration').then(module => ({ default: module.ImageGeneration }))
);
const News = React.lazy(() => import('./pages/News').then(module => ({ default: module.News })));
const Libraries = React.lazy(() =>
  import('./pages/Libraries').then(module => ({ default: module.Libraries }))
);
const ServiceMonitoring = React.lazy(() =>
  import('./pages/ServiceMonitoring').then(module => ({ default: module.ServiceMonitoring }))
);
const AccessibilitySettings = React.lazy(() => import('./pages/AccessibilitySettings'));
const ProfileLogin = React.lazy(() =>
  import('./pages/ProfileLogin').then(module => ({ default: module.ProfileLogin }))
);
import { LiquidNavBar } from './components/LiquidNavBar';
import { MorphingSearchBar } from './components/MorphingSearchBar';
import { FloatingActionButton } from './components/FloatingActionButton';
// Removed problematic floating elements to prevent overlay issues
import { ThemeProvider } from './theme/ThemeProvider';
import { FloatingThemeToggle } from './components/ThemeToggle';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KeyboardShortcutsHelp } from './hooks/useKeyboardShortcuts';
import { Logger } from './utils/logger';
import { KeyboardShortcutsProvider } from './components/KeyboardShortcutsProvider';
import { PerformanceMonitor } from './components/OptimizedComponents';
import { AccessibilityProvider } from './components/AccessibilityProvider';
import AccessibilityTestRunner from './components/AccessibilityTestRunner';
import { DevToolsDiagnostics } from './components/DevToolsDiagnostics';
import { AISelfHealingDashboard } from './components/AISelfHealingDashboard';
import { RestartMonitoringDashboard } from './components/RestartMonitoringDashboard';
import { useStore } from './store/useStore';
import { selfHealingSystem } from './services/selfHealingErrorSystem';
import './services/aiSelfHealingSystem'; // Initialize on import
// import { initializeRestartMonitoring } from './utils/initializeRestartMonitoring'; // TEMPORARILY DISABLED
import './App.css';
import './styles/glassmorphism.css';
import './styles/theme.css';
import './styles/accessibility.css';

// Page transition variants with glass effect
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    filter: 'blur(10px)',
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: -20,
    filter: 'blur(10px)',
    scale: 0.95,
  },
};

const pageTransition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
};

// Animated Routes Component
const AnimatedRoutes: React.ComponentType = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode='wait'>
      <motion.div
        key={location.pathname}
        initial='initial'
        animate='animate'
        exit='exit'
        variants={pageVariants}
        transition={pageTransition}
        className='h-full'
      >
        <React.Suspense
          fallback={
            <div className='flex items-center justify-center min-h-[50vh]'>
              <motion.div
                className='glass-card p-8 text-center'
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className='w-8 h-8 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4'
                />
                <p className='text-white/60'>Loading...</p>
              </motion.div>
            </div>
          }
        >
          <Routes location={location}>
            <Route path='/' element={<Dashboard />} />
            <Route path='/dashboard' element={<Dashboard />} />
            <Route path='/chat' element={<Chat />} />
            <Route path='/image-generation' element={<ImageGeneration />} />
            <Route path='/news' element={<News />} />
            <Route path='/libraries' element={<Libraries />} />
            <Route path='/service-monitoring' element={<ServiceMonitoring />} />
            <Route path='/services' element={<Services />} />
            <Route path='/settings' element={<Settings />} />
            <Route path='/accessibility' element={<AccessibilitySettings />} />
          </Routes>
        </React.Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

const App: React.ComponentType = () => {
  const [appVersion, setAppVersion] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const store = useStore();
  const user = store?.user;

  useEffect(() => {
    setMounted(true);

    // Initialize Self-Healing Error Systems
    Logger.info('[App] Self-Healing Error System initialized');
    Logger.info('[App] AI Self-Healing System initialized');

    // The systems initialize themselves on import, but we can add custom patterns here
    selfHealingSystem.addErrorPattern({
      id: 'electron-specific',
      pattern: /electronAPI|ipcRenderer/i,
      description: 'Electron API error',
      autoFix: (error, _context) => {
        Logger.warn('[SelfHealing] Electron API error detected', error);
        // Attempt to reconnect or fallback
      },
      telemetry: {
        category: 'electron',
        severity: 'high',
        frequency: 0,
      },
    });

    // Initialize Proactive Restart Monitoring System - TEMPORARILY DISABLED
    // initializeRestartMonitoring({
    //   enabled: true,
    //   pattern_learning_enabled: true,
    //   automated_recovery_enabled: true,
    //   alerting_enabled: process.env.NODE_ENV === 'development', // Only alert in dev
    //   health_check_interval_seconds: 30,
    // }).then(monitoringSystem => {
    //   Logger.info('[App] Proactive Restart Monitoring System initialized');
    //
    //   // Store monitoring system for global access
    //   if (typeof window !== 'undefined') {
    //     (window as any).__RESTART_MONITORING__ = monitoringSystem;
    //   }
    // }).catch(error => {
    //   Logger.error('[App] Failed to initialize restart monitoring:', error);
    // });

    // AI system will automatically connect to Supabase and start monitoring
    // Status can be checked via: aiSelfHealingSystem.getSystemStatus()

    // Get app version and system info
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setAppVersion);
      // Note: systemInfo is available but not displayed in UI currently
      window.electronAPI.getSystemInfo().catch(_error => {
        // Silently handle system info errors in production
      });

      // Set up navigation listener
      window.electronAPI.onNavigateTo((route: string) => {
        window.location.hash = route;
      });

      // Set up other listeners
      window.electronAPI.onNewChat(() => {
        // Navigate to chat page when new chat is requested
        window.location.hash = '/chat';
      });

      window.electronAPI.onImportFile((_filePath: string) => {
        // Handle file import - could be expanded to show notification
      });

      window.electronAPI.onExportData(() => {
        // Handle data export - could be expanded to show notification
      });

      // Cleanup listeners on unmount
      return () => {
        window.electronAPI.removeAllListeners();
      };
    }
    return undefined;
  }, []);

  // Show login page if no user is authenticated
  if (!user?.isAuthenticated) {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <AccessibilityProvider>
            <React.Suspense
              fallback={
                <div className='flex items-center justify-center min-h-screen bg-gradient-to-br from-red-600 via-orange-500 to-white'>
                  <div className='text-gray-800 text-lg'>Loading...</div>
                </div>
              }
            >
              <ProfileLogin />
            </React.Suspense>
          </AccessibilityProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AccessibilityProvider>
          <Router>
            <KeyboardShortcutsProvider>
              <div className='main-scroll-container min-h-screen bg-gradient-to-br from-red-600 via-orange-500 to-white relative'>
                {/* Custom draggable title bar for macOS */}
                <div className='title-bar-drag-region' />
                {/* Simple Static Background - No Overlapping Elements */}
                <div
                  className='fixed inset-0 pointer-events-none'
                  style={{
                    zIndex: -100,
                    background:
                      'radial-gradient(circle at 20% 50%, rgba(255, 0, 0, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 140, 0, 0.05) 0%, transparent 50%), radial-gradient(circle at 40% 80%, rgba(255, 255, 255, 0.08) 0%, transparent 50%)',
                  }}
                />

                {/* Glass Navigation */}
                <div className='relative z-50'>
                  <LiquidNavBar />
                </div>

                {/* Responsive Search Bar - Fixed Positioning */}
                <motion.div
                  className='fixed top-24 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-2xl px-8'
                  initial={{ y: -100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                >
                  <div className='w-full flex justify-center'>
                    <MorphingSearchBar />
                  </div>
                </motion.div>

                {/* Main Content Area - Clean Container with scrolling */}
                <main className='pt-32 pb-20 px-8 relative z-10 min-h-screen'>
                  <motion.div
                    className='max-w-7xl mx-auto relative'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {/* Version Badge - Repositioned to avoid overlap */}
                    {appVersion && (
                      <motion.div
                        className='fixed bottom-8 left-8 glass-subtle px-3 py-1 rounded-full z-30'
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.8, type: 'spring' }}
                      >
                        <span className='text-xs text-white/60 font-system'>v{appVersion}</span>
                      </motion.div>
                    )}

                    {/* Page Content */}
                    <AnimatePresence>{mounted && <AnimatedRoutes />}</AnimatePresence>
                  </motion.div>
                </main>

                {/* Floating Action Button */}
                <div className='relative z-20'>
                  <FloatingActionButton
                    position='bottom-right'
                    actions={[
                      {
                        id: 'chat',
                        label: 'New Chat',
                        icon: ChatBubbleLeftRightIcon,
                        color: '#ff0080',
                        onClick: () => (window.location.hash = '/chat'),
                      },
                      {
                        id: 'image',
                        label: 'Generate Image',
                        icon: PhotoIcon,
                        color: '#40e0d0',
                        onClick: () => (window.location.hash = '/image-generation'),
                      },
                      {
                        id: 'news',
                        label: 'AI News',
                        icon: NewspaperIcon,
                        color: '#8b5cf6',
                        onClick: () => (window.location.hash = '/news'),
                      },
                      {
                        id: 'libraries',
                        label: 'Swift Libraries',
                        icon: BookOpenIcon,
                        color: '#06b6d4',
                        onClick: () => (window.location.hash = '/libraries'),
                      },
                      {
                        id: 'monitoring',
                        label: 'Service Monitor',
                        icon: ChartBarIcon,
                        color: '#10b981',
                        onClick: () => (window.location.hash = '/service-monitoring'),
                      },
                      {
                        id: 'services',
                        label: 'View Services',
                        icon: ServerIcon,
                        color: '#ff8c00',
                        onClick: () => (window.location.hash = '/services'),
                      },
                      {
                        id: 'settings',
                        label: 'Settings',
                        icon: Cog6ToothIcon,
                        color: '#00ff00',
                        onClick: () => (window.location.hash = '/settings'),
                      },
                    ]}
                  />
                </div>

                {/* Ambient Animation Effects */}
                <motion.div
                  className='fixed bottom-0 left-0 w-full h-1 glass'
                  style={{
                    background:
                      'linear-gradient(90deg, #dc2626, #f97316, #fb923c, #fed7aa, #ffffff, #fed7aa, #fb923c, #f97316, #dc2626)',
                    backgroundSize: '200% 100%',
                  }}
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%'],
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />

                {/* Theme Toggle */}
                <div className='relative z-40'>
                  <FloatingThemeToggle />
                </div>

                {/* Keyboard Shortcuts Help Modal */}
                <div className='relative z-50'>
                  <KeyboardShortcutsHelp />
                </div>

                {/* Performance Monitor - Development Only */}
                <PerformanceMonitor showDetails={process.env.NODE_ENV === 'development'} />

                {/* Accessibility Test Runner - Development Only */}
                <AccessibilityTestRunner
                  enabled={process.env.NODE_ENV === 'development'}
                  position='bottom-left'
                  autoRun={true}
                  showDetails={true}
                />

                {/* React DevTools Diagnostics - Development Only */}
                <DevToolsDiagnostics />

                {/* AI Self-Healing Dashboard - Development Only */}
                {process.env.NODE_ENV === 'development' && <AISelfHealingDashboard />}

                {/* Restart Monitoring Dashboard - Development Only */}
                <RestartMonitoringDashboard />
              </div>
            </KeyboardShortcutsProvider>
          </Router>
        </AccessibilityProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
