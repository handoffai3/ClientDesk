<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);

  let showForgotModal = $state(false);
  let resetEmail = $state('');
  let resetLoading = $state(false);
  let resetMessage = $state('');
  let resetError = $state('');

  async function handleResetPassword(e: Event) {
    e.preventDefault();
    if (!resetEmail) {
      resetError = 'Please enter your email address.';
      return;
    }
    resetError = '';
    resetMessage = '';
    resetLoading = true;
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    resetLoading = false;
    if (err) {
      resetError = err.message;
    } else {
      resetMessage = 'Password reset link sent! Check your email inbox.';
    }
  }

  function closeForgotModal() {
    showForgotModal = false;
    resetEmail = '';
    resetError = '';
    resetMessage = '';
  }

  async function handleLogin(e: Event) {
    e.preventDefault();
    
    if (!email) {
      error = 'Please enter your email address.';
      return;
    }
    if (!password) {
      error = 'Please enter your password.';
      return;
    }

    error = '';
    loading = true;

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    loading = false;

    if (authError) {
      error = authError.message;
    } else {
      // Redirect to the dashboard page on success
      goto('/');
    }
  }
</script>

<svelte:head>
  <title>ClientDesk - Login</title>
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

    <!-- Login Card -->
    <div class="bg-surface-container-lowest rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">
      <!-- Banner -->
      <div class="bg-gradient-to-r from-primary to-primary-container p-6 text-center">
        <h2 class="font-title-md text-title-md text-on-primary">Welcome back 👋</h2>
        <p class="font-body-md text-body-md text-on-primary-container mt-1">Please sign in to continue</p>
      </div>

      <!-- Form Area -->
      <div class="p-8">
        {#if error}
          <div class="mb-6 p-4 bg-error-container text-on-error-container border border-error/20 rounded-lg flex items-center gap-2 font-body-md text-body-md">
            <span class="material-symbols-outlined text-xl">error</span>
            <span>{error}</span>
          </div>
        {/if}

        <form class="space-y-6" onsubmit={handleLogin}>
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
            <div class="flex justify-between items-center mb-2">
              <label class="block font-label-md text-label-md text-on-surface-variant" for="password">Password</label>
              <button type="button" class="font-label-md text-label-md text-primary hover:text-primary-container transition-colors bg-transparent border-none cursor-pointer p-0" onclick={() => { showForgotModal = true; resetEmail = email; }}>Forgot password?</button>
            </div>
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
            class="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-title-md text-title-md py-3 rounded-full hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed" 
            type="submit"
            disabled={loading}
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing In...
            {:else}
              Login
              <span class="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
            {/if}
          </button>
        </form>
      </div>
      
      <!-- Footer -->
      <div class="bg-surface-container-low p-4 text-center border-t border-outline-variant/30">
        <p class="font-body-md text-body-md text-on-surface-variant">
          Don't have an account? 
          <a href="/signup" class="text-primary font-semibold hover:underline">Sign up</a>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-8 text-center">
      <p class="font-label-md text-label-md text-outline">Powered by ClientDesk</p>
    </div>
  </main>
</div>

{#if showForgotModal}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onclick={(e) => { if (e.target === e.currentTarget) closeForgotModal(); }} onkeydown={(e) => { if (e.key === 'Escape') closeForgotModal(); }}>
  <div class="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
    <div class="p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-title-md text-title-md text-on-surface font-bold">Reset Password</h3>
        <button class="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container" onclick={closeForgotModal}>
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <p class="font-body-md text-body-md text-on-surface-variant mb-5">Enter your email and we'll send you a link to reset your password.</p>

      {#if resetMessage}
        <div class="mb-4 p-3 bg-primary-container/30 text-primary border border-primary/20 rounded-lg flex items-center gap-2 font-body-md text-body-md">
          <span class="material-symbols-outlined text-xl">check_circle</span>
          <span>{resetMessage}</span>
        </div>
      {/if}

      {#if resetError}
        <div class="mb-4 p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg flex items-center gap-2 font-body-md text-body-md">
          <span class="material-symbols-outlined text-xl">error</span>
          <span>{resetError}</span>
        </div>
      {/if}

      {#if !resetMessage}
        <form onsubmit={handleResetPassword}>
          <div class="mb-5">
            <label class="block font-label-md text-label-md text-on-surface-variant mb-2" for="reset-email">Email Address</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">mail</span>
              <input
                class="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-body-md text-body-md text-on-surface placeholder-outline-variant"
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                bind:value={resetEmail}
                disabled={resetLoading}
              />
            </div>
          </div>
          <button
            class="w-full bg-primary text-on-primary font-title-md text-title-md py-2.5 rounded-full hover:opacity-90 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={resetLoading}
          >
            {#if resetLoading}
              <svg class="animate-spin h-5 w-5 text-on-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            {:else}
              Send Reset Link
            {/if}
          </button>
        </form>
      {:else}
        <button
          class="w-full bg-primary text-on-primary font-title-md text-title-md py-2.5 rounded-full hover:opacity-90 active:scale-[0.98] transition-all duration-200"
          onclick={closeForgotModal}
        >
          Back to Login
        </button>
      {/if}
    </div>
  </div>
</div>
{/if}
