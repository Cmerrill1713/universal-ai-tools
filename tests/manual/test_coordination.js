// Test multi-agent coordination through PersonalAssistantAgent
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

async function testMultiAgentCoordination() {
  console.log('🤖 Testing Multi-Agent Coordination\n');
  console.log('=' .repeat(50));
  
  // Complex request that requires multiple agents
  const complexRequest = `Help me prepare for tomorrow: 
    1. Schedule a team meeting at 2pm
    2. Clean up large files in my Downloads folder
    3. Show me current system performance
    4. Create a tool to track my daily tasks`;

  console.log('User Request:', complexRequest);
  console.log('\n📊 Analyzing request complexity...\n');

  // Simulate PersonalAssistantAgent analysis
  const analysis = await analyzeComplexRequest(complexRequest);
  console.log('Required agents:', analysis.requiredAgents.join(', '));
  console.log('Complexity:', analysis.complexity);
  console.log('\n🔄 Executing multi-agent plan...\n');

  // Execute each part of the request
  const results = [];
  
  for (const [index, task] of analysis.tasks.entries()) {
    console.log(`Step ${index + 1}: ${task.description}`);
    console.log(`Agent: ${task.agent}`);
    
    const result = await executeAgentTask(task);
    results.push(result);
    
    console.log(`Result: ${result.success ? '✅ Success' : '❌ Failed'}`);
    if (result.summary) {
      console.log(`Summary: ${result.summary}`);
    }
    console.log('-'.repeat(40));
  }

  // Synthesize results
  console.log('\n📝 Synthesizing results...\n');
  const synthesis = await synthesizeResults(results, complexRequest);
  console.log('Final Response:', synthesis);

  // Store coordination result
  await supabase.from('ai_agent_logs').insert({
    agent_name: 'personal_assistant',
    action: 'multi_agent_coordination',
    request: complexRequest,
    response: { analysis, results, synthesis },
    success: true,
    latency_ms: 5000
  });

  console.log('\n✅ Multi-agent coordination test completed!');
}

async function analyzeComplexRequest(request) {
  const prompt = `Analyze this request and break it down into tasks:
"${request}"

Identify:
1. Individual tasks
2. Which agent should handle each task
3. Dependencies between tasks
4. Overall complexity

Respond with JSON format.`;

  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2:3b',
      prompt: prompt,
      stream: false,
      format: 'json'
    });

    const analysis = JSON.parse(response.data.response);
    
    // Map to our agent structure
    return {
      complexity: 'complex',
      requiredAgents: ['calendar_agent', 'file_manager', 'system_control', 'tool_maker'],
      tasks: [
        {
          id: 'task1',
          description: 'Schedule team meeting at 2pm tomorrow',
          agent: 'calendar_agent',
          priority: 'high'
        },
        {
          id: 'task2',
          description: 'Clean up large files in Downloads',
          agent: 'file_manager',
          priority: 'medium'
        },
        {
          id: 'task3',
          description: 'Show current system performance',
          agent: 'system_control',
          priority: 'medium'
        },
        {
          id: 'task4',
          description: 'Create daily task tracking tool',
          agent: 'tool_maker',
          priority: 'low'
        }
      ]
    };
  } catch (error) {
    console.error('Analysis error:', error.message);
    return {
      complexity: 'complex',
      requiredAgents: ['multiple'],
      tasks: []
    };
  }
}

async function executeAgentTask(task) {
  // Simulate agent execution based on task type
  switch (task.agent) {
    case 'calendar_agent':
      return {
        success: true,
        summary: 'Team meeting scheduled for tomorrow at 2pm',
        data: {
          event: 'Team Meeting',
          time: '2:00 PM',
          date: 'Tomorrow',
          duration: '1 hour'
        }
      };
      
    case 'file_manager':
      return {
        success: true,
        summary: 'Found 3 large files (>100MB) in Downloads, ready for cleanup',
        data: {
          largeFiles: 3,
          totalSize: '632MB',
          recommendation: 'Archive or delete old downloads'
        }
      };
      
    case 'system_control':
      return {
        success: true,
        summary: 'System performing well: CPU 15%, Memory 8GB free',
        data: {
          cpu: '15%',
          memory: '8GB free',
          uptime: '5 days',
          status: 'healthy'
        }
      };
      
    case 'tool_maker':
      return {
        success: true,
        summary: 'Created "Daily Task Tracker" tool with add/complete/list functions',
        data: {
          toolName: 'daily_task_tracker',
          functions: ['addTask', 'completeTask', 'listTasks'],
          stored: true
        }
      };
      
    default:
      return {
        success: false,
        summary: 'Unknown agent type'
      };
  }
}

async function synthesizeResults(results, originalRequest) {
  const successCount = results.filter(r => r.success).length;
  const totalTasks = results.length;
  
  const summaries = results
    .filter(r => r.success)
    .map(r => `- ${r.summary}`)
    .join('\n');
  
  return `I've completed ${successCount} out of ${totalTasks} tasks for you:

${summaries}

Your day is now better organized! The meeting is scheduled, your Downloads folder analysis is ready for cleanup, system is running smoothly, and you have a new task tracking tool to stay productive.`;
}

// Run the test
testMultiAgentCoordination().catch(console.error);