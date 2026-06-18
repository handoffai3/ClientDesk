<script lang="ts">
  let { onCancel } = $props<{ onCancel: () => void }>();

  // Form State
  let client = $state('Acme Corp');
  let invoiceId = $state('INV-2024-005');
  let issueDate = $state('2024-10-24');
  let dueDate = $state('');

  // Line items
  interface LineItem {
    id: number;
    description: string;
    qty: number;
    rate: number;
  }
  let lineItems = $state<LineItem[]>([
    { id: 1, description: 'UI/UX Design Phase 1', qty: 40, rate: 150 }
  ]);

  let applyGst = $state(true);

  // Derived totals
  let subtotal = $derived(lineItems.reduce((acc, item) => acc + (item.qty * item.rate), 0));
  let gstAmount = $derived(applyGst ? subtotal * 0.18 : 0);
  let total = $derived(subtotal + gstAmount);

  function addItem() {
    lineItems = [...lineItems, { id: Date.now(), description: '', qty: 0, rate: 0 }];
  }

  function updateItem(id: number, field: keyof LineItem, value: string | number) {
    lineItems = lineItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  }
</script>

<style>
  .hero-gradient {
      background: linear-gradient(135deg, #630ed4 0%, #d2bbff 100%);
  }
  .form-input {
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      transition: all 0.2s ease;
  }
  .form-input:focus {
      border-color: #630ed4;
      box-shadow: 0 0 0 2px rgba(99, 14, 212, 0.2);
      outline: none;
  }
  .ambient-shadow-sm { box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.05); }
</style>

<div class="animate-fadeIn flex flex-col gap-stack-md">
  <!-- Back Button -->
  <button class="flex items-center gap-1 w-fit text-on-surface-variant hover:text-primary transition-colors focus:outline-none" onclick={onCancel}>
    <span class="material-symbols-outlined text-[20px]">arrow_back</span>
    <span class="font-body-md font-medium">Back to Invoices</span>
  </button>

  <!-- Hero Card -->
  <div class="hero-gradient rounded-xl p-8 text-on-primary flex flex-col md:flex-row justify-between items-start md:items-center ambient-shadow-sm">
    <div>
      <h1 class="font-headline-lg text-headline-lg md:font-display-lg md:text-display-lg mb-2">Create Invoice</h1>
      <p class="font-body-lg text-body-lg opacity-90">Generate and send professional invoices</p>
    </div>
    <div class="mt-4 md:mt-0 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/30">
      <span class="font-label-md text-label-md uppercase tracking-wider opacity-80 block">Invoice #</span>
      <span class="font-title-md text-title-md">{invoiceId}</span>
    </div>
  </div>

  <!-- Main Content Area -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
    <!-- Left Column: Form Editor -->
    <div class="lg:col-span-7 bg-surface-container-lowest rounded-xl p-6 ambient-shadow-sm flex flex-col gap-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1">
          <label class="font-label-md text-label-md text-on-surface-variant">Client</label>
          <select class="form-input w-full p-2 font-body-md text-body-md bg-transparent" bind:value={client}>
            <option value="Acme Corp">Acme Corp</option>
            <option value="Globex Inc">Globex Inc</option>
            <option value="Stark Industries">Stark Industries</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-label-md text-label-md text-on-surface-variant">Project</label>
          <select class="form-input w-full p-2 font-body-md text-body-md bg-transparent">
            <option value="">Select Project...</option>
            <option value="1">Website Redesign</option>
            <option value="2">Mobile App Dev</option>
          </select>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1">
          <label class="font-label-md text-label-md text-on-surface-variant">Issue Date</label>
          <input class="form-input w-full p-2 font-body-md text-body-md bg-transparent" type="date" bind:value={issueDate}/>
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-label-md text-label-md text-on-surface-variant">Due Date</label>
          <input class="form-input w-full p-2 font-body-md text-body-md bg-transparent" type="date" bind:value={dueDate}/>
        </div>
      </div>

      <div class="border-t border-outline-variant pt-6">
        <h3 class="font-title-md text-title-md text-on-surface mb-4 flex items-center justify-between">
          Line Items
          <button class="font-label-md text-label-md text-primary flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none" onclick={addItem}>
            <span class="material-symbols-outlined text-[16px]" data-icon="add">add</span> Add Item
          </button>
        </h3>
        
        <!-- Line Item Headers -->
        <div class="grid grid-cols-12 gap-2 mb-2 font-label-md text-label-md text-on-surface-variant px-2">
          <div class="col-span-6">Description</div>
          <div class="col-span-2 text-right">Qty</div>
          <div class="col-span-2 text-right">Rate</div>
          <div class="col-span-2 text-right">Amount</div>
        </div>
        
        <!-- Line Items -->
        {#each lineItems as item (item.id)}
          <div class="grid grid-cols-12 gap-2 mb-3 items-center">
            <div class="col-span-6">
              <input class="form-input w-full p-2 font-body-md text-body-md" type="text" value={item.description} oninput={(e) => updateItem(item.id, 'description', e.currentTarget.value)} placeholder="Item description"/>
            </div>
            <div class="col-span-2">
              <input class="form-input w-full p-2 font-body-md text-body-md text-right" type="number" value={item.qty} oninput={(e) => updateItem(item.id, 'qty', Number(e.currentTarget.value))} placeholder="0"/>
            </div>
            <div class="col-span-2">
              <input class="form-input w-full p-2 font-body-md text-body-md text-right" type="number" value={item.rate} oninput={(e) => updateItem(item.id, 'rate', Number(e.currentTarget.value))} placeholder="0.00"/>
            </div>
            <div class="col-span-2 text-right font-body-md text-body-md px-2 {item.qty * item.rate === 0 ? 'text-on-surface-variant' : ''}">
              {formatCurrency(item.qty * item.rate)}
            </div>
          </div>
        {/each}
      </div>

      <div class="border-t border-outline-variant pt-6 flex flex-col md:flex-row justify-between items-end gap-6">
        <div class="w-full md:w-auto flex items-center gap-3 bg-surface p-3 rounded-lg border border-outline-variant">
          <span class="font-label-md text-label-md text-on-surface">Apply GST (18%)</span>
          <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
            <input type="checkbox" id="gst-toggle" class="peer sr-only" bind:checked={applyGst}/>
            <label for="gst-toggle" class="block overflow-hidden h-5 rounded-full bg-surface-variant cursor-pointer transition-colors duration-200 peer-checked:bg-primary"></label>
            <div class="absolute left-0 top-0 bg-white w-5 h-5 rounded-full border-2 border-surface-variant transition-transform duration-200 peer-checked:translate-x-5 peer-checked:border-primary"></div>
          </div>
        </div>
        
        <div class="w-full md:w-64 flex flex-col gap-2">
          <div class="flex justify-between font-body-md text-body-md text-on-surface-variant">
            <span>Subtotal</span>
            <span>INR {formatCurrency(subtotal)}</span>
          </div>
          {#if applyGst}
          <div class="flex justify-between font-body-md text-body-md text-on-surface-variant animate-fadeIn">
            <span>GST (18%)</span>
            <span>INR {formatCurrency(gstAmount)}</span>
          </div>
          {/if}
          <div class="flex justify-between font-title-md text-title-md text-on-surface pt-2 border-t border-outline-variant">
            <span>Total</span>
            <span>INR {formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div class="pt-6 mt-2 flex justify-end gap-3 border-t border-outline-variant">
        <button class="px-6 py-2 rounded-lg font-label-md text-label-md bg-surface-variant text-on-surface-variant hover:bg-outline-variant transition-colors focus:outline-none">
          Save Draft
        </button>
        <button class="px-6 py-2 rounded-lg font-label-md text-label-md text-on-primary bg-primary hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md focus:outline-none">
          <span class="material-symbols-outlined text-[16px]" data-icon="send">send</span>
          Send to Client
        </button>
      </div>
    </div>

    <!-- Right Column: Live Preview -->
    <div class="lg:col-span-5 bg-surface-container-lowest rounded-xl p-6 ambient-shadow-sm flex flex-col sticky top-24">
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant">
        <h2 class="font-title-md text-title-md text-on-surface">Live Preview</h2>
        <span class="material-symbols-outlined text-outline" data-icon="visibility">visibility</span>
      </div>
      
      <!-- Actual Invoice Preview Card -->
      <div class="bg-white border border-outline-variant p-6 rounded-lg shadow-sm flex-1 font-body-md text-body-md text-on-surface relative overflow-hidden">
        <!-- Watermark / Stamp Placeholder -->
        <div class="absolute -right-6 top-12 rotate-[30deg] opacity-10 pointer-events-none">
          <span class="font-display-lg text-display-lg text-primary uppercase font-bold border-4 border-primary p-2 rounded">PENDING</span>
        </div>
        
        <div class="flex justify-between items-start mb-8">
          <div>
            <div class="font-headline-md text-headline-md font-bold text-primary mb-1">ClientDesk</div>
            <div class="text-on-surface-variant text-[12px] leading-relaxed">
              123 Tech Park, Block B<br/>
              Bangalore, India 560001<br/>
              GSTIN: 29XXXXX0000X1Z5
            </div>
          </div>
          <div class="text-right">
            <div class="font-title-md text-title-md mb-1 text-on-surface-variant">INVOICE</div>
            <div class="font-label-md text-label-md">#{invoiceId}</div>
            <div class="text-[12px] mt-2 text-on-surface-variant">Date: {issueDate ? new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</div>
          </div>
        </div>
        
        <div class="mb-8 p-4 bg-surface-container-low rounded">
          <div class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase">Billed To:</div>
          <div class="font-title-md text-title-md">{client || 'Select a Client'}</div>
          <div class="text-[12px] text-on-surface-variant mt-1">
            Attn: Finance Dept<br/>
            456 Corporate Blvd<br/>
            Mumbai, India 400001
          </div>
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
                  <td class="py-3 pr-2 break-words">{item.description || '-'}</td>
                  <td class="py-3 text-right">{item.qty || 0}</td>
                  <td class="py-3 text-right">{item.rate || 0}</td>
                  <td class="py-3 text-right">{formatCurrency((item.qty || 0) * (item.rate || 0))}</td>
                </tr>
              {/if}
            {/each}
            {#if lineItems.length === 0 || !lineItems.some(i => i.description || i.qty || i.rate)}
              <tr class="border-b border-surface-variant">
                <td colspan="4" class="py-3 text-center text-on-surface-variant italic">No items added yet.</td>
              </tr>
            {/if}
          </tbody>
        </table>
        
        <div class="flex justify-end">
          <div class="w-48 text-[13px]">
            <div class="flex justify-between py-1 text-on-surface-variant">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {#if applyGst}
            <div class="flex justify-between py-1 text-on-surface-variant">
              <span>GST (18%)</span>
              <span>{formatCurrency(gstAmount)}</span>
            </div>
            {/if}
            <div class="flex justify-between py-2 mt-2 border-t border-surface-variant font-title-md text-title-md text-primary">
              <span>Total INR</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
        
        <div class="mt-12 text-center text-[11px] text-outline">
          Thank you for your business.<br/>
          Please process payment within 15 days.
        </div>
      </div>
    </div>
  </div>
</div>
