export type StageMode = 'listing' | 'gallery';
export const STAGE_MODES: {id: StageMode; name: string; note: string}[] = [
  {id: 'listing', name: '纯白 Listing', note: '纯白底 · 适合商品主图'},
  {id: 'gallery', name: '暖调展台', note: '棚拍 sweep · 适合品牌页'},
];
