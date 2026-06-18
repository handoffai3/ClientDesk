<script lang="ts">
  let searchQuery = $state('');

  const conversations = [
    {
      id: 1,
      name: 'Sarah Jenkins',
      time: '10:42 AM',
      preview: "I've reviewed the latest design files...",
      unread: 0,
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtUZMpzg__SIQrNcsHCqVmJd2PKi2M_TKuqVvxrobkhcemH5lV4_Xum7iSitpdT52QjKPG7OOHYb2EfncWtX4229Mbwbmq-oa7_5EK4mdsq3VleXHyxkNwWGkPh_3WLOLrjEv1f8yPnoOnSvPNhJq0lQ3IRVJ4bI5Q8EEdyqRB3ivUMiJe9-FczW3C1_XM1k7J3NgL1Tdj5yPzoG1r1jT1n9JyezS4Yu4nzscQSGK9el_OfiG0yM6bwPo3w6TG5-OSZ3EijrPcwQhd',
      active: true,
      online: true
    },
    {
      id: 2,
      name: 'Michael Ross',
      time: 'Yesterday',
      preview: 'Can we schedule a quick call to disc...',
      unread: 2,
      initials: 'MR',
      theme: 'bg-secondary-container text-on-secondary-container',
      active: false,
      online: false
    },
    {
      id: 3,
      name: 'David Chen',
      time: 'Tue',
      preview: 'The invoice has been processed. Thanks.',
      unread: 0,
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkCflhiI82bQPxjNJmSgzNA4Jp8CCWLaN2QUW9MtvylDv4yeKc-hl_BSvAjzOBmVpNiRA0IVCZBek4oVs616SHuhklN09YMlg_Ki1BFN8C1kY7t5DcGYg9Bmv_rnppsPgk_issNzVowVeEfuOnJR17b0bFFA16nTV3m1uWF-1WJrP2lojvyg5HbtW6sBH73wlKh_djRTDquTfDvBG2w-6s7-lf7t5PoGa_00zVCoFCzUXJt2V6zBieN3bIpKB1b8hjH0QL5Xa63eQh',
      active: false,
      online: false
    },
    {
      id: 4,
      name: 'Emma Larson',
      time: 'Mon',
      preview: 'Looking forward to the kickoff meeting!',
      unread: 0,
      initials: 'EL',
      theme: 'bg-tertiary-container text-on-tertiary-container',
      active: false,
      online: false
    }
  ];

  let selectedChatId = $state(1);

  // Derive the currently selected conversation to display in the header
  let activeConversation = $derived(conversations.find(c => c.id === selectedChatId) || conversations[0]);
  
</script>

<style>
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(204, 195, 216, 0.5); border-radius: 20px; }
  .bg-gradient-hero { background: linear-gradient(135deg, #630ed4 0%, #ff52a4 100%); }
  .bg-gradient-bubble { background: linear-gradient(135deg, #7c3aed 0%, #630ed4 100%); }
</style>

<div class="fixed top-16 left-0 right-0 bottom-0 bg-background overflow-hidden animate-fadeIn flex justify-center z-10">
  <div class="flex w-full h-full max-w-container-max shadow-ambient bg-surface">
    <!-- Left Panel: Conversations -->
    <div class="w-full md:w-[320px] lg:w-[380px] bg-surface-container-low flex flex-col h-full border-r border-surface-variant shrink-0">
      <!-- Hero Header -->
      <div class="p-base">
        <div class="bg-gradient-hero rounded-xl p-stack-sm shadow-md text-on-primary flex justify-between items-center">
          <h1 class="font-headline-md text-headline-md">Messages</h1>
          <span class="bg-surface/20 text-on-primary px-3 py-1 rounded-full font-label-md text-label-md border border-surface/30 backdrop-blur-sm">3 Unread</span>
        </div>
      </div>
      
      <!-- Search -->
      <div class="px-base pb-base">
        <div class="relative group">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">search</span>
          <input class="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-outline" placeholder="Search conversations..." type="text" bind:value={searchQuery}/>
        </div>
      </div>
      
      <!-- Conversation List -->
      <div class="flex-1 overflow-y-auto custom-scrollbar px-base pb-base space-y-2">
        {#each conversations.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())) as chat}
          <div 
            class="bg-surface rounded-xl p-3 flex gap-3 cursor-pointer relative shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all group {chat.id === selectedChatId ? 'border-l-4 border-l-primary shadow-[0_10px_25px_rgba(0,0,0,0.08)]' : 'border-l-4 border-l-transparent border hover:border-surface-variant hover:shadow-[0_10px_25px_rgba(0,0,0,0.08)] opacity-75 hover:opacity-100'}"
            onclick={() => selectedChatId = chat.id}
          >
            <div class="relative shrink-0">
              {#if chat.avatar}
                <img alt={chat.name} class="w-12 h-12 rounded-full object-cover" src={chat.avatar}/>
              {:else}
                <div class="w-12 h-12 rounded-full flex items-center justify-center font-title-md text-title-md {chat.theme}">
                  {chat.initials}
                </div>
              {/if}
              {#if chat.online}
                <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface"></div>
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-baseline mb-1">
                <h3 class="font-title-md text-title-md text-on-surface truncate pr-2">{chat.name}</h3>
                <span class="font-label-md text-label-md {chat.unread > 0 ? 'text-primary' : 'text-on-surface-variant'} shrink-0">{chat.time}</span>
              </div>
              <p class="font-body-md text-body-md {chat.unread > 0 ? 'text-on-surface font-medium' : 'text-on-surface-variant'} truncate">{chat.preview}</p>
            </div>
            {#if chat.id === selectedChatId}
              <div class="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full"></div>
            {:else if chat.unread > 0}
              <div class="absolute right-3 top-1/2 -translate-y-1/2 bg-primary text-on-primary w-5 h-5 rounded-full flex items-center justify-center font-label-md text-[10px]">{chat.unread}</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
    
    <!-- Right Panel: Chat Area -->
    <div class="hidden md:flex flex-col flex-1 bg-surface relative h-full">
      <!-- Chat Header -->
      <div class="h-20 border-b border-surface-variant flex items-center justify-between px-gutter shrink-0 bg-surface/80 backdrop-blur-md z-10">
        <div class="flex items-center gap-4">
          <div class="relative">
            {#if activeConversation.avatar}
              <img alt={activeConversation.name} class="w-12 h-12 rounded-full object-cover" src={activeConversation.avatar}/>
            {:else}
              <div class="w-12 h-12 rounded-full flex items-center justify-center font-title-md text-title-md {activeConversation.theme}">
                {activeConversation.initials}
              </div>
            {/if}
            {#if activeConversation.online}
              <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface"></div>
            {/if}
          </div>
          <div>
            <h2 class="font-title-md text-title-md text-on-surface">{activeConversation.name}</h2>
            <p class="font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
              {#if activeConversation.online}
                <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Online
              {:else}
                <span class="w-2 h-2 rounded-full bg-outline inline-block"></span> Offline
              {/if}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="w-10 h-10 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-colors focus:outline-none">
            <span class="material-symbols-outlined">call</span>
          </button>
          <button class="w-10 h-10 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-colors focus:outline-none">
            <span class="material-symbols-outlined">videocam</span>
          </button>
          <button class="w-10 h-10 rounded-full hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-colors focus:outline-none">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </div>
      
      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto custom-scrollbar p-gutter space-y-6 bg-surface-bright pb-24">
        {#if selectedChatId === 1}
          <!-- Date Divider -->
          <div class="flex justify-center my-4">
            <span class="bg-surface-variant text-on-surface-variant px-3 py-1 rounded-full font-label-md text-label-md">Today, 9:00 AM</span>
          </div>
          
          <!-- Agency Message (Right) -->
          <div class="flex justify-end animate-fadeIn" style="animation-delay: 50ms;">
            <div class="max-w-[70%]">
              <div class="bg-gradient-bubble text-on-primary p-4 rounded-2xl rounded-tr-sm shadow-md inline-block">
                <p class="font-body-md text-body-md">Hi Sarah! I've uploaded the initial wireframes for the new dashboard to the project folder. Let me know what you think when you have a moment.</p>
              </div>
              <div class="flex justify-end mt-1 items-center gap-1">
                <span class="font-label-md text-[10px] text-outline">9:05 AM</span>
                <span class="material-symbols-outlined text-[14px] text-primary">done_all</span>
              </div>
            </div>
          </div>
          
          <!-- Agency Attachment (Right) -->
          <div class="flex justify-end animate-fadeIn" style="animation-delay: 100ms;">
            <div class="max-w-[70%] w-64">
              <div class="bg-surface border border-outline-variant p-3 rounded-2xl rounded-tr-sm shadow-sm flex items-center gap-3 hover:border-primary transition-colors cursor-pointer group">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <span class="material-symbols-outlined">design_services</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-title-md text-sm text-on-surface truncate">Dashboard_v1.fig</p>
                  <p class="font-label-md text-label-md text-on-surface-variant">4.2 MB</p>
                </div>
                <button class="text-outline hover:text-primary transition-colors focus:outline-none">
                  <span class="material-symbols-outlined">download</span>
                </button>
              </div>
              <div class="flex justify-end mt-1 items-center gap-1">
                <span class="font-label-md text-[10px] text-outline">9:06 AM</span>
                <span class="material-symbols-outlined text-[14px] text-primary">done_all</span>
              </div>
            </div>
          </div>
          
          <!-- Client Message (Left) -->
          <div class="flex justify-start animate-fadeIn" style="animation-delay: 150ms;">
            <div class="flex gap-3 max-w-[70%]">
              <img alt="Sarah Jenkins" class="w-8 h-8 rounded-full object-cover shrink-0 mt-auto" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDC91vk8OLL-6PzJdJkBX-ZIQnr7S_lVQ0NQS2O_tMXuys3DvhkQuQGMjB5o375kgTtXABBgWgE8ZmQchGl0g1ErMu2Jix-7SIyZ3AGkglJPMtI7IV9FT7LKvPD0DPhU9Ykhyl6KROysZJmi-1HwO-fXhpIYnHok_FzCHdRxdEj0-CTDuzAvLOt4Fuo6G9TBOUHH0CXifwT9HaMEfRygChVA3kehqJ9Ny4PH8LT29pvboU_1sk0GpPQ46yA5rJvnszDSpdgAfOYXkmp"/>
              <div>
                <div class="bg-surface border border-outline-variant text-on-surface p-4 rounded-2xl rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.05)] inline-block">
                  <p class="font-body-md text-body-md">Thanks! I'm taking a look right now. The overall layout is fantastic.</p>
                </div>
                <div class="flex justify-start mt-1">
                  <span class="font-label-md text-[10px] text-outline">10:30 AM</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Client Message (Left) -->
          <div class="flex justify-start animate-fadeIn" style="animation-delay: 200ms;">
            <div class="flex gap-3 max-w-[70%]">
              <div class="w-8 shrink-0"></div> <!-- Spacer for alignment -->
              <div>
                <div class="bg-surface border border-outline-variant text-on-surface p-4 rounded-2xl rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.05)] inline-block">
                  <p class="font-body-md text-body-md">I've reviewed the latest design files. One small note: can we adjust the padding on the summary cards? They feel a bit tight on mobile.</p>
                </div>
                <div class="flex justify-start mt-1">
                  <span class="font-label-md text-[10px] text-outline">10:42 AM</span>
                </div>
              </div>
            </div>
          </div>
        {:else}
          <div class="flex h-full items-center justify-center text-on-surface-variant font-body-md text-body-md italic opacity-70">
            No active conversation messages to display yet.
          </div>
        {/if}
      </div>
      
      <!-- Input Area -->
      <div class="p-gutter border-t border-surface-variant bg-surface shrink-0 absolute bottom-0 left-0 right-0 z-10">
        <div class="flex items-end gap-3 bg-surface-container-low p-2 rounded-2xl border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-sm">
          <button class="p-2 text-outline hover:text-primary transition-colors rounded-full hover:bg-surface-variant shrink-0 focus:outline-none">
            <span class="material-symbols-outlined">attach_file</span>
          </button>
          <textarea class="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 font-body-md text-body-md text-on-surface placeholder:text-outline custom-scrollbar" oninput={(e) => { e.currentTarget.style.height = ''; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px' }} placeholder="Type a message..." rows="1"></textarea>
          <button class="p-2 text-outline hover:text-primary transition-colors rounded-full hover:bg-surface-variant shrink-0 mb-1 focus:outline-none">
            <span class="material-symbols-outlined">sentiment_satisfied</span>
          </button>
          <button class="w-11 h-11 bg-primary text-on-primary rounded-full hover:bg-primary-container hover:text-on-primary-container shadow-md flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 mb-0.5 focus:outline-none">
            <span class="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
