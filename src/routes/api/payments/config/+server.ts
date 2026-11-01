import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireCaller } from '$lib/server/auth';

/** Whether online card payments can work on this deployment (Stripe secret key present). */
export const GET: RequestHandler = async ({ request }) => {
  await requireCaller(request);
  return json({ enabled: Boolean((env.STRIPE_SECRET_KEY || '').trim()) });
};
