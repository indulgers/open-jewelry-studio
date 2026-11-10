/** Browser evidence from real before/after builds. No generated artwork or
 * screenshot-size heuristics: verify the actual scene objects and transforms. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const mode=process.env.REVIEW_MODE??'after';
const origin=process.env.STUDIO_URL??'http://127.0.0.1:5179';
const output=`artifacts/stonefirst-regression/${mode}`;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],consoleErrors=[],failedRequests=[],report={mode,commit:process.env.SOURCE_COMMIT,cases:[],errors,consoleErrors,failedRequests};
page.on('pageerror',e=>errors.push(e.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('response',response=>{if(response.status()>=400)failedRequests.push({url:response.url(),status:response.status()});});
async function flushScene(){
 return page.evaluate(async()=>{
  const { _roots }=await import('/node_modules/.vite/deps/@react-three_fiber.js');
  const canvas=document.querySelector('.stone-first-canvas canvas');
  const root=_roots.get(canvas);
  if(!root)throw Error('Missing real R3F canvas root');
  // Pause endless animation for software-GPU review, without changing geometry,
  // material, lighting or the genuine onBeforeRender gemstone shaders.
  for(const {store} of _roots.values())store.getState().setFrameloop('never');
  const state=root.store.getState();
  state.gl.render(state.scene,state.camera);state.gl.getContext().finish();
  const meshes=[],instances=[];
  state.scene.traverse(o=>{
   if(o.isMesh)meshes.push({name:o.name,positions:o.geometry.attributes.position?.count});
   if(o.isInstancedMesh){
    const a=o.instanceMatrix.array;
    for(let i=0;i<o.count;i++)instances.push({position:[a[i*16+12],a[i*16+13],a[i*16+14]],scale:Math.hypot(a[i*16],a[i*16+1],a[i*16+2])});
   }
  });
  return {meshes,instances,camera:state.camera.position.toArray(),status:document.querySelector('.stone-first-canvas')?.dataset.solidStatus};
 });
}
try{
 await page.goto(origin+'/#/stonefirst',{waitUntil:'networkidle',timeout:60000});
 await page.locator('.stone-first-canvas canvas').waitFor({timeout:60000});
 await page.addStyleTag({content:'.stone-first-canvas{height:500px!important}.stone-first-preview{position:static!important}'});
 await page.waitForFunction(()=>['fused','fragmented','error'].includes(document.querySelector('.stone-first-canvas')?.dataset.solidStatus),null,{timeout:120000});
 await flushScene();
 const cases=await page.evaluate(async()=>{
   const {recipeDesign}=await import('/src/stone-first/recipe.ts');
   const ids=['floral-pave','floral-solitaire','architectural-halo','flowing-shoulder','geometry-eternity','leaf-nodes'];
   return [...ids.map(id=>({id,design:recipeDesign(id)})),{id:'nine-stone',design:{...recipeDesign('floral-pave'),setting:'graduated'}}];
 });
 for(const item of cases){
  await page.locator('input[type=file]').setInputFiles({name:item.id+'.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(item.design))});
  await page.waitForTimeout(150);
  await page.waitForFunction(()=>['fused','fragmented','error'].includes(document.querySelector('.stone-first-canvas')?.dataset.solidStatus),null,{timeout:120000});
  const entry={id:item.id,design:item.design,frames:[]};
  report.cases.push(entry);
  const views=item.id==='floral-pave'?[['overall','整体'],['side','镶座侧面'],['top','戒面俯视']]:item.id==='nine-stone'?[['overall','整体'],['side','镶座侧面']]:[['overall','整体']];
  for(const [view,label] of views){
   await page.getByRole('button',{name:label,exact:true}).click();
   await page.waitForTimeout(120);
   await flushScene();
   const frame=await flushScene();
   frame.view=view;frame.statusText=await page.locator('.stone-fusion-status').innerText();
   frame.expected=await page.evaluate(async d=>{
    const {buildStoneLayout}=await import('/src/stone-first/recipe.ts');
    return buildStoneLayout(d).filter(s=>s.kind==='accent').map(s=>({position:[s.x,s.y,s.z],scale:s.diameter/2}));
   },item.design);
   const name=`${item.id}-${view}.png`;
   await page.locator('.stone-first-preview').screenshot({path:`${output}/${name}`,timeout:90000,animations:'disabled'});
   frame.image=name;entry.frames.push(frame);
   console.log(mode,item.id,view,frame.status,'stones',frame.instances.length);
   await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
   if(mode==='after'){
    if(!frame.meshes.some(m=>m.name.includes('metal')))throw Error(item.id+': blank metal preview');
    if(frame.instances.length!==frame.expected.length)throw Error(item.id+': lost accent instances');
    for(let i=0;i<frame.instances.length;i++){
      const a=frame.instances[i],b=frame.expected[i];
      if(Math.abs(a.scale-b.scale)>1e-5||a.position.some((v,j)=>Math.abs(v-b.position[j])>1e-5))throw Error(item.id+': invalid mounted gem matrix '+i);
    }
    if(frame.status!=='fused')throw Error(item.id+': default geometry not validated: '+frame.statusText);
   }
  }
 }
 if(errors.length)throw Error('Browser exceptions: '+errors.join('; '));
}catch(error){
 report.failure=String(error);
 report.failureBody=await page.locator('body').innerText().catch(()=>'(unavailable)');
 await page.screenshot({path:`${output}/failure.png`,timeout:15000}).catch(()=>{});
 console.error(JSON.stringify(report,null,2));
 throw error;
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
