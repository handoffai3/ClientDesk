<script lang="ts" module>
  export interface InvoiceProps {
    id: string;
    status: 'Paid' | 'Pending' | 'Overdue';
    clientName: string;
    clientInitials?: string;
    clientAvatar?: string;
    amount: string;
    theme?: 'primary' | 'secondary' | 'tertiary';
  }
</script>

<script lang="ts">
  let { invoice } = $props<{ invoice: InvoiceProps }>();

  let statusConfig = $derived.by(() => {
    switch (invoice.status) {
      case 'Paid': return 'bg-[#dcfce7] text-[#166534]';
      case 'Pending': return 'bg-[#fef3c7] text-[#b45309]';
      case 'Overdue': return 'bg-error-container text-on-error-container';
      default: return 'bg-surface-variant text-on-surface-variant';
    }
  });

  let initialsBg = $derived.by(() => {
    switch (invoice.theme) {
      case 'primary': return 'bg-primary-container text-on-primary-container';
      case 'secondary': return 'bg-secondary-container text-on-secondary';
      case 'tertiary': return 'bg-tertiary-container text-on-tertiary';
      default: return 'bg-surface-variant text-on-surface-variant';
    }
  });
</script>

<div class="bg-surface rounded-[16px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col border border-surface-variant">
  <div class="flex justify-between items-start mb-4">
    <span class="font-label-md text-label-md text-outline">{invoice.id}</span>
    <span class="{statusConfig} px-2 py-1 rounded font-label-md text-label-md">{invoice.status}</span>
  </div>
  <div class="flex items-center gap-3 mb-6">
    {#if invoice.clientAvatar}
      <img alt="Client avatar" class="w-10 h-10 rounded-full bg-surface-variant object-cover" src={invoice.clientAvatar} />
    {:else}
      <div class="w-10 h-10 rounded-full {initialsBg} flex items-center justify-center font-title-md text-title-md">
        {invoice.clientInitials}
      </div>
    {/if}
    <div class="font-title-md text-title-md text-on-surface">{invoice.clientName}</div>
  </div>
  <div class="mb-6 flex-grow">
    <div class="font-headline-md text-headline-md text-on-surface">{invoice.amount}</div>
    <div class="font-body-md text-body-md text-outline">Total Amount</div>
  </div>
  <div class="flex gap-2 mt-auto">
    <button class="flex-1 bg-primary-container hover:bg-primary/20 text-primary px-3 py-2 rounded font-label-md text-label-md transition-colors flex items-center justify-center gap-1 focus:outline-none">
      <span class="material-symbols-outlined text-sm">download</span> PDF
    </button>
    <button class="flex-1 bg-surface-variant hover:bg-surface-dim text-on-surface-variant px-3 py-2 rounded font-label-md text-label-md transition-colors flex items-center justify-center gap-1 focus:outline-none">
      <span class="material-symbols-outlined text-sm">send</span> Remind
    </button>
  </div>
</div>
