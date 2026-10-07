// login.js — Auto-login to the iClicker student portal with Chromium and
// capture the API bearer token. Credentials come from .env (never committed).
//
//   node login.js            # headless by default
//   HEADED=1 node login.js   # watch the browser do it
//
// On success it writes auth.json with the bearer token, userId, and cookies.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
const OUT = path.join(__dirname, 'auth.json');

// --- tiny .env loader (no dependency) ---
function loadEnv() {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

function decodeJwtSub(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    return { userId: payload.userId, email: payload.user_name, exp: payload.exp };
  } catch { return {}; }
}

(async () => {
  loadEnv();
  const email = process.env.ICLICKER_EMAIL;
  const password = process.env.ICLICKER_PASSWORD;
  if (!email || !password) {
    console.error('✗ Missing ICLICKER_EMAIL / ICLICKER_PASSWORD. Copy .env.example to .env and fill them in.');
    process.exit(1);
  }
  const headed = process.env.HEADED === '1' || process.env.HEADED === 'true';

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: !headed,
    args: ['--no-sandbox'],
    proxy: PROXY ? { server: PROXY } : undefined,
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  });
  const page = await ctx.newPage();

  // Capture the bearer token the moment any request carries one.
  let token = null;
  const gotToken = new Promise((resolve) => {
    ctx.on('request', (req) => {
      const auth = req.headers()['authorization'];
      if (auth && /^bearer /i.test(auth) && !token) {
        token = auth.replace(/^bearer /i, '').trim();
        resolve(token);
      }
    });
  });

  console.log('→ Opening login page…');
  await page.goto('https://student.iclicker.com/#/login', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Dismiss the OneTrust cookie banner if it shows up (it can overlay the button).
  try {
    await page.click('#onetrust-reject-all-handler', { timeout: 4000 });
    console.log('→ Dismissed cookie banner');
  } catch { /* banner not present, fine */ }

  console.log('→ Filling credentials…');
  await page.fill('#input-email', email);
  await page.fill('#input-password', password);
  await page.click('#sign-in-button');

  console.log('→ Signing in, waiting for token…');
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 45000));
  try {
    await Promise.race([gotToken, timeout]);
  } catch {
    // Surface a login error message if the page shows one.
    let msg = '';
    try { msg = await page.locator('.error, [class*="error"], [role="alert"]').first().innerText({ timeout: 2000 }); } catch {}
    console.error('✗ Did not capture a token within 45s.' + (msg ? ` Page says: "${msg.trim()}"` : ' Check your credentials.'));
    if (headed) { console.error('  (headed mode — inspect the window, then Ctrl+C)'); await page.waitForTimeout(60000); }
    await browser.close();
    process.exit(2);
  }

  const info = decodeJwtSub(token);
  const cookies = await ctx.cookies();
  const auth = {
    token,
    userId: info.userId || null,
    email: info.email || email,
    expiresAt: info.exp ? new Date(info.exp * 1000).toISOString() : null,
    capturedAt: new Date().toISOString(),
    cookies,
  };
  fs.writeFileSync(OUT, JSON.stringify(auth, null, 2));
  console.log(`✓ Logged in as ${auth.email}`);
  console.log(`✓ Token saved to ${OUT}` + (auth.expiresAt ? ` (expires ${auth.expiresAt})` : ''));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
