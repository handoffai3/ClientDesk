<script lang="ts">
  let activeTab = $state('My Projects');
  const tabs = ['My Projects', 'Files', 'Invoices', 'Messages'];
</script>

<svelte:head>
  <title>Client View - ClientDesk</title>
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <script>
    document.documentElement.classList.add('light');
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          "colors": {
            "primary": "#630ed4",
            "on-tertiary": "#ffffff",
            "on-secondary-fixed-variant": "#004395",
            "on-tertiary-fixed-variant": "#713700",
            "tertiary-fixed": "#ffdcc6",
            "tertiary-container": "#a15100",
            "surface-container-low": "#f9f1ff",
            "secondary-container": "#2170e4",
            "inverse-on-surface": "#f6eefc",
            "on-primary-fixed-variant": "#5a00c6",
            "surface-variant": "#e8dfee",
            "surface-container-highest": "#e8dfee",
            "surface-bright": "#fef7ff",
            "on-tertiary-container": "#ffe0cd",
            "surface-container": "#f3ebfa",
            "on-tertiary-fixed": "#301400",
            "error-container": "#ffdad6",
            "secondary-fixed-dim": "#adc6ff",
            "on-secondary": "#ffffff",
            "outline-variant": "#ccc3d8",
            "inverse-primary": "#d2bbff",
            "on-error": "#ffffff",
            "error": "#ba1a1a",
            "surface-container-lowest": "#ffffff",
            "background": "#fef7ff",
            "primary-fixed": "#eaddff",
            "tertiary": "#7d3d00",
            "on-error-container": "#93000a",
            "surface": "#fef7ff",
            "on-primary-fixed": "#25005a",
            "on-surface-variant": "#4a4455",
            "primary-container": "#7c3aed",
            "inverse-surface": "#332f39",
            "on-primary": "#ffffff",
            "outline": "#7b7487",
            "on-secondary-fixed": "#001a42",
            "tertiary-fixed-dim": "#ffb784",
            "on-secondary-container": "#fefcff",
            "surface-dim": "#dfd7e6",
            "primary-fixed-dim": "#d2bbff",
            "surface-container-high": "#ede5f4",
            "surface-tint": "#732ee4",
            "on-background": "#1d1a24",
            "on-surface": "#1d1a24",
            "on-primary-container": "#ede0ff",
            "secondary": "#0058be",
            "secondary-fixed": "#d8e2ff"
          },
          "borderRadius": {
            "DEFAULT": "0.25rem",
            "lg": "0.5rem",
            "xl": "0.75rem",
            "full": "9999px"
          },
          "spacing": {
            "margin-desktop": "32px",
            "base": "8px",
            "stack-md": "24px",
            "margin-mobile": "16px",
            "container-max": "1280px",
            "gutter": "24px",
            "stack-sm": "12px",
            "stack-lg": "48px"
          },
          "fontFamily": {
            "body-lg": ["Inter"],
            "title-md": ["Inter"],
            "headline-md": ["Inter"],
            "label-md": ["Inter"],
            "display-lg": ["Inter"],
            "headline-lg": ["Inter"],
            "body-md": ["Inter"],
            "headline-lg-mobile": ["Inter"]
          },
          "fontSize": {
            "body-lg": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
            "title-md": ["18px", { "lineHeight": "24px", "fontWeight": "600" }],
            "headline-md": ["24px", { "lineHeight": "32px", "fontWeight": "600" }],
            "label-md": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600" }],
            "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
            "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
            "body-md": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
            "headline-lg-mobile": ["24px", { "lineHeight": "32px", "fontWeight": "600" }]
          }
        }
      }
    };
  </script>
</svelte:head>

<style>
  .glass-panel {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.3);
  }
  .hero-gradient {
      background: linear-gradient(135deg, #630ed4 0%, #ec4899 100%);
  }
  .shadow-ambient {
      box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.05);
  }
  .shadow-hover:hover {
      box-shadow: 0px 10px 25px rgba(0, 0, 0, 0.08);
      transform: translateY(-2px);
  }
  
  /* Hide scrollbar for kanban tracks */
  .kanban-track::-webkit-scrollbar {
      display: none;
  }
  .kanban-track {
      -ms-overflow-style: none;
      scrollbar-width: none;
  }
</style>

<div class="bg-background text-on-background font-body-md min-h-screen flex flex-col">
  <!-- TopNavBar -->
  <nav class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 max-w-container-max mx-auto bg-surface/90 dark:bg-surface-dim/90 backdrop-blur-xl shadow-sm">
    <div class="flex items-center gap-8">
      <div class="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed-dim">ClientDesk</div>
      <div class="hidden md:flex items-center gap-[32px]">
        {#each tabs as tab}
          <button 
            onclick={() => activeTab = tab}
            class="font-body-md text-body-md transition-all duration-200 active:scale-95 focus:outline-none {activeTab === tab ? 'text-primary dark:text-primary-fixed-dim font-semibold border-b-2 border-primary pb-1' : 'text-on-surface-variant dark:text-outline-variant hover:text-primary hover:opacity-80'}"
          >
            {tab}
          </button>
        {/each}
      </div>
    </div>
    <div class="flex items-center gap-4">
      <button class="text-on-surface-variant hover:text-primary hover:opacity-80 transition-opacity duration-200 active:scale-95 focus:outline-none">
        <span class="material-symbols-outlined">notifications</span>
      </button>
      <div class="w-8 h-8 rounded-full overflow-hidden bg-surface-variant">
        <img alt="User profile avatar" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrVCAxUD8MyEZSwNGYkZn564jBiMUZEekjWnEHYllgbcvaDYfl4yK5xwaKrWx5oyPyJ0SpnWT85YjTIWpUd2WJmOIOMdnJo9HENZAnbt5KJuvyAM5vCbOwANbAFzTOZAzDPxzT_XJVKglpilk_-YdV8DvMgV-5MCI69iLENKmZasc-bznZASur0mSmKb9ojriJiE02yim-8CdqTCVLR6rDTWL0QKd26wmWdjTNzjxP8C_5oinNiH6ccEFkUCPz-31WFpO6jelEJT2Q"/>
      </div>
    </div>
  </nav>

  <!-- Main Content Canvas -->
  <main class="flex-1 max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop pt-24 pb-12 overflow-x-hidden">
    {#if activeTab === 'My Projects'}
      <div class="animate-fadeIn">
        <!-- Hero Card -->
        <section class="hero-gradient rounded-xl p-8 mb-stack-md text-white shadow-ambient relative overflow-hidden">
          <!-- Decorative element -->
          <div class="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 class="font-headline-lg text-headline-lg mb-2">Welcome, John 👋</h1>
              <p class="font-body-lg text-body-lg text-white/90">Here is an overview of your active engagements.</p>
            </div>
            
            <div class="glass-panel rounded-lg p-4 w-full md:w-auto min-w-[280px]">
              <div class="flex justify-between items-center mb-2">
                <span class="font-label-md text-label-md text-white/90 uppercase tracking-wider">Current Project Progress</span>
                <span class="font-label-md text-label-md font-bold text-white">68%</span>
              </div>
              <div class="w-full bg-black/20 rounded-full h-2">
                <div class="bg-white h-2 rounded-full" style="width: 68%"></div>
              </div>
              <p class="font-label-md text-label-md text-white/80 mt-2">Website Redesign - Phase 2</p>
            </div>
          </div>
        </section>

        <!-- Metrics Row -->
        <section class="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-lg">
          <!-- Active Projects -->
          <div class="bg-surface rounded-xl p-6 shadow-ambient border-l-4 border-secondary-container flex items-center justify-between">
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Active Projects</p>
              <p class="font-headline-md text-headline-md text-on-surface">2</p>
            </div>
            <div class="w-12 h-12 rounded-full bg-secondary-container/10 flex items-center justify-center text-secondary-container">
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">dashboard</span>
            </div>
          </div>
          
          <!-- Files Available -->
          <div class="bg-surface rounded-xl p-6 shadow-ambient border-l-4 border-green-500 flex items-center justify-between">
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Files Available</p>
              <p class="font-headline-md text-headline-md text-on-surface">14</p>
            </div>
            <div class="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">folder_open</span>
            </div>
          </div>
          
          <!-- Invoices Due -->
          <div class="bg-surface rounded-xl p-6 shadow-ambient border-l-4 border-orange-500 flex items-center justify-between">
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Invoices Due</p>
              <p class="font-headline-md text-headline-md text-on-surface">1</p>
            </div>
            <div class="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600">
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">receipt_long</span>
            </div>
          </div>
        </section>

        <!-- Kanban Structure -->
        <section class="flex flex-col md:flex-row gap-gutter overflow-x-auto kanban-track pb-4 items-start">
          <!-- Column: My Projects -->
          <div class="flex-none w-full md:w-[320px] bg-surface-container-low rounded-xl p-4 flex flex-col gap-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-title-md text-title-md text-on-surface">My Projects</h2>
              <span class="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded-full font-label-md text-label-md">2</span>
            </div>
            
            <!-- Card 1 -->
            <div class="bg-surface rounded-xl p-4 shadow-ambient shadow-hover transition-all cursor-pointer border border-outline-variant/30">
              <div class="flex justify-between items-start mb-3">
                <span class="bg-secondary-container text-white px-2 py-1 rounded font-label-md text-label-md">In Progress</span>
                <button class="text-on-surface-variant hover:text-primary focus:outline-none"><span class="material-symbols-outlined text-[20px]">more_horiz</span></button>
              </div>
              <h3 class="font-title-md text-title-md text-on-surface mb-1">Website Redesign</h3>
              <p class="font-body-md text-body-md text-on-surface-variant mb-4">Phase 2: Development & Integration</p>
              <div class="space-y-2">
                <div class="flex justify-between items-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Progress</span>
                  <span class="font-label-md text-label-md text-on-surface font-semibold">68%</span>
                </div>
                <div class="w-full bg-surface-variant rounded-full h-1.5">
                  <div class="bg-primary h-1.5 rounded-full" style="width: 68%"></div>
                </div>
              </div>
            </div>
            
            <!-- Card 2 -->
            <div class="bg-surface rounded-xl p-4 shadow-ambient shadow-hover transition-all cursor-pointer border border-outline-variant/30">
              <div class="flex justify-between items-start mb-3">
                <span class="bg-surface-variant text-on-surface-variant px-2 py-1 rounded font-label-md text-label-md">Planning</span>
                <button class="text-on-surface-variant hover:text-primary focus:outline-none"><span class="material-symbols-outlined text-[20px]">more_horiz</span></button>
              </div>
              <h3 class="font-title-md text-title-md text-on-surface mb-1">Q3 Marketing Campaign</h3>
              <p class="font-body-md text-body-md text-on-surface-variant mb-4">Asset gathering and timeline estimation.</p>
              <div class="space-y-2">
                <div class="flex justify-between items-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Progress</span>
                  <span class="font-label-md text-label-md text-on-surface font-semibold">15%</span>
                </div>
                <div class="w-full bg-surface-variant rounded-full h-1.5">
                  <div class="bg-primary h-1.5 rounded-full" style="width: 15%"></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Column: Recent Files -->
          <div class="flex-none w-full md:w-[320px] bg-surface-container-low rounded-xl p-4 flex flex-col gap-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-title-md text-title-md text-on-surface">Recent Files</h2>
              <span class="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded-full font-label-md text-label-md">14</span>
            </div>
            
            <!-- File Card 1 -->
            <div class="bg-surface rounded-xl p-4 shadow-ambient shadow-hover transition-all flex flex-col gap-3 border border-outline-variant/30">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined">picture_as_pdf</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-title-md text-title-md text-on-surface truncate text-[14px]">Q2_Financial_Report_Final.pdf</h3>
                  <p class="font-label-md text-label-md text-on-surface-variant">2.4 MB • Updated Today</p>
                </div>
              </div>
              <button class="w-full bg-surface-variant hover:bg-surface-dim text-on-surface font-label-md text-label-md py-2 rounded transition-colors flex items-center justify-center gap-2 focus:outline-none">
                <span class="material-symbols-outlined text-[16px]">download</span> Download
              </button>
            </div>
            
            <!-- File Card 2 -->
            <div class="bg-surface rounded-xl p-4 shadow-ambient shadow-hover transition-all flex flex-col gap-3 border border-outline-variant/30">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined">image</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-title-md text-title-md text-on-surface truncate text-[14px]">Hero_Banner_V3_Approved.png</h3>
                  <p class="font-label-md text-label-md text-on-surface-variant">8.1 MB • Yesterday</p>
                </div>
              </div>
              <button class="w-full bg-surface-variant hover:bg-surface-dim text-on-surface font-label-md text-label-md py-2 rounded transition-colors flex items-center justify-center gap-2 focus:outline-none">
                <span class="material-symbols-outlined text-[16px]">download</span> Download
              </button>
            </div>
          </div>
          
          <!-- Column: Invoices -->
          <div class="flex-none w-full md:w-[320px] bg-surface-container-low rounded-xl p-4 flex flex-col gap-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-title-md text-title-md text-on-surface">Invoices</h2>
              <span class="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded-full font-label-md text-label-md">Recent</span>
            </div>
            
            <!-- Invoice Card 1 (Pending) -->
            <div class="bg-surface rounded-xl p-4 shadow-ambient shadow-hover transition-all border border-orange-200">
              <div class="flex justify-between items-start mb-2">
                <span class="bg-orange-100 text-orange-700 px-2 py-1 rounded font-label-md text-label-md font-bold">Pending</span>
                <span class="font-label-md text-label-md text-on-surface-variant">Due in 3 days</span>
              </div>
              <h3 class="font-title-md text-title-md text-on-surface">INV-2023-089</h3>
              <p class="font-body-md text-body-md text-on-surface-variant mb-3">Website Development Milestone 1</p>
              <div class="flex items-center justify-between mb-4">
                <span class="font-label-md text-label-md text-on-surface-variant">Amount</span>
                <span class="font-title-md text-title-md text-on-surface">$4,500.00</span>
              </div>
              <button class="w-full bg-primary hover:bg-primary/90 text-white font-label-md text-label-md py-2.5 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 focus:outline-none">
                Pay Now <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
            
            <!-- Invoice Card 2 (Paid) -->
            <div class="bg-surface rounded-xl p-4 shadow-ambient shadow-hover transition-all border border-outline-variant/30 opacity-75">
              <div class="flex justify-between items-start mb-2">
                <span class="bg-green-100 text-green-700 px-2 py-1 rounded font-label-md text-label-md font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">check_circle</span> Paid</span>
                <span class="font-label-md text-label-md text-on-surface-variant">Oct 12, 2023</span>
              </div>
              <h3 class="font-title-md text-title-md text-on-surface">INV-2023-084</h3>
              <p class="font-body-md text-body-md text-on-surface-variant mb-3">Initial Consultation Retainer</p>
              <div class="flex items-center justify-between">
                <span class="font-label-md text-label-md text-on-surface-variant">Amount</span>
                <span class="font-title-md text-title-md text-on-surface">$1,200.00</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    {:else}
      <div class="bg-surface-container-lowest p-12 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-8 animate-fadeIn">
        <div class="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 animate-pulse">
          <span class="material-symbols-outlined text-5xl">
            {activeTab === 'Files' ? 'folder' : 
             activeTab === 'Invoices' ? 'receipt_long' : 'chat'}
          </span>
        </div>
        <h2 class="font-headline-md text-headline-md font-bold mb-3">{activeTab}</h2>
        <p class="text-on-surface-variant max-w-md mb-8">
          This is the client view of the {activeTab.toLowerCase()} list. Manage your workflow, view assets, and review agreements.
        </p>
        <button 
          onclick={() => activeTab = 'My Projects'} 
          class="bg-primary hover:bg-primary-container text-on-primary font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors shadow-md focus:outline-none"
        >
          Back to Overview
        </button>
      </div>
    {/if}
  </main>
</div>
