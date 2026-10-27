<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import ClientCard, { type ClientProps } from '$lib/components/ClientCard.svelte';
  import { goto } from '$app/navigation';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  import { agencyDataStore } from '../../stores/agencyData';

  const tabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];
  
  let showModal = $state(false);
  let userMenuOpen = $state(false);
  let searchQuery = $state('');
  let statusFilter = $state<'all' | 'active' | 'inactive'>('all');
  let currentPage = $state(1);
  const PAGE_SIZE = 12;

  // Form fields
  let fullName = $state('');
  let company = $state('');
  let email = $state('');
  let phone = $state('');
  let location = $state('');
  let isSaving = $state(false);
  let errorMsg = $state('');

  let clients = $derived($agencyDataStore.clients);
  let loadingClients = $derived(!$agencyDataStore.loaded);

  let filteredClients = $derived.by(() => {
    let result = clients;
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }
    const term = searchQuery.toLowerCase();
    if (term) {
      result = result.filter(c =>
        c.full_name?.toLowerCase().includes(term) ||
        c.company?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      );
    }
    return result;
  });

  let totalPages = $derived(Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE)));
  let paginatedClients = $derived(filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE));

  $effect(() => {
    if (searchQuery || statusFilter) currentPage = 1;
  });

  function exportCsv() {
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Location', 'Status'];
    const rows = filteredClients.map(c => [
      c.full_name || '',
      c.company || '',
      c.email || '',
      c.phone || '',
      c.location || '',
      c.status || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAddClient(e: Event) {
    e.preventDefault();
    if (!fullName || !email) {
      errorMsg = 'Full Name and Email are required.';
      return;
    }
    isSaving = true;
    errorMsg = '';

    const { data, error } = await supabase
      .from('clients')
      .insert({
        agency_id: authState.agencyId,
        full_name: fullName,
        company: company,
        email: email,
        phone: phone,
        location: location,
        status: 'active'
      })
      .select('*, projects(count)')
      .single();

    if (error) {
      errorMsg = error.message;
    } else if (data) {
      agencyDataStore.update(s => ({ ...s, clients: [data, ...s.clients] }));
      // Reset form
      fullName = '';
      company = '';
      email = '';
      phone = '';
      location = '';
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
  <title>Clients - ClientDesk</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <!-- Top Navigation Container -->
  <AgencyHeader activeTab="Clients" />

  <!-- Main Content Area -->
  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 animate-fadeIn">
      <div>
        <h1 class="text-xl font-semibold text-on-surface mb-1">Clients</h1>
        <p class="text-sm text-on-surface-variant">{clients.length} total clients</p>
      </div>
      <button
        onclick={() => showModal = true}
        class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 w-fit"
      >
        <span class="material-symbols-outlined text-[18px]">add</span>
        Add Client
      </button>
    </div>

    <div class="flex flex-col md:flex-row gap-3 items-center justify-between mb-5">
      <div class="relative flex-1">
        <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
        <input
          class="w-full pl-9 pr-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-outline"
          placeholder="Search clients..."
          type="text"
          bind:value={searchQuery}
        />
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <select
          class="px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          bind:value={statusFilter}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onclick={exportCsv}
          class="px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
        >
          <span class="material-symbols-outlined text-[16px]">download</span> Export
        </button>
      </div>
    </div>

    <!-- Client Cards Grid -->
    {#if loadingClients}
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {#each Array(8) as _}
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-9 h-9 rounded-full animate-shimmer"></div>
              <div class="flex-1">
                <div class="h-3.5 animate-shimmer rounded w-3/4 mb-1.5"></div>
                <div class="h-3 animate-shimmer rounded w-1/2"></div>
              </div>
            </div>
            <div class="h-3 animate-shimmer rounded w-full mb-1.5"></div>
            <div class="h-3 animate-shimmer rounded w-2/3"></div>
          </div>
        {/each}
      </section>
    {:else if filteredClients.length === 0}
      <div class="py-16 text-center border border-dashed border-outline-variant rounded-lg">
        <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">group_off</span>
        <h3 class="text-sm font-medium text-on-surface mb-1">No clients found</h3>
        <p class="text-[13px] text-on-surface-variant">
          {#if searchQuery}
            Try adjusting your search terms.
          {:else}
            Get started by adding your first client.
          {/if}
        </p>
      </div>
    {:else}
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
        {#each paginatedClients as client (client.id)}
          {@const mappedClient = {
            id: client.id,
            initials: client.full_name ? client.full_name.substring(0, 2).toUpperCase() : 'CL',
            name: client.full_name,
            industry: client.company || 'Private Client',
            projectsCount: client.projects?.[0]?.count || 0,
            status: (client.status === 'active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
            theme: (['primary', 'secondary', 'tertiary'] as const)[client.full_name.length % 3]
          }}
          <ClientCard
            client={mappedClient}
            onViewProfile={() => goto(`/clients/${client.id}`)}
          />
        {/each}
      </section>

      {#if totalPages > 1}
        <div class="flex justify-center items-center gap-2 mb-12">
          <button
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {currentPage === 1 ? 'text-outline cursor-not-allowed' : 'text-primary hover:bg-primary-container'}"
            disabled={currentPage === 1}
            onclick={() => currentPage = Math.max(1, currentPage - 1)}
          >
            <span class="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          {#each Array.from({ length: totalPages }, (_, i) => i + 1) as pg}
            <button
              class="w-9 h-9 rounded-lg text-sm font-medium transition-colors {pg === currentPage ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant'}"
              onclick={() => currentPage = pg}
            >
              {pg}
            </button>
          {/each}
          <button
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {currentPage === totalPages ? 'text-outline cursor-not-allowed' : 'text-primary hover:bg-primary-container'}"
            disabled={currentPage === totalPages}
            onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
          >
            <span class="material-symbols-outlined text-sm">chevron_right</span>
          </button>
          <span class="text-xs text-on-surface-variant ml-2">{filteredClients.length} clients</span>
        </div>
      {/if}
    {/if}
  </main>
</div>

<!-- Add Client Modal -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-white w-full max-w-md rounded-lg p-5 shadow-lg border border-outline-variant mx-4 animate-fadeIn">
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-[15px] font-semibold text-on-surface">Add New Client</h3>
        <button
          class="text-on-surface-variant hover:text-on-surface w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center"
          onclick={() => showModal = false}
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {#if errorMsg}
        <div class="mb-4 p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg text-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-lg">error</span>
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form onsubmit={handleAddClient} class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="full-name">Full Name *</label>
          <input
            type="text"
            id="full-name"
            bind:value={fullName}
            placeholder="John Doe"
            required
            disabled={isSaving}
            class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="company">Company</label>
          <input
            type="text"
            id="company"
            bind:value={company}
            placeholder="Acme Corp"
            disabled={isSaving}
            class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="email">Email *</label>
          <input
            type="email"
            id="email"
            bind:value={email}
            placeholder="john@example.com"
            required
            disabled={isSaving}
            class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="phone">Phone</label>
          <input
            type="tel"
            id="phone"
            bind:value={phone}
            placeholder="+1 (555) 019-2834"
            disabled={isSaving}
            class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="location">Location</label>
          <input
            type="text"
            id="location"
            bind:value={location}
            placeholder="San Francisco, CA"
            disabled={isSaving}
            class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm text-on-surface"
          />
        </div>

        <div class="flex gap-3 pt-4 border-t border-outline-variant mt-1">
          <button
            type="button"
            onclick={() => showModal = false}
            disabled={isSaving}
            class="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            class="flex-1 py-2 bg-primary text-white hover:bg-primary-hover rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {#if isSaving}
              <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            {:else}
              Save Client
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
