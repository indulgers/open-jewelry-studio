import {rmSync} from 'node:fs';

// These assets and their renders are for local reference only.
for(const path of ['models/webgi/','models/reference/','environments/reference/','media/sample/']){
  rmSync(new URL('../dist/'+path,import.meta.url),{recursive:true,force:true});
}
