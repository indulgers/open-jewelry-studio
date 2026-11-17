import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright-core';

const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/snap/bin/chromium'].find(existsSync);
if(!chrome)throw new Error('Chromium/Chrome not installed on CI runner');
const dest='visual-artifacts';mkdirSync(dest,{recursive:true});
const port=5189;
const server=spawn('npm',['run','dev','--','--port',String(port)],{stdio:'inherit'});
let browser;
try{
  let ready=false;
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)throw new Error('Vite dev server exited unexpectedly');
    try{const r=await fetch('http://127.0.0.1:'+port+'/');if(r.ok){ready=true;break}}catch{}
    await delay(300);
  }
  if(!ready)throw new Error('Vite dev server did not start');
  browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1450,height:950},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:'+port+'/#/motif-case',{waitUntil:'domcontentloaded'});
  await page.locator('.motif-product-toggle button').first().waitFor({timeout:30000});
  await page.locator('canvas').waitFor({timeout:30000});
  const ready3D=async()=>{
    await page.waitForFunction(()=>!document.querySelector('.motif-loader'),null,{timeout:30000});
    await delay(1400);
  };
  const capture=async(name)=>{
    await ready3D();
    await page.screenshot({path:dest+'/'+name+'.png',animations:'disabled'});
    console.log('Captured',name);
  };
  await page.locator('.motif-view-tools button').filter({hasText:'正面'}).click();
  await capture('01-necklace-front');
  await page.locator('.motif-product-toggle button').nth(1).click();
  await page.locator('.motif-view-tools button').filter({hasText:'45°'}).click();
  await capture('02-ring-angle');
  await page.locator('.motif-view-tools button').filter({hasText:'指孔'}).click();
  await capture('03-ring-bore');
  await page.locator('.motif-part-list button').last().click();
  await capture('04-ring-shank-isolated');
  await page.locator('.motif-all-parts').click();
  await page.locator('.motif-product-toggle button').first().click();
  await page.locator('.motif-choices button').nth(3).click();
  await page.locator('.motif-view-tools button').filter({hasText:'正面'}).click();
  await capture('05-butterfly-necklace');
  writeFileSync(dest+'/browser-errors.json',JSON.stringify(errors,null,2));
  if(errors.length)throw new Error('Browser page errors: '+errors.join(' | '));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
