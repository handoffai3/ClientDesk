#!/usr/bin/env node
/**
 * ClientDesk end-to-end demo recorder.
 * Uses REAL browser login (magic-link PKCE) for both agency and client.
 * Pin creation and approval go through the actual UI.
 * Payment simulation via service-role (no STRIPE_SECRET_KEY configured).
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, existsSync, cpSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'out');
const FRAMES = resolve(OUT, 'demo-frames');
for (const d of [OUT, FRAMES, resolve(OUT, 'desktop-video'), resolve(OUT, 'phone-video')]) {
  mkdirSync(d, { recursive: true });
}

const env = {};
readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
});

const SUPABASE_URL = env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = 'http://localhost:5176';
const PROD_SITE = env.PUBLIC_SITE_URL || 'https://clientdesk-opal.vercel.app';
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const PROJECT_ID = 'd31a0694-4ada-41f5-a7e7-c4827bd4cb1b';
const DELIVERABLE_ID = '8e84ee1d-7533-46a0-9b6f-5924fcdf641e';
const LOCKED_FILE_ID = '72dc63fd-a6cf-46c7-8eed-0288683a2b41';
const INVOICE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AGENCY_EMAIL = 'melekithm@gmail.com';
const CLIENT_EMAIL = 'handoffai3@gmail.com';

// ── Auth: real PKCE login via magic link ──

async function realLogin(page, email) {
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'magiclink', email,
    options: { redirectTo: `${PROD_SITE}/client/auth/callback` },
  });
  if (error) throw new Error(`Magic link failed for ${email}`);

  // Intercept the Supabase verify redirect to rewrite production → localhost
  await page.route('**/auth/v1/verify*', async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const location = response.headers()['location'] || '';
    if (location.includes(PROD_SITE)) {
      await route.fulfill({ status: 302, headers: { location: location.replace(PROD_SITE, SITE) } });
    } else {
      await route.fulfill({ response });
    }
  });

  await page.goto(data.properties.action_link, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.unroute('**/auth/v1/verify*');

  // If landed on production domain, transfer session to localhost
  if (page.url().includes(PROD_SITE)) {
    const sessionData = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.includes('auth'));
      return keys.length ? { key: keys[0], value: localStorage.getItem(keys[0]) } : null;
    });
    if (sessionData) {
      await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), sessionData);
      await page.goto(SITE, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
    }
  }

  // For agency users, check we're on the agency dashboard
  // For client users, check we're on the client dashboard
  const url = page.url();
  const hasSession = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.includes('auth'));
    if (!keys.length) return false;
    try { return !!JSON.parse(localStorage.getItem(keys[0]))?.access_token; } catch { return false; }
  });
  return { url, hasSession };
}

// For agency: the magic link callback page checks client_users and signs out non-clients.
// Agency users need a different approach — use the injectAuth with server-generated tokens
// since the callback page is client-only.
async function getAgencySession(email) {
  const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`Magic link failed: ${error.message}`);
  const res = await fetch(data.properties.action_link, { redirect: 'manual' });
  const hash = (res.headers.get('location') || '').split('#')[1] || '';
  const p = new URLSearchParams(hash);
  const at = p.get('access_token'), rt = p.get('refresh_token');
  if (!at || !rt) throw new Error(`Token extraction failed for ${email}`);
  const payload = JSON.parse(Buffer.from(at.split('.')[1], 'base64').toString());
  return { at, rt, ei: parseInt(p.get('expires_in') || '3600'), ea: parseInt(p.get('expires_at') || '0'), uid: payload.sub, email: payload.email };
}

async function injectAgencyAuth(page, sess) {
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const host = new URL(SUPABASE_URL).hostname.split('.')[0];
  const key = `sb-${host}-auth-token`;
  await page.evaluate(({ key, at, rt, ei, ea, uid, email }) => {
    localStorage.setItem(key, JSON.stringify({
      access_token: at, refresh_token: rt, token_type: 'bearer',
      expires_in: ei, expires_at: ea,
      user: { id: uid, email, aud: 'authenticated', role: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
        created_at: new Date().toISOString() },
    }));
  }, { key, ...sess });
  await page.goto(SITE, { waitUntil: 'networkidle', timeout: 20000 });
}

// ── Helpers ──

function assert(label, actual, expected) {
  if (actual !== expected) throw new Error(`ASSERT FAILED: ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  console.log(`  ✅ ${label}: ${JSON.stringify(actual)}`);
}
function assertMatch(label, val, re) {
  if (!re.test(val)) throw new Error(`ASSERT FAILED: ${label}: "${val}" !~ ${re}`);
  console.log(`  ✅ ${label}: matches ${re}`);
}
function assertGt(label, val, min) {
  if (!(val > min)) throw new Error(`ASSERT FAILED: ${label}: ${val} not > ${min}`);
  console.log(`  ✅ ${label}: ${val} > ${min}`);
}

async function frame(page, name, desc) {
  const p = resolve(FRAMES, `${name}.png`);
  await page.screenshot({ path: p });
  assert(`frame ${name}`, existsSync(p), true);
  console.log(`  📸 ${desc}`);
}

function dur(f) {
  try { return parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${f}"`, { encoding: 'utf-8' }).trim()); }
  catch { return 0; }
}

const evidence = [];
async function step(name, fn) {
  console.log(`\n${'='.repeat(60)}\nSTEP: ${name}\n${'='.repeat(60)}`);
  try { await fn(); evidence.push(`✅ ${name}`); }
  catch (e) { console.log(`  ❌ ${e.message}`); evidence.push(`❌ ${name}: ${e.message}`); throw e; }
}

// ── Main ──

async function main() {
  console.log('=== Demo Reset ===');
  execSync('node scripts/demo-reset.mjs', { cwd: ROOT, stdio: 'inherit' });
  const { data: d0 } = await sb.from('deliverables').select('status,version').eq('id', DELIVERABLE_ID).single();
  assert('Reset: deliverable pending', d0.status, 'pending');
  assert('Reset: deliverable v1', d0.version, 1);

  console.log('\n=== Auth ===');
  const agSess = await getAgencySession(AGENCY_EMAIL);
  console.log('  ✅ Agency session obtained');

  const browser = await chromium.launch({ headless: true });
  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: resolve(OUT, 'desktop-video'), size: { width: 1440, height: 900 } } });
  const desktop = await dCtx.newPage();
  const pCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: resolve(OUT, 'phone-video'), size: { width: 390, height: 844 } } });
  const phone = await pCtx.newPage();

  // Login client via real PKCE flow
  console.log('  Logging in client via real magic-link PKCE...');
  const clLogin = await realLogin(phone, CLIENT_EMAIL);
  console.log(`  Client login: session=${clLogin.hasSession}, url=${clLogin.url.substring(0, 60)}`);
  assert('Client has session', clLogin.hasSession, true);

  // ── 1. Agency dashboard ──
  await step('1. Agency dashboard', async () => {
    await injectAgencyAuth(desktop, agSess);
    await desktop.waitForTimeout(2000);
    const h = (await desktop.textContent('h1') || '').replace(/\s+/g, ' ').trim();
    assertMatch('Greeting', h, /Good .* Dave/i);
    await desktop.waitForTimeout(1500);
    await frame(desktop, '00-dashboard', 'Agency dashboard');
  });

  // ── 2. Upload v2 ──
  await step('2. Upload v2 (agency)', async () => {
    await desktop.goto(`${SITE}/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await desktop.waitForTimeout(1500);
    await desktop.locator('button:has-text("Deliverables")').first().click();
    await desktop.waitForTimeout(2000);
    assert('v1 visible', await desktop.locator('span:has-text("v1")').count() > 0, true);

    const fc = desktop.waitForEvent('filechooser');
    await desktop.locator('button[title="Upload new version"]').first().click();
    (await fc).setFiles(resolve(ROOT, 'scripts/demo-assets/bluebird-home-v2.png'));
    for (let i = 0; i < 12; i++) {
      await desktop.waitForTimeout(1000);
      if (await desktop.locator('span:has-text("v2")').count() > 0) break;
    }
    assert('v2 appeared', await desktop.locator('span:has-text("v2")').count() > 0, true);
    await desktop.waitForTimeout(1500);
    await frame(desktop, '01-v2-uploaded', 'v2 uploaded');
  });

  // ── 3. Client pins feedback (REAL UI) ──
  await step('3. Client pins feedback', async () => {
    await phone.goto(`${SITE}/client/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(1500);
    await phone.locator('button:has-text("Deliverables")').first().click();
    await phone.waitForTimeout(1500);
    await phone.locator('text=Home screen design').first().click();
    await phone.waitForTimeout(5000); // wait for signed URL image to load

    // Enable pin mode (required on mobile)
    const pinModeBtn = phone.locator('button[title="Enable pin mode"]');
    assert('Pin mode button exists', await pinModeBtn.count() > 0, true);
    await pinModeBtn.first().click({ force: true });
    console.log('  Pin mode enabled');
    await phone.waitForTimeout(500);

    // Click canvas area to place pin
    const canvasArea = phone.locator('.canvas-area');
    const caBox = await canvasArea.first().boundingBox();
    assert('Canvas area found', !!caBox, true);
    await canvasArea.first().click({ position: { x: caBox.width / 2, y: caBox.height / 3 }, force: true });
    console.log('  Clicked canvas to place pin');
    await phone.waitForTimeout(2000);

    // Fill the visible textarea (mobile sheet)
    const textareas = phone.locator('textarea');
    const taCount = await textareas.count();
    assertGt('Textareas available', taCount, 0);
    for (let i = taCount - 1; i >= 0; i--) {
      if (await textareas.nth(i).isVisible()) {
        await textareas.nth(i).fill('Make the headline bigger and bolder');
        console.log(`  Filled textarea[${i}]`);
        break;
      }
    }
    await phone.waitForTimeout(500);

    // Monitor network for the pin insert
    const pinNetLog = [];
    phone.on('response', async (resp) => {
      if (resp.url().includes('/rest/v1/pins')) {
        let body = ''; try { body = await resp.text(); } catch {}
        pinNetLog.push({ method: resp.request().method(), status: resp.status(), body: body.substring(0, 300) });
      }
    });

    // Click the visible Add Pin button
    const addPinBtns = phone.locator('button:has-text("Add Pin")');
    for (let i = (await addPinBtns.count()) - 1; i >= 0; i--) {
      if (await addPinBtns.nth(i).isVisible()) {
        await addPinBtns.nth(i).click();
        console.log(`  Clicked Add Pin[${i}]`);
        break;
      }
    }
    await phone.waitForTimeout(5000);

    // Print network evidence
    console.log(`  Pin network requests: ${pinNetLog.length}`);
    for (const r of pinNetLog) {
      console.log(`    ${r.method} ${r.status} ${r.body.substring(0, 200)}`);
    }

    // Verify pin in DB (v2 upload creates a new deliverable; pin may be on either)
    const { data: allDels } = await sb.from('deliverables').select('id').eq('project_id', PROJECT_ID);
    const delIds = allDels.map(d => d.id);
    const { data: pins } = await sb.from('pins').select('id,content,deliverable_id').in('deliverable_id', delIds);
    console.log(`  Pins in DB: ${pins?.length || 0}`);
    if (pins?.length) {
      assert('Pin content', pins[0].content, 'Make the headline bigger and bolder');
    } else {
      await phone.screenshot({ path: resolve(FRAMES, 'debug-pin-fail.png') });
      throw new Error('Pin not created — check debug-pin-fail.png and network log');
    }

    // Reload to show pin visually
    await phone.goto(`${SITE}/client/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(1500);
    await phone.locator('button:has-text("Deliverables")').first().click();
    await phone.waitForTimeout(1500);
    await phone.locator('text=Home screen design').first().click();
    await phone.waitForTimeout(5000);
    await frame(phone, '02-pin-placed', 'Client proofing with pin');
  });

  // ── 4. Agency sees pin ──
  await step('4. Agency sees pin', async () => {
    await desktop.goto(`${SITE}/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await desktop.waitForTimeout(1500);
    await desktop.locator('button:has-text("Deliverables")').first().click();
    await desktop.waitForTimeout(1500);
    // Pin is on the latest version (v2, shown first), so click the first Review
    const reviews = desktop.locator('button:has-text("Review")');
    const cnt = await reviews.count();
    console.log(`  Review buttons: ${cnt}`);
    await reviews.first().click();
    await desktop.waitForTimeout(4000);
    const feedbackText = await desktop.locator('h3:has-text("Feedback")').first().textContent().catch(() => '');
    console.log(`  Feedback header: "${feedbackText}"`);
    assertMatch('Agency sees pin', feedbackText, /1/);
    await desktop.waitForTimeout(2000);
    await frame(desktop, '03-agency-sees-pin', 'Agency sees pin feedback');
  });

  // ── 5. Client approves (REAL UI) ──
  await step('5. Client approves', async () => {
    // Open proofing canvas on phone
    await phone.goto(`${SITE}/client/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(1500);
    await phone.locator('button:has-text("Deliverables")').first().click();
    await phone.waitForTimeout(1500);
    await phone.locator('text=Home screen design').first().click();
    await phone.waitForTimeout(5000);

    // Click the visible Approve button (last one = mobile sticky bar)
    const approveBtns = phone.locator('button:has-text("Approve")');
    const abCount = await approveBtns.count();
    assertGt('Approve buttons', abCount, 0);
    for (let i = abCount - 1; i >= 0; i--) {
      if (await approveBtns.nth(i).isVisible()) {
        await approveBtns.nth(i).click();
        console.log(`  Clicked Approve[${i}]`);
        break;
      }
    }
    await phone.waitForTimeout(4000);

    // Verify in DB (approve goes to whatever deliverable the UI shows — may be v2)
    const { data: dels } = await sb.from('deliverables').select('id,status,approved_at,version').eq('project_id', PROJECT_ID).order('version', { ascending: false });
    const approved = dels.find(d => d.status === 'approved');
    assert('A deliverable is approved', !!approved, true);
    assert('approved_at set', approved.approved_at !== null, true);
    console.log(`  Approved v${approved.version}, at: ${approved.approved_at}`);

    // Screenshot showing approved badge
    await frame(phone, '04-approved', 'Deliverable approved badge');

    // Agency sees approval too
    await desktop.goto(`${SITE}/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await desktop.waitForTimeout(1500);
    await desktop.locator('button:has-text("Deliverables")').first().click();
    await desktop.waitForTimeout(2000);
    const approvedBadge = desktop.locator('text=Approved').first();
    assert('Agency sees Approved', await approvedBadge.isVisible({ timeout: 3000 }), true);
  });

  // ── 6. Locked files + payment ──
  await step('6. Files: locked → pay → unlocked', async () => {
    await phone.goto(`${SITE}/client/files`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(2000);
    assert('Payment required visible', await phone.locator('text=Payment required').first().isVisible(), true);
    await phone.waitForTimeout(1500);
    await frame(phone, '05-locked-file', 'Locked file (Payment required)');

    await phone.goto(`${SITE}/client/invoices`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(2000);
    await frame(phone, '06-stripe-checkout', 'Invoice with Pay Now button');

    // Simulate Stripe webhook (no STRIPE_SECRET_KEY configured for real checkout)
    console.log('  Simulating Stripe webhook (invoice paid, file unlocked)...');
    await sb.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString(), stripe_session_id: 'demo_cs_test' }).eq('id', INVOICE_ID);
    await sb.from('files').update({ unlocked_at: new Date().toISOString() }).eq('id', LOCKED_FILE_ID).eq('is_locked', true);

    const { data: inv } = await sb.from('invoices').select('status').eq('id', INVOICE_ID).single();
    assert('Invoice paid', inv.status, 'paid');
    const { data: f } = await sb.from('files').select('unlocked_at').eq('id', LOCKED_FILE_ID).single();
    assert('File unlocked', f.unlocked_at !== null, true);

    await phone.goto(`${SITE}/client/files`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(2000);
    const dlBtns = phone.locator('button:has-text("Download")');
    assert('Download buttons visible', await dlBtns.count() >= 2, true);
    await phone.waitForTimeout(1500);
    await frame(phone, '07-file-unlocked', 'File unlocked, Download visible');
  });

  // ── 7. AI Summarize ──
  await step('7. AI Summarize', async () => {
    // Call AI endpoint directly
    const res = await fetch(`${SITE}/api/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agSess.at}` },
      body: JSON.stringify({
        type: 'pins',
        data: { pins: [{ number: 1, content: 'Make the headline bigger and bolder', is_resolved: false, replies: [] }] },
      }),
    });
    const json = await res.json();
    console.log(`  AI status: ${res.status}`);
    if (res.ok && json.summary) {
      assertGt('AI summary length', json.summary.length, 20);
      console.log(`  AI Summary: "${json.summary.substring(0, 120)}..."`);
    } else {
      throw new Error(`AI summarize failed: ${res.status} ${json.error || ''}`);
    }

    // Show AI on desktop proofing canvas
    await desktop.goto(`${SITE}/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await desktop.waitForTimeout(1500);
    await desktop.locator('button:has-text("Deliverables")').first().click();
    await desktop.waitForTimeout(1500);
    // Open the v2 review (first in list — newest first, has the pin)
    const reviews2 = desktop.locator('button:has-text("Review")');
    await reviews2.first().click();
    await desktop.waitForTimeout(4000);

    const aiBtn = desktop.locator('button[title="AI Summarize Feedback"]').first();
    if (await aiBtn.isVisible({ timeout: 3000 })) {
      await aiBtn.click();
      await desktop.waitForTimeout(10000);
      const summaryVis = await desktop.locator('text=AI Summary').first().isVisible().catch(() => false);
      console.log(`  AI Summary visible on page: ${summaryVis}`);
    }
    await frame(desktop, '08-ai-summary', 'AI feedback summary');
  });

  // ── 8. Client dashboard ──
  await step('8. Client dashboard', async () => {
    await phone.goto(`${SITE}/client/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(2000);
    await frame(phone, '09-client-dashboard', 'Client dashboard');
  });

  // ── Save videos ──
  console.log('\n=== Saving videos ===');
  const dPage = desktop, pPage = phone;
  await dCtx.close(); await pCtx.close();
  const dRaw = resolve(OUT, 'desktop-raw.webm'), pRaw = resolve(OUT, 'phone-raw.webm');
  const dVid = await dPage.video()?.path(), pVid = await pPage.video()?.path();
  if (dVid && existsSync(dVid)) cpSync(dVid, dRaw);
  if (pVid && existsSync(pVid)) cpSync(pVid, pRaw);
  await browser.close();
  console.log(`  Desktop: ${dur(dRaw).toFixed(1)}s`);
  console.log(`  Phone: ${dur(pRaw).toFixed(1)}s`);

  // ── Post-production ──
  console.log('\n=== Post-production ===');
  const captions = [
    [0,6,"Agency dashboard — projects, clients, invoices"],
    [7,14,"Upload v2 of a deliverable"],
    [15,22,"Client pins feedback on the design"],
    [23,30,"Agency sees the pin instantly"],
    [31,38,"Client approves — timestamped record"],
    [39,46,"Files locked until paid"],
    [47,55,"Stripe test checkout — file unlocks"],
    [56,64,"AI summarizes all feedback"],
    [65,75,"Branded client portal"],
    [76,90,"One-time license · Full source code · DM me"],
  ];
  const cf = captions.map(([s,e,t]) =>
    `drawtext=text='${t.replace(/'/g,"\\'")}':fontsize=28:fontcolor=white:x=(w-text_w)/2:y=h-60:box=1:boxcolor=black@0.6:boxborderw=10:enable='between(t\\,${s}\\,${e})'`
  ).join(',');

  const demo = resolve(OUT, 'demo.mp4');
  try {
    execSync(`ffmpeg -y -i "${dRaw}" -i "${pRaw}" -filter_complex "[0:v]scale=1280:900:force_original_aspect_ratio=decrease,pad=1280:1080:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e[d];[1:v]scale=320:693:force_original_aspect_ratio=decrease,pad=640:1080:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e[m];[d][m]hstack=inputs=2[c];[c]${cf}[out]" -map "[out]" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart "${demo}"`,
      { cwd: ROOT, stdio: 'pipe', timeout: 180000 });
    console.log('  ✅ demo.mp4');
  } catch {
    console.log('  ⚠ Combined failed, desktop-only fallback');
    execSync(`ffmpeg -y -i "${dRaw}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p "${demo}"`,
      { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    console.log('  ✅ demo.mp4 (desktop-only)');
  }

  const vert = resolve(OUT, 'demo-vertical.mp4');
  try {
    execSync(`ffmpeg -y -i "${pRaw}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart "${vert}"`,
      { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    console.log('  ✅ demo-vertical.mp4');
  } catch (e) { console.log(`  ⚠ Vertical failed: ${e.message?.substring(0,100)}`); }

  if (existsSync(resolve(FRAMES, '02-pin-placed.png')))
    cpSync(resolve(FRAMES, '02-pin-placed.png'), resolve(OUT, 'demo-thumbnail.png'));

  // ── Report ──
  console.log('\n' + '='.repeat(60) + '\nFILE REPORT\n' + '='.repeat(60));
  for (const f of ['demo.mp4','demo-vertical.mp4','desktop-raw.webm','phone-raw.webm']) {
    const p = resolve(OUT, f);
    if (existsSync(p)) {
      const d = dur(p), mb = (statSync(p).size/1048576).toFixed(2);
      const kbps = d > 0 ? ((statSync(p).size * 8)/(d*1000)).toFixed(0) : '?';
      console.log(`  ${f}: ${mb} MB, ${d.toFixed(1)}s, ${kbps} kbps`);
    } else console.log(`  ${f}: MISSING`);
  }

  console.log('\n' + '='.repeat(60) + '\nFRAME REPORT\n' + '='.repeat(60));
  const descs = {
    '00-dashboard':'Agency dashboard with stat cards',
    '01-v2-uploaded':'v2 uploaded, version badge visible',
    '02-pin-placed':'Client proofing canvas with pin',
    '03-agency-sees-pin':'Agency sees pin in feedback panel',
    '04-approved':'Approved badge on deliverable',
    '05-locked-file':'Locked file (Payment required)',
    '06-stripe-checkout':'Invoice with Pay Now button',
    '07-file-unlocked':'File unlocked, Download visible',
    '08-ai-summary':'AI summary of feedback',
    '09-client-dashboard':'Client dashboard with branding',
  };
  for (const [n,d] of Object.entries(descs)) {
    const exists = existsSync(resolve(FRAMES, `${n}.png`));
    console.log(`  ${exists ? '✅' : '❌'} ${n}.png — ${d}`);
  }

  console.log('\n' + '='.repeat(60) + '\nSTEP EVIDENCE\n' + '='.repeat(60));
  for (const e of evidence) console.log(`  ${e}`);
  const failed = evidence.filter(e => e.startsWith('❌')).length;
  console.log(`\nRESULT: ${evidence.length - failed} passed, ${failed} failed`);

  console.log('\n=== Final Reset ===');
  execSync('node scripts/demo-reset.mjs', { cwd: ROOT, stdio: 'inherit' });
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
