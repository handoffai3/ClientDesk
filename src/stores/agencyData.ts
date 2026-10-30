import { writable } from 'svelte/store';

export const agencyDataStore = writable({
  clients: [] as any[],
  projects: [] as any[],
  files: [] as any[],
  invoices: [] as any[],
  tasks: [] as any[],
  messages: [] as any[],
  currency: 'USD',
  taxLabel: 'Tax',
  defaultTaxRate: 0,
  loaded: false
});
