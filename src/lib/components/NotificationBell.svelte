<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';

  interface Notification {
    id: string;
    title: string;
    body: string | null;
    is_read: boolean;
    type: string | null;
    created_at: string;
  }

  let open = $state(false);
  let loading = $state(true);
  let notifications = $state<Notification[]>([]);
  let unreadCount = $derived(notifications.filter((n) => !n.is_read).length);

  $effect(() => {
    const userId = authState.user?.id;
    if (!userId) return;

    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, is_read, type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      notifications = data || [];
      loading = false;
    })();

    const channel = supabase
      .channel('notifications-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: any) => {
        if (!notifications.find((n) => n.id === payload.new.id)) notifications = [payload.new, ...notifications];
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  });

  async function markAllRead() {
    const ids = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    notifications = notifications.map((n) => ({ ...n, is_read: true }));
  }

  function timeAgo(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function iconFor(type: string | null): string {
    switch (type) {
      case 'invoice': return 'receipt_long';
      case 'file': return 'description';
      case 'approval': return 'verified';
      case 'message': return 'chat';
      case 'task': return 'task_alt';
      default: return 'notifications';
    }
  }
</script>

<div class="relative">
  <button
    class="text-on-surface-variant hover:text-on-surface transition-colors relative w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center"
    aria-label="Notifications"
    onclick={() => (open = !open)}
  >
    <span class="material-symbols-outlined text-[20px]">notifications</span>
    {#if unreadCount > 0}
      <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" data-testid="unread-dot"></span>
    {/if}
  </button>

  {#if open}
    <div class="absolute right-0 top-11 w-80 bg-white border border-outline-variant rounded-lg shadow-dropdown z-50 flex flex-col overflow-hidden max-h-[380px] animate-fadeIn">
      <div class="px-4 py-3 border-b border-outline-variant flex justify-between items-center">
        <h3 class="text-sm font-semibold text-on-surface">Notifications</h3>
        {#if unreadCount > 0}
          <button class="text-xs text-primary hover:underline font-medium" onclick={markAllRead}>Mark all read</button>
        {/if}
      </div>
      <div class="overflow-y-auto flex-1">
        {#if loading}
          <div class="py-8 flex justify-center"><div class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
        {:else if notifications.length === 0}
          <div class="py-10 text-center">
            <span class="material-symbols-outlined text-[32px] text-outline-variant mb-2 block">notifications_off</span>
            <p class="text-sm text-on-surface-variant">No notifications yet</p>
          </div>
        {:else}
          {#each notifications as notif (notif.id)}
            <div class="px-4 py-3 border-b border-outline-variant/50 last:border-b-0 {notif.is_read ? '' : 'bg-primary/[0.03]'}">
              <div class="flex gap-3">
                <span class="material-symbols-outlined text-[18px] mt-0.5 shrink-0 {notif.is_read ? 'text-outline' : 'text-primary'}">{iconFor(notif.type)}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-[13px] text-on-surface leading-snug {notif.is_read ? '' : 'font-medium'}">{notif.title}</p>
                  {#if notif.body}<p class="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{notif.body}</p>{/if}
                  <p class="text-[11px] text-outline mt-1">{timeAgo(notif.created_at)}</p>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
