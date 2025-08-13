import { execSync } from 'child_process';
class SyntaxGuardian {
    isRunning = false;
    checkInterval = 30000;
    constructor() {
        console.log('🛡️ Syntax Guardian initialized');
    }
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Syntax Guardian is already running');
            return;
        }
        this.isRunning = true;
        console.log('🔍 Starting Syntax Guardian monitoring...');
        await this.checkSyntax();
        setInterval(async () => {
            if (this.isRunning) {
                await this.checkSyntax();
            }
        }, this.checkInterval);
    }
    async checkSyntax() {
        try {
            console.log('🔍 Running syntax check...');
            execSync('npx tsc --noEmit --skipLibCheck', {
                cwd: process.cwd(),
                encoding: 'utf8',
                timeout: 30000,
            });
            console.log('✅ No syntax errors found');
        }
        catch (error) {
            const e = error;
            if (e.stdout || e.stderr) {
                const output = e.stdout || e.stderr || '';
                console.log('⚠️ Syntax issues detected, attempting auto-fix...');
                await this.attemptAutoFix(output);
            }
        }
    }
    async attemptAutoFix(_errorOutput) {
        try {
            console.log('🔧 Attempting auto-fix...');
            execSync('npm run lint:fix', {
                cwd: process.cwd(),
                stdio: 'inherit',
                timeout: 60000,
            });
            console.log('✅ Auto-fix completed');
        }
        catch (error) {
            console.log('❌ Auto-fix failed, manual intervention may be required');
        }
    }
    stop() {
        this.isRunning = false;
        console.log('🛑 Syntax Guardian stopped');
    }
}
if (require.main === module) {
    const guardian = new SyntaxGuardian();
    guardian.start().catch(console.error);
    process.on('SIGINT', () => {
        guardian.stop();
        process.exit(0);
    });
}
export { SyntaxGuardian };
//# sourceMappingURL=syntax-guardian.js.map