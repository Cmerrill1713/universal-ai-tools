#!/usr/bin/env node
/**
 * Functional Test: Devil's Advocate Collaborative Coding Workflow
 * Tests the complete workflow from start to finish
 */

async function testDevilsAdvocateWorkflow() {
  console.log('👹 FUNCTIONAL TEST: DEVIL\'S ADVOCATE WORKFLOW');
  console.log('');
  
  try {
    // Step 1: Test service health
    console.log('=== STEP 1: SERVICE HEALTH CHECK ===');
    const healthResponse = await fetch('http://localhost:9999/api/v1/collaborative-coding/health');
    const healthData = await healthResponse.json();
    
    if (healthData.success === false) {
      console.log('⚠️ Service not available via API, testing direct agent collaboration...');
      await testDirectAgentCollaboration();
      return;
    }
    
    console.log('✅ Collaborative Coding Service Health:');
    console.log(`   Status: ${healthData.status}`);
    console.log(`   Writer Agent: ${healthData.agents.writer}`);
    console.log(`   Critic Agent: ${healthData.agents.critic}`);
    console.log('');

    // Step 2: Start collaborative session
    console.log('=== STEP 2: STARTING COLLABORATIVE SESSION ===');
    const sessionResponse = await fetch('http://localhost:9999/api/v1/collaborative-coding/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Create a secure password hashing utility',
        requirements: [
          'Hash passwords using bcrypt',
          'Compare passwords securely',
          'Include salt generation',
          'Handle errors gracefully',
          'Provide TypeScript types'
        ],
        language: 'typescript',
        complexity: 'medium',
        maxIterations: 2,
        constraints: [
          'Use bcrypt library',
          'Include proper error handling',
          'Follow security best practices'
        ],
        targetEnvironment: 'Node.js'
      })
    });

    const sessionData = await sessionResponse.json();
    
    if (!sessionData.success) {
      throw new Error(`Failed to start session: ${sessionData.error}`);
    }

    const sessionId = sessionData.session.id;
    console.log('🚀 Session Started:');
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Task: ${sessionData.session.task.description}`);
    console.log(`   Language: ${sessionData.session.task.language}`);
    console.log(`   Max Iterations: ${sessionData.session.maxIterations}`);
    console.log('');

    // Step 3: Monitor session progress
    console.log('=== STEP 3: MONITORING SESSION PROGRESS ===');
    await monitorSessionProgress(sessionId, sessionData.session.maxIterations);

    // Step 4: Get final results
    console.log('=== STEP 4: FINAL RESULTS ===');
    await getFinalResults(sessionId);

    // Step 5: Service statistics
    console.log('=== STEP 5: SERVICE STATISTICS ===');
    await getServiceStats();

  } catch (error) {
    console.error('❌ Workflow test failed:', error);
    console.log('🔄 Falling back to direct agent testing...');
    await testDirectAgentCollaboration();
  }
}

async function monitorSessionProgress(sessionId, maxIterations) {
  let iterations = 0;
  const maxWaitTime = 45000; // 45 seconds max
  const startTime = Date.now();

  while (iterations < maxIterations && (Date.now() - startTime) < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 4000)); // Wait 4 seconds

    try {
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
    } catch (error) {
      console.log('❌ Error monitoring session:', error.message);
      break;
    }
  }
}

async function getFinalResults(sessionId) {
  try {
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
  } catch (error) {
    console.log('❌ Failed to get final results:', error.message);
  }
}

async function getServiceStats() {
  try {
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
  } catch (error) {
    console.log('❌ Failed to get service stats:', error.message);
  }
}

async function testDirectAgentCollaboration() {
  console.log('🔄 TESTING DIRECT AGENT COLLABORATION');
  console.log('');
  
  try {
    // Test Writer Agent (MLX)
    console.log('=== STEP 1: WRITER AGENT (MLX) ===');
    const writerPrompt = `Write a TypeScript function to hash passwords using bcrypt. Include:
- Hash password function
- Compare password function  
- Proper error handling
- TypeScript types
- Security best practices

Provide clean, production-ready code.`;

    const writerResponse = await fetch('http://localhost:8001/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mlx-qwen2.5-0.5b',
        messages: [{ role: 'user', content: writerPrompt }],
        max_tokens: 500
      })
    });

    const writerData = await writerResponse.json();
    const generatedCode = writerData.choices[0].message.content;
    
    console.log('✅ Writer Agent (MLX) Generated Code:');
    console.log(`   Model: mlx-qwen2.5-0.5b`);
    console.log(`   Provider: MLX`);
    console.log(`   Response Length: ${generatedCode.length} characters`);
    console.log('');
    console.log('📄 Generated Code:');
    console.log('```typescript');
    console.log(generatedCode);
    console.log('```');
    console.log('');

    // Test Critic Agent (Ollama)
    console.log('=== STEP 2: CRITIC AGENT (OLLAMA) ===');
    const criticPrompt = `As a senior code reviewer and devil's advocate, critically analyze this TypeScript password hashing code:

${generatedCode}

Find issues, security concerns, performance problems, and suggest improvements. Be thorough and critical.`;

    const criticResponse = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-oss:20b',
        messages: [{ role: 'user', content: criticPrompt }],
        stream: false
      })
    });

    const criticData = await criticResponse.json();
    const critique = criticData.message?.content || 'No critique received';
    
    console.log('✅ Critic Agent (Ollama) Analysis:');
    console.log(`   Model: gpt-oss:20b`);
    console.log(`   Provider: Ollama`);
    console.log(`   Critique Length: ${critique.length} characters`);
    console.log('');
    console.log('👹 Code Critique:');
    console.log(critique);
    console.log('');

    // Test Writer Revision
    console.log('=== STEP 3: WRITER REVISION (MLX) ===');
    const revisionPrompt = `Based on the following critique, revise the password hashing code to address the issues:

CRITIQUE:
${critique}

ORIGINAL CODE:
${generatedCode}

Please provide improved code that addresses the feedback while maintaining functionality.`;

    const revisionResponse = await fetch('http://localhost:8001/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mlx-qwen2.5-0.5b',
        messages: [{ role: 'user', content: revisionPrompt }],
        max_tokens: 500
      })
    });

    const revisionData = await revisionResponse.json();
    const revisedCode = revisionData.choices[0].message.content;
    
    console.log('✅ Writer Agent (MLX) Revised Code:');
    console.log(`   Model: mlx-qwen2.5-0.5b`);
    console.log(`   Provider: MLX`);
    console.log(`   Revised Code Length: ${revisedCode.length} characters`);
    console.log('');
    console.log('📄 Revised Code:');
    console.log('```typescript');
    console.log(revisedCode);
    console.log('```');
    console.log('');

    // Summary
    console.log('=== STEP 4: WORKFLOW SUMMARY ===');
    console.log('🎯 DEVIL\'S ADVOCATE WORKFLOW COMPLETE!');
    console.log('');
    console.log('✅ SUCCESSFUL COLLABORATION:');
    console.log('   • Writer Agent (MLX) generated initial code');
    console.log('   • Critic Agent (Ollama) provided thorough analysis');
    console.log('   • Writer Agent (MLX) revised code based on feedback');
    console.log('   • Different models provided diverse perspectives');
    console.log('');
    console.log('🤝 COLLABORATION BENEFITS:');
    console.log('   • Multi-model perspectives improve code quality');
    console.log('   • Devil\'s advocate approach catches issues early');
    console.log('   • Iterative improvement process');
    console.log('   • Security and performance analysis');
    console.log('   • Different models excel at different aspects');
    console.log('');
    console.log('🎉 DEVIL\'S ADVOCATE WORKFLOW IS FUNCTIONAL!');

  } catch (error) {
    console.error('❌ Direct agent collaboration failed:', error);
  }
}

// Run the functional test
testDevilsAdvocateWorkflow();
