<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';

  const navTabs = ['Dashboard', 'My Projects', 'Files', 'Invoices', 'Messages'];

  import { clientDataStore } from '../../../stores/clientData';

  let userMenuOpen = $state(false);

  let agencyLogo = $derived($clientDataStore.agencyLogo);
  let agencyName = $derived($clientDataStore.agencyName || 'ClientDesk');

  let activeProjects = $derived($clientDataStore.projects.filter(p => p.status === 'active'));
  let recentProject = $derived(activeProjects.length > 0 ? activeProjects[0] : null);
  let activeProjectsCount = $derived(activeProjects.length);
  let filesCount = $derived($clientDataStore.files.length);
  let recentFiles = $derived($clientDataStore.files.slice(0, 2));
  let invoices = $derived($clientDataStore.invoices);
  let pendingInvoicesCount = $derived($clientDataStore.invoices.filter(i => i.status === 'pending').length);
  let loading = $derived(!$clientDataStore.loaded);

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/client/login');
  }

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/client/dashboard';
    if (tab === 'My Projects') return '/client/projects';
    if (tab === 'Files') return '/client/files';
    if (tab === 'Invoices') return '/client/invoices';
    if (tab === 'Messages') return '/client/messages';
    return `/client/dashboard`;
  }

  function getFileType(name: string): 'pdf' | 'image' | 'zip' | 'doc' {
    const ext = name?.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
    return 'doc';
  }

  function iconConfig(type: string) {
    switch (type) {
      case 'pdf': return { icon: 'picture_as_pdf', bg: 'bg-red-50', text: 'text-red-500' };
      case 'image': return { icon: 'image', bg: 'bg-blue-50', text: 'text-blue-500' };
      case 'zip': return { icon: 'folder_zip', bg: 'bg-gray-100', text: 'text-gray-500' };
      default: return { icon: 'description', bg: 'bg-blue-50', text: 'text-blue-600' };
    }
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fmtAmt(n: number) { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'; }
  function initials(name: string | null) { return name?.substring(0, 2).toUpperCase() || 'NA'; }
</script>

<svelte:head>
  <title>Client Dashboard</title>
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
            <a href={tabHref(tab)} class="relative font-label-md text-label-md transition-colors duration-150 py-5 focus:outline-none {tab === 'Dashboard' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">{tab}</a>
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

  <!-- Main Content Area -->
  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full">
    {#if loading}
      <div class="py-20 flex justify-center items-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    {:else}
      <!-- Hero Section -->
      <div class="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between shadow-lg mb-8">
        <div>
          <h1 class="font-display-md font-bold mb-2">Welcome, {$clientStore.full_name} 👋</h1>
          <p class="font-body-md text-white/90">Here is an overview of your active engagements.</p>
        </div>
        {#if recentProject}
          <div class="mt-6 md:mt-0 bg-white/10 backdrop-blur-md rounded-xl p-6 w-full md:w-80 border border-white/20 shadow-md">
            <div class="flex justify-between items-end mb-2">
              <div>
                <span class="text-xs text-white/70 uppercase tracking-wider font-semibold block mb-1">Current Project</span>
                <h3 class="font-title-md font-bold text-white truncate max-w-[180px]">{recentProject.name}</h3>
              </div>
              <span class="font-title-lg font-bold">{recentProject.progress}%</span>
            </div>
            <div class="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div class="bg-white h-full rounded-full transition-all duration-1000" style="width: {recentProject.progress}%;"></div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-surface border border-[#bfdbfe] rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-[#2563eb] uppercase tracking-wider mb-1">Active Projects</p>
            <h4 class="font-display-sm text-display-sm font-bold text-on-surface">{activeProjectsCount}</h4>
          </div>
          <div class="w-12 h-12 rounded-full bg-[#eff6ff] text-[#2563eb] flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">folder_open</span>
          </div>
        </div>
        <div class="bg-surface border border-[#bbf7d0] rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-[#16a34a] uppercase tracking-wider mb-1">Files Uploaded</p>
            <h4 class="font-display-sm text-display-sm font-bold text-on-surface">{filesCount}</h4>
          </div>
          <div class="w-12 h-12 rounded-full bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">description</span>
          </div>
        </div>
        <div class="bg-surface border border-[#fed7aa] rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-[#ea580c] uppercase tracking-wider mb-1">Pending Invoices</p>
            <h4 class="font-display-sm text-display-sm font-bold text-on-surface">{pendingInvoicesCount}</h4>
          </div>
          <div class="w-12 h-12 rounded-full bg-[#fff7ed] text-[#ea580c] flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
        </div>
      </div>

      <!-- 3 Columns Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <!-- Column 1: My Projects -->
        <div class="space-y-4">
          <h2 class="font-title-lg text-title-lg text-on-surface border-b border-outline-variant/30 pb-2 mb-4">My Projects</h2>
          {#each activeProjects as project}
            <div class="bg-surface rounded-xl p-5 shadow-sm border border-outline-variant/30 hover:border-primary/40 transition-colors">
              <div class="flex justify-between items-start mb-3">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider {project.progress > 0 ? 'bg-[#eff6ff] text-[#2563eb]' : 'bg-surface-variant text-on-surface-variant'}">
                  {project.progress > 0 ? 'In Progress' : 'Planning'}
                </span>
                {#if project.deadline}
                  <span class="text-xs text-outline font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">event</span> {fmtDate(project.deadline)}</span>
                {/if}
              </div>
              <h3 class="font-title-md text-title-md font-bold text-on-surface mb-1">{project.name}</h3>
              <p class="text-sm text-on-surface-variant mb-4 line-clamp-2">{project.description || 'No description provided.'}</p>
              <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mt-auto">
                <div class="bg-primary h-full rounded-full transition-all" style="width: {project.progress}%;"></div>
              </div>
              <div class="text-right mt-1 text-xs font-semibold text-primary">{project.progress}%</div>
            </div>
          {/each}
          {#if activeProjects.length === 0}
            <div class="text-center p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm">
              No active projects at the moment.
            </div>
          {/if}
        </div>

        <!-- Column 2: Recent Files -->
        <div class="space-y-4">
          <h2 class="font-title-lg text-title-lg text-on-surface border-b border-outline-variant/30 pb-2 mb-4">Recent Files</h2>
          {#each recentFiles as file}
            {@const fType = getFileType(file.file_name)}
            {@const icon = iconConfig(fType)}
            <div class="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant/30 flex items-center gap-4 hover:border-primary/40 transition-colors">
              <div class="w-12 h-12 rounded-xl {icon.bg} {icon.text} flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-2xl">{icon.icon}</span>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-title-md text-sm font-bold text-on-surface truncate mb-0.5">{file.file_name}</h3>
                <div class="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span>{formatSize(file.file_size)}</span>
                  <span>•</span>
                  <span>{fmtDate(file.created_at)}</span>
                </div>
              </div>
              <a href={file.file_url} target="_blank" rel="noopener noreferrer" class="w-8 h-8 rounded-full hover:bg-primary-container text-primary flex items-center justify-center transition-colors focus:outline-none shrink-0" title="Download">
                <span class="material-symbols-outlined text-[20px]">download</span>
              </a>
            </div>
          {/each}
          {#if recentFiles.length === 0}
            <div class="text-center p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm">
              No recent files uploaded.
            </div>
          {/if}
        </div>

        <!-- Column 3: Invoices -->
        <div class="space-y-4">
          <h2 class="font-title-lg text-title-lg text-on-surface border-b border-outline-variant/30 pb-2 mb-4">Invoices</h2>
          {#each invoices as invoice}
            <div class="bg-surface rounded-xl p-5 shadow-sm border border-outline-variant/30 hover:border-primary/40 transition-colors flex flex-col">
              <div class="flex justify-between items-start mb-3">
                {#if invoice.status === 'pending' || invoice.status === 'overdue'}
                  <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#fff7ed] text-[#ea580c] flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">schedule</span> Pending
                  </span>
                {:else}
                  <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#f0fdf4] text-[#16a34a] flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">check_circle</span> Paid
                  </span>
                {/if}
                <span class="font-label-sm text-xs font-semibold text-outline">{invoice.invoice_number}</span>
              </div>
              
              <div class="mb-4">
                <p class="text-sm text-on-surface-variant truncate mb-1">{invoice.notes || 'Invoice for Services'}</p>
                <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface">{fmtAmt(invoice.total)}</h3>
                {#if invoice.status === 'pending' && invoice.due_date}
                  <p class="text-xs text-error mt-1">Due {fmtDate(invoice.due_date)}</p>
                {:else}
                  <p class="text-xs text-outline mt-1">Issued {fmtDate(invoice.created_at)}</p>
                {/if}
              </div>

              <div class="mt-auto">
                {#if invoice.status === 'pending' || invoice.status === 'overdue'}
                  <button class="w-full bg-primary hover:bg-primary/90 text-white font-label-md py-2.5 rounded-lg shadow-sm transition-colors text-sm font-bold focus:outline-none">
                    Pay Now
                  </button>
                {:else}
                  <button class="w-full bg-surface-variant hover:bg-outline-variant text-on-surface-variant font-label-md py-2.5 rounded-lg transition-colors text-sm font-bold focus:outline-none flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">download</span> Download PDF
                  </button>
                {/if}
              </div>
            </div>
          {/each}
          {#if invoices.length === 0}
            <div class="text-center p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm">
              No invoices available.
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </main>
</div>
