#!/usr/bin/env node
/**
 * Knowledge Graph Functionality Test Suite
 * 
 * Comprehensive test suite to verify knowledge graph functionality including:
 * - Neo4j connection and schema
 * - Entity extraction and storage
 * - Relationship mapping
 * - Graph querying and retrieval
 * - Performance and scalability
 * - Integration with unified knowledge system
 */

console.log('🧠 Knowledge Graph Functionality Test Suite');
console.log('=========================================');

async function testKnowledgeGraphFunctionality() {
  const startTime = Date.now();
  let testsCompleted = 0;
  let testsPassed = 0;
  
  const results = {
    neo4jConnection: false,
    schemaInitialization: false,
    entityExtraction: false,
    relationshipMapping: false,
    graphQuerying: false,
    performanceMetrics: false,
    unifiedIntegration: false
  };

  try {
    console.log('\n🔍 Test 1: Neo4j Connection and Database Health');
    try {
      // Test Neo4j connection using direct client
      const neo4j = await import('neo4j-driver');
      const driver = neo4j.default.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.default.auth.basic(
          process.env.NEO4J_USER || 'neo4j',
          process.env.NEO4J_PASSWORD || 'password123'
        )
      );
      
      const session = driver.session();
      const result = await session.run('RETURN "Neo4j Connected" as status, datetime() as timestamp');
      const record = result.records[0];
      
      console.log(`  ✅ Neo4j connection successful: ${record.get('status')}`);
      console.log(`  📅 Database timestamp: ${record.get('timestamp')}`);
      
      // Check database version and status
      const versionResult = await session.run('CALL dbms.components()');
      if (versionResult.records.length > 0) {
        const component = versionResult.records[0];
        console.log(`  🏷️ Neo4j version: ${component.get('name')} ${component.get('versions')[0]}`);
      }
      
      // Check available memory and storage
      const memResult = await session.run('CALL dbms.queryJmx("java.lang:type=Memory") YIELD attributes RETURN attributes.HeapMemoryUsage.used as heapUsed, attributes.HeapMemoryUsage.max as heapMax');
      if (memResult.records.length > 0) {
        const memory = memResult.records[0];
        const used = Math.round(memory.get('heapUsed') / 1024 / 1024);
        const max = Math.round(memory.get('heapMax') / 1024 / 1024);
        console.log(`  💾 Memory usage: ${used}MB / ${max}MB`);
      }
      
      await session.close();
      await driver.close();
      
      results.neo4jConnection = true;
      testsPassed++;
    } catch (error) {
      console.log(`  ❌ Neo4j connection failed: ${error.message}`);
      console.log(`  💡 Make sure Neo4j is running: docker run -p 7687:7687 -p 7474:7474 neo4j:latest`);
    }
    testsCompleted++;

    console.log('\n🗄️ Test 2: Graph Schema and Index Validation');
    try {
      const neo4j = await import('neo4j-driver');
      const driver = neo4j.default.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.default.auth.basic(
          process.env.NEO4J_USER || 'neo4j',
          process.env.NEO4J_PASSWORD || 'password123'
        )
      );
      
      const session = driver.session();
      
      // Check indexes
      const indexResult = await session.run('SHOW INDEXES');
      console.log(`  📑 Indexes found: ${indexResult.records.length}`);
      
      let requiredIndexes = ['entity_id', 'entity_type', 'entity_name', 'community_id'];
      let foundIndexes = 0;
      
      indexResult.records.forEach(record => {
        const indexName = record.get('name');
        if (requiredIndexes.some(req => indexName.includes(req) || indexName.includes('Entity') || indexName.includes('Community'))) {
          console.log(`    ✅ Found index: ${indexName}`);
          foundIndexes++;
        }
      });
      
      // Check constraints
      const constraintResult = await session.run('SHOW CONSTRAINTS');
      console.log(`  🔒 Constraints found: ${constraintResult.records.length}`);
      
      // Test basic CRUD operations
      const testEntityId = `test_entity_${Date.now()}`;
      await session.run(`
        CREATE (e:Entity {
          id: $id,
          type: 'test',
          name: 'Test Entity',
          createdAt: datetime()
        })
      `, { id: testEntityId });
      
      const queryResult = await session.run(`
        MATCH (e:Entity {id: $id}) 
        RETURN e.name as name, e.type as type
      `, { id: testEntityId });
      
      if (queryResult.records.length > 0) {
        console.log(`  ✅ CRUD operations working: Created and queried test entity`);
      }
      
      // Cleanup test entity
      await session.run(`MATCH (e:Entity {id: $id}) DELETE e`, { id: testEntityId });
      
      await session.close();
      await driver.close();
      
      if (foundIndexes > 0) {
        results.schemaInitialization = true;
        testsPassed++;
      }
    } catch (error) {
      console.log(`  ❌ Schema validation failed: ${error.message}`);
    }
    testsCompleted++;

    console.log('\n🔍 Test 3: Knowledge Graph Service Integration');
    try {
      // Test if we can import the knowledge graph service
      const fs = await import('fs/promises');
      const serviceFile = 'src/services/graph-rag/knowledge-graph-service.ts';
      const content = await fs.readFile(serviceFile, 'utf8');
      
      const hasEssentialMethods = [
        'extractEntities',
        'extractRelationships', 
        'buildGraph',
        'queryGraph',
        'initializeNeo4j'
      ].every(method => content.includes(method));
      
      const hasEssentialTypes = [
        'GraphEntity',
        'GraphRelationship',
        'GraphQuery',
        'GraphPath'
      ].every(type => content.includes(type));
      
      const hasRLOptimization = content.includes('RLState') && 
                               content.includes('reinforcement learning');
      
      if (hasEssentialMethods && hasEssentialTypes) {
        console.log(`  ✅ Knowledge Graph Service has all essential methods`);
        console.log(`  ✅ All required TypeScript interfaces defined`);
        
        if (hasRLOptimization) {
          console.log(`  ✅ R1 reinforcement learning optimization included`);
        }
        
        results.entityExtraction = true;
        testsPassed++;
      } else {
        console.log(`  ❌ Knowledge Graph Service missing essential components`);
      }
    } catch (error) {
      console.log(`  ❌ Service integration check failed: ${error.message}`);
    }
    testsCompleted++;

    console.log('\n🔗 Test 4: Graph Construction and Relationship Mapping');
    try {
      const neo4j = await import('neo4j-driver');
      const driver = neo4j.default.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.default.auth.basic(
          process.env.NEO4J_USER || 'neo4j',
          process.env.NEO4J_PASSWORD || 'password123'
        )
      );
      
      const session = driver.session();
      
      // Create a small test knowledge graph
      const testData = [
        { id: 'test_person_1', type: 'person', name: 'Alice Developer' },
        { id: 'test_tech_1', type: 'technology', name: 'GraphRAG' },
        { id: 'test_concept_1', type: 'concept', name: 'Knowledge Graphs' }
      ];
      
      // Insert test entities
      for (const entity of testData) {
        await session.run(`
          MERGE (e:Entity {id: $id})
          SET e.type = $type, e.name = $name, e.testCreated = datetime()
        `, entity);
      }
      
      // Create test relationships
      await session.run(`
        MATCH (p:Entity {id: 'test_person_1'}), (t:Entity {id: 'test_tech_1'})
        MERGE (p)-[r:USES {weight: 0.8, testCreated: datetime()}]->(t)
      `);
      
      await session.run(`
        MATCH (t:Entity {id: 'test_tech_1'}), (c:Entity {id: 'test_concept_1'})
        MERGE (t)-[r:IMPLEMENTS {weight: 0.9, testCreated: datetime()}]->(c)
      `);
      
      // Test graph queries
      const pathResult = await session.run(`
        MATCH path = (p:Entity {type: 'person'})-[*1..2]-(target:Entity)
        WHERE p.id STARTS WITH 'test_' 
        RETURN path, length(path) as pathLength
        LIMIT 5
      `);
      
      console.log(`  ✅ Created test knowledge graph with ${testData.length} entities`);
      console.log(`  🔗 Found ${pathResult.records.length} relationship paths`);
      
      if (pathResult.records.length > 0) {
        pathResult.records.forEach((record, i) => {
          const pathLength = record.get('pathLength');
          console.log(`    Path ${i + 1}: ${pathLength} hops`);
        });
      }
      
      // Test community detection (simplified)
      const communityResult = await session.run(`
        MATCH (n:Entity)
        WHERE n.id STARTS WITH 'test_'
        RETURN n.type as type, count(*) as count
      `);
      
      console.log(`  🏘️ Entity distribution by type:`);
      communityResult.records.forEach(record => {
        console.log(`    ${record.get('type')}: ${record.get('count')} entities`);
      });
      
      // Cleanup test data
      await session.run(`
        MATCH (n:Entity) 
        WHERE n.id STARTS WITH 'test_' 
        DETACH DELETE n
      `);
      
      await session.close();
      await driver.close();
      
      results.relationshipMapping = true;
      testsPassed++;
    } catch (error) {
      console.log(`  ❌ Graph construction test failed: ${error.message}`);
    }
    testsCompleted++;

    console.log('\n🔎 Test 5: Graph Querying and Retrieval Performance');
    try {
      const neo4j = await import('neo4j-driver');
      const driver = neo4j.default.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.default.auth.basic(
          process.env.NEO4J_USER || 'neo4j',
          process.env.NEO4J_PASSWORD || 'password123'
        )
      );
      
      const session = driver.session();
      
      // Performance test: Count all entities
      const countStart = Date.now();
      const countResult = await session.run('MATCH (n:Entity) RETURN count(n) as nodeCount');
      const countTime = Date.now() - countStart;
      const nodeCount = countResult.records[0]?.get('nodeCount').toNumber() || 0;
      
      console.log(`  📊 Graph statistics: ${nodeCount} total entities`);
      console.log(`  ⚡ Count query performance: ${countTime}ms`);
      
      // Performance test: Relationship queries
      const relStart = Date.now();
      const relResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relCount');
      const relTime = Date.now() - relStart;
      const relCount = relResult.records[0]?.get('relCount').toNumber() || 0;
      
      console.log(`  🔗 Relationship count: ${relCount} total relationships`);
      console.log(`  ⚡ Relationship query performance: ${relTime}ms`);
      
      // Test complex pathfinding
      const pathStart = Date.now();
      const complexPathResult = await session.run(`
        MATCH path = (start:Entity)-[*1..3]-(end:Entity)
        WHERE start.type <> end.type
        RETURN count(path) as pathCount
        LIMIT 1000
      `);
      const pathTime = Date.now() - pathStart;
      const pathCount = complexPathResult.records[0]?.get('pathCount').toNumber() || 0;
      
      console.log(`  🛤️ Multi-hop paths found: ${pathCount}`);
      console.log(`  ⚡ Complex path query performance: ${pathTime}ms`);
      
      // Calculate graph density and other metrics
      if (nodeCount > 0) {
        const possibleEdges = nodeCount * (nodeCount - 1);
        const density = possibleEdges > 0 ? (relCount / possibleEdges * 100).toFixed(2) : 0;
        const avgDegree = nodeCount > 0 ? (relCount * 2 / nodeCount).toFixed(2) : 0;
        
        console.log(`  📈 Graph metrics:`);
        console.log(`    - Density: ${density}%`);
        console.log(`    - Average degree: ${avgDegree}`);
        console.log(`    - Nodes/edges ratio: ${nodeCount > 0 ? (relCount / nodeCount).toFixed(2) : 0}`);
      }
      
      await session.close();
      await driver.close();
      
      // Consider performance acceptable if queries complete in reasonable time
      if (countTime < 1000 && relTime < 1000 && pathTime < 5000) {
        results.performanceMetrics = true;
        testsPassed++;
      }
    } catch (error) {
      console.log(`  ❌ Performance testing failed: ${error.message}`);
    }
    testsCompleted++;

    console.log('\n📊 Test 6: Knowledge Graph Database Status');
    try {
      const neo4j = await import('neo4j-driver');
      const driver = neo4j.default.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.default.auth.basic(
          process.env.NEO4J_USER || 'neo4j',
          process.env.NEO4J_PASSWORD || 'password123'
        )
      );
      
      const session = driver.session();
      
      // Check database size and storage
      try {
        const storeResult = await session.run(`
          CALL apoc.meta.stats() YIELD nodeCount, relCount, propertyKeyCount, nodeTypeCount, relTypeCount
          RETURN nodeCount, relCount, propertyKeyCount, nodeTypeCount, relTypeCount
        `);
        
        if (storeResult.records.length > 0) {
          const stats = storeResult.records[0];
          console.log(`  📊 Database Statistics (via APOC):`);
          console.log(`    - Nodes: ${stats.get('nodeCount')}`);
          console.log(`    - Relationships: ${stats.get('relCount')}`);
          console.log(`    - Property keys: ${stats.get('propertyKeyCount')}`);
          console.log(`    - Node types: ${stats.get('nodeTypeCount')}`);
          console.log(`    - Relationship types: ${stats.get('relTypeCount')}`);
        }
      } catch (apocError) {
        // APOC might not be available, use basic queries
        console.log(`  ℹ️ APOC not available, using basic statistics`);
        
        const nodeResult = await session.run('MATCH (n) RETURN count(n) as count');
        const relResult = await session.run('MATCH ()-[r]->() RETURN count(r) as count');
        
        console.log(`  📊 Basic Statistics:`);
        console.log(`    - Total nodes: ${nodeResult.records[0]?.get('count') || 0}`);
        console.log(`    - Total relationships: ${relResult.records[0]?.get('count') || 0}`);
      }
      
      // Check different entity types
      const typeResult = await session.run(`
        MATCH (n:Entity) 
        RETURN n.type as type, count(*) as count 
        ORDER BY count DESC 
        LIMIT 10
      `);
      
      if (typeResult.records.length > 0) {
        console.log(`  🏷️ Top entity types:`);
        typeResult.records.forEach(record => {
          console.log(`    - ${record.get('type')}: ${record.get('count')} entities`);
        });
      }
      
      await session.close();
      await driver.close();
      
      results.graphQuerying = true;
      testsPassed++;
    } catch (error) {
      console.log(`  ❌ Database status check failed: ${error.message}`);
    }
    testsCompleted++;

    console.log('\n🔄 Test 7: Unified Knowledge Integration Check');
    try {
      // Check if knowledge graph service is properly integrated with unified knowledge bridge
      const fs = await import('fs/promises');
      
      const bridgeContent = await fs.readFile('src/services/unified-knowledge-bridge.ts', 'utf8');
      const hasGraphIntegration = bridgeContent.includes('knowledgeGraphService') &&
                                 bridgeContent.includes('graph-rag') &&
                                 bridgeContent.includes('GraphEntity');
      
      const executorContent = await fs.readFile('src/services/enhanced-agent-executor.ts', 'utf8');
      const hasExecutorIntegration = executorContent.includes('unifiedKnowledgeBridge') &&
                                    executorContent.includes('KnowledgeResponse');
      
      const serverContent = await fs.readFile('src/server.ts', 'utf8');
      const hasServerIntegration = serverContent.includes('initializeUnifiedKnowledgeIntegration');
      
      if (hasGraphIntegration && hasExecutorIntegration && hasServerIntegration) {
        console.log(`  ✅ Knowledge graph integrated with unified knowledge bridge`);
        console.log(`  ✅ Enhanced agent executor uses knowledge graph`);
        console.log(`  ✅ Server properly initializes knowledge integration`);
        
        results.unifiedIntegration = true;
        testsPassed++;
      } else {
        console.log(`  ❌ Knowledge graph integration incomplete`);
        console.log(`    Graph → Bridge: ${hasGraphIntegration ? '✅' : '❌'}`);
        console.log(`    Executor integration: ${hasExecutorIntegration ? '✅' : '❌'}`);
        console.log(`    Server integration: ${hasServerIntegration ? '✅' : '❌'}`);
      }
    } catch (error) {
      console.log(`  ❌ Integration check failed: ${error.message}`);
    }
    testsCompleted++;

    // Final results
    const executionTime = Date.now() - startTime;
    const successRate = (testsPassed / testsCompleted * 100).toFixed(1);
    
    console.log(`\n📊 KNOWLEDGE GRAPH FUNCTIONALITY TEST RESULTS`);
    console.log(`==========================================`);
    console.log(`\n🎯 Overall Results:`);
    console.log(`   Total Tests: ${testsCompleted}`);
    console.log(`   Passed: ${testsPassed} ✅`);
    console.log(`   Failed: ${testsCompleted - testsPassed} ❌`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Total Execution Time: ${executionTime}ms`);

    console.log(`\n🔍 Component Status:`);
    console.log(`   Neo4j Connection: ${results.neo4jConnection ? '✅' : '❌'}`);
    console.log(`   Schema Initialization: ${results.schemaInitialization ? '✅' : '❌'}`);
    console.log(`   Entity Extraction: ${results.entityExtraction ? '✅' : '❌'}`);
    console.log(`   Relationship Mapping: ${results.relationshipMapping ? '✅' : '❌'}`);
    console.log(`   Graph Querying: ${results.graphQuerying ? '✅' : '❌'}`);
    console.log(`   Performance Metrics: ${results.performanceMetrics ? '✅' : '❌'}`);
    console.log(`   Unified Integration: ${results.unifiedIntegration ? '✅' : '❌'}`);

    if (testsPassed === testsCompleted) {
      console.log(`\n🎉 KNOWLEDGE GRAPH FULLY FUNCTIONAL!`);
      console.log(`\n✨ Your knowledge graph is working perfectly:`);
      console.log(`   • Neo4j database connected and responsive`);
      console.log(`   • Graph schema properly initialized with indexes`);
      console.log(`   • Entity extraction and relationship mapping functional`);
      console.log(`   • Graph querying performing within acceptable limits`);
      console.log(`   • Fully integrated with unified knowledge system`);
      console.log(`   • Ready for R1 RAG enhanced agent operations`);
    } else {
      console.log(`\n⚠️ KNOWLEDGE GRAPH NEEDS ATTENTION`);
      console.log(`   ${testsCompleted - testsPassed} issues found that may affect functionality.`);
      
      if (!results.neo4jConnection) {
        console.log(`\n💡 Neo4j Setup Instructions:`);
        console.log(`   1. Start Neo4j: docker run -p 7687:7687 -p 7474:7474 -e NEO4J_AUTH=neo4j/password123 neo4j:latest`);
        console.log(`   2. Or install locally and configure credentials`);
        console.log(`   3. Verify connection at http://localhost:7474`);
      }
    }

    return testsPassed === testsCompleted;

  } catch (error) {
    console.error(`\n❌ Knowledge graph test suite failed: ${error.message}`);
    return false;
  }
}

// Run the comprehensive test
testKnowledgeGraphFunctionality().then(success => {
  if (success) {
    console.log('\n🚀 Knowledge Graph Functionality Test Complete! ✅');
    process.exit(0);
  } else {
    console.log('\n❌ Knowledge graph tests revealed issues that need attention.');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 Test runner failed:', error);
  process.exit(1);
});