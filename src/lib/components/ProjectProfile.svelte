<script lang="ts">
  import type { ProjectProps } from '$lib/components/ProjectCard.svelte';

  let { project, onBack } = $props<{
    project: ProjectProps;
    onBack: () => void;
  }>();

  // Circle progress calculation
  // stroke-dasharray="80, 100" can be derived from project.progress
  let dashArray = $derived(`${project.progress}, 100`);
</script>

<style>
  .gradient-hero {
      background: linear-gradient(135deg, #630ed4 0%, #d2bbff 100%);
  }
  .shadow-level-2 {
      box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.05);
  }
  .shadow-level-3:hover {
      box-shadow: 0px 10px 25px rgba(0, 0, 0, 0.08);
      transform: translateY(-2px);
      transition: all 0.2s ease;
  }
  .no-scrollbar::-webkit-scrollbar {
      display: none;
  }
  .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
  }
  .kanban-track {
      min-width: 280px;
      max-width: 320px;
  }
</style>

<div class="animate-fadeIn space-y-stack-md">
  <!-- Breadcrumbs & Back -->
  <div class="flex items-center gap-2 text-on-surface-variant hover:opacity-80 transition-opacity w-fit">
    <button class="flex items-center gap-1 active:scale-95 transition-transform focus:outline-none" onclick={onBack}>
      <span class="material-symbols-outlined text-[20px]">arrow_back</span>
      <span class="font-body-md text-body-md font-medium">Back to Projects</span>
    </button>
  </div>

  <!-- Hero Card (Gradient) -->
  <div class="gradient-hero rounded-xl p-6 md:p-10 shadow-level-2 text-on-primary relative overflow-hidden">
    <!-- Decorative subtle circle -->
    <div class="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="bg-secondary text-on-secondary px-3 py-1 rounded-full font-label-md text-label-md uppercase">{project.status}</span>
          <span class="bg-surface/20 backdrop-blur-sm text-on-primary px-3 py-1 rounded-full font-label-md text-label-md border border-white/20 uppercase">DUE {project.dueDate}</span>
        </div>
        <div>
          <h2 class="font-display-lg text-headline-lg-mobile md:text-display-lg text-on-primary mb-1 tracking-tight shadow-sm">{project.name}</h2>
          <p class="font-title-md text-title-md text-primary-fixed-dim opacity-90">Client: {project.clientName}</p>
        </div>
      </div>
      <div class="flex items-center gap-4 bg-surface/10 backdrop-blur-md p-4 rounded-lg border border-white/20 shrink-0">
        <div class="w-16 h-16 rounded-full border-4 border-primary-fixed-dim flex items-center justify-center relative">
          <!-- SVG Circular Progress -->
          <svg class="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path class="text-white/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>
            <path class="text-white" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray={dashArray} stroke-linecap="round" stroke-width="3"></path>
          </svg>
          <span class="font-title-md text-title-md font-bold z-10">{project.progress}%</span>
        </div>
        <div class="flex flex-col">
          <span class="font-label-md text-label-md text-primary-fixed-dim uppercase tracking-wider">Completion</span>
          <span class="font-body-md text-body-md">On Schedule</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex space-x-2 border-b border-surface-variant overflow-x-auto no-scrollbar pb-2">
    <button class="px-4 py-2 rounded-full font-label-md text-label-md bg-primary text-on-primary shadow-sm active:scale-95 transition-transform shrink-0 focus:outline-none">Overview</button>
    <button class="px-4 py-2 rounded-full font-label-md text-label-md bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/50 transition-colors shrink-0 focus:outline-none">Files</button>
    <button class="px-4 py-2 rounded-full font-label-md text-label-md bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/50 transition-colors shrink-0 flex items-center gap-2 focus:outline-none">Tasks <span class="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded-full text-[10px]">12</span></button>
    <button class="px-4 py-2 rounded-full font-label-md text-label-md bg-surface text-on-surface-variant hover:bg-surface-variant border border-outline-variant/50 transition-colors shrink-0 flex items-center gap-2 focus:outline-none">Messages <span class="bg-primary text-on-primary px-2 py-0.5 rounded-full text-[10px]">3</span></button>
  </div>

  <!-- Kanban Canvas -->
  <div class="flex overflow-x-auto gap-gutter pb-8 no-scrollbar items-start min-h-[500px]">
    <!-- Column 1: Timeline -->
    <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl">
      <div class="flex justify-between items-center mb-2 px-1">
        <h3 class="font-title-md text-title-md text-on-surface">Timeline</h3>
        <button class="text-on-surface-variant hover:text-primary focus:outline-none"><span class="material-symbols-outlined">add</span></button>
      </div>
      <!-- Timeline Card 1 -->
      <div class="bg-surface rounded-lg p-4 shadow-level-2 shadow-level-3 cursor-pointer border border-transparent hover:border-outline-variant/50">
        <div class="flex items-start gap-3">
          <div class="bg-surface-container-high p-2 rounded-full shrink-0 mt-1">
            <span class="material-symbols-outlined text-primary text-[20px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
          </div>
          <div>
            <h4 class="font-body-md text-body-md font-semibold text-on-surface">Initial Discovery Call</h4>
            <p class="font-body-md text-[13px] text-on-surface-variant mt-1">Completed requirement gathering with stakeholders.</p>
            <p class="font-label-md text-[11px] text-outline mt-3 uppercase">Oct 1 • Completed</p>
          </div>
        </div>
      </div>
      <!-- Timeline Card 2 -->
      <div class="bg-surface rounded-lg p-4 shadow-level-2 shadow-level-3 cursor-pointer border border-transparent hover:border-outline-variant/50">
        <div class="flex items-start gap-3">
          <div class="bg-surface-container-high p-2 rounded-full shrink-0 mt-1">
            <span class="material-symbols-outlined text-secondary text-[20px]" style="font-variation-settings: 'FILL' 1;">design_services</span>
          </div>
          <div>
            <h4 class="font-body-md text-body-md font-semibold text-on-surface">Wireframe Presentation</h4>
            <p class="font-body-md text-[13px] text-on-surface-variant mt-1">Presented V1 wireframes to marketing team.</p>
            <p class="font-label-md text-[11px] text-outline mt-3 uppercase">Oct 5 • Completed</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Column 2: Approvals -->
    <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl border-l-4 border-error/50">
      <div class="flex justify-between items-center mb-2 px-1">
        <div class="flex items-center gap-2">
          <h3 class="font-title-md text-title-md text-on-surface">Pending Approvals</h3>
          <span class="bg-error-container text-on-error-container px-2 py-0.5 rounded-full font-label-md text-[10px]">1 Action Req</span>
        </div>
        <button class="text-on-surface-variant hover:text-primary focus:outline-none"><span class="material-symbols-outlined">more_horiz</span></button>
      </div>
      <!-- Approval Card -->
      <div class="bg-surface rounded-lg shadow-level-2 shadow-level-3 overflow-hidden border border-transparent hover:border-outline-variant/50">
        <!-- Image container with descriptive data-alt -->
        <div class="h-32 bg-surface-variant w-full relative group">
          <img alt="Mockup Preview" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBLk2hbDVh8g32naDbN45zLmoBAQmfOwebj3mrp2u9RTmMF19MlITqtiN6szwdx3wX4GMCZpRDHXTYBipZ1xE3TaQFsHwaL1b0aVTxEUVYKsRWRq8bxjk1uAvS-5bVi96xb4it747kPIV1Pi-OWUKmN1yF5IO6fS4ElcFZvQFbNyO9yCkYZ6HGr1jSehnR1xO2EFUtyJuqB74f4R5r5B3T1jCJtbvDi01nNSCTs6msll8PXbJM0694HasjLzrf2sODaXqTNw1WWLcQx"/>
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button class="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full font-label-md flex items-center gap-1 focus:outline-none"><span class="material-symbols-outlined text-[16px]">visibility</span> View Full</button>
          </div>
        </div>
        <div class="p-4">
          <h4 class="font-body-md text-body-md font-semibold text-on-surface mb-1">Brand Identity V2</h4>
          <p class="font-body-md text-[13px] text-on-surface-variant mb-4">Awaiting final sign-off on the logo mark adjustments before proceeding to guidelines.</p>
          <div class="flex gap-2">
            <button class="flex-1 bg-surface-container-high hover:bg-surface-variant text-on-surface px-3 py-2 rounded-lg font-label-md text-label-md transition-colors border border-outline-variant/30 focus:outline-none">Changes</button>
            <button class="flex-1 bg-primary text-on-primary hover:bg-primary/90 px-3 py-2 rounded-lg font-label-md text-label-md transition-colors shadow-sm focus:outline-none">Approve</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Column 3: Milestones -->
    <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl">
      <div class="flex justify-between items-center mb-2 px-1">
        <h3 class="font-title-md text-title-md text-on-surface">Upcoming Milestones</h3>
        <button class="text-on-surface-variant hover:text-primary focus:outline-none"><span class="material-symbols-outlined">calendar_month</span></button>
      </div>
      <!-- Milestone Card 1 (Tomorrow) -->
      <div class="bg-surface rounded-lg p-4 shadow-level-2 shadow-level-3 cursor-pointer border border-transparent hover:border-outline-variant/50 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-1 h-full bg-tertiary-container"></div>
        <div class="flex justify-between items-start mb-3">
          <span class="bg-tertiary-container text-on-tertiary-container px-2 py-1 rounded font-label-md text-[10px] tracking-widest uppercase font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">schedule</span> TOMORROW</span>
        </div>
        <h4 class="font-body-md text-body-md font-semibold text-on-surface mb-1">Frontend Handoff</h4>
        <p class="font-body-md text-[13px] text-on-surface-variant mb-3">Deliver all final Figma assets and design system tokens to engineering team.</p>
        <div class="flex items-center justify-between pt-3 border-t border-surface-variant">
          <div class="flex -space-x-2">
            <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-surface z-20">AJ</div>
            <div class="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-surface z-10">MR</div>
          </div>
          <span class="font-label-md text-[11px] text-on-surface-variant">2 Tasks Left</span>
        </div>
      </div>
      <!-- Milestone Card 2 -->
      <div class="bg-surface rounded-lg p-4 shadow-level-2 shadow-level-3 cursor-pointer border border-transparent hover:border-outline-variant/50 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-1 h-full bg-outline-variant"></div>
        <div class="flex justify-between items-start mb-3">
          <span class="text-outline font-label-md text-[11px] uppercase tracking-wider font-semibold">Oct 15, 2023</span>
        </div>
        <h4 class="font-body-md text-body-md font-semibold text-on-surface mb-1">Final Project Delivery</h4>
        <p class="font-body-md text-[13px] text-on-surface-variant mb-3">Official launch date and final invoice generation.</p>
        <div class="w-full bg-surface-variant rounded-full h-1.5 mt-2">
          <div class="bg-primary h-1.5 rounded-full" style="width: 80%"></div>
        </div>
      </div>
    </div>
  </div>
</div>
