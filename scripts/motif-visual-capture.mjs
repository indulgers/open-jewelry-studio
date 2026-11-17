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
  await page.locator('.motif-fusion-panel button').click();
  await page.waitForFunction(()=>/金属布尔初筛(通过|未通过|失败)/.test(document.querySelector('.motif-status')?.textContent??''),null,{timeout:90000});
  const fusionMessage=await page.locator('.motif-status').textContent();
  console.log('Metal fusion browser report:',fusionMessage);
  if(!fusionMessage?.includes('通过'))throw new Error('Browser metal Boolean screening failed: '+fusionMessage);
  await capture('06-ring-manifold-fused');
  await page.locator('.motif-view-tools button').filter({hasText:'指孔'}).click();
  await capture('03-ring-bore');
  await page.locator('.motif-part-list button').last().click();
  await capture('04-ring-shank-isolated');
  await page.locator('.motif-all-parts').click();
  await page.locator('.motif-product-toggle button').first().click();
  await page.locator('.motif-choices button').nth(3).click();
  await page.locator('.motif-view-tools button').filter({hasText:'正面'}).click();
  await capture('05-butterfly-necklace');
  // Two close-up crops, taken from the actual WebGL viewport.
  await page.locator('.motif-visual canvas').hover();
  await page.mouse.wheel(0,-380);
  await delay(900);
  await page.locator('.motif-visual').screenshot({path:dest+'/07-butterfly-inlay-detail.png'});
  await page.locator('.motif-choices button').first().click();
  await ready3D();
  await page.locator('.motif-visual').screenshot({path:dest+'/08-clover-nacre-detail.png'});
  // V0.4 acceptance — six independent setting grammars, not six material swatches.
  const names=[
    '09-carnelian-beaded-ring','10-malachite-beaded-ring','11-sunburst-engraved-ring',
    '12-diamond-cluster-ring','13-five-petal-pave-ring','14-mirror-petal-necklace',
  ];
  const expected=['彩石嵌片','彩石嵌片','放射雕纹','钻石花簇','花瓣密钉','立体花瓣'];
  for(let i=0;i<names.length;i++){
    await page.locator('.motif-preset-card').nth(i).click();
    await page.locator('.motif-view-tools button').filter({hasText:'45°'}).click();
    await ready3D();
    const spec=await page.locator('.motif-setting-spec strong').textContent();
    if(spec!==expected[i])throw new Error('Wrong technique '+names[i]+': '+spec);
    if(i===3||i===4){
      const countText=await page.locator('.motif-setting-spec span').textContent();
      if(!countText?.includes('独立镶座'))throw new Error('Missing independent gem seats: '+countText);
    }
    await page.screenshot({path:dest+'/'+names[i]+'.png',animations:'disabled'});
    console.log('Recipe visual check',names[i],expected[i]);
  }
  // Every wearable choice is a separate geometry configuration.
  await page.locator('.motif-preset-card').nth(4).click();
  await page.locator('.motif-wear-styles button').filter({hasText:'分叉肩位'}).click();
  await capture('15-split-shank-design');
  await page.locator('.motif-wear-styles button').filter({hasText:'戒臂侧石'}).click();
  await capture('16-pave-shoulder-design');
  await page.locator('.motif-preset-card').nth(5).click();
  await page.locator('.motif-wear-styles button').filter({hasText:'双侧连接'}).click();
  await capture('17-side-attached-sculpted-necklace');
  writeFileSync(dest+'/browser-errors.json',JSON.stringify(errors,null,2));
  if(errors.length)throw new Error('Browser page errors: '+errors.join(' | '));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
