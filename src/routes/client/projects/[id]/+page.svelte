<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  const navTabs = ['Dashboard', 'My Projects', 'Files', 'Invoices', 'Messages'];
  const projectId = $derived($page.params.id);

  let project = $state<any>(null);
  let timeline = $state<any[]>([]);
  let approvals = $state<any[]>([]);
  let milestones = $state<any[]>([]);
  let files = $state<any[]>([]);
  let messages = $state<any[]>([]);
  let loading = $state(true);
  let activeTab = $state('Overview');
  let userMenuOpen = $state(false);
  let agencyLogo = $state('');
  let agencyName = $state('ClientDesk');
  let msgInput = $state('');
  let sendingMsg = $state(false);
  let messagesEnd: HTMLDivElement;

  let dashArray = $derived(project ? `${project.progress || 0}, 100` : '0, 100');

  async function loadProject(clientId: string, agencyId: string) {
    loading = true;
    const { data: ag } = await supabase.from('agencies').select('logo_url, name').eq('id', agencyId).single();
    if (ag) { agencyLogo = ag.logo_url || ''; agencyName = ag.name || 'ClientDesk'; }

    const { data } = await supabase.from('projects').select('*').eq('id', projectId).eq('client_id', clientId).single();
    if (!data) { loading = false; return; }
    project = data;

    const [tlRes, apRes, msRes, flRes, msgRes] = await Promise.all([
      supabase.from('timeline_updates').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('approvals').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('milestones').select('*').eq('project_id', projectId).order('due_date', { ascending: true }),
      supabase.from('files').select('*').eq('project_id', projectId).eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').eq('client_id', clientId).eq('project_id', projectId).order('created_at', { ascending: true })
    ]);
    if (tlRes.data) timeline = tlRes.data;
    if (apRes.data) approvals = apRes.data;
    if (msRes.data) milestones = msRes.data;
    if (flRes.data) files = flRes.data;
    if (msgRes.data) messages = msgRes.data;
    loading = false;
    setTimeout(() => messagesEnd?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  let dataLoaded = false;
  $effect(() => {
    if (!dataLoaded && !authState.loading && $clientStore.client_id && $clientStore.agency_id && projectId) {
      dataLoaded = true;
      loadProject($clientStore.client_id, $clientStore.agency_id);
    }
  });

  async function manualReload() {
    if (!$clientStore.client_id || !$clientStore.agency_id) return;
    dataLoaded = false;
    await loadProject($clientStore.client_id, $clientStore.agency_id);
  }

  onMount(() => {
    const channel = supabase.channel('client-proj-msgs-' + projectId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` }, (payload: any) => {
        const newMsg = payload.new;
        if (!messages.find(m => m.id === newMsg.id)) {
          messages = [...messages, newMsg];
          setTimeout(() => messagesEnd?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  });

  async function sendMessage() {
    if (!msgInput.trim() || !$clientStore.client_id || !$clientStore.agency_id) return;
    sendingMsg = true;
    const { data } = await supabase.from('messages').insert({
      agency_id: $clientStore.agency_id, client_id: $clientStore.client_id, project_id: projectId,
      sender_type: 'client', sender_id: authState.user?.id, content: msgInput
    }).select('*').single();
    if (data && !messages.find(m => m.id === data.id)) messages = [...messages, data];
    msgInput = '';
    sendingMsg = false;
    setTimeout(() => messagesEnd?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function handleApproval(id: string, newStatus: 'approved' | 'changes_requested') {
    await supabase.from('approvals').update({ status: newStatus, reviewed_at: new Date().toISOString() }).eq('id', id);
    approvals = approvals.map(a => a.id === id ? { ...a, status: newStatus } : a);
  }

  function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'; }
  function fmtTime(d: string) { return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
  function initials(n: string | null) { return n?.substring(0, 2).toUpperCase() || 'NA'; }
  function isTomorrow(ds: string) { const d = new Date(ds); const t = new Date(); t.setDate(t.getDate() + 1); return d.toDateString() === t.toDateString(); }
  function tabHref(tab: string) { if (tab === 'Dashboard') return '/client/dashboard'; if (tab === 'My Projects') return '/client/projects'; if (tab === 'Files') return '/client/files'; if (tab === 'Invoices') return '/client/invoices'; if (tab === 'Messages') return '/client/messages'; return '/client/dashboard'; }

  function fileIcon(name: string) {
    const ext = name?.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return { icon: 'picture_as_pdf', bg: 'bg-red-50', text: 'text-red-500' };
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return { icon: 'image', bg: 'bg-blue-50', text: 'text-blue-500' };
    if (['zip','rar','7z'].includes(ext)) return { icon: 'folder_zip', bg: 'bg-gray-100', text: 'text-gray-500' };
    return { icon: 'description', bg: 'bg-blue-50', text: 'text-blue-600' };
  }
  function formatSize(b: number | null) { if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; }

  async function handleSignOut() { userMenuOpen = false; await supabase.auth.signOut(); goto('/client/login'); }
</script>

<svelte:head><title>{project?.name || 'Project'} - Client Portal</title></svelte:head>

<style>
  .gradient-hero { background: linear-gradient(135deg, #630ed4 0%, #d2bbff 100%); }
  .kanban-track { min-width: 280px; max-width: 360px; flex: 1; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <!-- Top Nav -->
  <div class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
    <div class="flex items-center gap-8 w-full max-w-container-max mx-auto justify-between">
      <div class="flex items-center gap-8">
        <a href="/client/dashboard" class="flex items-center">
          {#if agencyLogo}<img src={agencyLogo} alt="{agencyName}" class="h-8 max-w-[150px] object-contain" />
          {:else}<span class="font-headline-md text-headline-md font-bold text-primary">{agencyName}</span>{/if}
        </a>
        <nav class="hidden md:flex gap-8">
          {#each navTabs as tab}
            <a href={tabHref(tab)} class="relative font-label-md text-label-md transition-colors duration-150 py-5 focus:outline-none {tab === 'My Projects' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">{tab}</a>
          {/each}
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <div class="relative">
          <button class="bg-primary-container text-on-primary-container w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center font-bold text-xs focus:outline-none" onclick={() => userMenuOpen = !userMenuOpen}>{initials($clientStore.full_name)}</button>
          {#if userMenuOpen}
            <div class="absolute right-0 top-10 w-48 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg py-2 z-50">
              <div class="px-4 py-2 border-b border-outline-variant/30"><p class="text-xs font-semibold">{$clientStore.full_name || 'Client'}</p><p class="text-[10px] text-outline truncate">{authState.user?.email}</p></div>
              <hr class="border-outline-variant/30 my-1" />
              <button class="w-full text-left px-4 py-2 text-xs text-error hover:bg-error-container/20 flex items-center gap-2" onclick={handleSignOut}><span class="material-symbols-outlined text-sm">logout</span> Sign Out</button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full space-y-6">
    {#if loading}
      <div class="py-20 flex justify-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
    {:else if !project}
      <div class="py-20 text-center"><span class="material-symbols-outlined text-5xl text-outline-variant mb-3 block">block</span><h3 class="font-title-md text-on-surface font-semibold">Project not found or access denied.</h3></div>
    {:else}
      <!-- Breadcrumb -->
      <a href="/client/projects" class="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors text-sm"><span class="material-symbols-outlined text-[20px]">arrow_back</span> Back to Projects</a>

      <!-- Hero -->
      <div class="gradient-hero rounded-xl p-6 md:p-10 text-on-primary relative overflow-hidden">
        <div class="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div class="space-y-3">
            <span class="bg-secondary text-on-secondary px-3 py-1 rounded-full font-label-md text-label-md uppercase">{project.status === 'active' ? 'Active' : project.status === 'completed' ? 'Completed' : 'On Hold'}</span>
            <div class="flex items-center gap-4">
              <h2 class="font-display-lg text-headline-lg md:text-display-lg tracking-tight">{project.name}</h2>
              <button
                onclick={manualReload}
                disabled={loading}
                class="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors flex items-center justify-center disabled:opacity-50"
                title="Reload data"
              >
                <span class="material-symbols-outlined text-[20px] {loading ? 'animate-spin' : ''}">refresh</span>
              </button>
            </div>
            {#if project.description}<p class="font-body-md text-white/80 max-w-xl">{project.description}</p>{/if}
          </div>
          <div class="flex items-center gap-4 bg-surface/10 backdrop-blur-md p-4 rounded-lg border border-white/20 shrink-0">
            <div class="w-16 h-16 rounded-full border-4 border-primary-fixed-dim flex items-center justify-center relative">
              <svg class="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path class="text-white/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>
                <path class="text-white" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray={dashArray} stroke-linecap="round" stroke-width="3"></path>
              </svg>
              <span class="font-title-md font-bold z-10">{project.progress || 0}%</span>
            </div>
            <div class="flex flex-col"><span class="font-label-md text-primary-fixed-dim uppercase tracking-wider">Completion</span><span class="font-body-md">{project.progress >= 100 ? 'Done' : project.progress >= 50 ? 'On Track' : 'In Progress'}</span></div>
          </div>
        </div>
      </div>

      <!-- Tab Pills -->
      <div class="flex space-x-2 border-b border-surface-variant overflow-x-auto no-scrollbar pb-2">
        {#each ['Overview', 'Files', 'Tasks', 'Messages'] as tab}
          <button onclick={() => activeTab = tab} class="px-4 py-2 rounded-full font-label-md text-label-md shrink-0 focus:outline-none transition-colors {activeTab === tab ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/50'}">{tab}</button>
        {/each}
      </div>

      <!-- Overview Tab -->
      {#if activeTab === 'Overview'}
        <div class="flex overflow-x-auto gap-gutter pb-8 no-scrollbar items-start min-h-[400px]">
          <!-- Timeline -->
          <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl">
            <h3 class="font-title-md text-on-surface px-1 mb-2">Timeline</h3>
            {#if timeline.length === 0}<p class="text-sm text-on-surface-variant text-center py-4">No updates yet.</p>{/if}
            {#each timeline as item (item.id)}
              <div class="bg-surface rounded-lg p-4 shadow-sm border border-transparent hover:border-outline-variant/50">
                <div class="flex items-start gap-3">
                  <div class="bg-surface-container-high p-2 rounded-full shrink-0 mt-1">
                    {#if item.status === 'completed'}<span class="material-symbols-outlined text-[#10b981] text-[20px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                    {:else if item.status === 'in_progress'}<span class="material-symbols-outlined text-[#f59e0b] text-[20px]" style="font-variation-settings: 'FILL' 1;">pending</span>
                    {:else}<span class="material-symbols-outlined text-outline-variant text-[20px]">radio_button_unchecked</span>{/if}
                  </div>
                  <div><p class="font-body-md text-on-surface">{item.content}</p><p class="font-label-md text-[11px] text-outline mt-2 uppercase">{fmtDate(item.created_at)}</p></div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Approvals -->
          <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl border-l-4 border-error/50">
            <div class="flex items-center gap-2 px-1 mb-2">
              <h3 class="font-title-md text-on-surface">Approvals</h3>
              {#if approvals.filter(a => a.status === 'pending').length > 0}<span class="bg-error-container text-on-error-container px-2 py-0.5 rounded-full text-[10px] font-bold">{approvals.filter(a => a.status === 'pending').length} Pending</span>{/if}
            </div>
            {#if approvals.length === 0}<p class="text-sm text-on-surface-variant text-center py-4">No approvals yet.</p>{/if}
            {#each approvals as item (item.id)}
              <div class="bg-surface rounded-lg shadow-sm overflow-hidden border border-transparent hover:border-outline-variant/50">
                {#if item.image_url}<div class="h-32 bg-surface-variant w-full"><img alt="Preview" class="w-full h-full object-cover" src={item.image_url} /></div>{/if}
                <div class="p-4">
                  <div class="flex items-center justify-between mb-1">
                    <h4 class="font-body-md font-semibold text-on-surface">{item.title}</h4>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold {item.status === 'approved' ? 'bg-[#10b981]/10 text-[#059669]' : item.status === 'changes_requested' ? 'bg-tertiary-container/10 text-tertiary-container' : 'bg-error-container/30 text-error'}">{item.status === 'approved' ? 'Approved' : item.status === 'changes_requested' ? 'Changes Req.' : 'Pending'}</span>
                  </div>
                  {#if item.description}<p class="text-[13px] text-on-surface-variant mb-4">{item.description}</p>{/if}
                  {#if item.status === 'pending'}
                    <div class="flex gap-2">
                      <button onclick={() => handleApproval(item.id, 'changes_requested')} class="flex-1 bg-surface-container-high hover:bg-surface-variant text-on-surface px-3 py-2 rounded-lg text-label-md transition-colors border border-outline-variant/30 focus:outline-none">Changes</button>
                      <button onclick={() => handleApproval(item.id, 'approved')} class="flex-1 bg-primary text-on-primary hover:bg-primary/90 px-3 py-2 rounded-lg text-label-md transition-colors shadow-sm focus:outline-none">Approve</button>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

          <!-- Milestones -->
          <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl">
            <div class="flex justify-between items-center px-1 mb-2"><h3 class="font-title-md text-on-surface">Milestones</h3><span class="material-symbols-outlined text-on-surface-variant">calendar_month</span></div>
            {#if milestones.length === 0}<p class="text-sm text-on-surface-variant text-center py-4">No milestones yet.</p>{/if}
            {#each milestones as ms (ms.id)}
              <div class="bg-surface rounded-lg p-4 shadow-sm border border-transparent hover:border-outline-variant/50 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-1 h-full {ms.due_date && isTomorrow(ms.due_date) ? 'bg-tertiary-container' : ms.is_completed ? 'bg-[#10b981]' : 'bg-outline-variant'}"></div>
                <div class="flex justify-between items-start mb-3">
                  {#if ms.due_date && isTomorrow(ms.due_date)}<span class="bg-tertiary-container text-on-tertiary-container px-2 py-1 rounded text-[10px] uppercase font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">schedule</span> TOMORROW</span>
                  {:else if ms.is_completed}<span class="bg-[#10b981]/10 text-[#059669] px-2 py-1 rounded text-[10px] uppercase font-bold">COMPLETED</span>
                  {:else}<span class="text-outline text-[11px] uppercase tracking-wider font-semibold">{ms.due_date ? fmtDate(ms.due_date) : 'No date'}</span>{/if}
                </div>
                <h4 class="font-body-md font-semibold text-on-surface mb-1">{ms.title}</h4>
                {#if ms.description}<p class="text-[13px] text-on-surface-variant">{ms.description}</p>{/if}
              </div>
            {/each}
          </div>
        </div>

      <!-- Files Tab -->
      {:else if activeTab === 'Files'}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each files as file (file.id)}
            {@const ic = fileIcon(file.file_name)}
            <div class="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant/30 flex items-center gap-4 hover:border-primary/40 transition-colors">
              <div class="w-12 h-12 rounded-xl {ic.bg} {ic.text} flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-2xl">{ic.icon}</span></div>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-bold text-on-surface truncate mb-0.5">{file.file_name}</h3>
                <div class="flex items-center gap-2 text-xs text-on-surface-variant"><span>{formatSize(file.file_size)}</span><span>•</span><span>{fmtDate(file.created_at)}</span></div>
              </div>
              <a href={file.file_url} target="_blank" rel="noopener noreferrer" class="w-9 h-9 rounded-full hover:bg-primary-container text-primary flex items-center justify-center transition-colors shrink-0" title="Download"><span class="material-symbols-outlined text-[20px]">download</span></a>
            </div>
          {/each}
          {#if files.length === 0}<div class="col-span-full py-12 text-center text-on-surface-variant bg-surface rounded-xl border border-outline-variant/20"><span class="material-symbols-outlined text-4xl text-outline-variant mb-2 block">folder_off</span>No files for this project.</div>{/if}
        </div>

      <!-- Tasks Tab (placeholder) -->
      {:else if activeTab === 'Tasks'}
        <div class="py-20 text-center bg-surface border border-outline-variant/30 rounded-xl"><span class="material-symbols-outlined text-5xl text-outline-variant mb-4 block">construction</span><h3 class="font-title-md text-on-surface font-semibold mb-1">Tasks — Coming Soon</h3><p class="text-sm text-on-surface-variant">Task visibility for clients is under development.</p></div>

      <!-- Messages Tab -->
      {:else if activeTab === 'Messages'}
        <div class="bg-surface rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col" style="height: calc(100vh - 380px); min-height: 400px;">
          <div class="px-6 py-4 border-b border-outline-variant/20"><h3 class="font-title-md text-on-surface font-bold">Project Messages</h3></div>
          <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {#each messages as msg (msg.id)}
              {#if msg.sender_type === 'client'}
                <div class="flex justify-end"><div class="bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[70%] shadow-sm"><p class="text-sm">{msg.content}</p><p class="text-[10px] text-white/60 mt-1 text-right">{fmtTime(msg.created_at)}</p></div></div>
              {:else}
                <div class="flex justify-start"><div class="bg-surface-container border border-outline-variant/30 px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[70%]"><p class="text-sm text-on-surface">{msg.content}</p><p class="text-[10px] text-outline mt-1">{fmtTime(msg.created_at)}</p></div></div>
              {/if}
            {/each}
            {#if messages.length === 0}<div class="flex-1 flex items-center justify-center text-on-surface-variant text-sm">No messages yet. Start the conversation!</div>{/if}
            <div bind:this={messagesEnd}></div>
          </div>
          <div class="px-6 py-4 border-t border-outline-variant/20">
            <form class="flex gap-3" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
              <input type="text" bind:value={msgInput} placeholder="Type a message..." disabled={sendingMsg} class="flex-1 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:outline-none focus:border-primary" />
              <button type="submit" disabled={sendingMsg || !msgInput.trim()} class="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-label-md shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none"><span class="material-symbols-outlined text-[18px]">send</span></button>
            </form>
          </div>
        </div>
      {/if}
    {/if}
  </main>
</div>
