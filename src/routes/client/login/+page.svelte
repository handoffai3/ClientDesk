<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let errorMsg = $state('');

  let agencyLogo = $state('');
  let agencyColor = $state('#7C3AED');
  let agencyName = $state('ClientDesk');
  let loadingAgency = $state(true);

  onMount(async () => {
    // Fetch the white-label agency branding
    const { data } = await supabase
      .from('agencies')
      .select('logo_url, primary_color, name')
      .limit(1)
      .single();

    if (data) {
      if (data.logo_url) agencyLogo = data.logo_url;
      if (data.primary_color) agencyColor = data.primary_color;
      if (data.name) agencyName = data.name;
    }
    loadingAgency = false;
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    if (!email || !password) {
      errorMsg = 'Please enter email and password';
      return;
    }

    loading = true;
    errorMsg = '';

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      errorMsg = authError.message;
      loading = false;
      return;
    }

    if (authData.user) {
      // Verify they are actually a client
      const { data: clientUser } = await supabase
        .from('client_users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (!clientUser) {
        // Not a client
        await supabase.auth.signOut();
        errorMsg = 'You are not authorized as a client.';
        loading = false;
        return;
      }

      // Valid client, let the layout handle the redirect
      // or explicitly go there
      goto('/client/dashboard');
    }
  }
</script>

<svelte:head>
  <title>Client Portal Login</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-surface-container-low p-4">
  <div class="max-w-md w-full bg-surface rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:p-10 border border-outline-variant/20 flex flex-col items-center">
    
    <!-- Agency Branding -->
    <div class="h-16 flex items-center justify-center mb-6">
      {#if loadingAgency}
        <div class="w-10 h-10 border-2 border-outline-variant border-t-primary rounded-full animate-spin"></div>
      {:else if agencyLogo}
        <img src={agencyLogo} alt="{agencyName} Logo" class="h-full object-contain max-w-[200px]" />
      {:else}
        <div class="font-display-sm text-display-sm font-bold" style="color: {agencyColor}">
          {agencyName} Portal
        </div>
      {/if}
    </div>

    <div class="text-center mb-8">
      <h1 class="font-headline-md text-headline-md text-on-surface font-bold mb-2">Welcome back</h1>
      <p class="font-body-md text-body-md text-on-surface-variant">Sign in to your portal</p>
    </div>

    {#if errorMsg}
      <div class="w-full mb-6 p-4 bg-error-container/50 text-on-error-container border border-error/20 rounded-xl text-sm flex items-start gap-3">
        <span class="material-symbols-outlined text-error">error</span>
        <span class="mt-0.5">{errorMsg}</span>
      </div>
    {/if}

    <form class="w-full space-y-5" onsubmit={handleLogin}>
      <div>
        <label class="block font-label-md text-label-md text-on-surface-variant mb-1.5 ml-1" for="email">Email Address</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">mail</span>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="you@company.com"
            class="w-full pl-11 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl font-body-md text-body-md focus:outline-none focus:ring-2 focus:border-transparent transition-all"
            style="--tw-ring-color: {agencyColor}"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label class="block font-label-md text-label-md text-on-surface-variant mb-1.5 ml-1" for="password">Password</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">lock</span>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            bind:value={password}
            placeholder="••••••••"
            class="w-full pl-11 pr-12 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl font-body-md text-body-md focus:outline-none focus:ring-2 focus:border-transparent transition-all"
            style="--tw-ring-color: {agencyColor}"
            required
            disabled={loading}
          />
          <button
            type="button"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface focus:outline-none transition-colors"
            onclick={() => showPassword = !showPassword}
          >
            <span class="material-symbols-outlined text-[20px]">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      </div>

      <div class="pt-2">
        <button
          type="submit"
          class="w-full py-3.5 rounded-xl text-white font-label-md text-label-md shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style="background-color: {agencyColor}"
          disabled={loading}
        >
          {#if loading}
            <svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing In...
          {:else}
            Sign In
          {/if}
        </button>
      </div>
    </form>

    <div class="mt-8 pt-6 border-t border-outline-variant/30 w-full text-center">
      <p class="font-label-md text-xs text-outline flex items-center justify-center gap-1">
        Powered by <span class="font-bold">ClientDesk</span>
      </p>
    </div>
  </div>
</div>
