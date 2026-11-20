import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright-core';

const origin='http://127.0.0.1:5188';
const adminPassword=randomBytes(32).toString('hex');
const directory='visual-artifacts';
mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5188','--strictPort'],{
  stdio:'inherit',env:{...process.env,XIANGYAN_R2_ACCOUNT_ID:'',XIANGYAN_ADMIN_PASSWORD:adminPassword,XIANGYAN_MODEL_DIR:mkdtempSync(join(tmpdir(),'studio-acceptance-'))},
});
let browser,page;
async function capture(name){await page.screenshot({path:join(directory,name+'.png')});}
async function twoFrames(){
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

async function checkStorefrontStates(browser,width){
  const statePage=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  try{
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    await statePage.route('**/{managed,public}/index.json',async route=>{
      await gate;
      await route.continue();
    });
    await statePage.goto(origin+'/#/diy/collection',{waitUntil:'domcontentloaded'});
    await statePage.getByText('正在读取款式…',{exact:true}).waitFor({state:'attached'});
    const tile=statePage.locator('.gallery-loading .skeleton-photo').first();
    const before=await tile.boundingBox();
    await statePage.screenshot({path:join(directory,'collection-loading-'+width+'.png')});
    release();
    const realTile=statePage.locator('.diy-template-image').first();
    await realTile.waitFor();
    const after=await realTile.boundingBox();
    for(const key of ['x','y','width','height']){
      assert.ok(Math.abs(before[key]-after[key])<=1,'catalog '+width+' '+key+': '+before[key]+' => '+after[key]);
    }
    console.log('CATALOG_GEOMETRY',width,JSON.stringify({before,after}));
    const header=statePage.getByRole('banner');
    for(const name of ['登录','注册']){
      const bounds=await header.getByRole('link',{name,exact:true}).boundingBox();
      assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.height>=44,'visible account link '+name);
    }
    let fail=true;
    await statePage.route('**/community/works',route=>route.fulfill({
      status:fail?503:200,contentType:'application/json',body:fail?'{}':'[]',
    }));
    await statePage.goto(origin+'/#/community');
    await statePage.getByRole('heading',{name:'作品暂时无法读取'}).waitFor();
    fail=false;
    await statePage.getByRole('button',{name:'重新加载'}).click();
    const panel=statePage.locator('.shop-state-empty');
    const region=await panel.boundingBox();
    const action=panel.getByRole('link',{name:'上传第一件作品'});
    const button=await action.boundingBox();
    assert.ok(Math.abs(region.x+region.width/2-button.x-button.width/2)<=1,'centered empty action');
    assert.ok(await statePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page fits viewport');
    await statePage.screenshot({path:join(directory,'community-empty-'+width+'.png')});
    await action.click();
    await statePage.getByRole('button',{name:'登录',exact:true}).waitFor();
    await statePage.getByRole('navigation',{name:'账号入口'}).getByRole('link',{name:'注册账号'}).click();
    await statePage.getByRole('button',{name:'注册账号',exact:true}).waitFor();
    assert.ok(statePage.url().includes('upload=1'),'auth mode switch preserves the upload destination');
    await header.getByRole('link',{name:'登录',exact:true}).click();
    await statePage.getByRole('button',{name:'登录',exact:true}).waitFor();
    let showWork;
    const worksGate=new Promise(resolve=>{showWork=resolve;});
    await statePage.route('**/community/works',async route=>{
      await worksGate;
      await route.fulfill({json:[{id:'layout-check',title:'花冠侧影',image:'/media/diy/ring-floral.jpg',author:'相言工作室',published:true}]});
    });
    await statePage.goto(origin+'/#/community');
    await statePage.getByText('正在读取作品…',{exact:true}).waitFor({state:'attached'});
    const reserved=await statePage.locator('.gallery-loading .skeleton-photo').first().boundingBox();
    showWork();
    const picture=await statePage.getByRole('button',{name:'预览花冠侧影'}).boundingBox();
    for(const key of ['x','y','width','height']){
      assert.ok(Math.abs(reserved[key]-picture[key])<=1,'community '+width+' '+key+': '+reserved[key]+' => '+picture[key]);
    }
    console.log('COMMUNITY_GEOMETRY',width,JSON.stringify({reserved,picture}));
  }finally{await statePage.close();}
}

async function previewPixels(locator){
  return locator.evaluate(element=>{
    const sample=document.createElement('canvas');
    sample.width=96;sample.height=64;
    const context=sample.getContext('2d');
    context.drawImage(element,0,0,96,64);
    const {data}=context.getImageData(0,0,96,64);
    const shade=[];
    let chroma=0;
    let mass=0,moment=0;
    for(let n=0;n<data.length;n+=4){
      const ink=(255-(data[n]+data[n+1]+data[n+2])/3)*data[n+3]/255;
      chroma+=(Math.max(data[n],data[n+1],data[n+2])-Math.min(data[n],data[n+1],data[n+2]))*data[n+3]/255;
      shade.push(ink);mass+=ink;moment+=ink*((n/4)%96);
    }
    return {centroid:moment/mass,shade,chroma,aspect:(element.naturalWidth||element.width)/(element.naturalHeight||element.height)};
  });
}

// Weigh the jewelry itself and compare small patches to catch a washed-out center stone.
function compareInspectionFrame(moving,settled,mode){
  let worstLoss=0,totalError=0,mass=0;
  for(let y=0;y<64;y+=4)for(let x=0;x<96;x+=4){
    let reference=0,actual=0;
    for(let j=0;j<4;j++)for(let i=0;i<4;i++){
      const n=(y+j)*96+x+i;
      reference+=settled.shade[n];actual+=moving.shade[n];
      totalError+=Math.abs(moving.shade[n]-settled.shade[n]);mass+=settled.shade[n];
    }
    if(reference>16*24)worstLoss=Math.max(worstLoss,1-actual/reference);
  }
  console.log('DRAG_FIDELITY',JSON.stringify({mode,worstPatchLoss:worstLoss,relativeError:totalError/mass}));
  assert.ok(mass>0&&totalError/mass<(mode==='pan'?.09:.25),'visible jewelry must retain its appearance during '+mode);
  assert.ok(worstLoss<(mode==='pan'?.22:.48),'a shaded patch washed out during '+mode);
}

// The small preview above checks tone. Compare neighboring native pixels as
// well so a low-resolution render enlarged to the canvas cannot pass as sharp.
async function checkNativeDetail(canvas,held){
  return canvas.evaluate((element,held)=>{
    const c=document.createElement('canvas');
    c.width=element.width;c.height=element.height;
    const ctx=c.getContext('2d');ctx.drawImage(element,0,0);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    if(held){window.heldRingPixels=pixels;return;}
    const moving=window.heldRingPixels;
    delete window.heldRingPixels;
    if(moving.length!==pixels.length)throw Error('canvas changed size during drag');
    let motionEdge=0,restEdge=0,error=0,ink=0;
    const stride=4*c.width;
    for(let y=1;y<c.height;y++)for(let x=1;x<c.width;x++){
      const n=y*stride+x*4;
      for(let k=n;k<n+3;k++){
        motionEdge+=Math.abs(moving[k]-moving[k-4])+Math.abs(moving[k]-moving[k-stride]);
        restEdge+=Math.abs(pixels[k]-pixels[k-4])+Math.abs(pixels[k]-pixels[k-stride]);
        error+=Math.abs(pixels[k]-moving[k]);ink+=255-pixels[k];
      }
    }
    return {edgeRatio:motionEdge/restEdge,relativeError:error/ink};
  },held);
}
async function checkInspectionLayout(){
  const canvas=page.locator('.stone-first-preview canvas').first();
  await canvas.waitFor({state:'visible',timeout:90000});
  const drawing=await canvas.boundingBox();
  for(const control of [page.getByRole('group',{name:'戒指观察视角'}),page.getByRole('group',{name:'三维画布操作'})]){
    await control.waitFor({state:'visible',timeout:90000});
    const box=await control.boundingBox();
    assert.ok(box&&drawing&&box.y+box.height<=drawing.y+1,'canvas controls must precede the drawing');
  }
  return canvas;
}

async function checkDesktopInspection(){
  const canvas=await checkInspectionLayout();
  await canvas.scrollIntoViewIfNeeded();
  const box=await canvas.boundingBox();
  const x=box.x+box.width*.48,y=box.y+box.height*.48;
  await page.getByRole('button',{name:'平移',exact:true}).click();
  const before=await previewPixels(canvas);
  await page.mouse.move(x,y);await page.mouse.down();
  await page.evaluate(()=>{window.dragFrames=[];});
  await page.mouse.move(x+box.width*.08,y,{steps:32});
  await twoFrames();
  const frames=await page.evaluate(()=>{const result=window.dragFrames;window.dragFrames=null;return result;});
  assert.ok(frames.length>=2,'drag must render successive jewelry frames');
  const intervals=frames.slice(1).map((frame,i)=>frame.time-frames[i].time).sort((a,b)=>a-b);
  console.log('DRAG_PROFILE',JSON.stringify({frames:frames.length,medianMs:intervals[Math.floor(intervals.length*.5)],
    p95Ms:intervals[Math.ceil(intervals.length*.95)-1],scenePixels:frames.at(-1).pixels}));
  const surfacePixels=await canvas.evaluate(el=>el.width*el.height);
  assert.equal(frames.at(-1).pixels,0,'cached pan must avoid all jewelry draw calls');
  assert.equal(await canvas.getAttribute('data-inspection-frame'),'moving');
  assert.equal(await canvas.getAttribute('data-inspection-draw'),'cached-pan');
  const movingPan=await previewPixels(canvas);
  await capture('03-main-pan-held');
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.stone-first-preview canvas')?.dataset.inspectionFrame==='settled');
  await twoFrames();
  const panned=await previewPixels(canvas);
  compareInspectionFrame(movingPan,panned,'pan');
  assert.ok(panned.centroid>before.centroid+2,'primary drag must shift visible silver right');
  await page.mouse.move(x+box.width*.2,y);
  await page.mouse.wheel(0,-240);await twoFrames();
  const zoom=page.locator('.ring-inspection-zoom span');
  const magnification=Number.parseInt(await zoom.innerText(),10);
  assert.ok(magnification>100,'scroll wheel magnifies the current inspection angle');
  const enlarged=await previewPixels(canvas);
  assert.ok(enlarged.centroid<panned.centroid,'zooming at a point right of the ring must shift it left');
  await capture('03-editor-desktop-inspection');
  await page.getByRole('button',{name:'旋转',exact:true}).click();
  await page.mouse.move(x,y);await page.mouse.down();
  await page.evaluate(()=>{window.dragFrames=[];});
  await page.mouse.move(x+box.width*.06,y+box.height*.03,{steps:12});
  await twoFrames();
  await page.waitForFunction(()=>document.querySelector('.stone-first-preview canvas')?.dataset.inspectionDraw==='traced-motion');
  const rotation=await page.evaluate(()=>{const result=window.dragFrames;window.dragFrames=null;return result;});
  assert.ok(rotation.length>=2&&rotation.at(-1).pixels===surfacePixels);
  const times=rotation.slice(1).map((frame,i)=>frame.time-rotation[i].time).sort((a,b)=>a-b);
  console.log('ROTATE_PROFILE',JSON.stringify({frames:rotation.length,medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.ceil(times.length*.95)-1]}));
  assert.equal(await canvas.getAttribute('data-inspection-draw'),'traced-motion');
  await checkNativeDetail(canvas,true);
  const movingRotation=await previewPixels(canvas);
  await capture('03-main-rotation-held');
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.stone-first-preview canvas')?.dataset.inspectionFrame==='settled');
  const detail=await checkNativeDetail(canvas,false);
  console.log('NATIVE_ROTATION_DETAIL',JSON.stringify(detail));
  assert.ok(detail.edgeRatio>.85&&detail.edgeRatio<1.15&&detail.relativeError<.22,'native facet detail must match the settled view');
  compareInspectionFrame(movingRotation,await previewPixels(canvas),'rotation');
  await capture('03-main-rotation-settled');
  return canvas;
}

async function waitForCamera(){
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('.stone-first-preview canvas');
    return canvas?.dataset.inspectionFrame==='settled'&&!canvas.dataset.cameraTransition;
  });
}

async function checkAccentShimmer(){
  const canvas=await checkInspectionLayout();
  const reset=page.getByRole('button',{name:'复位当前视角',exact:true});
  await reset.click();await waitForCamera();
  await canvas.scrollIntoViewIfNeeded();
  const probe=await canvas.evaluateHandle(async element=>{
    const {createShimmerProbe}=await import('/scripts/measure-accent-shimmer.mjs');
    return createShimmerProbe(element);
  });
  const bounds=await canvas.boundingBox(),x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  async function replay(reference){
    await reset.click();await waitForCamera();
    await probe.evaluate((p,reference)=>p.begin(reference),reference);
    await page.mouse.move(x,y);await page.mouse.down();
    try{
      for(let step=1;step<=24;step++){
        await probe.evaluate((p,step)=>p.sample(step),step);
      }
      return await probe.evaluate(p=>p.result());
    }finally{
      await page.mouse.up();
      await page.waitForFunction(()=>document.querySelector('.stone-first-preview canvas')?.dataset.inspectionFrame==='settled');
    }
  }
  try{
    const reference=await replay(true),filtered=await replay(false);
    console.log('ACCENT_SHIMMER',JSON.stringify({reference,filtered}));
    for(const zone of ['halo','shoulder']){
      const before=reference[zone],after=filtered[zone];
      assert.ok(before.count>=100&&after.count===before.count,zone+' must track the same visible facet samples');
      assert.ok(after.p95<before.p95*.9,zone+' must reduce high-frequency brightness jumps');
      assert.ok(after.contrast>10&&after.contrast>=before.contrast*.65,zone+' must retain bright and dark facets');
    }
  }finally{
    await probe.evaluate(p=>p.dispose());
    await probe.dispose();
    await reset.click();await waitForCamera();
  }
}

async function checkTouchZoom(canvas){
  await canvas.scrollIntoViewIfNeeded();
  const box=await canvas.boundingBox();
  const x=box.x+box.width*.58,y=box.y+box.height*.45;
  const zoom=page.locator('.ring-inspection-zoom span');
  const before=Number.parseInt(await zoom.innerText(),10);
  const client=await page.context().newCDPSession(page);
  const touches=distance=>[{x:x-distance,y,id:1},{x:x+distance,y,id:2}];
  try{
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(28)});
    for(const gap of [34,41,48]){
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(gap)});
    }
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await twoFrames();
    assert.ok(Number.parseInt(await zoom.innerText(),10)>before,'a two-finger pinch must magnify the ring');
  }finally{
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await client.detach();
  }
}

async function assertCurrentSnapshot(canvas,save){
  const displayed=await previewPixels(canvas);
  assert.ok(Number.isFinite(displayed.centroid),'displayed frame contains jewelry');
  await save.click();
  const image=page.getByAltText('本次保存的设计预览');
  await image.evaluate(img=>img.decode());
  const stored=await previewPixels(image);
  assert.ok(Math.abs(stored.aspect-displayed.aspect)<.01,'saved frame retains the viewport aspect ratio');
  const mean=stored.shade.reduce((sum,v,i)=>sum+Math.abs(v-displayed.shade[i]),0)/stored.shade.length;
  assert.ok(mean<7,'saved jewelry matches the displayed frame including camera position');
}

try{
  for(let step=0;step<100;step++){
    if(await fetch(origin).then(r=>r.ok).catch(()=>false))break;
    await delay(400);
  }
  const executablePath=['/usr/bin/google-chrome','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
  assert.ok(executablePath,'Install Chromium for visual acceptance');
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const width of [1440,390,320])await checkStorefrontStates(browser,width);
  page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  page.setDefaultTimeout(35000);
  // Hold the next animation callback to verify a just-edited design cannot save an older frame.
  await page.addInitScript(()=>{
    const next=window.requestAnimationFrame.bind(window);
    let frameTime=0;
    const gl=WebGL2RenderingContext.prototype,areas=new WeakMap();
    const draw=gl.drawElements,viewport=gl.viewport;
    gl.viewport=function(x,y,width,height){
      areas.set(this,width*height);
      return viewport.call(this,x,y,width,height);
    };
    let lastSceneTime=-1,lastSceneArea=0;
    gl.drawElements=function(mode,count,type,offset){
      if(window.dragFrames&&count>12&&this.canvas.closest?.('.stone-first-preview')){
        lastSceneTime=frameTime;lastSceneArea=areas.get(this);
      }
      return draw.call(this,mode,count,type,offset);
    };
    const drawArrays=gl.drawArrays;
    gl.drawArrays=function(mode,first,count){
      const result=drawArrays.call(this,mode,first,count);
      if(window.dragFrames&&this.canvas.closest?.('.stone-first-preview')&&!this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)
        &&window.dragFrames.at(-1)?.time!==frameTime){
        window.dragFrames.push({time:frameTime,pixels:lastSceneTime===frameTime?lastSceneArea:0});
      }
      return result;
    };
    let held=false;
    window.requestAnimationFrame=callback=>next(function run(time){
      if(held)next(run);else {frameTime=time;callback(time);}
    });
    window.holdTestFrames=value=>{held=value;};
  });
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('button',{name:'原款图'}).waitFor();
  assert.equal(await page.getByLabel('网站风格').count(),0,'Maison has a single storefront identity');
  await page.locator('.diy-hero-art img').evaluate(img=>img.decode());
  await capture('01-home');
  await page.getByRole('button',{name:'原款图'}).click();
  await page.locator('.diy-hero-art img').evaluate(img=>img.decode());
  assert.match(await page.locator('.diy-hero-art img').getAttribute('src'),/ring-02.jpg$/);
  await page.getByRole('banner').getByRole('link',{name:'注册',exact:true}).click();
  await page.getByLabel('账号名').fill('studio_reviewer');
  await page.getByLabel('密码',{exact:true}).fill('local-test-account-only');
  await page.getByRole('button',{name:'注册账号',exact:true}).click();
  await page.getByRole('button',{name:'上传作品'}).click();
  await page.getByLabel('作品名称').fill('花冠侧影');
  await page.getByLabel('预览图',{exact:true}).setInputFiles('public/media/diy/ring-floral.jpg');
  await page.getByRole('button',{name:'私密保存作品'}).click();
  await page.getByText('仅自己可见',{exact:true}).waitFor();
  await page.getByRole('button',{name:'发布作品',exact:true}).click();
  await page.getByRole('button',{name:'确认发布'}).click();
  await page.getByText('已公开',{exact:true}).waitFor();
  await page.getByRole('button',{name:'退出登录'}).click();
  await page.getByRole('button',{name:'登录',exact:true}).waitFor();
  await page.goto(origin+'/#/community');
  await page.getByRole('button',{name:'预览花冠侧影'}).click();
  await page.getByRole('dialog',{name:'花冠侧影'}).getByRole('button',{name:'申请同款'}).click();
  const signIn=page.getByRole('dialog',{name:'登录后申请同款'});
  await signIn.getByLabel('账号名').fill('studio_reviewer');
  await signIn.getByLabel('密码',{exact:true}).fill('local-test-account-only');
  await signIn.getByRole('button',{name:'登录',exact:true}).click();
  await page.getByRole('dialog',{name:'确认同款申请'}).getByText('花冠侧影',{exact:true}).waitFor();
  await page.getByRole('button',{name:'确认提交申请'}).click();
  const receipt=page.getByRole('dialog',{name:'同款申请回执'});
  await receipt.getByText('待人工核价',{exact:true}).waitFor();
  await capture('02-community');
  await receipt.getByRole('link',{name:'查看这笔申请'}).click();
  await page.locator('.community-orders').getByText('待人工核价',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.activeElement?.id.startsWith('community-order-'));
  const adminContext=await browser.newContext();
  try{
    const staff=await adminContext.newPage();
    await staff.goto(origin+'/admin/');
    await staff.getByRole('button',{name:'设计社区'}).click();
    await staff.getByLabel('社区管理员口令').fill(adminPassword);
    await staff.getByRole('button',{name:'登录社区管理'}).click();
    await staff.locator('summary').filter({hasText:'花冠侧影'}).click();
    await staff.getByRole('button',{name:'受理申请'}).click();
    await staff.getByRole('button',{name:'填写报价'}).click();
    await staff.getByLabel('一件总价（人民币元）').fill('1688.50');
    await staff.getByLabel('款式配置与费用范围').fill('花冠侧影一件，含银托、配钻与镶嵌工费。');
    await staff.getByRole('button',{name:'发送报价'}).click();
    await staff.getByText('报价已发送。',{exact:true}).waitFor();
  }finally{await adminContext.close();}
  await page.reload();
  await page.getByRole('button',{name:'核对报价并下单'}).click();
  const quotation=page.getByRole('dialog',{name:'核对报价并下单'});
  await quotation.getByText('花冠侧影一件，含银托、配钻与镶嵌工费。').waitFor();
  await quotation.getByRole('button',{name:/确认按.*1,688\.50.*下单/}).click();
  await page.getByText('已下单 · 未支付',{exact:true}).waitFor();
  await page.reload();
  await page.getByText('已下单 · 未支付',{exact:true}).waitFor();
  const orders=await page.request.get(origin+'/api/model-admin/community/orders',{headers:{'X-Expected-Account':'studio_reviewer'}});
  assert.equal(orders.status(),200);
  const purchases=await orders.json();
  assert.equal(purchases.length,1);
  assert.equal(purchases[0].status,'已下单');
  assert.equal(purchases[0].quote.amountFen,168850);
  await page.goto(origin+'/#/stonefirst/ring-02');
  const save=page.getByRole('button',{name:'保存设计',exact:true});
  await save.waitFor({timeout:90000});
  await page.waitForFunction(()=>document.querySelector('.community-save-control button:not(:disabled)'),{},{timeout:90000});
  for(const [tab,openLabel,kind] of [['戒圈与铺钻','查看全部戒圈','band'],['戒头','查看全部戒头','head']]){
    await page.getByRole('button',{name:tab,exact:true}).click();
    await page.getByRole('button',{name:openLabel,exact:true}).click();
    const library=page.getByRole('dialog');
    const images=library.locator('.source-part-image img');
    assert.equal(await images.count(),7,'all stock parts have a '+kind+' view');
    for(const image of await images.all()){
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(async element=>{await element.decode();});
      assert.match(await image.getAttribute('src'),new RegExp('/part-views/[^/]+-'+kind+'\\.webp$'));
      assert.equal(await image.evaluate(element=>element.naturalWidth),256);
    }
    await library.getByRole('button',{name:'返回选款',exact:true}).click();
  }
  await page.getByRole('button',{name:'戒圈与铺钻',exact:true}).click();
  await page.getByRole('button',{name:'纤细戒圈',exact:true}).click();
  await page.getByText('39 颗宝石',{exact:true}).waitFor();
  await page.getByRole('button',{name:'戒头',exact:true}).click();
  await page.getByRole('button',{name:'1 ct',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.community-save-control button:not(:disabled)'));
  await page.getByRole('button',{name:'复位当前视角',exact:true}).click();
  await checkAccentShimmer();
  const canvas=await checkDesktopInspection();
  // Hold the session response across the paired events delivered when returning to the editor.
  const sessionRoute='**/community/session';
  let resumeRequests=0,releaseSession;
  const sessionGate=new Promise(resolve=>{releaseSession=resolve;});
  const holdSession=async route=>{resumeRequests++;await sessionGate;await route.continue();};
  await page.route(sessionRoute,holdSession);
  const mountedCanvas=await canvas.elementHandle();
  const scrollPosition=await page.evaluate(()=>window.scrollY);
  try{
    await Promise.all([page.waitForRequest(request=>request.url().endsWith('/community/session')),page.evaluate(()=>{
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    })]);
    await twoFrames();
    assert.ok(await mountedCanvas.isVisible(),'session refresh must keep the ring visible');
    assert.equal(await page.evaluate(()=>window.scrollY),scrollPosition);
    assert.equal(resumeRequests,1);
  }finally{
    const completed=page.waitForResponse(response=>response.url().endsWith('/community/session'));
    releaseSession();
    await completed;
    await page.unroute(sessionRoute,holdSession);
  }
  assert.ok(await canvas.evaluate((current,original)=>current===original,mountedCanvas));
  await waitForCamera();
  const originalFace=await previewPixels(canvas);
  await page.getByLabel('主石切形').selectOption('pear');
  await page.getByLabel('宝石类别').selectOption('培育钻石');
  await page.getByRole('button',{name:'粉色',exact:true}).click();
  await page.getByRole('button',{name:'1.5 ct',exact:true}).click();
  await page.getByRole('button',{name:'戒圈与铺钻',exact:true}).click();
  await page.getByRole('group',{name:'表面处理'}).getByRole('button',{name:'哑面'}).click();
  await page.waitForFunction(()=>document.querySelector('.community-save-control button:not(:disabled)'),{},{timeout:90000});
  await waitForCamera();
  assert.notDeepEqual((await previewPixels(canvas)).shade,originalFace.shade,'custom styling must change visible pixels');
  await capture('03-editor-pear-gem');
  await canvas.scrollIntoViewIfNeeded();
  const pinkBox=await canvas.boundingBox();
  const cx=pinkBox.x+pinkBox.width/2,cy=pinkBox.y+pinkBox.height/2;
  await page.mouse.move(cx,cy);await page.mouse.down();
  await page.mouse.move(cx+pinkBox.width*.025,cy+5,{steps:5});
  await twoFrames();
  await page.waitForFunction(()=>document.querySelector('.stone-first-preview canvas')?.dataset.inspectionDraw==='traced-motion');
  const pinkHeld=await previewPixels(canvas);
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.stone-first-preview canvas')?.dataset.inspectionFrame==='settled');
  const pinkSettled=await previewPixels(canvas);
  compareInspectionFrame(pinkHeld,pinkSettled,'pink-rotation');
  const chromaRatio=pinkHeld.chroma/pinkSettled.chroma;
  console.log('PINK_CHROMA_RATIO',chromaRatio);
  assert.ok(chromaRatio>.7&&chromaRatio<1.3,'pink stone must retain its color while rotating');
  await assertCurrentSnapshot(canvas,save);
  await page.getByLabel('作品名称').fill('围钻定制快照');
  await page.getByRole('button',{name:'保存到我的设计'}).click();
  await page.getByText(/已私密保存/).waitFor();
  const privateSnapshot=await page.request.get(origin+'/api/model-admin/community/mine',{headers:{'X-Expected-Account':'studio_reviewer'}});
  assert.equal(privateSnapshot.status(),200);
  const saved=(await privateSnapshot.json()).find(item=>item.title==='围钻定制快照');
  assert.equal(saved?.design?.styling?.cut,'pear');
  assert.equal(saved?.design?.styling?.gem,'grown-pink');
  assert.equal(saved?.design?.styling?.carat,1.5);
  assert.equal(saved?.published,false);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo(0,0));await twoFrames();
  const mobileCanvas=await checkInspectionLayout();
  await checkTouchZoom(mobileCanvas);
  await page.getByRole('button',{name:'镶嵌特写'}).click();await twoFrames();
  await capture('04-editor-mobile-detail');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile editor overflow');
  await page.goto(origin+'/#/stonefirst/precision/ring-02');
  await page.locator('[aria-label="戒指 02 三维预览"] canvas').waitFor({state:'visible',timeout:90000});
  await page.waitForFunction(()=>document.querySelector('.community-save-control button:not(:disabled)'),{},{timeout:90000});
  const precision=await checkInspectionLayout();
  await precision.scrollIntoViewIfNeeded();
  const bounds=await precision.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x+bounds.width*.6,bounds.y+bounds.height*.55,{steps:6});
  await page.waitForFunction(()=>document.querySelector('.stone-first-preview canvas')?.dataset.inspectionFrame==='moving');
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.stone-first-preview canvas')?.dataset.inspectionFrame==='settled');
  await page.getByLabel('刻字文字').fill('A & B');
  assert.ok(await save.isDisabled(),'unconfirmed engraving cannot be captured');
  await page.getByRole('button',{name:'简洁黑体'}).click();
  await page.evaluate(()=>window.holdTestFrames(true));
  try{
    await page.getByRole('button',{name:'确认刻字'}).dispatchEvent('click');
    assert.ok(await save.isDisabled(),'a new revision must wait for its own render before saving');
  }finally{await page.evaluate(()=>window.holdTestFrames(false));}
  await page.getByRole('button',{name:/查看内圈效果/}).click();
  await page.waitForFunction(()=>document.querySelector('.community-save-control button:not(:disabled)'),{},{timeout:90000});
  await twoFrames();
  await assertCurrentSnapshot(precision,save);
  await page.getByRole('button',{name:'返回编辑器'}).click();
  await page.goto(origin+'/#/diy/fit');
  await page.getByLabel('身高（cm）').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile overflow');
  await capture('05-mobile-fit');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(origin+'/#/stonefirst/ring-floral');
  await page.getByLabel('宝石类别').selectOption('培育钻石');
  await page.getByRole('button',{name:'粉色',exact:true}).click();
  for(const [cut,size,angle] of [['wide-triangle','原款大小','戒面俯视'],['pear','3+ ct','镶嵌特写']]){
    await page.getByLabel('主石切形').selectOption(cut);
    await page.getByRole('button',{name:size,exact:true}).click();
    await page.getByRole('button',{name:angle,exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.community-save-control button:not(:disabled)'),{},{timeout:90000});
    await twoFrames();
    await page.locator('.stone-first-preview canvas').screenshot({path:join(directory,'floral-setting-'+cut+'.png')});
  }
  assert.deepEqual(errors,[],'uncaught browser errors');
} catch(error){
  if(page){
    console.error('Failed page',page.url(), await page.locator('[role=alert]').allTextContents().catch(()=>[]));
    await capture('failure').catch(()=>{});
  }
  throw error;
} finally{
  if(browser)await browser.close();
  server.kill();
}
