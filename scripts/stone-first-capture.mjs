import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('artifacts/stone-first',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1500,height:940},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER_CONSOLE_ERROR',msg.text());});
try{
 await page.goto('http://127.0.0.1:5179/#/stonefirst',{waitUntil:'networkidle',timeout:40000});
 await page.getByText('镶嵌优先的珠宝 DIY').waitFor();
 await page.locator('.stone-first-canvas canvas').waitFor({timeout:25000});
 const overlay=await page.locator('vite-error-overlay').count();
 if(overlay){
   const detail=await page.locator('vite-error-overlay').first().evaluate(el=>el.shadowRoot?.textContent?.slice(0,7000)||'No error detail');
   console.log('VITE_ERROR_OVERLAY',detail);
   throw new Error('Vite dev compile error: '+detail.slice(0,1200));
 }
 const webgl=await page.evaluate(()=>{
  const c=document.querySelector('.stone-first-canvas canvas');
  return Boolean(c?.getContext('webgl2')||c?.getContext('webgl'));
 });
 console.log('WEBGL_PRESENT='+webgl);
 if(!webgl)throw Error('WebGL unavailable in headless Chromium');
 const recipes=[['floral-solitaire','四瓣主钻戒'],['floral-pave','花瓣密镶戒'],['architectural-halo','建筑几何镶嵌']];
 const target=process.env.STONE_RECIPE;
 if(target&&!recipes.some(([id])=>id===target))throw Error('Unknown visual test recipe: '+target);
 for(const [id,label] of recipes.filter(([id])=>!target||id===target)){
  // The recipes live in step 1. Reset the step before switching.
  await page.getByRole('button',{name:/戒指结构原型/}).click();
  await page.getByRole('button',{name:new RegExp(label)}).click();
  // A canvas can be non-empty while the metal has failed to fuse. Do not
  // accept such screenshots as successful jewelry geometry.
  await page.waitForFunction(()=>{
    const status=document.querySelector('.stone-first-canvas')?.getAttribute('data-solid-status');
    return status==='fused'||status==='fragmented'||status==='error';
  },null,{timeout:90000});
  const solidStatus=await page.locator('.stone-first-canvas').getAttribute('data-solid-status');
  const detail=await page.locator('.stone-fusion-status').innerText();
  console.log('SOLID_STATUS='+id+':'+solidStatus+' / '+detail);
  if(solidStatus!=='fused')throw Error('Metal is not one closed fused body: '+detail);
  const views=[['overall','整体'],['top','戒面俯视'],['side','镶座侧面'],['macro','镶钻特写']];
  for(const [view,name] of views){
   await page.getByRole('button',{name,exact:true}).click();
   let bytes=Buffer.alloc(0);
   for(let attempt=1;attempt<=4;attempt++){
     await page.waitForTimeout(1200);
     const png=await page.locator('.stone-first-canvas canvas').evaluate(canvas=>{
       if(!(canvas instanceof HTMLCanvasElement))throw Error('No canvas');
       const data=canvas.toDataURL('image/png');
       if(!data.startsWith('data:image/png;base64,'))throw Error('Canvas image is empty');
       return data;
     },{timeout:60000});
     bytes=Buffer.from(png.slice('data:image/png;base64,'.length),'base64');
     console.log('RENDER_ATTEMPT='+id+'/'+view+'/'+attempt+' BYTES='+bytes.length);
     if(bytes.length>=15000)break;
   }
   // Keep even a bad frame as evidence. Hiding empty screenshots made failures
   // impossible to investigate and falsely suggested no image was generated.
   await writeFile('artifacts/stone-first/'+id+'-'+view+'.png',bytes);
   if(bytes.length<15000)throw Error('Rendered '+id+' '+view+' image remains blank: '+bytes.length);
   console.log('SCREENSHOT='+id+'/'+view+' BYTES='+bytes.length);
  }
 }
 if(errors.length)throw Error('Browser JavaScript exceptions: '+errors.join('; '));
 console.log('CAPTURE_SUCCESS');
}finally{await browser.close();}
