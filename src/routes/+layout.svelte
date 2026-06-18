<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { initAuth, authState } from '$lib/auth.svelte';
	import { clientStore } from '$lib/clientStore';
	import { get } from 'svelte/store';
	import { agencyDataStore } from '../stores/agencyData';
	import { clientDataStore } from '../stores/clientData';
	import { supabase } from '$lib/supabaseClient';

	let { children } = $props();

	onMount(() => {
		initAuth();
	});

	$effect(() => {
		if (!authState.loading) {
			const path = $page.url.pathname;
			const isAuthRoute = path === '/login' || path === '/signup' || path === '/client/login';
			const isPortalRoute = path.startsWith('/client/') || path === '/client';
			const clientData = get(clientStore);
			
			if (!authState.user && !isAuthRoute) {
				goto(isPortalRoute ? '/client/login' : '/login');
			}
			
			if (authState.user) {
				if (clientData.client_id) {
					// Is Client User
					if (!isPortalRoute) goto('/client/dashboard');
					else if (path === '/client/login') goto('/client/dashboard');
				} else if (authState.agencyId) {
					// Is Agency User
					if (isPortalRoute && path !== '/client/login') goto('/');
					else if (isAuthRoute && path !== '/client/login') goto('/');

					// Fetch agency data if not loaded
					if (!get(agencyDataStore).loaded) {
						fetchAgencyData(authState.agencyId);
					}
				} else {
					// Unknown user type or pending setup
					if (isAuthRoute && path !== '/client/login') goto('/');
				}
			}
		}
	});

	async function fetchAgencyData(agencyId: string) {
		const [clientsRes, projectsRes, invoicesRes, tasksRes, messagesRes] = await Promise.all([
			supabase.from('clients').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
			supabase.from('projects').select('*, clients(full_name, avatar_url, company)').eq('agency_id', agencyId).order('created_at', { ascending: false }),
			supabase.from('invoices').select('*, clients(full_name, avatar_url)').eq('agency_id', agencyId).order('created_at', { ascending: false }),
			supabase.from('tasks').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
			supabase.from('messages').select('id, client_id, content, file_name, sender_type, is_read, created_at, clients(full_name, avatar_url, company)').eq('agency_id', agencyId).order('created_at', { ascending: true })
		]);

		const projects = projectsRes.data || [];
		const projectIds = projects.map(p => p.id);

		let allFiles: any[] = [];
		const { data: directFiles } = await supabase.from('files').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false });
		if (directFiles) allFiles = [...directFiles];

		if (projectIds.length > 0) {
			const { data: projectFiles } = await supabase.from('files').select('*').in('project_id', projectIds).order('created_at', { ascending: false });
			if (projectFiles) {
				const existingIds = new Set(allFiles.map(f => f.id));
				for (const pf of projectFiles) {
					if (!existingIds.has(pf.id)) allFiles.push(pf);
				}
			}
		}
		allFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

		agencyDataStore.set({
			clients: clientsRes.data || [],
			projects,
			invoices: invoicesRes.data || [],
			tasks: tasksRes.data || [],
			messages: messagesRes.data || [],
			files: allFiles,
			loaded: true
		});
	}

	let isReloading = $state(false);

	async function globalReload() {
		isReloading = true;
		
		const clientData = get(clientStore);
		if (clientData.client_id && clientData.agency_id) {
			clientDataStore.update(s => ({ ...s, loaded: false }));
			// The $effect in client layout will re-trigger, but we can also manually trigger here if we wanted
			// To keep it simple, we'll force window reload to re-run everything cleanly
			window.location.reload();
			return;
		}

		if (authState.agencyId) {
			agencyDataStore.update(s => ({ ...s, loaded: false }));
			await fetchAgencyData(authState.agencyId);
		}
		
		isReloading = false;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if authState.loading}
	<div class="min-h-screen flex items-center justify-center bg-surface-container-low">
		<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
	</div>
{:else}
	{@render children()}
{/if}

<button
	onclick={globalReload}
	disabled={isReloading}
	class="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-[#630ed4] hover:bg-[#520bb3] text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
	title="Reload all data"
>
	<span class="material-symbols-outlined text-2xl {isReloading ? 'animate-spin' : ''}">refresh</span>
</button>
