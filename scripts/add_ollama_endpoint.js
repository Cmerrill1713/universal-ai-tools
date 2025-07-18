#!/usr/bin/env node
/**
 * Add Ollama status endpoint to the working server
 */

const fs = require('fs');
const path = require('path');

const serverPath = '/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources/dist/server.js';

// Read current server content
let content = fs.readFileSync(serverPath, 'utf8');

// Check if Ollama endpoint already exists
if (content.includes('/api/ollama/status')) {
    console.log('✅ Ollama endpoint already exists');
    process.exit(0);
}

// Add Ollama endpoint before the stats endpoint
const ollamaEndpoint = `
// Ollama status endpoint
app.get('/api/ollama/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
    const data = response.data;
    const activeModel = data.models && data.models.length > 0 ? data.models[0].name : null;
    res.json({
      status: 'available',
      active_model: activeModel,
      model_count: data.models?.length || 0,
      available: true
    });
  } catch (error) {
    res.json({
      status: 'offline',
      active_model: null,
      model_count: 0,
      available: false,
      error: error.message
    });
  }
});

`;

// Find the stats endpoint and insert before it
const statsPattern = /\/\/ System stats endpoint/;
if (statsPattern.test(content)) {
    content = content.replace(statsPattern, ollamaEndpoint + '// System stats endpoint');
} else {
    // Fallback: add before error handling
    const errorPattern = /\/\/ Error handling middleware/;
    if (errorPattern.test(content)) {
        content = content.replace(errorPattern, ollamaEndpoint + '// Error handling middleware');
    } else {
        // Last resort: add before server start
        const serverPattern = /\/\/ Start server/;
        content = content.replace(serverPattern, ollamaEndpoint + '// Start server');
    }
}

// Also update the available endpoints list
content = content.replace(
    '"GET /api/stats"',
    '"GET /api/ollama/status",\n      "GET /api/stats"'
);

// Write the updated content
try {
    fs.writeFileSync(serverPath, content);
    console.log('✅ Added Ollama status endpoint to server');
} catch (error) {
    console.log('❌ Failed to write server file:', error.message);
    console.log('🔧 Trying alternative approach...');
    
    // Create a new server file in the development directory
    const devServerPath = '/Users/christianmerrill/Desktop/universal-ai-tools/fixed_server.js';
    fs.writeFileSync(devServerPath, content);
    console.log(`✅ Created updated server at: ${devServerPath}`);
    console.log('📝 Copy this file to replace the app bundle server manually');
}