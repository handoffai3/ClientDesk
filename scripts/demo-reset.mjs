#!/usr/bin/env node
/**
 * Reset demo data to a clean starting state (idempotent).
 * - Deliverable "Home screen design" at v1, status pending, no pins/replies
 * - Final-App-Icons.zip locked (unlock_type=approval, linked to Home screen design deliverable)
 * - INV-1001 status 'sent', not paid
 * - Remove any v2+ deliverables
 * - Demo copy restored (no pin/approval claims that contradict the reset state)
 * - Demo agency's ai_usage rows deleted so the AI quota starts fresh
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname, '..', '.env');
const env = {};
try {
  readFileSync(envPath, 'utf-8').split('\n').forEach(l => {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m) env[m[1]] = m[2];
  });
} catch {}

const SUPABASE_URL = env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function api(path, opts = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=minimal',
      ...(opts.headers || {}),
    },
  });
}

const DELIVERABLE_ID = '8e84ee1d-7533-46a0-9b6f-5924fcdf641e';
const FILE_ID = '72dc63fd-a6cf-46c7-8eed-0288683a2b41';
const INVOICE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PROJECT_ID = 'd31a0694-4ada-41f5-a7e7-c4827bd4cb1b';
const AGENCY_ID = '3060b4b4-f0d2-4a5e-ad2a-a7f08231f2b6';

const DEMO_MESSAGES = [
  ['0992d134-131e-42bc-95db-07e4e3d540c0', "First round of the home screen is up for review in the proofing canvas. Let us know what you'd like changed!"],
  ['151e1ec5-866f-4ecf-b683-60f9895d5cb5', 'Love the direction! Can we try a darker accent on the CTA button?'],
];
const DEMO_TIMELINE = [
  ['815dbc72-65eb-4482-a714-2bad15d4b48e', 'Wireframes and user-flow diagrams reviewed with Sarah.'],
  ['5f43b026-642d-4534-b549-65d9c45542eb', 'High-fidelity screens in progress — home and tracking views drafted.'],
];

async function main() {
  console.log('Resetting demo data...');

  // Delete all pins and replies (cascade handles replies)
  let r;
  r = await api(`/rest/v1/pin_replies`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  // pin_replies doesn't have a simple wildcard delete, use a broad filter
  r = await api(`/rest/v1/pin_replies?id=not.is.null`, { method: 'DELETE' });
  console.log('  Deleted pin_replies:', r.status);

  r = await api(`/rest/v1/pins?id=not.is.null`, { method: 'DELETE' });
  console.log('  Deleted pins:', r.status);

  // Remove any deliverables other than the original v1
  r = await api(`/rest/v1/deliverables?id=neq.${DELIVERABLE_ID}&project_id=eq.${PROJECT_ID}`, { method: 'DELETE' });
  console.log('  Removed extra deliverables:', r.status);

  // Reset the v1 deliverable
  r = await api(`/rest/v1/deliverables?id=eq.${DELIVERABLE_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'pending',
      version: 1,
      approved_at: null,
      approved_by: null,
    }),
  });
  console.log('  Reset deliverable to v1/pending:', r.status);

  // Re-lock Final-App-Icons.zip: approval-based, linked to the Home screen design deliverable
  r = await api(`/rest/v1/files?id=eq.${FILE_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({
      is_locked: true,
      unlocked_at: null,
      unlock_type: 'approval',
      unlock_deliverable_id: DELIVERABLE_ID,
      unlock_invoice_id: null,
    }),
  });
  console.log('  Re-locked Final-App-Icons.zip (approval-based):', r.status);

  // Reset invoice to 'sent' (no locked file linked to it any more)
  r = await api(`/rest/v1/invoices?id=eq.${INVOICE_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'sent',
      paid_at: null,
      stripe_session_id: null,
    }),
  });
  console.log('  Reset INV-1001 to sent:', r.status);

  // Delete any test messages
  r = await api(`/rest/v1/messages?content=eq.test-demo-cleanup`, { method: 'DELETE' });

  // Restore demo copy
  for (const [id, content] of DEMO_MESSAGES) {
    r = await api(`/rest/v1/messages?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ content }) });
    console.log(`  Restored message ${id.slice(0, 8)}:`, r.status);
  }
  for (const [id, content] of DEMO_TIMELINE) {
    r = await api(`/rest/v1/timeline_updates?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ content }) });
    console.log(`  Restored timeline ${id.slice(0, 8)}:`, r.status);
  }
  r = await api(`/rest/v1/milestones?project_id=eq.${PROJECT_ID}&title=eq.Design%20sign-off`, {
    method: 'PATCH',
    body: JSON.stringify({ description: 'Client signs off on all screens' }),
  });
  console.log('  Restored milestone "Design sign-off":', r.status);

  // Fresh AI quota for the demo agency
  r = await api(`/rest/v1/ai_usage?agency_id=eq.${AGENCY_ID}`, { method: 'DELETE' });
  console.log('  Cleared ai_usage:', r.status);

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
