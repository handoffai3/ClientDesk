<script lang="ts">
  let activeSettingTab = $state('Branding');
  const settingTabs = ['Branding', 'Account', 'Notifications', 'Team'];

  let primaryColor = $state('#630ED4');
</script>

<style>
  .glass-panel {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.3);
  }
  .hero-gradient {
      background: linear-gradient(135deg, #630ed4 0%, #d946ef 100%);
  }
  .scrollbar-hide::-webkit-scrollbar {
      display: none;
  }
  .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
  }
</style>

<div class="flex flex-col gap-stack-md animate-fadeIn">
  <!-- Hero Card -->
  <div class="hero-gradient rounded-xl p-8 md:p-10 text-on-primary shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
    <div class="absolute inset-0 bg-white/10 opacity-50 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent"></div>
    <div class="relative z-10 flex flex-col gap-2">
      <h2 class="font-display-lg text-display-lg tracking-tight">Settings</h2>
      <p class="font-body-lg text-body-lg opacity-90 max-w-md">Manage your workspace preferences, branding, and team members.</p>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-surface-variant">
    {#each settingTabs as tab}
      <button 
        class="px-6 py-2 rounded-full font-title-md text-title-md shadow-sm transition-all active:scale-95 whitespace-nowrap {activeSettingTab === tab ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-variant'}"
        onclick={() => activeSettingTab = tab}
      >
        {tab}
      </button>
    {/each}
  </div>

  <!-- Tab Content -->
  {#if activeSettingTab === 'Branding'}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4 animate-fadeIn">
      <!-- Left Form Column -->
      <div class="lg:col-span-5 flex flex-col gap-6">
        <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-variant flex flex-col gap-6">
          <h3 class="font-headline-md text-headline-md text-on-surface border-b border-surface-variant pb-4">Brand Identity</h3>
          
          <!-- Logo Upload -->
          <div class="flex flex-col gap-3">
            <label class="font-title-md text-title-md text-on-surface-variant">Workspace Logo</label>
            <div class="flex items-center gap-6">
              <div class="w-20 h-20 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span class="material-symbols-outlined text-3xl" data-icon="image">image</span>
              </div>
              <div class="flex flex-col gap-2">
                <button class="px-4 py-2 bg-surface-variant hover:bg-outline-variant text-on-surface-variant font-label-md text-label-md rounded-lg transition-colors flex items-center gap-2 self-start focus:outline-none">
                  <span class="material-symbols-outlined text-sm" data-icon="upload">upload</span> Upload New
                </button>
                <p class="font-body-md text-body-md text-outline text-xs">PNG, JPG or SVG. Max 2MB.</p>
              </div>
            </div>
          </div>
          
          <!-- Primary Color -->
          <div class="flex flex-col gap-3">
            <label class="font-title-md text-title-md text-on-surface-variant">Primary Color</label>
            <div class="flex items-center gap-4">
              <button class="w-12 h-12 rounded-lg bg-primary shadow-inner border border-black/10 cursor-pointer relative after:content-[''] after:absolute after:inset-0 after:rounded-lg after:ring-2 after:ring-offset-2 after:ring-primary focus:outline-none" aria-label="Primary color purple" onclick={() => primaryColor = '#630ED4'}></button>
              <button class="w-10 h-10 rounded-lg bg-blue-500 shadow-inner border border-black/10 cursor-pointer focus:outline-none hover:scale-105 transition-transform" aria-label="Primary color blue" onclick={() => primaryColor = '#3B82F6'}></button>
              <button class="w-10 h-10 rounded-lg bg-emerald-500 shadow-inner border border-black/10 cursor-pointer focus:outline-none hover:scale-105 transition-transform" aria-label="Primary color emerald" onclick={() => primaryColor = '#10B981'}></button>
              <button class="w-10 h-10 rounded-lg bg-rose-500 shadow-inner border border-black/10 cursor-pointer focus:outline-none hover:scale-105 transition-transform" aria-label="Primary color rose" onclick={() => primaryColor = '#F43F5E'}></button>
              <button class="w-10 h-10 rounded-lg bg-slate-800 shadow-inner border border-black/10 cursor-pointer flex items-center justify-center focus:outline-none hover:scale-105 transition-transform" aria-label="Add custom color">
                <span class="material-symbols-outlined text-white text-sm" data-icon="add">add</span>
              </button>
            </div>
            <input class="mt-2 block w-full rounded-lg border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md text-on-surface py-2 px-3 outline-none transition-all" readonly type="text" value={primaryColor}/>
          </div>
          
          <!-- Custom Domain -->
          <div class="flex flex-col gap-3">
            <label class="font-title-md text-title-md text-on-surface-variant">Custom Domain</label>
            <div class="flex rounded-lg shadow-sm border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <span class="inline-flex items-center px-4 rounded-l-lg border-r border-outline-variant bg-surface-container-low text-on-surface-variant font-body-md text-body-md">
                  https://
              </span>
              <input class="flex-1 block w-full rounded-none rounded-r-lg border-none bg-surface-container-lowest font-body-md text-body-md text-on-surface placeholder:text-outline/50 py-2 px-3 outline-none" placeholder="portal.yourcompany.com" type="text"/>
            </div>
            <p class="font-body-md text-body-md text-outline text-xs">Configure CNAME records in your DNS provider.</p>
          </div>
          
          <div class="pt-4 border-t border-surface-variant flex justify-end">
            <button class="px-6 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-title-md text-title-md rounded-lg shadow-sm transition-all active:scale-95 focus:outline-none">
              Save Changes
            </button>
          </div>
        </div>
      </div>
      
      <!-- Right Live Preview Column -->
      <div class="lg:col-span-7 flex flex-col gap-4">
        <h3 class="font-title-md text-title-md text-on-surface-variant px-2">Live Login Preview</h3>
        <div class="flex-1 bg-surface-container-low rounded-2xl border border-surface-variant overflow-hidden flex items-center justify-center p-8 relative min-h-[500px]">
          <!-- Decorative background for preview -->
          <div class="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>
          
          <!-- Simulated Login Card -->
          <div class="glass-panel w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6 shadow-xl relative z-10 animate-fadeIn" style="animation-delay: 100ms;">
            <div class="flex flex-col items-center gap-3 mb-2">
              <div class="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-xl shadow-md transition-colors duration-300" style="background-color: {primaryColor};">C</div>
              <h4 class="font-headline-md text-headline-md text-on-surface text-center">Welcome Back</h4>
              <p class="font-body-md text-body-md text-on-surface-variant text-center">Sign in to your client portal</p>
            </div>
            
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="font-label-md text-label-md text-on-surface-variant">Email</label>
                <div class="w-full h-10 bg-white/50 border border-outline-variant/50 rounded-lg"></div>
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex justify-between items-center">
                  <label class="font-label-md text-label-md text-on-surface-variant">Password</label>
                  <span class="font-label-md text-label-md text-primary text-[10px] transition-colors duration-300" style="color: {primaryColor};">Forgot?</span>
                </div>
                <div class="w-full h-10 bg-white/50 border border-outline-variant/50 rounded-lg"></div>
              </div>
              
              <button class="w-full h-10 text-on-primary rounded-lg font-title-md text-title-md mt-2 shadow-sm flex items-center justify-center opacity-90 cursor-default transition-colors duration-300" style="background-color: {primaryColor};">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center py-20 bg-surface-container-lowest rounded-xl border border-surface-variant border-dashed mt-4 animate-fadeIn">
      <span class="material-symbols-outlined text-4xl text-outline mb-4">construction</span>
      <h3 class="font-title-md text-title-md text-on-surface">Coming Soon</h3>
      <p class="font-body-md text-body-md text-on-surface-variant mt-2 text-center max-w-sm">The {activeSettingTab} settings panel is currently under development.</p>
    </div>
  {/if}
</div>
