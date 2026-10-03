import { chromium } from 'playwright';
import fs from 'fs';
const [,, out, scheme='light'] = process.argv;
const dir=`${out}/frames-${scheme}`; fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
// A 16:10 window, the shape of a laptop screen (it was 1280 x 660, which made a short, wide video)
const ctx=await b.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1.5,colorScheme:scheme});
await ctx.addInitScript(()=>{
  addEventListener('DOMContentLoaded',()=>{
    const c=document.createElement('div');
    c.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 3l14 8-6.2 1.6L9.6 19z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style,{position:'fixed',left:'0',top:'0',zIndex:2147483647,pointerEvents:'none',transform:'translate(700px,420px)',filter:'drop-shadow(0 2px 3px rgba(0,0,0,.35))'});
    const r=document.createElement('div');
    Object.assign(r.style,{position:'fixed',left:'0',top:'0',width:'34px',height:'34px',margin:'-17px 0 0 -17px',borderRadius:'50%',background:'rgba(37,99,217,.28)',zIndex:2147483646,pointerEvents:'none',opacity:'0',transition:'opacity .35s ease, scale .35s ease'});
    document.body.append(r,c);
    addEventListener('mousemove',e=>{c.style.transform=`translate(${e.clientX}px,${e.clientY}px)`;r.style.translate=`${e.clientX}px ${e.clientY}px`},true);
    addEventListener('mousedown',()=>{r.style.transition='none';r.style.scale='.4';r.style.opacity='1';requestAnimationFrame(()=>{r.style.transition='opacity .45s ease, scale .45s ease';r.style.scale='1';r.style.opacity='0'})},true);
  });
});
const p=await ctx.newPage();
p.on('pageerror',e=>console.log('PAGEERR',String(e).slice(0,300)));
await p.goto('http://localhost:5199/app/',{waitUntil:'load'});
await p.waitForTimeout(2500);

let pos={x:700,y:420};
await p.mouse.move(pos.x,pos.y);
let vt=0; const marks=[];
const mark=()=>marks.push({r:Date.now()/1000,v:vt});
const wait=async ms=>{mark();await p.waitForTimeout(ms);vt+=ms/1000;mark()};
const type=async(text,delay)=>{for(const ch of text){await p.keyboard.type(ch);await wait(delay)}};
const glide=async(x,y,ms=520)=>{const from={...pos};const n=Math.max(6,Math.round(ms/16));for(let i=1;i<=n;i++){const t=i/n,e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;mark();await p.mouse.move(from.x+(x-from.x)*e,from.y+(y-from.y)*e);await p.waitForTimeout(10);vt+=0.016;mark()}pos={x,y}};
const centre=async(loc,fx=.5,fy=.5)=>{const bb=await loc.boundingBox();return {x:bb.x+bb.width*fx,y:bb.y+bb.height*fy}};
const reveal=async(loc)=>{await loc.evaluate(e=>e.scrollIntoView({behavior:'smooth',block:'center'}));await wait(650)};
const goClick=async(loc,ms)=>{const c=await centre(loc);await glide(c.x,c.y,ms);await wait(90);await p.mouse.down();await wait(60);await p.mouse.up()};
// Native select popups are not captured, so glide to it, pulse, then set the value
const choose=async(loc,value)=>{const c=await centre(loc);await glide(c.x,c.y);await wait(120);await p.evaluate(()=>dispatchEvent(new MouseEvent('mousedown')));await wait(260);await loc.selectOption(value);await wait(420)};
const stepTo=async(label,target,valueLabel)=>{const more=p.getByRole('button',{name:label});const val=p.getByLabel(valueLabel);await goClick(more);for(let i=0;i<20;i++){const v=parseInt(await val.inputValue())||0;if(v>=target)break;await wait(150);await p.mouse.down();await wait(40);await p.mouse.up()}await wait(350)};

// ---- start capturing
const cdp=await ctx.newCDPSession(p);
const frames=[];
cdp.on('Page.screencastFrame',async f=>{frames.push({t:f.metadata.timestamp,data:f.data});try{await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId})}catch{}});
await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,everyNthFrame:1});
const t0=Date.now(); mark();
await wait(700);

const nums=p.locator('input[type=number]');
const sel=p.locator('select');
// size
await goClick(nums.nth(0)); await type('1165',95); await wait(250);
await goClick(nums.nth(1),380); await type('1165',95); await wait(900);
// bottom boards
await reveal(sel.nth(2));
await choose(sel.nth(1),'pine-green-case'); await choose(sel.nth(2),'100x19');
await stepTo('More bottom boards',3,'Number of bottom boards'); await wait(500);
// bearers
await reveal(sel.nth(6));
await choose(sel.nth(5),'pine-green-case'); await choose(sel.nth(6),'100x38');
await stepTo('More bearers',3,'Number of bearers'); await wait(500);
// top boards
await reveal(sel.nth(4));
await choose(sel.nth(3),'pine-green-case'); await choose(sel.nth(4),'100x17');
await stepTo('More top boards',7,'Number of top boards'); await wait(700);
// quantity
const qty=p.getByLabel('Number of pallets');
await goClick(qty,650); await p.keyboard.press('Control+A'); await type('250',120); await p.keyboard.press('Enter'); await wait(900);
// turn the pallet round
const canvas=p.locator('canvas').first();
const cb=await canvas.boundingBox();
await glide(cb.x+cb.width*.40,cb.y+cb.height*.66,600);
await p.mouse.down(); await glide(cb.x+cb.width*.70,cb.y+cb.height*.68,1600); await glide(cb.x+cb.width*.50,cb.y+cb.height*.665,1100); await p.mouse.up(); await wait(500);
// the quote
await goClick(p.locator('button.tab',{hasText:'Quote'}),600); await wait(700);
await glide(pos.x+40,pos.y+300,700); await wait(2200);

await cdp.send('Page.stopScreencast');
await wait(300);
console.log(scheme,'frames',frames.length,'seconds',((Date.now()-t0)/1000).toFixed(1));
mark();
const toV=(r)=>{ if(r<=marks[0].r) return 0; for(let i=1;i<marks.length;i++){ if(r<=marks[i].r){ const a=marks[i-1],b=marks[i]; const f=b.r>a.r?(r-a.r)/(b.r-a.r):1; return a.v+(b.v-a.v)*f } } return vt };
for(const f of frames) f.v=toV(f.t);
console.log('script seconds',vt.toFixed(1));
let list='';
frames.forEach((f,i)=>{const name=`f${String(i).padStart(5,'0')}.jpg`;fs.writeFileSync(`${dir}/${name}`,Buffer.from(f.data,'base64'));const d=i<frames.length-1?Math.max(0.0005,frames[i+1].v-f.v):0.6;list+=`file '${name}'\nduration ${d.toFixed(4)}\n`});
list+=`file 'f${String(frames.length-1).padStart(5,'0')}.jpg'\n`;
fs.writeFileSync(`${dir}/list.txt`,list);
// The frame to use as the poster: the finished pallet, just before the Quote tab is opened
const still=frames.findLast(f=>f.v<=vt-5.0)||frames.at(-1); fs.writeFileSync(`${out}/poster-${scheme}.jpg`,Buffer.from(still.data,'base64'));
await p.screenshot({path:`${out}/rec-end-${scheme}.png`});
await b.close();
