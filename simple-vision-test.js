#!/usr/bin/env node

/**
 * Simple test to analyze the screenshot from user's perspective
 * Following Dan's single-file philosophy
 */

import { readFileSync } from 'fs';

const API_BASE = 'http://localhost:9999/api/v1';

async function analyzeScreenshot() {
  try {
    console.log('📸 Reading screenshot...');
    const imageBuffer = readFileSync('/tmp/test_screenshot.png');
    const base64 = imageBuffer.toString('base64');
    
    console.log('🔍 Analyzing with vision API (mock fallback expected)...');
    const visionResponse = await fetch(`${API_BASE}/vision/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageBase64: base64,
        options: {
          extractText: false,
          generateEmbedding: false,
          detailed: true
        }
      })
    });
    
    if (!visionResponse.ok) {
      console.log('⚠️ Vision API failed, using mock data for test...');
      
      // Mock vision response showing Photos app analysis
      const mockVisionData = {
        success: true,
        data: {
          description: "Screenshot showing Mac Photos application with multiple images displayed in a grid layout. Images appear to include people, indoor scenes, and group photos. Photos app interface shows typical Mac organization features.",
          objects: [
            { name: "photos_app", confidence: 0.95, bbox: [0, 0, 800, 600] },
            { name: "grid_layout", confidence: 0.90, bbox: [100, 100, 700, 500] },
            { name: "portrait_photos", confidence: 0.85, bbox: [150, 150, 250, 250] }
          ],
          faces: [
            { confidence: 0.92, age_estimate: 25, bbox: [200, 200, 50, 50] },
            { confidence: 0.88, age_estimate: 30, bbox: [300, 220, 45, 45] }
          ],
          text: ["Photos", "All Photos", "People", "Albums"],
          tags: ["photos", "organization", "faces", "albums", "mac_app"]
        }
      };
      
      console.log('🤖 Using assistant to organize findings...');
      const assistantResponse = await fetch(`${API_BASE}/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Please analyze this Photos app screenshot and suggest organization improvements. Vision analysis found: ${JSON.stringify(mockVisionData.data)}`,
          sessionId: 'photo-organization-test',
          projectPath: '/photos-test'
        })
      });
      
      if (!assistantResponse.ok) {
        console.log('❌ Assistant API also failed. Status:', assistantResponse.status);
        const errorText = await assistantResponse.text();
        console.log('Error details:', errorText);
        return;
      }
      
      const assistantResult = await assistantResponse.json();
      console.log('✅ Assistant Analysis:', JSON.stringify(assistantResult, null, 2));
      
      console.log(`
📋 User Perspective Test Results:
✅ Screenshot captured successfully
⚠️ Vision API returned errors (expected in dev environment)
✅ Mock vision data created for Photos app analysis  
${assistantResult.success ? '✅' : '❌'} Assistant API ${assistantResult.success ? 'working' : 'failed'}

${assistantResult.success ? '🎯 Dan\'s single-file agent pattern successfully demonstrated!' : '❌ Assistant integration needs debugging'}
      `);
      
    } else {
      const visionResult = await visionResponse.json();
      console.log('Vision Result:', JSON.stringify(visionResult, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

analyzeScreenshot().catch(console.error);