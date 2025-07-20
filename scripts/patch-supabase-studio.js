// Supabase Studio Patcher - Redirects AI to Ollama
// This patches the Supabase Studio to use Ollama instead of OpenAI

(function() {
  console.log('🔧 Patching Supabase Studio for Ollama...');
  
  // Method 1: Override the OpenAI configuration
  if (window.__SUPABASE_STUDIO_CONFIG__) {
    console.log('📝 Found Studio config, patching...');
    window.__SUPABASE_STUDIO_CONFIG__.OPENAI_API_KEY = 'ollama-proxy';
    window.__SUPABASE_STUDIO_CONFIG__.OPENAI_API_URL = 'http://localhost:8080/v1';
  }
  
  // Method 2: Intercept localStorage/sessionStorage
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (key.includes('openai') || key.includes('OPENAI')) {
      console.log('🎯 Intercepted OpenAI config:', key);
      if (key.includes('url') || key.includes('URL')) {
        value = 'http://localhost:8080/v1';
      }
    }
    return originalSetItem.call(this, key, value);
  };
  
  // Method 3: Override fetch to redirect OpenAI to Ollama
  const originalFetch = window.fetch;
  window.fetch = async function(url, options = {}) {
    let actualUrl = typeof url === 'string' ? url : url.toString();
    
    // Log AI-related requests
    if (actualUrl.includes('api.openai.com') || 
        actualUrl.includes('/chat/completions') ||
        actualUrl.includes('ai-query') ||
        actualUrl.includes('sql-gen')) {
      
      console.log('🎯 Intercepted AI request:', actualUrl);
      console.log('📦 Request body:', options.body);
      
      // Parse OpenAI format
      let messages = [];
      let prompt = '';
      
      try {
        const body = JSON.parse(options.body || '{}');
        
        // Handle OpenAI chat format
        if (body.messages) {
          messages = body.messages;
          prompt = messages.map(m => m.content).join('\n');
        } else if (body.prompt) {
          prompt = body.prompt;
        } else if (body.query) {
          prompt = body.query;
        }
        
        console.log('💬 Extracted prompt:', prompt);
        
        // Determine the intent
        let ollamaPrompt = prompt;
        if (prompt.toLowerCase().includes('generate') || 
            prompt.toLowerCase().includes('create') ||
            prompt.toLowerCase().includes('write')) {
          ollamaPrompt = `You are a PostgreSQL expert. Generate only SQL code for: ${prompt}. No explanations, just SQL.`;
        }
        
        // Call Ollama
        const ollamaResponse = await originalFetch('http://localhost:8080/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2:3b',
            prompt: ollamaPrompt,
            stream: false,
            temperature: 0.1
          })
        });
        
        const ollamaData = await ollamaResponse.json();
        let result = ollamaData.response || '';
        
        // Clean SQL
        result = result.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim();
        
        console.log('✅ Ollama response:', result);
        
        // Return in OpenAI format
        const openAIResponse = {
          id: 'ollama-' + Date.now(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'llama3.2:3b',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: result
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: prompt.length,
            completion_tokens: result.length,
            total_tokens: prompt.length + result.length
          }
        };
        
        return new Response(JSON.stringify(openAIResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('❌ Error processing request:', error);
        
        // Return error in OpenAI format
        return new Response(JSON.stringify({
          error: {
            message: `Ollama error: ${error.message}`,
            type: 'ollama_error',
            code: 'ollama_unavailable'
          }
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // For all other requests, use original fetch
    return originalFetch.call(this, url, options);
  };
  
  // Method 4: Patch the studio's internal AI service
  function patchAIService() {
    // Look for common AI service patterns
    const checkPatches = () => {
      // Check for OpenAI client
      if (window.OpenAI || window.openai) {
        console.log('🎯 Found OpenAI client, patching...');
        const client = window.OpenAI || window.openai;
        if (client.apiKey) client.apiKey = 'ollama';
        if (client.baseURL) client.baseURL = 'http://localhost:8080/v1';
        if (client.basePath) client.basePath = 'http://localhost:8080/v1';
      }
      
      // Check React components
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        const components = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers;
        // This would need more sophisticated React patching
      }
    };
    
    // Check periodically
    checkPatches();
    setInterval(checkPatches, 1000);
  }
  
  // Method 5: Create a proxy button that works
  function addWorkingAIButton() {
    const checkForSQLEditor = setInterval(() => {
      const editor = document.querySelector('.monaco-editor');
      const toolbar = document.querySelector('[class*="toolbar"]') || 
                      document.querySelector('[class*="Toolbar"]') ||
                      document.querySelector('.flex.items-center.gap-2');
      
      if (editor && toolbar && !document.querySelector('#ollama-ai-btn')) {
        console.log('📝 Found SQL editor, adding Ollama button...');
        
        const button = document.createElement('button');
        button.id = 'ollama-ai-btn';
        button.className = 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1';
        button.innerHTML = '✨ AI Generate (Ollama)';
        
        button.onclick = async () => {
          const prompt = window.prompt('What SQL would you like to generate?');
          if (!prompt) return;
          
          button.disabled = true;
          button.innerHTML = '⏳ Generating...';
          
          try {
            const response = await fetch('http://localhost:8080/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'llama3.2:3b',
                prompt: `Generate PostgreSQL for: ${prompt}. Return only SQL code.`,
                stream: false
              })
            });
            
            const data = await response.json();
            const sql = data.response?.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim() || '';
            
            // Insert into Monaco editor
            const monaco = editor._domElement.__monaco;
            if (monaco) {
              const model = monaco.editor.getModels()[0];
              if (model) {
                model.setValue(sql);
              }
            } else {
              // Fallback: try to set via textarea
              const textarea = editor.querySelector('textarea');
              if (textarea) {
                textarea.value = sql;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
            
            button.innerHTML = '✨ AI Generate (Ollama)';
          } catch (error) {
            alert('Error: ' + error.message);
            button.innerHTML = '✨ AI Generate (Ollama)';
          } finally {
            button.disabled = false;
          }
        };
        
        toolbar.appendChild(button);
        clearInterval(checkForSQLEditor);
      }
    }, 1000);
  }
  
  // Start patching
  patchAIService();
  addWorkingAIButton();
  
  console.log(`
✅ Supabase Studio Patched for Ollama!
=====================================
- OpenAI requests → Ollama (localhost:8080)
- Added "AI Generate (Ollama)" button
- Original AI button should now use Ollama
  `);
  
  // Test connection
  fetch('http://localhost:8080/api/tags')
    .then(r => r.json())
    .then(data => console.log(`🟢 Ollama connected (${data.models?.length || 0} models)`))
    .catch(() => console.warn('🔴 Ollama not accessible'));
})();