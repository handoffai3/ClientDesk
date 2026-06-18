import { writable } from 'svelte/store';

export const clientDataStore = writable({
  agencyName: '',
  agencyLogo: '',
  projects: [] as any[],
  files: [] as any[],
  invoices: [] as any[],
  messages: [] as any[],
  loaded: false
});
