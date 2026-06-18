<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  const navTabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  import { agencyDataStore } from '../../stores/agencyData';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  let activeFilter = $state<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');
  let userMenuOpen = $state(false);
  let toastMsg = $state('');

  let invoices = $derived.by(() => {
    const clientFilterId = $page.url.searchParams.get('client');
    let data = $agencyDataStore.invoices;
    if (clientFilterId) {
      data = data.filter(i => i.client_id === clientFilterId);
    }
    return data;
  });

  let loading = $derived(!$agencyDataStore.loaded);

  let filteredInvoices = $derived(
    activeFilter === 'All' ? invoices : invoices.filter(i => i.status === activeFilter.toLowerCase())
  );

  let paidTotal = $derived(invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0));
  let pendingTotal = $derived(invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.total || 0), 0));
  let overdueTotal = $derived(invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.total || 0), 0));

  function fmt(n: number) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function statusDisplay(s: string) {
    if (s === 'paid') return 'Paid';
    if (s === 'pending') return 'Pending';
    return 'Overdue';
  }

  function statusBadge(s: string) {
    if (s === 'paid') return 'bg-[#dcfce7] text-[#166534]';
    if (s === 'pending') return 'bg-[#fef3c7] text-[#b45309]';
    return 'bg-error-container text-on-error-container';
  }

  function initials(name: string) {
    return name.substring(0, 2).toUpperCase();
  }

  function showToast(msg: string) {
    toastMsg = msg;
    setTimeout(() => toastMsg = '', 3000);
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
  <title>Invoices - ClientDesk</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <AgencyHeader activeTab="Invoices" />

  <!-- Main -->
  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full">
    <!-- Hero -->
    <section class="rounded-xl overflow-hidden shadow-lg mb-stack-md bg-gradient-to-br from-primary to-secondary p-8 md:p-12 relative flex flex-col md:flex-row items-center justify-between gap-6 group hover:-translate-y-1 transition-transform duration-300">
      <div class="absolute inset-0 bg-white/5 opacity-50 pointer-events-none" />
      <div class="relative z-10 flex-1 w-full text-center md:text-left">
        <h1 class="font-display-lg text-display-lg text-white mb-2">Invoices</h1>
        <p class="font-body-lg text-body-lg text-white/90">Track payments and manage billing</p>
        <div class="mt-6 inline-flex items-end gap-3 bg-white/10 backdrop-blur-md px-6 py-4 rounded-lg border border-white/20">
          <span class="font-display-lg text-display-lg text-white leading-none">{fmt(paidTotal)}</span>
          <span class="font-label-md text-label-md text-white/80 uppercase tracking-wider pb-1">Total Revenue</span>
        </div>
      </div>
      <div class="relative z-10 w-full md:w-auto mt-6 md:mt-0 flex justify-center md:justify-end">
        <a href="/invoices/create" class="bg-[#10b981] hover:bg-[#059669] text-white font-title-md text-title-md px-8 py-4 rounded-lg shadow-md transition-all duration-200 active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center no-underline">
          <span class="material-symbols-outlined">add</span> Create Invoice
        </a>
      </div>
    </section>

    <!-- Stat Cards -->
    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-stack-md">
      <div class="bg-surface border border-[#bbf7d0] rounded-xl p-6 shadow-sm">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center">
            <span class="material-symbols-outlined text-[#166534]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
          </div>
          <span class="font-label-md text-label-md text-[#166534] uppercase tracking-wider">Paid</span>
        </div>
        <p class="font-headline-md text-headline-md text-on-surface font-bold">{fmt(paidTotal)}</p>
        <p class="font-body-md text-body-md text-on-surface-variant mt-1">{invoices.filter(i => i.status === 'paid').length} invoices</p>
      </div>
      <div class="bg-surface border border-[#fed7aa] rounded-xl p-6 shadow-sm">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-[#fef3c7] flex items-center justify-center">
            <span class="material-symbols-outlined text-[#b45309]" style="font-variation-settings: 'FILL' 1;">schedule</span>
          </div>
          <span class="font-label-md text-label-md text-[#b45309] uppercase tracking-wider">Pending</span>
        </div>
        <p class="font-headline-md text-headline-md text-on-surface font-bold">{fmt(pendingTotal)}</p>
        <p class="font-body-md text-body-md text-on-surface-variant mt-1">{invoices.filter(i => i.status === 'pending').length} invoices</p>
      </div>
      <div class="bg-surface border border-error/30 rounded-xl p-6 shadow-sm">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-error-container flex items-center justify-center">
            <span class="material-symbols-outlined text-error" style="font-variation-settings: 'FILL' 1;">warning</span>
          </div>
          <span class="font-label-md text-label-md text-error uppercase tracking-wider">Overdue</span>
        </div>
        <p class="font-headline-md text-headline-md text-on-surface font-bold">{fmt(overdueTotal)}</p>
        <p class="font-body-md text-body-md text-on-surface-variant mt-1">{invoices.filter(i => i.status === 'overdue').length} invoices</p>
      </div>
    </section>

    <!-- Filters -->
    <section class="flex gap-2 overflow-x-auto pb-2 mb-stack-md scrollbar-hide">
      {#each ['All', 'Paid', 'Pending', 'Overdue'] as f}
        <button
          onclick={() => activeFilter = f as any}
          class="px-5 py-2.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all duration-150 focus:outline-none {activeFilter === f ? 'bg-primary text-white shadow-sm' : 'bg-surface hover:bg-surface-variant text-on-surface-variant border border-outline-variant/30'}"
        >{f}</button>
      {/each}
    </section>

    <!-- Invoice Grid -->
    {#if loading}
      <div class="py-20 flex justify-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
    {:else if filteredInvoices.length === 0}
      <div class="py-20 text-center bg-surface border border-outline-variant/30 rounded-xl">
        <span class="material-symbols-outlined text-5xl text-outline-variant mb-4">receipt_long</span>
        <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-1">No invoices found</h3>
        <p class="font-body-md text-body-md text-on-surface-variant">
          {#if activeFilter !== 'All'}Try a different filter.{:else}Create your first invoice to get started!{/if}
        </p>
      </div>
    {:else}
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter mb-12">
        {#each filteredInvoices as inv (inv.id)}
          <div class="bg-surface rounded-[16px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col border border-surface-variant">
            <!-- Header -->
            <div class="flex justify-between items-start mb-4">
              <span class="font-label-md text-label-md text-outline">{inv.invoice_number}</span>
              <span class="{statusBadge(inv.status)} px-2 py-1 rounded font-label-md text-label-md">{statusDisplay(inv.status)}</span>
            </div>

            <!-- Client -->
            <div class="flex items-center gap-3 mb-6">
              {#if inv.clients?.avatar_url}
                <img alt="Client" class="w-10 h-10 rounded-full bg-surface-variant object-cover" src={inv.clients.avatar_url} />
              {:else}
                <div class="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-title-md">
                  {initials(inv.clients?.full_name || 'NA')}
                </div>
              {/if}
              <div>
                <div class="font-title-md text-title-md text-on-surface">{inv.clients?.full_name || 'Unknown'}</div>
                {#if inv.clients?.company}
                  <div class="font-body-md text-[12px] text-on-surface-variant">{inv.clients.company}</div>
                {/if}
              </div>
            </div>

            <!-- Amount -->
            <div class="mb-6 flex-grow">
              <div class="font-headline-md text-headline-md text-on-surface font-bold">{fmt(Number(inv.total || 0))}</div>
              <div class="font-body-md text-body-md text-outline">
                {#if inv.due_date}Due {new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{:else}No due date{/if}
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 mt-auto">
              <button
                class="flex-1 bg-primary-container hover:bg-primary/20 text-primary px-3 py-2 rounded font-label-md text-label-md transition-colors flex items-center justify-center gap-1 focus:outline-none"
                onclick={() => showToast(`Downloading PDF for ${inv.invoice_number}...`)}
              >
                <span class="material-symbols-outlined text-sm">download</span> PDF
              </button>
              <button
                class="flex-1 bg-surface-variant hover:bg-surface-dim text-on-surface-variant px-3 py-2 rounded font-label-md text-label-md transition-colors flex items-center justify-center gap-1 focus:outline-none"
                onclick={() => showToast(`Reminder sent to ${inv.clients?.full_name || 'client'}!`)}
              >
                <span class="material-symbols-outlined text-sm">send</span> Remind
              </button>
            </div>
          </div>
        {/each}
      </section>
    {/if}
  </main>
</div>

<!-- Toast -->
{#if toastMsg}
  <div class="fixed bottom-6 right-6 z-50 bg-on-surface text-surface px-5 py-3 rounded-lg shadow-lg font-body-md text-body-md flex items-center gap-2 animate-fade-in">
    <span class="material-symbols-outlined text-sm">check_circle</span>
    {toastMsg}
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style>
