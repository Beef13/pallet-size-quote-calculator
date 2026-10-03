// Captures every landing-page screenshot from the real calculator, in light or dark.
import { launch, tab, build, qty, preset, settings } from './state.mjs';
const [,,out,scheme='light']=process.argv;
const {b,p}=await launch(scheme,{width:1280,height:800},2);
const shot=(name,clip)=>p.screenshot({path:`${out}/${name}-${scheme}.png`,...(clip?{clip}:{})});
const panelScroll=(y)=>p.evaluate((y)=>{const s=[...document.querySelectorAll('aside *')].find(e=>e.scrollHeight>e.clientHeight+50&&getComputedStyle(e).overflowY!=='visible');if(s)s.scrollTop=y==='end'?s.scrollHeight:y},y);
const box=async(loc,pad=0)=>{const r=await loc.boundingBox();return {x:Math.max(0,r.x-pad),y:Math.max(0,r.y-pad),width:r.width+pad*2,height:r.height+pad*2}};
const PANEL={x:14,y:14,width:440,height:772};

await settings(p);
await tab(p,'Prices'); await p.waitForTimeout(300);
await shot('markup',{x:26,y:152,width:416,height:276});
// relock labour and markup so the padlock shows closed
await tab(p,'Prices');
const lock=p.getByRole('button',{name:/labour, markup and GST/i}).first();
if(!(await p.locator('[data-field="labour"]').isDisabled())){await lock.click();await p.waitForTimeout(300)}
await tab(p,'Build');

const saveQuote=async(customer,{pdf=true}={})=>{
  await tab(p,'Quote'); await p.locator('[data-field="customer"]').fill(customer); await p.waitForTimeout(200);
  if(pdf){await p.getByRole('button',{name:'Customer PDF'}).click()} else {await p.getByRole('button',{name:'Save quote'}).click()}
  await p.waitForTimeout(700);
};
const newQuote=async()=>{await tab(p,'Quote');await p.getByRole('button',{name:'New quote'}).click();await p.waitForTimeout(600);const ok=p.getByRole('button',{name:/^(Start new|New quote|Yes|Discard)/}).last();await tab(p,'Build')};

// three presets and four quotes
await build(p,{w:1200,l:1000,top:9,topSize:'100x19'}); await preset(p,'1200 x 1000 heavy duty'); await qty(p,400); await saveQuote('Customer C',{pdf:false}); await newQuote();
await build(p,{w:1140,l:1140}); await preset(p,'1140 export'); await qty(p,120); await saveQuote('Customer B'); await newQuote();
await build(p,{w:1165,l:1165,top:5}); await qty(p,60); await saveQuote('Customer D'); await newQuote();
await build(p,{w:1165,l:1165}); await preset(p,'1165 standard'); await qty(p,250); await saveQuote('Customer A');

// statuses
await tab(p,'History');
const setStatus=async(customer,status)=>{await p.locator('aside button',{hasText:customer}).first().click();await p.waitForTimeout(400);const row=p.locator('aside li, aside article, aside div').filter({hasText:customer}).filter({has:p.locator('select')}).last();await row.locator('select').selectOption({label:status});await p.waitForTimeout(400)};
await setStatus('Customer D','Lost'); await setStatus('Customer A','Accepted');
await p.mouse.move(900,650); await p.waitForTimeout(600);
await shot('history');
await shot('history-panel',PANEL);

// quote tab (hero and step 3)
await tab(p,'Quote'); await panelScroll(0); await p.waitForTimeout(700);
await shot('quote');
await panelScroll('end'); await p.waitForTimeout(500);
await shot('quote-totals');
await shot('quote-totals-panel',PANEL);

// build tab (step 2), with the presets open
await tab(p,'Build'); await panelScroll(0); await p.waitForTimeout(500);
const presetsToggle=p.getByRole('button',{name:/Saved presets/}).first();
await shot('presets',{x:14,y:150,width:440,height:300});
await presetsToggle.click(); await p.waitForTimeout(500);
await shot('build');
// the 3D stage on its own
await shot('stage',{x:468,y:14,width:798,height:772});

// prices tab (step 1): fold the business details away so the price list sits under labour and markup
await tab(p,'Prices'); await panelScroll(0);
const biz=p.getByRole('button',{name:/Your business/}).first(); await biz.click(); await p.waitForTimeout(500);
await shot('prices');
await shot('prices-panel',PANEL);
// the price list with its padlocks
await panelScroll(318); await p.waitForTimeout(400);
await shot('locks',{x:14,y:150,width:440,height:420});

// leader boards
await tab(p,'Build'); await panelScroll(0);
const leaderToggle=p.locator('aside input[type=checkbox]').nth(1);
await leaderToggle.evaluate(e=>e.scrollIntoView({block:'center'})); await p.waitForTimeout(300);
await leaderToggle.click({force:true}); await p.waitForTimeout(600);
console.log('selects after leader toggle:',await p.evaluate(()=>[...document.querySelectorAll('aside select')].map((s,i)=>i+':'+(s.value||'-')+'['+[...s.options].slice(0,4).map(o=>o.value).join(',')+']').join(' ')));
const sel=p.locator('aside select');
await sel.nth(5).selectOption('pine-green-case'); await p.waitForTimeout(300);
await sel.nth(6).selectOption('150x17').catch(async()=>{await sel.nth(6).selectOption({index:1})}); await p.waitForTimeout(900);
await leaderToggle.evaluate(e=>e.scrollIntoView({block:'center'})); await p.waitForTimeout(400);
const lt=await leaderToggle.boundingBox();
await shot('leader',{x:14,y:Math.max(150,lt.y-150),width:440,height:300});
await shot('leader-app');
await b.close();
