// The same raw HDR feeds both metal reflections and the gem's refraction shader.
// Keep it local so a third-party host cannot interrupt the preview.
export const STUDIO_ENVIRONMENT={
  url:'/environments/peppermint_powerplant_2_1k.hdr',
  title:'Peppermint Powerplant 2',
  author:'Andreas Mischok',
  sourceUrl:'https://polyhaven.com/a/peppermint_powerplant_2',
} as const;
