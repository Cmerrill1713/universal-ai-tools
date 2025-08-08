/*
 Integration tests for Supabase RLS on ai_memories and read-only compatibility view memories.
 These tests require real Supabase credentials. They will be skipped unless required env vars are set.
 Required env vars:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY (for anon/basic client)
  - SUPABASE_USER_A_TOKEN (JWT for user A)
  - SUPABASE_USER_B_TOKEN (JWT for user B)
  - SUPABASE_SERVICE_KEY (optional; service role tests)
*/

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || '';
const anon = process.env.SUPABASE_ANON_KEY || '';
const userAToken = process.env.SUPABASE_USER_A_TOKEN || '';
const userBToken = process.env.SUPABASE_USER_B_TOKEN || '';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';

const hasRequiredEnv = Boolean(url && anon && userAToken && userBToken);

// Helper to create a client that uses a static access token (user JWT)
function createUserClient(accessToken: string): SupabaseClient {
  return createClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe('Supabase RLS on ai_memories', () => {
  if (!hasRequiredEnv) {
    it.skip('skips: missing SUPABASE_URL/ANON_KEY/USER tokens', () => {
      /* no-op */
    });
    return;
  }

  const userA = createUserClient(userAToken);
  const userB = createUserClient(userBToken);
  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  const serviceClient = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

  let createdId: string | null = null;

  it('user A can insert and read own ai_memories row', async () => {
    const insertRes = await userA
      .from('ai_memories')
      .insert({
        content: 'rls-test-a',
        metadata: {},
        memory_type: 'test',
        service_id: crypto.randomUUID(),
      })
      .select('id')
      .single();

    expect(insertRes.error).toBeNull();
    expect(insertRes.data?.id).toBeTruthy();
    createdId = insertRes.data?.id || null;

    const readRes = await userA.from('ai_memories').select('*').eq('id', createdId).single();
    expect(readRes.error).toBeNull();
    expect(readRes.data?.content).toBe('rls-test-a');
  });

  it('user B cannot read user A row', async () => {
    const res = await userB.from('ai_memories').select('*').eq('id', createdId).maybeSingle();
    // With RLS, this should return no row (data=null) rather than an error
    expect(res.data).toBeNull();
  });

  it('anon cannot read user A row', async () => {
    const res = await anonClient.from('ai_memories').select('*').eq('id', createdId).maybeSingle();
    expect(res.data).toBeNull();
  });

  it('memories view is read-only (insert fails)', async () => {
    const res = await userA
      .from('memories')
      .insert({ content: 'should-fail', metadata: {} })
      .select('id')
      .maybeSingle();
    // Expect an error because the view is read-only
    expect(res.error).toBeTruthy();
  });

  (serviceClient ? it : it.skip)('service role can read user A row', async () => {
    const res = await serviceClient!
      .from('ai_memories')
      .select('id, content')
      .eq('id', createdId)
      .single();
    expect(res.error).toBeNull();
    expect(res.data?.content).toBe('rls-test-a');
  });
});

describe('DB HTTP functions lockdown', () => {
  if (!hasRequiredEnv) {
    it.skip('skips: missing SUPABASE_URL/ANON_KEY/USER tokens', () => {
      /* no-op */
    });
    return;
  }

  const client = createUserClient(userAToken);

  it('ai_generate_sql is not callable by app roles (if present)', async () => {
    // Some environments may not have this function; handle both cases
    const res = await client.rpc('ai_generate_sql', {
      prompt: 'SELECT 1',
      model: 'llama3.2:3b',
      temperature: 0.1,
    } as any);
    // Either we get an error due to permissions, or the function is missing (also error)
    expect(res.error).toBeTruthy();
  });
});
