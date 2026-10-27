<script lang="ts">
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { theme, setTheme } from '$lib/theme.svelte';

  const themeOptions = [
    { mode: 'light', icon: 'light_mode', label: 'Light' },
    { mode: 'dark', icon: 'dark_mode', label: 'Dark' },
    { mode: 'system', icon: 'computer', label: 'System' }
  ] as const;

  let { activeTab } = $props<{ activeTab: string }>();

  const tabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  let userMenuOpen = $state(false);
  let notificationsOpen = $state(false);
  let mobileDrawerOpen = $state(false);

  interface Notification {
    id: string;
    title: string;
    body: string | null;
    is_read: boolean;
    type: string | null;
    created_at: string;
  }

  let notifications = $state<Notification[]>([]);
  let loadingNotifs = $state(true);

  let unreadCount = $derived(notifications.filter(n => !n.is_read).length);

  onMount(async () => {
    if (!authState.user) { loadingNotifs = false; return; }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', authState.user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    notifications = data || [];
    loadingNotifs = false;
  });

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    notifications = notifications.map(n => ({ ...n, is_read: true }));
  }

  function formatNotifTime(dateStr: string): string {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function notifIcon(type: string | null): string {
    switch (type) {
      case 'invoice': return 'receipt_long';
      case 'file': return 'description';
      case 'approval': return 'verified';
      case 'message': return 'chat';
      case 'task': return 'task_alt';
      default: return 'notifications';
    }
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

<div class="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-white border-b border-outline-variant">
  <div class="flex items-center gap-8 w-full max-w-container-max mx-auto justify-between">
    <div class="flex items-center gap-8">
      <a href="/" class="text-[15px] font-semibold text-on-surface cursor-pointer no-underline tracking-tight">
        {authState.agencyName || "ClientDesk"}
      </a>
      <nav class="hidden md:flex gap-1">
        {#each tabs as tab}
          <a
            href={tabHref(tab)}
            class="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors duration-150 focus:outline-none {activeTab === tab ? 'text-primary bg-primary/[0.06]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}"
          >
            {tab}
          </a>
        {/each}
      </nav>
    </div>

    <div class="flex items-center gap-2 relative">
      <button class="md:hidden p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant" onclick={() => mobileDrawerOpen = true}>
        <span class="material-symbols-outlined text-[22px]">menu</span>
      </button>
      <div class="relative">
        <button
          class="text-on-surface-variant hover:text-on-surface transition-colors relative w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center"
          onclick={() => { notificationsOpen = !notificationsOpen; userMenuOpen = false; }}
        >
          <span class="material-symbols-outlined text-[20px]">notifications</span>
          {#if unreadCount > 0}
            <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
          {/if}
        </button>

        {#if notificationsOpen}
          <div class="absolute right-0 top-11 w-80 bg-white border border-outline-variant rounded-lg shadow-dropdown z-50 flex flex-col overflow-hidden max-h-[380px] animate-fadeIn">
            <div class="px-4 py-3 border-b border-outline-variant flex justify-between items-center">
              <h3 class="text-sm font-semibold text-on-surface">Notifications</h3>
              {#if unreadCount > 0}
                <button class="text-xs text-primary hover:underline font-medium" onclick={markAllRead}>Mark all read</button>
              {/if}
            </div>
            <div class="overflow-y-auto flex-1">
              {#if loadingNotifs}
                <div class="py-8 flex justify-center">
                  <div class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                </div>
              {:else if notifications.length === 0}
                <div class="py-10 text-center">
                  <span class="material-symbols-outlined text-[32px] text-outline-variant mb-2 block">notifications_off</span>
                  <p class="text-sm text-on-surface-variant">No notifications yet</p>
                </div>
              {:else}
                {#each notifications as notif (notif.id)}
                  <div class="px-4 py-3 hover:bg-surface-container-low transition-colors cursor-pointer border-b border-outline-variant/50 last:border-b-0 {notif.is_read ? '' : 'bg-primary/[0.03]'}">
                    <div class="flex gap-3">
                      <span class="material-symbols-outlined text-[18px] mt-0.5 shrink-0 {notif.is_read ? 'text-outline' : 'text-primary'}">{notifIcon(notif.type)}</span>
                      <div class="flex-1 min-w-0">
                        <p class="text-[13px] text-on-surface leading-snug {notif.is_read ? '' : 'font-medium'}">{notif.title}</p>
                        {#if notif.body}
                          <p class="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{notif.body}</p>
                        {/if}
                        <p class="text-[11px] text-outline mt-1">{formatNotifTime(notif.created_at)}</p>
                      </div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <a
        href="/settings"
        class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors {activeTab === 'Settings' ? 'text-primary bg-primary/[0.06]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}"
      >
        <span class="material-symbols-outlined text-[20px]">settings</span>
      </a>

      <div class="relative ml-1">
        <button
          class="flex items-center focus:outline-none"
          onclick={() => { userMenuOpen = !userMenuOpen; notificationsOpen = false; }}
        >
          <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
            {(authState.userFullName || authState.user?.email || 'U').substring(0, 2).toUpperCase()}
          </div>
        </button>

        {#if userMenuOpen}
          <div class="absolute right-0 top-11 w-52 bg-white border border-outline-variant rounded-lg shadow-dropdown py-1 z-50 animate-fadeIn">
            <div class="px-4 py-2.5 border-b border-outline-variant">
              <p class="text-sm font-medium text-on-surface">{authState.userFullName || "User"}</p>
              <p class="text-xs text-on-surface-variant truncate mt-0.5">{authState.user?.email || ""}</p>
            </div>
            <a href="/settings" class="w-full text-left px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">settings</span> Settings
            </a>
            <div class="border-t border-outline-variant my-1"></div>
            <div class="px-4 py-2">
              <p class="text-[11px] text-on-surface-variant mb-1.5">Theme</p>
              <div class="flex gap-1 bg-surface-container rounded-lg p-0.5">
                {#each themeOptions as opt}
                  <button
                    title={opt.label}
                    onclick={() => setTheme(opt.mode)}
                    class="flex-1 h-7 rounded-md flex items-center justify-center transition-colors {theme.mode === opt.mode ? 'bg-surface text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}"
                  >
                    <span class="material-symbols-outlined text-[16px]">{opt.icon}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div class="border-t border-outline-variant my-1"></div>
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
        <span class="text-sm font-semibold text-on-surface">{authState.agencyName || "ClientDesk"}</span>
        <button class="p-1 rounded-lg hover:bg-surface-container" onclick={() => mobileDrawerOpen = false}>
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto py-2">
        {#each tabs as tab}
          <a
            href={tabHref(tab)}
            onclick={() => mobileDrawerOpen = false}
            class="flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors {activeTab === tab ? 'text-primary bg-primary/[0.04]' : 'text-on-surface-variant hover:bg-surface-container'}"
          >
            {tab}
          </a>
        {/each}
        <div class="border-t border-outline-variant my-2"></div>
        <a href="/settings" onclick={() => mobileDrawerOpen = false} class="flex items-center gap-3 px-5 py-3 text-sm text-on-surface-variant hover:bg-surface-container">
          <span class="material-symbols-outlined text-[20px]">settings</span> Settings
        </a>
      </div>
      <div class="border-t border-outline-variant p-4 shrink-0">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
            {(authState.userFullName || authState.user?.email || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-on-surface truncate">{authState.userFullName || "User"}</p>
            <p class="text-xs text-on-surface-variant truncate">{authState.user?.email || ""}</p>
          </div>
        </div>
        <button class="w-full text-left px-3 py-2 text-sm text-error hover:bg-error-container/30 rounded-lg transition-colors flex items-center gap-2" onclick={handleSignOut}>
          <span class="material-symbols-outlined text-[18px]">logout</span> Sign Out
        </button>
      </div>
    </nav>
  </div>
{/if}
