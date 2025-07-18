import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { AIChat } from './pages/AIChat';
import { Memory } from './pages/Memory';
import { Agents } from './pages/Agents';
import { Tools } from './pages/Tools';
import { Monitoring } from './pages/Monitoring';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { DSPyOrchestration } from './pages/DSPyOrchestration';
import { SweetAthenaDemo } from './pages/SweetAthenaDemo';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Skip authentication for local development
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" />} />
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/chat" element={<AIChat />} />
              <Route path="/memory" element={<Memory />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/dspy" element={<DSPyOrchestration />} />
              <Route path="/sweet-athena" element={<SweetAthenaDemo />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;