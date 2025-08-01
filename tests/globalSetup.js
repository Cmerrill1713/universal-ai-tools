export default async function globalSetup() {
    console.log('🧪 Setting up test environment...');
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    console.log('✅ Test environment ready');
}
//# sourceMappingURL=globalSetup.js.map