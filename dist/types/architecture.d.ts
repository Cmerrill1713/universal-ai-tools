export interface ArchitectureRecommendation {
    id: string;
    type: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
}
export interface ArchitectureContext {
    currentStack: string[];
    performance: Record<string, number>;
    usage: Record<string, number>;
}
export interface ArchitecturePattern {
    id: string;
    name: string;
    description: string;
    category: string;
    pattern: any;
    framework?: string;
    patternType?: string;
    successRate?: number;
    useCases?: string[];
    implementation?: any;
}
//# sourceMappingURL=architecture.d.ts.map