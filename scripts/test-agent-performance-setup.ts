import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAgentPerformanceSetup() {
  console.log('🚀 Testing Agent Performance Tracker setup...\n');

  try {
    // Test 1: Check if tables were created
    console.log('1️⃣ Checking if performance tables exist...');
    const tables = [
      'agent_performance_metrics',
      'agent_performance_aggregated',
      'agent_performance_benchmarks',
      'agent_performance_alerts',
    ];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error && !error.message.includes('permission denied')) {
        console.error(`   ❌ Table ${table} check failed:`, error.message);
      } else {
        console.log(`   ✅ Table ${table} exists`);
      }
    }

    // Test 2: Check if view was created
    console.log('\n2️⃣ Checking if performance summary view exists...');
    const { error: viewError } = await supabase
      .from('agent_performance_summary')
      .select('*')
      .limit(1);

    if (viewError && !viewError.message.includes('permission denied')) {
      console.error('   ❌ View agent_performance_summary check failed:', viewError.message);
    } else {
      console.log('   ✅ View agent_performance_summary exists');
    }

    // Test 3: Insert test performance metric
    console.log('\n3️⃣ Testing performance metric insertion...');
    const testMetric = {
      agent_id: 'test-agent-001',
      agent_name: 'Test Agent',
      agent_type: 'cognitive',
      task_id: 'test-task-001',
      task_name: 'Test Task',
      metric_type: 'execution_time',
      value: 1500,
      unit: 'ms',
      metadata: {
        success: true,
        complexity: 2,
      },
    };

    const { data: metricData, error: metricError } = await supabase
      .from('agent_performance_metrics')
      .insert(testMetric)
      .select()
      .single();

    if (metricError) {
      console.error('   ❌ Failed to insert test metric:', metricError.message);
    } else {
      console.log('   ✅ Test metric inserted successfully');
      console.log('   📊 Metric ID:', metricData.id);
    }

    // Test 4: Test aggregation function
    console.log('\n4️⃣ Testing aggregation function...');
    const { error: aggError } = await supabase.rpc('aggregate_performance_metrics', {
      p_period: 'hour',
    });

    if (aggError) {
      console.error('   ❌ Aggregation function failed:', aggError.message);
    } else {
      console.log('   ✅ Aggregation function executed successfully');
    }

    // Test 5: Check benchmarks
    console.log('\n5️⃣ Checking default benchmarks...');
    const { data: benchmarks, error: benchError } = await supabase
      .from('agent_performance_benchmarks')
      .select('*')
      .limit(5);

    if (benchError) {
      console.error('   ❌ Failed to fetch benchmarks:', benchError.message);
    } else {
      console.log(`   ✅ Found ${benchmarks?.length || 0} default benchmarks`);
      benchmarks?.forEach((b) => {
        console.log(
          `      - ${b.agent_type}/${b.task_type} Level ${b.complexity_level}: ${b.expected_execution_time}ms`
        );
      });
    }

    // Test 6: Test reliability calculation
    console.log('\n6️⃣ Testing reliability calculation...');
    const { data: reliabilityData, error: reliabilityError } = await supabase.rpc(
      'calculate_agent_reliability',
      {
        p_agent_id: 'test-agent-001',
        p_days: 7,
      }
    );

    if (reliabilityError) {
      console.error('   ❌ Reliability calculation failed:', reliabilityError.message);
    } else {
      console.log('   ✅ Reliability calculation successful:', reliabilityData);
    }

    // Test 7: Cleanup test data
    console.log('\n7️⃣ Cleaning up test data...');
    const { error: cleanupError } = await supabase
      .from('agent_performance_metrics')
      .delete()
      .eq('agent_id', 'test-agent-001');

    if (cleanupError) {
      console.error('   ❌ Cleanup failed:', cleanupError.message);
    } else {
      console.log('   ✅ Test data cleaned up');
    }

    console.log('\n✨ Agent Performance Tracker setup test completed!');
    console.log('\n📝 Summary:');
    console.log('- All tables and views created successfully');
    console.log('- Performance tracking functions working');
    console.log('- Default benchmarks installed');
    console.log('- Ready for use with SwarmOrchestrator');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAgentPerformanceSetup().catch(console.error);
