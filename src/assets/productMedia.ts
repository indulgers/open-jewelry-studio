export const PRODUCT_VIEWS=['overall','front','side','stone'] as const;
export type ProductView=typeof PRODUCT_VIEWS[number];
export const VIEW_LABELS:Record<ProductView,string>={overall:'整体',front:'正面',side:'镶座侧面',stone:'主石细节'};
export type ProductImage={view:ProductView;url:string;label:string};
export const SAMPLE_IMAGES:ProductImage[]=PRODUCT_VIEWS.map(view=>({view,url:`/media/sample/${view}.jpg`,label:VIEW_LABELS[view]}));
