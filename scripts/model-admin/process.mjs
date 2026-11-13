import {createHash} from 'node:crypto';
import {packRing} from '../pack-ring-02.mjs';
import {readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {splitPackedRing} from '../split-reference-parts.mjs';
import {inspectObj,roles,writeSemanticObj} from './obj.mjs';

export async function processModel(action,job,output,{catalog,seatHeights,referencePartRole,root=fileURLToPath(new URL('../../',import.meta.url))}){
  const bytes=readFileSync(join(job,'original.obj'));
  const mesh=inspectObj(bytes);
  const hash=createHash('sha256').update(bytes).digest('hex');
  function findReference(){
    for(const ring of catalog){
      const directory=join(root,'assets/source',ring.id);
      if(ring.kind==='reference'){
        const data=JSON.parse(readFileSync(join(directory,'source.json'),'utf8'));
        if(data.sourceSha256===hash)return {ring,names:new Map(data.parts.map(({id,name})=>[id,name]))};
      }else if(ring.id==='ring-02'){
        const semantic=readFileSync(join(directory,'source.obj'),'utf8');
        if(semantic.match(/^# Original SHA-256 ([a-f0-9]{64})$/m)?.[1]!==hash)continue;
        const names=new Map();
        for(const object of semantic.split(/^o /m).slice(1)){
          const newline=object.indexOf('\n');
          const name=object.slice(0,newline);
          const faces=object.slice(newline+1);
          let id=Infinity;
          for(const [,a,b,c] of faces.matchAll(/^f (\d+) (\d+) (\d+)$/gm))id=Math.min(id,+a,+b,+c);
          names.set(id,name);
        }
        return {ring,names};
      }
    }
  }
  const known=findReference();
  const width=mesh.max[0]-mesh.min[0];
  const height=mesh.max[1]-mesh.min[1];

  function identify(){
    if(known)return new Map([...known.names].map(([id,name])=>{
      const gem=/^gem_(center|halo|shoulder)(?:_|$)/.exec(name)?.[1];
      const section=referencePartRole(known.ring.id,name);
      return [id,gem??(name.startsWith('unresolved_')?'exclude':section==='pave'?'paveMetal':section)];
    }));
    const stones=mesh.parts.filter(part=>part.faces.length===174);
    const span=part=>Math.max(...part.max.map((value,axis)=>value-part.min[axis]));
    const center=stones.reduce((largest,part)=>!largest||span(part)>span(largest)?part:largest,null);
    const shoulderLimit=center?center.min[1]:mesh.max[1]-height*.15;
    return new Map(mesh.parts.map(part=>{
      if(part===center)return [part.id,'center'];
      if(stones.includes(part))return [part.id,part.max[1]<shoulderLimit?'shoulder':'halo'];
      if(part.max[0]-part.min[0]>width*.7&&part.min[1]<mesh.min[1]+height*.15&&part.max[1]<shoulderLimit)return [part.id,'band'];
      if(part.min[1]>=shoulderLimit)return [part.id,'head'];
      return [part.id,'unassigned'];
    }));
  }

  async function encode(dir,roleFor,{plain,nameFor,filename='ring.glb'}={}){
    const obj=join(dir,'semantic.obj'),glb=join(dir,filename);
    writeFileSync(obj,writeSemanticObj(mesh,roleFor,nameFor));
    await packRing(obj,glb,plain);
    return glb;
  }

  if(action==='analyze'){
    const suggested=identify();
    const glb=await encode(job,id=>suggested.get(id)==='exclude'?'unassigned':suggested.get(id));
    const parts=mesh.parts.map(part=>({
      id:part.id,triangles:part.faces.length,min:part.min,max:part.max,role:suggested.get(part.id)??'unassigned',
    }));
    writeFileSync(join(job,'analysis.json'),JSON.stringify({
      hash,min:mesh.min,max:mesh.max,triangleCount:mesh.triangleCount,sourceUnits:'unknown',
      reference:known?.ring.name,seatY:known?seatHeights[known.ring.id]:null,parts,previewBytes:readFileSync(glb).length,
    }));
  }else if(action==='export'){
    const {seatY,assignments}=JSON.parse(readFileSync(join(output,'review.json'),'utf8'));
    if(typeof seatY!=='number'||!Number.isFinite(seatY)||seatY<=mesh.min[1]||seatY>=mesh.max[1]){
      throw new Error('请输入位于模型 Y 轴范围内的接合点。');
    }
    const assigned=new Map(mesh.parts.map(({id})=>[id,assignments?.[id]]));
    const values=[...assigned.values()];
    if(values.some(role=>!roles.includes(role)||role==='unassigned')||
      !values.includes('head')||!values.includes('band')||values.filter(role=>role==='center').length!==1){
      throw new Error('请标记全部部件（可标为不导出），并确认至少一个戒头和戒圈、恰好一颗主石。');
    }
    const original=known?identify():null;
    const originalRoles=!!original&&[...assigned].every(([id,role])=>original.get(id)===role);
    const profileId=originalRoles&&seatY===seatHeights[known.ring.id]?known.ring.id:undefined;
    const plain=known?.ring.id==='ring-starlight'&&originalRoles?join(root,'assets/source/ring-solstice/source.obj'):undefined;
    const roleByName=new Map();
    const nameFor=(id,role)=>{
      const gem=['center','halo','shoulder'].includes(role);
      const name=original?.get(id)===role?known.names.get(id):
        (role==='exclude'?'unresolved':gem?'gem_'+role:'metal')+'_'+id;
      roleByName.set(name,role);
      return name;
    };
    let glb=await encode(output,id=>assigned.get(id),{nameFor});
    // The clean shank is an alternative used during automatic pavé reflow, not an overlay in the original model.
    if(plain)glb=await encode(output,id=>assigned.get(id),{nameFor,plain,filename:'assembly.glb'});
    const library=splitPackedRing(readFileSync(glb),{
      id:'ring',seatY,output:join(output,'parts'),
      classify(name){
        if(name==='metal_reflow_shank')return 'band';
        const role=roleByName.get(name);
        if(role==='center'||role==='halo')return 'headStones';
        if(role==='shoulder'||role==='paveMetal')return 'pave';
        return role;
      },
    });
    if(plain)rmSync(glb);
    writeFileSync(join(output,'manifest.json'),JSON.stringify({
      sourceSha256:hash,sourceUnits:'unknown',status:'staged',triangleCount:mesh.triangleCount,
      reviewedSeatY:seatY,assignments,profileId,hasReflowShank:!!plain,parts:library,
    },null,2)+'\n');
  }
}
