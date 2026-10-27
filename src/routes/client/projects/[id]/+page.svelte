<script lang="ts">
  import ClientHeader from '$lib/components/ClientHeader.svelte';
  import { apiFetch } from '$lib/apiFetch';
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ProofingCanvas from '$lib/components/ProofingCanvas.svelte';

  const projectId = $derived($page.params.id);

  let project = $state<any>(null);
  let timeline = $state<any[]>([]);
  let approvals = $state<any[]>([]);
  let milestones = $state<any[]>([]);
  let files = $state<any[]>([]);
  let messages = $state<any[]>([]);
  let loading = $state(true);
  const initialTab = $page.url.searchParams.get('tab');
  let activeTab = $state(['Overview', 'Deliverables', 'Files', 'Tasks', 'Messages'].includes(initialTab || '') ? (initialTab as string) : 'Overview');
  let tasks = $state<any[]>([]);
  let uploadingFile = $state(false);
  let payingFileId = $state<string | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let agencyName = $state('ClientDesk');
  let msgInput = $state('');
  let sendingMsg = $state(false);
  let messagesEnd: HTMLDivElement;

  // Deliverables
  let deliverables = $state<any[]>([]);
  let proofingDeliverable = $state<any>(null);
  let proofingPins = $state<any[]>([]);
  let showProofing = $state(false);

  let toastMsg = $state('');
  let toastType = $state<'success' | 'error'>('success');
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg; toastType = type; setTimeout(() => { toastMsg = ''; }, 3000);
  }

  // AI Summary
  let aiProjectSummary = $state('');
  let aiProjectSummarizing = $state(false);
  let showProjectSummary = $state(false);

  async function summarizeProject() {
    if (!project) return;
    aiProjectSummarizing = true;
    aiProjectSummary = '';
    showProjectSummary = true;
    try {
      const res = await apiFetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project',
          data: {
            projectName: project.name,
            timeline: timeline.slice(0, 10).map(t => ({ status: t.status, content: t.content })),
            milestones: milestones.map(m => ({ title: m.title, is_completed: m.is_completed, due_date: m.due_date })),
            deliverables: deliverables.map(d => ({ title: d.title, version: d.version, status: d.status })),
            recentMessages: messages.slice(-10).map(m => ({ sender_type: m.sender_type, content: m.content }))
          }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Summarization failed');
      aiProjectSummary = json.summary;
    } catch (err: any) {
      aiProjectSummary = `Error: ${err.message}`;
    } finally {
      aiProjectSummarizing = false;
    }
  }

  let dashArray = $derived(project ? `${project.progress || 0}, 100` : '0, 100');

  async function loadProject(clientId: string, agencyId: string) {
    loading = true;
    const { data: ag } = await supabase.from('agencies').select('logo_url, name').eq('id', agencyId).single();
    if (ag) { agencyName = ag.name || 'ClientDesk'; }

    const { data } = await supabase.from('projects').select('*').eq('id', projectId).eq('client_id', clientId).single();
    if (!data) { loading = false; return; }
    project = data;

    const [tlRes, apRes, msRes, flRes, msgRes, tkRes] = await Promise.all([
      supabase.from('timeline_updates').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('approvals').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('milestones').select('*').eq('project_id', projectId).order('due_date', { ascending: true }),
      supabase.from('files').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').eq('client_id', clientId).eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    ]);
    if (tkRes.data) tasks = tkRes.data;
    if (tlRes.data) timeline = tlRes.data;
    if (apRes.data) approvals = apRes.data;
    if (msRes.data) milestones = msRes.data;
    if (flRes.data) files = flRes.data;
    if (msgRes.data) messages = msgRes.data;

    // Load deliverables
    const { data: dels } = await supabase
      .from('deliverables')
      .select('*')
      .eq('project_id', projectId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (dels) deliverables = dels;

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
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, (payload: any) => {
        if (payload.eventType === 'DELETE') tasks = tasks.filter(t => t.id !== payload.old.id);
        else if (tasks.find(t => t.id === payload.new.id)) tasks = tasks.map(t => t.id === payload.new.id ? payload.new : t);
        else tasks = [payload.new, ...tasks];
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files', filter: `project_id=eq.${projectId}` }, (payload: any) => {
        if (payload.eventType === 'DELETE') files = files.filter(f => f.id !== payload.old.id);
        else if (files.find(f => f.id === payload.new.id)) files = files.map(f => f.id === payload.new.id ? payload.new : f);
        else files = [payload.new, ...files];
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  });

  function isLocked(file: any) { return file.is_locked && !file.unlocked_at; }

  async function uploadClientFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !$clientStore.client_id || !$clientStore.agency_id || !authState.user) return;
    if (file.size > 50 * 1024 * 1024) { showToast('File must be under 50MB.', 'error'); input.value = ''; return; }
    uploadingFile = true;
    const path = `client-uploads/${$clientStore.client_id}/${Date.now()}_${file.name}`;
    const { error: storageErr } = await supabase.storage.from('ClientDeskBucket').upload(path, file);
    if (storageErr) { showToast('Upload failed: ' + storageErr.message, 'error'); uploadingFile = false; input.value = ''; return; }
    const { data: urlData } = supabase.storage.from('ClientDeskBucket').getPublicUrl(path);
    const { data, error } = await supabase.from('files').insert({
      agency_id: $clientStore.agency_id,
      client_id: $clientStore.client_id,
      project_id: projectId,
      file_name: file.name,
      file_url: urlData?.publicUrl || '',
      file_size: file.size,
      file_type: file.type,
      folder: 'client_uploads',
      uploaded_by: authState.user.id,
      is_locked: false
    }).select('*').single();
    if (error) showToast('Could not save file: ' + error.message, 'error');
    else if (data) {
      if (!files.find(f => f.id === data.id)) files = [data, ...files];
      showToast('File uploaded');
    }
    uploadingFile = false;
    input.value = '';
  }

  async function payForFile(file: any) {
    if (!file.unlock_invoice_id) { goto('/client/invoices'); return; }
    payingFileId = file.id;
    try {
      const res = await apiFetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: file.unlock_invoice_id })
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      showToast('Could not create payment session.', 'error');
    } catch {
      showToast('Payment failed. Please try again.', 'error');
    }
    payingFileId = null;
  }

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
  function fileIcon(name: string) {
    const ext = name?.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return { icon: 'picture_as_pdf', bg: 'bg-red-50', text: 'text-red-500' };
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return { icon: 'image', bg: 'bg-blue-50', text: 'text-blue-500' };
    if (['zip','rar','7z'].includes(ext)) return { icon: 'folder_zip', bg: 'bg-gray-100', text: 'text-gray-500' };
    return { icon: 'description', bg: 'bg-blue-50', text: 'text-blue-600' };
  }
  function formatSize(b: number | null) { if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; }

  async function openProofing(del: any) {
    const { data: pinsData } = await supabase.from('pins').select('*').eq('deliverable_id', del.id).order('created_at', { ascending: true });
    proofingDeliverable = del;
    proofingPins = pinsData || [];
    showProofing = true;
  }

  function closeProofing() { showProofing = false; proofingDeliverable = null; proofingPins = []; }

  function handleProofingStatusChange(newStatus: string, data?: any) {
    if (proofingDeliverable) {
      deliverables = deliverables.map(d => d.id === proofingDeliverable.id ? { ...d, status: newStatus, ...(data || {}) } : d);
      proofingDeliverable = { ...proofingDeliverable, status: newStatus, ...(data || {}) };
    }
  }

  function delStatusBadge(s: string) {
    if (s === 'approved') return 'bg-[#dcfce7] text-[#166534]';
    if (s === 'changes_requested') return 'bg-[#fef3c7] text-[#b45309]';
    if (s === 'in_review') return 'bg-[#dbeafe] text-[#1e40af]';
    return 'bg-surface-variant text-on-surface-variant';
  }
  function delStatusLabel(s: string) {
    if (s === 'approved') return 'Approved';
    if (s === 'changes_requested') return 'Changes Req.';
    if (s === 'in_review') return 'In Review';
    return 'Pending';
  }

</script>

<svelte:head><title>{project?.name || 'Project'} - Client Portal</title></svelte:head>

<style>
  .gradient-hero { background: linear-gradient(135deg, #630ed4 0%, #d2bbff 100%); }
  .kanban-track { min-width: 280px; max-width: 360px; flex: 1; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <ClientHeader activeTab="My Projects" />

  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full space-y-6">
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
                onclick={summarizeProject}
                disabled={aiProjectSummarizing}
                class="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors flex items-center justify-center disabled:opacity-50"
                title="AI Project Summary"
              >
                <span class="material-symbols-outlined text-[20px] {aiProjectSummarizing ? 'animate-spin' : ''}">auto_awesome</span>
              </button>
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

      <!-- AI Summary Panel -->
      {#if showProjectSummary}
        <div class="bg-tertiary-container/30 border border-tertiary/20 rounded-xl p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <span class="material-symbols-outlined text-tertiary shrink-0 mt-0.5">auto_awesome</span>
              <div class="flex-1 min-w-0">
                <p class="font-label-md text-label-md text-tertiary mb-2">AI Project Summary</p>
                {#if aiProjectSummarizing}
                  <p class="font-body-md text-body-md text-on-surface-variant">Generating summary...</p>
                {:else}
                  <p class="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{aiProjectSummary}</p>
                {/if}
              </div>
            </div>
            <button onclick={() => { showProjectSummary = false; }} class="text-on-surface-variant hover:text-on-surface shrink-0 focus:outline-none">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
      {/if}

      <!-- Tab Pills -->
      <div class="flex space-x-2 border-b border-surface-variant overflow-x-auto no-scrollbar pb-2">
        {#each ['Overview', 'Deliverables', 'Files', 'Tasks', 'Messages'] as tab}
          <button onclick={() => activeTab = tab} class="px-4 py-2 rounded-full font-label-md text-label-md shrink-0 focus:outline-none transition-colors {activeTab === tab ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/50'}">
            {tab}
            {#if tab === 'Deliverables' && deliverables.length > 0}
              <span class="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold {activeTab === tab ? 'bg-white/20' : 'bg-primary/10 text-primary'}">{deliverables.length}</span>
            {/if}
          </button>
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

      <!-- Deliverables Tab -->
      {:else if activeTab === 'Deliverables'}
        <div class="space-y-6">
          <h3 class="font-title-md text-title-md text-on-surface">Deliverables for Review ({deliverables.length})</h3>

          {#if deliverables.length === 0}
            <div class="flex flex-col items-center justify-center py-16 border-2 border-dashed border-outline-variant/40 rounded-xl text-center">
              <span class="material-symbols-outlined text-5xl text-outline-variant mb-3">design_services</span>
              <h3 class="font-title-md text-on-surface font-semibold mb-1">No deliverables yet</h3>
              <p class="text-sm text-on-surface-variant">Your agency hasn't uploaded any deliverables for review yet.</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each deliverables as del (del.id)}
                <div class="bg-surface rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer" onclick={() => openProofing(del)}>
                  <div class="h-40 bg-surface-container-high relative overflow-hidden">
                    {#if del.file_type === 'image' && del.file_url}
                      <img src={del.thumbnail_url || del.file_url} alt={del.title} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
                        <span class="material-symbols-outlined text-5xl text-red-400">picture_as_pdf</span>
                      </div>
                    {/if}
                    <div class="absolute top-2 right-2">
                      <span class="{delStatusBadge(del.status)} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shadow-sm">{delStatusLabel(del.status)}</span>
                    </div>
                    <div class="absolute bottom-2 left-2">
                      <span class="bg-black/60 text-white px-2 py-0.5 rounded text-[10px] font-bold">v{del.version}</span>
                    </div>
                  </div>
                  <div class="p-4">
                    <h4 class="font-title-md text-on-surface truncate mb-1">{del.title}</h4>
                    {#if del.description}<p class="text-xs text-on-surface-variant truncate mb-2">{del.description}</p>{/if}
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] text-outline">{fmtDate(del.created_at)}</span>
                      <button onclick={(e) => { e.stopPropagation(); openProofing(del); }} class="text-primary hover:bg-primary/10 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors focus:outline-none">
                        <span class="material-symbols-outlined text-[16px]">rate_review</span> Review
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- Files Tab -->
      {:else if activeTab === 'Files'}
        <div class="space-y-4 animate-fadeIn">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-on-surface">Project Files ({files.length})</h3>
            <div>
              <input type="file" class="hidden" bind:this={fileInputEl} onchange={uploadClientFile} />
              <button onclick={() => fileInputEl?.click()} disabled={uploadingFile} class="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50">
                {#if uploadingFile}<div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Uploading...{:else}<span class="material-symbols-outlined text-[16px]">upload_file</span> Upload File{/if}
              </button>
            </div>
          </div>
          {#if files.length === 0}
            <div class="py-14 text-center border border-dashed border-outline-variant rounded-lg">
              <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">folder_off</span>
              <p class="text-sm font-medium text-on-surface mb-1">No files for this project</p>
              <p class="text-[13px] text-on-surface-variant">Files your agency shares appear here. You can also upload files for them.</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each files as file (file.id)}
                {@const ic = fileIcon(file.file_name)}
                {@const locked = isLocked(file)}
                <div class="bg-white rounded-lg p-4 shadow-xs border {locked ? 'border-tertiary/30' : 'border-outline-variant'} flex flex-col">
                  <div class="flex items-start gap-3 mb-3">
                    <div class="w-9 h-9 rounded-lg {ic.bg} {ic.text} flex items-center justify-center shrink-0 {locked ? 'opacity-50' : ''}"><span class="material-symbols-outlined text-[18px]">{ic.icon}</span></div>
                    <div class="flex-1 min-w-0">
                      <h4 class="text-sm font-medium text-on-surface truncate" title={file.file_name}>{file.file_name}</h4>
                      <p class="text-xs text-on-surface-variant">{formatSize(file.file_size)}{file.file_size ? ' · ' : ''}{fmtDate(file.created_at)}</p>
                      <div class="flex flex-wrap gap-1 mt-1.5">
                        {#if file.folder === 'client_uploads'}<span class="px-1.5 py-0.5 rounded bg-secondary/[0.08] text-secondary text-[10px] font-medium">Uploaded by you</span>{/if}
                        {#if locked}<span class="px-1.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container text-[10px] font-medium flex items-center gap-0.5"><span class="material-symbols-outlined text-[10px]">lock</span>{file.unlock_type === 'approval' ? 'Approval required' : 'Payment required'}</span>{/if}
                      </div>
                    </div>
                  </div>
                  <div class="mt-auto pt-3 border-t border-outline-variant flex items-center justify-end">
                    {#if locked}
                      {#if file.unlock_type === 'approval'}
                        <button onclick={() => activeTab = 'Deliverables'} class="bg-tertiary hover:opacity-90 text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">thumb_up</span> Approve to unlock</button>
                      {:else}
                        <button onclick={() => payForFile(file)} disabled={payingFileId === file.id} class="bg-primary hover:bg-primary-hover text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 disabled:opacity-50"><span class="material-symbols-outlined text-[14px]">payments</span> {payingFileId === file.id ? 'Redirecting...' : 'Pay to unlock'}</button>
                      {/if}
                    {:else}
                      <a href={file.file_url} target="_blank" rel="noopener noreferrer" download class="text-primary hover:bg-primary/[0.06] px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 no-underline"><span class="material-symbols-outlined text-[14px]">download</span> Download</a>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- Tasks Tab -->
      {:else if activeTab === 'Tasks'}
        <div class="space-y-4 animate-fadeIn">
          <h3 class="text-sm font-medium text-on-surface">Tasks ({tasks.filter(t => t.status !== 'done').length} open, {tasks.filter(t => t.status === 'done').length} done)</h3>
          {#if tasks.length === 0}
            <div class="py-14 text-center border border-dashed border-outline-variant rounded-lg">
              <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">task_alt</span>
              <p class="text-sm font-medium text-on-surface mb-1">No tasks yet</p>
              <p class="text-[13px] text-on-surface-variant">Your agency's tasks for this project will show up here.</p>
            </div>
          {:else}
            <div class="bg-white border border-outline-variant rounded-lg shadow-xs divide-y divide-outline-variant">
              {#each tasks as t (t.id)}
                <div class="flex items-start gap-3 px-4 py-3">
                  <span class="material-symbols-outlined text-[20px] mt-0.5 shrink-0 {t.status === 'done' ? 'text-success' : 'text-outline'}" style={t.status === 'done' ? "font-variation-settings: 'FILL' 1;" : ''}>{t.status === 'done' ? 'check_circle' : 'radio_button_unchecked'}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium {t.status === 'done' ? 'line-through text-on-surface-variant' : 'text-on-surface'}">{t.title}</p>
                    {#if t.description}<p class="text-[13px] text-on-surface-variant mt-0.5">{t.description}</p>{/if}
                    <div class="flex flex-wrap gap-1.5 mt-1.5">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-medium {t.priority === 'high' ? 'bg-error-container text-on-error-container' : t.priority === 'low' ? 'bg-surface-container text-on-surface-variant' : 'bg-tertiary-container text-on-tertiary-container'}">{t.priority || 'medium'}</span>
                      {#if t.category}<span class="px-1.5 py-0.5 rounded bg-primary/[0.08] text-primary text-[10px] font-medium">{t.category}</span>{/if}
                      <span class="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-medium">{t.status === 'this_week' ? 'This week' : t.status === 'done' ? 'Done' : 'Today'}</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

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

<!-- Proofing Canvas -->
{#if showProofing && proofingDeliverable}
  <ProofingCanvas
    deliverable={proofingDeliverable}
    pins={proofingPins}
    userRole="client"
    agencyId={project?.agency_id || $clientStore.agency_id || ''}
    userId={authState.user?.id || ''}
    userName={$clientStore.full_name || 'Client'}
    onClose={closeProofing}
    onStatusChange={handleProofingStatusChange}
  />
{/if}

{#if toastMsg}
  <div class="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 font-body-md text-body-md {toastType === 'success' ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'}">
    <span class="material-symbols-outlined text-lg">{toastType === 'success' ? 'check_circle' : 'error'}</span>
    {toastMsg}
  </div>
{/if}
