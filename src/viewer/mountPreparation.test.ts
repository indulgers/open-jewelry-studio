import {BoxGeometry,DoubleSide,Ray,Vector3} from 'three';
import {afterEach,expect,it,vi} from 'vitest';
import {bakeMetalOcclusion,createMountGeometry} from './mountGeometry';
import {buildMountData,packMetal,restoreMountData,type MetalInput,type MountData} from './mountPreparationData';
import {prepareMount} from './prepareMount';

afterEach(()=>vi.unstubAllGlobals());
it('keeps the original occlusion samples and mount intersections across the worker boundary',()=>{
  const base=new BoxGeometry(1,.1,1),lid=new BoxGeometry(2,.1,2);lid.translate(0,.13,0);
  const sources=[base,lid],original=createMountGeometry(sources);
  const expected=sources.map(g=>bakeMetalOcclusion(g,original.tree,.14,6));
  const packed=sources.map(packMetal);
  const transferred=structuredClone(packed,{transfer:packed.flatMap(p=>[p.position.buffer,p.normal!.buffer,p.index!.buffer]) as ArrayBuffer[]});
  expect(base.getAttribute('position').array.byteLength).toBeGreaterThan(0);
  const result=buildMountData(transferred),restored=restoreMountData(result,sources);
  result.occlusion.forEach((data,i)=>expect([...data]).toEqual([...expected[i]]));
  const ray=new Ray(new Vector3(0,2,0),new Vector3(0,-1,0));
  expect(restored.tree.raycastFirst(ray,DoubleSide)?.distance).toBeCloseTo(original.tree.raycastFirst(ray,DoubleSide)!.distance,10);
  sources.forEach((g,i)=>expect([...g.getAttribute('localOcclusion').array]).toEqual([...expected[i]]));
  original.dispose();restored.dispose();sources.forEach(g=>g.dispose());
});
it('reuses completed preparation and terminates unfinished jobs when a ring is replaced',async()=>{
  class WorkerStub{
    static instances:WorkerStub[]=[];
    onmessage:((event:MessageEvent<{type:'ready';data:MountData}>)=>void)|null=null;onerror:(()=>void)|null=null;
    inputs:MetalInput[]=[];terminate=vi.fn();
    constructor(){WorkerStub.instances.push(this)}
    postMessage(inputs:MetalInput[],transfer:ArrayBuffer[]){this.inputs=structuredClone(inputs,{transfer})}
  }
  vi.stubGlobal('Worker',WorkerStub);
  const source={},geometry=new BoxGeometry(),first=prepareMount(source,[geometry]),worker=WorkerStub.instances[0];
  const data=buildMountData(worker.inputs);worker.onmessage!({data:{type:'ready',data}} as MessageEvent);
  expect(await first.result).toBe(data);expect(worker.terminate).toHaveBeenCalledOnce();
  expect(await prepareMount(source,[geometry]).result).toBe(data);expect(WorkerStub.instances).toHaveLength(1);
  const next=prepareMount({},[geometry]);const rejected=expect(next.result).rejects.toThrow('已取消');next.cancel();
  await rejected;expect(WorkerStub.instances[1].terminate).toHaveBeenCalledOnce();geometry.dispose();
});
