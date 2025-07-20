const axios = require('axios');

async function testGraphQL() {
  console.log('Testing GraphQL Server...\n');
  
  const baseURL = 'http://localhost:8080';
  
  try {
    // Test 1: Check if GraphQL endpoint exists
    console.log('1. Testing GraphQL endpoint...');
    const response = await axios.post(`${baseURL}/graphql`, {
      query: `
        query TestQuery {
          __schema {
            queryType {
              name
            }
          }
        }
      `
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.data) {
      console.log('✅ GraphQL endpoint is working!');
      console.log('Schema query type:', response.data.data.__schema.queryType.name);
    }
    
    // Test 2: Check GraphQL health endpoint
    console.log('\n2. Testing GraphQL health check...');
    const healthResponse = await axios.get(`${baseURL}/api/graphql/health`);
    console.log('✅ GraphQL health check:', healthResponse.data);
    
    // Test 3: Try a simple query
    console.log('\n3. Testing a simple query...');
    const queryResponse = await axios.post(`${baseURL}/graphql`, {
      query: `
        query {
          systemInfo {
            version
            environment
            uptime
          }
        }
      `
    });
    
    if (queryResponse.data && queryResponse.data.data) {
      console.log('✅ System info query worked!');
      console.log('Response:', JSON.stringify(queryResponse.data.data, null, 2));
    }
    
    console.log('\n✅ GraphQL server is functional!');
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Error:', error.response.status, error.response.data);
      if (error.response.data && error.response.data.errors) {
        console.error('GraphQL Errors:', error.response.data.errors);
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Error: Server is not running. Please start the server first with "npm run dev"');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Run the test
testGraphQL();