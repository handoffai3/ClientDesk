<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  const tabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  let project = $state<any>(null);
  let timeline = $state<any[]>([]);
  let approvals = $state<any[]>([]);
  let milestones = $state<any[]>([]);
  let loading = $state(true);
  let activeTab = $state('Overview');
  let userMenuOpen = $state(false);

  // Post Update form
  let showUpdateForm = $state(false);
  let updateContent = $state('');
  let updateStatus = $state<'completed' | 'in_progress' | 'pending'>('in_progress');
  let postingUpdate = $state(false);

  // Add Approval modal
  let showApprovalModal = $state(false);
  let newApprovalTitle = $state('');
  let newApprovalDesc = $state('');
  let newApprovalImage = $state('');
  let submittingApproval = $state(false);

  // Add Milestone modal
  let showMilestoneModal = $state(false);
  let newMilestoneTitle = $state('');
  let newMilestoneDesc = $state('');
  let newMilestoneDue = $state('');
  let submittingMilestone = $state(false);

  const projectId = $derived($page.params.id);

  // Circle progress
  let dashArray = $derived(project ? `${project.progress || 0}, 100` : '0, 100');

  async function loadProject() {
    loading = true;
    const { data } = await supabase
      .from('projects')
      .select('*, clients(full_name, avatar_url, company)')
      .eq('id', projectId)
      .single();
    if (data) project = data;

    // Load timeline
    const { data: tl } = await supabase
      .from('timeline_updates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (tl) timeline = tl;

    // Load approvals
    const { data: ap } = await supabase
      .from('approvals')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (ap) approvals = ap;

    // Load milestones
    const { data: ms } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true });
    if (ms) milestones = ms;

    loading = false;
  }

  let dataLoaded = false;
  $effect(() => {
    if (projectId && !authState.loading && !dataLoaded) {
      dataLoaded = true;
      loadProject();
    }
  });

  async function manualReload() {
    dataLoaded = false; // allow reload
    await loadProject();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isTomorrow(dateStr: string) {
    const d = new Date(dateStr);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d.toDateString() === tomorrow.toDateString();
  }

  function statusDisplay(s: string) {
    if (s === 'active') return 'Active';
    if (s === 'completed') return 'Completed';
    return 'On Hold';
  }

  async function postTimelineUpdate() {
    if (!updateContent.trim()) return;
    postingUpdate = true;
    const { data, error } = await supabase
      .from('timeline_updates')
      .insert({
        project_id: projectId,
        posted_by: authState.user?.id || null,
        content: updateContent,
        status: updateStatus
      })
      .select('*')
      .single();
    if (data) {
      timeline = [data, ...timeline];
      updateContent = '';
      updateStatus = 'in_progress';
      showUpdateForm = false;
    }
    postingUpdate = false;
  }

  async function handleApproval(id: string, newStatus: 'approved' | 'changes_requested') {
    const { error } = await supabase
      .from('approvals')
      .update({ status: newStatus, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      approvals = approvals.map(a => a.id === id ? { ...a, status: newStatus } : a);
    }
  }

  async function createApproval() {
    if (!newApprovalTitle.trim()) return;
    submittingApproval = true;
    const { data, error } = await supabase
      .from('approvals')
      .insert({
        project_id: projectId,
        title: newApprovalTitle,
        description: newApprovalDesc || null,
        image_url: newApprovalImage || null,
        status: 'pending'
      })
      .select('*')
      .single();
    if (data) {
      approvals = [data, ...approvals];
      newApprovalTitle = '';
      newApprovalDesc = '';
      newApprovalImage = '';
      showApprovalModal = false;
    }
    submittingApproval = false;
  }

  async function createMilestone() {
    if (!newMilestoneTitle.trim()) return;
    submittingMilestone = true;
    const { data, error } = await supabase
      .from('milestones')
      .insert({
        project_id: projectId,
        title: newMilestoneTitle,
        description: newMilestoneDesc || null,
        due_date: newMilestoneDue || null,
        is_completed: false
      })
      .select('*')
      .single();
    if (data) {
      milestones = [...milestones, data];
      newMilestoneTitle = '';
      newMilestoneDesc = '';
      newMilestoneDue = '';
      showMilestoneModal = false;
    }
    submittingMilestone = false;
  }

  async function deleteApproval(id: string) {
    if (!confirm('Are you sure you want to delete this approval?')) return;
    const { error } = await supabase.from('approvals').delete().eq('id', id);
    if (!error) {
      approvals = approvals.filter(a => a.id !== id);
    }
  }

  async function deleteMilestone(id: string) {
    if (!confirm('Are you sure you want to delete this milestone?')) return;
    const { error } = await supabase.from('milestones').delete().eq('id', id);
    if (!error) {
      milestones = milestones.filter(m => m.id !== id);
    }
  }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/login');
  }
</script>

<svelte:head>
  <title>{project?.name || 'Project'} - ClientDesk</title>
</svelte:head>

<style>
  .gradient-hero { background: linear-gradient(135deg, #630ed4 0%, #d2bbff 100%); }
  .shadow-level-2 { box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.05); }
  .kanban-track { min-width: 280px; max-width: 360px; flex: 1; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <!-- Top Navigation -->
  <div class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
    <div class="flex items-center gap-8 w-full max-w-container-max mx-auto justify-between">
      <div class="flex items-center gap-8">
        <a href="/" class="font-headline-md text-headline-md font-bold text-primary">
          {authState.agencyName || 'ClientDesk'}
        </a>
        <nav class="hidden md:flex gap-8">
          {#each tabs as tab}
            <a
              href={tab === 'Projects' ? '/projects' : tab === 'Clients' ? '/clients' : tab === 'Files' ? '/files' : tab === 'Invoices' ? '/invoices' : tab === 'Messages' ? '/messages' : tab === 'Dashboard' ? '/' : `/?tab=${tab}`}
              class="relative font-label-md text-label-md transition-colors duration-150 py-5 focus:outline-none {tab === 'Projects' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}"
            >
              {tab}
            </a>
          {/each}
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <a href="/settings" class="text-on-surface-variant hover:text-primary transition-colors duration-150 p-1 rounded-full hover:bg-surface-container">
          <span class="material-symbols-outlined block">settings</span>
        </a>
        <div class="relative">
          <button class="flex items-center active:scale-95 transition-transform duration-150 focus:outline-none" onclick={() => userMenuOpen = !userMenuOpen}>
            <img alt="User avatar" class="w-8 h-8 rounded-full border border-outline-variant object-cover hover:border-primary transition-colors" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxwSVvb_fIogrcoBmjb3RFOseMlp7ZlQW5UR7wn7k2TUPqho3kL_wgmKdxfNfbmBZt0_3NI5wgM0D3ouDRj8e9hVeue2XIB77dY5A0onBiPzeaW2r20LW-VONp7JXcwEyqaXtMu6Pn8RqtTfWRwGhHPxBM7_JP3p7JqUqtGW7hAxADfGOI2ViGlUKPcWLkm6P-5y5tMJK4EuXoQRCbpAKVxw57QJdS7TzGXoyCMfB5RekZGyw_bQKaip-8KAkeZeLxB-qA8R_LlLEE" />
          </button>
          {#if userMenuOpen}
            <div class="absolute right-0 top-10 w-48 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg py-2 z-50">
              <div class="px-4 py-2 border-b border-outline-variant/30">
                <p class="text-xs font-semibold text-on-surface">{authState.userFullName || 'User'}</p>
                <p class="text-[10px] text-outline truncate">{authState.user?.email || ''}</p>
              </div>
              <hr class="border-outline-variant/30 my-1" />
              <button class="w-full text-left px-4 py-2 text-xs text-error hover:bg-error-container/20 transition-colors flex items-center gap-2" onclick={handleSignOut}>
                <span class="material-symbols-outlined text-sm">logout</span> Sign Out
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full space-y-stack-md">
    {#if loading}
      <div class="py-20 flex justify-center items-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
    {:else if !project}
      <div class="py-20 text-center"><h3 class="font-title-md text-title-md text-on-surface">Project not found</h3></div>
    {:else}
      <!-- Breadcrumb -->
      <div class="flex items-center gap-2 text-on-surface-variant">
        <a href="/projects" class="flex items-center gap-1 hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-[20px]">arrow_back</span>
          <span class="font-body-md text-body-md font-medium">Back to Projects</span>
        </a>
      </div>

      <!-- Hero Card -->
      <div class="gradient-hero rounded-xl p-6 md:p-10 shadow-level-2 text-on-primary relative overflow-hidden">
        <div class="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <span class="bg-secondary text-on-secondary px-3 py-1 rounded-full font-label-md text-label-md uppercase">{statusDisplay(project.status)}</span>
              <span class="bg-surface/20 backdrop-blur-sm text-on-primary px-3 py-1 rounded-full font-label-md text-label-md border border-white/20 uppercase">
                {project.deadline ? `DUE ${formatDate(project.deadline)}` : 'NO DEADLINE'}
              </span>
            </div>
            <div>
              <div class="flex items-center gap-4">
                <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-primary mb-1 tracking-tight">{project.name}</h2>
                <button
                  onclick={manualReload}
                  disabled={loading}
                  class="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors flex items-center justify-center disabled:opacity-50"
                  title="Reload data"
                >
                  <span class="material-symbols-outlined text-[20px] {loading ? 'animate-spin' : ''}">refresh</span>
                </button>
              </div>
              <p class="font-title-md text-title-md text-primary-fixed-dim opacity-90">Client: {project.clients?.full_name || 'Unknown'}</p>
            </div>
            {#if project.description}
              <p class="font-body-md text-body-md text-white/80 max-w-xl">{project.description}</p>
            {/if}
          </div>
          <div class="flex items-center gap-4 bg-surface/10 backdrop-blur-md p-4 rounded-lg border border-white/20 shrink-0">
            <div class="w-16 h-16 rounded-full border-4 border-primary-fixed-dim flex items-center justify-center relative">
              <svg class="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path class="text-white/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>
                <path class="text-white" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray={dashArray} stroke-linecap="round" stroke-width="3"></path>
              </svg>
              <span class="font-title-md text-title-md font-bold z-10">{project.progress || 0}%</span>
            </div>
            <div class="flex flex-col">
              <span class="font-label-md text-label-md text-primary-fixed-dim uppercase tracking-wider">Completion</span>
              <span class="font-body-md text-body-md">{project.progress >= 100 ? 'Done' : project.progress >= 50 ? 'On Track' : 'In Progress'}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Pills -->
      <div class="flex space-x-2 border-b border-surface-variant overflow-x-auto no-scrollbar pb-2">
        {#each ['Overview', 'Files', 'Tasks', 'Messages'] as tab}
          <button
            onclick={() => activeTab = tab}
            class="px-4 py-2 rounded-full font-label-md text-label-md shrink-0 focus:outline-none transition-colors {activeTab === tab ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/50'}"
          >
            {tab}
          </button>
        {/each}
      </div>

      <!-- Overview Tab Content -->
      {#if activeTab === 'Overview'}
        <div class="flex overflow-x-auto gap-gutter pb-8 no-scrollbar items-start min-h-[400px]">
          <!-- Column 1: Timeline -->
          <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl">
            <div class="flex justify-between items-center mb-2 px-1">
              <h3 class="font-title-md text-title-md text-on-surface">Timeline</h3>
              <button class="text-on-surface-variant hover:text-primary focus:outline-none" onclick={() => showUpdateForm = !showUpdateForm}>
                <span class="material-symbols-outlined">{showUpdateForm ? 'close' : 'add'}</span>
              </button>
            </div>

            <!-- Post Update Form -->
            {#if showUpdateForm}
              <div class="bg-surface rounded-lg p-4 shadow-level-2 border border-primary/30 space-y-3">
                <textarea
                  bind:value={updateContent}
                  placeholder="What's the update?"
                  rows="2"
                  disabled={postingUpdate}
                  class="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                ></textarea>
                <select
                  bind:value={updateStatus}
                  disabled={postingUpdate}
                  class="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending">Pending</option>
                </select>
                <button
                  onclick={postTimelineUpdate}
                  disabled={postingUpdate || !updateContent.trim()}
                  class="w-full py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {#if postingUpdate}
                    <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Posting...
                  {:else}
                    Post Update
                  {/if}
                </button>
              </div>
            {/if}

            {#if timeline.length === 0}
              <p class="text-sm text-on-surface-variant text-center py-4">No updates yet.</p>
            {/if}

            {#each timeline as item (item.id)}
              <div class="bg-surface rounded-lg p-4 shadow-level-2 cursor-pointer border border-transparent hover:border-outline-variant/50">
                <div class="flex items-start gap-3">
                  <div class="bg-surface-container-high p-2 rounded-full shrink-0 mt-1">
                    {#if item.status === 'completed'}
                      <span class="material-symbols-outlined text-[#10b981] text-[20px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                    {:else if item.status === 'in_progress'}
                      <span class="material-symbols-outlined text-[#f59e0b] text-[20px]" style="font-variation-settings: 'FILL' 1;">pending</span>
                    {:else}
                      <span class="material-symbols-outlined text-outline-variant text-[20px]">radio_button_unchecked</span>
                    {/if}
                  </div>
                  <div>
                    <p class="font-body-md text-body-md text-on-surface">{item.content}</p>
                    <p class="font-label-md text-[11px] text-outline mt-2 uppercase">
                      {formatDate(item.created_at)} • {item.status === 'completed' ? 'Completed' : item.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Column 2: Approvals -->
          <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl border-l-4 border-error/50">
            <div class="flex justify-between items-center mb-2 px-1">
              <div class="flex items-center gap-2">
                <h3 class="font-title-md text-title-md text-on-surface">Approvals</h3>
                {#if approvals.filter(a => a.status === 'pending').length > 0}
                  <span class="bg-error-container text-on-error-container px-2 py-0.5 rounded-full font-label-md text-[10px]">{approvals.filter(a => a.status === 'pending').length} Pending</span>
                {/if}
              </div>
              <button class="flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none" onclick={() => showApprovalModal = true}>
                <span class="material-symbols-outlined text-[16px]">add</span> Add Approval
              </button>
            </div>

            {#if approvals.length === 0}
              <div class="flex flex-col items-center justify-center py-8 border-2 border-dashed border-outline-variant/40 rounded-xl text-outline-variant text-center px-4">
                <span class="material-symbols-outlined text-3xl mb-2">approval</span>
                <p class="text-xs font-semibold mb-1">No approvals yet</p>
                <p class="text-[10px] text-outline mb-3">Create one for client review.</p>
                <button
                  class="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1 focus:outline-none"
                  onclick={() => showApprovalModal = true}
                >
                  <span class="material-symbols-outlined text-[16px]">add</span> Add Approval
                </button>
              </div>
            {/if}

            {#each approvals as item (item.id)}
              <div class="bg-surface rounded-lg shadow-level-2 overflow-hidden border border-transparent hover:border-outline-variant/50">
                {#if item.image_url}
                  <div class="h-32 bg-surface-variant w-full relative group">
                    <img alt="Approval preview" class="w-full h-full object-cover" src={item.image_url} />
                  </div>
                {/if}
                <div class="p-4">
                  <div class="flex items-start justify-between mb-1 gap-2">
                    <div class="flex flex-col gap-1">
                      <h4 class="font-body-md text-body-md font-semibold text-on-surface">{item.title}</h4>
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded-full font-label-md text-[10px] {item.status === 'approved' ? 'bg-[#10b981]/10 text-[#059669]' : item.status === 'changes_requested' ? 'bg-tertiary-container/10 text-tertiary-container' : 'bg-error-container/30 text-error'}">
                          {item.status === 'approved' ? 'Approved' : item.status === 'changes_requested' ? 'Changes Req.' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    <button class="text-outline-variant hover:text-error transition-colors focus:outline-none p-1 rounded hover:bg-error-container/20 shrink-0" onclick={() => deleteApproval(item.id)} title="Delete Approval">
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                  {#if item.description}
                    <p class="font-body-md text-[13px] text-on-surface-variant mb-3">{item.description}</p>
                  {/if}
                  {#if item.status === 'pending'}
                    <div class="flex items-center gap-2 text-[11px] text-outline mt-1">
                      <span class="material-symbols-outlined text-[14px]">hourglass_top</span>
                      Waiting for client review
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

          <!-- Column 3: Milestones -->
          <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl">
            <div class="flex justify-between items-center mb-2 px-1">
              <h3 class="font-title-md text-title-md text-on-surface">Milestones</h3>
              <button class="flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none" onclick={() => showMilestoneModal = true}>
                <span class="material-symbols-outlined text-[16px]">add</span> Add Milestone
              </button>
            </div>

            {#if milestones.length === 0}
              <div class="flex flex-col items-center justify-center py-8 border-2 border-dashed border-outline-variant/40 rounded-xl text-outline-variant text-center px-4">
                <span class="material-symbols-outlined text-3xl mb-2">flag</span>
                <p class="text-xs font-semibold mb-1">No milestones yet</p>
                <p class="text-[10px] text-outline mb-3">Track project progress with milestones.</p>
                <button
                  class="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1 focus:outline-none"
                  onclick={() => showMilestoneModal = true}
                >
                  <span class="material-symbols-outlined text-[16px]">add</span> Add Milestone
                </button>
              </div>
            {/if}

            {#each milestones as ms (ms.id)}
              <div class="bg-surface rounded-lg p-4 shadow-level-2 cursor-pointer border border-transparent hover:border-outline-variant/50 relative overflow-hidden group">
                <div class="absolute top-0 left-0 w-1 h-full {ms.due_date && isTomorrow(ms.due_date) ? 'bg-tertiary-container' : ms.is_completed ? 'bg-[#10b981]' : 'bg-outline-variant'}"></div>
                
                <button class="absolute top-2 right-2 text-outline-variant hover:text-error transition-colors focus:outline-none p-1 rounded hover:bg-error-container/20 opacity-0 group-hover:opacity-100" onclick={() => deleteMilestone(ms.id)} title="Delete Milestone">
                  <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>

                <div class="flex justify-between items-start mb-3 pr-6">
                  {#if ms.due_date && isTomorrow(ms.due_date)}
                    <span class="bg-tertiary-container text-on-tertiary-container px-2 py-1 rounded font-label-md text-[10px] tracking-widest uppercase font-bold flex items-center gap-1">
                      <span class="material-symbols-outlined text-[12px]">schedule</span> TOMORROW
                    </span>
                  {:else if ms.is_completed}
                    <span class="bg-[#10b981]/10 text-[#059669] px-2 py-1 rounded font-label-md text-[10px] tracking-widest uppercase font-bold">COMPLETED</span>
                  {:else}
                    <span class="text-outline font-label-md text-[11px] uppercase tracking-wider font-semibold">
                      {ms.due_date ? formatDate(ms.due_date) : 'No date'}
                    </span>
                  {/if}
                </div>
                <h4 class="font-body-md text-body-md font-semibold text-on-surface mb-1">{ms.title}</h4>
                {#if ms.description}
                  <p class="font-body-md text-[13px] text-on-surface-variant">{ms.description}</p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <!-- Placeholder for other tabs -->
        <div class="py-20 text-center bg-surface border border-outline-variant/30 rounded-xl">
          <span class="material-symbols-outlined text-5xl text-outline-variant mb-4">construction</span>
          <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-1">{activeTab} — Coming Soon</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">This section is under development.</p>
        </div>
      {/if}
    {/if}
  </main>
<!-- Add Approval Modal -->
{#if showApprovalModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
      <div class="flex justify-between items-center px-6 py-4 border-b border-outline-variant/20">
        <h3 class="font-title-md text-title-md font-bold text-on-surface">Add Approval</h3>
        <button class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container focus:outline-none" onclick={() => showApprovalModal = false}>
          <span class="material-symbols-outlined block">close</span>
        </button>
      </div>
      <form
        onsubmit={(e) => { e.preventDefault(); createApproval(); }}
        class="p-6 space-y-4"
      >
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="approval-title">Title *</label>
          <input type="text" id="approval-title" bind:value={newApprovalTitle} required placeholder="e.g. Homepage Design v2" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="approval-desc">Description</label>
          <textarea id="approval-desc" bind:value={newApprovalDesc} rows="2" placeholder="What needs to be reviewed?" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="approval-img">Image URL (optional)</label>
          <input type="url" id="approval-img" bind:value={newApprovalImage} placeholder="https://example.com/preview.png" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
        </div>
        <div class="flex gap-3 justify-end pt-4 border-t border-outline-variant/30">
          <button type="button" class="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg" onclick={() => showApprovalModal = false}>Cancel</button>
          <button type="submit" disabled={submittingApproval || !newApprovalTitle.trim()} class="px-5 py-2 text-sm font-semibold text-on-primary bg-primary hover:bg-primary/90 rounded-lg shadow-md disabled:opacity-50 flex items-center gap-2">
            {#if submittingApproval}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {/if}
            Create Approval
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Add Milestone Modal -->
{#if showMilestoneModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
      <div class="flex justify-between items-center px-6 py-4 border-b border-outline-variant/20">
        <h3 class="font-title-md text-title-md font-bold text-on-surface">Add Milestone</h3>
        <button class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container focus:outline-none" onclick={() => showMilestoneModal = false}>
          <span class="material-symbols-outlined block">close</span>
        </button>
      </div>
      <form
        onsubmit={(e) => { e.preventDefault(); createMilestone(); }}
        class="p-6 space-y-4"
      >
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="ms-title">Title *</label>
          <input type="text" id="ms-title" bind:value={newMilestoneTitle} required placeholder="e.g. Phase 1 Delivery" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="ms-desc">Description</label>
          <textarea id="ms-desc" bind:value={newMilestoneDesc} rows="2" placeholder="What does this milestone include?" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="ms-due">Due Date</label>
          <input type="date" id="ms-due" bind:value={newMilestoneDue} class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
        </div>
        <div class="flex gap-3 justify-end pt-4 border-t border-outline-variant/30">
          <button type="button" class="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg" onclick={() => showMilestoneModal = false}>Cancel</button>
          <button type="submit" disabled={submittingMilestone || !newMilestoneTitle.trim()} class="px-5 py-2 text-sm font-semibold text-on-primary bg-primary hover:bg-primary/90 rounded-lg shadow-md disabled:opacity-50 flex items-center gap-2">
            {#if submittingMilestone}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {/if}
            Create Milestone
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

</div>
