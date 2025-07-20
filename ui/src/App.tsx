import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { LayoutSimple as Layout } from './components/Layout-simple';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { ToastContainer } from './components/Toast';
import { Dashboard } from './pages/Dashboard';
import { AIChat } from './pages/AIChat';
import { Memory } from './pages/Memory';
import { Agents } from './pages/Agents';
import { Tools } from './pages/Tools';
import { Monitoring } from './pages/Monitoring';
import { Settings } from './pages/Settings';
import { DSPyOrchestration } from './pages/DSPyOrchestration';
import { SweetAthenaDemo } from './pages/SweetAthenaDemo';
import { AthenaDashboard } from './pages/AthenaDashboard';
import WidgetCreatorPage from './pages/WidgetCreator';
import PerformanceDashboard from './pages/PerformanceDashboard';
import OptimizedAthenaDemo from './pages/OptimizedAthenaDemo';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on authentication errors
        if (error?.response?.status === 401) return false;
        // Don't retry on client errors (4xx)
        if (error?.response?.status >= 400 && error?.response?.status < 500) return false;
        // Retry up to 2 times for server errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Note: Authentication is skipped for local development

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" />} />
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={
                <ErrorBoundary name="AthenaDashboard">
                  <AthenaDashboard />
                </ErrorBoundary>
              } />
              <Route path="/classic-dashboard" element={
                <ErrorBoundary name="Dashboard">
                  <Dashboard />
                </ErrorBoundary>
              } />
              <Route path="/chat" element={
                <ErrorBoundary name="AIChat">
                  <AIChat />
                </ErrorBoundary>
              } />
              <Route path="/memory" element={
                <ErrorBoundary name="Memory">
                  <Memory />
                </ErrorBoundary>
              } />
              <Route path="/agents" element={
                <ErrorBoundary name="Agents">
                  <Agents />
                </ErrorBoundary>
              } />
              <Route path="/tools" element={
                <ErrorBoundary name="Tools">
                  <Tools />
                </ErrorBoundary>
              } />
              <Route path="/dspy" element={
                <ErrorBoundary name="DSPyOrchestration">
                  <DSPyOrchestration />
                </ErrorBoundary>
              } />
              <Route path="/sweet-athena" element={
                <ErrorBoundary name="SweetAthenaDemo">
                  <SweetAthenaDemo />
                </ErrorBoundary>
              } />
              <Route path="/optimized-athena" element={
                <ErrorBoundary name="OptimizedAthenaDemo">
                  <OptimizedAthenaDemo />
                </ErrorBoundary>
              } />
              <Route path="/widget-studio" element={
                <ErrorBoundary name="WidgetCreator">
                  <WidgetCreatorPage />
                </ErrorBoundary>
              } />
              <Route path="/performance" element={
                <ErrorBoundary name="PerformanceDashboard">
                  <PerformanceDashboard />
                </ErrorBoundary>
              } />
              <Route path="/monitoring" element={
                <ErrorBoundary name="Monitoring">
                  <Monitoring />
                </ErrorBoundary>
              } />
              <Route path="/settings" element={
                <ErrorBoundary name="Settings">
                  <Settings />
                </ErrorBoundary>
              } />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AuthProvider>
            <AppRoutes />
            <ToastContainer />
          </AuthProvider>
        </Router>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;