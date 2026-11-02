import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const python=process.env.FORME_PYTHON||(existsSync(root+'.venv/bin/python')?root+'.venv/bin/python':'python3');
const geometry=spawn(python,['services/forme/solid_engine.py'],{cwd:root,stdio:'inherit'});
const frontend=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',...process.argv.slice(2)],{cwd:root,stdio:'inherit'});
let stopping=false;
function stop(code=0){
  if(stopping)return;stopping=true;
  geometry.kill('SIGTERM');frontend.kill('SIGTERM');process.exitCode=code;
}
for(const child of [geometry,frontend]){
  child.on('error',error=>{console.error(error.message);stop(1);});
  child.on('exit',code=>stop(code??0));
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
