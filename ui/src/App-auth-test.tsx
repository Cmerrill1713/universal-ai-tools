import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useStore } from './store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Test component that uses auth
function AuthTestComponent() {
  const { isAuthenticated, loading } = useAuth();
  const { sidebarCollapsed } = useStore();
  
  return (
    <div style={{
      padding: '20px',
      background: '#1f2937',
      color: 'white',
      minHeight: '100vh'
    }}>
      <h1>🔧 App Auth Test</h1>
      <p>Testing Auth integration...</p>
      
      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#374151',
        borderRadius: '8px'
      }}>
        <h2>✅ Auth Working</h2>
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
        <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
        <p>Sidebar collapsed: {sidebarCollapsed ? 'Yes' : 'No'}</p>
        <p>Next: Add Layout...</p>
      </div>
    </div>
  );
}

// Test App with Router + QueryClient + Auth + Store
export default function AppAuthTest() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AuthTestComponent />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}