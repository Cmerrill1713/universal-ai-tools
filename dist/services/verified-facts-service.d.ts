export interface VerifiedFact {
    id?: string;
    question: string;
    answer: string;
    citations: {
        title: string;
        url: string;
        snippet?: string;
    }[];
    created_at?: string;
    updated_at?: string;
}
declare class VerifiedFactsService {
    private memory;
    upsertFact(fact: VerifiedFact): Promise<string | null>;
    findFact(question: string): Promise<VerifiedFact | null>;
}
export declare const verifiedFactsService: VerifiedFactsService;
export {};
//# sourceMappingURL=verified-facts-service.d.ts.map