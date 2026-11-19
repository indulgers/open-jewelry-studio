// @vitest-environment node
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createServer,type ViteDevServer} from 'vite';
import {modelAdmin} from './server';

const cloud=vi.hoisted(()=>({enabled:false,handler:vi.fn()}));
vi.mock('./cloud-store.ts',()=>({cloudStore:()=>cloud.enabled?{}:undefined}));
vi.mock('./cloud-admin.ts',()=>({cloudAdmin:cloud.handler}));

let root:string,server:ViteDevServer|undefined;
beforeEach(async()=>{
  root=await mkdtemp(join(tmpdir(),'jewelry-quote-'));
  vi.stubEnv('XIANGYAN_MODEL_DIR',join(root,'storage'));
});
afterEach(async()=>{
  await server?.close();
  server=undefined;
  cloud.enabled=false;
  vi.unstubAllEnvs();
  await rm(root,{recursive:true,force:true});
});
async function serve(){
  server=await createServer({root,configFile:false,plugins:[modelAdmin()],logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false}});
  await server.listen();
  const {port}=server.httpServer!.address() as AddressInfo;
  return 'http://127.0.0.1:'+port+'/api/model-admin/public/';
}
it('serves local quotes for the published revision at the same API used in production',async()=>{
  const id='11111111-1111-1111-1111-111111111111',revision='22222222-2222-2222-2222-222222222222';
  const directory=join(root,'public/models/managed');
  await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'index.json'),JSON.stringify([{id,revision,pricing:{base:2000,head:3.15,band:0,pave:0}}]));
  const base=await serve();
  const response=await fetch(base+id+'/'+revision+'/quote');
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({version:revision,currency:'CNY',amount:2003.15});
  expect((await fetch(base+id+'/'+id+'/quote')).status).toBe(409);
});
it('forwards the selected component IDs and revisions to the cloud quote endpoint in development',async()=>{
  cloud.enabled=true;
  vi.stubEnv('XIANGYAN_ADMIN_PASSWORD','temporary-test-password');
  cloud.handler.mockImplementation(async(request:Request)=>Response.json(Object.fromEntries(new URL(request.url).searchParams)));
  const base=await serve();
  const parts={head:'ring-02',band:'ring-petal',headRevision:'head-v1',bandRevision:'band-v3'};
  const response=await fetch(base+'combination-quote?'+new URLSearchParams(parts));
  expect(await response.json()).toEqual(parts);
});
