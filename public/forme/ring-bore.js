// Each motif is a separate solid. Subtract before repeating it; the same cutter
// is rotationally invariant by one motif step because its facet count is a multiple of the repeat count.
export function cutRing(kernel, stock, source, state, normals) {
  const { Manifold, Mesh } = kernel;
  const { count, boreDiameter } = state;
  if (!Number.isFinite(boreDiameter) || boreDiameter < 15 || boreDiameter > 26)
    throw Error('内孔直径须在 15–26 mm 之间');
  const stride = source.positions.length;
  const segments = count * Math.ceil(360 / count);
  // Circumscribe the requested hole: even the center of each facet clears the finger.
  const radius = boreDiameter / 2 / Math.cos(Math.PI / segments);
  let height = 0;
  for (let i = 1; i < stock.positions.length; i += 3) height = Math.max(height, Math.abs(stock.positions[i]));
  const cylinder = Manifold.cylinder(2 * height + 2, radius, radius, segments, true);
  const tool = cylinder.rotate([90, 0, 0]); cylinder.delete();
  const variants = [], copies = [];
  try {
    for (let k = 0; k < count; k++) {
      const variant = (state.mirror || state.arrange === 'alternating') ? k % 2 : 0;
      if (!variants[variant]) {
        const pos = stock.positions.slice(k * stride, (k + 1) * stride);
        const tri = new Uint32Array(source.indices);
        if (state.mirror && variant) for (let j=0;j<tri.length;j+=3) [tri[j],tri[j+1]]=[tri[j+1],tri[j]];
        const input = new Mesh({numProp:3, vertProperties:pos, triVerts:tri});
        input.merge();
        const part = new Manifold(input);
        let diff, oriented;
        try {
          if (part.status() !== 'NoError') throw Error('模组不是封闭实体，无法切内孔；请先修复 STL');
          if (part.volume() < 0) {
            const idx=input.triVerts;
            for(let j=0;j<idx.length;j+=3) [idx[j],idx[j+1]]=[idx[j+1],idx[j]];
            oriented=new Manifold(input);
          }
          diff = (oriented || part).subtract(tool);
          if (diff.status() !== 'NoError') throw Error('圆柱切除失败，请检查模组几何');
          variants[variant] = {mesh:diff.getMesh(), k, removed:(oriented || part).volume()-diff.volume()};
        } finally { diff?.delete(); oriented?.delete(); part.delete(); }
      }
      copies.push(variants[variant]);
    }
  } finally { tool.delete(); }
  let np=0, ni=0;
  for(const {mesh} of copies) {np+=mesh.vertProperties.length; ni+=mesh.triVerts.length;}
  const positions=new Float32Array(np), indices=new Uint32Array(ni);
  let p=0, t=0;
  copies.forEach(({mesh,k:first},k)=>{
    const angle=2*Math.PI*(k-first)/count, c=Math.cos(angle),s=Math.sin(angle);
    const base=p/3,v=mesh.vertProperties;
    for(let j=0;j<v.length;j+=3){
      positions[p++]=c*v[j]+s*v[j+2];positions[p++]=v[j+1];positions[p++]=-s*v[j]+c*v[j+2];
    }
    for(const idx of mesh.triVerts) indices[t++]=base+idx;
  });
  return {...stock,positions,indices,normals:normals(positions,indices),
    boreStatus:!ni?'内孔已切去全部材料，请减小直径':variants.every(x=>x.removed<1e-6)?'圆柱未接触金属；增大内孔直径或减小戒圈基准尺寸':'内孔已切削'};
}
