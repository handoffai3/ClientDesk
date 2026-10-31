<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { agencyDataStore } from '../../../stores/agencyData';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';
  import { apiFetch } from '$lib/apiFetch';
  import { onMount } from 'svelte';
  import { fmtMoney } from '$lib/format';

  const clientId = $page.params.id;

  const validTabs = ['Overview', 'Projects', 'Files', 'Invoices', 'Messages'];
  const initialTab = $page.url.searchParams.get('tab');
  let activeTab = $state(validTabs.includes(initialTab || '') ? (initialTab as string) : 'Overview');

  $effect(() => {
    const url = new URL(window.location.href);
    if (activeTab === 'Overview') url.searchParams.delete('tab');
    else url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url.toString());
  });

  let client = $state<any>(null);
  let projects = $state<any[]>([]);
  let files = $state<any[]>([]);
  let invoices = $state<any[]>([]);
  let messages = $state<any[]>([]);
  let activeProjectsCount = $state(0);
  let totalRevenue = $state(0);
  let pendingInvoicesCount = $state(0);
  let loading = $state(true);

  // Portal invite
  let showInviteModal = $state(false);
  let inviteEmail = $state('');
  let inviteLoading = $state(false);
  let inviteMsg = $state('');
  let inviteError = $state('');
  let hasPortalAccess = $state(false);
  let portalEmail = $state('');
  let inviteIsResend = $state(false);

  // Edit modal
  let showEditModal = $state(false);
  let editForm = $state({ full_name: '', company: '', email: '', phone: '', location: '', status: 'active' });
  let editSaving = $state(false);
  let editError = $state('');
  let editEmailChanged = $state(false);

  // Messages
  let msgInput = $state('');
  let sendingMsg = $state(false);
  let messagesEnd: HTMLDivElement;

  // Toast
  let toastMsg = $state('');
  let toastType = $state<'success' | 'error'>('success');

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg; toastType = type; setTimeout(() => toastMsg = '', 3000);
  }

  function fmt(n: number) { return fmtMoney(n, $agencyDataStore.currency, 0); }

  async function downloadFile(file: any) {
    try {
      const res = await apiFetch(`/api/files/${file.id}/download`);
      const data = await res.json();
      if (res.ok && data.url) window.open(data.url, '_blank');
    } catch {}
  }
  function initials(name: string) { return name?.substring(0, 2).toUpperCase() || 'NA'; }
  function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'; }
  function fmtTime(d: string) { return new Date(d).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  async function checkPortalAccess() {
    const { data } = await supabase.from('client_users').select('email').eq('client_id', clientId).order('created_at', { ascending: true });
    hasPortalAccess = !!(data && data.length > 0);
    portalEmail = data?.[0]?.email || '';
  }

  function openInviteModal(resend = false) {
    inviteIsResend = resend;
    inviteEmail = resend ? portalEmail : (client?.email || '');
    inviteError = ''; inviteMsg = '';
    showInviteModal = true;
  }

  async function sendInvite(e: Event) {
    e.preventDefault();
    if (!inviteEmail.trim()) { inviteError = 'Please enter an email.'; return; }
    inviteError = ''; inviteMsg = '';
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
        inviteMsg = `${json.resent ? 'New login link sent' : 'Invite sent'} to ${json.email}.`;
      }
    } catch { inviteError = 'Network error. Please try again.'; }
    inviteLoading = false;
  }

  function closeInviteModal() { showInviteModal = false; inviteEmail = ''; inviteError = ''; inviteMsg = ''; }

  // Edit modal
  function openEditModal() {
    if (!client) return;
    editForm = {
      full_name: client.full_name || '',
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      location: client.location || '',
      status: client.status || 'active'
    };
    editError = '';
    editEmailChanged = false;
    showEditModal = true;
  }

  async function saveEdit(e: Event) {
    e.preventDefault();
    if (!editForm.full_name.trim()) { editError = 'Name is required.'; return; }
    if (editForm.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(editForm.email)) { editError = 'Enter a valid email.'; return; }
    editError = '';
    editSaving = true;

    const emailChanged = editForm.email !== (client.email || '');
    const { error } = await supabase.from('clients').update({
      full_name: editForm.full_name.trim(),
      company: editForm.company.trim() || null,
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      location: editForm.location.trim() || null,
      status: editForm.status
    }).eq('id', clientId);

    if (error) { editError = error.message; editSaving = false; return; }

    client = { ...client, ...editForm };
    agencyDataStore.update(s => ({
      ...s,
      clients: s.clients.map(c => c.id === clientId ? { ...c, ...editForm } : c)
    }));

    editSaving = false;
    showEditModal = false;
    showToast('Client updated');

    if (emailChanged && hasPortalAccess) {
      editEmailChanged = true;
    }
  }

  // Messages
  async function sendClientMessage() {
    if (!msgInput.trim() || !authState.agencyId || !authState.user) return;
    sendingMsg = true;
    const { data, error } = await supabase.from('messages').insert({
      agency_id: authState.agencyId,
      client_id: clientId,
      sender_type: 'agency',
      sender_id: authState.user.id,
      content: msgInput,
      is_read: true
    }).select('*').single();
    if (error) showToast('Send failed: ' + error.message, 'error');
    else if (data) {
      messages = [...messages, data];
      agencyDataStore.update(s => ({ ...s, messages: [...s.messages, data] }));
      msgInput = '';
      setTimeout(() => messagesEnd?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    sendingMsg = false;
  }

  async function loadData() {
    if (!authState.agencyId) return;
    loading = true;

    const { data: cData } = await supabase.from('clients').select('*').eq('id', clientId).eq('agency_id', authState.agencyId).single();
    if (cData) client = cData;

    const [pRes, fRes, iRes, msgRes] = await Promise.all([
      supabase.from('projects').select('*, clients(full_name)').eq('client_id', clientId).eq('agency_id', authState.agencyId).order('created_at', { ascending: false }),
      supabase.from('files').select('*').eq('client_id', clientId).eq('agency_id', authState.agencyId).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('client_id', clientId).eq('agency_id', authState.agencyId).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').eq('client_id', clientId).eq('agency_id', authState.agencyId).order('created_at', { ascending: true })
    ]);

    if (pRes.data) {
      projects = pRes.data;
      activeProjectsCount = pRes.data.filter(p => p.status === 'active').length;
    }
    if (fRes.data) files = fRes.data;
    if (iRes.data) {
      invoices = iRes.data;
      totalRevenue = iRes.data.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total || 0), 0);
      pendingInvoicesCount = iRes.data.filter(i => i.status === 'pending').length;
    }
    if (msgRes.data) messages = msgRes.data;

    await checkPortalAccess();
    loading = false;
  }

  $effect(() => {
    if (!authState.loading && authState.agencyId) loadData();
  });

  onMount(() => {
    const channel = supabase.channel('client-detail-msgs-' + clientId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` }, (payload: any) => {
        const newMsg = payload.new;
        if (!messages.find(m => m.id === newMsg.id)) {
          messages = [...messages, newMsg];
          setTimeout(() => messagesEnd?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  });

  function invoiceStatusBadge(s: string) {
    if (s === 'paid') return 'bg-success/10 text-success';
    if (s === 'pending' || s === 'sent') return 'bg-tertiary-container text-on-tertiary-container';
    if (s === 'overdue') return 'bg-error-container text-on-error-container';
    return 'bg-surface-container text-on-surface-variant';
  }

  function getFileIcon(name: string) {
    const ext = name?.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['zip', 'rar', '7z'].includes(ext)) return 'folder_zip';
    return 'description';
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
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
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
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
        <!-- Back link -->
        <a href="/clients" class="flex items-center gap-1.5 text-on-surface-variant mb-4 hover:text-on-surface transition-colors w-fit no-underline">
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          <span class="text-[13px] font-medium">Clients</span>
        </a>

        <!-- Client header card -->
        <div class="bg-white rounded-lg border border-outline-variant shadow-xs p-5 mb-5 flex flex-col md:flex-row items-start gap-4">
          <div class="shrink-0">
            {#if client.avatar_url}
              <img alt="Client Avatar" class="h-12 w-12 rounded-full object-cover" src={client.avatar_url}/>
            {:else}
              <div class="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">{initials(client.full_name)}</div>
            {/if}
          </div>
          <div class="flex-1 min-w-0">
            <h1 class="text-lg font-semibold text-on-surface mb-0.5">{client.full_name}</h1>
            <p class="text-sm text-on-surface-variant">{client.company || 'Independent'}</p>
            <p class="text-xs text-outline mt-1">Client since {new Date(client.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
          </div>
          <div class="flex flex-wrap gap-2 shrink-0">
            {#if hasPortalAccess}
              <span class="text-success bg-success/[0.08] px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">check_circle</span> Portal Active
              </span>
              <button class="bg-white border border-outline-variant text-on-surface px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-surface-container-low transition-colors flex items-center gap-1.5" onclick={() => openInviteModal(true)}>
                <span class="material-symbols-outlined text-[16px]">forward_to_inbox</span> Resend invite
              </button>
            {:else}
              <button class="bg-white border border-outline-variant text-on-surface px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-surface-container-low transition-colors flex items-center gap-1.5" onclick={() => openInviteModal(false)}>
                <span class="material-symbols-outlined text-[16px]">person_add</span> Invite to Portal
              </button>
            {/if}
            <button onclick={openEditModal} class="bg-white border border-outline-variant text-on-surface-variant px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-surface-container-low transition-colors flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">edit</span> Edit
            </button>
          </div>
        </div>

        <!-- Email change warning -->
        {#if editEmailChanged}
          <div class="mb-4 p-3 bg-tertiary-container/30 border border-tertiary/20 rounded-lg flex items-start gap-2 text-sm text-on-tertiary-container animate-fadeIn">
            <span class="material-symbols-outlined text-[18px] mt-0.5 shrink-0">warning</span>
            <div>
              <p class="font-medium">Portal login email not updated</p>
              <p class="text-xs mt-0.5">The portal login still uses <strong>{portalEmail}</strong>. To change it, resend the invite with the new email.</p>
              <button onclick={() => { editEmailChanged = false; openInviteModal(false); }} class="mt-1.5 text-xs font-semibold text-primary hover:underline">Resend invite with new email</button>
            </div>
            <button onclick={() => editEmailChanged = false} class="ml-auto shrink-0 text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined text-[16px]">close</span></button>
          </div>
        {/if}

        <!-- Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-lg bg-secondary/[0.08] flex items-center justify-center"><span class="material-symbols-outlined text-secondary text-[16px]">folder_open</span></div>
              <span class="text-xs text-on-surface-variant">Active Projects</span>
            </div>
            <span class="text-[15px] font-semibold text-on-surface">{activeProjectsCount}</span>
          </div>
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-lg bg-success/[0.08] flex items-center justify-center"><span class="material-symbols-outlined text-success text-[16px]">payments</span></div>
              <span class="text-xs text-on-surface-variant">Total Revenue</span>
            </div>
            <span class="text-[15px] font-semibold text-on-surface">{fmt(totalRevenue)}</span>
          </div>
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-lg bg-tertiary/[0.08] flex items-center justify-center"><span class="material-symbols-outlined text-tertiary text-[16px]">receipt_long</span></div>
              <span class="text-xs text-on-surface-variant">Pending Invoices</span>
            </div>
            <span class="text-[15px] font-semibold text-on-surface">{pendingInvoicesCount}</span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1.5 tab-strip pb-1 mb-5">
          {#each validTabs as tab}
            <button
              onclick={() => activeTab = tab}
              class="px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors {activeTab === tab ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}"
            >{tab}</button>
          {/each}
        </div>

        <!-- Tab content -->
        {#if activeTab === 'Overview'}
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start mb-8 animate-fadeIn">
            <div class="lg:col-span-4">
              <div class="bg-white rounded-lg border border-outline-variant shadow-xs p-4">
                <h3 class="text-sm font-medium text-on-surface mb-4 flex items-center gap-2">
                  <span class="material-symbols-outlined text-[18px] text-primary">contact_page</span> Contact Information
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
                      </div>
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

        {:else if activeTab === 'Projects'}
          <div class="space-y-4 animate-fadeIn">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-on-surface">Projects ({projects.length})</h3>
              <a href={`/projects?new=1&client=${clientId}`} class="bg-primary hover:bg-primary-hover text-on-primary px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5 no-underline">
                <span class="material-symbols-outlined text-[16px]">add</span> New Project
              </a>
            </div>
            {#if projects.length === 0}
              <div class="py-14 text-center border border-dashed border-outline-variant rounded-lg">
                <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">folder_off</span>
                <p class="text-sm text-on-surface-variant">No projects yet.</p>
              </div>
            {:else}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {#each projects as p (p.id)}
                  <a href={`/projects/${p.id}`} class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant hover:border-primary/30 transition-colors no-underline group">
                    <div class="flex justify-between items-start mb-2">
                      <span class="text-[11px] font-medium px-1.5 py-0.5 rounded {p.status === 'active' ? 'text-success bg-success/[0.08]' : p.status === 'completed' ? 'text-primary bg-primary/[0.08]' : 'text-on-surface-variant bg-surface-container'}">{p.status}</span>
                      <span class="material-symbols-outlined text-[16px] text-outline group-hover:text-primary">arrow_forward</span>
                    </div>
                    <h4 class="text-sm font-medium text-on-surface mb-1">{p.name}</h4>
                    <p class="text-[13px] text-on-surface-variant line-clamp-2 mb-3">{p.description || 'No description'}</p>
                    <div class="flex justify-between text-xs mb-1">
                      <span class="text-on-surface-variant">Progress</span>
                      <span class="font-medium text-primary">{p.progress}%</span>
                    </div>
                    <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div class="bg-primary h-full rounded-full" style="width: {p.progress}%;"></div>
                    </div>
                  </a>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activeTab === 'Files'}
          <div class="space-y-4 animate-fadeIn">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-on-surface">Files ({files.length})</h3>
            </div>
            {#if files.length === 0}
              <div class="py-14 text-center border border-dashed border-outline-variant rounded-lg">
                <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">description</span>
                <p class="text-sm text-on-surface-variant">No files for this client.</p>
              </div>
            {:else}
              <div class="bg-white rounded-lg border border-outline-variant shadow-xs divide-y divide-outline-variant">
                {#each files as f (f.id)}
                  <div class="flex items-center gap-3 px-4 py-3">
                    <div class="w-9 h-9 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                      <span class="material-symbols-outlined text-primary text-[18px]">{getFileIcon(f.file_name)}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-on-surface truncate">{f.file_name}</p>
                      <div class="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        {#if f.file_size}<span>{formatSize(f.file_size)}</span><span class="text-outline">·</span>{/if}
                        <span>{fmtDate(f.created_at)}</span>
                        {#if f.is_locked && !f.unlocked_at}
                          <span class="text-outline">·</span>
                          <span class="text-tertiary flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">lock</span> Locked</span>
                        {/if}
                      </div>
                    </div>
                    <button onclick={() => downloadFile(f)} class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors shrink-0" title="Download">
                      <span class="material-symbols-outlined text-[18px]">download</span>
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activeTab === 'Invoices'}
          <div class="space-y-4 animate-fadeIn">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-on-surface">Invoices ({invoices.length})</h3>
              <a href={`/invoices/create?client=${clientId}`} class="bg-primary hover:bg-primary-hover text-on-primary px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5 no-underline">
                <span class="material-symbols-outlined text-[16px]">add</span> New Invoice
              </a>
            </div>
            {#if invoices.length === 0}
              <div class="py-14 text-center border border-dashed border-outline-variant rounded-lg">
                <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">receipt_long</span>
                <p class="text-sm text-on-surface-variant">No invoices for this client.</p>
              </div>
            {:else}
              <div class="bg-white rounded-lg border border-outline-variant shadow-xs divide-y divide-outline-variant">
                {#each invoices as inv (inv.id)}
                  <div class="flex items-center gap-3 px-4 py-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-0.5">
                        <span class="text-sm font-medium text-on-surface">{inv.invoice_number || 'Draft'}</span>
                        <span class="{invoiceStatusBadge(inv.status)} px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{inv.status}</span>
                      </div>
                      <p class="text-xs text-on-surface-variant">{inv.notes || 'Invoice'} · {fmtDate(inv.created_at)}</p>
                    </div>
                    <span class="text-sm font-semibold text-on-surface whitespace-nowrap">{fmt(Number(inv.total || 0))}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activeTab === 'Messages'}
          <div class="bg-white rounded-lg border border-outline-variant shadow-xs flex flex-col animate-fadeIn" style="height: calc(100vh - 360px); min-height: 380px;">
            <div class="px-5 py-3 border-b border-outline-variant">
              <h3 class="text-sm font-medium text-on-surface">Conversation with {client.full_name}</h3>
            </div>
            <div class="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {#each messages as msg (msg.id)}
                {#if msg.sender_type === 'agency'}
                  <div class="flex justify-end"><div class="bg-primary text-on-primary px-3.5 py-2 rounded-2xl rounded-br-md max-w-[70%]"><p class="text-sm whitespace-pre-wrap">{msg.content}</p><p class="text-[10px] opacity-70 mt-1 text-right">{fmtTime(msg.created_at)}</p></div></div>
                {:else}
                  <div class="flex justify-start"><div class="bg-surface-container border border-outline-variant px-3.5 py-2 rounded-2xl rounded-bl-md max-w-[70%]"><p class="text-sm text-on-surface whitespace-pre-wrap">{msg.content}</p><p class="text-[10px] text-outline mt-1">{fmtTime(msg.created_at)}</p></div></div>
                {/if}
              {/each}
              {#if messages.length === 0}
                <div class="h-full flex flex-col items-center justify-center text-center text-on-surface-variant">
                  <span class="material-symbols-outlined text-[28px] text-outline mb-2">chat</span>
                  <p class="text-sm">No messages yet. Start the conversation.</p>
                </div>
              {/if}
              <div bind:this={messagesEnd}></div>
            </div>
            <div class="px-5 py-3 border-t border-outline-variant">
              <form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); sendClientMessage(); }}>
                <input type="text" bind:value={msgInput} placeholder="Type a message..." disabled={sendingMsg} class="flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary" />
                <button type="submit" disabled={sendingMsg || !msgInput.trim()} class="px-3 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors">
                  <span class="material-symbols-outlined text-[18px]">send</span>
                </button>
              </form>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="py-20 text-center text-on-surface-variant">Client not found or you don't have permission to view it.</div>
    {/if}
  </main>
</div>

<!-- Invite Modal -->
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
          <span class="material-symbols-outlined text-[18px]">check_circle</span><span>{inviteMsg}</span>
        </div>
        <button class="w-full bg-primary text-on-primary py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors" onclick={closeInviteModal}>Done</button>
      {:else}
        {#if inviteError}
          <div class="mb-4 p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg flex items-center gap-2 text-sm">
            <span class="material-symbols-outlined text-[18px]">error</span><span>{inviteError}</span>
          </div>
        {/if}
        <form onsubmit={sendInvite}>
          <div class="mb-4">
            <label class="block text-xs font-medium text-on-surface-variant mb-1.5" for="invite-email">Email Address</label>
            <input class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm text-on-surface" id="invite-email" type="email" bind:value={inviteEmail} disabled={inviteLoading} />
          </div>
          <button class="w-full bg-primary text-on-primary py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50" type="submit" disabled={inviteLoading}>
            {#if inviteLoading}<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Sending...{:else}{inviteIsResend ? 'Resend Invite' : 'Send Invite'}{/if}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
{/if}

<!-- Edit Client Modal -->
{#if showEditModal}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onclick={(e) => { if (e.target === e.currentTarget) showEditModal = false; }} onkeydown={(e) => { if (e.key === 'Escape') showEditModal = false; }}>
  <div class="bg-white rounded-lg shadow-lg w-full max-w-md border border-outline-variant animate-fadeIn">
    <div class="p-5">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-[15px] font-semibold text-on-surface">Edit Client</h3>
        <button class="text-on-surface-variant hover:text-on-surface w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center" onclick={() => showEditModal = false}>
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      {#if editError}
        <div class="mb-4 p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg flex items-center gap-2 text-sm">
          <span class="material-symbols-outlined text-[18px]">error</span><span>{editError}</span>
        </div>
      {/if}
      <form onsubmit={saveEdit} class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-on-surface-variant mb-1" for="edit-name">Full Name *</label>
          <input id="edit-name" bind:value={editForm.full_name} required class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label class="block text-xs font-medium text-on-surface-variant mb-1" for="edit-company">Company</label>
          <input id="edit-company" bind:value={editForm.company} class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label class="block text-xs font-medium text-on-surface-variant mb-1" for="edit-email">Email</label>
          <input id="edit-email" type="email" bind:value={editForm.email} class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-on-surface-variant mb-1" for="edit-phone">Phone</label>
            <input id="edit-phone" bind:value={editForm.phone} class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label class="block text-xs font-medium text-on-surface-variant mb-1" for="edit-status">Status</label>
            <select id="edit-status" bind:value={editForm.status} class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-on-surface-variant mb-1" for="edit-location">Location</label>
          <input id="edit-location" bind:value={editForm.location} class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
        </div>
        <div class="flex gap-3 justify-end pt-3 border-t border-outline-variant mt-4">
          <button type="button" onclick={() => showEditModal = false} class="px-4 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={editSaving} class="px-4 py-1.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50">
            {editSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
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
