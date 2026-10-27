<script lang="ts">
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  const clientId = $page.params.id;

  let client = $state<any>(null);
  let projects = $state<any[]>([]);
  let activeProjectsCount = $state(0);
  let totalRevenue = $state(0);
  let pendingInvoicesCount = $state(0);
  let loading = $state(true);

  let showInviteModal = $state(false);
  let inviteEmail = $state('');
  let inviteLoading = $state(false);
  let inviteMsg = $state('');
  let inviteError = $state('');
  let hasPortalAccess = $state(false);
  let portalEmail = $state('');
  let inviteIsResend = $state(false);

  let toastMsg = $state('');
  let toastType = $state<'success' | 'error'>('success');

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    setTimeout(() => toastMsg = '', 3000);
  }

  async function checkPortalAccess() {
    const { data } = await supabase
      .from('client_users')
      .select('email')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    hasPortalAccess = !!(data && data.length > 0);
    portalEmail = data?.[0]?.email || '';
  }

  function openInviteModal(resend = false) {
    inviteIsResend = resend;
    inviteEmail = resend ? portalEmail : (client?.email || '');
    inviteError = '';
    inviteMsg = '';
    showInviteModal = true;
  }

  async function sendInvite(e: Event) {
    e.preventDefault();
    if (!inviteEmail.trim()) { inviteError = 'Please enter an email.'; return; }
    inviteError = '';
    inviteMsg = '';
    inviteLoading = true;
    try {
      const res = await fetch('/api/client/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authState.session?.access_token || ''}` },
        body: JSON.stringify({ client_id: clientId, email: inviteEmail.trim() })
      });
      const json = await res.json().catch(() => ({}));
      if (json.portal_created) { hasPortalAccess = true; portalEmail = portalEmail || inviteEmail.trim().toLowerCase(); }
      if (!res.ok || !json.success) {
        inviteError = json.message || 'Could not send the invite. Please try again.';
      } else {
        hasPortalAccess = true;
        portalEmail = portalEmail || json.email;
        inviteMsg = `${json.resent ? 'New login link sent' : 'Invite sent'} to ${json.email}. They can sign in straight from the email.`;
      }
    } catch {
      inviteError = 'Network error. Please try again.';
    }
    inviteLoading = false;
  }

  function closeInviteModal() {
    showInviteModal = false;
    inviteEmail = '';
    inviteError = '';
    inviteMsg = '';
  }

  function fmt(n: number) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function initials(name: string) {
    return name?.substring(0, 2).toUpperCase() || 'NA';
  }

  async function loadData() {
    if (!authState.agencyId) return;
    loading = true;

    // Fetch Client
    const { data: cData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('agency_id', authState.agencyId)
      .single();
    if (cData) client = cData;

    // Fetch Projects
    const { data: pData } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .eq('agency_id', authState.agencyId)
      .order('created_at', { ascending: false });
    if (pData) {
      projects = pData;
      activeProjectsCount = pData.filter(p => p.status === 'active').length;
    }

    // Fetch Invoices for Stats
    const { data: iData } = await supabase
      .from('invoices')
      .select('status, total')
      .eq('client_id', clientId)
      .eq('agency_id', authState.agencyId);
    if (iData) {
      totalRevenue = iData.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total || 0), 0);
      pendingInvoicesCount = iData.filter(i => i.status === 'pending').length;
    }


    await checkPortalAccess();
    loading = false;
  }

  $effect(() => {
    if (!authState.loading && authState.agencyId) {
      loadData();
    }
  });

</script>

<svelte:head>
  <title>{client?.full_name || 'Client Details'} - ClientDesk</title>
</svelte:head>


<div class="fixed inset-0 bg-background text-on-background flex overflow-hidden w-full">
  <AgencyHeader activeTab="Clients" />

  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full">
    {#if loading}
      <div>
        <div class="h-3.5 w-20 animate-shimmer rounded mb-4"></div>
        <div class="animate-shimmer rounded-lg h-32 mb-5"></div>
        <div class="grid grid-cols-3 gap-3 mb-5">
          {#each Array(3) as _}
            <div class="bg-white rounded-lg p-4 border border-outline-variant">
              <div class="h-3 animate-shimmer rounded w-1/2 mb-2"></div>
              <div class="h-6 animate-shimmer rounded w-1/3"></div>
            </div>
          {/each}
        </div>
      </div>
    {:else if client}
      <div class="animate-fadeIn">
        <a href="/clients" class="flex items-center gap-1.5 text-on-surface-variant mb-4 hover:text-on-surface transition-colors w-fit no-underline">
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          <span class="text-[13px] font-medium">Clients</span>
        </a>

        <div class="bg-white rounded-lg border border-outline-variant shadow-xs p-5 mb-5 flex flex-col md:flex-row items-start gap-4">
          <div class="shrink-0">
            {#if client.avatar_url}
              <img alt="Client Avatar" class="h-12 w-12 rounded-full object-cover" src={client.avatar_url}/>
            {:else}
              <div class="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                {initials(client.full_name)}
              </div>
            {/if}
          </div>
          <div class="flex-1 min-w-0">
            <h1 class="text-lg font-semibold text-on-surface mb-0.5">{client.full_name}</h1>
            <p class="text-sm text-on-surface-variant">{client.company || 'Independent'}</p>
            <p class="text-xs text-outline mt-1">Client since {new Date(client.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            {#if hasPortalAccess}
              <span class="text-success bg-success/[0.08] px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                Portal Active
              </span>
              <button class="bg-white border border-outline-variant text-on-surface px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-surface-container-low transition-colors flex items-center gap-1.5" onclick={() => openInviteModal(true)}>
                <span class="material-symbols-outlined text-[16px]">forward_to_inbox</span>
                Resend invite
              </button>
            {:else}
              <button class="bg-white border border-outline-variant text-on-surface px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-surface-container-low transition-colors flex items-center gap-1.5" onclick={() => openInviteModal(false)}>
                <span class="material-symbols-outlined text-[16px]">person_add</span>
                Invite to Portal
              </button>
            {/if}
            <button class="bg-white border border-outline-variant text-on-surface-variant px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-surface-container-low transition-colors flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">edit</span>
              Edit
            </button>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3 mb-5">
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-lg bg-secondary/[0.08] flex items-center justify-center">
                <span class="material-symbols-outlined text-secondary text-[16px]">folder_open</span>
              </div>
              <span class="text-xs text-on-surface-variant">Active Projects</span>
            </div>
            <span class="text-[15px] font-semibold text-on-surface">{activeProjectsCount}</span>
          </div>
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-lg bg-success/[0.08] flex items-center justify-center">
                <span class="material-symbols-outlined text-success text-[16px]">payments</span>
              </div>
              <span class="text-xs text-on-surface-variant">Total Revenue</span>
            </div>
            <span class="text-[15px] font-semibold text-on-surface">{fmt(totalRevenue)}</span>
          </div>
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-lg bg-tertiary/[0.08] flex items-center justify-center">
                <span class="material-symbols-outlined text-tertiary text-[16px]">receipt_long</span>
              </div>
              <span class="text-xs text-on-surface-variant">Pending Invoices</span>
            </div>
            <span class="text-[15px] font-semibold text-on-surface">{pendingInvoicesCount}</span>
          </div>
        </div>

        <div class="flex gap-1.5 overflow-x-auto pb-1 mb-5">
          <button class="bg-primary text-white px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors">Overview</button>
          <a href={`/projects?client=${client.id}`} class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors no-underline">Projects</a>
          <a href={`/files?client=${client.id}`} class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors no-underline">Files</a>
          <a href={`/invoices?client=${client.id}`} class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors no-underline">Invoices</a>
          <a href={`/messages?client=${client.id}`} class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors no-underline">Messages</a>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start mb-8">
          <div class="lg:col-span-4">
            <div class="bg-white rounded-lg border border-outline-variant shadow-xs p-4">
              <h3 class="text-sm font-medium text-on-surface mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px] text-primary">contact_page</span>
                Contact Information
              </h3>
              <div class="space-y-3.5">
                {#each [
                  { icon: 'mail', label: 'Email', value: client.email },
                  { icon: 'phone', label: 'Phone', value: client.phone },
                  { icon: 'location_on', label: 'Location', value: client.location }
                ] as item}
                <div class="flex items-start gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                    <span class="material-symbols-outlined text-primary text-[16px]">{item.icon}</span>
                  </div>
                  <div>
                    <p class="text-[11px] text-on-surface-variant mb-0.5">{item.label}</p>
                    <p class="text-sm text-on-surface">{item.value || 'Not provided'}</p>
                  </div>
                </div>
                {/each}
              </div>
            </div>
          </div>

          <div class="lg:col-span-8">
            <h3 class="text-sm font-medium text-on-surface mb-3">Active Projects</h3>

            {#if projects.filter(p => p.status === 'active').length === 0}
              <div class="border border-dashed border-outline-variant rounded-lg py-10 text-center">
                <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">folder_off</span>
                <p class="text-sm text-on-surface-variant">No active projects for this client.</p>
              </div>
            {:else}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                {#each projects.filter(p => p.status === 'active') as p (p.id)}
                  <a href={`/projects/${p.id}`} class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant hover:border-primary/30 transition-colors no-underline flex flex-col h-full group">
                    <div class="flex justify-between items-start mb-2">
                      <span class="text-[11px] font-medium text-success bg-success/[0.08] px-1.5 py-0.5 rounded">Active</span>
                      <span class="material-symbols-outlined text-[16px] text-outline group-hover:text-primary transition-colors">arrow_forward</span>
                    </div>
                    <h4 class="text-sm font-medium text-on-surface mb-1 group-hover:text-primary transition-colors">{p.name}</h4>
                    <p class="text-[13px] text-on-surface-variant mb-3 line-clamp-2 flex-1">{p.description || 'No description provided'}</p>
                    <div class="mt-auto">
                      <div class="flex justify-between text-xs mb-1">
                        <span class="text-on-surface-variant">Progress</span>
                        <span class="text-success font-medium">{p.progress}%</span>
                      </div>
                      <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                        <div class="bg-success h-full rounded-full" style="width: {p.progress}%;"></div>
                      </div>
                      <div class="flex items-center mt-2.5 pt-2.5 border-t border-outline-variant text-xs text-on-surface-variant">
                        <span class="material-symbols-outlined text-[14px] mr-1">schedule</span>
                        {#if p.deadline}
                          Due {new Date(p.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {:else}
                          No deadline
                        {/if}
                      </div>
                    </div>
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <div class="py-20 text-center text-on-surface-variant">Client not found or you don't have permission to view it.</div>
    {/if}
  </main>
</div>

{#if showInviteModal}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onclick={(e) => { if (e.target === e.currentTarget) closeInviteModal(); }} onkeydown={(e) => { if (e.key === 'Escape') closeInviteModal(); }}>
  <div class="bg-white rounded-lg shadow-lg w-full max-w-sm border border-outline-variant animate-fadeIn">
    <div class="p-5">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-[15px] font-semibold text-on-surface">{inviteIsResend ? 'Resend Portal Invite' : 'Invite to Client Portal'}</h3>
        <button class="text-on-surface-variant hover:text-on-surface w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center" onclick={closeInviteModal}>
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <p class="text-sm text-on-surface-variant mb-4">{inviteIsResend ? 'Send a fresh login link to' : 'Send a portal login link to'} <strong>{client?.full_name}</strong>.</p>

      {#if inviteMsg}
        <div class="mb-4 p-3 bg-success/[0.06] text-success border border-success/20 rounded-lg flex items-center gap-2 text-sm">
          <span class="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{inviteMsg}</span>
        </div>
        <button class="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors" onclick={closeInviteModal}>Done</button>
      {:else}
        {#if inviteError}
          <div class="mb-4 p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg flex items-center gap-2 text-sm">
            <span class="material-symbols-outlined text-[18px]">error</span>
            <span>{inviteError}</span>
          </div>
        {/if}
        <form onsubmit={sendInvite}>
          <div class="mb-4">
            <label class="block text-xs font-medium text-on-surface-variant mb-1.5" for="invite-email">Email Address</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">mail</span>
              <input
                class="w-full pl-9 pr-3 py-1.5 bg-white border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm text-on-surface"
                id="invite-email"
                type="email"
                bind:value={inviteEmail}
                disabled={inviteLoading}
              />
            </div>
          </div>
          <button
            class="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            type="submit"
            disabled={inviteLoading}
          >
            {#if inviteLoading}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Sending...
            {:else}
              {inviteIsResend ? 'Resend Invite' : 'Send Invite'}
            {/if}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
{/if}

{#if toastMsg}
  <div class="fixed bottom-5 right-5 z-[200] px-4 py-2.5 rounded-lg shadow-md text-sm flex items-center gap-2 animate-fadeIn {toastType === 'error' ? 'bg-white border border-error/20 text-on-surface' : 'bg-on-surface text-surface'}">
    <span class="material-symbols-outlined text-[18px] {toastType === 'error' ? 'text-error' : ''}">{toastType === 'error' ? 'error' : 'check_circle'}</span>
    {toastMsg}
  </div>
{/if}
