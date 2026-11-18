import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readdirSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import type {CloudStore} from './cloud-store.ts';

export type CommunityStore=Pick<CloudStore,'get'|'put'|'list'|'remove'>;
const etag=(data:Uint8Array)=>'"'+createHash('sha256').update(data).digest('hex')+'"';

// Vite's local backend has one process. Conditional checks and rename run in
// one synchronous section, just as R2 performs an object-level conditional PUT.
export function localCommunityStore(directory:string):CommunityStore {
  return {
    async get(key){
      const path=join(directory,key);
      if(!existsSync(path))return;
      const data=readFileSync(path);
      return new Response(new Uint8Array(data),{headers:{ETag:etag(data)}});
    },
    async put(key,body,_type,condition){
      const bytes=new Uint8Array(await new Response(body).arrayBuffer());
      const path=join(directory,key);
      if(condition&&(existsSync(path)?etag(readFileSync(path)):null)!==condition.etag)return false;
      mkdirSync(dirname(path),{recursive:true,mode:0o700});
      const temporary=path+'.'+randomUUID()+'.tmp';
      try{writeFileSync(temporary,bytes,{mode:0o600});renameSync(temporary,path);}
      finally{rmSync(temporary,{force:true});}
      return true;
    },
    async list(prefix){
      const folder=join(directory,prefix);
      if(!existsSync(folder))return [];
      const visit=(path:string):string[]=>readdirSync(join(directory,path),{withFileTypes:true}).flatMap(entry=>{
        const key=path+entry.name;
        return entry.isDirectory()?visit(key+'/'):entry.name.endsWith('.tmp')?[]:[key];
      });
      return visit(prefix);
    },
    async remove(key){rmSync(join(directory,key),{force:true});},
  };
}
