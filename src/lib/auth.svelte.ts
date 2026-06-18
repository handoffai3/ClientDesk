import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import { clientStore } from './clientStore';

// Global Svelte 5 reactive auth state
export const authState = $state({
  user: null as User | null,
  session: null as Session | null,
  agencyId: null as string | null,
  agencyName: null as string | null,
  userFullName: null as string | null,
  loading: true
});

export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  authState.session = data.session;
  authState.user = data.session?.user || null;
  
  if (authState.user) {
    await fetchUserDetails(authState.user.id);
  }
  
  authState.loading = false;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    authState.session = session;
    authState.user = session?.user || null;
    
    if (authState.user) {
      await fetchUserDetails(authState.user.id);
    } else {
      authState.agencyId = null;
      authState.agencyName = null;
      authState.userFullName = null;
    }
  });
}

async function fetchUserDetails(userId: string) {
  const { data: userData } = await supabase.from('users').select('agency_id, full_name, agencies(name)').eq('id', userId).single();
  if (userData) {
    authState.agencyId = userData.agency_id;
    authState.userFullName = userData.full_name;
    // @ts-ignore
    authState.agencyName = userData.agencies?.name || null;
  } else {
    // Check if client
    const { data: clientUser } = await supabase.from('client_users').select('client_id, clients(full_name, agency_id)').eq('id', userId).single();
    if (clientUser) {
      clientStore.set({
        client_id: clientUser.client_id,
        // @ts-ignore
        full_name: clientUser.clients?.full_name || null,
        // @ts-ignore
        agency_id: clientUser.clients?.agency_id || null
      });
    }
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}
