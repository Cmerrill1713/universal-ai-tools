
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Test App with Router + QueryClient
export default function AppQueryTest() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div style={{
          padding: '20px',
          background: '#1f2937',
          color: 'white',
          minHeight: '100vh'
        }}>
          <h1>🔧 App Query Test</h1>
          <p>Testing QueryClient integration...</p>
          
          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#374151',
            borderRadius: '8px'
          }}>
            <h2>✅ QueryClient Working</h2>
            <p>Next: Add Store...</p>
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  );
}