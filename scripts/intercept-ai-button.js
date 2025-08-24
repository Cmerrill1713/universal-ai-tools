// Supabase Studio AI Button Interceptor
// This script intercepts the AI Assistant button clicks and redirects to Ollama

(function () {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔍 Setting up AI Button interceptor...');

  // Store original fetch
  const originalFetch = window.fetch;

  // Override fetch to intercept AI requests
  window.fetch = async function (...args) {
    const [url, options] = args;

    // Log all requests to find AI endpoint
    if (typeof url === 'string') {
      console.log('📡 Request:', url);

      // Check for OpenAI or AI-related endpoints
      if (
        url.includes('openai.com') ||
        url.includes('/ai/') ||
        url.includes('completion') ||
        url.includes('chat') ||
        url.includes('sql/generate')
      ) {
        console.log('🎯 Intercepted AI request!');
        console.log('URL:', url);
        console.log('Options:', options);

        // Parse the request
        let prompt = '';
        try {
          const body = JSON.parse(options.body);
          prompt = body.messages?.[0]?.content || body.prompt || body.query || '';
          console.log('Prompt:', prompt);
        } catch (e) {
          console.log('Could not parse body:', options.body);
        }

        // Redirect to Ollama
        try {
          const ollamaResponse = await originalFetch('http://localhost:8080/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama3.2:3b',
              prompt: `You are a PostgreSQL expert. Generate only SQL code for: ${prompt}`,
              stream: false,
              temperature: 0.1,
            }),
          });

          const ollamaData = await ollamaResponse.json();
          const sql =
            ollamaData.response
              ?.replace(/```sql\n?/gi, '')
              .replace(/```\n?/gi, '')
              .trim() || '';

          // Return in OpenAI format
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: sql,
                    role: 'assistant',
                  },
                  finish_reason: 'stop',
                },
              ],
              model: 'llama3.2:3b',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } catch (error) {
          process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Ollama error:', error);
          throw error;
        }
      }
    }

    // For all other requests, use original fetch
    return originalFetch.apply(this, args);
  };

  // Also intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    console.log('📡 XHR Request:', method, url);

    if (url.includes('openai.com') || url.includes('/ai/')) {
      console.log('🎯 Intercepted AI XHR request!');
      // Store for later interception
      this._isAIRequest = true;
      this._aiURL = url;
    }

    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  // Find and monitor the AI button
  function findAIButton() {
    // Look for buttons with AI-related text or icons
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent || '';
      const hasAIText =
        text.includes('AI') || text.includes('Assistant') || text.includes('Generate');
      const hasAIIcon =
        button.querySelector('[data-icon="sparkles"]') ||
        button.querySelector('[data-icon="robot"]') ||
        button.querySelector('svg path[d*="sparkle"]');

      if (hasAIText || hasAIIcon) {
        console.log('🎯 Found AI button:', button);

        // Clone and replace to remove existing listeners
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        // Add our click handler
        newButton.addEventListener('click', async (e) => {
          console.log('🖱️ AI Button clicked!');

          // Let the original handler run to see what it does
          setTimeout(() => {
            // Check if a modal or input appeared
            const modal = document.querySelector('[role="dialog"]');
            const textarea =
              document.querySelector('textarea[placeholder*="Describe"]') ||
              document.querySelector('textarea[placeholder*="Generate"]');

            if (modal || textarea) {
              console.log('📝 Found AI input modal/textarea');
              interceptAISubmit();
            }
          }, 100);
        });
      }
    }
  }

  // Intercept AI form submissions
  function interceptAISubmit() {
    const forms = document.querySelectorAll('form');
    forms.forEach((form) => {
      form.addEventListener('submit', async (e) => {
        const textarea = form.querySelector('textarea');
        if (textarea && textarea.value) {
          console.log('📤 Intercepting form submit with prompt:', textarea.value);
          // The fetch interceptor will handle the actual request
        }
      });
    });
  }

  // Set up mutation observer to catch dynamically added buttons
  const observer = new MutationObserver((mutations) => {
    findAIButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial scan
  findAIButton();

  console.log(`
✅ AI Button Interceptor Active!
===================================
- All OpenAI requests will be redirected to Ollama
- Click the AI Assistant button to test
- Check console for intercepted requests
  `);
})();
