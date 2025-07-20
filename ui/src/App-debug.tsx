

// Simple debug version of App to isolate the issue
export default function AppDebug() {
  return (
    <div style={{
      padding: '20px',
      background: '#1f2937',
      color: 'white',
      minHeight: '100vh'
    }}>
      <h1>🔧 App Debug Mode</h1>
      <p>Testing step-by-step component loading...</p>
      
      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#374151',
        borderRadius: '8px'
      }}>
        <h2>✅ Basic App Structure Working</h2>
        <p>Next: Add Router...</p>
      </div>
    </div>
  );
}