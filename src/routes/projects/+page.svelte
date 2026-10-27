<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import ProjectCard, { type ProjectProps } from '$lib/components/ProjectCard.svelte';
  import { goto } from '$app/navigation';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  import { agencyDataStore } from '../../stores/agencyData';

  const tabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  let showModal = $state(false);
  let userMenuOpen = $state(false);
  let activeFilter = $state<'All' | 'Active' | 'Completed' | 'On Hold'>('All');
  let searchQuery = $state('');

  // Form fields
  let projectName = $state('');
  let clientId = $state('');
  let description = $state('');
  let deadline = $state('');
  let status = $state<'active' | 'on_hold' | 'completed'>('active');
  let progress = $state(0);
  let isSaving = $state(false);
  let errorMsg = $state('');

  let projects = $derived.by(() => {
    // Check for client query param
    const clientFilterId = $page.url.searchParams.get('client');
    if (clientFilterId) {
      return $agencyDataStore.projects.filter(p => p.client_id === clientFilterId);
    }
    return $agencyDataStore.projects;
  });

  let clients = $derived($agencyDataStore.clients);
  let loadingProjects = $derived(!$agencyDataStore.loaded);

  // Derived filtered projects list
  let filteredProjects = $derived(
    projects.filter(p => {
      // 1. Filter by status pill
      if (activeFilter === 'Active' && p.status !== 'active') return false;
      if (activeFilter === 'Completed' && p.status !== 'completed') return false;
      if (activeFilter === 'On Hold' && p.status !== 'on_hold') return false;

      // 2. Filter by search query
      const term = searchQuery.toLowerCase();
      const clientName = p.clients?.full_name || '';
      return (
        p.name?.toLowerCase().includes(term) ||
        clientName.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    })
  );

  async function handleAddProject(e: Event) {
    e.preventDefault();
    if (!projectName || !clientId) {
      errorMsg = 'Project Name and Client selection are required.';
      return;
    }
    isSaving = true;
    errorMsg = '';

    const { data, error } = await supabase
      .from('projects')
      .insert({
        agency_id: authState.agencyId,
        client_id: clientId,
        name: projectName,
        description: description,
        deadline: deadline || null,
        status: status,
        progress: progress
      })
      .select('*, clients(full_name, avatar_url, company)')
      .single();

    if (error) {
      errorMsg = error.message;
    } else if (data) {
      agencyDataStore.update(s => ({ ...s, projects: [data, ...s.projects] }));
      // Reset form
      projectName = '';
      clientId = '';
      description = '';
      deadline = '';
      status = 'active';
      progress = 0;
      showModal = false;
    }
    isSaving = false;
  }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Projects - ClientDesk</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <AgencyHeader activeTab="Projects" />

  <!-- Main Content Area -->
  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 animate-fadeIn">
      <div>
        <h1 class="text-xl font-semibold text-on-surface mb-1">Projects</h1>
        <p class="text-sm text-on-surface-variant">{projects.length} total projects</p>
      </div>
      <button
        onclick={() => showModal = true}
        class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 w-fit"
      >
        <span class="material-symbols-outlined text-[18px]">add</span>
        New Project
      </button>
    </div>

    <div class="flex flex-col md:flex-row gap-3 mb-5">
      <div class="flex gap-1.5 overflow-x-auto pb-1 md:pb-0">
        {#each ['All', 'Active', 'Completed', 'On Hold'] as filterOption}
          <button
            onclick={() => activeFilter = filterOption as any}
            class="px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors {activeFilter === filterOption ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}"
          >
            {filterOption}
          </button>
        {/each}
      </div>
      <div class="relative flex-1">
        <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
        <input
          class="w-full pl-9 pr-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-outline"
          placeholder="Search projects..."
          type="text"
          bind:value={searchQuery}
        />
      </div>
    </div>

    {#if loadingProjects}
      <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each Array(6) as _}
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex justify-between mb-2">
              <div class="h-4 animate-shimmer rounded w-14"></div>
              <div class="h-3 animate-shimmer rounded w-16"></div>
            </div>
            <div class="h-4 animate-shimmer rounded w-3/4 mb-1.5"></div>
            <div class="h-3 animate-shimmer rounded w-full mb-1"></div>
            <div class="h-3 animate-shimmer rounded w-2/3 mb-3"></div>
            <div class="h-1.5 animate-shimmer rounded-full w-full"></div>
          </div>
        {/each}
      </section>
    {:else if filteredProjects.length === 0}
      <div class="py-16 text-center border border-dashed border-outline-variant rounded-lg">
        <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">folder_off</span>
        <h3 class="text-sm font-medium text-on-surface mb-1">No projects found</h3>
        <p class="text-[13px] text-on-surface-variant">
          {#if searchQuery || activeFilter !== 'All'}
            Try adjusting your search or filters.
          {:else}
            Launch your first project to get started.
          {/if}
        </p>
      </div>
    {:else}
      <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {#each filteredProjects as project (project.id)}
          {@const mappedProject = {
            id: project.id,
            name: project.name,
            status: (project.status === 'active' ? 'Active' : project.status === 'completed' ? 'Completed' : 'On Hold') as 'Active' | 'On Hold' | 'Completed',
            clientName: project.clients?.full_name || 'Private Client',
            clientLogo: project.clients?.avatar_url || '',
            progress: project.progress || 0,
            dueDate: project.deadline ? new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Deadline',
            theme: 'primary' as any
          }}
          <ProjectCard
            project={mappedProject}
            onOpenProject={() => goto(`/projects/${project.id}`)}
          />
        {/each}
      </section>
    {/if}
  </main>
</div>

<!-- Add Project Modal -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-white w-full max-w-md rounded-lg p-5 shadow-lg border border-outline-variant mx-4 animate-fadeIn">
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-[15px] font-semibold text-on-surface">Add New Project</h3>
        <button
          class="text-on-surface-variant hover:text-on-surface w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center"
          onclick={() => showModal = false}
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {#if errorMsg}
        <div class="mb-4 p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg text-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-lg">error</span>
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form onsubmit={handleAddProject} class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="project-name">Project Name *</label>
          <input
            type="text"
            id="project-name"
            bind:value={projectName}
            placeholder="e.g. Website Redesign"
            required
            disabled={isSaving}
            class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="client-select">Select Client *</label>
          <select
            id="client-select"
            bind:value={clientId}
            required
            disabled={isSaving}
            class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface"
          >
            <option value="" disabled selected>-- Choose a Client --</option>
            {#each clients as client (client.id)}
              <option value={client.id}>{client.full_name} {client.company ? `(${client.company})` : ''}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="description">Description</label>
          <textarea
            id="description"
            bind:value={description}
            placeholder="Enter brief project scope..."
            disabled={isSaving}
            rows="3"
            class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface resize-none"
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="deadline">Deadline</label>
            <input
              type="date"
              id="deadline"
              bind:value={deadline}
              disabled={isSaving}
              class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="status">Status</label>
            <select
              id="status"
              bind:value={status}
              disabled={isSaving}
              class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface"
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="progress">Initial Progress (%)</label>
          <div class="flex items-center gap-3">
            <input
              type="range"
              id="progress"
              min="0"
              max="100"
              bind:value={progress}
              disabled={isSaving}
              class="flex-1 accent-primary"
            />
            <span class="text-sm font-medium text-on-surface w-10 text-right">{progress}%</span>
          </div>
        </div>

        <div class="flex gap-3 pt-4 border-t border-outline-variant mt-1">
          <button
            type="button"
            onclick={() => showModal = false}
            disabled={isSaving}
            class="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            class="flex-1 py-2 bg-primary text-white hover:bg-primary-hover rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {#if isSaving}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Saving...
            {:else}
              Save Project
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
