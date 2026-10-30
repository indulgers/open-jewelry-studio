export type FinishedRingId = 'halo' | 'solitaire' | 'vintage';
export type FinishedRing = {
  id: FinishedRingId;
  name: string;
  note: string;
  url: string;
  draco: string;
  /** Extra rotation applied to the source asset before it is stood on the floor. */
  rotation: [number, number, number];
  /** Replace the model's centre stone with the studio's round brilliant. */
  replaceCenter: boolean;
};

const DRACO = '/draco/';

export const FINISHED_RINGS: FinishedRing[] = [
  {
    id: 'halo',
    name: '经典光环',
    note: '圆形主石 · 光环配钻',
    url: '/models/atelier/ring.glb',
    draco: '',
    rotation: [0, 0, 0],
    replaceCenter: true,
  },
  {
    id: 'solitaire',
    name: '铺钻单钻',
    note: '圆形主石 · 密钉戒臂',
    url: '/models/webgi/ring2_webgi3.glb',
    draco: DRACO,
    rotation: [0, 0, 0],
    replaceCenter: false,
  },
  {
    id: 'vintage',
    name: '复古椭圆',
    note: '椭圆主石 · 复古双圈',
    url: '/models/webgi/ring_webgi.glb',
    draco: DRACO,
    rotation: [-1.574, 0.129, -0.88],
    replaceCenter: false,
  },
];

export function finishedRing(id: FinishedRingId): FinishedRing {
  return FINISHED_RINGS.find((ring) => ring.id === id) ?? FINISHED_RINGS[0];
}
