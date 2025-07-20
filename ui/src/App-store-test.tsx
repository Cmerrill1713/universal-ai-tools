
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Test component that uses the store
function StoreTestComponent() {
  const { sidebarCollapsed, toggleSidebar } = useStore();
  
  return (
    <div style={{
      padding: '20px',
      background: '#1f2937',
      color: 'white',
      minHeight: '100vh'
    }}>
      <h1>🔧 App Store Test</h1>
      <p>Testing Store integration...</p>
      
      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#374151',
        borderRadius: '8px'
      }}>
        <h2>✅ Store Working</h2>
        <p>Sidebar collapsed: {sidebarCollapsed ? 'Yes' : 'No'}</p>
        <button 
          onClick={toggleSidebar}
          style={{
            background: '#4f46e5',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Toggle Sidebar
        </button>
        <p>Next: Add Layout...</p>
      </div>
    </div>
  );
}

// Test App with Router + QueryClient + Store
export default function AppStoreTest() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <StoreTestComponent />
      </Router>
    </QueryClientProvider>
  );
}