#!/usr/bin/env node
/**
 * Simple Neo4j Health Check
 */

console.log('🔍 Simple Neo4j Health Check');

async function testNeo4jHealth() {
  try {
    const neo4j = await import('neo4j-driver');
    const driver = neo4j.default.driver(
      'bolt://localhost:7687',
      neo4j.default.auth.basic('neo4j', 'password123')
    );
    
    const session = driver.session();
    
    console.log('📡 Testing connection...');
    const result = await session.run('RETURN "Hello Neo4j" as message');
    console.log(`✅ Connection successful: ${result.records[0].get('message')}`);
    
    console.log('🗑️ Cleaning any test data...');
    await session.run('MATCH (n) WHERE n.testData = true DETACH DELETE n');
    
    console.log('🧪 Creating test entity...');
    await session.run(`
      CREATE (e:Entity {
        id: 'test_health_check',
        name: 'Health Check Entity',
        type: 'test',
        testData: true
      })
    `);
    
    console.log('🔍 Querying test entity...');
    const queryResult = await session.run(`
      MATCH (e:Entity {id: 'test_health_check'})
      RETURN e.name as name
    `);
    
    if (queryResult.records.length > 0) {
      console.log(`✅ Query successful: Found ${queryResult.records[0].get('name')}`);
    }
    
    console.log('🗑️ Cleaning up...');
    await session.run('MATCH (n) WHERE n.testData = true DELETE n');
    
    await session.close();
    await driver.close();
    
    console.log('✅ Neo4j is healthy and operational!');
    return true;
    
  } catch (error) {
    console.log(`❌ Neo4j health check failed: ${error.message}`);
    return false;
  }
}

testNeo4jHealth().then(healthy => {
  process.exit(healthy ? 0 : 1);
});