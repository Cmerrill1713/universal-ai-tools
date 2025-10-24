/**
 * Test Governance Integration with Chat, Neuroforge, and UAT-Prompt
 * Comprehensive testing of the democratic decision-making system
 */

import { createClient } from '@supabase/supabase-js';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
}

class GovernanceIntegrationTester {
  private baseUrl: string;
  private supabase: any;
  private results: TestResult[] = [];

  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:9999';
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
  }

  async runAllTests(): Promise<void> {
    console.log('🏛️ Universal AI Tools - Governance Integration Test Suite\n');
    console.log('Testing democratic decision-making with AI integration...\n');

    try {
      // Test 1: Database Setup
      await this.testDatabaseSetup();

      // Test 2: Governance Service Health
      await this.testGovernanceHealth();

      // Test 3: Republic Service Health
      await this.testRepublicHealth();

      // Test 4: Citizen Registration
      await this.testCitizenRegistration();

      // Test 5: Proposal Creation
      await this.testProposalCreation();

      // Test 6: Voting System
      await this.testVotingSystem();

      // Test 7: Consensus Building
      await this.testConsensusBuilding();

      // Test 8: Neural Voting Integration
      await this.testNeuralVotingIntegration();

      // Test 9: UAT-Prompt Integration
      await this.testUATPromptIntegration();

      // Test 10: Republic Statistics
      await this.testRepublicStatistics();

      // Test 11: End-to-End Democratic Process
      await this.testEndToEndDemocraticProcess();

      // Test 12: Performance Testing
      await this.testPerformance();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.addResult('Test Suite', 'FAIL', `Test suite failed: ${error}`, 0);
    }
  }

  private async testDatabaseSetup(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🗄️ Testing database setup...');

      // Test governance tables
      const { data: proposals, error: proposalsError } = await this.supabase
        .from('governance_proposals')
        .select('count')
        .limit(1);

      if (proposalsError) {
        throw new Error(`Governance proposals table error: ${proposalsError.message}`);
      }

      // Test republic tables
      const { data: citizens, error: citizensError } = await this.supabase
        .from('republic_citizens')
        .select('count')
        .limit(1);

      if (citizensError) {
        throw new Error(`Republic citizens table error: ${citizensError.message}`);
      }

      this.addResult('Database Setup', 'PASS', 'All governance and republic tables accessible', Date.now() - start);

    } catch (error) {
      this.addResult('Database Setup', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testGovernanceHealth(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🏛️ Testing governance service health...');

      const response = await fetch(`${this.baseUrl}/api/governance/health`);
      
      if (!response.ok) {
        throw new Error(`Governance health check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || data.data.status !== 'healthy') {
        throw new Error('Governance service not healthy');
      }

      this.addResult('Governance Health', 'PASS', 'Governance service is healthy', Date.now() - start);

    } catch (error) {
      this.addResult('Governance Health', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testRepublicHealth(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🏛️ Testing republic service health...');

      const response = await fetch(`${this.baseUrl}/api/governance/republic/stats`);
      
      if (!response.ok) {
        throw new Error(`Republic stats check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Republic service not responding');
      }

      this.addResult('Republic Health', 'PASS', 'Republic service is healthy', Date.now() - start);

    } catch (error) {
      this.addResult('Republic Health', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testCitizenRegistration(): Promise<void> {
    const start = Date.now();
    try {
      console.log('👥 Testing citizen registration...');

      const testCitizen = {
        username: `test_citizen_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        initialRole: 'citizen' as const
      };

      const response = await fetch(`${this.baseUrl}/api/governance/citizens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCitizen)
      });

      if (!response.ok) {
        throw new Error(`Citizen registration failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data.id) {
        throw new Error('Citizen registration response invalid');
      }

      this.addResult('Citizen Registration', 'PASS', 'Citizen registered successfully', Date.now() - start);

    } catch (error) {
      this.addResult('Citizen Registration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testProposalCreation(): Promise<void> {
    const start = Date.now();
    try {
      console.log('📝 Testing proposal creation...');

      const testProposal = {
        title: 'Test Governance Proposal',
        description: 'This is a test proposal for governance system validation',
        category: 'platform' as const,
        proposer: 'test_citizen_123',
        priority: 'medium' as const
      };

      const response = await fetch(`${this.baseUrl}/api/governance/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testProposal)
      });

      if (!response.ok) {
        throw new Error(`Proposal creation failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data.id) {
        throw new Error('Proposal creation response invalid');
      }

      this.addResult('Proposal Creation', 'PASS', 'Proposal created successfully', Date.now() - start);

    } catch (error) {
      this.addResult('Proposal Creation', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testVotingSystem(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🗳️ Testing voting system...');

      // First, get a proposal to vote on
      const proposalsResponse = await fetch(`${this.baseUrl}/api/governance/proposals`);
      const proposalsData = await proposalsResponse.json();
      
      if (!proposalsData.success || !proposalsData.data.length) {
        throw new Error('No proposals available for voting test');
      }

      const proposalId = proposalsData.data[0].id;

      const testVote = {
        proposalId: proposalId,
        voter: 'test_citizen_123',
        vote: 'yes' as const,
        confidence: 0.8,
        reasoning: 'This proposal aligns with our democratic values and technical goals'
      };

      const response = await fetch(`${this.baseUrl}/api/governance/votes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testVote)
      });

      if (!response.ok) {
        throw new Error(`Vote submission failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data.id) {
        throw new Error('Vote submission response invalid');
      }

      this.addResult('Voting System', 'PASS', 'Vote submitted successfully', Date.now() - start);

    } catch (error) {
      this.addResult('Voting System', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testConsensusBuilding(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🤝 Testing consensus building...');

      // Get a proposal for consensus
      const proposalsResponse = await fetch(`${this.baseUrl}/api/governance/proposals`);
      const proposalsData = await proposalsResponse.json();
      
      if (!proposalsData.success || !proposalsData.data.length) {
        throw new Error('No proposals available for consensus test');
      }

      const proposalId = proposalsData.data[0].id;

      const response = await fetch(`${this.baseUrl}/api/governance/proposals/${proposalId}/consensus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Consensus building failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data.proposalId) {
        throw new Error('Consensus building response invalid');
      }

      this.addResult('Consensus Building', 'PASS', 'Consensus built successfully', Date.now() - start);

    } catch (error) {
      this.addResult('Consensus Building', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testNeuralVotingIntegration(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🧠 Testing neural voting integration...');

      // Test if neural voting is enabled
      const response = await fetch(`${this.baseUrl}/api/governance/health`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Governance health check failed');
      }

      const neuralVotingEnabled = data.data.services?.neuralVoting;
      
      if (neuralVotingEnabled) {
        this.addResult('Neural Voting Integration', 'PASS', 'Neural voting is enabled and integrated', Date.now() - start);
      } else {
        this.addResult('Neural Voting Integration', 'SKIP', 'Neural voting is disabled', Date.now() - start);
      }

    } catch (error) {
      this.addResult('Neural Voting Integration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testUATPromptIntegration(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🔧 Testing UAT-prompt integration...');

      // Test if UAT-prompt analysis is enabled
      const response = await fetch(`${this.baseUrl}/api/governance/health`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Governance health check failed');
      }

      const uatPromptEnabled = data.data.services?.uatPromptAnalysis;
      
      if (uatPromptEnabled) {
        this.addResult('UAT-Prompt Integration', 'PASS', 'UAT-prompt analysis is enabled and integrated', Date.now() - start);
      } else {
        this.addResult('UAT-Prompt Integration', 'SKIP', 'UAT-prompt analysis is disabled', Date.now() - start);
      }

    } catch (error) {
      this.addResult('UAT-Prompt Integration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testRepublicStatistics(): Promise<void> {
    const start = Date.now();
    try {
      console.log('📊 Testing republic statistics...');

      const response = await fetch(`${this.baseUrl}/api/governance/republic/stats`);
      
      if (!response.ok) {
        throw new Error(`Republic stats failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data.totalCitizens) {
        throw new Error('Republic statistics response invalid');
      }

      this.addResult('Republic Statistics', 'PASS', 'Republic statistics retrieved successfully', Date.now() - start);

    } catch (error) {
      this.addResult('Republic Statistics', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testEndToEndDemocraticProcess(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🔄 Testing end-to-end democratic process...');

      // Step 1: Register a citizen
      const citizen = {
        username: `demo_citizen_${Date.now()}`,
        email: `demo_${Date.now()}@example.com`
      };

      const citizenResponse = await fetch(`${this.baseUrl}/api/governance/citizens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(citizen)
      });

      if (!citizenResponse.ok) {
        throw new Error('Citizen registration failed in E2E test');
      }

      // Step 2: Create a proposal
      const proposal = {
        title: 'E2E Test Proposal',
        description: 'Testing the complete democratic process',
        category: 'governance',
        proposer: 'demo_citizen_123',
        priority: 'high'
      };

      const proposalResponse = await fetch(`${this.baseUrl}/api/governance/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal)
      });

      if (!proposalResponse.ok) {
        throw new Error('Proposal creation failed in E2E test');
      }

      const proposalData = await proposalResponse.json();

      // Step 3: Submit votes
      const votes = [
        { proposalId: proposalData.data.id, voter: 'demo_citizen_123', vote: 'yes', confidence: 0.9, reasoning: 'Strong support' },
        { proposalId: proposalData.data.id, voter: 'test_citizen_456', vote: 'yes', confidence: 0.8, reasoning: 'Good idea' },
        { proposalId: proposalData.data.id, voter: 'test_citizen_789', vote: 'no', confidence: 0.7, reasoning: 'Needs more discussion' }
      ];

      for (const vote of votes) {
        const voteResponse = await fetch(`${this.baseUrl}/api/governance/votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vote)
        });

        if (!voteResponse.ok) {
          throw new Error('Vote submission failed in E2E test');
        }
      }

      // Step 4: Build consensus
      const consensusResponse = await fetch(`${this.baseUrl}/api/governance/proposals/${proposalData.data.id}/consensus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!consensusResponse.ok) {
        throw new Error('Consensus building failed in E2E test');
      }

      this.addResult('End-to-End Democratic Process', 'PASS', 'Complete democratic process executed successfully', Date.now() - start);

    } catch (error) {
      this.addResult('End-to-End Democratic Process', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testPerformance(): Promise<void> {
    const start = Date.now();
    try {
      console.log('⚡ Testing governance system performance...');

      const performanceTests = [
        { name: 'Get Proposals', url: '/api/governance/proposals' },
        { name: 'Get Citizens', url: '/api/governance/citizens' },
        { name: 'Get Stats', url: '/api/governance/stats' },
        { name: 'Get Republic Stats', url: '/api/governance/republic/stats' }
      ];

      const results = await Promise.all(
        performanceTests.map(async (test) => {
          const testStart = Date.now();
          const response = await fetch(`${this.baseUrl}${test.url}`);
          const duration = Date.now() - testStart;
          
          return {
            test: test.name,
            duration,
            success: response.ok
          };
        })
      );

      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const allSuccessful = results.every(r => r.success);

      if (allSuccessful && avgDuration < 1000) {
        this.addResult('Performance', 'PASS', `Average response time: ${Math.round(avgDuration)}ms`, Date.now() - start);
      } else {
        this.addResult('Performance', 'FAIL', `Performance issues: avg ${Math.round(avgDuration)}ms, success: ${allSuccessful}`, Date.now() - start);
      }

    } catch (error) {
      this.addResult('Performance', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration: number): void {
    this.results.push({ test, status, message, duration });
  }

  private displayResults(): void {
    console.log('\n📊 Test Results Summary\n');
    console.log('=' .repeat(80));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

    console.log('\n📋 Detailed Results\n');
    console.log('-'.repeat(80));

    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      const duration = `${result.duration}ms`;
      console.log(`${statusIcon} ${result.test.padEnd(30)} ${duration.padStart(8)} ${result.message}`);
    });

    console.log('\n' + '='.repeat(80));

    if (failed === 0) {
      console.log('🎉 All tests passed! Governance system is ready for democratic decision-making.');
    } else {
      console.log('⚠️ Some tests failed. Please review the issues above.');
    }
  }
}

// Run the tests
async function main() {
  const tester = new GovernanceIntegrationTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { GovernanceIntegrationTester };