import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as publicEnv } from '$env/dynamic/public';
import { stripe } from '$lib/server/stripe';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireCaller } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, url }) => {
  const caller = await requireCaller(request);
  const body = await request.json().catch(() => ({}));
  const { invoice_id } = body;

  if (!invoice_id) {
    throw error(400, 'Missing invoice_id');
  }

  const { data: invoice, error: invErr } = await supabaseAdmin
    .from('invoices')
    .select('*, clients(full_name, email), agencies(name, stripe_account_id, currency)')
    .eq('id', invoice_id)
    .single();

  if (invErr || !invoice) {
    throw error(404, 'Invoice not found');
  }

  const owns =
    caller.kind === 'agency'
      ? invoice.agency_id === caller.agencyId
      : invoice.client_id === caller.clientId;
  if (!owns) throw error(404, 'Invoice not found');
  if (invoice.status === 'paid') throw error(400, 'This invoice has already been paid.');

  const { data: items } = await supabaseAdmin
    .from('invoice_items')
    .select('description, quantity, rate, amount')
    .eq('invoice_id', invoice_id);

  const lineItems: any[] = (items || []).map((item: any) => ({
    price_data: {
      currency: (invoice.agencies?.currency || 'USD').toLowerCase(),
      product_data: { name: item.description || 'Service' },
      unit_amount: Math.round(Number(item.rate || 0) * 100),
    },
    quantity: Number(item.quantity || 1),
  }));

  if (Number(invoice.gst_amount) > 0) {
    lineItems.push({
      price_data: {
        currency: (invoice.agencies?.currency || 'USD').toLowerCase(),
        product_data: { name: `Tax (${invoice.gst_rate || 0}%)` },
        unit_amount: Math.round(Number(invoice.gst_amount) * 100),
      },
      quantity: 1,
    });
  }

  if (lineItems.length === 0) {
    lineItems.push({
      price_data: {
        currency: (invoice.agencies?.currency || 'USD').toLowerCase(),
        product_data: { name: `Invoice ${invoice.invoice_number}` },
        unit_amount: Math.round(Number(invoice.total || 0) * 100),
      },
      quantity: 1,
    });
  }

  const origin = publicEnv.PUBLIC_SITE_URL || url.origin;
  const stripeAccount = invoice.agencies?.stripe_account_id || undefined;

  const sessionParams: any = {
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    metadata: {
      invoice_id: invoice.id,
      agency_id: invoice.agency_id,
      client_id: invoice.client_id,
    },
    success_url: `${origin}/client/invoices?payment=success`,
    cancel_url: `${origin}/client/invoices?payment=cancelled`,
  };

  if (invoice.clients?.email) {
    sessionParams.customer_email = invoice.clients.email;
  }

  try {
    const session = stripeAccount
      ? await stripe.checkout.sessions.create(sessionParams, { stripeAccount })
      : await stripe.checkout.sessions.create(sessionParams);
    return json({ url: session.url });
  } catch (err: any) {
    throw error(502, 'Could not start the payment session. Please try again later.');
  }
};
