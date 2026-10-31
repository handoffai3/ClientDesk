<script lang="ts">
  import { apiFetch } from '$lib/apiFetch';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { sendBrandedEmail } from '$lib/emailTemplates';
  import { proofingOpen } from '$lib/proofingOpen';

  let {
    deliverable,
    pins: initialPins = [],
    userRole = 'agency',
    userId = '',
    userName = '',
    agencyId = '',
    onClose = () => {},
    onStatusChange = (_status: string, _data?: any) => {},
  }: {
    deliverable: any;
    pins?: any[];
    userRole?: 'agency' | 'client';
    userId?: string;
    userName?: string;
    agencyId?: string;
    onClose?: () => void;
    onStatusChange?: (status: string, data?: any) => void;
  } = $props();

  let pins = $state<any[]>(initialPins);
  let pinReplies = $state<Record<string, any[]>>({});
  let selectedPinId = $state<string | null>(null);
  let pinFilter = $state<'all' | 'unresolved' | 'resolved'>('all');

  // Canvas state
  let canvasContainer: HTMLDivElement;
  let imageEl: HTMLImageElement;
  let zoom = $state(1);
  let imageLoaded = $state(false);
  let imageNaturalWidth = $state(0);
  let imageNaturalHeight = $state(0);

  // PDF state
  let pdfDoc = $state<any>(null);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let pdfCanvas: HTMLCanvasElement;
  let pdfRendering = $state(false);
  let pdfPageWidth = $state(0);
  let pdfPageHeight = $state(0);

  // New pin state
  let newPinPos = $state<{ x: number; y: number } | null>(null);
  let newPinContent = $state('');
  let submittingPin = $state(false);
  let newPinInput: HTMLTextAreaElement;

  // Reply state
  let replyContent = $state<Record<string, string>>({});
  let submittingReply = $state<string | null>(null);

  // Mobile state
  let pinModeActive = $state(false);
  let mobileSheetOpen = $state(false);
  let pinError = $state('');

  // Toast
  let toastMsg = $state('');
  let toastType = $state<'success' | 'error'>('success');

  // AI Summary
  let aiPinSummary = $state('');
  let aiPinSummarizing = $state(false);
  let showPinSummary = $state(false);

  async function summarizePins() {
    if (pins.length === 0) return;
    aiPinSummarizing = true;
    aiPinSummary = '';
    showPinSummary = true;
    try {
      const res = await apiFetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pins',
          data: {
            pins: pins.map((p, i) => ({
              number: i + 1,
              content: p.content,
              is_resolved: p.is_resolved,
              replies: (pinReplies[p.id] || []).map((r: any) => ({
                author_type: r.author_type,
                content: r.content
              }))
            }))
          }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Summarization failed');
      aiPinSummary = json.summary;
    } catch (err: any) {
      aiPinSummary = `Error: ${err.message}`;
    } finally {
      aiPinSummarizing = false;
    }
  }

  let signedFileUrl = $state<string | null>(null);
  let fileUrl = $derived(signedFileUrl || deliverable.file_url);
  let isPdf = $derived(deliverable.file_type === 'pdf');
  let isApproved = $derived(deliverable.status === 'approved');

  // Agency branding for emails
  let agencyBrandingEmail = $state<{ name: string; logo_url: string | null; primary_color: string; email: string; reply_to_email: string | null }>({ name: 'ClientDesk', logo_url: null, primary_color: '#7C3AED', email: '', reply_to_email: null });

  let filteredPins = $derived.by(() => {
    let p = pins.filter(pin => isPdf ? pin.page_number === currentPage : true);
    if (pinFilter === 'unresolved') return p.filter(pin => !pin.is_resolved);
    if (pinFilter === 'resolved') return p.filter(pin => pin.is_resolved);
    return p;
  });

  let allPinsForList = $derived.by(() => {
    if (pinFilter === 'unresolved') return pins.filter(pin => !pin.is_resolved);
    if (pinFilter === 'resolved') return pins.filter(pin => pin.is_resolved);
    return pins;
  });

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    setTimeout(() => { toastMsg = ''; }, 3000);
  }

  async function notifyOtherParty(title: string, body: string) {
    try {
      if (userRole === 'client' && agencyId) {
        const { data: agencyUsers } = await supabase.from('users').select('id').eq('agency_id', agencyId).limit(5);
        for (const u of agencyUsers || []) {
          await supabase.from('notifications').insert({ user_id: u.id, title, body, type: 'approval' });
        }
      } else if (userRole === 'agency' && deliverable.client_id) {
        const { data: clientUsers } = await supabase.from('client_users').select('id').eq('client_id', deliverable.client_id).limit(1);
        if (clientUsers && clientUsers.length > 0) {
          await supabase.from('notifications').insert({ user_id: clientUsers[0].id, title, body, type: 'approval' });
        }
      }
    } catch { /* non-critical */ }
  }

  function getPinNumber(pin: any): number {
    return pins.indexOf(pin) + 1;
  }

  onMount(() => {
    proofingOpen.set(true);
    let channel: any;

    (async () => {
      // Fetch signed URL for the deliverable file
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.access_token && deliverable.id) {
          const res = await fetch('/api/files/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session.access_token}` },
            body: JSON.stringify({ type: 'deliverable', id: deliverable.id })
          });
          if (res.ok) {
            const json = await res.json();
            if (json.url) signedFileUrl = json.url;
          }
        }
      } catch { /* fall back to original URL */ }

      await loadPins();
      await loadAllReplies();
      if (isPdf) await loadPdf();

      if (agencyId) {
        const { data: ag } = await supabase.from('agencies').select('name, logo_url, primary_color, email, reply_to_email').eq('id', agencyId).single();
        if (ag) agencyBrandingEmail = ag as any;
      }

      channel = supabase.channel('proofing-' + deliverable.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pins', filter: `deliverable_id=eq.${deliverable.id}` }, (payload: any) => {
          if (!pins.find(p => p.id === payload.new.id)) {
            pins = [...pins, payload.new];
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pins', filter: `deliverable_id=eq.${deliverable.id}` }, (payload: any) => {
          pins = pins.map(p => p.id === payload.new.id ? payload.new : p);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pin_replies' }, (payload: any) => {
          const reply = payload.new;
          if (pins.find(p => p.id === reply.pin_id)) {
            pinReplies = {
              ...pinReplies,
              [reply.pin_id]: [...(pinReplies[reply.pin_id] || []), reply]
            };
          }
        })
        .subscribe();
    })();

    return () => { proofingOpen.set(false); if (channel) supabase.removeChannel(channel); };
  });

  async function loadPins() {
    const { data } = await supabase
      .from('pins')
      .select('*')
      .eq('deliverable_id', deliverable.id)
      .order('created_at', { ascending: true });
    if (data) pins = data;
  }

  async function loadAllReplies() {
    if (pins.length === 0) return;
    const pinIds = pins.map(p => p.id);
    const { data } = await supabase
      .from('pin_replies')
      .select('*')
      .in('pin_id', pinIds)
      .order('created_at', { ascending: true });
    if (data) {
      const grouped: Record<string, any[]> = {};
      for (const r of data) {
        if (!grouped[r.pin_id]) grouped[r.pin_id] = [];
        grouped[r.pin_id].push(r);
      }
      pinReplies = grouped;
    }
  }

  async function loadPdf() {
    pdfRendering = true;
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const loadingTask = pdfjsLib.getDocument(fileUrl);
      pdfDoc = await loadingTask.promise;
      totalPages = pdfDoc.numPages;
      await renderPdfPage(currentPage);
    } catch (err) {
      showToast('Failed to load PDF', 'error');
    }
    pdfRendering = false;
  }

  async function renderPdfPage(pageNum: number) {
    if (!pdfDoc || !pdfCanvas) return;
    pdfRendering = true;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 * zoom });
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    pdfPageWidth = viewport.width;
    pdfPageHeight = viewport.height;
    const ctx = pdfCanvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    pdfRendering = false;
  }

  function handleCanvasClick(e: MouseEvent) {
    if (isApproved) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile && !pinModeActive) return;
    const target = (isPdf ? pdfCanvas : imageEl) as HTMLElement;
    if (!target) return;
    if (e.target !== target && !(e.target as HTMLElement)?.closest?.('.canvas-area')) return;
    const rect = target.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    newPinPos = { x, y };
    newPinContent = '';
    pinError = '';
    if (isMobile) {
      mobileSheetOpen = true;
    }
    setTimeout(() => newPinInput?.focus(), 50);
  }

  async function submitPin() {
    if (!newPinPos || !newPinContent.trim()) return;
    submittingPin = true;
    pinError = '';
    try {
      const { data, error } = await supabase.from('pins').insert({
        deliverable_id: deliverable.id,
        author_id: userId,
        author_type: userRole,
        author_name: userName,
        x_percent: newPinPos.x,
        y_percent: newPinPos.y,
        page_number: isPdf ? currentPage : 1,
        content: newPinContent,
      }).select('*').single();

      if (error) {
        pinError = error.message || 'Failed to add pin';
        showToast('Failed to add pin', 'error');
        submittingPin = false;
        return;
      }
      if (data && !pins.find(p => p.id === data.id)) {
        pins = [...pins, data];
        notifyOtherParty(
          `New feedback on ${deliverable.title}`,
          `${userName}: "${newPinContent.substring(0, 80)}"`
        );
      }
      newPinPos = null;
      newPinContent = '';
      mobileSheetOpen = false;
      if (pinModeActive) pinModeActive = false;
    } catch (err: any) {
      pinError = err.message || 'Unexpected error';
      showToast('Failed to add pin', 'error');
    }
    submittingPin = false;
  }

  function cancelNewPin() {
    newPinPos = null;
    newPinContent = '';
    pinError = '';
  }

  async function toggleResolved(pin: any) {
    if (userRole !== 'agency') return;
    const newVal = !pin.is_resolved;
    const update: any = { is_resolved: newVal };
    if (newVal) { update.resolved_by = userId; update.resolved_at = new Date().toISOString(); }
    else { update.resolved_by = null; update.resolved_at = null; }
    await supabase.from('pins').update(update).eq('id', pin.id);
    pins = pins.map(p => p.id === pin.id ? { ...p, ...update } : p);
  }

  async function submitReply(pinId: string) {
    const content = replyContent[pinId]?.trim();
    if (!content) return;
    submittingReply = pinId;
    const { data } = await supabase.from('pin_replies').insert({
      pin_id: pinId,
      author_id: userId,
      author_type: userRole,
      author_name: userName,
      content,
    }).select('*').single();
    if (data) {
      pinReplies = {
        ...pinReplies,
        [pinId]: [...(pinReplies[pinId] || []), data]
      };
      const pin = pins.find(p => p.id === pinId);
      if (pin && pin.author_id !== userId) {
        notifyOtherParty(
          `Reply on ${deliverable.title}`,
          `${userName} replied to a pin`
        );
      }
    }
    replyContent = { ...replyContent, [pinId]: '' };
    submittingReply = null;
  }

  async function requestChanges() {
    await supabase.from('deliverables').update({ status: 'changes_requested', updated_at: new Date().toISOString() }).eq('id', deliverable.id);
    onStatusChange('changes_requested');
    notifyOtherParty(
      `Changes requested: ${deliverable.title}`,
      `${userName} requested changes on a deliverable`
    );

    // Email agency about changes requested
    if (userRole === 'client' && agencyId) {
      const { data: agencyUsers } = await supabase.from('users').select('email').eq('agency_id', agencyId).limit(3);
      for (const u of agencyUsers || []) {
        if (u.email) {
          sendBrandedEmail({
            to: u.email,
            subject: `${userName} requested changes on '${deliverable.title}'`,
            body_html: `<p><strong>${userName}</strong> has requested changes on the deliverable <strong>${deliverable.title}</strong>.</p>
              <p>Please review the feedback and upload a revised version.</p>`,
            cta_text: 'View Feedback',
            cta_url: `${window.location.origin}/projects/${deliverable.project_id}`,
            agency_id: agencyId,
            agency_name: agencyBrandingEmail.name,
            agency_logo_url: agencyBrandingEmail.logo_url,
            agency_primary_color: agencyBrandingEmail.primary_color,
          });
        }
      }
    }

    showToast('Changes requested');
  }

  async function approveDeliverable() {
    const now = new Date().toISOString();
    const updateData: any = {
      status: 'approved',
      approved_at: now,
      approved_by: userId,
      approved_user_agent: navigator.userAgent,
      updated_at: now,
    };
    await supabase.from('deliverables').update(updateData).eq('id', deliverable.id);

    // Unlock files linked via approval
    if (deliverable.project_id) {
      await supabase.rpc('unlock_approval_files', { p_project_id: deliverable.project_id });
    }

    onStatusChange('approved', updateData);
    notifyOtherParty(
      `Deliverable approved: ${deliverable.title}`,
      `${userName} approved the deliverable`
    );

    // Email agency about approval
    if (userRole === 'client' && agencyId) {
      const { data: agencyUsers } = await supabase.from('users').select('email').eq('agency_id', agencyId).limit(3);
      for (const u of agencyUsers || []) {
        if (u.email) {
          sendBrandedEmail({
            to: u.email,
            subject: `${userName} approved '${deliverable.title}'`,
            body_html: `<p>Great news! <strong>${userName}</strong> has approved the deliverable <strong>${deliverable.title}</strong>.</p>
              <p>Any files locked behind approval for this project have been automatically unlocked.</p>`,
            cta_text: 'View Deliverable',
            cta_url: `${window.location.origin}/projects/${deliverable.project_id}`,
            agency_id: agencyId,
            agency_name: agencyBrandingEmail.name,
            agency_logo_url: agencyBrandingEmail.logo_url,
            agency_primary_color: agencyBrandingEmail.primary_color,
          });
        }
      }
    }

    showToast('Deliverable approved!');
  }

  function selectPin(pinId: string) {
    selectedPinId = pinId;
    const el = document.getElementById('pin-thread-' + pinId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function scrollToCanvasPin(pin: any) {
    selectedPinId = pin.id;
  }

  function zoomIn() { zoom = Math.min(zoom + 0.25, 3); if (isPdf && pdfDoc) renderPdfPage(currentPage); }
  function zoomOut() { zoom = Math.max(zoom - 0.25, 0.5); if (isPdf && pdfDoc) renderPdfPage(currentPage); }
  function zoomFit() {
    if (canvasContainer && imageNaturalWidth > 0) {
      const containerWidth = canvasContainer.clientWidth - 32;
      zoom = Math.min(containerWidth / imageNaturalWidth, 3);
    } else {
      zoom = 1;
    }
    if (isPdf && pdfDoc) renderPdfPage(currentPage);
  }

  async function reopenDeliverable() {
    const now = new Date().toISOString();
    await supabase.from('deliverables').update({ status: 'pending', updated_at: now }).eq('id', deliverable.id);
    onStatusChange('pending', { status: 'pending', updated_at: now });
    showToast('Deliverable reopened');
  }

  async function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    newPinPos = null;
    await renderPdfPage(page);
  }

  function fmtTime(d: string) {
    return new Date(d).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function initials(name: string) { return name?.substring(0, 2).toUpperCase() || '??'; }

  function statusBadge(s: string) {
    if (s === 'approved') return 'bg-[#dcfce7] text-[#166534]';
    if (s === 'changes_requested') return 'bg-[#fef3c7] text-[#b45309]';
    if (s === 'in_review') return 'bg-[#dbeafe] text-[#1e40af]';
    return 'bg-surface-variant text-on-surface-variant';
  }
  function statusLabel(s: string) {
    if (s === 'approved') return 'Approved';
    if (s === 'changes_requested') return 'Changes Requested';
    if (s === 'in_review') return 'In Review';
    return 'Pending';
  }

  function handleImageLoad() {
    if (imageEl) {
      imageNaturalWidth = imageEl.naturalWidth;
      imageNaturalHeight = imageEl.naturalHeight;
      imageLoaded = true;
    }
  }
</script>

<style>
  .proofing-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0, 0, 0, 0.9);
    display: flex; flex-direction: column;
  }
  .pin-marker {
    position: absolute; transform: translate(-50%, -100%);
    cursor: pointer; transition: transform 0.15s ease;
    z-index: 10;
  }
  .pin-marker:hover { transform: translate(-50%, -100%) scale(1.15); }
  .pin-marker.selected { transform: translate(-50%, -100%) scale(1.2); z-index: 20; }
  .pin-dot {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    border: 2px solid white;
  }
  .pin-unresolved { background: #ef4444; }
  .pin-resolved { background: #22c55e; }
  .pin-popover {
    position: absolute; z-index: 30;
    transform: translate(-50%, 8px);
  }
  .canvas-area { cursor: crosshair; }
  .canvas-area.approved { cursor: default; }
  @media (max-width: 767px) {
    .canvas-area { cursor: default; touch-action: pan-x pan-y pinch-zoom; }
    .canvas-area.pin-mode { cursor: crosshair; touch-action: none; }
  }
  .thread-resolved { opacity: 0.6; }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .animate-slideUp { animation: slideUp 0.25s ease-out forwards; }
  .thread-resolved .thread-content { text-decoration: line-through; }
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
</style>

<div class="proofing-overlay">
  <!-- Top Toolbar -->
  <div class="bg-white border-b border-outline-variant px-3 md:px-5 py-2 md:py-2.5 flex items-center justify-between gap-2 md:gap-4 shrink-0">
    <div class="flex items-center gap-2 md:gap-4 min-w-0">
      <button onclick={onClose} class="text-on-surface-variant hover:text-primary p-1.5 rounded-lg hover:bg-surface-container transition-colors focus:outline-none shrink-0">
        <span class="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
      </button>
      <div class="min-w-0">
        <h2 class="text-xs md:text-sm font-semibold text-on-surface truncate max-w-[150px] md:max-w-none">{deliverable.title}</h2>
        <div class="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
          <span class="{statusBadge(deliverable.status)} px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase whitespace-nowrap">{statusLabel(deliverable.status)}</span>
          <span class="text-[10px] md:text-[11px] text-outline hidden md:inline">v{deliverable.version}</span>
          <span class="text-[10px] md:text-[11px] text-outline whitespace-nowrap hidden md:inline">{pins.length} pin{pins.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1 md:gap-2 shrink-0 overflow-x-auto no-scrollbar">
      <!-- Pin filter (hidden on mobile, shown in sheet) -->
      <div class="hidden md:flex bg-surface-container rounded-lg p-0.5 gap-0.5">
        {#each [['all', 'All'], ['unresolved', 'Open'], ['resolved', 'Done']] as [val, label]}
          <button onclick={() => pinFilter = val as any} class="px-3 py-1 rounded-md text-[11px] font-semibold transition-colors focus:outline-none {pinFilter === val ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-variant'}">{label}</button>
        {/each}
      </div>

      <!-- Zoom -->
      <div class="flex items-center gap-0.5 md:gap-1 bg-surface-container rounded-lg p-0.5">
        <button onclick={zoomOut} class="p-1 md:p-1.5 rounded-md hover:bg-surface-variant text-on-surface-variant focus:outline-none"><span class="material-symbols-outlined text-[16px] md:text-[18px]">remove</span></button>
        <span class="px-1 md:px-1.5 text-[11px] font-semibold text-on-surface-variant select-none">{Math.round(zoom * 100)}%</span>
        <button onclick={zoomIn} class="p-1 md:p-1.5 rounded-md hover:bg-surface-variant text-on-surface-variant focus:outline-none"><span class="material-symbols-outlined text-[16px] md:text-[18px]">add</span></button>
        <button onclick={zoomFit} class="p-1 md:p-1.5 rounded-md hover:bg-surface-variant text-on-surface-variant focus:outline-none" title="Fit to screen"><span class="material-symbols-outlined text-[16px] md:text-[18px]">fit_screen</span></button>
      </div>

      <!-- PDF page nav -->
      {#if isPdf && totalPages > 1}
        <div class="flex items-center gap-0.5 md:gap-1 bg-surface-container rounded-lg p-0.5">
          <button onclick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} class="p-1 md:p-1.5 rounded-md hover:bg-surface-variant text-on-surface-variant focus:outline-none disabled:opacity-30"><span class="material-symbols-outlined text-[16px] md:text-[18px]">chevron_left</span></button>
          <span class="px-1.5 md:px-2 text-[11px] font-semibold text-on-surface-variant">{currentPage}/{totalPages}</span>
          <button onclick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} class="p-1 md:p-1.5 rounded-md hover:bg-surface-variant text-on-surface-variant focus:outline-none disabled:opacity-30"><span class="material-symbols-outlined text-[16px] md:text-[18px]">chevron_right</span></button>
        </div>
      {/if}

      <!-- Mobile: pin toggle + feedback sheet toggle -->
      {#if !isApproved}
        <button
          onclick={() => pinModeActive = !pinModeActive}
          class="md:hidden p-1.5 rounded-lg transition-colors focus:outline-none {pinModeActive ? 'bg-primary text-white ring-2 ring-primary/40 ring-offset-1' : 'bg-surface-container text-on-surface-variant'}"
          title={pinModeActive ? 'Disable pin mode' : 'Enable pin mode'}
        >
          <span class="material-symbols-outlined text-[18px]" style={pinModeActive ? "font-variation-settings: 'FILL' 1;" : ''}>push_pin</span>
        </button>
      {/if}
      <button onclick={() => mobileSheetOpen = !mobileSheetOpen} class="md:hidden p-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:bg-surface-variant focus:outline-none flex items-center gap-1" title="Feedback panel">
        <span class="material-symbols-outlined text-[18px]">chat</span>
        {#if pins.length > 0}<span class="text-[10px] font-bold">{pins.length}</span>{/if}
      </button>

      <!-- Desktop actions: only client users can approve/request changes -->
      <div class="hidden md:flex items-center gap-2">
        {#if !isApproved}
          {#if userRole === 'client'}
            <button onclick={requestChanges} class="px-3 py-1.5 bg-[#fef3c7] text-[#b45309] rounded-lg text-[11px] font-bold hover:bg-[#fde68a] transition-colors focus:outline-none flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">edit</span> Request Changes
            </button>
            <button onclick={approveDeliverable} class="px-3 py-1.5 bg-[#22c55e] text-white rounded-lg text-[11px] font-bold hover:bg-[#16a34a] transition-colors focus:outline-none flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">check_circle</span> Approve
            </button>
          {:else}
            <span class="{statusBadge(deliverable.status)} px-2.5 py-1 rounded-full text-[11px] font-bold">{statusLabel(deliverable.status)}</span>
            {#if deliverable.status === 'changes_requested'}
              <button onclick={reopenDeliverable} class="px-3 py-1.5 bg-surface-container text-on-surface-variant rounded-lg text-[11px] font-bold hover:bg-surface-variant transition-colors focus:outline-none flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">refresh</span> Reopen
              </button>
            {/if}
          {/if}
        {:else}
          <span class="px-3 py-1.5 bg-[#dcfce7] text-[#166534] rounded-lg text-[11px] font-bold flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">verified</span> Approved
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div class="flex flex-1 overflow-hidden">
    <!-- Left: Canvas -->
    <div class="flex-1 md:flex-[7] overflow-auto bg-[#1a1a2e] flex items-start justify-center p-4 pt-6 md:p-8 {userRole === 'client' && !isApproved ? 'pb-20 md:pb-8' : ''}" bind:this={canvasContainer}>
      {#if pinModeActive}
        <div class="fixed top-14 left-1/2 -translate-x-1/2 z-[210] md:hidden bg-primary text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 animate-fadeIn">
          <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">push_pin</span> Pin mode on — tap the image
        </div>
      {/if}
      <div class="relative inline-block canvas-area" class:approved={isApproved} class:pin-mode={pinModeActive} onclick={handleCanvasClick}>
        {#if isPdf}
          <canvas bind:this={pdfCanvas} class="block rounded shadow-lg" style="transform: origin top left;"></canvas>
          {#if pdfRendering}
            <div class="absolute inset-0 flex items-center justify-center bg-black/30 rounded">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          {/if}
        {:else}
          <img
            bind:this={imageEl}
            src={fileUrl}
            alt={deliverable.title}
            onload={handleImageLoad}
            class="block rounded shadow-lg max-w-none"
            style="width: {zoom * 100}%; height: auto;"
            draggable="false"
          />
        {/if}

        <!-- Pin markers -->
        {#if (!isPdf || !pdfRendering)}
          {#each filteredPins as pin (pin.id)}
            <button
              class="pin-marker" class:selected={selectedPinId === pin.id}
              style="left: {pin.x_percent}%; top: {pin.y_percent}%;"
              onclick={(e) => { e.stopPropagation(); selectPin(pin.id); }}
              title={pin.content}
            >
              <div class="pin-dot {pin.is_resolved ? 'pin-resolved' : 'pin-unresolved'}">
                {#if pin.is_resolved}
                  <span class="material-symbols-outlined text-[14px]">check</span>
                {:else}
                  {getPinNumber(pin)}
                {/if}
              </div>
            </button>
          {/each}
        {/if}

        <!-- New pin popover (desktop only — mobile uses bottom sheet) -->
        {#if newPinPos && !isApproved}
          <div class="pin-popover hidden md:block" style="left: clamp(130px, {newPinPos.x}%, calc(100% - 130px)); top: {newPinPos.y}%;">
            <div class="pin-dot pin-unresolved mb-1 mx-auto" style="transform: translateX(-50%); margin-left: 50%;">
              <span class="material-symbols-outlined text-[14px]">add</span>
            </div>
            <div class="bg-white rounded-lg shadow-lg border border-outline-variant p-3 w-64" onclick={(e) => e.stopPropagation()}>
              <textarea
                bind:this={newPinInput}
                bind:value={newPinContent}
                placeholder="Add your feedback..."
                rows="3"
                class="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPin(); } }}
              ></textarea>
              {#if pinError}
                <p class="text-xs text-error mt-1">{pinError}</p>
              {/if}
              <div class="flex gap-2 mt-2">
                <button onclick={cancelNewPin} class="flex-1 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors focus:outline-none">Cancel</button>
                <button onclick={submitPin} disabled={submittingPin || !newPinContent.trim()} class="flex-1 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none">
                  {submittingPin ? 'Adding...' : 'Add Pin'}
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Pin Thread Panel (desktop only) -->
    <div class="hidden md:flex flex-[3] bg-white border-l border-outline-variant flex-col overflow-hidden min-w-[300px] max-w-[400px]">
      <div class="px-4 py-2.5 border-b border-outline-variant shrink-0 flex items-center justify-between">
        <h3 class="text-sm font-medium text-on-surface">Feedback ({allPinsForList.length})</h3>
        <button
          onclick={summarizePins}
          disabled={aiPinSummarizing || pins.length === 0}
          class="p-1.5 rounded-lg hover:bg-tertiary-container text-tertiary transition-colors focus:outline-none disabled:opacity-50"
          title="AI Summarize Feedback"
        >
          <span class="material-symbols-outlined text-[20px] {aiPinSummarizing ? 'animate-spin' : ''}">auto_awesome</span>
        </button>
      </div>

      {#if showPinSummary}
        <div class="border-b border-outline-variant/20 bg-tertiary-container/30 px-4 py-3 shrink-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-start gap-2 flex-1 min-w-0">
              <span class="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">auto_awesome</span>
              <div class="flex-1 min-w-0">
                <p class="text-[11px] font-bold text-tertiary mb-1">AI Summary</p>
                {#if aiPinSummarizing}
                  <p class="text-xs text-on-surface-variant">Generating...</p>
                {:else}
                  <p class="text-xs text-on-surface whitespace-pre-wrap leading-relaxed">{aiPinSummary}</p>
                {/if}
              </div>
            </div>
            <button onclick={() => { showPinSummary = false; }} class="text-on-surface-variant hover:text-on-surface shrink-0 focus:outline-none">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      {/if}

      <div class="flex-1 overflow-y-auto">
        {#if allPinsForList.length === 0}
          <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
            <span class="material-symbols-outlined text-4xl text-outline-variant mb-3">push_pin</span>
            <p class="text-sm font-semibold text-on-surface mb-1">No pins yet</p>
            <p class="text-xs text-on-surface-variant">Click anywhere on the {isPdf ? 'PDF' : 'image'} to add feedback.</p>
          </div>
        {/if}

        {#each allPinsForList as pin, idx (pin.id)}
          {@const replies = pinReplies[pin.id] || []}
          <div
            id="pin-thread-{pin.id}"
            class="border-b border-outline-variant/10 transition-colors {selectedPinId === pin.id ? 'bg-primary/5' : 'hover:bg-surface-container-low'}"
            class:thread-resolved={pin.is_resolved}
          >
            <!-- Pin header -->
            <button
              class="w-full text-left px-4 py-3 flex items-start gap-3 focus:outline-none"
              onclick={() => scrollToCanvasPin(pin)}
            >
              <div class="pin-dot {pin.is_resolved ? 'pin-resolved' : 'pin-unresolved'} shrink-0 mt-0.5" style="width: 24px; height: 24px; font-size: 10px;">
                {#if pin.is_resolved}
                  <span class="material-symbols-outlined text-[12px]">check</span>
                {:else}
                  {idx + 1}
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs font-bold text-on-surface">{pin.author_name}</span>
                  <span class="text-[10px] text-outline px-1.5 py-0.5 rounded bg-surface-container {pin.author_type === 'client' ? 'text-primary' : 'text-on-surface-variant'}">{pin.author_type}</span>
                  {#if isPdf}<span class="text-[10px] text-outline">p.{pin.page_number}</span>{/if}
                </div>
                <p class="text-sm text-on-surface thread-content leading-relaxed">{pin.content}</p>
                <p class="text-[10px] text-outline mt-1">{fmtTime(pin.created_at)}</p>
              </div>
            </button>

            <!-- Resolve toggle (agency only) -->
            {#if userRole === 'agency'}
              <div class="px-4 pb-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pin.is_resolved} onchange={() => toggleResolved(pin)} class="w-3.5 h-3.5 rounded accent-[#22c55e]" />
                  <span class="text-[11px] text-on-surface-variant font-medium">{pin.is_resolved ? 'Resolved' : 'Mark resolved'}</span>
                </label>
              </div>
            {/if}

            <!-- Replies -->
            {#if replies.length > 0}
              <div class="px-4 pb-2 space-y-2 ml-8">
                {#each replies as reply (reply.id)}
                  <div class="flex items-start gap-2 bg-surface-container-low rounded-lg p-2">
                    <div class="w-5 h-5 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[9px] font-bold shrink-0">{initials(reply.author_name)}</div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1">
                        <span class="text-[11px] font-bold text-on-surface">{reply.author_name}</span>
                        <span class="text-[10px] text-outline">{fmtTime(reply.created_at)}</span>
                      </div>
                      <p class="text-xs text-on-surface-variant leading-relaxed">{reply.content}</p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Reply input -->
            {#if !isApproved}
              <div class="px-4 pb-3 ml-8">
                <form class="flex gap-1.5" onsubmit={(e) => { e.preventDefault(); submitReply(pin.id); }}>
                  <input
                    type="text"
                    placeholder="Reply..."
                    bind:value={replyContent[pin.id]}
                    class="flex-1 px-2.5 py-1.5 bg-surface-container-low border border-outline-variant/30 rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button type="submit" disabled={submittingReply === pin.id || !replyContent[pin.id]?.trim()} class="px-2.5 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 focus:outline-none shrink-0">
                    <span class="material-symbols-outlined text-[14px]">send</span>
                  </button>
                </form>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Approval audit trail -->
      {#if isApproved && deliverable.approved_at}
        <div class="px-4 py-3 border-t border-outline-variant/20 bg-[#f0fdf4] shrink-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="material-symbols-outlined text-[#166534] text-[16px]">verified</span>
            <span class="text-xs font-bold text-[#166534]">Approved</span>
          </div>
          <p class="text-[11px] text-[#166534]/80 leading-relaxed">
            {new Date(deliverable.approved_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {#if deliverable.approved_user_agent}
            <p class="text-[10px] text-[#166534]/60 mt-1 truncate" title={deliverable.approved_user_agent}>
              {deliverable.approved_user_agent.substring(0, 80)}...
            </p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Mobile sticky bottom action bar (client only, not approved) -->
{#if userRole === 'client' && !isApproved}
  <div class="fixed bottom-0 left-0 right-0 z-[240] md:hidden bg-white border-t border-outline-variant px-4 py-2.5 flex gap-2 safe-bottom">
    <button onclick={requestChanges} class="flex-1 py-2.5 bg-[#fef3c7] text-[#b45309] rounded-lg text-sm font-bold hover:bg-[#fde68a] transition-colors focus:outline-none flex items-center justify-center gap-1.5">
      <span class="material-symbols-outlined text-[16px]">edit</span> Request Changes
    </button>
    <button onclick={approveDeliverable} class="flex-1 py-2.5 bg-[#22c55e] text-white rounded-lg text-sm font-bold hover:bg-[#16a34a] transition-colors focus:outline-none flex items-center justify-center gap-1.5">
      <span class="material-symbols-outlined text-[16px]">check_circle</span> Approve
    </button>
  </div>
{/if}

<!-- Mobile Bottom Sheet -->
{#if mobileSheetOpen}
  <div class="fixed inset-0 z-[250] md:hidden flex flex-col justify-end">
    <div class="absolute inset-0 bg-black/40" onclick={() => { mobileSheetOpen = false; cancelNewPin(); }}></div>
    <div class="relative bg-white rounded-t-2xl max-h-[70vh] flex flex-col animate-slideUp">
      <div class="flex items-center justify-between px-4 py-3 border-b border-outline-variant shrink-0">
        <h3 class="text-sm font-semibold text-on-surface">
          {#if newPinPos}Add Feedback{:else}Feedback ({allPinsForList.length}){/if}
        </h3>
        <div class="flex items-center gap-2">
          <!-- Pin filter in sheet -->
          {#if !newPinPos}
            <div class="flex bg-surface-container rounded-lg p-0.5 gap-0.5">
              {#each [['all', 'All'], ['unresolved', 'Open'], ['resolved', 'Done']] as [val, label]}
                <button onclick={() => pinFilter = val as any} class="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors focus:outline-none {pinFilter === val ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-variant'}">{label}</button>
              {/each}
            </div>
          {/if}
          <button onclick={() => { mobileSheetOpen = false; cancelNewPin(); }} class="p-1 rounded-lg hover:bg-surface-container">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      {#if newPinPos}
        <!-- New pin form in bottom sheet -->
        <div class="p-4" onclick={(e) => e.stopPropagation()}>
          <textarea
            bind:this={newPinInput}
            bind:value={newPinContent}
            placeholder="Add your feedback..."
            rows="3"
            class="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPin(); } }}
          ></textarea>
          {#if pinError}
            <p class="text-xs text-error mt-1">{pinError}</p>
          {/if}
          <div class="flex gap-2 mt-2">
            <button onclick={() => { cancelNewPin(); mobileSheetOpen = false; }} class="flex-1 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors focus:outline-none">Cancel</button>
            <button onclick={submitPin} disabled={submittingPin || !newPinContent.trim()} class="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none">
              {submittingPin ? 'Adding...' : 'Add Pin'}
            </button>
          </div>
        </div>
      {:else}
        <!-- Pin list -->
        <div class="flex-1 overflow-y-auto">
          {#if allPinsForList.length === 0}
            <div class="flex flex-col items-center justify-center py-10 px-4 text-center">
              <span class="material-symbols-outlined text-3xl text-outline-variant mb-2">push_pin</span>
              <p class="text-sm text-on-surface-variant">No pins yet. Tap the pin button then tap on the image.</p>
            </div>
          {/if}

          {#each allPinsForList as pin, idx (pin.id)}
            {@const replies = pinReplies[pin.id] || []}
            <div class="border-b border-outline-variant/10 {selectedPinId === pin.id ? 'bg-primary/5' : ''}">
              <button class="w-full text-left px-4 py-3 flex items-start gap-3 focus:outline-none" onclick={() => { scrollToCanvasPin(pin); }}>
                <div class="pin-dot {pin.is_resolved ? 'pin-resolved' : 'pin-unresolved'} shrink-0" style="width: 22px; height: 22px; font-size: 9px;">
                  {#if pin.is_resolved}<span class="material-symbols-outlined text-[11px]">check</span>{:else}{idx + 1}{/if}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <span class="text-xs font-bold text-on-surface">{pin.author_name}</span>
                    <span class="text-[10px] text-outline">{pin.author_type}</span>
                  </div>
                  <p class="text-xs text-on-surface leading-relaxed">{pin.content}</p>
                </div>
              </button>
              {#if replies.length > 0}
                <div class="px-4 pb-2 ml-7 space-y-1.5">
                  {#each replies as reply (reply.id)}
                    <div class="flex items-start gap-1.5 bg-surface-container-low rounded-lg p-1.5">
                      <span class="text-[10px] font-bold text-on-surface">{reply.author_name}:</span>
                      <p class="text-[11px] text-on-surface-variant">{reply.content}</p>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if !isApproved}
                <div class="px-4 pb-2 ml-7">
                  <form class="flex gap-1.5" onsubmit={(e) => { e.preventDefault(); submitReply(pin.id); }}>
                    <input type="text" placeholder="Reply..." bind:value={replyContent[pin.id]} class="flex-1 px-2.5 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary" />
                    <button type="submit" disabled={submittingReply === pin.id || !replyContent[pin.id]?.trim()} class="px-2.5 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 focus:outline-none shrink-0">
                      <span class="material-symbols-outlined text-[14px]">send</span>
                    </button>
                  </form>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Agency reopen in sheet -->
        {#if userRole === 'agency' && deliverable.status === 'changes_requested'}
          <div class="border-t border-outline-variant p-3 shrink-0">
            <button onclick={reopenDeliverable} class="w-full py-2.5 bg-surface-container text-on-surface-variant rounded-lg text-sm font-bold hover:bg-surface-variant transition-colors focus:outline-none flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">refresh</span> Reopen
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

{#if toastMsg}
  <div class="fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] px-4 py-2.5 rounded-lg shadow-md flex items-center gap-2 text-sm animate-fadeIn {toastType === 'success' ? 'bg-on-surface text-surface' : 'bg-white border border-error/20 text-on-surface'}">
    <span class="material-symbols-outlined text-[18px] {toastType === 'error' ? 'text-error' : ''}">{toastType === 'success' ? 'check_circle' : 'error'}</span>
    {toastMsg}
  </div>
{/if}
