<script lang="ts">
  import ClientHeader from '$lib/components/ClientHeader.svelte';
  import { apiFetch } from '$lib/apiFetch';
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  import { clientDataStore } from '../../../stores/clientData';

  let activeFilter = $state('all');
  let selectedInvoice = $state<any>(null);
  let isModalOpen = $state(false);
  let isPrinting = $state(false);
  let payingInvoiceId = $state<string | null>(null);
  let toastMsg = $state('');
  let toastType = $state<'success' | 'error'>('success');

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    setTimeout(() => toastMsg = '', 3000);
  }

  onMount(() => {
    const payment = $page.url.searchParams.get('payment');
    if (payment === 'success') {
      showToast('Payment successful! Thank you.');
      history.replaceState(null, '', '/client/invoices');
    } else if (payment === 'cancelled') {
      showToast('Payment was cancelled.', 'error');
      history.replaceState(null, '', '/client/invoices');
    }
  });

  let agencyLogo = $derived($clientDataStore.agencyLogo);
  let agencyName = $derived($clientDataStore.agencyName || 'ClientDesk');
  let invoices = $derived($clientDataStore.invoices);
  let loading = $derived(!$clientDataStore.loaded);

  let filteredInvoices = $derived.by(() => {
    if (activeFilter === 'all') return invoices;
    return invoices.filter(i => i.status === activeFilter);
  });

  let pendingTotal = $derived(invoices.filter(i => i.status === 'pending' || i.status === 'sent').reduce((s, i) => s + Number(i.total || 0), 0));
  let paidTotal = $derived(invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0));

  function fmt(n: number) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
  }

  function initials(name: string | null) { return name?.substring(0, 2).toUpperCase() || 'NA'; }

  function openInvoiceModal(inv: any) {
    selectedInvoice = inv;
    isModalOpen = true;
  }

  function closeInvoiceModal() {
    isModalOpen = false;
    setTimeout(() => { selectedInvoice = null; }, 200);
  }

  function generatePDF(inv: any) {
    selectedInvoice = inv;
    isPrinting = true;
    setTimeout(() => {
      window.print();
      isPrinting = false;
      selectedInvoice = null;
    }, 100);
  }

  async function payWithStripe(invoiceId?: string) {
    const id = invoiceId || selectedInvoice?.id;
    if (!id) return;
    payingInvoiceId = id;
    try {
      const res = await apiFetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast('Could not create payment session.', 'error');
        payingInvoiceId = null;
      }
    } catch {
      showToast('Payment failed. Please try again.', 'error');
      payingInvoiceId = null;
    }
  }
</script>

<svelte:head>
  <title>My Invoices - Client Portal</title>
</svelte:head>

<style>
  @media print {
    :global(body *) {
      visibility: hidden;
    }
    #print-area, #print-area * {
      visibility: visible;
    }
    #print-area {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 40px;
      background: white !important;
      color: black !important;
    }
    .print-hide {
      display: none !important;
    }
  }
</style>

<!-- Main Interface -->
<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full {isPrinting ? 'print-hide' : ''}">
  <ClientHeader activeTab="Invoices" />

  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full">
    {#if loading}
      <div class="animate-shimmer rounded-lg h-16 mb-5"></div>
      <div class="grid grid-cols-2 gap-3 mb-5">
        {#each Array(2) as _}<div class="h-20 animate-shimmer rounded-lg"></div>{/each}
      </div>
    {:else}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 animate-fadeIn">
        <div>
          <h1 class="text-xl font-semibold text-on-surface mb-1">My Invoices</h1>
          <p class="text-sm text-on-surface-variant">Amount due: <span class="font-medium text-on-surface">{fmt(pendingTotal)}</span></p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-success/[0.08] flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-success text-[18px]">check_circle</span>
          </div>
          <div>
            <p class="text-xs text-on-surface-variant mb-0.5">Total Paid</p>
            <h4 class="text-[15px] font-semibold text-on-surface">{fmt(paidTotal)}</h4>
          </div>
        </div>

        <div class="bg-white rounded-lg p-4 shadow-xs border border-outline-variant flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-tertiary/[0.08] flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-tertiary text-[18px]">schedule</span>
          </div>
          <div>
            <p class="text-xs text-on-surface-variant mb-0.5">Total Pending</p>
            <h4 class="text-[15px] font-semibold text-on-surface">{fmt(pendingTotal)}</h4>
          </div>
        </div>
      </div>

      <div class="flex gap-1.5 tab-strip pb-1 mb-5">
        {#each [
          { key: 'all', label: 'All' },
          { key: 'paid', label: 'Paid' },
          { key: 'pending', label: 'Pending' },
          { key: 'overdue', label: 'Overdue' }
        ] as filter}
          <button
            class="px-3 py-1 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors {activeFilter === filter.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}"
            onclick={() => activeFilter = filter.key}
          >
            {filter.label}
          </button>
        {/each}
      </div>

      <!-- Invoices Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {#each filteredInvoices as inv (inv.id)}
          <div class="bg-surface rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer" onclick={() => openInvoiceModal(inv)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInvoiceModal(inv); } }}>
            <div class="flex justify-between items-start mb-4">
              <span class="font-label-md text-xs font-bold text-outline uppercase tracking-wider">{inv.invoice_number}</span>
              
              {#if inv.status === 'paid'}
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#f0fdf4] text-[#16a34a] flex items-center gap-1">
                  <span class="material-symbols-outlined text-[12px]">check_circle</span> Paid
                </span>
              {:else if inv.status === 'overdue'}
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-error-container text-on-error-container flex items-center gap-1">
                  <span class="material-symbols-outlined text-[12px]">warning</span> Overdue
                </span>
              {:else if inv.status === 'sent'}
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#dbeafe] text-[#1e40af] flex items-center gap-1">
                  <span class="material-symbols-outlined text-[12px]">mail</span> Sent
                </span>
              {:else if inv.status === 'draft'}
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-variant text-on-surface-variant flex items-center gap-1">
                  <span class="material-symbols-outlined text-[12px]">edit_note</span> Draft
                </span>
              {:else}
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#fff7ed] text-[#ea580c] flex items-center gap-1">
                  <span class="material-symbols-outlined text-[12px]">schedule</span> Pending
                </span>
              {/if}
            </div>
            
            <div class="mb-5 flex-grow">
              <p class="text-sm text-on-surface-variant truncate mb-2">{inv.notes || 'Invoice for Services'}</p>
              <h3 class="font-display-sm font-bold text-on-surface mb-1">{fmt(Number(inv.total || 0))}</h3>
              
              <div class="flex flex-col gap-1 mt-3 text-xs text-outline">
                <div class="flex justify-between"><span>Subtotal:</span> <span class="font-medium">{fmt(Number(inv.subtotal || 0))}</span></div>
                <div class="flex justify-between"><span>GST ({inv.gst_rate || 18}%):</span> <span class="font-medium">{fmt(Number(inv.gst_amount || 0))}</span></div>
                <div class="w-full h-px bg-outline-variant/30 my-1"></div>
                <div class="flex justify-between font-bold text-on-surface-variant"><span>Total:</span> <span>{fmt(Number(inv.total || 0))}</span></div>
              </div>

              {#if (inv.status === 'sent' || inv.status === 'pending' || inv.status === 'overdue') && inv.due_date}
                <p class="text-xs text-error mt-4 font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">event</span> Due {fmtDate(inv.due_date)}</p>
              {:else}
                <p class="text-xs text-outline mt-4 flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">event</span> Issued {fmtDate(inv.created_at)}</p>
              {/if}
            </div>

            <div class="mt-auto">
              {#if inv.status === 'paid'}
                <div class="flex gap-2">
                  <span class="flex-1 bg-[#dcfce7] text-[#166534] font-label-md py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-[16px]">check_circle</span> Paid
                    {#if inv.paid_at}
                      <span class="text-[10px] font-normal ml-1">({new Date(inv.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})</span>
                    {/if}
                  </span>
                  <button
                    onclick={() => generatePDF(inv)}
                    class="bg-surface-variant hover:bg-outline-variant text-on-surface-variant font-label-md py-2.5 px-3 rounded-lg transition-colors text-sm font-bold focus:outline-none flex items-center justify-center gap-1"
                  >
                    <span class="material-symbols-outlined text-[18px]">download</span>
                  </button>
                </div>
              {:else if inv.status === 'draft'}
                <span class="w-full bg-surface-variant text-on-surface-variant font-label-md py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">edit_note</span> Draft
                </span>
              {:else}
                <button
                  onclick={() => payWithStripe(inv.id)}
                  disabled={payingInvoiceId === inv.id}
                  class="w-full bg-primary hover:bg-primary/90 text-white font-label-md py-2.5 rounded-lg shadow-sm transition-colors text-sm font-bold focus:outline-none flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {#if payingInvoiceId === inv.id}
                    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Redirecting...
                  {:else}
                    <span class="material-symbols-outlined text-[18px]">payments</span> Pay Now
                  {/if}
                </button>
              {/if}
            </div>
          </div>
        {/each}

        {#if filteredInvoices.length === 0}
          <div class="col-span-full py-16 text-center bg-surface-container-lowest rounded-xl border border-outline-variant/20">
            <span class="material-symbols-outlined text-5xl text-outline-variant mb-3 block">receipt_long</span>
            <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-1">No invoices found</h3>
            <p class="text-sm text-on-surface-variant">
              {#if activeFilter !== 'all'}
                You have no {activeFilter} invoices.
              {:else}
                You have no invoices yet.
              {/if}
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>

<!-- Payment/Invoice Modal -->
{#if isModalOpen && selectedInvoice}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print-hide p-4">
    <div class="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fadeIn">
      <div class="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest">
        <h3 class="font-title-lg font-bold text-on-surface flex items-center gap-2">
          Invoice <span class="text-primary">{selectedInvoice.invoice_number}</span>
        </h3>
        <button class="text-on-surface-variant hover:text-error transition-colors p-1 rounded-full hover:bg-surface-variant focus:outline-none" onclick={closeInvoiceModal}>
          <span class="material-symbols-outlined block">close</span>
        </button>
      </div>
      
      <div class="p-6 overflow-y-auto bg-surface-container-lowest">
        <!-- Agency & Client Info -->
        <div class="flex justify-between items-start mb-8">
          <div>
            {#if agencyLogo}
              <img src={agencyLogo} alt="Agency Logo" class="h-10 mb-2 object-contain" />
            {:else}
              <h2 class="font-bold text-lg text-primary mb-2">{agencyName}</h2>
            {/if}
            <p class="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Billed By</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Billed To</p>
            <h2 class="font-bold text-lg text-on-surface">{$clientStore.full_name}</h2>
            <p class="text-sm text-on-surface-variant mt-1">Issue Date: {fmtDate(selectedInvoice.created_at)}</p>
            <p class="text-sm text-on-surface-variant">Due Date: <span class="text-error font-semibold">{fmtDate(selectedInvoice.due_date)}</span></p>
          </div>
        </div>

        <!-- Line Items -->
        <div class="border border-outline-variant/30 rounded-xl overflow-hidden mb-6">
          <table class="w-full text-left text-sm">
            <thead class="bg-surface-variant text-on-surface-variant">
              <tr>
                <th class="py-3 px-4 font-semibold">Description</th>
                <th class="py-3 px-4 font-semibold text-right">Qty</th>
                <th class="py-3 px-4 font-semibold text-right">Rate</th>
                <th class="py-3 px-4 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/20">
              {#if selectedInvoice.invoice_items && selectedInvoice.invoice_items.length > 0}
                {#each selectedInvoice.invoice_items as item}
                  <tr class="hover:bg-surface-container-low transition-colors">
                    <td class="py-3 px-4 text-on-surface">{item.description}</td>
                    <td class="py-3 px-4 text-on-surface-variant text-right">{item.quantity}</td>
                    <td class="py-3 px-4 text-on-surface-variant text-right">{fmt(Number(item.rate || 0))}</td>
                    <td class="py-3 px-4 text-on-surface font-semibold text-right">{fmt(Number(item.amount || 0))}</td>
                  </tr>
                {/each}
              {:else}
                <tr>
                  <td colspan="4" class="py-6 px-4 text-center text-outline italic">No line items detailed.</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div class="flex justify-end">
          <div class="w-full max-w-sm space-y-3">
            <div class="flex justify-between text-sm text-on-surface-variant">
              <span>Subtotal</span>
              <span class="font-medium text-on-surface">{fmt(Number(selectedInvoice.subtotal || 0))}</span>
            </div>
            <div class="flex justify-between text-sm text-on-surface-variant">
              <span>GST ({selectedInvoice.gst_rate || 18}%)</span>
              <span class="font-medium text-on-surface">{fmt(Number(selectedInvoice.gst_amount || 0))}</span>
            </div>
            <div class="w-full h-px bg-outline-variant/50"></div>
            <div class="flex justify-between text-lg font-bold text-primary">
              <span>Total Due</span>
              <span>{fmt(Number(selectedInvoice.total || 0))}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-outline-variant/20 bg-surface flex justify-end gap-3">
        <button class="px-5 py-2.5 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors focus:outline-none" onclick={closeInvoiceModal}>
          Cancel
        </button>
        <button class="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-[#10b981] hover:bg-[#059669] shadow-md transition-all active:scale-95 focus:outline-none flex items-center gap-2 disabled:opacity-50" onclick={() => payWithStripe(selectedInvoice.id)} disabled={payingInvoiceId === selectedInvoice.id}>
          {#if payingInvoiceId === selectedInvoice.id}
            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Redirecting to Stripe...
          {:else}
            <span class="material-symbols-outlined text-[18px]">credit_card</span> Pay {fmt(Number(selectedInvoice.total || 0))}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Hidden Printable Invoice Template -->
{#if isPrinting && selectedInvoice}
  <div id="print-area">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #eaeaea; padding-bottom: 20px;">
      <div>
        {#if agencyLogo}
          <img src={agencyLogo} alt="Agency Logo" style="height: 50px; margin-bottom: 10px;" />
        {:else}
          <h1 style="font-size: 24px; font-weight: bold; color: #630ed4; margin: 0 0 10px 0;">{agencyName}</h1>
        {/if}
        <p style="color: #666; margin: 0;">TAX INVOICE</p>
      </div>
      <div style="text-align: right;">
        <h2 style="font-size: 32px; font-weight: bold; margin: 0 0 5px 0;">{selectedInvoice.invoice_number}</h2>
        <p style="color: #666; margin: 0;">Issue Date: {fmtDate(selectedInvoice.created_at)}</p>
        <p style="color: #666; margin: 0;">Status: <strong style="color: #16a34a;">PAID</strong></p>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
      <div style="width: 45%;">
        <p style="font-size: 12px; color: #888; text-transform: uppercase; margin: 0 0 5px 0;">Billed To</p>
        <h3 style="font-size: 18px; font-weight: bold; margin: 0 0 5px 0;">{$clientStore.full_name}</h3>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
          <th style="padding: 12px; text-align: left; color: #444;">Description</th>
          <th style="padding: 12px; text-align: right; color: #444;">Qty</th>
          <th style="padding: 12px; text-align: right; color: #444;">Rate</th>
          <th style="padding: 12px; text-align: right; color: #444;">Amount</th>
        </tr>
      </thead>
      <tbody>
        {#if selectedInvoice.invoice_items && selectedInvoice.invoice_items.length > 0}
          {#each selectedInvoice.invoice_items as item}
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px; text-align: left;">{item.description}</td>
              <td style="padding: 12px; text-align: right; color: #666;">{item.quantity}</td>
              <td style="padding: 12px; text-align: right; color: #666;">{fmt(Number(item.rate || 0))}</td>
              <td style="padding: 12px; text-align: right; font-weight: bold;">{fmt(Number(item.amount || 0))}</td>
            </tr>
          {/each}
        {:else}
          <tr><td colspan="4" style="padding: 20px; text-align: center; color: #999;">No line items detailed.</td></tr>
        {/if}
      </tbody>
    </table>

    <div style="display: flex; justify-content: flex-end;">
      <div style="width: 300px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #666;">
          <span>Subtotal</span>
          <span>{fmt(Number(selectedInvoice.subtotal || 0))}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #666;">
          <span>GST ({selectedInvoice.gst_rate || 18}%)</span>
          <span>{fmt(Number(selectedInvoice.gst_amount || 0))}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 16px 0; border-top: 2px solid #ddd; margin-top: 8px; font-size: 20px; font-weight: bold;">
          <span>Total Paid</span>
          <span>{fmt(Number(selectedInvoice.total || 0))}</span>
        </div>
      </div>
    </div>
    
    <div style="margin-top: 60px; text-align: center; color: #888; font-size: 14px;">
      <p>Thank you for your business!</p>
    </div>
  </div>
{/if}

{#if toastMsg}
  <div class="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-lg shadow-lg font-body-md text-body-md flex items-center gap-2 {toastType === 'error' ? 'bg-error-container text-on-error-container' : 'bg-on-surface text-surface'}">
    <span class="material-symbols-outlined text-sm">{toastType === 'error' ? 'error' : 'check_circle'}</span>
    {toastMsg}
  </div>
{/if}
