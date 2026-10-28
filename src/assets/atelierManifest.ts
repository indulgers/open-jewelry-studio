export const ATELIER_RING='/models/atelier/ring.glb';
const shapes=[
  ['round','圆形'],['oval','椭圆形'],['pear','梨形'],['cushion','枕形'],['princess','公主方'],
  ['heart','心形'],['marquise','马眼形'],['octagon','八方形'],['hexagon','六角形'],
  ['triangle','三角形'],['half-moon','半月形'],['square-small-octagon','正小八角'],
  ['square-bevel','正方倒角'],['straight-triangle','直三角'],['wide-triangle','肥三角'],
  ['wide-square','肥正方'],['elongated-small-octagon','长小八角'],['rectangle-bevel','长方倒角'],['rectangle','长方形'],
] as const;
export type GemShapeId=typeof shapes[number][0];
export const ATELIER_GEMS=shapes.map(([id,name])=>({id,name,url:`/models/atelier/gems/${id}.glb`}));
export function atelierGem(id:GemShapeId){return ATELIER_GEMS.find(gem=>gem.id===id)??ATELIER_GEMS[0];}
