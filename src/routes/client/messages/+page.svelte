<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';

  const navTabs = ['Dashboard', 'My Projects', 'Files', 'Invoices', 'Messages'];

  import { clientDataStore } from '../../../stores/clientData';

  let userMenuOpen = $state(false);
  let selectedChannel = $state<string | null>(null);
  let messageInput = $state('');
  let sending = $state(false);
  let messagesEnd: HTMLDivElement;
  let realtimeChannel: any = null;

  let agencyLogo = $derived($clientDataStore.agencyLogo);
  let agencyName = $derived($clientDataStore.agencyName || 'ClientDesk');
  let projects = $derived($clientDataStore.projects);
  let loading = $derived(!$clientDataStore.loaded);

  let messages = $derived.by(() => {
    return $clientDataStore.messages.filter(m => 
      selectedChannel === null ? m.project_id === null : m.project_id === selectedChannel
    );
  });

  function setupRealtime() {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    if (!$clientStore.client_id) return;

    realtimeChannel = supabase.channel('client_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `client_id=eq.${$clientStore.client_id}` 
      }, (payload: any) => {
        const newMsg = payload.new;
        clientDataStore.update(store => {
          if (!store.messages.find(m => m.id === newMsg.id)) {
            return { ...store, messages: [...store.messages, newMsg] };
          }
          return store;
        });
      }).subscribe();
  }

  async function sendMessage() {
    if (!messageInput.trim() || !$clientStore.client_id || !$clientStore.agency_id) return;
    sending = true;

    const { data } = await supabase.from('messages').insert({
      agency_id: $clientStore.agency_id,
      client_id: $clientStore.client_id,
      project_id: selectedChannel,
      sender_type: 'client',
      sender_id: authState.user?.id,
      content: messageInput
    }).select('*').single();

    if (data) {
      clientDataStore.update(store => {
        if (!store.messages.find(m => m.id === data.id)) {
          return { ...store, messages: [...store.messages, data] };
        }
        return store;
      });
    }
    
    messageInput = '';
    sending = false;
  }

  function selectChannel(id: string | null) {
    selectedChannel = id;
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesEnd?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  let prevMsgCount = $state(0);
  $effect(() => {
    // Automatically scroll to bottom when messages array length changes
    if (messages.length !== prevMsgCount) {
      prevMsgCount = messages.length;
      scrollToBottom();
    }
  });

  let realtimeSetupDone = false;
  $effect(() => {
    if (!authState.loading && $clientStore.client_id && !realtimeSetupDone) {
      realtimeSetupDone = true;
      setupRealtime();
    }
  });

  onDestroy(() => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  });

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/client/dashboard';
    if (tab === 'My Projects') return '/client/projects';
    if (tab === 'Files') return '/client/files';
    if (tab === 'Invoices') return '/client/invoices';
    if (tab === 'Messages') return '/client/messages';
    return '/client/dashboard';
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function needsDateSep(msgs: any[], idx: number) {
    if (idx === 0) return true;
    const prev = new Date(msgs[idx - 1].created_at).toDateString();
    const cur = new Date(msgs[idx].created_at).toDateString();
    return prev !== cur;
  }

  function formatDateSep(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function initials(name: string | null) { return name?.substring(0, 2).toUpperCase() || 'NA'; }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/client/login');
  }
</script>

<svelte:head>
  <title>Messages - Client Portal</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <!-- Top Nav -->
  <div class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
    <div class="flex items-center gap-8 w-full max-w-container-max mx-auto justify-between">
      <div class="flex items-center gap-8">
        <a href="/client/dashboard" class="flex items-center">
          {#if agencyLogo}
            <img src={agencyLogo} alt="{agencyName} Logo" class="h-8 max-w-[150px] object-contain" />
          {:else}
            <span class="font-headline-md text-headline-md font-bold text-primary">{agencyName}</span>
          {/if}
        </a>
        <nav class="hidden md:flex gap-8">
          {#each navTabs as tab}
            <a href={tabHref(tab)} class="relative font-label-md text-label-md transition-colors duration-150 py-5 focus:outline-none {tab === 'Messages' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">{tab}</a>
          {/each}
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <div class="relative">
          <button class="flex items-center active:scale-95 transition-transform duration-150 focus:outline-none bg-primary-container text-on-primary-container w-8 h-8 rounded-full border border-outline-variant justify-center font-bold text-xs" onclick={() => userMenuOpen = !userMenuOpen}>
            {initials($clientStore.full_name)}
          </button>
          {#if userMenuOpen}
            <div class="absolute right-0 top-10 w-48 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg py-2 z-50">
              <div class="px-4 py-2 border-b border-outline-variant/30">
                <p class="text-xs font-semibold text-on-surface">{$clientStore.full_name || 'Client'}</p>
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

  <!-- Main Split View -->
  <main class="flex-1 mt-16 max-w-container-max mx-auto w-full h-[calc(100vh-64px)] flex border-x border-outline-variant/10 shadow-sm bg-surface">
    {#if loading}
      <div class="w-full h-full flex items-center justify-center">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    {:else}
      <!-- Left Sidebar: Channels -->
      <div class="w-80 border-r border-outline-variant/20 flex flex-col bg-surface-container-lowest shrink-0 hidden md:flex">
        <div class="p-6 border-b border-outline-variant/20">
          <h2 class="font-display-sm font-bold text-on-surface mb-1">Messages</h2>
          <p class="text-xs text-on-surface-variant">Chat with {agencyName}</p>
        </div>
        
        <div class="flex-1 overflow-y-auto p-4 space-y-2">
          <!-- General Support Channel -->
          <button 
            class="w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 {selectedChannel === null ? 'bg-primary-container text-on-primary-container shadow-sm' : 'hover:bg-surface-variant text-on-surface-variant'}"
            onclick={() => selectChannel(null)}
          >
            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 {selectedChannel === null ? 'bg-primary text-white' : 'bg-surface border border-outline-variant/30 text-primary'}">
              <span class="material-symbols-outlined text-[20px]">support_agent</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-label-md text-sm font-bold truncate">General Support</h3>
              <p class="text-[11px] truncate opacity-80">Direct line to agency</p>
            </div>
          </button>

          {#if projects.length > 0}
            <div class="pt-4 pb-1 px-2">
              <span class="text-[10px] font-bold text-outline uppercase tracking-wider">Project Channels</span>
            </div>
            {#each projects as proj}
              <button 
                class="w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 {selectedChannel === proj.id ? 'bg-primary-container text-on-primary-container shadow-sm' : 'hover:bg-surface-variant text-on-surface-variant'}"
                onclick={() => selectChannel(proj.id)}
              >
                <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 {selectedChannel === proj.id ? 'bg-primary text-white' : 'bg-surface border border-outline-variant/30 text-on-surface-variant'}">
                  <span class="material-symbols-outlined text-[20px]">tag</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-label-md text-sm font-bold truncate">{proj.name}</h3>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Right Area: Chat Window -->
      <div class="flex-1 flex flex-col bg-surface relative">
        <!-- Chat Header -->
        <div class="h-[72px] border-b border-outline-variant/20 px-6 flex items-center justify-between shrink-0 bg-surface/80 backdrop-blur-md">
          <div class="flex items-center gap-4">
            <!-- Mobile Menu Toggle (simplified for client view, usually a drawer) -->
            <button class="md:hidden text-on-surface-variant hover:text-primary p-2">
              <span class="material-symbols-outlined">menu</span>
            </button>
            
            <div class="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined">{selectedChannel === null ? 'support_agent' : 'tag'}</span>
            </div>
            <div>
              <h2 class="font-title-md font-bold text-on-surface">
                {selectedChannel === null ? 'General Support' : projects.find(p => p.id === selectedChannel)?.name || 'Project Channel'}
              </h2>
              <p class="text-[11px] text-on-surface-variant">We usually reply within a few hours.</p>
            </div>
          </div>
        </div>

        <!-- Messages Area -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <div class="text-center py-6">
            <div class="inline-block bg-surface-variant text-on-surface-variant text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              Beginning of conversation
            </div>
          </div>

          {#each messages as msg, i (msg.id)}
            {#if needsDateSep(messages, i)}
              <div class="flex justify-center my-6">
                <span class="bg-surface-container-high text-on-surface-variant text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-outline-variant/20">
                  {formatDateSep(msg.created_at)}
                </span>
              </div>
            {/if}

            {#if msg.sender_type === 'client'}
              <!-- Client (Right) -->
              <div class="flex justify-end items-end gap-2 group">
                <div class="flex flex-col items-end max-w-[70%]">
                  <div class="bg-gradient-to-br from-[#7C3AED] to-[#9333EA] text-white px-4 py-3 rounded-2xl rounded-br-sm shadow-sm transition-transform duration-200 hover:shadow-md">
                    {#if msg.content}
                      <p class="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {/if}
                  </div>
                  <span class="text-[10px] text-outline mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity px-1">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            {:else}
              <!-- Agency (Left) -->
              <div class="flex justify-start items-end gap-3 group">
                {#if agencyLogo}
                  <img src={agencyLogo} alt="Agency" class="w-8 h-8 rounded-full border border-outline-variant/30 object-cover shrink-0 mb-5" />
                {:else}
                  <div class="w-8 h-8 rounded-full bg-primary-container text-primary flex items-center justify-center shrink-0 mb-5">
                    <span class="font-bold text-xs">{initials(agencyName)}</span>
                  </div>
                {/if}
                <div class="flex flex-col items-start max-w-[70%]">
                  <span class="text-[11px] text-on-surface-variant font-medium mb-1 pl-1">{agencyName}</span>
                  <div class="bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                    {#if msg.content}
                      <p class="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {/if}
                  </div>
                  <span class="text-[10px] text-outline mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity pl-1">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            {/if}
          {/each}
          
          {#if messages.length === 0}
            <div class="h-full flex flex-col items-center justify-center text-on-surface-variant">
              <span class="material-symbols-outlined text-6xl text-outline-variant mb-4">forum</span>
              <p class="text-sm font-semibold">No messages yet.</p>
              <p class="text-xs mt-1">Send a message to start the conversation.</p>
            </div>
          {/if}
          <div bind:this={messagesEnd} class="h-1"></div>
        </div>

        <!-- Input Area -->
        <div class="p-4 bg-surface-container-lowest border-t border-outline-variant/20 shrink-0">
          <form 
            class="flex items-center gap-3 bg-surface border border-outline-variant/40 rounded-xl p-2 shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all"
            onsubmit={(e) => { e.preventDefault(); sendMessage(); }}
          >
            <input 
              type="text" 
              bind:value={messageInput} 
              disabled={sending}
              placeholder="Type your message here..." 
              class="flex-1 bg-transparent px-3 py-2 text-sm text-on-surface focus:outline-none"
            />
            <button 
              type="submit" 
              disabled={sending || !messageInput.trim()}
              class="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-all active:scale-95 focus:outline-none"
            >
              {#if sending}
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {:else}
                <span class="material-symbols-outlined text-[18px]">send</span>
              {/if}
            </button>
          </form>
          <div class="text-center mt-2">
            <span class="text-[10px] text-outline">Press Enter to send. Messages are secure and private.</span>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>
