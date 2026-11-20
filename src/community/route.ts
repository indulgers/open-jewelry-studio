export function communityMode(hash:string){
  if(hash==='#/community')return 'community';
  if(hash==='#/my-designs'||hash.startsWith('#/my-designs?'))return 'mine';
}
