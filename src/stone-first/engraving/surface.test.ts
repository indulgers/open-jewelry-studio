// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {jewelryModelLoader} from '../../viewer/modelLoader';
import {prepareReferenceGeometry} from '../reference/model';
import parts from '../reference/part-assets.json';
import {engravingSurface} from './surface';
for(const [id,source] of Object.entries(parts))it(id+' has an inner engraving surface',async()=>{
  const data=readFileSync(process.cwd()+'/public'+source.band);
  const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  const {scene}=await jewelryModelLoader().parseAsync(bytes,'');
  const ring=prepareReferenceGeometry(scene,source.scale,source.axisY);
  const surface=engravingSurface(ring.metal);
  try{expect(surface).not.toBeNull();}finally{surface?.dispose();ring.dispose();}
});
