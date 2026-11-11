import {readFileSync} from 'node:fs';
import {Box3,DoubleSide,Matrix4,Ray,Texture,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RING02_MODEL,RING02_OVAL} from './assets';
import {createGemOptics} from '../../viewer/gemOptics';
import {describe,expect,it} from 'vitest';
import {BASE_DESIGN,REACHES,SIZES,ZONES,parseDesign,prepareTemplate,fitStones,buildMetal,findNewIntersection,paveSpacing,usesAutomaticPave} from './model';

const position=(m:Matrix4)=>new Vector3().setFromMatrixPosition(m);

async function fixture() {
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const scene=async(url:string)=>(await loader.parseAsync(new Uint8Array(readFileSync('public'+url)).buffer,'')).scene;
  const [model,oval]=await Promise.all([scene(RING02_MODEL),scene(RING02_OVAL)]);
  return prepareTemplate(model,oval);
}

describe('ring 02 template',()=>{
  it('reflows the editable halo without moving the four divider stones or orphaning their seats',async()=>{
    const template=await fixture();
    const before=fitStones(template,BASE_DESIGN);
    const nextDesign={...BASE_DESIGN,halo:{...BASE_DESIGN.halo,size:1.06 as const}};
    const after=fitStones(template,nextDesign);
    expect(paveSpacing(before,'halo').count).toBe(12);
    expect(paveSpacing(after,'halo')).toMatchObject({count:8,minGap:expect.any(Number),maxGap:expect.any(Number)});
    expect(paveSpacing(after,'halo').minGap!).toBeGreaterThan(paveSpacing(before,'halo').minGap!);
    expect(after.filter(stone=>stone.source.divider).map(stone=>stone.matrix.toArray()))
      .toEqual(before.filter(stone=>stone.source.divider).map(stone=>stone.matrix.toArray()));
    expect(findNewIntersection(template,after)).toBeUndefined();

    const metal=buildMetal(template,nextDesign,after);
    const dividers=metal.filter(part=>part.name.startsWith('metal_halo_bead_'));
    expect(dividers).toHaveLength(16);
    expect(dividers.every(part=>!part.owned)).toBe(true);
    const seats=metal.filter(part=>part.name.startsWith('gem_halo_segment_')&&part.name.endsWith('_seat'));
    expect(seats).toHaveLength(8);
    const crown=metal.find(part=>part.name==='metal_crown_halo')!.geometry.clone();
    const support=new MeshBVH(crown);
    for(const seat of seats)expect(support.intersectsGeometry(seat.geometry,new Matrix4()),seat.name).toBe(true);
    crown.dispose();
    metal.forEach(part=>{if(part.owned)part.geometry.dispose();});
  });

  it('uses the available shoulder length to change count, mirrors the seats and leaves the lower ring in place',async()=>{
    const template=await fixture();
    const short={...BASE_DESIGN,reach:.97 as const};
    const long={...BASE_DESIGN,reach:1.05 as const};
    const shortened=fitStones(template,short),extended=fitStones(template,long);
    expect(paveSpacing(shortened,'shoulder').count).toBe(10);
    expect(paveSpacing(extended,'shoulder').count).toBe(12);
    expect(paveSpacing(shortened,'shoulder').minGap!).toBeGreaterThan(.08);
    expect(findNewIntersection(template,shortened)).toBeUndefined();
    expect(findNewIntersection(template,extended)).toBeUndefined();
    for(let index=1;index<=6;index++){
      const id=String(index).padStart(2,'0');
      const right=position(extended.find(stone=>stone.name==='gem_shoulder_positive_x_'+id)!.matrix);
      const left=position(extended.find(stone=>stone.name==='gem_shoulder_negative_x_'+id)!.matrix);
      expect(left.toArray()).toEqual([-right.x,right.y,right.z]);
    }

    const metal=buildMetal(template,short,shortened);
    expect(metal.some(part=>part.name.startsWith('metal_shoulder_bead_'))).toBe(false);
    const seats=metal.filter(part=>part.name.startsWith('gem_shoulder_')&&part.name.endsWith('_seat'));
    expect(seats).toHaveLength(10);
    const shank=metal.find(part=>part.name==='metal_shank_with_shoulders')!.geometry.clone();
    const support=new MeshBVH(shank);
    for(const seat of seats)expect(support.intersectsGeometry(seat.geometry,new Matrix4()),seat.name).toBe(true);
    expect(metal.find(part=>part.name==='metal_lower_shank_shell')?.geometry)
      .toBe(template.metal.find(part=>part.name==='metal_lower_shank_shell')?.geometry);
    shank.dispose();
    metal.forEach(part=>{if(part.owned)part.geometry.dispose();});
  });

  it('keeps both inner shoulder stones above the rail as the halo head expands',async()=>{
    const template=await fixture();
    const center={...BASE_DESIGN.center,cut:'oval' as const,size:1.06 as const};
    const designs=[
      {...BASE_DESIGN,center},
      {...BASE_DESIGN,center,reach:.97 as const,shoulder:{...BASE_DESIGN.shoulder,cut:'oval' as const,size:.94 as const}},
    ];
    for(const design of designs){
      const stones=fitStones(template,design);
      const metal=buildMetal(template,design,stones);
      const shank=metal.find(part=>part.name==='metal_shank_with_shoulders')!.geometry.clone();
      const rail=new MeshBVH(shank);
      for(const stone of stones.filter(stone=>stone.zone==='shoulder'&&stone.name.endsWith('_01'))){
        const geometry=stone.geometry.clone();
        const gem=new MeshBVH(geometry);
        const inverse=stone.matrix.clone().invert();
        for(const x of [-.45,-.27,0,.27,.45]){
          const ray=new Ray(new Vector3(x,2,0),new Vector3(0,-1,0));
          const facet=gem.raycastFirst(ray,DoubleSide)!.point;
          const support=rail.raycastFirst(ray.applyMatrix4(stone.matrix),DoubleSide)!.point.applyMatrix4(inverse);
          expect(facet.y-support.y,stone.name+' at '+x).toBeGreaterThan(.05);
        }
        geometry.dispose();
      }
      shank.dispose();
      metal.forEach(part=>{if(part.owned)part.geometry.dispose();});
    }
  });

  it('keeps the shipped model under the download budget and preserves each source stone position',async()=>{
    expect(readFileSync('public'+RING02_MODEL).byteLength).toBeLessThan(1_000_000);
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
    const a=base.find(stone=>stone.name==='gem_halo_segment_1_2')!;
    const b=next.find(stone=>stone.name===a.name)!;
    expect(usesAutomaticPave({...BASE_DESIGN,center:{...BASE_DESIGN.center,cut:'oval'}})).toBe(true);
    expect(position(b.matrix).distanceTo(position(a.matrix))).toBeGreaterThan(0.1);
    expect(b.matrix.getMaxScaleOnAxis()).toBeCloseTo(a.matrix.getMaxScaleOnAxis(),8);
    expect(next.filter(stone=>stone.source.divider).map(stone=>stone.matrix.toArray()))
      .toEqual(base.filter(stone=>stone.source.divider).map(stone=>stone.matrix.toArray()));
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
    expect(findNewIntersection(template,fitStones(template,crowded))).toBeUndefined();
    const a=stones[2],b=stones[3];
    b.matrix.setPosition(position(a.matrix));
    expect(findNewIntersection(template,stones)).toBeDefined();
    expect(parseDesign(JSON.parse(JSON.stringify(BASE_DESIGN)))).toEqual(BASE_DESIGN);
    expect(parseDesign({...BASE_DESIGN,reach:99})).toBeNull();
    expect(parseDesign({...BASE_DESIGN,center:{cut:'round',size:'1',appearance:'diamond'}})).toBeNull();
  });
});
