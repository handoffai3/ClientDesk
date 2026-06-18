<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';

  const navTabs = ['Dashboard', 'Projects', 'Clients', 'Files', 'Invoices', 'Messages'];

  let clients = $state<any[]>([]);
  let projects = $state<any[]>([]);
  let userMenuOpen = $state(false);
  let saving = $state(false);
  let errorMsg = $state('');

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

  async function loadData() {
    if (!authState.agencyId) return;
    const { data: c } = await supabase.from('clients').select('id, full_name, company, location').eq('agency_id', authState.agencyId).order('full_name');
    if (c) clients = c;
    const { data: p } = await supabase.from('projects').select('id, name, client_id').eq('agency_id', authState.agencyId).order('name');
    if (p) projects = p;

    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', authState.agencyId);
    
    const nextNum = (count || 0) + 1;
    invoiceNumber = `INV-${year}-${nextNum.toString().padStart(3, '0')}`;
  }

  $effect(() => {
    if (!authState.loading && authState.agencyId) loadData();
  });

  async function handleSave(status: 'pending' | 'paid') {
    if (!clientId) { errorMsg = 'Please select a client.'; return; }
    if (lineItems.every(i => !i.description && !i.qty && !i.rate)) { errorMsg = 'Add at least one line item.'; return; }
    saving = true;
    errorMsg = '';

    // 1. Insert invoice
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
      .select('id')
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

    saving = false;
    goto('/invoices');
  }

  function tabHref(tab: string) {
    if (tab === 'Dashboard') return '/';
    if (tab === 'Projects') return '/projects';
    if (tab === 'Clients') return '/clients';
    if (tab === 'Files') return '/files';
    if (tab === 'Invoices') return '/invoices';
    return `/?tab=${tab}`;
  }

  async function handleSignOut() {
    userMenuOpen = false;
    await supabase.auth.signOut();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Create Invoice - ClientDesk</title>
</svelte:head>

<style>
  .hero-gradient { background: linear-gradient(135deg, #630ed4 0%, #d2bbff 100%); }
  .form-input {
    border: 1px solid #E5E7EB; border-radius: 8px; transition: all 0.2s ease;
    color: #1d1a24;
  }
  .form-input:focus { border-color: #630ed4; box-shadow: 0 0 0 2px rgba(99, 14, 212, 0.2); outline: none; }
</style>

<div class="fixed inset-0 bg-background text-on-background font-body-lg text-body-lg flex overflow-hidden w-full">
  <!-- Top Nav -->
  <div class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
    <div class="flex items-center gap-8 w-full max-w-container-max mx-auto justify-between">
      <div class="flex items-center gap-8">
        <a href="/" class="font-headline-md text-headline-md font-bold text-primary">{authState.agencyName || 'ClientDesk'}</a>
        <nav class="hidden md:flex gap-8">
          {#each navTabs as tab}
            <a href={tabHref(tab)} class="relative font-label-md text-label-md transition-colors duration-150 py-5 focus:outline-none {tab === 'Invoices' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">{tab}</a>
          {/each}
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <div class="relative">
          <button class="flex items-center active:scale-95 transition-transform duration-150 focus:outline-none" onclick={() => userMenuOpen = !userMenuOpen}>
            <img alt="User avatar" class="w-8 h-8 rounded-full border border-outline-variant object-cover hover:border-primary transition-colors" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxwSVvb_fIogrcoBmjb3RFOseMlp7ZlQW5UR7wn7k2TUPqho3kL_wgmKdxfNfbmBZt0_3NI5wgM0D3ouDRj8e9hVeue2XIB77dY5A0onBiPzeaW2r20LW-VONp7JXcwEyqaXtMu6Pn8RqtTfWRwGhHPxBM7_JP3p7JqUqtGW7hAxADfGOI2ViGlUKPcWLkm6P-5y5tMJK4EuXoQRCbpAKVxw57QJdS7TzGXoyCMfB5RekZGyw_bQKaip-8KAkeZeLxB-qA8R_LlLEE" />
          </button>
          {#if userMenuOpen}
            <div class="absolute right-0 top-10 w-48 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg py-2 z-50">
              <div class="px-4 py-2 border-b border-outline-variant/30">
                <p class="text-xs font-semibold text-on-surface">{authState.userFullName || 'User'}</p>
                <p class="text-[10px] text-outline truncate">{authState.user?.email || ''}</p>
              </div>
              <hr class="border-outline-variant/30 my-1" />
              <button class="w-full text-left px-4 py-2 text-xs text-error hover:bg-error-container/20 transition-colors flex items-center gap-2" onclick={handleSignOut}>
                <span class="material-symbols-outlined text-sm">logout</span> Sign Out
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Main -->
  <main class="flex-1 overflow-y-auto mt-16 px-margin-desktop py-8 max-w-container-max mx-auto w-full space-y-stack-md">
    <!-- Back -->
    <a href="/invoices" class="flex items-center gap-1 w-fit text-on-surface-variant hover:text-primary transition-colors">
      <span class="material-symbols-outlined text-[20px]">arrow_back</span>
      <span class="font-body-md font-medium">Back to Invoices</span>
    </a>

    <!-- Hero -->
    <div class="hero-gradient rounded-xl p-8 text-on-primary flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg">
      <div>
        <h1 class="font-headline-lg text-headline-lg md:font-display-lg md:text-display-lg mb-2">Create Invoice</h1>
        <p class="font-body-lg text-body-lg opacity-90">Generate and send professional invoices</p>
      </div>
      <div class="mt-4 md:mt-0 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/30">
        <span class="font-label-md text-label-md uppercase tracking-wider opacity-80 block">Invoice #</span>
        <span class="font-title-md text-title-md">{invoiceNumber}</span>
      </div>
    </div>

    {#if errorMsg}
      <div class="p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg text-sm flex items-center gap-2">
        <span class="material-symbols-outlined text-lg">error</span><span>{errorMsg}</span>
      </div>
    {/if}

    <!-- Form + Preview -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
      <!-- Left: Form -->
      <div class="lg:col-span-7 bg-surface-container-lowest rounded-xl p-6 shadow-sm flex flex-col gap-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="font-label-md text-label-md text-on-surface-variant" for="inv-client">Client *</label>
            <select id="inv-client" class="form-input w-full p-2 font-body-md text-body-md bg-transparent" bind:value={clientId} disabled={saving}>
              <option value="" disabled>Select Client...</option>
              {#each clients as c (c.id)}
                <option value={c.id}>{c.full_name} {c.company ? `(${c.company})` : ''}</option>
              {/each}
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-label-md text-label-md text-on-surface-variant" for="inv-project">Project</label>
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
            <label class="font-label-md text-label-md text-on-surface-variant" for="inv-issue">Issue Date</label>
            <input id="inv-issue" class="form-input w-full p-2 font-body-md text-body-md bg-transparent" type="date" bind:value={issueDate} disabled={saving} />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-label-md text-label-md text-on-surface-variant" for="inv-due">Due Date</label>
            <input id="inv-due" class="form-input w-full p-2 font-body-md text-body-md bg-transparent" type="date" bind:value={dueDate} disabled={saving} />
          </div>
        </div>

        <!-- Line Items -->
        <div class="border-t border-outline-variant pt-6">
          <h3 class="font-title-md text-title-md text-on-surface mb-4 flex items-center justify-between">
            Line Items
            <button class="font-label-md text-label-md text-primary flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none" onclick={addItem}>
              <span class="material-symbols-outlined text-[16px]">add</span> Add Item
            </button>
          </h3>

          <div class="grid grid-cols-12 gap-2 mb-2 font-label-md text-label-md text-on-surface-variant px-2">
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
        <div class="border-t border-outline-variant pt-6 flex flex-col md:flex-row justify-between items-end gap-6">
          <div class="w-full md:w-auto flex items-center gap-3 bg-surface p-3 rounded-lg border border-outline-variant">
            <span class="font-label-md text-label-md text-on-surface">Apply GST (18%)</span>
            <input type="checkbox" bind:checked={applyGst} class="accent-primary w-5 h-5" />
          </div>
          <div class="w-full md:w-64 flex flex-col gap-2">
            <div class="flex justify-between font-body-md text-body-md text-on-surface-variant">
              <span>Subtotal</span><span>₹{fmt(subtotal)}</span>
            </div>
            {#if applyGst}
              <div class="flex justify-between font-body-md text-body-md text-on-surface-variant">
                <span>GST (18%)</span><span>₹{fmt(gstAmount)}</span>
              </div>
            {/if}
            <div class="flex justify-between font-title-md text-title-md text-on-surface pt-2 border-t border-outline-variant font-bold">
              <span>Total</span><span>₹{fmt(total)}</span>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="border-t border-outline-variant pt-6">
          <label class="font-label-md text-label-md text-on-surface-variant mb-1 block" for="inv-notes">Notes</label>
          <textarea id="inv-notes" class="form-input w-full p-3 font-body-md text-body-md bg-transparent resize-none" rows="2" bind:value={notes} placeholder="Payment terms, thank you note..." disabled={saving}></textarea>
        </div>

        <!-- Actions -->
        <div class="pt-4 flex justify-end gap-3 border-t border-outline-variant">
          <a href="/invoices" class="px-6 py-2 rounded-lg font-label-md text-label-md bg-surface-variant text-on-surface-variant hover:bg-outline-variant transition-colors no-underline">Cancel</a>
          <button onclick={() => handleSave('pending')} disabled={saving} class="px-6 py-2 rounded-lg font-label-md text-label-md bg-surface-variant text-on-surface-variant hover:bg-outline-variant transition-colors focus:outline-none flex items-center gap-2">
            {#if saving}<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{/if}
            Save Draft
          </button>
          <button onclick={() => handleSave('pending')} disabled={saving} class="px-6 py-2 rounded-lg font-label-md text-label-md text-on-primary bg-primary hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md focus:outline-none">
            <span class="material-symbols-outlined text-[16px]">send</span> Send to Client
          </button>
        </div>
      </div>

      <!-- Right: Live Preview -->
      <div class="lg:col-span-5 bg-surface-container-lowest rounded-xl p-6 shadow-sm flex flex-col sticky top-24">
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant">
          <h2 class="font-title-md text-title-md text-on-surface">Live Preview</h2>
          <span class="material-symbols-outlined text-outline">visibility</span>
        </div>

        <div class="bg-white border border-outline-variant p-6 rounded-lg shadow-sm flex-1 font-body-md text-body-md text-on-surface relative overflow-hidden">
          <div class="absolute -right-6 top-12 rotate-[30deg] opacity-10 pointer-events-none">
            <span class="font-display-lg text-display-lg text-primary uppercase font-bold border-4 border-primary p-2 rounded">DRAFT</span>
          </div>

          <div class="flex justify-between items-start mb-8">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {(authState.agencyName || 'ClientDesk').substring(0, 1)}
              </div>
              <div>
                <div class="font-headline-md text-headline-md font-bold text-primary mb-1">{authState.agencyName || 'ClientDesk'}</div>
                <div class="text-on-surface-variant text-[12px] leading-relaxed">123 Tech Park, Block B<br/>GSTIN: 29XXXXX0000X1Z5</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-title-md text-title-md mb-1 text-on-surface-variant">INVOICE</div>
              <div class="font-label-md text-label-md">#{invoiceNumber}</div>
              <div class="text-[12px] mt-2 text-on-surface-variant">{issueDate ? new Date(issueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</div>
            </div>
          </div>

          <div class="mb-8 p-4 bg-surface-container-low rounded">
            <div class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase">Billed To:</div>
            <div class="font-title-md text-title-md">{clients.find(c => c.id === clientId)?.full_name || 'Select a Client'}</div>
            {#if clients.find(c => c.id === clientId)?.company}
              <div class="text-[12px] text-on-surface-variant mt-1">{clients.find(c => c.id === clientId)?.company}</div>
            {/if}
            {#if clients.find(c => c.id === clientId)?.location}
              <div class="text-[12px] text-on-surface-variant mt-1">{clients.find(c => c.id === clientId)?.location}</div>
            {/if}
          </div>

          <table class="w-full mb-8 text-[13px]">
            <thead>
              <tr class="border-b-2 border-surface-variant text-left text-on-surface-variant font-label-md text-label-md">
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
              <div class="flex justify-between py-2 mt-2 border-t border-surface-variant font-title-md text-title-md text-primary font-bold">
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
