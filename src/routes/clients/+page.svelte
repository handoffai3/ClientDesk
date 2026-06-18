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

  // Derived filtered clients list
  let filteredClients = $derived(
    clients.filter(c => {
      const term = searchQuery.toLowerCase();
      return (
        c.full_name?.toLowerCase().includes(term) ||
        c.company?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      );
    })
  );

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
  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full">
    <!-- Hero Header -->
    <section class="rounded-xl overflow-hidden shadow-lg mb-stack-md bg-gradient-to-br from-primary to-secondary p-8 md:p-12 relative flex flex-col md:flex-row items-center justify-between gap-6 group hover:-translate-y-1 transition-transform duration-300">
      <div class="absolute inset-0 bg-white/5 opacity-50 pointer-events-none" />
      <div class="relative z-10 flex-1 w-full text-center md:text-left">
        <h1 class="font-display-lg text-display-lg text-white mb-2">Client Directory</h1>
        <p class="font-body-lg text-body-lg text-white/90">Manage your client relationships</p>
        <div class="mt-6 inline-flex items-end gap-3 bg-white/10 backdrop-blur-md px-6 py-4 rounded-lg border border-white/20">
          <span class="font-display-lg text-display-lg text-white leading-none">{clients.length}</span>
          <span class="font-label-md text-label-md text-white/80 uppercase tracking-wider pb-1">Total Clients</span>
        </div>
      </div>
      <div class="relative z-10 w-full md:w-auto mt-6 md:mt-0 flex justify-center md:justify-end">
        <button
          onclick={() => showModal = true}
          class="bg-[#10b981] hover:bg-[#059669] text-white font-title-md text-title-md px-8 py-4 rounded-lg shadow-md transition-all duration-200 active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center"
        >
          <span class="material-symbols-outlined">add</span>
          Add Client
        </button>
      </div>
    </section>

    <!-- Search / Controls -->
    <section class="mb-stack-md flex flex-col md:flex-row gap-4 items-center justify-between bg-surface p-4 rounded-xl shadow-sm border border-outline-variant/30">
      <div class="relative w-full flex-1">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
        <input
          class="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-on-surface placeholder:text-on-surface-variant"
          placeholder="Search clients by name, company, or email..."
          type="text"
          bind:value={searchQuery}
        />
      </div>
    </section>

    <!-- Client Cards Grid -->
    {#if loadingClients}
      <div class="py-20 flex justify-center items-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    {:else if filteredClients.length === 0}
      <div class="py-20 text-center bg-surface border border-outline-variant/30 rounded-xl">
        <span class="material-symbols-outlined text-5xl text-outline-variant mb-4">group_off</span>
        <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-1">No clients found</h3>
        <p class="font-body-md text-body-md text-on-surface-variant">
          {#if searchQuery}
            Try adjusting your search terms.
          {:else}
            Get started by adding your first client!
          {/if}
        </p>
      </div>
    {:else}
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter mb-12">
        {#each filteredClients as client (client.id)}
          {@const mappedClient = {
            id: client.id,
            initials: client.full_name ? client.full_name.substring(0, 2).toUpperCase() : 'CL',
            name: client.full_name,
            industry: client.company || 'Private Client',
            projectsCount: client.projects?.[0]?.count || 0,
            status: client.status === 'active' ? 'Active' : 'Inactive',
            theme: ['primary', 'secondary', 'tertiary'][client.full_name.length % 3]
          }}
          <ClientCard
            client={mappedClient}
            onViewProfile={() => goto(`/clients/${client.id}`)}
          />
        {/each}
      </section>
    {/if}
  </main>
</div>

<!-- Add Client Modal -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-surface-container-lowest w-full max-w-md rounded-2xl p-6 shadow-2xl border border-outline-variant/40 mx-4">
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-title-md text-title-md font-bold text-on-surface">Add New Client</h3>
        <button
          class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container"
          onclick={() => showModal = false}
        >
          <span class="material-symbols-outlined block">close</span>
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

        <div class="flex gap-3 pt-4">
          <button
            type="button"
            onclick={() => showModal = false}
            disabled={isSaving}
            class="flex-1 py-2 rounded-lg border border-outline text-on-surface-variant hover:bg-surface-variant text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            class="flex-1 py-2 bg-primary text-white hover:bg-primary/95 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
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
