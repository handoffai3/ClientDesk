<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onDestroy } from 'svelte';

  const navTabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  import { agencyDataStore } from '../../stores/agencyData';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';
  import { fmtMoney } from '$lib/format';

  let selectedClientId = $state<string | null>(null);
  let clientFilterId = $derived($page.url.searchParams.get('client'));
  let clientFilterName = $derived(clientFilterId ? ($agencyDataStore.clients.find(c => c.id === clientFilterId)?.full_name || 'Client') : null);

  function clearClientFilter() {
    const url = new URL(window.location.href);
    url.searchParams.delete('client');
    goto(url.pathname + url.search, { replaceState: true });
  }
  let messageText = $state('');
  let sending = $state(false);
  let userMenuOpen = $state(false);
  let searchQuery = $state('');
  let fileInput: HTMLInputElement;
  let messagesContainer: HTMLDivElement;
  let realtimeChannel: any = null;

  let conversations = $derived.by(() => {
    const map = new Map<string, any>();
    for (const m of $agencyDataStore.messages) {
      if (!map.has(m.client_id)) {
        map.set(m.client_id, {
          client_id: m.client_id,
          client_name: (m.clients as any)?.full_name || 'Unknown',
          client_avatar: (m.clients as any)?.avatar_url || null,
          client_company: (m.clients as any)?.company || '',
          last_message: '',
          last_time: m.created_at,
          unread_count: 0
        });
      }
      const conv = map.get(m.client_id)!;
      conv.last_message = m.content || (m.file_name ? `📎 ${m.file_name}` : '');
      conv.last_time = m.created_at;
      if (!m.is_read && m.sender_type === 'client') {
        conv.unread_count++;
      }
    }
    // Also include any clients that don't have messages yet
    for (const c of $agencyDataStore.clients) {
      if (!map.has(c.id)) {
        map.set(c.id, {
          client_id: c.id,
          client_name: c.full_name,
          client_avatar: c.avatar_url,
          client_company: c.company,
          last_message: '',
          last_time: c.created_at,
          unread_count: 0
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
  });

  let selectedClient = $derived(conversations.find(c => c.client_id === selectedClientId));
  let filteredConversations = $derived(
    searchQuery ? conversations.filter(c => c.client_name.toLowerCase().includes(searchQuery.toLowerCase())) : conversations
  );
  let totalUnread = $derived(conversations.reduce((s, c) => s + (c.unread_count || 0), 0));

  let messages = $derived.by(() => {
    if (!selectedClientId) return [];
    return $agencyDataStore.messages.filter(m => m.client_id === selectedClientId);
  });

  function initials(name: string) { return name?.substring(0, 2).toUpperCase() || 'NA'; }
  function fmt(n: number) { return fmtMoney(n, $agencyDataStore.currency, 0); }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function formatRelativeTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000 && d.getDate() === now.getDate()) return formatTime(dateStr);
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function formatDateSep(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  async function downloadMsgFile(msgId: string) {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/files/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'message', id: msgId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) window.open(data.url, '_blank');
      }
    } catch {}
  }

  function needsDateSep(msgs: any[], idx: number) {
    if (idx === 0) return true;
    const prev = new Date(msgs[idx - 1].created_at).toDateString();
    const cur = new Date(msgs[idx].created_at).toDateString();
    return prev !== cur;
  }

  async function selectClient(clientId: string) {
    selectedClientId = clientId;
    scrollToBottom();

    // Mark as read globally
    const unreadMsgs = messages.filter(m => !m.is_read && m.sender_type === 'client');
    if (unreadMsgs.length > 0) {
      const ids = unreadMsgs.map(m => m.id);
      agencyDataStore.update(s => {
        const newMsgs = s.messages.map(m => ids.includes(m.id) ? { ...m, is_read: true } : m);
        return { ...s, messages: newMsgs };
      });
      await supabase.from('messages').update({ is_read: true }).in('id', ids);
    }
  }

  function scrollToBottom() {
    setTimeout(() => { if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight; }, 50);
  }

  async function sendMessage() {
    if (!messageText.trim() || !selectedClientId || !authState.agencyId) return;
    sending = true;
    const content = messageText.trim();
    messageText = '';

    const { data, error } = await supabase.from('messages').insert({
      agency_id: authState.agencyId,
      client_id: selectedClientId,
      sender_type: 'agency',
      sender_id: authState.user?.id,
      content,
      is_read: true
    }).select('*').single();

    if (!error && data) {
      agencyDataStore.update(s => ({ ...s, messages: [...s.messages, data] }));
      scrollToBottom();
    }
    sending = false;
  }

  async function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !selectedClientId || !authState.agencyId) return;
    sending = true;

    const path = `${authState.agencyId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('ClientDeskBucket').upload(path, file);
    if (uploadErr) { sending = false; return; }

    const { data: urlData } = supabase.storage.from('ClientDeskBucket').getPublicUrl(path);
    const fileUrl = urlData?.publicUrl || '';

    const { data, error } = await supabase.from('messages').insert({
      agency_id: authState.agencyId,
      client_id: selectedClientId,
      sender_type: 'agency',
      sender_id: authState.user?.id,
      content: null,
      file_url: fileUrl,
      file_path: path,
      file_name: file.name,
      is_read: true
    }).select('*').single();

    if (!error && data) {
      agencyDataStore.update(s => ({ ...s, messages: [...s.messages, data] }));
      scrollToBottom();
    }
    sending = false;
    target.value = '';
  }

  function setupRealtime() {
    if (!authState.agencyId) return;
    realtimeChannel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `agency_id=eq.${authState.agencyId}` },
        (payload: any) => {
          const newMsg = payload.new;
          agencyDataStore.update(s => {
            if (!s.messages.find(m => m.id === newMsg.id)) {
              return { ...s, messages: [...s.messages, newMsg] };
            }
            return s;
          });
          if (newMsg.client_id === selectedClientId && newMsg.sender_type === 'client') {
            supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id);
            agencyDataStore.update(s => {
              const msgs = s.messages.map(m => m.id === newMsg.id ? { ...m, is_read: true } : m);
              return { ...s, messages: msgs };
            });
          }
        }
      ).subscribe();
  }

  let realtimeSetupDone = false;
  $effect(() => {
    if (!authState.loading && authState.agencyId && !realtimeSetupDone) {
      realtimeSetupDone = true;
      const urlClient = $page.url.searchParams.get('client');
      if (urlClient && selectedClientId !== urlClient) {
        selectClient(urlClient);
      }
      setupRealtime();
    }
  });

  let prevMsgCount = $state(0);
  $effect(() => {
    if (messages.length !== prevMsgCount) {
      prevMsgCount = messages.length;
      scrollToBottom();
    }
  });

  onDestroy(() => { if (realtimeChannel) supabase.removeChannel(realtimeChannel); });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
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

  async function handleSignOut() { userMenuOpen = false; await supabase.auth.signOut(); goto('/login'); }
</script>

<svelte:head><title>Messages - ClientDesk</title></svelte:head>


<div class="fixed inset-0 bg-background text-on-background flex flex-col overflow-hidden w-full">
  <AgencyHeader activeTab="Messages" />

  <div class="flex flex-1 overflow-hidden max-w-container-max mx-auto w-full mt-14 bg-white border-x border-outline-variant">
    <!-- Left Panel: Conversations -->
    <div class="w-full md:w-[320px] lg:w-[360px] bg-surface-container-low flex flex-col h-full border-r border-outline-variant shrink-0">
      <div class="px-4 py-3 border-b border-outline-variant">
        <div class="flex items-center justify-between">
          <h1 class="text-[15px] font-semibold text-on-surface">Messages</h1>
          {#if totalUnread > 0}
            <span class="bg-primary text-on-primary px-2 py-0.5 rounded-md text-[11px] font-medium">{totalUnread}</span>
          {/if}
        </div>
        {#if clientFilterName}
          <div class="mt-2">
            <span class="inline-flex items-center gap-1.5 bg-primary/[0.08] text-primary pl-2.5 pr-1.5 py-0.5 rounded-lg text-[12px] font-medium">
              Filtered: {clientFilterName}
              <button onclick={clearClientFilter} class="w-4 h-4 rounded-full hover:bg-primary/20 flex items-center justify-center transition-colors" title="Clear filter">
                <span class="material-symbols-outlined text-[12px]">close</span>
              </button>
            </span>
          </div>
        {/if}
      </div>

      <div class="px-4 py-2.5">
        <div class="relative">
          <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input class="w-full pl-9 pr-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-outline" placeholder="Search conversations..." type="text" bind:value={searchQuery} />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {#if filteredConversations.length === 0}
          <div class="text-center py-12 text-on-surface-variant">
            <span class="material-symbols-outlined text-[28px] mb-2 block text-outline">forum</span>
            <p class="text-sm">No conversations yet</p>
          </div>
        {/if}
        {#each filteredConversations as conv (conv.client_id)}
          <button
            class="w-full text-left rounded-lg p-2.5 flex gap-2.5 cursor-pointer relative transition-colors focus:outline-none {conv.client_id === selectedClientId ? 'bg-primary/[0.06]' : 'hover:bg-surface-container'}"
            onclick={() => selectClient(conv.client_id)}
          >
            <div class="relative shrink-0">
              {#if conv.client_avatar}
                <img alt={conv.client_name} class="w-9 h-9 rounded-full object-cover" src={conv.client_avatar} />
              {:else}
                <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium bg-primary/10 text-primary">{initials(conv.client_name)}</div>
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-baseline mb-0.5">
                <h3 class="text-sm font-medium text-on-surface truncate pr-2">{conv.client_name}</h3>
                <span class="text-[11px] {conv.unread_count > 0 ? 'text-primary font-medium' : 'text-outline'} shrink-0">{formatRelativeTime(conv.last_time)}</span>
              </div>
              <p class="text-[13px] {conv.unread_count > 0 ? 'text-on-surface font-medium' : 'text-on-surface-variant'} truncate">{conv.last_message || 'No messages'}</p>
            </div>
            {#if conv.unread_count > 0 && conv.client_id !== selectedClientId}
              <div class="absolute right-2.5 top-1/2 -translate-y-1/2 bg-primary text-white w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-medium">{conv.unread_count}</div>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- Right Panel: Chat Area -->
    <div class="hidden md:flex flex-col flex-1 bg-white relative h-full">
      {#if selectedClientId && selectedClient}
        <div class="h-14 border-b border-outline-variant flex items-center justify-between px-5 shrink-0 bg-white z-10">
          <div class="flex items-center gap-3">
            {#if selectedClient.client_avatar}
              <img alt={selectedClient.client_name} class="w-8 h-8 rounded-full object-cover" src={selectedClient.client_avatar} />
            {:else}
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-primary/10 text-primary">{initials(selectedClient.client_name)}</div>
            {/if}
            <div>
              <h2 class="text-sm font-medium text-on-surface">{selectedClient.client_name}</h2>
              {#if selectedClient.client_company}
                <p class="text-xs text-on-surface-variant">{selectedClient.client_company}</p>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button class="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors focus:outline-none"><span class="material-symbols-outlined text-[18px]">call</span></button>
            <button class="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors focus:outline-none"><span class="material-symbols-outlined text-[18px]">videocam</span></button>
          </div>
        </div>

        <!-- Messages Area -->
        <div bind:this={messagesContainer} class="flex-1 overflow-y-auto p-5 space-y-3 bg-surface-container-low">
          {#each messages as msg, idx (msg.id)}
            <!-- Date separator -->
            {#if needsDateSep(messages, idx)}
              <div class="flex justify-center my-3">
                <span class="bg-white text-on-surface-variant px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-outline-variant">{formatDateSep(msg.created_at)}</span>
              </div>
            {/if}

            {#if msg.sender_type === 'agency'}
              <div class="flex justify-end">
                <div class="max-w-[70%]">
                  {#if msg.file_url}
                    <div class="bg-white border border-outline-variant p-2.5 rounded-lg rounded-tr-sm shadow-xs flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-lg bg-primary/[0.06] flex items-center justify-center text-primary">
                        <span class="material-symbols-outlined text-[18px]">description</span>
                      </div>
                      <p class="flex-1 min-w-0 text-sm text-on-surface truncate">{msg.file_name || 'File'}</p>
                      <button onclick={() => downloadMsgFile(msg.id)} class="text-outline hover:text-primary transition-colors"><span class="material-symbols-outlined text-[18px]">download</span></button>
                    </div>
                  {:else}
                    <div class="bg-primary text-white p-3 rounded-lg rounded-tr-sm shadow-xs inline-block">
                      <p class="text-sm">{msg.content}</p>
                    </div>
                  {/if}
                  <div class="flex justify-end mt-0.5 items-center gap-1">
                    <span class="text-[10px] text-outline">{formatTime(msg.created_at)}</span>
                    <span class="material-symbols-outlined text-[12px] text-primary">done_all</span>
                  </div>
                </div>
              </div>
            {:else}
              <div class="flex justify-start">
                <div class="flex gap-2 max-w-[70%]">
                  {#if selectedClient.client_avatar}
                    <img alt={selectedClient.client_name} class="w-7 h-7 rounded-full object-cover shrink-0 mt-auto" src={selectedClient.client_avatar} />
                  {:else}
                    <div class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium bg-secondary/10 text-secondary shrink-0 mt-auto">{initials(selectedClient.client_name)}</div>
                  {/if}
                  <div>
                    {#if msg.file_url}
                      <div class="bg-white border border-outline-variant p-2.5 rounded-lg rounded-tl-sm shadow-xs flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-secondary/[0.06] flex items-center justify-center text-secondary"><span class="material-symbols-outlined text-[18px]">description</span></div>
                        <p class="flex-1 min-w-0 text-sm text-on-surface truncate">{msg.file_name || 'File'}</p>
                        <button onclick={() => downloadMsgFile(msg.id)} class="text-outline hover:text-primary transition-colors"><span class="material-symbols-outlined text-[18px]">download</span></button>
                      </div>
                    {:else}
                      <div class="bg-white border border-outline-variant text-on-surface p-3 rounded-lg rounded-tl-sm shadow-xs inline-block">
                        <p class="text-sm">{msg.content}</p>
                      </div>
                    {/if}
                    <div class="flex justify-start mt-0.5"><span class="text-[10px] text-outline">{formatTime(msg.created_at)}</span></div>
                  </div>
                </div>
              </div>
            {/if}
          {/each}

          {#if messages.length === 0}
            <div class="flex h-full items-center justify-center text-on-surface-variant">
              <div class="text-center">
                <span class="material-symbols-outlined text-[28px] mb-2 block text-outline">chat_bubble_outline</span>
                <p class="text-sm">No messages yet. Start the conversation!</p>
              </div>
            </div>
          {/if}
        </div>

        <!-- Input Area -->
        <div class="p-3 border-t border-outline-variant bg-white shrink-0">
          <div class="flex items-end gap-2 bg-surface-container-low p-1.5 rounded-lg border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
            <input type="file" class="hidden" bind:this={fileInput} onchange={handleFileUpload} />
            <button class="p-1.5 text-outline hover:text-primary transition-colors rounded-lg hover:bg-surface-container shrink-0" onclick={() => fileInput?.click()} disabled={sending}>
              <span class="material-symbols-outlined text-[20px]">attach_file</span>
            </button>
            <textarea
              class="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none max-h-28 min-h-[36px] py-2 text-sm text-on-surface placeholder:text-outline"
              oninput={(e) => { const t = e.currentTarget; t.style.height = ''; t.style.height = t.scrollHeight + 'px'; }}
              onkeydown={handleKeydown}
              placeholder="Type a message..."
              rows="1"
              bind:value={messageText}
              disabled={sending}
            ></textarea>
            <button
              class="w-9 h-9 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center justify-center shrink-0 transition-colors disabled:opacity-40"
              onclick={sendMessage}
              disabled={sending || !messageText.trim()}
            >
              <span class="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        </div>
      {:else}
        <div class="flex-1 flex items-center justify-center bg-surface-container-low">
          <div class="text-center">
            <span class="material-symbols-outlined text-[32px] text-outline mb-3 block">forum</span>
            <h2 class="text-sm font-medium text-on-surface mb-1">Select a Conversation</h2>
            <p class="text-[13px] text-on-surface-variant">Choose a client from the list to start messaging</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
