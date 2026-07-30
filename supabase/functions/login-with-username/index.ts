import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function normalizeUsername(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: 'Brak konfiguracji logowania.' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(body.username);
    const password = String(body.password ?? '');
    if (!USERNAME_PATTERN.test(username) || !password) {
      return jsonResponse({ error: 'Nieprawidłowy login lub hasło.' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false }
    });

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('email, is_active')
      .eq('username', username)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.email || profile.is_active !== true) {
      return jsonResponse({ error: 'Nieprawidłowy login lub hasło.' }, 401);
    }

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: profile.email,
      password
    });
    if (signInError || !signInData.session) {
      return jsonResponse({ error: 'Nieprawidłowy login lub hasło.' }, 401);
    }

    return jsonResponse({ session: signInData.session, user: signInData.user });
  } catch (_error) {
    return jsonResponse({ error: 'Nieprawidłowy login lub hasło.' }, 401);
  }
});
