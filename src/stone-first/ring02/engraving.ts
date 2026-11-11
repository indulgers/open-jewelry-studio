export const ENGRAVING_LIMIT=16;
export function engravingProblem(value:string){
  if(value.length>ENGRAVING_LIMIT)return '刻字最多 '+ENGRAVING_LIMIT+' 个字符。';
  if(!/^[A-Za-z0-9 .&-]*$/.test(value))return '请输入英文字母、数字、空格或 . & - 。';
  return '';
}
