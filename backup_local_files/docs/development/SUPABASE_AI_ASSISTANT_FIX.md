# Fix for Supabase Studio AI Assistant Error
## The Issue

When you click the AI Assistant button in Supabase Studio, you get an error because it expects OpenAI API, but we're using Ollama locally.
## The Solution

We've set up an nginx proxy to bridge Ollama with Supabase. Here's how to use it:
### Method 1: Direct SQL Functions (Recommended)
Instead of using the AI Assistant button, use these SQL functions directly in the SQL Editor:
```sql

-- Generate SQL from natural language

SELECT ai_generate_sql('show all users created this week');
-- Explain a query

SELECT ai_explain_sql('SELECT * FROM users u JOIN orders o ON u.id = o.user_id');
-- Optimize a query

SELECT ai_optimize_sql('SELECT * FROM large_table WHERE status = ''active''');

```
### Method 2: Browser Console Helper
Open the browser console (F12) while in Supabase Studio and paste this:
```javascript

// Ollama AI Assistant Helper

window.ollamaAI = {

  async generate(prompt) {

    const response = await fetch('http://localhost:8080/api/generate', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        model: 'llama3.2:3b',

        prompt: `Generate PostgreSQL query for: ${prompt}. Return only SQL code.`,

        stream: false

      })

    });

    const data = await response.json();

    const sql = data.response.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();

    console.log(sql);

    return sql;

  },

  

  async explain(query) {

    const response = await fetch('http://localhost:8080/api/generate', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        model: 'llama3.2:3b',

        prompt: `Explain this SQL query: ${query}`,

        stream: false

      })

    });

    const data = await response.json();

    console.log(data.response);

    return data.response;

  }

};
console.log('✅ Ollama AI Assistant loaded! Usage:');

console.log('- await ollamaAI.generate("find all active users")');

console.log('- await ollamaAI.explain("SELECT * FROM users")');

```
Then use it like:

```javascript

// Generate SQL

await ollamaAI.generate('find users who logged in today')
// Explain SQL

await ollamaAI.explain('SELECT COUNT(*) FROM orders WHERE total > 1000')

```
### Method 3: Custom Bookmarklet
Create a bookmark with this as the URL:
```javascript

javascript:(async()=>{window.ollamaAI={async generate(p){const r=await fetch('http://localhost:8080/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'llama3.2:3b',prompt:`Generate PostgreSQL query for: ${p}. Return only SQL code.`,stream:false})});const d=await r.json();return d.response.replace(/```sql\n?/g,'').replace(/```\n?/g,'').trim();}};alert('Ollama AI ready! Use: await ollamaAI.generate("your prompt")')})();

```
Click the bookmark while in Supabase Studio to load the AI helper.
## Prerequisites
1. **Ollama must be running**

   ```bash

   ollama serve

   ```
2. **Nginx proxy must be running**

   ```bash

   npm run ollama:nginx:start

   ```
3. **Check if working**

   ```bash

   npm run ollama:nginx:test

   ```
## Available Models
You can use any Ollama model by changing the model parameter:

- `llama3.2:3b` - Fast, good for simple queries

- `qwen2.5:7b` - Better for complex queries

- `deepseek-r1:14b` - Best quality

- `phi:2.7b-chat-v2-q4_0` - Very fast
## Troubleshooting
### "Failed to connect" error

1. Check Ollama is running: `curl http://localhost:11434/api/tags`

2. Check nginx is running: `docker ps | grep ollama-proxy`

3. Restart nginx: `npm run ollama:nginx:stop && npm run ollama:nginx:start`
### Slow responses

- Use a smaller model like `phi:2.7b-chat-v2-q4_0`

- Check Ollama isn't overloaded: `ollama ps`
### CORS errors

- The nginx proxy handles CORS, but if you still get errors, use the SQL functions instead
## Summary
While the Supabase Studio AI Assistant button won't work directly with Ollama, you have several alternatives:

1. **SQL Functions** - Most reliable, works in SQL Editor

2. **Browser Console** - Interactive, good for testing

3. **Bookmarklet** - Quick access from any page
The nginx proxy at `http://localhost:8080` bridges Supabase and Ollama, making local AI-powered database management possible!