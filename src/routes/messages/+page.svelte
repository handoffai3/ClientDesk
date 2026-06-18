<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onDestroy } from 'svelte';

  const navTabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  import { agencyDataStore } from '../../stores/agencyData';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  let selectedClientId = $state<string | null>(null);
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
  function fmt(n: number) { return '₹' + n.toLocaleString('en-IN'); }

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
    if (uploadErr) { console.error('Upload error:', uploadErr); sending = false; return; }

    const { data: urlData } = supabase.storage.from('ClientDeskBucket').getPublicUrl(path);
    const fileUrl = urlData?.publicUrl || '';

    const { data, error } = await supabase.from('messages').insert({
      agency_id: authState.agencyId,
      client_id: selectedClientId,
      sender_type: 'agency',
      sender_id: authState.user?.id,
      content: null,
      file_url: fileUrl,
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

<style>
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(204, 195, 216, 0.5); border-radius: 20px; }
  .bg-gradient-hero { background: linear-gradient(135deg, #630ed4 0%, #ff52a4 100%); }
  .bg-gradient-bubble { background: linear-gradient(135deg, #7c3aed 0%, #630ed4 100%); }
</style>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex flex-col overflow-hidden w-full">
  <AgencyHeader activeTab="Messages" />

  <!-- Main two-panel layout -->
  <div class="flex flex-1 overflow-hidden max-w-container-max mx-auto w-full shadow-lg bg-surface">
    <!-- Left Panel: Conversations -->
    <div class="w-full md:w-[340px] lg:w-[380px] bg-surface-container-low flex flex-col h-full border-r border-surface-variant shrink-0">
      <div class="p-4">
        <div class="bg-gradient-hero rounded-xl p-4 shadow-md text-on-primary flex justify-between items-center">
          <h1 class="font-headline-md text-headline-md">Messages</h1>
          {#if totalUnread > 0}
            <span class="bg-surface/20 text-on-primary px-3 py-1 rounded-full font-label-md text-label-md border border-surface/30 backdrop-blur-sm">{totalUnread} Unread</span>
          {/if}
        </div>
      </div>

      <div class="px-4 pb-3">
        <div class="relative group">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">search</span>
          <input class="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-outline" placeholder="Search conversations..." type="text" bind:value={searchQuery} />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-2">
        {#if filteredConversations.length === 0}
          <div class="text-center py-12 text-on-surface-variant">
            <span class="material-symbols-outlined text-4xl mb-2 block">forum</span>
            <p class="font-body-md text-body-md">No conversations yet</p>
          </div>
        {/if}
        {#each filteredConversations as conv (conv.client_id)}
          <button
            class="w-full text-left bg-surface rounded-xl p-3 flex gap-3 cursor-pointer relative shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all group focus:outline-none {conv.client_id === selectedClientId ? 'border-l-4 border-l-primary shadow-[0_10px_25px_rgba(0,0,0,0.08)]' : 'border-l-4 border-l-transparent border hover:border-surface-variant hover:shadow-[0_10px_25px_rgba(0,0,0,0.08)] opacity-75 hover:opacity-100'}"
            onclick={() => selectClient(conv.client_id)}
          >
            <div class="relative shrink-0">
              {#if conv.client_avatar}
                <img alt={conv.client_name} class="w-12 h-12 rounded-full object-cover" src={conv.client_avatar} />
              {:else}
                <div class="w-12 h-12 rounded-full flex items-center justify-center font-title-md text-title-md bg-primary-container text-on-primary-container">{initials(conv.client_name)}</div>
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-baseline mb-1">
                <h3 class="font-title-md text-title-md text-on-surface truncate pr-2">{conv.client_name}</h3>
                <span class="font-label-md text-label-md {conv.unread_count > 0 ? 'text-primary' : 'text-on-surface-variant'} shrink-0">{formatRelativeTime(conv.last_time)}</span>
              </div>
              <p class="font-body-md text-body-md {conv.unread_count > 0 ? 'text-on-surface font-medium' : 'text-on-surface-variant'} truncate">{conv.last_message || 'No messages'}</p>
            </div>
            {#if conv.client_id === selectedClientId}
              <div class="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full"></div>
            {:else if conv.unread_count > 0}
              <div class="absolute right-3 top-1/2 -translate-y-1/2 bg-primary text-on-primary w-5 h-5 rounded-full flex items-center justify-center font-label-md text-[10px]">{conv.unread_count}</div>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- Right Panel: Chat Area -->
    <div class="hidden md:flex flex-col flex-1 bg-surface relative h-full">
      {#if selectedClientId && selectedClient}
        <!-- Chat Header -->
        <div class="h-20 border-b border-surface-variant flex items-center justify-between px-6 shrink-0 bg-surface/80 backdrop-blur-md z-10">
          <div class="flex items-center gap-4">
            {#if selectedClient.client_avatar}
              <img alt={selectedClient.client_name} class="w-12 h-12 rounded-full object-cover" src={selectedClient.client_avatar} />
            {:else}
              <div class="w-12 h-12 rounded-full flex items-center justify-center font-title-md text-title-md bg-primary-container text-on-primary-container">{initials(selectedClient.client_name)}</div>
            {/if}
            <div>
              <h2 class="font-title-md text-title-md text-on-surface">{selectedClient.client_name}</h2>
              {#if selectedClient.client_company}
                <p class="font-body-md text-body-md text-on-surface-variant">{selectedClient.client_company}</p>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="w-10 h-10 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-colors focus:outline-none"><span class="material-symbols-outlined">call</span></button>
            <button class="w-10 h-10 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-colors focus:outline-none"><span class="material-symbols-outlined">videocam</span></button>
          </div>
        </div>

        <!-- Messages Area -->
        <div bind:this={messagesContainer} class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-surface-bright">
          {#each messages as msg, idx (msg.id)}
            <!-- Date separator -->
            {#if needsDateSep(messages, idx)}
              <div class="flex justify-center my-4">
                <span class="bg-surface-variant text-on-surface-variant px-3 py-1 rounded-full font-label-md text-label-md">{formatDateSep(msg.created_at)}</span>
              </div>
            {/if}

            {#if msg.sender_type === 'agency'}
              <!-- Agency message (right) -->
              <div class="flex justify-end">
                <div class="max-w-[70%]">
                  {#if msg.file_url}
                    <div class="bg-surface border border-outline-variant p-3 rounded-2xl rounded-tr-sm shadow-sm flex items-center gap-3 hover:border-primary transition-colors group">
                      <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                        <span class="material-symbols-outlined">description</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="font-title-md text-sm text-on-surface truncate">{msg.file_name || 'File'}</p>
                      </div>
                      <a href={msg.file_url} target="_blank" rel="noopener noreferrer" class="text-outline hover:text-primary transition-colors focus:outline-none"><span class="material-symbols-outlined">download</span></a>
                    </div>
                  {:else}
                    <div class="bg-gradient-bubble text-on-primary p-4 rounded-2xl rounded-tr-sm shadow-md inline-block">
                      <p class="font-body-md text-body-md">{msg.content}</p>
                    </div>
                  {/if}
                  <div class="flex justify-end mt-1 items-center gap-1">
                    <span class="font-label-md text-[10px] text-outline">{formatTime(msg.created_at)}</span>
                    <span class="material-symbols-outlined text-[14px] text-primary">done_all</span>
                  </div>
                </div>
              </div>
            {:else}
              <!-- Client message (left) -->
              <div class="flex justify-start">
                <div class="flex gap-3 max-w-[70%]">
                  {#if selectedClient.client_avatar}
                    <img alt={selectedClient.client_name} class="w-8 h-8 rounded-full object-cover shrink-0 mt-auto" src={selectedClient.client_avatar} />
                  {:else}
                    <div class="w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md bg-secondary-container text-on-secondary-container shrink-0 mt-auto">{initials(selectedClient.client_name)}</div>
                  {/if}
                  <div>
                    {#if msg.file_url}
                      <div class="bg-surface border border-outline-variant p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-3 hover:border-primary transition-colors group">
                        <div class="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary"><span class="material-symbols-outlined">description</span></div>
                        <div class="flex-1 min-w-0"><p class="font-title-md text-sm text-on-surface truncate">{msg.file_name || 'File'}</p></div>
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" class="text-outline hover:text-primary transition-colors focus:outline-none"><span class="material-symbols-outlined">download</span></a>
                      </div>
                    {:else}
                      <div class="bg-surface border border-outline-variant text-on-surface p-4 rounded-2xl rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.05)] inline-block">
                        <p class="font-body-md text-body-md">{msg.content}</p>
                      </div>
                    {/if}
                    <div class="flex justify-start mt-1"><span class="font-label-md text-[10px] text-outline">{formatTime(msg.created_at)}</span></div>
                  </div>
                </div>
              </div>
            {/if}
          {/each}

          {#if messages.length === 0}
            <div class="flex h-full items-center justify-center text-on-surface-variant font-body-md text-body-md italic opacity-70">
              <div class="text-center">
                <span class="material-symbols-outlined text-5xl mb-3 block">chat_bubble_outline</span>
                <p>No messages yet. Start the conversation!</p>
              </div>
            </div>
          {/if}
        </div>

        <!-- Input Area -->
        <div class="p-4 border-t border-surface-variant bg-surface shrink-0">
          <div class="flex items-end gap-3 bg-surface-container-low p-2 rounded-2xl border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-sm">
            <input type="file" class="hidden" bind:this={fileInput} onchange={handleFileUpload} />
            <button class="p-2 text-outline hover:text-primary transition-colors rounded-full hover:bg-surface-variant shrink-0 focus:outline-none" onclick={() => fileInput?.click()} disabled={sending}>
              <span class="material-symbols-outlined">attach_file</span>
            </button>
            <textarea
              class="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none max-h-32 min-h-[44px] py-3 font-body-md text-body-md text-on-surface placeholder:text-outline custom-scrollbar"
              oninput={(e) => { const t = e.currentTarget; t.style.height = ''; t.style.height = t.scrollHeight + 'px'; }}
              onkeydown={handleKeydown}
              placeholder="Type a message..."
              rows="1"
              bind:value={messageText}
              disabled={sending}
            ></textarea>
            <button
              class="w-11 h-11 bg-primary text-on-primary rounded-full hover:bg-primary-container hover:text-on-primary-container shadow-md flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 mb-0.5 focus:outline-none disabled:opacity-50"
              onclick={sendMessage}
              disabled={sending || !messageText.trim()}
            >
              <span class="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Empty state -->
        <div class="flex-1 flex items-center justify-center bg-surface-bright">
          <div class="text-center">
            <span class="material-symbols-outlined text-7xl text-outline-variant mb-4 block">forum</span>
            <h2 class="font-headline-md text-headline-md text-on-surface mb-2">Select a Conversation</h2>
            <p class="font-body-md text-body-md text-on-surface-variant">Choose a client from the list to start messaging</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
