<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { agencyDataStore } from '../../../stores/agencyData';
  import AgencyHeader from '$lib/components/AgencyHeader.svelte';

  let saving = $state(false);
  let errorMsg = $state('');

  // Derive clients and projects from the global store
  let clients = $derived($agencyDataStore.clients);
  let projects = $derived($agencyDataStore.projects);

  // Form state
  let clientId = $state('');
  let projectId = $state('');
  let invoiceNumber = $state('INV-...');
  let issueDate = $state(new Date().toISOString().split('T')[0]);
  let dueDate = $state('');
  let notes = $state('');
  let applyGst = $state(true);

  interface LineItem { id: number; description: string; qty: number; rate: number; }
  let lineItems = $state<LineItem[]>([
    { id: 1, description: '', qty: 0, rate: 0 }
  ]);

  let subtotal = $derived(lineItems.reduce((s, i) => s + (i.qty * i.rate), 0));
  let gstAmount = $derived(applyGst ? subtotal * 0.18 : 0);
  let total = $derived(subtotal + gstAmount);

  function fmt(n: number) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  function addItem() {
    lineItems = [...lineItems, { id: Date.now(), description: '', qty: 0, rate: 0 }];
  }

  function removeItem(id: number) {
    lineItems = lineItems.filter(i => i.id !== id);
  }

  function updateItem(id: number, field: keyof LineItem, value: string | number) {
    lineItems = lineItems.map(i => i.id === id ? { ...i, [field]: value } : i);
  }

  let filteredProjects = $derived(clientId ? projects.filter(p => p.client_id === clientId) : projects);

  $effect(() => {
    if (clientId && projectId) {
      const p = projects.find(proj => proj.id === projectId);
      if (p && p.client_id !== clientId) {
        projectId = '';
      }
    }
  });

  // Generate invoice number from existing store data
  let invoiceNumberGenerated = false;
  $effect(() => {
    if ($agencyDataStore.loaded && !invoiceNumberGenerated) {
      invoiceNumberGenerated = true;
      const year = new Date().getFullYear();
      const nextNum = ($agencyDataStore.invoices.length || 0) + 1;
      invoiceNumber = `INV-${year}-${nextNum.toString().padStart(3, '0')}`;
    }
  });

  async function handleSave(status: 'draft' | 'sent') {
    if (!clientId) { errorMsg = 'Please select a client.'; return; }
    if (lineItems.every(i => !i.description && !i.qty && !i.rate)) { errorMsg = 'Add at least one line item.'; return; }
    saving = true;
    errorMsg = '';

    // 1. Insert invoice — select full row plus joined client data
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .insert({
        agency_id: authState.agencyId,
        client_id: clientId,
        project_id: projectId || null,
        invoice_number: invoiceNumber,
        status,
        subtotal,
        gst_rate: applyGst ? 18 : 0,
        gst_amount: gstAmount,
        total,
        issue_date: issueDate || null,
        due_date: dueDate || null,
        notes: notes || null
      })
      .select('*, clients(full_name, avatar_url)')
      .single();

    if (invErr) {
      errorMsg = invErr.message;
      saving = false;
      return;
    }

    // 2. Insert line items
    const items = lineItems
      .filter(i => i.description || i.qty || i.rate)
      .map(i => ({
        invoice_id: inv.id,
        description: i.description || 'Item',
        quantity: i.qty,
        rate: i.rate,
        amount: i.qty * i.rate
      }));

    if (items.length > 0) {
      await supabase.from('invoice_items').insert(items);
    }

    // 3. Push the new invoice into the global store so /invoices sees it instantly
    agencyDataStore.update(s => ({
      ...s,
      invoices: [inv, ...s.invoices]
    }));

    saving = false;
    goto('/invoices');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Create Invoice - ClientDesk</title>
</svelte:head>

<style>
  .form-input {
    border: 1px solid #E5E7EB; border-radius: 8px; transition: border-color 0.15s, box-shadow 0.15s;
    color: #1d1a24; font-size: 14px;
  }
  .form-input:focus { border-color: #5b21b6; box-shadow: 0 0 0 2px rgba(91, 33, 182, 0.1); outline: none; }
</style>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <AgencyHeader activeTab="Invoices" />

  <!-- Main -->
  <main class="flex-1 overflow-y-auto mt-14 px-6 py-6 max-w-container-max mx-auto w-full space-y-5">
    <a href="/invoices" class="flex items-center gap-1.5 w-fit text-on-surface-variant hover:text-on-surface transition-colors no-underline">
      <span class="material-symbols-outlined text-[16px]">arrow_back</span>
      <span class="text-[13px] font-medium">Invoices</span>
    </a>

    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
      <div>
        <h1 class="text-xl font-semibold text-on-surface mb-1">Create Invoice</h1>
        <p class="text-sm text-on-surface-variant">Generate and send professional invoices</p>
      </div>
      <div class="bg-white border border-outline-variant rounded-lg px-3 py-2 shadow-xs">
        <span class="text-[11px] text-on-surface-variant block">Invoice #</span>
        <span class="text-sm font-medium text-on-surface">{invoiceNumber}</span>
      </div>
    </div>

    {#if errorMsg}
      <div class="p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg text-sm flex items-center gap-2">
        <span class="material-symbols-outlined text-lg">error</span><span>{errorMsg}</span>
      </div>
    {/if}

    <!-- Form + Preview -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div class="lg:col-span-7 bg-white rounded-lg border border-outline-variant p-5 shadow-xs flex flex-col gap-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-on-surface-variant" for="inv-client">Client *</label>
            <select id="inv-client" class="form-input w-full p-2 font-body-md text-body-md bg-transparent" bind:value={clientId} disabled={saving}>
              <option value="" disabled>Select Client...</option>
              {#each clients as c (c.id)}
                <option value={c.id}>{c.full_name} {c.company ? `(${c.company})` : ''}</option>
              {/each}
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-on-surface-variant" for="inv-project">Project</label>
            <select id="inv-project" class="form-input w-full p-2 font-body-md text-body-md bg-transparent" bind:value={projectId} disabled={saving}>
              <option value="">None</option>
              {#each filteredProjects as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-on-surface-variant" for="inv-issue">Issue Date</label>
            <input id="inv-issue" class="form-input w-full p-2 font-body-md text-body-md bg-transparent" type="date" bind:value={issueDate} disabled={saving} />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-on-surface-variant" for="inv-due">Due Date</label>
            <input id="inv-due" class="form-input w-full p-2 font-body-md text-body-md bg-transparent" type="date" bind:value={dueDate} disabled={saving} />
          </div>
        </div>

        <!-- Line Items -->
        <div class="border-t border-outline-variant pt-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-medium text-on-surface">Line Items</h3>
            <button class="text-[13px] text-primary font-medium flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none" onclick={addItem}>
              <span class="material-symbols-outlined text-[16px]">add</span> Add Item
            </button>
          </div>

          <div class="grid grid-cols-12 gap-2 mb-2 text-[11px] font-medium text-on-surface-variant px-2">
            <div class="col-span-5">Description</div>
            <div class="col-span-2 text-right">Qty</div>
            <div class="col-span-2 text-right">Rate</div>
            <div class="col-span-2 text-right">Amount</div>
            <div class="col-span-1"></div>
          </div>

          {#each lineItems as item (item.id)}
            <div class="grid grid-cols-12 gap-2 mb-3 items-center">
              <div class="col-span-5">
                <input class="form-input w-full p-2 font-body-md text-body-md" type="text" value={item.description} oninput={(e) => updateItem(item.id, 'description', e.currentTarget.value)} placeholder="Item description" disabled={saving} />
              </div>
              <div class="col-span-2">
                <input class="form-input w-full p-2 font-body-md text-body-md text-right" type="number" value={item.qty} oninput={(e) => updateItem(item.id, 'qty', Number(e.currentTarget.value))} placeholder="0" disabled={saving} />
              </div>
              <div class="col-span-2">
                <input class="form-input w-full p-2 font-body-md text-body-md text-right" type="number" value={item.rate} oninput={(e) => updateItem(item.id, 'rate', Number(e.currentTarget.value))} placeholder="0" disabled={saving} />
              </div>
              <div class="col-span-2 text-right font-body-md text-body-md px-2">₹{fmt(item.qty * item.rate)}</div>
              <div class="col-span-1 text-center">
                <button onclick={() => removeItem(item.id)} class="text-on-surface-variant hover:text-error focus:outline-none" disabled={saving}>
                  <span class="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>
          {/each}
        </div>

        <!-- Totals -->
        <div class="border-t border-outline-variant pt-5 flex flex-col md:flex-row justify-between items-end gap-5">
          <div class="w-full md:w-auto flex items-center gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
            <span class="text-sm text-on-surface">Apply GST (18%)</span>
            <input type="checkbox" bind:checked={applyGst} class="accent-primary w-5 h-5" />
          </div>
          <div class="w-full md:w-56 flex flex-col gap-1.5">
            <div class="flex justify-between text-sm text-on-surface-variant">
              <span>Subtotal</span><span>₹{fmt(subtotal)}</span>
            </div>
            {#if applyGst}
              <div class="flex justify-between text-sm text-on-surface-variant">
                <span>GST (18%)</span><span>₹{fmt(gstAmount)}</span>
              </div>
            {/if}
            <div class="flex justify-between text-[15px] text-on-surface pt-2 border-t border-outline-variant font-semibold">
              <span>Total</span><span>₹{fmt(total)}</span>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="border-t border-outline-variant pt-5">
          <label class="text-xs font-medium text-on-surface-variant mb-1 block" for="inv-notes">Notes</label>
          <textarea id="inv-notes" class="form-input w-full p-3 font-body-md text-body-md bg-transparent resize-none" rows="2" bind:value={notes} placeholder="Payment terms, thank you note..." disabled={saving}></textarea>
        </div>

        <!-- Actions -->
        <div class="pt-4 flex justify-end gap-2 border-t border-outline-variant">
          <a href="/invoices" class="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors no-underline">Cancel</a>
          <button onclick={() => handleSave('draft')} disabled={saving} class="px-4 py-2 rounded-lg text-sm font-medium border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors focus:outline-none flex items-center gap-1.5">
            {#if saving}<div class="w-3.5 h-3.5 border-2 border-outline/30 border-t-outline rounded-full animate-spin"></div>{/if}
            Save Draft
          </button>
          <button onclick={() => handleSave('sent')} disabled={saving} class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary-hover transition-colors flex items-center gap-1.5 focus:outline-none">
            <span class="material-symbols-outlined text-[16px]">send</span> Send to Client
          </button>
        </div>
      </div>

      <!-- Right: Live Preview -->
      <div class="lg:col-span-5 bg-white rounded-lg border border-outline-variant p-5 shadow-xs flex flex-col sticky top-20">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-outline-variant">
          <h2 class="text-sm font-medium text-on-surface">Live Preview</h2>
          <span class="material-symbols-outlined text-outline text-[18px]">visibility</span>
        </div>

        <div class="bg-surface-container-low border border-outline-variant p-5 rounded-lg flex-1 text-sm text-on-surface relative overflow-hidden">
          <div class="absolute -right-4 top-10 rotate-[30deg] opacity-[0.06] pointer-events-none">
            <span class="text-[32px] text-primary uppercase font-bold border-2 border-primary px-2 py-1 rounded">DRAFT</span>
          </div>

          <div class="flex justify-between items-start mb-6">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white font-medium text-sm">
                {(authState.agencyName || 'ClientDesk').substring(0, 1)}
              </div>
              <div>
                <div class="text-sm font-semibold text-primary">{authState.agencyName || 'ClientDesk'}</div>
                <div class="text-xs text-on-surface-variant">{authState.user?.email || ''}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs text-on-surface-variant mb-0.5">INVOICE</div>
              <div class="text-xs font-medium">#{invoiceNumber}</div>
              <div class="text-[11px] mt-1 text-on-surface-variant">{issueDate ? new Date(issueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</div>
            </div>
          </div>

          <div class="mb-6 p-3 bg-white rounded-lg border border-outline-variant">
            <div class="text-[10px] text-on-surface-variant mb-1 uppercase font-medium">Billed To:</div>
            <div class="text-sm font-medium">{clients.find(c => c.id === clientId)?.full_name || 'Select a Client'}</div>
            {#if clients.find(c => c.id === clientId)?.company}
              <div class="text-[12px] text-on-surface-variant mt-1">{clients.find(c => c.id === clientId)?.company}</div>
            {/if}
            {#if clients.find(c => c.id === clientId)?.location}
              <div class="text-[12px] text-on-surface-variant mt-1">{clients.find(c => c.id === clientId)?.location}</div>
            {/if}
          </div>

          <table class="w-full mb-6 text-[13px]">
            <thead>
              <tr class="border-b border-outline-variant text-left text-[11px] font-medium text-on-surface-variant">
                <th class="pb-2">Description</th>
                <th class="pb-2 text-right w-12">Qty</th>
                <th class="pb-2 text-right w-20">Rate</th>
                <th class="pb-2 text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {#each lineItems as item}
                {#if item.description || item.qty || item.rate}
                  <tr class="border-b border-surface-variant">
                    <td class="py-3 pr-2">{item.description || '-'}</td>
                    <td class="py-3 text-right">{item.qty || 0}</td>
                    <td class="py-3 text-right">{item.rate || 0}</td>
                    <td class="py-3 text-right">{fmt(item.qty * item.rate)}</td>
                  </tr>
                {/if}
              {/each}
              {#if lineItems.every(i => !i.description && !i.qty && !i.rate)}
                <tr class="border-b border-surface-variant">
                  <td colspan="4" class="py-3 text-center text-on-surface-variant italic">No items added yet.</td>
                </tr>
              {/if}
            </tbody>
          </table>

          <div class="flex justify-end">
            <div class="w-48 text-[13px]">
              <div class="flex justify-between py-1 text-on-surface-variant"><span>Subtotal</span><span>₹{fmt(subtotal)}</span></div>
              {#if applyGst}
                <div class="flex justify-between py-1 text-on-surface-variant"><span>GST (18%)</span><span>₹{fmt(gstAmount)}</span></div>
              {/if}
              <div class="flex justify-between py-2 mt-1.5 border-t border-outline-variant text-sm text-primary font-semibold">
                <span>Total INR</span><span>₹{fmt(total)}</span>
              </div>
            </div>
          </div>

          <div class="mt-12 text-center text-[11px] text-outline">
            Thank you for your business.<br/>Please process payment within 15 days.
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
