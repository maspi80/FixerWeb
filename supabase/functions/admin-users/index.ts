import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const ROLE_VALUES = new Set(['admin', 'user']);
const PERMISSION_KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;
const DEFAULT_USER_COLOR = '#2563EB';
const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeRole(value: unknown) {
  const role = cleanText(value);
  return ROLE_VALUES.has(role) ? role : 'user';
}

function normalizeUserColor(value: unknown) {
  const color = cleanText(value).toUpperCase();
  return HEX_COLOR_PATTERN.test(color) ? color : DEFAULT_USER_COLOR;
}

function normalizePermissionRows(userId: string, permissions: unknown) {
  if (!Array.isArray(permissions)) return [];
  return permissions
    .map((permission) => ({
      user_id: userId,
      permission_key: cleanText((permission as { permission_key?: unknown })?.permission_key).toLowerCase(),
      allowed: Boolean((permission as { allowed?: unknown })?.allowed),
      updated_at: new Date().toISOString()
    }))
    .filter((permission) => PERMISSION_KEY_PATTERN.test(permission.permission_key));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: 'Brak konfiguracji funkcji administracyjnej.' }, 500);
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

    const callerId = authData.user.id;
    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', callerId)
      .maybeSingle();
    if (callerError) throw callerError;
    if (callerProfile?.role !== 'admin' || callerProfile?.is_active !== true) {
      return jsonResponse({ error: 'Brak uprawnień administratora.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action);

    const assertNotLastActiveAdmin = async (targetUserId: string, nextRole: string, nextActive: boolean) => {
      const { data: activeAdmins, error } = await adminClient
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true);
      if (error) throw error;
      const adminIds = (activeAdmins ?? []).map((profile) => profile.id);
      if (adminIds.length === 1 && adminIds[0] === targetUserId && (nextRole !== 'admin' || nextActive !== true)) {
        throw new Error('Nie można zmienić lub wyłączyć ostatniego aktywnego administratora.');
      }
    };

    if (action === 'listUsers') {
      const { data: profiles, error: profilesError } = await adminClient
        .from('profiles')
        .select('id, email, full_name, role, user_color, is_active, created_at, updated_at')
        .order('email', { ascending: true });
      if (profilesError) throw profilesError;

      const { data: permissions, error: permissionsError } = await adminClient
        .from('user_permissions')
        .select('id, user_id, permission_key, allowed, created_at, updated_at')
        .order('permission_key', { ascending: true });
      if (permissionsError) throw permissionsError;

      return jsonResponse({ profiles: profiles ?? [], permissions: permissions ?? [] });
    }

    if (action === 'createUser') {
      const email = cleanText(body.email).toLowerCase();
      const password = String(body.password ?? '');
      const fullName = cleanText(body.fullName);
      const role = normalizeRole(body.role);
      const userColor = normalizeUserColor(body.userColor);
      if (!email || !password || password.length < 6) {
        return jsonResponse({ error: 'Podaj email i hasło tymczasowe o długości co najmniej 6 znaków.' }, 400);
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });
      if (createError) throw createError;
      const user = created.user;
      if (!user) return jsonResponse({ error: 'Nie udało się utworzyć użytkownika Auth.' }, 500);

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .upsert({
          id: user.id,
          email,
          full_name: fullName,
          role,
          user_color: userColor,
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select('id, email, full_name, role, user_color, is_active, created_at, updated_at')
        .single();
      if (profileError) throw profileError;

      return jsonResponse({ profile });
    }

    if (action === 'updateUser') {
      const userId = cleanText(body.userId);
      const fullName = cleanText(body.fullName);
      const role = normalizeRole(body.role);
      const userColor = normalizeUserColor(body.userColor);
      const isActive = Boolean(body.isActive);
      if (!userId) return jsonResponse({ error: 'Brak ID użytkownika.' }, 400);

      await assertNotLastActiveAdmin(userId, role, isActive);

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .update({
          full_name: fullName,
          role,
          user_color: userColor,
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('id, email, full_name, role, user_color, is_active, created_at, updated_at')
        .single();
      if (profileError) throw profileError;

      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: fullName }
      });

      return jsonResponse({ profile });
    }

    if (action === 'savePermissions') {
      const userId = cleanText(body.userId);
      if (!userId) return jsonResponse({ error: 'Brak ID użytkownika.' }, 400);
      const rows = normalizePermissionRows(userId, body.permissions);
      const keys = rows.map((row) => row.permission_key);

      if (rows.length) {
        const { error: upsertError } = await adminClient
          .from('user_permissions')
          .upsert(rows, { onConflict: 'user_id,permission_key' });
        if (upsertError) throw upsertError;
      }

      return jsonResponse({ saved: keys.length });
    }

    if (action === 'updatePassword') {
      const userId = cleanText(body.userId);
      const password = String(body.password ?? '');
      if (!userId) return jsonResponse({ error: 'Brak ID użytkownika.' }, 400);
      if (!password || password.length < 6) {
        return jsonResponse({ error: 'Hasło musi mieć co najmniej 6 znaków.' }, 400);
      }

      const { error: passwordError } = await adminClient.auth.admin.updateUserById(userId, {
        password
      });
      if (passwordError) throw passwordError;

      return jsonResponse({ updated: true });
    }

    return jsonResponse({ error: 'Nieznana operacja administracyjna.' }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Operacja administracyjna nie powiodła się.' }, 500);
  }
});
