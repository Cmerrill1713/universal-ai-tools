const { performance } = require('perf_hooks');

async function benchmarkThroughput() {
    console.log('Starting throughput benchmark...');
    
    const requests = [];
    const startTime = performance.now();
    
    // Simulate concurrent requests
    for (let i = 0; i < 100; i++) {
        requests.push(simulateRequest(i));
    }
    
    try {
        await Promise.all(requests);
        const endTime = performance.now();
        const duration = endTime - startTime;
        const throughput = (100 / duration) * 1000; // requests per second
        
        console.log(`Throughput benchmark results:`);
        console.log(`Total requests: 100`);
        console.log(`Duration: ${duration.toFixed(2)}ms`);
        console.log(`Throughput: ${throughput.toFixed(2)} requests/second`);
        
        return {
            totalRequests: 100,
            durationMs: duration,
            throughputRps: throughput,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Throughput benchmark failed:', error);
        return null;
    }
}

async function simulateRequest(id) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    return { id, status: 'completed' };
}

benchmarkThroughput().then(results => {
    if (results) {
        require('fs').writeFileSync('throughput_results.json', JSON.stringify(results, null, 2));
    }
});
