declare class SyntaxGuardian {
    private isRunning;
    private checkInterval;
    constructor();
    start(): Promise<void>;
    checkSyntax(): Promise<void>;
    attemptAutoFix(_errorOutput: string): Promise<void>;
    stop(): void;
}
export { SyntaxGuardian };
//# sourceMappingURL=syntax-guardian.d.ts.map