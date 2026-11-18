import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright-core';

const origin='http://127.0.0.1:5188';
const directory='visual-artifacts';
mkdirSync(directory,{recursive:true});
const server=spawn('npm',['run','dev','--','--port','5188','--strictPort'],{
  stdio:'inherit',env:{...process.env,XIANGYAN_MODEL_DIR:mkdtempSync(join(tmpdir(),'studio-acceptance-'))},
});
let browser,page;
async function capture(name){await page.screenshot({path:join(directory,name+'.png')});}
try{
  for(let step=0;step<100;step++){
    if(await fetch(origin).then(r=>r.ok).catch(()=>false))break;
    await delay(400);
  }
  const executablePath=['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
  assert.ok(executablePath,'Install Chromium for visual acceptance');
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  page.setDefaultTimeout(35000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // The clean local store starts empty. Seed the published catalog response only;
  // preview geometry, account, uploads, private saves and orders use the actual app.
  await page.route('**/models/managed/index.json',route=>route.fulfill({json:[
    {id:'ring-02',revision:'review',name:'围钻戒指',catalogId:'ring-02',featured:true,collection:'相映系列',
     image:'/media/diy/ring-02.jpg',campaign:'/media/campaign/halo-on-model.jpg',pricing:{base:2180,head:0,band:0,pave:0}},
  ]}));
  await page.goto(origin);
  await page.getByRole('button',{name:'原款图'}).waitFor();
  await page.locator('.hero-photo img').evaluate(img=>img.decode());
  await capture('01-home');
  await page.getByRole('button',{name:'原款图'}).click();
  await page.locator('.hero-photo img').evaluate(img=>img.decode());
  assert.match(await page.locator('.hero-photo img').getAttribute('src'),/ring-02.jpg$/);
  await page.goto(origin+'/#/my-designs');
  await page.getByRole('button',{name:'创建消费者账号'}).click();
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
  await page.goto(origin+'/#/community');
  await page.getByRole('button',{name:'申请同款'}).click();
  await page.getByText(/已提交同款申请，编号/).waitFor();
  await capture('02-community');
  await page.goto(origin+'/#/my-designs');
  await page.getByText('待人工核价',{exact:true}).waitFor();
  const orders=await page.request.get(origin+'/api/model-admin/community/orders');
  assert.equal((await orders.json()).length,1);
  await page.goto(origin+'/#/stonefirst/combine/ring-02');
  const save=page.getByRole('button',{name:'保存设计',exact:true});
  await save.waitFor({timeout:90000});
  await page.waitForFunction(()=>document.querySelector('.community-save-control button:not(:disabled)'),{},{timeout:90000});
  await capture('03-editor');
  await save.click();
  await page.getByLabel('作品名称').fill('围钻定制快照');
  await page.getByRole('button',{name:'保存到我的设计'}).click();
  await page.getByText(/已私密保存/).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+'/#/diy/fit');
  await page.getByLabel('身高（cm）').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile overflow');
  await capture('04-mobile-fit');
  assert.deepEqual(errors,[],'uncaught browser errors');
} catch(error){
  if(page)await capture('failure').catch(()=>{});
  throw error;
} finally{
  if(browser)await browser.close();
  server.kill();
}
