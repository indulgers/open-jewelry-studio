import {modelAdmin} from './scripts/model-admin/server.ts';
import { defineConfig } from 'vitest/config';
import {RING02_PRECISION_ROUTE,RING02_TEMPLATE} from './src/stone-first/ring02/assets.ts';
import {RING_CATALOG} from './src/stone-first/catalog.ts';
import referenceParts from './src/stone-first/reference/part-assets.json' with {type:'json'};
import {HALO_COMBINATION_ROUTE} from './src/stone-first/reference/parts.ts';
import {STUDIO_ENVIRONMENT} from './src/viewer/studioEnvironment.ts';
import {resolve} from 'node:path';

export default defineConfig({
  build:{rolldownOptions:{input:{shop:resolve('index.html'),admin:resolve('admin/index.html')}}},
  plugins: [modelAdmin(),{
    name:'jewelry-direct-entry-preload',
    apply:'build',
    transformIndexHtml:{
      order:'post',
      handler(_html,{bundle,path}){
        if(path.includes('/admin/'))return;
        const halo=RING_CATALOG[0];
        const entries=[
          ...RING_CATALOG.map(template=>({...template,parametric:false})),
          {...halo,editor:HALO_COMBINATION_ROUTE,parametric:false},
          {...halo,editor:RING02_PRECISION_ROUTE,parametric:true},
        ];
        const parts:Record<string,{head:string;band:string;headStones:string;pave?:string;adapter?:string}>=referenceParts;
        const routes=Object.fromEntries(entries.map(template=>{
          const {parametric}=template;
          const suffix=parametric?'/ring02/Ring02Studio.tsx':'/reference/SourceRingStudio.tsx';
          const editor=Object.values(bundle??{}).find(chunk=>chunk.type==='chunk'&&chunk.facadeModuleId?.endsWith(suffix));
          if(!editor||editor.type!=='chunk')return [template.editor,{assets:[]}];
          const part=parts[template.id];
          return [template.editor,{
            assets:[[STUDIO_ENVIRONMENT.url,'fetch'],...[editor.fileName,...editor.imports].map(file=>['/'+file,'module']),
              ...(parametric?[[template.model,'fetch'],[RING02_TEMPLATE.oval,'fetch']]:[])],
            parts:parametric?undefined:[part.head,part.band,part.headStones,part.pave,part.adapter].filter(Boolean),
            draft:parametric?undefined:'open-jewelry-studio:'+template.revision+(template.id==='ring-02'?':combination':''),
            id:template.id,
          }];
        }));
        // An existing custom draft lets the editor request only the parts it needs.
        return [{tag:'script',injectTo:'head-prepend',children:`
          const entry=${JSON.stringify(routes)}[location.hash];
          let defaultParts=entry?.parts;
          if(entry?.draft){
            try{
              const saved=localStorage.getItem(entry.draft)??(entry.id==='ring-02'?localStorage.getItem(entry.draft.replace(/:combination$/,'')):null);
              const design=JSON.parse(saved??'null')?.design;
              if((design?.headId&&design.headId!==entry.id)||(design?.bandId&&design.bandId!==entry.id))defaultParts=undefined;
            }catch{}
          }
          for(const [href,type] of [...(entry?.assets??[]),...(defaultParts??[]).map(href=>[href,'fetch'])]){
            const link=document.createElement('link');
            link.rel=type==='module'?'modulepreload':'preload';
            if(type!=='module')link.as=type;
            link.crossOrigin='anonymous';
            link.href=href;
            document.head.append(link);
          }`},
          {tag:'script',injectTo:'body',children:`
            if(${JSON.stringify(entries.map(template=>template.editor))}.includes(location.hash)){
              const root=document.getElementById('root');
              if(!root.hasChildNodes())root.innerHTML='<div role="status" aria-label="正在加载三维预览" style="min-height:65vh;display:grid;place-items:center"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#8c6d1f" stroke-width="1.5" stroke-dasharray="38 19"/></svg></div>';
            }`},
        ];
      },
    },
  }],
  server: {
    watch:{usePolling:true,interval:400},
    allowedHosts:['terminal.local'],
    proxy:{'/api/forme':{target:process.env.FORME_API_ORIGIN||'http://127.0.0.1:8787'}},
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], restoreMocks: true },
});
