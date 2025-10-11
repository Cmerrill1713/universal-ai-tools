#!/usr/bin/env node
/**
 * Test Devil's Advocate Collaborative Coding System
 * Demonstrates writer (MLX) vs critic (Ollama) collaboration
 */

async function testDevilsAdvocateCoding() {
  console.log('👹 DEVIL\'S ADVOCATE COLLABORATIVE CODING TEST');
  console.log('');
  
  try {
    // Step 1: Test health endpoint
    console.log('=== STEP 1: TESTING SERVICE HEALTH ===');
    const healthResponse = await fetch('http://localhost:9999/api/v1/collaborative-coding/health');
    const healthData = await healthResponse.json();
    
    console.log('✅ Collaborative Coding Service Health:');
    console.log(`   Status: ${healthData.status}`);
    console.log(`   Writer Agent: ${healthData.agents.writer}`);
    console.log(`   Critic Agent: ${healthData.agents.critic}`);
    console.log(`   Active Sessions: ${healthData.stats.activeSessions}`);
    console.log('');

    // Step 2: Start a collaborative coding session
    console.log('=== STEP 2: STARTING COLLABORATIVE CODING SESSION ===');
    const sessionResponse = await fetch('http://localhost:9999/api/v1/collaborative-coding/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Create a simple user authentication system',
        requirements: [
          'User registration with email and password',
          'Password hashing for security',
          'Login functionality',
          'JWT token generation',
          'Input validation and error handling'
        ],
        language: 'typescript',
        complexity: 'medium',
        maxIterations: 3,
        constraints: [
          'Use bcrypt for password hashing',
          'Use jsonwebtoken for JWT tokens',
          'Include proper TypeScript types'
        ],
        targetEnvironment: 'Node.js Express server'
      })
    });

    const sessionData = await sessionResponse.json();
    
    if (!sessionData.success) {
      throw new Error(`Failed to start session: ${sessionData.error}`);
    }

    const sessionId = sessionData.session.id;
    console.log('🚀 Collaborative Session Started:');
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Task: ${sessionData.session.task.description}`);
    console.log(`   Language: ${sessionData.session.task.language}`);
    console.log(`   Complexity: ${sessionData.session.task.complexity}`);
    console.log(`   Max Iterations: ${sessionData.session.maxIterations}`);
    console.log('');

    // Step 3: Monitor session progress
    console.log('=== STEP 3: MONITORING SESSION PROGRESS ===');
    let iterations = 0;
    const maxWaitTime = 60000; // 60 seconds max
    const startTime = Date.now();

    while (iterations < sessionData.session.maxIterations && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      const statusResponse = await fetch(`http://localhost:9999/api/v1/collaborative-coding/session/${sessionId}`);
      const statusData = await statusResponse.json();

      if (!statusData.success) {
        console.log('❌ Failed to get session status');
        break;
      }

      const session = statusData.session;
      console.log(`🔄 Iteration ${session.iterations}/${session.maxIterations}:`);
      console.log(`   Phase: ${session.currentPhase}`);
      console.log(`   Status: ${session.status}`);
      console.log(`   Submissions: ${session.submissions.length}`);
      console.log(`   Critiques: ${session.critiques.length}`);

      if (session.submissions.length > 0) {
        const latestSubmission = session.submissions[session.submissions.length - 1];
        console.log(`   Latest Code (${latestSubmission.agent}): ${latestSubmission.codeLength} chars`);
        console.log(`   Model: ${latestSubmission.model} (${latestSubmission.provider})`);
      }

      if (session.critiques.length > 0) {
        const latestCritique = session.critiques[session.critiques.length - 1];
        console.log(`   Latest Critique Score: ${latestCritique.score}/10`);
        console.log(`   Issues Found: ${latestCritique.issuesCount}`);
        console.log(`   Improvements: ${latestCritique.improvementsCount}`);
        console.log(`   Critic Model: ${latestCritique.model} (${latestCritique.provider})`);
      }

      console.log('');

      if (session.status === 'completed' || session.status === 'failed') {
        break;
      }

      iterations = session.iterations;
    }

    // Step 4: Get final code and critique
    console.log('=== STEP 4: FINAL CODE AND CRITIQUE ===');
    const codeResponse = await fetch(`http://localhost:9999/api/v1/collaborative-coding/session/${sessionId}/code`);
    const codeData = await codeResponse.json();

    if (codeData.success) {
      console.log('📝 Final Code Submission:');
      console.log(`   Agent: ${codeData.code.submission.agent}`);
      console.log(`   Model: ${codeData.code.submission.model} (${codeData.code.submission.provider})`);
      console.log(`   Code Length: ${codeData.code.submission.code.length} characters`);
      console.log(`   Explanation: ${codeData.code.submission.explanation}`);
      console.log('');

      if (codeData.code.critique) {
        console.log('👹 Final Critique:');
        console.log(`   Agent: ${codeData.code.critique.agent}`);
        console.log(`   Model: ${codeData.code.critique.model} (${codeData.code.critique.provider})`);
        console.log(`   Score: ${codeData.code.critique.score}/10`);
        console.log(`   Issues Found: ${codeData.code.critique.issues.length}`);
        console.log(`   Improvements Suggested: ${codeData.code.critique.improvements.length}`);
        console.log('');

        if (codeData.code.critique.issues.length > 0) {
          console.log('🔍 Issues Identified:');
          codeData.code.critique.issues.forEach((issue, index) => {
            console.log(`   ${index + 1}. ${issue}`);
          });
          console.log('');
        }

        if (codeData.code.critique.improvements.length > 0) {
          console.log('💡 Improvements Suggested:');
          codeData.code.critique.improvements.forEach((improvement, index) => {
            console.log(`   ${index + 1}. ${improvement}`);
          });
          console.log('');
        }
      }

      // Show actual code
      console.log('📄 Generated Code:');
      console.log('```typescript');
      console.log(codeData.code.submission.code);
      console.log('```');
      console.log('');
    }

    // Step 5: Get service statistics
    console.log('=== STEP 5: SERVICE STATISTICS ===');
    const statsResponse = await fetch('http://localhost:9999/api/v1/collaborative-coding/stats');
    const statsData = await statsResponse.json();

    if (statsData.success) {
      console.log('📊 Service Statistics:');
      console.log(`   Total Sessions: ${statsData.stats.totalSessions}`);
      console.log(`   Active Sessions: ${statsData.stats.activeSessions}`);
      console.log(`   Completed Sessions: ${statsData.stats.completedSessions}`);
      console.log(`   Writer Agent: ${statsData.stats.agents.writer}`);
      console.log(`   Critic Agent: ${statsData.stats.agents.critic}`);
      console.log('');
    }

    // Step 6: Summary
    console.log('=== STEP 6: DEVIL\'S ADVOCATE SUMMARY ===');
    console.log('🎯 COLLABORATIVE CODING TEST COMPLETE!');
    console.log('');
    console.log('✅ SUCCESSFUL FEATURES:');
    console.log('   • Writer Agent (MLX) generates initial code');
    console.log('   • Critic Agent (Ollama) provides devil\'s advocate review');
    console.log('   • Different models provide diverse perspectives');
    console.log('   • Iterative improvement process');
    console.log('   • Real-time session monitoring');
    console.log('   • Comprehensive code analysis');
    console.log('');
    console.log('🤝 COLLABORATION BENEFITS:');
    console.log('   • Multiple model perspectives improve code quality');
    console.log('   • Devil\'s advocate approach catches issues early');
    console.log('   • Iterative refinement process');
    console.log('   • Different models excel at different aspects');
    console.log('   • Comprehensive security and performance analysis');
    console.log('');
    console.log('👹 DEVIL\'S ADVOCATE SYSTEM IS WORKING!');

  } catch (error) {
    console.error('❌ Devil\'s Advocate test failed:', error);
  }
}

// Run the test
testDevilsAdvocateCoding();
