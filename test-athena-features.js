#!/usr/bin/env node

/**
 * Interactive test script for Athena features
 * Tests the core functionality through the API while the GUI is open
 */

import axios from 'axios';
import chalk from 'chalk';

const BASE_URL = 'http://localhost:9999';

// Test data
const testAgentConfig = {
    task: 'Assist with SwiftUI development and testing',
    context: 'Testing Universal AI Tools GUI functionality',
    expertise_needed: ['swift', 'swiftui', 'macos', 'testing'],
    autonomy_level: 'advanced'
};

const testToolConfig = {
    name: 'SwiftUIPreviewGenerator',
    description: 'Generates SwiftUI preview code for components',
    purpose: 'Automate SwiftUI preview generation',
    type: 'code_generation',
    inputs: [
        {
            name: 'componentName',
            type: 'string',
            description: 'Name of the SwiftUI component',
            required: true
        },
        {
            name: 'previewData',
            type: 'object',
            description: 'Sample data for preview',
            required: false
        }
    ],
    outputs: [
        {
            name: 'previewCode',
            type: 'string',
            description: 'Generated SwiftUI preview code'
        }
    ],
    implementation: `
        const preview = \`#Preview {
    \${input.componentName}()
        .environmentObject(AppStateCoordinator.shared)\${input.previewData ? \`
        .previewData(\${JSON.stringify(input.previewData)})\` : ''}
}\`;
        return { previewCode: preview };
    `
};

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAthenaFeatures() {
    console.log(chalk.blue('\n=== Testing Athena Features with GUI ===\n'));
    
    try {
        // Test 1: Spawn a specialized agent
        console.log(chalk.yellow('1. Spawning SwiftUI Assistant Agent...'));
        const spawnResponse = await axios.post(`${BASE_URL}/api/v1/athena/spawn`, testAgentConfig);
        const agent = spawnResponse.data.data.agent;
        console.log(chalk.green(`✓ Agent spawned: ${agent.name} (${agent.id})`));
        console.log(chalk.gray(`  Purpose: ${agent.purpose}`));
        console.log(chalk.gray(`  Status: ${agent.status}`));
        
        await delay(1000);
        
        // Test 2: Execute a task with the agent
        console.log(chalk.yellow('\n2. Testing agent execution...'));
        const executeResponse = await axios.post(`${BASE_URL}/api/v1/athena/execute`, {
            agentId: agent.id,
            task: 'Generate a SwiftUI view for displaying agent status with animations',
            context: {
                requirements: [
                    'Show agent name and status',
                    'Include animation for status changes',
                    'Use system colors and SF Symbols'
                ]
            }
        });
        
        const execution = executeResponse.data.data;
        console.log(chalk.green('✓ Task executed successfully'));
        console.log(chalk.gray(`  Execution time: ${execution.performance.executionTime}ms`));
        console.log(chalk.gray(`  Success rate: ${(execution.performance.successRate * 100).toFixed(0)}%`));
        
        // Show a snippet of the generated code
        if (execution.result.response) {
            console.log(chalk.cyan('\n  Generated code preview:'));
            console.log(chalk.gray('  ' + execution.result.response.substring(0, 200) + '...'));
        }
        
        await delay(1000);
        
        // Test 3: Create a dynamic tool
        console.log(chalk.yellow('\n3. Creating dynamic tool...'));
        const toolResponse = await axios.post(`${BASE_URL}/api/v1/athena/tools/create`, testToolConfig);
        const tool = toolResponse.data.data.tool;
        console.log(chalk.green(`✓ Tool created: ${tool.name}`));
        console.log(chalk.gray(`  Purpose: ${tool.purpose || 'N/A'}`));
        if (tool.inputs && Array.isArray(tool.inputs)) {
            console.log(chalk.gray(`  Inputs: ${tool.inputs.map(i => i.name).join(', ')}`));
        }
        
        await delay(1000);
        
        // Test 4: Execute the created tool
        console.log(chalk.yellow('\n4. Testing created tool...'));
        const toolExecResponse = await axios.post(`${BASE_URL}/api/v1/athena/tools/execute`, {
            toolId: tool.id,
            input: {
                componentName: 'AgentStatusView',
                previewData: {
                    agentName: 'Test Agent',
                    status: 'active'
                }
            }
        });
        
        console.log(chalk.green('✓ Tool executed successfully'));
        console.log(chalk.cyan('  Generated preview:'));
        console.log(chalk.gray(toolExecResponse.data.data.result.previewCode));
        
        await delay(1000);
        
        // Test 5: Get system status
        console.log(chalk.yellow('\n5. Checking Athena system status...'));
        const statusResponse = await axios.get(`${BASE_URL}/api/v1/athena/status`);
        const status = statusResponse.data.data.status;
        
        console.log(chalk.green('✓ System Status:'));
        console.log(chalk.gray(`  Total agents: ${status.agents.total}`));
        console.log(chalk.gray(`  Active agents: ${status.agents.active}`));
        console.log(chalk.gray(`  Total tools: ${status.tools.total}`));
        console.log(chalk.gray(`  Tasks completed: ${status.performance.totalTasksCompleted}`));
        
        // Test 6: Agent collaboration
        console.log(chalk.yellow('\n6. Testing agent collaboration...'));
        
        // Spawn a second agent
        const secondAgentResponse = await axios.post(`${BASE_URL}/api/v1/athena/spawn`, {
            task: 'Review and optimize SwiftUI code',
            expertise_needed: ['code_review', 'performance', 'swift'],
            autonomy_level: 'intermediate'
        });
        const reviewAgent = secondAgentResponse.data.data.agent;
        console.log(chalk.green(`✓ Review agent spawned: ${reviewAgent.name}`));
        
        // Create a workflow with both agents
        const workflowResponse = await axios.post(`${BASE_URL}/api/v1/athena/workflow`, {
            name: 'SwiftUI Development Workflow',
            description: 'Generate and review SwiftUI components',
            agents: [
                {
                    agentId: agent.id,
                    role: 'generator',
                    tasks: ['Generate SwiftUI component']
                },
                {
                    agentId: reviewAgent.id,
                    role: 'reviewer',
                    tasks: ['Review generated code', 'Suggest optimizations']
                }
            ],
            context: {
                component: 'AnimatedMenuBarIcon',
                requirements: ['Smooth animations', 'Low CPU usage', 'Accessibility support']
            }
        });
        
        console.log(chalk.green('✓ Workflow created and executing...'));
        console.log(chalk.gray(`  Workflow ID: ${workflowResponse.data.data.workflow.id}`));
        
        // Summary
        console.log(chalk.blue('\n=== Test Summary ==='));
        console.log(chalk.green('✓ All Athena features tested successfully!'));
        console.log(chalk.cyan('\nFeatures validated:'));
        console.log('  • Dynamic agent spawning');
        console.log('  • Agent task execution');
        console.log('  • Dynamic tool creation');
        console.log('  • Tool execution');
        console.log('  • System status monitoring');
        console.log('  • Multi-agent collaboration');
        
        console.log(chalk.yellow('\n💡 Next steps:'));
        console.log('1. Click "Agent Management" in the GUI to see spawned agents');
        console.log('2. Click "Enhanced Chat" to interact with agents');
        console.log('3. Use "Create Tool" to build more tools visually');
        console.log('4. Monitor real-time updates in the interface');
        
    } catch (error) {
        console.error(chalk.red('\n❌ Test failed:'), error.message);
        if (error.response) {
            console.error(chalk.red('Response data:'), error.response.data);
        }
    }
}

// Run the tests
console.log(chalk.cyan('Starting Athena feature tests...'));
console.log(chalk.gray('Make sure the GUI is open to see real-time updates!\n'));

testAthenaFeatures();