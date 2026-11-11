import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

if(typeof Worker!=='undefined'&&MeshoptDecoder.supported){
  try{MeshoptDecoder.useWorkers(1);}
  catch{/* Keep synchronous decoding available when Worker construction is blocked. */}
}

export function jewelryModelLoader(){return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);}
