<script lang="ts">
  import type { ClientProps } from '$lib/components/ClientCard.svelte';

  let { client, onBack } = $props<{
    client: ClientProps;
    onBack: () => void;
  }>();
</script>

<style>
  .hero-gradient {
      background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
  }
  .stat-card-shadow {
      box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.05);
  }
  .stat-card-shadow:hover {
      box-shadow: 0px 10px 25px rgba(0, 0, 0, 0.08);
      transform: translateY(-2px);
  }
  .kanban-scrollbar::-webkit-scrollbar {
      height: 6px;
  }
  .kanban-scrollbar::-webkit-scrollbar-track {
      background: #f3ebfa;
      border-radius: 4px;
  }
  .kanban-scrollbar::-webkit-scrollbar-thumb {
      background: #d2bbff;
      border-radius: 4px;
  }
</style>

<div class="animate-fadeIn">
  <!-- Back Button & Breadcrumbs -->
  <button class="flex items-center space-x-2 text-on-surface-variant mb-stack-sm cursor-pointer hover:text-primary transition-colors w-fit focus:outline-none" onclick={onBack}>
    <span class="material-symbols-outlined text-[18px]">arrow_back</span>
    <span class="font-label-md text-label-md">Back to Clients</span>
  </button>

  <!-- Hero Card -->
  <div class="hero-gradient rounded-xl p-stack-md flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-8 shadow-sm relative overflow-hidden mb-stack-md">
    <!-- Decorative Elements -->
    <div class="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white opacity-10 rounded-full blur-2xl pointer-events-none"></div>
    <div class="absolute bottom-[-30px] left-[20%] w-32 h-32 bg-white opacity-10 rounded-full blur-xl pointer-events-none"></div>
    <div class="relative">
      <img alt="Client Avatar" class="h-24 w-24 rounded-full border-4 border-white/30 object-cover shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCzixxoWJtTJhuoG2isQParUmGndsQHmJY8dtbRSdDrsOF14g6VWRzSckTQfMWEHzjEtj0kUJutrwX-ZKrBKi--C21x58a9kRbTCV0prXJjb6ujiYgVBRvrEVIZ6P3RYRkdrFhQRIr7mtVRgGjeqzXApejn-I6s2Ah-z0yD6mN4-noF8_Pory2p9zsgj_Vutl6rdi9DxnDBKrMEocHRUuAxvJH7-galEAakwv0DGuVqmSSynWMj8XI1naFqfpxmAGjtbsC9yCzBcx3S"/>
    </div>
    <div class="flex-1 text-center md:text-left z-10 text-white">
      <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold mb-1">{client.name}</h1>
      <h2 class="font-title-md text-title-md font-medium text-white/90 mb-4">{client.industry}</h2>
      <div class="flex items-center justify-center md:justify-start space-x-2 bg-white/20 w-fit px-3 py-1 rounded-full text-white/90 font-label-md text-label-md mx-auto md:mx-0">
        <span class="material-symbols-outlined text-[14px]">calendar_today</span>
        <span>Client since Oct 2022</span>
      </div>
    </div>
    <div class="z-10 mt-4 md:mt-0 flex space-x-3">
      <button class="bg-white text-primary px-4 py-2 rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-bright active:scale-95 transition-all flex items-center space-x-1">
        <span class="material-symbols-outlined text-[16px]">edit</span>
        <span>Edit</span>
      </button>
      <button class="bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-white/30 active:scale-95 transition-all flex items-center space-x-1">
        <span class="material-symbols-outlined text-[16px]">more_vert</span>
      </button>
    </div>
  </div>

  <!-- 3 Stat Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-md">
    <!-- Active Projects (Blue) -->
    <div class="bg-surface rounded-xl p-stack-sm stat-card-shadow border-l-4 border-secondary-container transition-all duration-200">
      <div class="flex justify-between items-start mb-2">
        <h3 class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Active Projects</h3>
        <div class="bg-secondary-container/10 p-1 rounded-md text-secondary-container">
          <span class="material-symbols-outlined text-[20px]">folder_open</span>
        </div>
      </div>
      <div class="flex items-baseline space-x-2">
        <span class="font-headline-lg text-headline-lg text-on-surface font-bold">{client.projectsCount || 4}</span>
        <span class="font-label-md text-label-md text-secondary-container">+1 this month</span>
      </div>
    </div>
    <!-- Total Revenue (Green) -->
    <div class="bg-surface rounded-xl p-stack-sm stat-card-shadow border-l-4 border-[#10b981] transition-all duration-200">
      <div class="flex justify-between items-start mb-2">
        <h3 class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Total Revenue YTD</h3>
        <div class="bg-[#10b981]/10 p-1 rounded-md text-[#10b981]">
          <span class="material-symbols-outlined text-[20px]">payments</span>
        </div>
      </div>
      <div class="flex items-baseline space-x-2">
        <span class="font-headline-lg text-headline-lg text-on-surface font-bold">$124k</span>
        <span class="font-label-md text-label-md text-[#10b981]">+12% vs last year</span>
      </div>
    </div>
    <!-- Pending Invoices (Orange) -->
    <div class="bg-surface rounded-xl p-stack-sm stat-card-shadow border-l-4 border-tertiary-container transition-all duration-200">
      <div class="flex justify-between items-start mb-2">
        <h3 class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Pending Invoices</h3>
        <div class="bg-tertiary-container/10 p-1 rounded-md text-tertiary-container">
          <span class="material-symbols-outlined text-[20px]">receipt_long</span>
        </div>
      </div>
      <div class="flex items-baseline space-x-2">
        <span class="font-headline-lg text-headline-lg text-on-surface font-bold">$18,450</span>
        <span class="font-label-md text-label-md text-tertiary-container">2 Overdue</span>
      </div>
    </div>
  </div>

  <!-- Tab Pills -->
  <div class="flex space-x-2 overflow-x-auto pb-2 kanban-scrollbar mb-stack-md">
    <button class="bg-primary-container text-on-primary-container px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap active:scale-95 transition-transform duration-150">Overview</button>
    <button class="bg-surface text-on-surface-variant px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap hover:bg-surface-variant active:scale-95 transition-all duration-150 border border-outline-variant/30">Projects</button>
    <button class="bg-surface text-on-surface-variant px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap hover:bg-surface-variant active:scale-95 transition-all duration-150 border border-outline-variant/30">Files</button>
    <button class="bg-surface text-on-surface-variant px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap hover:bg-surface-variant active:scale-95 transition-all duration-150 border border-outline-variant/30">Invoices</button>
    <button class="bg-surface text-on-surface-variant px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap hover:bg-surface-variant active:scale-95 transition-all duration-150 border border-outline-variant/30">Messages</button>
  </div>

  <!-- Overview Tab Content (2 Column Layout) -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
    <!-- Left Column: Contact Info (4 cols) -->
    <div class="lg:col-span-4 space-y-stack-md">
      <div class="bg-surface rounded-xl p-stack-md stat-card-shadow transition-all duration-200">
        <h3 class="font-title-md text-title-md text-on-surface mb-stack-sm flex items-center">
          <span class="material-symbols-outlined mr-2 text-primary">contact_page</span>
          Contact Information
        </h3>
        <div class="space-y-4">
          <div class="flex items-start space-x-3">
            <div class="bg-surface-container p-2 rounded-lg text-primary mt-1">
              <span class="material-symbols-outlined text-[18px]">mail</span>
            </div>
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase">Email Address</p>
              <p class="font-body-md text-body-md text-on-surface font-medium hover:text-primary cursor-pointer transition-colors">info@{client.name.toLowerCase().replace(/\s+/g, '')}.com</p>
            </div>
          </div>
          <div class="flex items-start space-x-3">
            <div class="bg-surface-container p-2 rounded-lg text-primary mt-1">
              <span class="material-symbols-outlined text-[18px]">phone</span>
            </div>
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase">Phone Number</p>
              <p class="font-body-md text-body-md text-on-surface font-medium hover:text-primary cursor-pointer transition-colors">+1 (555) 123-4567</p>
              <p class="font-label-md text-label-md text-on-surface-variant mt-1">Office (Ext 402)</p>
            </div>
          </div>
          <div class="flex items-start space-x-3">
            <div class="bg-surface-container p-2 rounded-lg text-primary mt-1">
              <span class="material-symbols-outlined text-[18px]">location_on</span>
            </div>
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase">Headquarters</p>
              <p class="font-body-md text-body-md text-on-surface font-medium">100 Innovation Way<br/>Suite 400<br/>San Francisco, CA 94105</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity Mini List -->
      <div class="bg-surface rounded-xl p-stack-md stat-card-shadow transition-all duration-200">
        <h3 class="font-title-md text-title-md text-on-surface mb-stack-sm flex items-center">
          <span class="material-symbols-outlined mr-2 text-primary">history</span>
          Recent Activity
        </h3>
        <ul class="space-y-3">
          <li class="flex items-start space-x-3">
            <div class="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
            <div>
              <p class="font-body-md text-body-md text-on-surface">Invoice #INV-2023-45 paid</p>
              <p class="font-label-md text-label-md text-on-surface-variant mt-0.5">2 days ago</p>
            </div>
          </li>
          <li class="flex items-start space-x-3">
            <div class="w-2 h-2 rounded-full bg-secondary mt-1.5 flex-shrink-0"></div>
            <div>
              <p class="font-body-md text-body-md text-on-surface">New brief uploaded: Q4 Campaign</p>
              <p class="font-label-md text-label-md text-on-surface-variant mt-0.5">4 days ago</p>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Right Column: Active Projects & Outstanding (8 cols) -->
    <div class="lg:col-span-8 space-y-stack-md">
      <!-- Section Header -->
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-title-md text-title-md text-on-surface">Active Projects Focus</h3>
        <button class="text-primary hover:text-primary-container font-label-md text-label-md flex items-center transition-colors">
          View All <span class="material-symbols-outlined text-[16px] ml-1">arrow_forward</span>
        </button>
      </div>

      <!-- Active Projects Cards (Kanban Style) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <!-- Project Card 1 -->
        <div class="bg-surface rounded-xl p-stack-sm stat-card-shadow transition-all duration-200 flex flex-col h-full border border-outline-variant/20">
          <div class="flex justify-between items-start mb-3">
            <span class="bg-surface-container-high text-on-surface-variant px-2 py-1 rounded-full font-label-md text-label-md text-[10px]">Web App</span>
            <button class="text-on-surface-variant hover:text-primary transition-colors focus:outline-none">
              <span class="material-symbols-outlined text-[18px]">more_horiz</span>
            </button>
          </div>
          <h4 class="font-title-md text-title-md text-on-surface mb-2">Customer Portal Redesign</h4>
          <p class="font-body-md text-body-md text-on-surface-variant mb-4 line-clamp-2 flex-1">Overhaul of the main dashboard UX/UI to improve user retention and task completion rates.</p>
          <div class="mt-auto">
            <div class="flex justify-between font-label-md text-label-md mb-1">
              <span class="text-on-surface-variant">Progress</span>
              <span class="text-[#10b981] font-bold">75%</span>
            </div>
            <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
              <div class="bg-[#10b981] h-full rounded-full" style="width: 75%;"></div>
            </div>
            <div class="flex justify-between items-center mt-3 pt-3 border-t border-outline-variant/20">
              <span class="font-label-md text-label-md text-on-surface-variant flex items-center">
                <span class="material-symbols-outlined text-[14px] mr-1">schedule</span> Due in 14 days
              </span>
              <div class="flex -space-x-2">
                <div class="w-6 h-6 rounded-full bg-primary-container border-2 border-surface text-center leading-5 text-[10px] text-on-primary-container font-bold">AK</div>
                <div class="w-6 h-6 rounded-full bg-secondary-container border-2 border-surface text-center leading-5 text-[10px] text-white font-bold">JD</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Project Card 2 -->
        <div class="bg-surface rounded-xl p-stack-sm stat-card-shadow transition-all duration-200 flex flex-col h-full border border-outline-variant/20">
          <div class="flex justify-between items-start mb-3">
            <span class="bg-surface-container-high text-on-surface-variant px-2 py-1 rounded-full font-label-md text-label-md text-[10px]">Marketing</span>
            <button class="text-on-surface-variant hover:text-primary transition-colors focus:outline-none">
              <span class="material-symbols-outlined text-[18px]">more_horiz</span>
            </button>
          </div>
          <h4 class="font-title-md text-title-md text-on-surface mb-2">Q4 Brand Campaign Assets</h4>
          <p class="font-body-md text-body-md text-on-surface-variant mb-4 line-clamp-2 flex-1">Creation of social media graphics, email templates, and landing page banners for Q4 push.</p>
          <div class="mt-auto">
            <div class="flex justify-between font-label-md text-label-md mb-1">
              <span class="text-on-surface-variant">Progress</span>
              <span class="text-[#10b981] font-bold">30%</span>
            </div>
            <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
              <div class="bg-[#10b981] h-full rounded-full" style="width: 30%;"></div>
            </div>
            <div class="flex justify-between items-center mt-3 pt-3 border-t border-outline-variant/20">
              <span class="font-label-md text-label-md text-on-surface-variant flex items-center">
                <span class="material-symbols-outlined text-[14px] mr-1">schedule</span> Due in 45 days
              </span>
              <div class="flex -space-x-2">
                <div class="w-6 h-6 rounded-full bg-primary border-2 border-surface text-center leading-5 text-[10px] text-white font-bold">SJ</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Outstanding Invoice Attention Card -->
      <div class="bg-[#fff7ed] border border-[#fed7aa] rounded-xl p-stack-sm shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center mt-stack-md transition-all hover:shadow-md">
        <div class="flex items-start space-x-3 mb-3 sm:mb-0">
          <div class="bg-[#ffedd5] p-2 rounded-full text-[#ea580c] mt-1 sm:mt-0 flex-shrink-0">
            <span class="material-symbols-outlined text-[20px]">warning</span>
          </div>
          <div>
            <h4 class="font-title-md text-title-md text-[#9a3412] mb-1">Action Required: Overdue Invoice</h4>
            <p class="font-body-md text-body-md text-[#9a3412]/80">Invoice #INV-2023-42 ($4,500) is 15 days overdue.</p>
          </div>
        </div>
        <button class="bg-[#ea580c] text-white px-4 py-2 rounded-lg font-label-md text-label-md shadow-sm hover:bg-[#c2410c] active:scale-95 transition-all whitespace-nowrap self-end sm:self-auto focus:outline-none">
          Send Reminder
        </button>
      </div>
    </div>
  </div>
</div>
