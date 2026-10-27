<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let email = $state('');
  let loading = $state(false);
  let errorMsg = $state('');
  let sentTo = $state('');
  let cooldown = $state(0);

  let agencyLogo = $state('');
  let agencyColor = $state('#7C3AED');
  let agencyName = $state('ClientDesk');
  let loadingAgency = $state(true);

  onMount(() => {
    const agencyParam = $page.url.searchParams.get('agency');
    const urlError = $page.url.searchParams.get('error');
    if (urlError) errorMsg = urlError;

    (async () => {
      let agencyId = agencyParam;
      if (!agencyId) {
        try { agencyId = localStorage.getItem('clientdesk:agency'); } catch { /* storage unavailable */ }
      }
      if (agencyId) {
        const { data } = await supabase.rpc('get_agency_branding', { p_agency_id: agencyId });
        const brand = Array.isArray(data) ? data[0] : data;
        if (brand) {
          if (brand.logo_url) agencyLogo = brand.logo_url;
          if (brand.primary_color) agencyColor = brand.primary_color;
          if (brand.name) agencyName = brand.name;
        }
      }
      loadingAgency = false;
    })();

    const timer = setInterval(() => { if (cooldown > 0) cooldown -= 1; }, 1000);
    return () => clearInterval(timer);
  });

  function friendlyError(error: { message: string; code?: string; status?: number }) {
    const msg = error.message.toLowerCase();
    if (error.code === 'otp_disabled' || msg.includes('signups not allowed') || msg.includes('user not found')) {
      return "We couldn't find a client portal for that email. Check the address, or ask your agency to send you an invite.";
    }
    if (error.status === 429 || error.code === 'over_email_send_rate_limit' || msg.includes('rate limit') || msg.includes('seconds')) {
      return 'A login link was just sent. Please wait a minute before requesting another.';
    }
    return 'We could not send a login link right now. Please try again in a moment.';
  }

  async function sendLink(e?: Event) {
    e?.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) { errorMsg = 'Please enter your email address.'; return; }
    if (cooldown > 0) return;

    loading = true;
    errorMsg = '';
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/client/auth/callback`
      }
    });
    loading = false;

    if (error) {
      errorMsg = friendlyError(error);
      return;
    }
    sentTo = address;
    cooldown = 30;
  }

  function useDifferentEmail() {
    sentTo = '';
    errorMsg = '';
  }
</script>

<svelte:head>
  <title>Client Portal Login</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background p-4">
  <div class="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 md:p-10 border border-outline-variant flex flex-col items-center">
    <div class="h-14 flex items-center justify-center mb-6">
      {#if loadingAgency}
        <div class="w-8 h-8 border-2 border-outline-variant border-t-primary rounded-full animate-spin"></div>
      {:else if agencyLogo}
        <img src={agencyLogo} alt="{agencyName} Logo" class="h-full object-contain max-w-[200px]" />
      {:else}
        <div class="text-xl font-semibold" style="color: {agencyColor}">{agencyName} Portal</div>
      {/if}
    </div>

    {#if sentTo}
      <div class="w-full text-center" role="status">
        <div class="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4" style="background-color: {agencyColor}1a; color: {agencyColor}">
          <span class="material-symbols-outlined">mark_email_read</span>
        </div>
        <h1 class="text-xl font-semibold text-on-surface mb-2">Check your inbox</h1>
        <p class="text-sm text-on-surface-variant mb-1">We sent a login link to</p>
        <p class="text-sm font-medium text-on-surface mb-4 break-all">{sentTo}</p>
        <p class="text-[13px] text-on-surface-variant mb-6">Open the email on this device and click the button to sign in. The link works once and expires soon.</p>

        {#if errorMsg}
          <p class="text-[13px] text-error mb-3" role="alert">{errorMsg}</p>
        {/if}

        <div class="flex flex-col gap-2">
          <button
            type="button"
            onclick={() => sendLink()}
            disabled={loading || cooldown > 0}
            class="w-full py-2.5 rounded-lg text-sm font-medium border border-outline-variant text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend link in ${cooldown}s` : loading ? 'Sending...' : 'Resend link'}
          </button>
          <button type="button" onclick={useDifferentEmail} class="text-[13px] text-on-surface-variant hover:text-on-surface py-1">Use a different email</button>
        </div>
      </div>
    {:else}
      <div class="text-center mb-6">
        <h1 class="text-xl font-semibold text-on-surface mb-1">Sign in to your portal</h1>
        <p class="text-sm text-on-surface-variant">Enter your email and we'll send you a secure login link. No password needed.</p>
      </div>

      {#if errorMsg}
        <div class="w-full mb-5 p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg text-sm flex items-start gap-2" role="alert">
          <span class="material-symbols-outlined text-[18px] mt-0.5">error</span>
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form class="w-full space-y-4" onsubmit={sendLink}>
        <div>
          <label class="block text-xs font-medium text-on-surface-variant mb-1.5" for="email">Email address</label>
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
            <input
              id="email"
              type="email"
              autocomplete="email"
              bind:value={email}
              placeholder="you@company.com"
              class="w-full pl-10 pr-3 py-2.5 bg-white border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:border-transparent transition-all"
              style="--tw-ring-color: {agencyColor}"
              required
              disabled={loading}
            />
          </div>
        </div>

        <button
          type="submit"
          class="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60"
          style="background-color: {agencyColor}"
          disabled={loading}
        >
          {#if loading}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Sending...
          {:else}
            Email me a login link
          {/if}
        </button>
      </form>
    {/if}

    <div class="mt-8 pt-5 border-t border-outline-variant w-full text-center">
      <p class="text-xs text-outline">Powered by <span class="font-medium">ClientDesk</span></p>
    </div>
  </div>
</div>
