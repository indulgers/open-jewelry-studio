// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {DoubleSide,Matrix4,Ray,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {firstMeshGeometry,girdle} from '../../geometry/productGeometry';
import {jewelryModelLoader} from '../../viewer/modelLoader';
import {createReferenceLibrary} from './part-library';
import assets from './part-assets.json';
import {ATELIER_GEMS} from '../../assets/atelierManifest';
import {fitCenterSetting} from './center-setting';

const bvhOptions={indirect:true,setBoundingBox:false};
const read=async(url:string)=>Uint8Array.from(readFileSync('public'+url)).buffer;
async function loadCut(name:string){
  const {scene}=await jewelryModelLoader().parseAsync(await read('/models/atelier/gems/'+name+'.glb'),'');
  return firstMeshGeometry(scene);
}

it('reseats real heads for triangular and pear cuts from the smallest to the largest size',async()=>{
  const library=createReferenceLibrary(read);
  const cuts=await Promise.all(['wide-triangle','pear'].map(loadCut));
  const identity=new Matrix4();
  try{
    for(const id of Object.keys(assets)){
      const {stock}=await library.load(id,'ring-floral');
      const original=fitCenterSetting(stock,undefined,1);
      expect(original.metal).toBe(stock.metal);
      expect(original.stones).toBe(stock.stones);
      for(const [index,cut] of cuts.entries())for(const carat of [.75,1,3]){
        const label=[id,index,carat].join(' ');
        const fitted=fitCenterSetting(stock,cut,Math.cbrt(carat));
        try{
          expect(fitted.issue,label).toBe('');
          const gem=fitted.stones.find(stone=>stone.zone==='center')!;
          const tree=new MeshBVH(gem.geometry,bvhOptions);
          const supports=fitted.metal.filter((part,i)=>part!==stock.metal[i]);
          expect(supports.length,label).toBeGreaterThan(0);
          for(const part of supports){
            expect(part.headMetal,label).toBe(true);
            const relative=new Matrix4().copy(gem.matrix).invert().multiply(new Matrix4().makeTranslation(0,part.offsetY??0,0));
            part.geometry.boundsTree=new MeshBVH(part.geometry,bvhOptions);
            const gap=tree.closestPointToGeometry(part.geometry,relative,undefined,undefined,.004)!.distance;
            expect(gap,label+' '+part.name).toBeLessThan(.012);
            const base=stock.metal.find(other=>other.name===part.name)!;
            expect(part.geometry.boundingBox!.min.y,label).toBeCloseTo(base.geometry.boundingBox!.min.y,4);
          }
          for(const part of supports){
            const base=stock.metal.find(other=>other.name===part.name)!;
            for(const accent of stock.stones.filter(s=>s.zone!=='center')){
              const relative=new Matrix4().makeTranslation(0,-(part.offsetY??0),0).multiply(accent.matrix);
              const box=accent.geometry.boundingBox!.clone().applyMatrix4(relative);
              if(!part.geometry.boundingBox!.intersectsBox(box))continue;
              const before=base.geometry.boundsTree??=new MeshBVH(base.geometry,bvhOptions);
              if(!before.intersectsGeometry(accent.geometry,relative)){
                expect(part.geometry.boundsTree!.intersectsGeometry(accent.geometry,relative),label+' '+part.name+' vs '+accent.name).toBe(false);
              }
            }
          }
          for(const stone of fitted.stones.filter(s=>s.zone!=='center')){
            expect(stock.stones).toContain(stone);
            expect(tree.intersectsGeometry(stone.geometry,identity.copy(gem.matrix).invert().multiply(stone.matrix)),label+' '+stone.name).toBe(false);
          }
        }finally{fitted.dispose();}
      }
    }
  }finally{library.dispose();cuts.forEach(cut=>cut.dispose());}
},120000);

it('keeps each floral claw visible on the crown and in contact for every offered cut',async()=>{
  const library=createReferenceLibrary(read);
  try{
    const {stock}=await library.load('ring-floral','ring-floral');
    for(const cut of ATELIER_GEMS){
      const shape=await loadCut(cut.id);
      try{
        for(const carat of [.75,3]){
          const result=fitCenterSetting(stock,shape,Math.cbrt(carat));
          try{
            const label=cut.id+' '+carat;
            expect(result.issue,label).toBe('');
            const gem=result.stones.find(s=>s.zone==='center')!.geometry;
            const box=gem.boundingBox!,waist=girdle(gem,box),ray=new Ray(new Vector3(),new Vector3(0,-1,0));
            const tree=new MeshBVH(gem,bvhOptions);
            for(const name of ['metal_644','metal_647','metal_650','metal_653']){
              const p=result.metal.find(part=>part.name===name)!.geometry.getAttribute('position');
              let exposed=false,contact=false;
              for(let i=0;i<p.count&&!(exposed&&contact);i++){
                const y=p.getY(i);
                if(y<waist)continue;
                ray.origin.set(p.getX(i),box.max.y+1,p.getZ(i));
                const hit=tree.raycastFirst(ray,DoubleSide);
                if(!hit)continue;
                const clearance=y-hit.point.y;
                exposed ||= clearance>0;
                contact ||= Math.abs(clearance)<.008;
              }
              expect(exposed&&contact,label+' '+name+' must visibly grip the cut').toBe(true);
            }
          }finally{result.dispose();}
        }
      }finally{shape.dispose();}
    }
  }finally{library.dispose();}
},120000);

it('preserves the source geometry and reports unsupported heads explicitly',async()=>{
  const library=createReferenceLibrary(read);
  try{
    const {stock}=await library.load('ring-floral','ring-petal');
    const bandOnly={...stock,metal:stock.metal.filter(part=>!part.headMetal)};
    expect(fitCenterSetting(bandOnly,undefined,Math.cbrt(3)).issue).toContain('缺少可识别的主石镶位');
    const center=stock.stones.find(s=>s.zone==='center')!;
    const original=center.geometry.getAttribute('position').array.slice();
    const resized=fitCenterSetting(stock,undefined,Math.cbrt(.75));
    expect(resized.issue).toBe('');
    expect(resized.stones.find(s=>s.zone==='center')!.geometry).not.toBe(center.geometry);
    resized.dispose();
    expect(center.geometry.getAttribute('position').array).toEqual(original);
    expect(fitCenterSetting(stock,undefined,1).metal).toBe(stock.metal);
  }finally{library.dispose();}
});
