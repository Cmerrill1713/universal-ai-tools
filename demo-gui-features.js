#!/usr/bin/env node

/**
 * Demo script to showcase GUI features
 * Run this while the app is open to see real-time updates
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:9999';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function demoGUIFeatures() {
    console.log('\n🎯 Universal AI Tools GUI Demo\n');
    console.log('Watch the GUI for real-time updates as we run these commands!\n');
    
    try {
        // 1. Show current status
        console.log('1️⃣ Checking system status...');
        const statusRes = await axios.get(`${BASE_URL}/api/v1/athena/status`);
        const status = statusRes.data.data.status;
        console.log(`   ✓ Agents: ${status.agents.total} total, ${status.agents.active} active`);
        console.log(`   ✓ System: Operational\n`);
        
        await sleep(2000);
        
        // 2. Spawn an agent
        console.log('2️⃣ Spawning a SwiftUI Helper agent...');
        const spawnRes = await axios.post(`${BASE_URL}/api/v1/athena/spawn`, {
            task: 'Help with SwiftUI development',
            expertise_needed: ['swift', 'swiftui'],
            autonomy_level: 'intermediate'
        });
        const agent = spawnRes.data.data.agent;
        console.log(`   ✓ Created: ${agent.name} (${agent.id.substring(0, 8)}...)`);
        console.log(`   ✓ Status: ${agent.status}\n`);
        
        await sleep(2000);
        
        // 3. Execute a simple task
        console.log('3️⃣ Asking agent to generate a button component...');
        const execRes = await axios.post(`${BASE_URL}/api/v1/athena/execute`, {
            agentId: agent.id,
            task: 'Create a simple SwiftUI button that says "Hello Athena"'
        });
        console.log('   ✓ Task completed!');
        console.log('   ✓ Agent response received\n');
        
        await sleep(2000);
        
        // 4. Create a tool
        console.log('4️⃣ Creating a custom tool...');
        const toolRes = await axios.post(`${BASE_URL}/api/v1/athena/tools/create`, {
            name: 'ColorPicker',
            description: 'Generate SwiftUI color picker code',
            purpose: 'Quick color picker generation',
            type: 'utility',
            inputs: [{
                name: 'defaultColor',
                type: 'string',
                description: 'Default color name',
                required: false
            }],
            outputs: [{
                name: 'code',
                type: 'string',
                description: 'SwiftUI code'
            }],
            implementation: 'return { code: "ColorPicker(\\"Choose Color\\", selection: $color)" };'
        });
        console.log(`   ✓ Tool created: ${toolRes.data.data.tool.name}\n`);
        
        // 5. Summary
        console.log('✅ Demo complete!\n');
        console.log('📱 In the GUI you can now:');
        console.log('   • Click "Agent Management" to see your new agent');
        console.log('   • Click "Enhanced Chat" to chat with the agent');
        console.log('   • Click "Create Tool" to build more tools');
        console.log('   • Use the search bar to find commands quickly\n');
        
        console.log('💡 Try these interactions:');
        console.log('   1. Type "agent" in the search bar');
        console.log('   2. Click on "Agent Management"');
        console.log('   3. You should see the SwiftUI Helper agent listed\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the demo
demoGUIFeatures();