import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stripe } from '$lib/server/stripe';
import { supabaseAdmin } from '$lib/server/supabase';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw error(500, 'Webhook secret is not configured');
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    throw error(400, 'Missing stripe-signature header');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    throw error(400, `Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const invoiceId = session.metadata?.invoice_id;

    if (invoiceId) {
      // Mark invoice as paid
      await supabaseAdmin
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_session_id: session.id,
        })
        .eq('id', invoiceId);

      // Unlock any files tied to this invoice
      await supabaseAdmin
        .from('files')
        .update({ unlocked_at: new Date().toISOString() })
        .eq('unlock_invoice_id', invoiceId)
        .eq('is_locked', true);

      // Notify agency user
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('invoice_number, agency_id, client_id, total, clients(full_name), agencies(currency)')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        const { data: agencyUsers } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('agency_id', invoice.agency_id)
          .limit(5);

        const clientName = (invoice.clients as any)?.full_name || 'A client';
        const cur = ((invoice.agencies as any)?.currency || 'USD') as string;
        const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(Number(invoice.total || 0));

        for (const user of agencyUsers || []) {
          await supabaseAdmin.from('notifications').insert({
            user_id: user.id,
            title: `Invoice ${invoice.invoice_number} paid`,
            body: `${clientName} paid ${amount}`,
            type: 'invoice',
          });
        }
      }
    }
  }

  return json({ received: true });
};
