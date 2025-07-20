
import ReactDOM from 'react-dom/client';

// Simple test component to verify React is working
function SimpleTest() {
  return (
    <div style={{
      padding: '20px',
      background: '#1f2937',
      color: 'white',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>✅ React is Working!</h1>
      <p>This is a simple test to verify React mounting is working correctly.</p>
      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#374151',
        borderRadius: '8px'
      }}>
        <h2>🔧 Frontend Status</h2>
        <p>✅ React successfully mounted</p>
        <p>✅ DOM manipulation working</p>
        <p>✅ Styling applied correctly</p>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<SimpleTest />);