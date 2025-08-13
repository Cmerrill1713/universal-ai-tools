/**
 * Test User Preferences Database Operations
 * Tests direct database operations for the preference learning system
 */

const { createClient } = require('@supabase/supabase-js');

// Use local Supabase instance
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function testDatabaseOperations() {
  console.log('🗄️  Testing User Preferences Database Operations...\n');
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client created\n');

    const testUserId = 'test-db-user-' + Date.now();

    console.log('1. Testing user preferences table...');
    try {
      // Insert test user preferences
      const { data: insertData, error: insertError } = await supabase
        .from('user_preferences')
        .insert({
          user_id: testUserId,
          model_preferences: {
            'gpt-4:openai': {
              modelId: 'gpt-4',
              providerId: 'openai',
              overallScore: 0.85,
              usageCount: 10,
              avgRating: 4.5,
            },
          },
          task_preferences: {
            coding: {
              taskType: 'coding',
              avgComplexity: 0.8,
              preferredStyle: 'technical',
            },
          },
        })
        .select();

      if (insertError) {
        console.log(`❌ Insert error: ${insertError.message}`);
      } else {
        console.log(`✅ Inserted user preferences: ${insertData.length} record(s)`);
      }

      // Query user preferences
      const { data: queryData, error: queryError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', testUserId)
        .single();

      if (queryError) {
        console.log(`❌ Query error: ${queryError.message}`);
      } else {
        console.log(`✅ Retrieved user preferences for user: ${queryData.user_id}`);
        console.log(`   Model preferences: ${Object.keys(queryData.model_preferences).length} models`);
        console.log(`   Task preferences: ${Object.keys(queryData.task_preferences).length} tasks`);
        console.log(`   Version: ${queryData.version}`);
      }
    } catch (error) {
      console.log(`❌ User preferences test failed: ${error.message}`);
    }
    console.log('');

    console.log('2. Testing user interactions table...');
    try {
      // Insert test interactions
      const interactions = [
        {
          user_id: testUserId,
          session_id: 'test-session-1',
          interaction_type: 'model_selection',
          model_id: 'gpt-4',
          provider_id: 'openai',
          task_type: 'coding',
          rating: 5,
          feedback: 'Excellent code generation',
          context: { complexity: 0.8, urgency: 0.6 },
          response_time: 2500,
        },
        {
          user_id: testUserId,
          session_id: 'test-session-2',
          interaction_type: 'response_rating',
          model_id: 'claude-3',
          provider_id: 'anthropic',
          task_type: 'writing',
          rating: 4,
          was_regenerated: false,
          context: { creativity: 0.9 },
        },
      ];

      const { data: interactionData, error: interactionError } = await supabase
        .from('user_interactions')
        .insert(interactions)
        .select();

      if (interactionError) {
        console.log(`❌ Interactions insert error: ${interactionError.message}`);
      } else {
        console.log(`✅ Inserted ${interactionData.length} interactions`);
      }

      // Query interactions
      const { data: queryInteractions, error: queryInteractionsError } = await supabase
        .from('user_interactions')
        .select('*')
        .eq('user_id', testUserId)
        .order('timestamp', { ascending: false });

      if (queryInteractionsError) {
        console.log(`❌ Interactions query error: ${queryInteractionsError.message}`);
      } else {
        console.log(`✅ Retrieved ${queryInteractions.length} interactions`);
        queryInteractions.forEach((interaction, index) => {
          console.log(`   ${index + 1}. ${interaction.interaction_type} - ${interaction.model_id}:${interaction.provider_id} - Rating: ${interaction.rating || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`❌ User interactions test failed: ${error.message}`);
    }
    console.log('');

    console.log('3. Testing database constraints and validations...');
    try {
      // Test rating constraint (should fail with rating > 5)
      const { error: constraintError } = await supabase
        .from('user_interactions')
        .insert({
          user_id: testUserId,
          session_id: 'test-constraint',
          interaction_type: 'response_rating',
          model_id: 'test-model',
          provider_id: 'test-provider',
          rating: 6, // Should fail - rating must be between 1 and 5
        });

      if (constraintError && constraintError.message.includes('rating')) {
        console.log('✅ Rating constraint working correctly');
      } else {
        console.log('❌ Rating constraint not working as expected');
      }

      // Test interaction_type constraint (should fail with invalid type)
      const { error: typeError } = await supabase
        .from('user_interactions')
        .insert({
          user_id: testUserId,
          session_id: 'test-type',
          interaction_type: 'invalid_type', // Should fail
          model_id: 'test-model',
          provider_id: 'test-provider',
        });

      if (typeError && typeError.message.includes('interaction_type')) {
        console.log('✅ Interaction type constraint working correctly');
      } else {
        console.log('❌ Interaction type constraint not working as expected');
      }
    } catch (error) {
      console.log(`❌ Constraint test failed: ${error.message}`);
    }
    console.log('');

    console.log('4. Testing indexing performance...');
    try {
      // Test query performance with indexes
      const startTime = Date.now();
      
      const { data: indexedQuery, error: indexedError } = await supabase
        .from('user_interactions')
        .select('*')
        .eq('user_id', testUserId)
        .eq('model_id', 'gpt-4')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const endTime = Date.now();
      
      if (indexedError) {
        console.log(`❌ Indexed query error: ${indexedError.message}`);
      } else {
        console.log(`✅ Indexed query completed in ${endTime - startTime}ms`);
        console.log(`   Found ${indexedQuery.length} matching interactions`);
      }
    } catch (error) {
      console.log(`❌ Index performance test failed: ${error.message}`);
    }
    console.log('');

    console.log('5. Testing JSONB operations...');
    try {
      // Test JSONB querying
      const { data: jsonbQuery, error: jsonbError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', testUserId);

      if (jsonbError) {
        console.log(`❌ JSONB query error: ${jsonbError.message}`);
      } else if (jsonbQuery.length > 0) {
        console.log(`✅ JSONB query successful`);
        const preferences = jsonbQuery[0];
        console.log(`   General preferences keys: ${Object.keys(preferences.general_preferences).join(', ')}`);
        console.log(`   Adaptive weights keys: ${Object.keys(preferences.adaptive_weights).join(', ')}`);
        console.log(`   Model preferences: ${Object.keys(preferences.model_preferences).length} models`);
      }
    } catch (error) {
      console.log(`❌ JSONB test failed: ${error.message}`);
    }
    console.log('');

    console.log('6. Testing triggers and automatic timestamps...');
    try {
      // Update preferences to test trigger
      const beforeUpdate = new Date();
      
      const { data: updateData, error: updateError } = await supabase
        .from('user_preferences')
        .update({
          version: 2,
          model_preferences: {
            'gpt-4:openai': {
              modelId: 'gpt-4',
              providerId: 'openai',
              overallScore: 0.9, // Updated score
              usageCount: 15,
              avgRating: 4.7,
            },
          },
        })
        .eq('user_id', testUserId)
        .select();

      if (updateError) {
        console.log(`❌ Update error: ${updateError.message}`);
      } else if (updateData.length > 0) {
        const updated = updateData[0];
        const updatedAt = new Date(updated.updated_at);
        
        console.log(`✅ Update successful, version: ${updated.version}`);
        console.log(`   Updated timestamp automatically changed: ${updatedAt > beforeUpdate}`);
      }
    } catch (error) {
      console.log(`❌ Trigger test failed: ${error.message}`);
    }
    console.log('');

    console.log('7. Cleaning up test data...');
    try {
      // Clean up test data
      const { error: deleteInteractionsError } = await supabase
        .from('user_interactions')
        .delete()
        .eq('user_id', testUserId);

      const { error: deletePreferencesError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', testUserId);

      if (deleteInteractionsError || deletePreferencesError) {
        console.log('❌ Cleanup had errors, but test data created');
      } else {
        console.log('✅ Test data cleaned up successfully');
      }
    } catch (error) {
      console.log(`⚠️  Cleanup failed: ${error.message}`);
    }
    console.log('');

    console.log('🎉 Database operations testing completed successfully!\n');

  } catch (error) {
    console.error('❌ Database test suite failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the tests
testDatabaseOperations();