<script lang="ts">
  import { goto } from '$app/navigation';
  import ClientCard, { type ClientProps } from '$lib/components/ClientCard.svelte';
  import ClientProfile from '$lib/components/ClientProfile.svelte';
  import ProjectCard, { type ProjectProps } from '$lib/components/ProjectCard.svelte';
  import ProjectProfile from '$lib/components/ProjectProfile.svelte';
  import FileCard, { type FileProps } from '$lib/components/FileCard.svelte';
  import InvoiceCard, { type InvoiceProps } from '$lib/components/InvoiceCard.svelte';
  import Messages from '$lib/components/Messages.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { agencyDataStore } from '../stores/agencyData';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  let timeOfDay = $derived.by(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  // Task interface
  interface Task {
    id: string;
    title: string;
    description: string;
    priority: string;
    category: string;
    tag: string;
    tagClass: string;
    comments: number;
    assignees: string[];
    visible_to_client: boolean;
  }

  // Column interface
  interface Column {
    id: string;
    title: string;
    tasks: Task[];
  }

  // Navigation tab state
  let activeTab = $state('Dashboard');
  const tabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  $effect(() => {
    const tabParam = $page.url.searchParams.get('tab');
    if (tabParam && tabs.includes(tabParam)) {
      activeTab = tabParam;
    }
  });



  // Drag-and-drop state
  let draggedTaskId = $state<string | null>(null);

  // Notifications State (managed in AgencyHeader)

  // User Profile Dropdown State
  let userMenuOpen = $state(false);

  // Task creation state
  let isModalOpen = $state(false);
  let newTaskTitle = $state('');
  let newTaskDescription = $state('');
  let newTaskPriority = $state('medium');
  let newTaskCategory = $state('');
  let newTaskColumn = $state('today');
  let newTaskVisibleToClient = $state(false);
  // Keep for backwards compat with old modal references
  let newTaskTag = $state('Development');

  // Task Details Modal State
  let selectedTask = $state<Task | null>(null);

  const priorityConfig: Record<string, { label: string; cls: string }> = {
    'high': { label: 'High', cls: 'bg-[#fdf2f8] text-[#db2777]' },
    'medium': { label: 'Medium', cls: 'bg-[#fefce8] text-[#a16207]' },
    'low': { label: 'Low', cls: 'bg-surface-variant text-on-surface-variant' }
  };

  const tagsConfig: Record<string, string> = {
    'High Priority': 'bg-[#fdf2f8] text-[#db2777]',
    'Development': 'bg-[#eff6ff] text-[#2563eb]',
    'Design': 'bg-[#f5f3ff] text-[#7c3aed]',
    'Setup': 'bg-surface-variant text-on-surface-variant'
  };

  // Drag handlers
  function handleDragStart(e: DragEvent, taskId: string) {
    draggedTaskId = taskId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', taskId);
    }
  }

  async function handleDrop(e: DragEvent, targetColumnId: string) {
    e.preventDefault();
    if (!draggedTaskId) return;

    // Update task in the global store immediately for optimistic UI
    agencyDataStore.update(store => {
      const updatedTasks = store.tasks.map(t => {
        if (t.id === draggedTaskId) {
          return { ...t, status: targetColumnId };
        }
        return t;
      });
      return { ...store, tasks: updatedTasks };
    });

    // Update in Supabase
    if (draggedTaskId.startsWith('task-')) {
       // Local only (not saved yet)
    } else {
      await supabase
        .from('tasks')
        .update({ status: targetColumnId })
        .eq('id', draggedTaskId);
    }

    draggedTaskId = null;
  }

  function mapDbTaskToTask(t: any): Task {
    return {
      id: t.id,
      title: t.title,
      description: t.description || '',
      priority: t.priority || 'medium',
      category: t.category || '',
      tag: t.category || '',
      tagClass: tagsConfig[t.category as keyof typeof tagsConfig] || 'bg-[#eff6ff] text-[#2563eb]',
      comments: 0,
      assignees: [],
      visible_to_client: t.visible_to_client || false
    };
  }

  async function createTask() {
    if (!newTaskTitle.trim() || !authState.agencyId) return;

    const { data: insertedTask } = await supabase
      .from('tasks')
      .insert({
        agency_id: authState.agencyId,
        title: newTaskTitle,
        description: newTaskDescription,
        category: newTaskCategory || null,
        status: newTaskColumn,
        priority: newTaskPriority,
        visible_to_client: newTaskVisibleToClient
      })
      .select('*')
      .single();

    if (insertedTask) {
      // Update global store
      agencyDataStore.update(store => ({
        ...store,
        tasks: [insertedTask, ...store.tasks]
      }));
    }

    // Reset input states
    newTaskTitle = '';
    newTaskDescription = '';
    newTaskPriority = 'medium';
    newTaskCategory = '';
    newTaskColumn = 'today';
    newTaskVisibleToClient = false;
    isModalOpen = false;
  }

  function fmtINR(n: number) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/login');
  }


  let allFilesRaw = $derived($agencyDataStore.files);

  function folderCount(folder: string) {
    return allFilesRaw.filter(f => f.folder === folder).length;
  }

  let realClientsCount = $derived($agencyDataStore.clients.length);
  let activeProjectsCount = $derived($agencyDataStore.projects.filter(p => p.status === 'active').length);
  let realPendingInvoicesCount = $derived($agencyDataStore.invoices.filter(i => i.status === 'pending').length);
  let totalRevenue = $derived($agencyDataStore.invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + Number(inv.total || 0), 0));

  const clientsCount = $derived(realClientsCount);
  const projectsCount = $derived(activeProjectsCount);
  const invoicesPendingCount = $derived(realPendingInvoicesCount);

  let clientsData = $derived($agencyDataStore.clients.map(c => ({
    id: c.id,
    initials: c.full_name.substring(0, 2).toUpperCase(),
    name: c.company || c.full_name,
    industry: 'Client',
    projectsCount: $agencyDataStore.projects.filter(p => p.client_id === c.id).length,
    status: (c.status === 'active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
    theme: 'primary' as const,
    avatar: c.avatar_url
  })));

  let projectsData = $derived($agencyDataStore.projects.map(p => ({
    id: p.id,
    name: p.name,
    status: (p.status === 'active' ? 'Active' : p.status === 'completed' ? 'Completed' : 'On Hold') as 'Active' | 'On Hold' | 'Completed',
    clientName: p.clients?.full_name || 'Unknown',
    clientLogo: p.clients?.avatar_url,
    progress: p.progress,
    dueDate: p.deadline ? new Date(p.deadline).toLocaleDateString() : 'No Deadline',
    theme: 'secondary' as const
  })));

  let invoicesData = $derived($agencyDataStore.invoices.map(i => ({
    id: i.invoice_number,
    status: (i.status === 'paid' ? 'Paid' : i.status === 'pending' ? 'Pending' : 'Overdue') as 'Paid' | 'Pending' | 'Overdue',
    clientName: i.clients?.full_name || 'Unknown',
    clientAvatar: i.clients?.avatar_url,
    clientInitials: i.clients?.full_name ? i.clients.full_name.substring(0, 2).toUpperCase() : 'NA',
    theme: (i.status === 'paid' ? 'secondary' : i.status === 'overdue' ? 'primary' : 'tertiary') as 'primary' | 'secondary' | 'tertiary',
    amount: `$${i.total.toLocaleString()}`
  })));

  let filesData = $derived($agencyDataStore.files.map(f => ({
    id: f.id,
    name: f.file_name,
    type: (f.file_name.endsWith('.pdf') ? 'pdf' : f.file_name.endsWith('.zip') ? 'zip' : 'image') as 'pdf' | 'zip' | 'image' | 'doc',
    size: f.file_size ? `${(f.file_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
    date: new Date(f.created_at).toLocaleDateString(),
    uploaderAvatars: ['https://lh3.googleusercontent.com/aida-public/AB6AXuA2pquS7vAc_d3Qio3jPCeRij5_GIGG-hFiZWIwn369izlsJQ37ZmtRkRoptY_SEyXcUZFIRVq7PXdyYPzuOIZAQUR_mU_rTJ545lNRIgI7Rvue9QcrTo-YQ2s0tjSUiAS4Zw86aRzEz8wZFmrEkBP3NINIhV5LlHvv_spUkjlZAPaVSqEcMBvxbOPZSCkZBuaI2pe6BvRqQED_6o8WKRlXS_JLDOBqw-wrEgXdjg6kY8JT1t9aNg19gvyF3KTQz7F_1P-u0izXU-Q0']
  })));

  let columns = $derived.by(() => {
    const grouped = { today: [] as Task[], this_week: [] as Task[], done: [] as Task[] };
    $agencyDataStore.tasks.forEach(t => {
      const taskObj = mapDbTaskToTask(t);
      if (t.status === 'today') grouped.today.push(taskObj);
      else if (t.status === 'this_week') grouped.this_week.push(taskObj);
      else grouped.done.push(taskObj);
    });
    return [
      { id: 'today', title: 'Today', tasks: grouped.today },
      { id: 'this_week', title: 'This Week', tasks: grouped.this_week },
      { id: 'done', title: 'Done', tasks: grouped.done }
    ];
  });

  let selectedClientId = $state<string | null>(null);
  let selectedClient = $derived(selectedClientId ? clientsData.find(c => c.id === selectedClientId) : null);

  let selectedProjectId = $state<string | null>(null);
  let selectedProject = $derived(selectedProjectId ? projectsData.find(p => p.id === selectedProjectId) : null);

</script>

<svelte:head>
  <title>ClientDesk - Dashboard</title>

  <style>
    .material-symbols-outlined {
      font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
    }
  </style>
</svelte:head>

<div
  class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full"
>
  <AgencyHeader activeTab="Dashboard" />  <!-- Main Content Canvas -->
  {#if activeTab !== "Messages"}
    <main
      class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full"
    >
      {#if activeTab === "Dashboard"}
        <!-- Welcome + Stats -->
        <div class="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
          <div>
            <h1 class="text-xl font-semibold text-on-surface mb-1">
              {timeOfDay}
              {authState.userFullName
                ? authState.userFullName.split(" ")[0]
                : authState.user?.email?.split("@")[0] || "there"}
            </h1>
            <p class="text-sm text-on-surface-variant">
              Here's what's happening today
            </p>
          </div>
          <a
            href="/projects"
            class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 w-fit"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            New Project
          </a>
        </div>

        <!-- Stat Cards Row -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-white p-5 rounded-lg border border-outline-variant shadow-xs">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">payments</span>
              </div>
              <div>
                <p class="text-[22px] font-semibold text-on-surface leading-tight">{fmtINR(totalRevenue)}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">Total Revenue</p>
              </div>
            </div>
          </div>
          <div class="bg-white p-5 rounded-lg border border-outline-variant shadow-xs">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-[#dbeafe] text-[#1d4ed8] flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">groups</span>
              </div>
              <div>
                <p class="text-[22px] font-semibold text-on-surface leading-tight">{clientsCount}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">Clients</p>
              </div>
            </div>
          </div>
          <div class="bg-white p-5 rounded-lg border border-outline-variant shadow-xs">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-[#d1fae5] text-[#059669] flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">folder_open</span>
              </div>
              <div>
                <p class="text-[22px] font-semibold text-on-surface leading-tight">{projectsCount}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">Projects</p>
              </div>
            </div>
          </div>
          <div class="bg-white p-5 rounded-lg border border-outline-variant shadow-xs">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-[#fee2e2] text-[#dc2626] flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">receipt_long</span>
              </div>
              <div>
                <p class="text-[22px] font-semibold text-on-surface leading-tight">{invoicesPendingCount}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">Pending Invoices</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Kanban Board -->
        <div
          class="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-380px)] min-h-[400px] snap-x snap-mandatory md:snap-none"
        >
          {#each columns as column}
            <div
              class="flex-none w-[300px] bg-surface-container-low rounded-lg p-3 flex flex-col snap-start {column.id === 'done' ? 'opacity-70' : ''}"
              ondragover={(e) => e.preventDefault()}
              ondrop={(e) => handleDrop(e, column.id)}
            >
              <div class="flex justify-between items-center mb-3 px-1">
                <h3 class="text-sm font-medium text-on-surface">
                  {column.title}
                </h3>
                <span class="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">{column.tasks.length}</span>
              </div>

              <div class="flex flex-col gap-2 overflow-y-auto pr-1 pb-2 flex-1">
                {#each column.tasks as task (task.id)}
                  <div
                    class="bg-white p-3.5 rounded-lg border border-outline-variant shadow-xs hover:shadow-sm transition-shadow cursor-grab active:cursor-grabbing select-none"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, task.id)}
                    onclick={() => (selectedTask = task)}
                  >
                    <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span
                        class="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium {priorityConfig[
                          task.priority
                        ]?.cls || priorityConfig['medium'].cls}"
                      >
                        {priorityConfig[task.priority]?.label || "Medium"}
                      </span>
                      {#if task.category}
                        <span
                          class="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#eff6ff] text-[#2563eb]"
                        >
                          {task.category}
                        </span>
                      {/if}
                      {#if task.visible_to_client}
                        <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success">
                          <span class="material-symbols-outlined text-[12px]">visibility</span> Client
                        </span>
                      {/if}
                    </div>

                    <h4
                      class="text-sm font-medium text-on-surface mb-1 {column.id ===
                      'done'
                        ? 'line-through text-outline'
                        : ''}"
                    >
                      {task.title}
                    </h4>

                    {#if task.description}
                      <p
                        class="text-[13px] text-on-surface-variant line-clamp-2 mb-2"
                      >
                        {task.description}
                      </p>
                    {/if}

                    {#if task.assignees.length > 0}
                      <div class="flex -space-x-2 mt-auto">
                        {#each task.assignees as assignee}
                          <img
                            alt="Avatar"
                            class="w-6 h-6 rounded-full border-2 border-surface object-cover {column.id ===
                            'done'
                              ? 'grayscale'
                              : ''}"
                            src={assignee}
                          />
                        {/each}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div
                    class="flex flex-col items-center justify-center py-10 border border-dashed border-outline-variant rounded-lg text-center px-4 flex-1"
                  >
                    <span class="material-symbols-outlined text-[28px] text-outline-variant mb-2">task</span>
                    <p class="text-sm text-on-surface-variant mb-3">No tasks yet</p>
                    <button
                      class="px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-hover transition-colors flex items-center gap-1 focus:outline-none"
                      onclick={() => {
                        newTaskColumn = column.id;
                        isModalOpen = true;
                      }}
                    >
                      <span class="material-symbols-outlined text-[16px]">add</span> Add Task
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else if activeTab === "Projects"}
        {#if selectedProjectId && selectedProject}
          <ProjectProfile
            project={selectedProject}
            onBack={() => (selectedProjectId = null)}
          />
        {:else}
          <div class="space-y-5 animate-fadeIn">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 class="text-xl font-semibold text-on-surface mb-1">Projects</h1>
                <p class="text-sm text-on-surface-variant">{projectsData.length} active projects</p>
              </div>
              <button class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 w-fit">
                <span class="material-symbols-outlined text-[18px]">add</span>
                New Project
              </button>
            </div>

            <div class="flex gap-2 overflow-x-auto pb-1">
              <button class="px-3 py-1.5 rounded-md text-[13px] font-medium bg-primary/[0.08] text-primary whitespace-nowrap transition-colors focus:outline-none">All</button>
              <button class="px-3 py-1.5 rounded-md text-[13px] font-medium text-on-surface-variant hover:bg-surface-container whitespace-nowrap transition-colors focus:outline-none">Active</button>
              <button class="px-3 py-1.5 rounded-md text-[13px] font-medium text-on-surface-variant hover:bg-surface-container whitespace-nowrap transition-colors focus:outline-none">Completed</button>
              <button class="px-3 py-1.5 rounded-md text-[13px] font-medium text-on-surface-variant hover:bg-surface-container whitespace-nowrap transition-colors focus:outline-none">On Hold</button>
            </div>

            <!-- Projects Grid -->
            <section
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter"
            >
              {#each projectsData as project (project.id)}
                <ProjectCard
                  {project}
                  onOpenProject={() => (selectedProjectId = project.id)}
                />
              {/each}
            </section>
          </div>
        {/if}
      {:else if activeTab === "Clients"}
        {#if selectedClientId && selectedClient}
          <ClientProfile
            client={selectedClient}
            onBack={() => (selectedClientId = null)}
          />
        {:else}
          <!-- Client Directory -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h1 class="text-xl font-semibold text-on-surface mb-1">Clients</h1>
              <p class="text-sm text-on-surface-variant">{clientsCount} total clients</p>
            </div>
            <button class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 w-fit">
              <span class="material-symbols-outlined text-[18px]">add</span>
              Add Client
            </button>
          </div>

          <!-- Stats Row -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div class="bg-white p-4 rounded-lg border border-outline-variant shadow-xs flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-[#dbeafe] text-[#1d4ed8] flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">folder_open</span>
              </div>
              <div>
                <p class="text-lg font-semibold text-on-surface">{projectsCount}</p>
                <p class="text-xs text-on-surface-variant">Active Projects</p>
              </div>
            </div>
            <div class="bg-white p-4 rounded-lg border border-outline-variant shadow-xs flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-[#fef3c7] text-[#b45309] flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">chat</span>
              </div>
              <div>
                <p class="text-lg font-semibold text-on-surface">{$agencyDataStore.messages.filter(m => !m.is_read && m.sender_type === 'client').length}</p>
                <p class="text-xs text-on-surface-variant">Unread Messages</p>
              </div>
            </div>
          </div>

          <!-- Search -->
          <div class="mb-5 flex flex-col md:flex-row gap-3 items-center">
            <div class="relative w-full flex-1">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
              <input
                class="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-on-surface placeholder:text-on-surface-variant"
                placeholder="Search clients..."
                type="text"
              />
            </div>
          </div>

          <!-- Client Grid -->
          <section
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter"
          >
            {#each clientsData as client (client.id)}
              <ClientCard
                {client}
                onViewProfile={() => (selectedClientId = client.id)}
              />
            {/each}
          </section>

          <!-- Pagination -->
          <div class="mt-stack-lg flex justify-center items-center gap-2">
            <button
              class="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              <span class="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              class="w-10 h-10 rounded-lg flex items-center justify-center bg-primary text-white font-title-md text-title-md shadow-sm"
              >1</button
            >
            <button
              class="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-variant font-title-md text-title-md transition-colors"
              >2</button
            >
            <button
              class="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-variant font-title-md text-title-md transition-colors"
              >3</button
            >
            <span class="text-on-surface-variant px-2">...</span>
            <button
              class="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-variant font-title-md text-title-md transition-colors"
              >12</button
            >
            <button
              class="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        {/if}
      {:else if activeTab === "Files"}
        <div class="space-y-5 animate-fadeIn">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-1">
            <div>
              <h1 class="text-xl font-semibold text-on-surface mb-1">Files</h1>
              <p class="text-sm text-on-surface-variant">{allFilesRaw.length} files stored</p>
            </div>
            <button class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 w-fit">
              <span class="material-symbols-outlined text-[18px]">upload</span>
              Upload File
            </button>
          </div>

          <section class="mb-5">
            <h3 class="text-sm font-medium text-on-surface mb-3">Folders</h3>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
              {#each [
                { name: 'Designs', key: 'designs', icon: 'palette', color: 'text-primary', bg: 'bg-primary/[0.06]' },
                { name: 'Contracts', key: 'contracts', icon: 'description', color: 'text-secondary', bg: 'bg-secondary/[0.06]' },
                { name: 'Invoices', key: 'invoices', icon: 'receipt_long', color: 'text-success', bg: 'bg-success/[0.06]' },
                { name: 'Reports', key: 'reports', icon: 'assessment', color: 'text-tertiary', bg: 'bg-tertiary/[0.06]' },
                { name: 'Brand Assets', key: 'brand_assets', icon: 'brush', color: 'text-error', bg: 'bg-error/[0.06]' }
              ] as folder (folder.key)}
              <div class="bg-white border border-outline-variant rounded-lg p-3.5 shadow-xs hover:shadow-sm transition-shadow cursor-pointer">
                <div class="w-9 h-9 rounded-lg {folder.bg} flex items-center justify-center mb-2.5">
                  <span class="material-symbols-outlined {folder.color} text-[18px]" style="font-variation-settings: 'FILL' 1;">{folder.icon}</span>
                </div>
                <h4 class="text-sm font-medium text-on-surface mb-0.5">{folder.name}</h4>
                <p class="text-xs text-on-surface-variant">{folderCount(folder.key)} files</p>
              </div>
              {/each}
            </div>
          </section>

          <section>
            <div class="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
              <h3 class="text-sm font-medium text-on-surface">Recent Files</h3>
              <div class="flex items-center gap-2">
                <div class="relative w-full md:w-56">
                  <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    class="w-full pl-9 pr-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-outline"
                    placeholder="Search files..."
                    type="text"
                  />
                </div>
                <button class="p-1.5 border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]">filter_list</span>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {#each filesData as file (file.id)}
                <FileCard {file} />
              {/each}
            </div>
          </section>
        </div>
      {:else if activeTab === "Invoices"}
          <div class="space-y-5 animate-fadeIn">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-1">
              <div>
                <h1 class="text-xl font-semibold text-on-surface mb-1">Invoices</h1>
                <p class="text-sm text-on-surface-variant">Total revenue: {fmtINR($agencyDataStore.invoices.reduce((s, i) => s + Number(i.total || 0), 0))}</p>
              </div>
              <a
                href="/invoices/create"
                class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 w-fit no-underline"
              >
                <span class="material-symbols-outlined text-[18px]">add</span>
                Create Invoice
              </a>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-7 h-7 rounded-lg bg-success/[0.08] flex items-center justify-center">
                    <span class="material-symbols-outlined text-success text-[16px]">check_circle</span>
                  </div>
                  <span class="text-xs text-on-surface-variant">Paid</span>
                </div>
                <span class="text-[15px] font-semibold text-on-surface">{fmtINR($agencyDataStore.invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0))}</span>
              </div>
              <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-7 h-7 rounded-lg bg-tertiary/[0.08] flex items-center justify-center">
                    <span class="material-symbols-outlined text-tertiary text-[16px]">schedule</span>
                  </div>
                  <span class="text-xs text-on-surface-variant">Pending</span>
                </div>
                <span class="text-[15px] font-semibold text-on-surface">{fmtINR($agencyDataStore.invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.total || 0), 0))}</span>
              </div>
              <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-7 h-7 rounded-lg bg-error/[0.08] flex items-center justify-center">
                    <span class="material-symbols-outlined text-error text-[16px]">warning</span>
                  </div>
                  <span class="text-xs text-on-surface-variant">Overdue</span>
                </div>
                <span class="text-[15px] font-semibold text-on-surface">{fmtINR($agencyDataStore.invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.total || 0), 0))}</span>
              </div>
            </div>

            <div class="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
              <button class="bg-primary text-on-primary px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors">All</button>
              <button class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors">Paid</button>
              <button class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors">Pending</button>
              <button class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors">Overdue</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each invoicesData as invoice (invoice.id)}
                <InvoiceCard {invoice} />
              {/each}
            </div>
          </div>
      {:else if activeTab === "Settings"}
        <Settings />
      {/if}
    </main>
  {:else}
    <Messages />
  {/if}

  {#if isModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white w-full max-w-md rounded-lg p-5 shadow-lg border border-outline-variant mx-4 animate-fadeIn">
        <div class="flex justify-between items-center mb-5">
          <h3 class="text-[15px] font-semibold text-on-surface">Add New Task</h3>
          <button
            class="text-on-surface-variant hover:text-on-surface w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center"
            onclick={() => (isModalOpen = false)}
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form
          onsubmit={(e) => {
            e.preventDefault();
            createTask();
          }}
          class="space-y-4"
        >
          <div>
            <label
              class="block text-xs font-semibold text-on-surface-variant mb-1"
              for="task-title">Title</label
            >
            <input
              type="text"
              id="task-title"
              bind:value={newTaskTitle}
              placeholder="e.g. Design Landing Page"
              required
              class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div>
            <label
              class="block text-xs font-semibold text-on-surface-variant mb-1"
              for="task-desc">Description</label
            >
            <textarea
              id="task-desc"
              bind:value={newTaskDescription}
              rows="2"
              placeholder="Provide task details..."
              class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label
                class="block text-xs font-semibold text-on-surface-variant mb-1"
                for="task-priority">Priority</label
              >
              <select
                id="task-priority"
                bind:value={newTaskPriority}
                class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label
                class="block text-xs font-semibold text-on-surface-variant mb-1"
                for="task-category">Category</label
              >
              <input
                type="text"
                id="task-category"
                bind:value={newTaskCategory}
                placeholder="e.g. Development, Design"
                class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
              />
            </div>
          </div>

          <div>
            <label
              class="block text-xs font-semibold text-on-surface-variant mb-1"
              for="task-column">Status Column</label
            >
            <select
              id="task-column"
              bind:value={newTaskColumn}
              class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="done">Done</option>
            </select>
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={newTaskVisibleToClient} class="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary" />
            <span class="text-xs font-semibold text-on-surface-variant">Show to client</span>
          </label>

          <div class="flex gap-3 justify-end pt-4 border-t border-outline-variant mt-5">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
              onclick={() => (isModalOpen = false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if selectedTask}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white w-full max-w-md rounded-lg p-5 shadow-lg border border-outline-variant mx-4 animate-fadeIn">
        <div class="flex justify-between items-start mb-4">
          <div>
            <span class="inline-block px-2 py-0.5 rounded text-[11px] font-medium mb-2 {selectedTask.tagClass}">
              {selectedTask.tag}
            </span>
            <h3 class="text-[15px] font-semibold text-on-surface">{selectedTask.title}</h3>
          </div>
          <button
            class="text-on-surface-variant hover:text-on-surface w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center"
            onclick={() => (selectedTask = null)}
          >
            <span class="material-symbols-outlined block">close</span>
          </button>
        </div>

        <div class="space-y-4 my-6">
          <div>
            <h4 class="text-xs font-semibold text-outline mb-1">Description</h4>
            <p class="text-sm text-on-surface-variant leading-relaxed">
              {selectedTask.description}
            </p>
          </div>

          <div>
            <h4 class="text-xs font-semibold text-outline mb-2">Assignees</h4>
            <div class="flex gap-2">
              {#each selectedTask.assignees as assignee}
                <img
                  alt="Avatar"
                  class="w-8 h-8 rounded-full border border-outline-variant object-cover"
                  src={assignee}
                />
              {/each}
            </div>
          </div>

          {#if selectedTask.comments > 0}
            <div>
              <h4 class="text-xs font-semibold text-outline mb-2">
                Activity & Comments ({selectedTask.comments})
              </h4>
              <div class="space-y-2 max-h-32 overflow-y-auto pr-1">
                <div class="bg-surface-container-low p-2.5 rounded-lg">
                  <div class="flex justify-between mb-1">
                    <span class="text-[10px] font-bold text-primary"
                      >Team Member</span
                    >
                    <span class="text-[9px] text-outline">1h ago</span>
                  </div>
                  <p class="text-xs text-on-surface">
                    Looks great, I'm working on resolving the feedback now.
                  </p>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <div class="flex justify-end pt-4 border-t border-outline-variant">
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
            onclick={() => (selectedTask = null)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(html),
  :global(body) {
    overflow: hidden !important;
    height: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background-color: rgb(var(--c-background)) !important;
    background-image: none !important;
  }
  :global(::-webkit-scrollbar) {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
</style>
