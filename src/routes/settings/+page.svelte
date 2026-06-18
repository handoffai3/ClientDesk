<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  const navTabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];
  
  let activeTab = $state<'Branding' | 'Account' | 'Notifications' | 'Team'>('Branding');
  let userMenuOpen = $state(false);
  let loading = $state(true);

  // Agency data
  let agencyId = $state('');
  let logoUrl = $state('');
  let primaryColor = $state('#7C3AED');
  let customDomain = $state('');
  let notificationSettings = $state({
    newFile: true,
    invoicePaid: true,
    approvalRequested: true,
    messageReceived: true,
    taskCompleted: true,
    newClient: true
  });

  // Team data
  let teamMembers = $state<any[]>([]);
  let showInviteModal = $state(false);
  let inviteEmail = $state('');
  let inviteError = $state('');
  let inviteSuccess = $state('');

  // UI state
  let savingBranding = $state(false);
  let savingNotifications = $state(false);
  let brandingMsg = $state('');
  let notifMsg = $state('');
  let fileInput: HTMLInputElement;

  async function loadData() {
    if (!authState.agencyId) return;
    agencyId = authState.agencyId;
    loading = true;

    // Load Agency
    const { data: agency } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .single();

    if (agency) {
      logoUrl = agency.logo_url || '';
      primaryColor = agency.primary_color || '#7C3AED';
      customDomain = agency.custom_domain || '';
      if (agency.notification_settings) {
        notificationSettings = { ...notificationSettings, ...agency.notification_settings };
      }
    }

    // Load Team
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: true });

    if (users) {
      teamMembers = users;
    }

    loading = false;
  }

  $effect(() => {
    if (!authState.loading && authState.agencyId) {
      loadData();
    }
  });

  async function handleLogoUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !agencyId) return;

    brandingMsg = 'Uploading logo...';
    const path = `${agencyId}/logo_${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('agency-assets').upload(path, file);
    
    if (uploadErr) {
      brandingMsg = 'Upload failed: ' + uploadErr.message;
      return;
    }

    const { data: urlData } = supabase.storage.from('agency-assets').getPublicUrl(path);
    logoUrl = urlData?.publicUrl || '';
    brandingMsg = 'Logo uploaded! Don\'t forget to save changes.';
    target.value = '';
  }

  async function saveBranding() {
    if (!agencyId) return;
    savingBranding = true;
    brandingMsg = '';

    const { error } = await supabase
      .from('agencies')
      .update({
        logo_url: logoUrl,
        primary_color: primaryColor,
        custom_domain: customDomain
      })
      .eq('id', agencyId);

    if (error) {
      brandingMsg = 'Error: ' + error.message;
    } else {
      brandingMsg = 'Brand identity updated successfully!';
      setTimeout(() => brandingMsg = '', 3000);
    }
    savingBranding = false;
  }

  async function toggleNotification(key: keyof typeof notificationSettings) {
    notificationSettings[key] = !notificationSettings[key];
    if (!agencyId) return;
    savingNotifications = true;

    const { error } = await supabase
      .from('agencies')
      .update({ notification_settings: notificationSettings })
      .eq('id', agencyId);

    if (error) {
      // Revert if error
      notificationSettings[key] = !notificationSettings[key];
      notifMsg = 'Error saving setting: ' + error.message;
      // You may need to run ALTER TABLE agencies ADD COLUMN notification_settings jsonb; in Supabase SQL Editor if this fails!
    } else {
      notifMsg = 'Settings saved.';
      setTimeout(() => notifMsg = '', 2000);
    }
    savingNotifications = false;
  }

  async function inviteMember() {
    if (!inviteEmail) return;
    inviteError = '';
    inviteSuccess = '';

    // The prompt requested to use supabase.auth.admin.inviteUserByEmail()
    // Note: This requires the SERVICE_ROLE key, so it will fail with anon key.
    // Assuming the user has a modified supabaseClient with admin privileges or a workaround if they specifically requested it.
    try {
      const { data, error } = await (supabase.auth as any).admin?.inviteUserByEmail(inviteEmail, {
        data: { agency_id: agencyId, role: 'member' }
      });

      if (error) throw error;
      
      inviteSuccess = 'Invitation sent to ' + inviteEmail;
      inviteEmail = '';
      setTimeout(() => showInviteModal = false, 2000);
    } catch (e: any) {
      inviteError = e.message || 'Error sending invite (Admin API may not be accessible from client).';
    }
  }

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/';
    if (tab === 'Projects') return '/projects';
    if (tab === 'Clients') return '/clients';
    if (tab === 'Files') return '/files';
    if (tab === 'Invoices') return '/invoices';
    if (tab === 'Messages') return '/messages';
    return `/?tab=${tab}`;
  }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/login');
  }

  const presetColors = [
    { name: 'Purple', hex: '#7C3AED' },
    { name: 'Blue', hex: '#2563EB' },
    { name: 'Green', hex: '#10B981' },
    { name: 'Red', hex: '#EF4444' }
  ];

  const notifs = [
    { key: 'newFile', label: 'New file upload', desc: 'When a client uploads a file.' },
    { key: 'invoicePaid', label: 'Invoice paid', desc: 'When a client completes payment.' },
    { key: 'approvalRequested', label: 'Approval requested', desc: 'When a client requests changes to a deliverable.' },
    { key: 'messageReceived', label: 'Message received', desc: 'When a client sends a new message.' },
    { key: 'taskCompleted', label: 'Task completed', desc: 'When a client marks a task as done.' },
    { key: 'newClient', label: 'New client added', desc: 'When a new client registers in the portal.' }
  ];
</script>

<svelte:head>
  <title>Settings - ClientDesk</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <AgencyHeader activeTab="Settings" />

  <!-- Main -->
  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full">
    <div class="mb-8">
      <h1 class="font-display-md text-display-md text-on-surface mb-2">Settings</h1>
      <p class="font-body-md text-body-md text-on-surface-variant">Manage your agency preferences and team.</p>
    </div>

    <!-- Tab Pills -->
    <div class="flex space-x-2 overflow-x-auto pb-2 mb-8">
      {#each ['Branding', 'Account', 'Notifications', 'Team'] as tab}
        <button
          class="px-5 py-2.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all duration-150 focus:outline-none {activeTab === tab ? 'bg-primary text-white shadow-sm' : 'bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/30'}"
          onclick={() => activeTab = tab as any}
        >
          {tab}
        </button>
      {/each}
    </div>

    {#if loading}
      <div class="py-20 flex justify-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
    {:else}
      {#if activeTab === 'Branding'}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <!-- Left: Form -->
          <div class="bg-surface rounded-2xl p-8 shadow-sm border border-outline-variant/20">
            <h2 class="font-headline-sm text-headline-sm text-on-surface mb-6">Brand Identity</h2>
            
            <div class="space-y-6">
              <!-- Logo Upload -->
              <div>
                <label class="block font-label-md text-label-md text-on-surface-variant mb-2">Agency Logo</label>
                <div class="flex items-center gap-4">
                  <div class="w-16 h-16 rounded-xl border-2 border-dashed border-outline-variant flex items-center justify-center bg-surface-container-lowest overflow-hidden">
                    {#if logoUrl}
                      <img src={logoUrl} alt="Logo" class="w-full h-full object-contain" />
                    {:else}
                      <span class="material-symbols-outlined text-outline-variant text-2xl">image</span>
                    {/if}
                  </div>
                  <input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={handleLogoUpload} />
                  <button class="bg-surface-variant hover:bg-outline-variant text-on-surface-variant px-4 py-2 rounded-lg font-label-md text-label-md transition-colors focus:outline-none" onclick={() => fileInput?.click()}>
                    Upload Logo
                  </button>
                </div>
              </div>

              <!-- Color Picker -->
              <div>
                <label class="block font-label-md text-label-md text-on-surface-variant mb-2">Primary Color</label>
                <div class="flex items-center gap-3 mb-3">
                  {#each presetColors as pc}
                    <button
                      class="w-8 h-8 rounded-full border-2 focus:outline-none transition-transform hover:scale-110 {primaryColor.toUpperCase() === pc.hex.toUpperCase() ? 'border-on-surface shadow-md scale-110' : 'border-transparent'}"
                      style="background-color: {pc.hex}"
                      onclick={() => primaryColor = pc.hex}
                      aria-label={pc.name}
                    ></button>
                  {/each}
                </div>
                <div class="flex items-center gap-3">
                  <input type="color" bind:value={primaryColor} class="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                  <input type="text" bind:value={primaryColor} class="px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary uppercase w-32" />
                </div>
              </div>

              <!-- Custom Domain -->
              <div>
                <label class="block font-label-md text-label-md text-on-surface-variant mb-2">Custom Domain</label>
                <div class="flex items-center">
                  <span class="px-3 py-2 bg-surface-variant border border-outline-variant border-r-0 rounded-l-lg font-body-md text-body-md text-on-surface-variant">https://</span>
                  <input type="text" bind:value={customDomain} placeholder="clients.youragency.com" class="flex-1 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-r-lg font-body-md text-body-md focus:outline-none focus:border-primary" />
                </div>
              </div>

              <!-- Messages & Actions -->
              <div class="pt-4 border-t border-outline-variant/30 flex items-center justify-between">
                <span class="text-sm {brandingMsg.includes('Error') ? 'text-error' : 'text-[#10b981]'}">{brandingMsg}</span>
                <button
                  class="bg-primary hover:bg-primary/90 text-on-primary px-6 py-2 rounded-lg font-label-md text-label-md shadow-md transition-colors focus:outline-none flex items-center gap-2"
                  onclick={saveBranding}
                  disabled={savingBranding}
                >
                  {#if savingBranding}
                    <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {/if}
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          <!-- Right: Preview -->
          <div class="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/20 flex flex-col items-center">
            <h2 class="font-headline-sm text-headline-sm text-on-surface mb-6 w-full text-left">Live Login Preview</h2>
            
            <div class="w-full max-w-[320px] bg-white rounded-xl shadow-xl border border-outline-variant/10 overflow-hidden relative" style="height: 400px;">
              <!-- Mini Login Header -->
              <div class="h-32 flex flex-col items-center justify-center relative" style="background-color: {primaryColor}">
                <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                {#if logoUrl}
                  <img src={logoUrl} alt="Logo" class="h-12 w-auto relative z-10 bg-white/10 p-2 rounded-lg backdrop-blur-sm" />
                {:else}
                  <div class="h-12 w-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center relative z-10 text-white font-bold text-xl">A</div>
                {/if}
              </div>
              <!-- Mini Form -->
              <div class="p-6">
                <h3 class="font-title-md text-title-md text-center mb-4">Client Portal</h3>
                <div class="space-y-3 mb-4">
                  <div class="h-10 rounded border border-outline-variant/50 bg-surface-variant/30 flex items-center px-3"><span class="w-16 h-2 bg-outline-variant/50 rounded"></span></div>
                  <div class="h-10 rounded border border-outline-variant/50 bg-surface-variant/30 flex items-center px-3"><span class="w-12 h-2 bg-outline-variant/50 rounded"></span></div>
                </div>
                <div class="h-10 rounded text-white flex items-center justify-center text-sm font-bold shadow-md" style="background-color: {primaryColor}">Sign In</div>
              </div>
            </div>
          </div>
        </div>

      {:else if activeTab === 'Notifications'}
        <div class="max-w-2xl bg-surface rounded-2xl p-8 shadow-sm border border-outline-variant/20">
          <h2 class="font-headline-sm text-headline-sm text-on-surface mb-2">Email Notifications</h2>
          <p class="font-body-md text-body-md text-on-surface-variant mb-6">Choose what events trigger an email to your agency administrators.</p>
          
          <div class="space-y-4">
            {#each notifs as n}
              <div class="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                <div>
                  <h3 class="font-title-md text-title-md text-on-surface">{n.label}</h3>
                  <p class="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">{n.desc}</p>
                </div>
                <button
                  class="w-12 h-6 rounded-full relative transition-colors focus:outline-none {notificationSettings[n.key as keyof typeof notificationSettings] ? 'bg-primary' : 'bg-surface-variant'}"
                  onclick={() => toggleNotification(n.key as keyof typeof notificationSettings)}
                >
                  <div class="w-4 h-4 bg-white rounded-full absolute top-1 transition-transform {notificationSettings[n.key as keyof typeof notificationSettings] ? 'translate-x-7' : 'translate-x-1'}"></div>
                </button>
              </div>
            {/each}
          </div>
          {#if notifMsg}
            <div class="mt-4 text-sm text-[#10b981]">{notifMsg}</div>
          {/if}
          <div class="mt-6 p-4 bg-primary-container/30 text-on-primary-container rounded-lg text-sm border border-primary/20">
            <strong>Note:</strong> If you receive an error saving, you may need to run <code>ALTER TABLE agencies ADD COLUMN notification_settings jsonb;</code> in your Supabase SQL Editor.
          </div>
        </div>

      {:else if activeTab === 'Team'}
        <div class="mb-6 flex justify-between items-center">
          <h2 class="font-headline-sm text-headline-sm text-on-surface">Agency Team</h2>
          <button class="bg-primary hover:bg-primary/90 text-on-primary px-5 py-2 rounded-lg font-label-md text-label-md shadow-md transition-colors focus:outline-none flex items-center gap-2" onclick={() => showInviteModal = true}>
            <span class="material-symbols-outlined text-sm">person_add</span> Invite Member
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each teamMembers as member (member.id)}
            <div class="bg-surface rounded-2xl p-6 shadow-sm border border-outline-variant/20 flex flex-col items-center text-center">
              {#if member.avatar_url}
                <img src={member.avatar_url} alt="Avatar" class="w-20 h-20 rounded-full object-cover mb-4 border border-outline-variant/30" />
              {:else}
                <div class="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-display-md text-display-md mb-4 border border-outline-variant/30">
                  {member.full_name?.substring(0, 2).toUpperCase() || 'NA'}
                </div>
              {/if}
              <h3 class="font-title-md text-title-md text-on-surface mb-1">{member.full_name || 'Pending User'}</h3>
              <p class="font-body-md text-body-md text-on-surface-variant mb-4">{member.email}</p>
              <div class="mt-auto w-full pt-4 border-t border-outline-variant/30 flex justify-between items-center">
                <span class="px-2 py-1 rounded-full text-xs font-bold {member.role === 'admin' ? 'bg-primary-container text-primary' : 'bg-surface-variant text-on-surface-variant'} uppercase tracking-wider">
                  {member.role}
                </span>
                {#if member.role !== 'admin'}
                  <button class="text-outline hover:text-error transition-colors focus:outline-none"><span class="material-symbols-outlined text-sm">delete</span></button>
                {/if}
              </div>
            </div>
          {/each}
          {#if teamMembers.length === 0}
            <div class="col-span-full py-12 text-center text-on-surface-variant bg-surface rounded-xl border border-outline-variant/20">
              No team members found. Invite someone to join your agency!
            </div>
          {/if}
        </div>

      {:else if activeTab === 'Account'}
        <div class="bg-surface rounded-2xl p-8 shadow-sm border border-outline-variant/20 max-w-2xl">
          <h2 class="font-headline-sm text-headline-sm text-on-surface mb-6">Account Settings</h2>
          <p class="text-on-surface-variant mb-4">Account preferences and billing details will appear here.</p>
          <div class="bg-surface-container p-6 rounded-lg text-center border border-outline-variant/30">
            <span class="material-symbols-outlined text-4xl text-outline mb-2 block">construction</span>
            <p>This section is under construction.</p>
          </div>
        </div>
      {/if}
    {/if}
  </main>
</div>

<!-- Invite Modal -->
{#if showInviteModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
    <div class="bg-surface-container-lowest w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-outline-variant/40">
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-title-md text-title-md font-bold text-on-surface">Invite Team Member</h3>
        <button class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container" onclick={() => showInviteModal = false}>
          <span class="material-symbols-outlined block">close</span>
        </button>
      </div>

      <p class="font-body-md text-body-md text-on-surface-variant mb-4">Send an invitation email to a new team member. They will be added as a 'Member'.</p>

      <div class="mb-6">
        <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="invite-email">Email Address</label>
        <input type="email" id="invite-email" bind:value={inviteEmail} placeholder="colleague@agency.com" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-sm text-on-surface" />
      </div>

      {#if inviteError}
        <div class="mb-4 text-xs text-error bg-error-container/20 p-2 rounded border border-error/20">{inviteError}</div>
      {/if}
      {#if inviteSuccess}
        <div class="mb-4 text-xs text-[#10b981] bg-[#10b981]/10 p-2 rounded border border-[#10b981]/20">{inviteSuccess}</div>
      {/if}

      <button class="w-full bg-primary text-on-primary py-2.5 rounded-lg font-label-md text-label-md shadow-sm hover:bg-primary/90 transition-colors focus:outline-none disabled:opacity-50" onclick={inviteMember} disabled={!inviteEmail}>
        Send Invitation
      </button>
    </div>
  </div>
{/if}
