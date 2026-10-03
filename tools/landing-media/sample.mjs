import { chromium } from 'playwright';
const out=process.argv[2];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1280,height:900}});
p.on('pageerror',e=>console.log('PAGEERR',String(e).slice(0,300)));
await p.addInitScript(()=>{window.print=()=>{window.__printed=(window.__printed||0)+1}});
await p.goto('http://localhost:5199/app/',{waitUntil:'load'});
await p.waitForTimeout(2500);
const nums=p.locator('input[type=number]'); const sel=p.locator('select');
await nums.nth(0).fill('1165'); await nums.nth(1).fill('1165'); await p.waitForTimeout(400);
const step=async(label,val,target)=>{for(let i=0;i<20;i++){const v=parseInt(await p.getByLabel(val).inputValue())||0;if(v>=target)break;await p.getByRole('button',{name:label}).click();await p.waitForTimeout(120)}};
await sel.nth(1).selectOption('pine-green-case'); await sel.nth(2).selectOption('100x19'); await step('More bottom boards','Number of bottom boards',3);
await sel.nth(5).selectOption('pine-green-case'); await sel.nth(6).selectOption('100x38'); await step('More bearers','Number of bearers',3);
await sel.nth(3).selectOption('pine-green-case'); await sel.nth(4).selectOption('100x17'); await step('More top boards','Number of top boards',7);
const qty=p.getByLabel('Number of pallets'); await qty.click(); await p.keyboard.press('Control+A'); await p.keyboard.type('250'); await p.keyboard.press('Enter');
// prices tab: business + pricing
await p.locator('button.tab',{hasText:'Prices'}).click(); await p.waitForTimeout(600);
if(!(await p.locator('[data-field="biz-name"]').isVisible().catch(()=>false))){ await p.getByRole('button',{name:/Your business/}).first().click(); await p.waitForTimeout(300); }
await p.locator('[data-field="biz-name"]').fill('Example Pallets Pty Ltd');
await p.locator('[data-field="biz-abn"]').fill('00 000 000 000');
await p.locator('[data-field="biz-phone"]').fill('(03) 0000 0000');
await p.locator('[data-field="biz-email"]').fill('quotes@example.com');
const labour=p.locator('[data-field="labour"]');
if(!(await labour.isVisible().catch(()=>false))){ await p.getByRole('button',{name:/Labour, markup/}).first().click().catch(()=>{}); await p.waitForTimeout(300); }
if(await labour.isDisabled()){ await p.getByRole('button',{name:/labour, markup and GST/i}).first().click(); await p.waitForTimeout(300); }
await labour.fill('3'); await p.locator('[data-field="markup"]').fill('25'); await p.waitForTimeout(300);
const save=p.getByRole('button',{name:/Save prices/}); if(await save.isEnabled().catch(()=>false)){ await save.click(); await p.waitForTimeout(400); }
await p.locator('button.tab',{hasText:'Quote'}).click(); await p.waitForTimeout(600);
await p.locator('[data-field="customer"]').fill('Sample customer'); await p.waitForTimeout(300);
await p.screenshot({path:`${out}/sample-quote-tab.png`});
await p.getByRole('button',{name:'Customer PDF'}).click(); await p.waitForTimeout(1200);
console.log('printed',await p.evaluate(()=>window.__printed),'title',await p.title());
await p.emulateMedia({media:'print'});
await p.pdf({path:`${out}/sample-quote.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
await p.emulateMedia({media:'screen'}); await p.waitForTimeout(400);
await p.getByRole('button',{name:'Breakdown PDF'}).click(); await p.waitForTimeout(1200);
console.log('printed',await p.evaluate(()=>window.__printed),'title',await p.title());
await p.emulateMedia({media:'print'});
await p.pdf({path:`${out}/sample-breakdown.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
await b.close();
