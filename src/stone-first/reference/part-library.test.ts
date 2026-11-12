// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {RING_CATALOG} from '../catalog';
import {jewelryModelLoader} from '../../viewer/modelLoader';
import {combineReferenceRings,prepareReferenceRing} from './model';
import {applyReferencePave} from './pave';
import {PAVE_DIAMETERS,PAVE_LENGTHS} from './pave-options';
import {createReferenceLibrary} from './part-library';
import assets from './part-assets.json';

const bytes=(url:string)=>Uint8Array.from(readFileSync('public'+url)).buffer;

it('rebuilds existing stock and mixed rings from the published parts',async()=>{
  const originals=await Promise.all(RING_CATALOG.map(async ({id,model})=>{
    const {scene}=await jewelryModelLoader().parseAsync(bytes(model),'');
    return prepareReferenceRing(scene,id);
  }));
  const requests:string[]=[];
  const library=createReferenceLibrary(async url=>{requests.push(url);return bytes(url);});
  try{
    for(const head of originals)for(const band of originals){
      const label=head.id+' × '+band.id;
      const {stock,band:splitBand}=await library.load(head.id!,band.id!);
      const original=combineReferenceRings(head,band);
      expect(stock.frames,label).toEqual(original.frames);
      expect(stock.metal.map(part=>[part.name,part.offsetY]),label).toEqual(original.metal.map(part=>[part.name,part.offsetY]));
      expect(stock.stones.map(stone=>[stone.name,stone.matrix.elements]),label)
        .toEqual(original.stones.map(stone=>[stone.name,stone.matrix.elements]));
      const originals=[...original.metal,...original.stones];
      for(const [index,part] of [...stock.metal,...stock.stones].entries()){
        const previous=originals[index];
        expect(part.geometry.getAttribute('position').count,label).toBe(previous.geometry.getAttribute('position').count);
        expect(part.geometry.boundingBox,label).toEqual(previous.geometry.boundingBox);
        if(head===band){
          for(const attribute of ['position','normal']){
            const actual=part.geometry.getAttribute(attribute).array;
            const expected=previous.geometry.getAttribute(attribute).array;
            expect(Buffer.compare(
              Buffer.from(actual.buffer,actual.byteOffset,actual.byteLength),
              Buffer.from(expected.buffer,expected.byteOffset,expected.byteLength),
            ),label+' '+part.name+' '+attribute).toBe(0);
          }
        }
      }
      for(const diameter of PAVE_DIAMETERS)for(const length of PAVE_LENGTHS){
        const paved=applyReferencePave(stock,splitBand,diameter,length);
        const previous=applyReferencePave(original,band,diameter,length);
        expect(paved.pave,label).toEqual(previous.pave);
        expect(paved.stones.map(stone=>stone.matrix.elements),label).toEqual(previous.stones.map(stone=>stone.matrix.elements));
      }
    }
    expect(new Set(requests).size).toBe(requests.length);
  }finally{library.dispose();originals.forEach(ring=>ring.dispose());}
});

it('shares in-flight parts, requests only the new head, and retries a failed asset',async()=>{
  const requests:string[]=[];
  let fail=true;
  const library=createReferenceLibrary(async url=>{
    requests.push(url);
    if(fail&&url===assets['ring-solstice'].headStones){fail=false;throw new Error('test interruption');}
    return bytes(url);
  });
  const band=assets['ring-starlight'],first=assets['ring-rosette'],second=assets['ring-solstice'];
  try{
    await Promise.all([library.load('ring-rosette','ring-starlight'),library.load('ring-rosette','ring-starlight')]);
    expect(requests.sort()).toEqual([first.head,first.headStones,band.band,band.pave].sort());
    requests.length=0;
    await expect(library.load('ring-solstice','ring-starlight')).rejects.toThrow('test interruption');
    expect(requests.sort()).toEqual([second.head,second.headStones].sort());
    requests.length=0;
    await library.load('ring-solstice','ring-starlight');
    expect(requests).toEqual([second.headStones]);
  }finally{library.dispose();}
});
