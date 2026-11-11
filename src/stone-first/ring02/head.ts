import {Vector3} from 'three';
import {metalSetting} from '../geometry';
import {recipeDesign,type Site} from '../recipe';
import {cappedCurve} from '../solid/fusionInput';
import type {FittedStone} from './model';

export const HEADS=[
  ['halo','原款围钻','四段围钻与四颗隔断装饰钻'],
  ['four-prong','四爪单钻','开放式篮托，露出主石侧面'],
  ['bezel','包镶单钻','金属圈贴合主石外缘'],
] as const;
export type Head=typeof HEADS[number][0];

const mountingDesign=recipeDesign('floral-solitaire');
export function buildSolitaireHead(head:Exclude<Head,'halo'>,stone:FittedStone){
  // The prepared gemstone is centered on its girdle. Read both planar axes,
  // so the basket and prongs follow the actual oval mesh as well as the round.
  const size=stone.geometry.boundingBox!.getSize(new Vector3()).multiplyScalar(stone.matrix.getMaxScaleOnAxis());
  const center=new Vector3().setFromMatrixPosition(stone.matrix);
  const rx=size.x/2,rz=size.z/2,r=Math.sqrt(rx*rz);
  const site:Site={id:'head',kind:'main',zone:'center',diameter:2,x:0,y:0,z:0,tilt:0,angle:0,
    mount:head==='bezel'?'bezel':'prong'};
  const parts=metalSetting(mountingDesign,site).map(({name,geometry})=>({
    name:'head-'+name,geometry:geometry.scale(rx,r,rz).translate(center.x,center.y,center.z),owned:true,
  }));
  for(const x of [-1,1])for(const z of [-1,1]){
    const xTop=center.x+x*rx*.69/Math.SQRT2;
    const zTop=center.z+z*rz*.69/Math.SQRT2;
    const geometry=cappedCurve([
      new Vector3(x*2.15,9.65,z*.43),
      new Vector3(x*1.98,10.65,z*.61),
      new Vector3(xTop,center.y-r*.30,zTop),
    ],.19);
    parts.push({name:`head-to-shank-${x}-${z}`,geometry,owned:true});
  }
  return parts;
}
