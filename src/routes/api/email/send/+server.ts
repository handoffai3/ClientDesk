import { json, error, type RequestHandler } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireCaller } from '$lib/server/auth';
import { sendAgencyEmail } from '$lib/server/email';

const MAX_RECIPIENTS = 5;

async function allowedRecipients(caller: Awaited<ReturnType<typeof requireCaller>>): Promise<Set<string>> {
  const emails = new Set<string>();
  const add = (rows: { email: string | null }[] | null) => rows?.forEach((r) => r.email && emails.add(r.email.toLowerCase()));

  const { data: staff } = await supabaseAdmin.from('users').select('email').eq('agency_id', caller.agencyId);
  add(staff);

  if (caller.kind === 'agency') {
    const { data: clients } = await supabaseAdmin.from('clients').select('id, email').eq('agency_id', caller.agencyId);
    add(clients);
    const ids = (clients || []).map((c) => c.id);
    if (ids.length) {
      const { data: portal } = await supabaseAdmin.from('client_users').select('email').in('client_id', ids);
      add(portal);
    }
  }
  return emails;
}

export const POST: RequestHandler = async ({ request }) => {
  const caller = await requireCaller(request);

  const body = await request.json().catch(() => ({}));
  const { to, subject, html } = body;
  if (!to || typeof subject !== 'string' || typeof html !== 'string' || !subject || !html) {
    throw error(400, 'Missing required fields: to, subject, html');
  }

  const recipients: string[] = (Array.isArray(to) ? to : [to]).filter((t: unknown): t is string => typeof t === 'string');
  if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) throw error(400, `Provide between 1 and ${MAX_RECIPIENTS} recipients.`);

  const allowed = await allowedRecipients(caller);
  if (!recipients.every((r) => allowed.has(r.trim().toLowerCase()))) {
    throw error(403, 'You can only email people who belong to your agency or your clients.');
  }

  const result = await sendAgencyEmail({
    agencyId: caller.agencyId,
    to: recipients,
    subject,
    html,
    includeReplyTo: caller.kind === 'agency'
  });
  if (!result.ok) return json({ error: result.message }, { status: result.status });
  return json(result.skipped ? { success: true, skipped: true } : { success: true });
};
