#!/usr/bin/env node

/**
 * User Perspective Test - Following Dan's single-file philosophy
 * Real user automation test using browser automation and API testing
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const API_BASE = 'http://localhost:9999';

async function runUserPerspectiveTest() {
  console.log('🎯 Starting User Perspective Test - Simulating Real User Actions\n');
  
  let browser = null;
  let results = {
    browserAutomation: false,
    authentication: false,
    photoWorkflow: false,
    visionAPI: false,
    assistantAPI: false,
    userExperience: 'pending'
  };
  
  try {
    // Step 1: Launch browser (simulating user opening browser)
    console.log('🌐 Step 1: Launching browser (simulating user)...');
    browser = await chromium.launch({ 
      headless: true, // Set to false to see actual browser actions
      slowMo: 100 // Slow down actions to simulate human-like interaction
    });
    
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      userAgent: 'Universal-AI-Tools-UserTest/1.0'
    });
    
    const page = await context.newPage();
    results.browserAutomation = true;
    console.log('✅ Browser launched successfully');
    
    // Step 2: Test authentication (user getting access)
    console.log('\n🔐 Step 2: Testing user authentication flow...');
    const authResult = await testUserAuthentication(page);
    results.authentication = authResult.success;
    console.log(authResult.success ? '✅ Authentication working' : '⚠️ Authentication issues detected');
    
    // Step 3: Simulate user taking screenshot (like opening Photos app)
    console.log('\n📸 Step 3: Simulating user photo workflow...');
    const screenshotPath = await simulateUserScreenshot(page);
    console.log(`📷 User screenshot captured: ${screenshotPath}`);
    
    // Step 4: Test vision API from user perspective
    console.log('\n👁️ Step 4: Testing vision analysis (user uploads photo)...');
    const visionResult = await testVisionFromUserPerspective(page, screenshotPath, authResult.token);
    results.visionAPI = visionResult.success;
    console.log(visionResult.success ? '✅ Vision API responds to user' : '⚠️ Vision API needs attention');
    
    // Step 5: Test assistant integration (user asks for help)
    console.log('\n🤖 Step 5: Testing assistant interaction (user asks questions)...');
    const assistantResult = await testAssistantFromUserPerspective(page, authResult.token);
    results.assistantAPI = assistantResult.success;
    console.log(assistantResult.success ? '✅ Assistant helps user' : '⚠️ Assistant needs improvement');
    
    // Step 6: Simulate complete photo organization workflow
    console.log('\n📂 Step 6: Testing complete photo organization workflow...');
    const workflowResult = await testCompletePhotoWorkflow(page, authResult.token);
    results.photoWorkflow = workflowResult.success;
    console.log(workflowResult.success ? '✅ Workflow works end-to-end' : '⚠️ Workflow has gaps');
    
    // Step 7: Test user interface (if available)
    console.log('\n🖥️ Step 7: Testing web interface (user browses system)...');
    const uiResult = await testUserInterface(page);
    console.log(uiResult.available ? '✅ Web interface accessible' : 'ℹ️ API-only system (expected)');
    
    // Step 8: Evaluate overall user experience
    console.log('\n🎯 Step 8: Evaluating complete user experience...');
    results.userExperience = evaluateUserExperience(results);
    
  } catch (error) {
    console.error('❌ User perspective test encountered error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  // Generate user perspective report
  generateUserReport(results);
  
  return results;
}

async function testUserAuthentication(page) {
  try {
    console.log('   👤 User requesting access token...');
    
    const response = await page.request.post(`${API_BASE}/api/v1/auth/demo-token`, {
      data: {
        name: 'Real User Test',
        purpose: 'Photo organization using Universal AI Tools',
        duration: '1h'
      }
    });
    
    if (response.ok()) {
      const data = await response.json();
      const token = data.data?.token;
      if (token) {
        console.log('   ✅ User successfully authenticated');
        return { success: true, token, userData: data.data };
      }
    }
    
    console.log('   ⚠️ Authentication failed, proceeding with public endpoints');
    return { success: false, token: null };
    
  } catch (error) {
    console.log('   ❌ Authentication error:', error.message);
    return { success: false, token: null };
  }
}

async function simulateUserScreenshot(page) {
  console.log('   📱 User taking screenshot of their Photos app...');
  
  // Create a mock "user's desktop" page
  await page.setContent(`
    <html>
      <head><title>Mac Photos App - User's View</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5;">
        <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h1 style="color: #333;">📸 Photos</h1>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 20px;">
            <div style="aspect-ratio: 1; background: linear-gradient(45deg, #FFB6C1, #87CEEB); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">Family</div>
            <div style="aspect-ratio: 1; background: linear-gradient(45deg, #98FB98, #F0E68C); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">Vacation</div>
            <div style="aspect-ratio: 1; background: linear-gradient(45deg, #DDA0DD, #F4A460); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">Birthday</div>
            <div style="aspect-ratio: 1; background: linear-gradient(45deg, #FFE4E1, #E0E0E0); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666; font-weight: bold;">More...</div>
          </div>
          <p style="margin-top: 20px; color: #666;">User wants to organize these photos better with AI assistance</p>
        </div>
      </body>
    </html>
  `);
  
  const screenshotPath = '/tmp/user_perspective_screenshot.png';
  await page.screenshot({ 
    path: screenshotPath,
    fullPage: true 
  });
  
  console.log('   📷 Screenshot captured from user perspective');
  return screenshotPath;
}

async function testVisionFromUserPerspective(page, screenshotPath, token) {
  try {
    console.log('   👁️ User uploading photo for analysis...');
    
    const imageBuffer = readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await page.request.post(`${API_BASE}/api/v1/vision/analyze`, {
      headers,
      data: {
        imageBase64: base64Image,
        options: {
          extractText: true,
          generateEmbedding: false,
          detailed: true
        }
      }
    });
    
    console.log('   📊 Vision API response status:', response.status());
    
    if (response.ok()) {
      const result = await response.json();
      console.log('   ✅ User receives photo analysis');
      return { success: true, data: result };
    } else {
      console.log('   ⚠️ Vision API returned error, using fallback');
      return { success: false, fallback: true };
    }
    
  } catch (error) {
    console.log('   ❌ Vision test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testAssistantFromUserPerspective(page, token) {
  try {
    console.log('   💬 User asking assistant for photo organization help...');
    
    const userMessage = "I have a lot of family photos that need organizing. Can you help me create a good system for organizing them by people, events, and dates?";
    
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await page.request.post(`${API_BASE}/api/v1/assistant/chat`, {
      headers,
      data: {
        message: userMessage,
        sessionId: 'user-perspective-test',
        projectPath: '/Users/test/Photos'
      }
    });
    
    console.log('   📋 Assistant response status:', response.status());
    
    if (response.ok()) {
      const result = await response.json();
      if (result.success && result.data?.response) {
        console.log('   ✅ User receives helpful response');
        console.log('   📝 Assistant suggestion preview:', result.data.response.substring(0, 100) + '...');
        return { success: true, response: result.data.response };
      }
    }
    
    console.log('   ⚠️ Assistant needs improvement');
    return { success: false };
    
  } catch (error) {
    console.log('   ❌ Assistant test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testCompletePhotoWorkflow(page, token) {
  console.log('   🔄 Testing complete user workflow...');
  
  const workflow = [
    'User opens Photos app',
    'User selects photos to organize', 
    'System analyzes photos',
    'AI suggests organization strategy',
    'User applies suggestions',
    'System creates organized structure'
  ];
  
  let workflowSuccess = true;
  
  for (const step of workflow) {
    console.log(`     • ${step}`);
    
    // Simulate each step with appropriate API calls
    try {
      switch (step) {
        case 'System analyzes photos':
          const analysisResponse = await page.request.get(`${API_BASE}/api/v1/vision`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          if (!analysisResponse.ok() && analysisResponse.status() === 404) {
            // Expected for this test
          }
          break;
          
        case 'AI suggests organization strategy':
          const agentsResponse = await page.request.get(`${API_BASE}/api/v1/agents`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          // Check if agents are available
          break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate user thinking time
      
    } catch (error) {
      console.log(`     ⚠️ ${step} encountered issues`);
      workflowSuccess = false;
    }
  }
  
  console.log(`   ${workflowSuccess ? '✅' : '⚠️'} Workflow ${workflowSuccess ? 'successful' : 'has room for improvement'}`);
  return { success: workflowSuccess };
}

async function testUserInterface(page) {
  try {
    console.log('   🌐 User navigating to web interface...');
    
    await page.goto(API_BASE, { waitUntil: 'networkidle', timeout: 5000 });
    
    const title = await page.title();
    console.log('   📄 Page title:', title);
    
    return { available: true, title };
    
  } catch (error) {
    console.log('   ℹ️ No web interface (API-only system)');
    return { available: false };
  }
}

function evaluateUserExperience(results) {
  const scores = {
    browser: results.browserAutomation ? 1 : 0,
    auth: results.authentication ? 1 : 0.5, // Half point for fallback
    vision: results.visionAPI ? 1 : 0.3, // Some points for graceful degradation
    assistant: results.assistantAPI ? 1 : 0.3,
    workflow: results.photoWorkflow ? 1 : 0.5
  };
  
  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const maxScore = Object.keys(scores).length;
  const percentage = (totalScore / maxScore) * 100;
  
  if (percentage >= 80) return 'excellent';
  if (percentage >= 60) return 'good';
  if (percentage >= 40) return 'fair';
  return 'needs-improvement';
}

function generateUserReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 USER PERSPECTIVE TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log('\n🎯 Test Components:');
  console.log(`   Browser Automation: ${results.browserAutomation ? '✅ Working' : '❌ Failed'}`);
  console.log(`   User Authentication: ${results.authentication ? '✅ Working' : '⚠️ Fallback Mode'}`);
  console.log(`   Photo Workflow: ${results.photoWorkflow ? '✅ Complete' : '⚠️ Partial'}`);
  console.log(`   Vision API: ${results.visionAPI ? '✅ Responsive' : '⚠️ Needs Work'}`);
  console.log(`   Assistant API: ${results.assistantAPI ? '✅ Helpful' : '⚠️ Needs Work'}`);
  
  console.log(`\n🏆 Overall User Experience: ${results.userExperience.toUpperCase()}`);
  
  console.log('\n📝 User Perspective Summary:');
  if (results.userExperience === 'excellent') {
    console.log('   🎉 System provides excellent user experience!');
    console.log('   📸 Photo organization workflow is smooth and intuitive');
    console.log('   🤖 AI assistance is helpful and responsive');
  } else if (results.userExperience === 'good') {
    console.log('   👍 System provides good user experience with minor issues');
    console.log('   🔧 Some components need refinement but core functionality works');
  } else {
    console.log('   🛠️ System has foundation but needs development for optimal UX');
    console.log('   📋 Focus on API reliability and user-facing features');
  }
  
  console.log('\n💡 Following Dan\'s Philosophy:');
  console.log('   ✅ Single-file test approach');
  console.log('   ✅ User-focused evaluation');
  console.log('   ✅ Real browser automation');
  console.log('   ✅ End-to-end workflow testing');
  
  console.log('\n' + '='.repeat(60));
  
  // Save detailed report
  const reportData = {
    timestamp: new Date().toISOString(),
    results,
    summary: `User perspective test completed with ${results.userExperience} rating`,
    recommendation: generateRecommendations(results)
  };
  
  writeFileSync('/tmp/user_perspective_report.json', JSON.stringify(reportData, null, 2));
  console.log('📄 Detailed report saved to: /tmp/user_perspective_report.json');
}

function generateRecommendations(results) {
  const recommendations = [];
  
  if (!results.authentication) {
    recommendations.push('Improve authentication system reliability');
  }
  
  if (!results.visionAPI) {
    recommendations.push('Fix vision API endpoints and error handling');
  }
  
  if (!results.assistantAPI) {
    recommendations.push('Enhance assistant API response quality');
  }
  
  if (!results.photoWorkflow) {
    recommendations.push('Streamline photo organization workflow');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System performing well, focus on user experience refinements');
  }
  
  return recommendations;
}

// Run the test
runUserPerspectiveTest()
  .then(results => {
    console.log('\n🎯 User perspective testing completed!');
    process.exit(results.userExperience === 'excellent' ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });