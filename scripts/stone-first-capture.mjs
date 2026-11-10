import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('artifacts/stone-first',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1500,height:940},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5179/#/stonefirst',{waitUntil:'networkidle',timeout:40000});
 await page.getByText('镶嵌优先的珠宝 DIY').waitFor();
 await page.locator('.stone-first-canvas canvas').waitFor({timeout:25000});
 const webgl=await page.evaluate(()=>{
  const c=document.querySelector('.stone-first-canvas canvas');
  return Boolean(c?.getContext('webgl2')||c?.getContext('webgl'));
 });
 console.log('WEBGL_PRESENT='+webgl);
 if(!webgl)throw Error('WebGL unavailable in headless Chromium');
 for(const [id,label] of [['floral-solitaire','四瓣主钻戒'],['floral-pave','花瓣密镶戒'],['architectural-halo','建筑几何镶嵌']]){
  // The recipes live in step 1. Reset the step before switching.
  await page.getByRole('button',{name:/戒指结构原型/}).click();
  await page.getByRole('button',{name:new RegExp(label)}).click();
  await page.waitForTimeout(4500);
  const png=await page.locator('.stone-first-canvas canvas').evaluate(canvas=>{
    const el=canvas;
    if(!(el instanceof HTMLCanvasElement))throw Error('No canvas');
    const data=el.toDataURL('image/png');
    if(!data.startsWith('data:image/png;base64,'))throw Error('Canvas image is empty');
    return data;
  },{timeout:45000});
  const bytes=Buffer.from(png.slice('data:image/png;base64,'.length),'base64');
  if(bytes.length<15000)throw Error('Rendered image is likely blank: '+bytes.length);
  await writeFile('artifacts/stone-first/'+id+'.png',bytes);
  console.log('CANVAS_BYTES='+bytes.length);
  console.log('SCREENSHOT='+id);
 }
 if(errors.length)throw Error('Browser JavaScript exceptions: '+errors.join('; '));
 console.log('CAPTURE_SUCCESS');
}finally{await browser.close();}
