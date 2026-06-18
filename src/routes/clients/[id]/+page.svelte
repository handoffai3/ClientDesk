<script lang="ts">
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';

  const clientId = $page.params.id;
  const navTabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  let client = $state<any>(null);
  let projects = $state<any[]>([]);
  let activeProjectsCount = $state(0);
  let totalRevenue = $state(0);
  let pendingInvoicesCount = $state(0);
  let loading = $state(true);
  let userMenuOpen = $state(false);

  function fmt(n: number) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function initials(name: string) {
    return name?.substring(0, 2).toUpperCase() || 'NA';
  }

  async function loadData() {
    if (!authState.agencyId) return;
    loading = true;

    // Fetch Client
    const { data: cData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('agency_id', authState.agencyId)
      .single();
    if (cData) client = cData;

    // Fetch Projects
    const { data: pData } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .eq('agency_id', authState.agencyId)
      .order('created_at', { ascending: false });
    if (pData) {
      projects = pData;
      activeProjectsCount = pData.filter(p => p.status === 'active').length;
    }

    // Fetch Invoices for Stats
    const { data: iData } = await supabase
      .from('invoices')
      .select('status, total')
      .eq('client_id', clientId)
      .eq('agency_id', authState.agencyId);
    if (iData) {
      totalRevenue = iData.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total || 0), 0);
      pendingInvoicesCount = iData.filter(i => i.status === 'pending').length;
    }

    loading = false;
  }

  $effect(() => {
    if (!authState.loading && authState.agencyId) {
      loadData();
    }
  });

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
  <title>{client?.full_name || 'Client Details'} - ClientDesk</title>
</svelte:head>

<style>
  .hero-gradient { background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); }
  .stat-card-shadow { box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.05); }
  .stat-card-shadow:hover { box-shadow: 0px 10px 25px rgba(0, 0, 0, 0.08); transform: translateY(-2px); }
  .kanban-scrollbar::-webkit-scrollbar { height: 6px; }
  .kanban-scrollbar::-webkit-scrollbar-track { background: #f3ebfa; border-radius: 4px; }
  .kanban-scrollbar::-webkit-scrollbar-thumb { background: #d2bbff; border-radius: 4px; }
</style>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <!-- Top Nav -->
  <div class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
    <div class="flex items-center gap-8 w-full max-w-container-max mx-auto justify-between">
      <div class="flex items-center gap-8">
        <a href="/" class="font-headline-md text-headline-md font-bold text-primary">{authState.agencyName || 'ClientDesk'}</a>
        <nav class="hidden md:flex gap-8">
          {#each navTabs as tab}
            <a href={tabHref(tab)} class="relative font-label-md text-label-md transition-colors duration-150 py-5 focus:outline-none {tab === 'Clients' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">{tab}</a>
          {/each}
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <div class="relative">
          <button class="flex items-center active:scale-95 transition-transform duration-150 focus:outline-none" onclick={() => userMenuOpen = !userMenuOpen}>
            <img alt="User avatar" class="w-8 h-8 rounded-full border border-outline-variant object-cover hover:border-primary transition-colors" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxwSVvb_fIogrcoBmjb3RFOseMlp7ZlQW5UR7wn7k2TUPqho3kL_wgmKdxfNfbmBZt0_3NI5wgM0D3ouDRj8e9hVeue2XIB77dY5A0onBiPzeaW2r20LW-VONp7JXcwEyqaXtMu6Pn8RqtTfWRwGhHPxBM7_JP3p7JqUqtGW7hAxADfGOI2ViGlUKPcWLkm6P-5y5tMJK4EuXoQRCbpAKVxw57QJdS7TzGXoyCMfB5RekZGyw_bQKaip-8KAkeZeLxB-qA8R_LlLEE" />
          </button>
          {#if userMenuOpen}
            <div class="absolute right-0 top-10 w-48 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg py-2 z-50">
              <div class="px-4 py-2 border-b border-outline-variant/30">
                <p class="text-xs font-semibold text-on-surface">{authState.userFullName || 'User'}</p>
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
      <div class="flex justify-center items-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
    {:else if client}
      <div class="animate-fadeIn">
        <!-- Back Button -->
        <a href="/clients" class="flex items-center space-x-2 text-on-surface-variant mb-stack-sm cursor-pointer hover:text-primary transition-colors w-fit focus:outline-none no-underline">
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          <span class="font-label-md text-label-md">Back to Clients</span>
        </a>

        <!-- Hero Card -->
        <div class="hero-gradient rounded-xl p-stack-md flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-8 shadow-sm relative overflow-hidden mb-stack-md">
          <div class="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white opacity-10 rounded-full blur-2xl pointer-events-none"></div>
          <div class="absolute bottom-[-30px] left-[20%] w-32 h-32 bg-white opacity-10 rounded-full blur-xl pointer-events-none"></div>
          <div class="relative">
            {#if client.avatar_url}
              <img alt="Client Avatar" class="h-24 w-24 rounded-full border-4 border-white/30 object-cover shadow-sm bg-white" src={client.avatar_url}/>
            {:else}
              <div class="h-24 w-24 rounded-full border-4 border-white/30 shadow-sm bg-white/20 flex items-center justify-center text-white font-display-md text-display-md">
                {initials(client.full_name)}
              </div>
            {/if}
          </div>
          <div class="flex-1 text-center md:text-left z-10 text-white">
            <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold mb-1">{client.full_name}</h1>
            <h2 class="font-title-md text-title-md font-medium text-white/90 mb-4">{client.company || 'Independent'}</h2>
            <div class="flex items-center justify-center md:justify-start space-x-2 bg-white/20 w-fit px-3 py-1 rounded-full text-white/90 font-label-md text-label-md mx-auto md:mx-0">
              <span class="material-symbols-outlined text-[14px]">calendar_today</span>
              <span>Client since {new Date(client.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
          <div class="z-10 mt-4 md:mt-0 flex space-x-3">
            <button class="bg-white text-primary px-4 py-2 rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-bright active:scale-95 transition-all flex items-center space-x-1 focus:outline-none">
              <span class="material-symbols-outlined text-[16px]">edit</span>
              <span>Edit</span>
            </button>
          </div>
        </div>

        <!-- 3 Stat Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-md">
          <!-- Active Projects -->
          <div class="bg-surface rounded-xl p-stack-sm stat-card-shadow border-l-4 border-secondary-container transition-all duration-200">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Active Projects</h3>
              <div class="bg-secondary-container/10 p-1 rounded-md text-secondary-container"><span class="material-symbols-outlined text-[20px]">folder_open</span></div>
            </div>
            <div class="flex items-baseline space-x-2">
              <span class="font-headline-lg text-headline-lg text-on-surface font-bold">{activeProjectsCount}</span>
            </div>
          </div>
          <!-- Total Revenue -->
          <div class="bg-surface rounded-xl p-stack-sm stat-card-shadow border-l-4 border-[#10b981] transition-all duration-200">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Total Revenue</h3>
              <div class="bg-[#10b981]/10 p-1 rounded-md text-[#10b981]"><span class="material-symbols-outlined text-[20px]">payments</span></div>
            </div>
            <div class="flex items-baseline space-x-2">
              <span class="font-headline-lg text-headline-lg text-on-surface font-bold">{fmt(totalRevenue)}</span>
            </div>
          </div>
          <!-- Pending Invoices -->
          <div class="bg-surface rounded-xl p-stack-sm stat-card-shadow border-l-4 border-tertiary-container transition-all duration-200">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Pending Invoices</h3>
              <div class="bg-tertiary-container/10 p-1 rounded-md text-tertiary-container"><span class="material-symbols-outlined text-[20px]">receipt_long</span></div>
            </div>
            <div class="flex items-baseline space-x-2">
              <span class="font-headline-lg text-headline-lg text-on-surface font-bold">{pendingInvoicesCount}</span>
            </div>
          </div>
        </div>

        <!-- Tab Pills -->
        <div class="flex space-x-2 overflow-x-auto pb-2 kanban-scrollbar mb-stack-md">
          <button class="bg-primary text-white px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap active:scale-95 transition-transform duration-150 focus:outline-none">Overview</button>
          <a href={`/projects?client=${client.id}`} class="bg-surface text-on-surface-variant px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap hover:bg-surface-variant active:scale-95 transition-all duration-150 border border-outline-variant/30 focus:outline-none no-underline block">Projects</a>
          <a href={`/files?client=${client.id}`} class="bg-surface text-on-surface-variant px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap hover:bg-surface-variant active:scale-95 transition-all duration-150 border border-outline-variant/30 focus:outline-none no-underline block">Files</a>
          <a href={`/invoices?client=${client.id}`} class="bg-surface text-on-surface-variant px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap hover:bg-surface-variant active:scale-95 transition-all duration-150 border border-outline-variant/30 focus:outline-none no-underline block">Invoices</a>
          <a href={`/messages?client=${client.id}`} class="bg-surface text-on-surface-variant px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap hover:bg-surface-variant active:scale-95 transition-all duration-150 border border-outline-variant/30 focus:outline-none no-underline block">Messages</a>
        </div>

        <!-- Overview Tab Content -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start mb-12">
          <!-- Left Column: Contact Info -->
          <div class="lg:col-span-4 space-y-stack-md">
            <div class="bg-surface rounded-xl p-stack-md stat-card-shadow transition-all duration-200">
              <h3 class="font-title-md text-title-md text-on-surface mb-stack-sm flex items-center">
                <span class="material-symbols-outlined mr-2 text-primary">contact_page</span>
                Contact Information
              </h3>
              <div class="space-y-4">
                <div class="flex items-start space-x-3">
                  <div class="bg-surface-container p-2 rounded-lg text-primary mt-1"><span class="material-symbols-outlined text-[18px]">mail</span></div>
                  <div>
                    <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase">Email Address</p>
                    <p class="font-body-md text-body-md text-on-surface font-medium hover:text-primary cursor-pointer transition-colors">{client.email || 'Not provided'}</p>
                  </div>
                </div>
                <div class="flex items-start space-x-3">
                  <div class="bg-surface-container p-2 rounded-lg text-primary mt-1"><span class="material-symbols-outlined text-[18px]">phone</span></div>
                  <div>
                    <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase">Phone Number</p>
                    <p class="font-body-md text-body-md text-on-surface font-medium hover:text-primary cursor-pointer transition-colors">{client.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div class="flex items-start space-x-3">
                  <div class="bg-surface-container p-2 rounded-lg text-primary mt-1"><span class="material-symbols-outlined text-[18px]">location_on</span></div>
                  <div>
                    <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase">Location</p>
                    <p class="font-body-md text-body-md text-on-surface font-medium">{client.location || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Active Projects -->
          <div class="lg:col-span-8 space-y-stack-md">
            <div class="flex justify-between items-center mb-2">
              <h3 class="font-title-md text-title-md text-on-surface">Active Projects</h3>
            </div>

            {#if projects.filter(p => p.status === 'active').length === 0}
              <div class="bg-surface border border-outline-variant/30 rounded-xl p-8 text-center">
                <p class="text-on-surface-variant">No active projects found for this client.</p>
              </div>
            {:else}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                {#each projects.filter(p => p.status === 'active') as p (p.id)}
                  <a href={`/projects/${p.id}`} class="bg-surface rounded-xl p-stack-sm stat-card-shadow transition-all duration-200 flex flex-col h-full border border-outline-variant/20 hover:border-primary/50 no-underline group block">
                    <div class="flex justify-between items-start mb-3">
                      <span class="bg-surface-container-high text-on-surface-variant px-2 py-1 rounded-full font-label-md text-label-md text-[10px] group-hover:bg-primary/10 group-hover:text-primary transition-colors">Active</span>
                      <button class="text-on-surface-variant hover:text-primary transition-colors focus:outline-none">
                        <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </button>
                    </div>
                    <h4 class="font-title-md text-title-md text-on-surface mb-2 group-hover:text-primary transition-colors">{p.name}</h4>
                    <p class="font-body-md text-body-md text-on-surface-variant mb-4 line-clamp-2 flex-1">{p.description || 'No description provided'}</p>
                    <div class="mt-auto">
                      <div class="flex justify-between font-label-md text-label-md mb-1">
                        <span class="text-on-surface-variant">Progress</span>
                        <span class="text-[#10b981] font-bold">{p.progress}%</span>
                      </div>
                      <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                        <div class="bg-[#10b981] h-full rounded-full transition-all duration-1000" style="width: {p.progress}%;"></div>
                      </div>
                      <div class="flex justify-between items-center mt-3 pt-3 border-t border-outline-variant/20">
                        <span class="font-label-md text-label-md text-on-surface-variant flex items-center">
                          <span class="material-symbols-outlined text-[14px] mr-1">schedule</span>
                          {#if p.deadline}
                            Due {new Date(p.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          {:else}
                            No deadline
                          {/if}
                        </span>
                      </div>
                    </div>
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <div class="py-20 text-center text-on-surface-variant">Client not found or you don't have permission to view it.</div>
    {/if}
  </main>
</div>
