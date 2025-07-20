
import { BrowserRouter as Router } from 'react-router-dom';

// Test App with Router only
export default function AppRouterTest() {
  return (
    <Router>
      <div style={{
        padding: '20px',
        background: '#1f2937',
        color: 'white',
        minHeight: '100vh'
      }}>
        <h1>🔧 App Router Test</h1>
        <p>Testing Router integration...</p>
        
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#374151',
          borderRadius: '8px'
        }}>
          <h2>✅ Router Working</h2>
          <p>Next: Add QueryClient...</p>
        </div>
      </div>
    </Router>
  );
}