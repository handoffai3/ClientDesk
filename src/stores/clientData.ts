import { writable } from 'svelte/store';

export const clientDataStore = writable({
  agencyName: '',
  agencyLogo: '',
  currency: 'USD',
  taxLabel: 'Tax',
  defaultTaxRate: 0,
  projects: [] as any[],
  files: [] as any[],
  invoices: [] as any[],
  messages: [] as any[],
  loaded: false
});
