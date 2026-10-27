<script lang="ts">
  import NotificationBell from '$lib/components/NotificationBell.svelte';
  import { apiFetch } from '$lib/apiFetch';
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
    'My Uploads': files.filter(f => f.folder === 'client_uploads').length,
  });

  let filteredFiles = $derived.by(() => {
    if (activeFolder === 'All') return files;
    const folderMap: Record<string, string> = {
      'Designs': 'designs',
      'Contracts': 'contracts',
      'Invoices': 'invoices',
      'Reports': 'reports',
      'Brand Assets': 'brand_assets',
      'My Uploads': 'client_uploads'
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

  let toastMsg = $state('');
  let toastType = $state<'success' | 'error'>('success');

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    setTimeout(() => { toastMsg = ''; }, 3000);
  }

  function isLocked(file: any): boolean {
    return file.is_locked && !file.unlocked_at;
  }

  function goApprove(file: any) {
    goto(file.project_id ? `/client/projects/${file.project_id}?tab=Deliverables` : '/client/projects');
  }

  let payingFileId = $state<string | null>(null);
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
  <div class="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-white border-b border-outline-variant">
    <div class="flex items-center gap-8 w-full max-w-container-max mx-auto justify-between">
      <div class="flex items-center gap-8">
        <a href="/client/dashboard" class="flex items-center">
          {#if agencyLogo}
            <img src={agencyLogo} alt="{agencyName} Logo" class="h-7 max-w-[140px] object-contain" />
          {:else}
            <span class="text-[15px] font-semibold text-on-surface tracking-tight">{agencyName}</span>
          {/if}
        </a>
        <nav class="hidden md:flex gap-1">
          {#each navTabs as tab}
            <a href={tabHref(tab)} class="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors {tab === 'Files' ? 'text-primary bg-primary/[0.06]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}">{tab}</a>
          {/each}
        </nav>
      </div>
      <div class="flex items-center gap-2">
        <NotificationBell />
        <div class="relative">
          <button class="flex items-center focus:outline-none" onclick={() => userMenuOpen = !userMenuOpen}>
            <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">{initials($clientStore.full_name)}</div>
          </button>
          {#if userMenuOpen}
            <div class="absolute right-0 top-11 w-52 bg-white border border-outline-variant rounded-lg shadow-dropdown py-1 z-50 animate-fadeIn">
              <div class="px-4 py-2.5 border-b border-outline-variant">
                <p class="text-sm font-medium text-on-surface">{$clientStore.full_name || 'Client'}</p>
                <p class="text-xs text-on-surface-variant truncate mt-0.5">{authState.user?.email || ''}</p>
              </div>
              <button class="w-full text-left px-4 py-2 text-sm text-error hover:bg-error-container/30 transition-colors flex items-center gap-2" onclick={handleSignOut}>
                <span class="material-symbols-outlined text-[18px]">logout</span> Sign Out
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full">
    {#if loading}
      <div class="animate-shimmer rounded-lg h-20 mb-5"></div>
      <div class="grid grid-cols-3 lg:grid-cols-7 gap-3 mb-5">
        {#each Array(6) as _}<div class="h-20 animate-shimmer rounded-lg"></div>{/each}
      </div>
    {:else}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 animate-fadeIn">
        <div>
          <h1 class="text-xl font-semibold text-on-surface mb-1">My Files</h1>
          <p class="text-sm text-on-surface-variant">{totalFilesCount} total files</p>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        <button
          onclick={() => activeFolder = 'All'}
          class="bg-white rounded-lg p-3 shadow-xs border transition-colors focus:outline-none flex flex-col items-center justify-center text-center {activeFolder === 'All' ? 'border-primary' : 'border-outline-variant hover:border-primary/30'}"
        >
          <span class="material-symbols-outlined text-[20px] mb-1.5 {activeFolder === 'All' ? 'text-primary' : 'text-on-surface-variant'}">folder_copy</span>
          <h3 class="text-[13px] font-medium text-on-surface">All Files</h3>
          <p class="text-xs text-on-surface-variant mt-0.5">{totalFilesCount}</p>
        </button>

        {#each Object.entries(folderCounts) as [folderName, count]}
          {@const isActive = activeFolder === folderName}
          <button
            onclick={() => activeFolder = folderName}
            class="bg-white rounded-lg p-3 shadow-xs border transition-colors focus:outline-none flex flex-col items-center justify-center text-center {isActive ? 'border-primary' : 'border-outline-variant hover:border-primary/30'}"
          >
            <span class="material-symbols-outlined text-[20px] mb-1.5 {isActive ? 'text-primary' : 'text-on-surface-variant'}">folder</span>
            <h3 class="text-[13px] font-medium text-on-surface">{folderName}</h3>
            <p class="text-xs text-on-surface-variant mt-0.5">{count}</p>
          </button>
        {/each}
      </div>

      <h2 class="text-sm font-medium text-on-surface mb-3">{activeFolder} Files</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-12">
        {#each filteredFiles as file (file.id)}
          {@const fType = getFileType(file.file_name)}
          {@const icon = iconConfig(fType)}
          {@const locked = isLocked(file)}
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant flex flex-col transition-colors {locked ? 'border-[#b45309]/30' : 'hover:border-primary/30'}">
            <div class="flex items-start gap-3 mb-3">
              <div class="w-9 h-9 rounded-lg {icon.bg} {icon.text} flex items-center justify-center shrink-0 relative {locked ? 'opacity-50' : ''}">
                <span class="material-symbols-outlined text-[18px]">{icon.icon}</span>
                {#if locked}
                  <span class="absolute -top-1 -right-1 w-4 h-4 bg-[#b45309] rounded-full flex items-center justify-center">
                    <span class="material-symbols-outlined text-white text-[10px]">lock</span>
                  </span>
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-[13px] font-medium text-on-surface truncate mb-0.5" title={file.file_name}>{file.file_name}</h3>
                <p class="text-xs text-on-surface-variant">{formatSize(file.file_size)}</p>
                {#if locked}
                  <span class="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#b45309] text-[11px] font-medium">
                    <span class="material-symbols-outlined text-[10px]">lock</span>
                    {file.unlock_type === 'approval' ? 'Approval required' : 'Payment required'}
                  </span>
                {/if}
              </div>
            </div>

            <div class="mt-auto border-t border-outline-variant pt-3 flex items-center justify-between">
              <span class="text-xs text-on-surface-variant">{fmtDate(file.created_at)}</span>
              {#if locked}
                {#if file.unlock_type === 'approval'}
                  <button onclick={() => goApprove(file)} class="bg-[#b45309] hover:bg-[#92400e] text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors focus:outline-none">
                    <span class="material-symbols-outlined text-[14px]">thumb_up</span> Approve
                  </button>
                {:else}
                  <button onclick={() => payForFile(file)} disabled={payingFileId === file.id} class="bg-primary hover:bg-primary-hover text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors focus:outline-none disabled:opacity-50">
                    <span class="material-symbols-outlined text-[14px]">payments</span> {payingFileId === file.id ? 'Redirecting...' : 'Pay'}
                  </button>
                {/if}
              {:else}
                <a href={file.file_url} target="_blank" rel="noopener noreferrer" class="text-primary hover:bg-primary/[0.06] px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors focus:outline-none">
                  <span class="material-symbols-outlined text-[14px]">download</span> Download
                </a>
              {/if}
            </div>
          </div>
        {/each}

        {#if filteredFiles.length === 0}
          <div class="col-span-full py-16 text-center border border-dashed border-outline-variant rounded-lg">
            <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">folder_off</span>
            <h3 class="text-sm font-medium text-on-surface mb-1">No files found</h3>
            <p class="text-[13px] text-on-surface-variant">
              {#if activeFolder !== 'All'}
                No files in the "{activeFolder}" folder.
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

{#if toastMsg}
  <div class="fixed bottom-6 right-6 z-[200] px-4 py-2.5 rounded-lg shadow-sm border border-outline-variant flex items-center gap-2 text-sm animate-fadeIn {toastType === 'success' ? 'bg-white text-on-surface' : 'bg-error-container text-on-error-container'}">
    <span class="material-symbols-outlined text-[18px] {toastType === 'success' ? 'text-success' : ''}">{toastType === 'success' ? 'check_circle' : 'error'}</span>
    {toastMsg}
  </div>
{/if}
