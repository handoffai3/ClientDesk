<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';

  const navTabs = ['Dashboard', 'My Projects', 'Files', 'Invoices', 'Messages'];

  import { clientDataStore } from '../../../stores/clientData';

  let userMenuOpen = $state(false);
  let activeFilter = $state('all');

  let agencyLogo = $derived($clientDataStore.agencyLogo);
  let agencyName = $derived($clientDataStore.agencyName || 'ClientDesk');
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

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/client/dashboard';
    if (tab === 'My Projects') return '/client/projects';
    if (tab === 'Files') return '/client/files';
    if (tab === 'Invoices') return '/client/invoices';
    if (tab === 'Messages') return '/client/messages';
    return '/client/dashboard';
  }

  function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
  }

  function initials(name: string | null) { return name?.substring(0, 2).toUpperCase() || 'NA'; }

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

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/client/login');
  }
</script>

<svelte:head>
  <title>My Projects - Client Portal</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <!-- Top Nav -->
  <div class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
    <div class="flex items-center gap-8 w-full max-w-container-max mx-auto justify-between">
      <div class="flex items-center gap-8">
        <a href="/client/dashboard" class="flex items-center">
          {#if agencyLogo}
            <img src={agencyLogo} alt="{agencyName} Logo" class="h-8 max-w-[150px] object-contain" />
          {:else}
            <span class="font-headline-md text-headline-md font-bold text-primary">{agencyName}</span>
          {/if}
        </a>
        <nav class="hidden md:flex gap-8">
          {#each navTabs as tab}
            <a href={tabHref(tab)} class="relative font-label-md text-label-md transition-colors duration-150 py-5 focus:outline-none {tab === 'My Projects' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">{tab}</a>
          {/each}
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <div class="relative">
          <button class="flex items-center active:scale-95 transition-transform duration-150 focus:outline-none bg-primary-container text-on-primary-container w-8 h-8 rounded-full border border-outline-variant justify-center font-bold text-xs" onclick={() => userMenuOpen = !userMenuOpen}>
            {initials($clientStore.full_name)}
          </button>
          {#if userMenuOpen}
            <div class="absolute right-0 top-10 w-48 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg py-2 z-50">
              <div class="px-4 py-2 border-b border-outline-variant/30">
                <p class="text-xs font-semibold text-on-surface">{$clientStore.full_name || 'Client'}</p>
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

  <!-- Main -->
  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full">
    {#if loading}
      <div class="py-20 flex justify-center items-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
    {:else}
      <!-- Hero -->
      <div class="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between shadow-lg mb-8 relative overflow-hidden">
        <div class="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        <div class="relative z-10">
          <h1 class="font-display-md font-bold mb-2">My Projects</h1>
          <p class="font-body-md text-white/90 flex items-center gap-2">
            <span class="font-bold text-xl">{activeCount}</span> Active Projects
          </p>
        </div>
        <div class="relative z-10 mt-4 md:mt-0 bg-white/10 backdrop-blur-md rounded-xl px-6 py-3 border border-white/20">
          <span class="text-sm text-white/80">{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      <!-- Filter Pills -->
      <div class="flex space-x-2 overflow-x-auto pb-2 mb-8">
        {#each [
          { key: 'all', label: 'All' },
          { key: 'active', label: 'In Progress' },
          { key: 'completed', label: 'Completed' },
          { key: 'on_hold', label: 'On Hold' }
        ] as filter}
          <button
            class="px-5 py-2.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all duration-150 focus:outline-none {activeFilter === filter.key ? 'bg-primary text-white shadow-sm' : 'bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/30'}"
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
          <div class="bg-surface rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-t-4 {borderColor(project.status)}">
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

              <h3 class="font-title-md text-title-md font-bold text-on-surface mb-2">{project.name}</h3>
              <p class="text-sm text-on-surface-variant mb-5 line-clamp-2">{project.description || 'No description provided.'}</p>

              <!-- Progress Bar -->
              <div class="mb-4">
                <div class="flex justify-between items-center mb-1.5">
                  <span class="text-xs text-on-surface-variant font-medium">Progress</span>
                  <span class="text-xs font-bold text-primary">{project.progress || 0}%</span>
                </div>
                <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div class="bg-primary h-full rounded-full transition-all duration-500" style="width: {project.progress || 0}%;"></div>
                </div>
              </div>

              <a href="/client/projects/{project.id}" class="w-full bg-primary hover:bg-primary/90 text-white font-label-md text-label-md py-2.5 rounded-lg shadow-sm transition-colors focus:outline-none flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[18px]">open_in_new</span> Open
              </a>
            </div>
          </div>
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
