import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { supabaseAdmin } from '$lib/server/supabase';
import { brandedEmail } from '$lib/emailTemplates';
import { sendAgencyEmail } from '$lib/server/email';

const fail = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  json({ success: false, message, ...extra }, { status });

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { error };
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return { user: hit };
    if (data.users.length < 200) break;
  }
  return { user: null };
}

export const POST: RequestHandler = async ({ request, url }) => {
  const siteUrl = publicEnv.PUBLIC_SITE_URL || url.origin;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(501, 'Portal invites need SUPABASE_SERVICE_ROLE_KEY to be set on the server.');
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, 'Please sign in again.');
  const { data: caller, error: callerErr } = await supabaseAdmin.auth.getUser(token);
  if (callerErr || !caller.user) return fail(401, 'Please sign in again.');

  const { data: me } = await supabaseAdmin.from('users').select('agency_id').eq('id', caller.user.id).maybeSingle();
  if (!me?.agency_id) return fail(403, 'Only agency users can invite clients.');

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === 'string' ? body.client_id : '';
  if (!clientId) return fail(400, 'Missing client_id.');

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, agency_id, full_name, email')
    .eq('id', clientId)
    .maybeSingle();
  if (!client || client.agency_id !== me.agency_id) return fail(404, 'Client not found.');

  const { data: existingAccess } = await supabaseAdmin
    .from('client_users')
    .select('id, email')
    .eq('client_id', client.id)
    .order('created_at', { ascending: true });

  const requested = typeof body.email === 'string' ? body.email.trim() : '';
  const email = (requested || existingAccess?.[0]?.email || client.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, 'Enter a valid email address.');

  // Find or create the auth user
  let authUserId: string;
  const created = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
  if (!created.error && created.data.user) {
    authUserId = created.data.user.id;
  } else if (created.error && (created.error.code === 'email_exists' || created.error.status === 422)) {
    const found = await findAuthUserByEmail(email);
    if (!found.user) return fail(500, found.error?.message || 'Could not look up the existing account.');
    authUserId = found.user.id;
  } else {
    return fail(500, created.error?.message || 'Could not create the portal account.');
  }
  const wasCreated = !created.error;

  // Never link an agency account (or another client's login) to this client
  const { data: agencyUser } = await supabaseAdmin.from('users').select('id').eq('id', authUserId).maybeSingle();
  if (agencyUser) return fail(409, 'That email belongs to an agency account and cannot be used as a client login.');
  const { data: otherLink } = await supabaseAdmin.from('client_users').select('client_id').eq('id', authUserId).maybeSingle();
  if (otherLink && otherLink.client_id !== client.id) {
    return fail(409, 'That email is already a portal login for a different client.');
  }

  const { error: linkErr } = await supabaseAdmin
    .from('client_users')
    .upsert({ id: authUserId, client_id: client.id, email }, { onConflict: 'id' });
  if (linkErr) {
    if (wasCreated) await supabaseAdmin.auth.admin.deleteUser(authUserId);
    return fail(500, 'Could not save portal access: ' + linkErr.message);
  }

  const { data: link, error: genErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${siteUrl}/client/auth/callback` }
  });
  if (genErr || !link?.properties?.action_link) {
    return fail(500, genErr?.message || 'Could not generate a login link.', { portal_created: true });
  }

  const { data: agency } = await supabaseAdmin
    .from('agencies')
    .select('name, logo_url, primary_color, email, reply_to_email')
    .eq('id', me.agency_id)
    .single();
  const agencyName = agency?.name || 'ClientDesk';

  const html = brandedEmail({
    agency_name: agencyName,
    agency_logo_url: agency?.logo_url,
    agency_primary_color: agency?.primary_color || undefined,
    body_html: `<p>Hi ${client.full_name || 'there'},</p>
      <p>You've been invited to the <strong>${agencyName}</strong> client portal, where you can view your projects, files and invoices and message the team.</p>
      <p>Click the button below to sign in. The link is single-use and expires soon. If it has expired, request a new one any time at <a href="${siteUrl}/client/login?agency=${me.agency_id}">${siteUrl}/client/login</a>.</p>`,
    cta_text: 'Access Your Portal',
    cta_url: link.properties.action_link
  });

  const sendResult = await sendAgencyEmail({
    agencyId: me.agency_id,
    to: email,
    subject: `You've been invited to the ${agencyName} client portal`,
    html
  });
  if (!sendResult.ok) {
    return fail(502, `Portal access was set up, but the email could not be sent (${sendResult.message}). Use "Resend invite" once email is working.`, { portal_created: true });
  }
  if (sendResult.skipped) {
    return fail(409, 'Portal access was set up, but email notifications are turned off for your agency (Settings > Email). Turn them on and use "Resend invite".', { portal_created: true });
  }

  return json({ success: true, email, resent: !wasCreated && !!existingAccess?.length });
};
