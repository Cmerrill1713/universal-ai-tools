// Add Ollama AI Assistant to Supabase Studio
// This adds a working AI button that uses Ollama

(function() {
  console.log('🤖 Adding Ollama AI Assistant...');
  
  // Create floating AI assistant
  const assistant = document.createElement('div');
  assistant.id = 'ollama-assistant';
  assistant.innerHTML = `
    <style>
      #ollama-assistant {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
      }
      
      #ollama-btn {
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.2s;
      }
      
      #ollama-btn:hover {
        background: #2563eb;
        transform: scale(1.1);
      }
      
      #ollama-panel {
        position: absolute;
        bottom: 70px;
        right: 0;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        width: 400px;
        display: none;
      }
      
      #ollama-panel.show {
        display: block;
      }
      
      #ollama-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        margin-bottom: 12px;
      }
      
      #ollama-generate {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        width: 100%;
        font-size: 14px;
        font-weight: 500;
      }
      
      #ollama-generate:hover {
        background: #2563eb;
      }
      
      #ollama-generate:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }
      
      #ollama-result {
        margin-top: 12px;
        padding: 12px;
        background: #f3f4f6;
        border-radius: 6px;
        font-family: monospace;
        font-size: 13px;
        white-space: pre-wrap;
        max-height: 300px;
        overflow-y: auto;
        display: none;
      }
      
      .ollama-examples {
        margin: 8px 0;
        font-size: 12px;
        color: #6b7280;
      }
      
      .ollama-example {
        display: inline-block;
        background: #e5e7eb;
        padding: 4px 8px;
        border-radius: 4px;
        margin-right: 4px;
        cursor: pointer;
      }
      
      .ollama-example:hover {
        background: #d1d5db;
      }
    </style>
    
    <button id="ollama-btn" title="Ollama AI Assistant">✨</button>
    
    <div id="ollama-panel">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
        🤖 Ollama SQL Assistant
      </h3>
      
      <input 
        type="text" 
        id="ollama-input" 
        placeholder="Describe the SQL you want..."
        autocomplete="off"
      />
      
      <div class="ollama-examples">
        <span>Try:</span>
        <span class="ollama-example" onclick="document.getElementById('ollama-input').value='show all tables'">show all tables</span>
        <span class="ollama-example" onclick="document.getElementById('ollama-input').value='count users by day'">count users by day</span>
      </div>
      
      <button id="ollama-generate">Generate SQL</button>
      
      <div id="ollama-result"></div>
    </div>
  `;
  
  document.body.appendChild(assistant);
  
  // Toggle panel
  document.getElementById('ollama-btn').addEventListener('click', () => {
    document.getElementById('ollama-panel').classList.toggle('show');
    if (document.getElementById('ollama-panel').classList.contains('show')) {
      document.getElementById('ollama-input').focus();
    }
  });
  
  // Generate SQL
  async function generateSQL() {
    const input = document.getElementById('ollama-input');
    const button = document.getElementById('ollama-generate');
    const result = document.getElementById('ollama-result');
    
    const prompt = input.value.trim();
    if (!prompt) return;
    
    button.disabled = true;
    button.textContent = 'Generating...';
    result.style.display = 'block';
    result.textContent = 'Thinking...';
    
    try {
      const response = await fetch('http://localhost:8080/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2:3b',
          prompt: `You are a PostgreSQL expert. Generate only SQL code for: ${prompt}. No explanations, no markdown, just SQL.`,
          stream: false,
          temperature: 0.1
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate SQL');
      }
      
      const data = await response.json();
      let sql = data.response || '';
      
      // Clean SQL
      sql = sql.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim();
      
      result.textContent = sql;
      
      // Copy to clipboard button
      const copyBtn = document.createElement('button');
      copyBtn.textContent = '📋 Copy';
      copyBtn.style.cssText = 'margin-top: 8px; padding: 4px 8px; background: #e5e7eb; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(sql);
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
      };
      result.appendChild(copyBtn);
      
      // Insert into editor button
      const insertBtn = document.createElement('button');
      insertBtn.textContent = '📝 Insert into Editor';
      insertBtn.style.cssText = 'margin-left: 8px; margin-top: 8px; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';
      insertBtn.onclick = () => {
        // Find Monaco editor
        const monaco = document.querySelector('.monaco-editor');
        if (monaco && monaco._domElement && monaco._domElement.__monaco) {
          const editor = monaco._domElement.__monaco.editor;
          const model = editor.getModels()[0];
          if (model) {
            model.setValue(sql);
            insertBtn.textContent = '✅ Inserted!';
            setTimeout(() => insertBtn.textContent = '📝 Insert into Editor', 2000);
          }
        } else {
          // Fallback: try to find textarea
          const textarea = document.querySelector('.monaco-editor textarea, textarea');
          if (textarea) {
            textarea.value = sql;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            insertBtn.textContent = '✅ Inserted!';
            setTimeout(() => insertBtn.textContent = '📝 Insert into Editor', 2000);
          }
        }
      };
      result.appendChild(insertBtn);
      
    } catch (error) {
      result.textContent = `Error: ${error.message}\n\nMake sure Ollama is running and the nginx proxy is started:\nnpm run ollama:nginx:start`;
      console.error('❌ Error:', error);
    } finally {
      button.disabled = false;
      button.textContent = 'Generate SQL';
    }
  }
  
  // Button click
  document.getElementById('ollama-generate').addEventListener('click', generateSQL);
  
  // Enter key
  document.getElementById('ollama-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      generateSQL();
    }
  });
  
  // Test connection
  fetch('http://localhost:8080/api/tags')
    .then(r => r.json())
    .then(data => {
      console.log(`✅ Ollama connected (${data.models?.length || 0} models)`);
      document.getElementById('ollama-btn').title = `Ollama AI Assistant (${data.models?.length || 0} models available)`;
    })
    .catch(() => {
      console.warn('❌ Cannot connect to Ollama');
      document.getElementById('ollama-btn').style.background = '#ef4444';
      document.getElementById('ollama-btn').title = 'Ollama not connected - Start nginx proxy';
    });
  
  console.log(`
✅ Ollama AI Assistant Added!
============================
- Click the ✨ button in the bottom right
- Type your SQL request
- Click Generate or press Enter
  `);
})();