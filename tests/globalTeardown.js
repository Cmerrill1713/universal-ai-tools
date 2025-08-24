/**
 * Global Jest Teardown
 * Runs once after all test suites complete
 */
export default async function globalTeardown() {
    console.log('🧹 Cleaning up test environment...');
    // Force garbage collection before cleanup
    if (global.gc) {
        global.gc();
    }
    // Clean up test artifacts and cache
    try {
        const fs = await import('fs');
        const path = await import('path');
        // Clean Jest cache
        const cacheDir = path.join(process.cwd(), '.jest-cache');
        if (fs.existsSync(cacheDir)) {
            fs.rmSync(cacheDir, { recursive: true, force: true });
        }
        // Clean test temp files
        const tempPatterns = [
            'test-*.tmp',
            '*.test.log',
            'coverage/tmp/**/*'
        ];
        // Remove any lingering test files
        for (const pattern of tempPatterns) {
            try {
                const glob = await import('glob');
                const files = glob.globSync(pattern, { cwd: process.cwd() });
                files.forEach(file => {
                    try {
                        fs.unlinkSync(file);
                    }
                    catch (e) {
                        // Ignore individual file cleanup errors
                    }
                });
            }
            catch (e) {
                // Ignore glob/cleanup errors
            }
        }
    }
    catch (error) {
        // Ignore cleanup errors
    }
    // Force final garbage collection
    if (global.gc) {
        global.gc();
    }
    // Log final memory usage
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    console.log(`📊 Final memory usage: ${heapUsedMB}MB heap used`);
    console.log('✅ Test environment cleaned up');
}
//# sourceMappingURL=globalTeardown.js.map