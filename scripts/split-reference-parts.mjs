import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {RING_CATALOG} from '../src/stone-first/catalog.ts';
import {isBandMetal,isShoulderBead,SEAT_Y} from '../src/stone-first/reference/parts.ts';

const codec='EXT_meshopt_compression';
const output='public/models/parts';
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);

function chunk(type,bytes,fill=0){
  const padded=Buffer.concat([bytes,Buffer.alloc((4-bytes.length%4)%4,fill)]);
  const header=Buffer.alloc(8);
  header.writeUInt32LE(padded.length);
  header.write(type,4);
  return Buffer.concat([header,padded]);
}

function writePart(kind,id,source,bin,selected,decodedViews){
  if(!selected.length)return undefined;
  const data=[],bufferViews=[],accessors=[],meshes=[],nodes=[];
  let compressed=0,decoded=0;
  const copyAccessor=index=>{
    const accessor=source.accessors[index];
    const view=source.bufferViews[accessor.bufferView],extension=view.extensions[codec];
    const offset=extension.byteOffset??0,accessorOffset=accessor.byteOffset??0;
    let bytes=bin.subarray(offset,offset+extension.byteLength);
    const length=accessor.count*extension.byteStride;
    // The source GLB may share one index buffer across all meshes. Copy only this accessor.
    if(accessorOffset||length!==view.byteLength){
      if(extension.mode!=='INDICES')throw new Error('Unexpected shared vertex buffer in '+id);
      let unpacked=decodedViews.get(accessor.bufferView);
      if(!unpacked){
        unpacked=new Uint8Array(view.byteLength);
        MeshoptDecoder.decodeGltfBuffer(unpacked,extension.count,extension.byteStride,bytes,extension.mode);
        decodedViews.set(accessor.bufferView,unpacked);
      }
      bytes=MeshoptEncoder.encodeGltfBuffer(unpacked.subarray(accessorOffset,accessorOffset+length),
        accessor.count,extension.byteStride,extension.mode);
    }
    const newIndex=accessors.length;
    accessors.push({...accessor,bufferView:bufferViews.length,byteOffset:0});
    bufferViews.push({...view,byteOffset:decoded,byteLength:length,extensions:{[codec]:{...extension,
      byteOffset:compressed,byteLength:bytes.byteLength,count:accessor.count,
    }}});
    data.push(bytes);
    compressed+=bytes.byteLength;
    decoded+=length+(4-length%4)%4;
    return newIndex;
  };
  for(const [order,node] of selected){
    const mesh=source.meshes[node.mesh];
    const primitives=mesh.primitives.map(primitive=>({...primitive,
      indices:copyAccessor(primitive.indices),
      attributes:Object.fromEntries(Object.entries(primitive.attributes).map(([name,index])=>[name,copyAccessor(index)])),
    }));
    nodes.push({...node,mesh:meshes.length,extras:{sourceOrder:order}});
    meshes.push({...mesh,primitives});
  }
  const manifest={asset:source.asset,nodes,meshes,accessors,bufferViews,scenes:[{nodes:nodes.map((_,i)=>i)}],scene:0,
    buffers:[{byteLength:compressed},{byteLength:decoded,extensions:{[codec]:{fallback:true}}}],
    extensionsUsed:[codec],extensionsRequired:[codec]};
  const json=chunk('JSON',Buffer.from(JSON.stringify(manifest)),0x20);
  const body=chunk('BIN\0',Buffer.concat(data));
  const header=Buffer.alloc(12);
  header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(header.length+json.length+body.length,8);
  const glb=Buffer.concat([header,json,body]);
  const hash=createHash('sha256').update(glb).digest('hex').slice(0,12);
  const path=kind+'/'+id+'-'+hash+'.glb';
  mkdirSync(output+'/'+kind,{recursive:true});
  writeFileSync(output+'/'+path,glb);
  return '/models/parts/'+path;
}

const library={};
for(const {id,model} of RING_CATALOG){
  const bytes=readFileSync('public'+model);
  const jsonSize=bytes.readUInt32LE(12);
  const source=JSON.parse(bytes.toString('utf8',20,20+jsonSize));
  const bin=bytes.subarray(28+jsonSize);
  const groups={head:[],band:[],headStones:[],pave:[],adapter:[]};
  let minX=Infinity,maxX=-Infinity,minY=Infinity;
  source.nodes.forEach((node,order)=>{
    for(const primitive of source.meshes[node.mesh].primitives){
      const {min,max}=source.accessors[primitive.attributes.POSITION];
      minX=Math.min(minX,min[0]);maxX=Math.max(maxX,max[0]);minY=Math.min(minY,min[1]);
    }
    const name=node.name;
    const role=name==='reference_crown_shank_shell'?'adapter':/^gem_(center|halo)/.test(name)?'headStones'
      :name.startsWith('gem_shoulder')||isShoulderBead(id,name)?'pave'
      :name==='metal_reflow_shank'||isBandMetal(id,name)?'band':'head';
    groups[role].push([order,node]);
  });
  const width=maxX-minX,scale=2/width,axisY=minY+width/2,decodedViews=new Map();
  library[id]={scale,axisY,seatY:(SEAT_Y[id]-axisY)*scale,
    head:writePart('heads',id,source,bin,groups.head,decodedViews),
    band:writePart('bands',id,source,bin,groups.band,decodedViews),
    headStones:writePart('stones',id+'-head',source,bin,groups.headStones,decodedViews),
    pave:writePart('stones',id+'-pave',source,bin,groups.pave,decodedViews),
    adapter:writePart('bands',id+'-adapter',source,bin,groups.adapter,decodedViews),
  };
}
writeFileSync('src/stone-first/reference/part-assets.json',JSON.stringify(library,null,2)+'\n');
