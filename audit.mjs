import { chromium } from '@playwright/test';
import fs from 'fs';

const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.split('=')[0], l.split('=').slice(1).join('=')]));
const { createClient } = await import('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const email = `audit+${Date.now()}@example.com`, pass = 'Test12345!';
const { data: u } = await admin.auth.admin.createUser({ email, password: pass, email_confirm: true });
const { data: c } = await admin.from('invite_codes').select('generated_by').eq('status','unused').limit(1).single();
const uname = 'audit' + Date.now() % 100000;
await admin.from('profiles').insert({ id: u.user.id, username: uname, invited_by: c.generated_by });
// give the audit user a saved item so /saved has content
const { data: l } = await admin.from('listings').select('id').eq('status','active').limit(1).single();
await admin.from('saves').insert({ user_id: u.user.id, listing_id: l.id });

fs.mkdirSync('audit-shots', { recursive: true });
const browser = await chromium.launch();
const findings = [];

const ROUTES = ['/browse', '/saved', '/messages', '/sell', '/settings', `/sellers/${uname}`, `/listings/${l.id}`];
const VIEWS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile',  width: 375,  height: 812 },
];

for (const v of VIEWS) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 90)));
  page.on('console', m => { if (m.type() === 'error' && !/woff2|Sentry|CSP|favicon/i.test(m.text())) errs.push(m.text().slice(0, 90)); });

  await page.goto('http://localhost:3000/enter/login');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', pass);
  await page.click('button[type=submit]');
  await page.waitForURL('**/browse', { timeout: 25000 });

  for (const route of ROUTES) {
    errs.length = 0;
    await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle' }).catch(()=>{});
    await page.waitForTimeout(1800);

    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth > window.innerWidth + 2;
      // elements poking outside the viewport horizontally
      const overflowing = [...document.querySelectorAll('body *')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2);
      }).slice(0, 4).map(e => `${e.tagName}.${(e.className||'').toString().slice(0,18)}`);
      // tap targets smaller than 44px (iOS HIG minimum)
      const small = [...document.querySelectorAll('button, a')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 40;
      }).length;
      const bottomNav = !!document.querySelector('[data-testid=mobile-tabbar], nav[data-mobile-tabs]');
      const bodyText = document.body.innerText.trim();
      return { overflowX, overflowing, small, bottomNav, empty: bodyText.length < 40, chars: bodyText.length };
    });

    findings.push({ view: v.name, route, ...m, errors: [...errs] });
    await page.screenshot({ path: `audit-shots/${v.name}-${route.replace(/[\/\[\]]/g,'_')}.png`, fullPage: false });
  }
  await page.close();
}

await browser.close();
await admin.from('saves').delete().eq('user_id', u.user.id);
await admin.auth.admin.deleteUser(u.user.id);

console.log('\n=== AUDIT ===');
for (const f of findings) {
  const flags = [];
  if (f.overflowX) flags.push('H-OVERFLOW:' + f.overflowing.join(','));
  if (f.empty) flags.push('EMPTY-PAGE');
  if (f.view === 'mobile' && !f.bottomNav) flags.push('NO-BOTTOM-TABBAR');
  if (f.small > 0) flags.push(`${f.small} tap-targets <40px`);
  if (f.errors.length) flags.push('JS-ERR:' + f.errors[0]);
  console.log(`${f.view.padEnd(7)} ${f.route.padEnd(28)} ${flags.length ? '⚠️  ' + flags.join(' | ') : '✅ clean'}`);
}
fs.writeFileSync('audit-findings.json', JSON.stringify(findings, null, 2));
console.log('\nshots → audit-shots/  data → audit-findings.json');
