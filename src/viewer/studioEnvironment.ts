// The same raw HDR feeds both metal reflections and the gem's refraction shader.
// Keep it local so a third-party host cannot interrupt the preview.
export const STUDIO_ENVIRONMENT={
  url:'/environments/catalog-studio.hdr',
  title:'商品柔光棚 · Studio Small 09',
  author:'Sergej Majboroda / Poly Haven',
  sourceUrl:'https://polyhaven.com/a/studio_small_09',
} as const;
