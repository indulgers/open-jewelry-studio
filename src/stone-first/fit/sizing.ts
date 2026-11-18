// US sizes and inner circumferences follow the Helzberg chart linked from the guide.
const circumferences=[46.8,47.4,48,48.7,49.3,50,50.6,51.2,51.9,52.5,53.1,53.8,54.4,55.1,55.7,56.3,57,57.6,58.3,58.9,59.5];
export const RING_SIZES=circumferences.map((circumference,index)=>({us:4+index/4,circumference}));
export const sizeChartUrl='https://www.helzberg.com/jewelry/gemstone-ring-in-sterling-silver/MTR341.html';
export function isRingSize(value:unknown):value is number{
  return RING_SIZES.some(size=>size.us===value);
}
export function ringSizeDescription(value?:number){
  const size=RING_SIZES.find(item=>item.us===value);
  return size?'美码 '+size.us+' · 参考内周 '+size.circumference+' mm · 待工艺确认':'待工艺确认';
}
