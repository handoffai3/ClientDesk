import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { supabaseAdmin } from '$lib/server/supabase';

const fail = (status: number, message: string) => json({ message }, { status });

export const POST: RequestHandler = async ({ request }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return fail(501, 'Signup needs SUPABASE_SERVICE_ROLE_KEY to be set on the server.');

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const agencyName = typeof body.agencyName === 'string' ? body.agencyName.trim() : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';

  if (!agencyName || agencyName.length > 120) return fail(400, 'Please enter your agency name.');
  if (!fullName || fullName.length > 120) return fail(400, 'Please enter your full name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, 'Please enter a valid email address.');
  if (password.length < 6) return fail(400, 'Password must be at least 6 characters.');

  // Public sign-up keeps Supabase's own email-confirmation behaviour
  const anon = createClient(publicEnv.PUBLIC_SUPABASE_URL!, publicEnv.PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: signUp, error: signUpErr } = await anon.auth.signUp({ email, password });
  if (signUpErr && (signUpErr.code === 'user_already_exists' || /already (registered|exists)/i.test(signUpErr.message))) {
    return fail(409, 'An account with this email already exists. Try signing in.');
  }
  if (signUpErr || !signUp.user) return fail(400, signUpErr?.message || 'Could not create your account.');
  if (signUp.user.identities && signUp.user.identities.length === 0) {
    return fail(409, 'An account with this email already exists. Try signing in.');
  }
  const userId = signUp.user.id;

  const { data: agency, error: agencyErr } = await supabaseAdmin
    .from('agencies')
    .insert({ name: agencyName, email, primary_color: '#630ED4' })
    .select('id')
    .single();
  if (agencyErr || !agency) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return fail(500, 'Could not create your agency. Please try again.');
  }

  const { error: userErr } = await supabaseAdmin
    .from('users')
    .insert({ id: userId, agency_id: agency.id, full_name: fullName, email, role: 'admin' });
  if (userErr) {
    await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return fail(500, 'Could not finish creating your account. Please try again.');
  }

  return json({
    agencyId: agency.id,
    session: signUp.session
      ? { access_token: signUp.session.access_token, refresh_token: signUp.session.refresh_token }
      : null
  });
};
