#!/usr/bin/env tsx
/**
 * Simple Photo Agent - Uses existing Universal AI Tools infrastructure
 * 
 * This agent leverages the EXISTING vision and assistant APIs
 * No new dependencies, no reimplementation - just orchestration
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const API_BASE = 'http://localhost:9999/api/v1';

/**
 * Get auth token from existing system
 */
async function getToken(): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/demo-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Photo Agent',
      purpose: 'Organizing photos with face detection'
    })
  });
  
  const data = await response.json();
  return data.data.token;
}

/**
 * Open Mac Photos and get photos
 */
async function openPhotosAndProcess(): Promise<void> {
  console.log('📸 Opening Mac Photos...');
  await execAsync('open -a Photos');
  
  console.log(`
Photos app is now open! To analyze your photos:
1. Select and export photos to a folder
2. I'll use our vision API to detect faces
3. Our assistant will help organize them into profiles
  `);
}

/**
 * Analyze image using our existing vision endpoint
 */
async function analyzeImage(imagePath: string, token: string): Promise<any> {
  const fs = await import('fs/promises');
  const imageBuffer = await fs.readFile(imagePath);
  const base64 = imageBuffer.toString('base64');
  
  const response = await fetch(`${API_BASE}/vision/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      imageBase64: base64,
      options: {
        extractText: false,
        generateEmbedding: true,
        detailed: true
      }
    })
  });
  
  return response.json();
}

/**
 * Use assistant to organize the data
 */
async function organizeWithAssistant(faceData: any, token: string): Promise<string> {
  const response = await fetch(`${API_BASE}/assistant/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Please organize this face detection data into profiles. Group by age and relationships: ${JSON.stringify(faceData)}`,
      sessionId: 'photo-organization',
      projectPath: '/photos'
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Assistant API HTTP ${response.status}: ${errorText}`);
  }
  
  const result = await response.json();
  console.log('Assistant Response:', JSON.stringify(result, null, 2));
  
  if (result.success && result.data) {
    return result.data.response;
  }
  throw new Error(`Assistant API failed: ${JSON.stringify(result.error || result)}`);
}

/**
 * Main flow
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === '--open-photos') {
    await openPhotosAndProcess();
    return;
  }
  
  if (args[0] === '--analyze' && args[1]) {
    console.log('🔐 Getting auth token...');
    const token = await getToken();
    
    console.log('🔍 Analyzing image with vision API...');
    const analysis = await analyzeImage(args[1], token);
    console.log('Vision Analysis:', analysis);
    
    console.log('🤖 Organizing with assistant...');
    const organized = await organizeWithAssistant(analysis, token);
    console.log('Assistant Response:', organized);
    
    return;
  }
  
  console.log(`
Simple Photo Agent - Uses existing Universal AI Tools
Usage:
  --open-photos         Open Mac Photos app
  --analyze <image>     Analyze image using existing APIs
  
This agent uses your existing:
- Vision API at ${API_BASE}/vision/analyze
- Assistant at ${API_BASE}/assistant/chat
- No new dependencies needed!
  `);
}

// ES module check for direct execution
if (import.meta.url.endsWith(process.argv[1])) {
  main().catch(console.error);
}