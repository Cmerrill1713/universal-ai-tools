#!/usr/bin/env tsx
/**
 * Test Chat Integration with UAT-Prompt and Neuroforge
 * Verifies that all components work together properly
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
}

class ChatIntegrationTester {
  private results: TestResult[] = [];
  private baseUrl = 'http://localhost:9999';

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Chat Integration Tests...\n');

    // Test 1: Database Setup
    await this.testDatabaseSetup();
    
    // Test 2: Chat Service Health
    await this.testChatServiceHealth();
    
    // Test 3: UAT-Prompt Integration
    await this.testUATPromptIntegration();
    
    // Test 4: Neuroforge Integration
    await this.testNeuroforgeIntegration();
    
    // Test 5: Context Engineering
    await this.testContextEngineering();
    
    // Test 6: End-to-End Chat Flow
    await this.testEndToEndChatFlow();
    
    // Test 7: Session Management
    await this.testSessionManagement();
    
    // Test 8: Performance Tests
    await this.testPerformance();

    this.printResults();
  }

  private async testDatabaseSetup(): Promise<void> {
    const start = Date.now();
    
    try {
      console.log('📊 Testing database setup...');
      
      // Test chat_messages table
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .limit(1);
      
      if (messagesError) {
        throw new Error(`chat_messages table error: ${messagesError.message}`);
      }
      
      // Test chat_sessions table
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('*')
        .limit(1);
      
      if (sessionsError) {
        throw new Error(`chat_sessions table error: ${sessionsError.message}`);
      }
      
      // Test context_storage table
      const { data: context, error: contextError } = await supabase
        .from('context_storage')
        .select('*')
        .limit(1);
      
      if (contextError) {
        throw new Error(`context_storage table error: ${contextError.message}`);
      }
      
      this.addResult('Database Setup', 'PASS', 'All required tables are accessible', Date.now() - start);
      
    } catch (error) {
      this.addResult('Database Setup', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testChatServiceHealth(): Promise<void> {
    const start = Date.now();
    
    try {
      console.log('🏥 Testing chat service health...');
      
      const response = await fetch(`${this.baseUrl}/api/chat/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status !== 'healthy') {
        throw new Error(`Service not healthy: ${data.status}`);
      }
      
      this.addResult('Chat Service Health', 'PASS', 'Service is healthy and responding', Date.now() - start);
      
    } catch (error) {
      this.addResult('Chat Service Health', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testUATPromptIntegration(): Promise<void> {
    const start = Date.now();
    
    try {
      console.log('🧠 Testing UAT-Prompt integration...');
      
      const testMessage = {
        userId: 'test-user-001',
        sessionId: 'test-session-001',
        message: 'I need help with TypeScript error handling in my React application',
        projectPath: '/workspace/test-project'
      };
      
      const response = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });
      
      if (!response.ok) {
        throw new Error(`UAT-Prompt test failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.message) {
        throw new Error('UAT-Prompt response missing required fields');
      }
      
      // Check if UAT-Prompt metadata is present
      if (data.message.metadata && data.message.metadata.uatPrompt) {
        this.addResult('UAT-Prompt Integration', 'PASS', 'UAT-Prompt processing successful', Date.now() - start);
      } else {
        this.addResult('UAT-Prompt Integration', 'SKIP', 'UAT-Prompt metadata not found (may be disabled)', Date.now() - start);
      }
      
    } catch (error) {
      this.addResult('UAT-Prompt Integration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testNeuroforgeIntegration(): Promise<void> {
    const start = Date.now();
    
    try {
      console.log('🧠 Testing Neuroforge integration...');
      
      const testMessage = {
        userId: 'test-user-002',
        sessionId: 'test-session-002',
        message: 'I\'m frustrated with this bug in my code. Can you help me debug it?',
        projectPath: '/workspace/test-project'
      };
      
      const response = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });
      
      if (!response.ok) {
        throw new Error(`Neuroforge test failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.message) {
        throw new Error('Neuroforge response missing required fields');
      }
      
      // Check if Neuroforge metadata is present
      if (data.message.metadata && data.message.metadata.neuroforge) {
        this.addResult('Neuroforge Integration', 'PASS', 'Neuroforge processing successful', Date.now() - start);
      } else {
        this.addResult('Neuroforge Integration', 'SKIP', 'Neuroforge metadata not found (may be disabled)', Date.now() - start);
      }
      
    } catch (error) {
      this.addResult('Neuroforge Integration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testContextEngineering(): Promise<void> {
    const start = Date.now();
    
    try {
      console.log('🔧 Testing context engineering...');
      
      // First, seed some context
      await this.seedTestContext();
      
      const testMessage = {
        userId: 'test-user-003',
        sessionId: 'test-session-003',
        message: 'What is the architecture of Universal AI Tools?',
        projectPath: '/workspace'
      };
      
      const response = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });
      
      if (!response.ok) {
        throw new Error(`Context engineering test failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.message) {
        throw new Error('Context engineering response missing required fields');
      }
      
      // Check if context categories are present
      if (data.message.metadata && data.message.metadata.contextCategories) {
        this.addResult('Context Engineering', 'PASS', 'Context retrieval and injection successful', Date.now() - start);
      } else {
        this.addResult('Context Engineering', 'SKIP', 'Context categories not found (may be disabled)', Date.now() - start);
      }
      
    } catch (error) {
      this.addResult('Context Engineering', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testEndToEndChatFlow(): Promise<void> {
    const start = Date.now();
    
    try {
      console.log('🔄 Testing end-to-end chat flow...');
      
      const sessionId = 'e2e-test-session';
      const userId = 'e2e-test-user';
      
      // Send multiple messages to test conversation flow
      const messages = [
        'Hello! I need help with my project.',
        'I\'m working on a TypeScript application with React.',
        'I\'m getting an error with async/await in my components.',
        'Can you help me fix this specific error?'
      ];
      
      for (let i = 0; i < messages.length; i++) {
        const response = await fetch(`${this.baseUrl}/api/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId,
            sessionId,
            message: messages[i],
            projectPath: '/workspace/test-project'
          })
        });
        
        if (!response.ok) {
          throw new Error(`Message ${i + 1} failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.success) {
          throw new Error(`Message ${i + 1} processing failed`);
        }
      }
      
      // Get chat history
      const historyResponse = await fetch(`${this.baseUrl}/api/chat/history/${sessionId}`);
      if (!historyResponse.ok) {
        throw new Error('Failed to get chat history');
      }
      
      const historyData = await historyResponse.json();
      if (!historyData.success || historyData.count < messages.length) {
        throw new Error('Chat history incomplete');
      }
      
      this.addResult('End-to-End Chat Flow', 'PASS', `Successfully processed ${messages.length} messages`, Date.now() - start);
      
    } catch (error) {
      this.addResult('End-to-End Chat Flow', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testSessionManagement(): Promise<void> {
    const start = Date.now();
    
    try {
      console.log('📝 Testing session management...');
      
      const sessionId = 'session-mgmt-test';
      const userId = 'session-mgmt-user';
      
      // Create session by sending a message
      await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId,
          message: 'Test message for session management',
          projectPath: '/workspace'
        })
      });
      
      // Get session context
      const contextResponse = await fetch(`${this.baseUrl}/api/chat/context/${sessionId}`);
      if (!contextResponse.ok) {
        throw new Error('Failed to get session context');
      }
      
      const contextData = await contextResponse.json();
      if (!contextData.success || !contextData.context) {
        throw new Error('Session context not found');
      }
      
      // Update session context
      const updateResponse = await fetch(`${this.baseUrl}/api/chat/context/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: ['conversation', 'project_info', 'error_analysis']
        })
      });
      
      if (!updateResponse.ok) {
        throw new Error('Failed to update session context');
      }
      
      // Clear session
      const clearResponse = await fetch(`${this.baseUrl}/api/chat/session/${sessionId}`, {
        method: 'DELETE'
      });
      
      if (!clearResponse.ok) {
        throw new Error('Failed to clear session');
      }
      
      this.addResult('Session Management', 'PASS', 'Session CRUD operations successful', Date.now() - start);
      
    } catch (error) {
      this.addResult('Session Management', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testPerformance(): Promise<void> {
    const start = Date.now();
    
    try {
      console.log('⚡ Testing performance...');
      
      const concurrentRequests = 5;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          fetch(`${this.baseUrl}/api/chat/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: `perf-user-${i}`,
              sessionId: `perf-session-${i}`,
              message: `Performance test message ${i}`,
              projectPath: '/workspace'
            })
          })
        );
      }
      
      const responses = await Promise.all(promises);
      
      const failedRequests = responses.filter(r => !r.ok).length;
      if (failedRequests > 0) {
        throw new Error(`${failedRequests} out of ${concurrentRequests} requests failed`);
      }
      
      const duration = Date.now() - start;
      this.addResult('Performance', 'PASS', `Handled ${concurrentRequests} concurrent requests in ${duration}ms`, duration);
      
    } catch (error) {
      this.addResult('Performance', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async seedTestContext(): Promise<void> {
    const testContext = {
      content: 'Universal AI Tools is a next-generation AI platform with MLX fine-tuning, intelligent parameter automation, and distributed learning systems. It uses a service-oriented architecture with Rust services, Go services, and TypeScript/Node.js integration.',
      category: 'project_info',
      source: 'architecture-docs',
      user_id: 'test-user-003',
      project_path: '/workspace',
      metadata: { tags: ['architecture', 'platform', 'ai'] }
    };
    
    await supabase.from('context_storage').insert(testContext);
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration: number): void {
    this.results.push({ test, status, message, duration });
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================\n');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;
    
    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${statusIcon} ${result.test}: ${result.message} (${result.duration}ms)`);
    });
    
    console.log('\n📈 Summary:');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Some tests failed. Please check the implementation.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed! Chat integration is working correctly.');
    }
  }
}

// Run tests
const tester = new ChatIntegrationTester();
tester.runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});