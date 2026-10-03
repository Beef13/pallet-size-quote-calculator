// Captures the frames for the "How it works" panels on the landing page: close crops of the
// real calculator, one frame per click and per keystroke while it is driven through each step.
// Alongside the pictures it writes steps-<theme>.json: for every frame, what kind of action led
// to it and where on the crop the pointer was, so the page can show a pointer making the moves.
// Usage: node tools/landing-media/steps.mjs <out-folder> [light|dark]
import { writeFileSync } from 'node:fs';
import { launch, tab } from './state.mjs';
const [,,out,scheme='light']=process.argv;
const {b,p}=await launch(scheme,{width:1280,height:1100},2);
const settle=(ms=350)=>p.waitForTimeout(ms);

const scenes={};            // scene -> [{kind, reels:{name:{k, at}}}]
const count={}, lastShot={};
let scene=null;
const begin=(name)=>{scene=name;scenes[name]=[]};
/* One moment in a scene. kind: 'start' | 'click' | 'again' (same control clicked again) | 'type' | 'cut'.
   shots: [{reel, clip, target?}] - a reel with a target always gets a frame; one without only when it changed. */
const moment=async(kind,shots)=>{
  const entry={kind,reels:{}};
  for(const {reel,clip,target} of shots){
    const png=await p.screenshot({clip});
    if(!target&&kind!=='start'&&lastShot[reel]&&png.equals(lastShot[reel])) continue;
    lastShot[reel]=png;
    const k=count[reel]=(count[reel]??-1)+1;
    writeFileSync(`${out}/${reel}-${k}-${scheme}.png`,png);
    entry.reels[reel]={k,at:target?[+(100*(target.x-clip.x)/clip.width).toFixed(1),+(100*(target.y-clip.y)/clip.height).toFixed(1)]:null};
  }
  scenes[scene].push(entry);
};
const centre=async(loc)=>{const r=await loc.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2}};
const clipOf=async(loc,{dx=0,dy=0,w,h,block='center'})=>{
  await loc.evaluate((e,block)=>e.scrollIntoView({block}),block); await settle(200);
  const r=await loc.boundingBox();
  return {x:Math.round(r.x+dx),y:Math.round(r.y+dy),width:w??Math.round(r.width),height:h??Math.round(r.height)};
};
// Type into the focused field one key at a time, a frame after each
const typeInto=async(text,shots)=>{for(const ch of text){await p.keyboard.type(ch);await settle(220);await moment('type',await shots())}};

const sel=p.locator('aside select'); const nums=p.locator('aside input[type=number]');
const sections=p.locator('aside section.form-section');   // presets, pallet size, bottom boards, top boards, bearers
const STAGE={x:548,y:300,width:660,height:500};

/* ---------------- Step 2: build ---------------- */
begin('build');
{
  let section=sections.nth(1);
  const shots=(target)=>async()=>[{reel:'build-panel',clip:await clipOf(section,{dx:-12,dy:6,w:416,h:244}),target:target?await centre(target):undefined},{reel:'build-stage',clip:STAGE}];
  const act=async(kind,target,wait=650)=>{await settle(wait);await moment(kind,await shots(target)())};
  await moment('start',(await shots()()).map(s=>({...s,target:undefined})));
  for(const field of [nums.nth(0),nums.nth(1)]){
    await field.click(); await act('click',field,250);
    await typeInto('1165',async()=>{await settle(450);return shots(field)()});
  }
  const part=async(index,timber,size,value,more,less,target)=>{
    section=sections.nth(index);
    await p.mouse.move(700,1090); await settle(250);
    await moment('cut',await shots()());
    await timber.selectOption('pine-green-case'); await timber.hover(); await act('click',timber);
    await size[0].selectOption(size[1]); await size[0].hover(); await act('click',size[0]);
    const btn=p.getByRole('button',{name:more}); let first=true;
    for(let i=0;i<20;i++){
      const v=parseInt(await p.getByLabel(value).inputValue())||0;
      if(v===target)break;
      const use=v<target?btn:p.getByRole('button',{name:less});
      await use.click(); await act(first?'click':'again',use); first=false;
    }
  };
  await part(2,sel.nth(1),[sel.nth(2),'100x19'],'Number of bottom boards','More bottom boards','Fewer bottom boards',3);
  await part(4,sel.nth(5),[sel.nth(6),'100x38'],'Number of bearers','More bearers','Fewer bearers',3);
  await part(3,sel.nth(3),[sel.nth(4),'100x17'],'Number of top boards','More top boards','Fewer top boards',7);
}

/* ---------------- Step 1: rates ---------------- */
await p.mouse.move(700,1090);
await tab(p,'Prices');
begin('rates');
{
  const card=p.locator('aside section.settings-group').first();
  const lock=card.locator('button.lock-button');
  const labour=p.locator('[data-field="labour"]'), markup=p.locator('[data-field="markup"]');
  const group=p.locator('aside section.price-group.open').first();
  if(!(await labour.isDisabled())){await lock.click();await settle()}
  await p.mouse.move(700,1090); await settle();
  const cardClip=()=>clipOf(card,{block:'start'});
  const one=async(kind,target)=>{await settle();await moment(kind,[{reel:'rates-labour',clip:await cardClip(),target:target?await centre(target):undefined}])};
  // both reels have a first frame
  await moment('start',[{reel:'rates-labour',clip:await cardClip()},{reel:'rates-list',clip:await clipOf(group,{dx:-12,w:416,h:262,block:'start'})}]);
  await card.evaluate(e=>e.scrollIntoView({block:'start'})); await settle();
  await lock.click(); await one('click',lock);
  await labour.click(); await p.keyboard.press('Control+A'); await one('click',labour);
  await p.keyboard.type('3'); await one('type',labour);
  await markup.click(); await p.keyboard.press('Control+A'); await one('click',markup);
  await p.keyboard.type('2'); await one('type',markup);
  await p.keyboard.type('5'); await one('type',markup);
  const save=p.getByRole('button',{name:/Save prices/}); if(await save.isEnabled().catch(()=>false)){await save.click();await settle()}
  await lock.click(); await one('click',lock);
  await p.mouse.move(700,1090); await settle();
  const listClip=()=>clipOf(group,{dx:-12,w:416,h:262,block:'start'});
  const two=async(kind,target)=>{await settle();await moment(kind,[{reel:'rates-list',clip:await listClip(),target:await centre(target)}])};
  const unlock=group.getByRole('button',{name:/Unlock all/}); await listClip();
  await unlock.click(); await two('click',group.getByRole('button',{name:/Lock all/}));
  const price=group.locator('input').nth(1); await price.click(); await two('click',price);
  const relock=group.getByRole('button',{name:/Lock all/}); await relock.click(); await two('click',group.getByRole('button',{name:/Unlock all/}));
  console.log('price padlocks still open:',await group.locator('button.lock-button.unlocked').count());
}

/* ---------------- Step 3: price ---------------- */
await p.mouse.move(700,1090);
await tab(p,'Quote');
begin('price');
{
  const totals=p.locator('aside div.totals');
  const lines=await clipOf(p.locator('aside ul.line-items'),{dx:-18,dy:-4,w:428,h:280});
  await moment('start',[{reel:'price-lines',clip:lines}]);
  const clip=()=>clipOf(totals,{dx:-6,dy:-4,w:404,h:382});
  const qty=totals.getByLabel('Number of pallets');
  const one=async(kind,target)=>{await settle();await moment(kind,[{reel:'price-totals',clip:await clip(),target:target?await centre(target):undefined}])};
  await one('start');
  await qty.click(); await p.keyboard.press('Control+A'); await one('click',qty);
  for(const ch of '250'){await p.keyboard.type(ch); await one('type',qty)}
  await p.keyboard.press('Enter'); await p.mouse.move(700,1090); await settle();
}

/* ---------------- Step 4: send ---------------- */
begin('send');
{
  const meta=p.locator('aside div.quote-meta'), foot=p.locator('aside footer.panel-footer');
  await p.locator('[data-field="customer"]').fill('Sample customer'); await p.mouse.move(700,1090); await settle();
  const head=()=>clipOf(meta,{dx:-12,dy:-10,w:416,h:106,block:'start'});
  const bar=async()=>{const r=await foot.boundingBox();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}};
  await moment('start',[{reel:'send-quote',clip:await head()},{reel:'send-buttons',clip:await bar()}]);
  const pdf=p.getByRole('button',{name:'Customer PDF'});
  await pdf.click(); await settle(1100);
  await moment('click',[{reel:'send-buttons',clip:await bar(),target:await centre(pdf)},{reel:'send-quote',clip:await head()}]);
}
writeFileSync(`${out}/steps-${scheme}.json`,JSON.stringify({scenes,count},null,1));
console.log(JSON.stringify(count));
await b.close();
