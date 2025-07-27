import React from 'react';

function DebugApp() {
  console.log('🔥 DebugApp component rendering...');
  
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#000',
      color: '#0f0',
      fontFamily: 'monospace',
      minHeight: '100vh'
    }}>
      <h1>🔥 DEBUG MODE - FRONTEND IS WORKING!</h1>
      <p>✅ React is mounting and rendering successfully</p>
      <p>✅ TypeScript is compiling</p>
      <p>✅ Vite is serving correctly</p>
      <p>✅ Hot reload is active</p>
      
      <div style={{ margin: '20px 0', padding: '15px', background: '#333', color: '#fff' }}>
        <h3>Environment Info:</h3>
        <p>Mode: {import.meta.env.MODE}</p>
        <p>Base URL: {import.meta.env.BASE_URL}</p>
        <p>Dev: {import.meta.env.DEV ? 'true' : 'false'}</p>
      </div>
      
      <button 
        onClick={() => alert('✅ JavaScript events are working!')}
        style={{
          padding: '15px 30px',
          fontSize: '16px',
          backgroundColor: '#0f0',
          color: '#000',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Test Click (Should show alert)
      </button>
    </div>
  );
}

export default DebugApp;