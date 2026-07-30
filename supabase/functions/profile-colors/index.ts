import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const DEFAULT_USER_COLOR = '#2563EB';
const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function normalizeUserColor(value: unknown) {
  const color = String(value ?? '').trim().toUpperCase();
  return HEX_COLOR_PATTERN.test(color) ? color : DEFAULT_USER_COLOR;
}

function normalizeUserIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id ?? '').trim()).filter(Boolean))].slice(0, 100);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: 'Brak konfiguracji funkcji kolorów profili.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return jsonResponse({ error: 'Brak sesji użytkownika.' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData.user) return jsonResponse({ error: 'Nieprawidłowa sesja użytkownika.' }, 401);

    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('id, is_active')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (callerError) throw callerError;
    if (callerProfile?.is_active !== true) return jsonResponse({ error: 'Konto jest nieaktywne.' }, 403);

    const body = await req.json().catch(() => ({}));
    const userIds = normalizeUserIds(body.userIds);
    if (!userIds.length) return jsonResponse({ colors: {} });

    const { data, error } = await adminClient
      .from('profiles')
      .select('id, user_color')
      .in('id', userIds);
    if (error) throw error;

    const colors = Object.fromEntries(
      (data ?? []).map((profile) => [profile.id, normalizeUserColor(profile.user_color)])
    );
    return jsonResponse({ colors });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Nie udało się pobrać kolorów profili.' }, 500);
  }
});
