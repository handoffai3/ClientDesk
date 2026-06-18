<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';

  let email = $state('');
  let password = $state('');
  let agencyName = $state('');
  let fullName = $state('');
  let showPassword = $state(false);
  let errorMsg = $state('');
  let loading = $state(false);

  async function handleSignup(e: Event) {
    e.preventDefault();
    
    if (!agencyName) { errorMsg = 'Please enter your agency name.'; return; }
    if (!fullName) { errorMsg = 'Please enter your full name.'; return; }
    if (!email) { errorMsg = 'Please enter your email address.'; return; }
    if (!password || password.length < 6) { errorMsg = 'Password must be at least 6 characters.'; return; }

    errorMsg = '';
    loading = true;

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      errorMsg = authError?.message || 'Failed to create user in Auth.';
      loading = false;
      return;
    }

    const userId = authData.user.id;

    // 2. Insert into agencies table
    const { data: agencyData, error: agencyError } = await supabase.from('agencies').insert({
      name: agencyName,
      email: email,
      primary_color: '#630ED4'
    }).select('id').single();

    if (agencyError || !agencyData) {
      errorMsg = agencyError?.message || 'Failed to create agency record.';
      loading = false;
      return;
    }

    // 3. Insert into users table with full_name
    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      agency_id: agencyData.id,
      full_name: fullName,
      email: email,
      role: 'admin'
    });

    if (userError) {
      errorMsg = userError.message;
      loading = false;
      return;
    }

    // Manually update authState so the dashboard has data immediately
    authState.agencyId = agencyData.id;
    authState.agencyName = agencyName;
    authState.userFullName = fullName;

    loading = false;
    goto('/');
  }
</script>

<svelte:head>
  <title>ClientDesk - Sign Up</title>
</svelte:head>

<div class="bg-surface-container-low min-h-screen w-full flex items-center justify-center p-4">
  <main class="w-full max-w-md">
    <!-- Brand / Logo -->
    <div class="flex items-center justify-center gap-2 mb-8">
      <div class="w-8 h-8 bg-primary rounded flex items-center justify-center">
        <span class="material-symbols-outlined text-on-primary text-xl" style="font-variation-settings: 'FILL' 1;">widgets</span>
      </div>
      <h1 class="font-headline-md text-headline-md font-bold text-on-surface">ClientDesk</h1>
    </div>

    <!-- Signup Card -->
    <div class="bg-surface-container-lowest rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">
      <!-- Banner -->
      <div class="bg-gradient-to-r from-primary to-primary-container p-6 text-center">
        <h2 class="font-title-md text-title-md text-on-primary">Create your Agency</h2>
        <p class="font-body-md text-body-md text-on-primary-container mt-1">Join ClientDesk to manage your clients</p>
      </div>

      <!-- Form Area -->
      <div class="p-8">
        {#if errorMsg}
          <div class="mb-6 p-4 bg-error-container text-on-error-container border border-error/20 rounded-lg flex items-center gap-2 font-body-md text-body-md">
            <span class="material-symbols-outlined text-xl">error</span>
            <span>{errorMsg}</span>
          </div>
        {/if}

        <form class="space-y-5" onsubmit={handleSignup}>
          <!-- Agency Name Input -->
          <div>
            <label class="block font-label-md text-label-md text-on-surface-variant mb-2" for="agencyName">Agency Name</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">domain</span>
              <input 
                class="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-body-md text-body-md text-on-surface placeholder-outline-variant" 
                id="agencyName" 
                name="agencyName" 
                placeholder="Acme Creative" 
                type="text"
                bind:value={agencyName}
                disabled={loading}
              />
            </div>
          </div>

          <!-- Full Name Input -->
          <div>
            <label class="block font-label-md text-label-md text-on-surface-variant mb-2" for="fullName">Your Full Name</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">person</span>
              <input 
                class="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-body-md text-body-md text-on-surface placeholder-outline-variant" 
                id="fullName" 
                name="fullName" 
                placeholder="John Doe" 
                type="text"
                bind:value={fullName}
                disabled={loading}
              />
            </div>
          </div>

          <!-- Email Input -->
          <div>
            <label class="block font-label-md text-label-md text-on-surface-variant mb-2" for="email">Email Address</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">mail</span>
              <input 
                class="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-body-md text-body-md text-on-surface placeholder-outline-variant" 
                id="email" 
                name="email" 
                placeholder="you@example.com" 
                type="email"
                bind:value={email}
                disabled={loading}
              />
            </div>
          </div>

          <!-- Password Input -->
          <div>
            <label class="block font-label-md text-label-md text-on-surface-variant mb-2" for="password">Password</label>
            <div class="relative group">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">lock</span>
              <input 
                class="w-full pl-10 pr-10 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-body-md text-body-md text-on-surface placeholder-outline-variant" 
                id="password" 
                name="password" 
                placeholder="••••••••" 
                type={showPassword ? "text" : "password"}
                bind:value={password}
                disabled={loading}
              />
              <button 
                class="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-on-surface-variant focus:outline-none" 
                type="button"
                onclick={() => showPassword = !showPassword}
              >
                {#if showPassword}
                  <span class="material-symbols-outlined text-lg">visibility_off</span>
                {:else}
                  <span class="material-symbols-outlined text-lg">visibility</span>
                {/if}
              </button>
            </div>
          </div>

          <!-- Submit Button -->
          <button 
            class="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-title-md text-title-md py-3 mt-4 rounded-full hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed" 
            type="submit"
            disabled={loading}
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Agency...
            {:else}
              Sign Up
              <span class="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
            {/if}
          </button>
        </form>
      </div>
      
      <!-- Footer -->
      <div class="bg-surface-container-low p-4 text-center border-t border-outline-variant/30">
        <p class="font-body-md text-body-md text-on-surface-variant">
          Already have an account? 
          <a href="/login" class="text-primary font-semibold hover:underline">Log in</a>
        </p>
      </div>
    </div>
  </main>
</div>
