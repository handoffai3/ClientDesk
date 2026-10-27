import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

export type Caller =
  | { kind: 'agency'; userId: string; email: string | null; agencyId: string; role: string }
  | { kind: 'client'; userId: string; email: string | null; agencyId: string; clientId: string };

/** Verifies the Supabase access token in `Authorization: Bearer` and derives identity from the database. Never trusts the request body. */
export async function requireCaller(request: Request, allow: Array<Caller['kind']> = ['agency', 'client']): Promise<Caller> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw error(401, 'Please sign in again.');

  const { data, error: tokenErr } = await supabaseAdmin.auth.getUser(token);
  if (tokenErr || !data.user) throw error(401, 'Please sign in again.');
  const user = data.user;

  let caller: Caller | null = null;

  const { data: agencyUser } = await supabaseAdmin.from('users').select('agency_id, role').eq('id', user.id).maybeSingle();
  if (agencyUser?.agency_id) {
    caller = { kind: 'agency', userId: user.id, email: user.email ?? null, agencyId: agencyUser.agency_id, role: agencyUser.role || 'member' };
  } else {
    const { data: clientUser } = await supabaseAdmin
      .from('client_users')
      .select('client_id, clients(agency_id)')
      .eq('id', user.id)
      .maybeSingle();
    const agencyId = (clientUser as any)?.clients?.agency_id as string | undefined;
    if (clientUser?.client_id && agencyId) {
      caller = { kind: 'client', userId: user.id, email: user.email ?? null, agencyId, clientId: clientUser.client_id };
    }
  }

  if (!caller) throw error(403, 'Your account is not linked to an agency or client portal.');
  if (!allow.includes(caller.kind)) throw error(403, 'You do not have permission to do that.');
  return caller;
}
