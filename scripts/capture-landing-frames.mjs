// Retakes the captures used by the landing page showcase (src/landing/showcase.js).
// Each one is a piece of the real app: a section of the build panel, the price card,
// the slider, or the 3D pallet on a transparent background.
//
//   1. npm run dev            (in another terminal; no Supabase settings, so there is no account button)
//   2. npm i -D playwright    (once), then: mkdir landing-frames && node scripts/capture-landing-frames.mjs
//   3. Convert the PNGs in ./landing-frames/ to src/landing/img/show/<name>.webp :
//        card-*, stamp-*, slider-*  as they are (they are captured at 2x)
//        pallet-*                   re-run with deviceScaleFactor 4, crop every one to the same box
//                                   (the union of their non-transparent areas plus a small margin; the pieces
//                                   must stay registered) and resize to 1500 px wide
//        Customer and Breakdown PDF page 1 (print each from the app, then pdftoppm -r 110)
//                                   -> sheet-customer.webp, sheet-breakdown.webp
//      The hero image (src/landing/img/app-hero.webp and -dark) is a plain 1120 x 760 screenshot of the finished build.
//
// The quote it makes must match the copy in index.html (#how) and the PIECES list in showcase.js.
import { chromium } from 'playwright';
const b = await chromium.launch(); const errs = [];
const ctx = await b.newContext({ viewport: { width: 1120, height: 760 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { window.print = () => {} });
await p.goto('http://localhost:5173/pallet-size-quote-calculator/app/'); await p.waitForTimeout(1500);
const f = n => p.locator(`[data-field="${n}"]`);
const body = p.locator('.panel-body');
const settle = async (ms = 1300) => { await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.mouse.move(5, 5); await p.waitForTimeout(ms); };
const setCount = async (l, v) => { const i = p.locator(`input[aria-label="Number of ${l}"]`); await i.fill(v); await i.press('Tab'); };
const tab = async (name) => { await p.getByRole('tab', { name: new RegExp(`^${name}($| )`) }).click(); await p.waitForTimeout(350); };
const el = async (sel, name) => { await p.locator(sel).first().screenshot({ path: `landing-frames/${name}.png`, omitBackground: true }); };
// Clear backdrops so pieces come out on transparency
const bare = await p.addStyleTag({ content: `html, body, #root, .workbench, .stage { background: transparent !important; }` });
const pallet = async (name) => {
  const t = await p.addStyleTag({ content: `.stamp, .stage-controls, .pallet-3d-live > svg { visibility: hidden !important; }` });
  await p.waitForTimeout(150);
  await el('.pallet-3d-live', `pallet-${name}`);
  await t.evaluate(n => n.remove());
};
await tab('Prices');
await p.locator('.settings-group .lock-button').first().click();
await f('labour').fill('3'); await f('markup').fill('25');
await p.locator('.settings-group .lock-button').first().click();
await p.getByRole('button', { name: 'Save prices' }).click(); await p.waitForTimeout(300);
await settle(300); await el('.settings-group', 'card-rates');
await tab('Build'); await settle(500);
await el('[data-fold="size"]', 'card-size-empty');
await f('width').fill('1165'); await f('width').press('Tab'); await settle(400); await el('[data-fold="size"]', 'card-size-width');
await f('length').fill('1165'); await f('length').press('Tab'); await settle(1700); await el('[data-fold="size"]', 'card-size'); await pallet('ghost');
await el('[data-fold="bottom"]', 'card-bottom-empty');
await f('bottom-type').selectOption('pine-green-case'); await f('bottom-size').selectOption('100x19'); await setCount('bottom boards', '3'); await settle(1700);
await el('[data-fold="bottom"]', 'card-bottom'); await el('.stamp', 'stamp-bottom'); await pallet('bottom');
await f('bearer-type').selectOption('pine-green-case'); await f('bearer-size').selectOption('100x38'); await setCount('bearers', '3'); await settle(1700);
await el('[data-fold="bearers"]', 'card-bearers'); await el('.stamp', 'stamp-bearers'); await pallet('bearers');
await f('top-type').selectOption('pine-green-case'); await f('top-size').selectOption('100x17');
for (const n of [5, 6, 7, 8, 9]) {
  await setCount('top boards', String(n)); await settle(1600);
  await pallet(`top${n}`);
  if (n >= 7) { await el('[data-fold="top"]', `card-top${n}`); await el('.stamp', `stamp-top${n}`); await el('.range', `slider-${n}`); }
}
await setCount('top boards', '7'); await settle(800);
await tab('Quote');
await f('customer').fill('Harbour Freight Co');
const q = p.locator('input[aria-label="Number of pallets"]').first(); await q.fill('250'); await q.press('Tab'); await settle(600);
await el('.stamp', 'stamp-250'); await el('.totals', 'card-totals'); await el('.line-items', 'card-lines');
console.log(await p.evaluate(() => [...document.querySelector('.panel-body').children].map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().height) + ' > ' + [...e.children].map(c => c.tagName + '.' + c.className + ':' + Math.round(c.getBoundingClientRect().height)).join(' | ')).join('\n')));
for (const btn of ['Customer PDF']) { await p.getByRole('button', { name: btn }).click(); await p.waitForTimeout(400); }
await tab('History'); await settle(400);
console.log(await p.evaluate(() => [...document.querySelector('.panel-body').children].map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().height) + ' > ' + [...e.children].map(c => c.tagName + '.' + c.className).join(' | ')).join('\n')));
await el('.quote-item', 'card-history'); await el('.status-filter', 'card-filter');
console.log('ERR', errs); await b.close();
