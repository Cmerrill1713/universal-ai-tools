import React from 'react'

function TestApp() {
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#1a1a1a', 
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ color: '#4ade80' }}>🔥 Frontend Test - React is Working!</h1>
      <p>If you can see this, React is rendering correctly.</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
      
      <div style={{ 
        background: '#374151', 
        padding: '15px', 
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>Environment Check:</h3>
        <ul>
          <li>✅ React: Working</li>
          <li>✅ TypeScript: Compiling</li>
          <li>✅ Vite: Serving</li>
          <li>✅ Hot Reload: Active</li>
        </ul>
      </div>
      
      <button 
        onClick={() => alert('Button clicked! React events are working.')}
        style={{
          padding: '10px 20px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Test Click Event
      </button>
    </div>
  )
}

export default TestApp