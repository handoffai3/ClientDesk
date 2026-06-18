<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';

  const navTabs = ['Dashboard', 'My Projects', 'Files', 'Invoices', 'Messages'];

  import { clientDataStore } from '../../../stores/clientData';

  let userMenuOpen = $state(false);
  let activeFolder = $state('All');

  let agencyLogo = $derived($clientDataStore.agencyLogo);
  let agencyName = $derived($clientDataStore.agencyName || 'ClientDesk');
  let files = $derived($clientDataStore.files);
  let loading = $derived(!$clientDataStore.loaded);

  let totalFilesCount = $derived(files.length);

  // Folder counts
  let folderCounts = $derived({
    'Designs': files.filter(f => f.folder === 'designs').length,
    'Contracts': files.filter(f => f.folder === 'contracts').length,
    'Invoices': files.filter(f => f.folder === 'invoices').length,
    'Reports': files.filter(f => f.folder === 'reports').length,
    'Brand Assets': files.filter(f => f.folder === 'brand_assets').length,
  });

  let filteredFiles = $derived.by(() => {
    if (activeFolder === 'All') return files;
    const folderMap: Record<string, string> = {
      'Designs': 'designs',
      'Contracts': 'contracts',
      'Invoices': 'invoices',
      'Reports': 'reports',
      'Brand Assets': 'brand_assets'
    };
    return files.filter(f => f.folder === folderMap[activeFolder]);
  });

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/client/dashboard';
    if (tab === 'My Projects') return '/client/projects';
    if (tab === 'Files') return '/client/files';
    if (tab === 'Invoices') return '/client/invoices';
    if (tab === 'Messages') return '/client/messages';
    return '/client/dashboard';
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
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
  }

  function initials(name: string | null) { return name?.substring(0, 2).toUpperCase() || 'NA'; }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/client/login');
  }
</script>

<svelte:head>
  <title>My Files - Client Portal</title>
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
            <a href={tabHref(tab)} class="relative font-label-md text-label-md transition-colors duration-150 py-5 focus:outline-none {tab === 'Files' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">{tab}</a>
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
          <h1 class="font-display-md font-bold mb-2">My Files</h1>
          <p class="font-body-md text-white/90 flex items-center gap-2">
            <span class="font-bold text-xl">{totalFilesCount}</span> Total Files
          </p>
        </div>
      </div>

      <!-- Folder Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <button
          onclick={() => activeFolder = 'All'}
          class="bg-surface rounded-xl p-4 shadow-sm border hover:-translate-y-0.5 transition-all focus:outline-none flex flex-col items-center justify-center text-center {activeFolder === 'All' ? 'border-primary shadow-md' : 'border-outline-variant/30 hover:border-primary/50'}"
        >
          <span class="material-symbols-outlined text-3xl mb-2 {activeFolder === 'All' ? 'text-primary' : 'text-on-surface-variant'}">folder_copy</span>
          <h3 class="font-label-md text-label-md font-bold text-on-surface">All Files</h3>
          <p class="text-xs text-on-surface-variant mt-1">{totalFilesCount} files</p>
        </button>

        {#each Object.entries(folderCounts) as [folderName, count]}
          {@const isActive = activeFolder === folderName}
          <button
            onclick={() => activeFolder = folderName}
            class="bg-surface rounded-xl p-4 shadow-sm border hover:-translate-y-0.5 transition-all focus:outline-none flex flex-col items-center justify-center text-center {isActive ? 'border-primary shadow-md' : 'border-outline-variant/30 hover:border-primary/50'}"
          >
            <span class="material-symbols-outlined text-3xl mb-2 {isActive ? 'text-primary' : 'text-on-surface-variant'}">folder</span>
            <h3 class="font-label-md text-label-md font-bold text-on-surface">{folderName}</h3>
            <p class="text-xs text-on-surface-variant mt-1">{count} files</p>
          </button>
        {/each}
      </div>

      <!-- Files Grid -->
      <h2 class="font-title-lg text-title-lg font-bold text-on-surface mb-4 border-b border-outline-variant/20 pb-2">
        {activeFolder} Files
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {#each filteredFiles as file (file.id)}
          {@const fType = getFileType(file.file_name)}
          {@const icon = iconConfig(fType)}
          <div class="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col hover:border-primary/40 transition-colors">
            <div class="flex items-start gap-4 mb-4">
              <div class="w-12 h-12 rounded-xl {icon.bg} {icon.text} flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-2xl">{icon.icon}</span>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-bold text-on-surface truncate mb-1" title={file.file_name}>{file.file_name}</h3>
                <p class="text-xs text-on-surface-variant">{formatSize(file.file_size)}</p>
              </div>
            </div>
            
            <div class="mt-auto border-t border-outline-variant/20 pt-3 flex items-center justify-between">
              <span class="text-xs text-outline">{fmtDate(file.created_at)}</span>
              <a href={file.file_url} target="_blank" rel="noopener noreferrer" class="text-primary hover:bg-primary-container px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors focus:outline-none">
                <span class="material-symbols-outlined text-[16px]">download</span> Download
              </a>
            </div>
          </div>
        {/each}

        {#if filteredFiles.length === 0}
          <div class="col-span-full py-16 text-center bg-surface-container-lowest rounded-xl border border-outline-variant/20">
            <span class="material-symbols-outlined text-5xl text-outline-variant mb-3 block">folder_off</span>
            <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-1">No files found</h3>
            <p class="text-sm text-on-surface-variant">
              {#if activeFolder !== 'All'}
                There are no files in the "{activeFolder}" folder.
              {:else}
                No files have been uploaded yet.
              {/if}
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>
