<script lang="ts">
  import NotificationBell from '$lib/components/NotificationBell.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { clientDataStore } from '../../stores/clientData';

  let { activeTab = 'Dashboard' }: { activeTab?: string } = $props();

  const navTabs = ['Dashboard', 'My Projects', 'Files', 'Invoices', 'Messages'];

  let userMenuOpen = $state(false);
  let mobileDrawerOpen = $state(false);

  let agencyLogo = $derived($clientDataStore.agencyLogo);
  let agencyName = $derived($clientDataStore.agencyName || 'ClientDesk');

  function initials(name: string | null) { return name?.substring(0, 2).toUpperCase() || 'NA'; }

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/client/dashboard';
    if (tab === 'My Projects') return '/client/projects';
    if (tab === 'Files') return '/client/files';
    if (tab === 'Invoices') return '/client/invoices';
    if (tab === 'Messages') return '/client/messages';
    return '/client/dashboard';
  }

  async function handleSignOut() {
    userMenuOpen = false;
    mobileDrawerOpen = false;
    await supabase.auth.signOut();
    goto('/client/login');
  }
</script>

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
          <a href={tabHref(tab)} class="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors {activeTab === tab ? 'text-primary bg-primary/[0.06]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}">{tab}</a>
        {/each}
      </nav>
    </div>
    <div class="flex items-center gap-2">
      <button class="md:hidden p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant" onclick={() => mobileDrawerOpen = true}>
        <span class="material-symbols-outlined text-[22px]">menu</span>
      </button>
      <NotificationBell />
      <div class="relative">
        <button class="flex items-center focus:outline-none" onclick={() => userMenuOpen = !userMenuOpen}>
          <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
            {initials($clientStore.full_name)}
          </div>
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

{#if mobileDrawerOpen}
  <div class="fixed inset-0 z-[100] md:hidden">
    <div class="absolute inset-0 bg-black/40" onclick={() => mobileDrawerOpen = false}></div>
    <nav class="absolute top-0 right-0 h-full w-72 bg-white shadow-xl flex flex-col animate-slideInRight">
      <div class="flex items-center justify-between px-5 h-14 border-b border-outline-variant shrink-0">
        <span class="text-sm font-semibold text-on-surface">{agencyName}</span>
        <button class="p-1 rounded-lg hover:bg-surface-container" onclick={() => mobileDrawerOpen = false}>
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto py-2">
        {#each navTabs as tab}
          <a
            href={tabHref(tab)}
            onclick={() => mobileDrawerOpen = false}
            class="flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors {activeTab === tab ? 'text-primary bg-primary/[0.04]' : 'text-on-surface-variant hover:bg-surface-container'}"
          >
            {tab}
          </a>
        {/each}
      </div>
      <div class="border-t border-outline-variant p-4 shrink-0">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
            {initials($clientStore.full_name)}
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-on-surface truncate">{$clientStore.full_name || 'Client'}</p>
            <p class="text-xs text-on-surface-variant truncate">{authState.user?.email || ''}</p>
          </div>
        </div>
        <button class="w-full text-left px-3 py-2 text-sm text-error hover:bg-error-container/30 rounded-lg transition-colors flex items-center gap-2" onclick={handleSignOut}>
          <span class="material-symbols-outlined text-[18px]">logout</span> Sign Out
        </button>
      </div>
    </nav>
  </div>
{/if}
