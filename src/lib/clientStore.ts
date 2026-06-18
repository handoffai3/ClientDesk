import { writable } from 'svelte/store';

export const clientStore = writable({
  client_id: null as string | null,
  full_name: null as string | null,
  agency_id: null as string | null
});
