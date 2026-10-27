<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  const navTabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];
  const folderOptions = ['designs', 'contracts', 'invoices', 'reports', 'brand_assets', 'client_uploads'] as const;
  const uploadFolderOptions = ['designs', 'contracts', 'invoices', 'reports', 'brand_assets'] as const;
  const folderLabels: Record<string, string> = {
    designs: 'Designs', contracts: 'Contracts', invoices: 'Invoices',
    reports: 'Reports', brand_assets: 'Brand Assets', client_uploads: 'Client Uploads'
  };
  const folderIcons: Record<string, string> = {
    designs: 'palette', contracts: 'gavel', invoices: 'receipt_long',
    reports: 'analytics', brand_assets: 'branding_watermark', client_uploads: 'cloud_upload'
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

  // Lock controls
  let lockFile = $state(false);
  let unlockType = $state<'payment' | 'approval'>('payment');
  let unlockInvoiceId = $state('');

  let invoicesList = $derived($agencyDataStore.invoices);

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
      uploadError = `Storage Error: ${storageErr.message}`;
      uploading = false;
      return;
    }
    uploadProgress = 70;

    const { data: urlData } = supabase.storage.from('ClientDeskBucket').getPublicUrl(fileName);
    const fileUrl = urlData?.publicUrl || '';

    const insertData: any = {
      agency_id: authState.agencyId,
      file_name: uploadFile.name,
      file_url: fileUrl,
      file_size: uploadFile.size,
      file_type: uploadFile.type,
      folder: uploadFolder,
      project_id: uploadProjectId || null,
      uploaded_by: authState.user?.id || null,
      is_locked: lockFile,
    };
    if (lockFile) {
      insertData.unlock_type = unlockType;
      if (unlockType === 'payment' && unlockInvoiceId) {
        insertData.unlock_invoice_id = unlockInvoiceId;
      }
    }

    const { data: row, error: dbErr } = await supabase
      .from('files')
      .insert(insertData)
      .select('*')
      .single();

    if (dbErr) {
      uploadError = `Database Error: ${dbErr.message}`;
    } else if (row) {
      agencyDataStore.update(s => ({ ...s, files: [row, ...s.files] }));
      uploadFile = null;
      uploadFolder = 'designs';
      uploadProjectId = '';
      lockFile = false;
      unlockType = 'payment';
      unlockInvoiceId = '';
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
  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 animate-fadeIn">
      <div>
        <h1 class="text-xl font-semibold text-on-surface mb-1">Files</h1>
        <p class="text-sm text-on-surface-variant">{files.length} files stored</p>
      </div>
      <button onclick={() => showUpload = true} class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 w-fit">
        <span class="material-symbols-outlined text-[18px]">upload_file</span> Upload File
      </button>
    </div>

    <section class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-5">
      {#each folderOptions as folder}
        <button
          onclick={() => activeFolder = activeFolder === folder ? null : folder}
          class="p-3.5 rounded-lg border transition-colors text-left focus:outline-none {activeFolder === folder ? 'bg-primary/[0.06] border-primary/30 shadow-xs' : 'bg-white border-outline-variant shadow-xs hover:shadow-sm'}"
        >
          <span class="material-symbols-outlined text-[18px] mb-2 {activeFolder === folder ? 'text-primary' : 'text-on-surface-variant'}" style="font-variation-settings: 'FILL' 1;">{folderIcons[folder]}</span>
          <p class="text-sm font-medium {activeFolder === folder ? 'text-primary' : 'text-on-surface'}">{folderLabels[folder]}</p>
          <p class="text-xs mt-0.5 {activeFolder === folder ? 'text-primary/70' : 'text-on-surface-variant'}">{folderCount(folder)} files</p>
        </button>
      {/each}
    </section>

    {#if activeFolder}
      <div class="mb-4 flex items-center gap-2">
        <span class="text-[13px] text-on-surface-variant">Showing:</span>
        <span class="bg-primary/[0.06] text-primary px-2 py-0.5 rounded-md text-[13px] font-medium">{folderLabels[activeFolder]}</span>
        <button onclick={() => activeFolder = null} class="text-on-surface-variant hover:text-error ml-0.5 focus:outline-none"><span class="material-symbols-outlined text-[16px]">close</span></button>
      </div>
    {/if}

    <!-- Files Grid -->
    {#if loadingFiles}
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {#each Array(8) as _}
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex items-start justify-between mb-3">
              <div class="w-9 h-9 animate-shimmer rounded-lg"></div>
              <div class="h-4 w-14 animate-shimmer rounded"></div>
            </div>
            <div class="h-3.5 animate-shimmer rounded w-3/4 mb-1.5"></div>
            <div class="h-3 animate-shimmer rounded w-1/2"></div>
          </div>
        {/each}
      </section>
    {:else if filteredFiles.length === 0}
      <div class="py-16 text-center border border-dashed border-outline-variant rounded-lg">
        <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">folder_off</span>
        <h3 class="text-sm font-medium text-on-surface mb-1">No files found</h3>
        <p class="text-[13px] text-on-surface-variant">
          {#if activeFolder}Try a different folder or upload a new file.{:else}Upload your first file to get started.{/if}
        </p>
      </div>
    {:else}
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
        {#each filteredFiles as f (f.id)}
          {@const ft = getFileType(f.file_name)}
          {@const ic = iconConfig(ft)}
          <div class="bg-white border border-outline-variant rounded-lg p-4 shadow-xs hover:shadow-sm transition-shadow flex flex-col h-full">
            <div class="flex items-start justify-between mb-3">
              <div class="w-9 h-9 rounded-lg {ic.bg} flex items-center justify-center {ic.text} relative">
                <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' 1;">{ic.icon}</span>
                {#if f.is_locked && !f.unlocked_at}
                  <span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-tertiary rounded-full flex items-center justify-center" title="Locked ({f.unlock_type || 'payment'})">
                    <span class="material-symbols-outlined text-white text-[8px]">lock</span>
                  </span>
                {/if}
              </div>
              <div class="flex items-center gap-1">
                {#if f.is_locked && !f.unlocked_at}
                  <span class="px-1.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container text-[10px] font-medium">{f.unlock_type === 'approval' ? 'Approval' : 'Payment'}</span>
                {/if}
                <span class="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-medium">{folderLabels[f.folder] || f.folder}</span>
              </div>
            </div>
            <h4 class="text-sm font-medium text-on-surface mb-0.5 truncate" title={f.file_name}>{f.file_name}</h4>
            <p class="text-xs text-on-surface-variant mb-3">{formatSize(f.file_size)} · {new Date(f.created_at).toLocaleDateString()}</p>
            <div class="mt-auto flex items-center justify-between border-t border-outline-variant pt-3">
              <span class="text-xs text-on-surface-variant flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">person</span> {f.folder === 'client_uploads' ? 'Client' : 'Agency'}
              </span>
              <a href={f.file_url} target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 border border-outline-variant text-on-surface-variant rounded-lg text-xs font-medium hover:border-primary hover:text-primary transition-colors flex items-center gap-1 no-underline">
                <span class="material-symbols-outlined text-[14px]">download</span> Download
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
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-white w-full max-w-md rounded-lg p-5 shadow-lg border border-outline-variant mx-4 animate-fadeIn">
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-[15px] font-semibold text-on-surface">Upload File</h3>
        <button class="text-on-surface-variant hover:text-on-surface w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center" onclick={() => showUpload = false}>
          <span class="material-symbols-outlined text-[18px]">close</span>
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
            {#each uploadFolderOptions as folder}
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

        <!-- Lock Toggle -->
        <div class="border border-outline-variant/40 rounded-lg p-3 space-y-3">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" bind:checked={lockFile} disabled={uploading} class="w-4 h-4 rounded accent-primary" />
            <span class="text-xs font-semibold text-on-surface flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">lock</span> Lock this file
            </span>
          </label>
          {#if lockFile}
            <div class="pl-7 space-y-3">
              <div>
                <label class="block text-xs font-semibold text-on-surface-variant mb-1">Unlock method</label>
                <div class="flex gap-2">
                  <button type="button" onclick={() => unlockType = 'payment'} class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none {unlockType === 'payment' ? 'bg-primary text-white' : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant'}">
                    <span class="material-symbols-outlined text-xs align-middle mr-0.5">payments</span> Payment
                  </button>
                  <button type="button" onclick={() => unlockType = 'approval'} class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none {unlockType === 'approval' ? 'bg-primary text-white' : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant'}">
                    <span class="material-symbols-outlined text-xs align-middle mr-0.5">thumb_up</span> Approval
                  </button>
                </div>
              </div>
              {#if unlockType === 'payment'}
                <div>
                  <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="unlock-invoice">Link to Invoice (optional)</label>
                  <select id="unlock-invoice" bind:value={unlockInvoiceId} disabled={uploading} class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                    <option value="">-- No specific invoice --</option>
                    {#each invoicesList.filter(i => i.status !== 'paid') as inv (inv.id)}
                      <option value={inv.id}>{inv.invoice_number} - {inv.clients?.full_name || 'Unknown'}</option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Progress bar -->
        {#if uploading}
          <div class="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
            <div class="h-full bg-primary rounded-full transition-all duration-300" style="width: {uploadProgress}%"></div>
          </div>
          <p class="text-xs text-on-surface-variant text-center">Uploading... {uploadProgress}%</p>
        {/if}

        <div class="flex gap-3 pt-4 border-t border-outline-variant mt-1">
          <button type="button" onclick={() => showUpload = false} disabled={uploading} class="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low text-sm font-medium transition-colors">Cancel</button>
          <button type="submit" disabled={uploading || !uploadFile} class="flex-1 py-2 bg-primary text-white hover:bg-primary-hover rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {#if uploading}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
