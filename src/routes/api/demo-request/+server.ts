import { json, type RequestHandler } from '@sveltejs/kit';
import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabase';
import { sendOperatorEmail } from '$lib/server/email';

const MAX_PER_IP_PER_HOUR = 3;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, { status: 400 });

  // Honeypot: real visitors never see this field. Pretend success so bots learn nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') return json({ ok: true });

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const agency = typeof body.agencyName === 'string' ? body.agencyName.trim() : '';
  if (!name || name.length > 100) return json({ error: 'Please enter your name.' }, { status: 400 });
  if (!EMAIL_RE.test(email) || email.length > 200) return json({ error: 'Please enter a valid email address.' }, { status: 400 });
  if (!agency || agency.length > 150) return json({ error: 'Please enter your agency name.' }, { status: 400 });

  let ip = 'unknown';
  try { ip = getClientAddress(); } catch { /* keep 'unknown' */ }
  const ipHash = createHmac('sha256', env.SUPABASE_SERVICE_ROLE_KEY || 'demo-request').update(ip).digest('hex');

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countErr } = await supabaseAdmin
    .from('demo_requests').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gt('created_at', since);
  if (countErr) return json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });

  // Only this endpoint can write to demo_requests (service role); anon has no table access.
  const { error: insErr } = await supabaseAdmin.from('demo_requests').insert({ name, email, agency_name: agency, ip_hash: ipHash });
  if (insErr) return json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  const notify = (env.DEMO_REQUEST_NOTIFY_EMAIL || '').trim();
  if (notify) {
    const result = await sendOperatorEmail({
      to: notify,
      replyTo: email,
      subject: `Demo request: ${agency}`,
      html: `<p><strong>New live demo request</strong></p><p>Name: ${esc(name)}<br>Email: ${esc(email)}<br>Agency: ${esc(agency)}</p>`
    });
    if (!result.ok) console.error('demo-request: notification email failed:', result.message);
  }
  return json({ ok: true });
};
