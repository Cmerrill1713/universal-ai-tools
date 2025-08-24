// Supabase Studio AI Helper - Paste this in the browser console
// This integrates Ollama with Supabase Studio

(function () {
  const OLLAMA_URL = 'http://localhost:8080';

  // Create global AI helper
  window.AI = {
    async generate(prompt, model = 'llama3.2:3b') {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🤖 Generating SQL for:', prompt);
      try {
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: `You are a PostgreSQL expert. Generate only SQL code for this request, no explanations or markdown: ${prompt}`,
            stream: false,
            temperature: 0.1,
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const sql = data.response
          .replace(/```sql\n?/gi, '')
          .replace(/```\n?/gi, '')
          .trim();

        console.log('✅ Generated SQL:');
        console.log(sql);

        // Try to insert into SQL editor if available
        const editor = document.querySelector('.monaco-editor textarea');
        if (editor) {
          editor.value = sql;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('📝 SQL inserted into editor');
        }

        return sql;
      } catch (error) {
        process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Error:', error.message);
        throw error;
      }
    },

    async explain(query) {
      console.log('🔍 Explaining query...');
      try {
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2:3b',
            prompt: `Explain this PostgreSQL query in simple terms: ${query}`,
            stream: false,
            temperature: 0.3,
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        console.log('📖 Explanation:');
        console.log(data.response);
        return data.response;
      } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
      }
    },

    async optimize(query) {
      console.log('⚡ Optimizing query...');
      try {
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2:3b',
            prompt: `Optimize this PostgreSQL query for better performance. Return only the optimized SQL: ${query}`,
            stream: false,
            temperature: 0.1,
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const sql = data.response
          .replace(/```sql\n?/gi, '')
          .replace(/```\n?/gi, '')
          .trim();

        console.log('✅ Optimized SQL:');
        console.log(sql);
        return sql;
      } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
      }
    },

    help() {
      console.log(`
🤖 Supabase Studio AI Helper (Powered by Ollama)
================================================

Available commands:

📝 Generate SQL:
   await AI.generate('find all active users')
   await AI.generate('count orders by status')
   await AI.generate('show tables with most rows')

🔍 Explain SQL:
   await AI.explain('SELECT * FROM users WHERE active = true')
   await AI.explain(getCurrentQuery())  // Explains current editor content

⚡ Optimize SQL:
   await AI.optimize('SELECT * FROM orders WHERE user_id IN (SELECT id FROM users)')
   await AI.optimize(getCurrentQuery())  // Optimizes current editor content

🎯 Quick examples:
   await AI.generate('find duplicate emails')
   await AI.generate('users who never ordered')
   await AI.generate('most popular products')

💡 Tips:
   - The generated SQL is automatically inserted into the editor
   - Use getCurrentQuery() to get the current editor content
   - All functions return the result for further use
      `);
    },
  };

  // Helper to get current SQL from editor
  window.getCurrentQuery = function () {
    const editor = document.querySelector('.monaco-editor textarea');
    if (editor && editor.value) {
      return editor.value;
    }

    // Try CodeMirror (older Supabase versions)
    const cm = document.querySelector('.CodeMirror');
    if (cm && cm.CodeMirror) {
      return cm.CodeMirror.getValue();
    }

    return '';
  };

  // Add keyboard shortcut (Ctrl/Cmd + Shift + G)
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      const prompt = window.prompt('Generate SQL for:');
      if (prompt) {
        await AI.generate(prompt);
      }
    }
  });

  // Show success message
  console.log(`
✅ Ollama AI Helper Loaded!
==========================
Type AI.help() for usage instructions
Or press Ctrl+Shift+G for quick SQL generation

Examples:
- await AI.generate('find all users')
- await AI.explain(getCurrentQuery())
- await AI.optimize('SELECT * FROM large_table')
  `);

  // Test connection
  fetch(`${OLLAMA_URL}/api/tags`)
    .then((r) => r.json())
    .then((data) => console.log(`🟢 Connected to Ollama (${data.models?.length || 0} models)`))
    .catch(() => process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.warn('🔴 Cannot connect to Ollama. Is nginx proxy running?'));
})();
