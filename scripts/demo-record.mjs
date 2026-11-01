#!/usr/bin/env node
/**
 * ClientDesk end-to-end demo recorder — ALL REAL, no simulations.
 *
 * - Agency login: server-side token extraction (callback page is client-only)
 * - Client login: real PKCE magic-link via callback page
 * - Pin: real UI (pin mode → click → type → Add Pin)
 * - Approve: real UI (click Approve button) — also unlocks linked files
 * - File unlock: verified via DB and client files page (real approve-to-unlock flow)
 * - AI: real API call + real UI button click
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
const AGENCY_EMAIL = 'melekithm@gmail.com';
const CLIENT_EMAIL = 'handoffai3@gmail.com';

const PAUSE = 800;
const WAIT_NAV = 1200;

// ── Auth ──

async function realClientLogin(page) {
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'magiclink', email: CLIENT_EMAIL,
    options: { redirectTo: `${PROD_SITE}/client/auth/callback` },
  });
  if (error) throw new Error('Client magic link failed');
  await page.route('**/auth/v1/verify*', async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const location = response.headers()['location'] || '';
    if (location.includes(PROD_SITE)) {
      await route.fulfill({ status: 302, headers: { location: location.replace(PROD_SITE, SITE) } });
    } else { await route.fulfill({ response }); }
  });
  await page.goto(data.properties.action_link, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.unroute('**/auth/v1/verify*');
  if (page.url().includes(PROD_SITE)) {
    const sd = await page.evaluate(() => {
      const k = Object.keys(localStorage).filter(k => k.includes('auth'));
      return k.length ? { key: k[0], value: localStorage.getItem(k[0]) } : null;
    });
    if (sd) {
      await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), sd);
      await page.goto(SITE, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
    }
  }
  const ok = await page.evaluate(() => {
    const k = Object.keys(localStorage).filter(k => k.includes('auth'));
    try { return !!JSON.parse(localStorage.getItem(k[0]))?.access_token; } catch { return false; }
  });
  return ok;
}

async function agencyLogin(page) {
  const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: AGENCY_EMAIL });
  if (error) throw new Error('Agency magic link failed');
  const res = await fetch(data.properties.action_link, { redirect: 'manual' });
  const hash = (res.headers.get('location') || '').split('#')[1] || '';
  const p = new URLSearchParams(hash);
  const at = p.get('access_token'), rt = p.get('refresh_token');
  if (!at || !rt) throw new Error('Agency token extraction failed');
  const payload = JSON.parse(Buffer.from(at.split('.')[1], 'base64').toString());
  const host = new URL(SUPABASE_URL).hostname.split('.')[0];
  const key = `sb-${host}-auth-token`;
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(({ key, at, rt, uid, email }) => {
    localStorage.setItem(key, JSON.stringify({
      access_token: at, refresh_token: rt, token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now()/1000) + 3600,
      user: { id: uid, email, aud: 'authenticated', role: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
        created_at: new Date().toISOString() },
    }));
  }, { key, at, rt, uid: payload.sub, email: payload.email });
  await page.goto(SITE, { waitUntil: 'networkidle', timeout: 20000 });
  return { at };
}

// ── Helpers ──

function assert(label, actual, expected) {
  if (actual !== expected) throw new Error(`ASSERT: ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  console.log(`  ✅ ${label}: ${JSON.stringify(actual)}`);
}
function assertMatch(label, val, re) {
  if (!re.test(val)) throw new Error(`ASSERT: ${label}: "${val}" !~ ${re}`);
  console.log(`  ✅ ${label}`);
}

async function frame(page, name, desc) {
  const p = resolve(FRAMES, `${name}.png`);
  await page.screenshot({ path: p });
  console.log(`  📸 ${name}: ${desc}`);
}

function dur(f) {
  try { return parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${f}"`, { encoding: 'utf-8' }).trim()); }
  catch { return 0; }
}

const evidence = [];
async function step(name, fn) {
  console.log(`\n── ${name} ──`);
  try { await fn(); evidence.push(`✅ ${name}`); }
  catch (e) { evidence.push(`❌ ${name}: ${e.message}`); throw e; }
}

// ── Main ──

async function main() {
  console.log('=== Reset ===');
  execSync('node scripts/demo-reset.mjs', { cwd: ROOT, stdio: 'inherit' });
  const { data: d0 } = await sb.from('deliverables').select('status,version').eq('id', DELIVERABLE_ID).single();
  assert('deliverable pending v1', d0.status === 'pending' && d0.version === 1, true);
  const { data: f0 } = await sb.from('files').select('is_locked,unlock_type,unlock_deliverable_id,unlocked_at').eq('id', LOCKED_FILE_ID).single();
  assert('file locked (approval)', f0.is_locked === true && f0.unlock_type === 'approval' && f0.unlocked_at === null, true);
  assert('file linked to deliverable', f0.unlock_deliverable_id, DELIVERABLE_ID);

  const browser = await chromium.launch({ headless: true });
  const dCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: resolve(OUT, 'desktop-video'), size: { width: 1440, height: 900 } },
  });
  const desktop = await dCtx.newPage();
  const pCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    recordVideo: { dir: resolve(OUT, 'phone-video'), size: { width: 390, height: 844 } },
  });
  const phone = await pCtx.newPage();

  console.log('\n=== Auth ===');
  await agencyLogin(desktop);
  console.log('  ✅ Agency logged in');
  const clOk = await realClientLogin(phone);
  assert('Client PKCE login', clOk, true);

  // ── 1. Agency dashboard ──
  await step('1. Agency dashboard', async () => {
    await desktop.waitForTimeout(WAIT_NAV);
    const h = (await desktop.textContent('h1') || '').replace(/\s+/g, ' ').trim();
    assertMatch('greeting', h, /Good .* Dave/i);
    await desktop.waitForTimeout(PAUSE);
    await frame(desktop, '01-dashboard', 'Agency dashboard: stats, task board');
  });

  // ── 2. Upload v2 ──
  await step('2. Upload v2', async () => {
    await desktop.goto(`${SITE}/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await desktop.waitForTimeout(PAUSE);
    await desktop.locator('button:has-text("Deliverables")').first().click();
    await desktop.waitForTimeout(PAUSE);
    const fc = desktop.waitForEvent('filechooser');
    await desktop.locator('button[title="Upload new version"]').first().click();
    (await fc).setFiles(resolve(ROOT, 'scripts/demo-assets/bluebird-home-v2.png'));
    for (let i = 0; i < 12; i++) {
      await desktop.waitForTimeout(800);
      if (await desktop.locator('span:has-text("v2")').count() > 0) break;
    }
    assert('v2 badge', await desktop.locator('span:has-text("v2")').count() > 0, true);
    await desktop.waitForTimeout(PAUSE);
    await frame(desktop, '02-v2-uploaded', 'v2 badge on deliverable card');
  });

  // ── 3. Client pins (real UI) ──
  await step('3. Client pins feedback', async () => {
    await phone.goto(`${SITE}/client/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(PAUSE);
    await phone.locator('button:has-text("Deliverables")').first().click();
    await phone.waitForTimeout(PAUSE);
    await phone.locator('text=Home screen design').first().click();
    await phone.waitForTimeout(4000);

    await phone.locator('button[title="Enable pin mode"]').first().click({ force: true });
    await phone.waitForTimeout(300);

    const ca = await phone.locator('.canvas-area').first().boundingBox();
    await phone.locator('.canvas-area').first().click({ position: { x: ca.width / 2, y: ca.height / 3 }, force: true });
    await phone.waitForTimeout(1500);

    const tas = phone.locator('textarea');
    for (let i = (await tas.count()) - 1; i >= 0; i--) {
      if (await tas.nth(i).isVisible()) { await tas.nth(i).fill('Make the headline bigger and bolder'); break; }
    }
    await phone.waitForTimeout(300);

    const apbs = phone.locator('button:has-text("Add Pin")');
    for (let i = (await apbs.count()) - 1; i >= 0; i--) {
      if (await apbs.nth(i).isVisible()) { await apbs.nth(i).click(); break; }
    }
    await phone.waitForTimeout(3000);

    const { data: allDels } = await sb.from('deliverables').select('id').eq('project_id', PROJECT_ID);
    const { data: pins } = await sb.from('pins').select('id,content').in('deliverable_id', allDels.map(d => d.id));
    assert('pin count', pins.length, 1);
    assert('pin text', pins[0].content, 'Make the headline bigger and bolder');

    await phone.goto(`${SITE}/client/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(PAUSE);
    await phone.locator('button:has-text("Deliverables")').first().click();
    await phone.waitForTimeout(PAUSE);
    await phone.locator('text=Home screen design').first().click();
    await phone.waitForTimeout(4000);
    await frame(phone, '03-pin-placed', 'Pin #1 on design, feedback count badge');
  });

  // ── 4. Agency sees pin ──
  await step('4. Agency sees pin', async () => {
    await desktop.goto(`${SITE}/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await desktop.waitForTimeout(PAUSE);
    await desktop.locator('button:has-text("Deliverables")').first().click();
    await desktop.waitForTimeout(PAUSE);
    await desktop.locator('button:has-text("Review")').first().click();
    await desktop.waitForTimeout(3000);
    const fb = await desktop.locator('h3:has-text("Feedback")').first().textContent().catch(() => '');
    assertMatch('feedback(1)', fb, /1/);
    await desktop.waitForTimeout(PAUSE);
    await frame(desktop, '04-agency-pin', 'Agency proofing: pin in sidebar');
  });

  // ── 5. Locked file visible before approval ──
  await step('5. Locked file (before approval)', async () => {
    await phone.goto(`${SITE}/client/files`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(PAUSE);

    // Verify the file shows as locked with the deliverable name
    const lockText = await phone.locator('text=Approval required, text=/Unlocks.*approve/i').first().isVisible({ timeout: 3000 }).catch(() => false)
      || await phone.locator('span:has-text("Approval")').first().isVisible({ timeout: 2000 }).catch(() => false);
    assert('locked file visible', lockText, true);

    // Verify "Approve to unlock" button exists
    const approveBtn = await phone.locator('button:has-text("Approve to unlock")').first().isVisible({ timeout: 2000 }).catch(() => false);
    assert('approve-to-unlock button', approveBtn, true);

    // DB check: still locked
    const { data: f1 } = await sb.from('files').select('is_locked,unlocked_at').eq('id', LOCKED_FILE_ID).single();
    assert('file still locked in DB', f1.is_locked && !f1.unlocked_at, true);

    await frame(phone, '05-locked', 'Locked file: "Approve to unlock"');
  });

  // ── 6. Client approves → file unlocks (real UI) ──
  await step('6. Client approves → file unlocks', async () => {
    await phone.goto(`${SITE}/client/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(PAUSE);
    await phone.locator('button:has-text("Deliverables")').first().click();
    await phone.waitForTimeout(PAUSE);
    await phone.locator('text=Home screen design').first().click();
    await phone.waitForTimeout(4000);

    const abs = phone.locator('button:has-text("Approve")');
    for (let i = (await abs.count()) - 1; i >= 0; i--) {
      if (await abs.nth(i).isVisible()) { await abs.nth(i).click(); break; }
    }
    await phone.waitForTimeout(3000);

    // Verify deliverable approved
    const { data: dels } = await sb.from('deliverables').select('status,approved_at,version').eq('project_id', PROJECT_ID).order('version', { ascending: false });
    const approved = dels.find(d => d.status === 'approved');
    assert('deliverable approved', !!approved, true);
    console.log(`  v${approved.version} approved at ${approved.approved_at}`);

    // Verify file unlocked by the approve action
    const { data: f2 } = await sb.from('files').select('is_locked,unlocked_at,unlock_type,unlock_deliverable_id').eq('id', LOCKED_FILE_ID).single();
    assert('file unlocked_at set', f2.unlocked_at !== null, true);
    console.log(`  File unlocked at ${f2.unlocked_at}`);

    await frame(phone, '06-approved', 'APPROVED badge, file now unlocked');
  });

  // ── 7. Unlocked file downloadable ──
  await step('7. File download available', async () => {
    await phone.goto(`${SITE}/client/files`, { waitUntil: 'networkidle', timeout: 15000 });
    await phone.waitForTimeout(PAUSE);

    const dlBtn = await phone.locator('button:has-text("Download")').count();
    assert('download buttons visible', dlBtn >= 2, true);

    await frame(phone, '07-unlocked', 'File unlocked: Download button');
  });

  // ── 8. AI Summarize ──
  await step('8. AI Summarize', async () => {
    await desktop.goto(`${SITE}/projects/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
    await desktop.waitForTimeout(PAUSE);
    await desktop.locator('button:has-text("Deliverables")').first().click();
    await desktop.waitForTimeout(PAUSE);
    await desktop.locator('button:has-text("Review")').first().click();
    await desktop.waitForTimeout(3000);

    const aiBtn = desktop.locator('button[title="AI Summarize Feedback"]').first();
    assert('AI button visible', await aiBtn.isVisible({ timeout: 3000 }), true);
    await aiBtn.click();
    console.log('  Clicked AI Summarize — waiting for response...');

    for (let i = 0; i < 20; i++) {
      await desktop.waitForTimeout(1000);
      if (await desktop.locator('text=AI Summary').first().isVisible().catch(() => false)) break;
    }
    const summaryVis = await desktop.locator('text=AI Summary').first().isVisible().catch(() => false);
    assert('AI summary visible', summaryVis, true);
    await desktop.waitForTimeout(PAUSE);
    await frame(desktop, '08-ai-summary', 'AI Summary in feedback panel');
  });

  // ── Save videos ──
  console.log('\n=== Videos ===');
  const dPage = desktop, pPage = phone;
  await dCtx.close(); await pCtx.close();
  const dRaw = resolve(OUT, 'desktop-raw.webm'), pRaw = resolve(OUT, 'phone-raw.webm');
  const dVid = await dPage.video()?.path(), pVid = await pPage.video()?.path();
  if (dVid && existsSync(dVid)) cpSync(dVid, dRaw);
  if (pVid && existsSync(pVid)) cpSync(pVid, pRaw);
  await browser.close();
  const dDur = dur(dRaw), pDur = dur(pRaw);
  console.log(`  Desktop: ${dDur.toFixed(1)}s  Phone: ${pDur.toFixed(1)}s`);

  // ── Post-production ──
  console.log('\n=== Export ===');
  const demo = resolve(OUT, 'demo.mp4');
  try {
    execSync(`ffmpeg -y -i "${dRaw}" -i "${pRaw}" -filter_complex ` +
      `"[0:v]scale=1280:900:force_original_aspect_ratio=decrease,pad=1280:1080:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e[d];` +
      `[1:v]scale=320:693:force_original_aspect_ratio=decrease,pad=640:1080:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e[m];` +
      `[d][m]hstack=inputs=2[out]" -map "[out]" -c:v libx264 -preset medium -b:v 2500k -maxrate 3000k -bufsize 5000k ` +
      `-pix_fmt yuv420p -movflags +faststart "${demo}"`,
      { cwd: ROOT, stdio: 'pipe', timeout: 180000 });
    console.log('  ✅ demo.mp4');
  } catch {
    execSync(`ffmpeg -y -i "${dRaw}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e" ` +
      `-c:v libx264 -preset medium -b:v 2500k -pix_fmt yuv420p "${demo}"`,
      { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    console.log('  ✅ demo.mp4 (desktop-only)');
  }

  const vert = resolve(OUT, 'demo-vertical.mp4');
  try {
    execSync(`ffmpeg -y -i "${pRaw}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e" ` +
      `-c:v libx264 -preset medium -b:v 2500k -maxrate 3000k -bufsize 5000k -pix_fmt yuv420p -movflags +faststart "${vert}"`,
      { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    console.log('  ✅ demo-vertical.mp4');
  } catch (e) { console.log(`  ⚠ Vertical: ${e.message?.substring(0,80)}`); }

  // ── Report ──
  console.log('\n' + '='.repeat(60) + '\nFILES');
  for (const f of ['demo.mp4','demo-vertical.mp4']) {
    const p = resolve(OUT, f);
    if (existsSync(p)) {
      const d = dur(p), mb = (statSync(p).size/1048576).toFixed(2);
      const kbps = d > 0 ? ((statSync(p).size * 8)/(d*1000)).toFixed(0) : '?';
      console.log(`  ${f}: ${mb} MB · ${d.toFixed(1)}s · ${kbps} kbps`);
    } else console.log(`  ${f}: MISSING`);
  }

  console.log('\nFRAMES');
  const descs = {
    '01-dashboard':'Agency dashboard: stat cards, task board',
    '02-v2-uploaded':'v2 badge on deliverable card',
    '03-pin-placed':'Pin #1 on design with feedback count',
    '04-agency-pin':'Agency proofing: pin in sidebar',
    '05-locked':'Locked file: Approve to unlock',
    '06-approved':'APPROVED badge, file now unlocked',
    '07-unlocked':'File unlocked: Download button',
    '08-ai-summary':'AI Summary in feedback panel',
  };
  for (const [n,d] of Object.entries(descs)) {
    const ex = existsSync(resolve(FRAMES, `${n}.png`));
    console.log(`  ${ex ? '✅' : '❌'} ${n}.png — ${d}`);
  }

  console.log('\nSTEPS');
  for (const e of evidence) console.log(`  ${e}`);
  const failed = evidence.filter(e => e.startsWith('❌')).length;
  console.log(`\n${evidence.length - failed}/8 passed, ${failed} failed`);

  console.log('\n=== Final Reset ===');
  execSync('node scripts/demo-reset.mjs', { cwd: ROOT, stdio: 'inherit' });
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
