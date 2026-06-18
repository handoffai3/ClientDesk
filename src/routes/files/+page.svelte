<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  const navTabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];
  const folderOptions = ['designs', 'contracts', 'invoices', 'reports', 'brand_assets'] as const;
  const folderLabels: Record<string, string> = {
    designs: 'Designs', contracts: 'Contracts', invoices: 'Invoices',
    reports: 'Reports', brand_assets: 'Brand Assets'
  };
  const folderIcons: Record<string, string> = {
    designs: 'palette', contracts: 'gavel', invoices: 'receipt_long',
    reports: 'analytics', brand_assets: 'branding_watermark'
  };

  import { agencyDataStore } from '../../stores/agencyData';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  let files = $derived.by(() => {
    const clientFilterId = $page.url.searchParams.get('client');
    if (clientFilterId) {
      return $agencyDataStore.files.filter(f => f.client_id === clientFilterId);
    }
    return $agencyDataStore.files;
  });

  let projects = $derived($agencyDataStore.projects);
  let loadingFiles = $derived(!$agencyDataStore.loaded);
  let activeFolder = $state<string | null>(null);
  let userMenuOpen = $state(false);

  // Upload modal
  let showUpload = $state(false);
  let uploadFile = $state<File | null>(null);
  let uploadFolder = $state<string>('designs');
  let uploadProjectId = $state('');
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let uploadError = $state('');

  // Derived
  let filteredFiles = $derived(
    activeFolder ? files.filter(f => f.folder === activeFolder) : files
  );

  function folderCount(folder: string) {
    return files.filter(f => f.folder === folder).length;
  }

  function getFileType(name: string): 'pdf' | 'image' | 'zip' | 'doc' {
    const ext = name.split('.').pop()?.toLowerCase() || '';
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
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }



  async function handleUpload(e: Event) {
    e.preventDefault();
    if (!uploadFile) { uploadError = 'Please select a file.'; return; }
    uploading = true;
    uploadError = '';
    uploadProgress = 10;

    const fileName = `${authState.agencyId}/${Date.now()}_${uploadFile.name}`;
    uploadProgress = 30;

    const { data: storageData, error: storageErr } = await supabase.storage
      .from('ClientDeskBucket')
      .upload(fileName, uploadFile);

    if (storageErr) {
      console.error("Supabase Storage Upload Error Details:", storageErr);
      uploadError = `Storage Error: ${storageErr.message}`;
      uploading = false;
      return;
    }
    uploadProgress = 70;

    const { data: urlData } = supabase.storage.from('ClientDeskBucket').getPublicUrl(fileName);
    const fileUrl = urlData?.publicUrl || '';

    const { data: row, error: dbErr } = await supabase
      .from('files')
      .insert({
        agency_id: authState.agencyId,
        file_name: uploadFile.name,
        file_url: fileUrl,
        file_size: uploadFile.size,
        file_type: uploadFile.type,
        folder: uploadFolder,
        project_id: uploadProjectId || null,
        uploaded_by: authState.user?.id || null
      })
      .select('*')
      .single();

    if (dbErr) {
      console.error("Supabase DB Insert Error Details:", dbErr);
      uploadError = `Database Error: ${dbErr.message}`;
    } else if (row) {
      agencyDataStore.update(s => ({ ...s, files: [row, ...s.files] }));
      uploadFile = null;
      uploadFolder = 'designs';
      uploadProjectId = '';
      showUpload = false;
    }
    uploadProgress = 100;
    uploading = false;
  }

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/';
    if (tab === 'Projects') return '/projects';
    if (tab === 'Clients') return '/clients';
    if (tab === 'Files') return '/files';
    if (tab === 'Invoices') return '/invoices';
    if (tab === 'Messages') return '/messages';
    return `/?tab=${tab}`;
  }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Files - ClientDesk</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <AgencyHeader activeTab="Files" />

  <!-- Main -->
  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full">
    <!-- Hero -->
    <section class="rounded-xl overflow-hidden shadow-lg mb-stack-md bg-gradient-to-br from-primary to-secondary p-8 md:p-12 relative flex flex-col md:flex-row items-center justify-between gap-6 group hover:-translate-y-1 transition-transform duration-300">
      <div class="absolute inset-0 bg-white/5 opacity-50 pointer-events-none" />
      <div class="relative z-10 flex-1 w-full text-center md:text-left">
        <h1 class="font-display-lg text-display-lg text-white mb-2">Files</h1>
        <p class="font-body-lg text-body-lg text-white/90">Manage all your project assets and documents</p>
        <div class="mt-6 inline-flex items-end gap-3 bg-white/10 backdrop-blur-md px-6 py-4 rounded-lg border border-white/20">
          <span class="font-display-lg text-display-lg text-white leading-none">{files.length}</span>
          <span class="font-label-md text-label-md text-white/80 uppercase tracking-wider pb-1">Total Files</span>
        </div>
      </div>
      <div class="relative z-10 w-full md:w-auto mt-6 md:mt-0 flex justify-center md:justify-end">
        <button onclick={() => showUpload = true} class="bg-[#10b981] hover:bg-[#059669] text-white font-title-md text-title-md px-8 py-4 rounded-lg shadow-md transition-all duration-200 active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center">
          <span class="material-symbols-outlined">upload_file</span> Upload File
        </button>
      </div>
    </section>

    <!-- Folder Cards -->
    <section class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-stack-md">
      {#each folderOptions as folder}
        <button
          onclick={() => activeFolder = activeFolder === folder ? null : folder}
          class="p-4 rounded-xl border transition-all duration-200 text-center hover:-translate-y-1 focus:outline-none {activeFolder === folder ? 'bg-primary text-white border-primary shadow-lg' : 'bg-surface border-outline-variant/30 hover:border-primary/50 hover:shadow-md'}"
        >
          <span class="material-symbols-outlined text-3xl mb-2 {activeFolder === folder ? 'text-white' : 'text-primary'}" style="font-variation-settings: 'FILL' 1;">{folderIcons[folder]}</span>
          <p class="font-title-md text-title-md font-semibold {activeFolder === folder ? '' : 'text-on-surface'}">{folderLabels[folder]}</p>
          <p class="font-label-md text-label-md mt-1 {activeFolder === folder ? 'text-white/80' : 'text-on-surface-variant'}">{folderCount(folder)} files</p>
        </button>
      {/each}
    </section>

    <!-- Active folder indicator -->
    {#if activeFolder}
      <div class="mb-4 flex items-center gap-2">
        <span class="font-body-md text-body-md text-on-surface-variant">Showing:</span>
        <span class="bg-primary/10 text-primary px-3 py-1 rounded-full font-label-md text-label-md font-semibold">{folderLabels[activeFolder]}</span>
        <button onclick={() => activeFolder = null} class="text-on-surface-variant hover:text-error ml-1 focus:outline-none"><span class="material-symbols-outlined text-sm">close</span></button>
      </div>
    {/if}

    <!-- Files Grid -->
    {#if loadingFiles}
      <div class="py-20 flex justify-center items-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
    {:else if filteredFiles.length === 0}
      <div class="py-20 text-center bg-surface border border-outline-variant/30 rounded-xl">
        <span class="material-symbols-outlined text-5xl text-outline-variant mb-4">folder_off</span>
        <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-1">No files found</h3>
        <p class="font-body-md text-body-md text-on-surface-variant">
          {#if activeFolder}Try a different folder or upload a new file.{:else}Upload your first file to get started!{/if}
        </p>
      </div>
    {:else}
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter mb-12">
        {#each filteredFiles as f (f.id)}
          {@const ft = getFileType(f.file_name)}
          {@const ic = iconConfig(ft)}
          <div class="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0px_10px_25px_rgba(0,0,0,0.08)] transition-all flex flex-col h-full group">
            <div class="flex items-start justify-between mb-4">
              <div class="w-10 h-10 rounded {ic.bg} flex items-center justify-center {ic.text}">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">{ic.icon}</span>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant font-label-md text-[10px] uppercase">{folderLabels[f.folder] || f.folder}</span>
            </div>
            <h4 class="font-title-md text-title-md text-on-surface mb-1 truncate" title={f.file_name}>{f.file_name}</h4>
            <p class="font-body-md text-body-md text-on-surface-variant mb-4">{formatSize(f.file_size)} • {new Date(f.created_at).toLocaleDateString()}</p>
            <div class="mt-auto flex items-center justify-between border-t border-outline-variant/20 pt-4">
              <div class="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
                <span class="material-symbols-outlined text-sm">person</span>
                <span>Uploader</span>
              </div>
              <a href={f.file_url} target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 border border-primary text-primary rounded-lg font-label-md text-label-md hover:bg-primary/5 transition-colors flex items-center gap-1 focus:outline-none">
                <span class="material-symbols-outlined text-[16px]">download</span> Download
              </a>
            </div>
          </div>
        {/each}
      </section>
    {/if}
  </main>
</div>

<!-- Upload Modal -->
{#if showUpload}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-surface-container-lowest w-full max-w-md rounded-2xl p-6 shadow-2xl border border-outline-variant/40 mx-4">
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-title-md text-title-md font-bold text-on-surface">Upload File</h3>
        <button class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container" onclick={() => showUpload = false}>
          <span class="material-symbols-outlined block">close</span>
        </button>
      </div>

      {#if uploadError}
        <div class="mb-4 p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg text-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-lg">error</span><span>{uploadError}</span>
        </div>
      {/if}

      <form onsubmit={handleUpload} class="space-y-4">
        <!-- File Picker -->
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="file-pick">Select File *</label>
          <div class="relative">
            <input
              type="file"
              id="file-pick"
              disabled={uploading}
              onchange={(e) => { const t = e.target as HTMLInputElement; if (t.files?.[0]) uploadFile = t.files[0]; }}
              class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
          </div>
          {#if uploadFile}
            <p class="text-xs text-on-surface-variant mt-1">{uploadFile.name} ({formatSize(uploadFile.size)})</p>
          {/if}
        </div>

        <!-- Folder -->
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="upload-folder">Folder *</label>
          <select id="upload-folder" bind:value={uploadFolder} disabled={uploading} class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
            {#each folderOptions as folder}
              <option value={folder}>{folderLabels[folder]}</option>
            {/each}
          </select>
        </div>

        <!-- Project (optional) -->
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="upload-project">Project (optional)</label>
          <select id="upload-project" bind:value={uploadProjectId} disabled={uploading} class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
            <option value="">-- None --</option>
            {#each projects as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        </div>

        <!-- Progress bar -->
        {#if uploading}
          <div class="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
            <div class="h-full bg-primary rounded-full transition-all duration-300" style="width: {uploadProgress}%"></div>
          </div>
          <p class="text-xs text-on-surface-variant text-center">Uploading... {uploadProgress}%</p>
        {/if}

        <div class="flex gap-3 pt-4">
          <button type="button" onclick={() => showUpload = false} disabled={uploading} class="flex-1 py-2 rounded-lg border border-outline text-on-surface-variant hover:bg-surface-variant text-sm font-semibold transition-colors">Cancel</button>
          <button type="submit" disabled={uploading || !uploadFile} class="flex-1 py-2 bg-primary text-white hover:bg-primary/95 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {#if uploading}
              <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Uploading...
            {:else}
              Upload
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
