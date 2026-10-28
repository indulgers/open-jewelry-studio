export type ModelMode='reference'|'procedural'|'gem';
export const REFERENCE_ASSETS={
  model:'/models/reference/six-prong.glb',
  metalEnvironment:'/environments/reference/metal.exr',
  gemEnvironment:'/environments/reference/gem.exr',
  draco:'/draco/',
} as const;
