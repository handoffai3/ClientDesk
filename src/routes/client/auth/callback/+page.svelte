<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let errorMsg = $state('');

  function fail(message: string) {
    errorMsg = message;
  }

  onMount(async () => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = $page.url.searchParams;

    const linkError = hash.get('error_description') || query.get('error_description');
    if (linkError) {
      const code = hash.get('error_code') || query.get('error_code');
      fail(code === 'otp_expired'
        ? 'This login link has expired or was already used. Request a new one below.'
        : 'This login link is not valid. Request a new one below.');
      return;
    }

    const authCode = query.get('code');
    const tokenHash = query.get('token_hash');
    const type = query.get('type');
    if (authCode) {
      const { error } = await supabase.auth.exchangeCodeForSession(authCode);
      if (error) { fail('This login link has expired or was already used. Request a new one below.'); return; }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'magiclink' | 'email' });
      if (error) { fail('This login link has expired or was already used. Request a new one below.'); return; }
    }

    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      session = await new Promise((resolve) => {
        const timer = setTimeout(() => { sub.data.subscription.unsubscribe(); resolve(null); }, 4000);
        const sub = supabase.auth.onAuthStateChange((_event, s) => {
          if (s) { clearTimeout(timer); sub.data.subscription.unsubscribe(); resolve(s); }
        });
      });
    }
    if (!session) {
      fail('We could not sign you in from this link. Request a new one below.');
      return;
    }

    const { data: clientUser } = await supabase
      .from('client_users')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!clientUser) {
      await supabase.auth.signOut();
      fail('This account is not set up for the client portal. If you are a client, ask your agency to send you an invite.');
      return;
    }

    const { data: clientRow } = await supabase.from('clients').select('agency_id').maybeSingle();
    try { if (clientRow?.agency_id) localStorage.setItem('clientdesk:agency', clientRow.agency_id); } catch { /* storage unavailable */ }

    window.location.replace('/client/dashboard');
  });
</script>

<svelte:head>
  <title>Signing you in...</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background p-4">
  <div class="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 border border-outline-variant text-center">
    {#if errorMsg}
      <div class="mx-auto w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mb-4">
        <span class="material-symbols-outlined">link_off</span>
      </div>
      <h1 class="text-xl font-semibold text-on-surface mb-2">We couldn't sign you in</h1>
      <p class="text-sm text-on-surface-variant mb-6" role="alert">{errorMsg}</p>
      <a href="/client/login" class="inline-block w-full py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium no-underline">Request a new login link</a>
    {:else}
      <div class="mx-auto w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
      <h1 class="text-base font-medium text-on-surface">Signing you in...</h1>
    {/if}
  </div>
</div>
