// @vitest-environment node
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {Box3,GLBufferAttribute,Group,Vector3} from 'three';
import {jewelryModelLoader} from '../../viewer/modelLoader';
import {RING_CATALOG} from '../catalog';
import {prepareReferenceRing} from './model';

describe('supplied reference models',()=>{
  for(const template of RING_CATALOG.filter(item=>item.kind==='reference')){
    it(template.id+' preserves the source triangle count and all original gems',async()=>{
      const source=readFileSync(process.cwd()+'/public'+template.model);
      const bytes=source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength);
      const {scene}=await jewelryModelLoader().parseAsync(bytes,'');
      const ring=prepareReferenceRing(scene);
      const manifest=JSON.parse(readFileSync(process.cwd()+'/assets/source/'+template.id+'/source.json','utf8'));
      try{
        expect(ring.stones).toHaveLength(template.stoneCount);
        expect(ring.stones.filter(stone=>stone.zone==='center')).toHaveLength(1);
        const parts=[...ring.metal,...ring.stones];
        expect(parts).toHaveLength(manifest.parts.length);
        expect(parts.reduce((sum,part)=>sum+(part.geometry.index?.count??part.geometry.attributes.position.count)/3,0)).toBe(manifest.sourceTriangles);
        const bounds=new Box3();
        for(const part of parts){
          bounds.union(part.geometry.boundingBox!);
          const positions=part.geometry.getAttribute('position');
          if(positions instanceof GLBufferAttribute)throw new Error('Unexpected GPU attribute');
          expect([...positions.array].every(Number.isFinite)).toBe(true);
        }
        expect(bounds.getSize(new Vector3()).x).toBeCloseTo(2,4);
        expect(Object.values(ring.frames).every(frame=>frame.height>0&&frame.target.every(Number.isFinite))).toBe(true);
      }finally{ring.dispose();}
    });
  }
  it('rejects an empty source instead of pretending the 3D is ready',()=>expect(()=>prepareReferenceRing(new Group())).toThrow('戒指模型为空'));
});
