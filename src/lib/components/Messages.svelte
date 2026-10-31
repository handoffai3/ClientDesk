<script lang="ts">
  import { apiFetch } from '$lib/apiFetch';
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { agencyDataStore } from '../../stores/agencyData';
  import { onMount } from 'svelte';
  import type { RealtimeChannel } from '@supabase/supabase-js';

  interface Conversation {
    client_id: string;
    name: string;
    company: string;
    avatar_url: string | null;
    initials: string;
    lastMessage: string;
    lastTime: string;
    lastTimestamp: number;
    unreadCount: number;
    online: boolean;
  }

  interface Message {
    id: string;
    sender_type: 'agency' | 'client';
    sender_id: string;
    content: string | null;
    file_url: string | null;
    file_name: string | null;
    is_read: boolean;
    created_at: string;
  }

  let searchQuery = $state('');
  let selectedClientId = $state<string | null>(null);
  let messageText = $state('');
  let sending = $state(false);
  let messagesEndEl = $state<HTMLDivElement | null>(null);
  let realtimeChannel: RealtimeChannel | null = null;

  // AI Summary
  let aiSummary = $state('');
  let aiSummarizing = $state(false);
  let showSummary = $state(false);

  async function summarizeThread() {
    if (!activeClientId || chatMessages.length === 0) return;
    aiSummarizing = true;
    aiSummary = '';
    showSummary = true;
    try {
      const res = await apiFetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'messages',
          data: {
            messages: chatMessages.map(m => ({
              sender_type: m.sender_type,
              content: m.content,
              file_name: m.file_name
            }))
          }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Summarization failed');
      aiSummary = json.summary;
    } catch (err: any) {
      aiSummary = `Error: ${err.message}`;
    } finally {
      aiSummarizing = false;
    }
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

  let allMessages = $derived($agencyDataStore.messages);
  let clients = $derived($agencyDataStore.clients);

  let conversations = $derived.by(() => {
    const grouped = new Map<string, { msgs: any[]; client: any }>();

    for (const client of clients) {
      grouped.set(client.id, { msgs: [], client });
    }

    for (const msg of allMessages) {
      if (!grouped.has(msg.client_id)) {
        const clientInfo = msg.clients || { full_name: 'Unknown', avatar_url: null, company: '' };
        grouped.set(msg.client_id, {
          msgs: [],
          client: { id: msg.client_id, full_name: clientInfo.full_name, avatar_url: clientInfo.avatar_url, company: clientInfo.company || '' }
        });
      }
      grouped.get(msg.client_id)!.msgs.push(msg);
    }

    const convos: Conversation[] = [];
    for (const [clientId, { msgs, client }] of grouped) {
      if (msgs.length === 0) continue;
      const sorted = [...msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const last = sorted[0];
      const unread = msgs.filter(m => !m.is_read && m.sender_type === 'client').length;

      convos.push({
        client_id: clientId,
        name: client.full_name || 'Unknown',
        company: client.company || '',
        avatar_url: client.avatar_url || null,
        initials: (client.full_name || 'NA').substring(0, 2).toUpperCase(),
        lastMessage: last.content || (last.file_name ? `📎 ${last.file_name}` : ''),
        lastTime: formatRelativeTime(last.created_at),
        lastTimestamp: new Date(last.created_at).getTime(),
        unreadCount: unread,
        online: false
      });
    }
    convos.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    return convos;
  });

  let filteredConversations = $derived(
    conversations.filter(c => {
      const term = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(term) || c.company.toLowerCase().includes(term);
    })
  );

  let activeConversation = $derived(
    selectedClientId
      ? conversations.find(c => c.client_id === selectedClientId) || null
      : conversations[0] || null
  );

  let activeClientId = $derived(activeConversation?.client_id || null);

  let chatMessages = $derived.by(() => {
    if (!activeClientId) return [];
    return allMessages
      .filter(m => m.client_id === activeClientId)
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) as Message[];
  });

  let totalUnread = $derived(conversations.reduce((s, c) => s + c.unreadCount, 0));

  function formatRelativeTime(dateStr: string): string {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return then.toLocaleDateString('en-US', { weekday: 'short' });
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatMessageTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndEl?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  $effect(() => {
    if (chatMessages.length > 0) scrollToBottom();
  });

  $effect(() => {
    if (activeClientId) {
      markMessagesRead(activeClientId);
    }
  });

  async function markMessagesRead(clientId: string) {
    const unreadIds = allMessages
      .filter(m => m.client_id === clientId && !m.is_read && m.sender_type === 'client')
      .map(m => m.id);
    if (unreadIds.length === 0) return;

    await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
    agencyDataStore.update(s => ({
      ...s,
      messages: s.messages.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m)
    }));
  }

  async function sendMessage() {
    if (!messageText.trim() || !activeClientId || !authState.agencyId || !authState.user) return;
    sending = true;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        agency_id: authState.agencyId,
        client_id: activeClientId,
        sender_type: 'agency',
        sender_id: authState.user.id,
        content: messageText.trim(),
        is_read: false
      })
      .select('id, client_id, content, file_name, sender_type, is_read, created_at')
      .single();

    if (data) {
      const client = clients.find(c => c.id === activeClientId);
      const enriched = {
        ...data,
        clients: client ? { full_name: client.full_name, avatar_url: client.avatar_url, company: client.company } : null
      };
      agencyDataStore.update(s => ({ ...s, messages: [...s.messages, enriched] }));
      messageText = '';
    }
    if (error) { /* send failed */ }
    sending = false;
  }

  onMount(() => {
    if (!authState.agencyId) return;

    realtimeChannel = supabase
      .channel('messages-agency')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `agency_id=eq.${authState.agencyId}` },
        (payload) => {
          const newMsg = payload.new as any;
          const alreadyExists = $agencyDataStore.messages.some(m => m.id === newMsg.id);
          if (!alreadyExists) {
            const client = $agencyDataStore.clients.find(c => c.id === newMsg.client_id);
            const enriched = {
              ...newMsg,
              clients: client ? { full_name: client.full_name, avatar_url: client.avatar_url, company: client.company } : null
            };
            agencyDataStore.update(s => ({ ...s, messages: [...s.messages, enriched] }));
          }
        }
      )
      .subscribe();

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  });

  function selectConversation(clientId: string) {
    selectedClientId = clientId;
  }
</script>


<div class="fixed top-14 left-0 right-0 bottom-0 bg-background overflow-hidden animate-fadeIn flex justify-center z-10">
  <div class="flex w-full h-full max-w-container-max bg-white border-x border-outline-variant">
    <div class="w-full md:w-[320px] lg:w-[360px] bg-surface-container-low flex flex-col h-full border-r border-outline-variant shrink-0">
      <div class="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
        <h1 class="text-[15px] font-semibold text-on-surface">Messages</h1>
        {#if totalUnread > 0}
          <span class="bg-primary text-white px-2 py-0.5 rounded-md text-[11px] font-medium">{totalUnread}</span>
        {/if}
      </div>

      <div class="px-4 py-2.5">
        <div class="relative">
          <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input class="w-full pl-9 pr-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-outline" placeholder="Search conversations..." type="text" bind:value={searchQuery}/>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {#if filteredConversations.length === 0}
          <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant">
            <span class="material-symbols-outlined text-[28px] mb-2 text-outline">forum</span>
            <p class="text-sm">No conversations yet</p>
          </div>
        {:else}
          {#each filteredConversations as chat (chat.client_id)}
            <button
              class="w-full text-left rounded-lg p-2.5 flex gap-2.5 cursor-pointer relative transition-colors focus:outline-none {chat.client_id === activeClientId ? 'bg-primary/[0.06]' : 'hover:bg-surface-container'}"
              onclick={() => selectConversation(chat.client_id)}
            >
              <div class="relative shrink-0">
                {#if chat.avatar_url}
                  <img alt={chat.name} class="w-9 h-9 rounded-full object-cover" src={chat.avatar_url}/>
                {:else}
                  <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium bg-primary/10 text-primary">
                    {chat.initials}
                  </div>
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline mb-0.5">
                  <h3 class="text-sm font-medium text-on-surface truncate pr-2">{chat.name}</h3>
                  <span class="text-[11px] {chat.unreadCount > 0 ? 'text-primary font-medium' : 'text-outline'} shrink-0">{chat.lastTime}</span>
                </div>
                <p class="text-[13px] {chat.unreadCount > 0 ? 'text-on-surface font-medium' : 'text-on-surface-variant'} truncate">{chat.lastMessage}</p>
              </div>
              {#if chat.unreadCount > 0 && chat.client_id !== activeClientId}
                <div class="absolute right-2.5 top-1/2 -translate-y-1/2 bg-primary text-white w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-medium">{chat.unreadCount}</div>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Right Panel: Chat Area -->
    <div class="hidden md:flex flex-col flex-1 bg-white relative h-full">
      {#if activeConversation}
        <div class="h-14 border-b border-outline-variant flex items-center justify-between px-5 shrink-0 bg-white z-10">
          <div class="flex items-center gap-3">
            {#if activeConversation.avatar_url}
              <img alt={activeConversation.name} class="w-8 h-8 rounded-full object-cover" src={activeConversation.avatar_url}/>
            {:else}
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-primary/10 text-primary">
                {activeConversation.initials}
              </div>
            {/if}
            <div>
              <h2 class="text-sm font-medium text-on-surface">{activeConversation.name}</h2>
              {#if activeConversation.company}
                <p class="text-xs text-on-surface-variant">{activeConversation.company}</p>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button
              onclick={summarizeThread}
              disabled={aiSummarizing || chatMessages.length === 0}
              class="w-8 h-8 rounded-lg hover:bg-tertiary/[0.08] flex items-center justify-center text-tertiary transition-colors focus:outline-none disabled:opacity-40"
              title="AI Summarize"
            >
              <span class="material-symbols-outlined text-[18px] {aiSummarizing ? 'animate-spin' : ''}">auto_awesome</span>
            </button>
            <button class="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors focus:outline-none">
              <span class="material-symbols-outlined text-[18px]">more_vert</span>
            </button>
          </div>
        </div>

        {#if showSummary}
          <div class="border-b border-outline-variant bg-tertiary/[0.04] px-5 py-2.5 shrink-0">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-2 flex-1 min-w-0">
                <span class="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">auto_awesome</span>
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] text-tertiary font-medium mb-0.5">AI Summary</p>
                  {#if aiSummarizing}
                    <p class="text-sm text-on-surface-variant">Generating summary...</p>
                  {:else}
                    <p class="text-sm text-on-surface whitespace-pre-wrap">{aiSummary}</p>
                  {/if}
                </div>
              </div>
              <button onclick={() => { showSummary = false; }} class="text-on-surface-variant hover:text-on-surface shrink-0">
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        {/if}

        <!-- Messages Area -->
        <div class="flex-1 overflow-y-auto p-5 space-y-3 bg-surface-container-low pb-24">
          {#if chatMessages.length === 0}
            <div class="flex h-full items-center justify-center text-on-surface-variant">
              <div class="text-center">
                <span class="material-symbols-outlined text-[28px] mb-2 block text-outline">chat_bubble_outline</span>
                <p class="text-sm">No messages yet. Start the conversation!</p>
              </div>
            </div>
          {:else}
            {#each chatMessages as msg (msg.id)}
              {#if msg.sender_type === 'agency'}
                <div class="flex justify-end">
                  <div class="max-w-[70%]">
                    {#if msg.content}
                      <div class="bg-primary text-white p-3 rounded-lg rounded-tr-sm shadow-xs inline-block">
                        <p class="text-sm">{msg.content}</p>
                      </div>
                    {/if}
                    {#if msg.file_name}
                      <div class="bg-white border border-outline-variant p-2.5 rounded-lg rounded-tr-sm shadow-xs flex items-center gap-2.5 mt-1">
                        <div class="w-8 h-8 rounded-lg bg-primary/[0.06] flex items-center justify-center text-primary">
                          <span class="material-symbols-outlined text-[18px]">attach_file</span>
                        </div>
                        <p class="flex-1 min-w-0 text-sm text-on-surface truncate">{msg.file_name}</p>
                        {#if msg.file_url}
                          <button onclick={() => downloadMsgFile(msg.id)} class="text-outline hover:text-primary transition-colors">
                            <span class="material-symbols-outlined text-[18px]">download</span>
                          </button>
                        {/if}
                      </div>
                    {/if}
                    <div class="flex justify-end mt-0.5 items-center gap-1">
                      <span class="text-[10px] text-outline">{formatMessageTime(msg.created_at)}</span>
                      <span class="material-symbols-outlined text-[12px] {msg.is_read ? 'text-primary' : 'text-outline'}">done_all</span>
                    </div>
                  </div>
                </div>
              {:else}
                <div class="flex justify-start">
                  <div class="flex gap-2 max-w-[70%]">
                    {#if activeConversation.avatar_url}
                      <img alt={activeConversation.name} class="w-7 h-7 rounded-full object-cover shrink-0 mt-auto" src={activeConversation.avatar_url}/>
                    {:else}
                      <div class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium bg-secondary/10 text-secondary shrink-0 mt-auto">
                        {activeConversation.initials.substring(0, 1)}
                      </div>
                    {/if}
                    <div>
                      {#if msg.content}
                        <div class="bg-white border border-outline-variant text-on-surface p-3 rounded-lg rounded-tl-sm shadow-xs inline-block">
                          <p class="text-sm">{msg.content}</p>
                        </div>
                      {/if}
                      {#if msg.file_name}
                        <div class="bg-white border border-outline-variant p-2.5 rounded-lg rounded-tl-sm shadow-xs flex items-center gap-2.5 mt-1">
                          <div class="w-8 h-8 rounded-lg bg-secondary/[0.06] flex items-center justify-center text-secondary">
                            <span class="material-symbols-outlined text-[18px]">attach_file</span>
                          </div>
                          <p class="flex-1 min-w-0 text-sm text-on-surface truncate">{msg.file_name}</p>
                          {#if msg.file_url}
                            <button onclick={() => downloadMsgFile(msg.id)} class="text-outline hover:text-primary transition-colors">
                              <span class="material-symbols-outlined text-[18px]">download</span>
                            </button>
                          {/if}
                        </div>
                      {/if}
                      <div class="flex justify-start mt-0.5">
                        <span class="text-[10px] text-outline">{formatMessageTime(msg.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
          <div bind:this={messagesEndEl}></div>
        </div>

        <!-- Input Area -->
        <div class="p-3 border-t border-outline-variant bg-white shrink-0 absolute bottom-0 left-0 right-0 z-10">
          <form
            onsubmit={(e) => { e.preventDefault(); sendMessage(); }}
            class="flex items-end gap-2 bg-surface-container-low p-1.5 rounded-lg border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors"
          >
            <button type="button" class="p-1.5 text-outline hover:text-primary transition-colors rounded-lg hover:bg-surface-container shrink-0">
              <span class="material-symbols-outlined text-[20px]">attach_file</span>
            </button>
            <textarea
              class="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none max-h-28 min-h-[36px] py-2 text-sm text-on-surface placeholder:text-outline"
              oninput={(e) => { e.currentTarget.style.height = ''; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px' }}
              onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type a message..."
              rows="1"
              bind:value={messageText}
              disabled={sending}
            ></textarea>
            <button
              type="submit"
              disabled={sending || !messageText.trim()}
              class="w-9 h-9 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center justify-center shrink-0 transition-colors disabled:opacity-40"
            >
              <span class="material-symbols-outlined text-[18px]">send</span>
            </button>
          </form>
        </div>
      {:else}
        <div class="flex h-full items-center justify-center text-on-surface-variant bg-surface-container-low">
          <div class="text-center">
            <span class="material-symbols-outlined text-[32px] mb-3 block text-outline">forum</span>
            <h3 class="text-sm font-medium text-on-surface mb-1">No conversations</h3>
            <p class="text-[13px] text-on-surface-variant">Messages with clients will appear here</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
