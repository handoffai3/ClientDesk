<script lang="ts">
  import ClientHeader from '$lib/components/ClientHeader.svelte';
  import { apiFetch } from '$lib/apiFetch';
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';

  import { clientDataStore } from '../../../stores/clientData';
  import { fmtMoney } from '$lib/format';

  let activeProjects = $derived($clientDataStore.projects.filter(p => p.status === 'active'));
  let recentProject = $derived(activeProjects.length > 0 ? activeProjects[0] : null);
  let activeProjectsCount = $derived(activeProjects.length);
  let filesCount = $derived($clientDataStore.files.length);
  let recentFiles = $derived($clientDataStore.files.slice(0, 2));
  let invoices = $derived($clientDataStore.invoices);
  let pendingInvoicesCount = $derived($clientDataStore.invoices.filter(i => i.status === 'pending').length);
  let loading = $derived(!$clientDataStore.loaded);


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

  function fmtAmt(n: number) { return fmtMoney(n, $clientDataStore.currency, 0); }
  function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'; }
  let toastMsg = $state('');
  let payingInvoiceId = $state<string | null>(null);

  function showToast(msg: string) {
    toastMsg = msg;
    setTimeout(() => toastMsg = '', 3000);
  }

  async function payWithStripe(invoiceId: string) {
    payingInvoiceId = invoiceId;
    try {
      const res = await apiFetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast('Could not create payment session.');
        payingInvoiceId = null;
      }
    } catch {
      showToast('Payment failed. Please try again.');
      payingInvoiceId = null;
    }
  }
</script>

<svelte:head>
  <title>Client Dashboard</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <ClientHeader activeTab="Dashboard" />

  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full">
    {#if loading}
      <div class="pt-1">
        <div class="animate-shimmer rounded-lg h-20 mb-5"></div>
        <div class="grid grid-cols-3 gap-3 mb-5">
          {#each Array(3) as _}
            <div class="bg-white rounded-lg p-4 border border-outline-variant">
              <div class="h-3 animate-shimmer rounded w-1/2 mb-2"></div>
              <div class="h-6 animate-shimmer rounded w-1/3"></div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 animate-fadeIn pt-1">
        <div>
          <h1 class="text-xl font-semibold text-on-surface mb-1">Welcome, {$clientStore.full_name}</h1>
          <p class="text-sm text-on-surface-variant">Here's an overview of your active engagements.</p>
        </div>
        {#if recentProject}
          <a href="/client/projects/{recentProject.id}" class="bg-white rounded-lg border border-outline-variant shadow-xs p-4 w-full md:w-72 no-underline cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group">
            <div class="flex justify-between items-end mb-2">
              <div>
                <span class="text-[11px] text-on-surface-variant">Current Project</span>
                <h3 class="text-sm font-medium text-on-surface truncate max-w-[160px] group-hover:text-primary transition-colors">{recentProject.name}</h3>
              </div>
              <span class="text-sm font-semibold text-primary">{recentProject.progress}%</span>
            </div>
            <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div class="bg-primary h-full rounded-full" style="width: {recentProject.progress}%;"></div>
            </div>
          </a>
        {/if}
      </div>

      <!-- Stat cards: compact row on mobile -->
      <div class="grid grid-cols-3 gap-3 mb-5">
        <a href="/client/projects" class="bg-white rounded-lg p-3 md:p-4 shadow-xs border border-outline-variant no-underline cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group">
          <div class="flex items-center gap-2 mb-1.5 md:mb-2">
            <div class="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-secondary/[0.08] flex items-center justify-center">
              <span class="material-symbols-outlined text-secondary text-[14px] md:text-[16px]">folder_open</span>
            </div>
            <span class="text-[10px] md:text-xs text-on-surface-variant leading-tight">Active Projects</span>
          </div>
          <span class="text-sm md:text-[15px] font-semibold text-on-surface group-hover:text-primary transition-colors">{activeProjectsCount}</span>
        </a>
        <a href="/client/files" class="bg-white rounded-lg p-3 md:p-4 shadow-xs border border-outline-variant no-underline cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group">
          <div class="flex items-center gap-2 mb-1.5 md:mb-2">
            <div class="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-success/[0.08] flex items-center justify-center">
              <span class="material-symbols-outlined text-success text-[14px] md:text-[16px]">description</span>
            </div>
            <span class="text-[10px] md:text-xs text-on-surface-variant leading-tight">Files Uploaded</span>
          </div>
          <span class="text-sm md:text-[15px] font-semibold text-on-surface group-hover:text-primary transition-colors">{filesCount}</span>
        </a>
        <a href="/client/invoices" class="bg-white rounded-lg p-3 md:p-4 shadow-xs border border-outline-variant no-underline cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group">
          <div class="flex items-center gap-2 mb-1.5 md:mb-2">
            <div class="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-tertiary/[0.08] flex items-center justify-center">
              <span class="material-symbols-outlined text-tertiary text-[14px] md:text-[16px]">receipt_long</span>
            </div>
            <span class="text-[10px] md:text-xs text-on-surface-variant leading-tight">Pending Invoices</span>
          </div>
          <span class="text-sm md:text-[15px] font-semibold text-on-surface group-hover:text-primary transition-colors">{pendingInvoicesCount}</span>
        </a>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        <div>
          <h2 class="text-sm font-medium text-on-surface mb-3">My Projects</h2>
          <div class="space-y-3">
            {#each activeProjects as project}
              <a href="/client/projects/{project.id}" class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant hover:border-primary/30 hover:shadow-md transition-all no-underline block cursor-pointer group">
                <div class="flex justify-between items-start mb-2">
                  <span class="text-[11px] font-medium px-1.5 py-0.5 rounded {project.progress > 0 ? 'bg-secondary/[0.08] text-secondary' : 'bg-surface-container text-on-surface-variant'}">
                    {project.progress > 0 ? 'In Progress' : 'Planning'}
                  </span>
                  {#if project.deadline}
                    <span class="text-xs text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">event</span> {fmtDate(project.deadline)}</span>
                  {/if}
                </div>
                <h3 class="text-sm font-medium text-on-surface mb-1 group-hover:text-primary transition-colors">{project.name}</h3>
                <p class="text-[13px] text-on-surface-variant mb-3 line-clamp-2">{project.description || 'No description provided.'}</p>
                <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div class="bg-primary h-full rounded-full" style="width: {project.progress}%;"></div>
                </div>
                <div class="text-right mt-1 text-xs font-medium text-primary">{project.progress}%</div>
              </a>
            {/each}
            {#if activeProjects.length === 0}
              <div class="py-10 text-center border border-dashed border-outline-variant rounded-lg">
                <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">folder_off</span>
                <p class="text-sm text-on-surface-variant">No active projects.</p>
              </div>
            {/if}
          </div>
        </div>

        <div>
          <h2 class="text-sm font-medium text-on-surface mb-3">Recent Files</h2>
          <div class="space-y-3">
            {#each recentFiles as file}
              {@const fType = getFileType(file.file_name)}
              {@const icon = iconConfig(fType)}
              <div class="bg-white rounded-lg p-3.5 shadow-xs border border-outline-variant flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg {icon.bg} {icon.text} flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-[18px]">{icon.icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-medium text-on-surface truncate mb-0.5">{file.file_name}</h3>
                  <div class="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span>{formatSize(file.file_size)}</span>
                    <span class="text-outline">·</span>
                    <span>{fmtDate(file.created_at)}</span>
                  </div>
                </div>
                <a href={file.file_url} target="_blank" rel="noopener noreferrer" class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors shrink-0" title="Download">
                  <span class="material-symbols-outlined text-[18px]">download</span>
                </a>
              </div>
            {/each}
            {#if recentFiles.length === 0}
              <div class="py-10 text-center border border-dashed border-outline-variant rounded-lg">
                <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">description</span>
                <p class="text-sm text-on-surface-variant">No recent files.</p>
              </div>
            {/if}
          </div>
        </div>

        <div>
          <h2 class="text-sm font-medium text-on-surface mb-3">Invoices</h2>
          <div class="space-y-3">
            {#each invoices as invoice}
              <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant flex flex-col">
                <div class="flex justify-between items-start mb-2">
                  {#if invoice.status === 'pending' || invoice.status === 'overdue'}
                    <span class="text-[11px] font-medium text-tertiary bg-tertiary/[0.08] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <span class="material-symbols-outlined text-[12px]">schedule</span> Pending
                    </span>
                  {:else}
                    <span class="text-[11px] font-medium text-success bg-success/[0.08] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <span class="material-symbols-outlined text-[12px]">check_circle</span> Paid
                    </span>
                  {/if}
                  <span class="text-xs text-on-surface-variant">{invoice.invoice_number}</span>
                </div>
                <p class="text-[13px] text-on-surface-variant truncate mb-1">{invoice.notes || 'Invoice for Services'}</p>
                <h3 class="text-[15px] font-semibold text-on-surface mb-1">{fmtAmt(invoice.total)}</h3>
                {#if invoice.status === 'pending' && invoice.due_date}
                  <p class="text-xs text-error mb-3">Due {fmtDate(invoice.due_date)}</p>
                {:else}
                  <p class="text-xs text-on-surface-variant mb-3">Issued {fmtDate(invoice.created_at)}</p>
                {/if}
                <div class="mt-auto">
                  {#if invoice.status === 'paid'}
                    <span class="w-full bg-success/[0.08] text-success py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
                      <span class="material-symbols-outlined text-[16px]">check_circle</span> Paid
                    </span>
                  {:else if invoice.status === 'sent' || invoice.status === 'pending' || invoice.status === 'overdue'}
                    <button class="w-full bg-primary hover:bg-primary-hover text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50" onclick={() => payWithStripe(invoice.id)} disabled={payingInvoiceId === invoice.id}>
                      {#if payingInvoiceId === invoice.id}
                        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {:else}
                        <span class="material-symbols-outlined text-[18px]">payments</span> Pay Now
                      {/if}
                    </button>
                  {:else}
                    <a href="/client/invoices" class="w-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 no-underline">
                      <span class="material-symbols-outlined text-[18px]">visibility</span> View
                    </a>
                  {/if}
                </div>
              </div>
            {/each}
            {#if invoices.length === 0}
              <div class="py-10 text-center border border-dashed border-outline-variant rounded-lg">
                <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">receipt_long</span>
                <p class="text-sm text-on-surface-variant">No invoices yet.</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

{#if toastMsg}
  <div class="fixed bottom-5 right-5 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-lg shadow-md text-sm flex items-center gap-2 animate-fadeIn">
    <span class="material-symbols-outlined text-[18px]">info</span>
    {toastMsg}
  </div>
{/if}
