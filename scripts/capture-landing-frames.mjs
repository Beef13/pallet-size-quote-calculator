// Retakes the screenshots used by the landing page (hero and walkthrough).
//
//   1. npm run dev            (in another terminal; no Supabase settings, so there is no account button)
//   2. npm i -D playwright    (once), then: node scripts/capture-landing-frames.mjs
//   3. Convert the PNGs it writes to ./landing-frames/ :
//        walkthrough frames -> src/landing/img/walk/<name>.webp at 1680 x 1140 (c2 and c3 repeat c0 and b6, so skip them)
//        customer.pdf / breakdown.pdf page 1 (pdftoppm -r 110) -> walk/sheet-customer.webp, walk/sheet-breakdown.webp
//        hero.png / hero-dark.png -> src/landing/img/app-hero.webp, app-hero-dark.webp at 2000 x 1357
//
// The quote it makes must match the copy in index.html (#how) and FRAMES in src/landing/walkthrough.js.
import { chromium } from 'playwright';
const URL = 'http://localhost:5173/pallet-size-quote-calculator/app/';
const b = await chromium.launch(); const errs = [];
async function run(dark) {
  const ctx = await b.newContext({ viewport: { width: 1120, height: 760 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.print = () => {} });
  await p.goto(URL); await p.waitForTimeout(1500);
  if (dark) { await p.locator('button[aria-label*="dark" i], button[title*="dark" i]').first().click(); await p.waitForTimeout(400); }
  const f = n => p.locator(`[data-field="${n}"]`);
  const body = p.locator('.panel-body');
  const scrollTo = async (y) => { await body.evaluate((e, y) => { e.scrollTop = y }, y); };
  const shot = async (name, wait = 1100) => {
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.mouse.move(820, 500); await p.waitForTimeout(wait);
    if (!dark || name === 'hero') await p.screenshot({ path: `landing-frames/${name}${dark ? '-dark' : ''}.png` });
  };
  const setCount = async (l, v) => { const i = p.locator(`input[aria-label="Number of ${l}"]`); await i.fill(v); await i.press('Tab'); };
  const tab = async (name) => { await p.getByRole('tab', { name: new RegExp(`^${name}($| )`) }).click(); await p.waitForTimeout(350); };
  await tab('Prices');
  await p.locator('.settings-group .lock-button').first().click();
  await f('labour').fill('3'); await f('markup').fill('25');
  await p.locator('.settings-group .lock-button').first().click();
  await p.getByRole('button', { name: 'Save prices' }).click(); await p.waitForTimeout(300);
  await tab('Build');
  await shot('a0-empty');
  await f('width').fill('1165'); await f('width').press('Tab'); await scrollTo(0); await shot('a1-width');
  await f('length').fill('1165'); await f('length').press('Tab'); await scrollTo(0); await shot('a2-length', 1700);
  const S1 = await body.evaluate(e => { const t = e.querySelector('[data-fold="bottom"]'); return Math.max(0, e.scrollTop + t.getBoundingClientRect().top - e.getBoundingClientRect().top - 150) });
  await scrollTo(S1); await shot('b0-bottom-empty');
  await f('bottom-type').selectOption('pine-green-case'); await f('bottom-size').selectOption('100x19'); await setCount('bottom boards', '3'); await scrollTo(S1); await shot('b1-bottom', 1700);
  const S2 = await body.evaluate(e => { const t = e.querySelector('[data-fold="top"]'); return e.scrollTop + t.getBoundingClientRect().top - e.getBoundingClientRect().top - 24 });
  await scrollTo(S2); await shot('b2-rest-empty');
  await f('bearer-type').selectOption('pine-green-case'); await f('bearer-size').selectOption('100x38'); await setCount('bearers', '3'); await scrollTo(S2); await shot('b3-bearers', 1700);
  await f('top-type').selectOption('pine-green-case'); await f('top-size').selectOption('100x17');
  for (const n of [5, 6, 7]) { await setCount('top boards', String(n)); await scrollTo(S2); await shot(`b${n - 1}-top${n}`, 1500); }
  await shot('hero', 300);
  if (dark) { await ctx.close(); return; }
  for (const [i, n] of [[0, 8], [1, 9], [2, 8], [3, 7]]) { await setCount('top boards', String(n)); await scrollTo(S2); await shot(`c${i}-top${n}`, 1500); }
  await tab('Prices'); await scrollTo(0); await shot('d0-prices');
  await tab('Quote');
  await f('customer').fill('Harbour Freight Co');
  await scrollTo(0); await shot('d1-quote1');
  const q = p.locator('input[aria-label="Number of pallets"]').first(); await q.fill('250'); await q.press('Tab');
  await scrollTo(0); await shot('d2-quote250');
  const max = await body.evaluate(e => e.scrollHeight - e.clientHeight);
  await scrollTo(max / 2); await shot('d3-quote-mid', 500);
  await scrollTo(max); await shot('d4-quote-totals', 500);
  for (const [btn, name] of [['Customer PDF', 'customer'], ['Breakdown PDF', 'breakdown']]) {
    await p.getByRole('button', { name: btn }).click(); await p.waitForTimeout(400);
    await p.pdf({ path: `landing-frames/${name}.pdf`, format: 'A4' });
  }
  await tab('History'); await shot('e0-history');
  await ctx.close();
}
await run(false); await run(true);
console.log('ERR', errs); await b.close();
