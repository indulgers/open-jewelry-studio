export const roles=['head','band','center','halo','shoulder','paveMetal','adapter','exclude','unassigned'];
const maxFaces=350_000;
const maxParts=4_000;

export function inspectObj(bytes){
  const lines=new TextDecoder('utf-8',{fatal:true}).decode(bytes).split(/\r?\n/);
  const vertices=[],faces=[],parents=[];
  const find=index=>{
    while(parents[index]!==index){
      parents[index]=parents[parents[index]];
      index=parents[index];
    }
    return index;
  };
  for(const line of lines){
    const value=line.split('#',1)[0].trim();
    if(!value)continue;
    const [tag,...items]=value.split(/\s+/);
    if(tag==='v'){
      const xyz=items.slice(0,3).map(Number);
      if(xyz.length!==3||xyz.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6)||vertices.length>=maxFaces*3)throw new Error('OBJ 顶点无效或超出处理上限。');
      parents.push(vertices.length);
      vertices.push(xyz);
    }
    if(tag!=='f')continue;
    if(items.length<3||faces.length+items.length-2>maxFaces)throw new Error('OBJ 面无效或超过 35 万三角面。');
    const indices=items.map(item=>{
      const value=item.split('/')[0];
      const index=Number(value);
      const resolved=index<0?vertices.length+index:index-1;
      if(!/^-?\d+$/.test(value)||!index||!Number.isInteger(resolved)||resolved<0||resolved>=vertices.length)throw new Error('OBJ 面引用了无效顶点。');
      return resolved;
    });
    for(let n=1;n<indices.length-1;n++){
      const face=[indices[0],indices[n],indices[n+1]];
      if(new Set(face).size!==3)throw new Error('OBJ 包含重复顶点的面。');
      parents[find(face[1])]=find(face[0]);
      parents[find(face[2])]=find(face[0]);
      faces.push(face);
    }
  }
  if(!faces.length)throw new Error('文件里没有可处理的 OBJ 网格。');
  const groups=new Map();
  for(const face of faces){
    const root=find(face[0]);
    const part=groups.get(root)??{id:Infinity,faces:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(const index of face){
      part.id=Math.min(part.id,index+1);
      for(let axis=0;axis<3;axis++){
        part.min[axis]=Math.min(part.min[axis],vertices[index][axis]);
        part.max[axis]=Math.max(part.max[axis],vertices[index][axis]);
      }
    }
    part.faces.push(face);
    groups.set(root,part);
  }
  if(groups.size>maxParts)throw new Error('模型的独立网格过多，请先在建模软件中整理。');
  const parts=[...groups.values()].sort((a,b)=>a.id-b.id);
  const min=[0,1,2].map(axis=>Math.min(...parts.map(part=>part.min[axis])));
  const max=[0,1,2].map(axis=>Math.max(...parts.map(part=>part.max[axis])));
  if(max[0]<=min[0]||max[1]<=min[1]||max[2]<=min[2])throw new Error('请上传完整的立体戒指模型。');
  return {vertices,parts,min,max,triangleCount:faces.length};
}

export function writeSemanticObj(mesh,roleFor,nameFor){
  const rows=mesh.vertices.map(vertex=>'v '+vertex.join(' '));
  for(const part of mesh.parts){
    const role=roleFor(part.id);
    const gem=role==='center'||role==='halo'||role==='shoulder';
    const name=nameFor?.(part.id,role)??(role==='exclude'?'unresolved':gem?'gem_'+role:'metal')+'_'+part.id;
    rows.push('o '+name);
    for(const face of part.faces)rows.push('f '+face.map(index=>index+1).join(' '));
  }
  return rows.join('\n')+'\n';
}
