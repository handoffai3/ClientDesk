import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as publicEnv } from '$env/dynamic/public';
import { stripe } from '$lib/server/stripe';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireCaller } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, url }) => {
  const siteUrl = publicEnv.PUBLIC_SITE_URL || url.origin;
  const caller = await requireCaller(request, ['agency']);
  if (caller.kind !== 'agency' || caller.role !== 'admin') {
    throw error(403, 'Only agency admins can manage payments.');
  }
  const agency_id = caller.agencyId;

  const body = await request.json().catch(() => ({}));

  if (body.action === 'disconnect') {
    await supabaseAdmin
      .from('agencies')
      .update({ stripe_account_id: null, stripe_connected: false })
      .eq('id', agency_id);
    return json({ success: true });
  }

  try {
    const account = await stripe.accounts.create({
      type: 'standard',
      metadata: { agency_id },
    });

    await supabaseAdmin
      .from('agencies')
      .update({ stripe_account_id: account.id })
      .eq('id', agency_id);

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${siteUrl}/settings?stripe=refresh`,
      return_url: `${siteUrl}/settings?stripe=success`,
      type: 'account_onboarding',
    });

    return json({ url: accountLink.url });
  } catch {
    throw error(502, 'Could not reach Stripe. Please try again later.');
  }
};

export const GET: RequestHandler = async ({ request }) => {
  const caller = await requireCaller(request, ['agency']);
  const agencyId = caller.agencyId;

  const { data: agency } = await supabaseAdmin
    .from('agencies')
    .select('stripe_account_id, stripe_connected')
    .eq('id', agencyId)
    .single();

  if (!agency?.stripe_account_id) {
    return json({ connected: false });
  }

  try {
    const account = await stripe.accounts.retrieve(agency.stripe_account_id);
    const isConnected = account.charges_enabled && account.details_submitted;

    if (isConnected && !agency.stripe_connected) {
      await supabaseAdmin
        .from('agencies')
        .update({ stripe_connected: true })
        .eq('id', agencyId);
    }

    return json({
      connected: isConnected,
      account_id: agency.stripe_account_id,
      charges_enabled: account.charges_enabled,
    });
  } catch {
    return json({ connected: false });
  }
};
