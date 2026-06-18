<script lang="ts" module>
  export interface ProjectProps {
    id: string;
    name: string;
    status: 'Active' | 'On Hold' | 'Completed';
    clientName: string;
    clientLogo: string;
    progress: number;
    dueDate: string;
    theme: 'primary' | 'tertiary' | 'secondary';
  }
</script>

<script lang="ts">
  let { project, onOpenProject } = $props<{ 
    project: ProjectProps;
    onOpenProject: () => void;
  }>();

  let borderClass = $derived.by(() => {
    switch (project.status) {
      case 'Active': return 'border-primary';
      case 'On Hold': return 'border-tertiary';
      case 'Completed': return 'border-[#10b981]';
      default: return 'border-outline';
    }
  });

  let statusClass = $derived.by(() => {
    if (project.status === 'Active') {
        return project.theme === 'primary' ? 'bg-secondary-container/10 text-secondary-container' : 'bg-secondary/10 text-secondary';
    }
    switch (project.status) {
      case 'On Hold': return 'bg-tertiary-container/10 text-tertiary-container';
      case 'Completed': return 'bg-[#10b981]/10 text-[#059669]';
      default: return 'bg-surface-variant text-on-surface-variant';
    }
  });
  let progressBgClass = $derived.by(() => {
    switch (project.status) {
      case 'Active': return 'bg-primary';
      case 'On Hold': return 'bg-tertiary';
      case 'Completed': return 'bg-[#10b981]';
      default: return 'bg-secondary-container';
    }
  });
</script>

<article class="bg-surface-lowest rounded-xl p-6 border-t-4 {borderClass} shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white flex flex-col gap-4">
  <div class="flex justify-between items-start">
    <h3 class="font-title-md text-title-md text-on-surface line-clamp-1">{project.name}</h3>
    <span class="px-2 py-1 rounded-full {statusClass} font-label-md text-[10px] whitespace-nowrap">{project.status}</span>
  </div>
  <div class="flex items-center gap-3">
    <div class="w-8 h-8 rounded-full bg-surface-variant overflow-hidden flex items-center justify-center">
      {#if project.clientLogo}
        <img alt="Client Logo" class="w-full h-full object-cover" src={project.clientLogo}/>
      {:else}
        <span class="font-bold text-[10px] text-primary">{project.clientName.substring(0, 2).toUpperCase()}</span>
      {/if}
    </div>
    <span class="font-body-md text-body-md text-on-surface-variant">{project.clientName}</span>
  </div>
  <div class="space-y-2 mt-auto">
    <div class="flex justify-between font-label-md text-[10px] text-on-surface-variant">
      <span>Progress</span>
      <span>{project.progress}%</span>
    </div>
    <div class="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
      <div class="h-full {progressBgClass} rounded-full" style="width: {project.progress}%"></div>
    </div>
  </div>
  <div class="flex justify-between items-center pt-4 border-t border-outline-variant/30 mt-2">
    <div class="flex items-center gap-1.5 text-on-surface-variant font-label-md text-label-md">
      <span class="material-symbols-outlined text-[16px]" data-icon="calendar_today">calendar_today</span>
      <span>{project.dueDate}</span>
    </div>
    <button class="text-primary font-label-md text-label-md flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none" onclick={onOpenProject}>
      Open <span class="material-symbols-outlined text-[16px]" data-icon="arrow_forward">arrow_forward</span>
    </button>
  </div>
</article>
