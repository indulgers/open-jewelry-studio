import type {RingDesign,StoneSpec} from './model';

export const RING02_MODEL='/models/atelier/ring-02/ring-v1.glb';
export const RING02_OVAL='/models/atelier/gems/oval.glb';
export const RING02_POSTER='/media/diy/ring-02.jpg';


// One publication record controls the catalog and the demo purchase entry.
export const ORIGINAL_STONE:StoneSpec={cut:'round',size:1,appearance:'diamond'};
const defaultDesign:RingDesign={
  head:'halo',center:ORIGINAL_STONE,halo:ORIGINAL_STONE,shoulder:ORIGINAL_STONE,reach:1,metal:'white',engraving:'',
};

export const RING02_TEMPLATE={
  name:'围钻戒指',
  editor:'#/stonefirst/ring-02',
  revision:'ring-02-source-split-1',
  listed:true,
  description:'四段围钻环绕圆形主石，两侧戒臂各有一列配钻。选好戒头，再搭配戒圈。',
  model:RING02_MODEL,
  oval:RING02_OVAL,
  image:RING02_POSTER,
  defaultDesign,
  // Sample values in whole yuan, pending business approval for live quotes.
  price:{
    version:'ring-02-demo-1',
    base:2280,
    leadTime:'7–10 个工作日',
    head:{halo:0,'four-prong':-200,bezel:-100},
    centerLarge:200,
    accentLarge:80,
    coloredAccent:100,
    longShoulder:120,
  },
} as const;
