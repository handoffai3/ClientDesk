import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabase';

export type SendResult = { ok: true; skipped?: boolean } | { ok: false; status: number; message: string };

/** Sends one email on behalf of an agency. Sender name and reply-to come from the agency record, never from request input. */
export async function sendAgencyEmail(opts: {
  agencyId: string;
  to: string | string[];
  subject: string;
  html: string;
  includeReplyTo?: boolean;
}): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, status: 500, message: 'Email service not configured' };

  const { data: agency } = await supabaseAdmin
    .from('agencies')
    .select('name, email, reply_to_email, email_notifications_enabled')
    .eq('id', opts.agencyId)
    .maybeSingle();
  if (!agency) return { ok: false, status: 404, message: 'Agency not found' };
  if (agency.email_notifications_enabled === false) return { ok: true, skipped: true };

  const configured = (env.EMAIL_FROM_ADDRESS || '').trim() || 'onboarding@resend.dev';
  const name = (agency.name || 'ClientDesk').replace(/[<>"\r\n]/g, '');
  const from = configured.includes('<') ? configured : `${name} <${configured}>`;
  const replyTo = opts.includeReplyTo === false ? undefined : agency.reply_to_email || agency.email || undefined;

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(replyTo ? { replyTo } : {})
    });
    if (error) return { ok: false, status: 502, message: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, status: 502, message: err.message || 'Failed to send email' };
  }
}
