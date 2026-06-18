<script lang="ts">
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';

  let { activeTab } = $props<{ activeTab: string }>();

  const tabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  let userMenuOpen = $state(false);
  let notificationsOpen = $state(false);

  // Notifications State (Mock)
  let notifications = $state([
    { id: 1, text: 'Roshan added you to "Finalize UI Designs"', time: '10m ago', unread: true },
    { id: 2, text: 'New invoice #INV-2026-08 generated', time: '2h ago', unread: true },
    { id: 3, text: 'Client Acme Corp approved the API spec', time: '1d ago', unread: false }
  ]);

  function markAllRead() {
    notifications = notifications.map(n => ({ ...n, unread: false }));
  }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/login');
  }

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/';
    if (tab === 'Projects') return '/projects';
    if (tab === 'Clients') return '/clients';
    if (tab === 'Files') return '/files';
    if (tab === 'Invoices') return '/invoices';
    if (tab === 'Messages') return '/messages';
    return '/';
  }
</script>

<div class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
  <div class="flex items-center gap-8 w-full max-w-container-max mx-auto justify-between">
    <div class="flex items-center gap-8">
      <a href="/" class="font-headline-md text-headline-md font-bold text-primary cursor-pointer no-underline">
        {authState.agencyName || "ClientDesk"}
      </a>
      <nav class="hidden md:flex gap-8">
        {#each tabs as tab}
          <a
            href={tabHref(tab)}
            class="relative font-label-md text-label-md transition-colors duration-150 py-5 focus:outline-none {activeTab === tab ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}"
          >
            {tab}
          </a>
        {/each}
      </nav>
    </div>

    <div class="flex items-center gap-4 relative">
      <!-- Notifications Bell -->
      <div class="relative">
        <button
          class="text-on-surface-variant hover:text-primary transition-colors duration-150 relative p-1 rounded-full hover:bg-surface-container active:scale-95"
          onclick={() => {
            notificationsOpen = !notificationsOpen;
            userMenuOpen = false;
          }}
        >
          <span class="material-symbols-outlined block">notifications</span>
          {#if notifications.some((n) => n.unread)}
            <span class="absolute top-1 right-1 w-2.5 h-2.5 bg-error rounded-full ring-2 ring-surface"></span>
          {/if}
        </button>

        {#if notificationsOpen}
          <div class="absolute right-0 top-12 w-80 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg z-50 flex flex-col overflow-hidden max-h-[400px]">
            <div class="px-4 py-3 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest sticky top-0">
              <h3 class="font-title-sm text-title-sm font-bold text-on-surface">Notifications</h3>
              <button class="text-xs text-primary hover:underline font-medium" onclick={markAllRead}>Mark all read</button>
            </div>
            <div class="overflow-y-auto flex-1 p-2 space-y-1">
              {#each notifications as notif}
                <div class="p-3 rounded-lg hover:bg-surface-container transition-colors cursor-pointer {notif.unread ? 'bg-primary/5' : ''}">
                  <p class="text-sm text-on-surface leading-snug {notif.unread ? 'font-semibold' : ''}">{notif.text}</p>
                  <p class="text-xs text-on-surface-variant mt-1">{notif.time}</p>
                </div>
              {/each}
            </div>
            <div class="p-3 border-t border-outline-variant/30 bg-surface-container-lowest text-center sticky bottom-0">
              <button class="text-sm font-medium text-primary hover:text-primary/80 transition-colors">View All Notifications</button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Settings Link -->
      <a
        href="/settings"
        class="transition-colors duration-150 p-1 rounded-full hover:bg-surface-container {activeTab === 'Settings' ? 'text-primary bg-primary/10' : 'text-on-surface-variant'}"
      >
        <span class="material-symbols-outlined block">settings</span>
      </a>

      <!-- User Avatar / Menu -->
      <div class="relative">
        <button
          class="flex items-center active:scale-95 transition-transform duration-150 focus:outline-none"
          onclick={() => {
            userMenuOpen = !userMenuOpen;
            notificationsOpen = false;
          }}
        >
          <img
            alt="User profile avatar"
            class="w-8 h-8 rounded-full border border-outline-variant object-cover hover:border-primary transition-colors"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxwSVvb_fIogrcoBmjb3RFOseMlp7ZlQW5UR7wn7k2TUPqho3kL_wgmKdxfNfbmBZt0_3NI5wgM0D3ouDRj8e9hVeue2XIB77dY5A0onBiPzeaW2r20LW-VONp7JXcwEyqaXtMu6Pn8RqtTfWRwGhHPxBM7_JP3p7JqUqtGW7hAxADfGOI2ViGlUKPcWLkm6P-5y5tMJK4EuXoQRCbpAKVxw57QJdS7TzGXoyCMfB5RekZGyw_bQKaip-8KAkeZeLxB-qA8R_LlLEE"
          />
        </button>

        {#if userMenuOpen}
          <div class="absolute right-0 top-12 w-48 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg py-2 z-50">
            <div class="px-4 py-2 border-b border-outline-variant/30">
              <p class="text-xs font-semibold text-on-surface">{authState.userFullName || "User"}</p>
              <p class="text-[10px] text-outline truncate">{authState.user?.email || ""}</p>
            </div>
            <a href="/profile" class="w-full text-left px-4 py-2 text-xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors flex items-center gap-2">
              <span class="material-symbols-outlined text-sm block">person</span> Profile
            </a>
            <a href="/settings" class="w-full text-left px-4 py-2 text-xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors flex items-center gap-2">
              <span class="material-symbols-outlined text-sm block">settings</span> Settings
            </a>
            <hr class="border-outline-variant/30 my-1" />
            <button class="w-full text-left px-4 py-2 text-xs text-error hover:bg-error-container/20 transition-colors flex items-center gap-2" onclick={handleSignOut}>
              <span class="material-symbols-outlined text-sm block">logout</span> Sign Out
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
