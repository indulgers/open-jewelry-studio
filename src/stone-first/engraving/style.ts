export const ENGRAVING_FONTS={serif:'宋体',sans:'简洁黑体',italic:'英文斜体'} as const;
export const ENGRAVING_ALIGNS={left:'靠左',center:'居中',right:'靠右'} as const;
export type EngravingStyle={font:keyof typeof ENGRAVING_FONTS;align:keyof typeof ENGRAVING_ALIGNS};
export const DEFAULT_ENGRAVING_STYLE:EngravingStyle={font:'serif',align:'center'};
export function parseEngravingStyle(value:unknown):EngravingStyle|null{
  if(!value||typeof value!=='object')return null;
  const v=value as Record<string,unknown>;
  return typeof v.font==='string'&&Object.hasOwn(ENGRAVING_FONTS,v.font)&&typeof v.align==='string'&&Object.hasOwn(ENGRAVING_ALIGNS,v.align)?{font:v.font as EngravingStyle['font'],align:v.align as EngravingStyle['align']}:null;
}
export function engravingStyleLabel(style=DEFAULT_ENGRAVING_STYLE){return ENGRAVING_FONTS[style.font]+' · '+ENGRAVING_ALIGNS[style.align];}
export function engravingFont(font:EngravingStyle['font']){return font==='sans'?'"PingFang SC", sans-serif':'"Songti SC", "Noto Serif SC", SimSun, serif';}
