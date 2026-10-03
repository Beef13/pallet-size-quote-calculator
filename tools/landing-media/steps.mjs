// Captures the frames for the "How it works" panels on the landing page: close crops of the
// real calculator, taken one after another while it is driven through each step.
// Usage: node tools/landing-media/steps.mjs <out-folder> [light|dark]
import { launch, tab, qty } from './state.mjs';
const [,,out,scheme='light']=process.argv;
const {b,p}=await launch(scheme,{width:1280,height:1100},2);
const settle=(ms=450)=>p.waitForTimeout(ms);
const count={};
const snap=async(name,clip)=>{const k=count[name]=(count[name]??-1)+1;await p.screenshot({path:`${out}/${name}-${k}-${scheme}.png`,clip});return k};
// Bring a part of the side panel into view and return a clip measured from its top-left corner
const clipOf=async(loc,{dx=0,dy=0,w,h,block='center'})=>{
  await loc.evaluate((e,block)=>e.scrollIntoView({block}),block); await settle(250);
  const r=await loc.boundingBox();
  return {x:Math.round(r.x+dx),y:Math.round(r.y+dy),width:w??Math.round(r.width),height:h??Math.round(r.height)};
};
const sel=p.locator('aside select'); const nums=p.locator('aside input[type=number]');
const stepTo=async(more,less,val,target)=>{for(let i=0;i<30;i++){const v=parseInt(await p.getByLabel(val).inputValue())||0;if(v===target)break;await p.getByRole('button',{name:v<target?more:less}).click();await p.waitForTimeout(120)}};

/* ---- Step 2 first, on a clean calculator: size, bottom boards, bearers, then top boards one at a time ---- */
const sections=p.locator('aside section.form-section');   // presets, pallet size, bottom boards, top boards, bearers
const STAGE={x:548,y:300,width:660,height:500};
const both=async(section)=>{
  await snap('build-panel',await clipOf(section,{dx:-12,dy:6,w:416,h:244}));
  await p.mouse.move(640,1090); await settle(700);
  await snap('build-stage',STAGE);
};
await both(sections.nth(1));
await nums.nth(0).fill('1165'); await settle(); await both(sections.nth(1));
await nums.nth(1).fill('1165'); await settle(); await both(sections.nth(1));
await sel.nth(1).selectOption('pine-green-case'); await sel.nth(2).selectOption('100x19'); await stepTo('More bottom boards','Fewer bottom boards','Number of bottom boards',3); await settle(); await both(sections.nth(2));
await sel.nth(5).selectOption('pine-green-case'); await sel.nth(6).selectOption('100x38'); await stepTo('More bearers','Fewer bearers','Number of bearers',3); await settle(); await both(sections.nth(4));
await sel.nth(3).selectOption('pine-green-case'); await sel.nth(4).selectOption('100x17');
for(let k=1;k<=7;k++){await stepTo('More top boards','Fewer top boards','Number of top boards',k); await settle(); await both(sections.nth(3));}

/* ---- Step 1: labour and markup entered and locked; the price list unlocked, a price selected, locked again ---- */
await tab(p,'Prices');
const labourCard=p.locator('aside section.settings-group').first();
const lock=labourCard.locator('button.lock-button');
const card=()=>clipOf(labourCard,{block:'start'});
if(!(await p.locator('[data-field="labour"]').isDisabled())){await lock.click();await settle()}
await snap('rates-labour',await card());
await lock.click(); await settle(); await snap('rates-labour',await card());
await p.locator('[data-field="labour"]').fill('3'); await settle(); await snap('rates-labour',await card());
await p.locator('[data-field="markup"]').fill('25'); await settle(); await p.mouse.click(700,600); await settle(250); await snap('rates-labour',await card());
const save=p.getByRole('button',{name:/Save prices/}); if(await save.isEnabled().catch(()=>false)){await save.click();await settle()}
await lock.click(); await settle(); await snap('rates-labour',await card());

const group=p.locator('aside section.price-group.open').first();
const list=()=>clipOf(group,{dx:-12,w:416,h:262,block:'start'});
await snap('rates-list',await list());
await group.getByRole('button',{name:/Unlock all/}).click(); await settle(); await snap('rates-list',await list());
const price=group.locator('input').nth(1); await price.click(); await settle(300); await snap('rates-list',await list());
await p.mouse.click(700,600); await settle(200);
const relock=group.getByRole('button',{name:/Lock all/});
if(await relock.count()){await relock.first().click()} else {for(const btn of await group.locator('button.lock-button.unlocked').all()){await btn.click();await p.waitForTimeout(80)}}
await settle(); console.log('price padlocks still open:',await group.locator('button.lock-button.unlocked').count());
await snap('rates-list',await list());

/* ---- Step 3: the itemised lines, and the totals as the quantity goes from 1 to 250 ---- */
await tab(p,'Quote');
await snap('price-lines',await clipOf(p.locator('aside ul.line-items'),{dx:-18,dy:-4,w:428,h:280}));
const totals=p.locator('aside div.totals');
for(const n of [1,50,250]){await qty(p,n); await settle(); await snap('price-totals',await clipOf(totals,{dx:-6,dy:-4,w:404,h:382}));}

/* ---- Step 4: the quote before and after the customer PDF is exported ---- */
const meta=p.locator('aside div.quote-meta');
const head=()=>clipOf(meta,{dx:-12,dy:-10,w:416,h:106,block:'start'});
await p.locator('[data-field="customer"]').fill('Sample customer'); await settle(250);
await snap('send-quote',await head());
await p.getByRole('button',{name:'Customer PDF'}).click(); await settle(1200);
await snap('send-quote',await head());
console.log(JSON.stringify(count));
await b.close();
