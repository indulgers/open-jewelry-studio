import {describe,expect,it} from 'vitest';
import {DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {createRingShankGeometry} from './WearableAdapters';
import {ringSizing} from './wearableGeometry';

describe('real ring shank mesh, not only a sizing formula',()=>{
  it.each([16,18,21])('finger-axis ray crosses the %s mm bore unobstructed, and strikes band material',diameter=>{
    const geom=createRingShankGeometry(diameter);
    const mesh=new Mesh(geom,new MeshBasicMaterial({side:DoubleSide}));
    mesh.updateMatrixWorld(true);
    const origin=new Vector3(-4,0,0),axis=new Vector3(1,0,0);
    expect(new Raycaster(origin,axis,0,8).intersectObject(mesh)).toHaveLength(0);
    const r=ringSizing(diameter);
    const bandY=(r.modeledInnerRadius+r.outerRadius)/2;
    expect(new Raycaster(new Vector3(-4,bandY,0),axis,0,8).intersectObject(mesh).length).toBeGreaterThan(0);
    geom.dispose();(mesh.material as MeshBasicMaterial).dispose();
  });
});
