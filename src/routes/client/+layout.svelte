<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { clientStore } from '$lib/clientStore';
  import { clientDataStore } from '../../stores/clientData';
  import { authState } from '$lib/auth.svelte';
  import { get } from 'svelte/store';

  let { children } = $props();

  async function fetchClientData() {
    const cStore = get(clientStore);
    if (!cStore.client_id || !cStore.agency_id) return;
    
    const clientId = cStore.client_id;
    const agencyId = cStore.agency_id;

    const [projectsRes, invoicesRes, messagesRes, filesRes, agencyRes] = await Promise.all([
      supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*, invoice_items(*)').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').eq('client_id', clientId).order('created_at', { ascending: true }),
      supabase.from('files').select('*'), // we'll filter this down below using project IDs
      supabase.from('agencies').select('logo_url, name').eq('id', agencyId).single()
    ]);

    const agencyData = agencyRes.data;
    const projects = projectsRes.data || [];
    const projectIds = projects.map(p => p.id);

    let files = [];
    if (projectIds.length > 0) {
      const { data: projectFiles } = await supabase.from('files').select('*').in('project_id', projectIds).order('created_at', { ascending: false });
      files = projectFiles || [];
    }

    clientDataStore.set({
      agencyName: agencyData?.name || 'ClientDesk',
      agencyLogo: agencyData?.logo_url || '',
      projects,
      invoices: invoicesRes.data || [],
      messages: messagesRes.data || [],
      files,
      loaded: true
    });
  }

  $effect(() => {
    const cStore = get(clientStore);
    const dataStore = get(clientDataStore);
    if (!authState.loading && cStore.client_id && !dataStore.loaded) {
      fetchClientData();
    }
  });

  export function reloadClientData() {
    clientDataStore.update(s => ({ ...s, loaded: false }));
    fetchClientData();
  }
</script>

{#if !$clientDataStore.loaded && $clientStore.client_id}
  <div class="min-h-screen flex items-center justify-center bg-surface-container-low">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
{:else}
  {@render children()}
{/if}
