import {rmSync} from 'node:fs';

// These assets and their renders are for local reference only.
for(const path of ['models/webgi/','models/reference/','environments/reference/','media/sample/']){
  rmSync(new URL('../dist/'+path,import.meta.url),{recursive:true,force:true});
}

// Production models and campaign files are served from the private R2 inventory.
for(const path of ['models/','media/'])rmSync(new URL('../dist/'+path,import.meta.url),{recursive:true,force:true});
