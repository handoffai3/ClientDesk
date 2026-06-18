<script lang="ts">
  import { goto } from '$app/navigation';
  import ClientCard, { type ClientProps } from '$lib/components/ClientCard.svelte';
  import ClientProfile from '$lib/components/ClientProfile.svelte';
  import ProjectCard, { type ProjectProps } from '$lib/components/ProjectCard.svelte';
  import ProjectProfile from '$lib/components/ProjectProfile.svelte';
  import FileCard, { type FileProps } from '$lib/components/FileCard.svelte';
  import InvoiceCard, { type InvoiceProps } from '$lib/components/InvoiceCard.svelte';
  import CreateInvoice from '$lib/components/CreateInvoice.svelte';
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

  // Notifications State
  let notificationsOpen = $state(false);
  let notifications = $state([
    { id: 1, text: 'Roshan added you to "Finalize UI Designs"', time: '10m ago', unread: true },
    { id: 2, text: 'New invoice #INV-2026-08 generated', time: '2h ago', unread: true },
    { id: 3, text: 'Client Acme Corp approved the API spec', time: '1d ago', unread: false }
  ]);

  // User Profile Dropdown State
  let userMenuOpen = $state(false);

  // Task creation state
  let isModalOpen = $state(false);
  let newTaskTitle = $state('');
  let newTaskDescription = $state('');
  let newTaskPriority = $state('medium');
  let newTaskCategory = $state('');
  let newTaskColumn = $state('today');
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
      assignees: []
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
        priority: newTaskPriority
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

  function markAllRead() {
    notifications = notifications.map(n => ({ ...n, unread: false }));
  }

  let allFilesRaw = $derived($agencyDataStore.files);

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
    status: c.status === 'active' ? 'Active' : 'Inactive',
    theme: 'primary' as const,
    avatar: c.avatar_url
  })));

  let projectsData = $derived($agencyDataStore.projects.map(p => ({
    id: p.id,
    name: p.name,
    status: p.status === 'active' ? 'Active' : p.status === 'completed' ? 'Completed' : 'On Hold',
    clientName: p.clients?.full_name || 'Unknown',
    clientLogo: p.clients?.avatar_url,
    progress: p.progress,
    dueDate: p.deadline ? new Date(p.deadline).toLocaleDateString() : 'No Deadline',
    theme: 'secondary' as const
  })));

  let invoicesData = $derived($agencyDataStore.invoices.map(i => ({
    id: i.invoice_number,
    status: i.status === 'paid' ? 'Paid' : i.status === 'pending' ? 'Pending' : 'Overdue',
    clientName: i.clients?.full_name || 'Unknown',
    clientAvatar: i.clients?.avatar_url,
    clientInitials: i.clients?.full_name ? i.clients.full_name.substring(0, 2).toUpperCase() : 'NA',
    theme: i.status === 'paid' ? 'secondary' : i.status === 'overdue' ? 'primary' : 'tertiary',
    amount: `$${i.total.toLocaleString()}`
  })));

  let filesData = $derived($agencyDataStore.files.map(f => ({
    id: f.id,
    name: f.file_name,
    type: f.file_name.endsWith('.pdf') ? 'pdf' : f.file_name.endsWith('.zip') ? 'zip' : 'image',
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

  let isCreatingInvoice = $state(false);
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
        <!-- Hero Card -->
        <div
          class="rounded-xl bg-gradient-to-r from-primary to-[#d946ef] p-8 text-on-primary relative overflow-hidden shadow-[0px_10px_25px_rgba(99,14,212,0.15)] mb-stack-md flex justify-between items-end"
        >
          <div
            class="relative z-10 flex flex-col justify-between h-full w-full"
          >
            <div>
              <h2 class="font-headline-lg text-headline-lg font-bold mb-2">
                {timeOfDay}
                {authState.userFullName
                  ? authState.userFullName.split(" ")[0]
                  : authState.user?.email?.split("@")[0] || "there"} 👋
              </h2>
              <p class="font-body-md text-body-md text-on-primary/80">
                Here's what's happening today
              </p>
            </div>
            <div class="mt-8">
              <p
                class="font-label-md text-label-md text-on-primary/70 uppercase mb-1"
              >
                TOTAL REVENUE
              </p>
              <p class="font-display-lg text-display-lg font-bold">
                {fmtINR(totalRevenue)}
              </p>
            </div>
          </div>
          <button
            onclick={() => {
              isModalOpen = true;
            }}
            class="relative z-10 bg-[#10b981] hover:bg-[#059669] text-white px-6 py-3 rounded-lg font-title-md text-title-md font-semibold transition-colors shadow-md flex items-center gap-2 active:scale-95 transition-transform duration-100"
          >
            <span class="material-symbols-outlined text-[20px]" data-icon="add"
              >add</span
            >
            New Project
          </button>
          <!-- Decorative abstract shapes -->
          <div
            class="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-10 blur-2xl pointer-events-none"
          />
          <div
            class="absolute bottom-0 right-20 w-40 h-40 rounded-full bg-white opacity-10 blur-xl pointer-events-none"
          />
        </div>

        <!-- Stat Cards Row -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-md">
          <!-- Stat 1 -->
          <div
            class="bg-gradient-to-br from-secondary-container to-secondary p-6 rounded-xl text-on-secondary shadow-sm flex flex-col justify-center min-h-[120px] hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-display-lg text-display-lg font-bold">
                  {clientsCount}
                </p>
                <p class="font-body-md text-body-md opacity-90">Clients</p>
              </div>
              <div
                class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
              >
                <span
                  class="material-symbols-outlined text-[24px]"
                  data-icon="groups">groups</span
                >
              </div>
            </div>
          </div>
          <!-- Stat 2 -->
          <div
            class="bg-gradient-to-br from-[#34d399] to-[#059669] p-6 rounded-xl text-white shadow-sm flex flex-col justify-center min-h-[120px] hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-display-lg text-display-lg font-bold">
                  {projectsCount}
                </p>
                <p class="font-body-md text-body-md opacity-90">Projects</p>
              </div>
              <div
                class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
              >
                <span
                  class="material-symbols-outlined text-[24px]"
                  data-icon="folder_open">folder_open</span
                >
              </div>
            </div>
          </div>
          <!-- Stat 3 -->
          <div
            class="bg-gradient-to-br from-[#fb923c] to-[#ea580c] p-6 rounded-xl text-white shadow-sm flex flex-col justify-center min-h-[120px] hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-display-lg text-display-lg font-bold">
                  {invoicesPendingCount}
                </p>
                <p class="font-body-md text-body-md opacity-90">
                  Invoices Pending
                </p>
              </div>
              <div
                class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
              >
                <span
                  class="material-symbols-outlined text-[24px]"
                  data-icon="receipt_long">receipt_long</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Kanban Board -->
        <div
          class="flex gap-gutter overflow-x-auto pb-4 h-[calc(100vh-420px)] min-h-[400px]"
        >
          {#each columns as column}
            <!-- Column -->
            <div
              class="flex-none w-[320px] bg-surface-container-low rounded-xl p-4 flex flex-col transition-all duration-200 {column.id ===
              'done'
                ? 'opacity-75 hover:opacity-90'
                : ''}"
              ondragover={(e) => e.preventDefault()}
              ondrop={(e) => handleDrop(e, column.id)}
            >
              <div class="flex justify-between items-center mb-4 px-2">
                <h3
                  class="font-title-md text-title-md font-semibold text-on-surface"
                >
                  {column.title}
                </h3>
                <span
                  class="bg-surface-variant text-on-surface-variant px-2 py-1 rounded-full font-label-md text-label-md"
                  >{column.tasks.length}</span
                >
              </div>

              <div class="flex flex-col gap-4 overflow-y-auto pr-2 pb-2 flex-1">
                {#each column.tasks as task (task.id)}
                  <!-- Task Card -->
                  <div
                    class="bg-surface p-4 rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0px_10px_25px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-200 cursor-grab active:cursor-grabbing border border-outline-variant/30 select-none"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, task.id)}
                    onclick={() => (selectedTask = task)}
                  >
                    <!-- Priority + Category badges -->
                    <div class="flex items-center gap-2 mb-3 flex-wrap">
                      <span
                        class="inline-block px-2 py-1 rounded font-label-md text-label-md {priorityConfig[
                          task.priority
                        ]?.cls || priorityConfig['medium'].cls}"
                      >
                        {priorityConfig[task.priority]?.label || "Medium"}
                      </span>
                      {#if task.category}
                        <span
                          class="inline-block px-2 py-1 rounded font-label-md text-label-md bg-[#eff6ff] text-[#2563eb]"
                        >
                          {task.category}
                        </span>
                      {/if}
                    </div>

                    <h4
                      class="font-title-md text-title-md font-semibold text-on-surface mb-2 {column.id ===
                      'done'
                        ? 'line-through text-outline'
                        : ''}"
                    >
                      {task.title}
                    </h4>

                    {#if task.description}
                      <p
                        class="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-3"
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
                    class="flex flex-col items-center justify-center py-12 border-2 border-dashed border-outline-variant/40 rounded-xl text-outline-variant text-center px-4 flex-1"
                  >
                    <span class="material-symbols-outlined text-4xl mb-2"
                      >task</span
                    >
                    <p class="text-xs font-semibold mb-1">No tasks yet</p>
                    <p class="text-[10px] text-outline mb-3">
                      Click Add Task to create one.
                    </p>
                    <button
                      class="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1 focus:outline-none"
                      onclick={() => {
                        newTaskColumn = column.id;
                        isModalOpen = true;
                      }}
                    >
                      <span class="material-symbols-outlined text-[16px]"
                        >add</span
                      > Add Task
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
          <div class="space-y-stack-md animate-fadeIn">
            <!-- Hero Section -->
            <section
              class="rounded-xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center text-on-primary shadow-lg relative overflow-hidden"
              style="background: linear-gradient(135deg, #630ed4 0%, #d2bbff 100%);"
            >
              <!-- Decorative background element -->
              <div
                class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"
              />
              <div class="z-10 mb-6 md:mb-0">
                <h1
                  class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold mb-2"
                >
                  Projects
                </h1>
                <p
                  class="font-body-lg text-body-lg text-on-primary/90 flex items-center gap-2"
                >
                  <span class="font-bold text-xl">{projectsData.length}</span> Active
                  Projects
                </p>
              </div>
              <button
                class="z-10 bg-secondary-container text-on-secondary font-label-md text-label-md px-6 py-3 rounded-lg flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-lg transition-all active:scale-95 focus:outline-none"
              >
                <span class="material-symbols-outlined" data-icon="add"
                  >add</span
                >
                New Project
              </button>
            </section>

            <!-- Filters -->
            <section class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <button
                class="px-5 py-2 rounded-full font-label-md text-label-md bg-primary-container text-on-primary-container whitespace-nowrap transition-colors focus:outline-none"
                >All</button
              >
              <button
                class="px-5 py-2 rounded-full font-label-md text-label-md bg-surface-container-high text-on-surface-variant hover:bg-surface-variant whitespace-nowrap transition-colors focus:outline-none"
                >Active</button
              >
              <button
                class="px-5 py-2 rounded-full font-label-md text-label-md bg-surface-container-high text-on-surface-variant hover:bg-surface-variant whitespace-nowrap transition-colors focus:outline-none"
                >Completed</button
              >
              <button
                class="px-5 py-2 rounded-full font-label-md text-label-md bg-surface-container-high text-on-surface-variant hover:bg-surface-variant whitespace-nowrap transition-colors focus:outline-none"
                >On Hold</button
              >
            </section>

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
          <!-- Hero Card -->
          <section
            class="rounded-xl overflow-hidden shadow-lg mb-stack-md bg-gradient-to-br from-primary to-secondary p-8 md:p-12 relative flex flex-col md:flex-row items-center justify-between gap-6 group hover:-translate-y-1 transition-transform duration-300"
          >
            <div
              class="absolute inset-0 bg-white/5 opacity-50 pointer-events-none"
            />
            <div class="relative z-10 flex-1 w-full text-center md:text-left">
              <h1 class="font-display-lg text-display-lg text-white mb-2">
                Client Directory
              </h1>
              <p class="font-body-lg text-body-lg text-white/90">
                Manage your client relationships
              </p>
              <div
                class="mt-6 inline-flex items-end gap-3 bg-white/10 backdrop-blur-md px-6 py-4 rounded-lg border border-white/20"
              >
                <span
                  class="font-display-lg text-display-lg text-white leading-none"
                  >142</span
                >
                <span
                  class="font-label-md text-label-md text-white/80 uppercase tracking-wider pb-1"
                  >Total Clients</span
                >
              </div>
            </div>
            <div
              class="relative z-10 w-full md:w-auto mt-6 md:mt-0 flex justify-center md:justify-end"
            >
              <button
                class="bg-[#10b981] hover:bg-[#059669] text-white font-title-md text-title-md px-8 py-4 rounded-lg shadow-md transition-all duration-200 active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center"
              >
                <span class="material-symbols-outlined">add</span>
                Add Client
              </button>
            </div>
          </section>

          <!-- Stats Overview Cards -->
          <section
            class="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-stack-lg"
          >
            <div
              class="bg-surface rounded-xl p-6 shadow-sm border-l-4 border-secondary-container flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div>
                <p
                  class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1"
                >
                  Active Projects
                </p>
                <p
                  class="font-headline-lg text-headline-lg text-on-surface group-hover:text-secondary-container transition-colors"
                >
                  38
                </p>
              </div>
              <div
                class="w-12 h-12 rounded-full bg-secondary-container/10 flex items-center justify-center text-secondary-container"
              >
                <span
                  class="material-symbols-outlined"
                  style="font-variation-settings: 'FILL' 1;">folder_open</span
                >
              </div>
            </div>
            <div
              class="bg-surface rounded-xl p-6 shadow-sm border-l-4 border-tertiary-container flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div>
                <p
                  class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1"
                >
                  Recent Activities
                </p>
                <p
                  class="font-headline-lg text-headline-lg text-on-surface group-hover:text-tertiary-container transition-colors"
                >
                  12
                </p>
              </div>
              <div
                class="w-12 h-12 rounded-full bg-tertiary-container/10 flex items-center justify-center text-tertiary-container"
              >
                <span
                  class="material-symbols-outlined"
                  style="font-variation-settings: 'FILL' 1;">history</span
                >
              </div>
            </div>
          </section>

          <!-- Controls / Search & Filters -->
          <section
            class="mb-stack-md flex flex-col md:flex-row gap-4 items-center justify-between bg-surface p-4 rounded-xl shadow-sm border border-outline-variant/30"
          >
            <div class="relative w-full flex-1">
              <span
                class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                >search</span
              >
              <input
                class="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-on-surface placeholder:text-on-surface-variant"
                placeholder="Search clients by name, company, or email..."
                type="text"
              />
            </div>
            <div class="flex gap-3 w-full md:w-auto">
              <button
                class="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-surface-container hover:bg-surface-variant text-on-surface rounded-lg font-title-md text-title-md border border-outline-variant transition-colors"
              >
                <span class="material-symbols-outlined">filter_list</span> Filter
              </button>
              <button
                class="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-surface-container hover:bg-surface-variant text-on-surface rounded-lg font-title-md text-title-md border border-outline-variant transition-colors"
              >
                <span class="material-symbols-outlined">download</span> Export
              </button>
            </div>
          </section>

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
        <div class="space-y-stack-md animate-fadeIn">
          <!-- Hero Card -->
          <section
            class="relative rounded-xl overflow-hidden mb-stack-md bg-gradient-to-r from-primary to-pink-500 shadow-[0px_10px_25px_rgba(99,14,212,0.15)] text-white p-8"
          >
            <div
              class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div>
                <h2
                  class="font-display-lg text-display-lg md:text-display-lg mb-2 text-white"
                >
                  Files
                </h2>
                <p class="font-body-lg text-body-lg text-white/80">
                  Manage, share, and organize all your client assets securely.
                  Currently storing 1,248 files.
                </p>
              </div>
              <button
                class="bg-[#10b981] hover:bg-[#059669] text-white px-6 py-3 rounded-lg font-title-md text-title-md shadow-lg transition-all active:scale-[0.98] flex items-center gap-2 whitespace-nowrap focus:outline-none"
              >
                <span class="material-symbols-outlined">upload</span>
                Upload File
              </button>
            </div>
            <!-- Decorative abstract shapes -->
            <div
              class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"
            />
            <div
              class="absolute bottom-0 left-1/2 w-48 h-48 bg-purple-900/20 rounded-full blur-2xl translate-y-1/2 pointer-events-none"
            />
          </section>

          <!-- Quick Folders -->
          <section class="mb-stack-lg">
            <div class="flex items-center justify-between mb-stack-sm">
              <h3 class="font-title-md text-title-md text-on-surface">
                Quick Access Folders
              </h3>
              <button
                class="font-label-md text-label-md text-primary hover:underline focus:outline-none"
                >View All</button
              >
            </div>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-gutter">
              <!-- Purple Folder -->
              <div
                class="bg-surface border border-outline-variant/30 rounded-xl p-4 shadow-sm hover:shadow-[0px_10px_25px_rgba(0,0,0,0.08)] transition-all cursor-pointer group hover:-translate-y-1"
              >
                <div
                  class="w-12 h-12 rounded-lg bg-primary-container/30 flex items-center justify-center mb-3 group-hover:bg-primary-container transition-colors"
                >
                  <span
                    class="material-symbols-outlined text-primary text-3xl"
                    style="font-variation-settings: 'FILL' 1;">folder</span
                  >
                </div>
                <h4 class="font-title-md text-title-md text-on-surface mb-1">
                  Designs
                </h4>
                <p class="font-label-md text-label-md text-on-surface-variant">
                  248 Files
                </p>
              </div>
              <!-- Blue Folder -->
              <div
                class="bg-surface border border-outline-variant/30 rounded-xl p-4 shadow-sm hover:shadow-[0px_10px_25px_rgba(0,0,0,0.08)] transition-all cursor-pointer group hover:-translate-y-1"
              >
                <div
                  class="w-12 h-12 rounded-lg bg-secondary-container/30 flex items-center justify-center mb-3 group-hover:bg-secondary-container transition-colors"
                >
                  <span
                    class="material-symbols-outlined text-secondary text-3xl"
                    style="font-variation-settings: 'FILL' 1;">folder</span
                  >
                </div>
                <h4 class="font-title-md text-title-md text-on-surface mb-1">
                  Contracts
                </h4>
                <p class="font-label-md text-label-md text-on-surface-variant">
                  112 Files
                </p>
              </div>
              <!-- Green Folder -->
              <div
                class="bg-surface border border-outline-variant/30 rounded-xl p-4 shadow-sm hover:shadow-[0px_10px_25px_rgba(0,0,0,0.08)] transition-all cursor-pointer group hover:-translate-y-1"
              >
                <div
                  class="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-3 group-hover:bg-emerald-200 transition-colors"
                >
                  <span
                    class="material-symbols-outlined text-emerald-600 text-3xl"
                    style="font-variation-settings: 'FILL' 1;">folder</span
                  >
                </div>
                <h4 class="font-title-md text-title-md text-on-surface mb-1">
                  Invoices
                </h4>
                <p class="font-label-md text-label-md text-on-surface-variant">
                  542 Files
                </p>
              </div>
              <!-- Orange Folder -->
              <div
                class="bg-surface border border-outline-variant/30 rounded-xl p-4 shadow-sm hover:shadow-[0px_10px_25px_rgba(0,0,0,0.08)] transition-all cursor-pointer group hover:-translate-y-1"
              >
                <div
                  class="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-3 group-hover:bg-orange-200 transition-colors"
                >
                  <span
                    class="material-symbols-outlined text-orange-600 text-3xl"
                    style="font-variation-settings: 'FILL' 1;">folder</span
                  >
                </div>
                <h4 class="font-title-md text-title-md text-on-surface mb-1">
                  Reports
                </h4>
                <p class="font-label-md text-label-md text-on-surface-variant">
                  89 Files
                </p>
              </div>
              <!-- Pink Folder -->
              <div
                class="bg-surface border border-outline-variant/30 rounded-xl p-4 shadow-sm hover:shadow-[0px_10px_25px_rgba(0,0,0,0.08)] transition-all cursor-pointer group hover:-translate-y-1"
              >
                <div
                  class="w-12 h-12 rounded-lg bg-pink-100 flex items-center justify-center mb-3 group-hover:bg-pink-200 transition-colors"
                >
                  <span
                    class="material-symbols-outlined text-pink-600 text-3xl"
                    style="font-variation-settings: 'FILL' 1;">folder</span
                  >
                </div>
                <h4 class="font-title-md text-title-md text-on-surface mb-1">
                  Brand Assets
                </h4>
                <p class="font-label-md text-label-md text-on-surface-variant">
                  67 Files
                </p>
              </div>
            </div>
          </section>

          <!-- Recent Files Grid -->
          <section>
            <div
              class="flex flex-col md:flex-row md:items-center justify-between mb-stack-md gap-4"
            >
              <h3 class="font-headline-md text-headline-md text-on-surface">
                Recent Files
              </h3>
              <!-- Filter/Search Bar -->
              <div class="flex items-center gap-3">
                <div class="relative w-full md:w-64">
                  <span
                    class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline"
                    >search</span
                  >
                  <input
                    class="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline-variant"
                    placeholder="Search files..."
                    type="text"
                  />
                </div>
                <button
                  class="p-2 border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-variant transition-colors flex items-center justify-center focus:outline-none"
                >
                  <span class="material-symbols-outlined">filter_list</span>
                </button>
              </div>
            </div>

            <div
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter"
            >
              {#each filesData as file (file.id)}
                <FileCard {file} />
              {/each}
            </div>
          </section>
        </div>
      {:else if activeTab === "Invoices"}
        {#if isCreatingInvoice}
          <CreateInvoice onCancel={() => (isCreatingInvoice = false)} />
        {:else}
          <div class="space-y-stack-md animate-fadeIn">
            <!-- Hero Card -->
            <div
              class="rounded-xl p-8 mb-stack-md text-on-primary shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              style="background: linear-gradient(135deg, #630ed4 0%, #ec4899 100%);"
            >
              <div
                class="absolute inset-0 opacity-20 pointer-events-none"
                style="background-image: radial-gradient(circle at 100% 0%, #ffffff 0%, transparent 50%);"
              />
              <div class="relative z-10">
                <h1 class="font-headline-lg text-headline-lg mb-2 text-white">
                  Invoices
                </h1>
                <p class="font-body-md text-body-md opacity-90 mb-1 text-white">
                  Total Revenue
                </p>
                <div
                  class="font-display-lg text-display-lg tracking-tight text-white"
                >
                  ₹2,40,000
                </div>
              </div>
              <button
                class="relative z-10 bg-[#10b981] hover:bg-[#059669] text-white px-6 py-3 rounded-lg font-title-md text-title-md shadow-md transition-all hover:shadow-lg active:scale-95 flex items-center gap-2 focus:outline-none"
                onclick={() => (isCreatingInvoice = true)}
              >
                <span class="material-symbols-outlined text-lg">add</span>
                Create Invoice
              </button>
            </div>

            <!-- Stat Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-md">
              <div
                class="bg-surface rounded-lg p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-l-4 border-[#10b981] flex flex-col"
              >
                <span
                  class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2"
                  >Paid</span
                >
                <span class="font-headline-md text-headline-md text-[#10b981]"
                  >₹2,10,500</span
                >
              </div>
              <div
                class="bg-surface rounded-lg p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-l-4 border-[#f59e0b] flex flex-col"
              >
                <span
                  class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2"
                  >Pending</span
                >
                <span class="font-headline-md text-headline-md text-[#f59e0b]"
                  >₹29,500</span
                >
              </div>
              <div
                class="bg-surface rounded-lg p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-l-4 border-error flex flex-col"
              >
                <span
                  class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2"
                  >Overdue</span
                >
                <span class="font-headline-md text-headline-md text-error"
                  >₹11,800</span
                >
              </div>
            </div>

            <!-- Filters -->
            <div
              class="flex items-center gap-3 mb-stack-md overflow-x-auto pb-2 scrollbar-hide"
            >
              <button
                class="bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors focus:outline-none"
                >All</button
              >
              <button
                class="bg-surface-variant text-on-surface-variant hover:bg-surface-dim px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors focus:outline-none"
                >Paid</button
              >
              <button
                class="bg-surface-variant text-on-surface-variant hover:bg-surface-dim px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors focus:outline-none"
                >Pending</button
              >
              <button
                class="bg-surface-variant text-on-surface-variant hover:bg-surface-dim px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors focus:outline-none"
                >Overdue</button
              >
            </div>

            <!-- Invoice Grid -->
            <div
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter"
            >
              {#each invoicesData as invoice (invoice.id)}
                <InvoiceCard {invoice} />
              {/each}
            </div>
          </div>
        {/if}
      {:else if activeTab === "Settings"}
        <Settings />
      {/if}
    </main>
  {:else}
    <Messages />
  {/if}

  <!-- "New Project" / Task Modal -->
  {#if isModalOpen}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        class="bg-surface-container-lowest w-full max-w-md rounded-2xl p-6 shadow-2xl border border-outline-variant/40 mx-4"
      >
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-title-md text-title-md font-bold text-on-surface">
            Add New Task
          </h3>
          <button
            class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container"
            onclick={() => (isModalOpen = false)}
          >
            <span class="material-symbols-outlined block">close</span>
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

          <div
            class="flex gap-4 justify-end pt-4 border-t border-outline-variant/30 mt-6"
          >
            <button
              type="button"
              class="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg"
              onclick={() => (isModalOpen = false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 text-sm font-semibold text-on-primary bg-primary hover:bg-primary-container rounded-lg shadow-md"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Task Details Modal -->
  {#if selectedTask}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        class="bg-surface-container-lowest w-full max-w-md rounded-2xl p-6 shadow-2xl border border-outline-variant/40 mx-4"
      >
        <div class="flex justify-between items-start mb-4">
          <div>
            <span
              class="inline-block px-2 py-1 rounded font-label-md text-label-md mb-2 {selectedTask.tagClass}"
            >
              {selectedTask.tag}
            </span>
            <h3 class="font-headline-md text-xl font-bold text-on-surface">
              {selectedTask.title}
            </h3>
          </div>
          <button
            class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container"
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

        <div class="flex justify-end pt-4 border-t border-outline-variant/30">
          <button
            class="px-5 py-2 text-sm font-semibold text-on-primary bg-primary hover:bg-primary-container rounded-lg shadow-md"
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
    background-color: #fef7ff !important;
    background-image: none !important;
  }
  :global(::-webkit-scrollbar) {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fadeIn {
    animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
</style>
