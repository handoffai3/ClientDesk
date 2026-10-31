<script lang="ts">
  import { apiFetch } from '$lib/apiFetch';
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import ProofingCanvas from '$lib/components/ProofingCanvas.svelte';
  import { sendBrandedEmail } from '$lib/emailTemplates';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  let project = $state<any>(null);
  let timeline = $state<any[]>([]);
  let approvals = $state<any[]>([]);
  let milestones = $state<any[]>([]);
  let loading = $state(true);
  let activeTab = $state('Overview');

  // Post Update form
  let showUpdateForm = $state(false);
  let updateContent = $state('');
  let updateStatus = $state<'completed' | 'in_progress' | 'pending'>('in_progress');
  let postingUpdate = $state(false);

  // Add Approval modal
  let showApprovalModal = $state(false);
  let newApprovalTitle = $state('');
  let newApprovalDesc = $state('');
  let newApprovalImage = $state('');
  let submittingApproval = $state(false);

  // Add Milestone modal
  let showMilestoneModal = $state(false);
  let newMilestoneTitle = $state('');
  let newMilestoneDesc = $state('');
  let newMilestoneDue = $state('');
  let submittingMilestone = $state(false);

  // Deliverables
  let deliverables = $state<any[]>([]);
  let showDeliverableModal = $state(false);
  let newDelTitle = $state('');
  let newDelDesc = $state('');
  let newDelFile = $state<File | null>(null);
  let submittingDeliverable = $state(false);
  let uploadingDeliverable = $state(false);
  let deliverableUploadProgress = $state(0);

  // Proofing canvas
  let proofingDeliverable = $state<any>(null);
  let proofingPins = $state<any[]>([]);
  let showProofing = $state(false);

  // Files tab
  const folderLabels: Record<string, string> = {
    designs: 'Designs', contracts: 'Contracts', invoices: 'Invoices',
    reports: 'Reports', brand_assets: 'Brand Assets', client_uploads: 'Client Uploads'
  };
  const agencyFolders = ['designs', 'contracts', 'invoices', 'reports', 'brand_assets'];
  let files = $state<any[]>([]);
  let projectInvoices = $state<any[]>([]);
  let showFileModal = $state(false);
  let uploadFileObj = $state<File | null>(null);
  let uploadFolder = $state('designs');
  let lockFile = $state(false);
  let unlockType = $state<'payment' | 'approval'>('payment');
  let unlockInvoiceId = $state('');
  let uploadingFile = $state(false);
  let fileError = $state('');

  // Tasks tab
  let tasks = $state<any[]>([]);
  let showTaskForm = $state(false);
  let newTaskTitle = $state('');
  let newTaskDesc = $state('');
  let newTaskPriority = $state<'high' | 'medium' | 'low'>('medium');
  let newTaskCategory = $state('');
  let newTaskColumn = $state<'today' | 'this_week' | 'done'>('today');
  let newTaskVisibleToClient = $state(false);
  let savingTask = $state(false);

  // Messages tab
  let messages = $state<any[]>([]);
  let msgInput = $state('');
  let sendingMsg = $state(false);
  let messagesEnd = $state<HTMLDivElement | null>(null);

  // Toast
  let toastMsg = $state('');
  let toastType = $state<'success' | 'error'>('success');

  // AI Summary
  let aiProjectSummary = $state('');
  let aiProjectSummarizing = $state(false);
  let showProjectSummary = $state(false);

  // Agency branding for emails
  let agencyBranding = $state<{ logo_url: string | null; primary_color: string; email: string; reply_to_email: string | null }>({ logo_url: null, primary_color: '#7C3AED', email: '', reply_to_email: null });

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    setTimeout(() => { toastMsg = ''; }, 3000);
  }

  async function summarizeProject() {
    if (!project) return;
    aiProjectSummarizing = true;
    aiProjectSummary = '';
    showProjectSummary = true;
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('sender_type, content, file_name')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20);

      const res = await apiFetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project',
          data: {
            projectName: project.name,
            timeline: timeline.slice(0, 10).map(t => ({ status: t.status, content: t.content })),
            milestones: milestones.map(m => ({ title: m.title, is_completed: m.is_completed, due_date: m.due_date })),
            deliverables: deliverables.map(d => ({ title: d.title, version: d.version, status: d.status })),
            recentMessages: (msgs || []).map(m => ({ sender_type: m.sender_type, content: m.content }))
          }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Summarization failed');
      aiProjectSummary = json.summary;
    } catch (err: any) {
      aiProjectSummary = `Error: ${err.message}`;
    } finally {
      aiProjectSummarizing = false;
    }
  }

  const projectId = $derived($page.params.id);

  // Circle progress
  let dashArray = $derived(project ? `${project.progress || 0}, 100` : '0, 100');

  async function loadProject() {
    loading = true;
    const { data } = await supabase
      .from('projects')
      .select('*, clients(full_name, avatar_url, company)')
      .eq('id', projectId)
      .single();
    if (data) project = data;

    // Load timeline
    const { data: tl } = await supabase
      .from('timeline_updates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (tl) timeline = tl;

    // Load approvals
    const { data: ap } = await supabase
      .from('approvals')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (ap) approvals = ap;

    // Load milestones
    const { data: ms } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true });
    if (ms) milestones = ms;

    // Load deliverables
    const { data: dels } = await supabase
      .from('deliverables')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (dels) {
      deliverables = dels;
      resolveDeliverableThumbs(dels);
    }

    const [flRes, tkRes, msgRes, invRes] = await Promise.all([
      supabase.from('files').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      project?.client_id
        ? supabase.from('invoices').select('id, invoice_number, status').eq('client_id', project.client_id).neq('status', 'paid')
        : Promise.resolve({ data: [] as any[] })
    ]);
    if (flRes.data) files = flRes.data;
    if (tkRes.data) tasks = tkRes.data;
    if (msgRes.data) messages = msgRes.data;
    if (invRes.data) projectInvoices = invRes.data;

    // Load agency branding for emails
    if (authState.agencyId) {
      const { data: brandData } = await supabase.from('agencies').select('logo_url, primary_color, email, reply_to_email').eq('id', authState.agencyId).single();
      if (brandData) agencyBranding = brandData as any;
    }

    loading = false;
  }

  let dataLoaded = false;
  $effect(() => {
    if (projectId && !authState.loading && !dataLoaded) {
      dataLoaded = true;
      loadProject();
    }
  });

  $effect(() => {
    const pid = projectId;
    if (!pid) return;
    const channel = supabase.channel('agency-project-' + pid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${pid}` }, (payload: any) => {
        if (!messages.find(m => m.id === payload.new.id)) {
          messages = [...messages, payload.new];
          scrollMessages();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${pid}` }, (payload: any) => {
        if (payload.eventType === 'DELETE') tasks = tasks.filter(t => t.id !== payload.old.id);
        else if (tasks.find(t => t.id === payload.new.id)) tasks = tasks.map(t => t.id === payload.new.id ? payload.new : t);
        else tasks = [payload.new, ...tasks];
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'files', filter: `project_id=eq.${pid}` }, (payload: any) => {
        if (!files.find(f => f.id === payload.new.id)) files = [payload.new, ...files];
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  });

  function scrollMessages() {
    setTimeout(() => messagesEnd?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  $effect(() => {
    if (activeTab !== 'Messages') return;
    scrollMessages();
    const unread = messages.filter(m => m.sender_type === 'client' && !m.is_read).map(m => m.id);
    if (unread.length > 0) {
      supabase.from('messages').update({ is_read: true }).in('id', unread).then(() => {
        messages = messages.map(m => unread.includes(m.id) ? { ...m, is_read: true } : m);
      });
    }
  });

  function formatSize(bytes: number | null) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  let signedThumbUrls = $state<Record<string, string>>({});

  async function resolveDeliverableThumbs(dels: any[]) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return;
    for (const del of dels) {
      const url = del.thumbnail_url || del.file_url;
      if (!url || del.file_type !== 'image') continue;
      try {
        const res = await fetch('/api/files/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ file_url: url })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) signedThumbUrls = { ...signedThumbUrls, [del.id]: data.url };
        }
      } catch {}
    }
  }

  async function downloadFile(file: any) {
    try {
      const res = await apiFetch(`/api/files/${file.id}/download`);
      const data = await res.json();
      if (res.ok && data.url) window.open(data.url, '_blank');
      else showToast(data.message || 'Download failed', 'error');
    } catch { showToast('Download failed.', 'error'); }
  }

  function fileIcon(name: string) {
    const ext = name?.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return { icon: 'picture_as_pdf', bg: 'bg-red-50', text: 'text-red-500' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return { icon: 'image', bg: 'bg-blue-50', text: 'text-blue-500' };
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: 'folder_zip', bg: 'bg-gray-100', text: 'text-gray-500' };
    return { icon: 'description', bg: 'bg-blue-50', text: 'text-blue-600' };
  }

  async function uploadProjectFile(e: Event) {
    e.preventDefault();
    if (!uploadFileObj || !project || !authState.agencyId) { fileError = 'Please select a file.'; return; }
    uploadingFile = true;
    fileError = '';
    const path = `${authState.agencyId}/${Date.now()}_${uploadFileObj.name}`;
    const { error: storageErr } = await supabase.storage.from('ClientDeskBucket').upload(path, uploadFileObj);
    if (storageErr) { fileError = 'Storage error: ' + storageErr.message; uploadingFile = false; return; }
    const { data: urlData } = supabase.storage.from('ClientDeskBucket').getPublicUrl(path);
    const row: any = {
      agency_id: authState.agencyId,
      project_id: projectId,
      client_id: project.client_id,
      file_name: uploadFileObj.name,
      file_url: urlData?.publicUrl || '',
      file_path: path,
      file_size: uploadFileObj.size,
      file_type: uploadFileObj.type,
      folder: uploadFolder,
      uploaded_by: authState.user?.id || null,
      is_locked: lockFile
    };
    if (lockFile) {
      row.unlock_type = unlockType;
      if (unlockType === 'payment' && unlockInvoiceId) row.unlock_invoice_id = unlockInvoiceId;
    }
    const { data, error } = await supabase.from('files').insert(row).select('*').single();
    if (error) { fileError = 'Database error: ' + error.message; uploadingFile = false; return; }
    if (data && !files.find(f => f.id === data.id)) files = [data, ...files];
    uploadFileObj = null; uploadFolder = 'designs'; lockFile = false; unlockType = 'payment'; unlockInvoiceId = '';
    showFileModal = false;
    uploadingFile = false;
    showToast('File uploaded');
  }

  async function deleteProjectFile(f: any) {
    if (!confirm(`Delete "${f.file_name}"?`)) return;
    const { error } = await supabase.from('files').delete().eq('id', f.id);
    if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
    files = files.filter(x => x.id !== f.id);
  }

  async function createProjectTask(e: Event) {
    e.preventDefault();
    if (!newTaskTitle.trim() || !authState.agencyId) return;
    savingTask = true;
    const { data, error } = await supabase.from('tasks').insert({
      agency_id: authState.agencyId,
      project_id: projectId,
      title: newTaskTitle,
      description: newTaskDesc || null,
      category: newTaskCategory || null,
      priority: newTaskPriority,
      status: newTaskColumn,
      visible_to_client: newTaskVisibleToClient
    }).select('*').single();
    if (error) showToast('Could not create task: ' + error.message, 'error');
    else if (data) {
      if (!tasks.find(t => t.id === data.id)) tasks = [data, ...tasks];
      newTaskTitle = ''; newTaskDesc = ''; newTaskCategory = ''; newTaskPriority = 'medium'; newTaskColumn = 'today'; newTaskVisibleToClient = false;
      showTaskForm = false;
    }
    savingTask = false;
  }

  async function toggleTask(t: any) {
    const status = t.status === 'done' ? 'today' : 'done';
    const prev = tasks;
    tasks = tasks.map(x => x.id === t.id ? { ...x, status } : x);
    const { error } = await supabase.from('tasks').update({ status }).eq('id', t.id);
    if (error) { tasks = prev; showToast('Update failed: ' + error.message, 'error'); }
  }

  async function deleteTask(t: any) {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    const { error } = await supabase.from('tasks').delete().eq('id', t.id);
    if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
    tasks = tasks.filter(x => x.id !== t.id);
  }

  async function sendProjectMessage() {
    if (!msgInput.trim() || !project?.client_id || !authState.agencyId || !authState.user) return;
    sendingMsg = true;
    const { data, error } = await supabase.from('messages').insert({
      agency_id: authState.agencyId,
      client_id: project.client_id,
      project_id: projectId,
      sender_type: 'agency',
      sender_id: authState.user.id,
      content: msgInput
    }).select('*').single();
    if (error) showToast('Send failed: ' + error.message, 'error');
    else if (data) {
      if (!messages.find(m => m.id === data.id)) messages = [...messages, data];
      msgInput = '';
      scrollMessages();
    }
    sendingMsg = false;
  }

  function fmtTime(d: string) {
    return new Date(d).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function manualReload() {
    dataLoaded = false; // allow reload
    await loadProject();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isTomorrow(dateStr: string) {
    const d = new Date(dateStr);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d.toDateString() === tomorrow.toDateString();
  }

  function statusDisplay(s: string) {
    if (s === 'active') return 'Active';
    if (s === 'completed') return 'Completed';
    return 'On Hold';
  }

  async function postTimelineUpdate() {
    if (!updateContent.trim()) return;
    postingUpdate = true;
    const { data, error } = await supabase
      .from('timeline_updates')
      .insert({
        project_id: projectId,
        posted_by: authState.user?.id || null,
        content: updateContent,
        status: updateStatus
      })
      .select('*')
      .single();
    if (data) {
      timeline = [data, ...timeline];
      updateContent = '';
      updateStatus = 'in_progress';
      showUpdateForm = false;
    }
    postingUpdate = false;
  }

  async function handleApproval(id: string, newStatus: 'approved' | 'changes_requested') {
    const { error } = await supabase
      .from('approvals')
      .update({ status: newStatus, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      approvals = approvals.map(a => a.id === id ? { ...a, status: newStatus } : a);
    }
  }

  async function createApproval() {
    if (!newApprovalTitle.trim()) return;
    submittingApproval = true;
    const { data, error } = await supabase
      .from('approvals')
      .insert({
        project_id: projectId,
        title: newApprovalTitle,
        description: newApprovalDesc || null,
        image_url: newApprovalImage || null,
        status: 'pending'
      })
      .select('*')
      .single();
    if (data) {
      approvals = [data, ...approvals];
      newApprovalTitle = '';
      newApprovalDesc = '';
      newApprovalImage = '';
      showApprovalModal = false;
    }
    submittingApproval = false;
  }

  async function createMilestone() {
    if (!newMilestoneTitle.trim()) return;
    submittingMilestone = true;
    const { data, error } = await supabase
      .from('milestones')
      .insert({
        project_id: projectId,
        title: newMilestoneTitle,
        description: newMilestoneDesc || null,
        due_date: newMilestoneDue || null,
        is_completed: false
      })
      .select('*')
      .single();
    if (data) {
      milestones = [...milestones, data];
      newMilestoneTitle = '';
      newMilestoneDesc = '';
      newMilestoneDue = '';
      showMilestoneModal = false;
    }
    submittingMilestone = false;
  }

  async function deleteApproval(id: string) {
    if (!confirm('Are you sure you want to delete this approval?')) return;
    const { error } = await supabase.from('approvals').delete().eq('id', id);
    if (!error) {
      approvals = approvals.filter(a => a.id !== id);
    }
  }

  async function deleteMilestone(id: string) {
    if (!confirm('Are you sure you want to delete this milestone?')) return;
    const { error } = await supabase.from('milestones').delete().eq('id', id);
    if (!error) {
      milestones = milestones.filter(m => m.id !== id);
    }
  }

  function getFileType(file: File): 'image' | 'pdf' {
    if (file.type === 'application/pdf') return 'pdf';
    return 'image';
  }

  async function uploadDeliverable() {
    if (!newDelTitle.trim() || !newDelFile || !project) return;
    submittingDeliverable = true;
    uploadingDeliverable = true;
    deliverableUploadProgress = 10;

    const fileType = getFileType(newDelFile);
    const fileName = `deliverables/${authState.agencyId}/${Date.now()}_${newDelFile.name}`;
    deliverableUploadProgress = 30;

    const { error: storageErr } = await supabase.storage
      .from('ClientDeskBucket')
      .upload(fileName, newDelFile);
    if (storageErr) {
      showToast('Upload failed: ' + storageErr.message, 'error');
      submittingDeliverable = false;
      uploadingDeliverable = false;
      return;
    }
    deliverableUploadProgress = 70;

    const { data: urlData } = supabase.storage.from('ClientDeskBucket').getPublicUrl(fileName);
    const fileUrl = urlData?.publicUrl || '';

    const { data: del, error: dbErr } = await supabase.from('deliverables').insert({
      agency_id: authState.agencyId,
      project_id: projectId,
      client_id: project.client_id || null,
      title: newDelTitle,
      description: newDelDesc || null,
      file_url: fileUrl,
      file_path: fileName,
      file_type: fileType,
      thumbnail_url: fileType === 'image' ? fileUrl : null,
      status: 'pending',
      version: 1,
    }).select('*').single();

    if (dbErr) {
      showToast('Failed to save: ' + dbErr.message, 'error');
    } else if (del) {
      deliverables = [del, ...deliverables];
      newDelTitle = '';
      newDelDesc = '';
      newDelFile = null;
      showDeliverableModal = false;
      showToast('Deliverable uploaded!');

      // Notify client
      if (project.client_id) {
        const { data: clientUsers } = await supabase
          .from('client_users')
          .select('id')
          .eq('client_id', project.client_id)
          .limit(1);
        if (clientUsers && clientUsers.length > 0) {
          await supabase.from('notifications').insert({
            user_id: clientUsers[0].id,
            title: `New deliverable: ${del.title}`,
            body: `A new deliverable has been uploaded for ${project.name}`,
            type: 'approval',
          });
        }

        // Send email to client
        const { data: clientData } = await supabase.from('clients').select('email, full_name').eq('id', project.client_id).single();
        if (clientData?.email && authState.agencyId) {
          sendBrandedEmail({
            to: clientData.email,
            subject: `${authState.agencyName || 'Your agency'} shared '${del.title}' for your review`,
            body_html: `<p>Hi ${clientData.full_name || 'there'},</p>
              <p><strong>${authState.agencyName || 'Your agency'}</strong> has shared a new deliverable for your review on project <strong>${project.name}</strong>.</p>
              <p style="font-weight:600;">${del.title}</p>
              ${newDelDesc ? `<p style="color:#6b7280;">${newDelDesc}</p>` : ''}
              <p>Please review and leave your feedback or approve it.</p>`,
            cta_text: 'Review & Give Feedback',
            cta_url: `${window.location.origin}/client/projects/${projectId}`,
            agency_id: authState.agencyId,
            agency_name: authState.agencyName || 'ClientDesk',
            agency_logo_url: agencyBranding.logo_url,
            agency_primary_color: agencyBranding.primary_color,
            reply_to: agencyBranding.reply_to_email || agencyBranding.email || undefined,
          });
        }
      }
    }
    deliverableUploadProgress = 100;
    submittingDeliverable = false;
    uploadingDeliverable = false;
  }

  async function uploadNewVersion(existing: any) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      submittingDeliverable = true;

      const fileType = getFileType(file);
      const fileName = `deliverables/${authState.agencyId}/${Date.now()}_${file.name}`;
      const { error: storageErr } = await supabase.storage.from('ClientDeskBucket').upload(fileName, file);
      if (storageErr) { showToast('Upload failed', 'error'); submittingDeliverable = false; return; }

      const { data: urlData } = supabase.storage.from('ClientDeskBucket').getPublicUrl(fileName);
      const fileUrl = urlData?.publicUrl || '';

      const { data: del } = await supabase.from('deliverables').insert({
        agency_id: authState.agencyId,
        project_id: projectId,
        client_id: project?.client_id || null,
        title: existing.title,
        description: existing.description,
        file_url: fileUrl,
        file_path: fileName,
        file_type: fileType,
        thumbnail_url: fileType === 'image' ? fileUrl : null,
        status: 'pending',
        version: existing.version + 1,
      }).select('*').single();

      if (del) {
        deliverables = [del, ...deliverables];
        showToast('New version uploaded!');
      }
      submittingDeliverable = false;
    };
    input.click();
  }

  async function openProofing(del: any) {
    const { data: pinsData } = await supabase
      .from('pins')
      .select('*')
      .eq('deliverable_id', del.id)
      .order('created_at', { ascending: true });
    proofingDeliverable = del;
    proofingPins = pinsData || [];
    showProofing = true;
  }

  function closeProofing() {
    showProofing = false;
    proofingDeliverable = null;
    proofingPins = [];
  }

  function handleProofingStatusChange(newStatus: string, data?: any) {
    if (proofingDeliverable) {
      deliverables = deliverables.map(d =>
        d.id === proofingDeliverable.id
          ? { ...d, status: newStatus, ...(data || {}) }
          : d
      );
      proofingDeliverable = { ...proofingDeliverable, status: newStatus, ...(data || {}) };
    }
  }

  function delStatusBadge(s: string) {
    if (s === 'approved') return 'bg-[#dcfce7] text-[#166534]';
    if (s === 'changes_requested') return 'bg-[#fef3c7] text-[#b45309]';
    if (s === 'in_review') return 'bg-[#dbeafe] text-[#1e40af]';
    return 'bg-surface-variant text-on-surface-variant';
  }
  function delStatusLabel(s: string) {
    if (s === 'approved') return 'Approved';
    if (s === 'changes_requested') return 'Changes Req.';
    if (s === 'in_review') return 'In Review';
    return 'Pending';
  }

</script>

<svelte:head>
  <title>{project?.name || 'Project'} - ClientDesk</title>
</svelte:head>

<style>
  .kanban-track { min-width: 280px; max-width: 360px; flex: 1; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>

<div class="fixed inset-0 bg-background text-on-background flex overflow-hidden w-full">
  <AgencyHeader activeTab="Projects" />

  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full space-y-5">
    {#if loading}
      <div class="py-16 flex justify-center items-center"><div class="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
    {:else if !project}
      <div class="py-16 text-center"><p class="text-sm text-on-surface-variant">Project not found</p></div>
    {:else}
      <a href="/projects" class="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors w-fit no-underline">
        <span class="material-symbols-outlined text-[16px]">arrow_back</span>
        <span class="text-[13px] font-medium">Projects</span>
      </a>

      <div class="bg-white rounded-lg border border-outline-variant shadow-xs p-5 animate-fadeIn">
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-[11px] font-medium px-1.5 py-0.5 rounded {project.status === 'active' ? 'text-success bg-success/[0.08]' : project.status === 'completed' ? 'text-primary bg-primary/[0.08]' : 'text-tertiary bg-tertiary/[0.08]'}">{statusDisplay(project.status)}</span>
              <span class="text-xs text-on-surface-variant">
                {project.deadline ? `Due ${formatDate(project.deadline)}` : 'No deadline'}
              </span>
            </div>
            <div class="flex items-center gap-3 mb-1">
              <h2 class="text-lg font-semibold text-on-surface">{project.name}</h2>
              <button
                onclick={summarizeProject}
                disabled={aiProjectSummarizing}
                class="text-on-surface-variant hover:text-primary w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center transition-colors disabled:opacity-50"
                title="AI Summary"
              >
                <span class="material-symbols-outlined text-[18px] {aiProjectSummarizing ? 'animate-spin' : ''}">auto_awesome</span>
              </button>
              <button
                onclick={manualReload}
                disabled={loading}
                class="text-on-surface-variant hover:text-primary w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center transition-colors disabled:opacity-50"
                title="Reload"
              >
                <span class="material-symbols-outlined text-[18px] {loading ? 'animate-spin' : ''}">refresh</span>
              </button>
            </div>
            <p class="text-sm text-on-surface-variant">Client: {project.clients?.full_name || 'Unknown'}</p>
            {#if project.description}
              <p class="text-[13px] text-on-surface-variant mt-2 max-w-xl">{project.description}</p>
            {/if}
          </div>
          <div class="flex items-center gap-3 bg-surface-container-low p-3 rounded-lg shrink-0">
            <div class="w-12 h-12 rounded-full border-[3px] border-primary/20 flex items-center justify-center relative">
              <svg class="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path class="text-outline-variant" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>
                <path class="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray={dashArray} stroke-linecap="round" stroke-width="3"></path>
              </svg>
              <span class="text-sm font-semibold z-10">{project.progress || 0}%</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[11px] text-on-surface-variant">Completion</span>
              <span class="text-sm font-medium text-on-surface">{project.progress >= 100 ? 'Done' : project.progress >= 50 ? 'On Track' : 'In Progress'}</span>
            </div>
          </div>
        </div>
      </div>

      {#if showProjectSummary}
        <div class="bg-tertiary/[0.04] border border-tertiary/15 rounded-lg p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2.5 flex-1 min-w-0">
              <span class="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">auto_awesome</span>
              <div class="flex-1 min-w-0">
                <p class="text-[11px] font-medium text-tertiary mb-1.5">AI Project Summary</p>
                {#if aiProjectSummarizing}
                  <p class="text-sm text-on-surface-variant">Generating summary...</p>
                {:else}
                  <p class="text-sm text-on-surface whitespace-pre-wrap">{aiProjectSummary}</p>
                {/if}
              </div>
            </div>
            <button onclick={() => { showProjectSummary = false; }} class="text-on-surface-variant hover:text-on-surface w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      {/if}

      <div class="flex gap-1.5 border-b border-outline-variant tab-strip pb-2">
        {#each ['Overview', 'Deliverables', 'Files', 'Tasks', 'Messages'] as tab}
          <button
            onclick={() => activeTab = tab}
            class="px-3 py-1 rounded-md text-[13px] font-medium shrink-0 transition-colors {activeTab === tab ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}"
          >
            {tab}
            {#if tab === 'Deliverables' && deliverables.length > 0}
              <span class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-medium {activeTab === tab ? 'bg-white/20' : 'bg-primary/10 text-primary'}">{deliverables.length}</span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Overview Tab Content -->
      {#if activeTab === 'Overview'}
        <div class="flex overflow-x-auto gap-3 pb-6 no-scrollbar items-start min-h-[400px]">
          <div class="flex flex-col gap-3 kanban-track shrink-0 bg-surface-container-low p-3 rounded-lg">
            <div class="flex justify-between items-center mb-2 px-1">
              <h3 class="font-title-md text-title-md text-on-surface">Timeline</h3>
              <button class="text-on-surface-variant hover:text-primary focus:outline-none" onclick={() => showUpdateForm = !showUpdateForm}>
                <span class="material-symbols-outlined">{showUpdateForm ? 'close' : 'add'}</span>
              </button>
            </div>

            <!-- Post Update Form -->
            {#if showUpdateForm}
              <div class="bg-surface rounded-lg p-4 shadow-level-2 border border-primary/30 space-y-3">
                <textarea
                  bind:value={updateContent}
                  placeholder="What's the update?"
                  rows="2"
                  disabled={postingUpdate}
                  class="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                ></textarea>
                <select
                  bind:value={updateStatus}
                  disabled={postingUpdate}
                  class="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending">Pending</option>
                </select>
                <button
                  onclick={postTimelineUpdate}
                  disabled={postingUpdate || !updateContent.trim()}
                  class="w-full py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {#if postingUpdate}
                    <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Posting...
                  {:else}
                    Post Update
                  {/if}
                </button>
              </div>
            {/if}

            {#if timeline.length === 0}
              <p class="text-sm text-on-surface-variant text-center py-4">No updates yet.</p>
            {/if}

            {#each timeline as item (item.id)}
              <div class="bg-surface rounded-lg p-4 shadow-level-2 cursor-pointer border border-transparent hover:border-outline-variant/50">
                <div class="flex items-start gap-3">
                  <div class="bg-surface-container-high p-2 rounded-full shrink-0 mt-1">
                    {#if item.status === 'completed'}
                      <span class="material-symbols-outlined text-[#10b981] text-[20px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                    {:else if item.status === 'in_progress'}
                      <span class="material-symbols-outlined text-[#f59e0b] text-[20px]" style="font-variation-settings: 'FILL' 1;">pending</span>
                    {:else}
                      <span class="material-symbols-outlined text-outline-variant text-[20px]">radio_button_unchecked</span>
                    {/if}
                  </div>
                  <div>
                    <p class="font-body-md text-body-md text-on-surface">{item.content}</p>
                    <p class="font-label-md text-[11px] text-outline mt-2 uppercase">
                      {formatDate(item.created_at)} • {item.status === 'completed' ? 'Completed' : item.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Column 2: Approvals -->
          <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl border-l-4 border-error/50">
            <div class="flex justify-between items-center mb-2 px-1">
              <div class="flex items-center gap-2">
                <h3 class="font-title-md text-title-md text-on-surface">Approvals</h3>
                {#if approvals.filter(a => a.status === 'pending').length > 0}
                  <span class="bg-error-container text-on-error-container px-2 py-0.5 rounded-full font-label-md text-[10px]">{approvals.filter(a => a.status === 'pending').length} Pending</span>
                {/if}
              </div>
              <button class="flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none" onclick={() => showApprovalModal = true}>
                <span class="material-symbols-outlined text-[16px]">add</span> Add Approval
              </button>
            </div>

            {#if approvals.length === 0}
              <div class="flex flex-col items-center justify-center py-8 border-2 border-dashed border-outline-variant/40 rounded-xl text-outline-variant text-center px-4">
                <span class="material-symbols-outlined text-3xl mb-2">approval</span>
                <p class="text-xs font-semibold mb-1">No approvals yet</p>
                <p class="text-[10px] text-outline mb-3">Create one for client review.</p>
                <button
                  class="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1 focus:outline-none"
                  onclick={() => showApprovalModal = true}
                >
                  <span class="material-symbols-outlined text-[16px]">add</span> Add Approval
                </button>
              </div>
            {/if}

            {#each approvals as item (item.id)}
              <div class="bg-surface rounded-lg shadow-level-2 overflow-hidden border border-transparent hover:border-outline-variant/50">
                {#if item.image_url}
                  <div class="h-32 bg-surface-variant w-full relative group">
                    <img alt="Approval preview" class="w-full h-full object-cover" src={item.image_url} />
                  </div>
                {/if}
                <div class="p-4">
                  <div class="flex items-start justify-between mb-1 gap-2">
                    <div class="flex flex-col gap-1">
                      <h4 class="font-body-md text-body-md font-semibold text-on-surface">{item.title}</h4>
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded-full font-label-md text-[10px] {item.status === 'approved' ? 'bg-[#10b981]/10 text-[#059669]' : item.status === 'changes_requested' ? 'bg-tertiary-container/10 text-tertiary-container' : 'bg-error-container/30 text-error'}">
                          {item.status === 'approved' ? 'Approved' : item.status === 'changes_requested' ? 'Changes Req.' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    <button class="text-outline-variant hover:text-error transition-colors focus:outline-none p-1 rounded hover:bg-error-container/20 shrink-0" onclick={() => deleteApproval(item.id)} title="Delete Approval">
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                  {#if item.description}
                    <p class="font-body-md text-[13px] text-on-surface-variant mb-3">{item.description}</p>
                  {/if}
                  {#if item.status === 'pending'}
                    <div class="flex items-center gap-2 text-[11px] text-outline mt-1">
                      <span class="material-symbols-outlined text-[14px]">hourglass_top</span>
                      Waiting for client review
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

          <!-- Column 3: Milestones -->
          <div class="flex flex-col gap-4 kanban-track shrink-0 bg-surface-container-low p-4 rounded-xl">
            <div class="flex justify-between items-center mb-2 px-1">
              <h3 class="font-title-md text-title-md text-on-surface">Milestones</h3>
              <button class="flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none" onclick={() => showMilestoneModal = true}>
                <span class="material-symbols-outlined text-[16px]">add</span> Add Milestone
              </button>
            </div>

            {#if milestones.length === 0}
              <div class="flex flex-col items-center justify-center py-8 border-2 border-dashed border-outline-variant/40 rounded-xl text-outline-variant text-center px-4">
                <span class="material-symbols-outlined text-3xl mb-2">flag</span>
                <p class="text-xs font-semibold mb-1">No milestones yet</p>
                <p class="text-[10px] text-outline mb-3">Track project progress with milestones.</p>
                <button
                  class="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1 focus:outline-none"
                  onclick={() => showMilestoneModal = true}
                >
                  <span class="material-symbols-outlined text-[16px]">add</span> Add Milestone
                </button>
              </div>
            {/if}

            {#each milestones as ms (ms.id)}
              <div class="bg-surface rounded-lg p-4 shadow-level-2 cursor-pointer border border-transparent hover:border-outline-variant/50 relative overflow-hidden group">
                <div class="absolute top-0 left-0 w-1 h-full {ms.due_date && isTomorrow(ms.due_date) ? 'bg-tertiary-container' : ms.is_completed ? 'bg-[#10b981]' : 'bg-outline-variant'}"></div>
                
                <button class="absolute top-2 right-2 text-outline-variant hover:text-error transition-colors focus:outline-none p-1 rounded hover:bg-error-container/20 opacity-0 group-hover:opacity-100" onclick={() => deleteMilestone(ms.id)} title="Delete Milestone">
                  <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>

                <div class="flex justify-between items-start mb-3 pr-6">
                  {#if ms.due_date && isTomorrow(ms.due_date)}
                    <span class="bg-tertiary-container text-on-tertiary-container px-2 py-1 rounded font-label-md text-[10px] tracking-widest uppercase font-bold flex items-center gap-1">
                      <span class="material-symbols-outlined text-[12px]">schedule</span> TOMORROW
                    </span>
                  {:else if ms.is_completed}
                    <span class="bg-[#10b981]/10 text-[#059669] px-2 py-1 rounded font-label-md text-[10px] tracking-widest uppercase font-bold">COMPLETED</span>
                  {:else}
                    <span class="text-outline font-label-md text-[11px] uppercase tracking-wider font-semibold">
                      {ms.due_date ? formatDate(ms.due_date) : 'No date'}
                    </span>
                  {/if}
                </div>
                <h4 class="font-body-md text-body-md font-semibold text-on-surface mb-1">{ms.title}</h4>
                {#if ms.description}
                  <p class="font-body-md text-[13px] text-on-surface-variant">{ms.description}</p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {:else if activeTab === 'Deliverables'}
        <!-- Deliverables Tab -->
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="font-title-md text-title-md text-on-surface">Deliverables ({deliverables.length})</h3>
            <button
              onclick={() => showDeliverableModal = true}
              class="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-sm focus:outline-none"
            >
              <span class="material-symbols-outlined text-[18px]">add</span> Add Deliverable
            </button>
          </div>

          {#if deliverables.length === 0}
            <div class="flex flex-col items-center justify-center py-16 border-2 border-dashed border-outline-variant/40 rounded-xl text-center">
              <span class="material-symbols-outlined text-5xl text-outline-variant mb-3">design_services</span>
              <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-1">No deliverables yet</h3>
              <p class="font-body-md text-body-md text-on-surface-variant mb-4">Upload designs, mockups, or documents for client review.</p>
              <button
                onclick={() => showDeliverableModal = true}
                class="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 focus:outline-none"
              >
                <span class="material-symbols-outlined text-[18px]">upload_file</span> Upload Deliverable
              </button>
            </div>
          {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each deliverables as del (del.id)}
                <div class="bg-surface rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer" onclick={() => openProofing(del)}>
                  <!-- Thumbnail -->
                  <div class="h-40 bg-surface-container-high relative overflow-hidden">
                    {#if del.file_type === 'image' && (signedThumbUrls[del.id] || del.file_url)}
                      <img src={signedThumbUrls[del.id] || ''} alt={del.title} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
                        <span class="material-symbols-outlined text-5xl text-red-400">picture_as_pdf</span>
                      </div>
                    {/if}
                    <div class="absolute top-2 right-2">
                      <span class="{delStatusBadge(del.status)} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shadow-sm">{delStatusLabel(del.status)}</span>
                    </div>
                    <div class="absolute bottom-2 left-2 flex items-center gap-1.5">
                      <span class="bg-black/60 text-white px-2 py-0.5 rounded text-[10px] font-bold">v{del.version}</span>
                    </div>
                  </div>
                  <!-- Info -->
                  <div class="p-4">
                    <h4 class="font-title-md text-title-md text-on-surface truncate mb-1">{del.title}</h4>
                    {#if del.description}
                      <p class="text-xs text-on-surface-variant truncate mb-2">{del.description}</p>
                    {/if}
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] text-outline">{formatDate(del.created_at)}</span>
                      <div class="flex items-center gap-2">
                        {#if del.status !== 'approved'}
                          <button
                            onclick={(e) => { e.stopPropagation(); uploadNewVersion(del); }}
                            class="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-surface-container transition-colors focus:outline-none"
                            title="Upload new version"
                          >
                            <span class="material-symbols-outlined text-[18px]">upload</span>
                          </button>
                        {/if}
                        <button
                          onclick={(e) => { e.stopPropagation(); openProofing(del); }}
                          class="text-primary hover:bg-primary/10 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors focus:outline-none"
                        >
                          <span class="material-symbols-outlined text-[16px]">preview</span> Review
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if activeTab === 'Files'}
        <div class="space-y-4 animate-fadeIn">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-on-surface">Project Files ({files.length})</h3>
            <button onclick={() => { fileError = ''; showFileModal = true; }} class="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">upload_file</span> Upload File
            </button>
          </div>
          {#if files.length === 0}
            <div class="py-14 text-center border border-dashed border-outline-variant rounded-lg">
              <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">folder_off</span>
              <p class="text-sm font-medium text-on-surface mb-1">No files yet</p>
              <p class="text-[13px] text-on-surface-variant">Upload a file to share it with {project.clients?.full_name || 'the client'}.</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each files as f (f.id)}
                {@const ic = fileIcon(f.file_name)}
                {@const locked = f.is_locked && !f.unlocked_at}
                <div class="bg-white border border-outline-variant rounded-lg p-4 shadow-xs flex flex-col">
                  <div class="flex items-start gap-3 mb-3">
                    <div class="w-9 h-9 rounded-lg {ic.bg} {ic.text} flex items-center justify-center shrink-0">
                      <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' 1;">{ic.icon}</span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="text-sm font-medium text-on-surface truncate" title={f.file_name}>{f.file_name}</h4>
                      <p class="text-xs text-on-surface-variant">{formatSize(f.file_size)}{f.file_size ? ' · ' : ''}{formatDate(f.created_at)}</p>
                      <div class="flex flex-wrap gap-1 mt-1.5">
                        <span class="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-medium">{folderLabels[f.folder] || f.folder}</span>
                        {#if f.folder === 'client_uploads'}
                          <span class="px-1.5 py-0.5 rounded bg-secondary/[0.08] text-secondary text-[10px] font-medium">From client</span>
                        {/if}
                        {#if locked}
                          <span class="px-1.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container text-[10px] font-medium flex items-center gap-0.5"><span class="material-symbols-outlined text-[10px]">lock</span>{f.unlock_type === 'approval' ? 'Approval' : 'Payment'}</span>
                        {:else if f.is_locked}
                          <span class="px-1.5 py-0.5 rounded bg-success/[0.1] text-success text-[10px] font-medium flex items-center gap-0.5"><span class="material-symbols-outlined text-[10px]">lock_open</span>Unlocked</span>
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="mt-auto pt-3 border-t border-outline-variant flex items-center justify-between">
                    <button onclick={() => deleteProjectFile(f)} class="text-on-surface-variant hover:text-error text-xs flex items-center gap-1 transition-colors"><span class="material-symbols-outlined text-[14px]">delete</span> Delete</button>
                    <button onclick={() => downloadFile(f)} class="px-2.5 py-1 border border-outline-variant text-on-surface-variant rounded-lg text-xs font-medium hover:border-primary hover:text-primary transition-colors flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">download</span> Download
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      {:else if activeTab === 'Tasks'}
        <div class="space-y-4 animate-fadeIn">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-on-surface">Tasks ({tasks.filter(t => t.status !== 'done').length} open, {tasks.filter(t => t.status === 'done').length} done)</h3>
            <button onclick={() => showTaskForm = !showTaskForm} class="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">{showTaskForm ? 'close' : 'add'}</span> {showTaskForm ? 'Cancel' : 'New Task'}
            </button>
          </div>

          {#if showTaskForm}
            <form onsubmit={createProjectTask} class="bg-white border border-outline-variant rounded-lg p-4 shadow-xs space-y-3">
              <div>
                <label class="block text-xs font-medium text-on-surface-variant mb-1" for="pt-title">Title *</label>
                <input id="pt-title" bind:value={newTaskTitle} required placeholder="e.g. Design landing page" class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-xs font-medium text-on-surface-variant mb-1" for="pt-desc">Description</label>
                <textarea id="pt-desc" bind:value={newTaskDesc} rows="2" class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"></textarea>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-medium text-on-surface-variant mb-1" for="pt-pri">Priority</label>
                  <select id="pt-pri" bind:value={newTaskPriority} class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary">
                    <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-on-surface-variant mb-1" for="pt-cat">Category</label>
                  <input id="pt-cat" bind:value={newTaskCategory} placeholder="e.g. Design" class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-on-surface-variant mb-1" for="pt-col">Status</label>
                  <select id="pt-col" bind:value={newTaskColumn} class="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary">
                    <option value="today">Today</option><option value="this_week">This Week</option><option value="done">Done</option>
                  </select>
                </div>
              </div>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" bind:checked={newTaskVisibleToClient} class="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary" />
                <span class="text-xs font-medium text-on-surface-variant">Show to client</span>
              </label>
              <div class="flex justify-end">
                <button type="submit" disabled={savingTask || !newTaskTitle.trim()} class="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium disabled:opacity-50">{savingTask ? 'Saving...' : 'Create Task'}</button>
              </div>
            </form>
          {/if}

          {#if tasks.length === 0}
            <div class="py-14 text-center border border-dashed border-outline-variant rounded-lg">
              <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">task_alt</span>
              <p class="text-sm font-medium text-on-surface mb-1">No tasks for this project</p>
              <p class="text-[13px] text-on-surface-variant">Create the first task to start tracking work.</p>
            </div>
          {:else}
            <div class="bg-white border border-outline-variant rounded-lg shadow-xs divide-y divide-outline-variant">
              {#each tasks as t (t.id)}
                <div class="flex items-start gap-3 px-4 py-3">
                  <button onclick={() => toggleTask(t)} title={t.status === 'done' ? 'Reopen' : 'Mark complete'} class="mt-0.5 shrink-0 {t.status === 'done' ? 'text-success' : 'text-outline hover:text-primary'}">
                    <span class="material-symbols-outlined text-[20px]" style={t.status === 'done' ? "font-variation-settings: 'FILL' 1;" : ''}>{t.status === 'done' ? 'check_circle' : 'radio_button_unchecked'}</span>
                  </button>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-on-surface {t.status === 'done' ? 'line-through text-on-surface-variant' : ''}">{t.title}</p>
                    {#if t.description}<p class="text-[13px] text-on-surface-variant mt-0.5">{t.description}</p>{/if}
                    <div class="flex flex-wrap gap-1.5 mt-1.5">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-medium {t.priority === 'high' ? 'bg-error-container text-on-error-container' : t.priority === 'low' ? 'bg-surface-container text-on-surface-variant' : 'bg-tertiary-container text-on-tertiary-container'}">{t.priority || 'medium'}</span>
                      {#if t.category}<span class="px-1.5 py-0.5 rounded bg-primary/[0.08] text-primary text-[10px] font-medium">{t.category}</span>{/if}
                      <span class="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-medium">{t.status === 'this_week' ? 'This week' : t.status === 'done' ? 'Done' : 'Today'}</span>
                      {#if t.visible_to_client}<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success"><span class="material-symbols-outlined text-[12px]">visibility</span> Client</span>{/if}
                    </div>
                  </div>
                  <button onclick={() => deleteTask(t)} class="text-on-surface-variant hover:text-error shrink-0" title="Delete task"><span class="material-symbols-outlined text-[18px]">delete</span></button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      {:else if activeTab === 'Messages'}
        <div class="bg-white rounded-lg border border-outline-variant shadow-xs flex flex-col animate-fadeIn" style="height: calc(100vh - 360px); min-height: 380px;">
          <div class="px-5 py-3 border-b border-outline-variant">
            <h3 class="text-sm font-medium text-on-surface">Conversation with {project.clients?.full_name || 'client'}</h3>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {#each messages as msg (msg.id)}
              {#if msg.sender_type === 'agency'}
                <div class="flex justify-end"><div class="bg-primary text-white px-3.5 py-2 rounded-2xl rounded-br-md max-w-[70%]"><p class="text-sm whitespace-pre-wrap">{msg.content}</p><p class="text-[10px] text-white/70 mt-1 text-right">{fmtTime(msg.created_at)}</p></div></div>
              {:else}
                <div class="flex justify-start"><div class="bg-surface-container border border-outline-variant px-3.5 py-2 rounded-2xl rounded-bl-md max-w-[70%]"><p class="text-sm text-on-surface whitespace-pre-wrap">{msg.content}</p><p class="text-[10px] text-outline mt-1">{fmtTime(msg.created_at)}</p></div></div>
              {/if}
            {/each}
            {#if messages.length === 0}
              <div class="h-full flex flex-col items-center justify-center text-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[28px] text-outline mb-2">chat</span>
                <p class="text-sm">No messages yet. Start the conversation.</p>
              </div>
            {/if}
            <div bind:this={messagesEnd}></div>
          </div>
          <div class="px-5 py-3 border-t border-outline-variant">
            <form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); sendProjectMessage(); }}>
              <input type="text" bind:value={msgInput} placeholder="Type a message..." disabled={sendingMsg} class="flex-1 px-3 py-2 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              <button type="submit" disabled={sendingMsg || !msgInput.trim()} class="bg-primary hover:bg-primary-hover text-white px-4 rounded-lg disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"><span class="material-symbols-outlined text-[18px]">send</span> Send</button>
            </form>
          </div>
        </div>
      {/if}
    {/if}
  </main>
<!-- Upload File Modal -->
{#if showFileModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
    <div class="bg-white w-full max-w-md rounded-lg shadow-lg border border-outline-variant animate-fadeIn p-5">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-[15px] font-semibold text-on-surface">Upload File</h3>
        <button class="text-on-surface-variant hover:text-on-surface w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center" onclick={() => showFileModal = false}><span class="material-symbols-outlined text-[18px]">close</span></button>
      </div>
      {#if fileError}
        <div class="mb-3 p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg text-sm flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">error</span>{fileError}</div>
      {/if}
      <form onsubmit={uploadProjectFile} class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-on-surface-variant mb-1" for="pf-file">Select file *</label>
          <input id="pf-file" type="file" disabled={uploadingFile} onchange={(e) => { const t = e.target as HTMLInputElement; uploadFileObj = t.files?.[0] || null; }} class="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary" />
          {#if uploadFileObj}<p class="text-xs text-on-surface-variant mt-1">{uploadFileObj.name} ({formatSize(uploadFileObj.size)})</p>{/if}
        </div>
        <div>
          <label class="block text-xs font-medium text-on-surface-variant mb-1" for="pf-folder">Folder</label>
          <select id="pf-folder" bind:value={uploadFolder} disabled={uploadingFile} class="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary">
            {#each agencyFolders as fo}<option value={fo}>{folderLabels[fo]}</option>{/each}
          </select>
        </div>
        <div class="border border-outline-variant rounded-lg p-3 space-y-3">
          <label class="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" bind:checked={lockFile} disabled={uploadingFile} class="w-4 h-4 rounded accent-primary" />
            <span class="text-xs font-medium text-on-surface flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">lock</span> Lock this file</span>
          </label>
          {#if lockFile}
            <div class="flex gap-2">
              <button type="button" onclick={() => unlockType = 'payment'} class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors {unlockType === 'payment' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}">Unlock on payment</button>
              <button type="button" onclick={() => unlockType = 'approval'} class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors {unlockType === 'approval' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}">Unlock on approval</button>
            </div>
            {#if unlockType === 'payment'}
              <select bind:value={unlockInvoiceId} disabled={uploadingFile} class="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-sm outline-none focus:border-primary" aria-label="Linked invoice">
                <option value="">-- No specific invoice --</option>
                {#each projectInvoices as inv (inv.id)}<option value={inv.id}>{inv.invoice_number}</option>{/each}
              </select>
            {:else}
              <p class="text-[11px] text-on-surface-variant">Unlocks automatically when the client approves a deliverable on this project.</p>
            {/if}
          {/if}
        </div>
        <div class="flex gap-3 pt-3 border-t border-outline-variant">
          <button type="button" onclick={() => showFileModal = false} disabled={uploadingFile} class="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low text-sm font-medium">Cancel</button>
          <button type="submit" disabled={uploadingFile || !uploadFileObj} class="flex-1 py-2 bg-primary text-white hover:bg-primary-hover rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {#if uploadingFile}<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Uploading...{:else}Upload{/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Add Approval Modal -->
{#if showApprovalModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
    <div class="bg-white w-full max-w-md rounded-lg shadow-lg border border-outline-variant overflow-hidden animate-fadeIn">
      <div class="flex justify-between items-center px-6 py-4 border-b border-outline-variant/20">
        <h3 class="font-title-md text-title-md font-bold text-on-surface">Add Approval</h3>
        <button class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container focus:outline-none" onclick={() => showApprovalModal = false}>
          <span class="material-symbols-outlined block">close</span>
        </button>
      </div>
      <form
        onsubmit={(e) => { e.preventDefault(); createApproval(); }}
        class="p-6 space-y-4"
      >
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="approval-title">Title *</label>
          <input type="text" id="approval-title" bind:value={newApprovalTitle} required placeholder="e.g. Homepage Design v2" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="approval-desc">Description</label>
          <textarea id="approval-desc" bind:value={newApprovalDesc} rows="2" placeholder="What needs to be reviewed?" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="approval-img">Image URL (optional)</label>
          <input type="url" id="approval-img" bind:value={newApprovalImage} placeholder="https://example.com/preview.png" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
        </div>
        <div class="flex gap-3 justify-end pt-4 border-t border-outline-variant/30">
          <button type="button" class="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg" onclick={() => showApprovalModal = false}>Cancel</button>
          <button type="submit" disabled={submittingApproval || !newApprovalTitle.trim()} class="px-5 py-2 text-sm font-semibold text-on-primary bg-primary hover:bg-primary/90 rounded-lg shadow-md disabled:opacity-50 flex items-center gap-2">
            {#if submittingApproval}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {/if}
            Create Approval
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Upload Deliverable Modal -->
{#if showDeliverableModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
    <div class="bg-white w-full max-w-md rounded-lg shadow-lg border border-outline-variant overflow-hidden animate-fadeIn">
      <div class="flex justify-between items-center px-6 py-4 border-b border-outline-variant/20">
        <h3 class="font-title-md text-title-md font-bold text-on-surface">Add Deliverable</h3>
        <button class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container focus:outline-none" onclick={() => showDeliverableModal = false}>
          <span class="material-symbols-outlined block">close</span>
        </button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); uploadDeliverable(); }} class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="del-title">Title *</label>
          <input type="text" id="del-title" bind:value={newDelTitle} required placeholder="e.g. Homepage Design v1" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="del-desc">Description</label>
          <textarea id="del-desc" bind:value={newDelDesc} rows="2" placeholder="What is this deliverable?" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="del-file">File * (JPG, PNG, WebP, or PDF)</label>
          <input
            type="file"
            id="del-file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={submittingDeliverable}
            onchange={(e) => { const t = e.target as HTMLInputElement; if (t.files?.[0]) newDelFile = t.files[0]; }}
            class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
          {#if newDelFile}
            <p class="text-xs text-on-surface-variant mt-1">{newDelFile.name} ({(newDelFile.size / 1024 / 1024).toFixed(1)} MB)</p>
          {/if}
        </div>
        {#if uploadingDeliverable}
          <div class="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
            <div class="h-full bg-primary rounded-full transition-all duration-300" style="width: {deliverableUploadProgress}%"></div>
          </div>
        {/if}
        <div class="flex gap-3 justify-end pt-4 border-t border-outline-variant/30">
          <button type="button" class="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg" onclick={() => showDeliverableModal = false}>Cancel</button>
          <button type="submit" disabled={submittingDeliverable || !newDelTitle.trim() || !newDelFile} class="px-5 py-2 text-sm font-semibold text-on-primary bg-primary hover:bg-primary/90 rounded-lg shadow-md disabled:opacity-50 flex items-center gap-2">
            {#if submittingDeliverable}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Uploading...
            {:else}
              <span class="material-symbols-outlined text-[16px]">upload_file</span> Upload
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Proofing Canvas -->
{#if showProofing && proofingDeliverable}
  <ProofingCanvas
    deliverable={proofingDeliverable}
    pins={proofingPins}
    userRole="agency"
    userId={authState.user?.id || ''}
    userName={authState.userFullName || 'Agency'}
    agencyId={authState.agencyId || ''}
    onClose={closeProofing}
    onStatusChange={handleProofingStatusChange}
  />
{/if}

<!-- Toast -->
{#if toastMsg}
  <div class="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg font-body-md text-body-md flex items-center gap-2 animate-fadeIn {toastType === 'error' ? 'bg-error-container text-on-error-container' : 'bg-on-surface text-surface'}">
    <span class="material-symbols-outlined text-sm">{toastType === 'error' ? 'error' : 'check_circle'}</span>
    {toastMsg}
  </div>
{/if}

<!-- Add Milestone Modal -->
{#if showMilestoneModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
    <div class="bg-white w-full max-w-md rounded-lg shadow-lg border border-outline-variant overflow-hidden animate-fadeIn">
      <div class="flex justify-between items-center px-6 py-4 border-b border-outline-variant/20">
        <h3 class="font-title-md text-title-md font-bold text-on-surface">Add Milestone</h3>
        <button class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container focus:outline-none" onclick={() => showMilestoneModal = false}>
          <span class="material-symbols-outlined block">close</span>
        </button>
      </div>
      <form
        onsubmit={(e) => { e.preventDefault(); createMilestone(); }}
        class="p-6 space-y-4"
      >
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="ms-title">Title *</label>
          <input type="text" id="ms-title" bind:value={newMilestoneTitle} required placeholder="e.g. Phase 1 Delivery" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="ms-desc">Description</label>
          <textarea id="ms-desc" bind:value={newMilestoneDesc} rows="2" placeholder="What does this milestone include?" class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-on-surface-variant mb-1" for="ms-due">Due Date</label>
          <input type="date" id="ms-due" bind:value={newMilestoneDue} class="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
        </div>
        <div class="flex gap-3 justify-end pt-4 border-t border-outline-variant/30">
          <button type="button" class="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg" onclick={() => showMilestoneModal = false}>Cancel</button>
          <button type="submit" disabled={submittingMilestone || !newMilestoneTitle.trim()} class="px-5 py-2 text-sm font-semibold text-on-primary bg-primary hover:bg-primary/90 rounded-lg shadow-md disabled:opacity-50 flex items-center gap-2">
            {#if submittingMilestone}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {/if}
            Create Milestone
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

</div>
