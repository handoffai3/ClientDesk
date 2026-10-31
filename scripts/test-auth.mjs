#!/usr/bin/env node
/**
 * Two-session auth test for file download + signed-url routes.
 *
 * Usage:
 *   node scripts/test-auth.mjs
 *
 * Required env (reads from ../.env by default):
 *   PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
 *
 * Optional env:
 *   APP_URL          – defaults to http://localhost:5173
 *   AGENCY_EMAIL     – defaults to melekithm@gmail.com
 *   AGENCY_PASSWORD  – you must supply this
 *   CLIENT_EMAIL     – defaults to handoffai3@gmail.com
 *   CLIENT_PASSWORD  – you must supply this
 *
 * What it tests (Final-App-Icons.zip, id 72dc63fd-…, is_locked=true):
 *   1. Client calls /api/files/{id}/download while file is locked  → 403
 *   2. Agency user calls download                                  → 200 + signed URL
 *   3. Unlock the file (sets unlocked_at = now())
 *   4. Client calls download again                                 → 200 + signed URL
 *   5. Verify the signed URL actually downloads (HEAD request)     → 200
 *   6. Re-lock the file for next run
 *
 * Deliverable (Home screen design, id 8e84ee1d-…):
 *   7. Client calls /api/files/signed-url for the deliverable image → 200
 *      (images are allowed even when their parent file is locked)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = resolve(__dirname, '..', '.env');
try {
  const envText = readFileSync(envPath, 'utf-8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* no .env, rely on environment */ }

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const ANON_KEY    = process.env.PUBLIC_SUPABASE_ANON_KEY;
const APP_URL     = process.env.APP_URL || 'http://localhost:5173';

const AGENCY_EMAIL    = process.env.AGENCY_EMAIL    || 'melekithm@gmail.com';
const AGENCY_PASSWORD = process.env.AGENCY_PASSWORD;
const CLIENT_EMAIL    = process.env.CLIENT_EMAIL    || 'handoffai3@gmail.com';
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD;

const FILE_ID        = '72dc63fd-a6cf-46c7-8eed-0288683a2b41'; // Final-App-Icons.zip, is_locked=true
const DELIVERABLE_URL = 'https://fqhmknjiqlqufhqgnwnn.supabase.co/storage/v1/object/public/ClientDeskBucket/deliverables/3060b4b4-f0d2-4a5e-ad2a-a7f08231f2b6/bluebird-home-v1.png';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}
if (!AGENCY_PASSWORD || !CLIENT_PASSWORD) {
  console.error('Set AGENCY_PASSWORD and CLIENT_PASSWORD env vars');
  process.exit(1);
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function callDownload(token, fileId) {
  const res = await fetch(`${APP_URL}/api/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
}

async function callSignedUrl(token, fileUrl) {
  const res = await fetch(`${APP_URL}/api/files/signed-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_url: fileUrl }),
  });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
}

// Use service role to toggle lock — only if SUPABASE_SERVICE_ROLE_KEY is set,
// otherwise print instructions.
async function setUnlock(unlock) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.log(`  ⚠  Set SUPABASE_SERVICE_ROLE_KEY to auto-toggle lock. Skipping lock toggle.`);
    return false;
  }
  const body = unlock
    ? { unlocked_at: new Date().toISOString() }
    : { unlocked_at: null };
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/files?id=eq.${FILE_ID}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    console.log(`  ⚠  Lock toggle failed: ${res.status}`);
    return false;
  }
  return true;
}

function check(label, actual, expected) {
  const pass = actual === expected;
  console.log(`  ${pass ? '✅' : '❌'} ${label}: ${actual} (expected ${expected})`);
  return pass;
}

async function main() {
  let allPass = true;

  console.log('Signing in...');
  const agencyToken = await signIn(AGENCY_EMAIL, AGENCY_PASSWORD);
  console.log(`  Agency user signed in (${AGENCY_EMAIL})`);
  const clientToken = await signIn(CLIENT_EMAIL, CLIENT_PASSWORD);
  console.log(`  Client user signed in (${CLIENT_EMAIL})\n`);

  // 1. Client downloads locked file → 403
  console.log('1. Client downloads locked file (Final-App-Icons.zip):');
  const r1 = await callDownload(clientToken, FILE_ID);
  allPass &= check('Locked file as client', r1.status, 403);

  // 2. Agency downloads same file → 200
  console.log('\n2. Agency downloads same file:');
  const r2 = await callDownload(agencyToken, FILE_ID);
  allPass &= check('Agency download', r2.status, 200);

  // 3. Unlock the file
  console.log('\n3. Unlocking file...');
  const unlocked = await setUnlock(true);

  if (unlocked) {
    // 4. Client downloads after unlock → 200
    console.log('\n4. Client downloads after unlock:');
    const r3 = await callDownload(clientToken, FILE_ID);
    allPass &= check('Unlocked file as client', r3.status, 200);

    // 5. Verify signed URL actually works
    if (r3.status === 200 && r3.body?.url) {
      console.log('\n5. HEAD request on signed URL:');
      const head = await fetch(r3.body.url, { method: 'HEAD' });
      allPass &= check('Signed URL downloads', head.status, 200);
    }

    // 6. Re-lock
    console.log('\n6. Re-locking file...');
    await setUnlock(false);
    console.log('  Done.');
  } else {
    console.log('  Skipping unlock/re-lock tests (no service key).');
  }

  // 7. Client gets signed URL for deliverable image (allowed even when locked)
  console.log('\n7. Client signed-url for deliverable image:');
  const r4 = await callSignedUrl(clientToken, DELIVERABLE_URL);
  allPass &= check('Deliverable image signed-url', r4.status, 200);

  console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
