// Supabase Studio AI Assistant Fix - Paste this in browser console
// This will make the AI Assistant work with Ollama

(function () {
  console.log('🔧 Applying AI Assistant fix...');

  // Method 1: Override fetch to intercept all AI requests
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let [url, options = {}] = args;

    // Convert URL object to string if needed
    const urlString = typeof url === 'string' ? url : url.toString();

    // Intercept OpenAI requests
    if (
      urlString.includes('openai.com') ||
      urlString.includes('/v1/chat/completions') ||
      urlString.includes('api/ai') ||
      urlString.includes('sql/generate')
    ) {
      console.log('🎯 Intercepted AI request:', urlString);

      try {
        // Parse the request body
        let prompt = '';
        let messages = [];

        if (options.body) {
          const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
          console.log('📦 Request body:', body);

          if (body.messages) {
            messages = body.messages;
            prompt = messages.map((m) => m.content).join(' ');
          } else if (body.prompt) {
            prompt = body.prompt;
          } else if (body.query) {
            prompt = body.query;
          }
        }

        // If no prompt found, check URL params
        if (!prompt && urlString.includes('?')) {
          const params = new URLSearchParams(urlString.split('?')[1]);
          prompt = params.get('prompt') || params.get('query') || '';
        }

        console.log('💬 Prompt:', prompt);

        // Call Ollama directly
        const ollamaResponse = await originalFetch('http://localhost:8080/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2:3b',
            prompt: `You are a PostgreSQL expert. Generate only SQL code for: ${prompt}. No explanations, no markdown, just SQL.`,
            stream: false,
            temperature: 0.1,
          }),
        });

        if (!ollamaResponse.ok) {
          throw new Error(`Ollama error: ${ollamaResponse.statusText}`);
        }

        const ollamaData = await ollamaResponse.json();
        let sql = ollamaData.response || 'SELECT 1;';

        // Clean the SQL
        sql = sql
          .replace(/```sql\n?/gi, '')
          .replace(/```\n?/gi, '')
          .trim();

        console.log('✅ Generated SQL:', sql);

        // Return in the format Supabase expects
        const fakeResponse = {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            sql: sql,
            query: sql,
            result: sql,
            content: sql,
            text: sql,
            data: { sql: sql },
            choices: [
              {
                message: { content: sql },
                text: sql,
              },
            ],
          }),
          text: async () => sql,
          clone: () => fakeResponse,
        };

        return fakeResponse;
      } catch (error) {
        console.error('❌ Error:', error);

        // Return a valid SQL as fallback
        const fallbackSQL = `-- Error: ${error.message}\nSELECT 'Error generating SQL' as error;`;

        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ sql: fallbackSQL, content: fallbackSQL }),
          text: async () => fallbackSQL,
          clone: () => this,
        };
      }
    }

    // For non-AI requests, use original fetch
    return originalFetch.apply(this, args);
  };

  // Method 2: Find and patch the AI button directly
  function patchAIButton() {
    // Find all buttons that might be AI-related
    const buttons = document.querySelectorAll('button');
    let aiButton = null;

    for (const btn of buttons) {
      const text = btn.textContent || '';
      const title = btn.title || '';
      const ariaLabel = btn.getAttribute('aria-label') || '';

      if (
        text.includes('AI') ||
        text.includes('Assistant') ||
        title.includes('AI') ||
        ariaLabel.includes('AI') ||
        btn.querySelector('[class*="ai"]') ||
        btn.querySelector('[class*="assist"]')
      ) {
        console.log('🎯 Found potential AI button:', btn);
        aiButton = btn;

        // Clone to remove existing handlers
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        // Add our handler
        newBtn.addEventListener('click', async (e) => {
          console.log('🖱️ AI button clicked!');

          // Wait for any modal or input to appear
          setTimeout(async () => {
            // Find the input field
            const inputs = document.querySelectorAll('input[type="text"], textarea');
            const modal = document.querySelector('[role="dialog"]');

            if (modal) {
              console.log('📝 Found modal, patching submit...');

              // Find submit button in modal
              const submitBtns = modal.querySelectorAll('button');
              for (const submitBtn of submitBtns) {
                if (
                  submitBtn.textContent.includes('Generate') ||
                  submitBtn.textContent.includes('Submit') ||
                  submitBtn.type === 'submit'
                ) {
                  const newSubmit = submitBtn.cloneNode(true);
                  submitBtn.parentNode.replaceChild(newSubmit, submitBtn);

                  newSubmit.addEventListener('click', async () => {
                    console.log('🚀 Intercepting generate request...');
                    // The fetch override will handle the actual request
                  });
                }
              }
            }
          }, 500);
        });
      }
    }

    return aiButton;
  }

  // Method 3: Monitor for dynamically added elements
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Check for new buttons
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            if (node.tagName === 'BUTTON' || node.querySelector('button')) {
              patchAIButton();
            }
          }
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial patch
  const aiBtn = patchAIButton();

  // Method 4: Override XMLHttpRequest as backup
  const originalXHR = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    console.log('📡 XHR:', method, url);

    if (url.includes('openai') || url.includes('/ai/')) {
      console.log('🎯 Intercepted AI XHR!');
      // Redirect to our proxy
      url = url.replace(/https?:\/\/[^\/]+/, 'http://localhost:8081');
    }

    return originalXHR.call(this, method, url, ...args);
  };

  console.log(`
✅ AI Assistant Fix Applied!
===========================
- All AI requests now go to Ollama
- Try clicking the AI Assistant button
- Type: "show all tables" to test
  `);

  // Test the connection
  fetch('http://localhost:8080/api/tags')
    .then((r) => r.json())
    .then((data) => console.log(`🟢 Ollama connected (${data.models?.length || 0} models)`))
    .catch(() => console.warn('🔴 Ollama not reachable. Is the proxy running?'));

  // Also try the OpenAI proxy
  fetch('http://localhost:8081/')
    .then((r) => r.json())
    .then((data) => console.log(`🟢 OpenAI proxy connected`))
    .catch(() => console.warn('🔴 OpenAI proxy not reachable'));
})();
