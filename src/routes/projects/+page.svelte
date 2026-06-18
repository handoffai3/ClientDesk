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
  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full">
    <!-- Hero Header -->
    <section class="rounded-xl overflow-hidden shadow-lg mb-stack-md bg-gradient-to-br from-primary to-secondary p-8 md:p-12 relative flex flex-col md:flex-row items-center justify-between gap-6 group hover:-translate-y-1 transition-transform duration-300">
      <div class="absolute inset-0 bg-white/5 opacity-50 pointer-events-none" />
      <div class="relative z-10 flex-1 w-full text-center md:text-left">
        <h1 class="font-display-lg text-display-lg text-white mb-2">Projects</h1>
        <p class="font-body-lg text-body-lg text-white/90">Manage client deliverables and progress</p>
        <div class="mt-6 inline-flex items-end gap-3 bg-white/10 backdrop-blur-md px-6 py-4 rounded-lg border border-white/20">
          <span class="font-display-lg text-display-lg text-white leading-none">{projects.length}</span>
          <span class="font-label-md text-label-md text-white/80 uppercase tracking-wider pb-1">Total Projects</span>
        </div>
      </div>
      <div class="relative z-10 w-full md:w-auto mt-6 md:mt-0 flex justify-center md:justify-end">
        <button
          onclick={() => showModal = true}
          class="bg-[#10b981] hover:bg-[#059669] text-white font-title-md text-title-md px-8 py-4 rounded-lg shadow-md transition-all duration-200 active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center"
        >
          <span class="material-symbols-outlined">add</span>
          New Project
        </button>
      </div>
    </section>

    <!-- Filters and Search -->
    <section class="flex flex-col md:flex-row gap-4 mb-stack-md">
      <!-- Filter Pills -->
      <div class="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
        {#each ['All', 'Active', 'Completed', 'On Hold'] as filterOption}
          <button
            onclick={() => activeFilter = filterOption as any}
            class="px-5 py-2.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all duration-150 focus:outline-none {activeFilter === filterOption ? 'bg-primary text-white shadow-sm' : 'bg-surface hover:bg-surface-variant text-on-surface-variant border border-outline-variant/30'}"
          >
            {filterOption}
          </button>
        {/each}
      </div>

      <!-- Search Input -->
      <div class="relative flex-1">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
        <input
          class="w-full pl-12 pr-4 py-2.5 bg-surface border border-outline-variant rounded-full font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-on-surface placeholder:text-on-surface-variant"
          placeholder="Search projects by name, description, or client..."
          type="text"
          bind:value={searchQuery}
        />
      </div>
    </section>

    <!-- Projects Grid -->
    {#if loadingProjects}
      <div class="py-20 flex justify-center items-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    {:else if filteredProjects.length === 0}
      <div class="py-20 text-center bg-surface border border-outline-variant/30 rounded-xl">
        <span class="material-symbols-outlined text-5xl text-outline-variant mb-4">folder_off</span>
        <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-1">No projects found</h3>
        <p class="font-body-md text-body-md text-on-surface-variant">
          {#if searchQuery || activeFilter !== 'All'}
            Try adjusting your search query or status filters.
          {:else}
            No projects found. Launch your first project!
          {/if}
        </p>
      </div>
    {:else}
      <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter mb-12">
        {#each filteredProjects as project (project.id)}
          {@const mappedProject = {
            id: project.id,
            name: project.name,
            status: project.status === 'active' ? 'Active' : project.status === 'completed' ? 'Completed' : 'On Hold',
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
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-surface-container-lowest w-full max-w-md rounded-2xl p-6 shadow-2xl border border-outline-variant/40 mx-4">
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-title-md text-title-md font-bold text-on-surface">Add New Project</h3>
        <button
          class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container"
          onclick={() => showModal = false}
        >
          <span class="material-symbols-outlined block">close</span>
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
            <span class="text-sm font-semibold text-on-surface w-10 text-right">{progress}%</span>
          </div>
        </div>

        <div class="flex gap-3 pt-4">
          <button
            type="button"
            onclick={() => showModal = false}
            disabled={isSaving}
            class="flex-1 py-2 rounded-lg border border-outline text-on-surface-variant hover:bg-surface-variant text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            class="flex-1 py-2 bg-primary text-white hover:bg-primary/95 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {#if isSaving}
              <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
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
