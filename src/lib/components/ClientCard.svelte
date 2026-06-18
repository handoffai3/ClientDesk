<script lang="ts" module>
  export interface ClientProps {
    id: string;
    initials: string;
    name: string;
    industry: string;
    projectsCount: number;
    status: 'Active' | 'Inactive';
    theme: 'secondary' | 'tertiary' | 'error' | 'primary';
  }
</script>

<script lang="ts">
  let { client, onViewProfile } = $props<{ 
    client: ClientProps;
    onViewProfile: () => void;
  }>();

  let avatarClass = $derived.by(() => {
    switch (client.theme) {
      case 'secondary': return 'bg-secondary-container/20 text-secondary-container';
      case 'tertiary': return 'bg-tertiary-container/20 text-tertiary-container';
      case 'error': return 'bg-error-container/50 text-error';
      case 'primary': return 'bg-primary-container/30 text-primary';
      default: return 'bg-surface-variant text-on-surface-variant';
    }
  });

  let statusIndicatorClass = $derived(client.status === 'Active' ? 'bg-[#10b981]' : 'bg-outline');
  
  let projectsBadgeClass = $derived('bg-secondary-container/10 text-secondary-container border-secondary-container/20');
  
  let statusBadgeClass = $derived(client.status === 'Active' 
    ? 'bg-[#10b981]/10 text-[#059669] border-[#10b981]/20'
    : 'bg-surface-variant text-on-surface-variant border-outline-variant/50');

  let buttonClass = $derived(client.status === 'Active'
    ? 'border-primary text-primary hover:bg-primary hover:text-white'
    : 'border-outline text-on-surface-variant hover:bg-surface-variant');
</script>

<article class="bg-surface rounded-xl p-6 shadow-sm hover:shadow-md border border-outline-variant/20 flex flex-col items-center text-center transition-all duration-200 hover:-translate-y-1 group">
  <div class="w-20 h-20 rounded-full {avatarClass} flex items-center justify-center font-headline-lg text-headline-lg font-bold mb-4 border-2 border-surface shadow-sm relative">
    {client.initials}
    <span class="absolute bottom-0 right-0 w-4 h-4 {statusIndicatorClass} border-2 border-surface rounded-full"></span>
  </div>
  <h3 class="font-title-md text-title-md text-on-surface mb-1">{client.name}</h3>
  <p class="font-body-md text-body-md text-on-surface-variant mb-4">{client.industry}</p>
  <div class="flex gap-2 mb-6 w-full justify-center">
    <span class="{projectsBadgeClass} px-3 py-1 rounded-full font-label-md text-label-md flex items-center gap-1 border">
      <span class="material-symbols-outlined text-[14px]">folder</span> {client.projectsCount} Projects
    </span>
    <span class="{statusBadgeClass} px-3 py-1 rounded-full font-label-md text-label-md border">{client.status}</span>
  </div>
  <button 
    class="mt-auto w-full py-2.5 rounded-lg border {buttonClass} font-title-md text-title-md transition-colors duration-200 focus:outline-none"
    onclick={onViewProfile}
  >
    View Profile
  </button>
</article>
