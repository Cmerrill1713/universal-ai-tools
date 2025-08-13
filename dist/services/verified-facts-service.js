import { getSupabaseClient } from '@/services/supabase-client';
class VerifiedFactsService {
    memory = [];
    async upsertFact(fact) {
        const supabase = getSupabaseClient();
        if (!supabase) {
            const existing = this.memory.find((f) => f.question === fact.question);
            if (existing)
                Object.assign(existing, fact);
            else
                this.memory.push({ ...fact, id: `${Date.now()}` });
            return fact.id || null;
        }
        const { data, error } = await supabase
            .from('verified_facts')
            .upsert({
            question: fact.question,
            answer: fact.answer,
            citations: fact.citations,
        }, { onConflict: 'question' })
            .select('id')
            .single();
        if (error)
            return null;
        return data?.id ?? null;
    }
    async findFact(question) {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return this.memory.find((f) => f.question === question) || null;
        }
        const { data, error } = await supabase
            .from('verified_facts')
            .select('id, question, answer, citations, created_at, updated_at')
            .eq('question', question)
            .limit(1)
            .maybeSingle();
        if (error)
            return null;
        return data || null;
    }
}
export const verifiedFactsService = new VerifiedFactsService();
//# sourceMappingURL=verified-facts-service.js.map