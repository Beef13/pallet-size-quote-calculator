// Builds a realistic calculator state (prices, business, presets, several saved quotes)
import { chromium } from 'playwright';
export async function launch(scheme='light', viewport={width:1280,height:800}, dsf=2){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const ctx=await b.newContext({viewport,deviceScaleFactor:dsf,colorScheme:scheme});
  const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',String(e).slice(0,300)));
  await p.addInitScript(()=>{window.print=()=>{}});
  await p.goto('http://localhost:5196/app/',{waitUntil:'load'}); await p.waitForTimeout(2500);
  return {b,p};
}
export const tab=async(p,name)=>{await p.locator('button.tab',{hasText:name}).click();await p.waitForTimeout(600)};
const step=async(p,more,less,val,target)=>{for(let i=0;i<30;i++){const v=parseInt(await p.getByLabel(val).inputValue())||0;if(v===target)break;await p.getByRole('button',{name:v<target?more:less}).click();await p.waitForTimeout(110)}};
export async function build(p,{w,l,bottom=3,bearers=3,top=7,topSize='100x17'}){
  const nums=p.locator('input[type=number]'); const sel=p.locator('select');
  await nums.nth(0).fill(String(w)); await nums.nth(1).fill(String(l)); await p.waitForTimeout(250);
  await sel.nth(1).selectOption('pine-green-case'); await sel.nth(2).selectOption('100x19'); await step(p,'More bottom boards','Fewer bottom boards','Number of bottom boards',bottom);
  await sel.nth(5).selectOption('pine-green-case'); await sel.nth(6).selectOption('100x38'); await step(p,'More bearers','Fewer bearers','Number of bearers',bearers);
  await sel.nth(3).selectOption('pine-green-case'); await sel.nth(4).selectOption(topSize); await step(p,'More top boards','Fewer top boards','Number of top boards',top);
  await p.waitForTimeout(500);
}
export async function qty(p,n){const q=p.getByLabel('Number of pallets').locator('visible=true').first();await q.click();await p.keyboard.press('Control+A');await p.keyboard.type(String(n));await p.keyboard.press('Enter');await p.waitForTimeout(300)}
export async function preset(p,name){await p.getByRole('button',{name:'Save as preset'}).click();await p.waitForTimeout(300);await p.getByPlaceholder('e.g. 1165 export, heavy duty').fill(name);await p.getByRole('button',{name:'Save preset'}).click();await p.waitForTimeout(400)}
export async function settings(p){
  await tab(p,'Prices');
  if(!(await p.locator('[data-field="biz-name"]').isVisible().catch(()=>false))){await p.getByRole('button',{name:/Your business/}).first().click();await p.waitForTimeout(300)}
  await p.locator('[data-field="biz-name"]').fill('Example Pallets Pty Ltd');
  await p.locator('[data-field="biz-abn"]').fill('00 000 000 000');
  await p.locator('[data-field="biz-phone"]').fill('(03) 0000 0000');
  await p.locator('[data-field="biz-email"]').fill('quotes@example.com');
  const labour=p.locator('[data-field="labour"]');
  if(!(await labour.isVisible().catch(()=>false))){await p.getByRole('button',{name:/Labour, markup/}).first().click().catch(()=>{});await p.waitForTimeout(300)}
  if(await labour.isDisabled()){await p.getByRole('button',{name:/labour, markup and GST/i}).first().click();await p.waitForTimeout(300)}
  await labour.fill('3'); await p.locator('[data-field="markup"]').fill('25'); await p.waitForTimeout(300);
  const save=p.getByRole('button',{name:/Save prices/}); if(await save.isEnabled().catch(()=>false)){await save.click();await p.waitForTimeout(400)}
  await tab(p,'Build');
}
