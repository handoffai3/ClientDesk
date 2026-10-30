<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { jsPDF } from 'jspdf';

  const navTabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  import { agencyDataStore } from '../../stores/agencyData';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';
  import { sendBrandedEmail } from '$lib/emailTemplates';
  import { fmtMoney } from '$lib/format';

  let activeFilter = $state<'All' | 'Draft' | 'Sent' | 'Paid' | 'Pending' | 'Overdue'>('All');
  let userMenuOpen = $state(false);
  let toastMsg = $state('');
  let toastType = $state<'success' | 'error'>('success');

  let agencyBranding = $state<{ logo_url: string | null; primary_color: string; email: string; reply_to_email: string | null }>({ logo_url: null, primary_color: '#7C3AED', email: '', reply_to_email: null });

  $effect(() => {
    if (authState.agencyId) {
      supabase.from('agencies').select('logo_url, primary_color, email, reply_to_email').eq('id', authState.agencyId).single().then(({ data }) => {
        if (data) agencyBranding = data as any;
      });
    }
  });

  let invoices = $derived.by(() => {
    const clientFilterId = $page.url.searchParams.get('client');
    let data = $agencyDataStore.invoices;
    if (clientFilterId) {
      data = data.filter(i => i.client_id === clientFilterId);
    }
    return data;
  });

  let loading = $derived(!$agencyDataStore.loaded);

  let clientFilterId = $derived($page.url.searchParams.get('client'));
  let clientFilterName = $derived(clientFilterId ? ($agencyDataStore.clients.find(c => c.id === clientFilterId)?.full_name || 'Client') : null);

  function clearClientFilter() {
    const url = new URL(window.location.href);
    url.searchParams.delete('client');
    goto(url.pathname + url.search, { replaceState: true });
  }

  let filteredInvoices = $derived(
    activeFilter === 'All' ? invoices : invoices.filter(i => i.status === activeFilter.toLowerCase())
  );

  let draftTotal = $derived(invoices.filter(i => i.status === 'draft').reduce((s, i) => s + Number(i.total || 0), 0));
  let sentTotal = $derived(invoices.filter(i => i.status === 'sent').reduce((s, i) => s + Number(i.total || 0), 0));
  let paidTotal = $derived(invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0));
  let pendingTotal = $derived(invoices.filter(i => i.status === 'pending' || i.status === 'sent').reduce((s, i) => s + Number(i.total || 0), 0));
  let overdueTotal = $derived(invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.total || 0), 0));

  function fmt(n: number) {
    return fmtMoney(n, $agencyDataStore.currency);
  }

  function statusDisplay(s: string) {
    if (s === 'draft') return 'Draft';
    if (s === 'sent') return 'Sent';
    if (s === 'paid') return 'Paid';
    if (s === 'pending') return 'Pending';
    return 'Overdue';
  }

  function statusBadge(s: string) {
    if (s === 'draft') return 'bg-surface-variant text-on-surface-variant';
    if (s === 'sent') return 'bg-[#dbeafe] text-[#1e40af]';
    if (s === 'paid') return 'bg-[#dcfce7] text-[#166534]';
    if (s === 'pending') return 'bg-[#fef3c7] text-[#b45309]';
    return 'bg-error-container text-on-error-container';
  }

  function initials(name: string) {
    return name.substring(0, 2).toUpperCase();
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    setTimeout(() => toastMsg = '', 3000);
  }

  async function downloadPdf(inv: any) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('description, quantity, rate, amount')
      .eq('invoice_id', inv.id);

    const doc = new jsPDF();
    const agencyName = authState.agencyName || 'ClientDesk';

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(agencyName, 20, 25);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('INVOICE', 160, 25);

    doc.setDrawColor(200);
    doc.line(20, 32, 190, 32);

    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`Invoice #: ${inv.invoice_number}`, 20, 42);
    doc.text(`Status: ${statusDisplay(inv.status)}`, 20, 48);
    doc.text(`Date: ${inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-IN') : '-'}`, 120, 42);
    doc.text(`Due: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : '-'}`, 120, 48);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(inv.clients?.full_name || 'Unknown', 20, 66);
    if (inv.clients?.company) doc.text(inv.clients.company, 20, 72);

    let y = 85;
    doc.setFillColor(245, 245, 245);
    doc.rect(20, y - 5, 170, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40);
    doc.text('Description', 22, y);
    doc.text('Qty', 110, y);
    doc.text('Rate', 130, y);
    doc.text('Amount', 160, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    if (items && items.length > 0) {
      for (const item of items) {
        doc.text(item.description || '-', 22, y);
        doc.text(String(item.quantity || 0), 110, y);
        doc.text(fmt(Number(item.rate || 0)), 130, y);
        doc.text(fmt(Number(item.amount || 0)), 160, y);
        y += 8;
      }
    }

    y += 5;
    doc.line(20, y, 190, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', 130, y);
    doc.text(fmt(Number(inv.subtotal || 0)), 160, y);
    y += 7;
    doc.text(`${$agencyDataStore.taxLabel} (${inv.gst_rate || 0}%):`, 130, y);
    doc.text(fmt(Number(inv.gst_amount || 0)), 160, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text('Total:', 130, y);
    doc.text(fmt(Number(inv.total || 0)), 160, y);

    doc.save(`${inv.invoice_number}.pdf`);
    showToast(`Downloaded ${inv.invoice_number}.pdf`);
  }

  async function sendReminder(inv: any) {
    if (!inv.client_id) {
      showToast('No client linked to this invoice.', 'error');
      return;
    }
    const { data: clientUsers } = await supabase
      .from('client_users')
      .select('id')
      .eq('client_id', inv.client_id)
      .limit(1);

    if (clientUsers && clientUsers.length > 0) {
      await supabase.from('notifications').insert({
        user_id: clientUsers[0].id,
        title: `Payment reminder for ${inv.invoice_number}`,
        body: `Amount due: ${fmt(Number(inv.total || 0))}`,
        type: 'invoice',
      });
    }

    await supabase.from('invoices').update({ reminded_at: new Date().toISOString() }).eq('id', inv.id);

    if (inv.clients?.email && authState.agencyId) {
      const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
      sendBrandedEmail({
        to: inv.clients.email,
        subject: `Reminder: Invoice ${inv.invoice_number} — ${fmt(Number(inv.total || 0))} due ${dueStr}`,
        body_html: `<p>Hi ${inv.clients.full_name || 'there'},</p>
          <p>This is a friendly reminder that invoice <strong>${inv.invoice_number}</strong> for <strong>${fmt(Number(inv.total || 0))}</strong> is due on <strong>${dueStr}</strong>.</p>
          <p>Please log in to your portal to complete the payment.</p>`,
        cta_text: 'Pay Now',
        cta_url: `${window.location.origin}/client/invoices`,
        agency_id: authState.agencyId,
        agency_name: authState.agencyName || 'ClientDesk',
        agency_logo_url: agencyBranding.logo_url,
        agency_primary_color: agencyBranding.primary_color,
        reply_to: agencyBranding.reply_to_email || agencyBranding.email || undefined,
      });
    }

    showToast(`Reminder sent to ${inv.clients?.full_name || 'client'}`);
  }

  async function sendToClient(inv: any) {
    if (inv.status !== 'draft') {
      showToast('Invoice already sent.', 'error');
      return;
    }
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', inv.id);
    agencyDataStore.update(s => ({
      ...s,
      invoices: s.invoices.map(i => i.id === inv.id ? { ...i, status: 'sent' } : i),
    }));

    if (inv.client_id) {
      const { data: clientUsers } = await supabase
        .from('client_users')
        .select('id')
        .eq('client_id', inv.client_id)
        .limit(1);
      if (clientUsers && clientUsers.length > 0) {
        await supabase.from('notifications').insert({
          user_id: clientUsers[0].id,
          title: `New invoice ${inv.invoice_number}`,
          body: `Amount: ${fmt(Number(inv.total || 0))}`,
          type: 'invoice',
        });
      }
    }

    // Fetch line items for email
    if (inv.clients?.email && authState.agencyId) {
      const { data: items } = await supabase.from('invoice_items').select('description, quantity, amount').eq('invoice_id', inv.id);
      const itemsHtml = (items || []).map(i => `<li>${i.description} (x${i.quantity}) — ${fmt(Number(i.amount || 0))}</li>`).join('');
      const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
      sendBrandedEmail({
        to: inv.clients.email,
        subject: `Invoice ${inv.invoice_number} — ${fmt(Number(inv.total || 0))}`,
        body_html: `<p>Hi ${inv.clients.full_name || 'there'},</p>
          <p>You have a new invoice from <strong>${authState.agencyName || 'us'}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:4px 0;color:#6b7280;">Invoice</td><td style="padding:4px 0;font-weight:600;">${inv.invoice_number}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Amount</td><td style="padding:4px 0;font-weight:600;">${fmt(Number(inv.total || 0))}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Due Date</td><td style="padding:4px 0;font-weight:600;">${dueStr}</td></tr>
          </table>
          ${itemsHtml ? `<p style="font-weight:600;margin-bottom:4px;">Items:</p><ul style="padding-left:20px;margin:0 0 16px;">${itemsHtml}</ul>` : ''}`,
        cta_text: 'View & Pay Invoice',
        cta_url: `${window.location.origin}/client/invoices`,
        agency_id: authState.agencyId,
        agency_name: authState.agencyName || 'ClientDesk',
        agency_logo_url: agencyBranding.logo_url,
        agency_primary_color: agencyBranding.primary_color,
        reply_to: agencyBranding.reply_to_email || agencyBranding.email || undefined,
      });
    }

    showToast(`Invoice ${inv.invoice_number} sent to client`);
  }

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/';
    if (tab === 'Projects') return '/projects';
    if (tab === 'Clients') return '/clients';
    if (tab === 'Files') return '/files';
    if (tab === 'Invoices') return '/invoices';
    if (tab === 'Messages') return '/messages';
    return `/?tab=${tab}`;
  }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Invoices - ClientDesk</title>
</svelte:head>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <AgencyHeader activeTab="Invoices" />

  <!-- Main -->
  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 animate-fadeIn">
      <div>
        <h1 class="text-xl font-semibold text-on-surface mb-1">Invoices</h1>
        <p class="text-sm text-on-surface-variant">Total revenue: {fmt(paidTotal)}</p>
      </div>
      <a href="/invoices/create" class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 w-fit no-underline">
        <span class="material-symbols-outlined text-[18px]">add</span> Create Invoice
      </a>
    </div>

    {#if clientFilterName}
      <div class="flex items-center gap-2 mb-3 animate-fadeIn">
        <span class="inline-flex items-center gap-1.5 bg-primary/[0.08] text-primary pl-3 pr-1.5 py-1 rounded-lg text-[13px] font-medium">
          Filtered: {clientFilterName}
          <button onclick={clearClientFilter} class="w-5 h-5 rounded-full hover:bg-primary/20 flex items-center justify-center transition-colors" title="Clear filter">
            <span class="material-symbols-outlined text-[14px]">close</span>
          </button>
        </span>
      </div>
    {/if}

    <div class="grid grid-cols-3 gap-3 mb-5">
      <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-7 h-7 rounded-lg bg-success/[0.08] flex items-center justify-center">
            <span class="material-symbols-outlined text-success text-[16px]">check_circle</span>
          </div>
          <span class="text-xs text-on-surface-variant">Paid</span>
        </div>
        <p class="text-[15px] font-semibold text-on-surface">{fmt(paidTotal)}</p>
        <p class="text-xs text-on-surface-variant mt-0.5">{invoices.filter(i => i.status === 'paid').length} invoices</p>
      </div>
      <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-7 h-7 rounded-lg bg-tertiary/[0.08] flex items-center justify-center">
            <span class="material-symbols-outlined text-tertiary text-[16px]">schedule</span>
          </div>
          <span class="text-xs text-on-surface-variant">Pending</span>
        </div>
        <p class="text-[15px] font-semibold text-on-surface">{fmt(pendingTotal)}</p>
        <p class="text-xs text-on-surface-variant mt-0.5">{invoices.filter(i => i.status === 'pending').length} invoices</p>
      </div>
      <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-7 h-7 rounded-lg bg-error/[0.08] flex items-center justify-center">
            <span class="material-symbols-outlined text-error text-[16px]">warning</span>
          </div>
          <span class="text-xs text-on-surface-variant">Overdue</span>
        </div>
        <p class="text-[15px] font-semibold text-on-surface">{fmt(overdueTotal)}</p>
        <p class="text-xs text-on-surface-variant mt-0.5">{invoices.filter(i => i.status === 'overdue').length} invoices</p>
      </div>
    </div>

    <div class="flex gap-1.5 tab-strip pb-1 mb-5">
      {#each ['All', 'Draft', 'Sent', 'Paid', 'Pending', 'Overdue'] as f}
        <button
          onclick={() => activeFilter = f as any}
          class="px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors {activeFilter === f ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}"
        >{f}</button>
      {/each}
    </div>

    <!-- Invoice Grid -->
    {#if loading}
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each Array(6) as _}
          <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant">
            <div class="flex justify-between mb-3">
              <div class="h-3 animate-shimmer rounded w-16"></div>
              <div class="h-4 animate-shimmer rounded w-14"></div>
            </div>
            <div class="flex items-center gap-2.5 mb-4">
              <div class="w-8 h-8 rounded-full animate-shimmer"></div>
              <div class="flex-1">
                <div class="h-3.5 animate-shimmer rounded w-2/3 mb-1"></div>
                <div class="h-3 animate-shimmer rounded w-1/3"></div>
              </div>
            </div>
            <div class="h-5 animate-shimmer rounded w-1/2 mb-1.5"></div>
            <div class="h-3 animate-shimmer rounded w-1/3 mb-4"></div>
            <div class="flex gap-2">
              <div class="flex-1 h-8 animate-shimmer rounded"></div>
              <div class="flex-1 h-8 animate-shimmer rounded"></div>
            </div>
          </div>
        {/each}
      </section>
    {:else if filteredInvoices.length === 0}
      <div class="py-16 text-center border border-dashed border-outline-variant rounded-lg">
        <span class="material-symbols-outlined text-[28px] text-outline mb-2 block">receipt_long</span>
        <h3 class="text-sm font-medium text-on-surface mb-1">No invoices found</h3>
        <p class="text-[13px] text-on-surface-variant">
          {#if activeFilter !== 'All'}Try a different filter.{:else}Create your first invoice to get started.{/if}
        </p>
      </div>
    {:else}
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {#each filteredInvoices as inv (inv.id)}
          <div class="bg-white rounded-lg p-4 shadow-xs hover:shadow-sm transition-shadow flex flex-col border border-outline-variant">
            <div class="flex justify-between items-start mb-3">
              <span class="text-xs text-outline">{inv.invoice_number}</span>
              <span class="{statusBadge(inv.status)} px-1.5 py-0.5 rounded text-[11px] font-medium">{statusDisplay(inv.status)}</span>
            </div>

            <div class="flex items-center gap-2.5 mb-4">
              {#if inv.clients?.avatar_url}
                <img alt="Client" class="w-8 h-8 rounded-full object-cover" src={inv.clients.avatar_url} />
              {:else}
                <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                  {initials(inv.clients?.full_name || 'NA')}
                </div>
              {/if}
              <div>
                <div class="text-sm font-medium text-on-surface">{inv.clients?.full_name || 'Unknown'}</div>
                {#if inv.clients?.company}
                  <div class="text-xs text-on-surface-variant">{inv.clients.company}</div>
                {/if}
              </div>
            </div>

            <div class="mb-4 flex-grow">
              <div class="text-lg font-semibold text-on-surface">{fmt(Number(inv.total || 0))}</div>
              <div class="text-xs text-outline">
                {#if inv.due_date}Due {new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{:else}No due date{/if}
              </div>
            </div>

            {#if inv.status === 'paid' && inv.paid_at}
              <div class="mb-2 flex items-center gap-1 text-success">
                <span class="material-symbols-outlined text-[14px]">check_circle</span>
                <span class="text-xs">Paid {new Date(inv.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
            {/if}

            <div class="flex gap-2 mt-auto pt-3 border-t border-outline-variant">
              <button
                class="flex-1 bg-primary/[0.06] hover:bg-primary/[0.1] text-primary px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                onclick={() => downloadPdf(inv)}
              >
                <span class="material-symbols-outlined text-[14px]">download</span> PDF
              </button>
              {#if inv.status === 'draft'}
                <button
                  class="flex-1 bg-primary hover:bg-primary-hover text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                  onclick={() => sendToClient(inv)}
                >
                  <span class="material-symbols-outlined text-[14px]">send</span> Send
                </button>
              {:else if inv.status !== 'paid'}
                <button
                  class="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface-variant px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                  onclick={() => sendReminder(inv)}
                >
                  <span class="material-symbols-outlined text-[14px]">notifications</span> Remind
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </section>
    {/if}
  </main>
</div>

{#if toastMsg}
  <div class="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-md text-sm flex items-center gap-2 animate-fadeIn {toastType === 'error' ? 'bg-white border border-error/20 text-on-surface' : 'bg-on-surface text-surface'}">
    <span class="material-symbols-outlined text-[18px] {toastType === 'error' ? 'text-error' : ''}">{toastType === 'error' ? 'error' : 'check_circle'}</span>
    {toastMsg}
  </div>
{/if}
