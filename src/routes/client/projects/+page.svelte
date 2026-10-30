<script lang="ts">
  import ClientHeader from '$lib/components/ClientHeader.svelte';
  import { clientStore } from '$lib/clientStore';

  import { clientDataStore } from '../../../stores/clientData';

  let activeFilter = $state('all');

  let projects = $derived($clientDataStore.projects);
  let loading = $derived(!$clientDataStore.loaded);

  let filteredProjects = $derived.by(() => {
    if (activeFilter === 'all') return projects;
    const statusMap: Record<string, string> = {
      'active': 'active',
      'completed': 'completed',
      'on_hold': 'on_hold'
    };
    return projects.filter(p => p.status === statusMap[activeFilter]);
  });

  let activeCount = $derived(projects.filter(p => p.status === 'active').length);

  function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
  }

  function statusBadge(status: string) {
    if (status === 'active') return { label: 'In Progress', cls: 'bg-[#eff6ff] text-[#2563eb]' };
    if (status === 'completed') return { label: 'Completed', cls: 'bg-[#f0fdf4] text-[#16a34a]' };
    return { label: 'On Hold', cls: 'bg-[#fff7ed] text-[#ea580c]' };
  }

  function borderColor(status: string) {
    if (status === 'active') return 'border-t-[#7C3AED]';
    if (status === 'completed') return 'border-t-[#16a34a]';
    return 'border-t-[#ea580c]';
  }

</script>

<svelte:head>
  <title>My Projects - Client Portal</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <ClientHeader activeTab="My Projects" />

  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full">
    {#if loading}
      <div class="py-20 flex justify-center items-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
    {:else}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 animate-fadeIn pt-1">
        <div>
          <h1 class="text-xl font-semibold text-on-surface mb-1">My Projects</h1>
          <p class="text-sm text-on-surface-variant">{activeCount} active {activeCount === 1 ? 'project' : 'projects'}</p>
        </div>
      </div>

      <div class="flex space-x-2 tab-strip pb-2 mb-5">
        {#each [
          { key: 'all', label: 'All' },
          { key: 'active', label: 'In Progress' },
          { key: 'completed', label: 'Completed' },
          { key: 'on_hold', label: 'On Hold' }
        ] as filter}
          <button
            class="px-5 py-2.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all duration-150 focus:outline-none {activeFilter === filter.key ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/30'}"
            onclick={() => activeFilter = filter.key}
          >
            {filter.label}
          </button>
        {/each}
      </div>

      <!-- Project Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {#each filteredProjects as project (project.id)}
          {@const badge = statusBadge(project.status)}
          <a href="/client/projects/{project.id}" class="bg-surface rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-t-4 {borderColor(project.status)} no-underline block cursor-pointer group">
            <div class="p-6">
              <div class="flex justify-between items-start mb-4">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider {badge.cls}">
                  {badge.label}
                </span>
                {#if project.deadline}
                  <span class="text-xs text-outline font-medium flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">event</span>
                    {fmtDate(project.deadline)}
                  </span>
                {/if}
              </div>

              <h3 class="font-title-md text-title-md font-bold text-on-surface mb-2 group-hover:text-primary transition-colors">{project.name}</h3>
              <p class="text-sm text-on-surface-variant mb-5 line-clamp-2">{project.description || 'No description provided.'}</p>

              <div class="mb-1">
                <div class="flex justify-between items-center mb-1.5">
                  <span class="text-xs text-on-surface-variant font-medium">Progress</span>
                  <span class="text-xs font-bold text-primary">{project.progress || 0}%</span>
                </div>
                <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div class="bg-primary h-full rounded-full transition-all duration-500" style="width: {project.progress || 0}%;"></div>
                </div>
              </div>
            </div>
          </a>
        {/each}

        {#if filteredProjects.length === 0}
          <div class="col-span-full py-16 text-center bg-surface-container-lowest rounded-xl border border-outline-variant/20">
            <span class="material-symbols-outlined text-5xl text-outline-variant mb-3 block">folder_off</span>
            <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-1">No projects found</h3>
            <p class="text-sm text-on-surface-variant">
              {#if activeFilter !== 'all'}
                Try selecting a different filter.
              {:else}
                You don't have any projects yet.
              {/if}
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>
