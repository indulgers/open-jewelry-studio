import {readFileSync} from 'node:fs';
import {Box3,Matrix4,Texture,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RING02_MODEL,RING02_OVAL} from './assets';
import {createGemOptics} from '../../viewer/gemOptics';
import {describe,expect,it} from 'vitest';
import {BASE_DESIGN,REACHES,SIZES,ZONES,parseDesign,prepareTemplate,fitStones,buildMetal,findNewIntersection} from './model';

const position=(m:Matrix4)=>new Vector3().setFromMatrixPosition(m);

async function fixture() {
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const scene=async(url:string)=>(await loader.parseAsync(new Uint8Array(readFileSync('public'+url)).buffer,'')).scene;
  const [model,oval]=await Promise.all([scene(RING02_MODEL),scene(RING02_OVAL)]);
  return prepareTemplate(model,oval);
}

describe('ring 02 template',()=>{
  it('keeps the shipped model under the download budget and preserves each source stone position',async()=>{
    expect(readFileSync('public'+RING02_MODEL).byteLength).toBeLessThan(1_250_000);
    const source=new OBJLoader().parse(readFileSync('assets/source/ring-02/source.obj','utf8'));
    const oval=(await new GLTFLoader().parseAsync(new Uint8Array(readFileSync('public'+RING02_OVAL)).buffer,'')).scene;
    const original=fitStones(prepareTemplate(source,oval),BASE_DESIGN);
    const packed=fitStones(await fixture(),BASE_DESIGN);
    expect(packed.map(stone=>stone.name)).toEqual(original.map(stone=>stone.name));
    packed.forEach((stone,index)=>{
      expect(position(stone.matrix).distanceTo(position(original[index].matrix))).toBeLessThan(.001);
    });
  });

  it('creates refraction geometry from the actual compressed center stone',async()=>{
    const center=fitStones(await fixture(),BASE_DESIGN)[0];
    const environment=new Texture();
    try{
      const optics=createGemOptics(center.geometry,environment,'standard');
      optics.dispose();
    }finally{environment.dispose();}
  });

  it('recreates all 29 source stones and leaves the source dimensions unchanged by default',async()=>{
    const template=await fixture();
    const stones=fitStones(template,BASE_DESIGN);
    expect(stones.filter(s=>s.zone==='center')).toHaveLength(1);
    expect(stones.filter(s=>s.zone==='halo')).toHaveLength(16);
    expect(stones.filter(s=>s.zone==='shoulder')).toHaveLength(12);
    const size=new Box3().copy(stones[0].geometry.boundingBox!).applyMatrix4(stones[0].matrix).getSize(new Vector3());
    expect(size.x).toBeCloseTo(5.9527,3);
    expect(findNewIntersection(template,stones)).toBeUndefined();
  });

  it('moves halo seats for the oval center without stretching the halo stones',async()=>{
    const template=await fixture();
    const base=fitStones(template,BASE_DESIGN);
    const next=fitStones(template,{...BASE_DESIGN,center:{...BASE_DESIGN.center,cut:'oval'}});
    expect(next[0].geometry).not.toBe(base[0].geometry);
    const a=base[1],b=next[1];
    expect(position(b.matrix).distanceTo(position(a.matrix))).toBeGreaterThan(0.1);
    expect(b.matrix.getMaxScaleOnAxis()).toBeCloseTo(a.matrix.getMaxScaleOnAxis(),8);
    expect(findNewIntersection(template,next)).toBeUndefined();
  });

  it('edits both shoulders without moving the lower ring or changing the other stones',async()=>{
    const template=await fixture();
    const design={...BASE_DESIGN,reach:1.05 as const,shoulder:{...BASE_DESIGN.shoulder,cut:'oval' as const}};
    const base=fitStones(template,BASE_DESIGN);
    const next=fitStones(template,design);
    expect(next[0].matrix.equals(base[0].matrix)).toBe(true);
    expect(next[1].matrix.equals(base[1].matrix)).toBe(true);
    const left=next.find(s=>s.name==='gem_shoulder_negative_x_06')!;
    const right=next.find(s=>s.name==='gem_shoulder_positive_x_06')!;
    expect(position(left.matrix).x).toBeCloseTo(-position(right.matrix).x,2);
    expect(position(right.matrix).x).toBeGreaterThan(position(base.find(s=>s.name===right.name)!.matrix).x);
    const metal=buildMetal(template,design,next);
    const lower=metal.find(p=>p.name==='metal_lower_shank_shell')!;
    expect(lower.geometry).toBe(template.metal.find(p=>p.name===lower.name)!.geometry);
    metal.forEach(p=>{if(p.owned)p.geometry.dispose();});
  });

  it('supports each exposed cut and size from the original design',async()=>{
    const template=await fixture();
    for(const zone of ZONES){
      for(const cut of ['round','oval'] as const){
        for(const size of SIZES){
          const design={...BASE_DESIGN,[zone]:{...BASE_DESIGN[zone],cut,size}};
          expect(findNewIntersection(template,fitStones(template,design)),[zone,cut,size].join(' ')).toBeUndefined();
        }
      }
    }
    for(const reach of REACHES){
      expect(findNewIntersection(template,fitStones(template,{...BASE_DESIGN,reach})),String(reach)).toBeUndefined();
    }
  });

  it('replaces the upper mounting while keeping the original shank and its stones',async()=>{
    const template=await fixture();
    const original=fitStones(template,BASE_DESIGN);
    const originalMetal=buildMetal(template,BASE_DESIGN,original);
    for(const head of ['four-prong','bezel'] as const){
      const design={...BASE_DESIGN,head,center:{...BASE_DESIGN.center,cut:'oval' as const}};
      const stones=fitStones(template,design);
      const metal=buildMetal(template,design,stones);
      expect(stones.filter(stone=>stone.zone==='halo')).toHaveLength(0);
      expect(stones.filter(stone=>stone.zone==='shoulder').map(s=>s.matrix.toArray()))
        .toEqual(original.filter(stone=>stone.zone==='shoulder').map(s=>s.matrix.toArray()));
      expect(metal.find(p=>p.name==='metal_shank_with_shoulders')?.geometry)
        .toBe(originalMetal.find(p=>p.name==='metal_shank_with_shoulders')?.geometry);
      expect(metal.some(p=>p.name==='metal_crown_halo')).toBe(false);
      expect(metal.some(p=>p.name.startsWith(head==='bezel'?'head-bezel':'head-formed-prong'))).toBe(true);
      const rails=metal.filter(p=>p.name.startsWith('head-to-shank'));
      expect(rails).toHaveLength(4);
      const shank=metal.find(p=>p.name==='metal_shank_with_shoulders')!.geometry.clone();
      const gallery=metal.find(p=>p.name==='head-under-gallery')!.geometry;
      const surface=new MeshBVH(shank);
      const upper=new MeshBVH(gallery);
      for(const rail of rails){
        expect(surface.intersectsGeometry(rail.geometry,new Matrix4()),rail.name+' to shank').toBe(true);
        expect(upper.intersectsGeometry(rail.geometry,new Matrix4()),rail.name+' to gallery').toBe(true);
      }
      shank.dispose();
      expect(findNewIntersection(template,stones)).toBeUndefined();
      metal.forEach(p=>{if(p.owned)p.geometry.dispose();});
    }
    const {head,...legacy}=BASE_DESIGN;
    expect(parseDesign(legacy)).toEqual(BASE_DESIGN);
    expect(parseDesign({...legacy,head:'custom'})).toBeNull();
  });

  it('detects a newly colliding pair and rejects invalid saved values',async()=>{
    const template=await fixture();
    const stones=fitStones(template,BASE_DESIGN);
    const crowded={...BASE_DESIGN,shoulder:{...BASE_DESIGN.shoulder,size:1.06 as const},reach:.97 as const};
    expect(findNewIntersection(template,fitStones(template,crowded))).toMatch(/gem_shoulder/);
    const a=stones[2],b=stones[3];
    b.matrix.setPosition(position(a.matrix));
    expect(findNewIntersection(template,stones)).toBeDefined();
    expect(parseDesign(JSON.parse(JSON.stringify(BASE_DESIGN)))).toEqual(BASE_DESIGN);
    expect(parseDesign({...BASE_DESIGN,reach:99})).toBeNull();
    expect(parseDesign({...BASE_DESIGN,center:{cut:'round',size:'1',appearance:'diamond'}})).toBeNull();
  });
});
