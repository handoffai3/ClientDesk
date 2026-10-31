<script lang="ts">
  import { apiFetch } from '$lib/apiFetch';
  import { authState } from '$lib/auth.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';

  let { initialTab = 'Branding', hideTabs = false }: { initialTab?: string; hideTabs?: boolean } = $props();
  let activeSettingTab = $state(initialTab);
  const settingTabs = ['Branding', 'Payments', 'Email'];

  $effect(() => { if (hideTabs) activeSettingTab = initialTab; });

  let primaryColor = $state('#630ED4');
  let customDomain = $state('');
  let logoUrl = $state<string | null>(null);
  let saving = $state(false);
  let uploading = $state(false);
  let toastMsg = $state('');
  let toastType = $state<'success' | 'error'>('success');

  let fileInput: HTMLInputElement;

  // Email settings
  let emailNotificationsEnabled = $state(true);
  let replyToEmail = $state('');
  let savingEmail = $state(false);

  let stripeConnected = $state(false);
  let stripeAccountId = $state<string | null>(null);
  let stripeChargesEnabled = $state(false);
  let stripeLoading = $state(false);
  let stripeChecking = $state(true);

  onMount(async () => {
    if (!authState.agencyId) return;
    const { data } = await supabase.from('agencies').select('primary_color, custom_domain, logo_url, email_notifications_enabled, reply_to_email, email').eq('id', authState.agencyId).single();
    if (data) {
      primaryColor = data.primary_color || '#630ED4';
      customDomain = data.custom_domain || '';
      logoUrl = data.logo_url || null;
      emailNotificationsEnabled = data.email_notifications_enabled !== false;
      replyToEmail = data.reply_to_email || data.email || '';
    }
    checkStripeStatus();
  });

  async function checkStripeStatus() {
    if (!authState.agencyId) { stripeChecking = false; return; }
    stripeChecking = true;
    try {
      const res = await apiFetch('/api/stripe/connect');
      const data = await res.json();
      stripeConnected = data.connected || false;
      stripeAccountId = data.account_id || null;
      stripeChargesEnabled = data.charges_enabled || false;
    } catch {
      stripeConnected = false;
    }
    stripeChecking = false;
  }

  async function connectStripe() {
    if (!authState.agencyId) return;
    stripeLoading = true;
    try {
      const res = await apiFetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast('Failed to create Stripe account link.', 'error');
        stripeLoading = false;
      }
    } catch {
      showToast('Connection failed. Please try again.', 'error');
      stripeLoading = false;
    }
  }

  async function disconnectStripe() {
    if (!authState.agencyId) return;
    stripeLoading = true;
    try {
      await apiFetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      stripeConnected = false;
      stripeAccountId = null;
      stripeChargesEnabled = false;
      showToast('Stripe disconnected.');
    } catch {
      showToast('Failed to disconnect.', 'error');
    }
    stripeLoading = false;
  }

  async function saveEmailSettings() {
    if (!authState.agencyId) return;
    savingEmail = true;
    const { error } = await supabase.from('agencies').update({
      email_notifications_enabled: emailNotificationsEnabled,
      reply_to_email: replyToEmail || null,
    }).eq('id', authState.agencyId);
    savingEmail = false;
    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast('Email settings saved!');
    }
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    setTimeout(() => { toastMsg = ''; }, 3000);
  }

  async function handleLogoUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !authState.agencyId) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('File must be under 2MB.', 'error');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      showToast('Only PNG, JPG or SVG allowed.', 'error');
      return;
    }
    uploading = true;
    const ext = file.name.split('.').pop();
    const path = `${authState.agencyId}/logo_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true });
    if (error) {
      showToast('Upload failed: ' + error.message, 'error');
      uploading = false;
      return;
    }
    const { data: urlData } = supabase.storage.from('branding').getPublicUrl(path);
    logoUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('agencies').update({ logo_url: urlData.publicUrl }).eq('id', authState.agencyId);
    uploading = false;
    showToast('Logo uploaded!');
  }

  async function saveBranding() {
    if (!authState.agencyId) return;
    saving = true;
    const { error } = await supabase.from('agencies').update({
      primary_color: primaryColor,
      custom_domain: customDomain || null,
    }).eq('id', authState.agencyId);
    saving = false;
    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast('Branding saved!');
    }
  }
</script>


<div class="flex flex-col gap-5 animate-fadeIn">
  {#if !hideTabs}
  <div>
    <h2 class="text-xl font-semibold text-on-surface mb-1">Settings</h2>
    <p class="text-sm text-on-surface-variant">Manage your workspace branding, payments, and email.</p>
  </div>

  <div class="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-outline-variant">
    {#each settingTabs as tab}
      <button
        class="px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors {activeSettingTab === tab ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}"
        onclick={() => activeSettingTab = tab}
      >
        {tab}
      </button>
    {/each}
  </div>
  {/if}

  <!-- Tab Content -->
  {#if activeSettingTab === 'Branding'}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2 animate-fadeIn">
      <div class="lg:col-span-5 flex flex-col gap-5">
        <div class="bg-white rounded-lg p-5 shadow-xs border border-outline-variant flex flex-col gap-5">
          <h3 class="text-sm font-medium text-on-surface border-b border-outline-variant pb-3">Brand Identity</h3>
          
          <div class="flex flex-col gap-2">
            <label class="text-xs font-medium text-on-surface-variant">Workspace Logo</label>
            <div class="flex items-center gap-6">
              <div class="w-20 h-20 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container flex items-center justify-center text-on-surface-variant overflow-hidden">
                {#if logoUrl}
                  <img src={logoUrl} alt="Agency logo" class="w-full h-full object-cover" />
                {:else}
                  <span class="material-symbols-outlined text-3xl" data-icon="image">image</span>
                {/if}
              </div>
              <div class="flex flex-col gap-2">
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" class="hidden" bind:this={fileInput} onchange={handleLogoUpload} />
                <button class="px-4 py-2 bg-surface-variant hover:bg-outline-variant text-on-surface-variant font-label-md text-label-md rounded-lg transition-colors flex items-center gap-2 self-start focus:outline-none disabled:opacity-50" onclick={() => fileInput.click()} disabled={uploading}>
                  {#if uploading}
                    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Uploading...
                  {:else}
                    <span class="material-symbols-outlined text-sm" data-icon="upload">upload</span> Upload New
                  {/if}
                </button>
                <p class="font-body-md text-body-md text-outline text-xs">PNG, JPG or SVG. Max 2MB.</p>
              </div>
            </div>
          </div>
          
          <!-- Primary Color -->
          <div class="flex flex-col gap-3">
            <label class="font-title-md text-title-md text-on-surface-variant">Primary Color</label>
            <div class="flex items-center gap-4">
              <button class="w-12 h-12 rounded-lg bg-primary shadow-inner border border-black/10 cursor-pointer relative after:content-[''] after:absolute after:inset-0 after:rounded-lg after:ring-2 after:ring-offset-2 after:ring-primary focus:outline-none" aria-label="Primary color purple" onclick={() => primaryColor = '#630ED4'}></button>
              <button class="w-10 h-10 rounded-lg bg-blue-500 shadow-inner border border-black/10 cursor-pointer focus:outline-none hover:scale-105 transition-transform" aria-label="Primary color blue" onclick={() => primaryColor = '#3B82F6'}></button>
              <button class="w-10 h-10 rounded-lg bg-emerald-500 shadow-inner border border-black/10 cursor-pointer focus:outline-none hover:scale-105 transition-transform" aria-label="Primary color emerald" onclick={() => primaryColor = '#10B981'}></button>
              <button class="w-10 h-10 rounded-lg bg-rose-500 shadow-inner border border-black/10 cursor-pointer focus:outline-none hover:scale-105 transition-transform" aria-label="Primary color rose" onclick={() => primaryColor = '#F43F5E'}></button>
              <button class="w-10 h-10 rounded-lg bg-slate-800 shadow-inner border border-black/10 cursor-pointer flex items-center justify-center focus:outline-none hover:scale-105 transition-transform" aria-label="Add custom color">
                <span class="material-symbols-outlined text-white text-sm" data-icon="add">add</span>
              </button>
            </div>
            <input class="mt-2 block w-full rounded-lg border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md text-on-surface py-2 px-3 outline-none transition-all" readonly type="text" value={primaryColor}/>
          </div>
          
          <!-- Custom Domain -->
          <div class="flex flex-col gap-3">
            <label class="font-title-md text-title-md text-on-surface-variant">Custom Domain</label>
            <div class="flex rounded-lg shadow-sm border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <span class="inline-flex items-center px-4 rounded-l-lg border-r border-outline-variant bg-surface-container-low text-on-surface-variant font-body-md text-body-md">
                  https://
              </span>
              <input class="flex-1 block w-full rounded-none rounded-r-lg border-none bg-surface-container-lowest font-body-md text-body-md text-on-surface placeholder:text-outline/50 py-2 px-3 outline-none" placeholder="portal.yourcompany.com" type="text" bind:value={customDomain}/>
            </div>
            <p class="font-body-md text-body-md text-outline text-xs">Configure CNAME records in your DNS provider.</p>
          </div>
          
          <div class="pt-4 border-t border-surface-variant flex justify-end">
            <button class="px-6 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-title-md text-title-md rounded-lg shadow-sm transition-all active:scale-95 focus:outline-none disabled:opacity-50 flex items-center gap-2" onclick={saveBranding} disabled={saving}>
              {#if saving}
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Saving...
              {:else}
                Save Changes
              {/if}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Right Live Preview Column -->
      <div class="lg:col-span-7 flex flex-col gap-4">
        <h3 class="font-title-md text-title-md text-on-surface-variant px-2">Live Login Preview</h3>
        <div class="flex-1 bg-surface-container-low rounded-2xl border border-surface-variant overflow-hidden flex items-center justify-center p-8 relative min-h-[500px]">
          <!-- Decorative background for preview -->
          <div class="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>
          
          <!-- Simulated Login Card -->
          <div class="glass-panel w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6 shadow-xl relative z-10 animate-fadeIn" style="animation-delay: 100ms;">
            <div class="flex flex-col items-center gap-3 mb-2">
              {#if logoUrl}
                <img src={logoUrl} alt="Preview logo" class="w-12 h-12 rounded-xl shadow-md object-cover" />
              {:else}
                <div class="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-xl shadow-md transition-colors duration-300" style="background-color: {primaryColor};">C</div>
              {/if}
              <h4 class="font-headline-md text-headline-md text-on-surface text-center">Welcome Back</h4>
              <p class="font-body-md text-body-md text-on-surface-variant text-center">Sign in to your client portal</p>
            </div>
            
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="font-label-md text-label-md text-on-surface-variant">Email</label>
                <div class="w-full h-10 bg-white/50 border border-outline-variant/50 rounded-lg"></div>
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex justify-between items-center">
                  <label class="font-label-md text-label-md text-on-surface-variant">Password</label>
                  <span class="font-label-md text-label-md text-primary text-[10px] transition-colors duration-300" style="color: {primaryColor};">Forgot?</span>
                </div>
                <div class="w-full h-10 bg-white/50 border border-outline-variant/50 rounded-lg"></div>
              </div>
              
              <button class="w-full h-10 text-on-primary rounded-lg font-title-md text-title-md mt-2 shadow-sm flex items-center justify-center opacity-90 cursor-default transition-colors duration-300" style="background-color: {primaryColor};">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {:else if activeSettingTab === 'Payments'}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4 animate-fadeIn">
      <!-- Stripe Connect Card -->
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-variant flex flex-col gap-6">
        <div class="flex items-center gap-3 border-b border-surface-variant pb-4">
          <div class="w-10 h-10 rounded-lg bg-[#635BFF] flex items-center justify-center">
            <svg viewBox="0 0 24 24" class="w-6 h-6 text-white" fill="currentColor"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
          </div>
          <div>
            <h3 class="font-headline-md text-headline-md text-on-surface">Stripe Connect</h3>
            <p class="font-body-md text-body-md text-on-surface-variant">Accept payments from your clients</p>
          </div>
        </div>

        {#if stripeChecking}
          <div class="flex items-center justify-center py-8">
            <svg class="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span class="ml-3 font-body-md text-body-md text-on-surface-variant">Checking connection status...</span>
          </div>
        {:else if stripeConnected}
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3 px-4 py-3 bg-[#dcfce7] rounded-lg">
              <span class="material-symbols-outlined text-[#166534]">check_circle</span>
              <div>
                <p class="font-title-md text-title-md text-[#166534]">Connected</p>
                <p class="font-body-sm text-body-sm text-[#166534]/70">Your Stripe account is active and ready to accept payments.</p>
              </div>
            </div>

            {#if stripeAccountId}
              <div class="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-lg">
                <span class="font-body-md text-body-md text-on-surface-variant">Account ID:</span>
                <code class="font-body-md text-body-md text-on-surface bg-surface-container-high px-2 py-0.5 rounded">{stripeAccountId}</code>
              </div>
            {/if}

            <div class="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-lg">
              <span class="font-body-md text-body-md text-on-surface-variant">Charges:</span>
              <span class="font-label-md text-label-md {stripeChargesEnabled ? 'text-[#166534]' : 'text-[#b91c1c]'}">{stripeChargesEnabled ? 'Enabled' : 'Pending verification'}</span>
            </div>

            <div class="pt-4 border-t border-surface-variant flex items-center justify-between">
              <button class="px-4 py-2 bg-surface-variant hover:bg-outline-variant text-on-surface-variant font-label-md text-label-md rounded-lg transition-colors focus:outline-none" onclick={checkStripeStatus}>
                <span class="material-symbols-outlined text-sm align-middle mr-1">refresh</span> Refresh Status
              </button>
              <button class="px-4 py-2 bg-error-container hover:bg-error-container/80 text-on-error-container font-label-md text-label-md rounded-lg transition-colors focus:outline-none disabled:opacity-50" onclick={disconnectStripe} disabled={stripeLoading}>
                {#if stripeLoading}
                  Disconnecting...
                {:else}
                  Disconnect
                {/if}
              </button>
            </div>
          </div>
        {:else}
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3 px-4 py-3 bg-surface-container rounded-lg">
              <span class="material-symbols-outlined text-outline">link_off</span>
              <div>
                <p class="font-title-md text-title-md text-on-surface">Not Connected</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">Connect your Stripe account to start accepting invoice payments from clients.</p>
              </div>
            </div>

            <button class="w-full px-6 py-3 bg-[#635BFF] hover:bg-[#5851e0] text-white font-title-md text-title-md rounded-lg shadow-sm transition-all active:scale-[0.98] focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2" onclick={connectStripe} disabled={stripeLoading}>
              {#if stripeLoading}
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Connecting...
              {:else}
                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
                Connect with Stripe
              {/if}
            </button>
          </div>
        {/if}
      </div>

      <!-- Info Card -->
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-variant flex flex-col gap-5">
        <h3 class="font-headline-md text-headline-md text-on-surface border-b border-surface-variant pb-4">How it Works</h3>
        <div class="flex flex-col gap-4">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-sm shrink-0">1</div>
            <div>
              <p class="font-title-md text-title-md text-on-surface">Connect Your Account</p>
              <p class="font-body-md text-body-md text-on-surface-variant">Link your existing Stripe account or create a new one. The setup takes about 5 minutes.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-sm shrink-0">2</div>
            <div>
              <p class="font-title-md text-title-md text-on-surface">Send Invoices</p>
              <p class="font-body-md text-body-md text-on-surface-variant">Your clients see a "Pay Now" button on their invoices with secure Stripe Checkout.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-sm shrink-0">3</div>
            <div>
              <p class="font-title-md text-title-md text-on-surface">Get Paid Instantly</p>
              <p class="font-body-md text-body-md text-on-surface-variant">Payments go directly to your Stripe account. Invoices are automatically marked as paid.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-sm shrink-0">4</div>
            <div>
              <p class="font-title-md text-title-md text-on-surface">Files Unlock Automatically</p>
              <p class="font-body-md text-body-md text-on-surface-variant">Lock files behind invoice payment. They unlock automatically when the client pays.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  {:else if activeSettingTab === 'Email'}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4 animate-fadeIn">
      <!-- Email Settings Card -->
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-variant flex flex-col gap-6">
        <div class="flex items-center gap-3 border-b border-surface-variant pb-4">
          <div class="w-10 h-10 rounded-lg bg-tertiary-container flex items-center justify-center">
            <span class="material-symbols-outlined text-on-tertiary-container">mail</span>
          </div>
          <div>
            <h3 class="font-headline-md text-headline-md text-on-surface">Email Notifications</h3>
            <p class="font-body-md text-body-md text-on-surface-variant">Configure how email notifications are sent to clients</p>
          </div>
        </div>

        <!-- Toggle -->
        <div class="flex items-center justify-between px-4 py-3 bg-surface-container rounded-lg">
          <div>
            <p class="font-title-md text-title-md text-on-surface">Send email notifications</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">When enabled, clients receive email notifications for invoices, deliverables, and portal invites.</p>
          </div>
          <button
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {emailNotificationsEnabled ? 'bg-primary' : 'bg-outline-variant'}"
            onclick={() => emailNotificationsEnabled = !emailNotificationsEnabled}
            role="switch"
            aria-checked={emailNotificationsEnabled}
          >
            <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out {emailNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
          </button>
        </div>

        <!-- Reply-To Email -->
        <div class="flex flex-col gap-3">
          <label class="font-title-md text-title-md text-on-surface-variant">Reply-to Email</label>
          <p class="font-body-md text-body-md text-on-surface-variant text-xs -mt-2">Clients who reply to notification emails will send their reply here.</p>
          <div class="flex rounded-lg shadow-sm border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <span class="inline-flex items-center px-3 rounded-l-lg border-r border-outline-variant bg-surface-container-low text-on-surface-variant">
              <span class="material-symbols-outlined text-sm">mail</span>
            </span>
            <input class="flex-1 block w-full rounded-none rounded-r-lg border-none bg-surface-container-lowest font-body-md text-body-md text-on-surface placeholder:text-outline/50 py-2 px-3 outline-none" placeholder="reply@youragency.com" type="email" bind:value={replyToEmail}/>
          </div>
        </div>

        <div class="pt-4 border-t border-surface-variant flex justify-end">
          <button class="px-6 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-title-md text-title-md rounded-lg shadow-sm transition-all active:scale-95 focus:outline-none disabled:opacity-50 flex items-center gap-2" onclick={saveEmailSettings} disabled={savingEmail}>
            {#if savingEmail}
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Saving...
            {:else}
              Save Changes
            {/if}
          </button>
        </div>
      </div>

      <!-- Info Card -->
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-variant flex flex-col gap-5">
        <h3 class="font-headline-md text-headline-md text-on-surface border-b border-surface-variant pb-4">Email Triggers</h3>
        <div class="flex flex-col gap-4">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-sm">receipt_long</span>
            </div>
            <div>
              <p class="font-title-md text-title-md text-on-surface">Invoice Sent</p>
              <p class="font-body-md text-body-md text-on-surface-variant">Client receives invoice details with a pay link.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-sm">notifications</span>
            </div>
            <div>
              <p class="font-title-md text-title-md text-on-surface">Payment Reminder</p>
              <p class="font-body-md text-body-md text-on-surface-variant">Reminder email for overdue or pending invoices.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-sm">person_add</span>
            </div>
            <div>
              <p class="font-title-md text-title-md text-on-surface">Portal Invite</p>
              <p class="font-body-md text-body-md text-on-surface-variant">Welcome email when a client is invited to the portal.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-sm">upload_file</span>
            </div>
            <div>
              <p class="font-title-md text-title-md text-on-surface">Deliverable Shared</p>
              <p class="font-body-md text-body-md text-on-surface-variant">Client is notified when a new deliverable is ready for review.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-sm">check_circle</span>
            </div>
            <div>
              <p class="font-title-md text-title-md text-on-surface">Deliverable Approved / Changes</p>
              <p class="font-body-md text-body-md text-on-surface-variant">Agency is notified when a client approves or requests changes.</p>
            </div>
          </div>
        </div>
        <div class="mt-2 px-4 py-3 bg-surface-container rounded-lg">
          <p class="font-body-md text-body-md text-on-surface-variant text-xs">
            <span class="material-symbols-outlined text-sm align-middle mr-1">info</span>
            Emails are sent from your agency name. White-label — no "ClientDesk" branding visible to your clients.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if toastMsg}
  <div class="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 font-body-md text-body-md animate-fadeIn {toastType === 'success' ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'}">
    <span class="material-symbols-outlined text-lg">{toastType === 'success' ? 'check_circle' : 'error'}</span>
    {toastMsg}
  </div>
{/if}
