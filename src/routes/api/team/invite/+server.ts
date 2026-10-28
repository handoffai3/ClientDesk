import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { supabaseAdmin } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request, url }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ message: 'Team invitations need SUPABASE_SERVICE_ROLE_KEY to be set on the server.' }, { status: 501 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ message: 'Not signed in.' }, { status: 401 });

  const { data: caller, error: callerErr } = await supabaseAdmin.auth.getUser(token);
  if (callerErr || !caller.user) return json({ message: 'Not signed in.' }, { status: 401 });

  const { data: me } = await supabaseAdmin.from('users').select('agency_id, role').eq('id', caller.user.id).single();
  if (!me?.agency_id || me.role !== 'admin') return json({ message: 'Only agency admins can invite team members.' }, { status: 403 });

  const { email } = await request.json().catch(() => ({ email: '' }));
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ message: 'Enter a valid email address.' }, { status: 400 });
  }

  const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { agency_id: me.agency_id, role: 'member' },
    redirectTo: `${publicEnv.PUBLIC_SITE_URL || url.origin}/login`
  });
  if (error || !invited.user) return json({ message: error?.message || 'Invitation failed.' }, { status: 400 });

  const { data: member, error: insertErr } = await supabaseAdmin
    .from('users')
    .insert({ id: invited.user.id, agency_id: me.agency_id, email, role: 'member', full_name: email.split('@')[0] })
    .select('id, full_name, email, role, created_at')
    .single();
  if (insertErr) return json({ message: insertErr.message }, { status: 500 });

  return json({ member });
};
